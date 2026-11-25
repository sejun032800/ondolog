"""쪽 수 규칙 - 본지 4의 배수 · 상한 36쪽 (기획서 3절 · 계약 README 공통 규칙 7, 위임 m20-a1 ⑦). 순수 함수 - 파일 · 네트워크 0.

본지 = 표지부터 뒤표지까지 모든 면(별지 - 연애리그 A2 - 제외). 지면 순서는 `compose.py`가 정하고, 이 파일은 **몇 면을 더하거나 빼는지**만 정한다.

모자랄 때(4의 배수까지 p면, p = 1 · 2 · 3)
  1. 사진 한 장(최대 2면, 쓸 사진이 있는 만큼) - 기획서 "사진 한 장 → 판권 여백" 순서
  2. 판권 여백 1면 - 판권 · 정오를 두 면(판권 / 정오)으로 나눈다. 빈 쪽이 아니라 정정 창구 안내가 실린 면이다
  3. 그래도 모자라면(사진이 모자람) **빈 쪽을 만들지 않고** 4의 배수가 아닌 채로 둔다 - `short`에 모자란 면 수를 남긴다
     (메인 세션 제안 · 근거: 빈 쪽 0 원칙이 4의 배수보다 앞선다. 4의 배수는 실물 호 대비이고 지금 발행물은 디지털 PDF다 -
     실물 호 트랙에서 다시 본다)
넘칠 때(36 초과)
  1. 사진 한 장부터 뺀다(여기서는 채움 용도로만 넣으므로 넘칠 때는 애초에 0면)
  2. 그다음 이달의 우리 기사 수를 줄이는 것이 기획서 순서지만, 지금 이달의 우리는 기사 수와 상관없이 2면 고정(tm-lead · tm-articles)이라
     기사를 줄여도 쪽 수가 줄지 않는다 -> `over`로 알리고 호출부(compose)가 렌더를 멈춘다(실패 - 조용히 넘기지 않음)
"""

from __future__ import annotations

import sys
from dataclasses import dataclass

sys.dont_write_bytecode = True

PAGE_MULTIPLE = 4      # 기획서 3절 - 실물 호(중철 · 무선 제본) 대비
BODY_PAGE_CAP = 36     # 기획서 3절 - 본지 상한(별지 제외)
PHOTO_BREAK_MAX = 2    # 기획서 3절 - 사진 한 장 최대 2면


@dataclass(frozen=True)
class PagePlan:
    base: int              # 채우기 전 면 수
    photo_breaks: int      # 넣을 사진 한 장 면 수
    colophon_split: bool   # 판권 여백(판권 · 정오를 두 면으로)
    total: int
    short: int             # 4의 배수까지 모자란 면(빈 쪽을 만들지 않아 남은 것)
    over: int              # 상한 36을 넘은 면


def plan_pages(base: int, photo_breaks_available: int) -> PagePlan:
    """`base` = 사진 한 장 · 판권 여백 없이 짠 면 수. `photo_breaks_available` = 쓸 수 있는 사진 한 장 후보 수."""
    if base < 1:
        raise ValueError('면 수는 1 이상')
    if base > BODY_PAGE_CAP:
        return PagePlan(base, 0, False, base, 0, base - BODY_PAGE_CAP)
    need = (-base) % PAGE_MULTIPLE
    photos = min(need, PHOTO_BREAK_MAX, max(0, photo_breaks_available))
    split = need - photos >= 1
    total = base + photos + (1 if split else 0)
    short = need - photos - (1 if split else 0)
    if total > BODY_PAGE_CAP:   # 4의 배수로 올리다 36을 넘는 일은 없다(36은 4의 배수) - 방어
        return PagePlan(base, 0, False, base, 0, total - BODY_PAGE_CAP)
    return PagePlan(base, photos, split, total, short, 0)
