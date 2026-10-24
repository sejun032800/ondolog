"""조판 구성 시험 (위임: 55-2 범위 2~6). 네트워크·브라우저 없음.

실행 (저장소 루트에서): render/.venv/Scripts/python.exe -B -m unittest discover -s render/tests
"""

import copy
import os
import sys
import unittest

sys.dont_write_bytecode = True
HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, '..'))
sys.path.insert(0, HERE)

import fixtures as fx  # noqa: E402
import render_issue as r  # noqa: E402
from compose import (  # noqa: E402
    ComposeError, PageSpec, _Builder, choose_variant, compose_issue, count_sentences, split_headline, split_timeline, stop_height,
)

NAMES = [fx.A, fx.B]


def compose(scenario, materials=None, couple=None):
    couple = {**fx.COUPLE_ROW, 'magazine_theme': scenario['theme'], **(couple or {})}
    return compose_issue(fx.ISSUE_ROW, couple, NAMES, scenario['corners'], materials)


def stems(comp):
    return [p.stem for p in comp.pages]


def page(comp, stem, nth=0):
    return [p for p in comp.pages if p.stem == stem][nth]


def stop_of(photos, notes=None, caption='캡션'):
    return fx.stop(0, '10:00', '장소', [fx.photo(f'x{i}') for i in range(photos)], [fx.memo('메모')] if notes else [], caption)


class Timeline(unittest.TestCase):
    """README §5 - stop 높이를 더해 953px을 넘으면 2면. 실측표 그대로."""

    def test_table_heights(self):
        self.assertEqual(stop_height(stop_of(0, True)), 148)
        self.assertEqual(stop_height(stop_of(0)), 101)
        self.assertEqual(stop_height(stop_of(1, True)), 390)
        self.assertEqual(stop_height(stop_of(1)), 338)
        self.assertEqual(stop_height(stop_of(2, True)), 378)
        self.assertEqual(stop_height(stop_of(2)), 326)
        self.assertEqual(stop_height(stop_of(3, True)), 453)
        self.assertEqual(stop_height(stop_of(3)), 401)
        self.assertEqual(stop_height(stop_of(7, True)), 453)  # 4장 이상은 3장과 같다

    def test_three_stops_with_photos_split_into_two_pages(self):
        pages, dropped = split_timeline([stop_of(1), stop_of(1), stop_of(1)])
        self.assertEqual([len(p) for p in pages], [2, 1])
        self.assertEqual(dropped, [])
        # 사진이 있는 stop 3개는 모든 조합이 넘는다(README §5)
        for n in (1, 2, 3):
            for note in (True, False):
                pages, _ = split_timeline([stop_of(n, note)] * 3)
                self.assertEqual(len(pages), 2, (n, note))

    def test_existing_p5_composition_stays_on_one_page(self):
        stops = [stop_of(1, True), stop_of(0), stop_of(3, True)]  # 390 + 101 + 453 = 944 (README의 945px)
        self.assertEqual(sum(stop_height(s) for s in stops), 944)
        pages, dropped = split_timeline(stops)
        self.assertEqual(len(pages), 1)
        self.assertEqual(dropped, [])

    def test_photoless_stops_fit_three_on_a_page(self):
        pages, _ = split_timeline([stop_of(0, True)] * 3)
        self.assertEqual(len(pages), 1)

    def test_no_more_than_two_pages_and_the_rest_is_dropped(self):
        pages, dropped = split_timeline([stop_of(3, True)] * 5)  # 453 x 2 = 906 / 면
        self.assertEqual([len(p) for p in pages], [2, 2])
        self.assertEqual(len(dropped), 1)

    def test_order_is_kept(self):
        stops = [fx.stop(i, f'1{i}:00', f'장소{i}', [fx.photo(f'y{i}')], [], '캡션') for i in range(3)]
        pages, _ = split_timeline(stops)
        self.assertEqual([s['time'] for p in pages for s in p], ['10:00', '11:00', '12:00'])

    def test_compose_makes_two_timeline_pages_for_the_photo_scenario(self):
        comp = compose(fx.photo_scenario())
        self.assertEqual(stems(comp).count('da-timeline'), 2)
        first, second = [p for p in comp.pages if p.stem == 'da-timeline']
        self.assertEqual(len(first.corner['payload']['articles'][0]['stops']), 2)
        self.assertEqual(len(second.corner['payload']['articles'][0]['stops']), 1)

    def test_drawing_only_notes_are_not_memos_on_the_page(self):
        s = fx.stop(0, '10:00', 'A', [], [], '캡션')
        s['userNotes'] = [{'authorId': 'u', 'authorName': 'x', 'type': 'drawing', 'path': 'p'}]
        self.assertEqual(stop_height(s), 101)


class Cover(unittest.TestCase):
    def test_photo_cover_needs_the_short_side_at_1170_or_more(self):
        self.assertEqual(compose(fx.photo_scenario(short_side=1170)).pages[0].stem, 'cover-photo')
        self.assertEqual(compose(fx.photo_scenario(short_side=1169)).pages[0].stem, 'cover-type')

    def test_no_photo_means_type_cover(self):
        art = fx.article('2026-09-12', '제목', '연남동', [fx.stop(0, '10:00', 'A', [], [fx.memo('메모')], None)], featured=True)
        sc = {'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([art]))]}
        comp = compose(sc)
        self.assertEqual(comp.pages[0].stem, 'cover-type')
        self.assertIsNone(comp.report['coverPhoto'])

    def test_photo_chain_falls_back_to_the_first_photo_of_the_corner(self):
        art = fx.article('2026-09-12', '제목', '연남동', [
            fx.stop(0, '10:00', 'A', [], [], '캡션'),
            fx.stop(1, '11:00', 'B', [fx.photo('later')], [], '캡션')], featured=True)
        comp = compose({'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([art]))]})
        self.assertEqual(comp.report['coverPhoto'], fx.dest('later'))

    def test_cover_values_headline_quote_temperature(self):
        comp = compose(fx.type_scenario())
        cover = comp.pages[0].computed['cover']
        self.assertEqual(cover['headline'], '비가 와도\n우리는\n걸었다')
        self.assertEqual(cover['quote'], '오늘 비 온대. 우산 챙겼어?')
        self.assertEqual(cover['quoteBy'], fx.A)
        self.assertEqual(cover['temperature'], '')  # 일 배치 전에는 늘 없다
        photo = compose(fx.photo_scenario()).pages[0].computed['cover']
        self.assertEqual(photo['headline'], '연남동을 자주 걸은 달')  # 사진 표지는 한 줄 그대로(clamp2)
        self.assertEqual(photo['photo'], fx.dest('e01'))

    def test_split_headline_rules(self):
        self.assertEqual(split_headline('비가 와도 우리는 걸었다'), ['비가 와도', '우리는', '걸었다'])
        self.assertEqual(split_headline('가을이 오는 길목'), ['가을이 오는', '길목'])
        self.assertIsNone(split_headline('아주아주긴단어입니다'))              # 6자 넘는 단어는 쪼개지 않는다
        self.assertEqual(split_headline('가 나 다 라 마 바 사 아'), ['가 나 다', '라 마 바', '사 아'])
        self.assertIsNone(split_headline('가나다 라마바 사아자 차카타'))      # 4줄이 필요하다
        self.assertIsNone(split_headline(''))
        self.assertIsNone(split_headline(None))
        self.assertEqual(split_headline('여섯글자다요'), ['여섯글자다요'])

    def test_unsplittable_headline_gives_way_to_the_quote(self):
        sc = fx.type_scenario()
        tm = copy.deepcopy(sc['corners'][2]['content'])
        tm['payload']['theme']['headline'] = '아주아주긴단어가있는제목'
        sc['corners'][2] = fx.corner_row('this_month', tm, seq=3)
        comp = compose(sc)
        self.assertEqual(comp.report['coverHeadlineFrom'], 'quote')
        self.assertEqual(comp.pages[0].computed['cover']['headline'], '오늘 비 온대. 우산 챙겼어?')

    def test_no_quote_when_sweet_words_is_skipped(self):
        comp = compose(fx.skipped_scenario())
        cover = comp.pages[0].computed['cover']
        self.assertEqual(cover['quote'], '')
        self.assertEqual(cover['quoteBy'], '')


class PhotoSets(unittest.TestCase):
    def test_contents_back_and_sweet_words_opener_photos(self):
        comp = compose(fx.photo_scenario())
        shown = comp.shown_photos
        cover = comp.report['coverPhoto']
        self.assertEqual(cover, fx.dest('e01'))
        pool = [p for p in shown if p != cover]
        self.assertEqual(comp.report['contentsPhoto'], pool[0])        # 표지가 아닌 첫 사진
        self.assertEqual(comp.report['backPhoto'], pool[-1])           # 같은 집합의 마지막 사진
        used = {cover, pool[0], pool[-1]}
        self.assertEqual(comp.report['swOpenerPhoto'], next(p for p in shown if p not in used))
        self.assertEqual(len(set(shown)), len(shown))

    def test_type_only_variant_when_no_unused_photo_remains(self):
        art = fx.article('2026-09-12', '제목', '연남동', [fx.stop(0, '10:00', 'A', [fx.photo('a'), fx.photo('b')], [], '캡션')], featured=True)
        sw = fx.sweet_words([fx.excerpt('정황', '22', [fx.turn(fx.A, '안녕', '2026-09-22T09:20:00+09:00')])])
        comp = compose({'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([art])), fx.corner_row('sweet_words', sw)]})
        opener = page(comp, 'sw-opener')
        self.assertEqual(comp.report['swOpenerPhoto'], None)
        self.assertEqual(choose_variant(opener, frozenset({'with-photo', 'type-only'}), None), 'type-only')

    def test_with_photo_variant_when_one_exists(self):
        comp = compose(fx.photo_scenario())
        self.assertEqual(choose_variant(page(comp, 'sw-opener'), frozenset({'with-photo', 'type-only'}), None), 'with-photo')

    def test_photos_beyond_the_stop_cap_are_not_shown(self):
        comp = compose(fx.photo_scenario())
        for dropped in ('e05',):  # 연남동 카페의 4번째 사진
            self.assertNotIn(fx.dest(dropped), comp.shown_photos)


class Variants(unittest.TestCase):
    def test_timeline_variant_follows_the_photo_count(self):
        names = frozenset({'photos-0', 'photos-1', 'photos-2', 'photos-3'})
        spec = PageSpec('da-timeline')
        for n, want in [(0, 'photos-0'), (1, 'photos-1'), (2, 'photos-2'), (3, 'photos-3'), (4, 'photos-3'), (9, 'photos-3')]:
            self.assertEqual(choose_variant(spec, names, {'photos': [{}] * n}), want)

    def test_grid_follows_the_article_count(self):
        names = frozenset({'grid-2', 'grid-3', 'grid-4'})
        for n, want in [(2, 'grid-2'), (3, 'grid-3'), (4, 'grid-4'), (5, 'grid-4')]:
            spec = PageSpec('tm-articles', {'payload': {'articles': [{}] * n}})
            self.assertEqual(choose_variant(spec, names, None), want)

    def test_unknown_variant_group_is_not_chosen(self):
        self.assertIsNone(choose_variant(PageSpec('x'), frozenset({'a', 'b'}), None))


class Order(unittest.TestCase):
    def test_photo_scenario_page_order(self):
        comp = compose(fx.photo_scenario())
        self.assertEqual(stems(comp), ['cover-photo', 'contents', 'note', 'da-opener', 'da-timeline', 'da-timeline', 'da-places',
                                       'da-article', 'da-article', 'sw-opener', 'sw-quotes', 'tm-lead', 'tm-articles', 'back'])

    def test_sweet_words_three_mains_make_two_quote_pages(self):
        comp = compose(fx.type_scenario())
        quotes = [p for p in comp.pages if p.stem == 'sw-quotes']
        self.assertEqual(len(quotes), 2)
        self.assertEqual(len(quotes[0].corner['payload']['main']), 2)
        self.assertEqual(quotes[0].corner['payload']['sub'], [])          # 단문은 마지막 인용면에만(§3-3)
        self.assertEqual(len(quotes[1].corner['payload']['main']), 1)
        self.assertEqual(len(quotes[1].corner['payload']['sub']), 6)

    def test_one_or_two_mains_make_one_quote_page(self):
        comp = compose(fx.photo_scenario())
        self.assertEqual(stems(comp).count('sw-quotes'), 1)

    def test_sweet_words_sub_time_is_shown_as_the_page_shows_it(self):
        comp = compose(fx.photo_scenario())
        subs = page(comp, 'sw-quotes').corner['payload']['sub']
        self.assertEqual(subs[0]['attribution']['at'], '09.11 23:40')
        self.assertEqual(fx.photo_scenario()['corners'][1]['content']['payload']['sub'][0]['attribution']['at'], '2026-09-11T23:40:00+09:00')

    def test_skipped_corner_leaves_pages_and_toc_and_page_numbers_are_recounted(self):
        comp = compose(fx.skipped_scenario())
        self.assertNotIn('sw-opener', stems(comp))
        self.assertNotIn('sw-quotes', stems(comp))
        self.assertEqual([t['title'] for t in comp.report['toc']], ['데이트 아카이브', '이달의 우리'])
        self.assertEqual([t['page'] for t in comp.report['toc']], ['04', '10'])  # 다정한 말들 두 면이 빠져 번호가 당겨진다
        self.assertEqual(len(comp.pages), 12)
        self.assertEqual([p.computed['page'] for p in comp.pages][-1], '12')
        full = compose(fx.photo_scenario())
        self.assertEqual([t['page'] for t in full.report['toc']], ['04', '10', '12'])

    def test_page_numbers_are_the_sheet_numbers(self):
        comp = compose(fx.photo_scenario())
        self.assertEqual([p.computed['page'] for p in comp.pages], [f'{n:02d}' for n in range(1, 15)])

    def test_unfinished_corners_leave_like_skipped_and_never_get_a_substitute_page(self):
        sc = fx.photo_scenario()
        sc['corners'][1] = fx.corner_row('sweet_words', None, status='failed', skip_reason='generation_failed')
        comp = compose(sc)
        self.assertNotIn('sw-opener', stems(comp))

    def test_no_ready_corner_stops(self):
        with self.assertRaises(ComposeError):
            compose({'theme': 'basic', 'corners': [fx.corner_row('sweet_words', None, status='skipped', skip_reason='insufficient_input')]})

    def test_theme_must_be_one_of_the_six(self):
        with self.assertRaises(ComposeError):
            compose(fx.photo_scenario(), couple={'magazine_theme': 'pastel'})
        for theme in ('basic', 'hip', 'neon', 'lovely', 'night', 'ondol'):
            self.assertEqual(compose(fx.photo_scenario(theme)).theme, theme)


class RecallReason(unittest.TestCase):
    """R26-4 - anniversary만 "N년 전 이맘때". never_featured·sparse_month는 빈 값(줄 삭제)."""

    @staticmethod
    def reason_of(reason, date_on='2025-09-20', recalled=True):
        feat = fx.article('2026-09-12', '대표', '연남동', [fx.stop(0, '10:00', 'A', [fx.photo('f1')], [], '캡션')], featured=True)
        other = fx.article(date_on, '다시', '합정동', [fx.stop(0, '12:00', 'B', [fx.photo('o1')], [], '캡션')], recalled=recalled, reason=reason)
        comp = compose({'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([feat, other]))]})
        return page(comp, 'da-article').corner['payload']['articles'][1]['recallReason']

    def test_anniversary_is_n_years_ago(self):
        self.assertEqual(self.reason_of('anniversary'), '1년 전 이맘때')
        self.assertEqual(self.reason_of('anniversary', '2024-09-20'), '2년 전 이맘때')

    def test_the_other_two_reasons_are_empty(self):
        self.assertIsNone(self.reason_of('never_featured'))
        self.assertIsNone(self.reason_of('sparse_month'))

    def test_not_recalled_has_no_reason(self):
        self.assertIsNone(self.reason_of(None, '2026-09-21', recalled=False))

    def test_filled_page_shows_the_label_only_for_anniversary(self):
        templates = r.load_templates()
        feat = fx.article('2026-09-12', '대표', '연남동', [fx.stop(0, '10:00', 'A', [fx.photo('f1')], [], '캡션')], featured=True)
        html = {}
        for reason in ('anniversary', 'never_featured', 'sparse_month'):
            other = fx.article('2025-09-20', '다시', '합정동', [fx.stop(0, '12:00', 'B', [fx.photo('o1')], [], '캡션')], recalled=True, reason=reason)
            comp = compose({'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([feat, other]))]})
            html[reason] = r.fill_page(page(comp, 'da-article'), 'basic', templates)
        self.assertIn('다시 실은 이유', html['anniversary'])
        self.assertIn('1년 전 이맘때', html['anniversary'])
        for reason in ('never_featured', 'sparse_month'):
            self.assertNotIn('다시 실은 이유', html[reason])
            self.assertNotIn('기록이 적은 달', html[reason])
            self.assertNotIn('이전 호 미수록', html[reason])
            self.assertIn('그때 그 시절', html[reason])  # 배지는 남는다


class Lead(unittest.TestCase):
    """R26-5 - @da.lead의 숫자는 지면에 실제로 실린 것: stop당 3장 상한 뒤 사진, 재소환을 뺀 이번 기간 데이트."""

    def test_counts_cap_photos_per_stop_and_exclude_recalled(self):
        feat = fx.article('2026-09-12', '대표', '연남동', [
            fx.stop(0, '10:00', 'A', [fx.photo(f'a{i}') for i in range(5)], [fx.memo('메모')], None),   # 5장 -> 3장
            fx.stop(1, '12:00', 'B', [fx.photo('b1')], [], '캡션')], featured=True)
        second = fx.article('2026-09-21', '둘째', '성수동', [fx.stop(0, '13:00', 'C', [fx.photo(f'c{i}') for i in range(4)], [], '캡션')])
        recalled = fx.article('2025-09-20', '다시', '합정동', [
            fx.stop(0, '12:00', 'D', [fx.photo('d1'), fx.photo('d2')], [fx.memo('옛 메모')], None)], recalled=True, reason='anniversary')
        comp = compose({'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([feat, second, recalled], ['연남동', '성수동']))]})
        lead = page(comp, 'da-opener').computed['da']['lead']
        # 데이트 2번(재소환 뺌) · 구간 3곳 · 사진 3 + 1 + 3 = 7장 · 메모 1개(재소환의 메모는 뺌)
        self.assertEqual(lead, '9월에 두 사람이 함께 보낸 날은 2번이었습니다. 연남동, 성수동, 3곳을 거치며 남긴 7장의 사진과 1개의 메모를 그대로 실었습니다.')

    def test_record_numbers_follow_the_readme_sums(self):
        comp = compose(fx.photo_scenario())
        da = page(comp, 'da-opener').computed['da']
        self.assertEqual(da['stopCount'], 3)
        self.assertEqual(da['photoCount'], 7)  # 1 + 4 + 2 (상한을 적용하지 않는 합 - README §9-②)
        self.assertEqual(da['records'], '남긴 기록 · 메모 2 · AI 캡션 1')
        self.assertEqual(da['startTime'], '14:20')
        self.assertEqual(da['endTime'], '19:00')
        self.assertEqual(da['featuredDate'], '2026.09.12')
        self.assertEqual(da['regionLine'], '연남동, 성수동 · 2026년 9월')

    def test_records_line_is_empty_when_there_is_nothing(self):
        art = fx.article('2026-09-12', '제목', '연남동', [fx.stop(0, '10:00', 'A', [fx.photo('a')], [], None)], featured=True)
        comp = compose({'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([art]))]})
        self.assertEqual(page(comp, 'da-opener').computed['da']['records'], '')

    def test_region_en_is_blank_when_it_cannot_be_romanized(self):
        for region, want in [('연남동', 'Yeonnam-dong'), ('test-region', ''), (None, '')]:
            art = fx.article('2026-09-12', '제목', region, [fx.stop(0, '10:00', 'A', [fx.photo('a')], [], '캡션')], featured=True)
            comp = compose({'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([art]))]})
            self.assertEqual(page(comp, 'da-opener').computed['da']['regionEn'], want)

    def test_places_questions_and_article_values(self):
        comp = compose(fx.photo_scenario())
        places = page(comp, 'da-places').computed['da']
        self.assertEqual(places['routeSummary'], '2개 지역 · 6개 장소')
        self.assertEqual(places['routeHeadline'], '9월에 두 사람이 그린 지도')
        self.assertEqual(places['places'][0], {'date': '09.12', 'placeName': '홍대입구역'})
        self.assertEqual([q['type'] for q in page(comp, 'da-places').corner['payload']['articles'][0]['closingQuestions']], ['평가', '회상', '제안'])
        art = page(comp, 'da-article').computed['da']
        self.assertEqual(art['articleNo'], '02')
        self.assertEqual(art['articleDate'], '2026.09.21')
        self.assertEqual(art['articleRoute'], '성수동 서점')  # placeName null인 stop은 건너뛴다
        self.assertEqual(art['articlePhotoCount'], 3)
        self.assertEqual(art['articleNoteCount'], 1)
        self.assertEqual(art['articleStopCount'], 2)
        self.assertEqual(art['articleCaptionCount'], 1)
        self.assertEqual([p['path'] for p in art['articlePhotos']], [fx.dest('e08'), fx.dest('e09'), fx.dest('e10')])
        self.assertEqual(art['articlePhotos'][0]['caption'], '서점에서 책을 골랐다')
        self.assertEqual(art['articlePhotos'][1]['caption'], '')

    def test_places_are_capped_and_the_rest_is_reported_as_not_posted(self):
        stops = [fx.stop(i, f'{10 + i}:00', f'장소{i}', [fx.photo(f'z{i}')], [], '캡션') for i in range(12)]
        art = fx.article('2026-09-12', '제목', '연남동', stops, featured=True)
        comp = compose({'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([art]))]})
        self.assertEqual(len(page(comp, 'da-places').computed['da']['places']), 8)
        notes = page(comp, 'note').computed['note']['notUsed']
        self.assertTrue(any(n.startswith('장소 4곳') for n in notes), notes)


class Sentences(unittest.TestCase):
    def test_count_sentences(self):
        self.assertEqual(count_sentences('오늘 비 온대. 우산 챙겼어?'), 2)
        self.assertEqual(count_sentences('스파이더맨 봤다.\n서영이는 중간에 졸았음'), 2)
        self.assertEqual(count_sentences('응'), 1)
        self.assertEqual(count_sentences('😂'), 1)
        self.assertEqual(count_sentences('   '), 0)
        self.assertEqual(count_sentences(None), 0)
        self.assertEqual(count_sentences('아... 진짜?! 그래'), 3)

    def test_breakdown_by_kind_and_ratio(self):
        comp = compose(fx.photo_scenario())
        summary = comp.report['sentences']
        by = summary['byKind']
        # 두 사람: 대표 기사 타임라인에 실린 메모 둘(2문장 + 줄바꿈 2문장) · 인용 turn 문장 6 · sub 2 · 근거 발췌(15자 이하) 1
        self.assertEqual(by['people:userNotes'], 2 + 2)
        self.assertEqual(by['people:turns'], 2 + 2 + 1 + 1)
        self.assertEqual(by['people:sub'], 2)
        self.assertEqual(by['people:evidenceExcerpt'], 1)    # '연남동 또 가자' 한 개 - 긴 발췌는 지면에 날짜만
        self.assertEqual(summary['people'], 4 + 6 + 2 + 1)
        self.assertEqual(by['ondolog:fixedFrame'], 2 + 1 + 1)  # @da.lead 2문장 · @da.routeHeadline · @back.closing
        self.assertEqual(by['ondolog:context'], 2)
        self.assertEqual(by['ondolog:closingQuestions'], 3 + 1)  # 질문 3 + suggestion의 basis 1
        self.assertEqual(by['ondolog:lead'], 1)
        self.assertEqual(by['ondolog:closing'], 1)
        self.assertEqual(summary['people'] + summary['ondolog'], sum(by.values()))
        note = page(comp, 'note').computed['note']
        total = summary['people'] + summary['ondolog']
        self.assertEqual(note['sentencesPeople'], f"{summary['people']}개")
        self.assertEqual(note['sentencesOndolog'], f"{summary['ondolog']}개")
        pct = int(note['ratioPeople'].rstrip('%'))
        self.assertEqual(pct + int(note['ratioOndolog'].rstrip('%')), 100)
        self.assertEqual(pct, int(summary['people'] * 100 / total + 0.5))

    def test_skipped_corner_adds_no_sentences(self):
        by = compose(fx.skipped_scenario()).report['sentences']['byKind']
        self.assertNotIn('people:turns', by)
        self.assertNotIn('ondolog:context', by)

    def test_sentences_are_counted_once_per_source_not_per_appearance(self):
        # 표지의 표제·이 달의 말은 같은 원천을 다시 보인다 - 따로 세지 않는다
        comp = compose(fx.type_scenario())
        by = comp.report['sentences']['byKind']
        self.assertEqual(by['people:turns'], 2 + 2 + 1 + 1 + 1 + 1 + 1)


class Note(unittest.TestCase):
    def test_material_rows_with_zero_collected_are_deleted(self):
        comp = compose(fx.photo_scenario(), {'messages': 0, 'photos': 14, 'dates': 3, 'memos': 0})
        rows = page(comp, 'note').computed['note']['materials']
        self.assertEqual([r_['label'] for r_ in rows], ['데이트', '사진'])
        self.assertEqual(rows[1], {'label': '사진', 'collected': '14장', 'used': f'{len(comp.shown_photos)}장'})
        self.assertEqual(rows[0]['used'], '2번')  # 재소환을 뺀 이번 기간 데이트

    def test_without_materials_there_is_no_row(self):
        comp = compose(fx.photo_scenario(), None)
        self.assertEqual(page(comp, 'note').computed['note']['materials'], [])

    def test_conversation_row_counts_quotes(self):
        comp = compose(fx.photo_scenario(), {'messages': 120})
        row = page(comp, 'note').computed['note']['materials'][0]
        self.assertEqual(row, {'label': '대화', 'collected': '120개', 'used': '인용 6개'})

    def test_not_used_lists_what_the_layout_left_out(self):
        notes = page(compose(fx.photo_scenario()), 'note').computed['note']['notUsed']
        self.assertIn('사진 1장 — 한 구간에 3장까지 싣습니다', notes)         # 연남동 카페 4장 중 1장
        self.assertIn('메모 1개 — 대표가 아닌 기사에는 개수만 적습니다', notes)
        self.assertIn('근거 사진 1장 — 이달의 우리에는 개수만 적습니다', notes)

    def test_nothing_left_out_says_so(self):
        art = fx.article('2026-09-12', '제목', '연남동', [fx.stop(0, '10:00', 'A', [fx.photo('a')], [fx.memo('메모')], None)], featured=True)
        comp = compose({'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([art]))]})
        self.assertEqual(page(comp, 'note').computed['note']['notUsed'], ['모두 실었습니다'])
        self.assertEqual(page(comp, 'note').computed['note']['emptyCorners'], ['이번 호에는 없습니다'])

    def test_empty_corners_say_why_in_plain_words(self):
        empty = page(compose(fx.skipped_scenario()), 'note').computed['note']['emptyCorners']
        self.assertEqual(empty, ['다정한 말들 — 인용할 만한 대화를 찾지 못했습니다'])
        sc = fx.photo_scenario()
        sc['corners'][2] = fx.corner_row('this_month', None, status='failed', skip_reason='schema_invalid')
        self.assertEqual(page(compose(sc), 'note').computed['note']['emptyCorners'], ['이달의 우리 — 이번 호에 싣지 못했습니다'])

    def test_note_has_no_adjectives_it_only_names_and_counts(self):
        # 평가어가 들어가지 않는다(CORNER_LAYOUT §3-0) - 노트가 만드는 모든 글을 훑는다
        note = page(compose(fx.photo_scenario(), {'messages': 5, 'photos': 9, 'dates': 3, 'memos': 4}), 'note').computed['note']
        text = ' '.join(note['notUsed'] + note['emptyCorners'])
        for word in ('풍성', '아쉽', '훌륭', '많은', '적은', '다정', '좋은'):
            self.assertNotIn(word, text)


class ThisMonth(unittest.TestCase):
    def test_evidence_line_rules(self):
        line = _Builder.evidence_line
        self.assertEqual(line([fx.ev_message('연남동 또 가자'), fx.ev_date('2026-09-12')]), '근거 · “연남동 또 가자” · 2026.09.12')
        # 15자 초과 발췌는 날짜만
        self.assertEqual(line([fx.ev_message('1234567890123456', '2026-09-03')]), '근거 · 2026.09.03')
        self.assertEqual(line([fx.ev_message('123456789012345')]), '근거 · “123456789012345”')
        # 사진 근거는 개수를 합친다
        self.assertEqual(line([fx.ev_photo('a'), fx.ev_message('좋아'), fx.ev_photo('b')]), '근거 · 사진 2장 · “좋아”')
        self.assertEqual(line([]), '')

    def test_signals_are_capped_at_three_and_seq_is_two_digits(self):
        sc = fx.photo_scenario()
        tm = copy.deepcopy(sc['corners'][2]['content'])
        tm['payload']['theme']['signals'] = [{'kind': 'place', 'value': f'v{i}', 'count': i + 1} for i in range(5)]
        sc['corners'][2] = fx.corner_row('this_month', tm, seq=3)
        comp = compose(sc)
        self.assertEqual(len(page(comp, 'tm-lead').corner['payload']['theme']['signals']), 3)
        self.assertEqual([a['seq'] for a in page(comp, 'tm-articles').corner['payload']['articles']], ['01', '02', '03'])

    def test_no_photo_is_bound_to_tm_articles(self):
        for a in page(compose(fx.photo_scenario()), 'tm-articles').corner['payload']['articles']:
            self.assertNotIn('photo', a)


class Back(unittest.TestCase):
    def test_closing_next_month_and_names(self):
        comp = compose(fx.photo_scenario())
        back = page(comp, 'back').computed
        self.assertEqual(back['back']['closing'], '9월의 온도를\n여기에 두고 갑니다')
        self.assertEqual(back['back']['nextMonth'], 'October 2026')
        self.assertEqual(back['issue']['names'], 'test-세준 · test-서영')
        self.assertEqual(back['issue']['month'], '9월호')
        self.assertEqual(back['issue']['period'], '9월 1일 ~ 9월 30일')

    def test_december_rolls_over_to_january(self):
        issue = {**fx.ISSUE_ROW, 'period_start': '2026-12-01', 'period_end': '2026-12-31'}
        sc = fx.photo_scenario()
        comp = compose_issue(issue, {**fx.COUPLE_ROW}, NAMES, sc['corners'], None)
        self.assertEqual(page(comp, 'back').computed['back']['nextMonth'], 'January 2027')


class Coverage(unittest.TestCase):
    """지면이 요구하는 코너 밖 이름(`@...`)을 compose가 빠짐없이 정의한다 - 디자인이 새 이름을 넣어 다시 넘기면 여기서 걸린다."""

    def test_every_at_name_in_every_page_is_defined(self):
        import re
        templates = r.load_templates()
        from slot_fill import Context, resolve
        seen = set()
        for scenario in (fx.photo_scenario(), fx.type_scenario(), fx.skipped_scenario()):
            comp = compose(scenario, {'messages': 1, 'photos': 1, 'dates': 1, 'memos': 1})
            for p in comp.pages:
                html = templates[p.stem]
                for attr in ('data-slot', 'data-src', 'data-if', 'data-repeat'):
                    for path in re.findall(attr + r'="(!?@[^"]+)"', html):
                        path = path.lstrip('!')
                        seen.add(path)
                        self.assertIsNotNone(resolve(path, None, Context(p.corner, p.computed, p.bind)), (p.stem, path))
        for name in ('@issue.month', '@cover.headline', '@toc', '@contents.photo', '@note.materials', '@note.ratioPeople', '@back.closing',
                     '@back.nextMonth', '@page', '@da.lead', '@da.regionEn', '@da.articlePhotos', '@sw.openerPhoto', '@da.places'):
            self.assertIn(name, seen)

    def test_every_corner_path_in_every_page_resolves_or_is_a_documented_empty(self):
        """코너 안 경로(`payload.*`·`header.*`)도 채운 데이터에서 풀린다 - 값이 없을 수 있는 것은 아래 둘과 사진 경로뿐이다."""
        import re
        templates = r.load_templates()
        from slot_fill import Context, resolve
        may_be_empty = {'payload.warmthIndex',               # 산출식이 없어 늘 null(CORNER_CONTENT §10)
                        'payload.articles[i].recallReason'}  # anniversary가 아니면 빈 값(R26-4)
        for scenario in (fx.photo_scenario(), fx.type_scenario()):
            comp = compose(scenario)
            for p in comp.pages:
                html = templates[p.stem]
                for attr in ('data-slot', 'data-src', 'data-if'):
                    for path in re.findall(attr + r'="!?((?:payload|header)[^"]*)"', html):
                        value = resolve(path, None, Context(p.corner, p.computed, p.bind))
                        if value is None and path not in may_be_empty and not path.endswith('.photos[0].path'):
                            self.fail((p.stem, path))


class Immutability(unittest.TestCase):
    def test_compose_does_not_change_the_stored_content(self):
        sc = fx.photo_scenario()
        before = copy.deepcopy(sc)
        compose(sc)
        self.assertEqual(sc, before)  # 원문은 고치지 않는다 - 보기 사본만 만든다


if __name__ == '__main__':
    unittest.main()
