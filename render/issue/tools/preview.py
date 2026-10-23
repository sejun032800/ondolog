import sys; sys.dont_write_bytecode = True  # tools/ 에 __pycache__ 를 남기지 않는다
import asyncio, pathlib, json
from playwright.async_api import async_playwright
R = pathlib.Path(".").resolve()
OUT = pathlib.Path("./_preview"); OUT.mkdir(exist_ok=True)
JS = (pathlib.Path("./tools/resolve.js")).read_text()
THEMES = ["basic","hip","neon","lovely","night","ondol"]

SRC = {'@cover.photo': 1, '@contents.photo': 1, '@back.photo': 1, '@sw.openerPhoto': 1, '.path': 1, '.photo': 1, '.photos[0].path': 1, '.photos[1].path': 1, '.photos[2].path': 1, 'payload.articles[featured].stops[0].photos[0].path': 1, 'payload.articles[i].stops[0].photos[0].path': 1}

CFG = {
 "cover-photo":  {},
 "cover-type":   {},
 "contents":     {"repeat":{"@toc":3}},
 "note":         {"repeat":{"@note.materials":3,"@note.notUsed":2,"@note.emptyCorners":1}},
 "da-opener":    {},
 "da-timeline":  {"variant":"photos-3","ifs":[".userNotes"],"repeat":{"payload.articles[i].stops":2,".turns":2}},
 "da-places":    {"repeat":{"@da.places":5,"payload.articles[featured].closingQuestions":3}},
 "da-article":   {"ifs":["payload.articles[i].recalled"],"repeat":{"@da.articlePhotos":3}},  # 사유 있음(anniversary)
 "sw-opener":    {"variant":"with-photo"},
 "sw-quotes":    {"repeat":{"payload.main":2,".turns":3,"payload.sub":6}},
 "tm-lead":      {"repeat":{"payload.theme.signals":3}},
 "tm-articles":  {"variant":"grid-4","repeat":{"payload.articles":4}},
 "back":         {},
}

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={"width":794,"height":1123}, device_scale_factor=2)
        for stem, cfg in CFG.items():
            for t in THEMES:
                await pg.goto(f"file://{R}/pages/{stem}.html", wait_until="networkidle")
                await pg.evaluate(f'document.documentElement.setAttribute("data-theme","{t}")')
                await pg.add_script_tag(content=JS)
                await pg.evaluate("c => window.__resolve(c)", {**cfg, "src": SRC})
                await pg.wait_for_timeout(110)
                await pg.screenshot(path=str(OUT/f"{stem}__{t}.png"))
        await b.close()
    print("previews:", len(CFG)*len(THEMES))
if __name__=="__main__": asyncio.run(main())
