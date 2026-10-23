import sys; sys.dont_write_bytecode = True  # tools/ 에 __pycache__ 를 남기지 않는다
import asyncio, pathlib, json, sys
sys.path.insert(0,"./tools")
from playwright.async_api import async_playwright
from audit import AUDIT
from preview import SRC
R=pathlib.Path(".").resolve(); JS=pathlib.Path("./tools/resolve.js").read_text()
THEMES=["basic","night"]   # 밝은 테마 대표 + 유일한 어두운 테마
CASES=[]
# tm-articles: 2·3·4편
for v,n in [("grid-2",2),("grid-3",3),("grid-4",4)]:
    CASES.append(("tm-articles",{"variant":v,"repeat":{"payload.articles":n}}))
# da-timeline: 사진 0·1·2·3장 × stop 1~3
for v in ["photos-0","photos-1","photos-2","photos-3"]:
    for st in (1,2,3):
        for ifs in ([".userNotes"],[".aiCaption"]):
            CASES.append(("da-timeline",{"variant":v,"ifs":ifs,
                "repeat":{"payload.articles[i].stops":st,".turns":2}}))
# sw-quotes: 대화 1~2 × turn 2~4, sub 0·6
for m in (1,2):
    for t in (2,3,4):
        CASES.append(("sw-quotes",{"repeat":{"payload.main":m,".turns":t,"payload.sub":6}}))
# 폴백 — 배열이 짧을 때
CASES += [("da-article",{"ifs":["payload.articles[i].recalled"],"repeat":{"@da.articlePhotos":3},"noReason":True}),  # recall-none
("sw-opener",{"variant":"type-only"}),
          ("sw-opener",{"variant":"with-photo"}),
          ("contents",{"repeat":{"@toc":5},"src":{}}),
          ("back",{"src":{}}),
          ("da-article",{"src":{}}),
("contents",{"repeat":{"@toc":5}}), ("contents",{"repeat":{"@toc":2}}),
          ("note",{"repeat":{"@note.materials":4,"@note.notUsed":4,"@note.emptyCorners":3}}),
          ("da-places",{"repeat":{"@da.places":8,"payload.articles[featured].closingQuestions":3}}),
          ("da-places",{"repeat":{"@da.places":2,"payload.articles[featured].closingQuestions":3}}),
          ("tm-lead",{"repeat":{"payload.theme.signals":2}}),
          ("da-article",{"ifs":["payload.articles[i].recalled"],"repeat":{"@da.articlePhotos":2}}),
          ("da-article",{"repeat":{"@da.articlePhotos":3}})]
async def main():
    bad=[]
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); pg=await b.new_page(viewport={"width":794,"height":1123})
        for stem,cfg in CASES:
            for t in THEMES:
                await pg.goto(f"file://{R}/pages/{stem}.html", wait_until="networkidle")
                await pg.evaluate(f'document.documentElement.setAttribute("data-theme","{t}")')
                await pg.add_script_tag(content=JS); await pg.evaluate("c=>window.__resolve(c)",{**cfg,"src":SRC})
                await pg.wait_for_timeout(50)
                res=await pg.evaluate(AUDIT)
                if res: bad.append((stem,t,cfg,res))
        await b.close()
    print(f"=== sweep: {len(CASES)*len(THEMES)} 조합, {len(bad)} 건 ===")
    for stem,t,cfg,res in bad[:14]:
        print(f"\n[{stem}/{t}] {json.dumps(cfg,ensure_ascii=False)}")
        for it in res[:4]: print("   ", json.dumps(it,ensure_ascii=False)[:190])
asyncio.run(main())
