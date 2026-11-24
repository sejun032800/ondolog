"""지면 검사 - 렌더 결과(채워진 지면)에 돌린다 (위임: 55-2 범위 7, 55-3 범위 4·5, CORNER_LAYOUT §7, R26-3).

항목
  overflow       지면 밖 넘침(210x297mm = 794x1123px 밖으로 나간 요소)
  safe           판면 이탈(글자 요소가 판면 좌우 68px · 위 60px · 아래 76px 밖. 러닝헤드·폴리오는 판면 밖이 정위치라 뺀다)
  overlap        형제 `.ab` 상자끼리 겹침(글자가 있는 것만)
  text-overlap   글자 요소(잎)끼리 겹침 - 본문 계열 요소 겹침(§7)
  broken-image   깨진 이미지(`naturalWidth === 0`, `src` 없음 포함)
  contrast       저대비(3.0:1 미만)
  tiny           과소 활자(7.2px 미만)
  overset        상자의 `scrollHeight > clientHeight`(판면 953px 기준, R26-3)
  overset(원문) `overset` 상자 안에 원문 슬롯(`ORIGINAL_SLOTS`)이 들었으면 **실패**(R49-1) - 잘린 원문과 같은 원칙이다. 온도록 문장만 든 상자의 overset은 기록이다.
                 어느 쪽인지는 `clipped`와 **같은 표시**(`ORIGINAL_SLOTS`, 슬롯 이름)로 가른다 - 원문 슬롯 목록은 이 파일 한 곳에만 있다.
  clipped        `.clamp1~4`가 글자를 잘랐다 - 넘침 안전망이 작동한 자리. **두 사람이 쓴 원문(`ORIGINAL_SLOTS`)이 잘렸으면 실패**(R29-3),
                 온도록이 쓴 문장이 잘렸으면 틀의 안전망(README §12 "안전망을 남긴 것")이 처리한 것이다. 어느 쪽인지는 잘린 요소의 `data-slot`으로 가른다.
  hidden         92-(R152-2): `.clamp*`가 아닌 `overflow:hidden|clip` 칸 안에서 글자가 보이지 않게 잘렸다(가로 말줄임 · 한 줄 막대 등).
                 사진 틀(`.ph`)과 지면 틀(`body` - 그쪽은 `overflow`)은 뺀다.

92- 넘침 · 잘림 · 겹침의 처리(`route`) - **기록만은 없다**(R152-2):
  되받기(feedback)  항목을 옮길 수 있는 지면(타임라인 · 인용 · 기사 - `render_feedback.has_items`)의 overflow · safe · overset · overlap · text-overlap.
                    되받기가 풀지 못하면 렌더 실패(`FeedbackStop`).
  실패(fail)        자리가 정해진 지면의 같은 다섯 종류 · 원문이 잘림(clipped · hidden) · 틀 안전망 밖의 hidden.
  축소(shrink)      틀이 일부러 줄여 보이는 칸(기존 길): 온도록 문장의 `.clamp*`(README §12 표) · 이달의 우리 사진 위 AI 캡션 말줄임(`.ai-txt`, README §12) ·
                    발행 노트 출처 막대 글자(`note.html` 막대 칸 `min-width:0;overflow:hidden;white-space:nowrap` - 좁은 막대에서 글자를 숨기는 틀 규칙).

앞의 다섯(overflow·tiny·contrast·overset·overlap)은 디자인의 `render/issue/tools/audit.py`와 **같은 판정**이어야 한다.
`compare_with_design`이 같은 지면에 두 검사를 모두 돌려 결과가 같은지 본다(디자인 검사기는 `tools/audit.py`의 `AUDIT`을 그대로 읽는다).

넘침 · 잘림 · 겹침(`OVERSET_KINDS`)은 아래 92- 처리 길로 간다. **그 밖의 기준(대비 · 활자 크기 · 깨진 그림)은 렌더를 실패시키지 않는다** - 결과를 파일에 남기고 운영자가 판단한다.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

sys.dont_write_bytecode = True

COMMON_KINDS = ('overflow', 'tiny', 'contrast', 'overset', 'overlap')

# 두 사람이 쓴 원문이 놓이는 슬롯(README §12 "자르지 않는 것"). 이 슬롯이 `clipped`면 원문이 지면에서 잘린 것이다.
#   .userNotes[0].text  타임라인 메모 · .text  인용 turn · 단문 · .evidence  근거 한 줄(발췌 포함) · @cover.quote  표지 이 달의 말
ORIGINAL_SLOTS = frozenset({'.userNotes[0].text', '.text', '.evidence', '@cover.quote'})

AUDIT_JS = r"""
() => {
  const W = 794, H = 1123, out = [];
  const lum = c => {
    const m = c.match(/\d+(\.\d+)?/g).map(Number);
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]);
  };
  const bgOf = el => {
    let n = el;
    while (n && n !== document.documentElement) {
      const b = getComputedStyle(n).backgroundColor;
      if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b;
      n = n.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  const ownText = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
  const name = el => el.tagName + '.' + (el.className || '');
  const photos = [...document.querySelectorAll('.ph')];

  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const cs = getComputedStyle(el);
    // overflow - 지면 밖
    if (r.bottom > H + 0.5 || r.right > W + 0.5 || r.top < -0.5 || r.left < -0.5) {
      out.push({k: 'overflow', t: name(el),
        box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]});
    }
    const txt = ownText(el);
    const onArt = el.closest('.ph') || photos.some(ph => {
      const q = ph.getBoundingClientRect();
      return r.left < q.right - 2 && r.right > q.left + 2 && r.top < q.bottom - 2 && r.bottom > q.top + 2;
    });
    if (txt) {
      const fs = parseFloat(cs.fontSize);
      if (fs < 7.2) out.push({k: 'tiny', t: txt.slice(0, 20), fs: fs});
      const a = lum(cs.color), b = lum(bgOf(el));
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (ratio < 3.0 && cs.opacity !== '0' && !onArt) {
        out.push({k: 'contrast', t: txt.slice(0, 20), r: +ratio.toFixed(2), fg: cs.color, bg: bgOf(el)});
      }
    }
  });

  // overset - 제 상자보다 내용이 큰 경우(종이에는 들어가도 판면을 넘는다)
  document.querySelectorAll('body > .ab').forEach(el => {
    const st = getComputedStyle(el);
    if (st.bottom !== 'auto' && st.top !== 'auto') {
      if (el.scrollHeight - el.clientHeight > 2) {
        out.push({k: 'overset', t: el.className || '?', need: el.scrollHeight, have: el.clientHeight});
      }
    }
  });

  // overlap - 형제 .ab 끼리, 글자가 있는 것만
  const abs = [...document.querySelectorAll('body > .ab')].map(e => [e, e.getBoundingClientRect()]);
  for (let i = 0; i < abs.length; i++) for (let j = i + 1; j < abs.length; j++) {
    const [ea, a] = abs[i], [eb, b] = abs[j];
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    const hasTxt = e => e.textContent.trim().length > 0 && !e.classList.contains('ph');
    if (ox > 2 && oy > 2 && !ea.contains(eb) && !eb.contains(ea) && hasTxt(ea) && hasTxt(eb)) {
      out.push({k: 'overlap', t: (ea.className || '?') + ' ∩ ' + (eb.className || '?'), area: Math.round(ox * oy)});
    }
  }
  return out;
}
"""

EXTRA_JS = r"""
() => {
  const out = [];
  const ownText = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
  // 글자가 실제로 차지한 줄 상자들(요소 상자가 아니라 글자 줄 단위 - 줄바꿈된 인라인 요소·전폭 가운데 정렬 글자의 오탐을 피한다)
  const lineRects = el => {
    const rs = [];
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const rg = document.createRange();
      rg.selectNodeContents(n);
      for (const r of rg.getClientRects()) if (r.width >= 1 && r.height >= 1) rs.push(r);
    }
    return rs;
  };
  const SAFE = {left: 68 - 0.5, right: 794 - 68 + 0.5, top: 60 - 0.5, bottom: 1123 - 76 + 0.5};

  // safe - 판면 이탈(글자). 러닝헤드(.run)·폴리오(.folio)·사진 위 글자(.ph)·판면 밖이 정위치인 표시([data-margin], 디자인 v1.2.3 README §6 · D9)는 뺀다.
  const leaves = [];
  document.querySelectorAll('body *').forEach(el => {
    if (el.tagName === 'BR' || el.tagName === 'STYLE') return;
    const rects = lineRects(el);
    if (!rects.length) return;
    leaves.push([el, rects]);
    if (el.closest('.run, .folio, .ph, [data-margin]')) return;
    const box = rects.reduce((u, r) => ({
      left: Math.min(u.left, r.left), top: Math.min(u.top, r.top),
      right: Math.max(u.right, r.right), bottom: Math.max(u.bottom, r.bottom)}),
      {left: 1e9, top: 1e9, right: -1e9, bottom: -1e9});
    if (box.left < SAFE.left || box.right > SAFE.right || box.top < SAFE.top || box.bottom > SAFE.bottom) {
      out.push({k: 'safe', t: ownText(el).slice(0, 20),
        box: [Math.round(box.left), Math.round(box.top), Math.round(box.right), Math.round(box.bottom)]});
    }
  });

  // broken-image
  document.querySelectorAll('img').forEach(img => {
    if (!(img.complete && img.naturalWidth > 0)) {
      out.push({k: 'broken-image', t: img.getAttribute('src') || '(src 없음)'});
    }
  });

  // text-overlap - 글자 줄끼리 겹침(서로 품은 요소는 뺀다)
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    const [ea, ra] = leaves[i], [eb, rb] = leaves[j];
    if (ea.contains(eb) || eb.contains(ea)) continue;
    let area = 0;
    for (const a of ra) for (const b of rb) {
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 2 && oy > 2) area = Math.max(area, Math.round(ox * oy));
    }
    if (area > 0) out.push({k: 'text-overlap', t: ownText(ea).slice(0, 14) + ' ∩ ' + ownText(eb).slice(0, 14), area: area});
  }

  // clipped - line-clamp가 글자를 잘랐다. 어떤 슬롯의 글자인지(`slot`)를 함께 남긴다 - 원문이면 실패, 온도록 문장이면 틀 축소(README §12)
  const slotOf = el => {
    const s = el.hasAttribute('data-slot') ? el : el.querySelector('[data-slot]');
    return s ? s.getAttribute('data-slot') : '';
  };
  document.querySelectorAll('.clamp1, .clamp2, .clamp3, .clamp4').forEach(el => {
    if (el.scrollHeight - el.clientHeight > 1) {
      out.push({k: 'clipped', t: (el.textContent || '').trim().slice(0, 24), slot: slotOf(el), need: el.scrollHeight, have: el.clientHeight});
    }
  });

  // hidden (92-) - clamp가 아닌 숨김 칸에서 글자가 잘렸다. 어떤 칸인지(`cls` · 막대 칸이면 `dw`)와 그 안의 원문 슬롯(`slots`)을 남긴다.
  const hid = v => v === 'hidden' || v === 'clip';
  document.querySelectorAll('body *').forEach(el => {
    if (el.matches('.clamp1, .clamp2, .clamp3, .clamp4, .ph, style, script')) return;
    const cs = getComputedStyle(el);
    if (!(hid(cs.overflowX) || hid(cs.overflowY))) return;
    if (!(el.textContent || '').trim()) return;
    const dx = el.scrollWidth - el.clientWidth, dy = el.scrollHeight - el.clientHeight;
    if (dx > 1 || dy > 1) {
      const slots = [...new Set([el, ...el.querySelectorAll('[data-slot]')].filter(s => s.hasAttribute('data-slot')).map(s => s.getAttribute('data-slot')))];
      out.push({k: 'hidden', t: (el.textContent || '').trim().slice(0, 24), cls: String(el.className || el.tagName.toLowerCase()),
        dw: el.getAttribute('data-width') || '', slots, need: Math.max(el.scrollWidth, el.scrollHeight), have: Math.max(el.clientWidth, el.clientHeight)});
    }
  });
  return out;
}
"""


# overset 상자(`body > .ab`, 위·아래가 모두 정해진 상자) 안에 든 원문 슬롯 이름. 판정 조건은 `AUDIT_JS`의 overset과 같다(순서도 같다).
OVERSET_SLOTS_JS = r"""
(originalSlots) => {
  const out = [];
  document.querySelectorAll('body > .ab').forEach(el => {
    const st = getComputedStyle(el);
    if (st.bottom !== 'auto' && st.top !== 'auto' && el.scrollHeight - el.clientHeight > 2) {
      const found = new Set();
      el.querySelectorAll('[data-slot]').forEach(s => { if (originalSlots.includes(s.getAttribute('data-slot'))) found.add(s.getAttribute('data-slot')); });
      out.push([...found]);
    }
  });
  return out;
}
"""


def mark_original_overset(page: Any, findings: list, extra_original_slots: Any = ()) -> None:
    """`overset` 결과마다 그 상자에 든 원문 슬롯 이름을 `originalSlots`로 붙인다. 디자인 검사기와의 비교(`compare_with_design`) **뒤에** 부른다
    (비교는 결과 전체를 보므로 먼저 붙이면 공통 다섯 항목이 어긋난다)."""
    sets = page.evaluate(OVERSET_SLOTS_JS, sorted(ORIGINAL_SLOTS | frozenset(extra_original_slots)))
    overs = [f for f in findings if f['k'] == 'overset']
    for f, slots in zip(overs, sets):
        f['originalSlots'] = slots


def original_overset(findings: list) -> list:
    """원문 필드가 든 상자의 넘침 - 하나라도 있으면 렌더는 실패다(R49-1)."""
    return [f for f in findings if f['k'] == 'overset' and f.get('originalSlots')]


def design_audit_js(tools_dir: Path) -> str:
    """디자인 검사기(`tools/audit.py`)의 `AUDIT`을 그대로 읽는다. 없으면 빈 문자열."""
    path = tools_dir / 'audit.py'
    if not path.exists():
        return ''
    m = re.search(r'AUDIT\s*=\s*r"""(.*?)"""', path.read_text(encoding='utf-8'), re.DOTALL)
    return m.group(1) if m else ''


def audit_page(page: Any) -> list:
    """열린 지면 하나를 검사한다."""
    page.evaluate('document.fonts.ready.then(() => true)')
    return page.evaluate(AUDIT_JS) + page.evaluate(EXTRA_JS)


def original_clipped(findings: list, extra_original_slots: Any = ()) -> list:
    """잘린 원문 - `clipped` 중 두 사람이 쓴 원문 슬롯의 것. 하나라도 있으면 렌더는 실패다(R29-3).

    `extra_original_slots`: 이 호에서만 원문이 놓인 슬롯(예: 표제가 이 달의 말로 바뀐 표지의 `@cover.headline`).
    """
    slots = ORIGINAL_SLOTS | frozenset(extra_original_slots)
    return [f for f in findings if f['k'] == 'clipped' and f.get('slot') in slots]


def recorded_clipped(findings: list, extra_original_slots: Any = ()) -> list:
    """잘린 온도록 문장 - 틀의 안전망(README §12)이 처리한 것(92- `route` = 'shrink'). 목록은 audit.json에 남는다."""
    slots = ORIGINAL_SLOTS | frozenset(extra_original_slots)
    return [f for f in findings if f['k'] == 'clipped' and f.get('slot') not in slots]


# ---------------------------------------------------------------------------
# 92- 처리 길(R152-2) - 넘침 · 잘림 · 겹침은 모두 되받기 · 실패 · 틀 축소 중 하나로 간다. 기록만은 없다.
# ---------------------------------------------------------------------------

OVERSET_KINDS = ('overflow', 'safe', 'overset', 'overlap', 'text-overlap', 'clipped', 'hidden')
ROUTES = ('feedback', 'fail', 'shrink')
# 발행 노트 출처 막대 칸(note.html - 좁은 막대에서 글자를 숨기는 틀 규칙)
NOTE_BAR_WIDTHS = frozenset({'@note.ratioPeopleWidth', '@note.ratioOndologWidth'})


def route(finding: dict, movable: bool, extra_original_slots: Any = ()) -> str | None:
    """검사 결과 하나의 처리 길 - 'feedback' | 'fail' | 'shrink'. 넘침 · 잘림 · 겹침이 아니면 None(대비 · 활자 크기 · 깨진 그림은 이 위임 밖).

    `movable`: 이 지면에 옮길 수 있는 항목이 있다(`render_feedback.has_items`). 판정은 순수하다(같은 입력 -> 같은 결과)."""
    k = finding.get('k')
    if k not in OVERSET_KINDS:
        return None
    originals = ORIGINAL_SLOTS | frozenset(extra_original_slots)
    if k == 'clipped':
        return 'fail' if finding.get('slot') in originals else 'shrink'
    if k == 'hidden':
        if any(s in originals for s in finding.get('slots') or []):
            return 'fail'
        cls = str(finding.get('cls') or '').split()
        if 'ai-txt' in cls or finding.get('dw') in NOTE_BAR_WIDTHS:
            return 'shrink'
        return 'fail'
    return 'feedback' if movable else 'fail'


def overset_by_page(pages: list, extra_original_slots: Any = ()) -> list:
    """지면별 넘침 · 잘림 · 겹침 수와 처리 길 수 - 숫자만(원문 · id 0). `pages` = [(번호, 지면 이름, 옮길 수 있음, 검사 결과)].
    결과가 하나도 없는 지면은 넣지 않는다."""
    out = []
    for n, stem, movable, findings in pages:
        found: dict[str, int] = {}
        routes = {r: 0 for r in ROUTES}
        for f in findings:
            way = route(f, movable, extra_original_slots)
            if way is None:
                continue
            found[f['k']] = found.get(f['k'], 0) + 1
            routes[way] += 1
        if found:
            out.append({'n': n, 'stem': stem, 'found': dict(sorted(found.items())), **routes})
    return out


def _norm(findings: list) -> list:
    return sorted(json.dumps(f, ensure_ascii=False, sort_keys=True) for f in findings if f['k'] in COMMON_KINDS)


def compare_with_design(page: Any, design_js: str, mine: list) -> dict:
    """같은 지면에서 디자인 검사기와 이 검사기의 공통 다섯 항목이 같은가."""
    if not design_js:
        return {'ran': False}
    theirs = page.evaluate(design_js)
    a, b = _norm(mine), _norm(theirs)
    return {'ran': True, 'same': a == b, 'mine': len(a), 'design': len(b),
            'onlyMine': [x for x in a if x not in b][:5], 'onlyDesign': [x for x in b if x not in a][:5]}
