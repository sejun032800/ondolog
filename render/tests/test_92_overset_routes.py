"""92- 시험 (위임: `92-dispatch-overset-all-pages-smoke-bundle`, ROADMAP r156 R152-2) - 13지면 넘침 · 잘림 · 겹침이 되받기 · 실패 · 틀 축소로 간다(기록만 0).
네트워크 없음. 견본은 합성(88-b 띄어쓰기 없는 긴 덩어리 재사용 · 실제 사용자 원문 0).

  R1  처리 길 표(브라우저 없음): `page_audit.route` · `overset_by_page` · `gate_failure` 사유에 원문 · id 0
  R2  13지면 실제 Chromium: 지면마다 판면 밖 넘침 견본 / 겹침 견본을 넣으면 - 자리가 정해진 지면은 gate 실패(지면 이름 · 칸 종류만),
      항목 지면(da-timeline · sw-quotes · da-article)은 되받기 길(`feedbackPages`) -> 풀 항목이 없으면 `FeedbackStop`(실패)
  R3  잘림 칸마다(`.clamp*` · `.ai-txt` 말줄임 · 발행 노트 막대 · 틀 밖 숨김 칸) 넘치는 견본 -> 원문 슬롯은 실패 · 온도록 문장은 틀 축소 · 틀 밖 숨김은 실패
  R4  넘침이 없는 시험 호(`photo` · `type` · `edge` · `batch4`)는 기록만 0 · 실패 0 · 되받기 0(`batch4` 긴 제목은 틀 축소 1)
"""

import re
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

import fixtures as fx  # noqa: E402
import page_audit as pa  # noqa: E402
import render_feedback as fb  # noqa: E402
import render_issue as r  # noqa: E402
from compose import compose_issue  # noqa: E402

NAMES = [fx.A, fx.B]
TEMPLATES = r.load_templates()
CHUNK = 'ㅋ' * 40 + ' https://example.com/very/long/path/that/never/breaks ' + '오늘은진짜로아무말도하지않고그냥계속걷기만했던날이었다' * 3
ALL_STEMS = {'back', 'contents', 'cover-photo', 'cover-type', 'da-article', 'da-opener', 'da-places', 'da-timeline', 'note',
             'sw-opener', 'sw-quotes', 'tm-articles', 'tm-lead'}
MOVABLE_STEMS = {'da-timeline', 'sw-quotes', 'da-article'}
# 띄어 쓴 긴 문장(합성) - 칸 안에서 줄바꿈되어 clamp가 자르는 보통 경우
LONG_SENTENCE = ' '.join(['오래 걸었던 골목 끝에서 다시 돌아오는 길'] * 12)
CLAMP_STEMS = {'cover-photo', 'cover-type', 'tm-lead', 'tm-articles', 'da-opener', 'da-article', 'da-places', 'back'}

# 판면 밖으로 나가는 글 상자(지면 아래 끝을 넘는다) - overflow · safe
OVERFLOW_BOX = '<div class="ab" data-test92="overflow" style="left:68px;top:1090px;width:320px;height:90px">합성 넘침 견본 상자</div>'
# 서로 겹치는 글 상자 둘(판면 안) - overlap · text-overlap
OVERLAP_BOXES = ('<div class="ab" data-test92="o1" style="left:200px;top:500px;width:300px;height:60px;background:#fff;color:#000">합성 겹침 견본 하나</div>'
                 '<div class="ab" data-test92="o2" style="left:220px;top:510px;width:300px;height:60px;background:#fff;color:#000">합성 겹침 견본 둘</div>')
# 틀 안전망 밖의 숨김 칸(새 모양이 아니라 시험 전용 견본) - hidden -> 실패
HIDDEN_BOX = ('<div class="ab" data-test92="hidden" style="left:200px;top:400px;width:120px;height:24px;overflow:hidden;white-space:nowrap;'
              'background:#fff;color:#000">' + CHUNK + '</div>')


def compose(sc):
    return compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW, 'magazine_theme': sc['theme']}, NAMES, sc['corners'], sc.get('materials'))


def build(comp, tmp):
    work = Path(tmp) / 'work'
    r.prepare_work(work)
    r.settle_cover(comp, TEMPLATES, work)
    return r.build_pages(comp, TEMPLATES, work, fx.ISSUE_ROW, lambda dest: fx.png(1200, 1600))


def inject(files, snippet):
    for f in files:
        text = f.read_text(encoding='utf-8')
        f.write_text(text.replace('</body>', snippet + '</body>', 1), encoding='utf-8')


def stretch(files, selector_re, text=CHUNK):
    """`class`에 맞는 요소의 글자를 긴 덩어리로 바꾼다(그 요소 안 data-slot 표시는 그대로 둔다)."""
    from bs4 import BeautifulSoup
    for f in files:
        soup = BeautifulSoup(f.read_text(encoding='utf-8'), 'html.parser')
        hit = False
        for el in soup.find_all(class_=re.compile(selector_re)):
            slots = el.find_all(attrs={'data-slot': True})
            target = slots[-1] if slots else el
            target.string = text
            hit = True
        if hit:
            f.write_text(str(soup), encoding='utf-8')


def draw_with(comp, mutate):
    """지면을 짓고 `mutate(files)`로 견본을 넣은 뒤 그려 검사한다 -> (files 이름 목록, audit)."""
    with tempfile.TemporaryDirectory() as tmp:
        files = build(comp, tmp)
        mutate(files)
        res = r.render_pages(files)
        return [p.stem for p in comp.pages], r.audit_summary(comp, res, fx.ISSUE)


def by_stem(audit):
    out = {}
    for row in audit['oversetByPage']:
        acc = out.setdefault(row['stem'], {'feedback': 0, 'fail': 0, 'shrink': 0, 'found': {}})
        for k in ('feedback', 'fail', 'shrink'):
            acc[k] += row[k]
        for k, v in row['found'].items():
            acc['found'][k] = acc['found'].get(k, 0) + v
    return out


# ---------------------------------------------------------------------------
class Routes(unittest.TestCase):
    """R1 - 처리 길 표(브라우저 없음)."""

    def test_overflow_kinds_go_to_feedback_on_movable_pages_and_fail_elsewhere(self):
        for k in ('overflow', 'safe', 'overset', 'overlap', 'text-overlap'):
            self.assertEqual(pa.route({'k': k}, True), 'feedback')
            self.assertEqual(pa.route({'k': k}, False), 'fail')

    def test_clamp_original_fails_ai_text_shrinks_by_the_template_rule(self):
        for slot in pa.ORIGINAL_SLOTS:
            self.assertEqual(pa.route({'k': 'clipped', 'slot': slot}, True), 'fail')
        self.assertEqual(pa.route({'k': 'clipped', 'slot': '@cover.headline'}, False, ('@cover.headline',)), 'fail')
        for slot in ('@cover.headline', 'payload.theme.headline', 'payload.articles[featured].title', '.aiCaption', '@da.lead', '@back.closing', '.body'):
            self.assertEqual(pa.route({'k': 'clipped', 'slot': slot}, False), 'shrink')

    def test_hidden_only_the_template_safety_nets_shrink(self):
        self.assertEqual(pa.route({'k': 'hidden', 'cls': 'ai-txt', 'slots': ['.photo.aiCaption']}, False), 'shrink')
        self.assertEqual(pa.route({'k': 'hidden', 'cls': '', 'dw': '@note.ratioPeopleWidth', 'slots': ['@note.ratioPeople']}, False), 'shrink')
        self.assertEqual(pa.route({'k': 'hidden', 'cls': 'ai-txt', 'slots': ['.text']}, False), 'fail')   # 원문이 들면 틀 안전망이어도 실패
        self.assertEqual(pa.route({'k': 'hidden', 'cls': 'x', 'slots': []}, True), 'fail')

    def test_other_audit_kinds_are_not_routed(self):
        for k in ('contrast', 'tiny', 'broken-image'):
            self.assertIsNone(pa.route({'k': k}, False))

    def test_overset_by_page_has_numbers_and_names_only(self):
        rows = pa.overset_by_page([(1, 'cover-type', False, [{'k': 'overflow', 't': '원문 같은 글'}, {'k': 'contrast'}]),
                                   (2, 'note', False, [])])
        self.assertEqual(rows, [{'n': 1, 'stem': 'cover-type', 'found': {'overflow': 1}, 'feedback': 0, 'fail': 1, 'shrink': 0}])

    def test_gate_reason_has_page_and_kind_only(self):
        audit = {'originalClipped': [], 'originalOverset': [], 'blocked': [{'n': 3, 'stem': 'note', 'k': 'overflow'}], 'feedbackLeft': []}
        reason = r.gate_failure(audit, fx.ISSUE)
        self.assertIn('3쪽 note overflow', reason)
        self.assertNotIn(fx.ISSUE, reason)
        self.assertEqual(r.local_stop_line('렌더 실패: ' + reason), '옮길 수 없는 칸이 넘치거나 겹쳤다')
        left = r.gate_failure({'originalClipped': [], 'originalOverset': [], 'blocked': [], 'feedbackLeft': [{'n': 5, 'stem': 'da-timeline', 'k': 'overlap'}]}, fx.ISSUE)
        self.assertEqual(r.local_stop_line(left), '되받기 뒤에도 넘침 · 겹침이 남았다')


# ---------------------------------------------------------------------------
class AllPages(unittest.TestCase):
    """R2 - 13지면 실제 Chromium: 넘침 · 겹침 견본."""

    @classmethod
    def setUpClass(cls):
        cls.comps = [compose(fx.photo_scenario('basic')), compose(fx.type_scenario('neon'))]
        stems = {p.stem for c in cls.comps for p in c.pages}
        assert stems == ALL_STEMS, stems
        cls.overflow = [draw_with(c, lambda fs: inject(fs, OVERFLOW_BOX)) for c in cls.comps]
        cls.overlap = [draw_with(c, lambda fs: inject(fs, OVERLAP_BOXES)) for c in cls.comps]

    def check(self, runs, kinds):
        seen = set()
        for stems, audit in runs:
            table = by_stem(audit)
            for stem in set(stems):
                seen.add(stem)
                row = table.get(stem)
                self.assertIsNotNone(row, f'{stem}: 견본이 잡히지 않았다')
                self.assertTrue(set(row['found']) & set(kinds), f'{stem}: {row}')
                if stem in MOVABLE_STEMS:
                    self.assertGreater(row['feedback'], 0, stem)
                    self.assertEqual(row['fail'], 0, stem)
                else:
                    self.assertGreater(row['fail'], 0, stem)
                    self.assertEqual(row['feedback'], 0, stem)
            # 기록만 0 - 잡힌 넘침 · 겹침은 모두 셋 중 하나의 길
            for row in audit['oversetByPage']:
                self.assertEqual(sum(row['found'].values()), row['feedback'] + row['fail'] + row['shrink'])
            reason = r.gate_failure(audit, fx.ISSUE)
            self.assertIsNotNone(reason)
            self.assertNotIn(fx.ISSUE, reason.split('|')[-1])
            self.assertNotIn('합성', reason)
        self.assertEqual(seen, ALL_STEMS)

    def test_overflow_sample_on_every_page_fails_or_goes_to_feedback(self):
        self.check(self.overflow, ('overflow', 'safe'))

    def test_overlap_sample_on_every_page_fails_or_goes_to_feedback(self):
        self.check(self.overlap, ('overlap', 'text-overlap'))

    def test_feedback_pages_end_in_failure_when_no_item_can_move(self):
        """항목 지면의 넘침이 항목 때문이 아니면 되받기가 풀 것이 없다 -> 실패(기록만 아님)."""
        sc = fx.photo_scenario('basic')
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'

            def draw(c):
                r.prepare_work(work)
                r.settle_cover(c, TEMPLATES, work)
                files = r.build_pages(c, TEMPLATES, work, fx.ISSUE_ROW, lambda dest: fx.png(1200, 1600))
                inject([f for f, p in zip(files, c.pages) if p.stem == 'da-timeline'], OVERFLOW_BOX)
                res = r.render_pages(files)
                return files, res, r.audit_summary(c, res, fx.ISSUE)

            with self.assertRaises(fb.FeedbackStop) as ctx:
                fb.render_with_feedback(lambda: compose(sc), draw)
        self.assertIn('da-timeline', str(ctx.exception))
        self.assertNotIn('합성', str(ctx.exception))


# ---------------------------------------------------------------------------
class Clipping(unittest.TestCase):
    """R3 - 잘림 칸마다 넘치는 견본."""

    @classmethod
    def setUpClass(cls):
        cls.runs = []
        for sc in (fx.photo_scenario('basic'), fx.type_scenario('neon'), fx.batch2_scenario('lovely')):
            comp = compose(sc)
            cls.runs.append((comp, draw_with(comp, lambda fs: stretch(fs, r'\bclamp[1-4]\b|\bai-txt\b', LONG_SENTENCE))))
        # 띄어쓰기 없는 덩어리(88-b 견본) - 위치가 정해진 상자는 가장 긴 덩어리만큼 넓어져 판면 밖으로 나간다(잘림이 아니라 넘침으로 잡힌다)
        comp = compose(fx.photo_scenario('basic'))
        cls.chunk = (comp, draw_with(comp, lambda fs: stretch(fs, r'\bclamp[1-4]\b|\bai-txt\b', CHUNK)))

    def test_every_clamp_box_is_routed_original_fails_ai_shrinks(self):
        found_stems = set()
        for comp, (_stems, audit) in self.runs:
            clipped = [(p['stem'], f) for p in audit['pages'] for f in p['findings'] if f['k'] == 'clipped']
            self.assertTrue(clipped)
            for stem, f in clipped:
                found_stems.add(stem)
                way = pa.route(f, False, r.clipped_original_slots(comp))
                if f['slot'] in pa.ORIGINAL_SLOTS:
                    self.assertEqual(way, 'fail', f['slot'])
                    self.assertTrue(any(c['slot'] == f['slot'] for c in audit['originalClipped']))
                else:
                    self.assertEqual(way, 'shrink', f['slot'])
            for row in audit['oversetByPage']:
                self.assertEqual(sum(row['found'].values()), row['feedback'] + row['fail'] + row['shrink'])
        # 틀의 clamp 칸이 있는 지면 전부(README §12 표)
        self.assertTrue(CLAMP_STEMS <= found_stems, found_stems)

    def test_unbreakable_chunk_in_a_clamp_box_overflows_and_fails_not_recorded(self):
        comp, (_stems, audit) = self.chunk
        routed = {row['stem']: row for row in audit['oversetByPage']}
        for stem in CLAMP_STEMS & {p.stem for p in comp.pages}:
            row = routed.get(stem)
            self.assertIsNotNone(row, stem)
            self.assertEqual(sum(row['found'].values()), row['feedback'] + row['fail'] + row['shrink'], stem)
        self.assertIsNotNone(r.gate_failure(audit, fx.ISSUE))

    def test_original_question_text_clamp_fails_the_render(self):
        """da-places `.text`(원문 슬롯 목록에 든 칸, clamp3)이 잘리면 렌더 실패."""
        for _comp, (_stems, audit) in self.runs:
            if any(c['stem'] == 'da-places' and c['slot'] == '.text' for c in audit['originalClipped']):
                self.assertIn('원문이 지면에서 잘렸다', r.gate_failure(audit, fx.ISSUE))
                return
        self.fail('da-places .text 잘림 견본이 잡히지 않았다')

    def test_ai_caption_ellipsis_is_detected_as_hidden_and_shrinks(self):
        rows = [f for _c, (_s, a) in self.runs for p in a['pages'] if p['stem'] == 'tm-articles' for f in p['findings'] if f['k'] == 'hidden']
        self.assertTrue(rows, 'tm-articles .ai-txt 말줄임이 잡히지 않았다')
        self.assertTrue(all(pa.route(f, False) == 'shrink' for f in rows if 'ai-txt' in f['cls']))

    def test_note_ratio_bar_label_hidden_shrinks(self):
        comp = compose(fx.photo_scenario('basic'))

        def narrow(files):
            for f, p in zip(files, comp.pages):
                if p.stem == 'note':
                    t = f.read_text(encoding='utf-8')
                    t, n = re.subn(r'(data-width="@note\.ratioPeopleWidth" style="[^"]*?width:)[0-9.]+%', r'\g<1>3%', t, count=1)
                    assert n == 1
                    f.write_text(t, encoding='utf-8')

        _stems, audit = draw_with(comp, narrow)
        rows = [f for p in audit['pages'] if p['stem'] == 'note' for f in p['findings'] if f['k'] == 'hidden']
        self.assertTrue(rows, '좁은 막대의 글자 숨김이 잡히지 않았다')
        self.assertTrue(all(pa.route(f, False) == 'shrink' for f in rows))
        self.assertEqual(audit['blocked'], [])

    def test_hidden_box_outside_the_template_rules_fails(self):
        comp = compose(fx.photo_scenario('basic'))
        _stems, audit = draw_with(comp, lambda fs: inject(fs, HIDDEN_BOX))
        self.assertTrue(any(b['k'] == 'hidden' for b in audit['blocked']))
        self.assertIn('hidden', r.gate_failure(audit, fx.ISSUE))


# ---------------------------------------------------------------------------
class CleanVolumes(unittest.TestCase):
    """R4 - 넘침이 없는 시험 호는 그대로(실패 0 · 되받기 0 · 기록만 0)."""

    def test_clean_volumes_have_no_blocked_and_no_feedback(self):
        for name, sc in (('photo', fx.photo_scenario('basic')), ('type', fx.type_scenario('neon')),
                         ('edge', fx.edge_scenario('basic')), ('batch4', fx.batch4_scenario('basic'))):
            _stems, audit = draw_with(compose(sc), lambda fs: None)
            self.assertEqual(audit['blocked'], [], name)
            self.assertEqual(audit['feedbackPages'], [], name)
            self.assertIsNone(r.gate_failure(audit, fx.ISSUE), name)
            shrink = sum(row['shrink'] for row in audit['oversetByPage'])
            self.assertEqual(shrink, 1 if name == 'batch4' else 0, name)   # batch4 = 40자 긴 기사 제목(생성 상한 20자 밖 견본) - 틀 clamp



# ---------------------------------------------------------------------------
class ChunkWrap(unittest.TestCase):
    """R5 - (2.0-D: 임시 CSS 없이 틀 v2.0.0 `base.css` `overflow-wrap:anywhere`만으로) 덩어리는 칸 끝에서 꺾여 판면 안에 머물고, 꺾여서 늘어난 줄이 예측보다 높으면 되받기가 잡는다."""

    CHUNKY = ' '.join(['ㅋ' * 34, 'https://example.com/very/long/path/to/a/page/that/never/breaks/anywhere?with=query&and=more',
                       '오늘은진짜로아무말도하지않고그냥계속걷기만했던날이었다'] * 4)

    def run_chunky(self, patches=()):
        from unittest import mock
        import measured
        sc = fx.timeline_overflow_scenario('basic')
        for s in sc['corners'][0]['content']['payload']['articles'][0]['stops']:
            s['userNotes'] = [fx.memo(self.CHUNKY)]
        seen = {'needed': False}

        def measure(comp, files, pages):
            groups = fb.measure_items(comp, files, pages)
            est = measured.estimates()
            for n, kind, items in groups:
                if kind != 'timeline':
                    continue
                bigger = any(v > est.get(k, 0) + 0.5 for k, v in items)
                over = sum(v for _k, v in items) > fb.capacity(comp.pages[n - 1], kind) + 0.5
                seen['needed'] = seen['needed'] or (bigger and over)
            return groups

        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'

            def draw(c):
                r.prepare_work(work)
                r.settle_cover(c, TEMPLATES, work)
                files = r.build_pages(c, TEMPLATES, work, fx.ISSUE_ROW, lambda dest: fx.png(1200, 1600))
                res = r.render_pages(files)
                return files, res, r.audit_summary(c, res, fx.ISSUE)

            started = [mock.patch(t, f) for t, f in patches]
            for p in started:
                p.start()
            try:
                comp, _files, _res, audit, summary = fb.render_with_feedback(lambda: compose(sc), draw, measure=measure)
            finally:
                for p in started:
                    p.stop()
        return audit, summary, seen['needed']

    def check_clean(self, audit, summary, needed):
        self.assertEqual([row for row in audit['oversetByPage'] if row['stem'] == 'da-timeline'], [])   # 판면 밖 · 겹침 0 - 덩어리가 칸 안에서 꺾였다
        self.assertIsNone(r.gate_failure(audit, fx.ISSUE))
        if needed:
            self.assertGreaterEqual(summary['rounds'], 1)   # 넘친 지면에 예측보다 큰 항목이 있었으면 되받기가 다시 나눴다
        self.assertLessEqual(summary['rounds'], 2)

    def test_chunk_memos_wrap_inside_the_column(self):
        self.check_clean(*self.run_chunky())

    def test_chunk_lines_taller_than_predicted_are_caught_by_feedback(self):
        """덩어리가 꺾여 늘어난 줄을 예측이 못 따라간 경우(시험 전용으로 예측을 낮춤) - 되받기가 잡아 다시 나눈다."""
        audit, summary, needed = self.run_chunky([('heights.timeline_stop_height', lambda *a, **k: 40)])
        self.assertTrue(needed)
        self.assertGreaterEqual(summary['rounds'], 1)
        self.check_clean(audit, summary, needed)


if __name__ == '__main__':
    unittest.main()
