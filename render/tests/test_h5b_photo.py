"""지면 사진 맞춤 · 메타데이터 제거 · PDF 크기 한도 시험 (위임: 74-h5b, ROADMAP R85-2 · R85-3 · R86-1 · R86-2). 네트워크 없음.
실제 Chromium을 쓰는 시험은 `Pipeline` 묶음뿐이다.

실행 (저장소 루트에서): render/.venv/Scripts/python.exe -B -m unittest discover -s render/tests
"""

import io
import json
import os
import re
import sys
import tempfile
import unittest
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

DPI = 150
K = DPI / 96
ROOMY = {'messages': 1000, 'photos': 1000, 'dates': 100, 'memos': 100}


def phone_jpeg(width=4000, height=3000, orientation=6) -> bytes:
    """폰 원본 흉내 - EXIF(방향 · GPS) · XMP · ICC · 주석 · IPTC(APP13)를 모두 단 JPEG. 왼쪽 위 1/4은 빨강, 나머지는 파랑."""
    im = Image.new('RGB', (width, height), (20, 40, 200))
    im.paste((220, 20, 20), (0, 0, width // 4, height // 4))
    exif = Image.Exif()
    exif[0x0112] = orientation
    gps = exif.get_ifd(0x8825)
    gps[1] = 'N'
    gps[2] = (37.0, 33.0, 12.5)
    gps[3] = 'E'
    gps[4] = (126.0, 55.0, 3.0)
    icc = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
    xmp = b'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></x:xmpmeta>'
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=90, exif=exif.tobytes(), icc_profile=icc, xmp=xmp, comment=b'shot on a phone')
    data = buf.getvalue()
    iptc_payload = b'Photoshop 3.0\x008BIM\x04\x04\x00\x00\x00\x00\x00\x0c\x1c\x02\x05\x00\x07caption'
    iptc = b'\xff\xed' + (len(iptc_payload) + 2).to_bytes(2, 'big') + iptc_payload
    return data[:2] + iptc + data[2:]


def size_of(data: bytes) -> tuple:
    with Image.open(io.BytesIO(data)) as im:
        return im.size


class Fixture(unittest.TestCase):
    def test_the_phone_sample_really_carries_every_kind_of_metadata(self):
        found = set(pf.metadata_found(phone_jpeg(400, 300)))
        self.assertTrue({'exif', 'xmp', 'icc', 'comment', 'iptc'} <= found, found)


class FitPhoto(unittest.TestCase):
    def test_a_big_photo_shrinks_to_the_box_times_dpi_and_keeps_no_metadata(self):
        src = phone_jpeg(4000, 3000, orientation=6)          # 눕혀 찍은 4000x3000 - 지면에는 세로 3000x4000으로 놓인다
        box = (300, 400)                                        # CSS px
        data, (w, h) = pf.fit_photo(src, box, DPI, 85)
        self.assertEqual((w, h), size_of(data))
        self.assertLess(w, h)                                   # EXIF 방향이 픽셀에 반영됐다
        self.assertEqual((w, h), (469, 625))                    # max(300*K/3000, 400*K/4000) = 0.15625
        self.assertLessEqual(min(w - box[0] * K, h - box[1] * K), 1)   # 칸을 덮는 데 필요한 만큼만(한 변은 칸 × DPI와 같다)
        self.assertEqual(pf.metadata_found(data), [])
        markers = [m for m, _ in pf.jpeg_markers(data)]
        for name, marker in (('EXIF·GPS·XMP', 0xE1), ('ICC', 0xE2), ('IPTC', 0xED), ('주석', 0xFE)):
            self.assertNotIn(marker, markers, name)
        with Image.open(io.BytesIO(data)) as im:
            self.assertEqual(dict(im.getexif()), {})
            self.assertNotIn('icc_profile', im.info)
            self.assertNotIn('xmp', im.info)
            self.assertNotIn('comment', im.info)
            self.assertEqual(im.getexif().get_ifd(0x8825), {})   # GPS 0
            # 방향 6(시계 방향 90도로 돌려 본다): 원본 왼쪽 위의 빨강이 결과 오른쪽 위로 간다
            r_, g_, b_ = im.convert('RGB').getpixel((w - 5, 5))
            self.assertGreater(r_, 150)
            self.assertLess(b_, 100)

    def test_a_small_photo_is_never_enlarged(self):
        data, size = pf.fit_photo(phone_jpeg(200, 300, orientation=1), (600, 800), DPI, 85)
        self.assertEqual(size, (200, 300))
        self.assertEqual(pf.metadata_found(data), [])

    def test_boxes_of_different_sizes_give_different_sizes(self):
        src = phone_jpeg(3000, 4000, orientation=1)
        hero = pf.fit_photo(src, (794, 1123), DPI, 85)[1]       # 표지 · 오프너처럼 판 전체
        body = pf.fit_photo(src, (300, 220), DPI, 85)[1]        # 본문 사진
        thumb = pf.fit_photo(src, (90, 90), DPI, 85)[1]         # 썸네일
        self.assertGreater(hero[0], body[0])
        self.assertGreater(body[0], thumb[0])
        self.assertEqual(thumb, (141, 188))

    def test_target_size_rules(self):
        self.assertEqual(pf.target_size((4000, 3000), (300, 200), DPI), (469, 352))            # cover - 더 큰 배율
        self.assertEqual(pf.target_size((4000, 3000), (300, 200), DPI, 'contain'), (417, 313))  # contain - 더 작은 배율
        self.assertEqual(pf.target_size((4000, 3000), (0, 0), DPI), (4000, 3000))               # 그려지지 않는 칸 - 크기는 그대로(다시 압축만)
        self.assertEqual(pf.target_size((100, 80), (300, 200), DPI), (100, 80))                 # 키우지 않는다

    def test_png_with_alpha_becomes_an_opaque_jpeg(self):
        im = Image.new('RGBA', (400, 300), (0, 0, 0, 0))
        buf = io.BytesIO()
        im.save(buf, 'PNG')
        data, size = pf.fit_photo(buf.getvalue(), (100, 75), DPI, 85)
        self.assertEqual(data[:2], b'\xff\xd8')
        self.assertEqual(pf.metadata_found(data), [])


class Config(unittest.TestCase):
    def test_existing_values_are_unchanged_and_come_from_the_one_file(self):
        cfg = pf.load_config()
        self.assertEqual((cfg['pageImageWidthPx'], cfg['pageImageJpegQuality'], cfg['photoJpegQuality'], cfg['digitalPdfMaxMb']), (1170, 85, 85, 30))
        self.assertEqual((r.IMAGE_WIDTH_PX, r.JPEG_QUALITY, r.PHOTO_JPEG_QUALITY, r.DIGITAL_PDF_MAX_MB), (1170, 85, 85, 30))
        self.assertTrue(re.fullmatch(r'[A-Za-z0-9._-]+', pf.CONFIG_FILE.name))

    def test_a_missing_or_bad_value_stops(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'c.json'
            p.write_text(json.dumps({'pageImageWidthPx': 1170, 'pageImageJpegQuality': 85, 'photoJpegQuality': 0, 'digitalPdfMaxMb': 30}), encoding='utf-8')
            with self.assertRaises(pf.PhotoFitError):
                pf.load_config(p)
            p.write_text('{}', encoding='utf-8')
            with self.assertRaises(pf.PhotoFitError):
                pf.load_config(p)


class Dpi(unittest.TestCase):
    class Api:
        def __init__(self, rows=None, fail=False):
            self.rows, self.fail, self.queries = rows, fail, []

        def select(self, table, query):
            self.queries.append((table, query))
            if self.fail:
                raise RuntimeError('app_config 조회 실패 (HTTP 500)')
            return self.rows

    def test_reads_the_digital_dpi_only(self):
        api = self.Api([{'value': {'digital': {'dpi': 150}, 'print': {'dpi': 300, 'bleedMm': 3}}}])
        self.assertEqual(r.read_digital_dpi(api), 150)
        self.assertEqual(api.queries, [('app_config', 'select=value&key=eq.pdf_profiles')])

    def test_cannot_read_stops(self):
        for api in (self.Api([]), self.Api([{'value': {'print': {'dpi': 300}}}]), self.Api([{'value': {'digital': {'dpi': 0}}}]),
                    self.Api([{'value': {'digital': {'dpi': True}}}]), self.Api(fail=True)):
            with self.assertRaises(r.StopError) as ctx:
                r.read_digital_dpi(api)
            self.assertIn('디지털 DPI를 읽지 못했다', str(ctx.exception))


class SizeLimit(unittest.TestCase):
    def test_a_pdf_over_the_limit_stops_before_upload_with_sizes_in_mb(self):
        with self.assertRaises(r.StopError) as ctx:
            r.assert_pdf_within_limit(b'x' * (2 * r.MB + r.MB // 2), 2)
        self.assertIn('2.50MB > 한도 2MB', str(ctx.exception))
        r.assert_pdf_within_limit(b'x' * (2 * r.MB), 2)

    def test_the_whole_render_stops_before_any_remote_write(self):
        import test_render_issue as tr
        api = tr.WholeApi(fx.photo_scenario())
        old_root, old_limit = r.OUT_ROOT, r.assert_pdf_within_limit.__defaults__
        with tempfile.TemporaryDirectory() as tmp:
            r.OUT_ROOT = Path(tmp)
            r.assert_pdf_within_limit.__defaults__ = (0.001,)
            try:
                with self.assertRaises(r.StopError) as ctx:
                    r.render_issue(api, fx.ISSUE, say=lambda s: None)
                self.assertTrue((Path(tmp) / fx.ISSUE / 'issue.pdf').exists())   # 로컬 산출물은 남는다 - 운영자가 본다
            finally:
                r.OUT_ROOT = old_root
                r.assert_pdf_within_limit.__defaults__ = old_limit
        self.assertIn('크기 한도를 넘는다', str(ctx.exception))
        self.assertEqual(api.puts, [])
        self.assertEqual(api.updates, [])


class UploadError(unittest.TestCase):
    def test_the_response_body_is_summarized_without_address_or_ids(self):
        body = json.dumps({'statusCode': '413', 'error': 'Payload too large',
                           'message': f'The object exceeded the maximum allowed size ({fx.COUPLE}/{fx.ISSUE}) https://example.invalid/x'}).encode()
        text = r.storage_error_summary(body)
        self.assertIn('code=413', text)
        self.assertIn('error=Payload too large', text)
        self.assertNotIn(fx.ISSUE, text)
        self.assertNotIn('https://', text)
        self.assertEqual(r.storage_error_summary(b'<html>'), '본문 해석 불가')

    def test_storage_put_failure_names_only_the_file(self):
        api = r.Api('https://example.invalid', 'k' * 40)
        api._request = lambda *a, **k: (400, json.dumps({'statusCode': '413', 'error': 'Payload too large', 'message': 'too big'}).encode())
        with self.assertRaises(r.StopError) as ctx:
            api.storage_put('magazine', f'{fx.COUPLE}/{fx.ISSUE}/render/issue.pdf', b'x', 'application/pdf')
        msg = str(ctx.exception)
        self.assertIn('HTTP 400', msg)
        self.assertIn('code=413', msg)
        self.assertTrue(msg.endswith('issue.pdf'))
        self.assertNotIn(fx.ISSUE, msg)


class Pipeline(unittest.TestCase):
    """실제 Chromium - 지면에서 칸을 재고 줄인 사진으로 바꾼 뒤 렌더한다."""

    def test_every_photo_on_every_page_is_fitted_and_clean(self):
        sc = fx.photo_scenario()
        comp = compose_issue(fx.ISSUE_ROW, {**fx.COUPLE_ROW, 'magazine_theme': sc['theme']}, [fx.A, fx.B], sc['corners'], ROOMY)
        src = phone_jpeg(2400, 3200, orientation=1)
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / 'work'
            r.prepare_work(work)
            files = r.build_pages(comp, r.load_templates(), work, fx.ISSUE_ROW, lambda dest: src)
            report = r.fit_photos(files, work, DPI)
            used = []
            for f in files:
                used += re.findall(r'<img\b[^>]*\bsrc="\.\./photos/([^"]+)"', f.read_text(encoding='utf-8'))
            names = {p.name for p in (work / 'photos').iterdir()}
            self.assertTrue(used)
            self.assertTrue(all('-fit-' in n for n in names))                 # 받아 둔 원본은 남지 않는다
            self.assertEqual(set(used), names)
            sizes = {}
            for n in names:
                data = (work / 'photos' / n).read_bytes()
                self.assertEqual(pf.metadata_found(data), [], n)
                w, h = size_of(data)
                self.assertLessEqual(w, 2400)
                self.assertLessEqual(w, 1316)                                  # 판 전체(794x1123 CSS px)를 덮는 크기가 최대
                self.assertLessEqual(h, 1755)
                sizes.setdefault(n.split('-fit-')[0], set()).add((w, h))
            self.assertTrue(any(len(v) > 1 for v in sizes.values()))         # 같은 사진이 크기가 다른 칸마다 다른 크기
            self.assertEqual(report['slots'], len(used))
            results = r.render_pages(files[:2])
            for res in results:
                self.assertEqual(r.jpeg_size(res['image'])[0], r.IMAGE_WIDTH_PX)
                self.assertEqual(pf.metadata_found(res['image']), [])        # 쪽 이미지도 메타데이터 0
                self.assertEqual([f['k'] for f in res['findings'] if f['k'] == 'broken-image'], [])


if __name__ == '__main__':
    unittest.main()
