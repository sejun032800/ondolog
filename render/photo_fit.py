"""지면 사진 맞춤 (위임: 74-h5b, ROADMAP R85-2 · R85-3 · R86-1 · R86-2). 네트워크 · 브라우저를 모른다 - 바이트를 받아 바이트를 돌려준다.

규칙
  - 사진은 **놓이는 칸 크기 × 디지털 DPI**까지 줄인다(MASTER 9-5 이중 렌더링 `digital` 약 150DPI). DPI는 호출부가 `app_config.pdf_profiles.digital.dpi`에서 읽어 넘긴다.
    칸 크기는 CSS px(1in = 96px)이고, 칸을 채우는 방식(`object-fit`)이 cover면 두 변 중 더 큰 배율, contain이면 더 작은 배율을 쓴다. **원본이 더 작으면 키우지 않는다.**
  - EXIF 방향을 픽셀에 반영한 뒤 다시 압축한다(JPEG). 결과 파일에는 **메타데이터가 없다** - EXIF · GPS · XMP(APP1) · ICC(APP2) · IPTC(APP13) · 주석(COM) 모두 쓰지 않는다 (R85-2 · R76-4).
    색 프로필이 있는 사진은 sRGB로 바꾼 뒤 프로필을 뺀다(프로필만 빼면 넓은 색역 사진의 색이 바랜다).
  - 인쇄용 프로필은 이 모듈을 쓰지 않는다 - 줄인 사진은 디지털 렌더의 작업 폴더에만 있다.
"""

from __future__ import annotations

import io
import json
import math
import sys
from pathlib import Path
from typing import Any, Optional

sys.dont_write_bytecode = True

from PIL import Image, ImageCms, ImageOps  # noqa: E402

CSS_PX_PER_INCH = 96
CONFIG_FILE = Path(__file__).resolve().parent / 'render_config.json'
CONFIG_KEYS = ('pageImageWidthPx', 'pageImageJpegQuality', 'photoJpegQuality', 'digitalPdfMaxMb')
SHRINK_FITS = ('contain', 'scale-down')   # 칸 안에 다 들어가야 하는 방식 - 더 작은 배율


class PhotoFitError(Exception):
    """사진을 맞출 수 없다 - 고치지 않고 알린다(호출부가 렌더를 멈춘다)."""


def load_config(path: Path = CONFIG_FILE) -> dict:
    """렌더 설정 파일 하나(R86-2). 키가 빠졌거나 양수가 아니면 멈춘다 - 기본값으로 메우지 않는다."""
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError) as e:
        raise PhotoFitError(f'렌더 설정 파일을 읽을 수 없다 ({path.name}: {e})') from None
    for key in CONFIG_KEYS:
        v = data.get(key) if isinstance(data, dict) else None
        if isinstance(v, bool) or not isinstance(v, (int, float)) or v <= 0:
            raise PhotoFitError(f'렌더 설정 {key}가 양수가 아니다 ({v!r})')
    return data


def target_size(src: tuple, box: tuple, dpi: float, fit: str = 'cover') -> tuple:
    """원본 (가로, 세로) px · 칸 (가로, 세로) CSS px · DPI -> 결과 (가로, 세로) px. 키우지 않는다. 칸이 0이면(지면에 그려지지 않음) 원본 크기."""
    sw, sh = src
    bw, bh = box
    if sw <= 0 or sh <= 0:
        raise PhotoFitError(f'사진 크기가 0이다 ({sw}x{sh})')
    if bw <= 0 or bh <= 0:
        return sw, sh
    k = dpi / CSS_PX_PER_INCH
    rx, ry = bw * k / sw, bh * k / sh
    scale = min(rx, ry) if fit in SHRINK_FITS else max(rx, ry)
    if scale >= 1:
        return sw, sh
    return max(1, math.ceil(sw * scale)), max(1, math.ceil(sh * scale))


def _to_srgb_rgb(im: Image.Image) -> Image.Image:
    icc = im.info.get('icc_profile')
    if im.mode in ('RGBA', 'LA', 'PA') or (im.mode == 'P' and 'transparency' in im.info):
        rgba = im.convert('RGBA')
        flat = Image.new('RGB', rgba.size, (255, 255, 255))
        flat.paste(rgba, mask=rgba.getchannel('A'))
        im = flat
    elif im.mode != 'RGB':
        im = im.convert('RGB')
    if icc:
        try:
            im = ImageCms.profileToProfile(im, ImageCms.ImageCmsProfile(io.BytesIO(icc)), ImageCms.createProfile('sRGB'), outputMode='RGB')
        except (ImageCms.PyCMSError, OSError, ValueError) as e:
            raise PhotoFitError(f'사진의 색 프로필을 sRGB로 바꿀 수 없다 ({e})') from None
    return im


def fit_photo(data: bytes, box: tuple, dpi: float, quality: int, fit: str = 'cover') -> tuple:
    """사진 하나를 칸에 맞춘다 -> (JPEG 바이트, (가로, 세로)). 결과에 메타데이터가 없다."""
    try:
        with Image.open(io.BytesIO(data)) as src:
            src.load()
            im = ImageOps.exif_transpose(src)
            if im is None:
                im = src.copy()
    except (OSError, ValueError, Image.DecompressionBombError) as e:
        raise PhotoFitError(f'사진을 열 수 없다 ({e})') from None
    im = _to_srgb_rgb(im)
    size = target_size(im.size, box, dpi, fit)
    if size != im.size:
        im = im.resize(size, Image.Resampling.LANCZOS)
    clean = Image.new('RGB', im.size)   # 픽셀만 옮긴다 - info(exif · icc · xmp · comment 등)를 하나도 넘기지 않는다
    clean.paste(im)
    out = io.BytesIO()
    clean.save(out, 'JPEG', quality=int(quality), optimize=True)
    return out.getvalue(), clean.size


# ---------------------------------------------------------------------------
# 결과 확인 - 시험과 렌더가 같은 함수로 본다
# ---------------------------------------------------------------------------

def jpeg_markers(data: bytes) -> list:
    """JPEG 머리의 표지 목록 [(표지 번호, 앞 몇 바이트)] - SOS(이미지 자료) 앞까지."""
    if data[:2] != b'\xff\xd8':
        raise PhotoFitError('JPEG가 아니다')
    out = []
    i = 2
    while i + 4 <= len(data):
        if data[i] != 0xFF:
            raise PhotoFitError(f'JPEG 표지 자리가 어긋났다 ({i})')
        marker = data[i + 1]
        if marker == 0xFF:
            i += 1
            continue
        length = int.from_bytes(data[i + 2:i + 4], 'big')
        out.append((marker, data[i + 4:i + 4 + min(length - 2, 32)]))
        if marker == 0xDA:   # SOS
            break
        i += 2 + length
    return out


def metadata_found(data: bytes) -> list:
    """결과 JPEG에 남은 메타데이터 종류 - 빈 목록이어야 한다. EXIF(GPS 포함) · XMP · ICC · IPTC · COM · 그 밖의 APPn(APP0 JFIF는 메타데이터가 아니다)."""
    found = []
    for marker, head in jpeg_markers(data):
        if marker == 0xE1:
            found.append('xmp' if head.startswith(b'http://ns.adobe.com/xap') else 'exif')
        elif marker == 0xE2:
            found.append('icc' if head.startswith(b'ICC_PROFILE') else 'app2')
        elif marker == 0xED:
            found.append('iptc')
        elif marker == 0xFE:
            found.append('comment')
        elif 0xE3 <= marker <= 0xEF:
            found.append(f'app{marker - 0xE0}')
        elif marker == 0xE0 and not head.startswith(b'JFIF\x00'):
            found.append('app0')
    return found


def summarize(sizes: list) -> Optional[dict[str, Any]]:
    """[(가로, 세로, 바이트)] -> 보고용 숫자."""
    if not sizes:
        return None
    w, h, b = max(sizes, key=lambda s: s[2])
    return {'files': len(sizes), 'bytes': sum(s[2] for s in sizes), 'largest': {'width': w, 'height': h, 'bytes': b}}
