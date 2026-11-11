"""운영자 명령 3 - 렌더 (M2-c `55-1` 배관 · `55-2` 지면). 위임: .claude/state/prompts/phase-7/55-2-corner-pipeline-render-binding.md

초안 호 하나를 `render/issue/pages/*.html`(디자인이 넘긴 슬롯 계약 HTML)에 채워 디지털 PDF 1개 + 쪽마다 이미지 1장으로 렌더해
`magazine` 버킷에 올리고, `issues.pdf_digital_path`·`page_count`·`cover_path`(1쪽 이미지)를 채운다. 실행 위치는 운영자 PC(R13-5).

규칙 (MASTER 9-5 · 17-0-10-D)
- Playwright(Chromium): `print_background=True`, margin 0 + CSS padding, `wait_until='networkidle'`, 출력 파일명 ASCII.
- **지면 HTML 구조는 고치지 않는다**(R23-2) - 슬롯 채움 모듈이 `data-*` 표시만 채운다. 어느 지면을 어떤 데이터로 채울지는 `compose.py`.
- **사진은 P7이 복제한 목적지 사본(`magazine` 버킷)을 읽는다**(R21-2). 원본(`entries`)은 읽지 않는다.
- 렌더는 발행 전에 한 번이다. **발행된 호는 다시 렌더하지 않는다.**
- **견본 사진(`render/issue/images/sample/`)은 렌더 작업 폴더에 복사하지 않고, 결과 HTML에 그 경로가 남으면 실패다.**
- 지면 검사(`page_audit.py`)는 렌더 결과에 돌고, 기존 기준 위반은 렌더를 실패시키지 않고 `audit.json`에 남긴다.

service_role 키 (CLAUDE.md 절대 규칙 7): 환경변수 `ONDOLOG_SUPABASE_URL`·`ONDOLOG_SUPABASE_SERVICE_ROLE_KEY`로만 읽는다.
앱 코드는 이 폴더를 import하지 않는다. **값은 화면·파일·로그·보고 어디에도 쓰지 않는다**(출력은 `redact`를 거친다).
접속 대상이 개발 프로젝트가 아니거나 시험 커플이 아니면 쓰기 전에 멈춘다(`scripts/ops/opsGuards.ts`와 같은 확인).

사용 (저장소 루트에서):
    render/.venv/Scripts/python.exe render/render_issue.py --issue-id <uuid>
산출은 `render/out/<issue_id>/`(추적 안 함)에 남고, 같은 PDF·이미지가 버킷에도 올라간다.
    issue.pdf · page-NN.jpg · audit.json(지면 검사) · compose.json(지면 구성·문장 출처 근거)
"""

from __future__ import annotations

import sys

sys.dont_write_bytecode = True

import argparse
import io
import json
import os
import re
import shutil
import struct
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Callable, Optional

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
sys.path.insert(0, str(HERE))

from compose import ComposeError, Composition, PageSpec, choose_variant, compose_issue  # noqa: E402
from page_audit import (  # noqa: E402
    audit_page, compare_with_design, design_audit_js, mark_original_overset, original_clipped, original_overset, recorded_clipped,
)
from slot_fill import fill  # noqa: E402
from photo_fit import PhotoFitError, fit_photo, load_config as load_render_config, metadata_found, summarize  # noqa: E402

from bs4 import BeautifulSoup  # noqa: E402

DEVELOPMENT_PROJECT_NAME = 'ondolog'
TEST_MARK = 'test'
MAGAZINE_BUCKET = 'magazine'
LINKED_PROJECT_FILE = REPO / 'supabase' / '.temp' / 'linked-project.json'
ISSUE_DIR = HERE / 'issue'
PAGES_DIR = ISSUE_DIR / 'pages'
TOOLS_DIR = ISSUE_DIR / 'tools'
ASSETS = ('base.css', 'themes', 'fonts')  # 작업 폴더로 복사하는 것 - 견본 사진(images/)은 복사하지 않는다
SAMPLE_MARK = 'images/sample'
OUT_ROOT = HERE / 'out'

# 설정값 - 렌더 설정 파일 하나(`render/render_config.json`, R86-2)에서 읽는다. 디지털 DPI만은 `app_config.pdf_profiles.digital.dpi`(R86-1)
try:
    CONFIG = load_render_config()
except PhotoFitError as _e:
    raise SystemExit(f'멈춤: {_e}') from None
IMAGE_WIDTH_PX = int(CONFIG['pageImageWidthPx'])
JPEG_QUALITY = int(CONFIG['pageImageJpegQuality'])
PHOTO_JPEG_QUALITY = int(CONFIG['photoJpegQuality'])
DIGITAL_PDF_MAX_MB = float(CONFIG['digitalPdfMaxMb'])
MB = 1024 * 1024
A4_WIDTH_CSS_PX = 210 / 25.4 * 96
VIEWPORT = {'width': 794, 'height': 1123}


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


UUID_RE = re.compile(r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}')


def storage_error_summary(body: bytes) -> str:
    """Storage 오류 응답 본문 -> `code=… error=… message=…`(짧게). 주소 · id는 지운다. 본문이 JSON이 아니면 `본문 해석 불가`."""
    try:
        data = json.loads(body.decode('utf-8', 'replace'))
    except ValueError:
        return '본문 해석 불가'
    if not isinstance(data, dict):
        return '본문 해석 불가'
    parts = []
    for key in ('statusCode', 'error', 'message'):
        v = data.get(key)
        if v is not None:
            text = re.sub(r'https?://\S+', '[주소]', UUID_RE.sub('[id]', str(v)))
            parts.append(f"{'code' if key == 'statusCode' else key}={text[:80]}")
    return ' '.join(parts) or '본문 해석 불가'


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

    def select_all(self, table: str, query: str, page: int = 1000) -> list[dict[str, Any]]:
        """PostgREST 한 번의 행 상한을 넘는 조회는 쪼개 읽는다."""
        rows: list[dict[str, Any]] = []
        while True:
            chunk = self.select(table, f'{query}&limit={page}&offset={len(rows)}')
            rows.extend(chunk)
            if len(chunk) < page:
                return rows

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
        status, body = self._request(
            'POST', f'/storage/v1/object/{bucket}/{urllib.parse.quote(path)}', content,
            {'Content-Type': content_type, 'x-upsert': 'true'},
        )
        if status not in (200, 201):
            # 74-h5b ⑤: 응답 본문의 오류 분류만 남긴다. 경로 대신 파일 이름(마지막 조각)만 - 커플 · 호 id가 들어가지 않는다
            raise StopError(f'storage 올리기 실패 (HTTP {status}, {storage_error_summary(body)}) {path.rsplit("/", 1)[-1]}')

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
# 재료 집계 - 발행 노트의 "모은 양"(CORNER_LAYOUT §3-0 "원재료 수집 단계의 카운트")
# ---------------------------------------------------------------------------

def _in(ids: list[str]) -> str:
    return '(' + ','.join(ids) + ')'


def _chunks(values: list[str], size: int = 100) -> list[list[str]]:
    return [values[i:i + size] for i in range(0, len(values), size)]


def collect_materials(api: Any, issue: dict[str, Any], couple: dict[str, Any]) -> dict[str, int]:
    """호의 기간에 속한 대화·데이트·사진·메모의 수. 입력 조립(`inputAssembly.ts`)과 같은 조건(커플·미삭제·열람 가능)을 건다.

    기간은 KST `[period_start 00:00, period_end 다음 날 00:00)`. 의미 없는 조각(F-2)은 빼지 않는다 - 모은 양이다.
    """
    cid = urllib.parse.quote(str(couple['id']))
    start = str(issue['period_start'])
    end = str(issue['period_end'])
    after_end = (date.fromisoformat(end) + timedelta(days=1)).isoformat()
    lo = urllib.parse.quote(f'{start}T00:00:00+09:00')
    hi = urllib.parse.quote(f'{after_end}T00:00:00+09:00')
    visible = '' if couple.get('subscription_tier') == 'paid' else '&access_locked=eq.false'

    messages = api.select_all('messages', f'select=id&couple_id=eq.{cid}&deleted_at=is.null&body=not.is.null&sent_at=gte.{lo}&sent_at=lt.{hi}')
    dates = api.select_all('dates', f'select=id&couple_id=eq.{cid}&deleted_at=is.null&date_on=gte.{start}&date_on=lte.{end}')
    date_ids = [str(d['id']) for d in dates]
    stop_ids: list[str] = []
    for chunk in _chunks(date_ids):
        stop_ids.extend(str(s['id']) for s in api.select_all('date_stops', f'select=id&couple_id=eq.{cid}&date_id=in.{_in(chunk)}'))

    base = f'select=id,entry_type&couple_id=eq.{cid}&deleted_at=is.null{visible}'
    photos = {str(e['id']) for e in api.select_all('data_entries', f'{base}&entry_type=eq.photo&captured_at=gte.{lo}&captured_at=lt.{hi}')}
    memos: set[str] = set()
    linked: list[dict[str, Any]] = []
    for chunk in _chunks(date_ids):
        linked.extend(api.select_all('data_entries', f'{base}&date_id=in.{_in(chunk)}'))
    for chunk in _chunks(stop_ids):
        linked.extend(api.select_all('data_entries', f'{base}&date_stop_id=in.{_in(chunk)}'))
    for e in linked:  # 데이트·구간에 묶인 항목 - 사진은 촬영 시각 조건과 합집합, 메모는 묶인 것만
        if e['entry_type'] == 'photo':
            photos.add(str(e['id']))
        elif e['entry_type'] == 'memo':
            memos.add(str(e['id']))
    return {'messages': len(messages), 'dates': len(dates), 'photos': len(photos), 'memos': len(memos)}


def couple_names(api: Any, couple: dict[str, Any]) -> list[str]:
    """두 사람의 표시 이름 - user_a, user_b 순서."""
    names = []
    for key in ('user_a_id', 'user_b_id'):
        uid = couple.get(key)
        if not uid:
            continue
        rows = api.select('profiles', f'select=display_name&id=eq.{urllib.parse.quote(str(uid))}')
        if rows and isinstance(rows[0].get('display_name'), str):
            names.append(rows[0]['display_name'])
    return names


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
# 지면 만들기 (채움 -> 작업 폴더)
# ---------------------------------------------------------------------------

def load_templates(pages_dir: Path = PAGES_DIR) -> dict[str, str]:
    return {p.stem: p.read_text(encoding='utf-8') for p in sorted(pages_dir.glob('*.html'))}


COUNT_CELL_SLOTS = ('@da.articleCaptionCount', '@da.articlePhotoCount', '@da.articleNoteCount', '@da.photoCount')   # 마지막은 오프너 `이날의 기록`의 사진 칸


def drop_empty_count_cells(html: str) -> str:
    """기사 칸(오프너 `이날의 기록` 포함)의 숫자 칸 중 값이 빈 것을 라벨째 뺀다 (R50-4 AI 캡션 · R51-5 사진 · 메모 0) + 타임라인의 `사진 0` 라벨.

    값이 빈 것은 호출부가 0을 빈 값으로 건넨 칸이다(`compose`) - 사실이지만 빈칸 · 고장으로 읽히는 `0`을 싣지 않는다.
    지면 HTML에 이 칸을 뺄 표시(`data-optional`)가 없다 - 디자인 v1.2.3 전 임시로 렌더러가 뺀다(R50-6의 허용 자리 밖이라 HTML은 고치지 않았다).
      - `COUNT_CELL_SLOTS` 칸: 슬롯의 부모 `<span>`(숫자 + 라벨)을 지운다. 그 줄에 칸이 남지 않으면 줄도 지운다.
      - `.photoLabel`: 슬롯이 빈 `.lbl`(`사진 <값>`)을 지운다.
    채운 값이 있으면 아무것도 하지 않는다.
    """
    if not any(name in html for name in (*COUNT_CELL_SLOTS, '.photoLabel')):
        return html
    soup = BeautifulSoup(html, 'html.parser')
    changed = False
    for name in COUNT_CELL_SLOTS:
        for el in soup.select(f'[data-slot="{name}"]'):
            if el.get_text(strip=True) == '' and el.parent is not None and el.parent.name == 'span':
                row = el.parent.parent
                el.parent.decompose()
                changed = True
                if row is not None and row.name == 'div' and not row.find(True):
                    row.decompose()
    for el in soup.select('[data-slot=".photoLabel"]'):
        if el.get_text(strip=True) == '' and el.parent is not None and 'lbl' in (el.parent.get('class') or []):
            el.parent.decompose()
            changed = True
    return str(soup) if changed else html


drop_empty_caption_cell = drop_empty_count_cells   # 이전 이름 - 같은 함수다


# R51-2 - 발행 노트 이번 기간 표 아래에 따로 놓는 한 줄. 지면 HTML에 자리가 없다 - 디자인 v1.2.3 전 임시로 렌더러가 표 뒤에 끼운다(R50-6의 허용 자리 밖이라 HTML은 고치지 않았다).
# 표(수집한 재료)는 네 줄이면 아래 블록(문장의 출처 `top:520px`)에 바짝 닿아 있어 줄이 들어갈 틈이 없다 - 줄을 끼울 때만 그 아래 두 블록(`520px` · `650px`)을 같은 만큼 내린다.
# 재소환 사진이 0이면 이 함수는 아무것도 하지 않는다(틀 그대로 - 줄도 이동도 없다).
NOTE_RECALLED_LINE = ('<span class="note" style="display:block;margin-top:14px">'
                      '<span data-slot="@note.recalledPhotosLine"></span></span>')
NOTE_BLOCK_TOPS = ((520, 556), (650, 686))   # (원래 top, 줄을 끼웠을 때 top) - 줄 높이 약 16px + 위 여백 14px에 숨 쉴 틈을 더한 36px


def add_note_recalled_line(template: str) -> str:
    """`note` 지면 틀의 수집 재료 표(`</table>`) 바로 뒤에 재소환 사진 줄을 끼우고 그 아래 두 블록을 내린다. 표나 블록이 틀에 하나씩 없으면 StopError - 자리를 짐작하지 않는다."""
    if template.count('</table>') != 1:
        raise StopError('발행 노트 틀에 표(</table>)가 하나가 아니다 - 재소환 사진 줄 자리를 정할 수 없다')
    for old, _ in NOTE_BLOCK_TOPS:
        if template.count(f'top:{old}px') != 1:
            raise StopError(f'발행 노트 틀에 top:{old}px 블록이 하나가 아니다 - 재소환 사진 줄 때문에 내릴 블록을 정할 수 없다')
    out = template.replace('</table>', '</table>' + NOTE_RECALLED_LINE, 1)
    for old, new in NOTE_BLOCK_TOPS:
        out = out.replace(f'top:{old}px', f'top:{new}px', 1)
    return out


def as_dict_note(spec: PageSpec) -> dict:
    note = (spec.computed or {}).get('note')
    return note if isinstance(note, dict) else {}


def fill_page(spec: PageSpec, theme: str, templates: dict[str, str]) -> str:
    """지면 하나를 채운다. 테마는 `<html data-theme>` 값 하나만 바꾼다(README §4)."""
    if spec.stem not in templates:
        raise StopError(f'지면 HTML이 없다 ({spec.stem})')
    template = templates[spec.stem]
    if spec.stem == 'note' and as_dict_note(spec).get('recalledPhotosLine'):
        template = add_note_recalled_line(template)
    html = fill(template, spec.corner, spec.computed, spec.bind,
                chooser=lambda names, scope: choose_variant(spec, names, scope), widths=spec.widths)
    html = drop_empty_count_cells(html)
    html, n = re.subn(r'(<html\b[^>]*\bdata-theme=")[^"]*(")', rf'\g<1>{theme}\g<2>', html, count=1)
    if n != 1:
        raise StopError(f'지면에 <html data-theme>가 없다 ({spec.stem})')
    return html


def prepare_work(work: Path) -> None:
    """작업 폴더에 스타일·테마·폰트를 복사한다. **견본 사진(images/)은 복사하지 않는다.**"""
    if work.exists():
        shutil.rmtree(work)
    (work / 'pages').mkdir(parents=True)
    (work / 'photos').mkdir()
    for name in ASSETS:
        src = ISSUE_DIR / name
        if src.is_dir():
            shutil.copytree(src, work / name)
        else:
            shutil.copy2(src, work / name)


COVER_PROBE_JS = r"""
() => {
  const SAFE = {left: 68 - 0.5, right: 794 - 68 + 0.5, top: 60 - 0.5, bottom: 1123 - 76 + 0.5};
  const out = {headlineClipped: false, quote: null};
  const h = document.querySelector('[data-slot="@cover.headline"]');
  if (h) out.headlineClipped = h.scrollHeight - h.clientHeight > 1;
  const q = document.querySelector('[data-slot="@cover.quote"]');
  if (!q) return out;
  const row = q.closest('[data-optional]') || q;
  let box = null;
  const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const rg = document.createRange();
    rg.selectNodeContents(n);
    for (const r of rg.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue;
      box = box ? {left: Math.min(box.left, r.left), top: Math.min(box.top, r.top), right: Math.max(box.right, r.right),
                   bottom: Math.max(box.bottom, r.bottom)} : {left: r.left, top: r.top, right: r.right, bottom: r.bottom};
    }
  }
  if (!box) return out;
  const reasons = [];
  if (box.left < SAFE.left || box.right > SAFE.right || box.top < SAFE.top || box.bottom > SAFE.bottom) reasons.push('safe');
  const host = row.closest('body > .ab');
  for (const o of document.querySelectorAll('body > .ab')) {
    if (o === host || o.contains(row) || !o.textContent.trim()) continue;
    const r = o.getBoundingClientRect();
    const ox = Math.min(box.right, r.right) - Math.max(box.left, r.left);
    const oy = Math.min(box.bottom, r.bottom) - Math.max(box.top, r.top);
    if (ox > 2 && oy > 2) reasons.push('overlap:' + (o.className || '?'));
  }
  out.quote = {fits: reasons.length === 0, reasons: reasons, box: [Math.round(box.left), Math.round(box.top), Math.round(box.right), Math.round(box.bottom)]};
  return out;
}
"""


def settle_cover(composition: Composition, templates: dict[str, str], work: Path, say: Callable[[str], None] = lambda s: None) -> dict[str, Any]:
    """표지를 한 번 열어 보고 원문이 잘리거나 규격에 안 들어가는 자리를 정리한다 (55-3 범위 4-④, README §12). 작업 폴더가 준비된 뒤에 부른다.

    - **이 달의 말**: 자리를 그대로 두고, 판면 밖이거나 다른 글자와 겹치면 **줄째 지운다**(`computed.cover.quote`·`quoteBy`를 비운다 -> `data-optional`이 줄을 지운다).
    - **표제가 이 달의 말로 바뀐 표지**(표제를 3줄·6자로 못 나눴을 때): 표제 칸이 `clamp`라 원문이 잘리면, 원문을 자르지 않고 나뉘지 않은 `theme.headline`로 되돌린다
      (그것도 없으면 표제를 비운다). 온도록이 쓴 표제는 잘려도 기록이다.
    결과는 `composition.report`에 남긴다(`coverQuoteRemoved` · `coverHeadlineFrom`).
    """
    spec = composition.pages[0]
    outcome: dict[str, Any] = {'quoteRemoved': False, 'headlineReverted': False}
    cover = spec.computed.get('cover')
    if spec.stem not in ('cover-photo', 'cover-type') or not isinstance(cover, dict):
        return outcome
    from playwright.sync_api import sync_playwright

    probe_file = work / 'pages' / '_cover-probe.html'

    def probe(page: Any) -> dict[str, Any]:
        probe_file.write_text(fill_page(spec, composition.theme, templates), encoding='utf-8', newline='\n')
        page.goto(probe_file.as_uri(), wait_until='networkidle')
        page.evaluate('document.fonts.ready.then(() => true)')
        return page.evaluate(COVER_PROBE_JS)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_context(viewport=VIEWPORT).new_page()
            result = probe(page)
            if composition.report.get('coverHeadlineFrom') == 'quote' and result['headlineClipped']:
                unsplit = composition.report.get('coverHeadlineUnsplit') or ''
                cover['headline'] = unsplit
                composition.report['coverHeadlineFrom'] = 'theme.headline-unsplit' if unsplit else 'none'
                outcome['headlineReverted'] = True
                say('표지: 이 달의 말을 표제로 쓰면 잘린다 - 원문을 자르지 않고 표제를 나뉘지 않은 이달의 우리 표제로 되돌렸다')
                result = probe(page)
            quote = result.get('quote')
            if quote is not None and not quote['fits']:
                cover['quote'] = ''
                cover['quoteBy'] = ''
                outcome['quoteRemoved'] = True
                outcome['reasons'] = quote['reasons']
                say(f"표지: 이 달의 말이 규격에 들어가지 않아 줄째 지웠다 ({', '.join(quote['reasons'])})")
        finally:
            browser.close()
    probe_file.unlink(missing_ok=True)
    composition.report['coverQuoteRemoved'] = outcome['quoteRemoved']
    return outcome


def build_pages(composition: Composition, templates: dict[str, str], work: Path, issue: dict[str, Any],
                fetch: Callable[[str], Optional[bytes]]) -> list[Path]:
    """채운 지면을 `work/pages/NN-<stem>.html`로 쓴다. 사진은 목적지 사본을 받아 `work/photos/`에 두고 상대 경로로 잇는다."""
    local: dict[str, str] = {}
    for dest in composition.shown_photos:
        parts = dest.split('/')
        if len(parts) != 3 or parts[0] != issue['couple_id'] or parts[1] != issue['id']:
            raise StopError(f'content의 사진 경로가 이 호의 목적지 경로가 아니다 ({dest})')
        data = fetch(dest)
        if data is None:
            raise StopError(f'목적지에 사진이 없다 - 복제(P7)가 먼저다 ({dest})')
        name = ascii_name(parts[2])
        (work / 'photos' / name).write_bytes(data)
        local[dest] = f'../photos/{name}'

    files: list[Path] = []
    for n, spec in enumerate(composition.pages, 1):
        html = fill_page(spec, composition.theme, templates)
        for dest, rel in local.items():
            html = html.replace(f'src="{dest}"', f'src="{rel}"')
        if SAMPLE_MARK in html:
            raise StopError(f'결과 HTML에 견본 사진 경로가 남았다 ({spec.stem}) - 견본은 렌더 결과에 들어가면 안 된다')
        for src in re.findall(r'<img\b[^>]*\bsrc="([^"]*)"', html):
            if not src.startswith('../photos/') or not (work / 'pages' / src).resolve().exists():
                raise StopError(f'채운 지면의 이미지 경로가 작업 폴더의 사진이 아니다 ({spec.stem}: {src})')
        f = work / 'pages' / f'{n:02d}-{ascii_name(spec.stem + ".html")}'
        f.write_text(html, encoding='utf-8', newline='\n')
        files.append(f)
    if (work / 'images').exists():
        raise StopError('작업 폴더에 images/가 있다 - 견본 사진이 복사됐다')
    return files


# ---------------------------------------------------------------------------
# 사진 맞춤 (74-h5b) - 칸 크기 × 디지털 DPI · 메타데이터 0
# ---------------------------------------------------------------------------

def read_digital_dpi(api: Any) -> float:
    """`app_config.pdf_profiles.digital.dpi`를 읽기만 한다(R86-1). 읽지 못하거나 양수가 아니면 멈춘다 - 기본값으로 메우지 않는다.
    인쇄용(`print`) 값은 읽지 않는다 - 이 렌더는 디지털 하나다."""
    try:
        rows = api.select('app_config', 'select=value&key=eq.pdf_profiles')
    except RuntimeError as e:
        raise StopError(f'디지털 DPI를 읽지 못했다 - app_config 조회 실패 ({e})') from None
    value = rows[0].get('value') if rows and isinstance(rows[0], dict) else None
    digital = value.get('digital') if isinstance(value, dict) else None
    dpi = digital.get('dpi') if isinstance(digital, dict) else None
    if isinstance(dpi, bool) or not isinstance(dpi, (int, float)) or dpi <= 0:
        raise StopError(f'디지털 DPI를 읽지 못했다 - app_config.pdf_profiles.digital.dpi가 양수가 아니다 ({dpi!r})')
    return float(dpi)


IMG_BOX_JS = r"""
() => Array.from(document.querySelectorAll('img')).map((img) => {
  const r = img.getBoundingClientRect();
  return {src: img.getAttribute('src') || '', w: r.width, h: r.height, fit: getComputedStyle(img).objectFit};
})
"""
IMG_SRC_RE = re.compile(r'(<img\b[^>]*\bsrc=")([^"]*)(")')


def fit_photos(page_files: list[Path], work: Path, dpi: float, quality: int = PHOTO_JPEG_QUALITY) -> dict[str, Any]:
    """지면마다 사진이 놓이는 칸을 재고(Chromium, 렌더와 같은 뷰포트), 칸마다 `칸 크기 × DPI`로 줄인 메타데이터 없는 JPEG를 만들어 그 지면의 `src`를 바꾼다.

    같은 사진이 크기가 다른 칸(표지 · 히어로 · 썸네일)에 놓이면 칸마다 다른 파일이 된다(같은 크기면 한 파일). 다 바꾼 뒤 받아 둔 원본 파일은 지운다 -
    PDF와 쪽 이미지에 원본(메타데이터 포함)이 들어갈 길이 남지 않는다. 결과: 보고용 숫자(파일 수 · 바이트 · 가장 큰 파일)."""
    from playwright.sync_api import sync_playwright

    photos = work / 'photos'
    originals = {p.name for p in photos.iterdir() if p.is_file()}
    made: dict[tuple, str] = {}
    sizes: list[tuple] = []
    slots = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_context(viewport=VIEWPORT).new_page()
            for f in page_files:
                page.goto(f.as_uri(), wait_until='networkidle')
                boxes = page.evaluate(IMG_BOX_JS)
                html = f.read_text(encoding='utf-8')
                tags = list(IMG_SRC_RE.finditer(html))
                if [m.group(2) for m in tags] != [b['src'] for b in boxes]:
                    raise StopError(f'지면의 사진 칸을 HTML과 맞출 수 없다 ({f.name})')
                new_srcs = []
                for b in boxes:
                    name = b['src'].rsplit('/', 1)[-1]
                    if not b['src'].startswith('../photos/') or name not in originals:
                        raise StopError(f'채운 지면의 이미지 경로가 작업 폴더의 사진이 아니다 ({f.name}: {b["src"]})')
                    try:
                        data, (w, h) = fit_photo((photos / name).read_bytes(), (b['w'], b['h']), dpi, quality, b['fit'])
                    except PhotoFitError as e:
                        raise StopError(f'사진을 지면에 맞출 수 없다 ({f.name}: {e})') from None
                    if metadata_found(data):
                        raise StopError(f'줄인 사진에 메타데이터가 남았다 ({f.name}: {metadata_found(data)})')
                    key = (name, w, h)
                    if key not in made:
                        made[key] = ascii_name(f'{name.rsplit(".", 1)[0]}-fit-{w}x{h}.jpg')
                        (photos / made[key]).write_bytes(data)
                        sizes.append((w, h, len(data)))
                    new_srcs.append(f'../photos/{made[key]}')
                    slots += 1
                it = iter(new_srcs)
                f.write_text(IMG_SRC_RE.sub(lambda m: m.group(1) + next(it) + m.group(3), html), encoding='utf-8', newline='\n')
        finally:
            browser.close()
    for name in originals:
        (photos / name).unlink()
    return {'dpi': dpi, 'quality': quality, 'slots': slots, 'summary': summarize(sizes)}


def size_report(pdf: bytes, images: list[bytes], photo_report: dict[str, Any]) -> dict[str, Any]:
    """크기 보고(R85-3) - 디지털 PDF · 쪽 이미지 합계 · 가장 큰 쪽 이미지 · 줄인 사진. 숫자만(이름 · id 없음)."""
    page_sizes = [(*jpeg_size(b), len(b)) for b in images]
    return {'pdfMb': round(len(pdf) / MB, 2), 'pdfLimitMb': DIGITAL_PDF_MAX_MB,
            'pageImages': summarize(page_sizes), 'photos': photo_report}


def assert_pdf_within_limit(pdf: bytes, limit_mb: float = DIGITAL_PDF_MAX_MB) -> None:
    """호 단위 검사(74-h5b ④) - 디지털 PDF가 한도를 넘으면 업로드 전에 멈춘다."""
    size_mb = len(pdf) / MB
    if size_mb > limit_mb:
        raise StopError(f'디지털 PDF가 크기 한도를 넘는다 ({size_mb:.2f}MB > 한도 {limit_mb:g}MB) - 올리지 않는다')


# ---------------------------------------------------------------------------
# 렌더 (Playwright)
# ---------------------------------------------------------------------------

def render_pages(page_files: list[Path], image_width: int = IMAGE_WIDTH_PX, jpeg_quality: int = JPEG_QUALITY,
                 with_png: bool = False) -> list[dict[str, Any]]:
    """지면마다: 검사 -> PDF 한 쪽 -> 이미지 한 장. 검사 결과는 렌더를 실패시키지 않는다.

    `with_png`이면 같은 렌더 결과(같은 페이지 · 같은 배율)에서 PNG도 한 장 더 찍는다(R50-7 쪽 그림 - 새 의존성 없이 Playwright 그대로)."""
    from playwright.sync_api import sync_playwright

    design_js = design_audit_js(TOOLS_DIR)
    results: list[dict[str, Any]] = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            context = browser.new_context(viewport=VIEWPORT, device_scale_factor=image_width / A4_WIDTH_CSS_PX)
            for f in page_files:
                page = context.new_page()
                page.goto(f.as_uri(), wait_until='networkidle')
                findings = audit_page(page)
                compare = compare_with_design(page, design_js, findings)
                mark_original_overset(page, findings)
                pdf = page.pdf(
                    width='210mm', height='297mm', print_background=True,
                    margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'},
                    prefer_css_page_size=True,
                )
                image = page.locator('body').screenshot(type='jpeg', quality=jpeg_quality)
                png = page.locator('body').screenshot(type='png') if with_png else None
                page.close()
                results.append({'file': f.name, 'pdf': pdf, 'image': image, 'png': png, 'findings': findings, 'design': compare})
        finally:
            browser.close()
    return results


def merge_pdf(pdfs: list[bytes]) -> tuple[bytes, list[int]]:
    """지면별 PDF의 첫 쪽만 이어 한 권으로. (PDF, 지면별 원래 쪽 수) - 쪽 수가 1이 아니면 호출부가 알린다."""
    from pypdf import PdfReader, PdfWriter

    writer = PdfWriter()
    counts: list[int] = []
    for data in pdfs:
        reader = PdfReader(io.BytesIO(data))
        counts.append(len(reader.pages))
        writer.add_page(reader.pages[0])
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue(), counts


def clipped_original_slots(composition: Composition) -> tuple:
    """이 호에서 원문이 놓이는 표지 표제 슬롯 - 표제가 이 달의 말(원문)로 바뀐 호만."""
    return ('@cover.headline',) if composition.report.get('coverHeadlineFrom') == 'quote' else ()


def gate_failure(audit: dict[str, Any], issue_id: str) -> Optional[str]:
    """지면 검사 결과가 렌더를 멈춰야 하는가 - 멈춰야 하면 사유(호 · 지면 · 상자 · 넘친 높이), 아니면 None.
    `render_issue`와 로컬 시험 호(`local_volumes.py`)가 **같은 이 함수**로 가른다.

    - 원문이 잘렸다(`originalClipped`, R29-3)
    - 원문 필드가 든 상자가 넘쳤다(`originalOverset`, R49-1) - 온도록 문장만 든 상자의 넘침은 `audit.json` 기록만이다
    """
    reasons: list[str] = []
    if audit['originalClipped']:
        reasons.append(f"원문이 지면에서 잘렸다 (호 {issue_id}): " + '; '.join(
            f"{c['n']}쪽 {c['stem']} 슬롯 {c.get('slot')} 「{c.get('t')}」 (필요 {c.get('need')}px / 가용 {c.get('have')}px)" for c in audit['originalClipped']))
    if audit['originalOverset']:
        reasons.append(f"원문 필드가 든 상자가 판면을 넘었다 (호 {issue_id}): " + '; '.join(
            f"{c['n']}쪽 {c['stem']} 상자 {c.get('t')} (내용 {c.get('need')}px / 상자 {c.get('have')}px, 원문 슬롯 {', '.join(c['originalSlots'])})"
            for c in audit['originalOverset']))
    return ' | '.join(reasons) if reasons else None


def audit_summary(composition: Composition, results: list[dict[str, Any]], issue_id: str) -> dict[str, Any]:
    pages = []
    totals: dict[str, int] = {}
    originals: list[dict[str, Any]] = []
    recorded: list[dict[str, Any]] = []
    overset_originals: list[dict[str, Any]] = []
    extra = clipped_original_slots(composition)
    for n, (spec, res) in enumerate(zip(composition.pages, results), 1):
        for f in res['findings']:
            totals[f['k']] = totals.get(f['k'], 0) + 1
        originals += [{'n': n, 'stem': spec.stem, **f} for f in original_clipped(res['findings'], extra)]
        recorded += [{'n': n, 'stem': spec.stem, **f} for f in recorded_clipped(res['findings'], extra)]
        overset_originals += [{'n': n, 'stem': spec.stem, **f} for f in original_overset(res['findings'])]
        pages.append({'n': n, 'stem': spec.stem, 'findings': res['findings'], 'designAudit': res['design']})
    return {
        'issueId': issue_id,
        'theme': composition.theme,
        'note': '기존 기준 위반은 렌더를 실패시키지 않고 기록한다 - 운영자가 보고 판단한다',
        'totals': totals,
        'designAuditSame': all(p['designAudit'].get('same', True) for p in pages),
        'originalClipped': originals,
        'originalOverset': overset_originals,
        'recordedClipped': recorded,
        'pages': pages,
    }


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
    couples = api.select('couples', f"select=id,status,nickname,magazine_theme,subscription_tier,user_a_id,user_b_id&id=eq.{issue['couple_id']}")
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
    dpi = read_digital_dpi(api)   # 74-h5b - 읽지 못하면 여기서 멈춘다(작업 폴더를 만들기 전)

    try:
        composition = compose_issue(issue, couple, couple_names(api, couple), corners, collect_materials(api, issue, couple))
    except ComposeError as e:
        raise StopError(f'지면을 짤 수 없다: {e}') from None

    out = OUT_ROOT / issue_id
    work = out / 'work'
    prepare_work(work)
    templates = load_templates()
    settle_cover(composition, templates, work, say)
    files = build_pages(composition, templates, work, issue, lambda dest: api.storage_get(MAGAZINE_BUCKET, dest))
    photo_report = fit_photos(files, work, dpi)

    results = render_pages(files, image_width, jpeg_quality)
    pdf, page_counts = merge_pdf([r['pdf'] for r in results])
    audit_pre = audit_summary(composition, results, issue_id)
    failure = gate_failure(audit_pre, issue_id)   # 원문이 잘리거나 원문 상자가 넘친 지면은 만들지 않는다(R29-3 · R49-1) - 운영자가 본다
    if failure:
        raise StopError(failure)
    extra = [(n, c) for n, c in enumerate(page_counts, 1) if c != 1]
    if extra:
        raise StopError(f'한 지면이 PDF 한 쪽에 들어가지 않는다 (지면, 쪽 수): {extra}')
    counted = pdf_page_count(pdf)
    if counted != len(results):
        raise StopError(f'PDF 쪽 수({counted})와 지면 수({len(results)})가 다르다')
    images = [r['image'] for r in results]
    for i, img in enumerate(images, 1):
        width, _ = jpeg_size(img)
        if width != image_width:
            raise StopError(f'{i}쪽 이미지 가로가 {width}px이다 (기대 {image_width}px)')

    pdf_name = ascii_name('issue.pdf')
    (out / pdf_name).write_bytes(pdf)
    image_names = [ascii_name(f'page-{i:02d}.jpg') for i in range(1, len(images) + 1)]
    for name, img in zip(image_names, images):
        (out / name).write_bytes(img)
    audit = audit_pre
    (out / 'audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (out / 'compose.json').write_text(json.dumps({
        'issueId': issue_id, 'report': composition.report, 'sentences': composition.sentences,
        'shownPhotos': composition.shown_photos,
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    sizes = size_report(pdf, images, photo_report)
    say(json.dumps({'sizes': sizes}, ensure_ascii=False))
    assert_pdf_within_limit(pdf)   # 74-h5b ④ - 업로드 전에 멈춘다(로컬 산출물은 위에 남아 운영자가 본다)

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
        'theme': composition.theme,
        'pdf': str(out / pdf_name),
        'pdfBytes': len(pdf),
        'pageCount': len(images),
        'pages': [{'n': i, 'stem': s.stem, 'image': str(out / n), 'bytes': len(b), 'size': list(jpeg_size(b))}
                  for i, (s, n, b) in enumerate(zip(composition.pages, image_names, images), 1)],
        'audit': {'file': str(out / 'audit.json'), 'totals': audit['totals'], 'designAuditSame': audit['designAuditSame']},
        'compose': {'file': str(out / 'compose.json'), 'sentences': composition.report['sentences'],
                    'cover': composition.report['cover'], 'timelinePages': composition.report['timelinePages'],
                    # R84-1 · R84-2 - 숫자만(날짜 · id · 파일 이름 없음): 뺀 기사 수 · 대표 사진을 대체 규칙으로 정한 기사 수
                    'droppedArticles': composition.report['droppedArticles'],
                    'heroFallbackArticles': composition.report['heroFallbackArticles']},
        'sizes': sizes,
        'bucketPaths': [f'{folder}/{pdf_name}'] + [f'{folder}/{n}' for n in image_names],
        'issuesFields': {k: updated[0][k] for k in ('pdf_digital_path', 'page_count', 'cover_path')},
    }
    say(json.dumps(report, ensure_ascii=False, indent=2))
    return report


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description='초안 호를 디지털 PDF + 페이지 이미지로 렌더한다(진짜 지면).')
    parser.add_argument('--issue-id', required=True)
    parser.add_argument('--image-width', type=int, default=IMAGE_WIDTH_PX)
    parser.add_argument('--jpeg-quality', type=int, default=JPEG_QUALITY)
    args = parser.parse_args(argv)
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    secrets: list[str] = []
    try:
        api, ref, secrets = connect()
        print(redact(f'접속 대상: 개발 프로젝트 {DEVELOPMENT_PROJECT_NAME} - 확인됨 (프로젝트 ref는 출력하지 않는다)', secrets))
        render_issue(api, args.issue_id, args.image_width, args.jpeg_quality, say=lambda s: print(redact(s, secrets)))
    except StopError as e:
        print(redact(f'멈춤: {e}', secrets), file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
