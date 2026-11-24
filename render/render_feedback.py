"""88-b 렌더 되받기(ROADMAP r150 R150-3 · README v1.2.4 §12 "렌더러가 하는 일") - 예측은 어림, 마지막 판정은 실제로 그린 결과.

흐름(`render_with_feedback`):
  1. 지면을 짜고(`compose_fn`) 그린다(`draw` - 지면 검사 포함).
  2. 항목이 있는 지면(타임라인 · 인용 · 글만 있는 기사 · 사진 기사)의 항목을 Chromium에서 잰다(`measure_items`) - 항목이 차지한 자리
     (다음 항목 윗변 - 이 항목 윗변 · 마지막은 아랫변 + 아래 여백 = 항목 사이 간격까지).
  3. 넘친 지면 = (a) 원문 필드가 든 상자가 넘친 지면(`originalOverset` - 지금 렌더를 멈추는 판정, `render_issue.gate_failure`) 또는
     (b) 잰 자리의 합이 그 섹션의 가용 높이(지면 짜기가 쓰는 바로 그 값 - 타임라인 953 · 인용 940/841/778 · 글만 있는 기사 592.5)를 넘고
         예측보다 큰 항목이 있는 지면 또는 (c) 사진 아래 메모 칸이 판면 아래(1047)를 넘은 지면. 없으면 끝(되받기 0).
     (b)는 인용면처럼 높이가 정해진 상자가 아니라 지면 검사의 overset에 걸리지 않는 넘침도 잡는다(88-b에서 찾음 - 인용면 넘침은 overflow · overlap으로만 나왔다).
     예측보다 큰 항목만 그 높이로 바꿔 끼워(`measured.active`) 다시 짜고 다시 그린다 - 다음 면으로 넘어가고, 섹션의 면 상한 안에 자리가
     없으면 지금 규칙대로 싣지 않고 발행 노트 "싣지 않은 것"에 적힌다(compose · facts의 기존 길 그대로).
     사진 아래 메모 칸은 틀에서 자리가 정해져 옮길 수 없다 - 기존 길(D5 · `facts.article_photo_view`)로 싣지 않고 발행 노트에.
  4. **최대 2번** 다시 그린다. 그 뒤에도 넘치면 실패(이유 = 항목 종류 · 되받기 횟수 - 원문 · id 0). 바꿔 끼울 것이 없어도 실패(끝없이 돌지 않는다).
원문은 자르지 않는다(R29-3) - 글자를 바꾸는 코드가 이 파일에 없다. 같은 입력이면 같은 결과(잰 값은 같은 Chromium · 같은 지면에서 같다).
"""

from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path
from typing import Any, Callable, Optional

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import heights  # noqa: E402
import measured  # noqa: E402
from compose import ComposeError, Composition  # noqa: E402

MAX_ROUNDS = 2
VIEWPORT = {'width': 794, 'height': 1123}
SAFE_BOTTOM = 1123 - 76 + 0.5   # 판면 아래 끝(page_audit SAFE와 같다)

SEL = {
    'timeline': '[data-repeat="payload.articles[i].stops"] > *',
    'quote': '[data-repeat="payload.main"] > *',
    'articleStop': '[data-repeat="@da.articleStops"] > *',
    'photoMemo': '[data-repeat="@da.articlePhotos"] > *',
}
MEASURE_JS = r"""
([sel, mode]) => {
  const els = [...document.querySelectorAll(sel)];
  if (mode === 'caption') return els.map((el) => { const m = el.querySelector('.cap.memo'); return m ? m.getBoundingClientRect().bottom : null; });
  const rects = els.map((el) => el.getBoundingClientRect());
  // 항목이 차지한 자리 = 다음 항목 윗변까지(항목 사이 간격 포함) · 마지막은 아랫변 + 아래 여백
  return els.map((el, i) => i + 1 < els.length ? rects[i + 1].top - rects[i].top
                                             : rects[i].height + parseFloat(getComputedStyle(el).marginBottom || '0'));
}
"""


class FeedbackStop(Exception):
    """되받기로도 넘침을 풀지 못했다 - 이유는 항목 종류 · 횟수뿐."""


def _items(spec: Any) -> list[tuple[str, str, list]]:
    """지면 하나의 (종류, 측정 방식, 항목 열쇠 목록 - 지면에 그려진 순서). 열쇠는 지면 짜기가 보기 사본에 붙인 `_fbKey`."""
    out: list[tuple[str, str, list]] = []
    if spec.stem == 'da-timeline':
        fi = spec.bind.get('featured', 0)
        stops = spec.corner['payload']['articles'][fi]['stops']
        out.append(('timeline', 'height', [s.get('_fbKey') for s in stops]))
    elif spec.stem == 'sw-quotes':
        out.append(('quote', 'height', [m.get('_fbKey') for m in spec.corner['payload']['main']]))
    elif spec.stem == 'da-article':
        da = spec.computed.get('da', {})
        if da.get('articleStops'):
            out.append(('articleStop', 'height', [s.get('_fbKey') for s in da['articleStops']]))
        if da.get('articlePhotos'):
            out.append(('photoMemo', 'caption', [p.get('_fbKey') if p.get('caption') else None for p in da['articlePhotos']]))
    return out


def item_pages(comp: Composition) -> list[int]:
    """항목이 있는 지면 번호(1부터)."""
    return [n for n, spec in enumerate(comp.pages, 1) if _items(spec)]


def capacity(spec: Any, kind: str) -> float:
    """그 지면 섹션의 가용 높이 - 지면 짜기(`compose.split_timeline` · `pack_quotes` · `facts.article_stops_view`)가 쓰는 바로 그 값."""
    if kind == 'timeline':
        return heights.TIMELINE_CAPACITY_PX
    if kind == 'quote':
        return heights.quote_capacity(len(((spec.corner or {}).get('payload') or {}).get('sub') or []))
    return heights.ARTICLE_STOPS_CAPACITY


def measure_items(comp: Composition, files: list[Path], page_numbers: list[int]) -> list[tuple]:
    """지면(1부터 센 번호)의 항목을 잰다 -> [(지면 번호, 종류, [(열쇠, 값)])]. 높이 항목 값 = 차지한 자리(px), 사진 아래 메모 칸 = 칸 아랫변(px)."""
    from playwright.sync_api import sync_playwright

    out: list[tuple] = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_context(viewport=VIEWPORT).new_page()
            for n in page_numbers:
                groups = _items(comp.pages[n - 1])
                if not groups:
                    continue
                page.goto(files[n - 1].as_uri(), wait_until='networkidle')
                page.evaluate('document.fonts.ready.then(() => true)')
                for kind, mode, keys in groups:
                    values = page.evaluate(MEASURE_JS, [SEL[kind], mode])
                    out.append((n, kind, [(k, float(v)) for k, v in zip(keys, values) if k and v is not None]))
        finally:
            browser.close()
    return out


def overflowing(comp: Composition, groups: list[tuple], estimates: dict, overset_pages: set) -> tuple[set, dict]:
    """(넘친 지면 번호, 바꿔 끼울 값). 머리말 3 (a)(b)(c)."""
    pages: set = set(overset_pages)
    added: dict[str, float] = {}
    for n, kind, items in groups:
        if kind == 'photoMemo':
            unfit = [k for k, bottom in items if bottom > SAFE_BOTTOM]
            if unfit:
                pages.add(n)
                added.update({k: measured.UNFIT for k in unfit})
            continue
        bigger = {k: v for k, v in items if v > estimates.get(k, 0) + 0.5}
        over = sum(v for _k, v in items) > capacity(comp.pages[n - 1], kind) + 0.5
        if (over and bigger) or n in overset_pages:
            pages.add(n)
            added.update(bigger)
    return pages, added


def placements(comp: Composition) -> dict[str, tuple]:
    """항목 열쇠 -> 놓인 자리(섹션 · 그 섹션 안 몇째 면). 사진 아래 메모는 칸에 실렸을 때만."""
    out: dict[str, tuple] = {}
    seen: Counter = Counter()
    for spec in comp.pages:
        ordinal = spec.bind.get('i') if spec.stem == 'da-article' else seen[spec.stem]
        seen[spec.stem] += 1
        for _kind, _mode, keys in _items(spec):
            for key in keys:
                if key:
                    out[key] = (spec.stem, ordinal)
    return out


def summarize(first: dict[str, tuple], final: dict[str, tuple], rounds: int) -> dict[str, Any]:
    """렌더 요약의 숫자 - 되받기 횟수 · 옮긴 항목 수 · 되받기로 싣지 않게 된 항목 수(종류별). 원문 · id 0."""
    moved = Counter(measured.kind_of(k) for k, where in first.items() if k in final and final[k] != where)
    dropped = Counter(measured.kind_of(k) for k in first if k not in final)
    return {'rounds': rounds, 'moved': dict(sorted(moved.items())), 'dropped': dict(sorted(dropped.items()))}


def render_with_feedback(compose_fn: Callable[[], Composition], draw: Callable[[Composition], tuple],
                         measure: Callable[[Composition, list, list], list] = measure_items,
                         max_rounds: int = MAX_ROUNDS, say: Callable[[str], None] = lambda s: None) -> tuple:
    """(composition, files, results, audit, 요약). `draw(comp)` -> (files, results, audit).

    넘친 지면이 없으면 한 번 그리고 끝(되받기 0 - 되받기 전과 같은 결과). 넘침이 남으면 `FeedbackStop`."""
    overrides: dict[str, float] = {}
    first: Optional[dict[str, tuple]] = None
    rounds = 0
    added: dict[str, float] = {}
    while True:
        with measured.active(overrides):
            try:
                comp = compose_fn()
            except ComposeError:
                if rounds == 0:
                    raise
                kinds = sorted({measured.kind_of(k) for k in added})
                raise FeedbackStop(f"되받기 {rounds}번 뒤 {', '.join(kinds)} 항목 하나가 한 면보다 크다 - 지금 규칙대로 렌더 실패(원문을 자르지 않는다)") from None
            estimates = measured.estimates()
        place = placements(comp)
        if first is None:
            first = place
        files, results, audit = draw(comp)
        if audit['originalClipped']:
            return comp, files, results, audit, summarize(first, place, rounds)   # 잘림은 되받기로 풀 수 없다 - 지금처럼 gate가 멈춘다
        overset_pages = {o['n'] for o in audit['originalOverset']}
        pages, found = overflowing(comp, measure(comp, files, item_pages(comp)), estimates, overset_pages)
        if not pages:
            return comp, files, results, audit, summarize(first, place, rounds)
        stems = sorted({comp.pages[n - 1].stem for n in pages})
        if rounds >= max_rounds:
            raise FeedbackStop(f"되받기 {rounds}번 뒤에도 넘친다 (지면 {', '.join(stems)})")
        added = {k: v for k, v in sorted(found.items()) if overrides.get(k) != v}
        if not added:
            raise FeedbackStop(f"넘친 지면에서 예측보다 큰 항목을 찾지 못했다 - 되받기 {rounds}번 (지면 {', '.join(stems)})")
        overrides.update(added)
        rounds += 1
        say(f"렌더 되받기 {rounds}번째: 예측보다 컸던 항목 {len(added)}개 - " +
            ', '.join(f'{k} {v}' for k, v in sorted(Counter(measured.kind_of(x) for x in added).items())))
