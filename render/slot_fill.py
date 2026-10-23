"""슬롯 채움 모듈 - 지면 HTML의 슬롯 표시를 데이터로 채운다 (위임: 55-1, 해석 순서는 ROADMAP R25-2).

지면 HTML의 구조는 고치지 않는다. 이 모듈이 하는 일은 여섯 표시를 처리하는 것뿐이다.

    data-variant  자식 중 `data-case`가 값과 같은 것만 남기고 나머지 변형은 지운다
    data-repeat   배열 항목마다 요소를 복제한다(항목이 그 복제본의 범위가 된다)
    data-if       값이 비어 있으면 요소를 지운다(`!경로`는 반대)
    data-optional 안의 슬롯 값이 전부 비면 요소째 지운다
    data-slot     요소의 글자를 값으로 채운다
    data-src      요소의 `src`를 값으로 채운다 (`data-src="."`는 반복 항목 자체가 경로)

해석 순서는 **variant -> repeat -> if -> optional**이다(R25-2). 한 요소 안에서도, 요소와 자손 사이에서도 이 순서다.
  - 지울 변형 안의 반복은 복제되지 않는다(variant가 먼저라 그 가지는 방문하지 않는다).
  - repeat가 먼저라 `if`는 복제본마다 그 항목을 범위로 판정한다.
  - `if`로 지운 가지의 빈 슬롯은 `optional` 판정에 세지 않는다(그 가지는 이미 트리에 없다).

경로 (원본 계약이 repo에 없어 55-1이 정한 최소 문법이다 - `render/issue/README.md`가 오면 대조한다, HANDOFF):
  - `.`            현재 범위 자신 (반복 항목)
  - `a.b.0.c`      현재 범위에서 키·배열 번호로 내려간다
  - `@이름.a.b`    루트에서 시작한다 (코너 밖 이름, 예 `@issue.name`)
비어 있는 값: None · 빈 문자열(공백뿐 포함) · 빈 배열 · 빈 객체. `0`·`False`는 값이 있다고 본다. `data-if`는 거기에 `False`를 거짓으로 더한다.
"""

from __future__ import annotations

import sys

sys.dont_write_bytecode = True

from typing import Any

from bs4 import BeautifulSoup, Tag

MARKS = ('data-variant', 'data-case', 'data-repeat', 'data-if', 'data-optional', 'data-slot', 'data-src')


def is_empty(value: Any) -> bool:
    """슬롯 값이 비었는가. `0`·`False`는 값이 있다."""
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ''
    if isinstance(value, (list, tuple, dict)):
        return len(value) == 0
    return False


def is_truthy(value: Any) -> bool:
    """`data-if` 판정 - 비어 있지 않고 `False`가 아니다."""
    return not is_empty(value) and value is not False


def resolve(path: str, scope: Any, root: Any) -> Any:
    """경로 -> 값. 없는 경로는 None(던지지 않는다 - 지면이 값을 요구해도 지어내지 않는다)."""
    path = path.strip()
    if path == '.':
        return scope
    if path.startswith('@'):
        current: Any = root
        segments = path[1:].split('.')
    else:
        current = scope
        segments = path.split('.')
    for segment in segments:
        if segment == '':
            return None
        if isinstance(current, dict):
            if segment not in current:
                return None
            current = current[segment]
        elif isinstance(current, (list, tuple)) and segment.isdigit():
            index = int(segment)
            if index >= len(current):
                return None
            current = current[index]
        else:
            return None
    return current


def _text(value: Any) -> str:
    if isinstance(value, bool):
        return 'true' if value else 'false'
    return str(value)


def _strip_marks(el: Tag) -> None:
    for mark in MARKS:
        if mark in el.attrs:
            del el.attrs[mark]


def _count_slots(el: Tag) -> int:
    n = 0
    for d in [el, *el.find_all(True)]:
        if d.has_attr('data-slot') or d.has_attr('data-src'):
            n += 1
    return n


Tally = tuple[int, int]  # (값이 찬 슬롯 수, 빈 슬롯 수)


class SlotFiller:
    def __init__(self, root: Any) -> None:
        self.root = root

    # -- 한 요소 ------------------------------------------------------------

    def handle(self, el: Tag, scope: Any) -> Tally:
        """variant -> repeat -> if -> optional 순서로 요소 하나를 처리한다."""
        # 1. variant: 이 요소 안의 변형 중 고르지 않은 것을 **자손을 방문하기 전에** 지운다.
        if el.has_attr('data-variant'):
            self._apply_variant(el, scope)

        # 2. repeat: 항목마다 복제한다. 복제본의 범위는 그 항목이다.
        if el.has_attr('data-repeat'):
            items = resolve(el['data-repeat'], scope, self.root)
            if not isinstance(items, (list, tuple)):
                items = []
            template_slots = _count_slots(el)
            filled = empty = 0
            anchor = el
            clones = []
            for item in items:
                clone = BeautifulSoup(str(el), 'html.parser').find(True)
                del clone.attrs['data-repeat']
                anchor.insert_after(clone)  # 먼저 전부 놓는다 - 처리 중 복제본이 지워져도 자리 기준이 남는다
                anchor = clone
                clones.append((clone, item))
            for clone, item in clones:
                f, e = self.body(clone, item)
                filled += f
                empty += e
            if not clones:
                # 항목이 없는 반복은 그 안의 슬롯이 전부 빈 것으로 센다(optional 판정용).
                empty += template_slots
            el.decompose()
            return filled, empty

        return self.body(el, scope)

    # -- repeat 이후: if -> 슬롯 -> 자손 -> optional --------------------------------

    def body(self, el: Tag, scope: Any) -> Tally:
        # 3. if
        if el.has_attr('data-if'):
            expr = el['data-if'].strip()
            negate = expr.startswith('!')
            value = resolve(expr[1:] if negate else expr, scope, self.root)
            keep = is_truthy(value)
            if negate:
                keep = not keep
            if not keep:
                el.decompose()
                return 0, 0  # 지운 가지의 슬롯은 어떤 optional 판정에도 세지 않는다

        filled = empty = 0

        # 슬롯: 요소 자신
        if el.has_attr('data-slot'):
            value = resolve(el['data-slot'], scope, self.root)
            if is_empty(value):
                el.clear()
                empty += 1
            else:
                el.string = _text(value)
                filled += 1
        if el.has_attr('data-src'):
            value = resolve(el['data-src'], scope, self.root)
            if is_empty(value):
                if el.has_attr('src'):
                    del el.attrs['src']
                empty += 1
            else:
                el['src'] = _text(value)
                filled += 1

        # 자손
        if not el.has_attr('data-slot'):
            for child in [c for c in el.children if isinstance(c, Tag)]:
                f, e = self.handle(child, scope)
                filled += f
                empty += e

        # 4. optional: 안의 슬롯 값이 전부 비면 요소째 지운다. 슬롯이 하나도 없으면 판정하지 않는다.
        if el.has_attr('data-optional') and empty > 0 and filled == 0:
            el.decompose()
            return 0, 0

        _strip_marks(el)
        return filled, empty

    def _apply_variant(self, el: Tag, scope: Any) -> None:
        value = resolve(el['data-variant'], scope, self.root)
        chosen = None if is_empty(value) else _text(value)
        for child in [c for c in el.children if isinstance(c, Tag) and c.has_attr('data-case')]:
            if chosen is None or child['data-case'].strip() != chosen:
                child.decompose()


def fill(html: str, data: Any) -> str:
    """HTML 문자열 + 데이터 -> 채워진 HTML 문자열. 지면 구조는 건드리지 않는다."""
    soup = BeautifulSoup(html, 'html.parser')
    filler = SlotFiller(data)
    for child in [c for c in soup.children if isinstance(c, Tag)]:
        filler.handle(child, data)
    return str(soup)
