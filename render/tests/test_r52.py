"""지역 숫자 · 시드 메모 시험 (위임: 55-3d, ROADMAP R52-2 · R52-4).

  P1  이달의 우리 지역 칸 = 이번 기간(재소환 제외) 그 지역에서 보낸 날(데이트) 수, 라벨 `{지역}에서 보낸 날` - 둘 다 호의 사실(`facts.py`)이 만든다
  P2  시드의 모든 메모는 붙은 구간의 장소 · 시각과 맞다 - 다른 구간의 장소 · 활동 낱말이 나오면 실패
"""

from __future__ import annotations

import copy
import os
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))

import fixtures as fx  # noqa: E402
from facts import build_facts  # noqa: E402
from test_r51 import SCENARIOS, ThisMonthNumbers, compose, date_archive_of  # noqa: E402


def facts_of(articles):
    return build_facts(articles=articles, fi=0, kept_stops=[], dropped_stops=[])


class RegionDays(unittest.TestCase):
    cells = staticmethod(ThisMonthNumbers.cells)

    def test_a_region_cell_counts_the_days_spent_there_not_the_stops(self):
        feat = fx.article('2026-09-12', '대표', '연남동', [fx.stop(i, f'1{i}:00', f'장소{i}', [fx.photo(f'a{i}')], [], '캡션') for i in range(4)], featured=True)
        facts = facts_of([feat])
        self.assertEqual(facts.signal('place', '연남동'), (1, '연남동에서 보낸 날'))      # 경유지 4곳이어도 하루

    def test_two_dates_in_a_region_count_two_and_recalled_dates_are_left_out(self):
        a = fx.article('2026-09-05', '첫째', '연남동', [fx.stop(0, '10:00', '가', [fx.photo('a0')], [], '캡션')], featured=True)
        b = fx.article('2026-09-19', '둘째', '연남동', [fx.stop(0, '11:00', '나', [fx.photo('b0')], [], '캡션'), fx.stop(1, '13:00', '다', [fx.photo('b1')], [], '캡션')])
        c = fx.article('2026-09-20', '셋째', '성수동', [fx.stop(0, '12:00', '라', [fx.photo('c0')], [], '캡션')])
        old = fx.article('2025-09-20', '재소환', '연남동', [fx.stop(0, '12:00', '마', [fx.photo('d0')], [], '캡션')], recalled=True, reason='anniversary')
        facts = facts_of([a, b, c, old])
        self.assertEqual(facts.signal('place', '연남동'), (2, '연남동에서 보낸 날'))
        self.assertEqual(facts.signal('place', '성수동'), (1, '성수동에서 보낸 날'))
        self.assertIsNone(facts.signal('place', '합정동'))

    def test_the_label_is_made_by_the_facts_not_by_the_generation(self):
        sc = fx.many_photos_scenario()
        tm = next(c for c in sc['corners'] if c['corner_type'] == 'this_month')['content']
        tm['payload']['theme']['signals'] = [{'kind': 'place', 'value': '연남동', 'count': 99}, {'kind': 'place', 'value': '성수동', 'count': 77}]
        before = copy.deepcopy(sc)
        comp = compose(sc)
        self.assertEqual(self.cells(comp), [('1', '연남동에서 보낸 날'), ('1', '성수동에서 보낸 날')])
        self.assertEqual(sc, before)                                                   # 입력 content는 건드리지 않는다

    def test_a_place_name_cell_keeps_its_own_label_and_definition(self):
        sc = fx.many_photos_scenario()
        tm = next(c for c in sc['corners'] if c['corner_type'] == 'this_month')['content']
        tm['payload']['theme']['signals'] = [{'kind': 'place', 'value': '연남동 카페', 'count': 9}]
        self.assertEqual(self.cells(compose(sc)), [('1', '연남동 카페')])

    def test_every_seed_shows_region_days_with_the_region_label(self):
        for name, build in SCENARIOS.items():
            sc = build()
            da = date_archive_of(sc)
            want = [(str(fx.days_in_region(da, r)), f'{r}에서 보낸 날') for r in da['payload']['summary']['regions']]
            cells = self.cells(compose(sc))
            self.assertEqual(cells, want, name)
            for number, label in cells:
                self.assertTrue(label.endswith('에서 보낸 날'), (name, label))


# ---------------------------------------------------------------------------
# P2 - 시드 메모 <-> 구간
# ---------------------------------------------------------------------------

# 낱말 -> 그 낱말이 나와도 되는 구간의 장소 조각 (구간의 `placeName`에 이 조각이 들어 있어야 한다). 빈 묶음 = 시드의 어느 구간에도 맞지 않는 활동.
PLACE_WORDS = {
    '역 앞': ('홍대입구역',), '지하철': ('홍대입구역',), '개찰구': ('홍대입구역',), '플랫폼': ('홍대입구역',), '열차': ('홍대입구역',),
    '카페': ('카페',), '커피': ('카페',), '창가': ('카페',), '케이크': ('카페',),
    '식당': ('식당',), '식사': ('식당',), '칼국수': ('식당',),
    '서점': ('서점',), '책을 골': ('서점',),
    '숲길': ('숲길',), '공원': ('숲길', '공원'), '벤치': ('숲길', '공원'), '놀이터': ('숲길', '공원'),
    '버스': (), '현관': (), '집에 도착': (), '집에 가는': (), '귀가': (),
}
# 낱말 -> 구간 시각(시)이 들어야 하는 범위 [시작, 끝)
TIME_WORDS = {'아침': (5, 11), '점심': (11, 15), '노을': (16, 21), '해가 질': (16, 21), '가로등': (16, 24), '저녁': (17, 22), '밤': (20, 24)}


def memo_conflicts(stop):
    """한 구간의 메모 속 장소 · 활동 · 때 낱말 가운데 그 구간과 맞지 않는 것."""
    place = stop.get('placeName') or ''
    hour = int(stop['time'][:2])
    found = []
    for note in stop.get('userNotes', []):
        text = note.get('text') or ''
        for word, owners in PLACE_WORDS.items():
            if word in text and not any(o in place for o in owners):
                found.append((word, place))
        for word, (lo, hi) in TIME_WORDS.items():
            if word in text and not lo <= hour < hi:
                found.append((word, stop['time']))
    return found


class SeedMemosMatchTheirStops(unittest.TestCase):
    def test_every_memo_of_every_seed_matches_the_place_and_time_of_its_stop(self):
        checked = 0
        for name, build in SCENARIOS.items():
            for article in date_archive_of(build())['payload']['articles']:
                for stop in article['stops']:
                    if stop.get('userNotes'):
                        checked += 1
                    self.assertEqual(memo_conflicts(stop), [], f'{name} {article["dateOn"]} {stop["time"]} {stop.get("placeName")}')
        self.assertGreater(checked, 10)

    def test_the_check_catches_the_old_vol3_defect(self):
        # R52-4가 지적한 14:20 홍대입구역의 "창가 자리 · 커피 · 노을" 메모 - 시험이 실패로 잡아야 한다
        stop = fx.stop(0, '14:20', '홍대입구역', [], [fx.memo(fx.whole_memo(fx.MEMO_SENTENCES_WINDOW, 120))], None)
        words = {w for w, _ in memo_conflicts(stop)}
        self.assertTrue({'창가', '커피', '노을'} <= words, words)

    def test_the_check_catches_another_stops_activity_and_time(self):
        stop = fx.stop(1, '19:10', '경의선숲길', [], [fx.memo('플랫폼에 서서 열차를 기다렸다.')], None)
        self.assertEqual({w for w, _ in memo_conflicts(stop)}, {'플랫폼', '열차'})
        stop = fx.stop(0, '09:05', '홍대입구역', [], [fx.memo('해가 질 때까지 앉아 있었다.')], None)
        self.assertEqual([w for w, _ in memo_conflicts(stop)], ['해가 질'])

    def test_both_long_memo_seeds_sit_on_the_stops_they_describe(self):
        long_stops = date_archive_of(fx.long_original_scenario())['payload']['articles'][0]['stops']
        memo_stop = next(s for s in long_stops if len(s['userNotes'][0]['text']) > 100)
        self.assertEqual((memo_stop['time'], memo_stop['placeName']), ('16:10', '연남동 카페'))
        for s in date_archive_of(fx.timeline_overflow_scenario())['payload']['articles'][0]['stops']:
            self.assertTrue(len(s['userNotes'][0]['text']) > 350)


if __name__ == '__main__':
    unittest.main()
