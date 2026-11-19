"""슬롯 채움 모듈 시험 - `render/issue/README.md` v1.1.1 §2·§3 문법 (위임: 55-1 · 55-2 0단계).

실행 (저장소 루트에서): render/.venv/Scripts/python.exe -B -m unittest discover -s render/tests
"""

import os
import sys
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from slot_fill import Context, fill, is_empty, resolve  # noqa: E402

PAGES = Path(__file__).resolve().parent.parent / 'issue' / 'pages'


def inner(html, corner=None, computed=None, bind=None, chooser=None):
    out = fill(f'<div id="r">{html}</div>', corner, computed, bind, chooser)
    return out[len('<div id="r">'):-len('</div>')]


class Paths(unittest.TestCase):
    CORNER = {'payload': {'articles': [{'title': 'A', 'stops': [{'photos': [{'path': 'p0'}, {'path': 'p1'}]}]},
                                       {'title': 'B', 'stops': []}]}}

    def ctx(self, **bind):
        return Context(self.CORNER, {'issue': {'month': '9월호'}, 'toc': [1, 2]}, bind)

    def test_corner_root_brackets_and_bound_names(self):
        c = self.ctx(featured=0, i=1)
        self.assertEqual(resolve('payload.articles[featured].title', None, c), 'A')
        self.assertEqual(resolve('payload.articles[i].title', None, c), 'B')
        self.assertEqual(resolve('payload.articles[0].stops[0].photos[1].path', None, c), 'p1')
        self.assertEqual(resolve('payload.articles[featured].stops[0].photos[0].path', None, c), 'p0')

    def test_length_of_arrays(self):
        c = self.ctx()
        self.assertEqual(resolve('payload.articles.length', None, c), 2)
        self.assertEqual(resolve('.photos.length', {'photos': [1, 2, 3]}, c), 3)
        self.assertEqual(resolve('.photos.length', {'photos': []}, c), 0)

    def test_leading_dot_is_the_item_and_dot_alone_is_the_item_itself(self):
        c = self.ctx()
        self.assertEqual(resolve('.a.b[1]', {'a': {'b': ['x', 'y']}}, c), 'y')
        self.assertEqual(resolve('.', 'self', c), 'self')

    def test_at_names_come_from_computed(self):
        self.assertEqual(resolve('@issue.month', None, self.ctx()), '9월호')
        self.assertIsNone(resolve('@issue.nope', None, self.ctx()))

    def test_item_scope_does_not_hide_the_corner_root(self):
        # 반복 안에서도 접두 없는 경로는 코너 봉투에서 시작한다
        self.assertEqual(resolve('payload.articles[0].title', {'x': 1}, self.ctx()), 'A')

    def test_missing_paths_are_none(self):
        c = self.ctx(featured=0)
        for path in ('nope', 'payload.nope', 'payload.articles[5].title', 'payload.articles[zz].title', '.x', '@nope', 'payload..x'):
            self.assertIsNone(resolve(path, {}, c), path)

    def test_empty_values(self):
        for v in (None, '', '  ', [], {}):
            self.assertTrue(is_empty(v))
        for v in (0, False, 'x', [0]):
            self.assertFalse(is_empty(v))


class SlotAndSrc(unittest.TestCase):
    def test_slot_fills_text_and_escapes(self):
        self.assertEqual(inner('<p data-slot="t"></p>', {'t': '<b>&</b>'}), '<p data-slot="t">&lt;b&gt;&amp;&lt;/b&gt;</p>')

    def test_newlines_become_br_and_text_is_otherwise_untouched(self):
        out = inner('<p data-slot="t"></p>', {'t': '첫째 줄.\n둘째 줄,  띄어쓰기  그대로'})
        self.assertEqual(out, '<p data-slot="t">첫째 줄.<br/>둘째 줄,  띄어쓰기  그대로</p>')

    def test_number_zero_is_a_value(self):
        self.assertEqual(inner('<p data-slot="n"></p>', {'n': 0}), '<p data-slot="n">0</p>')

    def test_empty_slot_stays_empty_without_optional(self):
        self.assertEqual(inner('<p data-slot="t">자리</p>', {'t': ''}), '<p data-slot="t"></p>')

    def test_marks_are_kept_because_the_page_css_reads_them(self):
        out = inner('<div data-repeat="xs"><i data-slot="."></i></div>', {'xs': ['a']})
        self.assertIn('data-repeat="xs"', out)

    def test_src_sets_attribute_and_empty_removes_it_including_the_sample(self):
        out = inner('<img data-src="p" src="old.png"><img data-src="q" src="../images/sample/x.jpg">', {'p': 'a/b.jpg', 'q': None})
        self.assertEqual(out, '<img data-src="p" src="a/b.jpg"/><img data-src="q"/>')
        self.assertNotIn('images/sample', out)


class Repeat(unittest.TestCase):
    def test_container_keeps_and_first_child_is_the_template(self):
        html = '<ul data-repeat="items"><li><b data-slot=".n"></b></li><li>견본</li></ul>'
        out = inner(html, {'items': [{'n': 'a'}, {'n': 'b'}]})
        self.assertEqual(out, '<ul data-repeat="items"><li><b data-slot=".n">a</b></li><li><b data-slot=".n">b</b></li></ul>')

    def test_no_items_leaves_an_empty_container(self):
        html = '<ul data-repeat="items"><li><b data-slot=".n"></b></li></ul>'
        self.assertEqual(inner(html, {'items': []}), '<ul data-repeat="items"></ul>')
        self.assertEqual(inner(html, {}), '<ul data-repeat="items"></ul>')

    def test_src_dot_is_the_item_itself(self):
        out = inner('<div data-repeat="photos"><img data-src="."></div>', {'photos': ['p/1.jpg', 'p/2.jpg']})
        self.assertEqual(out, '<div data-repeat="photos"><img data-src="." src="p/1.jpg"/><img data-src="." src="p/2.jpg"/></div>')

    def test_scalar_items_become_the_template_elements_text(self):
        # README §2 `@note.notUsed` - `.text` 없이 요소 글자 자체
        html = '<div data-repeat="@xs"><span class="note">견본</span></div>'
        out = inner(html, None, {'xs': ['사진 1장', '메모 2개']})
        self.assertEqual(out, '<div data-repeat="@xs"><span class="note">사진 1장</span><span class="note">메모 2개</span></div>')

    def test_nested_repeat_with_item_paths_and_at_names(self):
        computed = {'issue': {'name': 'I'}}
        corner = {'rows': [{'cells': [1, 2]}, {'cells': [3]}]}
        html = ('<div data-repeat="rows"><p><span data-slot="@issue.name"></span>'
                '<u data-repeat=".cells"><s data-slot="."></s></u></p></div>')
        out = inner(html, corner, computed)
        self.assertEqual(out.count('<p>'), 2)
        self.assertEqual(out.count('data-slot="@issue.name">I<'), 2)
        self.assertIn('<s data-slot=".">1</s><s data-slot=".">2</s>', out)

    def test_table_body_repeat_clones_rows(self):
        html = '<table><tbody data-repeat="@m"><tr><td data-slot=".a"></td></tr></tbody></table>'
        out = inner(html, None, {'m': [{'a': 1}, {'a': 2}]})
        self.assertEqual(out.count('<tr>'), 2)


class If(unittest.TestCase):
    def test_keep_and_remove(self):
        self.assertEqual(inner('<a data-if="y">Y</a><b data-if="n">N</b>', {'y': 'v', 'n': ''}), '<a data-if="y">Y</a>')

    def test_negation(self):
        self.assertEqual(inner('<a data-if="!y">Y</a><b data-if="!n">N</b>', {'y': 'v', 'n': None}), '<b data-if="!n">N</b>')

    def test_zero_keeps_false_removes_and_empty_list_removes(self):
        out = inner('<a data-if="z">Z</a><b data-if="f">F</b><i data-if="l">L</i>', {'z': 0, 'f': False, 'l': []})
        self.assertEqual(out, '<a data-if="z">Z</a>')


class Optional(unittest.TestCase):
    def test_all_empty_removes_the_element(self):
        html = '<div data-optional><i data-slot="a"></i><i data-slot="b"></i></div>'
        self.assertEqual(inner(html, {'a': '', 'b': None}), '')

    def test_one_filled_keeps(self):
        html = '<div data-optional><i data-slot="a"></i><i data-slot="b"></i></div>'
        self.assertIn('>x<', inner(html, {'a': '', 'b': 'x'}))

    def test_src_counts_as_a_slot(self):
        """R26-2 - 사진 틀에는 data-src밖에 없다."""
        html = '<figure data-optional><img data-src="p"><figcaption data-slot="c"></figcaption></figure>'
        self.assertEqual(inner(html, {'p': None, 'c': ''}), '')

    def test_photo_frame_with_only_src_is_removed_when_path_is_empty(self):
        html = '<div class="frame" data-optional><img data-src="p"></div>'
        for corner in ({'p': ''}, {'p': None}, {}):
            self.assertEqual(inner(html, corner), '')

    def test_photo_frame_with_only_src_stays_when_path_is_present(self):
        html = '<div class="frame" data-optional><img data-src="p"></div>'
        self.assertIn('src="a/b.jpg"', inner(html, {'p': 'a/b.jpg'}))

    def test_no_slots_inside_is_not_judged(self):
        self.assertIn('고정', inner('<div data-optional><p>고정</p></div>', {}))

    def test_repeat_with_no_items_counts_as_empty(self):
        html = '<section data-optional><ul data-repeat="xs"><li data-slot="."></li></ul></section>'
        self.assertEqual(inner(html, {'xs': []}), '')
        self.assertIn('>a<', inner(html, {'xs': ['a']}))


class Variant(unittest.TestCase):
    HTML = '<div><p data-variant="a">A</p><p data-variant="b">B</p><p data-variant="c">C</p><hr></div>'

    @staticmethod
    def pick(name):
        return lambda names, scope: name if name in names else None

    def test_siblings_keep_one(self):
        out = inner(self.HTML, chooser=self.pick('b'))
        self.assertIn('data-variant="b"', out)
        self.assertNotIn('data-variant="a"', out)
        self.assertNotIn('data-variant="c"', out)
        self.assertIn('<hr/>', out)

    def test_no_choice_removes_every_variant_but_not_other_children(self):
        out = inner(self.HTML, chooser=self.pick('zz'))
        self.assertEqual(out, '<div><hr/></div>')
        self.assertEqual(inner(self.HTML), '<div><hr/></div>')

    def test_chooser_receives_the_names_and_the_parents_scope(self):
        seen = []
        html = '<ul data-repeat="xs"><li><p data-variant="one">1</p><p data-variant="two">2</p></li></ul>'

        def chooser(names, scope):
            seen.append((names, scope['n']))
            return 'two' if scope['n'] > 1 else 'one'

        out = inner(html, {'xs': [{'n': 1}, {'n': 2}]}, chooser=chooser)
        self.assertEqual(seen, [(frozenset({'one', 'two'}), 1), (frozenset({'one', 'two'}), 2)])
        self.assertEqual(out.count('>1<'), 1)
        self.assertEqual(out.count('>2<'), 1)

    def test_variant_may_be_the_repeat_container_itself(self):
        # tm-articles.html - `<div data-variant="grid-2" data-repeat="payload.articles">`
        html = ('<div><div data-variant="g2" data-repeat="xs"><b data-slot="."></b></div>'
                '<div data-variant="g3" data-repeat="xs"><b data-slot="."></b></div></div>')
        out = inner(html, {'xs': ['a', 'b']}, chooser=self.pick('g3'))
        self.assertIn('data-variant="g3"', out)
        self.assertNotIn('data-variant="g2"', out)
        self.assertEqual(out.count('<b'), 2)


class Order(unittest.TestCase):
    """R25-2: variant -> repeat -> if -> optional"""

    def test_repeat_inside_a_removed_variant_is_not_cloned(self):
        html = ('<section data-optional>'
                '<div data-variant="a"><i data-slot="empty"></i></div>'
                '<div data-variant="b"><u data-repeat="xs"><s data-slot="."></s></u></div>'
                '</section>')
        data = {'empty': '', 'xs': ['가', '나']}
        pick_a = lambda names, scope: 'a'  # noqa: E731
        pick_b = lambda names, scope: 'b'  # noqa: E731
        self.assertEqual(inner(html, data, chooser=pick_a), '')  # 지울 b 안의 반복이 먼저 복제되면 optional이 살아남는다
        self.assertIn('>가<', inner(html, data, chooser=pick_b))

    def test_if_is_judged_per_clone_in_the_item_scope(self):
        data = {'xs': [{'n': 'a', 'x': 1}, {'n': 'b', 'x': ''}, {'n': 'c', 'x': 'y'}]}
        out = inner('<ol data-repeat="xs"><li data-if=".x"><b data-slot=".n"></b></li></ol>', data)
        self.assertEqual(out.count('<li'), 2)
        self.assertIn('>a<', out)
        self.assertNotIn('>b<', out)
        self.assertIn('>c<', out)

    def test_empty_slot_in_an_if_removed_branch_does_not_trip_optional(self):
        html = ('<div data-optional>'
                '<p data-if="note"><i data-slot="note"></i></p>'
                '<p data-if="!note"><i data-slot="caption"></i></p>'
                '<b data-slot="title"></b></div>')
        self.assertIn('>메모<', inner(html, {'note': '메모', 'caption': '', 'title': ''}))
        self.assertEqual(inner(html, {'note': '', 'caption': '', 'title': ''}), '')
        self.assertIn('>설명<', inner(html, {'note': '', 'caption': '설명', 'title': ''}))

    def test_values_in_the_rest_keep_optional_whatever_the_removed_branch_holds(self):
        html = '<div data-optional><p data-if="no"><i data-slot="e"></i></p><b data-slot="t"></b></div>'
        self.assertIn('>x<', inner(html, {'no': '', 'e': '', 't': 'x'}))


class RealPages(unittest.TestCase):
    """디자인이 넘긴 지면 13종이 이 문법으로 채워진다 - 구조는 그대로, 견본 사진 경로는 남지 않는다."""

    def test_every_page_fills_with_nothing_and_leaves_no_sample_path(self):
        pages = sorted(PAGES.glob('*.html'))
        self.assertEqual(len(pages), 13)
        for page in pages:
            html = page.read_text(encoding='utf-8')
            out = fill(html, {}, {}, {}, None)
            self.assertNotIn('images/sample', out, page.name)
            self.assertEqual(out.count('<body'), 1, page.name)

    def test_template_html_is_not_modified_by_filling(self):
        page = PAGES / 'da-timeline.html'
        before = page.read_bytes()
        fill(page.read_text(encoding='utf-8'), {}, {}, {}, None)
        self.assertEqual(page.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
