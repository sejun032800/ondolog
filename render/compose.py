"""조판 구성 - 호 하나를 지면 목록(어느 지면 · 어떤 데이터 · 어떤 코너 밖 값)으로 짠다 (위임: 55-2, 55-3).

네트워크·파일을 모른다. 입력은 이미 읽어 온 호·커플·코너 행이고, 출력은 `Composition`이다. 채움은 `slot_fill`, 렌더는 `render_issue`가 한다.

원본
  - 지면·슬롯·코너 밖 값의 이름과 계산: `render/issue/README.md` v1.2.3 §2·§3·§5·§9·§10·§11·§12 (높이는 `render/issue/measure.json` - `heights.py`)
  - 지면 순서·폴백·스킵: `docs/ONDOLOG_CORNER_LAYOUT.md` §3-0·§3-3·§4·§6
  - 표지: `docs/ONDOLOG_MASTER.md` 9-5 r64 · ROADMAP R22-3
  - 결정: R25-3(목차·목차/뒤표지 사진) · R26-4(재소환 사유) · R26-5(`@da.lead` 숫자 · 고정 틀 문장) · R26-6(`@sw.openerPhoto`)

**없는 값을 만들지 않는다.** content와 README §2·§9의 계산에 없는 값은 지면에 넣지 않는다(R25-4). 모자라면 비워 두고(줄 삭제),
지면 HTML이 비운 값을 받지 못하는 곳은 `Composition.report`가 아니라 완료 보고의 "막힌 슬롯"이다.
원문(유저 메모·채팅 인용)은 고치지 않는다 - 줄바꿈 외에 요약·교정·말투 다듬기를 하지 않는다. **자르지도 않는다(R29-3)**: 지면에 들어가지 않으면
면을 나누고, 나눌 수 없는 자리(한 대화가 한 면 초과 · 한 구간이 한 면 초과)에서는 `ComposeError`로 렌더를 멈춘다.

이 파일의 숫자 상수는 문서가 정한 값이다(출처를 곁에 적었다).
"""

from __future__ import annotations

import copy
import re
import sys
from dataclasses import dataclass, field
from typing import Any, Optional

sys.dont_write_bytecode = True

from romanize import romanize_place  # noqa: E402
import heights  # noqa: E402  (README v1.2.3 §12 - 높이의 원본은 실측 표 `measure.json`이다. 값을 여기 옮겨 적지 않는다)
from facts import (  # noqa: E402  (호의 사실 - 지면의 수치 · 목록은 모두 여기서 한 번 계산한다. 아래 이름은 compose에서도 쓸 수 있게 다시 내보낸다)
    ARTICLE_PHOTOS, PHOTOS_PER_STOP, PLACES_CAP, UNNAMED_PLACE, FactsError, IssueFacts, article_photo_view, article_photos, article_stops_view,
    as_dict, as_list, build_facts, caption_memo_count, first_photo_any, first_photo_path, has_photo, hero_photo_path, hero_stop_index, is_blank,
    memo_notes, mmdd_dot, place_label, ratio_label, shown_photos_of_stop, stop_photo_counts, this_month_photo, valid_photos, ymd_dot,
)

THEMES = ('basic', 'hip', 'neon', 'lovely', 'night', 'ondol')
CORNER_ORDER = ('date_archive', 'sweet_words', 'this_month')  # CORNER_LAYOUT §6 (연애 DNA·연애리그 없음)
CORNER_LABELS = {'date_archive': '데이트 아카이브', 'sweet_words': '다정한 말들', 'this_month': '이달의 우리'}

# README v1.2.3 §5 · §12 - 판면 가용 높이 · 구간 높이 · 인용 가용 높이는 실측 표(`render/issue/measure.json`)에서 읽는다(`heights.py`).
# v1.2.2의 규칙 문장(stop 높이표 + 메모 50자마다 29px, 대화 113 + 64 x 턴 + 35자마다 22px, 844 / 781)은 디자인이 폐기했다(D10).
TIMELINE_CAPACITY_PX = heights.TIMELINE_CAPACITY_PX
TIMELINE_MAX_PAGES = 2          # CORNER_LAYOUT §3-1 "타임라인 1~2면", §4 "배열이 예상보다 김: 상한까지만"
SIGNALS_CAP = 3                 # CORNER_LAYOUT §3-4 "요약 수치 3개"
QUOTE_MAX_CAPACITY_PX = heights.quote_capacity(0)   # 단문이 없는 면의 인용 가용 높이 - 한 대화가 이보다 크면 어느 면에도 들어가지 않는다
COVER_MIN_SHORT_SIDE_PX = 1170  # MASTER 9-5 r64 - 페이지 이미지 가로 폭
COVER_MAX_LINES = 3             # MASTER 9-5 r64 - 표제 3줄
COVER_LINE_CHARS = 6            # MASTER 9-5 r64 - 줄당 6자
EVIDENCE_EXCERPT_MAX = 15       # README §9 `.evidence` - 15자 초과면 날짜만

MONTHS_EN = ('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
             'November', 'December')
QUESTION_TYPE_KO = {'rating': '평가', 'recall': '회상', 'suggestion': '제안'}  # README §9 `.type`

SKIP_REASON_KO = {  # CORNER_LAYOUT §3-0 "스킵 사유를 유저 언어로" - 감정적 해석을 덧붙이지 않는다
    ('sweet_words', 'insufficient_input'): '인용할 만한 대화를 찾지 못했습니다',
    ('date_archive', 'insufficient_input'): '실을 만한 데이트 기록을 찾지 못했습니다',
    ('this_month', 'insufficient_input'): '실을 만한 기록을 찾지 못했습니다',
}
SKIP_REASON_OTHER = '이번 호에 싣지 못했습니다'


class ComposeError(Exception):
    """호를 짤 수 없다 - 재료가 계약을 어긴다(예: featured 기사가 없다). 고치지 않고 알린다.

    원문이 나눌 수 없는 자리에서 넘칠 때도 이 오류다(R29-3) - 자르지 않고 렌더를 멈춰 운영자에게 넘긴다.
    """


# ---------------------------------------------------------------------------
# 결과
# ---------------------------------------------------------------------------

@dataclass
class PageSpec:
    stem: str                                  # `render/issue/pages/<stem>.html`
    corner: Optional[dict] = None              # 코너 봉투(보기용 사본)
    computed: dict = field(default_factory=dict)  # `@이름` 값
    bind: dict = field(default_factory=dict)   # `[i]`·`[featured]`
    corner_type: Optional[str] = None
    widths: dict = field(default_factory=dict)  # `data-width` 경로 -> 숫자 폭(0~100). 디자인 `resolve.js`의 `cfg.width`와 같은 역할 - 글자(`34%`)와 따로 맡긴다 (R48-6)


@dataclass
class Composition:
    pages: list
    theme: str
    shown_photos: list                         # 지면에 실린 사진 경로(목적지 경로), 중복 없이 지면 순서
    sentences: list                            # [{'who','kind','source','sentences'}] - 발행 노트 근거
    report: dict


# ---------------------------------------------------------------------------
# 작은 도구
# ---------------------------------------------------------------------------

def code_points(s: str) -> int:
    return len(s)  # Python str은 코드포인트 단위다


def count_sentences(text: Any) -> int:
    """문장 수. 마침표·물음표·느낌표·말줄임표·줄바꿈 뒤에서 끊고, 비어 있지 않은 조각을 센다. 글자가 있으면 최소 1."""
    if not isinstance(text, str) or text.strip() == '':
        return 0
    parts = re.split(r'(?<=[.!?…。])\s+|\n+', text.strip())
    return max(1, len([p for p in parts if p.strip() != '']))


def mmdd_hhmm(value: Any) -> str:
    """ISO 시각(+09:00 표기 그대로) -> `08.11 23:40`. 모양이 아니면 빈 값."""
    if isinstance(value, str):
        m = re.match(r'^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})', value)
        if m:
            return f'{m.group(1)}.{m.group(2)} {m.group(3)}:{m.group(4)}'
    return ''


def source_stamp(at: Any, year: Optional[int], recalled_days: Any = (), fallback: Any = None) -> Any:
    """출처 날짜 · 시각(R50-2 #9) - 근거 날짜와 같은 규칙. `09.22 09:20`, 이 호의 연도와 다른 해이거나 재소환 기사의 날짜만 `2025.09.20 09:20`.

    ISO 시각이 아니면 `fallback`을 그대로 돌려준다(값을 지어내지 않는다).
    """
    if isinstance(at, str):
        m = re.match(r'^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})', at)
        day = mmdd_or_ymd(at, year, recalled_days)
        if m and day:
            return f'{day} {m.group(1)}:{m.group(2)}'
    return fallback


_DISPLAY_STAMP = re.compile(r'^\s*\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}')


def quote_display(display: Any, at: Any, year: Optional[int], recalled_days: Any = ()) -> Any:
    """`attribution.display`(`2026.09.22 09:20, 아침 대화 중`)의 앞 날짜 · 시각을 `source_stamp` 규칙으로 바꾼다. 뒤의 정황 말(`, 아침 대화 중`)은 그대로 둔다. 모양이 맞지 않으면 그대로."""
    if not isinstance(display, str):
        return display
    m = _DISPLAY_STAMP.match(display)
    stamp = source_stamp(at, year, recalled_days)
    if not m or not stamp:
        return display
    return stamp + display[m.end():]


def month_of_label(label: Any) -> Optional[str]:
    """`2026년 8월` -> `8월`."""
    if isinstance(label, str):
        m = re.search(r'(\d{1,2})월', label)
        if m:
            return f'{int(m.group(1))}월'
    return None


def mmdd_or_ymd(value: Any, year: Optional[int], recalled_days: Any = ()) -> str:
    """근거 날짜 표기(README §11 ⑤) - `08.22`. 연도는 적지 않는다. 재소환 기사의 날짜(다른 해 포함)만 `2025.08.20`처럼 연도를 붙인다.

    `year`는 이 호의 연도, `recalled_days`는 재소환 기사의 `dateOn` 모음이다. 모양이 아니면 빈 값.
    """
    full = ymd_dot(value)
    if not full:
        return ''
    day_key = full.replace('.', '-')
    if (year is not None and int(full[0:4]) != year) or day_key in recalled_days:
        return full
    return full[5:]


def hhmm(value: Any) -> Any:
    """시각 표기(README §11 ③) - 24시간 `14:20`, 자정은 `00:00`. `9:05`·`14:20:00`·ISO 시각을 받는다. 모양이 아니면 **있는 그대로** 돌려준다(값을 지어내지 않는다)."""
    if isinstance(value, str):
        m = re.match(r'^\s*(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*$', value) or re.match(r'^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})', value)
        if m and int(m.group(1)) < 24 and int(m.group(2)) < 60:
            return f'{int(m.group(1)):02d}:{m.group(2)}'
    return value


ORDINALS_EN = ('One', 'Two', 'Three', 'Four', 'Five')


def ordinal_en(number: int) -> str:
    """기사 순번의 영문 서수 - `One`~`Five`, 여섯째부터는 숫자(README §10 `@da.featuredOrdinalEn`)."""
    return ORDINALS_EN[number - 1] if 1 <= number <= len(ORDINALS_EN) else str(number)


def conversation_height(main: dict) -> int:
    """대화 하나(정황 + 출처 + 턴들)의 높이(README v1.2.3 §12 식 - `measure.json`). 줄 수는 표의 '글자 수 이상인 첫 칸', 줄바꿈 조각마다 따로."""
    turns = [t for t in as_list(main.get('turns')) if isinstance(t, dict)]
    return heights.conversation_height(main.get('context'), [t.get('text') for t in turns])


def pack_quotes(sizes: list, sub_count: int, names: Optional[list] = None) -> list:
    """대화 높이 목록 -> 면별 대화 번호 목록(README §12). **대화 단위**로 앞에서부터 채우고 한 대화를 두 면에 쪼개지 않는다.

    가용 높이(README v1.2.3 §12)는 그 면의 단문 수가 정한다 - 0개 940 · 1~3개 841 · 4개 이상 778(`measure.json`). 단문은 마지막 면에만 실리므로
    앞 면은 단문 0개 기준, 마지막 면만 단문 수 기준이다. 한 대화가 가용 높이를 넘으면 `ComposeError`(어느 대화 · 높이 · 가용 높이) - 자르지 않는다(R29-3).
    """
    names = names or [f'{i + 1}번째 대화' for i in range(len(sizes))]
    for i, h in enumerate(sizes):
        if h > QUOTE_MAX_CAPACITY_PX:
            raise ComposeError(f'{names[i]}이(가) 한 면을 넘는다 (높이 {h}px, 가용 {QUOTE_MAX_CAPACITY_PX}px) - 한 대화를 두 면에 쪼개지 않는다')
    pages: list = [[]]
    used = 0
    for i, h in enumerate(sizes):
        if pages[-1] and used + h > QUOTE_MAX_CAPACITY_PX:
            pages.append([])
            used = 0
        pages[-1].append(i)
        used += h
    last_cap = heights.quote_capacity(sub_count)
    if sum(sizes[i] for i in pages[-1]) > last_cap:
        moved = pages[-1].pop()      # 단문과 함께 실리는 마지막 면이 넘치면 마지막 대화만 따로 한 면에 둔다
        if sizes[moved] > last_cap:
            raise ComposeError(f'{names[moved]}이(가) 한 면을 넘는다 (높이 {sizes[moved]}px, 가용 {last_cap}px - 단문 {sub_count}개와 함께 실리는 면)')
        if not pages[-1]:
            pages.pop()
        pages.append([moved])
    return pages


def split_headline(text: Any) -> Optional[list]:
    """표제를 3줄·줄당 6자 이내로 띄어쓰기에 맞게 나눈다. 못 나누면 None (MASTER 9-5 r64).

    줄 길이는 그 줄의 글자 수(줄 안의 띄어쓰기 포함)다. 단어는 쪼개지 않는다. 앞에서부터 채우는 방식이 줄 수가 가장 적다.
    """
    if not isinstance(text, str):
        return None
    words = text.split()
    if not words:
        return None
    lines: list = []
    for word in words:
        if code_points(word) > COVER_LINE_CHARS:
            return None
        if lines and code_points(lines[-1]) + 1 + code_points(word) <= COVER_LINE_CHARS:
            lines[-1] = f'{lines[-1]} {word}'
        else:
            lines.append(word)
    return lines if len(lines) <= COVER_MAX_LINES else None


# ---------------------------------------------------------------------------
# 데이트 아카이브
# ---------------------------------------------------------------------------

def stop_height(stop: dict) -> int:
    """타임라인 구간 하나의 높이(README v1.2.3 §12 식 - `measure.json`) = max(왼쪽 단, 오른쪽 단) + 여백.
    지면이 그리는 메모는 첫 메모 하나이고, 메모가 없을 때만 AI 캡션을 그린다. 장소 이름이 길면 왼쪽 단이 높이를 정할 수 있다."""
    photos = min(len(valid_photos(stop)), PHOTOS_PER_STOP)
    memos = memo_notes(stop)
    return heights.timeline_stop_height(photos, memos[0]['text'] if memos else None,
                                        None if memos else stop.get('aiCaption'), stop.get('placeName'))


def split_timeline(stops: list) -> tuple:
    """README §5 - stop 높이를 앞에서부터 더해 953px을 넘으면 다음 면. (면별 stop 목록, 싣지 못한 stop 목록).

    한 구간만으로 한 면을 넘으면 `ComposeError` - 구간은 쪼갤 수 없고 원문 메모를 줄이지 않는다(R29-3).
    """
    pages: list = [[]]
    used = 0
    dropped: list = []
    for stop in stops:
        h = stop_height(stop)
        if h > TIMELINE_CAPACITY_PX:
            raise ComposeError(f"타임라인의 한 구간({stop.get('time')} {stop.get('placeName') or '장소 없음'})이 한 면을 넘는다 "
                               f'(높이 {h}px, 가용 {TIMELINE_CAPACITY_PX}px) - 구간을 두 면에 쪼개지 않는다')
        if pages[-1] and used + h > TIMELINE_CAPACITY_PX:
            if len(pages) >= TIMELINE_MAX_PAGES:
                dropped.append(stop)
                continue
            pages.append([])
            used = 0
        pages[-1].append(stop)
        used += h
    pages = [p for p in pages if p]
    if len(pages) == 2:   # v1.2.3 #9 · D11 - 두 면이면 순서를 지킨 채 두 면 높이 차가 가장 작게 다시 나눈다(둘째 면 아래 절반이 비던 것)
        seq = pages[0] + pages[1]
        hs = [stop_height(s) for s in seq]
        best = None
        for k in range(1, len(seq)):
            a, b = sum(hs[:k]), sum(hs[k:])
            if a <= TIMELINE_CAPACITY_PX and b <= TIMELINE_CAPACITY_PX and (best is None or abs(a - b) < best[0]):
                best = (abs(a - b), k)
        if best:
            pages = [seq[:best[1]], seq[best[1]:]]
    return pages, dropped


# 84-h에서 넣은 0인 조각 빼기 - 디자인 v1.2.4 README §11 ⑬으로 확정(88- E4 대조: 리드 둘째 문장 · `@da.records` · `@da.routeSummary` · 발행 노트 같음)
# 숫자를 문장 · 머리에 끼우는 자리에서 0인 조각은 문장에서 뺀다. 틀(`render/issue/`)의 예시 문장은 그대로 - 렌더러가 넣는 값만 바뀐다.

def lead_text(month: str, period_dates: int, regions: list, place_count: int, photos: int, memos: int) -> str:
    """`@da.lead` 두 문장. 둘째 문장의 0인 조각을 뺀다:
    사진 · 메모 둘 다 있으면 `…남긴 N장의 사진과 M개의 메모를 그대로 실었습니다.` / 하나만이면 그 조각만(`…남긴 N장의 사진을 …`) /
    둘 다 0이면 `…N곳을 거쳤습니다.` / 장소도 0이면 둘째 문장 없음. 장소가 0이면 `N곳을 거치며`를 뺀다(지역 이름도 함께 - 지역은 장소에서 온다)."""
    first = f'{month}에 두 사람이 함께 보낸 날은 {period_dates}번이었습니다.'
    where = f"{''.join(r + ', ' for r in regions)}{place_count}곳" if place_count > 0 else ''
    things = [t for n, t in ((photos, f'{photos}장의 사진'), (memos, f'{memos}개의 메모')) if n > 0]
    if things:
        obj = '과 '.join(things) + ('를' if things[-1].endswith('메모') else '을')
        second = f"{where + '을 거치며 ' if where else ''}남긴 {obj} 그대로 실었습니다."
    elif where:
        second = f'{where}을 거쳤습니다.'
    else:
        return first
    return f'{first} {second}'


def route_summary(region_count: int, place_count: int) -> str:
    """`@da.routeSummary` - `2개 지역 · 6개 장소`. 0인 조각은 뺀다(`0개 지역 · 6개 장소` -> `6개 장소`). 둘 다 0이면 빈 글자."""
    pieces = [t for n, t in ((region_count, f'{region_count}개 지역'), (place_count, f'{place_count}개 장소')) if n > 0]
    return ' · '.join(pieces)


def records_line(memos_total: int, ai_captions: int) -> str:
    """`@da.records` - `남긴 기록 · 메모 2 · AI 캡션 1`. 0인 조각은 뺀다(`메모 0 · AI 캡션 1` -> `AI 캡션 1`). 둘 다 0이면 빈 글자(칸째 빠짐 - 틀 data-optional)."""
    pieces = [t for n, t in ((memos_total, f'메모 {memos_total}'), (ai_captions, f'AI 캡션 {ai_captions}')) if n > 0]
    return ('남긴 기록 · ' + ' · '.join(pieces)) if pieces else ''


def photo_note(total: int, shown: int) -> str:
    """README §10 `@da.articlePhotoNote` - 실린 수 < 전체면 `그날 남은 사진 {전체}장 중 {실린}장`, 같으면 `그날 남은 사진 {실린}장`. 0이면 빈 값."""
    if shown <= 0:
        return ''
    return f'그날 남은 사진 {total}장 중 {shown}장' if shown < total else f'그날 남은 사진 {shown}장'


# ---------------------------------------------------------------------------
# 구성
# ---------------------------------------------------------------------------

class _Builder:
    def __init__(self, issue: dict, couple: dict, names: list, corners: list, materials: Optional[dict]) -> None:
        self.issue = issue
        self.couple = couple
        self.names = names
        self.materials = materials or {}
        self.theme = couple.get('magazine_theme') or 'basic'
        if self.theme not in THEMES:
            raise ComposeError(f'테마가 6종 밖이다 ({self.theme})')

        by_type = {}
        for c in corners:
            by_type.setdefault(c['corner_type'], c)
        self.corner_rows = by_type
        self.ready = {t: c['content'] for t, c in by_type.items()
                      if t in CORNER_ORDER and c.get('status') == 'ready' and isinstance(c.get('content'), dict)}
        end = str(issue['period_end'])
        start = str(issue['period_start'])
        self.end_year, self.end_month = int(end[0:4]), int(end[5:7])
        self.start_month, self.start_day = int(start[5:7]), int(start[8:10])
        self.end_day = int(end[8:10])
        self.sentences: list = []
        # 렌더 보고의 숫자(R84-1 · R84-2) - 날짜 · id · 파일 이름 없이 개수만
        self.report: dict = {'decisions': [], 'droppedArticles': 0, 'heroFallbackArticles': 0}
        self.shown: list = []  # 지면에 실린 사진(날짜 아카이브 안), 지면 순서·중복 없음
        self.facts: Optional[IssueFacts] = None   # 호의 사실 - 데이트 아카이브가 없으면 None

    # -- 기록 ----------------------------------------------------------------

    def say(self, who: str, kind: str, source: str, text: Any) -> None:
        n = count_sentences(text)
        if n > 0:
            self.sentences.append({'who': who, 'kind': kind, 'source': source, 'sentences': n})

    def decide(self, text: str) -> None:
        self.report['decisions'].append(text)

    def show(self, path: Optional[str]) -> None:
        if path and path not in self.shown:
            self.shown.append(path)

    # -- 호 전체 값 -----------------------------------------------------------

    def issue_values(self) -> dict:
        return {
            'month': f'{self.end_month}월호',
            'period': f'{self.start_month}월 {self.start_day}일 ~ {self.end_month}월 {self.end_day}일',
            'nickname': self.couple.get('nickname') or '',
            'names': ' · '.join(n for n in self.names if n),
        }

    def ensure_facts(self) -> None:
        """데이트 아카이브 지면이 없는 호의 호의 사실 - 기사 없이 대화 · 이달의 우리 수치와 노트 표만 든다."""
        if self.facts is not None:
            return
        sw_row, tm_row = self.ready.get('sweet_words'), self.ready.get('this_month')
        try:
            self.facts = build_facts(articles=[], fi=-1, kept_stops=[], dropped_stops=[], materials=self.materials, summary=None,
                                     sweet_payload=as_dict(sw_row).get('payload') if sw_row else None,
                                     this_month_payload=as_dict(tm_row).get('payload') if tm_row else None)
        except FactsError as e:
            raise ComposeError(f"호 {self.issue.get('id')}: {e}") from None

    # -- 데이트 아카이브 --------------------------------------------------------

    def date_archive_pages(self) -> list:
        content = self.ready['date_archive']
        payload = as_dict(content.get('payload'))
        articles = [a for a in as_list(payload.get('articles')) if isinstance(a, dict)]
        if not articles:
            raise ComposeError('date_archive에 기사가 없다')
        featured = [i for i, a in enumerate(articles) if a.get('featured') is True]
        if len(featured) != 1:
            raise ComposeError(f'date_archive의 featured 기사가 정확히 1개가 아니다 ({len(featured)})')

        # v1.2.3(R136-2 ① · D3): 임시 규칙 R84-2 "사진 0 기사 빼기"는 없앴다 - 사진이 없는 일반 기사는 `da-article` `hero-none`(글만 있는 기사)으로 싣는다.
        # 사진 없는 대표 기사는 그대로 활자 오프너(`type-only`)다. 보고 칸 `droppedArticles`는 늘 0이다(지난 보고와 맞대기 위해 남긴다).
        self.report['droppedArticles'] = 0
        fi = featured[0]
        art = articles[fi]
        self.da = {'articles': articles, 'fi': fi}
        label = as_dict(content.get('header')).get('periodLabel')
        month = month_of_label(label) or f'{self.end_month}월'
        summary = as_dict(payload.get('summary'))

        stops = [s for s in as_list(art.get('stops')) if isinstance(s, dict)]
        first_time = hhmm(stops[0].get('time')) if stops else None   # README §11 ③ `14:20`
        last_time = hhmm(stops[-1].get('time')) if stops else None

        # 타임라인 분할(README §5) - 메모 없는 그림 메모 stop은 보기 사본에서 메모로 세지 않는다.
        # 구간 라벨 `사진 3 / 4`(R50-2)의 숫자는 호의 사실(`facts.stop_photo_counts`)에서 온다 - 여기서 세지 않는다.
        view_stops = []
        for s in stops:
            v = copy.deepcopy(s)
            v['userNotes'] = memo_notes(s)
            # 84-d2(R138-4) - 이름 없는 경유지 = "이름을 남기지 않은 곳"(README v1.2.3 §10 ① 확정 - 타임라인 · 장소 목록 · 경로 모두 같은 말).
            # 틀의 장소 줄은 data-optional이라 빈 값이면 줄째 빠졌다. 구간 높이도 이 글자로 잰다(`stop_height`가 보기 사본을 잰다)
            v['placeName'] = place_label(s)
            v['time'] = hhmm(v.get('time'))
            shown_n, total_n = stop_photo_counts(s)
            v['photoLabel'] = ratio_label(shown_n, total_n) if total_n > 0 else ''   # 사진이 0이면 라벨 값이 비고 지면이 라벨째 뺀다 (R51-5)
            view_stops.append(v)
        try:
            tl_pages, dropped_stops = split_timeline(view_stops)
        except ComposeError as e:
            raise ComposeError(f"호 {self.issue.get('id')}: {e}") from None
        kept_stops = [s for p in tl_pages for s in p]

        # 히어로(R84-1, R48-3 ①을 바꿈): 대표 · 일반 기사 모두 사진이 있는 첫 구간의 첫 사진(`hero_photo_path` -> `@da.articleHero`). 기사 하나 때문에 호를 멈추지 않는다(R84-3) -
        # 사진 없는 일반 기사는 `hero-none`. 첫 구간에 사진이 없어 뒤 구간 사진을 쓴 기사 수만 보고한다.
        self.report['heroFallbackArticles'] = sum(1 for a in articles if has_photo(a) and first_photo_path(a) is None)

        # 호의 사실 - 이 아래의 모든 수치 · 목록은 여기서 읽는다 (R50-2)
        sw_row = self.ready.get('sweet_words')
        tm_row = self.ready.get('this_month')
        try:
            facts = build_facts(articles=articles, fi=fi, kept_stops=kept_stops, dropped_stops=dropped_stops, materials=self.materials,
                                summary=summary, sweet_payload=as_dict(sw_row).get('payload') if sw_row else None,
                                this_month_payload=as_dict(tm_row).get('payload') if tm_row else None)
        except FactsError as e:
            raise ComposeError(f"호 {self.issue.get('id')}: {e}") from None
        self.facts = facts
        lead_f = facts.lead

        # 실린 사진 - 지면 순서(오프너 -> 타임라인 -> 기사). 오프너 사진은 대표 기사 전체 stop의 첫 사진이다(§10)
        opener_photo = first_photo_any(art)
        self.show(opener_photo)
        for s in kept_stops:
            for p in shown_photos_of_stop(s):
                self.show(p['path'])
        others = [(i, a) for i, a in enumerate(articles) if i != fi]
        for i, a in others:
            self.show(hero_photo_path(a))
            for p in article_photos(a):
                self.show(p['path'])

        # @da.lead - 지면에 실제로 실린 것만 센다(R26-5): 데이트는 이번 기간 모은 양, 사진 · 메모는 이번 기간 기사 중 실린 것(재소환은 따로)
        regions = facts.regions
        # 84-h(R145-3): 0인 조각(사진 0장 · 메모 0개 · 장소 0곳)은 문장에서 뺀다 - `lead_text`
        lead = lead_text(month, facts.period_dates, regions, facts.place_count, len(facts.photos_shown_period), facts.memos_shown_period)
        route_headline = f'{month}에 두 사람이 그린 지도'
        self.say('ondolog', 'fixedFrame', '@da.lead', lead)
        self.say('ondolog', 'fixedFrame', '@da.routeHeadline', route_headline)

        records = records_line(lead_f.memos_total, lead_f.ai_captions_shown)   # 84-h: `메모 0 · AI 캡션 1` -> `AI 캡션 1`

        places = facts.places[:PLACES_CAP]
        self.omitted_places = len(facts.places) - len(places)
        article_no = f'{fi + 1:02d}'

        region_en = romanize_place(art['region']) if isinstance(art.get('region'), str) else None
        da_common = {
            'regionLine': (f"{', '.join(regions)} · {label}" if regions else str(label or '')),
            'lead': lead,
            'featuredDate': ymd_dot(art.get('dateOn')),
            'regionEn': region_en or '',
            'featuredOrdinalEn': ordinal_en(fi + 1),   # 대표 기사도 실제 순번(첫 기사가 아닐 수 있다)
            'openerPhoto': opener_photo or '',
            'startTime': first_time or '',
            'endTime': last_time or '',
            'stopCount': lead_f.stop_count,
            'photoCount': lead_f.photos_total or '',   # 0이면 빈 값 -> 칸째 뺀다 (R51-5)
            'records': records,
        }

        # 보기 사본 - 원본 content는 건드리지 않는다
        def view_copy() -> dict:
            return copy.deepcopy(content)

        pages = []
        # 오프너
        v = view_copy()
        pages.append(PageSpec('da-opener', v, {'da': da_common}, {'featured': fi, 'i': fi}, 'date_archive'))
        self.say('ondolog', 'headline', 'date_archive.featured.title', art.get('title'))

        # 타임라인 1~2면
        for page_stops in tl_pages:
            v = view_copy()
            v['payload']['articles'][fi]['stops'] = page_stops
            computed = {'da': {
                'articleNo': article_no,
                'startTime': first_time or '',
                'endTime': last_time or '',
                'route': lead_f.route,
                'totals': timeline_totals(lead_f),
            }}
            pages.append(PageSpec('da-timeline', v, computed, {'featured': fi, 'i': fi}, 'date_archive'))
        for s in kept_stops:
            notes = as_list(s.get('userNotes'))
            if notes:
                self.say('people', 'userNotes', 'date_archive.stop.userNotes[0].text', notes[0].get('text'))
            elif not is_blank(s.get('aiCaption')):
                self.say('ondolog', 'aiCaption', 'date_archive.stop.aiCaption', s.get('aiCaption'))
        self.timeline_dropped = dropped_stops
        self.timeline_page_count = len(tl_pages)

        # 이동 경로 + 세 물음 - 이번 달 경로이므로 재소환 장소는 없다 (R50-3)
        v = view_copy()
        v_art = v['payload']['articles'][fi]
        for q in as_list(v_art.get('closingQuestions')):
            if isinstance(q, dict):
                q['type'] = QUESTION_TYPE_KO.get(q.get('type'), q.get('type'))
        computed = {'da': {
            'routeSummary': route_summary(facts.region_count, facts.place_count),   # 84-h: `0개 지역 · 6개 장소` -> `6개 장소`
            'routeHeadline': route_headline,
            'places': places,
        }}
        pages.append(PageSpec('da-places', v, computed, {'featured': fi, 'i': fi}, 'date_archive'))
        for q in as_list(art.get('closingQuestions')):
            if isinstance(q, dict):
                self.say('ondolog', 'closingQuestions', 'date_archive.closingQuestions.text', q.get('text'))
                self.say('ondolog', 'closingQuestions', 'date_archive.closingQuestions.basis', q.get('basis'))

        # 두 번째 기사부터
        for i, a in others:
            v = view_copy()
            va = v['payload']['articles'][i]
            # v1.2.3(D2): 히어로는 `@da.articleHero`로 받는다 - 보기 사본에서 히어로 구간을 맨 앞으로 옮기던 처리(R84-1 임시)는 없앴다.
            years =self.end_year - int(str(a.get('dateOn') or '0000')[0:4]) if re.match(r'^\d{4}', str(a.get('dateOn') or '')) else 0
            # R26-4: anniversary만 "N년 전 이맘때". 나머지 사유는 빈 값(줄 삭제)
            va['recallReason'] = f'{years}년 전 이맘때' if (a.get('recalled') is True and a.get('recallReason') == 'anniversary' and years > 0) else None
            af = facts.article(i)
            a_photos = article_photos(a) if has_photo(a) else []
            # hero-none(사진 0) - 구간 목록. §12 가용 높이에 들어가는 데까지, 나머지 구간은 발행 노트 '싣지 않은 것'(호의 사실이 같은 함수로 센다)
            a_stops = [] if has_photo(a) else article_stops_view(a)[0]
            computed = {'da': {
                'articleNo': f'{i + 1:02d}',
                'articleOrdinalEn': ordinal_en(i + 1),
                'articlePhotoNote': photo_note(af.photos_total, af.photos_shown),
                'articleDate': ymd_dot(a.get('dateOn')),
                'articleRoute': af.route,
                'articlePhotoCount': af.photos_total or '',   # 0이면 빈 값 -> 칸째 뺀다 (R51-5)
                'articleNoteCount': af.memos_total or '',
                'articleStopCount': af.stop_count,
                'articleCaptionCount': af.ai_captions_shown if af.ai_captions_shown > 0 else '',   # 실린 수만, 0이면 빈 값 -> 칸째 뺀다 (R50-4)
                'articlePhotos': a_photos,
                'articleHero': hero_photo_path(a) or '',
                'articleStops': a_stops,
            }}
            pages.append(PageSpec('da-article', v, computed, {'featured': fi, 'i': i}, 'date_archive'))
            self.say('ondolog', 'headline', 'date_archive.article.title', a.get('title'))
            for p in a_photos:   # v1.2.3(D4): 사진 캡션 칸 = 그 구간의 메모(원문) 또는 AI 캡션(라벨 줄, 온도록 문장)
                if p['caption']:
                    self.say('people', 'userNotes', 'date_archive.article.photoCaption', p['caption'])
                elif p['aiCaption']:
                    self.say('ondolog', 'aiCaption', 'date_archive.article.photoAiCaption', p['aiCaption'])
            for st in a_stops:
                if st['userNotes']:
                    self.say('people', 'userNotes', 'date_archive.article.stop.userNotes[0].text', st['userNotes'][0]['text'])
                elif st['aiCaption']:
                    self.say('ondolog', 'aiCaption', 'date_archive.article.stop.aiCaption', st['aiCaption'])
        return pages

    # -- 다정한 말들 -----------------------------------------------------------

    def sweet_words_pages(self, opener_photo: Optional[str]) -> list:
        content = self.ready['sweet_words']
        payload = as_dict(content.get('payload'))
        mains = [m for m in as_list(payload.get('main')) if isinstance(m, dict)]
        subs = [s for s in as_list(payload.get('sub')) if isinstance(s, dict)]
        if not mains:
            raise ComposeError('sweet_words에 main이 없다')
        sw_computed = {'sw': {'openerPhoto': opener_photo or ''}}
        recalled_days = self.facts.recalled_days if self.facts else set()

        def view(main_slice: list, sub_slice: list) -> dict:
            v = copy.deepcopy(content)
            main_view = copy.deepcopy(main_slice)
            for m in main_view:   # 출처 날짜 = 근거 날짜 규칙 (R50-2 #9, R48-3 ④ 임시값을 대체)
                att = as_dict(m.get('attribution'))
                att['display'] = quote_display(att.get('display'), att.get('at'), self.end_year, recalled_days)
                m['attribution'] = att
            v['payload']['main'] = main_view
            sub_view = copy.deepcopy(sub_slice)
            for s in sub_view:
                att = as_dict(s.get('attribution'))
                att['at'] = source_stamp(att.get('at'), self.end_year, recalled_days, fallback='')   # 지면 표기 `08.11 23:40`
                s['attribution'] = att
            v['payload']['sub'] = sub_view
            return v

        pages = [PageSpec('sw-opener', copy.deepcopy(content), dict(sw_computed), {}, 'sweet_words')]
        # 인용면 나눔(README v1.2.3 §12) - 대화 높이를 더해 가용 높이(단문 0개 940 · 1~3개 841 · 4개 이상 778)를 넘으면 **대화 단위로** 다음 면. 단문은 마지막 면에만.
        names = [f"{i + 1}번째 대화({str(m.get('context') or '')[:20]})" for i, m in enumerate(mains)]
        try:
            groups = pack_quotes([conversation_height(m) for m in mains], len(subs), names)
        except ComposeError as e:
            raise ComposeError(f"호 {self.issue.get('id')}: 다정한 말들 {e}") from None
        for n, group in enumerate(groups):
            last = n == len(groups) - 1
            pages.append(PageSpec('sw-quotes', view([mains[i] for i in group], subs if last else []), {}, {}, 'sweet_words'))
        self.quote_page_count = len(groups)
        for m in mains:
            self.say('ondolog', 'context', 'sweet_words.main.context', m.get('context'))
            for t in as_list(m.get('turns')):
                self.say('people', 'turns', 'sweet_words.main.turns.text', as_dict(t).get('text'))
        for s in subs:
            self.say('people', 'sub', 'sweet_words.sub.text', s.get('text'))
        return pages

    # -- 이달의 우리 -------------------------------------------------------------

    def this_month_pages(self) -> list:
        content = self.ready['this_month']
        payload = as_dict(content.get('payload'))
        articles = [a for a in as_list(payload.get('articles')) if isinstance(a, dict)]
        theme = as_dict(payload.get('theme'))

        lead = copy.deepcopy(content)
        lead['payload']['theme']['signals'] = self.signal_cells(as_list(theme.get('signals')))

        view = copy.deepcopy(content)
        # README §11 ⑤ - 근거 날짜는 `08.22`, 재소환 기사의 날짜만 연도를 붙인다
        recalled_days = self.facts.recalled_days if self.facts else set()
        # README §11 ④ - `.seq`는 두 자리 `01`. seq가 0부터면 +1 해서 쓴다
        seqs = [a['seq'] for a in view['payload']['articles'] if isinstance(a.get('seq'), int)]
        seq_shift = 1 if seqs and min(seqs) == 0 else 0
        for a in view['payload']['articles']:
            a['seq'] = f"{a['seq'] + seq_shift:02d}" if isinstance(a.get('seq'), int) else None
            # v1.2.3 #18 · D6 = R44-9(R124-7): 근거가 사진인 소기사에만 그 사진(evidence를 한 줄로 바꾸기 **전에** 읽는다). 남는 사진으로 채우지 않는다
            a['photo'] = this_month_photo(as_list(a.get('evidence')))
            a['photoAiCaption'] = self.photo_ai_caption(a['photo'])
            a['evidence'] = self.evidence_line(as_list(a.get('evidence')), self.end_year, recalled_days)
            if a['photoAiCaption']:
                self.say('ondolog', 'aiCaption', 'this_month.article.photoAiCaption', a['photoAiCaption'])
        self.say('ondolog', 'headline', 'this_month.theme.headline', theme.get('headline'))
        self.say('ondolog', 'lead', 'this_month.theme.lead', theme.get('lead'))
        for a in articles:
            self.say('ondolog', 'headline', 'this_month.article.title', a.get('title'))
            self.say('ondolog', 'body', 'this_month.article.body', a.get('body'))
            for ev in as_list(a.get('evidence')):
                ev = as_dict(ev)
                if ev.get('type') == 'message' and isinstance(ev.get('excerpt'), str) and 0 < code_points(ev['excerpt']) <= EVIDENCE_EXCERPT_MAX:
                    self.say('people', 'evidenceExcerpt', 'this_month.evidence.excerpt', ev['excerpt'])
        self.say('ondolog', 'closing', 'this_month.closing', payload.get('closing'))
        return [PageSpec('tm-lead', lead, {}, {}, 'this_month'), PageSpec('tm-articles', view, {}, {}, 'this_month')]

    def photo_ai_caption(self, path: str) -> str:
        """이달의 우리 사진 위 한 줄(README v1.2.3 §11 ②) - 그 사진이 속한 데이트 아카이브 구간의 AI 캡션. 그 구간에 메모가 있으면(메모는 원문이라 한 줄 칸에 싣지 않는다) 빈 값."""
        if not path:
            return ''
        for a in (getattr(self, 'da', None) or {}).get('articles', []):
            for s in as_list(a.get('stops')):
                if isinstance(s, dict) and any(p['path'] == path for p in valid_photos(s)):
                    c = s.get('aiCaption')
                    return c.strip() if (not memo_notes(s) and isinstance(c, str)) else ''
        return ''

    def signal_cells(self, signals: list) -> list:
        """이달의 우리 리드의 숫자 칸 (R51-4) - 생성 콘텐츠는 **어떤 칸을 보일지**(`kind` · `value`와 순서)만 정한다.
        숫자와 라벨은 생성이 준 `count` · `value`가 아니라 호의 사실(`IssueFacts.signal`)이 만든다(지역 칸 = `{지역}에서 보낸 날`, R52-2). 기록에서 셀 수 없는 칸은 보이지 않는다. 보이는 칸은 `SIGNALS_CAP`개까지."""
        cells = []
        for s in signals:
            if not isinstance(s, dict) or not isinstance(s.get('value'), str):
                continue
            found = self.facts.signal(s.get('kind'), s.get('value')) if self.facts else None
            if found is None:
                self.decide(f"이달의 우리 숫자 칸 「{s.get('value')}」({s.get('kind')})은 기록에서 셀 수 없어 보이지 않는다 (R51-4)")
                continue
            cells.append({**s, 'count': found[0], 'value': found[1]})   # 숫자도 라벨도 호의 사실이 만든다 (R52-2)
        return cells[:SIGNALS_CAP]

    @staticmethod
    def evidence_line(evidence: list, year: Optional[int] = None, recalled_days: Any = ()) -> str:
        """README §9 `.evidence` / CORNER_LAYOUT §3-4 - `근거 · ...` 한 줄.

        message -> excerpt를 따옴표로(15자 초과면 날짜만) · photo -> `사진 n장`(사진 근거는 개수를 합쳐 한 번) · date -> 날짜.
        날짜 표기는 `08.22` - 연도는 재소환 기사의 날짜(또는 이 호의 연도 `year`와 다른 해)에만 붙인다(README §11 ⑤).
        `metric`은 저장 스키마에 없다.

        84-g ②(ROADMAP r143 R143-3 ②): 메시지 근거가 **둘 이상의 날짜**에 걸치면 발췌마다 그 메시지 날짜를 붙인다(`09.25 “…” · 09.26 “…”`).
        이때 발췌 없이 날짜만 서는 메시지 근거는, 같은 날짜가 이미 발췌 앞에 붙었으면 다시 쓰지 않는다. 메시지 날짜가 하나뿐이면 84-g 전과 같다.
        """
        def message_day(ev: dict) -> str:
            return (mmdd_or_ymd(ev.get('at'), year, recalled_days)
                    or mmdd_or_ymd(as_dict(ev.get('attribution')).get('at'), year, recalled_days))

        def shown_excerpt(ev: dict) -> Optional[str]:
            ex = ev.get('excerpt')
            return ex if isinstance(ex, str) and ex.strip() and code_points(ex) <= EVIDENCE_EXCERPT_MAX else None

        messages = [ev for ev in evidence if isinstance(ev, dict) and ev.get('type') == 'message']
        per_excerpt_day = len({d for d in (message_day(ev) for ev in messages) if d}) >= 2
        dated_excerpt_days = {message_day(ev) for ev in messages if shown_excerpt(ev) is not None} if per_excerpt_day else set()
        parts: list = []
        photo_at: Optional[int] = None
        photos = 0
        for ev in evidence:
            if not isinstance(ev, dict):
                continue
            kind = ev.get('type')
            if kind == 'message':
                ex = shown_excerpt(ev)
                day = message_day(ev)
                if ex is not None:
                    parts.append(f'{day} “{ex}”' if per_excerpt_day and day else f'“{ex}”')
                elif day and day not in dated_excerpt_days:
                    parts.append(day)
            elif kind == 'photo':
                photos += 1
                if photo_at is None:
                    photo_at = len(parts)
                    parts.append('')
            elif kind == 'date':
                day = mmdd_or_ymd(ev.get('at'), year, recalled_days)
                if day:
                    parts.append(day)
        if photo_at is not None:
            parts[photo_at] = f'사진 {photos}장'
        parts = [p for p in parts if p]
        return ('근거 · ' + ' · '.join(parts)) if parts else ''


# ---------------------------------------------------------------------------
# 호 전체
# ---------------------------------------------------------------------------

def compose_issue(issue: dict, couple: dict, names: list, corners: list, materials: Optional[dict] = None) -> Composition:
    """호 하나를 지면 목록으로 짠다. `corners`는 `corners` 행(corner_type · status · content · skip_reason · last_error)."""
    b = _Builder(issue, couple, names, corners, materials)
    if not b.ready:
        raise ComposeError('ready 코너가 없어 지면을 만들지 않는다')

    # 코너별 지면 (대체 지면을 만들지 않는다 - skipped·미완 코너는 지면과 목차에서 빠진다, §4)
    da_pages = b.date_archive_pages() if 'date_archive' in b.ready else []
    # 이달의 우리 소기사 사진(v1.2.3 D6) - 지면 순서상 데이트 아카이브 뒤(다정한 말들은 사진이 없다). 뒤표지 사진의 집합(실린 사진)에 든다(R136-2 ②).
    # 데이트 아카이브가 없는 호도 같다 - 근거가 사진인 소기사의 사진은 실린 사진이다
    if 'this_month' in b.ready:
        for ta in as_list(as_dict(b.ready['this_month'].get('payload')).get('articles')):
            b.show(this_month_photo(as_dict(ta).get('evidence')) or None)
    cover_ref = _cover_photo_ref(b)
    cover_photo = cover_ref['path'] if cover_ref else None
    # 표지 사진이 실린 사진에 든다(표지가 쓰는 사진도 지면에 실린 것이다)
    shown_date = list(b.shown)
    cover_is_photo = bool(cover_ref and min(cover_ref['width'], cover_ref['height']) >= COVER_MIN_SHORT_SIDE_PX)
    cover_photo_used = cover_photo if cover_is_photo else None
    if cover_photo_used:
        b.show(cover_photo_used)

    # README §2 `@contents.photo` = 데이트 아카이브에 실린 사진 중 표지가 아닌 첫 사진 · `@back.photo` = 실린 사진 중 마지막(R136-2 ② - 이달의 우리 소기사 사진일 수 있다)
    pool = [p for p in shown_date if p != cover_photo_used]
    da_pool = [p for p in pool if p in set(_da_paths(b))]
    contents_photo = da_pool[0] if da_pool else None
    back_photo = pool[-1] if pool else None
    used_up = {contents_photo, back_photo, cover_photo_used}
    sw_opener_photo = next((p for p in b.shown if p not in used_up), None)  # README §9 `@sw.openerPhoto`

    b.ensure_facts()   # 데이트 아카이브가 없는 호도 대화 · 이달의 우리 수치는 호의 사실에서 읽는다
    sw_pages = b.sweet_words_pages(sw_opener_photo) if 'sweet_words' in b.ready else []
    tm_pages = b.this_month_pages() if 'this_month' in b.ready else []

    body_pages = {'date_archive': da_pages, 'sweet_words': sw_pages, 'this_month': tm_pages}
    ordered = [t for t in CORNER_ORDER if body_pages[t]]

    # 쪽 번호(README §11 ⑦) - **표지를 뺀 본문 기준 1부터**: 목차 01, 발행 노트 02, 이후 지면 순서. 표지 2종과 뒤표지에는 폴리오가 없다.
    # 빠진 코너는 번호를 다시 매긴다. (쪽 번호 = 표지부터 센 장 번호 - 1)
    stems = ['cover', 'contents', 'note']
    first_page = {}
    for t in ordered:
        first_page[t] = len(stems)   # 이 코너 첫 지면의 쪽 번호 = (len(stems) + 1) - 1
        stems.extend(['body'] * len(body_pages[t]))
    stems.append('back')

    iv = b.issue_values()
    cover = _cover_values(b, cover_photo_used if cover_is_photo else None)
    toc = []
    for t in ordered:
        payload = as_dict(b.ready[t].get('payload'))
        header = as_dict(b.ready[t].get('header'))
        toc.append({'title': header.get('cornerName') or CORNER_LABELS[t], 'desc': toc_desc(b, t, payload, header),
                    'page': f'{first_page[t]:02d}'})

    closing = f'{b.end_month}월의 온도를\n여기에 두고 갑니다'
    b.say('ondolog', 'fixedFrame', '@back.closing', closing.replace('\n', ' '))

    base = {'issue': iv, 'toc': toc}
    pages: list = []
    cover_stem = 'cover-photo' if cover_is_photo else 'cover-type'
    cover_computed = {**base, 'cover': cover['photo' if cover_is_photo else 'type']}
    pages.append(PageSpec(cover_stem, None, cover_computed, {}, None))
    pages.append(PageSpec('contents', None, {**base, 'contents': {'photo': contents_photo or ''}}, {}, None))
    note_index = len(pages)
    pages.append(PageSpec('note', None, {}, {}, None))  # 발행 노트는 마지막에 채운다(실린 것을 센 뒤)
    for t in ordered:
        pages.extend(body_pages[t])
    pages.append(PageSpec('back', None, {**base, 'back': {
        'photo': back_photo or '', 'closing': closing}}, {}, None))   # R50-5: 다음 호를 약속하는 표시(NEXT ISSUE)는 싣지 않는다

    for n, p in enumerate(pages, 1):  # 폴리오는 표지·뒤표지 외 전부에 있다 - 표지(1장)를 뺀 번호
        p.computed.setdefault('issue', iv)
        if n > 1:
            p.computed['page'] = f'{n - 1:02d}'
    assert len(pages) == len(stems)

    note = _note_values(b, pages)
    pages[note_index].computed.update({'note': note})
    pages[note_index].widths = dict(getattr(b, 'note_widths', {}))

    report = dict(b.report)
    report.update({
        'theme': b.theme,
        'cover': cover_stem,
        'coverPhoto': cover_photo_used,
        'coverHeadlineFrom': cover['headlineFrom'],
        'coverHeadlineUnsplit': cover['headlineUnsplit'],
        'quotePages': getattr(b, 'quote_page_count', 0),
        'leadCounts': {'photos': len(b.facts.photos_shown_period) if b.facts else 0, 'memos': b.facts.memos_shown_period if b.facts else 0},
        'leadPhotoPaths': list(b.facts.photos_shown_period) if b.facts else [],
        'facts': b.facts.to_report() if b.facts else None,
        'contentsPhoto': contents_photo, 'backPhoto': back_photo, 'swOpenerPhoto': sw_opener_photo,
        'pages': [{'n': i, 'stem': p.stem} for i, p in enumerate(pages, 1)],
        'toc': toc,
        'timelinePages': getattr(b, 'timeline_page_count', 0),
        'timelineDroppedStops': len(getattr(b, 'timeline_dropped', [])),
        'omittedPlaces': getattr(b, 'omitted_places', 0),
        'absentCorners': [t for t in CORNER_ORDER if t in b.corner_rows and t not in b.ready],
        'sentences': _sentence_summary(b.sentences),
    })
    return Composition(pages, b.theme, list(b.shown), b.sentences, report)


def _da_paths(b: _Builder) -> list:
    """데이트 아카이브 지면에 실린 사진(오프너 · 타임라인 · 기사) - 이달의 우리 소기사 사진은 빼고."""
    if not b.facts:
        return []
    return [p for f in b.facts.articles for p in f.photos_shown_paths]


def toc_desc(b: _Builder, corner_type: str, payload: dict, header: dict) -> str:
    """목차 설명 줄(README §11 ①) - **코너가 담은 것을 종류와 개수로 적는다. 형용사를 쓰지 않는다.** 고정 틀 세 개. 개수는 호의 사실에서 읽는다(R50-2)."""
    if corner_type == 'date_archive':
        month = month_of_label(header.get('periodLabel')) or f'{b.end_month}월'
        recalled = f' · 그때 그 시절 {b.facts.articles_recalled}편' if b.facts.articles_recalled > 0 else ''   # 재소환이 없으면 뒤 조각은 없다
        return f'화보 · {month}의 하루 {b.facts.articles_period}편{recalled}'
    if corner_type == 'sweet_words':
        return '인용 · 원문 그대로'
    headline = as_dict(payload.get('theme')).get('headline')
    pieces = ['기사']
    if isinstance(headline, str) and headline.strip():
        pieces.append(headline)
    pieces.append(f'소기사 {b.facts.this_month_articles}편')
    return ' · '.join(pieces)


def _cover_photo_ref(b: _Builder) -> Optional[dict]:
    """MASTER 9-5 r64 대표 사진 사슬 - featured 첫 stop의 첫 사진 -> 그 코너 전체의 첫 사진. 없으면 None."""
    if 'date_archive' not in b.ready:
        return None
    articles, fi = b.da['articles'], b.da['fi']
    order = [fi] + [i for i in range(len(articles)) if i != fi]
    candidates = []
    first = articles[fi]
    stops = as_list(first.get('stops'))
    if stops and isinstance(stops[0], dict):
        photos = as_list(stops[0].get('photos'))
        if photos and isinstance(photos[0], dict):
            candidates.append(photos[0])
    for i in order:
        for s in as_list(articles[i].get('stops')):
            for p in as_list(as_dict(s).get('photos')):
                candidates.append(p)
    for p in candidates:
        if isinstance(p, dict) and isinstance(p.get('path'), str):
            w, h = p.get('width'), p.get('height')
            return {'path': p['path'], 'width': w if isinstance(w, (int, float)) else 0, 'height': h if isinstance(h, (int, float)) else 0}
    return None


def _cover_values(b: _Builder, photo: Optional[str]) -> dict:
    """표지 원천(MASTER 9-5 r64). 표제 = 이달의 우리 theme.headline(3줄·줄당 6자로 나뉘지 않으면 이 달의 말) · 이 달의 말 = main[0] 첫 발화."""
    quote = speaker = None
    if 'sweet_words' in b.ready:
        mains = [m for m in as_list(as_dict(b.ready['sweet_words'].get('payload')).get('main')) if isinstance(m, dict)]
        turns = as_list(mains[0].get('turns')) if mains else []
        if turns and isinstance(turns[0], dict) and not is_blank(turns[0].get('text')):
            quote, speaker = turns[0]['text'], turns[0].get('speaker')
    headline = None
    if 'this_month' in b.ready:
        headline = as_dict(as_dict(b.ready['this_month'].get('payload')).get('theme')).get('headline')
    lines = split_headline(headline)
    from_ = 'theme.headline'
    if lines is None:
        from_ = 'quote' if quote else ('theme.headline-unsplit' if headline else 'none')
    if lines is not None:
        photo_headline, type_headline = ' '.join(lines), '\n'.join(lines)
    elif quote:
        photo_headline = type_headline = quote
    else:
        photo_headline = type_headline = headline or ''
    # 88- E3(README v1.2.4 §11 ⑭ · §10 ④ E3): 표제가 이 달의 말에서 왔으면(`headlineFrom == 'quote'`) 같은 문장을 두 번 싣지 않는다 -
    # 인용 줄(`quote` · `quoteBy`)은 빈 값(줄째 빠짐), 표제 아래 `이 달의 말 · {말한 사람}` 줄(`headlineBy`). 아니면 `headlineBy`는 빈 값.
    # (검토 diff의 `lines is None and bool(quote)`와 같은 뜻 - 위에서 `from_ = 'quote'`는 정확히 그때만 선다.)
    # `heldQuote` · `heldQuoteBy`는 슬롯이 없는 보관 값 - 표제가 잘려 이달의 우리 표제로 되돌릴 때(render_issue.settle_cover) 인용 줄을 되살린다.
    same = from_ == 'quote'
    common = {'quote': '' if same else (quote or ''), 'quoteBy': '' if same else (speaker or ''),
              'headlineBy': (speaker or '') if same else '', 'heldQuote': quote or '', 'heldQuoteBy': speaker or '',
              'temperature': ''}  # 우리의 온도는 지금 늘 없다(일 배치 전)
    return {
        'photo': {**common, 'photo': photo or '', 'headline': photo_headline},
        'type': {**common, 'headline': type_headline},
        'headlineFrom': from_,
        'headlineUnsplit': headline if isinstance(headline, str) else '',   # 표제가 이 달의 말로 바뀐 표지가 잘리면 되돌릴 원래 표제
    }


def _sentence_summary(sentences: list) -> dict:
    total = {'people': 0, 'ondolog': 0}
    by_kind: dict = {}
    for s in sentences:
        total[s['who']] += s['sentences']
        key = f"{s['who']}:{s['kind']}"
        by_kind[key] = by_kind.get(key, 0) + s['sentences']
    return {'people': total['people'], 'ondolog': total['ondolog'], 'byKind': by_kind}


NOTE_ROW_LABELS = {'dates': ('데이트', '번', '{n}번'), 'photos': ('사진', '장', '{n}장'),
                   'memos': ('메모', '개', '{n}개'), 'messages': ('대화', '개', '인용 {n}개')}


def timeline_totals(lead_f: Any) -> str:
    """타임라인 아래 합계 한 줄 - `사진 3 / 4장 · 메모 2`. 0인 조각은 뺀다(`사진 0장 · 메모 2` -> `메모 2`, R51-5). 둘 다 0이면 빈 글자."""
    pieces = []
    if lead_f.photos_total > 0:
        pieces.append(f'사진 {ratio_label(lead_f.timeline_photos_shown, lead_f.photos_total)}장')
    if lead_f.memos_total > 0:
        pieces.append(f'메모 {ratio_label(lead_f.memos_shown, lead_f.memos_total)}')
    return ' · '.join(pieces)


def not_used_text(row_key: str, item: dict, timeline_max_pages: int) -> str:
    """발행 노트 '싣지 않은 것' 한 줄 - 호의 사실의 항목(`kind` · `n`)을 문장으로. 숫자는 항목의 것이고 여기서 세지 않는다."""
    n, kind = item['n'], item['kind']
    texts = {
        ('dates', 'unpicked'): f'기사로 고르지 않은 날 {n}번',
        ('photos', 'over_cap'): f'사진 {n}장 — 한 구간에 {PHOTOS_PER_STOP}장까지 싣습니다',
        # 84-h · v1.2.4 §11 ⑬ 확정: 사진이 0이면 `(사진 0장)` 조각을 뺀다 - 메모 쪽(`article_dropped_stops`)과 같은 모양
        ('photos', 'dropped_stops'): (f"구간 {item.get('stops', 0)}곳(사진 {n}장) — 타임라인 {timeline_max_pages}면에 들어가지 않았습니다" if n
                                      else f"구간 {item.get('stops', 0)}곳 — 타임라인 {timeline_max_pages}면에 들어가지 않았습니다"),
        ('photos', 'other_cap'): f'사진 {n}장 — 대표가 아닌 기사에는 {ARTICLE_PHOTOS}장까지 싣습니다',
        ('photos', 'unpicked'): f'사진 {n}장 — 기사에 담기지 않았습니다',
        ('memos', 'extra_in_stop'): f'메모 {n}개 — 한 구간에 하나만 싣습니다',
        ('memos', 'dropped_stops'): f'메모 {n}개 — 타임라인 {timeline_max_pages}면에 들어가지 않은 구간의 것입니다',
        ('memos', 'other_cap'): f'메모 {n}개 — 대표가 아닌 기사에는 실린 사진 · 구간마다 메모 하나만 싣습니다',
        ('memos', 'caption_overflow'): f'메모 {n}개 — 사진 아래 칸에 들어가지 않아 줄이지 않고 뺐습니다',
        ('memos', 'article_dropped_stops'): (f"구간 {item.get('stops', 0)}곳(메모 {n}개) — 글만 있는 기사 한 면에 들어가지 않았습니다" if n
                                             else f"구간 {item.get('stops', 0)}곳 — 글만 있는 기사 한 면에 들어가지 않았습니다"),
        ('memos', 'unpicked'): f'메모 {n}개 — 기사에 담기지 않았습니다',
        ('messages', 'unpicked'): f'대화 {n}개 — 인용으로 고르지 않았습니다',
    }
    return texts[(row_key, kind)]


# 84-c2(ROADMAP R134-5 ②) - 발행 노트 끝 AI 안내 한 줄(합니다체). **이 상수 한 곳에서만** 받는다 - 법무 검토(M4-7)에서 문장이 바뀌면 여기만 고친다.
# 자리 · 크기는 디자인 v1.2.3 #19(`note.html` 슬롯 `@note.aiNotice`)가 정했다 - 렌더러가 줄을 끼우던 84-c2 임시 처리는 없앴다(D7).
# 틀 문구처럼 '온도록이 쓴 문장' 수에는 넣지 않는다(결정 기록).
NOTE_AI_NOTICE = '온도록이 쓴 문장은 두 분의 기록을 바탕으로 AI가 만들었습니다. 두 분이 남긴 말과 사진은 고치지 않았습니다.'

INFO_TEXTS = {
    'drawings': lambda n: f'그림 {n}개 — 이 호의 지면에는 그림 자리가 없습니다',
    'omitted_places': lambda n: f'장소 {n}곳 — 목록에 {PLACES_CAP}곳까지 싣습니다',
    'article_dropped_stops': lambda n: f'구간 {n}곳 — 글만 있는 기사 한 면에 들어가지 않았습니다',
}


def _note_values(b: _Builder, pages: list) -> dict:
    """발행 노트(CORNER_LAYOUT §3-0) - 재료 집계 · 문장 출처 · 싣지 않은 것 · 비어 있는 코너. 형용사 없는 문장만.

    표와 '싣지 않은 것'의 숫자는 모두 호의 사실(`b.facts`)에서 읽는다 - 줄마다 `모은 양 - 실제 게재 = 싣지 않은 것의 합`이다(R50-2).
    """
    summary = _sentence_summary(b.sentences)
    people, ondolog = summary['people'], summary['ondolog']
    total = people + ondolog
    # 반올림은 .5를 올린다(파이썬 `round`의 은행가 반올림을 쓰지 않는다)
    ratio_people = int(people * 100 / total + 0.5) if total > 0 else None   # 문장이 하나도 없으면 비율도 없다(막대는 지면에서 지워진다)
    # 막대 폭은 글자(`34%`)와 따로 숫자로 맡긴다 - `data-width`는 `34%` 글자를 받지 않는다(R48-6, 디자인 resolve.js와 같다)
    # v1.2.3 #6 · D7 - 막대 폭 경로는 `@note.ratioPeopleWidth` · `@note.ratioOndologWidth`(숫자), 글자 경로 `@note.ratioPeople` · `.ratioOndolog`(`34%`)와 섞지 않는다
    b.note_widths = ({'@note.ratioPeopleWidth': ratio_people, '@note.ratioOndologWidth': 100 - ratio_people} if ratio_people is not None else {})

    facts = b.facts
    rows = []
    not_used = []
    for r in facts.rows:
        label, unit, used_label = NOTE_ROW_LABELS[r['key']]
        rows.append({'label': label, 'collected': f"{r['collected']}{unit}", 'used': used_label.format(n=r['used'])})
        not_used.extend(not_used_text(r['key'], i, TIMELINE_MAX_PAGES) for i in r['items'])
    not_used.extend(INFO_TEXTS[i['kind']](i['n']) for i in facts.info)
    if not not_used:
        not_used = ['모두 실었습니다']

    empty = []
    for t in CORNER_ORDER:
        row = b.corner_rows.get(t)
        if row is None or t in b.ready:
            continue
        reason = SKIP_REASON_KO.get((t, row.get('skip_reason'))) if row.get('status') == 'skipped' else None
        empty.append(f'{CORNER_LABELS[t]} — {reason or SKIP_REASON_OTHER}')
    if not empty:
        empty = ['이번 호에는 없습니다']

    return {
        'materials': rows,
        'ratioPeople': f'{ratio_people}%' if ratio_people is not None else '',
        'ratioOndolog': f'{100 - ratio_people}%' if ratio_people is not None else '',
        'ratioPeopleWidth': ratio_people if ratio_people is not None else '',
        'ratioOndologWidth': (100 - ratio_people) if ratio_people is not None else '',
        'sentencesPeople': f'{people}개',
        'sentencesOndolog': f'{ondolog}개',
        'notUsed': not_used,
        'emptyCorners': empty,
        # R51-2 - 이번 기간 표와 따로 한 줄. 재소환이 0이면 빈 글자(줄 없음). 숫자는 호의 사실(`photos_shown_recalled`)에서 온다
        'recalledPhotos': len(facts.photos_shown_recalled),
        'recalledPhotosLine': (f'그때 그 시절 · 지난 기록에서 다시 실은 사진 {len(facts.photos_shown_recalled)}장' if facts.photos_shown_recalled else ''),
        # 84-c2(R134-5) - 발행 노트 끝 AI 안내 한 줄. 문장은 `NOTE_AI_NOTICE` 한 곳 -> 디자인 v1.2.3 슬롯 `@note.aiNotice`(#19 · D7, 틀이 자리를 가진다)
        'aiNotice': NOTE_AI_NOTICE,
    }


# ---------------------------------------------------------------------------
# 변형 고르기 (README §3)
# ---------------------------------------------------------------------------

def choose_variant(page: PageSpec, names: frozenset, scope: Any) -> Optional[str]:
    """`data-variant` 형제 중 하나를 고른다 - AI가 아니라 개수가 정한다(README §3, CORNER_LAYOUT §3-1·§3-4)."""
    if names == frozenset({'photos-0', 'photos-1', 'photos-2', 'photos-3'}):
        return f"photos-{min(len(as_list(as_dict(scope).get('photos'))), PHOTOS_PER_STOP)}"
    if names == frozenset({'grid-2', 'grid-3', 'grid-4'}):
        n = len(as_list(as_dict(as_dict(page.corner).get('payload')).get('articles')))
        return f'grid-{min(max(n, 2), 4)}'
    if names == frozenset({'hero-photo', 'hero-none'}):   # v1.2.3 da-article (D1) - 그 기사(`bind.i`)에 사진이 하나라도 있으면 hero-photo
        i = as_dict(page.bind).get('i')
        arts = as_list(as_dict(as_dict(page.corner).get('payload')).get('articles'))
        return 'hero-photo' if isinstance(i, int) and 0 <= i < len(arts) and has_photo(as_dict(arts[i])) else 'hero-none'
    if names == frozenset({'with-photo', 'type-only'}):
        # 오프너 사진은 지면마다 원천이 다르다 - 데이트 아카이브는 대표 기사 전체 stop의 첫 사진, 다정한 말들은 쓰지 않은 첫 사진(README §3)
        group = 'da' if page.stem == 'da-opener' else 'sw'
        return 'with-photo' if not is_blank(as_dict(as_dict(page.computed).get(group)).get('openerPhoto')) else 'type-only'
    return None
