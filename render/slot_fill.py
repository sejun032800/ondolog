"""슬롯 채움 모듈 - 지면 HTML의 슬롯 표시를 데이터로 채운다 (위임: 55-1, 55-2. 문법의 원본은 `render/issue/README.md` v1.1.1 §2·§3).

지면 HTML의 구조는 고치지 않는다. 이 모듈이 하는 일은 여섯 표시를 처리하는 것뿐이다.

    data-variant  같은 부모 아래 형제 중 이름이 고른 값과 같은 것 하나만 남긴다(고르는 기준은 README §3 - 호출부가 정한다)
    data-repeat   **컨테이너**에 붙는다. 첫 자식이 항목 틀이다 - 항목마다 복제하고, 나머지 견본 자식은 지운다
    data-if       값이 참일 때만 남긴다(`!경로`는 반대)
    data-optional 안의 슬롯 값(`data-slot`·`data-src` 모두)이 전부 비면 요소째 지운다
    data-slot     요소의 글자를 값으로 바꾼다(줄바꿈은 `<br>`)
    data-src      `<img>`의 `src`를 사진 경로로 바꾼다 (`data-src="."`는 반복 항목 자체가 경로)

해석 순서는 **variant -> repeat -> if -> optional**이다(README §2, R25-2). 한 요소 안에서도, 요소와 자손 사이에서도 이 순서다.
  - 지울 변형 안의 반복은 복제되지 않는다(variant를 부모가 자손보다 먼저 고르므로 그 가지는 방문하지 않는다).
  - `if`로 지운 가지의 빈 슬롯은 `optional` 판정에 세지 않는다(그 가지는 이미 트리에 없다).

경로 (README §2·§9)
  - `.`              현재 범위(반복 항목) 자신
  - `.a.b[0].c`      `.`으로 시작하면 현재 범위(반복 항목)에서 내려간다
  - `@이름.a.b`      `@`로 시작하면 렌더러가 계산해 넣는 코너 밖 값(`computed`)이다
  - `payload.x[i]`   그 밖은 **코너 봉투**(`header.*`·`payload.*`) 기준이다 - 반복 안에서도 봉투에서 시작한다
  - `[숫자]` 배열 번호, `[featured]`·`[i]`는 호출부가 묶어 준 번호(`bind`), `.length`는 배열 길이(`payload.articles.length`)

표시는 지우지 않는다 - 지면 CSS가 `[data-repeat=".turns"]`·`[data-variant="grid-2"]`로 속성을 읽는다(`base.css`·`tm-articles.html`).

비어 있는 값: None · 빈 문자열(공백뿐 포함) · 빈 배열 · 빈 객체. `0`·`False`는 값이 있다고 본다. `data-if`는 거기에 `False`를 거짓으로 더한다.
"""

from __future__ import annotations

import re
import sys

sys.dont_write_bytecode = True

from typing import Any, Callable, Optional

from bs4 import BeautifulSoup, NavigableString, Tag

# 변형 고르기: (같은 부모 아래 변형 이름들, 그 부모의 범위) -> 고른 이름. 못 고르면 None(모두 지운다).
VariantChooser = Callable[[frozenset, Any], Optional[str]]


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


class Context:
    """경로 해석에 필요한 세 뿌리: 코너 봉투 · 코너 밖 값 · 번호 묶음."""

    def __init__(self, corner: Any = None, computed: Any = None, bind: Optional[dict] = None) -> None:
        self.corner = corner
        self.computed = computed if computed is not None else {}
        self.bind = bind or {}


_SEGMENT = re.compile(r'^([^\[\]]*)((?:\[[^\[\]]+\])*)$')
_BRACKET = re.compile(r'\[([^\[\]]+)\]')


def _step(current: Any, key: str, ctx: Context) -> Any:
    """한 걸음. 못 가면 None(던지지 않는다 - 지면이 값을 요구해도 지어내지 않는다)."""
    if isinstance(current, dict):
        return current.get(key)
    if isinstance(current, (list, tuple)):
        if key == 'length':
            return len(current)
        if key.isdigit():
            index = int(key)
            return current[index] if index < len(current) else None
        if key in ctx.bind:
            index = ctx.bind[key]
            return current[index] if isinstance(index, int) and 0 <= index < len(current) else None
        return None
    return None


def resolve(path: str, scope: Any, ctx: Context) -> Any:
    """경로 -> 값. 없는 경로는 None."""
    path = path.strip()
    if path == '.':
        return scope
    if path.startswith('@'):
        current: Any = ctx.computed
        rest = path[1:]
    elif path.startswith('.'):
        current = scope
        rest = path[1:]
    else:
        current = ctx.corner
        rest = path
    for part in rest.split('.'):
        m = _SEGMENT.match(part)
        if m is None or (m.group(1) == '' and m.group(2) == ''):
            return None
        name, brackets = m.group(1), m.group(2)
        if name != '':
            current = _step(current, name, ctx)
            if current is None:
                return None
        for key in _BRACKET.findall(brackets):
            current = _step(current, key.strip(), ctx)
            if current is None:
                return None
    return current


def _text(value: Any) -> str:
    if isinstance(value, bool):
        return 'true' if value else 'false'
    return str(value)


_BR_SOUP = BeautifulSoup('', 'html.parser')


def _set_text(el: Tag, value: Any) -> None:
    """요소의 글자를 값으로 바꾼다. 줄바꿈은 `<br>` - 원문의 줄을 그대로 둔다."""
    el.clear()
    lines = _text(value).replace('\r\n', '\n').replace('\r', '\n').split('\n')
    for i, line in enumerate(lines):
        if i > 0:
            el.append(_BR_SOUP.new_tag('br'))
        el.append(NavigableString(line))


def _count_slots(el: Tag) -> int:
    n = 0
    for d in [el, *el.find_all(True)]:
        if d.has_attr('data-slot') or d.has_attr('data-src'):
            n += 1
    return n


def _clone(el: Tag) -> Tag:
    return BeautifulSoup(str(el), 'html.parser').find(True)


Tally = tuple  # (값이 찬 슬롯 수, 빈 슬롯 수)


class SlotFiller:
    def __init__(self, ctx: Context, chooser: Optional[VariantChooser] = None) -> None:
        self.ctx = ctx
        self.chooser = chooser

    # -- 한 요소 ------------------------------------------------------------

    def handle(self, el: Tag, scope: Any) -> Tally:
        """요소 하나: (부모가 이미 variant를 골랐다) -> repeat -> if -> 슬롯·자손 -> optional."""
        filled = empty = 0

        # 2. repeat: 컨테이너. 첫 자식이 틀이다.
        if el.has_attr('data-repeat'):
            filled, empty = self._expand_repeat(el, scope)
            return self._finish(el, scope, filled, empty, children_done=True)

        return self._finish(el, scope, 0, 0, children_done=False)

    def _finish(self, el: Tag, scope: Any, filled: int, empty: int, children_done: bool) -> Tally:
        # 3. if
        if el.has_attr('data-if'):
            expr = el['data-if'].strip()
            negate = expr.startswith('!')
            value = resolve(expr[1:] if negate else expr, scope, self.ctx)
            keep = is_truthy(value)
            if negate:
                keep = not keep
            if not keep:
                el.decompose()
                return 0, 0  # 지운 가지의 슬롯은 어떤 optional 판정에도 세지 않는다

        # 슬롯: 요소 자신
        if el.has_attr('data-slot'):
            value = resolve(el['data-slot'], scope, self.ctx)
            if is_empty(value):
                el.clear()
                empty += 1
            else:
                _set_text(el, value)
                filled += 1
        if el.has_attr('data-src'):
            value = resolve(el['data-src'], scope, self.ctx)
            if is_empty(value):
                if el.has_attr('src'):
                    del el.attrs['src']
                empty += 1
            else:
                el['src'] = _text(value)
                filled += 1

        # 자손 (repeat 컨테이너의 자식은 이미 처리됐다)
        if not children_done and not el.has_attr('data-slot'):
            self._apply_variants(el, scope)
            for child in [c for c in el.children if isinstance(c, Tag)]:
                f, e = self.handle(child, scope)
                filled += f
                empty += e

        # 4. optional: 안의 슬롯 값이 전부 비면 요소째 지운다. 슬롯이 하나도 없으면 판정하지 않는다.
        if el.has_attr('data-optional') and empty > 0 and filled == 0:
            el.decompose()
            return 0, 0
        return filled, empty

    # -- repeat -------------------------------------------------------------------

    def _expand_repeat(self, el: Tag, scope: Any) -> Tally:
        items = resolve(el['data-repeat'], scope, self.ctx)
        if not isinstance(items, (list, tuple)):
            items = []
        children = [c for c in el.children if isinstance(c, Tag)]
        if not children:
            return 0, 0
        template = _clone(children[0])
        for c in children:  # 첫 자식이 틀이다 - 틀과 나머지 견본을 치우고 항목마다 새로 놓는다
            c.decompose()
        template_slots = _count_slots(template)

        filled = empty = 0
        for item in items:
            clone = _clone(template)
            el.append(clone)
            if template_slots == 0 and not isinstance(item, (dict, list, tuple)):
                # 값이 글자 하나인 배열(`@note.notUsed` 등) - 틀 요소의 글자가 곧 항목이다(README §2).
                if is_empty(item):
                    clone.decompose()
                    continue
                _set_text(clone, item)
                filled += 1
                continue
            f, e = self.handle(clone, item)
            filled += f
            empty += e
        if not items:
            empty += template_slots  # 항목이 없는 반복은 그 안의 슬롯이 전부 빈 것으로 센다(optional 판정용)
        return filled, empty

    # -- variant ------------------------------------------------------------------

    def _apply_variants(self, parent: Tag, scope: Any) -> None:
        """같은 부모 아래 `data-variant` 형제 하나만 남긴다. 부모가 자손보다 먼저 한다."""
        group = [c for c in parent.children if isinstance(c, Tag) and c.has_attr('data-variant')]
        if not group:
            return
        names = frozenset(c['data-variant'].strip() for c in group)
        chosen = self.chooser(names, scope) if self.chooser is not None else None
        for c in group:
            if chosen is None or c['data-variant'].strip() != chosen:
                c.decompose()


def fill(html: str, corner: Any = None, computed: Optional[dict] = None, bind: Optional[dict] = None,
         chooser: Optional[VariantChooser] = None) -> str:
    """HTML 문자열 + 데이터 -> 채워진 HTML 문자열. 지면 구조는 건드리지 않는다.

    corner    코너 봉투(`header`·`payload`). 접두 없는 경로의 뿌리
    computed  코너 밖 값(`@이름`)
    bind      `[i]`·`[featured]` 같은 이름 있는 배열 번호
    chooser   변형을 고르는 함수 - 기준은 README §3(호출부가 안다)
    """
    soup = BeautifulSoup(html, 'html.parser')
    filler = SlotFiller(Context(corner, computed, bind), chooser)
    for child in [c for c in soup.children if isinstance(c, Tag)]:
        filler.handle(child, corner)
    return str(soup)
