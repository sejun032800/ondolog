"""렌더 실사용 표본 상시 시험 (A-23, ROADMAP R85-4). 네트워크 · DB · 키 없음. 재료는 모두 생성한 합성 값이다(실제 사람의 기록 아님).

실제 커플의 한 달에서 흔히 나오는 다섯 가지를 한 호에 담아, 지면을 짜고(compose) 실제 Chromium으로 끝까지 렌더한다.
  ① 폰 원본 크기 사진 - 4032x3024 · 3024x4032, EXIF 방향 · GPS · XMP · ICC를 단 JPEG
  ② 사진 없는 구간 - 사진 있는 기사 안의 사진 없는 구간 + 사진이 하나도 없는 데이트(v1.2.3: 글만 있는 기사 hero-none으로 실린다 - R84-2 빼기는 없앴다)
  ③ 긴 대화 - 160자 안팎 4턴(`fixtures.LONG_CONVERSATION_TEXTS`)
  ④ 이모지 - 메모 · 대화 · 장소 이름에 단일 · 결합(ZWJ) · 변형 선택자 이모지
  ⑤ 자정 넘김 - 23:30 다음 구간이 00:40(seq 순서 그대로), 23:58에 시작해 다음 날 00:03까지 이어진 대화

실행 (저장소 루트에서): render/.venv/Scripts/python.exe -B -m unittest discover -s render/tests
"""

import io
import os
import re
import sys
import tempfile
import unittest
from html import unescape
from pathlib import Path

sys.dont_write_bytecode = True
HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, '..'))
sys.path.insert(0, HERE)

from PIL import Image, ImageCms  # noqa: E402

import fixtures as fx  # noqa: E402
import photo_fit as pf  # noqa: E402
import render_issue as r  # noqa: E402
from compose import compose_issue  # noqa: E402

NAMES = [fx.A, fx.B]
TEMPLATES = r.load_templates()
ROOMY = {'messages': 1000, 'photos': 1000, 'dates': 100, 'memos': 100}
DPI = 150

PHONE_W, PHONE_H = 4032, 3024     # 흔한 폰 카메라 원본(12MP) - 가로
EMOJI_MEMO = '파스타가 정말 맛있었다 🍝😋'
EMOJI_ALLEY = '사진은 못 찍었지만 오래 걸었다 🌙'
EMOJI_MIDNIGHT = '자정 넘어 편의점에서 라면 하나 🍜'
EMOJI_PLACE = '망원 한강공원 ⛲'
EMOJI_TURNS = ('집에 잘 들어갔어? 🏠', '응 방금 도착했어 💕 오늘 고마웠어 👩‍❤️‍👨')
ALL_EMOJI_TEXTS = (EMOJI_MEMO, EMOJI_ALLEY, EMOJI_MIDNIGHT, EMOJI_PLACE) + EMOJI_TURNS


def phone_photo(entry: str, portrait: bool = False) -> dict:
    w, h = (PHONE_H, PHONE_W) if portrait else (PHONE_W, PHONE_H)
    return fx.photo(entry, w, h)


def phone_jpeg(width: int, height: int, orientation: int = 1) -> bytes:
    """폰 원본 흉내 - EXIF(방향 · GPS) · XMP · ICC · 주석을 단 큰 JPEG(합성 그림)."""
    im = Image.new('RGB', (width, height), (30, 60, 180))
    im.paste((210, 40, 40), (0, 0, width // 3, height // 3))
    exif = Image.Exif()
    exif[0x0112] = orientation
    gps = exif.get_ifd(0x8825)
    gps[1] = 'N'
    gps[2] = (37.0, 0.0, 0.0)
    gps[3] = 'E'
    gps[4] = (127.0, 0.0, 0.0)
    icc = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
    xmp = b'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></x:xmpmeta>'
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=85, exif=exif.tobytes(), icc_profile=icc, xmp=xmp, comment=b'synthetic phone sample')
    return buf.getvalue()


def real_usage_scenario(theme: str = 'basic') -> dict:
    featured = fx.article('2026-09-12', '자정까지 걸은 날', '연남동', [
        fx.stop(0, '19:00', '연남동 식당', [phone_photo('p01'), phone_photo('p02', portrait=True)], [fx.memo(EMOJI_MEMO)], None),
        fx.stop(1, '21:40', '경의선숲길', [], [fx.memo(EMOJI_ALLEY, fx.B)], None),                    # ② 사진 없는 구간
        fx.stop(2, '23:30', EMOJI_PLACE, [phone_photo('p03')], [], '강가 벤치'),
        fx.stop(3, '00:40', '집 앞 편의점', [], [fx.memo(EMOJI_MIDNIGHT)], None),                       # ⑤ 자정 넘김 - seq 3
    ], featured=True)
    photoless = fx.article('2026-09-20', '사진 없는 하루', '망원동', [                                # ② 사진이 하나도 없는 데이트 -> 기사에서 빠진다
        fx.stop(0, '13:00', '망원시장', [], [fx.memo('시장에서 떡볶이를 먹었다.')], None),
    ])
    second = fx.article('2026-09-27', '성수동 오후', '성수동', [
        fx.stop(0, '14:00', '성수동 서점', [phone_photo('p04', portrait=True)], [], '서점에서 책을 골랐다'),
        fx.stop(1, '16:30', None, [phone_photo('p05'), phone_photo('p06')], [fx.memo('오래 걸었다.')], None),
    ])
    da = fx.date_archive([featured, photoless, second], ['연남동', '성수동'])
    context, day, hour, texts = fx.LONG_CONVERSATION_TEXTS[0]
    midnight = fx.excerpt('자정 무렵 이어진 대화', '12', [                                             # ⑤ 23:58 -> 다음 날 00:03
        fx.turn(fx.A, EMOJI_TURNS[0], '2026-09-12T23:58:00+09:00'),
        fx.turn(fx.B, EMOJI_TURNS[1], '2026-09-13T00:03:00+09:00'),
    ])
    sw = fx.sweet_words([fx.long_conversation(day, texts, context, hour), midnight],                  # ③ 긴 대화 + ⑤
                        [fx.sub(fx.B, '잘 자 🌙', '2026-09-13T00:10:00+09:00'), fx.sub(fx.A, '좋은 아침 ☀️', '2026-09-13T08:00:00+09:00')])
    return {'theme': theme, 'corners': [fx.corner_row('date_archive', da, seq=1), fx.corner_row('sweet_words', sw, seq=2),
                                        fx.corner_row('this_month', fx.standard_this_month(da), seq=3)]}


def compose(theme: str = 'basic'):
    sc = real_usage_scenario(theme)
    return compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW, 'magazine_theme': sc['theme']}, NAMES, sc['corners'], ROOMY)


def page_texts(comp) -> list:
    """지면별 보이는 글자(태그 제거 · 엔티티 풀기)."""
    out = []
    for spec in comp.pages:
        html = r.fill_page(spec, comp.theme, TEMPLATES)
        html = re.sub(r'<(script|style)\b.*?</\1>', ' ', html, flags=re.S)
        out.append(unescape(re.sub(r'<[^>]+>', ' ', html)))
    return out


def size_of(data: bytes) -> tuple:
    with Image.open(io.BytesIO(data)) as im:
        return im.size


class Compose(unittest.TestCase):
    """지면 짜기 - 빠른 시험(Chromium 없음)."""

    @classmethod
    def setUpClass(cls):
        cls.comp = compose()
        cls.texts = page_texts(cls.comp)
        cls.all_text = '\n'.join(cls.texts)

    def test_photoless_date_is_printed_as_hero_none_and_photoless_stops_stay_in_the_timeline(self):
        # v1.2.3(R136-2 ① · D3): R84-2 "사진 없는 데이트 빼기"는 없어졌다 - 글만 있는 기사(hero-none)로 싣는다
        self.assertEqual(self.comp.report['droppedArticles'], 0)
        self.assertIn('사진 없는 하루', self.all_text)
        self.assertIn('경의선숲길', self.all_text)                               # 사진 있는 기사 안의 사진 없는 구간은 남는다
        self.assertEqual(self.comp.report['heroFallbackArticles'], 0)

    def test_every_emoji_text_reaches_the_page_unchanged(self):
        for text in ALL_EMOJI_TEXTS:
            self.assertIn(text, self.all_text, text)                           # 결합 이모지(ZWJ) · 변형 선택자까지 그대로

    def test_timeline_keeps_seq_order_across_midnight(self):
        timeline = ' '.join(re.sub(r'\s+', ' ', t) for spec, t in zip(self.comp.pages, self.texts) if spec.stem == 'da-timeline')
        self.assertIn('19:00 – 00:40', timeline)                               # 기사 시간 범위 = 첫 구간 ~ 마지막 구간(seq)
        positions = [timeline.find(x) for x in ('19:00 연남동 식당', '21:40 경의선숲길', f'23:30 {EMOJI_PLACE}', '00:40 집 앞 편의점')]
        self.assertTrue(all(p >= 0 for p in positions), positions)
        self.assertEqual(positions, sorted(positions))                         # 00:40이 맨 앞으로 오지 않는다(HH:mm 글자로 다시 정렬하지 않는다)
        self.assertLess(positions[3], timeline.find(EMOJI_MIDNIGHT))

    def test_conversation_crossing_midnight_is_stamped_by_its_first_turn(self):
        self.assertIn('09.12 23:58', self.all_text)                            # 출처 줄 = 첫 발화의 날짜 · 시각
        self.assertNotIn('09.13 00:03,', self.all_text)
        self.assertLess(self.all_text.find(EMOJI_TURNS[0]), self.all_text.find(EMOJI_TURNS[1]))

    def test_long_conversation_is_printed_whole(self):
        for text in fx.LONG_CONVERSATION_TEXTS[0][3]:
            self.assertIn(text, self.all_text)                                 # 길이를 맞추려고 자르지 않는다

    def test_phone_sized_photos_are_on_the_pages(self):
        shown = set(self.comp.shown_photos)
        for entry in ('p01', 'p02', 'p03', 'p04'):
            self.assertIn(fx.dest(entry), shown, entry)


class PhoneOriginal(unittest.TestCase):
    """① 폰 원본 크기 사진 한 장 - 지면 칸에 맞춰 줄이고 메타데이터(GPS 포함)를 지운다."""

    def test_a_12mp_rotated_phone_photo_fits_the_full_page_and_is_clean(self):
        src = phone_jpeg(PHONE_W, PHONE_H, orientation=6)                      # 눕혀 찍은 원본 - 지면에는 세로로 놓인다
        data, (w, h) = pf.fit_photo(src, (794, 1123), DPI, 85)                 # 판 전체(CSS px)
        self.assertEqual((w, h), size_of(data))
        self.assertLess(w, h)
        k = DPI / 96
        self.assertGreaterEqual(w, 794 * k - 1)                                # 칸을 덮고
        self.assertGreaterEqual(h, 1123 * k - 1)
        self.assertLessEqual(min(w - 794 * k, h - 1123 * k), 1)               # 덮는 데 필요한 만큼만(한 변 = 판 x DPI, 반올림 1px)
        self.assertEqual(pf.metadata_found(data), [])
        with Image.open(io.BytesIO(data)) as im:
            self.assertEqual(im.getexif().get_ifd(0x8825), {})                # GPS 0


class Pipeline(unittest.TestCase):
    """실제 Chromium - 다섯 가지를 담은 호 한 권을 끝까지 렌더한다(업로드 없음)."""

    def test_the_real_usage_issue_renders_whole_without_gate_failure(self):
        comp = compose()
        cache: dict = {}

        def fetch(dest: str) -> bytes:
            entry = dest.rsplit('/', 1)[-1].split('.')[0]
            portrait = entry in ('p02', 'p04')
            key = (portrait,)
            if key not in cache:
                cache[key] = phone_jpeg(PHONE_H if portrait else PHONE_W, PHONE_W if portrait else PHONE_H)
            return cache[key]

        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'
            r.prepare_work(work)
            r.settle_cover(comp, TEMPLATES, work)
            files = r.build_pages(comp, TEMPLATES, work, fx.ISSUE_ROW, fetch)
            report = r.fit_photos(files, work, DPI)
            self.assertGreater(report['slots'], 0)
            for p in (work / 'photos').iterdir():
                data = p.read_bytes()
                self.assertEqual(pf.metadata_found(data), [], p.name)
                w, h = size_of(data)
                self.assertLess(w * h, PHONE_W * PHONE_H, p.name)              # 원본 4032x3024가 그대로 실리지 않는다
                self.assertTrue(w <= 1317 or h <= 1756, p.name)                 # 칸을 덮는 한 변은 판(794x1123 CSS px x DPI) 안
            results = r.render_pages(files)

        pdf, counts = r.merge_pdf([x['pdf'] for x in results])
        self.assertEqual(counts, [1] * len(results))                           # 한 지면 = PDF 한 쪽
        self.assertEqual(r.pdf_page_count(pdf), len(comp.pages))
        r.assert_pdf_within_limit(pdf)
        audit = r.audit_summary(comp, results, 'a23-sample')
        self.assertIsNone(r.gate_failure(audit, 'a23-sample'))                 # 원문 잘림 · 원문 상자 넘침 0
        for res in results:
            self.assertEqual(r.jpeg_size(res['image'])[0], r.IMAGE_WIDTH_PX)
            self.assertEqual([f for f in res['findings'] if f['k'] == 'broken-image'], [])


if __name__ == '__main__':
    unittest.main()
