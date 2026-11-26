"""2.0-A1 (위임 m20-a1 ⑤ ⑥ ⑦ ⑧) - 쪽 수 규칙 · 약속 문장 금지 · 새 지면 짜기 · 임시 틀 규칙. 합성 재료만(실제 사람 0)."""

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
from compose import ComposeError, compose_issue  # noqa: E402
from compose20 import LABELS20  # noqa: E402
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
        self.assertIn('tp-next-month', stems)
        self.assertIn('tp-appendix-postcards', stems)
        with mock.patch.object(page_plan, 'BODY_PAGE_CAP', n - 1):
            comp = compose20()
            st = [p.stem for p in comp.pages]
            self.assertNotIn('tp-next-month', st)
            self.assertIn('tp-appendix-postcards', st)
            self.assertNotIn('다음 달', [t['title'] for t in comp.report['toc']])
            self.assertEqual(comp.report['pagePlan']['reductions'], ['next_month'])
            self.assertEqual(len(comp.pages), n - 1)
        with mock.patch.object(page_plan, 'BODY_PAGE_CAP', n - 2):
            comp = compose20()
            st = [p.stem for p in comp.pages]
            self.assertNotIn('tp-next-month', st)
            self.assertNotIn('tp-appendix-postcards', st)
            self.assertEqual(comp.report['pagePlan']['reductions'], ['next_month', 'postcards'])
            rows = comp.pages[3].computed['tp']['rows']
            self.assertTrue(rows[2]['used'].startswith('엽서 0장'))   # 발행 노트도 실린 만큼만
        with mock.patch.object(page_plan, 'BODY_PAGE_CAP', n - 3):
            with self.assertRaises(ComposeError):
                compose20()
        self.assertNotIn('reductions', base.report['pagePlan'])


class Promise(unittest.TestCase):
    def test_patterns(self):
        for bad in ('다음 호에서 만나요', '다음 호에 실립니다', '다음 달에 만나요', '기대해 주세요', '다음호에서'):
            self.assertTrue(promise_violations(bad), bad)
        for ok in ('10월 13일 · 500일', '다음 달', '바로잡을 내용은 설정 › 문의로 알려 주세요.'):
            self.assertEqual(promise_violations(ok), [], ok)

    def test_next_month_note_back_are_checked(self):
        comp = compose20()
        for stem in ('tp-next-month', 'back', 'note'):
            for p in [x for x in comp.pages if x.stem == stem]:
                self.assertEqual(promise_violations(' '.join(visible_strings(p.computed))), [], stem)

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
        self.assertEqual(stems[:4], ['cover-photo', 'contents', 'note', 'tp-note-more'])
        order = ['tm-articles', 'tp-photo-break', 'tp-dna-score', 'tp-dna-axes', 'tp-rough-guess', 'tp-photo-break',
                 'tp-appendix-calendar', 'tp-appendix-postcards', 'tp-next-month', 'tp-colophon', 'back']
        self.assertEqual(stems[-len(order):], order)
        self.assertEqual(len(stems) % 4, 0)

    def test_skipped_corners_drop_with_plan_sentence(self):
        comp = compose20(dna=False, rough=False)
        stems = [p.stem for p in comp.pages]
        self.assertNotIn('tp-dna-score', stems)
        note = comp.pages[2].computed['note']
        self.assertIn('우리의 연애 DNA — 성격 정보가 아직 없어 싣지 않았습니다', note['emptyCorners'])
        self.assertIn('얼렁뚱땅 어림짐작 — 성격 정보가 아직 없어 싣지 않았습니다', note['emptyCorners'])
        self.assertNotIn('이번 호에는 없습니다', note['emptyCorners'])

    def test_no_next_month_page_without_milestone(self):
        self.assertNotIn('tp-next-month', [p.stem for p in compose20(next_month=False).pages])

    def test_note_new_rows_and_sentence_bar_counts_new_ai_sentences(self):
        comp = compose20()
        # 새 재료 줄은 「발행 노트 · 이어서」(노트 틀은 한 면 고정 - 실측으로 새 줄 1개까지만 들어감 · R152-2 되받기)
        rows = comp.pages[3].computed['tp']['rows']
        self.assertEqual([x['label'] for x in rows], ['성격 정보', '대화 묶음', '부록 사진'])
        self.assertEqual(rows[1], {'label': '대화 묶음', 'collected': '18개', 'used': '지표 18개'})
        kinds = {s['kind'] for s in comp.sentences if s['who'] == 'ondolog'}
        self.assertIn('dna', kinds)
        self.assertIn('roughGuess', kinds)
        base = compose_issue(fx.ISSUE_ROW, fx.COUPLE_ROW, NAMES, fx.photo_scenario()['corners'], None)
        self.assertEqual(comp.pages[2].computed['note']['materials'], base.pages[2].computed['note']['materials'])
        self.assertGreater(comp.report['sentences']['ondolog'], base.report['sentences']['ondolog'])

    def test_photo_break_note_caption_counts_as_people_original(self):
        comp = compose20(break_note='비 온 뒤 하늘이 맑았던 날, 자르지 않는 원문입니다.')
        pb = [p for p in comp.pages if p.stem == 'tp-photo-break'][0]
        self.assertEqual(pb.computed['tp']['caption'], '비 온 뒤 하늘이 맑았던 날, 자르지 않는 원문입니다.')
        self.assertIn('photoBreak', {s['kind'] for s in comp.sentences if s['who'] == 'people'})

    def test_toc_receives_new_items(self):
        toc = compose20().report['toc']
        self.assertEqual([t['title'] for t in toc][3:], ['우리의 연애 DNA', '얼렁뚱땅 어림짐작', '잡지 부록', '다음 달', '판권과 정오'])
        self.assertIn('채팅 반영 전', toc[3]['desc'])

    def test_colophon_title_and_edition_line(self):
        comp = compose20()
        col = [p for p in comp.pages if p.stem == 'tp-colophon'][0].computed['tp']
        self.assertEqual((col['cornerName'], col['pageTitle']), ('판권과 정오', '판권과 정오'))   # R158-3의 6 - 러닝헤드 · 제목
        self.assertRegex(col['pageTitle'], r'^[가-힣 ]{1,7}$')
        self.assertEqual(col['editionLine'], '2026년 9월호 · 제 3호')   # 발행일 없음 - 호 라벨 · 호 번호만
        self.assertNotRegex(' '.join(visible_strings(col)), r'발행일|\d{4}-\d{2}-\d{2}|\d+월 \d+일 발행')

    def test_dna_chat_applied_drops_the_mark(self):
        sc = fx.m20_scenario()
        dna = [c for c in sc['corners'] if c['corner_type'] == 'love_dna'][0]['content']['payload']
        dna['score'].update({'chatDelta': 9.16, 'chatApplied': True, 'total': 74.16, 'coeffVersion': 'dna_v0'})
        comp = compose_issue(fx.ISSUE_ROW, fx.COUPLE_ROW, NAMES, sc['corners'], None)
        self.assertNotIn('채팅 반영 전', comp.report['toc'][3]['desc'])
        self.assertIn('74.16', comp.report['toc'][3]['desc'])

    def test_shown_photos_include_appendix(self):
        comp = compose20()
        for entry in ('e20', 'e21'):
            self.assertIn(fx.dest(entry), comp.shown_photos)

    def test_issue_without_appendix_is_untouched(self):
        a = compose_issue(fx.ISSUE_ROW, fx.COUPLE_ROW, NAMES, fx.photo_scenario()['corners'], None)
        self.assertNotIn('pagePlan', a.report)
        self.assertFalse(any(p.stem.startswith('tp-') for p in a.pages))


class TempTemplates(unittest.TestCase):
    def test_separate_folder_header_and_titles(self):
        tdir = ROOT / 'render' / 'temp_pages'
        files = sorted(tdir.glob('*.html'))
        self.assertEqual(len(files), 10)
        for f in files:
            html = f.read_text(encoding='utf-8')
            self.assertIn('임시 — 디자인 v2.0.0 반입 때 교체', html)
            self.assertTrue(f.stem.startswith('tp-'))
            self.assertFalse((ROOT / 'render' / 'issue' / 'pages' / f.name).exists())
        for name, title in LABELS20.values():
            self.assertRegex(title, r'^[가-힣 ]{1,7}$')

    def test_titles_match_ts_table(self):
        ts = (ROOT / 'src' / 'types' / 'corners' / 'cornerTitles.ts').read_text(encoding='utf-8')
        for key, (name, title) in LABELS20.items():
            self.assertRegex(ts, rf"{key}: \{{ cornerName: '{re.escape(name)}', pageTitle: '{re.escape(title)}' \}}")

    def test_every_at_name_in_temp_pages_is_defined(self):
        from slot_fill import Context, resolve  # noqa: F401
        templates = r.load_templates()
        comp = compose20()
        for p in comp.pages:
            if not p.stem.startswith('tp-'):
                continue
            html = re.sub(r'<!--.*?-->', '', templates[p.stem], flags=re.S)
            for path in re.findall(r'data-(?:slot|src|if|repeat)="!?@([^".]+)\.?([^"]*)"', html):
                root = path[0]
                self.assertIn(root, p.computed, (p.stem, path))

    def test_fill_all_temp_pages_without_sample_photos(self):
        # 사진 칸은 실린 사진 경로로 바뀐다 - 견본 사진(`images/sample`)이 남으면 build_pages가 렌더를 멈춘다(SAMPLE_MARK)
        templates = r.load_templates()
        for p in compose20().pages:
            if not p.stem.startswith('tp-'):
                continue
            html = r.fill_page(p, 'basic', templates)
            self.assertNotIn(r.SAMPLE_MARK, re.sub(r'<!--.*?-->', '', html, flags=re.S), p.stem)


if __name__ == '__main__':
    unittest.main()
