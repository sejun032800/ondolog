/* 슬롯 계약 해석기 — 미리보기 전용(배포 HTML에는 JS가 없다).
   렌더 코드가 할 일을 그대로 흉내 낸다:
   1) data-variant 그룹에서 하나만 남김  2) data-repeat 전개  3) 빈 data-optional 제거 */
window.__resolve = (cfg) => {
  // 1. variant — 같은 부모 아래 변형끼리 한 그룹, 하나만 남긴다
  const groups = new Map();
  document.querySelectorAll("[data-variant]").forEach(el => {
    const p = el.parentElement;
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(el);
  });
  groups.forEach(list => {
    const keep = list.find(e => e.dataset.variant === cfg.variant) || list[0];
    list.forEach(e => { if (e !== keep) e.remove(); });
  });

  // 2. repeat — 첫 자식이 틀, 나머지 견본은 지우고 n개로 전개
  document.querySelectorAll("[data-repeat]").forEach(box => {
    const path = box.dataset.repeat;
    const n = cfg.repeat?.[path] ?? cfg.repeat?.["*"] ?? 3;
    const tpl = box.firstElementChild;
    if (!tpl) return;
    while (box.children.length > 1) box.lastElementChild.remove();
    for (let i = 1; i < n; i++) box.appendChild(tpl.cloneNode(true));
  });

  // 2b. if — 참인 가지만 남긴다. cfg.ifs 에 없으면 지운다
  document.querySelectorAll("[data-if]").forEach(el => {
    if (!(cfg.ifs || []).includes(el.dataset.if)) el.remove();
  });

  // 3. optional — 안의 슬롯 값이 **전부** 비면 요소째 삭제.
  //    data-slot(글자)과 data-src(사진 경로)를 모두 센다.
  document.querySelectorAll("[data-optional]").forEach(el => {
    const isSlot = n => n.hasAttribute("data-slot") || n.hasAttribute("data-src");
    const slots = isSlot(el) ? [el] : [...el.querySelectorAll("[data-slot],[data-src]")];
    if (!slots.length) return;
    const filled = slots.some(n => n.hasAttribute("data-src")
      ? !!(cfg.src || {})[n.dataset.src]
      : !!n.textContent.trim());
    if (!filled) el.remove();
  });

  // 3b. slot — 미리보기에서 몇 개만 실제 값으로 바꿔 본다(렌더러는 전부 바꾼다)
  document.querySelectorAll("[data-slot]").forEach(el => {
    const v = (cfg.text || {})[el.dataset.slot];
    if (v != null) el.textContent = v;
  });

  // 4. width — 값(0~100)을 width:% 로. optional 다음에 적용한다
  document.querySelectorAll("[data-width]").forEach(el => {
    const v = (cfg.width || {})[el.dataset.width];
    if (v == null) return;
    el.style.width = Math.max(0, Math.min(100, Number(v))) + "%";
    el.style.flex = "none";
  });

  return document.querySelectorAll("[data-repeat] > *").length;
};
