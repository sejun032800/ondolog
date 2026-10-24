"""지면 검사 - 렌더 결과(채워진 지면)에 돌린다 (위임: 55-2 범위 7, CORNER_LAYOUT §7, R26-3).

항목
  overflow       지면 밖 넘침(210x297mm = 794x1123px 밖으로 나간 요소)
  safe           판면 이탈(글자 요소가 판면 좌우 68px · 위 60px · 아래 76px 밖. 러닝헤드·폴리오는 판면 밖이 정위치라 뺀다)
  overlap        형제 `.ab` 상자끼리 겹침(글자가 있는 것만)
  text-overlap   글자 요소(잎)끼리 겹침 - 본문 계열 요소 겹침(§7)
  broken-image   깨진 이미지(`naturalWidth === 0`, `src` 없음 포함)
  contrast       저대비(3.0:1 미만)
  tiny           과소 활자(7.2px 미만)
  overset        상자의 `scrollHeight > clientHeight`(판면 953px 기준, R26-3)
  clipped        `.clamp1~4`가 글자를 잘랐다(원문이 지면에서 보이지 않는다) - 넘침 안전망이 작동한 자리

앞의 다섯(overflow·tiny·contrast·overset·overlap)은 디자인의 `render/issue/tools/audit.py`와 **같은 판정**이어야 한다.
`compare_with_design`이 같은 지면에 두 검사를 모두 돌려 결과가 같은지 본다(디자인 검사기는 `tools/audit.py`의 `AUDIT`을 그대로 읽는다).

**기존 기준 위반은 렌더를 실패시키지 않는다** - 결과를 파일에 남기고 운영자가 판단한다.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

sys.dont_write_bytecode = True

COMMON_KINDS = ('overflow', 'tiny', 'contrast', 'overset', 'overlap')

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

  // safe - 판면 이탈(글자). 러닝헤드(.run)·폴리오(.folio)는 판면 밖이 정위치다.
  const leaves = [];
  document.querySelectorAll('body *').forEach(el => {
    if (el.tagName === 'BR' || el.tagName === 'STYLE') return;
    const rects = lineRects(el);
    if (!rects.length) return;
    leaves.push([el, rects]);
    if (el.closest('.run, .folio, .ph')) return;
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

  // clipped - line-clamp가 글자를 잘랐다
  document.querySelectorAll('.clamp1, .clamp2, .clamp3, .clamp4').forEach(el => {
    if (el.scrollHeight - el.clientHeight > 1) {
      out.push({k: 'clipped', t: (el.textContent || '').trim().slice(0, 24), need: el.scrollHeight, have: el.clientHeight});
    }
  });
  return out;
}
"""


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
