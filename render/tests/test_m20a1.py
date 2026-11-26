"""2.0-A1 (위임 m20-a1 ⑤ ⑥ ⑦ ⑧) · 2.0-D(v2.0.0 틀 연결 · 정정 1~3) - 쪽 수 규칙 · 약속 문장 금지 · 새 지면 짜기 · 임시 틀 규칙. 합성 재료만(실제 사람 0)."""

from __future__ import annotations

import re
import sys
import unittest
from unittest import mock
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

import fixtures as fx  # noqa: E402
import render_issue as r  # noqa: E402
from compose import ComposeError, PageSpec, choose_variant, compose_issue  # noqa: E402
from compose20 import ATTACHMENT_TYPE_NAMES, LABELS20, attachment_names_in, signed_delta_text  # noqa: E402
import page_plan  # noqa: E402
from page_plan import BODY_PAGE_CAP, REDUCE_ORDER, plan_pages, reduce_to_cap  # noqa: E402
from promise_check import promise_violations, visible_strings  # noqa: E402

NAMES = [fx.A, fx.B]
ROOT = HERE.parent.parent


def compose20(**kw):
    return compose_issue(fx.ISSUE_ROW, fx.COUPLE_ROW, NAMES, fx.m20_scenario(**kw)['corners'], None)


class PagePlan(unittest.TestCase):
    def test_combinations_multiple_of_4_cap_36_no_blank(self):
        for base in range(4, 37):
            for photos in range(0, 4):
                p = plan_pages(base, photos)
                self.assertLessEqual(p.total, BODY_PAGE_CAP)
                self.assertEqual(p.over, 0)
                self.assertLessEqual(p.photo_breaks, min(2, photos))
                # 빈 쪽 0: 더한 면은 사진 한 장 · 판권 여백뿐, 모자라면 short로 남긴다
                self.assertEqual(p.total, base + p.photo_breaks + (1 if p.colophon_split else 0))
                self.assertEqual((p.total + p.short) % 4, 0)
                if photos >= 2:
                    self.assertEqual(p.total % 4, 0, (base, photos))
                    self.assertEqual(p.short, 0)

    def test_fill_order_photo_then_colophon(self):
        self.assertEqual(plan_pages(21, 2), plan_pages(21, 5))
        p = plan_pages(21, 2)
        self.assertEqual((p.photo_breaks, p.colophon_split, p.total, p.short), (2, True, 24, 0))
        p = plan_pages(22, 2)
        self.assertEqual((p.photo_breaks, p.colophon_split, p.total), (2, False, 24))
        p = plan_pages(23, 0)
        self.assertEqual((p.photo_breaks, p.colophon_split, p.total, p.short), (0, True, 24, 0))
        p = plan_pages(21, 0)   # 사진이 없어 4의 배수를 못 맞춤 - 빈 쪽 대신 short
        self.assertEqual((p.photo_breaks, p.colophon_split, p.total, p.short), (0, True, 22, 2))
        self.assertEqual(plan_pages(24, 2).photo_breaks, 0)

    def test_over_cap(self):
        p = plan_pages(37, 2)   # 줄일 「다음 달」 · 엽서가 없다 -> 실패(over)
        self.assertEqual((p.over, p.photo_breaks, p.reductions), (1, 0, ()))


class ReduceOrder(unittest.TestCase):
    # R158-5 - 36쪽을 넘을 때 줄이는 순서 ① 사진 한 장 2→1→0 ② 판권과 정오 2→1 ③ 다음 달 ④ 엽서 → ⑦ 실패.

    FULL = {'photo_break': 2, 'colophon': 2, 'next_month': 1, 'postcards': 1}   # 줄일 수 있는 것 6면 중 4면

    def test_order_table_has_seats_for_5_6(self):
        self.assertEqual([k for k, _ in REDUCE_ORDER], ['photo_break', 'colophon', 'next_month', 'postcards', 'each_day', 'between_us'])
        self.assertEqual(dict(REDUCE_ORDER), {'photo_break': 0, 'colophon': 1, 'next_month': 0, 'postcards': 0, 'each_day': 1, 'between_us': 1})

    def test_37_takes_one_photo_page_first(self):
        red = reduce_to_cap(37 - 6, self.FULL)
        self.assertEqual((red.total, red.over, red.steps), (36, 0, ('photo_break',)))
        self.assertEqual(red.parts, {'photo_break': 1, 'colophon': 2, 'next_month': 1, 'postcards': 1})

    def test_step_by_step_37_to_41(self):
        want = {
            37: ('photo_break',),
            38: ('photo_break', 'photo_break'),
            39: ('photo_break', 'photo_break', 'colophon'),
            40: ('photo_break', 'photo_break', 'colophon', 'next_month'),
            41: ('photo_break', 'photo_break', 'colophon', 'next_month', 'postcards'),
        }
        for total, steps in want.items():
            red = reduce_to_cap(total - 6, self.FULL)
            self.assertEqual((red.steps, red.total, red.over), (steps, 36, 0), total)

    def test_nothing_left_fails(self):
        red = reduce_to_cap(42 - 6, self.FULL)   # 다 줄여도 37
        self.assertEqual((red.total, red.over), (37, 1))
        self.assertEqual(red.parts, {'photo_break': 0, 'colophon': 1, 'next_month': 0, 'postcards': 0})
        red = reduce_to_cap(40, {})   # 줄일 것이 하나도 없음
        self.assertEqual((red.over, red.steps), (4, ()))

    def test_missing_parts_are_skipped_in_order(self):
        red = reduce_to_cap(35, {'colophon': 1, 'postcards': 1})   # 37 · 사진 0 · 판권 바닥 · 다음 달 없음 -> 엽서
        self.assertEqual((red.steps, red.over), (('postcards',), 0))
        with self.assertRaises(ValueError):
            reduce_to_cap(30, {'this_month': 2})   # 순서표에 없는 지면은 줄이지 않는다

    def test_plan_pages_over_37_40(self):
        p = plan_pages(37, 2, next_month_pages=1, postcard_pages=1)
        self.assertEqual((p.total, p.over, p.drop_next_month, p.drop_postcards, p.photo_breaks, p.colophon_split),
                         (36, 0, True, False, 0, False))
        self.assertEqual(p.reductions, ('next_month',))   # ①②는 채우는 면이라 넘치는 호에서는 이미 0면 · 1면
        p = plan_pages(38, 2, next_month_pages=1, postcard_pages=1)
        self.assertEqual((p.total, p.over, p.reductions, p.drop_next_month, p.drop_postcards), (36, 0, ('next_month', 'postcards'), True, True))
        p = plan_pages(37, 0, next_month_pages=0, postcard_pages=1)
        self.assertEqual((p.total, p.reductions, p.drop_next_month, p.drop_postcards), (36, ('postcards',), False, True))
        p = plan_pages(40, 2, next_month_pages=1, postcard_pages=1)   # 2면 줄여도 38 -> 실패
        self.assertEqual((p.total, p.over), (38, 2))

    def test_under_cap_is_unchanged(self):
        for base in range(4, 37):
            for nm in (0, 1):
                for pc in (0, 1):
                    a, b = plan_pages(base, 2, nm, pc), plan_pages(base, 2)
                    self.assertEqual((a.photo_breaks, a.colophon_split, a.total, a.short, a.over, a.reductions),
                                     (b.photo_breaks, b.colophon_split, b.total, b.short, b.over, ()))

    def test_compose_drops_next_month_then_postcards_and_fails_after(self):
        base = compose20()
        n = base.report['pagePlan']['base']
        self.assertEqual(n, base.report['pagePlan']['total'] - base.report['pagePlan']['photoBreaks'] - base.report['pagePlan']['colophonSplit'])
        stems = [p.stem for p in base.pages]
        self.assertIn('next', stems)
        self.assertIn('appendix-postcard', stems)
        with mock.patch.object(page_plan, 'BODY_PAGE_CAP', n - 1):
            comp = compose20()
            st = [p.stem for p in comp.pages]
            self.assertNotIn('next', st)
            self.assertIn('appendix-postcard', st)
            self.assertNotIn('다음 달', [t['title'] for t in comp.report['toc']])
            self.assertEqual(comp.report['pagePlan']['reductions'], ['next_month'])
            self.assertEqual(len(comp.pages), n - 1)
        with mock.patch.object(page_plan, 'BODY_PAGE_CAP', n - 2):
            comp = compose20()
            st = [p.stem for p in comp.pages]
            self.assertNotIn('next', st)
            self.assertNotIn('appendix-postcard', st)
            self.assertEqual(comp.report['pagePlan']['reductions'], ['next_month', 'postcards'])
            rows = comp.pages[2].computed['note']['materials']
            self.assertTrue([x for x in rows if x['label'] == '부록 사진'][0]['used'].startswith('엽서 0장'))   # 발행 노트도 실린 만큼만
        with mock.patch.object(page_plan, 'BODY_PAGE_CAP', n - 3):
            with self.assertRaises(ComposeError):
                compose20()
        self.assertNotIn('reductions', base.report['pagePlan'])

    def test_colophon_never_splits_with_v2_template(self):
        # 2.0-D - 판권과 정오 틀은 한 면(정오를 다음 면으로 나누는 변형 없음) -> 판권 여백으로 채우지 않고 short로 남긴다(PM 확인 대상)
        p = plan_pages(23, 0, colophon_split_ok=False)
        self.assertEqual((p.colophon_split, p.total, p.short), (False, 23, 1))
        comp = compose20()
        self.assertEqual([x.stem for x in comp.pages].count('colophon'), 1)
        self.assertFalse(comp.report['pagePlan']['colophonSplit'])
        self.assertEqual((comp.report['pagePlan']['total'] + comp.report['pagePlan']['short']) % 4, 0)


class Promise(unittest.TestCase):
    def test_patterns(self):
        for bad in ('다음 호에서 만나요', '다음 호에 실립니다', '다음 달에 만나요', '기대해 주세요', '다음호에서'):
            self.assertTrue(promise_violations(bad), bad)
        for ok in ('10월 13일 · 500일', '다음 달', '바로잡을 내용은 설정 › 문의로 알려 주세요.'):
            self.assertEqual(promise_violations(ok), [], ok)

    def test_filled_output_of_next_colophon_note_back_passes(self):
        # F5 - 채운 출력(틀 고정 문구 포함)에 건다. 틀의 고정 문구가 모두 통과해야 한다
        templates = r.load_templates()
        comp = compose20()
        seen = set()
        for p in comp.pages:
            if p.stem in r.PROMISE_CHECKED_STEMS:
                html = r.fill_page(p, 'basic', templates)
                self.assertEqual(r.output_promise_violations(p.stem, html), [], p.stem)
                seen.add(p.stem)
        self.assertEqual(seen, {'next', 'colophon', 'note', 'back'})
        for stem in ('next', 'colophon', 'note', 'back'):   # 틀 그대로(견본 글자 포함)도 통과
            self.assertEqual(promise_violations(r.output_visible_text(templates[stem])), [], stem)

    def test_promise_in_filled_output_stops_the_build(self):
        bad = r.fill_page(PageSpec('next', None, {'next': {'monthNum': '10', 'monthLine': '다음 호에서 만나요', 'emptyLine': ''}}), 'basic', r.load_templates())
        self.assertTrue(r.output_promise_violations('next', bad))
        self.assertEqual(r.output_promise_violations('dna-figure', bad), [])   # 검사 지면만

    def test_promise_in_note_fails_the_compose(self):
        sc = fx.m20_scenario()
        appendix = sc['corners'][-1]['content']['payload']
        appendix['colophon']['names'] = '다음 호에서 만나요'   # 노트 · 판권 어디든 약속 꼴이면 멈춘다(판권은 지면 글)
        appendix['nextMonth']['milestones'][0]['label'] = '기대해 주세요'
        with self.assertRaises(ComposeError):
            compose_issue(fx.ISSUE_ROW, fx.COUPLE_ROW, NAMES, sc['corners'], None)


class Compose20(unittest.TestCase):
    def test_order_follows_plan_section_3(self):
        stems = [p.stem for p in compose20().pages]
        self.assertEqual(stems[:4], ['cover-photo', 'contents', 'note', 'da-opener'])
        order = ['tm-articles', 'photo-break', 'dna-figure', 'dna-axes', 'rough-guess', 'photo-break',
                 'appendix-calendar', 'appendix-postcard', 'next', 'colophon', 'back']
        self.assertEqual(stems[-len(order):], order)

    def test_skipped_corners_drop_with_plan_sentence(self):
        comp = compose20(dna=False, rough=False)
        stems = [p.stem for p in comp.pages]
        self.assertNotIn('dna-figure', stems)
        note = comp.pages[2].computed['note']
        self.assertIn('우리의 연애 DNA — 성격 정보가 아직 없어 싣지 않았습니다', note['emptyCorners'])
        self.assertIn('얼렁뚱땅 어림짐작 — 성격 정보가 아직 없어 싣지 않았습니다', note['emptyCorners'])
        self.assertNotIn('이번 호에는 없습니다', note['emptyCorners'])

    def test_no_next_month_page_without_milestone(self):
        self.assertNotIn('next', [p.stem for p in compose20(next_month=False).pages])

    def test_note_new_rows_go_into_materials_and_grid(self):
        comp = compose20()
        note = comp.pages[2].computed['note']
        base = compose_issue(fx.ISSUE_ROW, fx.COUPLE_ROW, NAMES, fx.photo_scenario()['corners'], None)
        old = base.pages[2].computed['note']['materials']
        self.assertEqual(note['materials'][:len(old)], old)
        self.assertEqual([x['label'] for x in note['materials'][len(old):]], ['성격 정보', '대화 묶음', '부록 사진'])
        self.assertEqual(note['materials'][len(old) + 1], {'label': '대화 묶음', 'collected': '18개', 'used': '지표 18개'})
        # F7 - 재료 6줄 이상이면 grid, 5줄 이하면 rows(3코너 호는 그대로)
        self.assertEqual(choose_variant(comp.pages[2], frozenset({'rows', 'grid'}), None), 'grid' if len(note['materials']) > 5 else 'rows')
        self.assertEqual(choose_variant(base.pages[2], frozenset({'rows', 'grid'}), None), 'rows')
        kinds = {s['kind'] for s in comp.sentences if s['who'] == 'ondolog'}
        self.assertIn('dna', kinds)
        self.assertIn('roughGuess', kinds)
        self.assertGreater(comp.report['sentences']['ondolog'], base.report['sentences']['ondolog'])

    def test_contents_variant_short_long(self):
        comp = compose20()
        toc = comp.pages[1].computed['toc']
        want = 'long' if len(toc) > 8 else 'short'
        self.assertEqual(choose_variant(comp.pages[1], frozenset({'short', 'long'}), None), want)
        many = PageSpec('contents', None, {'toc': [{'title': str(i)} for i in range(9)]})
        few = PageSpec('contents', None, {'toc': [{'title': str(i)} for i in range(8)]})
        self.assertEqual(choose_variant(many, frozenset({'short', 'long'}), None), 'long')
        self.assertEqual(choose_variant(few, frozenset({'short', 'long'}), None), 'short')

    def test_dna_variants_and_chat_delta_text(self):
        comp = compose20()
        fig = [p for p in comp.pages if p.stem == 'dna-figure'][0]
        self.assertEqual(choose_variant(fig, frozenset({'delta', 'first'}), None), 'first')
        self.assertEqual(choose_variant(fig, frozenset({'chat', 'chat-pending'}), None), 'chat-pending')
        self.assertEqual(fig.computed['dna']['chatDeltaText'], '')
        sc = fx.m20_scenario()
        dna = [c for c in sc['corners'] if c['corner_type'] == 'love_dna'][0]['content']['payload']
        dna['score'].update({'chatDelta': 9.16, 'chatApplied': True, 'total': 74.16, 'coeffVersion': 'dna_v0', 'previousTotal': 70, 'delta': 4.16, 'firstIssue': False})
        comp2 = compose_issue(fx.ISSUE_ROW, fx.COUPLE_ROW, NAMES, sc['corners'], None)
        fig2 = [p for p in comp2.pages if p.stem == 'dna-figure'][0]
        self.assertEqual(choose_variant(fig2, frozenset({'delta', 'first'}), None), 'delta')
        self.assertEqual(choose_variant(fig2, frozenset({'chat', 'chat-pending'}), None), 'chat')
        self.assertEqual(fig2.computed['dna']['chatDeltaText'], '+9.16')
        self.assertNotIn('채팅 반영 전', comp2.report['toc'][3]['desc'])
        self.assertIn('74.16', comp2.report['toc'][3]['desc'])
        self.assertEqual(signed_delta_text(-3), '−3.0')
        self.assertEqual(signed_delta_text(0), '0.0')
        self.assertEqual(signed_delta_text(25), '+25.0')
        # 빅5 · 스턴버그는 저장값 그대로 옮겨 담는다(지면용 보기)
        axes = [p for p in comp.pages if p.stem == 'dna-axes'][0].corner['payload']
        self.assertEqual(axes['partners'][0]['bigFive'], {'o': 60, 'c': 70, 'e': 80, 'a': 50, 'n': 40})
        self.assertEqual(axes['partners'][1]['bigFive'], {'o': 55, 'c': 40, 'e': 20, 'a': 50, 'n': 45})
        self.assertEqual(axes['sternbergOverlap']['passion'], {'a': 60, 'b': 30})

    def test_rough_guess_view_estimates_measured(self):
        comp = compose20()
        v = [p for p in comp.pages if p.stem == 'rough-guess'][0].corner['payload']
        self.assertEqual(len(v['estimates']), 3)
        self.assertEqual(v['disclaimer'], '재미로 보는 지면입니다. 진짜로 잰 값은 아닙니다.')   # 정정 3(R158-8 ②)
        self.assertEqual(set(v['measured']), {'reply', 'talkFirst', 'emoji'})
        self.assertTrue(v['monthlyTopic']['text'])

    def test_photo_break_land_port_and_note_caption(self):
        comp = compose20(break_note='비 온 뒤 하늘이 맑았던 날, 자르지 않는 원문입니다.')
        pb = [p for p in comp.pages if p.stem == 'photo-break'][0]
        self.assertEqual(pb.corner['payload']['caption'], '비 온 뒤 하늘이 맑았던 날, 자르지 않는 원문입니다.')
        self.assertIn('photoBreak', {s['kind'] for s in comp.sentences if s['who'] == 'people'})
        ph = pb.corner['payload']['photo']
        want = 'land' if ph['width'] >= ph['height'] else 'port'
        self.assertEqual(choose_variant(pb, frozenset({'land', 'port'}), None), want)
        tall = PageSpec('photo-break', {'payload': {'photo': {'width': 800, 'height': 1200}}})
        self.assertEqual(choose_variant(tall, frozenset({'land', 'port'}), None), 'port')

    def test_toc_receives_new_items(self):
        toc = compose20().report['toc']
        self.assertEqual([t['title'] for t in toc][3:], ['우리의 연애 DNA', '얼렁뚱땅 어림짐작', '잡지 부록', '다음 달', '판권과 정오'])
        self.assertIn('채팅 반영 전', toc[3]['desc'])

    def test_colophon_title_and_issue_label(self):
        templates = r.load_templates()
        comp = compose20()
        col = [p for p in comp.pages if p.stem == 'colophon'][0]
        self.assertEqual(col.computed['colophon']['issueLabel'], '2026년 9월호 · 제 3호')   # 발행일 없음 - 호 라벨 · 호 번호만
        text = r.output_visible_text(r.fill_page(col, 'basic', templates))
        self.assertIn('판권과 정오', text)   # 러닝헤드(R158-3의 6)
        self.assertNotIn('판권 · 정오', text)
        self.assertNotRegex(text, r'발행일|\d{4}-\d{2}-\d{2}|\d+월 \d+일 발행')

    def test_next_values(self):
        nx = [p for p in compose20().pages if p.stem == 'next'][0]
        self.assertEqual(nx.computed['next']['monthNum'], '10')
        self.assertEqual(nx.computed['next']['monthLine'], '2026년 10월 · 31일 · 일요일 4번')
        self.assertEqual(nx.computed['next']['emptyLine'], '')
        self.assertEqual(nx.corner['payload']['milestones'][0]['dateText'], '10월 13일 화요일')

    def test_calendar_weeks_sunday_first(self):
        cal = [p for p in compose20().pages if p.stem == 'appendix-calendar'][0].computed['calendar']
        days = [d['day'] for w in cal['weeks'] for d in w['days']]
        self.assertEqual(days[:5], ['', '', '', '', '1'])   # 2026-10-01 = 목요일
        self.assertEqual(len(days) % 7, 0)
        self.assertEqual([d['mark'] for w in cal['weeks'] for d in w['days'] if d['mark']], ['500일'])
        self.assertEqual((cal['monthNum'], cal['yearText'], cal['monthEn']), ('10', '2026', 'OCTOBER'))

    def test_shown_photos_include_appendix(self):
        comp = compose20()
        for entry in ('e20', 'e21'):
            self.assertIn(fx.dest(entry), comp.shown_photos)

    def test_issue_without_appendix_is_untouched(self):
        a = compose_issue(fx.ISSUE_ROW, fx.COUPLE_ROW, NAMES, fx.photo_scenario()['corners'], None)
        self.assertNotIn('pagePlan', a.report)
        self.assertFalse(any(p.stem in NEW_STEMS for p in a.pages))


NEW_STEMS = ('dna-figure', 'dna-axes', 'rough-guess', 'appendix-calendar', 'appendix-postcard', 'photo-break', 'next', 'colophon')


class V2Templates(unittest.TestCase):
    def test_temp_pages_folder_is_gone(self):
        self.assertFalse((ROOT / 'render' / 'temp_pages').exists())
        self.assertFalse(any(k.startswith('tp-') for k in r.load_templates()))
        for name, title in LABELS20.values():
            self.assertRegex(title, r'^[가-힣 ]{1,7}$')

    def test_titles_match_ts_table(self):
        ts = (ROOT / 'src' / 'types' / 'corners' / 'cornerTitles.ts').read_text(encoding='utf-8')
        for key, (name, title) in LABELS20.items():
            self.assertRegex(ts, rf"{key}: \{{ cornerName: '{re.escape(name)}', pageTitle: '{re.escape(title)}' \}}")

    def test_every_at_name_in_new_pages_is_defined(self):
        templates = r.load_templates()
        comp = compose20()
        for p in comp.pages:
            if p.stem not in NEW_STEMS:
                continue
            html = re.sub(r'<!--.*?-->', '', templates[p.stem], flags=re.S)
            for path in re.findall(r'data-(?:slot|src|if|repeat|width)="!?@([^".\[]+)', html):
                if path == 'page':
                    continue
                self.assertIn(path, p.computed, (p.stem, path))

    def test_fill_all_new_pages_without_sample_photos_or_sample_text(self):
        # 사진 칸은 실린 사진 경로로 바뀐다 - 견본 사진(`images/sample`)이 남으면 build_pages가 렌더를 멈춘다(SAMPLE_MARK)
        templates = r.load_templates()
        for p in compose20().pages:
            html = r.fill_page(p, 'basic', templates)
            body = re.sub(r'<!--.*?-->', '', html, flags=re.S)
            self.assertNotIn(r.SAMPLE_MARK, body, p.stem)
            if p.stem in NEW_STEMS:
                for sample in ('견본상점', '예시 산책로', '조용히 오래 보는 사람', '친밀과 헌신이'):
                    self.assertNotIn(sample, r.output_visible_text(html), (p.stem, sample))

    def test_sample_stamp_is_always_blank_in_real_issues(self):
        # F3 - `@sample.stamp`는 견본 PDF에서만 "견본". 실제 호는 늘 빈 값 -> 요소째 빠진다(협찬 지면은 아직 연결 0 - 틀로 고정)
        for comp in (compose20(), compose_issue(fx.ISSUE_ROW, fx.COUPLE_ROW, NAMES, fx.photo_scenario()['corners'], None)):
            for p in comp.pages:
                self.assertNotIn('sample', p.computed, p.stem)
        html = r.fill_page(PageSpec('sponsored', None, {}), 'basic', r.load_templates())
        self.assertNotIn('data-slot="@sample.stamp"', html)
        self.assertNotIn('>견본<', html)


class AttachmentNames(unittest.TestCase):
    """2.0-D 정정 2(R158-8 ①) - 모든 지면 출력에 애착 유형 이름(안정형 · 불안형 · 회피형 · 혼란형 · 공포회피형 등)이 나오지 않는다."""

    def scenarios(self):
        yield 'm20', fx.m20_scenario()
        for name in ('photo_scenario', 'type_scenario', 'skipped_scenario', 'batch2_scenario', 'batch4_scenario', 'edge_scenario'):
            yield name, getattr(fx, name)()

    def test_no_attachment_type_name_in_any_page_output(self):
        templates = r.load_templates()
        for name, sc in self.scenarios():
            comp = compose_issue(fx.ISSUE_ROW, fx.COUPLE_ROW, NAMES, sc['corners'], None)
            for p in comp.pages:
                text = r.output_visible_text(r.fill_page(p, comp.theme, templates))
                self.assertEqual(attachment_names_in(text), [], (name, p.stem))

    def test_pair_label_shows_instead_of_type_names(self):
        text = r.output_visible_text(r.fill_page([p for p in compose20().pages if p.stem == 'dna-axes'][0], 'basic', r.load_templates()))
        self.assertIn('각자의 자리를 지켜 주는 짝', text)   # 엔진 ATTACHMENT_PAIR_LABELS['avoidant+secure'](fixtures)
        self.assertNotIn('안정형과', text)

    def test_ai_text_with_type_name_stops_compose(self):
        sc = fx.m20_scenario()
        dna = [c for c in sc['corners'] if c['corner_type'] == 'love_dna'][0]['content']['payload']
        dna['attachmentCombo']['headline'] = '안정형과 회피형의 만남'
        with self.assertRaises(ComposeError):
            compose_issue(fx.ISSUE_ROW, fx.COUPLE_ROW, NAMES, sc['corners'], None)

    def test_ts_and_py_name_lists_agree(self):
        ts = (ROOT / '__tests__' / 'engine' / 'm20a1Engines.test.ts').read_text(encoding='utf-8')
        for n in ('안정형', '불안형', '회피형', '혼란형', '공포회피형'):
            self.assertIn(n, ATTACHMENT_TYPE_NAMES)
            self.assertIn(f"'{n}'", ts)


if __name__ == '__main__':
    unittest.main()
