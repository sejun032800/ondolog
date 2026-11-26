import sys; sys.dont_write_bytecode = True  # tools/ 에 __pycache__ 를 남기지 않는다
import asyncio, pathlib, json
from playwright.async_api import async_playwright
R = pathlib.Path(".").resolve()
OUT = pathlib.Path("./_preview"); OUT.mkdir(exist_ok=True)
JS = (pathlib.Path("./tools/resolve.js")).read_text()
THEMES = ["basic","hip","neon","lovely","night","ondol"]

SRC = {'@cover.photo': 1, '@contents.photo': 1, '@back.photo': 1, '@sw.openerPhoto': 1, '@da.articleHero': 1, '.photo': 1, '.path': 1, '.photos[0].path': 1, '.photos[1].path': 1, '.photos[2].path': 1, 'payload.articles[featured].stops[0].photos[0].path': 1, 'payload.articles[i].stops[0].photos[0].path': 1}

CFG = {
 "cover-photo":  {},
 "cover-type":   {},
 "contents":     {"repeat":{"@toc":3}},
 "note":         {"width":{"@note.ratioPeopleWidth":34,"@note.ratioOndologWidth":66},"text":{"@note.ratioPeople":"34%","@note.ratioOndolog":"66%","@note.sentencesPeople":"25개","@note.sentencesOndolog":"49개"},"repeat":{"@note.materials":3,"@note.notUsed":2,"@note.emptyCorners":1}},
 "da-opener":    {"variant":"with-photo"},
 "da-timeline":  {"variant":"photos-3","ifs":[".userNotes"],"repeat":{"payload.articles[i].stops":2,".turns":2}},
 "da-places":    {"repeat":{"@da.places":5,"payload.articles[featured].closingQuestions":3}},
 "da-article":   {"variant":"hero-photo","ifs":["payload.articles[i].recalled"],"repeat":{"@da.articlePhotos":3}},  # 사유 있음(anniversary). hero-none은 sweep.py
 "sw-opener":    {"variant":"with-photo"},
 "sw-quotes":    {"repeat":{"payload.main":2,".turns":3,"payload.sub":6}},
 "tm-lead":      {"repeat":{"payload.theme.signals":3}},
 "tm-articles":  {"variant":"grid-4","repeat":{"payload.articles":4}},  # 사진 없음이 지금의 기본(R44)
 "back":         {},
 # ── v2.0.0 매거진 2.0 새 지면 (묶음 5). 한 지면에 변형 묶음이 여럿이면 "variants" 배열(resolve.js v2.0.0)
 "dna-figure":   {"variants":["delta","chat"],"repeat":{"payload.partners":2,"payload.strengths":3,"payload.complements":3}},
 "dna-axes":     {"repeat":{"payload.actionTips":2},"width":{"payload.partners[0].bigFive.o": 62, "payload.partners[1].bigFive.o": 48, "payload.partners[0].bigFive.c": 71, "payload.partners[1].bigFive.c": 40, "payload.partners[0].bigFive.e": 35, "payload.partners[1].bigFive.e": 66, "payload.partners[0].bigFive.a": 58, "payload.partners[1].bigFive.a": 58, "payload.partners[0].bigFive.n": 44, "payload.partners[1].bigFive.n": 52, "payload.sternbergOverlap.intimacy.a": 70, "payload.sternbergOverlap.intimacy.b": 64, "payload.sternbergOverlap.passion.a": 52, "payload.sternbergOverlap.passion.b": 61, "payload.sternbergOverlap.commitment.a": 80, "payload.sternbergOverlap.commitment.b": 80}},
 "rough-guess":  {"repeat":{"payload.estimates":3},"ifs":[],"width":{"payload.measured.talkFirst.a.percent":58,"payload.measured.emoji.a.percent":36}},
 "league-board": {"repeat":{"payload.weeklyCards":4},"width":{"payload.current.cards[0].stats.pus": 61, "payload.current.cards[0].stats.emp": 72, "payload.current.cards[0].stats.att": 40, "payload.current.cards[0].stats.def": 70, "payload.current.cards[0].stats.tac": 55, "payload.current.cards[0].stats.rea": 80, "payload.current.cards[1].stats.pus": 48, "payload.current.cards[1].stats.emp": 77, "payload.current.cards[1].stats.att": 58, "payload.current.cards[1].stats.def": 62, "payload.current.cards[1].stats.tac": 66, "payload.current.cards[1].stats.rea": 71}},
 "league-report":{"repeat":{"payload.matchReport.items":11,"payload.statChanges":2,".evidence":2,"payload.statBreakdown":6},"ifs":[".measured"]},
 "setlog":       {"variant":"two","repeat":{"payload.columns":2,".entries":3},"src":{".photo.path":1}},
 "interview":    {"repeat":{"payload.rounds":1,".questions":3,".answers":2}},
 "guest":        {"repeat":{"payload.questions":3,"payload.responses":4}},
 "over-shoulder":{"repeat":{"payload.cells":6}},
 "sponsored":    {"variant":"with-image","src":{"payload.image.path":1}},
 "appendix-calendar":{"keep":["@calendar.weeks",".days"]},
 "appendix-postcard":{"repeat":{"@appendix.postcards":2},"src":{".path":1}},
 "photo-break":  {"variant":"land","src":{"payload.photo.path":1}},
 "next":         {"repeat":{"payload.milestones":2,"payload.openingCorners":1}},
 "colophon":     {"repeat":{"payload.errata":1}},
 "contents-long":{"page":"contents","variant":"long","keep":["@toc"]},
 "note-grid":    {"page":"note","variant":"grid","keep":["@note.materials","@note.emptyCorners"],"repeat":{"@note.notUsed":2},"width":{"@note.ratioPeopleWidth":34,"@note.ratioOndologWidth":66}},

}

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={"width":794,"height":1123}, device_scale_factor=2)
        for stem, cfg in CFG.items():
            for t in THEMES:
                await pg.goto(f"file://{R}/pages/{cfg.get('page',stem)}.html", wait_until="networkidle")
                await pg.evaluate(f'document.documentElement.setAttribute("data-theme","{t}")')
                await pg.add_script_tag(content=JS)
                await pg.evaluate("c => window.__resolve(c)", {**cfg, "src": SRC})
                await pg.wait_for_timeout(110)
                await pg.screenshot(path=str(OUT/f"{stem}__{t}.png"))
        await b.close()
    print("previews:", len(CFG)*len(THEMES))
if __name__=="__main__": asyncio.run(main())
