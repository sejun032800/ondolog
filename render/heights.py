"""높이 어림 - `render/issue/measure.json`(디자인 v1.2.3 README §12 실측 표)만 읽는다 (위임: 84-d, D10 · D2 · D5).

**값을 코드에 옮겨 적지 않는다.** 표가 원본이고, 틀의 활자 · 폭이 바뀌면 디자인이 `tools/measure.py`로 다시 재 `measure.json`을 바꾼다.
규칙(README §12 "두 가지로 나눠 잰다")
  - 줄 수: 활자 칸마다의 표에서 **글자 수 이상인 첫 칸**(보간하지 않는다). 줄바꿈으로 나뉜 조각은 따로 세어 더한다.
  - 상자: 고정 + 줄 높이 x 줄 수. 표가 직선이 아니라고 적은 상자(`straight: false`)는 잰 값을 그대로 쓰고, 넘으면 가장 큰 증가분을 더한다.
  - 표 끝(가장 긴 칸)을 넘는 조각: 표의 마지막 칸 비율(글자 수당 줄 수)로 늘린다 - 크게 잡는 쪽이다(작게 어림하면 넘친 지면이 나간다).

네트워크를 모른다. 파일 하나를 읽는다.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any

sys.dont_write_bytecode = True

MEASURE_PATH = Path(__file__).resolve().parent / 'issue' / 'measure.json'
MEASURE: dict = json.loads(MEASURE_PATH.read_text(encoding='utf-8'))

# 88-(ROADMAP R149-5 · README v1.2.4 §12) 칸 종류별로 줄 수 표의 어느 열을 쓸지 - 이 설정 한 곳에서만 정한다(디자인 도구 · `measure.json` 모양은 그대로).
#   'lines'        = 디자인 `measure.py`가 여유 1줄(`SAFETY_LINES`)을 더해 적은 열(여유 있음)
#   'sampledLines' = 같은 측정의 여유 전 값(여유 없음)
# 판정 규칙: 칸 종류마다 렌더 환경에서 견본(시드 3 · 칸마다 210 - 시험 데이터 문장 · 낱말 길이를 섞은 합성 문장 · 줄바꿈 섞은 문장)으로
#   여유 없음 열의 예측 < 실제 − 0.5px 이 **0건이면 뺀다('sampledLines')**, 1건이라도 있으면 **남긴다('lines')**.
# 판정 표: HANDOFF `88-` 절 "③ 높이 여유 1줄 판정"(2026-11-23 · 9칸 모두 여유 없음 과소 4~49건 -> 모두 남김).
# 표를 다시 재도(`tools/measure.py`) 이 설정이 그대로 적용된다. 다시 판정하면 이 표와 HANDOFF 판정 표를 함께 고친다.
LINE_COLUMN: dict[str, str] = {
    'timeline.memoLines': 'lines',
    'timeline.captionLines': 'lines',
    'timeline.placeLines': 'lines',
    'quotes.turnLines.odd': 'lines',
    'quotes.turnLines.even': 'lines',
    'quotes.contextLines': 'lines',
    'article.stopMemoLines': 'lines',
    'article.photoCaption.1.memoLines': 'lines',
    'article.photoCaption.2.memoLines': 'lines',
    'article.photoCaption.3.memoLines': 'lines',
}


def line_table(path: str, measure: dict | None = None) -> dict:
    """줄 수 표 하나를 `LINE_COLUMN`이 고른 열로 - {'chars', 'lines'}. 설정에 없는 표 · 열이 없으면 KeyError(조용히 다른 열을 쓰지 않는다)."""
    node: Any = MEASURE if measure is None else measure
    for key in path.split('.'):
        node = node[key]
    return {'chars': node['chars'], 'lines': node[LINE_COLUMN[path]]}


def segment_lines(table: dict, n: int) -> int:
    """조각 하나(줄바꿈 없는 글자 n자)의 줄 수 - 표의 `n 이상인 첫 칸`. 빈 조각도 한 줄을 쓴다."""
    chars, lines = table['chars'], table['lines']
    for c, l in zip(chars, lines):
        if c >= n:
            return max(1, l)
    return max(lines[-1], math.ceil(n * lines[-1] / chars[-1]))


def table_lines(table: dict, text: Any) -> int:
    """글자의 줄 수 - 줄바꿈으로 나눈 조각마다 `segment_lines`를 더한다. 글자가 없으면 1줄(칸이 비어도 줄 높이는 남는다)."""
    if not isinstance(text, str) or text == '':
        return 1
    return sum(segment_lines(table, len(seg)) for seg in text.replace('\r\n', '\n').split('\n'))


def box(spec: dict, lines: int) -> float:
    """상자 높이 - `straight`면 base + perLine x 줄 수, 아니면 잰 값(1~4줄) + 넘는 줄마다 잰 값의 가장 큰 증가분."""
    if spec.get('straight', True) or not spec.get('measured1to4'):
        return spec['base'] + spec['perLine'] * lines
    m = spec['measured1to4']
    if lines <= 0:
        return spec['base']
    if lines <= len(m):
        return m[lines - 1]
    step = max(b - a for a, b in zip(m, m[1:]))
    return m[-1] + step * (lines - len(m))


def ceil_px(h: float) -> int:
    return int(math.ceil(h - 1e-9))


# --- 타임라인 구간 (README §12 "타임라인 구간") ---------------------------------

TIMELINE = MEASURE['timeline']
TL_MEMO = line_table('timeline.memoLines')
TL_CAPTION = line_table('timeline.captionLines')
TL_PLACE = line_table('timeline.placeLines')
TIMELINE_CAPACITY_PX = TIMELINE['capacity']


def timeline_stop_height(photos: int, memo_text: Any, ai_caption: Any, place: Any) -> int:
    """구간 높이 = max(왼쪽 단, 오른쪽 단) + stopPadding. 메모와 AI 캡션은 함께 그리지 않는다(메모가 있으면 메모)."""
    r = TIMELINE['right'][f'photos-{photos}']
    if isinstance(memo_text, str) and memo_text.strip():
        right = r['memo']['base'] + r['memo']['perLine'] * table_lines(TL_MEMO, memo_text)
    elif isinstance(ai_caption, str) and ai_caption.strip():
        right = r['caption']['base'] + r['caption']['perLine'] * table_lines(TL_CAPTION, ai_caption)
    else:
        right = r['none']
    lf = TIMELINE['left']
    has_place = isinstance(place, str) and place.strip() != ''
    key = ('place' if has_place else 'noPlace') + ('Label' if photos else 'NoLabel')
    left = lf[key] + (lf['placeLine'] * (table_lines(TL_PLACE, place) - 1) if has_place else 0)
    return ceil_px(max(left, right) + TIMELINE['stopPadding'])


# --- 다정한 말들 인용 (README §12 "인용 대화 하나") -------------------------------

QUOTES = MEASURE['quotes']
QUOTE_CAPACITY = QUOTES['capacity']
Q_CONTEXT = line_table('quotes.contextLines')
Q_TURN = {'odd': line_table('quotes.turnLines.odd'), 'even': line_table('quotes.turnLines.even')}     # {'sub0', 'sub1-3', 'sub4-6'}


def quote_capacity(sub_count: int) -> int:
    """그 면의 단문 수에 따른 인용 가용 높이 - 0개 / 1~3개 / 4개 이상."""
    if sub_count <= 0:
        return QUOTE_CAPACITY['sub0']
    return QUOTE_CAPACITY['sub1-3'] if sub_count <= 3 else QUOTE_CAPACITY['sub4-6']


def conversation_height(context: Any, turn_texts: list) -> int:
    """대화 하나 = base + contextLine x 정황 줄 수 + 턴마다(perTurn + turnLine x (그 턴 줄 수 - 1)). 홀수 턴 446px · 짝수 턴 404px 표."""
    c = QUOTES['conversation']
    h = c['base'] + c['contextLine'] * table_lines(Q_CONTEXT, context if isinstance(context, str) else '')
    for i, text in enumerate(turn_texts):
        table = Q_TURN['odd' if i % 2 == 0 else 'even']
        h += c['perTurn'] + c['turnLine'] * (table_lines(table, text) - 1)
    return ceil_px(h)


# --- 기사 지면 (README §12 "글만 있는 기사" · "기사 사진 아래 메모 칸") ---------------

ARTICLE = MEASURE['article']
ARTICLE_STOPS_CAPACITY = ARTICLE['stopsCapacity']
ART_STOP_MEMO = line_table('article.stopMemoLines')
ART_PHOTO_MEMO = {n: line_table(f'article.photoCaption.{n}.memoLines') for n in ('1', '2', '3')}


def article_stop_height(memo_text: Any, ai_caption: Any, place: Any) -> float:
    """`hero-none` 구간 하나 - 오른쪽(메모 / AI 캡션, 위아래 여백 포함)과 왼쪽(시각 + 장소 줄, + 여백) 중 큰 쪽."""
    if isinstance(memo_text, str) and memo_text.strip():
        right = box(ARTICLE['stopMemo'], table_lines(ART_STOP_MEMO, memo_text))
    elif isinstance(ai_caption, str) and ai_caption.strip():
        right = box(ARTICLE['stopCaption'], table_lines(TL_CAPTION, ai_caption))
    else:
        right = 0.0
    has_place = isinstance(place, str) and place.strip() != ''
    left_lines = table_lines(TL_PLACE, place) if has_place else 0   # 왼쪽 단 폭 68px · 11.5px = 타임라인 장소 칸과 같은 활자
    left = box(ARTICLE['stopLeft'], left_lines) + ARTICLE['stopPadding']
    return max(left, right)


def photo_caption_fits(memo_text: Any, photos_on_page: int) -> bool:
    """기사 사진 아래 메모 칸 - 메모 상자(22.3 + 15.2 x 줄)가 칸이 쓸 수 있는 높이(room)에 들어가는가. 칸 폭은 그 면의 사진 수(1 · 2 · 3)가 정한다."""
    key = str(min(max(photos_on_page, 1), 3))
    spec = ARTICLE['photoCaption'][key]
    lines = table_lines(ART_PHOTO_MEMO[key], memo_text)
    return box(spec['memoBlock'], lines) <= spec['room']
