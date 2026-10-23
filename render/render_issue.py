"""운영자 명령 3 - 렌더 (M2-c `55-1`). 위임: .claude/state/prompts/phase-7/55-1-corner-pipeline-render-plumbing.md

초안 호 하나를 디지털 PDF 1개 + 쪽마다 이미지 1장으로 렌더해 `magazine` 버킷에 올리고,
`issues.pdf_digital_path`·`page_count`·`cover_path`(1쪽 이미지)를 채운다. 실행 위치는 운영자 PC(R13-5).

규칙 (MASTER 9-5 · 17-0-10-D)
- Playwright(Chromium): `print_background=True`, margin 0 + CSS padding, `wait_until='networkidle'`, 출력 파일명 ASCII.
- **사진은 P7이 복제한 목적지 사본(`magazine` 버킷)을 읽는다**(R21-2). 원본(`entries`)은 읽지 않는다.
- 렌더는 발행 전에 한 번이다. **발행된 호는 다시 렌더하지 않는다.**
- 지면은 임시 지면(`render/_placeholder/issue.html`)이다. 진짜 지면은 `55-2`.

service_role 키 (CLAUDE.md 절대 규칙 7): 환경변수 `ONDOLOG_SUPABASE_URL`·`ONDOLOG_SUPABASE_SERVICE_ROLE_KEY`로만 읽는다.
앱 코드는 이 폴더를 import하지 않는다. **값은 화면·파일·로그·보고 어디에도 쓰지 않는다**(출력은 `redact`를 거친다).
접속 대상이 개발 프로젝트가 아니거나 시험 커플이 아니면 쓰기 전에 멈춘다(`scripts/ops/opsGuards.ts`와 같은 확인).

사용 (저장소 루트에서):
    render/.venv/Scripts/python.exe render/render_issue.py --issue-id <uuid>
산출은 `render/out/<issue_id>/`(추적 안 함)에 남고, 같은 파일이 버킷에도 올라간다.
"""

from __future__ import annotations

import sys

sys.dont_write_bytecode = True

import argparse
import json
import os
import re
import struct
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Optional

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
sys.path.insert(0, str(HERE))

from slot_fill import fill  # noqa: E402

DEVELOPMENT_PROJECT_NAME = 'ondolog'
TEST_MARK = 'test'
MAGAZINE_BUCKET = 'magazine'
LINKED_PROJECT_FILE = REPO / 'supabase' / '.temp' / 'linked-project.json'
PLACEHOLDER = HERE / '_placeholder' / 'issue.html'
OUT_ROOT = HERE / 'out'

# 설정값 - 하드코딩이 아니라 인수로 바꿀 수 있다(CLAUDE.md: PDF 프로필 config화는 M4-3, 여기는 digital 하나)
IMAGE_WIDTH_PX = 1170
JPEG_QUALITY = 85
PHOTO_LIMIT = 4  # 임시 지면에 싣는 사진 수
A4_WIDTH_CSS_PX = 210 / 25.4 * 96

CORNER_LABELS = {'date_archive': '데이트 아카이브', 'sweet_words': '다정한 말들', 'this_month': '이달의 우리'}
STATUS_LABELS = {'ready': '준비됨', 'pending': '대기 중', 'skipped': '건너뜀', 'failed': '실패', 'published': '발행됨'}


class StopError(Exception):
    """멈춤 - 안전 확인에 걸렸거나 전제가 빠졌다. 고치지 않고 이 지점에서 알린다."""


# ---------------------------------------------------------------------------
# 안전 확인 (opsGuards.ts와 같은 규칙)
# ---------------------------------------------------------------------------

def project_ref_from_url(url: str) -> str:
    m = re.match(r'^https://([a-z0-9]{10,32})\.supabase\.co/?$', url.strip())
    if m is None:
        raise StopError('접속 URL이 https://<프로젝트 ref>.supabase.co 모양이 아니다')
    return m.group(1)


def assert_development_project(url: str, linked_json: Optional[str]) -> str:
    ref = project_ref_from_url(url)
    if linked_json is None:
        raise StopError('supabase/.temp/linked-project.json이 없어 접속 대상이 개발 프로젝트인지 확인할 수 없다')
    try:
        linked = json.loads(linked_json)
        linked_ref, linked_name = linked['ref'], linked['name']
        if not isinstance(linked_ref, str) or not isinstance(linked_name, str):
            raise TypeError
    except (ValueError, KeyError, TypeError):
        raise StopError('supabase/.temp/linked-project.json에 ref·name이 없다') from None
    if linked_name != DEVELOPMENT_PROJECT_NAME:
        raise StopError(f'연결된 프로젝트 이름이 {DEVELOPMENT_PROJECT_NAME}이 아니다 ({linked_name})')
    if linked_ref != ref:
        raise StopError('접속 URL의 프로젝트가 연결된 개발 프로젝트와 다르다')
    return ref


def has_test_mark(name: Optional[str]) -> bool:
    return isinstance(name, str) and TEST_MARK in name.lower()


def redact(text: str, secrets: list[str]) -> str:
    for s in secrets:
        if len(s) >= 8:
            text = text.replace(s, '[REDACTED]')
    return text


# ---------------------------------------------------------------------------
# 저장소 접근 (REST - service_role, 개발 프로젝트)
# ---------------------------------------------------------------------------

class Api:
    def __init__(self, url: str, key: str) -> None:
        self.base = url.strip().rstrip('/')
        self.key = key

    def _request(self, method: str, path: str, body: Optional[bytes] = None, headers: Optional[dict[str, str]] = None) -> tuple[int, bytes]:
        h = {'apikey': self.key, 'Authorization': f'Bearer {self.key}'}
        h.update(headers or {})
        req = urllib.request.Request(self.base + path, data=body, method=method, headers=h)
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                return res.status, res.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()

    def select(self, table: str, query: str) -> list[dict[str, Any]]:
        status, data = self._request('GET', f'/rest/v1/{table}?{query}')
        if status != 200:
            raise RuntimeError(f'{table} 조회 실패 (HTTP {status})')
        return json.loads(data)

    def update(self, table: str, query: str, patch: dict[str, Any]) -> list[dict[str, Any]]:
        status, data = self._request(
            'PATCH', f'/rest/v1/{table}?{query}', json.dumps(patch).encode(),
            {'Content-Type': 'application/json', 'Prefer': 'return=representation'},
        )
        if status not in (200, 204):
            raise RuntimeError(f'{table} 갱신 실패 (HTTP {status})')
        return json.loads(data) if data else []

    def storage_get(self, bucket: str, path: str) -> Optional[bytes]:
        status, data = self._request('GET', f'/storage/v1/object/authenticated/{bucket}/{urllib.parse.quote(path)}')
        if status == 200:
            return data
        if status in (400, 404):
            return None
        raise RuntimeError(f'storage 내려받기 실패 (HTTP {status})')

    def storage_put(self, bucket: str, path: str, content: bytes, content_type: str) -> None:
        status, _ = self._request(
            'POST', f'/storage/v1/object/{bucket}/{urllib.parse.quote(path)}', content,
            {'Content-Type': content_type, 'x-upsert': 'true'},
        )
        if status not in (200, 201):
            raise RuntimeError(f'storage 올리기 실패 (HTTP {status}) {path}')

    def storage_list(self, bucket: str, prefix: str) -> list[str]:
        status, data = self._request(
            'POST', f'/storage/v1/object/list/{bucket}', json.dumps({'prefix': prefix, 'limit': 1000}).encode(),
            {'Content-Type': 'application/json'},
        )
        if status != 200:
            raise RuntimeError(f'storage 목록 조회 실패 (HTTP {status})')
        return [f['name'] for f in json.loads(data)]

    def storage_remove(self, bucket: str, paths: list[str]) -> None:
        if not paths:
            return
        status, _ = self._request(
            'DELETE', f'/storage/v1/object/{bucket}', json.dumps({'prefixes': paths}).encode(),
            {'Content-Type': 'application/json'},
        )
        if status != 200:
            raise RuntimeError(f'storage 지우기 실패 (HTTP {status})')


# ---------------------------------------------------------------------------
# 지면에 실을 값 (순수 함수)
# ---------------------------------------------------------------------------

def media_paths_of(corner_type: str, content: Any) -> list[str]:
    """저장된 코너 content가 싣고 있는 사진 경로 - `scripts/ops/mediaCopy.ts`의 `mediaPathsOf`와 같은 규칙(CORNER_CONTENT §2·§7)."""
    if not isinstance(content, dict) or not isinstance(content.get('payload'), dict):
        return []
    payload = content['payload']
    paths: list[str] = []
    articles = payload.get('articles')
    for article in articles if isinstance(articles, list) else []:
        if not isinstance(article, dict):
            continue
        if corner_type == 'date_archive':
            for stop in article.get('stops') or []:
                for photo in (stop.get('photos') if isinstance(stop, dict) else None) or []:
                    if isinstance(photo, dict) and isinstance(photo.get('path'), str):
                        paths.append(photo['path'])
        elif corner_type == 'this_month':
            for ev in article.get('evidence') or []:
                if isinstance(ev, dict) and ev.get('type') == 'photo' and isinstance(ev.get('photoPath'), str):
                    paths.append(ev['photoPath'])
    return paths


def issue_name(issue: dict[str, Any]) -> str:
    title = issue.get('title')
    if isinstance(title, str) and title.strip():
        return title
    if issue.get('issue_type') == 'monthly':
        return f"{int(issue['period_start'][5:7])}월호"
    return str(issue['period_start'])


def pick_photos(corners: list[dict[str, Any]], limit: int) -> list[str]:
    """지면 순서(seq)대로 실린 사진 경로, 중복 없이 앞에서 `limit`장."""
    seen: list[str] = []
    for corner in sorted(corners, key=lambda c: c.get('seq') or 0):
        if corner.get('status') != 'ready':
            continue
        for p in media_paths_of(corner['corner_type'], corner.get('content')):
            if p not in seen:
                seen.append(p)
    return seen[:limit]


def build_view(issue: dict[str, Any], couple: dict[str, Any], corners: list[dict[str, Any]], photo_src: dict[str, str]) -> dict[str, Any]:
    """슬롯 채움 모듈에 넘길 데이터. 호·기간·코너별 상태와 제목·실린 사진 - 있는 값만 싣는다."""
    rows = []
    for corner in sorted(corners, key=lambda c: c.get('seq') or 0):
        ready = corner.get('status') == 'ready'
        content = corner.get('content') if isinstance(corner.get('content'), dict) else {}
        header = content.get('header') if isinstance(content.get('header'), dict) else {}
        rows.append({
            'label': CORNER_LABELS.get(corner['corner_type'], corner['corner_type']),
            'statusLabel': STATUS_LABELS.get(corner.get('status'), str(corner.get('status'))),
            'view': 'ready' if ready else 'absent',
            'title': header.get('title') if ready else None,
            'periodLabel': header.get('periodLabel') if ready else None,
            'reason': None if ready else (corner.get('skip_reason') or corner.get('last_error')),
        })
    photos = [photo_src[p] for p in pick_photos(corners, PHOTO_LIMIT) if p in photo_src]
    return {
        'issue': {
            'name': issue_name(issue),
            'couple': couple.get('nickname'),
            'period': f"{issue['period_start']} ~ {issue['period_end']}",
            'hasPhotos': len(photos) > 0,
        },
        'corners': rows,
        'photos': photos,
    }


# ---------------------------------------------------------------------------
# 파일 해석
# ---------------------------------------------------------------------------

def jpeg_size(data: bytes) -> tuple[int, int]:
    """JPEG 머리에서 (가로, 세로). SOF 표지를 찾는다."""
    if data[:2] != b'\xff\xd8':
        raise ValueError('JPEG가 아니다')
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        (length,) = struct.unpack('>H', data[i + 2:i + 4])
        if marker in (0xC0, 0xC1, 0xC2):
            height, width = struct.unpack('>HH', data[i + 5:i + 9])
            return width, height
        i += 2 + length
    raise ValueError('JPEG 크기를 읽을 수 없다')


def pdf_page_count(pdf: bytes) -> int:
    return len(re.findall(rb'/Type\s*/Page(?![A-Za-z])', pdf))


def ascii_name(name: str) -> str:
    if not re.fullmatch(r'[A-Za-z0-9._-]+', name):
        raise StopError(f'출력 파일명이 ASCII 영문·숫자·-·_·. 가 아니다 ({name})')
    return name


# ---------------------------------------------------------------------------
# 렌더 (Playwright)
# ---------------------------------------------------------------------------

def render_pdf_and_images(html_file: Path, image_width: int, jpeg_quality: int) -> tuple[bytes, list[bytes]]:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            context = browser.new_context(
                viewport={'width': 794, 'height': 1123},
                device_scale_factor=image_width / A4_WIDTH_CSS_PX,
            )
            page = context.new_page()
            page.goto(html_file.as_uri(), wait_until='networkidle')
            pdf = page.pdf(
                width='210mm', height='297mm', print_background=True,
                margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'},
                prefer_css_page_size=True,
            )
            sheets = page.locator('.page')
            images = [
                sheets.nth(i).screenshot(type='jpeg', quality=jpeg_quality)
                for i in range(sheets.count())
            ]
        finally:
            browser.close()
    return pdf, images


# ---------------------------------------------------------------------------
# 명령
# ---------------------------------------------------------------------------

def connect() -> tuple[Api, str, list[str]]:
    url = os.environ.get('ONDOLOG_SUPABASE_URL', '')
    key = os.environ.get('ONDOLOG_SUPABASE_SERVICE_ROLE_KEY', '')
    if not url:
        raise StopError('환경변수 ONDOLOG_SUPABASE_URL이 없다')
    if not key:
        raise StopError('환경변수 ONDOLOG_SUPABASE_SERVICE_ROLE_KEY가 없다')
    linked = LINKED_PROJECT_FILE.read_text(encoding='utf-8') if LINKED_PROJECT_FILE.exists() else None
    ref = assert_development_project(url, linked)
    return Api(url, key), ref, [key]


def render_issue(api: Api, issue_id: str, image_width: int = IMAGE_WIDTH_PX, jpeg_quality: int = JPEG_QUALITY,
                 say=print) -> dict[str, Any]:
    issues = api.select('issues', f'select=*&id=eq.{urllib.parse.quote(issue_id)}')
    if not issues:
        raise StopError(f'없는 호다 ({issue_id})')
    issue = issues[0]
    couples = api.select('couples', f"select=id,status,nickname&id=eq.{issue['couple_id']}")
    if not couples:
        raise StopError(f"호의 커플이 없다 ({issue['couple_id']})")
    couple = couples[0]
    if not has_test_mark(couple.get('nickname')):
        raise StopError(f"렌더 명령은 시험 커플에만 돈다 - couples.nickname에 '{TEST_MARK}'가 없다 (couple {couple['id']})")
    if issue.get('published_at') is not None:
        raise StopError(f'이미 발행된 호다 - 렌더는 발행 전에 한 번이다 ({issue_id})')

    corners = api.select('corners', f'select=*&issue_id=eq.{issue_id}&order=seq.asc')
    if not any(c.get('status') == 'ready' for c in corners):
        raise StopError(f'ready 코너가 없어 지면을 만들지 않는다 ({issue_id})')

    work = OUT_ROOT / issue_id / 'work'
    (work / 'photos').mkdir(parents=True, exist_ok=True)

    # 사진 - 목적지 사본(magazine 버킷)만 읽는다(R21-2)
    photo_src: dict[str, str] = {}
    for path in pick_photos(corners, PHOTO_LIMIT):
        parts = path.split('/')
        if len(parts) != 3 or parts[0] != issue['couple_id'] or parts[1] != issue_id:
            raise StopError(f'content의 사진 경로가 이 호의 목적지 경로가 아니다 ({path})')
        data = api.storage_get(MAGAZINE_BUCKET, path)
        if data is None:
            raise StopError(f'목적지에 사진이 없다 - 복제(P7)가 먼저다 ({path})')
        name = ascii_name(parts[2])
        (work / 'photos' / name).write_bytes(data)
        photo_src[path] = f'photos/{name}'

    html = fill(PLACEHOLDER.read_text(encoding='utf-8'), build_view(issue, couple, corners, photo_src))
    html_file = work / 'issue.html'
    html_file.write_text(html, encoding='utf-8', newline='\n')

    pdf, images = render_pdf_and_images(html_file, image_width, jpeg_quality)
    if not images:
        raise StopError('지면(.page)이 하나도 없다')
    counted = pdf_page_count(pdf)
    if counted != len(images):
        raise StopError(f'PDF 쪽 수({counted})와 지면 수({len(images)})가 다르다')
    for i, img in enumerate(images, 1):
        width, _ = jpeg_size(img)
        if width != image_width:
            raise StopError(f'{i}쪽 이미지 가로가 {width}px이다 (기대 {image_width}px)')

    out = OUT_ROOT / issue_id
    pdf_name = ascii_name('issue.pdf')
    (out / pdf_name).write_bytes(pdf)
    image_names = [ascii_name(f'page-{i:02d}.jpg') for i in range(1, len(images) + 1)]
    for name, img in zip(image_names, images):
        (out / name).write_bytes(img)

    # 업로드 - 먼저 세 필드를 비운다(중간에 멎어도 낡은 값이 남지 않는다)
    folder = f"{issue['couple_id']}/{issue_id}/render"
    api.update('issues', f'id=eq.{issue_id}&published_at=is.null',
               {'pdf_digital_path': None, 'page_count': None, 'cover_path': None})
    api.storage_remove(MAGAZINE_BUCKET, [f'{folder}/{n}' for n in api.storage_list(MAGAZINE_BUCKET, folder)])
    api.storage_put(MAGAZINE_BUCKET, f'{folder}/{pdf_name}', pdf, 'application/pdf')
    for name, img in zip(image_names, images):
        api.storage_put(MAGAZINE_BUCKET, f'{folder}/{name}', img, 'image/jpeg')

    updated = api.update('issues', f'id=eq.{issue_id}&published_at=is.null', {
        'pdf_digital_path': f'{folder}/{pdf_name}',
        'page_count': len(images),
        'cover_path': f'{folder}/{image_names[0]}',
    })
    if len(updated) != 1:
        raise StopError(f'issues 갱신이 한 행이 아니다 ({len(updated)})')

    report = {
        'issueId': issue_id,
        'pdf': str(out / pdf_name),
        'pdfBytes': len(pdf),
        'images': [{'file': str(out / n), 'bytes': len(b), 'size': list(jpeg_size(b))} for n, b in zip(image_names, images)],
        'pageCount': len(images),
        'bucketPaths': [f'{folder}/{pdf_name}'] + [f'{folder}/{n}' for n in image_names],
        'issuesFields': {k: updated[0][k] for k in ('pdf_digital_path', 'page_count', 'cover_path')},
    }
    say(json.dumps(report, ensure_ascii=False, indent=2))
    return report


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description='초안 호를 디지털 PDF + 페이지 이미지로 렌더한다(임시 지면).')
    parser.add_argument('--issue-id', required=True)
    parser.add_argument('--image-width', type=int, default=IMAGE_WIDTH_PX)
    parser.add_argument('--jpeg-quality', type=int, default=JPEG_QUALITY)
    args = parser.parse_args(argv)
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    secrets: list[str] = []
    try:
        api, ref, secrets = connect()
        print(redact(f'접속 대상: 개발 프로젝트 {DEVELOPMENT_PROJECT_NAME} ({ref}) - 확인됨', secrets))
        render_issue(api, args.issue_id, args.image_width, args.jpeg_quality, say=lambda s: print(redact(s, secrets)))
    except StopError as e:
        print(redact(f'멈춤: {e}', secrets), file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
