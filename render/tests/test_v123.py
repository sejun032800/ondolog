"""디자인 v1.2.3 반입 시험 (위임: 84-d, ROADMAP R136-1~7). 네트워크 없음. Chromium을 쓰는 시험은 `Rendered` 묶음뿐이다.

  V1  높이 표(`measure.json`)를 읽는 `heights` - 줄 수(글자 수 이상인 첫 칸 · 줄바꿈 조각 · 표 끝 너머) · 사진 아래 메모 칸 5줄
  V2  겹친 data-optional - 바깥 줄은 안의 모든 슬롯으로 판정한다(디자인 resolve.js와 같게)
  V3  D6 = R44-9: 근거가 사진인 소기사에만 그 사진 · 사진 위 한 줄은 그 구간의 AI 캡션(메모가 있으면 빈 값) · 섞인 지면 · 실린 사진으로 센다
  V4  R136-2 ②: 뒤표지 사진 = 실린 사진 중 마지막 - 이달의 우리 소기사 사진일 수 있다 · 목차 사진은 데이트 아카이브의 사진
  V5  D2 · D5 · D12(디자인이 대조 렌더로 확인하지 못한 셋) - `fixtures.edge_scenario`를 렌더해 확인
  V6  batch2(디자인 대조 권) - hero-none · 구간 캡션 · 섞인 소기사 · 재소환 줄 · AI 안내 한 줄

실행 (저장소 루트에서): render/.venv/Scripts/python.exe -B -m unittest discover -s render/tests
"""

import os
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
from compose import NOTE_AI_NOTICE, compose_issue  # noqa: E402
from facts import article_photo_view, article_stops_view  # noqa: E402
from slot_fill import fill  # noqa: E402

NAMES = [fx.A, fx.B]
TEMPLATES = r.load_templates()


def compose(scenario, materials=None):
    return compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW, 'magazine_theme': scenario['theme']}, NAMES, scenario['corners'],
                         materials if materials is not None else scenario.get('materials'))


def pages(comp, stem):
    return [p for p in comp.pages if p.stem == stem]


def soup(spec, comp):
    return BeautifulSoup(r.fill_page(spec, comp.theme, TEMPLATES), 'html.parser')


def text(spec, comp):
    return soup(spec, comp).get_text(' ', strip=True)


class Heights(unittest.TestCase):
    def test_lines_are_the_first_cell_at_or_above_the_length(self):
        t = heights.TIMELINE['memoLines']
        for i in range(1, len(t['chars'])):
            c = t['chars'][i]
            self.assertEqual(heights.table_lines(t, '가' * c), t['lines'][i])
            self.assertEqual(heights.table_lines(t, '가' * (t['chars'][i - 1] + 1)), t['lines'][i])   # 칸 사이 글자 수도 위 칸(보간 없음)

    def test_each_line_break_piece_is_counted_on_its_own(self):
        t = heights.TIMELINE['memoLines']
        self.assertEqual(heights.table_lines(t, '가\n나\n다'), 3)
        self.assertEqual(heights.table_lines(t, '가' * 10 + '\n' + '나' * 10), 2)

    def test_beyond_the_table_never_counts_fewer_lines_than_its_last_cell(self):
        for t in (heights.TIMELINE['memoLines'], heights.QUOTES['turnLines']['odd'], heights.ARTICLE['photoCaption']['3']['memoLines']):
            last_c, last_l = t['chars'][-1], t['lines'][-1]
            self.assertGreaterEqual(heights.table_lines(t, '가' * (last_c + 1)), last_l)
            self.assertGreater(heights.table_lines(t, '가' * (last_c * 2)), last_l)

    def test_photo_caption_room_holds_five_lines(self):
        # README v1.2.3 §12 - 메모 칸 22.3 + 15.2 x 줄, 쓸 수 있는 높이 104px -> 5줄까지
        for n in ('1', '2', '3'):
            spec = heights.ARTICLE['photoCaption'][n]
            table = spec['memoLines']
            five = max(c for c, l in zip(table['chars'], table['lines']) if l <= 5)
            six = min(c for c, l in zip(table['chars'], table['lines']) if l >= 6) if max(table['lines']) >= 6 else None
            self.assertTrue(heights.photo_caption_fits('가' * five, int(n)), n)
            if six is not None:
                self.assertFalse(heights.photo_caption_fits('가' * six, int(n)), n)


class NestedOptional(unittest.TestCase):
    def test_outer_row_goes_when_all_its_inner_cells_go(self):
        html = '<div><div class="row" data-optional><span data-optional><b data-slot="@a">1</b></span><span data-optional><b data-slot="@b">2</b></span></div><i>kept</i></div>'
        self.assertNotIn('row', fill(html, None, {'a': '', 'b': ''}))
        out = fill(html, None, {'a': '', 'b': 3})
        self.assertIn('row', out)
        self.assertIn('>3<', out)
        self.assertNotIn('>1<', out)
        self.assertIn('kept', fill(html, None, {'a': '', 'b': ''}))

    def test_a_branch_removed_by_if_still_does_not_count(self):
        html = '<section data-optional><div data-if="@no"><b data-slot="@a">x</b></div><b data-slot="@c">y</b></section>'
        self.assertIn('section', fill(html, None, {'no': False, 'a': '', 'c': 'y'}))


class ThisMonthPhotos(unittest.TestCase):
    """D6 = R44-9(R124-7) - 근거가 사진인 소기사에만 그 사진. README v1.2.3 §11 ②."""

    @classmethod
    def setUpClass(cls):
        cls.sc = fx.batch2_scenario()
        cls.comp = compose(cls.sc)
        cls.spec = pages(cls.comp, 'tm-articles')[0]

    def test_only_articles_with_photo_evidence_get_a_photo(self):
        arts = self.spec.corner['payload']['articles']
        self.assertEqual([a['photo'] for a in arts], ['', fx.dest('e06'), '', fx.dest('e08')])
        srcs = [i['src'] for i in soup(self.spec, self.comp).find_all('img')]
        self.assertEqual(srcs, [fx.dest('e06'), fx.dest('e08')])                 # 남는 사진으로 채우지 않는다 - 빈 틀도 없다

    def test_caption_over_the_photo_is_the_stops_ai_caption_or_nothing(self):
        arts = self.spec.corner['payload']['articles']
        self.assertEqual([a['photoAiCaption'] for a in arts], ['', '저녁을 먹은 식당', '', '서점 앞에 오래 서 있던 오후'])
        page = soup(self.spec, self.comp)
        caps = [c.get_text(' ', strip=True) for c in page.select('.art-cap')]
        self.assertEqual(caps, ['AI 캡션 저녁을 먹은 식당', 'AI 캡션 서점 앞에 오래 서 있던 오후'])
        # 사진 근거가 있어도 그 구간에 메모가 있으면 사진 위 줄은 없다(메모는 원문이라 한 줄 칸에 싣지 않는다)
        sc = fx.batch2_scenario()
        sc['corners'][2]['content']['payload']['articles'][3]['evidence'] = [fx.ev_photo('e09')]   # 서울숲 구간 - 메모 있음
        arts2 = pages(compose(sc), 'tm-articles')[0].corner['payload']['articles']
        self.assertEqual((arts2[3]['photo'], arts2[3]['photoAiCaption']), (fx.dest('e09'), ''))

    def test_mixed_page_keeps_the_grid_and_the_ai_caption_is_an_ondolog_sentence(self):
        html = r.fill_page(self.spec, self.comp.theme, TEMPLATES)
        self.assertIn('data-variant="grid-4"', html)
        self.assertEqual(len(BeautifulSoup(html, 'html.parser').select('.art-num')), 4)   # 사진 없는 칸은 큰 순번 숫자가 받는다(CSS)
        self.assertTrue(any(s['source'] == 'this_month.article.photoAiCaption' and s['who'] == 'ondolog' for s in self.comp.sentences))

    def test_tm_photos_are_printed_photos_in_the_note(self):
        f = self.comp.report['facts']
        self.assertEqual(f['thisMonthPhotos'], 2)
        self.assertIn(fx.dest('e06'), self.comp.shown_photos)


class BackAndContentsPhoto(unittest.TestCase):
    def test_back_cover_photo_can_be_a_this_month_photo(self):
        comp = compose(fx.many_photos_scenario(), {'messages': 120, 'photos': 20, 'dates': 3, 'memos': 4})
        self.assertEqual(comp.shown_photos[-1], fx.dest('e12'))                 # 이달의 우리 소기사 사진(데이트 아카이브에 없는 사진)
        self.assertEqual(comp.report['backPhoto'], fx.dest('e12'))              # R136-2 ② - 정의 '실린 사진 중 마지막' 그대로
        self.assertNotEqual(comp.report['contentsPhoto'], fx.dest('e12'))       # 목차 사진은 데이트 아카이브에 실린 사진 중 첫 사진(README §2)

    def test_an_issue_with_only_this_month_still_fetches_its_photo(self):
        sc = fx.photo_scenario()
        comp = compose_issue(fx.ISSUE_ROW, fx.COUPLE_ROW, NAMES, [sc['corners'][2]], None)
        self.assertEqual(comp.shown_photos, [fx.dest('e12')])


class Edge(unittest.TestCase):
    """디자인이 대조 렌더로 확인하지 못한 셋(README §10 ③) - D2 '싣지 않은 것' 줄 · D5 메모 넘침 · D12 표지 두 줄."""

    @classmethod
    def setUpClass(cls):
        cls.sc = fx.edge_scenario()
        cls.comp = compose(cls.sc)
        cls.note = pages(cls.comp, 'note')[0].computed['note']
        cls.articles = cls.sc['corners'][0]['content']['payload']['articles']

    def test_d2_stops_beyond_the_hero_none_page_are_listed_as_not_printed(self):
        shown, dropped = article_stops_view(self.articles[2])
        self.assertEqual(len(shown) + len(dropped), 6)
        self.assertGreater(len(dropped), 0)
        spec = pages(self.comp, 'da-article')[1]
        self.assertEqual([s['time'] for s in spec.computed['da']['articleStops']], [s['time'] for s in shown])
        used = sum(heights.article_stop_height(v['userNotes'][0]['text'] if v['userNotes'] else None, v['aiCaption'], v['placeName']) for v in shown)
        self.assertLessEqual(used, heights.ARTICLE_STOPS_CAPACITY)
        memos = sum(1 for s in dropped for n in s['userNotes'] if n.get('type') == 'memo')
        self.assertIn(f'구간 {len(dropped)}곳(메모 {memos}개) — 글만 있는 기사 한 면에 들어가지 않았습니다', self.note['notUsed'])
        page_text = text(spec, self.comp)
        for s in dropped:
            for n in s['userNotes']:
                self.assertNotIn(n['text'].split('\n')[0], page_text)            # 싣지 못한 구간의 메모는 지면에 없다(잘라 싣지 않는다)

    def test_d5_a_memo_too_tall_for_the_photo_caption_is_left_out_whole(self):
        photos, overflow = article_photo_view(self.articles[1])
        self.assertEqual(overflow, 1)
        self.assertEqual([p['caption'] for p in photos], ['서점 앞에서 오래 서 있었다.', '', ''])
        self.assertFalse(heights.photo_caption_fits(fx.EDGE_LONG_PHOTO_MEMO, 3))
        page_text = text(pages(self.comp, 'da-article')[0], self.comp)
        self.assertNotIn(fx.EDGE_LONG_PHOTO_MEMO[:20], page_text)                 # 잘라 싣지 않는다
        self.assertIn('메모 1개 — 사진 아래 칸에 들어가지 않아 줄이지 않고 뺐습니다', self.note['notUsed'])

    def test_note_still_balances(self):
        rows = {r_['key']: r_ for r_ in self.comp.report['facts']['noteRows']}
        for key, row in rows.items():
            self.assertEqual(row['collected'] - row['used'], row['notUsed'], key)


class Rendered(unittest.TestCase):
    """실제 Chromium - D12 표지 두 줄 · batch2 · 가장자리 권이 지면 검사를 통과한다."""

    def render(self, sc):
        comp = compose(sc)
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'
            r.prepare_work(work)
            cover = r.settle_cover(comp, TEMPLATES, work)
            files = r.build_pages(comp, TEMPLATES, work, fx.ISSUE_ROW, lambda dest: fx.png(300, 400))
            results = r.render_pages(files)
        return comp, cover, r.audit_summary(comp, results, fx.ISSUE)

    def test_d12_cover_quote_over_two_lines_is_removed_as_a_row(self):
        comp, cover, audit = self.render(fx.edge_scenario())
        self.assertTrue(cover['quoteRemoved'])
        self.assertTrue(any(x.startswith('lines:') and int(x.split(':')[1]) > 2 for x in cover['reasons']), cover)
        self.assertEqual(comp.pages[0].computed['cover']['quote'], '')
        quotes = ' '.join(text(s, comp) for s in pages(comp, 'sw-quotes'))
        self.assertIn(fx.EDGE_COVER_QUOTE, quotes)                                # 원문은 인용면에 그대로(자르지 않는다)
        self.assertIsNone(r.gate_failure(audit, fx.ISSUE))
        self.assertEqual(audit['totals'].get('safe', 0), 0)

    def test_a_short_cover_quote_stays(self):
        comp, cover, _ = self.render(fx.photo_scenario())
        self.assertFalse(cover['quoteRemoved'])
        self.assertTrue(comp.pages[0].computed['cover']['quote'])

    def test_batch2_passes_the_page_checks(self):
        comp, cover, audit = self.render(fx.batch2_scenario())
        self.assertIsNone(r.gate_failure(audit, fx.ISSUE))
        self.assertEqual(audit['originalClipped'], [])
        self.assertTrue(audit['designAuditSame'])
        self.assertEqual(audit['totals'].get('safe', 0), 0)                       # v1.2.3 - 판면 밖 글자 0
        note = pages(comp, 'note')[0]
        self.assertIn(NOTE_AI_NOTICE, text(note, comp))
        self.assertIn('그때 그 시절 · 지난 기록에서 다시 실은 사진 1장', text(note, comp))
        variants = [s.find(attrs={'data-variant': True})['data-variant'] for s in (soup(p, comp) for p in pages(comp, 'da-article'))]
        self.assertEqual(variants, ['hero-photo', 'hero-none', 'hero-photo'])


if __name__ == '__main__':
    unittest.main()
