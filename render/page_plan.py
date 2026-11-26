"""쪽 수 규칙 - 본지 4의 배수 · 상한 36쪽 (기획서 3절 · 계약 README 공통 규칙 7, 위임 m20-a1 ⑦ · ROADMAP r158 R158-5). 순수 함수 - 파일 · 네트워크 0.

본지 = 표지부터 뒤표지까지 모든 면(별지 - 연애리그 A2 - 제외). 지면 순서는 `compose.py`가 정하고, 이 파일은 **몇 면을 더하거나 빼는지**만 정한다.

모자랄 때(4의 배수까지 p면, p = 1 · 2 · 3)
  1. 사진 한 장(최대 2면, 쓸 사진이 있는 만큼) - 기획서 "사진 한 장 → 판권 여백" 순서
  2. 판권 여백 1면 - 「판권과 정오」를 두 면(판권 / 정오)으로 나눈다. 빈 쪽이 아니라 정정 창구 안내가 실린 면이다
  3. 그래도 모자라면(사진이 모자람) **빈 쪽을 만들지 않고** 4의 배수가 아닌 채로 둔다 - `short`에 모자란 면 수를 남긴다
     (R158-3 수락 · 근거: 빈 쪽 0 원칙이 4의 배수보다 앞선다. 4의 배수는 실물 호 대비이고 지금 발행물은 디지털 PDF다)
넘칠 때(36 초과) - R158-5 순서표 `REDUCE_ORDER`(한 면씩, 앞 단계가 바닥에 닿아야 다음 단계)
  ① 사진 한 장 2 → 1 → 0면
  ② 판권과 정오 2 → 1면
  ③ 「다음 달」 빼기
  ④ 부록 엽서 면 빼기
  ⑤ 각자의 하루 2 → 1면 · ⑥ 우리 사이 2 → 1면 - 2.0-B에서(지금은 자리만 - 그 지면이 아직 없어 `parts`에 오지 않는다)
  ⑦ 그래도 넘으면 `over`로 알리고 호출부(compose)가 렌더를 멈춘다(실패 - 조용히 넘기지 않음)
  지금 짜임에서 ①②는 "모자랄 때 채우는 면"이라 36을 넘는 호에서는 이미 0면 · 1면이다 - 실제로 줄어드는 것은 ③④부터.
  기획서의 "이달의 우리 기사 줄이기"는 쪽 수가 줄지 않아 순서에서 지웠다(R158-5).
"""

from __future__ import annotations

import sys
from dataclasses import dataclass

sys.dont_write_bytecode = True

PAGE_MULTIPLE = 4      # 기획서 3절 - 실물 호(중철 · 무선 제본) 대비
BODY_PAGE_CAP = 36     # 기획서 3절 - 본지 상한(별지 제외)
PHOTO_BREAK_MAX = 2    # 기획서 3절 - 사진 한 장 최대 2면

# R158-5 줄이는 순서: (부분 이름, 줄일 수 있는 바닥 면 수). 앞에서부터 한 면씩 바닥까지 줄인 뒤 다음으로 간다.
REDUCE_ORDER: tuple = (
    ('photo_break', 0),   # ① 사진 한 장 2 → 1 → 0
    ('colophon', 1),      # ② 판권과 정오 2 → 1
    ('next_month', 0),    # ③ 「다음 달」 빼기
    ('postcards', 0),     # ④ 부록 엽서 면 빼기
    ('each_day', 1),      # ⑤ 각자의 하루 2 → 1 (2.0-B - 자리만)
    ('between_us', 1),    # ⑥ 우리 사이 2 → 1 (2.0-B - 자리만)
)


@dataclass(frozen=True)
class Reduction:
    parts: dict            # 줄인 뒤 부분별 면 수
    steps: tuple           # 한 면씩 줄인 차례(부분 이름)
    total: int
    over: int              # 다 줄여도 상한을 넘는 면(0이면 통과)


def reduce_to_cap(fixed: int, parts: dict, cap: int = BODY_PAGE_CAP) -> Reduction:
    """`fixed` = 줄일 수 없는 면 수 · `parts` = 줄일 수 있는 부분의 지금 면 수(`REDUCE_ORDER`에 없는 이름은 받지 않는다).

    합이 `cap`을 넘으면 `REDUCE_ORDER` 차례로 한 면씩 바닥까지 줄인다. 다 줄여도 넘으면 `over` > 0(호출부가 실패로 멈춘다).
    """
    known = {k for k, _ in REDUCE_ORDER}
    unknown = set(parts) - known
    if unknown:
        raise ValueError(f'줄이는 순서표에 없는 부분: {sorted(unknown)}')
    now = dict(parts)
    total = fixed + sum(now.values())
    steps: list = []
    for key, floor in REDUCE_ORDER:
        while total > cap and now.get(key, 0) > floor:
            now[key] -= 1
            total -= 1
            steps.append(key)
    return Reduction(now, tuple(steps), total, max(0, total - cap))


@dataclass(frozen=True)
class PagePlan:
    base: int              # 채우기 · 줄이기 전 면 수
    photo_breaks: int      # 넣을 사진 한 장 면 수
    colophon_split: bool   # 판권 여백(판권과 정오를 두 면으로)
    total: int
    short: int             # 4의 배수까지 모자란 면(빈 쪽을 만들지 않아 남은 것)
    over: int              # 다 줄여도 상한 36을 넘은 면
    drop_next_month: bool = False   # ③ 「다음 달」을 뺐다
    drop_postcards: bool = False    # ④ 부록 엽서 면을 뺐다
    reductions: tuple = ()          # 한 면씩 줄인 차례(R158-5 순서표 이름)


def plan_pages(base: int, photo_breaks_available: int, next_month_pages: int = 0, postcard_pages: int = 0,
               colophon_split_ok: bool = True) -> PagePlan:
    """`base` = 사진 한 장 · 판권 여백 없이 짠 면 수(「다음 달」 · 엽서 면 · 판권 1면 포함).
    `photo_breaks_available` = 쓸 수 있는 사진 한 장 후보 수. `next_month_pages` · `postcard_pages` = `base`에 든 그 면 수(뺄 수 있는 것).
    `colophon_split_ok` = 판권과 정오를 두 면으로 나눌 수 있는가 - 디자인 v2.0.0 틀은 한 면뿐이라 렌더러는 False(2.0-D · PM 확인 대상)."""
    if base < 1:
        raise ValueError('면 수는 1 이상')
    if not (0 <= next_month_pages and 0 <= postcard_pages and next_month_pages + postcard_pages + 1 <= base):
        raise ValueError('뺄 수 있는 면이 base보다 많다')
    if base > BODY_PAGE_CAP:
        # 넘칠 때: 사진 한 장 0면 · 판권 1면(채우는 면은 아직 없음)에서 R158-5 순서로 줄인다
        parts = {'photo_break': 0, 'colophon': 1, 'next_month': next_month_pages, 'postcards': postcard_pages}
        fixed = base - 1 - next_month_pages - postcard_pages
        red = reduce_to_cap(fixed, parts, BODY_PAGE_CAP)
        return PagePlan(base, red.parts['photo_break'], red.parts['colophon'] == 2, red.total, 0, red.over,
                        drop_next_month=next_month_pages > 0 and red.parts['next_month'] == 0,
                        drop_postcards=postcard_pages > 0 and red.parts['postcards'] == 0,
                        reductions=red.steps)
    need = (-base) % PAGE_MULTIPLE
    photos = min(need, PHOTO_BREAK_MAX, max(0, photo_breaks_available))
    split = colophon_split_ok and need - photos >= 1
    total = base + photos + (1 if split else 0)
    short = need - photos - (1 if split else 0)
    if total > BODY_PAGE_CAP:   # 4의 배수로 올리다 36을 넘는 일은 없다(36은 4의 배수) - 방어
        return PagePlan(base, 0, False, base, 0, total - BODY_PAGE_CAP)
    return PagePlan(base, photos, split, total, short, 0)
