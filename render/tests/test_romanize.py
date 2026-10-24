"""국어의 로마자 표기법 - 지명 (위임: 55-2, `@da.regionEn`). 실행: render/.venv/Scripts/python.exe -B -m unittest discover -s render/tests"""

import os
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from romanize import romanize_place  # noqa: E402


class Romanize(unittest.TestCase):
    def test_places_with_administrative_units_get_a_hyphen(self):
        for ko, en in [('연남동', 'Yeonnam-dong'), ('성수동', 'Seongsu-dong'), ('합정동', 'Hapjeong-dong'),
                       ('도봉구', 'Dobong-gu'), ('신창읍', 'Sinchang-eup'), ('명동', 'Myeong-dong'),
                       ('성남시', 'Seongnam-si')]:
            self.assertEqual(romanize_place(ko), en, ko)

    def test_sound_changes_the_rule_reflects(self):
        for ko, en in [('종로', 'Jongno'), ('신라', 'Silla'), ('독립문', 'Dongnimmun'), ('별내', 'Byeollae'), ('같이', 'Gachi'), ('해돋이', 'Haedoji'), ('좋고', 'Joko'),
                       ('국립', 'Gungnip'), ('백마', 'Baengma'), ('한라산', 'Hallasan'), ('대학로', 'Daehangno')]:
            self.assertEqual(romanize_place(ko), en, ko)

    def test_plain_names(self):
        for ko, en in [('홍대', 'Hongdae'), ('신촌', 'Sinchon'), ('서울', 'Seoul'), ('압구정', 'Apgujeong'),
                       ('묵호', 'Mukho'), ('경복궁', 'Gyeongbokgung'), ('북촌', 'Bukchon'), ('광화문', 'Gwanghwamun')]:
            self.assertEqual(romanize_place(ko), en, ko)

    def test_a_word_ending_in_a_unit_syllable_is_treated_as_the_unit(self):
        # 형태소를 모르므로 시·군·구·읍·면·동·리·가·도로 끝나는 두 음절 이상 단어는 행정 단위로 본다(왕십리 -> Wangsip-ri)
        self.assertEqual(romanize_place('왕십리'), 'Wangsip-ri')

    def test_words_are_romanized_one_by_one(self):
        self.assertEqual(romanize_place('연남동 일대'), 'Yeonnam-dong Ildae')

    def test_failure_is_none_so_the_line_is_deleted(self):
        for bad in ('', '   ', 'Seoul', 'test-region', '을지로3가', '연남동!', None, 3):
            self.assertIsNone(romanize_place(bad), bad)


if __name__ == '__main__':
    unittest.main()
