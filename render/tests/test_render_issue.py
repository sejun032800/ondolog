"""렌더 명령의 순수 부분 + 오프라인 렌더 시험 (위임: 55-1, 55-2). 네트워크·원격 접속 없음.

실행 (저장소 루트에서): render/.venv/Scripts/python.exe -B -m unittest discover -s render/tests
"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, '..'))
sys.path.insert(0, HERE)

import fixtures as fx  # noqa: E402
import render_issue as r  # noqa: E402
from compose import ComposeError, PageSpec, compose_issue  # noqa: E402
from page_audit import design_audit_js, original_clipped, recorded_clipped  # noqa: E402

REF = 'abcdefghij1234567890'
URL = f'https://{REF}.supabase.co'
LINKED = json.dumps({'ref': REF, 'name': 'ondolog'})
NAMES = [fx.A, fx.B]


class Guards(unittest.TestCase):
    def test_development_project_is_confirmed(self):
        self.assertEqual(r.assert_development_project(URL, LINKED), REF)

    def test_stops_when_not_development(self):
        with self.assertRaises(r.StopError):
            r.assert_development_project(URL, None)
        with self.assertRaises(r.StopError):
            r.assert_development_project(URL, json.dumps({'ref': REF, 'name': 'ondolog-prod'}))
        with self.assertRaises(r.StopError):
            r.assert_development_project(URL, json.dumps({'ref': 'zzzzzzzzzz1234567890', 'name': 'ondolog'}))
        with self.assertRaises(r.StopError):
            r.assert_development_project('http://localhost:54321', LINKED)
        with self.assertRaises(r.StopError):
            r.assert_development_project(URL, '{not json')

    def test_test_mark_and_redact(self):
        self.assertTrue(r.has_test_mark('Test-couple'))
        self.assertFalse(r.has_test_mark('우리'))
        self.assertFalse(r.has_test_mark(None))
        self.assertEqual(r.redact('key=SECRET-VALUE-123 end', ['SECRET-VALUE-123']), 'key=[REDACTED] end')

    def test_output_names_are_ascii_only(self):
        self.assertEqual(r.ascii_name('page-01.jpg'), 'page-01.jpg')
        for bad in ('페이지.jpg', 'a b.jpg', 'a(1).jpg', 'a/b.jpg'):
            with self.assertRaises(r.StopError):
                r.ascii_name(bad)


class Files(unittest.TestCase):
    def test_jpeg_size_and_pdf_pages(self):
        jpeg = b'\xff\xd8' + b'\xff\xe0\x00\x04\x00\x00' + b'\xff\xc0\x00\x0b\x08\x04\x00\x04\x92\x01\x01\x11\x00'
        self.assertEqual(r.jpeg_size(jpeg), (1170, 1024))
        self.assertEqual(r.pdf_page_count(b'<</Type /Pages>> <</Type /Page /X>> <</Type/Page>>'), 2)


class FakeApi:
    """질의 문자열만 기록하고 미리 정한 행을 돌려준다."""

    def __init__(self, tables):
        self.tables = tables
        self.queries = []

    def select_all(self, table, query):
        self.queries.append((table, query))
        rows = self.tables.get(table, [])
        if table == 'data_entries' and 'entry_type=eq.photo' in query:
            rows = [e for e in rows if e['entry_type'] == 'photo']
        return rows

    select = select_all


class WholeApi(FakeApi):
    """`render_issue` 한 번이 쓰는 질의·저장·갱신을 메모리로 받는다(원격 없음)."""

    def __init__(self, scenario, issue=None):
        issue = issue or {**fx.ISSUE_ROW, 'published_at': None}
        super().__init__({'issues': [issue], 'couples': [{**fx.COUPLE_ROW, 'magazine_theme': scenario['theme'], 'subscription_tier': 'free'}],
                          'corners': scenario['corners'], 'profiles': [{'display_name': fx.A}]})
        self.puts, self.updates = [], []

    def select_all(self, table, query):
        self.queries.append((table, query))
        if table == 'profiles':
            return self.tables['profiles'][:1]
        return self.tables.get(table, [])

    select = select_all

    def storage_get(self, bucket, path):
        return fx.png(1200, 1600, hue=len(path) % 80)

    def storage_list(self, bucket, prefix):
        return []

    def storage_remove(self, bucket, paths):
        pass

    def storage_put(self, bucket, path, content, content_type):
        self.puts.append(path)

    def update(self, table, query, patch):
        self.updates.append(patch)
        return [patch]


class WholeRender(unittest.TestCase):
    """`render_issue` 처음부터 끝까지(메모리 API) - 표지 정리 · 원문 잘림 검사 · 감사 요약 · 업로드 순서."""

    def run_issue(self, scenario):
        api = WholeApi(scenario)
        with tempfile.TemporaryDirectory() as tmp:
            old = r.OUT_ROOT
            r.OUT_ROOT = Path(tmp)
            try:
                lines = []
                report = r.render_issue(api, fx.ISSUE, say=lines.append)
                out = Path(tmp) / fx.ISSUE
                audit = json.loads((out / 'audit.json').read_text(encoding='utf-8'))
                compose = json.loads((out / 'compose.json').read_text(encoding='utf-8'))
            finally:
                r.OUT_ROOT = old
        return api, report, audit, compose

    def test_a_clean_issue_renders_with_no_original_clipped_and_the_design_audit_agrees(self):
        api, report, audit, compose = self.run_issue(fx.long_original_scenario())
        self.assertEqual(report['pageCount'], 15)
        self.assertEqual(audit['originalClipped'], [])
        self.assertTrue(audit['designAuditSame'])
        self.assertEqual(compose['report']['quotePages'], 2)
        self.assertFalse(compose['report']['coverQuoteRemoved'])
        self.assertEqual(len(api.puts), 16)                                     # PDF 1 + 쪽 이미지 15
        self.assertEqual(api.updates[0], {'pdf_digital_path': None, 'page_count': None, 'cover_path': None})   # 먼저 비우고
        self.assertEqual(api.updates[-1]['page_count'], 15)                      # 마지막에 채운다

    def test_an_overlong_conversation_stops_before_anything_is_written(self):
        api = WholeApi(fx.long_original_scenario(with_overlong=True))
        with tempfile.TemporaryDirectory() as tmp:
            old = r.OUT_ROOT
            r.OUT_ROOT = Path(tmp)
            try:
                with self.assertRaises(r.StopError) as ctx:
                    r.render_issue(api, fx.ISSUE, say=lambda s: None)
            finally:
                r.OUT_ROOT = old
        self.assertIn('지면을 짤 수 없다', str(ctx.exception))
        self.assertIn('1337px', str(ctx.exception))
        self.assertEqual(api.puts, [])
        self.assertEqual(api.updates, [])                                       # 원격에는 아무것도 쓰지 않았다

    def test_clipped_original_stops_the_render_before_upload(self):
        original = r.build_pages

        def clamp_quotes(composition, templates, work, issue, fetch):
            templates = dict(templates)
            templates['sw-quotes'] = templates['sw-quotes'].replace('class="mb"', 'class="mb clamp1"')
            return original(composition, templates, work, issue, fetch)

        scenario = fx.photo_scenario()
        scenario['corners'][1]['content']['payload']['main'][0]['turns'][0]['text'] = fx.exact_text(fx.LONG_SEED, 150)
        api = WholeApi(scenario)
        r.build_pages = clamp_quotes
        try:
            with tempfile.TemporaryDirectory() as tmp:
                old = r.OUT_ROOT
                r.OUT_ROOT = Path(tmp)
                try:
                    with self.assertRaises(r.StopError) as ctx:
                        r.render_issue(api, fx.ISSUE, say=lambda s: None)
                finally:
                    r.OUT_ROOT = old
        finally:
            r.build_pages = original
        self.assertIn('원문이 지면에서 잘렸다', str(ctx.exception))
        self.assertEqual(api.puts, [])
        self.assertEqual(api.updates, [])


class Materials(unittest.TestCase):
    ISSUE = {'period_start': '2026-09-01', 'period_end': '2026-09-30'}

    def test_counts_use_the_kst_window_and_the_assembly_conditions(self):
        api = FakeApi({
            'messages': [{'id': 'm1'}, {'id': 'm2'}, {'id': 'm3'}],
            'dates': [{'id': 'd1'}, {'id': 'd2'}],
            'date_stops': [{'id': 's1'}],
            'data_entries': [{'id': 'e1', 'entry_type': 'photo'}, {'id': 'e2', 'entry_type': 'memo'}, {'id': 'e3', 'entry_type': 'drawing'}],
        })
        got = r.collect_materials(api, self.ISSUE, {'id': 'c-1', 'subscription_tier': 'free'})
        # 같은 행이 여러 질의에 나와도 한 번만 센다(사진·메모는 집합) - 그림은 재료 집계에 넣지 않는다
        self.assertEqual(got, {'messages': 3, 'dates': 2, 'photos': 1, 'memos': 1})
        by_table = {t: q for t, q in api.queries}
        self.assertIn('sent_at=gte.2026-09-01T00%3A00%3A00%2B09%3A00', by_table['messages'])
        self.assertIn('sent_at=lt.2026-10-01T00%3A00%3A00%2B09%3A00', by_table['messages'])  # period_end 다음 날 0시(KST)
        self.assertIn('deleted_at=is.null', by_table['messages'])
        self.assertIn('date_on=gte.2026-09-01', by_table['dates'])
        self.assertIn('date_on=lte.2026-09-30', by_table['dates'])
        entry_queries = [q for t, q in api.queries if t == 'data_entries']
        self.assertTrue(entry_queries and all('access_locked=eq.false' in q for q in entry_queries))  # 무료 커플은 잠긴 항목을 못 본다

    def test_paid_couple_sees_locked_entries_too(self):
        api = FakeApi({})
        r.collect_materials(api, self.ISSUE, {'id': 'c-1', 'subscription_tier': 'paid'})
        self.assertTrue(all('access_locked' not in q for t, q in api.queries if t == 'data_entries'))


def sample_photos(size=(1200, 1600)):
    cache = {}

    def fetch(dest):
        name = dest.split('/')[-1]
        if name not in cache:
            cache[name] = fx.png(*size, hue=sum(map(ord, name)) % 80)
        return cache[name]
    return fetch


def build(scenario, work, size=(1200, 1600), materials=None):
    couple = {**fx.COUPLE_ROW, 'magazine_theme': scenario['theme']}
    comp = compose_issue(fx.ISSUE_ROW, couple, NAMES, scenario['corners'], materials)
    r.prepare_work(work)
    files = r.build_pages(comp, r.load_templates(), work, fx.ISSUE_ROW, sample_photos(size))
    return comp, files


class Sample(unittest.TestCase):
    """견본 사진(`render/issue/images/sample/`)은 렌더 결과에 들어가면 안 된다 - 들어가면 실패다."""

    def test_work_folder_never_gets_the_sample_images(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'
            comp, files = build(fx.photo_scenario(), work)
            self.assertFalse((work / 'images').exists())
            self.assertEqual(sorted(p.name for p in work.iterdir()), ['base.css', 'fonts', 'pages', 'photos', 'themes'])
            for f in files:
                self.assertNotIn('images/sample', f.read_text(encoding='utf-8'))
            self.assertTrue(all(img.exists() for img in (work / 'photos').iterdir()))

    def test_a_sample_path_left_in_a_page_is_a_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'
            comp = compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW}, NAMES, fx.photo_scenario()['corners'], None)
            templates = r.load_templates()
            templates['back'] = templates['back'].replace('<body class="back">', '<body class="back"><img src="../images/sample/back.jpg">')
            r.prepare_work(work)
            with self.assertRaises(r.StopError) as ctx:
                r.build_pages(comp, templates, work, fx.ISSUE_ROW, sample_photos())
            self.assertIn('견본', str(ctx.exception))

    def test_every_image_in_a_filled_page_is_a_work_folder_photo(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'
            comp, files = build(fx.photo_scenario(), work)
            for f in files:
                for src in __import__('re').findall(r'<img\b[^>]*\bsrc="([^"]*)"', f.read_text(encoding='utf-8')):
                    self.assertTrue(src.startswith('../photos/'), (f.name, src))

    def test_missing_destination_copy_stops(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'
            comp = compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW}, NAMES, fx.photo_scenario()['corners'], None)
            r.prepare_work(work)
            with self.assertRaises(r.StopError):
                r.build_pages(comp, r.load_templates(), work, fx.ISSUE_ROW, lambda dest: None)

    def test_photo_path_of_another_issue_stops(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'
            comp = compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW}, NAMES, fx.photo_scenario()['corners'], None)
            r.prepare_work(work)
            with self.assertRaises(r.StopError):
                r.build_pages(comp, r.load_templates(), work, {**fx.ISSUE_ROW, 'id': 'other'}, sample_photos())


class Render(unittest.TestCase):
    """실제 Chromium으로 렌더한다 - 지면마다 PDF 한 쪽 · 가로 1170px 이미지 · 한글 글리프 · 검사 결과."""

    def test_photo_scenario_renders_to_one_pdf_with_matching_pages(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'
            comp, files = build(fx.photo_scenario(), work, materials={'messages': 120, 'photos': 14, 'dates': 3, 'memos': 4})
            results = r.render_pages(files)
            pdf, counts = r.merge_pdf([x['pdf'] for x in results])
            self.assertEqual(len(results), 14)
            self.assertEqual(counts, [1] * 14)                       # 한 지면 = PDF 한 쪽
            self.assertEqual(r.pdf_page_count(pdf), 14)
            self.assertTrue(pdf.startswith(b'%PDF'))
            for x in results:
                self.assertEqual(r.jpeg_size(x['image'])[0], 1170)
            audit = r.audit_summary(comp, results, 'x')
            self.assertTrue(audit['designAuditSame'])                # 디자인의 audit.py와 같은 결과
            self.assertEqual(audit['totals'].get('overset', 0), 0)   # 분할이 맞으면 판면 초과가 없다
            self.assertEqual(audit['totals'].get('overflow', 0), 0)
            self.assertEqual(audit['totals'].get('broken-image', 0), 0)
            self.assertEqual(audit['totals'].get('contrast', 0), 0)

    def test_all_six_themes_render(self):
        for theme in ('basic', 'hip', 'neon', 'lovely', 'night', 'ondol'):
            with tempfile.TemporaryDirectory() as tmp:
                work = Path(tmp) / 'work'
                sc = fx.type_scenario(theme)
                sc['corners'] = [sc['corners'][2]]  # 이달의 우리만 - 표지·목차·노트·본문·뒤표지가 모두 한 번씩
                comp, files = build(sc, work, size=(900, 1200))
                for f in files:
                    self.assertIn(f'data-theme="{theme}"', f.read_text(encoding='utf-8'), (theme, f.name))
                results = r.render_pages(files)
                self.assertTrue(all(x['pdf'].startswith(b'%PDF') for x in results), theme)
                self.assertTrue(r.audit_summary(comp, results, 'x')['designAuditSame'], theme)

    def test_audit_catches_overset_when_the_timeline_is_not_split(self):
        """분할이 필요한 이유 - 사진 있는 stop 셋을 한 면에 두면 판면 953px을 넘는다(README §5). 검사는 이를 기록하되 렌더는 실패시키지 않는다."""
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'
            comp, _ = build(fx.photo_scenario(), work)
            template = [p for p in comp.pages if p.stem == 'da-timeline'][0]
            stops = [fx.stop(i, f'1{i}:00', f'장소{i}', [fx.photo('e01')], [], '캡션') for i in range(3)]
            crowded = PageSpec('da-timeline', template.corner, template.computed, template.bind, template.corner_type)
            crowded.corner = json.loads(json.dumps(template.corner))
            crowded.corner['payload']['articles'][0]['stops'] = stops
            comp.pages = [crowded]
            f = work / 'pages' / '01-da-timeline.html'
            f.write_text(r.fill_page(crowded, 'basic', r.load_templates()).replace('src="' + fx.dest('e01') + '"', 'src="../photos/e01.png"'), encoding='utf-8')
            results = r.render_pages([f])
            kinds = {x['k'] for x in results[0]['findings']}
            self.assertIn('overset', kinds)
            self.assertTrue(results[0]['design'].get('same'), results[0]['design'])

    def test_design_audit_is_read_from_the_design_tools(self):
        self.assertIn('overset', design_audit_js(r.TOOLS_DIR))

    def test_clipped_ondolog_sentence_is_recorded(self):
        """55-3 - 온도록이 쓴 문장이 `.clamp`에 잘리면 기록한다(렌더는 실패가 아니다). 이전: 인용 turn 원문을 일부러 길게 해 clipped를 기대했다
        (v1.1.1에는 인용 `clamp3`가 있었다). 이후: v1.2.2에는 원문 칸에 clamp가 없다 - 온도록 문장(이달의 우리 표제)이 넘칠 때 기록한다."""
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'
            sc = fx.photo_scenario()
            tm = json.loads(json.dumps(sc['corners'][2]['content']))
            tm['payload']['theme']['headline'] = '아주 긴 표제 ' * 30
            sc['corners'][2] = fx.corner_row('this_month', tm, seq=3)
            comp, files = build(sc, work)
            lead = [f for f in files if 'tm-lead' in f.name][0]
            results = r.render_pages([lead])
            clipped = [x for x in results[0]['findings'] if x['k'] == 'clipped']
            self.assertTrue(clipped)
            self.assertEqual(original_clipped(results[0]['findings']), [])           # 원문 슬롯이 아니다
            self.assertEqual(len(recorded_clipped(results[0]['findings'])), len(clipped))  # 기록으로 센다

    def test_clipped_original_is_a_failure(self):
        """55-3 - 두 사람이 쓴 원문이 잘리면 실패다(R29-3). v1.2.2 지면에는 원문 칸에 clamp가 없으므로, 지면에 clamp를 일부러 되살려 검사 경로를 확인한다."""
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'
            sc = fx.photo_scenario()
            sw = json.loads(json.dumps(sc['corners'][1]['content']))
            sw['payload']['main'][0]['turns'][0]['text'] = fx.exact_text(fx.LONG_SEED, 150)
            sc['corners'][1] = fx.corner_row('sweet_words', sw, seq=2)
            comp, files = build(sc, work)
            quotes = [f for f in files if 'sw-quotes' in f.name][0]
            quotes.write_text(quotes.read_text(encoding='utf-8').replace('<p class="mb"', '<p class="mb clamp1"'), encoding='utf-8')
            results = r.render_pages([quotes])
            self.assertTrue(original_clipped(results[0]['findings']), results[0]['findings'])
            comp.pages = [p for p in comp.pages if p.stem == 'sw-quotes'][:1]
            summary = r.audit_summary(comp, results, 'x')
            self.assertTrue(summary['originalClipped'])
            self.assertEqual(summary['originalClipped'][0]['slot'], '.text')

    def test_a_conversation_over_one_page_stops_the_render(self):
        """55-3 - 한 대화가 한 면을 넘으면 자르지 않고 멈춘다(R29-3). 사유에 어느 호 · 어느 대화 · 높이가 있다. 그 대화를 빼면 나뉘어 통과한다."""
        with self.assertRaises(ComposeError) as ctx:
            compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW}, NAMES, fx.long_original_scenario(with_overlong=True)['corners'], None)
        msg = str(ctx.exception)
        self.assertIn(fx.ISSUE, msg)
        self.assertIn('3번째 대화', msg)
        self.assertIn('1337px', msg)
        self.assertIn('844px', msg)
        ok = compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW}, NAMES, fx.long_original_scenario()['corners'], None)
        self.assertEqual(len([p for p in ok.pages if p.stem == 'sw-quotes']), 2)

    def test_cover_quote_that_does_not_fit_is_removed_as_a_row(self):
        """55-3 - 표지 이 달의 말이 규격에 들어가지 않으면 줄째 지운다. 들어가면 그대로 둔다."""
        for scenario_theme, short_side, stem in (('basic', 1200, 'cover-photo'), ('neon', 900, 'cover-type')):
            for quote, expect_removed in (('천천히 와도 돼', False), ('천천히 와도 괜찮다는 말을 오래 되뇌었다. ' * 14, True)):
                with tempfile.TemporaryDirectory() as tmp:
                    work = Path(tmp) / 'work'
                    sc = fx.photo_scenario(scenario_theme, short_side=short_side)
                    sw = json.loads(json.dumps(sc['corners'][1]['content']))
                    sw['payload']['main'][0]['turns'][0]['text'] = quote
                    sc['corners'][1] = fx.corner_row('sweet_words', sw, seq=2)
                    comp = compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW, 'magazine_theme': scenario_theme}, NAMES, sc['corners'], None)
                    self.assertEqual(comp.pages[0].stem, stem)
                    templates = r.load_templates()
                    r.prepare_work(work)
                    outcome = r.settle_cover(comp, templates, work)
                    self.assertEqual(outcome['quoteRemoved'], expect_removed, (stem, len(quote)))
                    html = r.fill_page(comp.pages[0], scenario_theme, templates)
                    self.assertEqual(quote in html, not expect_removed)
                    if expect_removed:
                        self.assertNotIn('이 달의 말', html)              # 줄째 - 라벨까지 지워진다(활자 표지) / 따옴표 줄(사진 표지)
                        self.assertNotIn('&ldquo;', html.replace('<!--', ''))
                    # 지운 뒤에도 원문은 인용면에 그대로 있다
                    self.assertIn(quote, json.dumps([p.corner for p in comp.pages if p.stem == 'sw-quotes'], ensure_ascii=False))

    def test_headline_from_the_quote_is_never_clipped(self):
        """55-3 - 표제를 못 나눠 이 달의 말(원문)이 표제가 됐는데 표제 칸이 잘리면, 원문을 자르지 않고 나뉘지 않은 이달의 우리 표제로 되돌린다."""
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'
            sc = fx.type_scenario('neon')
            tm = json.loads(json.dumps(sc['corners'][2]['content']))
            tm['payload']['theme']['headline'] = '아주아주긴단어가있는제목'
            sc['corners'][2] = fx.corner_row('this_month', tm, seq=3)
            sw = json.loads(json.dumps(sc['corners'][1]['content']))
            sw['payload']['main'][0]['turns'][0]['text'] = '오늘은 비가 온다고 했으니 우산을 꼭 챙겨서 나가자 알겠지? 약속이야'
            sc['corners'][1] = fx.corner_row('sweet_words', sw, seq=2)
            comp = compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW, 'magazine_theme': 'neon'}, NAMES, sc['corners'], None)
            self.assertEqual(comp.report['coverHeadlineFrom'], 'quote')
            templates = r.load_templates()
            r.prepare_work(work)
            outcome = r.settle_cover(comp, templates, work)
            self.assertTrue(outcome['headlineReverted'])
            self.assertEqual(comp.report['coverHeadlineFrom'], 'theme.headline-unsplit')
            self.assertEqual(comp.pages[0].computed['cover']['headline'], '아주아주긴단어가있는제목')


if __name__ == '__main__':
    unittest.main()
