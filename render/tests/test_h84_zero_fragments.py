"""84-h 시험 (위임: `phase-7/84-h-dispatch-meteor-preview-zero-fragments.md`, ROADMAP r145 R145-3). 네트워크 · 브라우저 없음.

  0인 조각 빼기(개발 임시 수정 · 디자인 판으로 확정 예정 - 틀 `render/issue/` 0, 렌더러가 넣는 값만):
  Z1  오프너 `@da.lead` - 사진 · 메모 0 · 1 · 여러 개 · 둘 다 0 · 장소 0
  Z2  장소 지도 머리 `@da.routeSummary` - `0개 지역 · 6개 장소` -> `6개 장소`
  Z3  같은 종류(찾은 자리): 오프너 `@da.records`(`메모 0 · AI 캡션 1`) · 발행 노트 '싣지 않은 것'(`구간 2곳(사진 0장)`)
  Z4  호 하나로 - 메모 0개 · 지역 0개인 데이트 아카이브(두 폰 커플 11월호 모양)
"""

import os
import sys
import unittest

sys.dont_write_bytecode = True
HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, '..'))
sys.path.insert(0, HERE)

import fixtures as fx  # noqa: E402
from compose import compose_issue, lead_text, not_used_text, records_line, route_summary  # noqa: E402

FIRST = '11월에 두 사람이 함께 보낸 날은 2번이었습니다.'


class LeadText(unittest.TestCase):
    def test_both_present_is_unchanged(self):
        self.assertEqual(lead_text('11월', 2, ['연남동', '성수동'], 3, 7, 1),
                         f'{FIRST} 연남동, 성수동, 3곳을 거치며 남긴 7장의 사진과 1개의 메모를 그대로 실었습니다.')
        self.assertEqual(lead_text('11월', 2, [], 6, 12, 3), f'{FIRST} 6곳을 거치며 남긴 12장의 사진과 3개의 메모를 그대로 실었습니다.')

    def test_memo_zero_keeps_photos_only(self):
        # 두 폰 커플 11월호 3쪽: 전 "…남긴 1장의 사진과 0개의 메모를 그대로 실었습니다."
        self.assertEqual(lead_text('11월', 2, [], 6, 1, 0), f'{FIRST} 6곳을 거치며 남긴 1장의 사진을 그대로 실었습니다.')
        self.assertEqual(lead_text('11월', 2, ['연남동'], 6, 9, 0), f'{FIRST} 연남동, 6곳을 거치며 남긴 9장의 사진을 그대로 실었습니다.')

    def test_photo_zero_keeps_memos_only(self):
        self.assertEqual(lead_text('11월', 2, [], 6, 0, 1), f'{FIRST} 6곳을 거치며 남긴 1개의 메모를 그대로 실었습니다.')
        self.assertEqual(lead_text('11월', 2, [], 6, 0, 4), f'{FIRST} 6곳을 거치며 남긴 4개의 메모를 그대로 실었습니다.')

    def test_both_zero_drops_the_whole_piece(self):
        self.assertEqual(lead_text('11월', 2, [], 6, 0, 0), f'{FIRST} 6곳을 거쳤습니다.')
        self.assertEqual(lead_text('11월', 2, ['성수동'], 1, 0, 0), f'{FIRST} 성수동, 1곳을 거쳤습니다.')

    def test_place_zero_drops_the_place_piece(self):
        self.assertEqual(lead_text('11월', 2, ['연남동'], 0, 3, 0), f'{FIRST} 남긴 3장의 사진을 그대로 실었습니다.')
        self.assertEqual(lead_text('11월', 2, [], 0, 0, 0), FIRST)

    def test_no_zero_number_ever(self):
        for photos in (0, 1, 5):
            for memos in (0, 1, 5):
                for places in (0, 1, 6):
                    text = lead_text('11월', 2, [], places, photos, memos)
                    self.assertNotRegex(text, r'(?<!\d)0(장|개|곳)', (photos, memos, places))
                    self.assertTrue(text.endswith('.'))


class RouteSummary(unittest.TestCase):
    def test_zero_pieces_are_dropped(self):
        self.assertEqual(route_summary(0, 6), '6개 장소')       # 두 폰 커플 11월호 5쪽: 전 "0개 지역 · 6개 장소"
        self.assertEqual(route_summary(1, 1), '1개 지역 · 1개 장소')
        self.assertEqual(route_summary(2, 5), '2개 지역 · 5개 장소')
        self.assertEqual(route_summary(3, 0), '3개 지역')
        self.assertEqual(route_summary(0, 0), '')


class SameKind(unittest.TestCase):
    def test_records_line(self):
        self.assertEqual(records_line(2, 1), '남긴 기록 · 메모 2 · AI 캡션 1')
        self.assertEqual(records_line(1, 0), '남긴 기록 · 메모 1')
        self.assertEqual(records_line(0, 1), '남긴 기록 · AI 캡션 1')      # 전 "남긴 기록 · 메모 0 · AI 캡션 1"
        self.assertEqual(records_line(0, 0), '')

    def test_not_used_dropped_stops_without_photos(self):
        self.assertEqual(not_used_text('photos', {'kind': 'dropped_stops', 'n': 3, 'stops': 2}, 2),
                         '구간 2곳(사진 3장) — 타임라인 2면에 들어가지 않았습니다')
        self.assertEqual(not_used_text('photos', {'kind': 'dropped_stops', 'n': 0, 'stops': 2}, 2),
                         '구간 2곳 — 타임라인 2면에 들어가지 않았습니다')   # 전 "구간 2곳(사진 0장) — …"


class WholeIssue(unittest.TestCase):
    """두 폰 커플 11월호 모양 - 사진 1장 · 메모 0개 · 지역 0개 · 장소 여럿."""

    def compose(self, regions, notes):
        feat = fx.article('2026-11-15', '대표', None, [
            fx.stop(0, '10:00', 'A', [fx.photo('a1')], notes, None if notes else '캡션'),
            fx.stop(1, '12:00', 'B', [], [], '캡션'),
            fx.stop(2, '14:00', 'C', [], [], '캡션')], featured=True)
        second = fx.article('2026-11-18', '둘째', None, [
            fx.stop(0, '13:00', 'D', [], [], '캡션'), fx.stop(1, '15:00', 'E', [], [], '캡션'), fx.stop(2, '17:00', 'F', [], [], '캡션')])
        da = fx.date_archive([feat, second], regions, label='2026년 11월')
        couple = {**fx.COUPLE_ROW, 'magazine_theme': 'basic'}
        return compose_issue(fx.ISSUE_ROW, couple, [fx.A, fx.B], [fx.corner_row('date_archive', da)])

    def da(self, comp, stem):
        return next(p for p in comp.pages if p.stem == stem).computed['da']

    def test_memo_zero_region_zero(self):
        comp = self.compose([], [])
        lead = self.da(comp, 'da-opener')['lead']
        self.assertNotIn('0개의 메모', lead)
        self.assertRegex(lead, r'6곳을 거치며 남긴 1장의 사진을 그대로 실었습니다\.$')
        self.assertEqual(self.da(comp, 'da-places')['routeSummary'], '6개 장소')
        self.assertNotIn('메모 0', self.da(comp, 'da-opener')['records'])

    def test_with_memo_and_regions_is_unchanged(self):
        comp = self.compose(['연남동', '성수동'], [fx.memo('메모')])
        self.assertRegex(self.da(comp, 'da-opener')['lead'], r'연남동, 성수동, 6곳을 거치며 남긴 1장의 사진과 1개의 메모를 그대로 실었습니다\.$')
        self.assertEqual(self.da(comp, 'da-places')['routeSummary'], '2개 지역 · 6개 장소')


if __name__ == '__main__':
    unittest.main()
