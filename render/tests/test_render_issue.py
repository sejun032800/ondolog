"""렌더 명령의 순수 부분 + 오프라인 렌더 시험 (위임: 55-1). 네트워크·원격 접속 없음.

실행 (저장소 루트에서): render/.venv/Scripts/python.exe -B -m unittest discover -s render/tests
"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import render_issue as r  # noqa: E402
from slot_fill import fill  # noqa: E402

REF = 'abcdefghij1234567890'
URL = f'https://{REF}.supabase.co'
LINKED = json.dumps({'ref': REF, 'name': 'ondolog'})
COUPLE = 'c0000000-0000-4000-8000-000000000001'
ISSUE = 'i0000000-0000-4000-8000-000000000001'


class Guards(unittest.TestCase):
    def test_development_project_is_confirmed(self):
        self.assertEqual(r.assert_development_project(URL, LINKED), REF)

    def test_stops_when_not_development(self):
        with self.assertRaises(r.StopError):
            r.assert_development_project(URL, None)
        with self.assertRaises(r.StopError):
            r.assert_development_project(URL, json.dumps({'ref': REF, 'name': 'ondolog-prod'}))
        with self.assertRaises(r.StopError):
            r.assert_development_project(URL, json.dumps({'ref': 'zzzzzzzzzz1234567890', 'name': 'ondolog'}))
        with self.assertRaises(r.StopError):
            r.assert_development_project('http://localhost:54321', LINKED)
        with self.assertRaises(r.StopError):
            r.assert_development_project(URL, '{not json')

    def test_test_mark_and_redact(self):
        self.assertTrue(r.has_test_mark('Test-couple'))
        self.assertFalse(r.has_test_mark('우리'))
        self.assertFalse(r.has_test_mark(None))
        self.assertEqual(r.redact('key=SECRET-VALUE-123 end', ['SECRET-VALUE-123']), 'key=[REDACTED] end')

    def test_output_names_are_ascii_only(self):
        self.assertEqual(r.ascii_name('page-01.jpg'), 'page-01.jpg')
        for bad in ('페이지.jpg', 'a b.jpg', 'a(1).jpg', 'a/b.jpg'):
            with self.assertRaises(r.StopError):
                r.ascii_name(bad)


def date_archive(paths):
    return {'header': {'title': '데이트 아카이브', 'periodLabel': '2026년 9월'},
            'payload': {'articles': [{'stops': [{'photos': [{'path': p} for p in paths]}]}]}}


def this_month(paths):
    return {'header': {'title': '이달의 우리'},
            'payload': {'articles': [{'evidence': [{'type': 'photo', 'photoPath': p} for p in paths] + [{'type': 'chat'}]}]}}


P = [f'{COUPLE}/{ISSUE}/e{i}.png' for i in range(1, 7)]
CORNERS = [
    {'seq': 1, 'corner_type': 'date_archive', 'status': 'ready', 'content': date_archive(P[:3])},
    {'seq': 2, 'corner_type': 'sweet_words', 'status': 'skipped', 'skip_reason': 'insufficient_input', 'content': {}},
    {'seq': 3, 'corner_type': 'this_month', 'status': 'ready', 'content': this_month([P[2], P[3], P[4], P[5]])},
]
ISSUE_ROW = {'id': ISSUE, 'couple_id': COUPLE, 'issue_type': 'monthly', 'period_start': '2026-09-01', 'period_end': '2026-09-30', 'title': None}


class View(unittest.TestCase):
    def test_media_paths_follow_the_stored_schema(self):
        self.assertEqual(r.media_paths_of('date_archive', date_archive(['a', 'b'])), ['a', 'b'])
        self.assertEqual(r.media_paths_of('this_month', this_month(['x'])), ['x'])
        self.assertEqual(r.media_paths_of('sweet_words', {'payload': {'articles': []}}), [])
        self.assertEqual(r.media_paths_of('date_archive', {}), [])

    def test_pick_photos_in_seq_order_without_duplicates_and_only_ready(self):
        picked = r.pick_photos(CORNERS, 4)
        self.assertEqual(picked, P[:4])
        corners = [dict(CORNERS[0], status='pending')] + CORNERS[1:]
        self.assertEqual(r.pick_photos(corners, 4), P[2:6])

    def test_issue_name(self):
        self.assertEqual(r.issue_name(ISSUE_ROW), '9월호')
        self.assertEqual(r.issue_name({**ISSUE_ROW, 'title': '가을'}), '가을')
        self.assertEqual(r.issue_name({**ISSUE_ROW, 'issue_type': 'daily'}), '2026-09-01')

    def test_view_carries_only_values_that_exist(self):
        src = {p: f'photos/{p.split("/")[-1]}' for p in P}
        v = r.build_view(ISSUE_ROW, {'nickname': 'test-x'}, CORNERS, src)
        self.assertEqual([c['view'] for c in v['corners']], ['ready', 'absent', 'ready'])
        self.assertEqual(v['corners'][1]['reason'], 'insufficient_input')
        self.assertIsNone(v['corners'][1]['title'])
        self.assertEqual(len(v['photos']), 4)
        self.assertTrue(v['issue']['hasPhotos'])

    def test_placeholder_fills_with_the_slot_module(self):
        src = {p: f'photos/{p.split("/")[-1]}' for p in P}
        html = fill(r.PLACEHOLDER.read_text(encoding='utf-8'), r.build_view(ISSUE_ROW, {'nickname': 'test-x'}, CORNERS, src))
        self.assertIn('9월호', html)
        self.assertIn('2026-09-01 ~ 2026-09-30', html)
        self.assertIn('데이트 아카이브', html)
        self.assertIn('사유: <span>insufficient_input</span>', html)
        self.assertEqual(html.count('<img'), 4)
        self.assertNotIn('data-slot', html)
        self.assertNotIn('실린 사진 없음', html)

    def test_placeholder_without_photos_drops_the_photo_block_and_says_so(self):
        corners = [{'seq': 1, 'corner_type': 'date_archive', 'status': 'ready', 'content': date_archive([])}]
        html = fill(r.PLACEHOLDER.read_text(encoding='utf-8'), r.build_view(ISSUE_ROW, {'nickname': None}, corners, {}))
        self.assertNotIn('<img', html)
        self.assertNotIn('class="photos"', html)
        self.assertIn('실린 사진 없음', html)


class Files(unittest.TestCase):
    def test_jpeg_size_and_pdf_pages(self):
        jpeg = b'\xff\xd8' + b'\xff\xe0\x00\x04\x00\x00' + b'\xff\xc0\x00\x0b\x08\x04\x00\x04\x92\x01\x01\x11\x00'
        self.assertEqual(r.jpeg_size(jpeg), (1170, 1024))
        self.assertEqual(r.pdf_page_count(b'<</Type /Pages>> <</Type /Page /X>> <</Type/Page>>'), 2)


class OfflineRender(unittest.TestCase):
    """실제 Chromium으로 임시 지면을 렌더한다 - 가로 1170px 이미지, 쪽 수 일치, 한글 글리프."""

    def test_render_placeholder_to_pdf_and_images(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            (work / 'photos').mkdir()
            html = fill(r.PLACEHOLDER.read_text(encoding='utf-8'), r.build_view(ISSUE_ROW, {'nickname': 'test-x'}, CORNERS, {}))
            f = work / 'issue.html'
            f.write_text(html, encoding='utf-8')
            pdf, images = r.render_pdf_and_images(f, r.IMAGE_WIDTH_PX, r.JPEG_QUALITY)
            self.assertEqual(len(images), 1)
            self.assertEqual(r.pdf_page_count(pdf), 1)
            self.assertEqual(r.jpeg_size(images[0])[0], 1170)
            self.assertTrue(pdf.startswith(b'%PDF'))


if __name__ == '__main__':
    unittest.main()
