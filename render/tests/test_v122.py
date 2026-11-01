"""디자인 v1.2.2 지면 맞춤 시험 (위임: 55-3). 네트워크 없음. 실제 Chromium을 쓰는 시험은 `Browser` 묶음뿐이다.

실행 (저장소 루트에서): render/.venv/Scripts/python.exe -B -m unittest discover -s render/tests
"""

import copy
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
import render_issue as r  # noqa: E402
import width_compare  # noqa: E402
from compose import (  # noqa: E402
    ComposeError, caption_memo_count, compose_issue, conversation_height, hhmm, mmdd_hhmm, mmdd_or_ymd, ordinal_en, pack_quotes, photo_note,
    split_timeline, stop_height, text_lines,
)
from page_audit import mark_original_overset, original_clipped, original_overset  # noqa: E402
from slot_fill import fill, parse_width  # noqa: E402

NAMES = [fx.A, fx.B]
TEMPLATES = r.load_templates()
ROOMY = {'messages': 1000, 'photos': 1000, 'dates': 100, 'memos': 100}   # 모은 양이 게재보다 늘 크다 - 이 시험들은 숫자가 아니라 지면 구조를 본다 (R50-2 정합은 test_facts.py)


def compose(scenario, materials=None, couple=None):
    couple = {**fx.COUPLE_ROW, 'magazine_theme': scenario['theme'], **(couple or {})}
    return compose_issue(fx.ISSUE_ROW, couple, NAMES, scenario['corners'], materials)


def pages(comp, stem):
    return [p for p in comp.pages if p.stem == stem]


def filled(comp, stem, nth=0):
    return r.fill_page(pages(comp, stem)[nth], comp.theme, TEMPLATES)


def text_of(html):
    return BeautifulSoup(html, 'html.parser').get_text(' ', strip=True)


def one_article_scenario(photos=3, notes=False, caption='캡션', recalled_second=False, theme='basic'):
    stop = fx.stop(0, '10:00', 'A', [fx.photo(f'a{i}') for i in range(photos)], [fx.memo('메모')] if notes else [], caption)
    feat = fx.article('2026-09-12', '대표', '연남동', [stop], featured=True)
    arts = [feat]
    if recalled_second is not None:
        arts.append(fx.article('2025-09-20', '다시', '합정동', [fx.stop(0, '12:00', 'B', [fx.photo(f'b{i}') for i in range(6)], [], '캡션')],
                               recalled=True, reason='anniversary'))
    return {'theme': theme, 'corners': [fx.corner_row('date_archive', fx.date_archive(arts))]}


# ---------------------------------------------------------------------------
# data-width (범위 1)
# ---------------------------------------------------------------------------

class Width(unittest.TestCase):
    def test_parse_width(self):
        for good, want in [(0, 0), (100, 100), (34, 34), (33.5, 33.5), ('34', 34), (' 34 ', 34), ('0', 0)]:
            self.assertEqual(parse_width(good), want, good)
        for bad in [None, '', '  ', 'abc', 120, -5, 100.01, '120', '-5', True, False, float('nan'), float('inf'), [], {}, '3 4', '34%', '0%', ' 34% ']:
            self.assertIsNone(parse_width(bad), bad)

    def test_width_replaces_the_fixed_width_and_keeps_other_declarations(self):
        html = fill('<div data-width="@w" style="width:42%;min-width:0;flex:1;background:repeating-linear-gradient(45deg,red 0 1px,blue 1px 6px)">x</div>',
                    None, {'w': 34})
        style = BeautifulSoup(html, 'html.parser').div['style']
        self.assertIn('width:34%', style)
        self.assertNotIn('42%', style)
        self.assertIn('min-width:0', style)
        self.assertIn('flex:none', style)
        self.assertNotIn('flex:1', style)
        self.assertIn('repeating-linear-gradient(45deg,red 0 1px,blue 1px 6px)', style)

    def test_missing_out_of_range_or_not_a_number_removes_the_element_instead_of_failing(self):
        for value in (None, 120, -5, 'abc'):
            html = fill('<p><span data-width="@w" style="width:42%">bar</span><i>kept</i></p>', None, {'w': value})
            self.assertNotIn('bar', html)
            self.assertIn('kept', html)
        self.assertNotIn('bar', fill('<p><span data-width="@missing">bar</span></p>', None, {}))   # 경로 자체가 없다

    def test_mark_is_kept_in_the_output(self):
        self.assertIn('data-width="@w"', fill('<div data-width="@w" style="width:1%">x</div>', None, {'w': 50}))

    def test_order_optional_then_width(self):
        # optional 판정은 폭이 지울 요소의 슬롯도 센다(디자인 resolve.js와 같은 순서) - 지운 폭 요소 때문에 부모가 사라지지 않는다
        html = fill('<section data-optional><span data-width="@w" data-slot="@t">x</span></section>', None, {'w': None, 't': '34%'})
        self.assertIn('<section data-optional="">', html)
        self.assertNotIn('data-width', html)  # 폭 요소는 지워졌다
        # optional이 먼저 지우면 폭은 계산하지 않는다
        self.assertEqual(fill('<section data-optional><span data-width="@w" data-slot="@t">x</span></section>', None, {'w': 50, 't': ''}), '')

    def test_if_false_branch_is_not_evaluated(self):
        self.assertEqual(fill('<div data-if="@no"><b data-width="@w">x</b></div>', None, {'w': 5}), '')

    def test_note_page_bars_follow_the_data(self):
        comp = compose(fx.photo_scenario(), ROOMY)
        note = pages(comp, 'note')[0].computed['note']
        soup = BeautifulSoup(filled(comp, 'note'), 'html.parser')
        people = int(note['ratioPeople'].rstrip('%'))
        self.assertIn(f'width:{people}%', soup.find(attrs={'data-width': '@note.ratioPeople'})['style'])
        self.assertIn(f"width:{100 - people}%", soup.find(attrs={'data-width': '@note.ratioOndolog'})['style'])
        self.assertNotIn('42%', str(soup.find(attrs={'data-width': '@note.ratioPeople'})['style']))

    def test_no_sentences_means_no_ratio_and_no_bars(self):
        comp = compose(fx.photo_scenario())
        spec = pages(comp, 'note')[0]
        spec.computed['note']['ratioPeople'] = ''
        spec.computed['note']['ratioOndolog'] = ''
        spec.widths = {}
        html = r.fill_page(spec, comp.theme, TEMPLATES)
        self.assertNotIn('data-width', html)
        self.assertNotIn('두 사람 0%', html)


# ---------------------------------------------------------------------------
# v1.2 슬롯 바인딩 (범위 2)
# ---------------------------------------------------------------------------

class Bindings(unittest.TestCase):
    def test_ordinals(self):
        self.assertEqual([ordinal_en(n) for n in (1, 2, 3, 4, 5, 6, 12)], ['One', 'Two', 'Three', 'Four', 'Five', '6', '12'])

    def test_featured_uses_its_real_position(self):
        a = fx.article('2026-09-05', '첫째', '합정동', [fx.stop(0, '10:00', 'A', [fx.photo('a')], [], '캡션')])
        b = fx.article('2026-09-12', '대표', '연남동', [fx.stop(0, '10:00', 'B', [fx.photo('b')], [], '캡션')], featured=True)
        comp = compose({'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([a, b]))]})
        self.assertEqual(pages(comp, 'da-opener')[0].computed['da']['featuredOrdinalEn'], 'Two')
        self.assertEqual(pages(comp, 'da-article')[0].computed['da']['articleOrdinalEn'], 'One')
        self.assertIn('Article Two', text_of(filled(comp, 'da-opener')).replace('  ', ' '))
        self.assertIn('Article One', text_of(filled(comp, 'da-article')))

    def test_running_head_phrase_only_for_a_recalled_article(self):
        feat = fx.article('2026-09-12', '대표', '연남동', [fx.stop(0, '10:00', 'A', [fx.photo('a')], [], '캡션')], featured=True)
        plain = fx.article('2026-09-21', '둘째', '성수동', [fx.stop(0, '10:00', 'B', [fx.photo('b')], [], '캡션')])
        again = fx.article('2025-09-20', '다시', '합정동', [fx.stop(0, '12:00', 'C', [fx.photo('c')], [], '캡션')], recalled=True, reason='anniversary')
        comp = compose({'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([feat, plain, again]))]})
        self.assertEqual(text_of(filled(comp, 'da-article', 0)).count('그때 그 시절'), 0)    # 재소환이 아니면 러닝헤드에도 배지에도 없다
        self.assertEqual(text_of(filled(comp, 'da-article', 1)).count('그때 그 시절'), 2)    # 러닝헤드 + 배지

    def test_photo_note(self):
        self.assertEqual(photo_note(6, 3), '그날 남은 사진 6장 중 3장')
        self.assertEqual(photo_note(3, 3), '그날 남은 사진 3장')
        self.assertEqual(photo_note(2, 2), '그날 남은 사진 2장')
        self.assertEqual(photo_note(0, 0), '')

    def test_photo_note_on_the_page_and_the_block_is_deleted_without_photos(self):
        comp = compose(one_article_scenario())
        art = pages(comp, 'da-article')[0].computed['da']
        self.assertEqual(art['articlePhotoNote'], '그날 남은 사진 6장 중 3장')
        self.assertIn('그날 남은 사진 6장 중 3장', filled(comp, 'da-article'))
        # 사진이 하나도 없는 기사는 R48-3 ①로 지면을 짜지 않는다(`R48Temporary`). 여기서는 사진 목록이 빈 값일 때 블록이 지워지는 것만 본다
        spec = pages(comp, 'da-article')[0]
        spec.computed['da']['articlePhotos'] = []
        spec.computed['da']['articlePhotoNote'] = ''
        html = r.fill_page(spec, comp.theme, TEMPLATES)
        self.assertNotIn('그날 남은 사진', html)
        self.assertEqual(html.count(' src="'), 1)   # 히어로 사진 하나뿐 - 블록 안 사진이 없다

    def test_opener_photo_is_the_first_photo_of_all_stops(self):
        comp = compose(fx.opener_fallback_scenario())
        opener = pages(comp, 'da-opener')[0]
        self.assertEqual(opener.computed['da']['openerPhoto'], fx.dest('e02'))   # 첫 stop은 사진이 없다 -> 다음 stop의 첫 사진
        html = filled(comp, 'da-opener')
        self.assertIn('data-variant="with-photo"', html)
        self.assertNotIn('data-variant="type-only"', html)
        self.assertIn(f'src="{fx.dest("e02")}"', html)

    def test_opener_is_type_only_when_the_featured_article_has_no_photo_at_all(self):
        comp = compose(fx.opener_type_only_scenario())
        self.assertEqual(pages(comp, 'da-opener')[0].computed['da']['openerPhoto'], '')
        html = filled(comp, 'da-opener')
        self.assertIn('data-variant="type-only"', html)
        self.assertNotIn('data-variant="with-photo"', html)
        self.assertNotIn('<img', html)
        self.assertIn('연남동, 성수동', text_of(html))                      # 활자 변형은 지역·기간 줄을 보인다

    def test_sweet_words_opener_variant_still_follows_its_own_source(self):
        comp = compose(fx.photo_scenario())
        self.assertIn('data-variant="with-photo"', filled(comp, 'sw-opener'))

    def test_warmth_index_range_is_optional(self):
        comp = compose(fx.photo_scenario())
        html = filled(comp, 'sw-opener')
        self.assertNotIn('다정 지수', html)                               # 산출식이 없어 null -> 라벨째 빠진다
        self.assertIn('2026년 9월', html)                                 # 기간은 남는다
        spec = pages(comp, 'sw-opener')[0]
        spec.corner['payload']['warmthIndex'] = 72
        self.assertIn('다정 지수', r.fill_page(spec, comp.theme, TEMPLATES))

    def test_toc_desc_fixed_frames_without_adjectives(self):
        toc = compose(fx.photo_scenario()).report['toc']
        self.assertEqual(toc[0]['desc'], '화보 · 9월의 하루 2편 · 그때 그 시절 1편')   # 실은 이번 기간 기사 · 재소환 기사를 따로 (R50-2)
        self.assertEqual(toc[1]['desc'], '인용 · 원문 그대로')
        self.assertEqual(toc[2]['desc'], '기사 · 연남동을 자주 걸은 달 · 소기사 3편')

    def test_time_notation(self):
        for raw, want in [('14:20', '14:20'), ('9:05', '09:05'), ('00:00', '00:00'), ('14:20:00', '14:20'), ('2026-09-12T08:07:00+09:00', '08:07'),
                          ('24:00', '24:00'), ('오후 2시', '오후 2시'), (None, None)]:
            self.assertEqual(hhmm(raw), want, raw)

    def test_time_notation_on_the_pages(self):
        stops = [fx.stop(0, '9:05', 'A', [], [], '캡션'), fx.stop(1, '20:05:00', 'B', [], [], '캡션')]
        art = fx.article('2026-09-12', '대표', '연남동', stops, featured=True)
        comp = compose({'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([art]))]})
        da = pages(comp, 'da-opener')[0].computed['da']
        self.assertEqual((da['startTime'], da['endTime']), ('09:05', '20:05'))
        times = [s['time'] for s in pages(comp, 'da-timeline')[0].corner['payload']['articles'][0]['stops']]
        self.assertEqual(times, ['09:05', '20:05'])
        self.assertEqual(art['stops'][0]['time'], '9:05')                    # 저장된 content는 그대로

    def test_seq_is_two_digits_and_zero_based_gets_plus_one(self):
        comp = compose(fx.photo_scenario())
        self.assertEqual([a['seq'] for a in pages(comp, 'tm-articles')[0].corner['payload']['articles']], ['01', '02', '03'])
        sc = fx.photo_scenario()
        tm = copy.deepcopy(sc['corners'][2]['content'])
        for a in tm['payload']['articles']:
            a['seq'] += 1                                                    # 1부터인 자료는 그대로 쓴다
        sc['corners'][2] = fx.corner_row('this_month', tm, seq=3)
        self.assertEqual([a['seq'] for a in pages(compose(sc), 'tm-articles')[0].corner['payload']['articles']], ['01', '02', '03'])

    def test_evidence_date_notation(self):
        self.assertEqual(mmdd_or_ymd('2026-08-22', 2026), '08.22')
        self.assertEqual(mmdd_or_ymd('2026-08-22T20:10:00+09:00', 2026), '08.22')
        self.assertEqual(mmdd_or_ymd('2025-08-20', 2026), '2025.08.20')               # 다른 해
        self.assertEqual(mmdd_or_ymd('2026-03-02', 2026, {'2026-03-02'}), '2026.03.02')  # 재소환 기사의 날짜는 같은 해여도 연도
        self.assertEqual(mmdd_or_ymd('not a date', 2026), '')

    def test_evidence_date_of_a_recalled_article_gets_the_year_on_the_page(self):
        sc = fx.photo_scenario()
        tm = copy.deepcopy(sc['corners'][2]['content'])
        tm['payload']['articles'][2]['evidence'] = [fx.ev_date('2025-09-20'), fx.ev_date('2026-09-21')]
        sc['corners'][2] = fx.corner_row('this_month', tm, seq=3)
        comp = compose(sc)
        line = pages(comp, 'tm-articles')[0].corner['payload']['articles'][2]['evidence']
        self.assertEqual(line, '근거 · 2025.09.20 · 09.21')

    def test_caption_has_no_prefix_and_the_label_is_its_own_line(self):
        comp = compose(fx.photo_scenario())
        label_blocks, notes = [], []
        for i in range(len(pages(comp, 'da-timeline'))):
            soup = BeautifulSoup(filled(comp, 'da-timeline', i), 'html.parser')
            label_blocks += [el for el in soup.find_all('div') if el.get('data-if') == '.aiCaption']
            notes += [el for el in soup.find_all('div') if el.get('data-if') == '.userNotes']
        self.assertTrue(label_blocks)
        for block in label_blocks:
            self.assertEqual(block.find('span').get_text(strip=True), 'AI 캡션')       # 별도 줄 라벨
            self.assertFalse(block.find('p').get_text(strip=True).startswith('AI 캡션'))   # 문장 앞 접두 없음
        # 유저 메모에는 라벨이 없다
        self.assertTrue(notes)
        self.assertTrue(all('AI 캡션' not in n.get_text() for n in notes))
        art = pages(compose(fx.photo_scenario()), 'da-article')[0].computed['da']['articlePhotos']
        self.assertFalse(any(p['caption'].startswith('AI 캡션') for p in art))

    def test_tm_articles_gets_no_photo_and_falls_to_one_column(self):
        for n in (2, 3, 4):
            sc = fx.photo_scenario() if n == 3 else fx.type_scenario()
            tm = copy.deepcopy(sc['corners'][2]['content'])
            tm['payload']['articles'] = [copy.deepcopy(tm['payload']['articles'][0]) for _ in range(n)]
            sc['corners'][2] = fx.corner_row('this_month', tm, seq=3)
            html = filled(compose(sc), 'tm-articles')
            soup = BeautifulSoup(html, 'html.parser')
            self.assertEqual(len(soup.find_all(class_='art-ph')), 0, n)    # 사진 틀이 빠졌다(미사용 사진으로 대신하지 않는다)
            self.assertEqual(len(soup.find_all('img')), 0, n)
            self.assertIn(f'data-variant="grid-{n}"', html)            # 변형 선택은 개수가 한다 - 한 단은 CSS가 내린다


# ---------------------------------------------------------------------------
# 원문 불변 (범위 4)
# ---------------------------------------------------------------------------

README_QUOTE_TABLE = {   # README §12 - 턴 수 -> {글자 수: 높이}
    1: {12: 177, 30: 177, 60: 199, 100: 221, 160: 243},
    2: {12: 241, 30: 241, 60: 285, 100: 329, 160: 372},
    3: {12: 305, 30: 305, 60: 371, 100: 436, 160: 502},
    4: {12: 369, 30: 369, 60: 456, 100: 544, 160: 631},
}


def main_of(turns, chars):
    return {'turns': [{'speaker': fx.A, 'text': fx.exact_text(fx.LONG_SEED, chars), 'at': 'x'} for _ in range(turns)]}


class Quotes(unittest.TestCase):
    def test_exact_text_has_the_exact_length(self):
        for n in (12, 30, 60, 100, 160, 400):
            self.assertEqual(len(fx.exact_text(fx.LONG_SEED, n)), n)

    def test_lines(self):
        self.assertEqual([text_lines('가' * n) for n in (1, 35, 36, 70, 71)], [1, 1, 2, 2, 3])
        self.assertEqual(text_lines('한 줄\n둘째 줄'), 2)           # 원문의 줄바꿈마다 새 줄
        self.assertEqual(text_lines(''), 1)

    def test_conversation_height_matches_the_readme_table(self):
        for turns, row in README_QUOTE_TABLE.items():
            for chars, want in row.items():
                got = conversation_height(main_of(turns, chars))
                if chars <= 100:
                    self.assertAlmostEqual(got, want, delta=2, msg=(turns, chars))   # 표는 반올림한 실측이다
                else:   # 160자는 한 줄을 35자로 잡아 5줄로 센다 - 표(4줄)보다 크게 잡는 쪽이다. 작게 잡지는 않는다
                    self.assertGreaterEqual(got, want, (turns, chars))
                    self.assertLessEqual(got, want + 22 * turns + 2, (turns, chars))

    def test_pack_boundary_844(self):
        self.assertEqual(pack_quotes([844], 0), [[0]])
        self.assertEqual(pack_quotes([844], 2), [[0]])
        with self.assertRaises(ComposeError):
            pack_quotes([845], 0)

    def test_pack_boundary_781_with_three_or_more_short_quotes(self):
        self.assertEqual(pack_quotes([781], 3), [[0]])
        self.assertEqual(pack_quotes([781], 6), [[0]])
        with self.assertRaises(ComposeError) as ctx:
            pack_quotes([782], 3)
        self.assertIn('781px', str(ctx.exception))
        self.assertEqual(pack_quotes([782], 2), [[0]])             # 단문 2개면 844
        self.assertEqual(pack_quotes([782], 0), [[0]])

    def test_conversations_are_never_split_across_pages(self):
        self.assertEqual(pack_quotes([400, 444], 0), [[0, 1]])      # 844 정확히
        self.assertEqual(pack_quotes([400, 445], 0), [[0], [1]])
        self.assertEqual(pack_quotes([400, 400], 3), [[0], [1]])    # 800 > 781 - 단문과 함께 실리는 마지막 면만 좁다
        self.assertEqual(pack_quotes([400, 400], 2), [[0, 1]])
        self.assertEqual(pack_quotes([700, 700, 700], 0), [[0], [1], [2]])
        self.assertEqual(pack_quotes([300, 300, 300, 300], 0), [[0, 1], [2, 3]])
        for heights in ([100] * 9, [300, 500, 200, 800, 100], [844, 1, 844]):
            groups = pack_quotes(heights, 1)
            self.assertEqual([i for g in groups for i in g], list(range(len(heights))))   # 순서 그대로, 하나도 빠지지 않는다

    def test_two_conversations_of_four_turns_x_160_chars_do_not_fit_on_one_page(self):
        h = conversation_height(main_of(4, 160))
        self.assertGreater(2 * h, 844)                              # README §12 - 2 x 631 = 1262
        self.assertEqual(pack_quotes([h, h], 0), [[0], [1]])

    def test_overlong_conversation_failure_names_issue_conversation_and_height(self):
        with self.assertRaises(ComposeError) as ctx:
            compose(fx.long_original_scenario(with_overlong=True))
        msg = str(ctx.exception)
        self.assertIn(fx.ISSUE, msg)
        self.assertIn('3번째 대화(밤새 이어진 가장 긴 대화)', msg)
        self.assertIn('1337px', msg)
        self.assertIn('844px', msg)

    def test_the_same_issue_passes_without_that_conversation_and_the_text_is_untouched(self):
        sc = fx.long_original_scenario()
        before = copy.deepcopy(sc)
        comp = compose(sc)
        quotes = pages(comp, 'sw-quotes')
        self.assertEqual(len(quotes), 2)
        self.assertEqual(len(quotes[0].corner['payload']['sub']), 0)
        self.assertEqual(len(quotes[1].corner['payload']['sub']), 2)
        for q, main in zip(quotes, before['corners'][1]['content']['payload']['main']):
            for shown, original in zip(q.corner['payload']['main'][0]['turns'], main['turns']):
                self.assertEqual(shown['text'], original['text'])         # 글자 하나도 줄지 않았다
        self.assertEqual(sc, before)

    def test_quote_text_is_never_shortened_anywhere_in_the_output(self):
        comp = compose(fx.long_original_scenario())
        html = ' '.join(filled(comp, 'sw-quotes', i) for i in range(2))
        for main in fx.long_original_scenario()['corners'][1]['content']['payload']['main']:
            for t in main['turns']:
                self.assertIn(t['text'], text_of(html).replace('  ', ' '))
        self.assertNotIn('…', html)


def stop_of(photos, memo_chars=None, caption='캡션'):
    notes = [fx.memo(fx.exact_text('메모', memo_chars))] if memo_chars else []
    return fx.stop(0, '10:00', '장소', [fx.photo(f'x{i}') for i in range(photos)], notes, caption)


class TimelineMemo(unittest.TestCase):
    def test_memo_up_to_50_chars_is_the_table_value(self):
        self.assertEqual([stop_height(stop_of(1, n)) for n in (1, 20, 50)], [390, 390, 390])

    def test_each_50_chars_beyond_adds_29px(self):
        self.assertEqual([stop_height(stop_of(1, n)) for n in (51, 100, 101, 150, 200)], [419, 419, 448, 448, 477])
        self.assertEqual(stop_height(stop_of(0, 100)), 148 + 29)

    def test_a_long_memo_moves_the_stop_to_the_next_page(self):
        short = [stop_of(1, 50), stop_of(1, 50), stop_of(0, 50)]            # 390 + 390 + 148 = 928
        self.assertEqual([len(p) for p in split_timeline(short)[0]], [3])
        longer = [stop_of(1, 50), stop_of(1, 50), stop_of(0, 150)]          # 148 + 58 -> 986 > 953
        self.assertEqual([len(p) for p in split_timeline(longer)[0]], [2, 1])

    def test_one_stop_over_a_page_stops_instead_of_cutting_the_memo(self):
        with self.assertRaises(ComposeError) as ctx:
            split_timeline([stop_of(3, 3000)])
        self.assertIn('한 면을 넘는다', str(ctx.exception))
        scenario = fx.photo_scenario()
        scenario['corners'][0]['content']['payload']['articles'][0]['stops'][0]['userNotes'] = [fx.memo(fx.exact_text('긴 메모', 3000))]
        with self.assertRaises(ComposeError) as ctx2:
            compose(scenario)
        self.assertIn(fx.ISSUE, str(ctx2.exception))

    def test_memo_text_in_the_page_is_whole(self):
        sc = fx.long_original_scenario()
        memo_text = sc['corners'][0]['content']['payload']['articles'][0]['stops'][0]['userNotes'][0]['text']
        comp = compose(sc)
        self.assertIn(memo_text, text_of(filled(comp, 'da-timeline', 0)))


class LeadEqualsNote(unittest.TestCase):
    """55-3 D안 - 오프너 문장의 사진·메모 = 재소환을 뺀 이번 기간 기사 중 지면에 실린 것. 발행 노트 '실제 게재'는 호 전체 그대로다.
    시험: 오프너 + 나머지(재소환 기사에 실린 것 · 표지 등 오프너 범위 밖에 실린 것) = 노트. 숫자는 같은 집합에서 나온다(하드코딩 없음)."""

    @staticmethod
    def many():
        w, h = 1200, 1600
        feat = fx.article('2026-09-12', '대표', '연남동', [
            fx.stop(0, '10:00', 'A', [fx.photo(f'a{i}', w, h) for i in range(5)], [fx.memo('첫 메모'), fx.memo('같은 구간 둘째 메모')], None),   # 5장 -> 3장 · 메모 둘 -> 한 구간 하나
            fx.stop(1, '12:00', 'B', [fx.photo('b1', w, h)], [fx.memo('메모')], None)], featured=True)
        second = fx.article('2026-09-21', '둘째', '성수동', [
            fx.stop(0, '13:00', 'C', [fx.photo(f'c{i}', w, h) for i in range(3)], [fx.memo('비대표 메모')], None),
            fx.stop(1, '14:00', 'D', [fx.photo(f'd{i}', w, h) for i in range(3)], [fx.memo('또 비대표 메모')], None)])   # 기사 합계 6장 -> 3장
        again = fx.article('2025-09-20', '다시', '합정동', [fx.stop(0, '12:00', 'E', [fx.photo('e1', w, h), fx.photo('e2', w, h)], [fx.memo('옛 메모')], None)],
                           recalled=True, reason='anniversary')
        return {'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([feat, second, again]))]}

    def check(self, scenario):
        comp = compose(scenario, ROOMY)
        lead = pages(comp, 'da-opener')[0].computed['da']['lead']
        said = re.search(r'남긴 (\d+)장의 사진과 (\d+)개의 메모', lead)
        lead_photos, lead_memos = int(said.group(1)), int(said.group(2))
        counts = comp.report['leadCounts']
        self.assertEqual((lead_photos, lead_memos), (counts['photos'], counts['memos']))      # 문장의 숫자 = 세어 둔 집합
        rows = {m['label']: m['used'] for m in pages(comp, 'note')[0].computed['note']['materials']}
        note_photos, note_memos = int(rows['사진'].rstrip('장')), int(rows['메모'].rstrip('개'))
        # R50-2 - 오프너 문장 = 발행 노트 게재 (같은 호의 사실에서 한 번 센다). 재소환 기사의 것은 둘 다에서 빠지고 따로 센다
        self.assertEqual((lead_photos, lead_memos), (note_photos, note_memos))
        shown = set(comp.shown_photos)
        self.assertTrue(set(comp.report['leadPhotoPaths']) <= shown)
        return lead_photos, lead_memos, len(shown - set(comp.report['leadPhotoPaths'])), note_photos, note_memos

    def test_cap_exceeded_non_featured_memos_and_recalled(self):
        photos, memos, rest, note_p, note_m = self.check(self.many())
        self.assertEqual(photos, 3 + 1 + 3)        # 대표 구간 3장 + 1장, 비대표 기사 6장 중 3장 (재소환 2장은 이번 기간 수치에 섞지 않는다)
        # 대표 타임라인에 실린 구간 둘 + 비대표 기사 사진 아래 메모 하나(첫 사진, R48-3 ② · R50-4) - 재소환 메모는 뺀다 / 한 구간의 둘째 메모는 지면에 없다
        self.assertEqual(memos, 3)
        self.assertEqual(rest, 2)                    # 재소환 기사에 실린 사진 2장은 노트 · 오프너 어디에도 세지 않는다
        self.assertEqual((note_p, note_m), (7, 3))

    def test_all_scenarios(self):
        for sc in (fx.photo_scenario(), fx.type_scenario(), fx.skipped_scenario(), fx.many_photos_scenario(), fx.opener_fallback_scenario(),
                   fx.opener_type_only_scenario(), fx.long_original_scenario()):
            self.check(sc)


# ---------------------------------------------------------------------------
# 디자인 v1.2.3 전 임시 규칙 (R48-3) · data-width 문자열 (R48-6)
# ---------------------------------------------------------------------------

def two_articles(second_stops, featured_stops=None):
    feat = fx.article('2026-09-12', '대표', '연남동',
                      featured_stops or [fx.stop(0, '10:00', 'A', [fx.photo('a0')], [], '캡션')], featured=True)
    second = fx.article('2026-09-21', '둘째 기사', '성수동', second_stops)
    return {'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([feat, second]))]}


class R48Temporary(unittest.TestCase):
    def test_hero_photo_source_missing_stops_the_render_with_a_reason(self):
        # 첫 구간에 사진이 없다 - 뒤 구간에 사진이 있어도 지면의 히어로는 첫 구간의 첫 사진 하나뿐이라 원천이 없다
        sc = two_articles([fx.stop(0, '13:00', 'B', [], [fx.memo('메모')], None), fx.stop(1, '15:00', 'C', [fx.photo('c0')], [], '캡션')])
        with self.assertRaises(ComposeError) as ctx:
            compose(sc)
        msg = str(ctx.exception)
        self.assertIn('히어로 사진 원천이 없다', msg)
        self.assertIn('2번째 기사(둘째 기사)', msg)
        self.assertIn(fx.ISSUE, msg)

    def test_hero_photo_source_missing_also_fails_a_recalled_article_and_no_blank_frame_is_ever_made(self):
        sc = two_articles([fx.stop(0, '12:00', 'B', [], [], '캡션')])
        sc['corners'][0]['content']['payload']['articles'][1].update(recalled=True, recallReason='anniversary')
        with self.assertRaises(ComposeError):
            compose(sc)

    def test_featured_article_without_photos_is_not_affected(self):
        comp = compose(fx.opener_type_only_scenario())        # 대표 기사 사진 없음(type-only 오프너) - 히어로 규칙은 da-article에만 걸린다
        self.assertEqual(len(pages(comp, 'da-article')), 1)

    def test_caption_is_the_users_memo_never_the_ai_caption(self):
        memo_text = '서점에서 책을 골랐다.\n둘이서 한 권씩.'
        sc = two_articles([fx.stop(0, '13:00', 'B', [fx.photo('b0'), fx.photo('b1')], [fx.memo(memo_text)], None),
                           fx.stop(1, '15:00', 'C', [fx.photo('c0')], [], '이 문장은 온도록 캡션')])
        comp = compose(sc)
        photos = pages(comp, 'da-article')[0].computed['da']['articlePhotos']
        self.assertEqual([p['caption'] for p in photos], [memo_text, '', ''])      # 원문 그대로 · 기사의 첫 사진 아래 하나뿐 · AI 캡션은 싣지 않는다
        self.assertEqual([p['authorName'] for p in photos], [fx.A, '', ''])         # 쓴 사람 (R50-4)
        html = filled(comp, 'da-article')
        self.assertIn('서점에서 책을 골랐다.', html)
        self.assertNotIn('이 문장은 온도록 캡션', html)
        self.assertNotIn('AI 캡션 ·', html)
        self.assertEqual(html.count('class="cap"'), 1)                               # 메모 없는 사진의 캡션 줄은 지워진다
        # 문장 출처: 사진 아래 메모는 두 사람의 문장이고 온도록 캡션 문장은 세지 않는다
        self.assertTrue(any(s['source'] == 'date_archive.article.photoCaption' and s['who'] == 'people' for s in comp.sentences))
        self.assertFalse(any(s['source'] == 'date_archive.article.photoCaption' and s['who'] == 'ondolog' for s in comp.sentences))

    def test_a_drawing_note_is_not_a_caption(self):
        drawing = {'authorId': 'u1', 'authorName': fx.A, 'type': 'drawing', 'path': fx.dest('dr1')}
        sc = two_articles([fx.stop(0, '13:00', 'B', [fx.photo('b0')], [drawing], None)])
        comp = compose(sc)
        self.assertEqual([p['caption'] for p in pages(comp, 'da-article')[0].computed['da']['articlePhotos']], [''])

    def test_caption_memos_are_counted_where_they_are_shown(self):
        sc = two_articles([fx.stop(0, '13:00', 'B', [fx.photo('b0')], [fx.memo('첫 메모'), fx.memo('둘째 메모')], None)])
        comp = compose(sc, ROOMY)
        self.assertEqual(comp.report['leadCounts']['memos'], 1)                      # 비대표 기사 사진 아래의 첫 메모 하나
        rows = {m['label']: m['used'] for m in pages(comp, 'note')[0].computed['note']['materials']}
        self.assertEqual(rows['메모'], '1개')
        self.assertIn('메모 1개 — 대표가 아닌 기사에는 하나만 싣습니다', pages(comp, 'note')[0].computed['note']['notUsed'])   # 싣지 못한 둘째 메모

    def test_safe_findings_never_fail_the_render(self):
        # ③ bottom:62px 계열 safe 위반은 기록만 한다 - 렌더를 멈추는 건 잘린 원문(clipped)뿐이다
        findings = [{'k': 'safe', 't': 'ONDOLOG', 'box': [68, 1040, 200, 1060]}, {'k': 'overset', 't': 'ab', 'need': 1100, 'have': 953}]
        self.assertEqual(original_clipped(findings), [])

    def test_attribution_and_places_date_formats_are_unchanged(self):
        # ④ 지금 값 유지: `.attribution.at` = `MM.DD HH:MM` · `@da.places .date` = `MM.DD`
        self.assertEqual(mmdd_hhmm('2026-08-11T23:40:00+09:00'), '08.11 23:40')
        comp = compose(fx.photo_scenario())
        self.assertEqual(pages(comp, 'da-places')[0].computed['da']['places'][0]['date'], '09.12')
        quotes = pages(comp, 'sw-quotes')[-1].corner['payload']['sub']
        self.assertEqual(quotes[0]['attribution']['at'], '09.11 23:40')


OVERSET_HTML = """<!doctype html><html><body style="margin:0;height:1123px">
<div class="ab" style="position:absolute;left:0;width:300px;top:100px;bottom:923px;overflow:visible">
  <div {attr} style="height:{h}px">text</div></div>
<div class="ab" style="position:absolute;left:400px;width:300px;top:100px;bottom:923px;overflow:visible">
  <div data-slot="@da.lead" style="height:{h2}px">온도록 문장</div></div>
</body></html>"""


class OriginalOversetGate(unittest.TestCase):
    """R49-1 - 원문 필드가 든 상자의 넘침은 렌더 실패, 온도록 문장만 든 상자의 넘침은 기록만. 상자 높이 = 1123 - 100 - 923 = 100px."""

    def audit_of(self, attr, h, h2=100):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / 'p.html'
            f.write_text(OVERSET_HTML.format(attr=attr, h=h, h2=h2), encoding='utf-8')
            res = r.render_pages([f])[0]
        return res['findings']

    def test_boundary_content_equal_to_box_passes(self):
        for attr in ('data-slot=".userNotes[0].text"', 'data-slot=".text"', 'data-slot=".evidence"', 'data-slot="@cover.quote"'):
            findings = self.audit_of(attr, 100)
            self.assertEqual([f for f in findings if f['k'] == 'overset'], [], attr)       # 내용 = 상자 높이 바로 그 값
            audit = {'originalClipped': [], 'originalOverset': original_overset(findings)}
            self.assertIsNone(r.gate_failure(audit, 'ISSUE'))

    def test_original_box_overflowing_fails_with_reason(self):
        findings = self.audit_of('data-slot=".userNotes[0].text"', 160)
        overs = [f for f in findings if f['k'] == 'overset']
        self.assertEqual(len(overs), 1)
        self.assertEqual((overs[0]['need'], overs[0]['have']), (160, 100))
        self.assertEqual(overs[0]['originalSlots'], ['.userNotes[0].text'])
        audit = {'originalClipped': [], 'originalOverset': [{'n': 5, 'stem': 'da-timeline', **f} for f in original_overset(findings)]}
        why = r.gate_failure(audit, 'ISSUE-1')
        for part in ('ISSUE-1', '5쪽', 'da-timeline', '내용 160px / 상자 100px', '.userNotes[0].text'):
            self.assertIn(part, why)

    def test_box_with_only_ondolog_sentences_is_recorded_not_failed(self):
        findings = self.audit_of('data-slot=".userNotes[0].text"', 100, h2=160)           # 원문 상자는 맞고 온도록 상자만 넘친다
        overs = [f for f in findings if f['k'] == 'overset']
        self.assertEqual(len(overs), 1)
        self.assertEqual(overs[0]['originalSlots'], [])
        self.assertEqual(original_overset(findings), [])
        self.assertIsNone(r.gate_failure({'originalClipped': [], 'originalOverset': original_overset(findings)}, 'ISSUE'))

    def test_marking_does_not_change_the_common_five_vs_design(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / 'p.html'
            f.write_text(OVERSET_HTML.format(attr='data-slot=".text"', h=160, h2=160), encoding='utf-8')
            res = r.render_pages([f])[0]
        self.assertTrue(res['design'].get('same', True), res['design'])

    def test_timeline_overflow_volume_stops_the_render(self):
        sc = fx.timeline_overflow_scenario('basic')
        comp = compose(sc)
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'
            r.prepare_work(work)
            files = r.build_pages(comp, TEMPLATES, work, fx.ISSUE_ROW, lambda dest: fx.png(200, 300))
            results = r.render_pages(files)
        audit = r.audit_summary(comp, results, fx.ISSUE)
        why = r.gate_failure(audit, fx.ISSUE)
        self.assertIsNotNone(why)
        self.assertIn('da-timeline', why)
        self.assertIn('.userNotes[0].text', why)
        self.assertEqual(audit['originalClipped'], [])


class DataWidthStrings(unittest.TestCase):
    def test_percent_string_removes_the_element_like_resolve_js(self):
        for value in ('34%', ' 34% ', '0%'):
            html = fill('<p><span data-width="@w" style="width:42%">bar</span><i>kept</i></p>', None, {'w': value})
            self.assertNotIn('bar', html, value)
            self.assertIn('kept', html)

    def test_width_and_text_are_given_separately(self):
        # 폭은 숫자로, 글자는 `34%`로 - 같은 경로를 함께 쓰는 발행 노트의 막대가 그대로 선다
        html = fill('<div data-width="@w" style="width:42%"><span data-slot="@w">42%</span></div>', None, {'w': '34%'}, widths={'@w': 34})
        soup = BeautifulSoup(html, 'html.parser')
        self.assertIn('width:34%', soup.div['style'])
        self.assertEqual(soup.span.get_text(), '34%')

    def test_note_page_bars_come_from_numbers_not_from_the_percent_text(self):
        comp = compose(fx.photo_scenario(), ROOMY)
        spec = pages(comp, 'note')[0]
        people = int(spec.computed['note']['ratioPeople'].rstrip('%'))
        self.assertEqual(spec.widths, {'@note.ratioPeople': people, '@note.ratioOndolog': 100 - people})
        spec.widths = {}                                                              # 숫자 폭을 빼면 `34%` 글자로는 막대를 세우지 않는다
        self.assertNotIn('data-width', r.fill_page(spec, comp.theme, TEMPLATES))


# ---------------------------------------------------------------------------
# Vol · 발행일 · 라벨 (범위 7·8)
# ---------------------------------------------------------------------------

class NoVolNoIssueDate(unittest.TestCase):
    def test_no_volume_or_publication_date_anywhere_in_the_issue(self):
        for scenario in (fx.photo_scenario(), fx.type_scenario(), fx.skipped_scenario(), fx.many_photos_scenario(), fx.opener_type_only_scenario()):
            issue = {**fx.ISSUE_ROW, 'published_at': '2026-10-02T00:00:00+09:00', 'issue_number': 7}
            comp = compose_issue(issue, {**fx.COUPLE_ROW, 'magazine_theme': scenario['theme']}, NAMES, scenario['corners'],
                                 ROOMY)
            for i, spec in enumerate(comp.pages, 1):
                text = text_of(r.fill_page(spec, comp.theme, TEMPLATES))
                self.assertIsNone(re.search(r'\bVol\b|Vol\.|발행일|Issue No|No\.\s*\d', text), (spec.stem, text[:80]))
                self.assertNotIn('2026.10.02', text)                    # 호의 발행 시각은 지면 어디에도 없다


# ---------------------------------------------------------------------------
# 실제 Chromium
# ---------------------------------------------------------------------------

class Browser(unittest.TestCase):
    def test_data_width_six_cases_match_the_designs_resolve_js(self):
        rows = width_compare.compare(width_compare.SIX_CASES)
        for row in rows:
            self.assertTrue(row['same'], row)
        by = {row['case']: row for row in rows}
        self.assertEqual(by['정상']['dev'], {'people': '34%', 'ondolog': '66%'})
        self.assertEqual(by['한쪽 null']['dev'], {'people': '34%', 'ondolog': None})
        self.assertEqual(by['둘 다 없음']['dev'], {'people': None, 'ondolog': None})
        for name in ('120(범위 밖)', '-5(범위 밖)', '문자열'):
            self.assertEqual(by[name]['dev'], {'people': None, 'ondolog': '66%'})

    def test_data_width_extra_cases(self):
        rows = {row['case']: row for row in width_compare.compare(width_compare.EXTRA_CASES)}
        self.assertTrue(rows['숫자 글자 "34"']['same'])
        self.assertTrue(rows['경계 0과 100']['same'])
        # R48-6 - `34%` 문자열은 디자인 resolve.js처럼 요소를 지운다(대조 기준 하나)
        row = rows['"34%" 문자열']
        self.assertTrue(row['same'], row)
        self.assertEqual(row['dev'], {'people': None, 'ondolog': '66%'})
        self.assertEqual(row['design'], {'people': None, 'ondolog': '66%'})

    def test_tm_articles_single_column_fits_the_page_with_longest_bodies(self):
        for n in (2, 3, 4):
            sc = fx.photo_scenario() if n == 3 else fx.type_scenario()
            tm = copy.deepcopy(sc['corners'][2]['content'])
            body = fx.exact_text('두 사람이 남긴 기록에 같은 동네의 장소가 여러 번 나왔고 그 흐름을 정리했습니다', 150)
            tm['payload']['articles'] = [{**copy.deepcopy(tm['payload']['articles'][0]), 'seq': i, 'body': body} for i in range(n)]
            sc['corners'][2] = fx.corner_row('this_month', tm, seq=3)
            comp = compose(sc)
            with tempfile.TemporaryDirectory() as tmp:
                work = Path(tmp) / 'work'
                r.prepare_work(work)
                files = r.build_pages(comp, TEMPLATES, work, fx.ISSUE_ROW, lambda dest: fx.png(200, 300))
                articles = [f for f in files if 'tm-articles' in f.name][0]
                results = r.render_pages([articles])
            kinds = {x['k'] for x in results[0]['findings']}
            self.assertNotIn('overset', kinds, (n, results[0]['findings']))
            self.assertNotIn('overflow', kinds, n)
            self.assertNotIn('broken-image', kinds, n)
            self.assertEqual(original_clipped(results[0]['findings']), [])


if __name__ == '__main__':
    unittest.main()
