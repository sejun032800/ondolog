"""로컬 시험 호 렌더 - 원격 없이 고정 입력(fixture)으로 v1.2.2 지면을 렌더해 PDF와 검사 결과를 남긴다 (위임: 55-3 범위 2·5·8).

네트워크·DB·service_role 키를 쓰지 않는다. 사진은 합성 이미지(`tests/fixtures.py`)다. 출력은 `render/out/55-3-local/<권>/`(git 무시 경로 - 커밋하지 않는다).

권
  vol1-photos           ① 사진 많은 달 · basic · 타임라인 2면 분할 · 출처 막대 두 칸 · 이달의 우리 한 단
  vol2-opener-fallback  ② 대표 기사 첫 stop에 사진이 없다 -> 다음 stop 사진으로 폴백 · night
  vol2b-opener-typeonly ② 대표 기사 전체에 사진이 없다 -> type-only · hip
  vol3-long-original    ③ 160자 4턴 대화 둘(인용 2면) + 긴 메모 · ondol
  vol3-fail             ③ 위 호에 한 면을 넘는 대화 하나를 더한 것 - **렌더가 실패해야 한다**(사유를 남긴다)

각 권: issue.pdf · page-NN.jpg · audit.json(개발 검사 + 디자인 `tools/audit.py` 검사 나란히) · compose.json · report.txt(요약 · safe 분류표 · 사실 확인)

사용 (저장소 루트에서):
    render/.venv/Scripts/python.exe render/local_volumes.py [출력 폴더]
"""

from __future__ import annotations

import sys

sys.dont_write_bytecode = True

import copy
import json
import re
import tempfile
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / 'tests'))

from bs4 import BeautifulSoup  # noqa: E402

import fixtures as fx  # noqa: E402
import render_issue as r  # noqa: E402
from compose import ComposeError, compose_issue  # noqa: E402

OUT_DEFAULT = HERE / 'out' / '55-3-local'
NAMES = [fx.A, fx.B]
VOLUMES = [
    ('vol1-photos', lambda: fx.many_photos_scenario('basic')),
    ('vol2-opener-fallback', lambda: fx.opener_fallback_scenario('night')),
    ('vol2b-opener-typeonly', lambda: fx.opener_type_only_scenario('hip')),
    ('vol3-long-original', lambda: fx.long_original_scenario('ondol')),
]
FAIL_VOLUME = ('vol3-fail', lambda: fx.long_original_scenario('ondol', with_overlong=True))
MATERIALS = {'messages': 120, 'photos': 20, 'dates': 3, 'memos': 4}

# safe 분류 - 판면(좌우 68 · 위 60 · 아래 76px) 밖에 글자가 놓인 자리를 원인별로 가른다
SAFE_BOX = {'left': 68, 'right': 726, 'top': 60, 'bottom': 1047}


def classify_safe(finding: dict) -> str:
    left, top, right, bottom = finding['box']
    if bottom > SAFE_BOX['bottom'] and top >= 1030:
        return 'bottom-margin'   # 지면 HTML이 하단 여백 안쪽(`bottom:62px` 등)에 박은 한 줄 - 판면 하단 76px 경계를 넘는다
    if top < SAFE_BOX['top']:
        return 'top'
    if left < SAFE_BOX['left'] or right > SAFE_BOX['right']:
        return 'side'
    return 'other'


SAFE_NOTES = {
    'bottom-margin': '하단 한 줄이 지면 HTML의 bottom:62px 등에 있어 판면 하단(1047px)을 넘는다 - 지면 HTML 값이라 디자인 확인 필요',
    'top': '판면 위 60px 밖',
    'side': '판면 좌우 68px 밖',
    'other': '판면 안인데 글자 줄이 경계를 넘음',
}


def facts_check(comp: Any, html_by_page: list) -> list:
    """지면에 찍힌 표시가 데이터와 같은지 확인한다(3-7 '사실과 다른 표시' 점검 중 기계가 할 수 있는 부분). 어긋남 목록을 돌려준다."""
    bad: list = []
    texts = [BeautifulSoup(h, 'html.parser') for h in html_by_page]
    for n, (spec, soup) in enumerate(zip(comp.pages, texts), 1):
        body = soup.get_text(' ', strip=True)
        if re.search(r'\bVol\b|Vol\.|발행일', body):
            bad.append(f'{n}쪽 {spec.stem}: Vol 또는 발행일이 찍혔다')
        folio = soup.find(class_='folio')
        if folio is not None:
            want = f'{n - 1:02d}'
            if folio.get_text(strip=True) != want:
                bad.append(f'{n}쪽 {spec.stem}: 폴리오 {folio.get_text(strip=True)} (기대 {want})')
        elif spec.stem not in ('cover-photo', 'cover-type', 'back'):
            bad.append(f'{n}쪽 {spec.stem}: 폴리오가 없다')
        if spec.stem in ('cover-photo', 'cover-type', 'back') and folio is not None:
            bad.append(f'{n}쪽 {spec.stem}: 표지/뒤표지에 폴리오가 찍혔다')
    # 목차 쪽 번호 = 그 코너 첫 지면의 폴리오
    contents = texts[1]
    first_of: dict = {}
    for n, spec in enumerate(comp.pages, 1):
        if spec.corner_type and spec.corner_type not in first_of:
            first_of[spec.corner_type] = n - 1
    toc_pages = [int(x.get_text(strip=True)) for x in contents.select('[data-slot=".page"]')]
    if toc_pages != list(first_of.values()):
        bad.append(f'목차 쪽 번호 {toc_pages} != 코너 첫 지면 {list(first_of.values())}')
    # 출처 막대 = 발행 노트의 비율
    note_i = next(i for i, p in enumerate(comp.pages) if p.stem == 'note')
    note_soup = texts[note_i]
    people = note_soup.find(attrs={'data-width': '@note.ratioPeople'})
    ondolog = note_soup.find(attrs={'data-width': '@note.ratioOndolog'})
    note = comp.pages[note_i].computed['note']
    if people is None or ondolog is None:
        bad.append('발행 노트: 출처 막대가 없다')
    else:
        for el, key in ((people, 'ratioPeople'), (ondolog, 'ratioOndolog')):
            want = note[key].rstrip('%')
            if f'width:{want}%' not in el.get('style', ''):
                bad.append(f'발행 노트: {key} 막대 폭이 {note[key]}와 다르다 ({el.get("style")})')
    # 기사 순번 / 사진 장수 / 오프너 변형이 데이터와 같다
    da = next((p for p in comp.pages if p.stem == 'da-opener'), None)
    if da is not None:
        i = comp.pages.index(da)
        want_variant = 'with-photo' if da.computed['da']['openerPhoto'] else 'type-only'
        got = [el['data-variant'] for el in texts[i].find_all(attrs={'data-variant': True})]
        if got != [want_variant]:
            bad.append(f'데이트 아카이브 오프너: 변형 {got} (기대 {want_variant})')
        articles = da.corner['payload']['articles']
        fi = next(k for k, a in enumerate(articles) if a.get('featured') is True)
        ordinal = ['One', 'Two', 'Three', 'Four', 'Five'][fi]
        if f'Article {ordinal}' not in texts[i].get_text(' ', strip=True):
            bad.append(f'오프너 Article {ordinal}가 없다')
    return bad


def render_volume(name: str, scenario: dict, out_root: Path, say) -> dict[str, Any]:
    out = out_root / name
    out.mkdir(parents=True, exist_ok=True)
    couple = {**fx.COUPLE_ROW, 'magazine_theme': scenario['theme']}
    comp = compose_issue(fx.ISSUE_ROW, couple, NAMES, scenario['corners'], MATERIALS)
    templates = r.load_templates()
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp) / 'work'
        r.prepare_work(work)
        cover = r.settle_cover(comp, templates, work, say)
        files = r.build_pages(comp, templates, work, fx.ISSUE_ROW, lambda dest: fx.png(1200, 1600, hue=sum(map(ord, dest)) % 80))
        html_by_page = [f.read_text(encoding='utf-8') for f in files]
        results = r.render_pages(files)
    pdf, counts = r.merge_pdf([x['pdf'] for x in results])
    if counts != [1] * len(counts):
        raise r.StopError(f'한 지면이 PDF 한 쪽이 아니다 {counts}')
    (out / 'issue.pdf').write_bytes(pdf)
    for i, x in enumerate(results, 1):
        (out / f'page-{i:02d}.jpg').write_bytes(x['image'])
    audit = r.audit_summary(comp, results, name)
    (out / 'audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (out / 'compose.json').write_text(json.dumps({'report': comp.report, 'sentences': comp.sentences, 'shownPhotos': comp.shown_photos},
                                                 ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    facts = facts_check(comp, html_by_page)

    safe_rows = []
    for page in audit['pages']:
        for f in page['findings']:
            if f['k'] == 'safe':
                kind = classify_safe(f)
                safe_rows.append({'n': page['n'], 'stem': page['stem'], 'text': f['t'], 'box': f['box'], 'kind': kind})
    lines = [f'== {name} (테마 {comp.theme}) ==',
             f'PDF: {out / "issue.pdf"}  ({len(results)}쪽, {len(pdf)} bytes)',
             f'지면 순서: ' + ' '.join(f"{i}:{p.stem}" for i, p in enumerate(comp.pages, 1)),
             f"표지: {comp.report['cover']}  표제 출처: {comp.report['coverHeadlineFrom']}  이 달의 말 줄 삭제: {cover['quoteRemoved']}",
             f"타임라인 {comp.report['timelinePages']}면 · 인용 {comp.report['quotePages']}면 · 못 실은 구간 {comp.report['timelineDroppedStops']}",
             '', '쪽 | 지면 | 개발 검사(종류별 수) | 5항목: 개발 N / 디자인 audit.py N | 같음']
    for page in audit['pages']:
        kinds: dict = {}
        for f in page['findings']:
            kinds[f['k']] = kinds.get(f['k'], 0) + 1
        d = page['designAudit']
        lines.append(f"{page['n']} | {page['stem']} | {json.dumps(kinds, ensure_ascii=False) if kinds else '-'} | "
                     f"{d.get('mine', '-')} / {d.get('design', '-')} | {'같음' if d.get('same', True) else '다름 ' + json.dumps(d, ensure_ascii=False)}")
    lines += ['', f"합계(개발): {json.dumps(audit['totals'], ensure_ascii=False)}  디자인 5항목 일치: {audit['designAuditSame']}",
              f"원문 clipped(실패): {len(audit['originalClipped'])}  온도록 문장 clipped(기록): {len(audit['recordedClipped'])}"]
    for c in audit['recordedClipped']:
        lines.append(f"  기록: {c['n']}쪽 {c['stem']} 슬롯 {c.get('slot')} 「{c.get('t')}」")
    lines += ['', 'safe 분류표 (판정 대상은 글자 줄 상자다. 풀블리드 사진(.ph)과 상단 바 같은 글자 없는 장식은 글자가 없어 판정에 들지 않고, 러닝헤드(.run)·폴리오(.folio)·사진 위 글자(.ph)는 판면 밖이 정위치라 뺀다)']
    for kind in sorted({s['kind'] for s in safe_rows}):
        lines.append(f'  [{kind}] {SAFE_NOTES[kind]}')
    if not safe_rows:
        lines.append('  (safe 위반 없음)')
    for s in safe_rows:
        lines.append(f"  {s['n']}쪽 {s['stem']} | {s['kind']} | 「{s['text']}」 {s['box']}")
    lines += ['', f'사실 확인(기계 점검) 어긋남 {len(facts)}건'] + [f'  {x}' for x in facts]
    (out / 'report.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    say('\n'.join(lines))
    return {'name': name, 'pages': len(results), 'totals': audit['totals'], 'originalClipped': len(audit['originalClipped']),
            'designSame': audit['designAuditSame'], 'safe': safe_rows, 'facts': facts, 'pdf': str(out / 'issue.pdf')}


def main(argv: list) -> int:
    sys.stdout.reconfigure(encoding='utf-8')
    out_root = Path(argv[0]).resolve() if argv else OUT_DEFAULT
    out_root.mkdir(parents=True, exist_ok=True)
    summary = []
    for name, build in VOLUMES:
        summary.append(render_volume(name, build(), out_root, print))
    # ③ 실패 권 - 한 면을 넘는 대화 하나로 렌더가 멈춰야 한다. 사유를 남긴다.
    name, build = FAIL_VOLUME
    sc = build()
    try:
        compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW, 'magazine_theme': sc['theme']}, NAMES, sc['corners'], MATERIALS)
    except ComposeError as e:
        reason = f'지면을 짤 수 없다: {e}'
        (out_root / name).mkdir(parents=True, exist_ok=True)
        (out_root / name / 'fail.txt').write_text(reason + '\n', encoding='utf-8')
        print(f'== {name} ==\n렌더 실패(기대한 결과): {reason}')
    else:
        print(f'== {name} ==\n!! 한 면을 넘는 대화인데 렌더가 멈추지 않았다')
        return 1
    (out_root / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    bad = [s for s in summary if s['originalClipped'] or s['facts'] or not s['designSame']]
    print('\n요약:', json.dumps([{k: v for k, v in s.items() if k != 'safe'} for s in summary], ensure_ascii=False))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
