"""88-b 시험 (위임: `88-b-dispatch-render-feedback-local-render`, ROADMAP r150 R150-3 · R150-4). 네트워크 없음. Chromium을 쓰는 시험은 `Rendered` · `LocalOnly`.

  F1  되받기 규칙(브라우저 없음): 넘침 없음 -> 되받기 0 · 넘침 -> 잰 높이로 다시 짬 · 최대 2번 · 바꿔 끼울 것이 없으면 실패 · 실패 이유에 원문 0
  F2  잰 높이 바꿔 끼우기(compose · facts): 타임라인 다음 면 · 면 상한이면 싣지 않음 + 발행 노트 · 대화 다음 면 · 글만 있는 기사 구간 · 사진 아래 메모(옮길 수 없는 칸 - D5 길)
  F3  실제 Chromium: 예측을 시험 전용으로 낮춰 넘치게 한 뒤 되받기 1번에 넘침 0 · 띄어쓰기 없는 덩어리 견본 원문 그대로 · 결정론 · 면이 없으면 싣지 않음
  L1  `--local-only`: 발행된 호 · 안 된 호 모두 그림 · 쓰기 호출 0(감싸개 + 가짜 클라이언트 쓰기 메서드 0번) · 저장소 안 `--out` 거부 · 화면 줄에 id 0
"""

import html
import json
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.dont_write_bytecode = True
HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, '..'))
sys.path.insert(0, HERE)

import fixtures as fx  # noqa: E402
import facts  # noqa: E402
import heights  # noqa: E402
import measured  # noqa: E402
import render_feedback as fb  # noqa: E402
import render_issue as r  # noqa: E402
from compose import ComposeError, compose_issue  # noqa: E402

NAMES = [fx.A, fx.B]
TEMPLATES = r.load_templates()

# 띄어쓰기 없는 긴 덩어리 견본(합성 - 실제 사용자 원문 0)
CHUNKS = {
    'laugh': 'ㅋ' * 34,
    'cry': 'ㅠ' * 16,
    'url': 'https://example.com/very/long/path/to/a/page/that/never/breaks/anywhere?with=query&and=more',
    'map': 'maps.example.com/place/서울특별시마포구어딘가골목끝작은가게앞',
    'word': '오늘은진짜로아무말도하지않고그냥계속걷기만했던날이었다',
}


def compose(sc, overrides=None):
    with measured.active(overrides or {}):
        return compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW, 'magazine_theme': sc['theme']}, NAMES, sc['corners'], sc.get('materials'))


def compose_plain(sc):
    """되받기 블록 안에서 부르는 짜기(바꿔 끼운 값은 바깥 `measured.active`가 준다)."""
    return compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW, 'magazine_theme': sc['theme']}, NAMES, sc['corners'], sc.get('materials'))


def note_lines(comp):
    return next(p for p in comp.pages if p.stem == 'note').computed['note']['notUsed']


def chunk_scenario(stops_n=4, memo=None):
    """타임라인 구간마다 덩어리가 섞인 긴 메모(사진 1장)."""
    w, h = 1200, 1600
    parts = list(CHUNKS.values())
    stops = []
    for k in range(stops_n):
        text = memo if memo is not None else (
            f"{parts[k % len(parts)]} 오늘은 오래 걸었다. {parts[(k + 1) % len(parts)]}\n"
            f"{parts[(k + 2) % len(parts)]} 그리고 돌아오는 길에 {parts[(k + 3) % len(parts)]}")
        stops.append(fx.stop(k, f'1{k}:00', f'골목 {k}', [fx.photo(f'e{k + 1:02d}', w, h)], [fx.memo(text)], None))
    featured = fx.article('2026-09-12', '덩어리가 많은 하루', '연남동', stops, featured=True)
    da = fx.date_archive([featured], ['연남동'])
    sw = fx.sweet_words([fx.excerpt('짧은 대화', '22', [fx.turn(fx.A, CHUNKS['laugh'], '2026-09-22T09:20:00+09:00'),
                                                     fx.turn(fx.B, CHUNKS['cry'], '2026-09-22T09:21:00+09:00')])])
    return {'theme': 'basic', 'materials': {'messages': 40, 'photos': stops_n, 'dates': 1, 'memos': stops_n},
            'corners': [fx.corner_row('date_archive', da, seq=1), fx.corner_row('sweet_words', sw, seq=2)]}


# ---------------------------------------------------------------------------
class Loop(unittest.TestCase):
    """F1 - 되받기 규칙(가짜 그리기 · 가짜 재기)."""

    def run_loop(self, overset_until, found, max_rounds=2):
        calls = {'draw': 0, 'measure': 0}

        def draw(comp):
            calls['draw'] += 1
            over = [{'n': 2}] if calls['draw'] <= overset_until else []
            return [Path('x')] * len(comp.pages), [], {'originalOverset': over, 'originalClipped': []}

        def measure(comp, files, pages):
            calls['measure'] += 1
            return [(2, 'quote' if k.startswith('qt:') else 'timeline', [(k, v)]) for k, v in found(calls['measure']).items()]

        out = fb.render_with_feedback(lambda: compose_plain(fx.photo_scenario()), draw, measure=measure, max_rounds=max_rounds)
        return out, calls

    def test_no_overflow_no_feedback(self):
        (comp, _f, _r, _a, summary), calls = self.run_loop(0, lambda n: {})
        self.assertEqual(summary, {'rounds': 0, 'moved': {}, 'dropped': {}, 'oversetByPage': []})   # 92- 첫 그림 지면별 넘침 수(없으면 빈 목록)
        self.assertEqual(calls, {'draw': 1, 'measure': 1})   # 항목 지면은 늘 잰다 - 넘침이 없으면 끝

    def test_one_round_then_clean(self):
        (_c, _f, _r, _a, summary), calls = self.run_loop(1, lambda n: {'tl:0': 900.0})
        self.assertEqual(summary['rounds'], 1)
        self.assertEqual(calls, {'draw': 2, 'measure': 2})

    def test_at_most_two_rounds_then_stop_without_text(self):
        with self.assertRaises(fb.FeedbackStop) as ctx:
            self.run_loop(99, lambda n: {'tl:0': 500.0 + n * 100})
        self.assertIn('되받기 2번 뒤에도 넘친다', str(ctx.exception))
        self.assertNotRegex(str(ctx.exception), r'역 앞에서|우산|연남동|' + fx.ISSUE)

    def test_nothing_bigger_stops_at_once(self):
        with self.assertRaises(fb.FeedbackStop) as ctx:
            self.run_loop(99, lambda n: {'tl:0': 1.0})   # 예측보다 작다 - 바꿔 끼울 것 없음
        self.assertIn('예측보다 큰 항목을 찾지 못했다', str(ctx.exception))

    def test_item_bigger_than_a_page_fails_by_the_current_rule(self):
        with self.assertRaises(fb.FeedbackStop) as ctx:
            self.run_loop(99, lambda n: {'qt:0': 5000.0})
        self.assertIn('quote 항목 하나가 한 면보다 크다', str(ctx.exception))


# ---------------------------------------------------------------------------
class Overrides(unittest.TestCase):
    """F2 - 잰 높이를 바꿔 끼우면 기존 규칙대로 다음 면 · 싣지 않음."""

    def test_keys_are_on_view_items_only_and_never_in_html(self):
        comp = compose(fx.photo_scenario())
        place = fb.placements(comp)
        self.assertTrue(any(k.startswith('tl:') for k in place))
        self.assertTrue(any(k.startswith('qt:') for k in place))
        for spec in comp.pages:
            self.assertNotIn('_fbKey', r.fill_page(spec, comp.theme, TEMPLATES))

    def test_no_override_is_identical(self):
        a, b = compose(fx.batch2_scenario()), compose(fx.batch2_scenario(), {})
        self.assertEqual([r.fill_page(p, a.theme, TEMPLATES) for p in a.pages], [r.fill_page(p, b.theme, TEMPLATES) for p in b.pages])

    def test_timeline_stop_moves_to_the_next_page(self):
        sc = fx.many_photos_scenario()
        before = fb.placements(compose(sc))
        after = fb.placements(compose(sc, {'tl:0': 900.0}))
        self.assertEqual(before['tl:1'], ('da-timeline', 0))
        self.assertEqual(after['tl:1'], ('da-timeline', 1))   # 첫 구간이 실제로 크면 둘째 구간은 다음 면으로
        summary = fb.summarize(before, after, 1)
        self.assertEqual(summary['moved'], {'timeline': 1})
        self.assertEqual(summary['dropped'], {'timeline': 1})   # 2면 상한 - 마지막 구간은 싣지 않음

    def test_no_room_in_two_pages_drops_and_notes(self):
        sc = fx.batch2_scenario()
        comp = compose(sc, {'tl:0': 900.0, 'tl:1': 900.0, 'tl:2': 900.0})
        self.assertNotIn('tl:2', fb.placements(comp))
        self.assertIn('구간 1곳 — 타임라인 2면에 들어가지 않았습니다', note_lines(comp))
        self.assertEqual(fb.summarize(fb.placements(compose(sc)), fb.placements(comp), 1)['dropped'], {'timeline': 1})

    def test_quote_moves_to_a_new_page(self):
        sc = fx.photo_scenario()
        base = compose(sc)
        moved = compose(sc, {'qt:0': 900.0})
        self.assertEqual((base.report['quotePages'], moved.report['quotePages']), (1, 2))
        self.assertEqual(fb.summarize(fb.placements(base), fb.placements(moved), 1)['moved'], {'quote': 1})

    def test_article_stop_dropped_with_note(self):
        sc = fx.batch2_scenario()
        base = fb.placements(compose(sc))
        keys = [k for k in base if k.startswith('as:')]
        self.assertTrue(keys)
        comp = compose(sc, {keys[0]: 600.0})
        self.assertFalse([k for k in fb.placements(comp) if k.startswith('as:')])   # 순서를 건너뛰지 않는다 - 뒤 구간도
        self.assertTrue(any('글만 있는 기사 한 면에 들어가지 않았습니다' in x for x in note_lines(comp)))

    def test_photo_memo_is_not_moved_but_left_out_by_the_existing_rule(self):
        sc = fx.batch2_scenario()
        base = fb.placements(compose(sc))
        keys = [k for k in base if k.startswith('ph:')]
        self.assertTrue(keys)
        comp = compose(sc, {keys[0]: measured.UNFIT})
        self.assertNotIn(keys[0], fb.placements(comp))
        self.assertTrue(any('사진 아래 칸에 들어가지 않아 줄이지 않고 뺐습니다' in x for x in note_lines(comp)))


# ---------------------------------------------------------------------------
def render_once(sc, lower=None):
    """실제 Chromium으로 되받기까지. `lower` = 시험 전용으로 예측을 낮추는 패치 목록."""
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp) / 'work'
        box = {}

        def draw(c):
            r.prepare_work(work)
            r.settle_cover(c, TEMPLATES, work)
            files = r.build_pages(c, TEMPLATES, work, fx.ISSUE_ROW, lambda dest: fx.png(1200, 1600))
            box['html'] = [f.read_text(encoding='utf-8') for f in files]
            res = r.render_pages(files)
            return files, res, r.audit_summary(c, res, fx.ISSUE)

        patches = [mock.patch(target, fn) for target, fn in (lower or [])]
        for p in patches:
            p.start()
        try:
            comp, _files, _res, audit, summary = fb.render_with_feedback(lambda: compose_plain(sc), draw)
        finally:
            for p in patches:
                p.stop()
        return comp, audit, summary, box['html']


LOW_TIMELINE = [('heights.timeline_stop_height', lambda *a, **k: 40)]


class Rendered(unittest.TestCase):
    """F3 - 실제 그리기."""

    def test_lowered_prediction_overflows_then_one_round_fixes_it_with_originals_intact(self):
        sc = chunk_scenario(4)
        comp, audit, summary, pages = render_once(sc, LOW_TIMELINE)
        self.assertEqual(audit['originalOverset'], [])
        self.assertGreaterEqual(summary['rounds'], 1)
        self.assertLessEqual(summary['rounds'], 2)
        self.assertGreater(summary['moved'].get('timeline', 0) + summary['dropped'].get('timeline', 0), 0)
        # 원문 그대로 - 실린 구간의 메모 글자가 지면 HTML에 줄바꿈 조각까지 같다
        doc = '\n'.join(pages)
        kept = [k for k in fb.placements(comp) if k.startswith('tl:')]
        for key in kept:
            n = int(key.split(':')[1])
            text = sc['corners'][0]['content']['payload']['articles'][0]['stops'][n]['userNotes'][0]['text']
            for piece in text.split('\n'):
                self.assertIn(html.escape(piece, quote=False), doc)

    def test_deterministic(self):
        a = render_once(chunk_scenario(4), LOW_TIMELINE)
        b = render_once(chunk_scenario(4), LOW_TIMELINE)
        self.assertEqual(a[2], b[2])
        self.assertEqual([p.stem for p in a[0].pages], [p.stem for p in b[0].pages])
        self.assertEqual(a[3], b[3])

    def test_no_room_drops_and_notes_after_feedback(self):
        long_memo = ('오래 걸었다. ' * 30).strip()
        comp, audit, summary, _ = render_once(chunk_scenario(6, long_memo), LOW_TIMELINE)
        self.assertEqual(audit['originalOverset'], [])
        self.assertGreater(summary['dropped'].get('timeline', 0), 0)
        self.assertTrue(any('타임라인 2면에 들어가지 않았습니다' in x for x in note_lines(comp)))

    def test_quotes_lowered_prediction_moves_conversations(self):
        comp, audit, summary, _ = render_once(fx.long_original_scenario('ondol'), [('compose.conversation_height', lambda m: 120)])
        self.assertEqual(audit['originalOverset'], [])
        self.assertGreater(summary['moved'].get('quote', 0), 0)

    def test_chunk_samples_without_lowering_need_no_feedback(self):
        comp, audit, summary, _ = render_once(chunk_scenario(4))
        self.assertEqual(audit['originalOverset'], [])
        self.assertEqual(summary['rounds'], 0)


# ---------------------------------------------------------------------------
WRITE_METHODS = ('update', 'insert', 'upsert', 'delete', 'rpc', 'storage_put', 'storage_remove', 'storage_list', 'storage_upload')


class FakeRemote:
    """읽기는 시험 데이터를 돌려주고, 쓰기 메서드는 불리면 기록한다(한 번이라도 불리면 시험 실패)."""

    def __init__(self, scenario, published):
        corners = [{**c, 'status': 'published' if (published and c['status'] == 'ready') else c['status']} for c in scenario['corners']]
        self.tables = {
            'issues': [{**fx.ISSUE_ROW, 'published_at': '2026-10-01T00:00:00Z' if published else None, 'page_count': 14 if published else None}],
            'couples': [{**fx.COUPLE_ROW, 'magazine_theme': scenario['theme'], 'subscription_tier': 'free', 'status': 'active'}],
            'corners': corners, 'profiles': [{'display_name': fx.A}],
            'app_config': [{'value': {'digital': {'dpi': 150}, 'print': {'dpi': 300, 'bleedMm': 3}}}],
        }
        self.writes = []
        for name in WRITE_METHODS:
            setattr(self, name, self._writer(name))

    def _writer(self, name):
        def call(*a, **k):
            self.writes.append(name)
            raise AssertionError(f'쓰기 호출 {name}')
        return call

    def select_all(self, table, query, page=1000):
        if table == 'profiles':
            return self.tables['profiles'][:1]
        return self.tables.get(table, [])

    def select(self, table, query):
        return self.select_all(table, query)

    def storage_get(self, bucket, path):
        return fx.png(1200, 1600, hue=len(path) % 80)


class LocalOnly(unittest.TestCase):
    """L1 - 읽기 전용 로컬 렌더."""

    def test_wrapper_has_read_methods_only(self):
        ro = r.ReadOnlyApi(FakeRemote(fx.photo_scenario(), True))
        for name in WRITE_METHODS:
            self.assertFalse(hasattr(ro, name), name)
        self.assertEqual(r.ReadOnlyApi.READ_METHODS, ('select', 'select_all', 'storage_get'))

    def test_published_and_unpublished_render_with_zero_writes(self):
        for published in (True, False):
            remote = FakeRemote(fx.photo_scenario(), published)
            lines = []
            with tempfile.TemporaryDirectory() as tmp:
                summary = r.render_local(r.ReadOnlyApi(remote), fx.ISSUE, Path(tmp) / 'out', say=lines.append)
                self.assertTrue((Path(tmp) / 'out' / 'issue.pdf').exists())
            self.assertEqual(remote.writes, [])
            self.assertEqual(summary['originalOverset'], 0)
            self.assertEqual(summary['renderFeedback']['rounds'], 0)
            self.assertEqual(summary['publishedPageCount'], 14 if published else None)
            shown = '\n'.join(lines)
            for secret in (fx.ISSUE, fx.COUPLE, 'magazine', 'http', fx.A):
                self.assertNotIn(secret, shown)

    def test_upload_mode_still_refuses_published(self):
        remote = FakeRemote(fx.photo_scenario(), True)
        with self.assertRaises(r.StopError) as ctx:
            r.compose_and_draw(remote, fx.ISSUE, Path(tempfile.gettempdir()) / 'never', allow_published=False)
        self.assertIn('이미 발행된 호', str(ctx.exception))
        self.assertEqual(remote.writes, [])

    def test_out_inside_the_repo_is_refused(self):
        remote = FakeRemote(fx.photo_scenario(), True)
        for bad in (r.REPO, r.REPO / 'render' / 'out' / 'x', r.REPO / 'scratch'):
            with self.assertRaises(r.StopError):
                r.render_local(r.ReadOnlyApi(remote), fx.ISSUE, bad)
        self.assertEqual(remote.writes, [])
        self.assertFalse((r.REPO / 'scratch').exists())

    def test_only_read_only_wrapper_is_accepted(self):
        with self.assertRaises(r.StopError):
            r.render_local(FakeRemote(fx.photo_scenario(), True), fx.ISSUE, Path(tempfile.gettempdir()) / 'x')

    def test_stop_line_has_kind_only(self):
        msg = f"원문 필드가 든 상자가 판면을 넘었다 (호 {fx.ISSUE}): 3쪽 da-timeline 상자 box (원문 슬롯 .userNotes[].text) 「역 앞에서 만났다」"
        line = r.local_stop_line(msg)
        self.assertEqual(line, '원문 상자가 판면을 넘었다')
        self.assertNotIn(fx.ISSUE, line)

    def test_cli_requires_out_and_the_upload_path_is_not_in_the_local_branch(self):
        src = Path(r.__file__).read_text(encoding='utf-8')
        body = src[src.index('def render_local('):src.index('LOCAL_STOP_KINDS')]
        self.assertNotIn('upload_render(', body)
        self.assertNotRegex(body, r'\.update\(|storage_put|storage_remove|storage_list')
        main = src[src.index('def main('):]
        self.assertIn("render_local(ReadOnlyApi(api)", main)
        with self.assertRaises(SystemExit):
            r.main(['--local-only', '--issue-id', fx.ISSUE])


if __name__ == '__main__':
    unittest.main()
