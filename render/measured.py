"""88-b 렌더 되받기(ROADMAP r150 R150-3) - 그린 결과로 잰 항목 높이를 지면 나누기에 바꿔 끼우는 곳.

예측(`heights.py` - `measure.json` 표)은 어림이고, 마지막 판정은 실제로 그린 결과가 한다. 넘친 지면 안의 항목을 Chromium에서 재어
(`render_feedback.py`) **예측보다 크면** 그 높이로 다시 나눈다. 항목은 열쇠(`_fbKey`)로 가른다 - 같은 입력이면 같은 열쇠(결정론):

  tl:{n}        대표 기사 타임라인 구간(구간 순서)
  qt:{n}        다정한 말들 인용 대화(대화 순서)
  as:{기사}:{n}  글만 있는 기사(`hero-none`) 구간
  ph:{기사}:{n}  사진 아래 메모 칸 - 틀에서 자리가 정해진 칸이라 다음 면으로 넘길 수 없다. 넘치면 기존 길(D5 - 싣지 않고 발행 노트
                "메모 n개 — 사진 아래 칸에 들어가지 않아 줄이지 않고 뺐습니다", `facts.article_photo_view`)로 간다. 값 = `math.inf`(들어가지 않음)

바꿔 끼우는 값은 `active(...)` 안에서만 보인다(지면 짜기 한 번 동안). 밖에서는 늘 빈 값 - 되받기가 없으면 88-과 같은 결과다.
원문 · id는 담지 않는다(열쇠는 순서 번호 · 기사 날짜뿐).
"""

from __future__ import annotations

import math
import sys
from contextlib import contextmanager
from typing import Iterator, Mapping, Optional

sys.dont_write_bytecode = True

KINDS = {'tl': 'timeline', 'qt': 'quote', 'as': 'articleStop', 'ph': 'photoMemo'}
UNFIT = math.inf

_current: Mapping[str, float] = {}
_estimates: dict = {}


@contextmanager
def active(overrides: Optional[Mapping[str, float]]) -> Iterator[None]:
    """이 블록 동안 잰 높이를 쓴다(중첩 시 안쪽 값). 끝나면 되돌린다."""
    global _current, _estimates
    before, before_est = _current, _estimates
    _current = dict(overrides or {})
    _estimates = {}
    try:
        yield
    finally:
        _current, _estimates = before, before_est


def get(key: Optional[str]) -> Optional[float]:
    return _current.get(key) if key else None


def bump(key: Optional[str], predicted: int) -> int:
    """예측 높이와 잰 높이 중 큰 쪽(잰 높이가 없으면 예측 그대로). 작게 바꾸지 않는다 - 예측이 크면 예측을 믿는다."""
    m = get(key)
    out = predicted if (m is None or m == UNFIT) else max(predicted, int(math.ceil(m - 1e-9)))
    if key:
        _estimates[key] = out
    return out


def estimates() -> dict:
    """이 `active` 블록에서 항목마다 쓴 높이(되받기가 잰 높이와 맞대어 더 큰 것만 바꿔 끼운다)."""
    return dict(_estimates)


def unfit(key: Optional[str]) -> bool:
    """사진 아래 메모 칸이 그린 결과 들어가지 않았다."""
    return get(key) == UNFIT


def kind_of(key: str) -> str:
    return KINDS.get(key.split(':', 1)[0], 'other')


def article_key(article: Mapping) -> str:
    """기사 열쇠 - 기사 날짜(같은 호 안에서 기사마다 다르다 · id는 쓰지 않는다). 없으면 'x'."""
    d = article.get('dateOn') or 'x'
    return str(d)
