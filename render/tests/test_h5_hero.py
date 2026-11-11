"""데이트 기사 대표 사진 대체 · 사진 없는 기사 빼기 시험 (위임: 74-h5, ROADMAP R84-1 ~ R84-4). 네트워크 없음.

  ① 기사의 히어로 = 구간을 순서대로 보다가 사진이 있는 첫 구간의 첫 사진. 순서는 content의 구간 순서(seq) 그대로다 -
     앱이 seq를 도착 시각(날짜 포함) 순으로 매긴다(`src/services/dateRecordApi.ts` `resequenceStops`). `HH:mm` 글자로 다시 정렬하지 않는다.
  ② 사진이 하나도 없는 데이트는 기사에서 뺀다(임시 규칙, 디자인 v1.2.3 전). 목차 · 타임라인 · 합계는 실린 기사만 센다.
     대표 기사(featured)는 빼지 않는다 - 사진 없는 대표 기사는 기존 type-only 오프너(README §10)로 실린다.
  ③ 기사 하나 때문에 호 전체를 멈추지 않는다.

실행 (저장소 루트에서): render/.venv/Scripts/python.exe -B -m unittest discover -s render/tests
"""

import os
import re
import sys
import unittest

sys.dont_write_bytecode = True
HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, '..'))
sys.path.insert(0, HERE)

import fixtures as fx  # noqa: E402
import render_issue as r  # noqa: E402
from compose import compose_issue  # noqa: E402
from facts import hero_photo_path  # noqa: E402

NAMES = [fx.A, fx.B]
TEMPLATES = r.load_templates()
ROOMY = {'messages': 1000, 'photos': 1000, 'dates': 100, 'memos': 100}


def compose(articles, materials=None, theme='basic'):
    da = fx.date_archive(articles)
    corners = [fx.corner_row('date_archive', da, seq=1), fx.corner_row('this_month', fx.standard_this_month(da), seq=3)]
    return compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW, 'magazine_theme': theme}, NAMES, corners, materials or ROOMY)


def pages(comp, stem):
    return [p for p in comp.pages if p.stem == stem]


def hero_src(comp, nth=0):
    html = r.fill_page(pages(comp, 'da-article')[nth], comp.theme, TEMPLATES)
    srcs = re.findall(r' src="([^"]+)"', html)
    return srcs[0] if srcs else None


def featured(stops=None):
    return fx.article('2026-09-12', '대표', '연남동', stops or [fx.stop(0, '10:00', 'A', [fx.photo('a0')], [], '캡션')], featured=True)


def second(stops, **kw):
    return fx.article('2026-09-21', '둘째 기사', '성수동', stops, **kw)


class Hero(unittest.TestCase):
    def test_first_stop_without_photos_uses_the_first_photo_of_the_next_stop_with_photos(self):
        art = second([fx.stop(0, '14:20', 'B', [], [], '캡션'), fx.stop(1, '16:20', 'C', [fx.photo('c0'), fx.photo('c1')], [], '캡션')])
        comp = compose([featured(), art])
        self.assertEqual(len(pages(comp, 'da-article')), 1)
        self.assertTrue(hero_src(comp).endswith('c0.png'))
        self.assertIn(fx.dest('c0'), comp.shown_photos)
        self.assertEqual(comp.report['heroFallbackArticles'], 1)
        self.assertEqual(comp.report['droppedArticles'], 0)
        # 기사 칸의 숫자는 그대로 - 구간은 둘, 사진은 둘
        da = pages(comp, 'da-article')[0].computed['da']
        self.assertEqual((da['articleStopCount'], da['articlePhotoCount']), (2, 2))
        self.assertEqual(da['articleRoute'], 'B → C')

    def test_one_stop_is_as_before(self):
        comp = compose([featured(), second([fx.stop(0, '13:00', 'B', [fx.photo('b0'), fx.photo('b1')], [], '캡션')])])
        self.assertTrue(hero_src(comp).endswith('b0.png'))
        self.assertEqual((comp.report['heroFallbackArticles'], comp.report['droppedArticles']), (0, 0))

    def test_stops_without_time_follow_the_stop_order(self):
        art = second([fx.stop(0, '', 'B', [], [], '캡션'), fx.stop(1, '', 'C', [fx.photo('c0')], [], '캡션'), fx.stop(2, '', 'D', [fx.photo('d0')], [], '캡션')])
        self.assertEqual(hero_photo_path(art), fx.dest('c0'))
        self.assertTrue(hero_src(compose([featured(), art])).endswith('c0.png'))

    def test_clock_text_is_not_re_sorted_past_midnight(self):
        # seq는 도착 시각(날짜 포함) 순이다 - 23:50 다음의 00:30은 다음 날이다. `HH:mm`로 다시 줄 세우면 00:30이 앞서 버린다
        art = second([fx.stop(0, '23:10', 'B', [], [], '캡션'), fx.stop(1, '23:50', 'C', [fx.photo('c0')], [], '캡션'),
                      fx.stop(2, '00:30', 'D', [fx.photo('d0')], [], '캡션')])
        self.assertEqual(hero_photo_path(art), fx.dest('c0'))

    def test_recalled_article_follows_the_same_rule(self):
        art = second([fx.stop(0, '12:00', 'B', [], [], '캡션'), fx.stop(1, '13:00', 'C', [fx.photo('c0')], [], '캡션')],
                     recalled=True, reason='anniversary')
        comp = compose([featured(), art])
        self.assertTrue(hero_src(comp).endswith('c0.png'))
        self.assertEqual(comp.report['facts']['articlesRecalled'], 1)
        self.assertEqual(comp.report['facts']['photosShownRecalled'], 1)

    def test_featured_article_opener_uses_the_same_chain(self):
        feat = featured([fx.stop(0, '14:20', 'A', [], [fx.memo('메모')], None), fx.stop(1, '16:20', 'B', [fx.photo('f1')], [], '캡션')])
        comp = compose([feat, second([fx.stop(0, '13:00', 'C', [fx.photo('c0')], [], '캡션')])])
        self.assertEqual(pages(comp, 'da-opener')[0].computed['da']['openerPhoto'], fx.dest('f1'))
        self.assertEqual(comp.report['heroFallbackArticles'], 1)

    def test_report_has_numbers_only(self):
        art = second([fx.stop(0, '14:20', 'B', [], [], '캡션'), fx.stop(1, '16:20', 'C', [fx.photo('c0')], [], '캡션')])
        comp = compose([featured(), art, fx.article('2026-09-25', '셋째', '망원동', [fx.stop(0, '11:00', 'D', [], [], '캡션')])])
        self.assertIs(type(comp.report['heroFallbackArticles']), int)
        self.assertIs(type(comp.report['droppedArticles']), int)
        for d in comp.report['decisions']:
            self.assertNotRegex(d, r'\d{4}-\d{2}-\d{2}|\d{4}\.\d{2}\.\d{2}')
            self.assertNotIn(fx.ISSUE, d)


class DropPhotoless(unittest.TestCase):
    def test_a_date_without_photos_is_left_out_of_the_pages_toc_and_totals(self):
        empty = fx.article('2026-09-25', '사진 없는 날', '망원동', [fx.stop(0, '11:00', '망원시장', [], [fx.memo('사진은 없다')], None)])
        keep = second([fx.stop(0, '13:00', 'B', [fx.photo('b0')], [], '캡션')])
        base = compose([featured(), keep])
        comp = compose([featured(), keep, empty])
        self.assertEqual(comp.report['droppedArticles'], 1)
        self.assertEqual([p.stem for p in comp.pages], [p.stem for p in base.pages])
        self.assertEqual(len(pages(comp, 'da-article')), 1)
        self.assertEqual(comp.report['toc'], base.report['toc'])                     # 목차 '하루 2편' - 뺀 기사는 세지 않는다
        self.assertIn('하루 2편', comp.report['toc'][0]['desc'])
        self.assertEqual(comp.report['facts'], base.report['facts'])                 # 경로 · 장소 · 합계 모두 실린 기사만
        self.assertNotIn('망원시장', [p['placeName'] for p in pages(comp, 'da-places')[0].computed['da']['places']])
        self.assertEqual(comp.shown_photos, base.shown_photos)

    def test_left_out_memos_are_counted_as_not_used_in_the_note(self):
        empty = fx.article('2026-09-25', '사진 없는 날', '망원동', [fx.stop(0, '11:00', '망원시장', [], [fx.memo('사진은 없다')], None)])
        comp = compose([featured(), second([fx.stop(0, '13:00', 'B', [fx.photo('b0')], [], '캡션')]), empty],
                       materials={'messages': 0, 'photos': 2, 'dates': 3, 'memos': 1})
        rows = {row['key']: row for row in comp.report['facts']['noteRows']}
        self.assertEqual((rows['dates']['used'], rows['dates']['notUsed']), (2, 1))   # 기사로 고르지 않은 날 1번
        self.assertEqual((rows['memos']['used'], rows['memos']['notUsed']), (0, 1))

    def test_photoless_recalled_article_is_left_out_too(self):
        old = fx.article('2025-09-20', '재소환', '합정동', [fx.stop(0, '12:00', 'R', [], [], '캡션')], recalled=True, reason='anniversary')
        comp = compose([featured(), old])
        self.assertEqual(comp.report['droppedArticles'], 1)
        self.assertEqual(comp.report['facts']['articlesRecalled'], 0)
        self.assertNotIn('그때 그 시절', comp.report['toc'][0]['desc'])

    def test_featured_article_without_photos_stays_with_the_type_only_opener(self):
        feat = featured([fx.stop(0, '14:20', 'A', [], [fx.memo('메모')], None)])
        empty = second([fx.stop(0, '13:00', 'B', [], [], '캡션')])
        comp = compose([feat, empty])
        self.assertEqual(comp.report['droppedArticles'], 1)                           # 대표가 아닌 사진 없는 기사만 빠진다
        self.assertEqual(len(pages(comp, 'da-opener')), 1)
        self.assertEqual(pages(comp, 'da-opener')[0].computed['da']['openerPhoto'], '')
        self.assertEqual(len(pages(comp, 'da-article')), 0)
        self.assertIn('하루 1편', comp.report['toc'][0]['desc'])

    def test_featured_index_follows_the_kept_articles(self):
        empty = fx.article('2026-09-05', '앞선 빈 날', '망원동', [fx.stop(0, '11:00', 'X', [], [], '캡션')])
        feat = featured([fx.stop(0, '10:00', 'A', [fx.photo('a0')], [], '캡션')])
        keep = second([fx.stop(0, '13:00', 'B', [fx.photo('b0')], [], '캡션')])
        comp = compose([empty, feat, keep])
        self.assertEqual(comp.report['droppedArticles'], 1)
        self.assertEqual(pages(comp, 'da-opener')[0].computed['da']['openerPhoto'], fx.dest('a0'))
        self.assertTrue(hero_src(comp).endswith('b0.png'))
        self.assertEqual(pages(comp, 'da-article')[0].computed['da']['articleNo'], '02')   # 실린 기사 순번


class SeedRegression(unittest.TestCase):
    """기존 시드 모양은 바뀌지 않는다 - 빠지는 기사 0, 지면 순서 · 쪽 수는 아래 고정값 그대로 (74-h5 전 스냅샷)."""
    PAGE_COUNTS = {'long_original_scenario': 15, 'many_photos_scenario': 14, 'opener_fallback_scenario': 12, 'opener_type_only_scenario': 12,
                   'photo_scenario': 14, 'skipped_scenario': 12, 'timeline_overflow_scenario': 13, 'type_scenario': 15}

    def test_seed_scenarios_keep_their_pages(self):
        for name, n in self.PAGE_COUNTS.items():
            sc = getattr(fx, name)()
            comp = compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW, 'magazine_theme': sc['theme']}, NAMES, sc['corners'], ROOMY)
            with self.subTest(name=name):
                self.assertEqual(len(comp.pages), n)
                self.assertEqual(comp.report['droppedArticles'], 0)


if __name__ == '__main__':
    unittest.main()
