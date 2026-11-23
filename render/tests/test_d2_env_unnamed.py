"""84-d2 시험 (위임: `phase-7/84-d2-dispatch-measure-env-unnamed-stop.md`, ROADMAP r138 R138-2 · R138-4). 네트워크 · 브라우저 없음.

  E1  높이 표를 잰 환경 기록(`render/issue/measure.env.json`) - 같은 환경이면 경고 0 · 글꼴 해시가 다른 가짜 환경이면 경고 1 · 기록이 없으면 경고 1
  E2  렌더러는 경고를 로그(`say`)와 렌더 결과 요약(`composition.report['measureEnvWarnings']`)에 남기고 멈추지 않는다
  U1  이름 없는 경유지 = "이름을 남기지 않은 곳"(README v1.2.3 §10 ① 확정) - 타임라인 · 장소 목록 · 경로 세 곳 모두 줄을 빼지 않는다.
      그 줄의 다른 칸(시각 · 사진 수 · 메모 / AI 캡션)은 그대로. 글만 있는 기사(hero-none) 구간 목록도 같은 말
"""

import copy
import os
import sys
import unittest

sys.dont_write_bytecode = True
HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, '..'))
sys.path.insert(0, HERE)

from bs4 import BeautifulSoup  # noqa: E402

import fixtures as fx  # noqa: E402
import measure_env  # noqa: E402
import render_issue as r  # noqa: E402
from compose import compose_issue, stop_height  # noqa: E402
from facts import UNNAMED_PLACE  # noqa: E402

NAMES = [fx.A, fx.B]
TEMPLATES = r.load_templates()


def compose(scenario):
    return compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW, 'magazine_theme': scenario['theme']}, NAMES, scenario['corners'], scenario.get('materials'))


def pages(comp, stem):
    return [p for p in comp.pages if p.stem == stem]


def text(spec, comp):
    return BeautifulSoup(r.fill_page(spec, comp.theme, TEMPLATES), 'html.parser').get_text(' ', strip=True)


class MeasureEnv(unittest.TestCase):
    def test_the_recorded_environment_is_this_one(self):
        self.assertEqual(measure_env.env_warnings(), [])                      # 표를 이 PC에서 잰 뒤 기록했다

    def test_a_different_font_file_gives_one_warning(self):
        current = measure_env.current_env()
        fake = copy.deepcopy(current)
        name = sorted(fake['fonts'])[0]
        fake['fonts'][name] = '0' * 64
        warnings = measure_env.env_warnings(recorded=fake, current=current)
        self.assertEqual(len(warnings), 1)
        self.assertIn('글꼴 파일', warnings[0])
        self.assertIn(name, warnings[0])

    def test_a_different_chromium_and_a_missing_record(self):
        current = measure_env.current_env()
        fake = {**copy.deepcopy(current), 'chromium': '0.0.0.0'}
        self.assertEqual(len(measure_env.env_warnings(recorded=fake, current=current)), 1)
        missing = measure_env.env_warnings(path=measure_env.ISSUE_DIR / 'no-such-env.json')
        self.assertEqual(len(missing), 1)
        self.assertIn('기록이 없다', missing[0])

    def test_the_renderer_warns_without_stopping(self):
        comp = compose(fx.photo_scenario())
        said = []
        old = r.env_warnings
        r.env_warnings = lambda: ['높이 표를 잰 환경과 글꼴 파일이(가) 다르다 (x.otf)']
        try:
            out = r.note_measure_env(comp, said.append)
        finally:
            r.env_warnings = old
        self.assertEqual(len(out), 1)
        self.assertEqual(comp.report['measureEnvWarnings'], out)
        self.assertTrue(said and said[0].startswith('경고: '))
        self.assertEqual(r.note_measure_env(comp, said.append), [])          # 같은 환경 - 경고 0
        self.assertEqual(comp.report['measureEnvWarnings'], [])


def unnamed_scenario():
    """대표 기사 둘째 구간(사진 1장 · AI 캡션)의 장소 이름이 없다. 일반 기사 둘째 구간(사진 2장 · 메모)도 이름이 없다."""
    sc = fx.photo_scenario()
    da = sc['corners'][0]['content']
    da['payload']['articles'][0]['stops'][2]['placeName'] = None          # 19:00 연남동 식당(사진 2장 · AI 캡션) -> 이름 없음
    return sc


class UnnamedStop(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.comp = compose(unnamed_scenario())

    def test_timeline_prints_the_line_with_its_other_cells(self):
        specs = pages(self.comp, 'da-timeline')
        views = [s for sp in specs for s in sp.corner['payload']['articles'][0]['stops']]
        row = next(v for v in views if v['time'] == '19:00')
        self.assertEqual(row['placeName'], UNNAMED_PLACE)
        self.assertEqual(row['photoLabel'], '2')                              # 사진 칸 그대로
        self.assertEqual(row['aiCaption'], '저녁을 먹은 식당')                  # AI 캡션 그대로
        page = ' '.join(text(sp, self.comp) for sp in specs)
        self.assertIn(f'19:00 {UNNAMED_PLACE}', page)
        self.assertIn('저녁을 먹은 식당', page)
        named = copy.deepcopy(row)
        self.assertEqual(stop_height(row), stop_height({**named, 'placeName': UNNAMED_PLACE}))   # 높이도 실린 글자로 잰다

    def test_places_list_and_routes_use_the_same_words(self):
        places = pages(self.comp, 'da-places')[0]
        self.assertIn({'date': '09.12', 'placeName': UNNAMED_PLACE}, places.computed['da']['places'])
        self.assertIn(UNNAMED_PLACE, text(places, self.comp))
        tl = pages(self.comp, 'da-timeline')[0].computed['da']
        self.assertEqual(tl['route'], f'홍대입구역 → 연남동 카페 → {UNNAMED_PLACE}')        # 경로 - 이름 없는 구간을 건너뛰지 않는다
        art = pages(self.comp, 'da-article')[0].computed['da']
        self.assertEqual(art['articleRoute'], f'성수동 서점 → {UNNAMED_PLACE}')
        self.assertIn('5개 장소', places.computed['da']['routeSummary'])            # 세는 수도 그대로(이름 없는 곳 포함)

    def test_hero_none_stop_list_uses_the_same_words(self):
        comp = compose(fx.batch2_scenario())
        spec = pages(comp, 'da-article')[1]                                     # 메모만 남은 하루(hero-none) - 18:20 구간 이름 없음
        stops = spec.computed['da']['articleStops']
        self.assertEqual((stops[2]['time'], stops[2]['placeName'], stops[2]['aiCaption']), ('18:20', UNNAMED_PLACE, '돌아오는 길에 들른 작은 가게'))
        self.assertIn(f'18:20 {UNNAMED_PLACE}', text(spec, comp))


if __name__ == '__main__':
    unittest.main()
