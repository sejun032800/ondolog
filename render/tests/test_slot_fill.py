"""슬롯 채움 모듈 시험 - 표시별 · 순서별 (위임: 55-1).

실행 (저장소 루트에서): render/.venv/Scripts/python.exe -B -m unittest discover -s render/tests
"""

import os
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from slot_fill import fill, is_empty, resolve  # noqa: E402


def body(html: str, data) -> str:
    return fill(f'<div id="r">{html}</div>', data)


def inner(html: str, data) -> str:
    """바깥 감싸개를 벗긴 안쪽."""
    out = body(html, data)
    return out[len('<div id="r">'):-len('</div>')]


class Paths(unittest.TestCase):
    def test_dotted_index_root_and_missing(self):
        data = {'a': {'b': [{'c': 'x'}, {'c': 'y'}]}, 'issue': {'name': 'N'}}
        self.assertEqual(resolve('a.b.1.c', data, data), 'y')
        self.assertEqual(resolve('@issue.name', {'z': 1}, data), 'N')
        self.assertEqual(resolve('.', 'self', data), 'self')
        self.assertIsNone(resolve('a.b.5.c', data, data))
        self.assertIsNone(resolve('a.nope', data, data))

    def test_empty_values(self):
        for v in (None, '', '  ', [], {}):
            self.assertTrue(is_empty(v))
        for v in (0, False, 'x', [0]):
            self.assertFalse(is_empty(v))


class SlotAndSrc(unittest.TestCase):
    def test_slot_fills_text_and_escapes(self):
        self.assertEqual(inner('<p data-slot="t"></p>', {'t': '<b>&</b>'}), '<p>&lt;b&gt;&amp;&lt;/b&gt;</p>')

    def test_slot_number_zero_is_a_value(self):
        self.assertEqual(inner('<p data-slot="n"></p>', {'n': 0}), '<p>0</p>')

    def test_empty_slot_stays_without_optional(self):
        self.assertEqual(inner('<p data-slot="t">자리</p>', {'t': ''}), '<p></p>')

    def test_marks_are_removed_structure_is_kept(self):
        out = inner('<section class="s"><h1 data-slot="t"></h1><i>x</i></section>', {'t': 'T'})
        self.assertEqual(out, '<section class="s"><h1>T</h1><i>x</i></section>')

    def test_src_sets_attribute_and_empty_removes_it(self):
        out = inner('<img data-src="p" src="old.png"><img data-src="q" src="old.png">', {'p': 'a/b.jpg', 'q': None})
        self.assertEqual(out, '<img src="a/b.jpg"/><img/>')


class Repeat(unittest.TestCase):
    def test_clone_per_item_with_item_scope(self):
        out = inner('<ul><li data-repeat="items"><b data-slot="n"></b></li></ul>', {'items': [{'n': 'a'}, {'n': 'b'}, {'n': 'c'}]})
        self.assertEqual(out, '<ul><li><b>a</b></li><li><b>b</b></li><li><b>c</b></li></ul>')

    def test_no_items_removes_template(self):
        html = '<ul><li data-repeat="items"><b data-slot="n"></b></li></ul>'
        self.assertEqual(inner(html, {'items': []}), '<ul></ul>')
        self.assertEqual(inner(html, {}), '<ul></ul>')

    def test_src_dot_is_the_item_itself(self):
        out = inner('<div><img data-repeat="photos" data-src="."></div>', {'photos': ['p/1.jpg', 'p/2.jpg']})
        self.assertEqual(out, '<div><img src="p/1.jpg"/><img src="p/2.jpg"/></div>')

    def test_slot_dot_for_scalar_items(self):
        out = inner('<p><i data-repeat="xs" data-slot="."></i></p>', {'xs': ['가', '나']})
        self.assertEqual(out, '<p><i>가</i><i>나</i></p>')

    def test_nested_repeat_and_root_name(self):
        data = {'issue': {'name': 'I'}, 'rows': [{'cells': [1, 2]}, {'cells': [3]}]}
        html = '<div data-repeat="rows"><span data-slot="@issue.name"></span><u data-repeat="cells" data-slot="."></u></div>'
        self.assertEqual(inner(html, data), '<div><span>I</span><u>1</u><u>2</u></div><div><span>I</span><u>3</u></div>')


class If(unittest.TestCase):
    def test_keep_and_remove(self):
        self.assertEqual(inner('<a data-if="y">Y</a><b data-if="n">N</b>', {'y': 'v', 'n': ''}), '<a>Y</a>')

    def test_negation(self):
        self.assertEqual(inner('<a data-if="!y">Y</a><b data-if="!n">N</b>', {'y': 'v', 'n': None}), '<b>N</b>')

    def test_zero_keeps_false_removes(self):
        self.assertEqual(inner('<a data-if="z">Z</a><b data-if="f">F</b>', {'z': 0, 'f': False}), '<a>Z</a>')


class Optional(unittest.TestCase):
    def test_all_empty_removes_the_element(self):
        html = '<div data-optional><i data-slot="a"></i><i data-slot="b"></i></div>'
        self.assertEqual(inner(html, {'a': '', 'b': None}), '')

    def test_one_filled_keeps(self):
        html = '<div data-optional><i data-slot="a"></i><i data-slot="b"></i></div>'
        self.assertEqual(inner(html, {'a': '', 'b': 'x'}), '<div><i></i><i>x</i></div>')

    def test_src_counts_as_a_slot(self):
        html = '<figure data-optional><img data-src="p"><figcaption data-slot="c"></figcaption></figure>'
        self.assertEqual(inner(html, {'p': None, 'c': ''}), '')

    def test_photo_frame_with_only_src_is_removed_when_path_is_empty(self):
        html = '<div class="frame" data-optional><img data-src="p"></div>'
        self.assertEqual(inner(html, {'p': ''}), '')
        self.assertEqual(inner(html, {'p': None}), '')
        self.assertEqual(inner(html, {}), '')

    def test_photo_frame_with_only_src_stays_when_path_is_present(self):
        html = '<div class="frame" data-optional><img data-src="p"></div>'
        self.assertEqual(inner(html, {'p': 'a/b.jpg'}), '<div class="frame"><img src="a/b.jpg"/></div>')

    def test_no_slots_inside_is_not_judged(self):
        self.assertEqual(inner('<div data-optional><p>고정</p></div>', {}), '<div><p>고정</p></div>')

    def test_nested_optional(self):
        html = '<div data-optional><section data-optional><i data-slot="a"></i></section><b data-slot="b"></b></div>'
        self.assertEqual(inner(html, {'a': '', 'b': 'x'}), '<div><b>x</b></div>')
        self.assertEqual(inner(html, {'a': '', 'b': ''}), '')

    def test_repeat_with_no_items_counts_as_empty(self):
        html = '<section data-optional><ul><li data-repeat="xs" data-slot="."></li></ul></section>'
        self.assertEqual(inner(html, {'xs': []}), '')
        self.assertEqual(inner(html, {'xs': ['a']}), '<section><ul><li>a</li></ul></section>')


class Variant(unittest.TestCase):
    HTML = '<div data-variant="layout"><p data-case="g2">두 칸</p><p data-case="g3">세 칸</p><p data-case="g4">네 칸</p><hr></div>'

    def test_chosen_case_stays_others_go(self):
        self.assertEqual(inner(self.HTML, {'layout': 'g3'}), '<div><p>세 칸</p><hr/></div>')

    def test_no_match_removes_every_case_but_not_other_children(self):
        self.assertEqual(inner(self.HTML, {'layout': 'g9'}), '<div><hr/></div>')
        self.assertEqual(inner(self.HTML, {}), '<div><hr/></div>')

    def test_number_value_matches_text(self):
        html = '<div data-variant="n"><p data-case="3">3</p><p data-case="4">4</p></div>'
        self.assertEqual(inner(html, {'n': 3}), '<div><p>3</p></div>')


class Order(unittest.TestCase):
    """R25-2: variant -> repeat -> if -> optional"""

    def test_repeat_inside_a_removed_variant_is_not_cloned(self):
        # 고르지 않은 변형 b 안의 반복이 먼저 복제되면 값이 찬 슬롯이 생겨 optional이 살아남는다.
        html = (
            '<section data-optional data-variant="v">'
            '<div data-case="a"><i data-slot="empty"></i></div>'
            '<div data-case="b"><u data-repeat="xs" data-slot="."></u></div>'
            '</section>'
        )
        data = {'empty': '', 'xs': ['가', '나']}
        self.assertEqual(inner(html, {**data, 'v': 'a'}), '')
        # 대조: b를 고르면 반복이 복제되고 optional은 살아남는다
        self.assertEqual(inner(html, {**data, 'v': 'b'}), '<section><div><u>가</u><u>나</u></div></section>')

    def test_if_is_judged_per_clone_in_the_item_scope(self):
        data = {'xs': [{'n': 'a', 'x': 1}, {'n': 'b', 'x': ''}, {'n': 'c', 'x': 'y'}]}
        out = inner('<ol><li data-repeat="xs" data-if="x"><b data-slot="n"></b></li></ol>', data)
        self.assertEqual(out, '<ol><li><b>a</b></li><li><b>c</b></li></ol>')

    def test_empty_slot_in_an_if_removed_branch_does_not_trip_optional(self):
        html = (
            '<div data-optional>'
            '<p data-if="note"><i data-slot="note"></i></p>'
            '<p data-if="!note"><i data-slot="caption"></i></p>'
            '<b data-slot="title"></b>'
            '</div>'
        )
        # 메모가 있으면 캡션 가지는 지워진다 - 캡션이 비어 있어도 그 가지는 판정에 없다
        self.assertEqual(inner(html, {'note': '메모', 'caption': '', 'title': ''}), '<div><p><i>메모</i></p><b></b></div>')
        # 메모가 없고 캡션·제목도 비면 요소째 지운다(캡션 가지는 살아 있고 비었다)
        self.assertEqual(inner(html, {'note': '', 'caption': '', 'title': ''}), '')
        # 메모가 비고 캡션이 차면 그 가지가 산다
        self.assertEqual(inner(html, {'note': '', 'caption': '설명', 'title': ''}), '<div><p><i>설명</i></p><b></b></div>')

    def test_values_in_the_rest_keep_optional_whatever_the_removed_branch_holds(self):
        html = '<div data-optional><p data-if="no"><i data-slot="e"></i></p><b data-slot="t"></b></div>'
        self.assertEqual(inner(html, {'no': '', 'e': '', 't': 'x'}), '<div><b>x</b></div>')


if __name__ == '__main__':
    unittest.main()
