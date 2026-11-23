"""디자인 v1.2.2 지면 맞춤 시험 (위임: 55-3) - 84-d에서 v1.2.3 규칙으로 갱신(높이 = `measure.json` 실측 표 · 기사 캡션 · hero-none · 막대 폭 경로). 네트워크 없음. 실제 Chromium을 쓰는 시험은 `Browser` 묶음뿐이다.

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
    split_timeline, stop_height,
)
import heights  # noqa: E402
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
        self.assertIn(f'width:{people}%', soup.find(attrs={'data-width': '@note.ratioPeopleWidth'})['style'])     # v1.2.3 #6 - 폭은 숫자 경로
        self.assertIn(f"width:{100 - people}%", soup.find(attrs={'data-width': '@note.ratioOndologWidth'})['style'])
        self.assertNotIn('42%', str(soup.find(attrs={'data-width': '@note.ratioPeopleWidth'})['style']))

    def test_no_sentences_means_no_ratio_and_no_bars(self):
        comp = compose(fx.photo_scenario())
        spec = pages(comp, 'note')[0]
        spec.computed['note']['ratioPeople'] = ''
        spec.computed['note']['ratioOndolog'] = ''
        spec.computed['note']['ratioPeopleWidth'] = ''
        spec.computed['note']['ratioOndologWidth'] = ''
        spec.widths = {}
        html = r.fill_page(spec, comp.theme, TEMPLATES)
        self.assertIsNone(BeautifulSoup(html, 'html.parser').find(attrs={'data-width': True}))   # v1.2.3 틀은 주석에 'data-width' 글자가 있다 - 속성으로 본다
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
        # 사진이 하나도 없는 기사는 v1.2.3 `hero-none`이다(`R48Temporary`). 여기서는 사진 목록이 빈 값일 때 블록이 지워지는 것만 본다
        spec = pages(comp, 'da-article')[0]
        spec.computed['da']['articlePhotos'] = []
        spec.computed['da']['articlePhotoNote'] = ''
        html = r.fill_page(spec, comp.theme, TEMPLATES)
        self.assertNotIn('그날 남은 사진', text_of(html))                     # v1.2.3 틀 주석에 같은 말이 있다 - 글자로 본다
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

    def test_tm_articles_without_photo_evidence_gets_no_photo_and_falls_to_one_column(self):
        # v1.2.3 #18(R44-9): 사진은 근거가 사진인 소기사에만. 여기 소기사는 모두 사진 근거가 없는 첫 기사의 사본이라 사진 0 -> 한 단(CSS)
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

def formula_conversation(turns, chars):
    """README v1.2.3 §12 '인용 대화 하나' 식을 `measure.json` 값으로 시험이 따로 계산한 값(정황 없음 = 한 줄 · 홀수 턴 446px 표 · 짝수 턴 404px 표 · 올림).
    84-d2(R138-2) - 표는 이 환경에서 잰 값이라 README 격자(디자인 환경)의 숫자를 박지 않는다."""
    import math
    q = heights.QUOTES
    c = q['conversation']

    def lines(table, n):
        return next(l for ch, l in zip(table['chars'], table['lines']) if ch >= n)
    h = c['base'] + c['contextLine'] * 1
    for i in range(turns):
        h += c['perTurn'] + c['turnLine'] * (lines(q['turnLines']['odd' if i % 2 == 0 else 'even'], chars) - 1)
    return math.ceil(h - 1e-9)


def main_of(turns, chars):
    return {'turns': [{'speaker': fx.A, 'text': fx.exact_text(fx.LONG_SEED, chars), 'at': 'x'} for _ in range(turns)]}


class Quotes(unittest.TestCase):
    def test_exact_text_has_the_exact_length(self):
        for n in (12, 30, 60, 100, 160, 400):
            self.assertEqual(len(fx.exact_text(fx.LONG_SEED, n)), n)

    def test_lines(self):
        # v1.2.3 §12 줄 수 표 - 글자 수 이상인 첫 칸(보간 없음), 줄바꿈 조각마다 따로 센다(옛 '35자마다 한 줄'은 폐기)
        odd = heights.QUOTES['turnLines']['odd']
        for c, l in zip(odd['chars'], odd['lines']):
            self.assertEqual(heights.table_lines(odd, '가' * c), l, c)
        self.assertEqual(heights.table_lines(odd, '한 줄\n둘째 줄'), 2)           # 원문의 줄바꿈마다 새 줄
        self.assertEqual(heights.table_lines(odd, ''), 1)
        self.assertGreaterEqual(heights.table_lines(odd, '가' * 2000), odd['lines'][-1])   # 표 끝을 넘어도 작게 잡지 않는다

    def test_conversation_height_follows_the_measure_formula(self):
        # 84-d2: README 격자(디자인 환경 값) 대신 이 환경 표로 같은 식을 따로 계산해 맞댄다 - 턴 1~6 x 8가지 길이, 같아야 한다
        for turns in range(1, 7):
            for chars in (12, 30, 60, 100, 160, 240, 320, 400):
                self.assertEqual(conversation_height(main_of(turns, chars)), formula_conversation(turns, chars), (turns, chars))

    def test_quote_capacities_come_from_the_table_and_narrow_with_short_quotes(self):
        cap = heights.QUOTE_CAPACITY
        self.assertGreater(cap['sub0'], cap['sub1-3'])
        self.assertGreater(cap['sub1-3'], cap['sub4-6'])                   # 단문이 많을수록 인용 자리가 좁다(README §12 3단)
        self.assertEqual([heights.quote_capacity(n) for n in (0, 1, 3, 4, 6)], [cap['sub0'], cap['sub1-3'], cap['sub1-3'], cap['sub4-6'], cap['sub4-6']])

    def test_pack_boundary_without_short_quotes(self):
        c0 = heights.QUOTE_CAPACITY['sub0']
        self.assertEqual(pack_quotes([c0], 0), [[0]])
        with self.assertRaises(ComposeError) as ctx:
            pack_quotes([c0 + 1], 0)
        self.assertIn(f'{c0}px', str(ctx.exception))

    def test_pack_boundary_with_one_to_three_and_four_or_more_short_quotes(self):
        c13, c46 = heights.QUOTE_CAPACITY['sub1-3'], heights.QUOTE_CAPACITY['sub4-6']
        for subs in (1, 2, 3):
            self.assertEqual(pack_quotes([c13], subs), [[0]])
            with self.assertRaises(ComposeError) as ctx:
                pack_quotes([c13 + 1], subs)
            self.assertIn(f'{c13}px', str(ctx.exception))
        for subs in (4, 6):
            self.assertEqual(pack_quotes([c46], subs), [[0]])
            with self.assertRaises(ComposeError) as ctx:
                pack_quotes([c46 + 1], subs)
            self.assertIn(f'{c46}px', str(ctx.exception))
        self.assertEqual(pack_quotes([c46 + 1], 3), [[0]])

    def test_conversations_are_never_split_across_pages(self):
        c0, c13, c46 = (heights.QUOTE_CAPACITY[k] for k in ('sub0', 'sub1-3', 'sub4-6'))
        self.assertEqual(pack_quotes([400, c0 - 400], 0), [[0, 1]])        # 단문 없는 면 가용 높이 정확히
        self.assertEqual(pack_quotes([400, c0 - 399], 0), [[0], [1]])
        self.assertEqual(pack_quotes([400, c46 - 399], 4), [[0], [1]])     # 단문과 함께 실리는 마지막 면만 좁다
        self.assertEqual(pack_quotes([400, c13 - 400], 3), [[0, 1]])
        self.assertEqual(pack_quotes([c13 - 400, 401, 400], 2), [[0, 1], [2]])   # 앞 면은 단문이 없어 단문 0 기준(c13 + 1 > c13이어도 앞 면에 든다)
        self.assertEqual(pack_quotes([700, 700, 700], 0), [[0], [1], [2]])
        self.assertEqual(pack_quotes([300, 300, 300, 300], 0), [[0, 1, 2], [3]])
        for sizes in ([100] * 12, [300, 500, 200, 800, 100], [c0, 1, c13]):
            groups = pack_quotes(sizes, 1)
            self.assertEqual([i for g in groups for i in g], list(range(len(sizes))))   # 순서 그대로, 하나도 빠지지 않는다

    def test_two_conversations_of_four_turns_x_160_chars_do_not_fit_on_one_page(self):
        h = conversation_height(main_of(4, 160))
        self.assertGreater(2 * h, heights.QUOTE_CAPACITY['sub0'])
        self.assertEqual(pack_quotes([h, h], 0), [[0], [1]])

    def test_overlong_conversation_failure_names_issue_conversation_and_height(self):
        with self.assertRaises(ComposeError) as ctx:
            compose(fx.long_original_scenario(with_overlong=True))
        msg = str(ctx.exception)
        self.assertIn(fx.ISSUE, msg)
        self.assertIn('3번째 대화(밤새 이어진 가장 긴 대화)', msg)
        self.assertIn(f"{conversation_height(fx.long_original_scenario(with_overlong=True)['corners'][1]['content']['payload']['main'][2])}px", msg)
        self.assertIn(f"{heights.QUOTE_CAPACITY['sub0']}px", msg)   # 단문 없는 면의 가용 높이(어느 면에도 들어가지 않는다)

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
    def test_stop_height_follows_the_measure_table(self):
        # README v1.2.3 §12 "타임라인 구간 하나" 식 - 84-d2부터 표는 이 환경에서 잰 값이라 README 격자 숫자 대신 같은 식을 따로 계산해 맞댄다
        import math
        tl = heights.TIMELINE

        def lines(n):
            return next(l for ch, l in zip(tl['memoLines']['chars'], tl['memoLines']['lines']) if ch >= n)
        for n in (20, 50, 100, 150, 200):
            r_ = tl['right']['photos-1']['memo']
            want = math.ceil(max(tl['left']['placeLabel'], r_['base'] + r_['perLine'] * lines(n)) + tl['stopPadding'])
            self.assertEqual(stop_height(stop_of(1, n)), want, n)
        want0 = math.ceil(max(tl['left']['placeNoLabel'], tl['right']['photos-0']['none']) + tl['stopPadding'])
        self.assertEqual(stop_height(stop_of(0, None, caption=None)), want0)   # 사진 0 · 메모 없음 · 캡션 없음(옛 표 101)

    def test_line_breaks_and_long_place_names_are_counted(self):
        one = stop_height(stop_of(0, None) | {'userNotes': [fx.memo('한 줄로 쓴 메모 한 줄로 쓴 메모')], 'aiCaption': None})
        split = stop_height(stop_of(0, None) | {'userNotes': [fx.memo('한 줄로 쓴 메모\n한 줄로 쓴 메모')], 'aiCaption': None})
        self.assertEqual(split - one, 29)                                    # 줄바꿈 조각은 따로 한 줄(옛 규칙은 세지 못했다)
        short_place = stop_height(fx.stop(0, '10:00', '카페', [], [], None))
        long_place = stop_height(fx.stop(0, '10:00', '서울특별시 마포구 연남동 골목 끝 작은 카페', [], [], None))
        self.assertGreater(long_place, short_place)                          # 사진 없는 구간은 장소 이름이 높이를 정할 수 있다

    def test_a_long_memo_moves_the_stop_to_the_next_page_and_two_pages_are_balanced(self):
        # 88-: v1.2.4 표(낱말 단위 줄바꿈 + 여유 1줄)에서 50자 메모가 한 줄 늘어 셋이 한 면을 넘었다 - 들어가는 묶음은 30자로(시험 뜻 그대로)
        short = [stop_of(1, 30), stop_of(1, 30), stop_of(0, 30)]
        self.assertLessEqual(sum(map(stop_height, short)), heights.TIMELINE_CAPACITY_PX)
        self.assertEqual([len(p) for p in split_timeline(short)[0]], [3])
        longer = [stop_of(1, 30), stop_of(1, 30), stop_of(0, 200)]
        self.assertGreater(sum(map(stop_height, longer)), heights.TIMELINE_CAPACITY_PX)
        # v1.2.3 #9 · D11 - 앞에서부터 채우면 [2, 1]이지만, 두 면이면 순서를 지켜 높이 차가 가장 작게 다시 나눈다 -> [1, 2]
        self.assertEqual([len(p) for p in split_timeline(longer)[0]], [1, 2])

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
        memo_text = sc['corners'][0]['content']['payload']['articles'][0]['stops'][1]['userNotes'][0]['text']   # 긴 메모는 16:10 연남동 카페 구간에 붙는다 (R52-4)
        comp = compose(sc)
        self.assertIn(memo_text, ' '.join(text_of(filled(comp, 'da-timeline', i)) for i in range(len(pages(comp, 'da-timeline')))))


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
        # R50-2 - 오프너 문장 = 발행 노트 게재 (같은 호의 사실에서 한 번 센다). 재소환 기사의 것은 둘 다에서 빠지고 따로 센다.
        # v1.2.3(D6 · README §11 ⑩): 노트는 호 전체 - 이달의 우리 소기사에만 실린 사진(데이트 아카이브 기사에 없는 것)이 더해진다
        tm_only = comp.report['facts']['photosShownIssuePeriod'] - comp.report['facts']['photosShownPeriod']
        self.assertEqual((lead_photos + tm_only, lead_memos), (note_photos, note_memos))
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
    def test_first_stop_without_photos_takes_the_hero_from_the_next_stop(self):
        # R84-1(R48-3 ①을 바꿈): 첫 구간에 사진이 없으면 사진이 있는 첫 구간의 첫 사진이 히어로다 - 렌더를 멈추지 않는다
        sc = two_articles([fx.stop(0, '13:00', 'B', [], [fx.memo('메모')], None), fx.stop(1, '15:00', 'C', [fx.photo('c0')], [], '캡션')])
        comp = compose(sc)
        html = filled(comp, 'da-article')
        self.assertIn(fx.dest('c0').split('/')[-1], re.findall(r' src="([^"]+)"', html)[0])
        self.assertEqual(comp.report['heroFallbackArticles'], 1)

    def test_article_without_any_photo_is_printed_as_hero_none_and_no_blank_frame_is_ever_made(self):
        # v1.2.3(R136-2 ① · D1 · D3): R84-2 "사진 0 기사 빼기"는 없어졌다 - 사진이 하나도 없는 기사(재소환이어도)는 글만 있는 기사(hero-none)로 싣는다. 빈 사진 틀은 없다
        sc = two_articles([fx.stop(0, '12:00', 'B', [], [], '캡션')])
        sc['corners'][0]['content']['payload']['articles'][1].update(recalled=True, recallReason='anniversary')
        comp = compose(sc)
        self.assertEqual(len(pages(comp, 'da-article')), 1)
        self.assertEqual(comp.report['droppedArticles'], 0)
        html = filled(comp, 'da-article')
        self.assertIn('data-variant="hero-none"', html)
        self.assertNotIn('data-variant="hero-photo"', html)
        self.assertNotIn('<img', html)
        self.assertIn('캡션', text_of(html))                                    # 구간 목록이 AI 캡션(라벨 줄)을 싣는다

    def test_featured_article_without_photos_is_not_affected(self):
        comp = compose(fx.opener_type_only_scenario())        # 대표 기사 사진 없음(type-only 오프너) - 히어로 규칙은 da-article에만 걸린다
        self.assertEqual(len(pages(comp, 'da-article')), 1)

    def test_caption_is_the_stops_memo_or_its_ai_caption_on_the_stops_first_photo(self):
        # v1.2.3(D4, README §10 ①): 사진마다 캡션 칸 하나. 그 사진이 속한 구간의 첫 사진에만 그 구간의 메모(라벨 없음) 또는 AI 캡션(라벨 줄)
        memo_text = '서점에서 책을 골랐다.\n둘이서 한 권씩.'
        sc = two_articles([fx.stop(0, '13:00', 'B', [fx.photo('b0'), fx.photo('b1')], [fx.memo(memo_text)], None),
                           fx.stop(1, '15:00', 'C', [fx.photo('c0')], [], '이 문장은 온도록 캡션')])
        comp = compose(sc)
        photos = pages(comp, 'da-article')[0].computed['da']['articlePhotos']
        self.assertEqual([p['caption'] for p in photos], [memo_text, '', ''])        # 원문 그대로 · 구간의 첫 사진 아래
        self.assertEqual([p['authorName'] for p in photos], [fx.A, '', ''])           # 쓴 사람 (R50-4)
        self.assertEqual([p['aiCaption'] for p in photos], ['', '', '이 문장은 온도록 캡션'])   # 메모 없는 구간의 첫 사진 - AI 캡션
        html = filled(comp, 'da-article')
        self.assertIn('서점에서 책을 골랐다.', html)
        self.assertIn('이 문장은 온도록 캡션', html)
        self.assertEqual(text_of(html).count('AI 캡션'), 2)                           # 라벨 줄(사진 캡션 칸) + 숫자 칸 라벨
        self.assertNotIn('AI 캡션 ·', html)                                            # 접두사 없음(§11 ⑥)
        # 문장 출처: 사진 아래 메모는 두 사람의 문장, AI 캡션은 온도록 문장
        self.assertTrue(any(s['source'] == 'date_archive.article.photoCaption' and s['who'] == 'people' for s in comp.sentences))
        self.assertTrue(any(s['source'] == 'date_archive.article.photoAiCaption' and s['who'] == 'ondolog' for s in comp.sentences))

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
        self.assertIn('메모 1개 — 대표가 아닌 기사에는 실린 사진 · 구간마다 메모 하나만 싣습니다', pages(comp, 'note')[0].computed['note']['notUsed'])   # 싣지 못한 둘째 메모

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

    @staticmethod
    def vol4():
        import local_volumes as lv
        comp = compose(fx.timeline_overflow_scenario('basic'))
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'
            r.prepare_work(work)
            files = r.build_pages(comp, TEMPLATES, work, fx.ISSUE_ROW, lambda dest: fx.png(200, 300))
            results = r.render_pages(files)
            timeline = lv.measure_timeline(comp, files)
        return r.audit_summary(comp, results, fx.ISSUE), timeline, lv

    def test_timeline_overflow_volume_never_ships_an_overflowing_page(self):
        # 넘친 지면은 나가지 않는다(README §12 "렌더 뒤 지면 검사가 마지막 방어") - 어림이 실제보다 작으면 관문이 원문 상자 넘침으로 멈춘다
        audit, timeline, lv = self.vol4()
        self.assertEqual(audit['originalClipped'], [])
        if lv.timeline_under(timeline):
            why = r.gate_failure(audit, fx.ISSUE)
            self.assertIsNotNone(why, timeline)
            self.assertIn('.userNotes[0].text', why)
        else:
            self.assertIsNone(r.gate_failure(audit, fx.ISSUE))

    def test_timeline_overflow_volume_passes_and_no_estimate_is_below_the_actual(self):
        # v1.2.3(D13): vol4는 통과하는 권이다. 84-d에서는 디자인 환경 표(384 · 394자 메모 9줄 / 이 환경 실제 10줄)로 넘쳐 기대 실패로 두었고,
        # 84-d2(R138-2)에서 표를 이 환경에서 디자인 도구 그대로 다시 재(`measure.json` + `measure.env.json`) 기대 실패 표시를 뗐다
        audit, timeline, lv = self.vol4()
        self.assertIsNone(r.gate_failure(audit, fx.ISSUE))
        self.assertEqual(audit['originalOverset'], [])
        self.assertEqual(lv.timeline_under(timeline), [], timeline)


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
        self.assertEqual(spec.widths, {'@note.ratioPeopleWidth': people, '@note.ratioOndologWidth': 100 - people})   # v1.2.3 #6 · D7
        spec.widths = {}                                                              # 숫자 폭을 빼면 `34%` 글자로는 막대를 세우지 않는다
        spec.computed['note']['ratioPeopleWidth'] = spec.computed['note']['ratioOndologWidth'] = ''   # v1.2.3 - 숫자 폭 경로(@note.ratio*Width)도 비운다. 글자(`36%`)는 남는다
        self.assertIsNone(BeautifulSoup(r.fill_page(spec, comp.theme, TEMPLATES), 'html.parser').find(attrs={'data-width': True}))


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
