import sys; sys.dont_write_bytecode = True  # tools/ 에 __pycache__ 를 남기지 않는다
"""높이 실측 — README §12의 표(`measure.json`)를 만든다. v1.2.3 · v2.0.0(새 지면 원문 칸 `v2` · 판 이름 v2.0.0)

지면을 **실제 틀 그대로** 채워(개발의 `render/slot_fill.py`) Chromium에서 잰다. 규칙 문장이 아니라 이 결과가 원본이다(#5).

잰 것 두 가지
  1) 줄 수 표 — 활자 칸(서체 · 크기 · 행간 · 폭)마다 "글자 수 → 최대 줄 수". 견본 문장 여러 개 중 **가장 많이 꺾인 값**(위 덮개)이라
     실제보다 작게 어림하는 일이 없다. 조회는 글자 수 이상인 첫 칸(보간하지 않는다 — 줄 수는 계단이다).
  2) 상자 식 — 지면 상자의 높이 = 고정 높이 + 줄 높이 x 줄 수. 줄 수 1~4로 재서 직선인지 확인한 뒤 절편 · 기울기를 적는다.
마지막에 무작위 견본(줄바꿈 · 길이 섞음)으로 식의 예측과 실제 높이를 맞대어 최대 오차를 남긴다.

사용 (저장소 루트에서):  render/.venv/Scripts/python.exe render/issue/tools/measure.py
산출: render/issue/measure.json  (다시 재면 덮어쓴다 — 틀의 활자 · 폭을 바꾸면 반드시 다시 잰다)
"""
import json, pathlib, random, re, copy
from playwright.sync_api import sync_playwright

ISSUE = pathlib.Path(__file__).resolve().parent.parent
RENDER = ISSUE.parent
sys.path.insert(0, str(RENDER))
from slot_fill import fill  # noqa: E402

PAGES = ISSUE / 'pages'
TMP = PAGES / '_measure.html'
SAMPLE = '../images/sample/da_01.jpg'
STEP = 5
MAX_CHARS = 420
SAFETY_LINES = 1   # v1.2.4 README §12 - 낱말 단위 줄바꿈 여유

# 견본 문장 — 시험 데이터(tests/fixtures.py)의 온전한 메모 · 대화 문장과 짧은 채팅 말투를 섞었다. 여러 시작점에서 잘라 쓴다
CORPUS = ' '.join([
    '창가 자리에 앉아 오래 이야기했다. 해가 질 때까지 아무 말 없이 있어도 좋았다. 커피가 식는 줄도 모르고 창밖만 한참 바라보았다.',
    '건너편 건물 유리에 노을이 번지는 것을 둘이 같이 보았다. 나가기 전에 한 잔씩 더 시켜서 천천히 마셨다. 계산하고 나오니 비가 그쳐 있었다.',
    '오늘 퇴근길에 비가 너무 많이 와서 우산을 쓰고도 바짓단이 다 젖었어. 그래도 네가 가방에 넣어 준 작은 우산이 있어서 끝까지 마음이 놓였고, 집에 와서야 고맙다는 말이 떠올랐어.',
    'ㅋㅋㅋ 진짜?? 나 지금 버스 탔어! 10분이면 도착해~ 먼저 들어가 있어 ㅎㅎ 아 그리고 우산 꼭 챙겨, 오늘 저녁 7시부터 비 온대.',
    '골목을 따라 걷다가 문 닫은 가게 앞에서 한참을 서 있었다. 셔터에 붙은 오래된 안내문의 글씨가 반쯤 바래 있었다. 그날의 공기가 오래 남았다.',
    '칼국수 좋지, 날씨도 쌀쌀해져서 딱 맞는 메뉴야. 일곱 시쯤 만나서 천천히 먹고, 소화도 시킬 겸 근처 골목을 한 바퀴 돌고 들어가자.',
    '내일 저녁은 어떻게 할까? 요즘 네가 일이 많아서 피곤해 보여서, 멀리 가지 말고 집 근처에서 조용히 먹으면 어떨까 해. 먹고 싶은 게 있으면 편하게 말해 줘.',
    '사진 속 우리는 생각보다 더 많이 웃고 있었다. 문을 열고 나서기 전에 잠깐 입구에 서 있었다. 내일도 비슷한 하루였으면 좋겠다고 적어 둔다.',
])
PLACES = ['홍대입구역', '연남동 카페 오월', '경의선숲길 연남동 구간', '성수동 대림창고 갤러리 앞 골목', '이름을 남기지 않은 곳',
          '망원한강공원 자전거 대여소', '서울숲 군마상 앞 잔디밭', 'CGV 용산아이파크몰 IMAX관']


def samples(n_chars: int, k: int = 7) -> list:
    """`n_chars`자 견본 k개 - 말뭉치의 서로 다른 시작점에서 자른다. 시작점은 고정 시드라 다시 재도 같다."""
    rnd = random.Random(n_chars * 7919)
    out = []
    for _ in range(k):
        start = rnd.randrange(0, len(CORPUS) - MAX_CHARS - 1)
        out.append(CORPUS[start:start + n_chars].strip() or CORPUS[:n_chars])
    return out


def place_samples(n_chars: int, k: int = 7) -> list:
    rnd = random.Random(n_chars * 104729)
    pool = ' '.join(PLACES * 4)
    return [pool[s:s + n_chars].strip() or pool[:n_chars] for s in (rnd.randrange(0, len(pool) - 60) for _ in range(k))]


def open_filled(page, template: str, corner: dict, computed: dict, bind: dict, choose) -> None:
    html = fill((PAGES / template).read_text(encoding='utf-8'), corner, computed, bind, chooser=choose)
    TMP.write_text(html, encoding='utf-8')
    page.goto(TMP.as_uri(), wait_until='networkidle')
    page.evaluate('document.fonts.ready.then(() => true)')


# 같은 요소의 글자만 바꿔 가며 높이를 재는 JS. sel = 바꿀 요소, box = 높이를 잴 상자
LINES_JS = r"""
([sel, texts]) => {
  const el = document.querySelector(sel);
  const cs = getComputedStyle(el);
  let lh = parseFloat(cs.lineHeight);
  if (!Number.isFinite(lh)) { el.textContent = '가'; lh = el.getBoundingClientRect().height; }
  return texts.map(t => { el.textContent = t; return Math.round(el.getBoundingClientRect().height / lh); });
}
"""
BOX_JS = r"""
([sel, box, texts]) => {
  const el = document.querySelector(sel), b = document.querySelector(box);
  return texts.map(t => { el.innerHTML = t; return Math.round(b.getBoundingClientRect().height * 10) / 10; });
}
"""


def line_table(page, sel: str, sampler=samples, max_chars: int = MAX_CHARS, step: int = STEP) -> dict:
    """글자 수 칸마다 (앞 칸 초과 ~ 이 칸 이하) 길이의 견본 중 최대 줄 수."""
    chars, lines = [], []
    prev = 0
    for c in range(step, max_chars + 1, step):
        texts = [t for n in range(prev + 1, c + 1, max(1, step // 5)) for t in sampler(n, 3)]
        got = page.evaluate(LINES_JS, [sel, texts])
        chars.append(c); lines.append(max(got))
        prev = c
    # v1.2.4 - 낱말 단위 줄바꿈(keep-all)에서는 줄 끝 낱말 길이에 따라 같은 글자 수라도 한 줄이 더 꺾인다.
    # 견본 밖 문장 3,000개로 잰 결과 위 덮개보다 많아야 +1줄(약 9%) - 두 줄 이상인 칸에 여유 SAFETY_LINES 줄을 더해 적는다
    # 한 줄 칸이라도 바로 다음 칸이 두 줄이면(한 줄의 끝자락) 같은 여유를 준다
    safe = [l + SAFETY_LINES if (l >= 2 or (i + 1 < len(lines) and lines[i + 1] >= 2)) else l for i, l in enumerate(lines)]
    return {'chars': chars, 'lines': safe, 'sampledLines': lines}


def fit_box(page, sel: str, box: str, unit: str) -> dict:
    """상자 높이 = base + per_line x 줄 수 — 줄 수 1~4(줄바꿈으로 만든다)로 재서 직선인지 본다."""
    texts = ['<br>'.join([unit] * n) for n in (1, 2, 3, 4)]
    h = page.evaluate(BOX_JS, [sel, box, texts])
    steps = [h[i + 1] - h[i] for i in range(3)]
    per = round(max(steps), 1)          # 직선이 아니면 가장 큰 증가분 - 작게 어림하지 않는다
    straight = max(steps) - min(steps) <= 1
    return {'base': round(h[0] - per, 1), 'perLine': per, 'straight': straight, 'measured1to4': h}


def stop(photos: int, memo: str = None, caption: str = None, place: str = '홍대입구역') -> dict:
    return {'seq': 0, 'time': '14:20', 'placeName': place,
            'photos': [{'path': SAMPLE} for _ in range(photos)],
            'photoLabel': f'{photos} / {photos}' if photos else '',
            'userNotes': [{'text': memo, 'authorName': '세준'}] if memo else [],
            'aiCaption': caption}


def timeline(page) -> dict:
    out = {'capacity': 953, 'stopPadding': 36}
    choose_n = {}

    def choose(names, scope):
        if 'photos-0' in names:
            return f"photos-{min(len(scope.get('photos') or []), 3)}"
        return None

    def load(st):
        corner = {'header': {}, 'payload': {'articles': [{'featured': True, 'stops': [st]}]}}
        open_filled(page, 'da-timeline.html', corner, {'da': {}}, {'featured': 0, 'i': 0}, choose)

    load(stop(1, memo='가'))
    out['memoLines'] = line_table(page, '[data-repeat] > * p.mb')
    load(stop(0, caption='가'))
    out['captionLines'] = line_table(page, '[data-repeat] > * [data-slot=".aiCaption"], [data-repeat] > * p')
    left = '[data-repeat] > * > div:first-child'
    load(stop(1, memo='가'))
    out['placeLines'] = line_table(page, left + ' [data-slot=".placeName"]', place_samples, 40, 2)
    # 왼쪽 단은 플렉스 줄 높이로 늘어나 있다 - 상자 높이가 아니라 **마지막 자식의 아래끝**까지를 잰다
    H = "s => { const d = document.querySelector(s); return d.lastElementChild.getBoundingClientRect().bottom - d.getBoundingClientRect().top; }"
    hs = []
    for n in (1, 2, 3):
        page.evaluate("([s, n]) => { document.querySelector(s).innerHTML = Array(n).fill('가').join('<br>'); }", [left + ' [data-slot=".placeName"]', n])
        hs.append(page.evaluate(H, left))
    per = round(hs[1] - hs[0], 1)
    cfg = {}
    for key, n_ph, place in (('placeLabel', 1, '가'), ('placeNoLabel', 0, '가'), ('noPlaceLabel', 1, ''), ('noPlaceNoLabel', 0, '')):
        load(stop(n_ph, memo='가', place=place))
        cfg[key] = round(page.evaluate(H, left), 1)
    out['left'] = {**cfg, 'placeLine': per,
                   'formula': '왼쪽 단 = (장소 있음/없음 x 사진 라벨 있음/없음의 값) + placeLine x (장소 줄 수 - 1). 사진 0이면 라벨이 빠진다'}
    right = '[data-repeat] > * > div:last-child'
    out['right'] = {}
    for n in range(4):
        load(stop(n, memo='가'))
        memo_box = fit_box(page, '[data-repeat] > * p.mb', right, '가')
        load(stop(n, caption='가'))
        cap_box = fit_box(page, '[data-repeat] > * [data-slot=".aiCaption"]', right, '가')
        load(stop(n))
        none_h = round(page.evaluate("s => document.querySelector(s).getBoundingClientRect().height", right), 1)
        out['right'][f'photos-{n}'] = {'memo': memo_box, 'caption': cap_box, 'none': none_h}
    return out


def quotes(page) -> dict:
    def turn(i, t):
        return {'speaker': '세준' if i % 2 == 0 else '서영', 'text': t, 'at': '2026-09-22T09:20:00+09:00'}

    def conv(texts, ctx='아침 출근길에 오간 대화'):
        return {'context': ctx, 'attribution': {'display': '09.22 09:20, 아침 대화 중', 'at': '09.22 09:20'},
                'turns': [turn(i, t) for i, t in enumerate(texts)]}

    def load(mains, subs=()):
        corner = {'header': {}, 'payload': {'main': mains, 'sub': [{'speaker': '서영', 'text': s, 'attribution': {'at': '09.11 23:40'}} for s in subs]}}
        open_filled(page, 'sw-quotes.html', corner, {}, {}, lambda n, s: None)

    out = {}
    load([conv(['가', '가'])])
    sel_odd = '[data-repeat="payload.main"] > * [data-repeat=".turns"] > *:nth-child(1) p'
    sel_even = '[data-repeat="payload.main"] > * [data-repeat=".turns"] > *:nth-child(2) p'
    out['turnLines'] = {'odd': line_table(page, sel_odd), 'even': line_table(page, sel_even),
                        'note': '홀수 턴은 인용 폭 446px, 짝수 턴은 42px 들여써 404px - 짝수 턴이 더 일찍 꺾인다'}
    out['contextLines'] = line_table(page, '[data-repeat="payload.main"] > * [data-slot=".context"]', max_chars=160)
    box = '[data-repeat="payload.main"] > *'
    # 대화 높이 = base + context 줄 x ctxLine + Σ(턴 고정 + 줄 x turnLine)
    load([conv(['가'])])
    one = fit_box(page, sel_odd, box, '가')
    ctx = fit_box(page, '[data-repeat="payload.main"] > * [data-slot=".context"]', box, '가')
    load([conv(['가', '가'])])
    two = page.evaluate("s => document.querySelector(s).getBoundingClientRect().height", box)
    load([conv(['가'])])
    single = page.evaluate("s => document.querySelector(s).getBoundingClientRect().height", box)
    per_turn = round(two - single, 1)
    out['conversation'] = {'base': round(single - per_turn - ctx['perLine'], 1), 'perTurn': per_turn, 'turnLine': one['perLine'],
                           'contextLine': ctx['perLine'],
                           'formula': '대화 = base + contextLine x 정황 줄 수 + Σ턴(perTurn + turnLine x (그 턴 줄 수 - 1))'}
    # 가용 높이 - 인용 블록(top 66px)부터 단문 묶음 윗변 - 숨 24px. 단문이 없으면 판면 안 바닥 줄(bottom 76px) 윗변 - 24px
    caps = {}
    for label, subs in (('sub0', []), ('sub1-3', ['오늘 고생했어 진짜', '잘 자', '사랑해']), ('sub4-6', ['오늘 고생했어 진짜'] * 6)):
        load([conv(['가'])], subs)
        caps[label] = page.evaluate("""() => {
          const top = 66;
          const subBox = [...document.querySelectorAll('body > .ab.col')].find(e => e.querySelector('[data-repeat="payload.sub"]'));
          const foot = [...document.querySelectorAll('body > .ab.col')].pop();
          const limit = subBox ? subBox.getBoundingClientRect().top : foot.getBoundingClientRect().top;
          return Math.floor(limit - 24 - top);
        }""")
    out['capacity'] = caps
    out['subLines'] = None
    return out


def article(page) -> dict:
    """da-article — hero-none의 구간 목록 상자 · hero-photo의 사진 캡션 칸."""
    def choose_none(names, scope):
        return 'hero-none' if 'hero-none' in names else None

    def choose_photo(names, scope):
        return 'hero-photo' if 'hero-photo' in names else None

    def load(choose, stops, photos=()):
        art = {'featured': False, 'title': '메모만 남은 하루', 'dateOn': '2026-09-20', 'stops': stops, 'recalled': False}
        corner = {'header': {}, 'payload': {'articles': [{'featured': True, 'stops': []}, art]}}
        computed = {'da': {'articleStops': stops, 'articlePhotos': list(photos), 'articleHero': SAMPLE, 'articleNo': '02',
                           'articleRoute': '망원동 → 합정', 'articleStopCount': len(stops) or 1, 'articlePhotoNote': '그날 남은 사진 3장'}}
        open_filled(page, 'da-article.html', corner, computed, {'featured': 0, 'i': 1}, choose)

    out = {}
    load(choose_none, [stop(0, memo='가')])
    out['stopMemoLines'] = line_table(page, '.art-stop p.mb')
    box = '[data-repeat="@da.articleStops"] > *'
    out['stopMemo'] = fit_box(page, '.art-stop p.mb', box, '가')
    load(choose_none, [stop(0, caption='가')])
    out['stopCaption'] = fit_box(page, '.art-stop [data-slot=".aiCaption"]', box, '가')
    load(choose_none, [stop(0, memo='가')])
    out['stopLeft'] = fit_box(page, '.art-stop [data-slot=".placeName"]', '.art-stop-l', '가')
    out['stopPadding'] = round(page.evaluate("""s => { const r = document.querySelector(s); const cs = getComputedStyle(r);
        return parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth); }""", box), 1)
    out['stopsCapacity'] = round(page.evaluate("s => document.querySelector(s).getBoundingClientRect().height", '[data-repeat="@da.articleStops"]'), 1)
    # 사진 캡션 칸 - 사진 수(1~3)마다 칸 폭이 다르다. 메모 줄 수 표 · 칸 고정 높이 · 칸이 쓸 수 있는 높이(사진 아래 ~ 판면 바닥 1047px)
    out['photoCaption'] = {}
    for n in (1, 2, 3):
        photos = [{'path': SAMPLE, 'caption': '가', 'authorName': '세준', 'aiCaption': ''}] + \
                 [{'path': SAMPLE, 'caption': '', 'authorName': '', 'aiCaption': ''} for _ in range(n - 1)]
        load(choose_photo, [stop(1)], photos)
        sel = '[data-repeat="@da.articlePhotos"] > *:first-child .cap.memo > span[data-slot=".caption"]'
        lines = line_table(page, sel, max_chars=300)
        memo_box = fit_box(page, sel, '[data-repeat="@da.articlePhotos"] > *:first-child .cap.memo', '가')
        room = page.evaluate("""() => { const p = document.querySelector('[data-repeat="@da.articlePhotos"] > *:first-child .ph');
            return Math.floor(1047 - p.getBoundingClientRect().bottom); }""")
        out['photoCaption'][str(n)] = {'memoLines': lines, 'memoBlock': memo_box, 'room': room,
                                       'aiCaptionMax': '3줄(clamp3) - 온도록 문장이라 잘려도 기록이다. 항상 들어간다'}
    return out


# ── v2.0.0 · 매거진 2.0 새 지면의 원문 칸 (묶음 5) ───────────────────────────
# 새 지면은 렌더러 채움(slot_fill) 없이 **틀의 견본 그대로** 연다 — 견본 항목의 글자만 바꿔 잰다(새 코너 계약이 렌더러에 아직 없다).
# 원문 칸만 잰다: AI 칸은 계약의 max_chars로 틀이 이미 최대 길이를 받게 그렸다(README §13).
V2 = {
    # 지면: [(이름, 글자 칸 선택자, 상자 선택자, 최대 글자)]
    'setlog.html': [('entryTwo', '.sl [data-variant="two"] .tx', '.sl [data-variant="two"] .en', 120),
                    ('entryOne', '.sl [data-variant="one"] .tx', '.sl [data-variant="one"] .en', 120)],
    'interview.html': [('question', '.iv .qt [data-slot=".text"]', None, 60),
                       ('own', '.iv .own', None, 200), ('predicted', '.iv .pr', None, 200)],
    'guest.html': [('answer', '.gb .ga', '.gb .gc', 400)],
    'league-report.html': [('explanation', '.lg2 .ch .ai-t', None, 160), ('excerpt', '.lg2 .ex', None, 300)],
    'note.html': [('emptyCorner', '.note .lists .li', None, 120)],
    'colophon.html': [('errata', '.co .el', None, 160)],
}
# 반복 블록이 쓸 수 있는 높이(첫 면) = 반복 상자 위 끝 ~ 판면 아래 끝(1047px)에서 바닥 줄 상자를 뺀 값
# 블록 한 개의 바닥 높이 — 블록 안 글 칸을 모두 한 줄('가')로 두고 잰다. 실제 높이 = 바닥 + Σ 칸마다 (줄 수 - 1) x 그 칸 perLine
BLOCK = {
    'setlog.html': ('.sl [data-variant="two"] .en', ['.tx']),
    'interview.html': ('.iv .q', ['.qt [data-slot=".text"]', '.own', '.pr > span:last-child']),
    'league-report.html': ('.lg2 .ch', ['.ai-t', '.ex > span:last-child', '.cw', '.cv']),
}
GUEST_JS = """() => { const c = document.querySelector('.gb .gc'); const ga = [...c.querySelectorAll('.ga')];
  ga.forEach(g => g.lastElementChild.textContent = '가');
  const h3 = c.getBoundingClientRect().height; ga[2].remove(); const h2 = c.getBoundingClientRect().height; ga[1].remove();
  const h1 = c.getBoundingClientRect().height; return [h1, h2, h3]; }"""
ROOM = {'setlog.html': '.sl .cols', 'interview.html': '.iv .rounds', 'guest.html': '.gb .gw', 'league-report.html': '.lg2 .sc'}


def v2(page) -> dict:
    out = {}
    for tpl, cells in V2.items():
        page.goto((PAGES / tpl).as_uri(), wait_until='networkidle')
        page.evaluate('document.fonts.ready.then(() => true)')
        o = {}
        for name, sel, box, mx in cells:
            o[name + 'Lines'] = line_table(page, sel, max_chars=mx)
            o[name] = fit_box(page, sel, box or sel, '가')
        # 줄 수 표 · 상자 식이 견본 글자를 바꿔 놓았으니 다시 연다
        page.goto((PAGES / tpl).as_uri(), wait_until='networkidle')
        page.evaluate('document.fonts.ready.then(() => true)')
        if tpl in BLOCK:
            blk, cells_ = BLOCK[tpl]
            o['blockBase'] = round(page.evaluate("""([b, cs]) => { const e = document.querySelector(b);
                cs.forEach(c => e.querySelectorAll(c).forEach(x => x.textContent = '가')); return e.getBoundingClientRect().height; }""", [blk, cells_]), 1)
        if tpl == 'guest.html':
            h1, h2, h3 = page.evaluate(GUEST_JS)
            o['card'] = {'oneAnswer': round(h1, 1), 'perAnswer': round(h2 - h1, 1), 'measured1to3': [round(h1, 1), round(h2, 1), round(h3, 1)]}
        if tpl in ROOM:
            o['room'] = round(page.evaluate("""s => { const r = document.querySelector(s).getBoundingClientRect();
                let lim = 1047; document.querySelectorAll('body > .ab').forEach(e => { const q = e.getBoundingClientRect();
                  if (getComputedStyle(e).bottom !== 'auto' && q.top > r.top && e.textContent.trim() && !e.classList.contains('folio')) lim = Math.min(lim, q.top - 16); });
                return lim - r.top; }""", ROOM[tpl]), 1)
        out[tpl.replace('.html', '')] = o
    return out


def validate(page, m: dict) -> dict:
    """무작위 견본(길이 · 줄바꿈 섞음)으로 식의 예측과 실제를 맞댄다."""
    rnd = random.Random(20261119)

    def lines_of(table, text):
        tot = 0
        for seg in text.split('\n'):
            n = len(seg)
            if n == 0:
                tot += 1; continue
            for c, l in zip(table['chars'], table['lines']):
                if c >= n:
                    tot += l; break
            else:
                tot += table['lines'][-1] + -(-(n - table['chars'][-1]) // 30)
        return tot

    res = {'timeline': [], 'quotes': []}
    tl = m['timeline']

    def choose(names, scope):
        return f"photos-{min(len(scope.get('photos') or []), 3)}" if 'photos-0' in names else None

    for _ in range(40):
        n_ph = rnd.randrange(4)
        kind = rnd.choice(['memo', 'memo', 'caption', 'none'])
        text = '\n'.join(samples(rnd.randrange(5, 200), 1)[0] for _ in range(rnd.choice([1, 1, 2])))
        place = rnd.choice(PLACES + [''])
        st = stop(n_ph, memo=text if kind == 'memo' else None, caption=text[:120] if kind == 'caption' else None, place=place)
        corner = {'header': {}, 'payload': {'articles': [{'featured': True, 'stops': [st]}]}}
        TMP.write_text(fill((PAGES / 'da-timeline.html').read_text(encoding='utf-8'), corner, {'da': {}}, {'featured': 0, 'i': 0}, chooser=choose), encoding='utf-8')
        page.goto(TMP.as_uri(), wait_until='networkidle'); page.evaluate('document.fonts.ready.then(() => true)')
        actual = page.evaluate("() => document.querySelector('[data-repeat] > *').getBoundingClientRect().height")
        pred = predict_stop(tl, n_ph, kind, text if kind == 'memo' else (text[:120] if kind == 'caption' else ''), place, lines_of)
        res['timeline'].append(round(pred - actual, 1))
    for _ in range(30):
        k = rnd.randrange(1, 7)
        texts = [samples(rnd.randrange(5, 400), 1)[0] for _ in range(k)]
        ctx = samples(rnd.randrange(8, 60), 1)[0]
        corner = {'header': {}, 'payload': {'main': [{'context': ctx, 'attribution': {'display': '09.22 09:20, 아침 대화 중'},
                  'turns': [{'speaker': 'A', 'text': t} for t in texts]}], 'sub': []}}
        TMP.write_text(fill((PAGES / 'sw-quotes.html').read_text(encoding='utf-8'), corner, {}, {}, chooser=lambda n, s: None), encoding='utf-8')
        page.goto(TMP.as_uri(), wait_until='networkidle'); page.evaluate('document.fonts.ready.then(() => true)')
        actual = page.evaluate("() => document.querySelector('[data-repeat=\"payload.main\"] > *').getBoundingClientRect().height")
        pred = predict_conversation(m['quotes'], ctx, texts, lines_of)
        res['quotes'].append(round(pred - actual, 1))
    return {k: {'n': len(v), 'minError': min(v), 'maxError': max(v), 'under': sum(1 for x in v if x < -0.5)} for k, v in res.items()}


def predict_stop(tl, n_ph, kind, text, place, lines_of) -> float:
    r = tl['right'][f'photos-{n_ph}']
    if kind == 'memo':
        right = r['memo']['base'] + r['memo']['perLine'] * lines_of(tl['memoLines'], text)
    elif kind == 'caption':
        right = r['caption']['base'] + r['caption']['perLine'] * lines_of(tl['captionLines'], text)
    else:
        right = r['none']
    lf = tl['left']
    key = ('place' if place else 'noPlace') + ('Label' if n_ph else 'NoLabel')
    left = lf[key] + (lf['placeLine'] * (lines_of(tl['placeLines'], place) - 1) if place else 0)
    return max(left, right) + tl['stopPadding']


def predict_conversation(q, ctx, texts, lines_of) -> float:
    c = q['conversation']
    h = c['base'] + c['contextLine'] * lines_of(q['contextLines'], ctx)
    for i, t in enumerate(texts):
        table = q['turnLines']['odd' if i % 2 == 0 else 'even']
        h += c['perTurn'] + c['turnLine'] * (lines_of(table, t) - 1)
    return h


def main() -> int:
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_context(viewport={'width': 794, 'height': 1123}).new_page()
        try:
            m = {'version': 'v2.0.0', 'conditions': {
                     'engine': 'Chromium (Playwright) · 794x1123 @96dpi · 글꼴 render/issue/fonts (Pretendard · MaruBuri otf)',
                     'timelineMemo': 'MaruBuri 16.7px / 29px · 폭 545px', 'timelineCaption': 'Pretendard 10.9px / 1.6 · 폭 545px',
                     'timelinePlace': 'Pretendard 11.5px · 폭 68px', 'quoteTurn': 'MaruBuri 12.5px / 1.75 · 폭 446px(홀수 턴) · 404px(짝수 턴)',
                     'quoteContext': 'Pretendard 9.5px / 1.6 · 폭 446px', 'articleStopMemo': 'MaruBuri 15px / 26px · 폭 545px',
                     'articlePhotoMemo': 'Pretendard 10.1px / 1.5 · 폭 = 사진 칸(1장 658 · 2장 320 · 3장 208px)',
                     'samples': '글자 수 칸마다 견본 문장 여러 개의 최대 줄 수(위 덮개). 줄바꿈은 줄 하나로 따로 센다',
                     'v2': 'v2.0.0 새 지면 원문 칸 — 틀의 견본 항목 글자만 바꿔 잼(README §13-3)'},
                 'timeline': timeline(page), 'quotes': quotes(page), 'article': article(page), 'v2': v2(page)}
            m['validation'] = validate(page, m)
        finally:
            b.close()
            TMP.unlink(missing_ok=True)
    (ISSUE / 'measure.json').write_text(json.dumps(m, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(json.dumps(m['validation'], ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
