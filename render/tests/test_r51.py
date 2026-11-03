"""지면 사실 마무리 시험 (위임: 55-3c, ROADMAP R51-2 ~ R51-7).

  N1  재소환 사진은 발행 노트에 따로 한 줄 - 이번 기간 게재 + 재소환 = 지면에 실제로 들어간 사진 전체 (지면의 사진 슬롯을 직접 센다)
  N2  "근거 사진 N장" 줄은 싣지 않은 것에 없다
  N3  활자 변형 오프너에 "Date Archive / 지역 · 월"이 두 번 나오지 않는다
  N4  이달의 우리 숫자 칸은 호의 사실에서 계산한다 - 콘텐츠가 다른 숫자를 줘도 지면은 호의 사실
  N5  0인 칸 · 라벨 · 합계 조각을 싣지 않는다
  N6  지면에 실린 모든 원문 줄 = 시드 기록의 메시지 · 메모 하나와 글자 단위로 같다 + 시드의 긴 원문은 온전한 메시지이고 대화 본문이 서로 겹치지 않는다
"""

from __future__ import annotations

import copy
import os
import re
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))

from bs4 import BeautifulSoup  # noqa: E402

import fixtures as fx  # noqa: E402
import local_volumes as lv  # noqa: E402
import render_issue as r  # noqa: E402
import seed_render_tests as seed  # noqa: E402
from compose import compose_issue, timeline_totals  # noqa: E402
from facts import build_facts  # noqa: E402

NAMES = [fx.A, fx.B]
TEMPLATES = r.load_templates()
LOCAL = lv.MATERIALS
SCENARIOS = {
    'photo': fx.photo_scenario, 'type': fx.type_scenario, 'skipped': fx.skipped_scenario, 'many': fx.many_photos_scenario,
    'opener_fallback': fx.opener_fallback_scenario, 'opener_type_only': fx.opener_type_only_scenario,
    'long_original': fx.long_original_scenario, 'timeline_overflow': fx.timeline_overflow_scenario,
}


def compose(scenario, materials=LOCAL):
    return compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW, 'magazine_theme': scenario['theme']}, NAMES, scenario['corners'], materials)


def pages(comp, stem):
    return [p for p in comp.pages if p.stem == stem]


def filled(spec, comp):
    return r.fill_page(spec, comp.theme, TEMPLATES)


def soup_of(spec, comp):
    return BeautifulSoup(filled(spec, comp), 'html.parser')


def date_archive_of(scenario):
    return next(c for c in scenario['corners'] if c['corner_type'] == 'date_archive')['content']


def photo_paths_on_pages(comp):
    """조립된 모든 지면의 사진 슬롯(`<img data-src>`에 경로가 채워진 것)에서 사진 경로를 모은다 - 지면 쪽 수치를 데이터가 아니라 지면에서 직접 센다."""
    found = set()
    for spec in comp.pages:
        for img in soup_of(spec, comp).select('img[data-src]'):
            if img.get('src'):
                found.add(img['src'])
    return found


def note_photo_numbers(comp):
    note = pages(comp, 'note')[0].computed['note']
    row = next((x for x in note['materials'] if x['label'] == '사진'), None)
    used = int(re.search(r'\d+', row['used']).group()) if row else 0
    return used, note['recalledPhotos'], note


# ---------------------------------------------------------------------------
# N1 - 재소환 사진 따로 한 줄
# ---------------------------------------------------------------------------

class RecalledPhotosLine(unittest.TestCase):
    def test_period_plus_recalled_equals_every_photo_on_the_pages(self):
        recalled_seen = 0
        for name, build in SCENARIOS.items():
            comp = compose(build())
            used, recalled, _ = note_photo_numbers(comp)
            on_pages = photo_paths_on_pages(comp)
            self.assertEqual(used + recalled, len(on_pages), f'{name}: 노트 이번 기간 {used} + 재소환 {recalled} != 지면에 실린 사진 {len(on_pages)}')
            recalled_seen += recalled
        self.assertGreater(recalled_seen, 0)                  # 재소환 사진이 있는 호가 시험에 들어 있다

    def test_period_part_still_balances_with_what_was_not_printed(self):
        # 이번 기간 정합(모은 양 - 게재 = 싣지 않은 것의 합)은 재소환을 섞지 않아서 그대로 맞는다
        for name, build in SCENARIOS.items():
            comp = compose(build())
            note = pages(comp, 'note')[0].computed['note']
            row = next(x for x in note['materials'] if x['label'] == '사진')
            collected, used = (int(re.search(r'\d+', row[k]).group()) for k in ('collected', 'used'))
            not_used = sum(int(m.group(1)) for line in note['notUsed'] for m in [re.match(r'^(?:구간 \d+곳\()?사진 (\d+)장', line)] if m)
            self.assertEqual(collected - used, not_used, name)

    def test_the_recalled_line_sits_under_the_table_and_reads_the_same_number(self):
        comp = compose(fx.photo_scenario())
        used, recalled, note = note_photo_numbers(comp)
        self.assertGreater(recalled, 0)
        want = f'그때 그 시절 · 지난 기록에서 다시 실은 사진 {recalled}장'
        self.assertEqual(note['recalledPhotosLine'], want)
        soup = soup_of(pages(comp, 'note')[0], comp)
        table = soup.select_one('table.tb')
        line = table.find_next_sibling('span')
        self.assertIsNotNone(line)
        self.assertEqual(line.get_text(strip=True), want)                       # 표 바로 아래에 따로
        self.assertNotIn('그때 그 시절', table.get_text())                        # 표 안(이번 기간 줄)에는 섞이지 않는다
        for tr in table.select('tbody tr'):                                      # 표의 게재 칸은 이번 기간 값 그대로
            if tr.select_one('td').get_text(strip=True) == '사진':
                self.assertEqual(tr.select('td')[2].get_text(strip=True), f'{used}장')

    def test_without_a_recalled_article_there_is_no_line(self):
        feat = fx.article('2026-09-12', '대표', '연남동', [fx.stop(0, '10:00', 'A', [fx.photo('a0')], [], '캡션')], featured=True)
        sec = fx.article('2026-09-21', '둘째', '성수동', [fx.stop(0, '13:00', 'C', [fx.photo('c0')], [], '캡션')])
        comp = compose({'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([feat, sec]))]})
        used, recalled, note = note_photo_numbers(comp)
        self.assertEqual((recalled, note['recalledPhotosLine']), (0, ''))
        html = filled(pages(comp, 'note')[0], comp)
        self.assertNotIn('다시 실은 사진', html)
        self.assertNotIn('recalledPhotosLine', html)
        self.assertEqual(html.count('top:520px'), 1)                               # 줄이 없으면 아래 블록도 틀 그대로다
        self.assertEqual(used, len(photo_paths_on_pages(comp)))

    def test_with_the_line_the_two_blocks_below_move_down_together(self):
        comp = compose(fx.photo_scenario())
        html = filled(pages(comp, 'note')[0], comp)
        self.assertNotIn('top:520px', html)
        self.assertNotIn('top:650px', html)
        self.assertEqual((html.count('top:556px'), html.count('top:686px')), (1, 1))
        self.assertEqual(r.add_note_recalled_line(TEMPLATES['note']).count('@note.recalledPhotosLine'), 1)

    def test_the_line_is_added_to_the_note_only(self):
        self.assertIn('@note.recalledPhotosLine', r.add_note_recalled_line(TEMPLATES['note']))
        for stem, html in TEMPLATES.items():
            self.assertNotIn('recalledPhotosLine', html, stem)                  # 지면 HTML 파일은 그대로다


# ---------------------------------------------------------------------------
# N2 - 근거 사진 줄 없음
# ---------------------------------------------------------------------------

class NoEvidencePhotoLine(unittest.TestCase):
    def test_not_printed_list_has_no_evidence_photo_line(self):
        for name, build in SCENARIOS.items():
            comp = compose(build())
            note = pages(comp, 'note')[0].computed['note']
            self.assertFalse([x for x in note['notUsed'] if '근거 사진' in x], name)
            self.assertNotIn('근거 사진', filled(pages(comp, 'note')[0], comp))
        # 근거 사진이 실제로 든 호에서도 (photo 시나리오의 이달의 우리 소기사에 사진 근거가 있다)
        sc = fx.photo_scenario()
        tm = next(c for c in sc['corners'] if c['corner_type'] == 'this_month')['content']
        self.assertTrue(any(ev['type'] == 'photo' for a in tm['payload']['articles'] for ev in a['evidence']))


# ---------------------------------------------------------------------------
# N3 - 활자 변형 오프너
# ---------------------------------------------------------------------------

class OpenerTypeVariant(unittest.TestCase):
    @staticmethod
    def region_line_count(comp):
        spec = pages(comp, 'da-opener')[0]
        soup = soup_of(spec, comp)
        want = spec.computed['da']['regionLine']
        texts = [el.get_text('\n').strip() for el in soup.select('[data-slot="@da.regionLine"]')]
        return len(texts), texts == [want] * len(texts), len(soup.find_all(string=re.compile(r'^\s*Date Archive\s*$')))

    def test_type_variant_shows_the_region_line_and_the_label_once(self):
        comp = compose(fx.opener_type_only_scenario())
        spec = pages(comp, 'da-opener')[0]
        self.assertFalse(spec.computed['da']['openerPhoto'])
        slots, same, labels = self.region_line_count(comp)
        self.assertEqual((slots, same, labels), (1, True, 1))

    def test_photo_variant_keeps_its_small_line(self):
        comp = compose(fx.photo_scenario())
        slots, same, labels = self.region_line_count(comp)
        self.assertEqual((slots, same, labels), (1, True, 1))                    # 사진 변형은 작은 줄 하나 (큰 활자는 없다)

    def test_the_template_edit_is_marked(self):
        self.assertRegex(TEMPLATES['da-opener'], r'<!-- R50-6 임시 — 디자인 v1\.2\.3에서 확정 \(N3')


# ---------------------------------------------------------------------------
# N4 - 이달의 우리 숫자 칸
# ---------------------------------------------------------------------------

class ThisMonthNumbers(unittest.TestCase):
    @staticmethod
    def cells(comp):
        soup = soup_of(pages(comp, 'tm-lead')[0], comp)
        return [(el.select_one('.num-xl').get_text(strip=True), el.select_one('.lbl').get_text(strip=True))
                for el in soup.select('[data-repeat="payload.theme.signals"] > div')]

    def test_number_cells_equal_the_facts_of_the_issue(self):
        for name, build in SCENARIOS.items():
            sc = build()
            comp = compose(sc)
            da = date_archive_of(sc)
            want = [(str(fx.days_in_region(da, region)), f'{region}에서 보낸 날') for region in da['payload']['summary']['regions']]
            self.assertEqual(self.cells(comp), want, name)

    def test_generated_numbers_are_ignored(self):
        sc = fx.many_photos_scenario()
        tm = next(c for c in sc['corners'] if c['corner_type'] == 'this_month')['content']
        tm['payload']['theme']['signals'] = [{'kind': 'place', 'value': '연남동', 'count': 99}, {'kind': 'place', 'value': '성수동', 'count': 77}]
        comp = compose(sc)
        cells = self.cells(comp)
        self.assertEqual(cells, [('1', '연남동에서 보낸 날'), ('1', '성수동에서 보낸 날')])   # 연남동 하루 · 성수동 하루, 재소환 합정동은 세지 않는다 (R52-2)
        text = soup_of(pages(comp, 'tm-lead')[0], comp).get_text(' ', strip=True)
        self.assertNotIn('99', text)
        self.assertNotIn('77', text)

    def test_which_cells_are_shown_is_still_the_generations_choice(self):
        sc = fx.many_photos_scenario()
        tm = next(c for c in sc['corners'] if c['corner_type'] == 'this_month')['content']
        tm['payload']['theme']['signals'] = [{'kind': 'place', 'value': '성수동', 'count': 5}]
        self.assertEqual(self.cells(compose(sc)), [('1', '성수동에서 보낸 날')])

    def test_a_signal_the_records_cannot_count_is_not_shown(self):
        sc = fx.many_photos_scenario()
        tm = next(c for c in sc['corners'] if c['corner_type'] == 'this_month')['content']
        tm['payload']['theme']['signals'] = [
            {'kind': 'keyword', 'value': '우산', 'count': 9},          # 키워드는 호의 사실에 정의가 없다
            {'kind': 'place', 'value': '합정동', 'count': 9},          # 재소환 기사의 지역은 이번 기간에 없다
            {'kind': 'place', 'value': '부산', 'count': 9},            # 기록에 없는 곳
            {'kind': 'place', 'value': '연남동 카페', 'count': 9},      # 경유지 이름으로는 센다
        ]
        comp = compose(sc)
        self.assertEqual(self.cells(comp), [('1', '연남동 카페')])
        self.assertGreaterEqual(sum(1 for d in comp.report['decisions'] if '셀 수 없어' in d), 3)

    def test_the_definition_counts_period_stops_by_article_region_or_place_name(self):
        sc = fx.many_photos_scenario()
        arts = date_archive_of(sc)['payload']['articles']
        facts = build_facts(articles=arts, fi=0, kept_stops=[], dropped_stops=[])
        self.assertEqual(facts.signal_count('place', '연남동'), 1)                  # 그 지역에서 보낸 날(데이트) 수 - 경유지 4곳이 아니다 (R52-2)
        self.assertEqual(facts.signal_count('place', ' 성수동 '), 1)
        self.assertEqual(facts.signal_count('place', '합정동'), None)
        self.assertEqual(facts.signal_count('place', '경의선숲길'), 1)
        self.assertEqual(facts.signal_count('activity', '연남동'), None)
        self.assertEqual(facts.signal_count('place', ''), None)

    def test_seed_sentences_carry_the_same_numbers_as_the_records(self):
        # M1c 판정 항목의 시드판 - 시드 본문의 숫자는 기록 집계와 같다
        for name, build in SCENARIOS.items():
            sc = build()
            da = date_archive_of(sc)
            tm = next(c for c in sc['corners'] if c['corner_type'] == 'this_month')['content']
            facts = build_facts(articles=da['payload']['articles'], fi=next(i for i, a in enumerate(da['payload']['articles']) if a['featured']),
                                kept_stops=[], dropped_stops=[])
            for a in tm['payload']['articles']:
                m = re.search(r'연남동에서 보낸 날은 이번 달 데이트 기록에 (\d+)번 있었고, 그 경유지는 (\d+)곳', a['body'])
                if m:
                    self.assertEqual(int(m.group(1)), facts.signal_count('place', '연남동'), name)
                    self.assertEqual(int(m.group(2)), fx.stops_in_region(da, '연남동'), name)
            for s in tm['payload']['theme']['signals']:
                self.assertEqual(s['count'], facts.signal_count(s['kind'], s['value']), name)
            self.assertNotRegex(repr(tm), '다섯 번')


# ---------------------------------------------------------------------------
# N5 - 0인 칸
# ---------------------------------------------------------------------------

class ZeroCells(unittest.TestCase):
    @staticmethod
    def article_page_labels(comp):
        spec = pages(comp, 'da-article')[0]
        return [x.get_text(strip=True) for x in soup_of(spec, comp).select('.lbl')]

    def test_article_without_a_memo_has_no_memo_cell(self):
        feat = fx.article('2026-09-12', '대표', '연남동', [fx.stop(0, '10:00', 'A', [fx.photo('a0')], [], '캡션')], featured=True)
        sec = fx.article('2026-09-21', '둘째', '성수동', [fx.stop(0, '13:00', 'C', [fx.photo('c0'), fx.photo('c1')], [], '캡션')])
        comp = compose({'theme': 'basic', 'corners': [fx.corner_row('date_archive', fx.date_archive([feat, sec]))]})
        spec = pages(comp, 'da-article')[0]
        self.assertEqual(spec.computed['da']['articleNoteCount'], '')
        labels = self.article_page_labels(comp)
        self.assertNotIn('메모', labels)
        self.assertNotIn('AI 캡션', labels)
        self.assertIn('사진', labels)
        self.assertIn('경유지', labels)
        html = filled(spec, comp)
        self.assertNotRegex(html, r'<span class="num"[^>]*>0</span>')

    def test_article_with_a_memo_keeps_the_memo_cell(self):
        comp = compose(fx.many_photos_scenario())
        self.assertIn('메모', self.article_page_labels(comp))

    def test_empty_row_goes_with_its_last_cell(self):
        cell = '<div><span style="flex:1"><span class="num" data-slot="@da.articlePhotoCount"></span><span class="lbl">사진</span></span></div>'
        self.assertNotIn('사진', r.drop_empty_count_cells(cell))
        both = ('<div class="r"><span><span class="num" data-slot="@da.articlePhotoCount"></span><span class="lbl">사진</span></span>'
                '<span><span class="num" data-slot="@da.articleNoteCount">2</span><span class="lbl">메모</span></span></div>')
        out = r.drop_empty_count_cells(both)
        self.assertNotIn('사진', out)
        self.assertIn('메모', out)

    def test_timeline_stop_without_photos_has_no_photo_label(self):
        comp = compose(fx.opener_fallback_scenario())          # 대표 기사의 첫 구간에 사진이 없다
        labels = []
        for spec in pages(comp, 'da-timeline'):
            labels += [x.get_text(' ', strip=True) for x in soup_of(spec, comp).select('.lbl')]
        self.assertNotIn('사진 0', labels)
        self.assertEqual(labels, ['사진 2'])
        stops = date_archive_of(fx.opener_fallback_scenario())['payload']['articles'][0]['stops']
        self.assertEqual([len(s['photos']) for s in stops], [0, 2])

    def test_opener_without_any_photo_has_no_photo_cell(self):
        comp = compose(fx.opener_type_only_scenario())         # 대표 기사 전체에 사진이 없다
        spec = pages(comp, 'da-opener')[0]
        self.assertEqual(spec.computed['da']['photoCount'], '')
        labels = [x.get_text(strip=True) for x in soup_of(spec, comp).select('.lbl')]
        self.assertNotIn('사진', labels)
        self.assertIn('경유지', labels)
        with_photos = compose(fx.photo_scenario())
        self.assertIn('사진', [x.get_text(strip=True) for x in soup_of(pages(with_photos, 'da-opener')[0], with_photos).select('.lbl')])

    def test_totals_drop_the_zero_piece(self):
        comp = compose(fx.opener_type_only_scenario())         # 대표 기사 전체에 사진이 없고 메모는 둘
        totals = pages(comp, 'da-timeline')[0].computed['da']['totals']
        self.assertEqual(totals, '메모 2')
        self.assertNotIn('사진 0', filled(pages(comp, 'da-timeline')[0], comp))

    def test_totals_pieces_unit(self):
        class F:  # 호의 사실에서 읽는 다섯 값만 가진 것
            def __init__(self, photos_total, shown, memos_total, memos_shown):
                self.photos_total, self.timeline_photos_shown, self.memos_total, self.memos_shown = photos_total, shown, memos_total, memos_shown
        self.assertEqual(timeline_totals(F(0, 0, 2, 2)), '메모 2')
        self.assertEqual(timeline_totals(F(4, 3, 0, 0)), '사진 3 / 4장')
        self.assertEqual(timeline_totals(F(4, 3, 2, 1)), '사진 3 / 4장 · 메모 1 / 2')
        self.assertEqual(timeline_totals(F(3, 3, 2, 2)), '사진 3장 · 메모 2')
        self.assertEqual(timeline_totals(F(0, 0, 0, 0)), '')

    def test_no_page_prints_a_zero_count_cell_or_label(self):
        for name, build in SCENARIOS.items():
            comp = compose(build())
            for spec in comp.pages:
                if spec.stem not in ('da-opener', 'da-article', 'da-timeline'):
                    continue
                soup = soup_of(spec, comp)
                for num in soup.select('.num'):
                    self.assertNotEqual(num.get_text(strip=True), '0', f'{name} {spec.stem}')
                self.assertNotIn('사진 0', soup.get_text(' ', strip=True), f'{name} {spec.stem}')


# ---------------------------------------------------------------------------
# N6 - 지면에 실린 원문 = 기록의 메시지 · 메모 (글자 단위)
# ---------------------------------------------------------------------------

def printed_original_lines(comp):
    """조립된 지면에서 두 사람의 말 줄을 읽는다 - (종류, 글). 종류: quote(인용 턴) · short(그 밖의 짧은 말) · memo(타임라인 메모) · caption(기사 사진 아래 메모) · evidence(근거 발췌) · cover(이 달의 말)."""
    out = []
    for spec in comp.pages:
        soup = soup_of(spec, comp)
        if spec.stem == 'sw-quotes':
            for el in soup.select('[data-repeat=".turns"] [data-slot=".text"]'):
                out.append(('quote', el.get_text('\n')))
            for el in soup.select('[data-repeat="payload.sub"] [data-slot=".text"]'):
                out.append(('short', el.get_text('\n')))
        elif spec.stem == 'da-timeline':
            out += [('memo', el.get_text('\n')) for el in soup.select('[data-slot=".userNotes[0].text"]')]
        elif spec.stem == 'da-article':
            out += [('caption', el.get_text('\n')) for el in soup.select('[data-slot=".caption"]')]
        elif spec.stem == 'tm-articles':
            for el in soup.select('[data-slot=".evidence"]'):
                out += [('evidence', q) for q in re.findall(r'“([^”]*)”', el.get_text('\n'))]
        elif spec.stem in ('cover-photo', 'cover-type'):
            out += [('cover', el.get_text('\n')) for el in soup.select('[data-slot="@cover.quote"]')]
    return out


class PrintedOriginalsAreRecords(unittest.TestCase):
    def check(self, name, scenario):
        comp = compose(scenario)
        rows = scenario['corners']
        messages = {text for _, text, _ in seed.chat_messages(rows)}
        memos = set(seed.memo_texts(rows))
        lines = printed_original_lines(comp)
        kinds = {k for k, _ in lines}
        for kind, text in lines:
            pool = memos if kind in ('memo', 'caption') else messages
            self.assertIn(text, pool, f'{name} {kind}: 지면의 글이 기록의 {"메모" if pool is memos else "메시지"} 어느 것과도 글자 단위로 같지 않다 「{text}」')
            if '…' in text:                                           # 줄임표는 기록 안에 있던 것이 아니면 없다 (위 비교가 이미 잡지만 이유를 따로 남긴다)
                self.assertTrue(any('…' in m for m in pool), f'{name} {kind}: 기록에 없는 줄임표 「{text}」')
        return kinds, lines, comp

    def test_every_printed_original_line_is_one_record_exactly(self):
        seen = set()
        for name, build in SCENARIOS.items():
            kinds, _, _ = self.check(name, build())
            seen |= kinds
        self.assertEqual(seen, {'quote', 'short', 'memo', 'caption', 'evidence', 'cover'})   # 여섯 종류가 모두 시험에 들었다

    def test_local_volumes_too(self):
        for name, build in [*lv.VOLUMES, lv.OVERFLOW_VOLUME]:
            self.check(name, build())

    def test_every_record_line_of_the_conversations_is_printed_whole(self):
        # 거꾸로도 - 인용으로 실린 대화의 모든 턴이 지면에 한 글자도 줄지 않고 있다
        for name in ('long_original', 'type', 'photo'):
            sc = SCENARIOS[name]()
            printed = [t for k, t in printed_original_lines(compose(sc)) if k == 'quote']
            sw = next(c for c in sc['corners'] if c['corner_type'] == 'sweet_words')['content']
            want = [t['text'] for m in sw['payload']['main'] for t in m['turns']]
            self.assertEqual(sorted(printed), sorted(want), name)

    def test_the_check_catches_a_cut_line(self):
        # 시험 자체의 검증 - 파이프라인이 앞뒤를 자르거나 줄임표를 붙이면 이 시험이 잡는다
        sc = fx.long_original_scenario()
        comp = compose(sc)
        messages = {text for _, text, _ in seed.chat_messages(sc['corners'])}
        quote = next(t for k, t in printed_original_lines(comp) if k == 'quote')
        for broken in (quote[1:], quote[:-1], quote[:-3] + '…', quote.replace('. ', '.\n', 1), quote + ' …'):
            self.assertNotIn(broken, messages)

    def test_a_cover_quote_is_a_whole_message_too(self):
        comp = compose(fx.long_original_scenario())
        covers = [t for k, t in printed_original_lines(comp) if k == 'cover']
        self.assertEqual(len(covers), 1)
        self.assertGreaterEqual(len(covers[0]), 160)
        self.assertRegex(covers[0], r'[.?!]$')


# ---------------------------------------------------------------------------
# N6 - 시드 점검: 긴 원문은 온전한 메시지, 대화 본문은 서로 겹치지 않는다
# ---------------------------------------------------------------------------

def sentences_of(text):
    return [x.strip() for x in re.split(r'(?<=[.?!])\s+', text) if x.strip()]


def all_message_texts(scenario):
    return [text for _, text, _ in seed.chat_messages(scenario['corners'])] + seed.memo_texts(scenario['corners'])


class SeedOriginalsAreWholeAndDistinct(unittest.TestCase):
    def test_long_conversation_turns_are_whole_sentences_of_160_chars_or_more(self):
        for context, day, hour, texts in fx.LONG_CONVERSATION_TEXTS:
            self.assertEqual(len(texts), 4)
            for t in texts:
                self.assertGreaterEqual(len(t), 160, t)
                self.assertLessEqual(len(t), 175, t)                         # 35자 한 줄 기준 5줄 안 - 대화 하나는 한 면에 든다
                self.assertEqual(t, t.strip())
                self.assertRegex(t, r'^[가-힣0-9]', t)                       # 낱말 중간에서 시작하지 않는다
                self.assertRegex(t, r'[.?!]$', t)                            # 문장이 끝나는 곳에서 끝난다
                self.assertNotIn('…', t)
                self.assertNotIn('...', t)

    def test_overlong_conversation_turns_are_whole_and_keep_their_height(self):
        for group in fx.OVERLONG_CONVERSATION_SENTENCES:
            text = ' '.join(group)
            self.assertTrue(386 <= len(text) <= 420, len(text))             # 12줄 -> 4턴 높이 1337px (README §12)
            self.assertRegex(text, r'[.?!]$')
            for sentence in group:
                self.assertRegex(sentence, r'[.?!]$')

    def test_long_memos_end_where_a_sentence_ends(self):
        for pool, n in ((fx.MEMO_SENTENCES_WINDOW, 120), (fx.MEMO_SENTENCES_WINDOW, 400), (fx.MEMO_SENTENCES_ALLEY, 400)):
            memo = fx.whole_memo(pool, n)
            self.assertGreaterEqual(len(memo), n)
            self.assertRegex(memo, r'[.?!]$')
            for sentence in memo.split('. '):
                self.assertTrue(sentence)
        with self.assertRaises(ValueError):
            fx.whole_memo(fx.MEMO_SENTENCES_WINDOW, 5000)                    # 모자라면 같은 문장을 되풀이하지 않고 멈춘다

    def test_the_overflow_volume_still_fits_one_page_by_the_estimate(self):
        # vol4의 뜻 - 높이 어림(메모 50자마다 29px)으로는 한 면에 들지만 실제로는 넘친다. 문장 단위로 고친 메모가 이 조건을 깨지 않는다 (351~400자 = 어림 +203px)
        from compose import split_timeline, stop_height
        sc = fx.timeline_overflow_scenario()
        stops = date_archive_of(sc)['payload']['articles'][0]['stops']
        lengths = [len(s['userNotes'][0]['text']) for s in stops]
        self.assertTrue(all(351 <= n <= 400 for n in lengths), lengths)
        self.assertLessEqual(sum(stop_height(s) for s in stops), 953)
        self.assertEqual([len(p) for p in split_timeline(stops)[0]], [2])

    def test_no_two_messages_of_a_scenario_overlap(self):
        for name, build in SCENARIOS.items():
            sc = build()
            texts = all_message_texts(sc)
            self.assertEqual(len(texts), len(set(texts)), f'{name}: 같은 글이 두 번 있다')
            for i, a in enumerate(texts):
                for j, b in enumerate(texts):
                    if i != j and len(a) >= 20:
                        self.assertNotIn(a, b, f'{name}: 한 글이 다른 글 안에 들어 있다 「{a}」')

    def test_conversation_bodies_share_no_sentence(self):
        for with_overlong in (False, True):
            sc = fx.long_original_scenario(with_overlong=with_overlong)
            sw = next(c for c in sc['corners'] if c['corner_type'] == 'sweet_words')['content']
            seen: dict = {}
            for m in sw['payload']['main']:
                bodies = ' '.join(t['text'] for t in m['turns'])
                mine = set(sentences_of(bodies))
                for other_context, other in seen.items():
                    self.assertFalse(mine & other, f'「{m["context"]}」와 「{other_context}」의 본문에 같은 문장이 있다: {mine & other}')
                seen[m['context']] = mine

    def test_the_vol3_conversations_are_not_the_same_text(self):
        sc = fx.long_original_scenario()
        sw = next(c for c in sc['corners'] if c['corner_type'] == 'sweet_words')['content']
        first, second = ([t['text'] for t in m['turns']] for m in sw['payload']['main'])
        self.assertFalse(set(first) & set(second))
        self.assertNotEqual(first[0][:40], second[0][:40])


if __name__ == '__main__':
    unittest.main()
