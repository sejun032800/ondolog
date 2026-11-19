"""74-k1 새 secret key 헤더 (R89-3 · R89-4). 네트워크·원격 접속 없음 - urlopen을 가로채 요청 헤더만 본다.

- 새 키(`sb_…`)는 `apikey` 헤더에만 싣고 `Authorization: Bearer <키>`는 보내지 않는다.
- legacy JWT(`eyJ…`)는 지금 방식 그대로(`apikey` + `Authorization: Bearer <키>`).
- 오류 문구에는 키 · 키 접두어 뒤 글자가 없고, 인증 거부일 때 "키 형태: legacy / new"만 남는다.

가짜 키만 쓴다. 저장소 키 모양 검사(R87-6)에 걸리지 않도록 실행 중에 이어 붙여 만든다.

실행 (저장소 루트에서): render/.venv/Scripts/python.exe -B -m unittest discover -s render/tests
"""

import io
import os
import sys
import unittest
import urllib.error
from unittest import mock

sys.dont_write_bytecode = True
HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, '..'))
sys.path.insert(0, HERE)

import render_issue as r  # noqa: E402
import seed_render_tests as seed  # noqa: E402

URL = 'https://abcdefghij1234567890.supabase.co'
FAKE_NEW = '_'.join(['sb', 'secret', 'test' + 'fakevalue' * 3])
FAKE_LEGACY = '.'.join(['ey' + 'J' + 'fakeheader' * 2, 'fakepayload' * 2, 'fakesignature' * 2])
NEW_TAIL = FAKE_NEW[len('sb_secret_'):]


class _Res:
    def __init__(self, status: int, body: bytes) -> None:
        self.status = status
        self._body = body

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc) -> None:
        return None


class Capture:
    """urlopen 대역 - 요청을 모으고 정해 둔 상태 · 본문을 돌려준다."""

    def __init__(self, status: int = 200, body: bytes = b'[]') -> None:
        self.status = status
        self.body = body
        self.requests: list = []

    def __call__(self, req, timeout=None):
        self.requests.append(req)
        if self.status >= 400:
            raise urllib.error.HTTPError(req.full_url, self.status, 'x', {}, io.BytesIO(self.body))
        return _Res(self.status, self.body)

    def headers(self, i: int = -1) -> dict[str, str]:
        return {k.lower(): v for k, v in self.requests[i].header_items()}


def call_all(api: r.Api) -> None:
    """Api가 원격에 보내는 모든 길(REST 조회 · 갱신 · Storage 내려받기 · 올리기 · 목록 · 지우기)을 한 번씩 부른다."""
    api.select('issues', 'select=id')
    api.update('issues', 'id=eq.x', {'a': 1})
    api.storage_get('b', 'p.png')
    api.storage_list('b', 'pre')
    api.storage_remove('b', ['p.png'])


class KeyKind(unittest.TestCase):
    def test_kind_is_decided_by_prefix_only(self):
        self.assertEqual(r.key_kind(FAKE_NEW), 'new')
        self.assertEqual(r.key_kind('_'.join(['sb', 'publishable', 'fakevalue'])), 'new')
        self.assertEqual(r.key_kind(FAKE_LEGACY), 'legacy')

    def test_new_key_goes_only_in_apikey(self):
        self.assertEqual(r.auth_headers(FAKE_NEW), {'apikey': FAKE_NEW})

    def test_legacy_key_keeps_both_headers(self):
        self.assertEqual(r.auth_headers(FAKE_LEGACY), {'apikey': FAKE_LEGACY, 'Authorization': f'Bearer {FAKE_LEGACY}'})


class RequestHeaders(unittest.TestCase):
    def run_all(self, key: str) -> Capture:
        cap = Capture(200, b'[]')
        with mock.patch.object(r.urllib.request, 'urlopen', cap):
            call_all(r.Api(URL, key))
        cap.status = 201
        with mock.patch.object(r.urllib.request, 'urlopen', cap):
            r.Api(URL, key).storage_put('b', 'p.pdf', b'%PDF', 'application/pdf')
        return cap

    def test_new_key_every_request_has_apikey_and_no_authorization(self):
        cap = self.run_all(FAKE_NEW)
        self.assertEqual(len(cap.requests), 6)
        for i in range(len(cap.requests)):
            h = cap.headers(i)
            self.assertEqual(h.get('apikey'), FAKE_NEW)
            self.assertNotIn('authorization', h)
            self.assertFalse(any(FAKE_NEW in v for k, v in h.items() if k != 'apikey'))

    def test_legacy_key_every_request_is_unchanged(self):
        cap = self.run_all(FAKE_LEGACY)
        self.assertEqual(len(cap.requests), 6)
        for i in range(len(cap.requests)):
            h = cap.headers(i)
            self.assertEqual(h.get('apikey'), FAKE_LEGACY)
            self.assertEqual(h.get('authorization'), f'Bearer {FAKE_LEGACY}')

    def test_call_headers_still_merge(self):
        cap = Capture(201, b'{}')
        with mock.patch.object(r.urllib.request, 'urlopen', cap):
            r.Api(URL, FAKE_NEW).storage_put('b', 'p.pdf', b'%PDF', 'application/pdf')
        h = cap.headers()
        self.assertEqual(h.get('content-type'), 'application/pdf')
        self.assertEqual(h.get('x-upsert'), 'true')
        self.assertNotIn('authorization', h)

    def test_seed_api_uses_the_same_headers(self):
        cap = Capture(201, b'[{"id": "x"}]')
        with mock.patch.object(r.urllib.request, 'urlopen', cap):
            seed.SeedApi(URL, FAKE_NEW).insert('t', [{'a': 1}])
        cap.body = b'{"id": "x"}'
        with mock.patch.object(r.urllib.request, 'urlopen', cap):
            seed.SeedApi(URL, FAKE_NEW).create_user('someone@example.invalid')
        for i in range(2):
            h = cap.headers(i)
            self.assertEqual(h.get('apikey'), FAKE_NEW)
            self.assertNotIn('authorization', h)


class ErrorText(unittest.TestCase):
    def assert_clean(self, text: str, key: str) -> None:
        self.assertNotIn(key, text)
        self.assertNotIn(NEW_TAIL, text)
        self.assertNotIn('sb_', text)
        self.assertNotIn('Bearer', text)
        self.assertNotIn(key[:12], text)

    def errors(self, key: str, status: int) -> list[str]:
        out: list[str] = []
        body = b'{"statusCode": "403", "error": "Unauthorized", "message": "Invalid Compact JWS"}'
        api = r.Api(URL, key)
        calls = [
            lambda: api.select('issues', 'select=id'),
            lambda: api.update('issues', 'id=eq.x', {'a': 1}),
            lambda: api.storage_get('b', 'p.png'),
            lambda: api.storage_put('b', 'p.pdf', b'%PDF', 'application/pdf'),
            lambda: api.storage_list('b', 'pre'),
            lambda: api.storage_remove('b', ['p.png']),
            lambda: seed.SeedApi(URL, key).insert('t', [{'a': 1}]),
            lambda: seed.SeedApi(URL, key).create_user('someone@example.invalid'),
        ]
        with mock.patch.object(r.urllib.request, 'urlopen', Capture(status, body)):
            for c in calls:
                with self.assertRaises((RuntimeError, r.StopError)) as ctx:
                    c()
                out.append(str(ctx.exception))
        return out

    def test_auth_failure_says_only_the_key_kind(self):
        for key, kind in ((FAKE_NEW, 'new'), (FAKE_LEGACY, 'legacy')):
            for status in (401, 403):
                for text in self.errors(key, status):
                    self.assertIn(f'키 형태: {kind}', text)
                    self.assert_clean(text, key)

    def test_other_failures_add_nothing(self):
        for text in self.errors(FAKE_NEW, 500):
            self.assertNotIn('키 형태', text)
            self.assert_clean(text, FAKE_NEW)

    def test_missing_key_message_has_no_key(self):
        with mock.patch.dict(os.environ, {'ONDOLOG_SUPABASE_URL': URL, 'ONDOLOG_SUPABASE_SERVICE_ROLE_KEY': ''}):
            with self.assertRaises(r.StopError) as ctx:
                r.connect()
        self.assertNotIn('sb_', str(ctx.exception))

    def test_redact_hides_a_new_key(self):
        self.assertEqual(r.redact(f'x {FAKE_NEW} y', [FAKE_NEW]), 'x [REDACTED] y')


if __name__ == '__main__':
    unittest.main()
