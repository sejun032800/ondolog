"""조판 구성 - 호 하나를 지면 목록(어느 지면 · 어떤 데이터 · 어떤 코너 밖 값)으로 짠다 (위임: 55-2, 55-3).

네트워크·파일을 모른다. 입력은 이미 읽어 온 호·커플·코너 행이고, 출력은 `Composition`이다. 채움은 `slot_fill`, 렌더는 `render_issue`가 한다.

원본
  - 지면·슬롯·코너 밖 값의 이름과 계산: `render/issue/README.md` v1.2.2 §2·§3·§5·§9·§10·§11·§12
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
from facts import (  # noqa: E402  (호의 사실 - 지면의 수치 · 목록은 모두 여기서 한 번 계산한다. 아래 이름은 compose에서도 쓸 수 있게 다시 내보낸다)
    ARTICLE_PHOTOS, PHOTOS_PER_STOP, PLACES_CAP, UNNAMED_PLACE, FactsError, IssueFacts, article_photos, as_dict, as_list, build_facts,
    caption_memo_count, first_photo_any, first_photo_path, is_blank, memo_notes, mmdd_dot, ratio_label, shown_photos_of_stop,
    stop_photo_counts, ymd_dot,
)

THEMES = ('basic', 'hip', 'neon', 'lovely', 'night', 'ondol')
CORNER_ORDER = ('date_archive', 'sweet_words', 'this_month')  # CORNER_LAYOUT §6 (연애 DNA·연애리그 없음)
CORNER_LABELS = {'date_archive': '데이트 아카이브', 'sweet_words': '다정한 말들', 'this_month': '이달의 우리'}

# README §5 - 판면 가용 높이와 stop 높이 실측표. (사진 장수(3 = 3장 이상), 유저 메모 있음) -> px
# 표는 메모 50자 안팎 기준이다. 메모가 더 길면 50자마다 29px을 더한다(README §5·§12, 55-3).
TIMELINE_CAPACITY_PX = 953
STOP_HEIGHT_PX = {
    (0, True): 148, (0, False): 101,
    (1, True): 390, (1, False): 338,
    (2, True): 378, (2, False): 326,
    (3, True): 453, (3, False): 401,
}
TIMELINE_MEMO_BASE_CHARS = 50   # README §12 - §5 표는 메모 50자 안팎을 기준으로 잰 값
TIMELINE_MEMO_STEP_PX = 29      # README §12 - 메모 50자마다 약 29px
TIMELINE_MAX_PAGES = 2          # CORNER_LAYOUT §3-1 "타임라인 1~2면", §4 "배열이 예상보다 김: 상한까지만"
SIGNALS_CAP = 3                 # CORNER_LAYOUT §3-4 "요약 수치 3개"
# README §12 - 다정한 말들 인용 블록의 가용 높이(그 면의 단문 개수에 따라)와 대화 하나의 높이. 대화 단위로 면을 나눈다.
QUOTE_CAPACITY_PX = 844         # 단문 0~2개
QUOTE_CAPACITY_WITH_SUB_PX = 781  # 단문 3개 이상
QUOTE_SUB_CROWDED = 3
QUOTE_BASE_PX = 113             # 대화 높이 = 113 + 64 x 턴 수 (표의 12자 열: 177 · 241 · 305 · 369) + 줄 늘어남
QUOTE_TURN_PX = 64
QUOTE_LINE_PX = 22              # "35자마다 22px씩 늘어난다고 보면 된다"
QUOTE_LINE_CHARS = 35
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


def text_lines(text: Any, chars_per_line: int = QUOTE_LINE_CHARS) -> int:
    """글자가 차지하는 줄 수 추정 - 원문의 줄바꿈마다 새 줄, 한 줄은 약 35자(README §12). 비어 있어도 1줄."""
    if not isinstance(text, str):
        return 1
    return sum(max(1, -(-code_points(seg) // chars_per_line)) for seg in text.replace('\r\n', '\n').split('\n'))


def conversation_height(main: dict) -> int:
    """대화 하나(정황 + 출처 + 턴들)의 높이 추정(README §12 표). 높이 = 113 + 64 x 턴 수, 35자를 넘는 줄마다 22px."""
    turns = [t for t in as_list(main.get('turns')) if isinstance(t, dict)]
    extra = sum(QUOTE_LINE_PX * (text_lines(t.get('text')) - 1) for t in turns)
    return QUOTE_BASE_PX + QUOTE_TURN_PX * len(turns) + extra


def pack_quotes(heights: list, sub_count: int, names: Optional[list] = None) -> list:
    """대화 높이 목록 -> 면별 대화 번호 목록(README §12). **대화 단위**로 앞에서부터 채우고 한 대화를 두 면에 쪼개지 않는다.

    가용 높이는 단문 0~2개면 844px, 3개 이상이면 781px이다. 단문은 마지막 면에만 실리므로 781은 마지막 면에만 건다.
    한 대화가 가용 높이를 넘으면 `ComposeError`(어느 대화 · 높이 · 가용 높이) - 자르지 않는다(R29-3).
    """
    names = names or [f'{i + 1}번째 대화' for i in range(len(heights))]
    for i, h in enumerate(heights):
        if h > QUOTE_CAPACITY_PX:
            raise ComposeError(f'{names[i]}이(가) 한 면을 넘는다 (높이 {h}px, 가용 {QUOTE_CAPACITY_PX}px) - 한 대화를 두 면에 쪼개지 않는다')
    pages: list = [[]]
    used = 0
    for i, h in enumerate(heights):
        if pages[-1] and used + h > QUOTE_CAPACITY_PX:
            pages.append([])
            used = 0
        pages[-1].append(i)
        used += h
    last_cap = QUOTE_CAPACITY_WITH_SUB_PX if sub_count >= QUOTE_SUB_CROWDED else QUOTE_CAPACITY_PX
    if sum(heights[i] for i in pages[-1]) > last_cap:
        moved = pages[-1].pop()      # 단문과 함께 실리는 마지막 면이 넘치면 마지막 대화만 따로 한 면에 둔다
        if heights[moved] > last_cap:
            raise ComposeError(f'{names[moved]}이(가) 한 면을 넘는다 (높이 {heights[moved]}px, 가용 {last_cap}px - 단문 {sub_count}개와 함께 실리는 면)')
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
    """README §5 표 + 메모 보정 - 메모가 50자를 넘으면 50자마다 29px을 더한다(§12). 지면이 그리는 메모는 첫 메모 하나다."""
    photos = min(len(as_list(stop.get('photos'))), PHOTOS_PER_STOP)
    memos = memo_notes(stop)
    height = STOP_HEIGHT_PX[(photos, len(memos) > 0)]
    if memos:
        over = code_points(memos[0]['text']) - TIMELINE_MEMO_BASE_CHARS
        if over > 0:
            height += TIMELINE_MEMO_STEP_PX * -(-over // TIMELINE_MEMO_BASE_CHARS)
    return height


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
    return [p for p in pages if p], dropped


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
        self.report: dict = {'decisions': []}
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
            v['time'] = hhmm(v.get('time'))
            v['photoLabel'] = ratio_label(*stop_photo_counts(s))
            view_stops.append(v)
        try:
            tl_pages, dropped_stops = split_timeline(view_stops)
        except ComposeError as e:
            raise ComposeError(f"호 {self.issue.get('id')}: {e}") from None
        kept_stops = [s for p in tl_pages for s in p]

        # 임시 규칙 R48-3 ①(디자인 v1.2.3 전까지): da-article 히어로는 첫 stop의 첫 사진 하나뿐이고 폴백이 없다 - 원천이 없으면 빈 틀을 싣지 않고 렌더를 멈춘다
        for i, a in enumerate(articles):
            if i != fi and first_photo_path(a) is None:
                raise ComposeError(f"호 {self.issue.get('id')}: 데이트 아카이브 {i + 1}번째 기사({str(a.get('title') or '')[:20]})의 히어로 사진 원천이 없다 "
                                   f'(첫 구간의 첫 사진 - 지면에 폴백이 없다. 디자인 v1.2.3 전 임시 규칙 R48-3 ①)')

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
            self.show(first_photo_path(a))
            for p in article_photos(a):
                self.show(p['path'])

        # @da.lead - 지면에 실제로 실린 것만 센다(R26-5): 데이트는 이번 기간 모은 양, 사진 · 메모는 이번 기간 기사 중 실린 것(재소환은 따로)
        regions = facts.regions
        region_part = f"{', '.join(regions)}, " if regions else ''
        lead = (f'{month}에 두 사람이 함께 보낸 날은 {facts.period_dates}번이었습니다. '
                f'{region_part}{facts.place_count}곳을 거치며 남긴 {len(facts.photos_shown_period)}장의 사진과 '
                f'{facts.memos_shown_period}개의 메모를 그대로 실었습니다.')
        route_headline = f'{month}에 두 사람이 그린 지도'
        self.say('ondolog', 'fixedFrame', '@da.lead', lead)
        self.say('ondolog', 'fixedFrame', '@da.routeHeadline', route_headline)

        records = ''
        if lead_f.memos_total + lead_f.ai_captions_shown > 0:
            records = f'남긴 기록 · 메모 {lead_f.memos_total}' + (f' · AI 캡션 {lead_f.ai_captions_shown}' if lead_f.ai_captions_shown > 0 else '')

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
            'photoCount': lead_f.photos_total,
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
                'totals': (f'사진 {ratio_label(lead_f.timeline_photos_shown, lead_f.photos_total)}장 · '
                           f'메모 {ratio_label(lead_f.memos_shown, lead_f.memos_total)}'),
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
            'routeSummary': f'{facts.region_count}개 지역 · {facts.place_count}개 장소',
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
            years = self.end_year - int(str(a.get('dateOn') or '0000')[0:4]) if re.match(r'^\d{4}', str(a.get('dateOn') or '')) else 0
            # R26-4: anniversary만 "N년 전 이맘때". 나머지 사유는 빈 값(줄 삭제)
            va['recallReason'] = f'{years}년 전 이맘때' if (a.get('recalled') is True and a.get('recallReason') == 'anniversary' and years > 0) else None
            af = facts.article(i)
            a_photos = article_photos(a)
            computed = {'da': {
                'articleNo': f'{i + 1:02d}',
                'articleOrdinalEn': ordinal_en(i + 1),
                'articlePhotoNote': photo_note(af.photos_total, af.photos_shown),
                'articleDate': ymd_dot(a.get('dateOn')),
                'articleRoute': af.route,
                'articlePhotoCount': af.photos_total,
                'articleNoteCount': af.memos_total,
                'articleStopCount': af.stop_count,
                'articleCaptionCount': af.ai_captions_shown if af.ai_captions_shown > 0 else '',   # 실린 수만, 0이면 빈 값 -> 칸째 뺀다 (R50-4)
                'articlePhotos': a_photos,
            }}
            pages.append(PageSpec('da-article', v, computed, {'featured': fi, 'i': i}, 'date_archive'))
            self.say('ondolog', 'headline', 'date_archive.article.title', a.get('title'))
            for p in a_photos:   # R48-3 ②: 사진 아래 캡션은 유저 메모다(AI 캡션은 싣지 않는다)
                if p['caption']:
                    self.say('people', 'userNotes', 'date_archive.article.photoCaption', p['caption'])
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
        # 인용면 나눔(README §12) - 대화 높이를 더해 가용 높이(844 / 단문 3개 이상 781)를 넘으면 **대화 단위로** 다음 면. 단문은 마지막 면에만.
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
        lead['payload']['theme']['signals'] = copy.deepcopy(as_list(theme.get('signals')))[:SIGNALS_CAP]

        view = copy.deepcopy(content)
        # README §11 ⑤ - 근거 날짜는 `08.22`, 재소환 기사의 날짜만 연도를 붙인다
        recalled_days = self.facts.recalled_days if self.facts else set()
        # README §11 ④ - `.seq`는 두 자리 `01`. seq가 0부터면 +1 해서 쓴다
        seqs = [a['seq'] for a in view['payload']['articles'] if isinstance(a.get('seq'), int)]
        seq_shift = 1 if seqs and min(seqs) == 0 else 0
        for a in view['payload']['articles']:
            a['seq'] = f"{a['seq'] + seq_shift:02d}" if isinstance(a.get('seq'), int) else None
            a['evidence'] = self.evidence_line(as_list(a.get('evidence')), self.end_year, recalled_days)
            a.pop('photo', None)  # R44-9 - `Evidence.path`가 생기기 전까지 소기사에 사진을 붙이지 않는다. 사진 틀은 비어 삭제된다
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

    @staticmethod
    def evidence_line(evidence: list, year: Optional[int] = None, recalled_days: Any = ()) -> str:
        """README §9 `.evidence` / CORNER_LAYOUT §3-4 - `근거 · ...` 한 줄.

        message -> excerpt를 따옴표로(15자 초과면 날짜만) · photo -> `사진 n장`(사진 근거는 개수를 합쳐 한 번) · date -> 날짜.
        날짜 표기는 `08.22` - 연도는 재소환 기사의 날짜(또는 이 호의 연도 `year`와 다른 해)에만 붙인다(README §11 ⑤).
        `metric`은 저장 스키마에 없다.
        """
        parts: list = []
        photo_at: Optional[int] = None
        photos = 0
        for ev in evidence:
            if not isinstance(ev, dict):
                continue
            kind = ev.get('type')
            if kind == 'message':
                ex = ev.get('excerpt')
                if isinstance(ex, str) and ex.strip() and code_points(ex) <= EVIDENCE_EXCERPT_MAX:
                    parts.append(f'“{ex}”')
                else:
                    day = (mmdd_or_ymd(ev.get('at'), year, recalled_days)
                           or mmdd_or_ymd(as_dict(ev.get('attribution')).get('at'), year, recalled_days))
                    if day:
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
    cover_ref = _cover_photo_ref(b)
    cover_photo = cover_ref['path'] if cover_ref else None
    # 표지 사진이 실린 사진에 든다(표지가 쓰는 사진도 지면에 실린 것이다)
    shown_date = list(b.shown)
    cover_is_photo = bool(cover_ref and min(cover_ref['width'], cover_ref['height']) >= COVER_MIN_SHORT_SIDE_PX)
    cover_photo_used = cover_photo if cover_is_photo else None
    if cover_photo_used:
        b.show(cover_photo_used)

    pool = [p for p in shown_date if p != cover_photo_used]        # README §2 `@contents.photo`·`@back.photo`의 집합
    contents_photo = pool[0] if pool else None
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
    common = {'quote': quote or '', 'quoteBy': speaker or '', 'temperature': ''}  # 우리의 온도는 지금 늘 없다(일 배치 전)
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


def not_used_text(row_key: str, item: dict, timeline_max_pages: int) -> str:
    """발행 노트 '싣지 않은 것' 한 줄 - 호의 사실의 항목(`kind` · `n`)을 문장으로. 숫자는 항목의 것이고 여기서 세지 않는다."""
    n, kind = item['n'], item['kind']
    texts = {
        ('dates', 'unpicked'): f'기사로 고르지 않은 날 {n}번',
        ('photos', 'over_cap'): f'사진 {n}장 — 한 구간에 {PHOTOS_PER_STOP}장까지 싣습니다',
        ('photos', 'dropped_stops'): f"구간 {item.get('stops', 0)}곳(사진 {n}장) — 타임라인 {timeline_max_pages}면에 들어가지 않았습니다",
        ('photos', 'other_cap'): f'사진 {n}장 — 대표가 아닌 기사에는 {ARTICLE_PHOTOS}장까지 싣습니다',
        ('photos', 'unpicked'): f'사진 {n}장 — 기사에 담기지 않았습니다',
        ('memos', 'extra_in_stop'): f'메모 {n}개 — 한 구간에 하나만 싣습니다',
        ('memos', 'dropped_stops'): f'메모 {n}개 — 타임라인 {timeline_max_pages}면에 들어가지 않은 구간의 것입니다',
        ('memos', 'other_cap'): f'메모 {n}개 — 대표가 아닌 기사에는 하나만 싣습니다',
        ('memos', 'unpicked'): f'메모 {n}개 — 기사에 담기지 않았습니다',
        ('messages', 'unpicked'): f'대화 {n}개 — 인용으로 고르지 않았습니다',
    }
    return texts[(row_key, kind)]


INFO_TEXTS = {
    'drawings': lambda n: f'그림 {n}개 — 이 호의 지면에는 그림 자리가 없습니다',
    'omitted_places': lambda n: f'장소 {n}곳 — 목록에 {PLACES_CAP}곳까지 싣습니다',
    'evidence_photos': lambda n: f'근거 사진 {n}장 — 이달의 우리에는 개수만 적습니다',
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
    b.note_widths = ({'@note.ratioPeople': ratio_people, '@note.ratioOndolog': 100 - ratio_people} if ratio_people is not None else {})

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
        'sentencesPeople': f'{people}개',
        'sentencesOndolog': f'{ondolog}개',
        'notUsed': not_used,
        'emptyCorners': empty,
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
    if names == frozenset({'with-photo', 'type-only'}):
        # 오프너 사진은 지면마다 원천이 다르다 - 데이트 아카이브는 대표 기사 전체 stop의 첫 사진, 다정한 말들은 쓰지 않은 첫 사진(README §3)
        group = 'da' if page.stem == 'da-opener' else 'sw'
        return 'with-photo' if not is_blank(as_dict(as_dict(page.computed).get(group)).get('openerPhoto')) else 'type-only'
    return None
