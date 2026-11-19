"""발행 노트 AI 안내 한 줄 시험 (위임: 84-c2, ROADMAP R134-5 ②).

  C1  발행 노트 끝(정정 요청 줄 바로 뒤)에 고정 문장이 한 번 - 문장은 `compose.NOTE_AI_NOTICE` 한 곳에서 온다
  C2  다른 지면에는 0번 · 지면 HTML 파일(틀)은 그대로(렌더러가 끼우는 개발 임시 수정)
  C3  정정 요청 문단이 틀에 하나가 아니면 자리를 짐작하지 않고 멈춘다
  C4  판면 검사 - 줄을 끼운 노트 쪽에 새 위반(safe · overlap · text-overlap · overflow · overset · clipped) 0 (사진 많은 호 포함)
  C5  고정 질문(84-c 해요체 정본)이 렌더 시험 자료와 같다
"""

from __future__ import annotations

import copy
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
from compose import NOTE_AI_NOTICE, PageSpec, compose_issue  # noqa: E402

NAMES = [fx.A, fx.B]
TEMPLATES = r.load_templates()
NOTICE = '온도록이 쓴 문장은 두 분의 기록을 바탕으로 AI가 만들었습니다. 두 분이 남긴 말과 사진은 고치지 않았습니다.'
LAYOUT_KINDS = ('safe', 'overlap', 'text-overlap', 'overflow', 'overset', 'clipped')


def compose(scenario):
    return compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW, 'magazine_theme': scenario['theme']}, NAMES, scenario['corners'], None)


def note_spec(comp) -> PageSpec:
    return next(p for p in comp.pages if p.stem == 'note')


class NoticeLine(unittest.TestCase):
    def test_sentence_lives_in_one_constant(self):
        self.assertEqual(NOTE_AI_NOTICE, NOTICE)
        self.assertEqual(note_spec(compose(fx.photo_scenario())).computed['note']['aiNotice'], NOTICE)

    def test_once_at_the_end_of_the_note(self):
        comp = compose(fx.photo_scenario())
        html = r.fill_page(note_spec(comp), comp.theme, TEMPLATES)
        self.assertEqual(html.count(NOTICE), 1)
        self.assertGreater(html.index(NOTICE), html.index('정정 요청'))                   # 정정 요청 줄 뒤
        self.assertGreater(html.index('data-slot="@page"'), html.index(NOTICE))           # 쪽 번호 · 워드마크보다 앞(본문의 끝)
        tail = html[html.index('정정 요청'):html.index(NOTICE)]
        self.assertEqual(tail.count('</p>'), 1)                                          # 정정 요청 문단 바로 다음 문단

    def test_no_other_page_and_template_unchanged(self):
        comp = compose(fx.photo_scenario())
        for spec in comp.pages:
            if spec.stem != 'note':
                self.assertNotIn(NOTICE, r.fill_page(spec, comp.theme, TEMPLATES), spec.stem)
        self.assertNotIn('aiNotice', TEMPLATES['note'])                                   # 틀 파일은 그대로 - 렌더러가 끼운다
        self.assertNotIn(NOTICE, TEMPLATES['note'])

    def test_stops_when_the_anchor_is_not_unique(self):
        with self.assertRaises(r.StopError):
            r.add_note_ai_notice(TEMPLATES['note'].replace('정정 요청', '문의'))
        with self.assertRaises(r.StopError):
            r.add_note_ai_notice(TEMPLATES['note'] + '<p>정정 요청</p>')
        self.assertEqual(r.add_note_ai_notice(TEMPLATES['note']).count('@note.aiNotice'), 1)

    def test_fixed_questions_match_the_engine(self):
        qs = fx.questions('근거')
        self.assertEqual([q['text'] for q in qs[:2]], ['이날의 데이트는 10점 만점에 몇 점인가요?', '이날 중 가장 기억에 남는 건 무엇인가요?'])


class NoticeLayout(unittest.TestCase):
    """판면 검사 - 같은 노트 쪽을 줄 없이 / 줄 넣고 그려 새 위반이 없는지 본다(사진 많은 호 = 싣지 않은 것 줄이 많은 경우 포함)."""

    def kinds(self, results):
        return sorted(f['k'] + ':' + str(f.get('t', '')) for f in results['findings'] if f['k'] in LAYOUT_KINDS)

    def test_no_new_layout_findings(self):
        for name, scenario in (('photo', fx.photo_scenario()), ('many', fx.many_photos_scenario())):
            with self.subTest(name), tempfile.TemporaryDirectory() as tmp:
                work = Path(tmp) / 'work'
                comp = compose(scenario)
                r.prepare_work(work)
                spec = note_spec(comp)
                without = PageSpec(spec.stem, spec.corner, copy.deepcopy(spec.computed), spec.bind, spec.corner_type)
                without.widths = spec.widths
                without.computed['note']['aiNotice'] = ''
                with_file = work / 'pages' / '01-note.html'
                without_file = work / 'pages' / '02-note.html'
                with_file.write_text(r.fill_page(spec, comp.theme, TEMPLATES), encoding='utf-8')
                without_file.write_text(r.fill_page(without, comp.theme, TEMPLATES), encoding='utf-8')
                res_with, res_without = r.render_pages([with_file, without_file])
                self.assertIn(NOTICE, with_file.read_text(encoding='utf-8'))
                self.assertNotIn(NOTICE, without_file.read_text(encoding='utf-8'))
                new = [k for k in self.kinds(res_with) if k not in self.kinds(res_without)]
                self.assertEqual(new, [], name)


if __name__ == '__main__':
    unittest.main()
