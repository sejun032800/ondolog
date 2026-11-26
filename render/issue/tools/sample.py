import sys; sys.dont_write_bytecode = True  # tools/ 에 __pycache__ 를 남기지 않는다
"""견본 호 PDF — v2.0.0. 지면 틀의 견본 글자 그대로(resolve.js 미리보기 해석) 한 권을 엮는다.

순서는 기획서 3절 기본(표지 → … → 뒤표지 · 별지). 본지 24쪽(4의 배수) + 별지 2쪽.
**견본 전용**: 견본 글자 · 사진 · 쪽 번호는 실제 호와 무관하다. 협찬 지면에 "견본" 표시가 찍힌다(@sample.stamp).
사용:  python tools/sample.py [테마 ...]   → samples/sample_issue_{테마}.pdf  (기본 basic · night)
"""
import pathlib, io
from playwright.sync_api import sync_playwright
from pypdf import PdfWriter, PdfReader
R = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(R / 'tools'))
from preview import CFG, SRC  # noqa: E402
JS = (R / 'tools/resolve.js').read_text(encoding='utf-8')
OUT = R / 'samples'

ORDER = ['cover-photo', 'contents-long', 'note-grid', 'da-opener', 'da-timeline', 'da-places', 'da-article', 'sw-opener', 'sw-quotes',
         'tm-lead', 'tm-articles', 'setlog', 'interview', 'guest', 'dna-figure', 'dna-axes', 'rough-guess', 'over-shoulder',
         'sponsored', 'appendix-calendar', 'appendix-postcard', 'next', 'colophon', 'back', 'league-board', 'league-report']


def folio(i: int, name: str) -> str:
    if name.startswith('league-'):
        return '별지 ' + str(ORDER.index(name) - ORDER.index('league-board') + 1)
    return ' '.join(f'{i:02d}')


def main(themes) -> int:
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': 794, 'height': 1123})
        for th in themes:
            w = PdfWriter()
            for i, name in enumerate(ORDER, start=1):
                cfg = CFG[name]
                stem = cfg.get('page', name)
                c = {**cfg, 'src': {**SRC, **cfg.get('src', {})}, 'text': {**cfg.get('text', {}), '@page': folio(i, name)}}
                pg.goto((R / 'pages' / f'{stem}.html').as_uri(), wait_until='networkidle')
                pg.evaluate(f'document.documentElement.setAttribute("data-theme","{th}")')
                pg.add_script_tag(content=JS); pg.evaluate('c => window.__resolve(c)', c)
                pg.evaluate('document.fonts.ready.then(() => true)'); pg.wait_for_timeout(80)
                pdf = pg.pdf(format='A4', print_background=True, margin={'top': '0', 'bottom': '0', 'left': '0', 'right': '0'}, prefer_css_page_size=True)
                for pgobj in PdfReader(io.BytesIO(pdf)).pages[:1]:
                    w.add_page(pgobj)
            path = OUT / f'sample_issue_{th}.pdf'
            with open(path, 'wb') as f:
                w.write(f)
            print(path.name, len(ORDER), 'pages')
        b.close()
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:] or ['basic', 'night']))
