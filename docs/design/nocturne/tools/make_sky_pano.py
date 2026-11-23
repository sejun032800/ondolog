"""우리의 하늘 360° 원본 만들기 — patch10 (R17 2부 2-1)

외부 사진 · 실존 장소 사진을 쓰지 않는다. 재료는 앱의 하늘 그림 `sky_world.jpg` 하나와 계산(잡음 · 점)뿐이다.

만드는 규칙
  1. 투영: **원통 띠**. 가로 = 방향 0°~360°(끊김 없이 이어짐), 세로 = 높이 −15°(지평선 아래) ~ +90°(천정).
     C01과 같은 배율 — 지평선 → 천정 90°가 C01의 하늘 높이 779pt다. 그래서 1° = 8.656pt, 한 바퀴 = 3116pt, 띠 높이 = 909pt.
  2. 들어가는 방향(0°~45°)에는 **C01이 보이는 바로 그 구간**(`sky_world.jpg` 위에서 620pt ~ 1399pt)을 그대로 심는다.
     C01 → 둘러보기로 들어갈 때 화면이 한 픽셀도 바뀌지 않는다. 양옆 15°에 걸쳐 계산한 하늘과 섞는다.
  3. 은하수는 하나의 큰 원이다 — 0° 쪽(C01 그림의 은하수)에서 솟아 천정을 지나 **180° 쪽으로 내려간다**. 띠에서는 0°와 180°에 세로 줄기 두 개,
     천정 가까이(위 12%)에서는 하늘 전체가 은은하게 밝다(원통 띠에서 천정은 한 점이 가로로 늘어난 것이라 무늬를 두지 않고 고르게 녹인다).
  4. 색은 C01 그림에서 뽑는다 — 줄마다 그림 가장자리 열의 색(위 어둠 → 아래 보랏빛). 지평선 빛은 넣지 않는다(C01 그림에 없다).
  5. 배경 별 = 점. 은하수 안이 더 촘촘하다. 크기 3단(0.8 · 1.2 · 1.8px@1x), 밝기 고르게 흩음. **반짝이는 별은 그림에 넣지 않는다**(앱이 CSS로 20개만 숨 쉬게 한다).
  6. 가로로 끊김이 없게 모든 잡음 · 별 · 줄기를 둘레로 감아 계산한다(왼쪽 끝 = 오른쪽 끝).
  7. 크기: 1.25x — 3896 × 1136px JPEG(품질 86). LG V40 텍스처 한도 4096px 안. 앱은 이 그림 두 장을 이어 붙여 옮긴다(보드 17-d 표).

사용: python make_sky_pano.py <sky_world.jpg 경로> <출력 경로>   (numpy · Pillow)
같은 입력이면 같은 그림이 나온다(시드 고정).
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

S = 1.25                     # 배율(px/pt)
PT_PER_DEG = 779 / 90        # C01: 지평선 → 천정 = 779pt
W = int(round(360 * PT_PER_DEG * S / 8)) * 8      # 3896
H_SKY = int(round(779 * S))                        # 974  (지평선 줄)
H = int(round(909 * S / 8)) * 8                    # 1136
CROP_W = int(round(390 * S))                       # 488 = 45°
FEATHER = int(round(15 * PT_PER_DEG * S))          # 15°
SEED = 20261123


def periodic_noise(h, w, scales, rng):
    """가로로 이어지는 잡음 — 작은 격자를 둘레로 감아 키운다."""
    out = np.zeros((h, w), np.float32)
    amp = 1.0
    for cells in scales:
        gw, gh = cells, max(2, int(cells * h / w * 2))
        g = rng.random((gh, gw)).astype(np.float32)
        g = np.concatenate([g, g[:, :1]], axis=1)          # 둘레로 감기
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((w + w // gw, h), Image.BICUBIC)
        out += amp * (np.asarray(im, np.float32)[:, :w] / 255.0)
        amp *= 0.55
    out -= out.min(); out /= max(out.max(), 1e-6)
    return out


def wrap_dx(x, c, w):
    d = np.abs(x - c)
    return np.minimum(d, w - d)


def main(src, dst):
    rng = np.random.default_rng(SEED)
    sky = Image.open(src).convert('RGB')
    sw, sh = sky.size                                  # 780 x 4000 (2x)
    # C01 구간: 위에서 620pt ~ 1399pt (2x px 1240 ~ 2798)
    crop = sky.crop((0, 1240, sw, 2798)).resize((CROP_W, H_SKY), Image.LANCZOS)
    c = np.asarray(crop, np.float32)

    # 4. 줄마다 평균색 (은하수를 빼려고 어두운 쪽 40% 값)
    edges = np.concatenate([c[:, :40], c[:, -40:]], axis=1)
    row = np.median(edges, axis=1)                     # H_SKY x 3 - 그림 가장자리 열의 색(이음매가 맞게)
    row = np.asarray(Image.fromarray(row[None].astype(np.uint8)).filter(ImageFilter.GaussianBlur(0)), np.float32)[0]
    k = np.ones(31) / 31
    row = np.stack([np.convolve(np.pad(row[:, i], 15, mode='edge'), k, 'valid') for i in range(3)], 1)
    base = np.zeros((H, W, 3), np.float32)
    base[:H_SKY] = row[:, None, :]
    # 지평선 아래: 땅 쪽으로 잉크까지(앱이 지평선 실루엣을 위에 그린다)
    t = np.linspace(0, 1, H - H_SKY)[:, None, None] ** 0.5
    base[H_SKY:] = np.array([16, 12, 30], np.float32) * (1 - t) + np.array([8, 6, 14], np.float32) * t
    # 지평선 빛(위 10°)
    y = np.arange(H, dtype=np.float32)[:, None]
    glow_h = 10 * PT_PER_DEG * S
    glow = np.exp(-np.clip(H_SKY - y, 0, None) / glow_h) * (y <= H_SKY)
    base += glow[..., None] * np.array([0, 0, 0], np.float32)   # C01 그림에 지평선 빛이 없다 - 넣지 않는다(앱의 지평선 실루엣이 받는다)

    # 3. 은하수 — 0°(그림 가운데)와 180°에 세로 줄기. 줄기 중심은 C01 그림의 은하수 위치를 따라 높이마다 흔들린다
    lum = c.mean(2)
    prof = np.asarray(Image.fromarray(lum.astype(np.uint8)).filter(ImageFilter.GaussianBlur(18)), np.float32)
    band_x0 = prof.argmax(1).astype(np.float32)        # 그림 안 은하수 중심(높이마다)
    band_x0 = np.convolve(np.pad(band_x0, 40, mode='edge'), np.ones(81) / 81, 'valid')
    xs = np.arange(W, dtype=np.float32)[None, :]
    el = (H_SKY - y) / (PT_PER_DEG * S)                # 높이(도)
    width = (7 + 4 * np.clip(1 - el / 90, 0, 1)) * PT_PER_DEG * S  # 아래가 넓다
    centers = [band_x0[:, None] if False else None]
    m = np.zeros((H, W), np.float32)
    yy = np.clip(np.arange(H), 0, H_SKY - 1)
    c0 = band_x0[yy][:, None]                          # 0° 줄기 = 그림 그대로의 자리
    c1 = (c0 + W / 2 + 60 * np.sin(np.arange(H)[:, None] / 140.0)) % W   # 180° 줄기 = 반대편, 다르게 흔들림
    m += np.exp(-(wrap_dx(xs, c0, W) / width) ** 2)
    m += 0.85 * np.exp(-(wrap_dx(xs, c1, W) / width) ** 2)
    top = np.exp(-(y / (0.12 * H_SKY)) ** 2)            # 천정 고르게
    m = np.clip(m + 0.35 * top, 0, 1.2) * (y <= H_SKY + 6)
    tex = periodic_noise(H, W, [12, 36, 110, 320], rng)
    dust = periodic_noise(H, W, [20, 70, 200], rng)
    band_col = np.array([96, 74, 150], np.float32)
    lane_col = np.array([-22, -18, -30], np.float32)
    grain = periodic_noise(H, W, [600, 1400], rng)
    base += (m * (0.15 + 1.25 * tex ** 2.2) * (0.75 + 0.5 * grain))[..., None] * band_col * 0.62
    base += (m * np.clip(dust - 0.55, 0, 1) * 3.2)[..., None] * lane_col

    # 5. 별
    n = int(W * H_SKY / 700)
    px = rng.random(n) * W
    py = rng.random(n) ** 1.15 * H_SKY
    keep = rng.random(n) < (0.35 + 0.65 * m[py.astype(int), px.astype(int)].clip(0, 1))
    px, py = px[keep], py[keep]
    size = rng.choice([0.8, 1.2, 1.8], len(px), p=[0.72, 0.22, 0.06]) * S
    bright = rng.uniform(60, 200, len(px)) * rng.choice([1.0, 0.55], len(px), p=[0.35, 0.65])
    stars = np.zeros((H, W), np.float32)
    for dx in (-1, 0, 1, 2):
        for dy in (-1, 0, 1, 2):
            fx = np.floor(px) + dx; fy = np.floor(py) + dy
            d2 = (fx + 0.5 - px) ** 2 + (fy + 0.5 - py) ** 2
            w_ = np.exp(-d2 / (2 * (size / 2.2) ** 2))
            ok = (fy >= 0) & (fy < H)
            np.add.at(stars, (fy[ok].astype(int), (fx[ok].astype(int)) % W), (bright * w_)[ok])
    star_tint = np.array([0.95, 0.93, 1.0], np.float32)
    base += np.clip(stars, 0, 255)[..., None] * star_tint

    # 2. C01 구간 심기 — 0° ~ 45°는 그림 그대로(들어갈 때 화면이 바뀌지 않는다).
    #    창 밖 양옆 15°는 그림을 거울로 이어 붙이고 계산한 하늘로 서서히 넘긴다(경계선이 생기지 않게)
    out = np.clip(base, 0, 255)
    out[:H_SKY, :CROP_W] = c
    ramp = (np.cos(np.linspace(0, np.pi, FEATHER)) + 1) / 2          # 1 → 0
    mir_r = c[:, ::-1][:, :FEATHER]                                     # 오른쪽 바깥 = 오른쪽 끝에서 거울
    mir_l = c[:, :FEATHER][:, ::-1]                                     # 왼쪽 바깥(둘레 끝) = 왼쪽 끝에서 거울
    for i in range(FEATHER):
        a = ramp[i]
        xr = CROP_W + i
        out[:H_SKY, xr] = mir_r[:, i] * a + out[:H_SKY, xr] * (1 - a)
        xl = (W - 1 - i) % W
        out[:H_SKY, xl] = mir_l[:, FEATHER - 1 - i] * a + out[:H_SKY, xl] * (1 - a)
    Image.fromarray(out.astype(np.uint8)).save(dst, quality=86, optimize=True)
    print(dst, W, H, 'horizon row', H_SKY, 'entry window x 0 ..', CROP_W)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
