import sys; sys.dont_write_bytecode = True  # tools/ 에 __pycache__ 를 남기지 않는다
import asyncio, pathlib, json
from playwright.async_api import async_playwright
R=pathlib.Path(".").resolve(); JS=pathlib.Path("./tools/resolve.js").read_text()
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from preview import CFG
THEMES=["basic","hip","neon","lovely","night","ondol"]
AUDIT = r"""
() => {
  const W=794,H=1123, out=[];
  const lum=c=>{const m=c.match(/\d+(\.\d+)?/g).map(Number);
    const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};
    return 0.2126*f(m[0])+0.7152*f(m[1])+0.0722*f(m[2])};
  const bgOf=el=>{let n=el;while(n&&n!==document.documentElement){
    const b=getComputedStyle(n).backgroundColor;
    if(b&&!/rgba\(0, 0, 0, 0\)|transparent/.test(b))return b;n=n.parentElement;}
    return getComputedStyle(document.body).backgroundColor;};
  document.querySelectorAll("body *").forEach(el=>{
    const r=el.getBoundingClientRect(); if(r.width<1||r.height<1)return;
    const cs=getComputedStyle(el);
    // 넘침
    if(r.bottom>H+0.5||r.right>W+0.5||r.top<-0.5||r.left<-0.5)
      out.push({k:"overflow",t:el.tagName+"."+(el.className||""),
        box:[Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]});
    // 글자
    const txt=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join("");
    const onArt = el.closest(".ph") || [...document.querySelectorAll(".ph")].some(ph=>{
        const q=ph.getBoundingClientRect();
        return r.left<q.right-2 && r.right>q.left+2 && r.top<q.bottom-2 && r.bottom>q.top+2;});
    if(txt){
      const fs=parseFloat(cs.fontSize);
      if(fs<7.2) out.push({k:"tiny",t:txt.slice(0,20),fs:fs});
      const a=lum(cs.color), b=lum(bgOf(el));
      const ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
      if(ratio<3.0&&cs.opacity!=="0"&&!onArt) out.push({k:"contrast",t:txt.slice(0,20),
        r:+ratio.toFixed(2),fg:cs.color,bg:bgOf(el)});
    }
  });
  // 판면 초과 — 제 상자보다 내용이 큰 경우(종이에는 들어가도 판면을 넘는다)
  document.querySelectorAll("body > .ab").forEach(el=>{
    const st=getComputedStyle(el);
    if(st.bottom!=="auto" && st.top!=="auto"){
      if(el.scrollHeight - el.clientHeight > 2)
        out.push({k:"overset",t:el.className||"?",
          need:el.scrollHeight, have:el.clientHeight});
    }
  });
  // 형제 겹침 — .ab 끼리만
  const abs=[...document.querySelectorAll("body > .ab")].map(e=>[e,e.getBoundingClientRect()]);
  for(let i=0;i<abs.length;i++)for(let j=i+1;j<abs.length;j++){
    const [ea,a]=abs[i],[eb,b]=abs[j];
    const ox=Math.min(a.right,b.right)-Math.max(a.left,b.left);
    const oy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
    const hasTxt=e=>e.textContent.trim().length>0 && !e.classList.contains("ph");
    if(ox>2&&oy>2&&!ea.contains(eb)&&!eb.contains(ea)&&hasTxt(ea)&&hasTxt(eb))
      out.push({k:"overlap",t:(ea.className||"?")+" ∩ "+(eb.className||"?"),
        area:Math.round(ox*oy)});
  }
  return out;
}"""
async def main():
    bad={}
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); pg=await b.new_page(viewport={"width":794,"height":1123})
        for stem,cfg in CFG.items():
            for t in THEMES:
                await pg.goto(f"file://{R}/pages/{stem}.html", wait_until="networkidle")
                await pg.evaluate(f'document.documentElement.setAttribute("data-theme","{t}")')
                await pg.add_script_tag(content=JS); await pg.evaluate("c=>window.__resolve(c)",cfg)
                await pg.wait_for_timeout(60)
                res=await pg.evaluate(AUDIT)
                if res: bad[f"{stem}/{t}"]=res
        await b.close()
    n=sum(len(v) for v in bad.values())
    print(f"=== {n} findings in {len(bad)} page/theme combos ===")
    for k,v in bad.items():
        kinds={}
        for it in v: kinds.setdefault(it["k"],[]).append(it)
        print(f"\n[{k}]")
        for kind,items in kinds.items():
            print(f"  {kind} x{len(items)}: {json.dumps(items[:3],ensure_ascii=False)[:300]}")
if __name__=="__main__": asyncio.run(main())
