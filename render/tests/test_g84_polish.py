"""84-g 시험 (위임: `phase-7/84-g-dispatch-first-issue-polish.md`, ROADMAP r143 R143-3 ② ③). 네트워크 · 브라우저 없음.

  G2  근거 날짜 여러 날 - 메시지 근거가 둘 이상의 날짜에 걸치면 발췌마다 그 메시지 날짜(한 날 · 두 날 · 세 날)
  G3  조판 개발 임시 수정(R50-6) - 작업 폴더 `base.css` 사본 끝에만 붙는다(원본 틀 그대로): 제목 낱말 단위 줄바꿈 · 발행 노트 막대 띄어쓰기
"""

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
from compose import _Builder  # noqa: E402

line = _Builder.evidence_line


class EvidenceDays(unittest.TestCase):
    def test_one_day_is_unchanged(self):
        # 같은 날이면 84-g 전과 같다 - 짧은 발췌는 따옴표만, 긴 발췌는 날짜 하나
        self.assertEqual(line([fx.ev_message('9시 40분 어때', '2025-09-25'), fx.ev_message('좋아', '2025-09-25')], 2025),
                         '근거 · “9시 40분 어때” · “좋아”')
        self.assertEqual(line([fx.ev_message('1234567890123456', '2025-09-25'), fx.ev_message('좋아', '2025-09-25')], 2025),
                         '근거 · 09.25 · “좋아”')

    def test_two_days_date_each_excerpt(self):
        # 시험 커플 G 1호 12쪽 소기사 3의 모양: 09.25 · 09.26 발췌 - 전에는 "09.25"만
        self.assertEqual(line([fx.ev_message('9시 40분 어때', '2025-09-25'), fx.ev_message('응 용산역 개찰구 앞', '2025-09-26')], 2025),
                         '근거 · 09.25 “9시 40분 어때” · 09.26 “응 용산역 개찰구 앞”')
        # 날짜만 서는 긴 발췌가 같은 날 발췌 앞 날짜와 겹치면 다시 쓰지 않는다
        self.assertEqual(line([fx.ev_message('1234567890123456', '2025-09-25'), fx.ev_message('9시 40분 어때', '2025-09-25'),
                               fx.ev_message('응 용산역 개찰구 앞', '2025-09-26')], 2025),
                         '근거 · 09.25 “9시 40분 어때” · 09.26 “응 용산역 개찰구 앞”')

    def test_three_days(self):
        self.assertEqual(line([fx.ev_message('가', '2025-09-03'), fx.ev_message('나', '2025-09-12'), fx.ev_message('1234567890123456', '2025-09-20'),
                               fx.ev_date('2025-09-20')], 2025),
                         '근거 · 09.03 “가” · 09.12 “나” · 09.20 · 09.20')

    def test_other_evidence_and_year_rules_kept(self):
        # 사진 근거는 개수를 합친다 · 다른 해 · 재소환 날짜는 연도를 붙인다(README §11 ⑤)
        self.assertEqual(line([fx.ev_photo('a'), fx.ev_message('가', '2025-09-03'), fx.ev_message('나', '2024-09-04')], 2025),
                         '근거 · 사진 1장 · 09.03 “가” · 2024.09.04 “나”')
        self.assertEqual(line([fx.ev_message('가', '2025-09-03'), fx.ev_message('나', '2025-09-04')], 2025, {'2025-09-04'}),
                         '근거 · 09.03 “가” · 2025.09.04 “나”')


class DevTempCss(unittest.TestCase):
    def test_appended_only_to_work_copy(self):
        original = (r.ISSUE_DIR / 'base.css').read_text(encoding='utf-8')
        self.assertNotIn('84-g', original)                                    # 디자인 틀 그대로
        with tempfile.TemporaryDirectory() as d:
            work = Path(d) / 'work'
            r.prepare_work(work)
            copied = (work / 'base.css').read_text(encoding='utf-8')
        self.assertTrue(copied.startswith(original))
        self.assertTrue(copied.endswith(r.DEV_TEMP_CSS_84G))
        self.assertIn('개발 임시 수정 · 84-g · 디자인 판으로 확정 예정', r.DEV_TEMP_CSS_84G)

    def test_rules(self):
        css = r.DEV_TEMP_CSS_84G
        self.assertIn('h1,h2,h3,.h-display,.h-art,.h-lead,.h-sec{word-break:keep-all;overflow-wrap:break-word}', css)
        self.assertIn('[data-slot="@note.ratioPeople"],[data-slot="@note.ratioOndolog"]{margin-left:.3em}', css)
        # 높이 표가 잰 칸(메모 p.mb · 인용 .text · 정황 · AI 캡션 · 장소)은 건드리지 않는다
        for sel in ('.mb', '.text', '.context', '.aiCaption', '.placeName', '.body'):
            self.assertNotIn(sel, css)


if __name__ == '__main__':
    unittest.main()
