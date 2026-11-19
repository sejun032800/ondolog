"""`data-width` 대조 - 같은 입력을 개발 쪽 해석(`slot_fill`)과 디자인의 `render/issue/tools/resolve.js`에 넣어 결과를 나란히 낸다 (위임: 55-3 범위 1).

지면은 발행 노트(`note.html`)의 출처 막대 두 칸(`data-width="@note.ratioPeople"` · `"@note.ratioOndolog"`)을 쓴다.
디자인 쪽은 Chromium에서 `resolve.js`의 `__resolve`를 그대로 돌린 결과(요소가 남았는가 · 인라인 `width`), 개발 쪽은 `slot_fill.fill` 결과다.

사용 (저장소 루트에서):
    render/.venv/Scripts/python.exe render/width_compare.py [출력 파일]
"""

from __future__ import annotations

import sys

sys.dont_write_bytecode = True

import json
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from bs4 import BeautifulSoup  # noqa: E402

from slot_fill import fill  # noqa: E402

NOTE_HTML = HERE / 'issue' / 'pages' / 'note.html'
RESOLVE_JS = HERE / 'issue' / 'tools' / 'resolve.js'
PEOPLE, ONDOLOG = '@note.ratioPeople', '@note.ratioOndolog'

# (이름, 사람 쪽 입력, 온도록 쪽 입력) - 지시서의 여섯 경우. None = 값 없음.
SIX_CASES: list = [
    ('정상', 34, 66),
    ('한쪽 null', 34, None),
    ('둘 다 없음', None, None),
    ('120(범위 밖)', 120, 66),
    ('-5(범위 밖)', -5, 66),
    ('문자열', 'abc', 66),
]
# 여섯 경우에 이어서: 숫자 글자는 둘 다 받고, `34%` 문자열은 둘 다 요소를 지운다(R48-6 - 이전에는 개발 쪽만 받았다).
EXTRA_CASES: list = [
    ('숫자 글자 "34"', '34', 66),
    ('"34%" 문자열', '34%', 66),
    ('경계 0과 100', 0, 100),
]


def mine(people: Any, ondolog: Any) -> dict:
    # 디자인 쪽 `cfg.width`와 같이 폭 값을 따로 건넨다(글자 값은 `computed`)
    html = fill(NOTE_HTML.read_text(encoding='utf-8'), None, {'note': {'ratioPeople': people, 'ratioOndolog': ondolog}},
                widths={PEOPLE: people, ONDOLOG: ondolog})
    soup = BeautifulSoup(html, 'html.parser')
    out = {}
    for key, path in (('people', PEOPLE), ('ondolog', ONDOLOG)):
        el = soup.find(attrs={'data-width': path})
        out[key] = None if el is None else next((d.split(':', 1)[1] for d in el.get('style', '').split(';') if d.strip().startswith('width:')), '')
    return out


def design(cases: list) -> list:
    """같은 입력을 `resolve.js`에 넣는다. 사례마다 새로 연다(한 번 돌린 문서는 다시 돌릴 수 없다)."""
    from playwright.sync_api import sync_playwright

    js = RESOLVE_JS.read_text(encoding='utf-8')
    rows = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page(viewport={'width': 794, 'height': 1123})
            for _, people, ondolog in cases:
                page.goto(NOTE_HTML.as_uri(), wait_until='load')
                page.add_script_tag(content=js)
                cfg = {'width': {PEOPLE: people, ONDOLOG: ondolog}, 'text': {}}
                rows.append(page.evaluate(
                    """(cfg) => {
                      window.__resolve(cfg);
                      const read = path => {
                        const el = document.querySelector('[data-width="' + path + '"]');
                        return el === null ? null : el.style.width;
                      };
                      return {people: read(%s), ondolog: read(%s)};
                    }""" % (json.dumps(PEOPLE), json.dumps(ONDOLOG)), cfg))
        finally:
            browser.close()
    return rows


def compare(cases: list) -> list:
    """사례별 (이름, 입력, 개발, 디자인, 같은가). 결과 값: 폭(`34%`) 또는 None(요소 삭제)."""
    theirs = design(cases)
    rows = []
    for (name, people, ondolog), d in zip(cases, theirs):
        m = mine(people, ondolog)
        rows.append({'case': name, 'input': {'people': people, 'ondolog': ondolog}, 'dev': m, 'design': d, 'same': m == d})
    return rows


def render_table(rows: list) -> str:
    def cell(v: Any) -> str:
        return '(요소 삭제)' if v is None else v

    lines = ['경우 | 입력(사람 / 온도록) | 개발(사람 / 온도록) | resolve.js(사람 / 온도록) | 같음']
    for r in rows:
        i, m, d = r['input'], r['dev'], r['design']
        lines.append(f"{r['case']} | {json.dumps(i['people'], ensure_ascii=False)} / {json.dumps(i['ondolog'], ensure_ascii=False)}"
                     f" | {cell(m['people'])} / {cell(m['ondolog'])} | {cell(d['people'])} / {cell(d['ondolog'])} | {'같음' if r['same'] else '다름'}")
    return '\n'.join(lines)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    text = '여섯 경우\n' + render_table(compare(SIX_CASES)) + '\n\n여섯 경우 밖의 확인\n' + render_table(compare(EXTRA_CASES)) + '\n'
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(text, encoding='utf-8')
    print(text)
