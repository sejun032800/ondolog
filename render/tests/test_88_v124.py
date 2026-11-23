"""디자인 v1.2.4 반입 시험 (위임: 88-, ROADMAP r149 R149-4 · R149-5 · R149-7). 네트워크 없음. Chromium을 쓰는 시험은 `Rendered` 묶음뿐이다.

  W1  R149-5 높이 여유 설정(`heights.LINE_COLUMN`) - 칸 이름이 `measure.json`에 모두 있고, 고른 열(여유 있음 `lines` / 여유 없음 `sampledLines`)을 읽는다
  W2  E2 - 발행 노트 막대 간격은 틀(`gap:.35em`)이 맡는다: 렌더러가 덧붙이는 CSS 0 · 비율 글자에 공백 0(두 번 띄워지지 않는다)
  W3  E3 - 표지 `@cover.headlineBy`(README §11 ⑭): 표제가 이 달의 말이면 인용 줄 빈 값 + 말한 사람 줄, 아니면 말한 사람 줄 빈 값(사진 · 활자 표지)
  W4  E5 - `fixtures.batch4_scenario`(메모 0 · 지역 0 · 이달의 우리 없음 · 긴 제목) - 0인 조각(§11 ⑬) · 표지 · 렌더 통과

실행 (저장소 루트에서): render/.venv/Scripts/python.exe -B -m unittest discover -s render/tests
"""

import os
import re
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, '..'))
sys.path.insert(0, HERE)

from bs4 import BeautifulSoup  # noqa: E402

import fixtures as fx  # noqa: E402
import heights  # noqa: E402
import render_issue as r  # noqa: E402
from compose import compose_issue  # noqa: E402

NAMES = [fx.A, fx.B]
TEMPLATES = r.load_templates()
TABLE_NAMES = ('timeline.memoLines', 'timeline.captionLines', 'timeline.placeLines', 'quotes.turnLines.odd', 'quotes.turnLines.even',
               'quotes.contextLines', 'article.stopMemoLines', 'article.photoCaption.1.memoLines', 'article.photoCaption.2.memoLines',
               'article.photoCaption.3.memoLines')


def compose(scenario):
    return compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW, 'magazine_theme': scenario['theme']}, NAMES, scenario['corners'], scenario.get('materials'))


def node(path):
    n = heights.MEASURE
    for k in path.split('.'):
        n = n[k]
    return n


def page_text(comp, stem, theme=None):
    spec = next(p for p in comp.pages if p.stem == stem)
    html = r.fill_page(spec, theme or comp.theme, TEMPLATES)
    return BeautifulSoup(html, 'html.parser').get_text(' ', strip=True), html


class SafetyLines(unittest.TestCase):
    def test_every_configured_table_exists_with_both_columns(self):
        self.assertEqual(set(heights.LINE_COLUMN), set(TABLE_NAMES))   # R149-5의 아홉 칸(사진 아래 메모는 사진 수별 표 셋)
        for name, col in heights.LINE_COLUMN.items():
            self.assertIn(col, ('lines', 'sampledLines'), name)
            t = node(name)
            self.assertEqual(len(t['lines']), len(t['chars']), name)
            self.assertEqual(len(t['sampledLines']), len(t['chars']), name)

    def test_reads_the_chosen_column(self):
        name = 'timeline.memoLines'
        saved = heights.LINE_COLUMN[name]
        try:
            for col in ('lines', 'sampledLines'):
                heights.LINE_COLUMN[name] = col
                self.assertEqual(heights.line_table(name)['lines'], node(name)[col])
                self.assertEqual(heights.line_table(name)['chars'], node(name)['chars'])
        finally:
            heights.LINE_COLUMN[name] = saved

    def test_loaded_tables_follow_the_setting(self):
        # 88- 판정: 아홉 칸 모두 여유를 남김 -> 렌더러가 쓰는 표는 `lines` 열
        pairs = [(heights.TL_MEMO, 'timeline.memoLines'), (heights.TL_CAPTION, 'timeline.captionLines'), (heights.TL_PLACE, 'timeline.placeLines'),
                 (heights.Q_TURN['odd'], 'quotes.turnLines.odd'), (heights.Q_TURN['even'], 'quotes.turnLines.even'),
                 (heights.Q_CONTEXT, 'quotes.contextLines'), (heights.ART_STOP_MEMO, 'article.stopMemoLines')] + \
                [(heights.ART_PHOTO_MEMO[n], f'article.photoCaption.{n}.memoLines') for n in ('1', '2', '3')]
        for table, name in pairs:
            self.assertEqual(table['lines'], node(name)[heights.LINE_COLUMN[name]], name)

    def test_unknown_table_is_an_error(self):
        with self.assertRaises(KeyError):
            heights.line_table('timeline.nope')


class NoteBarSpacing(unittest.TestCase):
    def test_work_copy_is_the_template_as_is(self):
        with tempfile.TemporaryDirectory() as d:
            work = Path(d) / 'work'
            r.prepare_work(work)
            self.assertEqual((work / 'base.css').read_bytes(), (r.ISSUE_DIR / 'base.css').read_bytes())
        self.assertFalse(hasattr(r, 'DEV_TEMP_CSS_84G'))
        self.assertIn('word-break:keep-all', (r.ISSUE_DIR / 'base.css').read_text(encoding='utf-8'))

    def test_template_gap_and_no_space_in_data(self):
        self.assertEqual(TEMPLATES['note'].count('gap:.35em'), 2)
        comp = compose(fx.photo_scenario())
        note = next(p for p in comp.pages if p.stem == 'note').computed['note']
        for key in ('ratioPeople', 'ratioOndolog'):
            self.assertRegex(note[key], r'^\d+%$')          # 앞뒤 공백 0 - 간격은 틀이 맡는다
        _, html = page_text(comp, 'note')
        self.assertNotIn('margin-left:.3em', html)
        self.assertRegex(html, r'두 사람\s*<span[^>]*data-slot="@note\.ratioPeople"[^>]*>\d+%</span>')


class CoverHeadlineBy(unittest.TestCase):
    def quote_headline(self, theme, short_side):
        sc = fx.photo_scenario(theme, short_side=short_side)
        tm = __import__('copy').deepcopy(sc['corners'][2]['content'])
        tm['payload']['theme']['headline'] = '아주아주긴단어가있는제목'      # 3줄 · 6자로 못 나눔 -> 표제 = 이 달의 말
        sc['corners'][2] = fx.corner_row('this_month', tm, seq=3)
        return compose(sc)

    def test_headline_from_quote_photo_and_type(self):
        for theme, short_side, stem in (('basic', 1200, 'cover-photo'), ('neon', 900, 'cover-type')):
            comp = self.quote_headline(theme, short_side)
            self.assertEqual(comp.pages[0].stem, stem)
            self.assertEqual(comp.report['coverHeadlineFrom'], 'quote')
            cover = comp.pages[0].computed['cover']
            self.assertEqual(cover['headline'], '오늘 비 온대. 우산 챙겼어?')
            self.assertEqual((cover['quote'], cover['quoteBy']), ('', ''))   # 같은 문장을 두 번 싣지 않는다
            self.assertEqual(cover['headlineBy'], fx.A)
            text, html = page_text(comp, stem, theme)
            self.assertIn(f'이 달의 말 · {fx.A}', text)
            self.assertEqual(text.count('오늘 비 온대. 우산 챙겼어?'), 1, stem)

    def test_headline_from_this_month_photo_and_type(self):
        for sc, stem in ((fx.photo_scenario('basic'), 'cover-photo'), (fx.type_scenario('neon'), 'cover-type')):
            comp = compose(sc)
            self.assertEqual(comp.pages[0].stem, stem)
            self.assertEqual(comp.report['coverHeadlineFrom'], 'theme.headline')
            cover = comp.pages[0].computed['cover']
            self.assertEqual(cover['headlineBy'], '')
            self.assertEqual(cover['quote'], '오늘 비 온대. 우산 챙겼어?')
            self.assertEqual(cover['quoteBy'], fx.A)
            _, html = page_text(comp, stem, sc['theme'])
            self.assertNotIn('data-slot="@cover.headlineBy"', html)          # 줄째 빠짐(data-optional)


class Batch4(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.comp = compose(fx.batch4_scenario())

    def test_zero_fragments(self):
        opener = next(p for p in self.comp.pages if p.stem == 'da-opener').computed['da']
        self.assertNotIn('메모', opener['lead'])
        self.assertNotIn(' 0', opener['lead'])
        self.assertRegex(opener['lead'], r'^9월에 두 사람이 함께 보낸 날은 2번이었습니다\. \d+곳을 거치며 남긴 \d+장의 사진을 그대로 실었습니다\.$')
        self.assertEqual(opener['records'], '남긴 기록 · AI 캡션 2')       # 메모 0 조각 없음(대표 기사 AI 캡션 2)
        places = next(p for p in self.comp.pages if p.stem == 'da-places').computed['da']
        self.assertRegex(places['routeSummary'], r'^\d+개 장소$')       # 지역 0 -> 조각째 없음
        _, html = page_text(self.comp, 'note')
        self.assertNotIn('(사진 0장)', html)
        self.assertNotIn('메모 0', html)

    def test_cover_and_long_title(self):
        self.assertEqual(self.comp.report['coverHeadlineFrom'], 'quote')    # 이달의 우리 없음 -> 표제 = 이 달의 말
        cover = self.comp.pages[0].computed['cover']
        self.assertEqual((cover['quote'], cover['headlineBy']), ('', fx.A))
        self.assertFalse([p for p in self.comp.pages if p.stem in ('tm-lead', 'tm-articles')])   # 이달의 우리 지면 0
        text, _ = page_text(self.comp, 'da-opener')
        self.assertIn(fx.BATCH4_LONG_TITLE.split()[0], text)


class Rendered(unittest.TestCase):
    """실제 Chromium - batch4 권 지면 검사 통과 · 표제가 잘려 되돌릴 때 인용 줄이 돌아오고 말한 사람 줄은 빠진다."""

    def test_batch4_renders_clean(self):
        comp = compose(fx.batch4_scenario())
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'
            r.prepare_work(work)
            r.settle_cover(comp, TEMPLATES, work)
            files = r.build_pages(comp, TEMPLATES, work, fx.ISSUE_ROW, lambda dest: fx.png(300, 400))
            results = r.render_pages(files)
        audit = r.audit_summary(comp, results, fx.ISSUE)
        self.assertIsNone(r.gate_failure(audit, fx.ISSUE))
        self.assertEqual(audit['totals'].get('safe', 0), 0)

    def test_reverted_headline_brings_back_the_quote_row(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'
            sc = fx.type_scenario('neon')
            tm = __import__('copy').deepcopy(sc['corners'][2]['content'])
            tm['payload']['theme']['headline'] = '아주아주긴단어가있는제목'
            sc['corners'][2] = fx.corner_row('this_month', tm, seq=3)
            sw = __import__('copy').deepcopy(sc['corners'][1]['content'])
            quote = '오늘은 비가 온다고 했으니 우산을 꼭 챙겨서 나가자 알겠지? 약속이야'
            sw['payload']['main'][0]['turns'][0]['text'] = quote
            sc['corners'][1] = fx.corner_row('sweet_words', sw, seq=2)
            comp = compose(sc)
            self.assertEqual(comp.pages[0].computed['cover']['headlineBy'], fx.A)
            r.prepare_work(work)
            outcome = r.settle_cover(comp, TEMPLATES, work)
            self.assertTrue(outcome['headlineReverted'])
            cover = comp.pages[0].computed['cover']
            self.assertEqual(cover['headline'], '아주아주긴단어가있는제목')
            self.assertEqual(cover['headlineBy'], '')
            if not outcome['quoteRemoved']:
                self.assertEqual((cover['quote'], cover['quoteBy']), (quote, fx.A))


if __name__ == '__main__':
    unittest.main()
