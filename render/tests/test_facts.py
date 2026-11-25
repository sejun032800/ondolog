"""호의 사실 시험 (위임: 55-3b, ROADMAP R50-2~R50-8). 네트워크 · 브라우저 없음 - 지면 HTML 채움까지만 본다.

숫자는 하드코딩하지 않는다: 기대값은 시험 재료(코너 content)에서 시험이 따로 세거나, 채운 지면에서 읽어 오는 값이다.

실행 (저장소 루트에서): render/.venv/Scripts/python.exe -B -m unittest discover -s render/tests
"""

import copy
import os
import re
import sys
import unittest

sys.dont_write_bytecode = True
HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, '..'))
sys.path.insert(0, HERE)

from bs4 import BeautifulSoup  # noqa: E402

import fixtures as fx  # noqa: E402
import local_volumes as lv  # noqa: E402
import render_issue as r  # noqa: E402
from compose import ComposeError, compose_issue, quote_display  # noqa: E402
from facts import UNNAMED_PLACE, FactsError, article_photos, build_facts, ratio_label  # noqa: E402

NAMES = [fx.A, fx.B]
TEMPLATES = r.load_templates()
LOCAL = lv.MATERIALS                                                   # 로컬 다섯 권이 쓰는 모은 양
ROOMY = {'messages': 1000, 'photos': 1000, 'dates': 100, 'memos': 100}


def compose(scenario, materials=None):
    couple = {**fx.COUPLE_ROW, 'magazine_theme': scenario['theme']}
    return compose_issue(fx.ISSUE_ROW, couple, NAMES, scenario['corners'], materials)


def pages(comp, stem):
    return [p for p in comp.pages if p.stem == stem]


def filled(spec, comp):
    return r.fill_page(spec, comp.theme, TEMPLATES)


def soup_of(spec, comp):
    return BeautifulSoup(filled(spec, comp), 'html.parser')


def text_of(spec, comp):
    return soup_of(spec, comp).get_text(' ', strip=True)


def date_archive_articles(scenario):
    return next(c for c in scenario['corners'] if c['corner_type'] == 'date_archive')['content']['payload']['articles']


SCENARIOS = {
    'photo': fx.photo_scenario, 'type': fx.type_scenario, 'skipped': fx.skipped_scenario, 'many': fx.many_photos_scenario,
    'opener_fallback': fx.opener_fallback_scenario, 'opener_type_only': fx.opener_type_only_scenario,
    'long_original': fx.long_original_scenario, 'timeline_overflow': fx.timeline_overflow_scenario,
}


def note_equation(note):
    """발행 노트를 지면에 찍힌 글자만으로 읽어 줄마다 (모은 양, 게재, 싣지 않은 것의 합)을 돌려준다."""
    sums = {'데이트': 0, '사진': 0, '메모': 0, '대화': 0}
    patterns = (('데이트', r'^기사로 고르지 않은 날 (\d+)번$'), ('사진', r'^구간 \d+곳\(사진 (\d+)장\)'), ('사진', r'^사진 (\d+)장 — '),
                ('메모', r'^메모 (\d+)개 — '), ('메모', r'^구간 \d+곳\(메모 (\d+)개\)'), ('대화', r'^대화 (\d+)개 — '))   # v1.2.3 D2 - 글만 있는 기사에서 싣지 못한 구간
    for line in note['notUsed']:
        for label, pat in patterns:
            m = re.match(pat, line)
            if m:
                sums[label] += int(m.group(1))
    out = {}
    for row in note['materials']:
        out[row['label']] = (int(re.search(r'\d+', row['collected']).group()), int(re.search(r'\d+', row['used']).group()), sums[row['label']])
    return out


# ---------------------------------------------------------------------------
# R50-2 - 노트 정합 (모은 양 - 실제 게재 = 싣지 않은 것의 합)
# ---------------------------------------------------------------------------

class NoteEquation(unittest.TestCase):
    def check(self, comp, where):
        note = pages(comp, 'note')[0].computed['note']
        eq = note_equation(note)
        self.assertTrue(eq, where)
        for label, (collected, used, not_used) in eq.items():
            self.assertEqual(collected - used, not_used, f'{where} {label}: 모은 양 {collected} - 게재 {used} != 싣지 않은 것 {not_used}')
        return eq

    def test_every_local_volume_balances(self):
        # 로컬 권 전부(v1.2.3: vol4 · vol5-batch2는 통과 권으로 VOLUMES 안) + 84-d 가장자리 권 - 숫자는 코너 content와 모은 양에서 나온다
        for name, build in [*lv.VOLUMES, ('edge', fx.edge_scenario)]:
            sc = build()
            self.check(compose(sc, sc.get('materials', LOCAL)), name)

    def test_every_scenario_balances_with_two_kinds_of_collected_amounts(self):
        for name, build in SCENARIOS.items():
            for mats in (LOCAL, ROOMY):
                self.check(compose(build(), mats), f'{name} {mats}')

    def test_rendered_note_page_carries_the_same_lines(self):
        comp = compose(fx.many_photos_scenario(), LOCAL)
        spec = pages(comp, 'note')[0]
        text = text_of(spec, comp)
        for line in spec.computed['note']['notUsed']:
            self.assertIn(line, text)
        for row in spec.computed['note']['materials']:
            self.assertIn(row['collected'], text)

    def test_dates_row_explains_the_days_not_picked_as_articles(self):
        comp = compose(fx.many_photos_scenario(), LOCAL)
        note = pages(comp, 'note')[0].computed['note']
        period = [a for a in date_archive_articles(fx.many_photos_scenario()) if a.get('recalled') is not True]
        self.assertEqual(note['materials'][0], {'label': '데이트', 'collected': f"{LOCAL['dates']}번", 'used': f'{len(period)}번'})
        self.assertIn(f"기사로 고르지 않은 날 {LOCAL['dates'] - len(period)}번", note['notUsed'])

    def test_memo_gap_has_its_reason(self):
        sc = fx.many_photos_scenario()
        comp = compose(sc, LOCAL)
        note = pages(comp, 'note')[0].computed['note']
        memo_lines = [x for x in note['notUsed'] if x.startswith('메모 ')]
        self.assertTrue(memo_lines)
        for line in memo_lines:
            self.assertRegex(line, r'^메모 \d+개 — .+')     # 숫자만이 아니라 사유가 따라붙는다

    def test_dropped_timeline_stops_are_accounted_for(self):
        # 타임라인 2면에 들어가지 않은 구간의 사진 · 메모도 싣지 않은 것에 든다 - 줄이 맞는다
        w, h = 1200, 1600
        stops = [fx.stop(k, f'{9 + k}:00', f'장소{k}', [fx.photo(f'p{k}{j}', w, h) for j in range(3)], [fx.memo(f'메모{k}')], None) for k in range(9)]
        feat = fx.article('2026-09-12', '긴 하루', '연남동', stops, featured=True)
        sc = {'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([feat]))]}
        comp = compose(sc, {'photos': 100, 'dates': 5, 'memos': 50})
        self.assertGreater(comp.report['timelineDroppedStops'], 0)
        eq = self.check(comp, 'dropped')
        note = pages(comp, 'note')[0].computed['note']
        self.assertTrue(any(x.startswith('구간 ') and '들어가지 않았습니다' in x for x in note['notUsed']))
        self.assertTrue(any(x.startswith('메모 ') and '들어가지 않은 구간' in x for x in note['notUsed']))
        self.assertIn('메모', eq)

    def test_a_collected_amount_smaller_than_what_is_printed_stops_the_render(self):
        # 게재가 모은 양보다 큰 노트는 찍지 않는다 - 거짓 숫자 대신 멈춘다
        with self.assertRaises(ComposeError) as ctx:
            compose(fx.photo_scenario(), {'dates': 1})
        self.assertIn('발행 노트 정합 실패', str(ctx.exception))
        with self.assertRaises(ComposeError):
            compose(fx.photo_scenario(), {'messages': 1})
        with self.assertRaises(FactsError):
            build_facts(articles=date_archive_articles(fx.photo_scenario()), fi=0, kept_stops=[], dropped_stops=[], materials={'photos': 1})


class OpenerTocNoteShareOneSource(unittest.TestCase):
    def test_opener_dates_is_the_collected_amount_not_the_article_count(self):
        comp = compose(fx.many_photos_scenario(), LOCAL)
        lead = pages(comp, 'da-opener')[0].computed['da']['lead']
        self.assertIn(f"함께 보낸 날은 {LOCAL['dates']}번이었습니다", lead)
        period = [a for a in date_archive_articles(fx.many_photos_scenario()) if a.get('recalled') is not True]
        self.assertNotEqual(len(period), LOCAL['dates'])             # 일부러 둘이 다른 재료다 - 섞이면 여기서 드러난다
        self.assertIn(f"함께 보낸 날은 {LOCAL['dates']}번", text_of(pages(comp, 'da-opener')[0], comp))

    def test_opener_without_collected_amounts_uses_the_corner_summary(self):
        comp = compose(fx.many_photos_scenario())
        self.assertEqual(comp.report['facts']['periodDatesSource'], 'summary.dateCount')
        self.assertIn('함께 보낸 날은 2번이었습니다', pages(comp, 'da-opener')[0].computed['da']['lead'])

    def test_toc_splits_this_period_articles_and_recalled_articles(self):
        sc = fx.many_photos_scenario()
        arts = date_archive_articles(sc)
        period = len([a for a in arts if a.get('recalled') is not True])
        recalled = len([a for a in arts if a.get('recalled') is True])
        self.assertGreater(recalled, 0)
        comp = compose(sc, LOCAL)
        self.assertEqual(comp.report['toc'][0]['desc'], f'화보 · 9월의 하루 {period}편 · 그때 그 시절 {recalled}편')
        html = text_of(pages(comp, 'contents')[0], comp)
        self.assertIn(f'9월의 하루 {period}편 · 그때 그 시절 {recalled}편', html)
        self.assertNotIn('번의 하루', html)
        self.assertNotIn('· 기사 3편', html)

    def test_toc_has_no_second_piece_without_recalled_articles(self):
        comp = compose(fx.opener_fallback_scenario(), LOCAL)
        desc = comp.report['toc'][0]['desc']
        self.assertEqual(desc, '화보 · 9월의 하루 2편')
        self.assertNotIn('그때 그 시절', desc)

    def test_opener_photos_and_memos_equal_the_note_and_the_images_on_the_pages(self):
        # 오프너 문장 = 발행 노트 게재 = 이번 기간 기사 지면에 실제로 놓인 사진 · 메모 (재소환 기사 지면은 따로)
        for name, build in SCENARIOS.items():
            sc = build()
            comp = compose(sc, ROOMY)
            if not pages(comp, 'da-opener'):
                continue
            arts = date_archive_articles(sc)
            imgs, memo_lines = set(), 0
            for spec in comp.pages:
                if spec.stem not in ('da-opener', 'da-timeline', 'da-article'):
                    continue
                if arts[spec.bind['i']].get('recalled') is True:
                    continue
                soup = soup_of(spec, comp)
                imgs |= {i['src'] for i in soup.find_all('img') if i.get('src')}
                if spec.stem in ('da-timeline', 'da-article'):
                    memo_lines += soup.get_text(' ', strip=True).count('의 메모')
            lead = pages(comp, 'da-opener')[0].computed['da']['lead']
            said = re.search(r'남긴 (\d+)장의 사진과 (\d+)개의 메모', lead)
            self.assertEqual((int(said.group(1)), int(said.group(2))), (len(imgs), memo_lines), name)
            # v1.2.3(D6 · README §11 ⑩) - 발행 노트 게재는 호 전체: 위 사진 + 이달의 우리 소기사 사진(재소환 기사의 사진은 따로)
            recalled_paths = {ph['path'] for a in arts if a.get('recalled') is True for st in a['stops'] for ph in st['photos']}
            tm_imgs = {i['src'] for spec in pages(comp, 'tm-articles') for i in soup_of(spec, comp).find_all('img') if i.get('src')}
            rows = {m['label']: m['used'] for m in pages(comp, 'note')[0].computed['note']['materials']}
            self.assertEqual((rows['사진'], rows['메모']), (f'{len(imgs | (tm_imgs - recalled_paths))}장', f'{memo_lines}개'), name)


# ---------------------------------------------------------------------------
# R50-3 - 이름 없는 경유지 · 재소환 장소 제외
# ---------------------------------------------------------------------------

class Places(unittest.TestCase):
    def test_unnamed_stop_is_listed_and_counted(self):
        sc = fx.many_photos_scenario()
        comp = compose(sc, LOCAL)
        spec = pages(comp, 'da-places')[0]
        listed = [p['placeName'] for p in spec.computed['da']['places']]
        self.assertIn(UNNAMED_PLACE, listed)
        stops = [s for a in date_archive_articles(sc) if a.get('recalled') is not True for s in a['stops']]
        self.assertEqual(len(listed), len(stops))                                   # 이름 없는 곳도 한 줄이다
        self.assertEqual(sum(1 for s in stops if not s.get('placeName')), listed.count(UNNAMED_PLACE))
        soup = soup_of(spec, comp)
        rows = soup.select('.pl-list > div')
        self.assertEqual(len(rows), len(listed))
        for row in rows:
            self.assertNotEqual(row.get_text(' ', strip=True).strip(), '')           # 빈 줄이 없다
        self.assertIn(UNNAMED_PLACE, soup.get_text(' ', strip=True))

    def test_recalled_place_is_not_on_this_months_route_nor_in_the_count(self):
        sc = fx.many_photos_scenario()
        comp = compose(sc, LOCAL)
        spec = pages(comp, 'da-places')[0]
        text = text_of(spec, comp)
        recalled_places = [s['placeName'] for a in date_archive_articles(sc) if a.get('recalled') is True for s in a['stops']]
        self.assertTrue(recalled_places)
        for name in recalled_places:
            self.assertNotIn(name, text)
        recalled_dates = {a['dateOn'][5:].replace('-', '.') for a in date_archive_articles(sc) if a.get('recalled') is True}
        self.assertTrue(all(p['date'] not in recalled_dates for p in spec.computed['da']['places']))
        n_stops = sum(len(a['stops']) for a in date_archive_articles(sc) if a.get('recalled') is not True)
        regions = len(next(c for c in sc['corners'] if c['corner_type'] == 'date_archive')['content']['payload']['summary']['regions'])
        self.assertEqual(spec.computed['da']['routeSummary'], f'{regions}개 지역 · {n_stops}개 장소')
        self.assertIn(f'{regions}개 지역 · {n_stops}개 장소', text)
        # 오프너의 "N곳"도 같은 값이다
        self.assertIn(f'{n_stops}곳을 거치며', pages(comp, 'da-opener')[0].computed['da']['lead'])

    def test_route_chains_use_the_same_names(self):
        comp = compose(fx.many_photos_scenario(), LOCAL)
        article = pages(comp, 'da-article')[0].computed['da']
        self.assertIn(UNNAMED_PLACE, article['articleRoute'])


# ---------------------------------------------------------------------------
# R50-4 - 기사 칸 · 기사 메모 줄
# ---------------------------------------------------------------------------

class ArticleCell(unittest.TestCase):
    @staticmethod
    def memo_only_second():
        feat = fx.article('2026-09-12', '대표', '연남동', [fx.stop(0, '10:00', 'A', [fx.photo('a0')], [], '캡션')], featured=True)
        sec = fx.article('2026-09-21', '둘째', '성수동', [fx.stop(0, '13:00', 'C', [fx.photo('c0')], [fx.memo('메모만 있는 구간')], None)])
        return {'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([feat, sec]))]}

    def test_ai_caption_cell_is_removed_whole_when_none_is_on_the_page(self):
        # v1.2.3 - 0인 칸은 틀의 `data-optional`이 지운다(렌더러 `drop_empty_count_cells`는 없앴다, D8)
        comp = compose(self.memo_only_second(), ROOMY)
        spec = pages(comp, 'da-article')[0]
        self.assertEqual(spec.computed['da']['articleCaptionCount'], '')
        text = text_of(spec, comp)
        self.assertNotIn('AI 캡션', text)
        self.assertIn('경유지', text)                                               # 같은 줄의 다른 칸은 남는다
        self.assertNotIn('data-slot="@da.articleCaptionCount"', filled(spec, comp))

    def test_cell_stays_when_a_caption_is_on_the_page(self):
        comp = compose(fx.many_photos_scenario(), LOCAL)                         # 둘째 기사 첫 사진 = 메모 없는 구간 -> AI 캡션 1
        spec = pages(comp, 'da-article')[0]
        self.assertEqual(spec.computed['da']['articleCaptionCount'], 1)
        cell = soup_of(spec, comp).find(attrs={'data-slot': '@da.articleCaptionCount'})
        self.assertIsNotNone(cell)
        self.assertEqual(cell.get_text(strip=True), '1')
        self.assertIn('AI 캡션', cell.parent.get_text(' ', strip=True))

    def test_ai_captions_counted_only_where_the_page_shows_them(self):
        # 대표 기사 타임라인은 AI 캡션을 싣는다(메모가 없는 구간) - 실린 구간만 센다. 기사 지면은 v1.2.3부터 사진 캡션 칸에 싣는다(D4) - 실린 칸만 센다
        comp = compose(fx.many_photos_scenario(), LOCAL)
        facts = build_facts(articles=date_archive_articles(fx.many_photos_scenario()), fi=0, kept_stops=[], dropped_stops=[])
        self.assertEqual(facts.lead.ai_captions_shown, 0)                          # 실린 구간이 없으면 0
        shown_ai = sum(1 for ph in article_photos(date_archive_articles(fx.many_photos_scenario())[1]) if ph['aiCaption'])
        self.assertEqual(facts.articles[1].ai_captions_shown, shown_ai)
        self.assertEqual(shown_ai, 1)
        timeline_ai = sum(1 for s in [s for sp in pages(comp, 'da-timeline') for s in sp.corner['payload']['articles'][0]['stops']] if s.get('aiCaption'))
        self.assertIn(f'AI 캡션 {timeline_ai}', pages(comp, 'da-opener')[0].computed['da']['records'])

    def test_article_memo_sits_under_its_own_stops_first_photo_with_the_authors_name(self):
        # v1.2.3(D4, README §10 ①): 기사의 첫 사진이 아니라 **그 메모가 남은 구간의 첫 사진** 아래. 다른 구간의 메모를 끌어오지 않는다(사진과 메모가 어긋나 보였다)
        sc = fx.many_photos_scenario()
        comp = compose(sc, LOCAL)
        spec = pages(comp, 'da-article')[0]
        photos = spec.computed['da']['articlePhotos']
        article = date_archive_articles(sc)[spec.bind['i']]
        memo_stop = next(st for st in article['stops'] if any(n['type'] == 'memo' for n in st['userNotes']))
        memo = next(n for n in memo_stop['userNotes'] if n['type'] == 'memo')
        k = [ph['path'] for ph in photos].index(memo_stop['photos'][0]['path'])
        self.assertGreater(k, 0)                                                     # 이 기사에서는 첫 사진이 아니다(첫 구간은 메모가 없다)
        self.assertEqual((photos[k]['caption'], photos[k]['authorName']), (memo['text'], memo['authorName']))
        self.assertEqual([ph['caption'] for i, ph in enumerate(photos) if i != k], ['', ''])
        soup = soup_of(spec, comp)
        strip = soup.select('[data-repeat="@da.articlePhotos"] > div')
        memo_caps = [d.select('.cap.memo') for d in strip]
        self.assertTrue(memo_caps[k])
        self.assertFalse(any(c for i, c in enumerate(memo_caps) if i != k))
        self.assertIn(memo['text'], memo_caps[k][0].get_text(' ', strip=True))
        self.assertRegex(re.sub(r'\s+', '', memo_caps[k][0].get_text(' ', strip=True)), r'—' + re.escape(memo['authorName']) + r'의메모')
        self.assertTrue(strip[0].select('.cap.ai'))                                  # 첫 사진의 구간은 메모가 없어 AI 캡션(라벨 줄)

    def test_memo_without_author_prints_no_empty_author_line(self):
        a = fx.article('2026-09-21', '둘째', '성수동', [fx.stop(0, '13:00', 'C', [fx.photo('c0')], [{'type': 'memo', 'text': '이름 없는 메모'}], None)])
        photos = article_photos(a)
        self.assertEqual((photos[0]['caption'], photos[0]['authorName']), ('이름 없는 메모', ''))
        feat = fx.article('2026-09-12', '대표', '연남동', [fx.stop(0, '10:00', 'A', [fx.photo('a0')], [], '캡션')], featured=True)
        comp = compose({'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([feat, a]))]})
        text = text_of(pages(comp, 'da-article')[0], comp)           # 주석이 아니라 보이는 글만 본다
        self.assertIn('이름 없는 메모', text)
        self.assertNotIn('의 메모', text)

    def test_no_memo_means_no_caption_line(self):
        feat = fx.article('2026-09-12', '대표', '연남동', [fx.stop(0, '10:00', 'A', [fx.photo('a0')], [], '캡션')], featured=True)
        sec = fx.article('2026-09-21', '둘째', '성수동', [fx.stop(0, '13:00', 'C', [fx.photo('c0')], [], '캡션')])
        comp = compose({'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([feat, sec]))]})
        html = filled(pages(comp, 'da-article')[0], comp)
        self.assertNotIn('class="cap"', html)


# ---------------------------------------------------------------------------
# R50-2 #8 - 타임라인 라벨 "실린 / 전체"
# ---------------------------------------------------------------------------

class TimelineLabel(unittest.TestCase):
    def test_label_reads_shown_over_total_from_the_same_source_as_the_article_note(self):
        sc = fx.many_photos_scenario()
        comp = compose(sc, LOCAL)
        stops = date_archive_articles(sc)[0]['stops']
        want = [ratio_label(min(len(s['photos']), 3), len(s['photos'])) for s in stops]
        got = []
        for spec in pages(comp, 'da-timeline'):
            for lbl in soup_of(spec, comp).select('.lbl'):
                m = re.match(r'^사진 (\d+(?: / \d+)?)$', lbl.get_text(' ', strip=True))
                if m:
                    got.append(m.group(1))
        self.assertEqual(got, want)
        self.assertIn('3 / 4', got)                    # 4장 중 3장
        self.assertNotIn('4', [g for g in got if '/' not in g])
        # 기사의 "그날 남은 사진 N장 중 M장"과 같은 규칙 - 같은 사진 수에서 나온다
        art = date_archive_articles(sc)[1]
        total = sum(len(s['photos']) for s in art['stops'])
        self.assertIn(f'그날 남은 사진 {total}장 중 3장', pages(comp, 'da-article')[0].computed['da']['articlePhotoNote'])

    def test_totals_line_reads_the_same_way(self):
        comp = compose(fx.many_photos_scenario(), LOCAL)
        totals = pages(comp, 'da-timeline')[0].computed['da']['totals']
        self.assertRegex(totals, r'^사진 \d+ / \d+장 · 메모 \d+( / \d+)?$')


# ---------------------------------------------------------------------------
# R50-2 #9 - 출처 날짜 · #10 - 뒤표지
# ---------------------------------------------------------------------------

class SourceDateAndBack(unittest.TestCase):
    def test_quote_source_date_follows_the_evidence_date_rule(self):
        comp = compose(fx.photo_scenario(), LOCAL)
        text = ' '.join(text_of(s, comp) for s in pages(comp, 'sw-quotes'))
        self.assertIn('— 09.22 09:20, 아침 대화 중', text)
        self.assertIn('— 09.24 18:02, 저녁 대화 중', text)
        self.assertNotIn('2026.09.22', text)

    def test_year_only_for_other_years_and_recalled_days(self):
        d = '2025.09.20 09:20, 아침 대화 중'
        self.assertEqual(quote_display(d, '2025-09-20T09:20:00+09:00', 2026, set()), '2025.09.20 09:20, 아침 대화 중')   # 다른 해
        self.assertEqual(quote_display('2026.09.20 09:20, 아침 대화 중', '2026-09-20T09:20:00+09:00', 2026, {'2026-09-20'}),
                         '2026.09.20 09:20, 아침 대화 중')                                                               # 재소환 기사의 날
        self.assertEqual(quote_display('2026.09.20 09:20, 아침 대화 중', '2026-09-20T09:20:00+09:00', 2026, set()), '09.20 09:20, 아침 대화 중')
        self.assertEqual(quote_display('아침 대화', '2026-09-20T09:20:00+09:00', 2026, set()), '아침 대화')                  # 모양이 다르면 그대로

    def test_short_quotes_use_the_same_rule(self):
        comp = compose(fx.photo_scenario(), LOCAL)
        sub = pages(comp, 'sw-quotes')[-1].corner['payload']['sub']
        self.assertEqual(sub[0]['attribution']['at'], '09.11 23:40')

    def test_back_cover_has_no_promise_sentence(self):
        # R157-7 - 뜻을 바꿨다: 사실(날짜 · 기념일)은 허용, 다음 호를 약속하는 문장("다음 호에서" · "기대해 주세요" · NEXT ISSUE 줄)은 금지
        from promise_check import promise_violations
        for build in SCENARIOS.values():
            comp = compose(build(), LOCAL)
            html = text_of(pages(comp, 'back')[0], comp)               # 보이는 글만 - 주석은 뺀다
            self.assertEqual(promise_violations(html), [])
        template = re.sub(r'<!--.*?-->', '', TEMPLATES['back'], flags=re.S)
        self.assertNotIn('nextMonth', template)   # 틀은 '쓰지 않는다'는 주석에만 이름이 있다
        self.assertEqual(promise_violations(template), [])


# ---------------------------------------------------------------------------
# R50-6 - render/issue/ 수정은 이름 붙인 곳만, 수정마다 주석
# ---------------------------------------------------------------------------

class DesignEditsAreMarked(unittest.TestCase):
    def test_no_development_temporary_edit_is_left_in_the_templates(self):
        # v1.2.3 - 개발이 R50-6으로 틀에 넣던 임시 수정(주석 'R50-6 임시')은 디자인 판으로 확정돼 틀에 남지 않는다. 틀은 디자인 판 그대로다(84-d)
        for stem, template in TEMPLATES.items():
            self.assertNotIn('R50-6 임시', template, stem)

    def test_sw_opener_folio_is_light_only_on_the_photo(self):
        template = TEMPLATES['sw-opener']
        with_photo = re.search(r'<div data-variant="with-photo">(.*?)<div data-variant="type-only">', template, re.S).group(1)
        type_only = template.split('<div data-variant="type-only">')[1]
        self.assertIn('color:var(--onPhoto)', re.search(r'class="ab folio[^>]*>', with_photo).group(0))
        self.assertNotIn('onPhoto', re.search(r'class="ab folio[^>]*>', type_only).group(0))
        comp = compose(fx.photo_scenario(), LOCAL)
        html = filled(pages(comp, 'sw-opener')[0], comp)
        self.assertEqual(html.count('class="ab folio'), 1)                          # 변형 하나만 남으니 폴리오도 하나


# ---------------------------------------------------------------------------
# R50-8 - 시드 점검 (생성 문장이 시드 기록과 맞는가). 실제 생성 검증은 M1c - 이번 범위 아님
# ---------------------------------------------------------------------------

ACTIVITY_PLACE_WORDS = ('영화', '관람', '식사', '산책', '케이크', '서점', '카페', '공원', '식당', '커피', '쇼핑', '전시', '공연', '노래방',
                        '맛집', '드라이브', '여행', '술집', '놀이공원', '미술관', '박물관')


def records_corpus(scenario):
    """시드 기록(두 사람의 것) - 경유지 이름 · 지역 · 메모 · 사진 AI 캡션이 아닌 원문 · 대화 원문 · 근거 발췌."""
    parts = []
    for c in scenario['corners']:
        content, ctype = c['content'], c['corner_type']
        if ctype == 'date_archive' and content:
            for a in content['payload']['articles']:
                parts.append(a.get('region') or '')
                for s in a['stops']:
                    parts.append(s.get('placeName') or '')
                    parts.extend(n.get('text') or '' for n in s['userNotes'])
            parts.extend(content['payload']['summary']['regions'])
        if ctype == 'sweet_words' and content:
            for m in content['payload']['main']:
                parts.extend(t['text'] for t in m['turns'])
            parts.extend(s['text'] for s in content['payload']['sub'])
        if ctype == 'this_month' and content:
            for a in content['payload']['articles']:
                parts.extend(e.get('excerpt') or '' for e in a['evidence'])
    return ' '.join(parts)


def generated_sentences(scenario):
    """생성 문장(온도록이 쓴 것) - (필드 이름, 글, 합니다체여야 하는가)."""
    out = []
    for c in scenario['corners']:
        content, ctype = c['content'], c['corner_type']
        if not content:
            continue
        p = content['payload']
        if ctype == 'date_archive':
            for a in p['articles']:
                out.append(('da.title', a['title'], False))
                for s in a['stops']:
                    if s.get('aiCaption'):
                        out.append(('da.aiCaption', s['aiCaption'], False))
                for q in a['closingQuestions']:
                    out.append(('da.question', q['text'], False))
                    if q.get('basis'):
                        out.append(('da.basis', q['basis'], False))
        if ctype == 'sweet_words':
            for m in p['main']:
                out.append(('sw.context', m['context'], False))
        if ctype == 'this_month':
            out.append(('tm.headline', p['theme']['headline'], False))
            out.append(('tm.lead', p['theme']['lead'], True))
            for a in p['articles']:
                out.append(('tm.title', a['title'], False))
                out.append(('tm.body', a['body'], True))
            out.append(('tm.closing', p['closing'], True))
    return out


class SeedMatchesItsRecords(unittest.TestCase):
    def test_places_and_activities_named_in_generated_sentences_exist_in_the_records(self):
        for name, build in SCENARIOS.items():
            sc = build()
            corpus = records_corpus(sc)
            for field, text, _ in generated_sentences(sc):
                for word in ACTIVITY_PLACE_WORDS:
                    if word in text:
                        self.assertIn(word, corpus, f'{name} {field} 「{text}」에 나오는 「{word}」가 시드 기록에 없다')

    def test_the_basis_of_a_suggestion_names_only_stops_of_its_own_article(self):
        for name, build in SCENARIOS.items():
            for a in date_archive_articles(build()):
                names = [s['placeName'] for s in a['stops'] if s.get('placeName')]
                for q in a['closingQuestions']:
                    basis = q.get('basis')
                    if basis:
                        self.assertTrue(any(n in basis for n in names), f'{name} 「{basis}」')

    def test_the_seed_no_longer_has_the_two_known_defects(self):
        for build in SCENARIOS.values():
            blob = repr(build())
            self.assertNotIn('영화', blob)
            self.assertNotIn('걸어 보자', blob)

    def test_this_month_sentences_are_in_the_polite_formal_voice(self):
        for name, build in SCENARIOS.items():
            for field, text, formal in generated_sentences(build()):
                if formal:
                    self.assertRegex(text, r'니다[.]$', f'{name} {field} 「{text}」는 합니다체가 아니다')

    def test_conversation_times_and_contexts_do_not_repeat(self):
        for name, build in SCENARIOS.items():
            for c in build()['corners']:
                if c['corner_type'] != 'sweet_words' or not c['content']:
                    continue
                mains = c['content']['payload']['main']
                displays = [m['attribution']['display'] for m in mains]
                self.assertEqual(len(set(displays)), len(displays), f'{name} 출처 줄이 겹친다 {displays}')
                for m in mains:
                    at = m['attribution']['at']
                    self.assertEqual(at, m['turns'][0]['at'])                             # 출처 시각 = 첫 발화 시각
                    self.assertTrue(m['attribution']['display'].startswith(f'{at[0:4]}.{at[5:7]}.{at[8:10]} {at[11:16]}'))
                    for word in ('아침', '저녁', '낮', '밤'):
                        if word in m['context'] and word != '밤새':
                            self.assertIn(f'{word} 대화 중', m['attribution']['display'], f'{name} 제목 「{m["context"]}」와 출처 줄이 어긋난다')
                if len(mains) > 1:
                    self.assertGreater(len({m['attribution']['at'][11:16] for m in mains}), 1, f'{name} 대화 시각이 모두 같다')

    def test_every_seed_scenario_still_composes_with_local_materials(self):
        for build in SCENARIOS.values():
            compose(build(), LOCAL)


if __name__ == '__main__':
    unittest.main()
