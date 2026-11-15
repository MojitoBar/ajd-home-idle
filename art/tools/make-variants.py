#!/usr/bin/env python3
"""수집품 황금·무지개 변종 생성.
사용: make-variants.py <master_dir> <out_dir> [--names a,b] [--size 256]
master_dir/col-<id>.png(1024 투명본) -> out_dir/<id>-gold.png, <id>-rainbow.png (알파·실루엣 그대로)
황금: 밝기 -> 색 단계(진갈색 -> 금 -> 크림) 대응 + 하이라이트 유지 + 반짝이 별
무지개: 대각선 무지개 색조 + 밝기 유지 + 은은한 줄무늬 홀로그램 + 반짝이 별(더 많이)"""
import sys, os, argparse, zlib, colorsys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('master'); ap.add_argument('out')
ap.add_argument('--names'); ap.add_argument('--size', type=int, default=256)
A = ap.parse_args()
os.makedirs(A.out, exist_ok=True)

def lum(rgb):
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]

def stretch(L, a):
    m = a > 0.5
    lo, hi = np.percentile(L[m], [3, 97])
    return np.clip((L - lo) / max(hi - lo, 1e-3), 0, 1)

STOPS = [(0.0, (70, 34, 4)), (0.35, (190, 120, 14)), (0.62, (255, 196, 40)), (0.85, (255, 233, 130)), (1.0, (255, 252, 225))]
def gold_map(t):
    out = np.zeros(t.shape + (3,))
    for (p0, c0), (p1, c1) in zip(STOPS, STOPS[1:]):
        m = (t >= p0) & (t <= p1)
        f = ((t - p0) / (p1 - p0))[m][:, None]
        out[m] = np.array(c0) * (1 - f) + np.array(c1) * f
    return out

def star(draw, cx, cy, r, color=(255, 255, 255, 255)):
    w = r * 0.16
    draw.polygon([(cx, cy - r), (cx + w, cy - w), (cx + r, cy), (cx + w, cy + w), (cx, cy + r), (cx - w, cy + w), (cx - r, cy), (cx - w, cy - w)], fill=color)
    r2 = r * 0.55; w2 = r2 * 0.2
    draw.polygon([(cx - r2, cy - r2 + w2), (cx - r2 + w2, cy - r2), (cx + r2 - w2, cy + r2), (cx + r2, cy + r2 - w2)], fill=color)
    draw.polygon([(cx + r2 - w2, cy - r2), (cx + r2, cy - r2 + w2), (cx - r2 + w2, cy + r2), (cx - r2, cy + r2 - w2)], fill=color)

def sparkles(img, alpha, seed, n, scale=1.0):
    """실루엣 안쪽 가까운 곳에 별을 얹는다(캔버스 밖으로 안 나가게)."""
    rng = np.random.RandomState(seed)
    H, W = alpha.shape
    ys, xs = np.nonzero(alpha > 0.9)
    layer = Image.new('RGBA', (W * 2, H * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(n):
        j = rng.randint(len(xs))
        cx, cy = xs[j], ys[j]
        r = (46 + rng.rand() * 40) * scale if i < 2 else (22 + rng.rand() * 22) * scale
        star(d, cx * 2, cy * 2, r * 2)
    glow = layer.filter(ImageFilter.GaussianBlur(10))
    layer = layer.resize((W, H), Image.LANCZOS); glow = glow.resize((W, H), Image.LANCZOS)
    img = Image.alpha_composite(img, glow)
    img = Image.alpha_composite(img, layer)
    img.putalpha(Image.fromarray((alpha * 255).clip(0, 255).astype(np.uint8)))  # 알파(실루엣) 원본 유지
    return img

def gold(rgb, a, seed):
    L = stretch(lum(rgb), a)
    L = (L ** 0.72) * 0.9
    out = gold_map(L)
    img = Image.fromarray(np.dstack([out, a * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
    return sparkles(img, a, seed, 5)

def rainbow(rgb, a, seed):
    H, W = a.shape
    L = stretch(lum(rgb), a)
    yy, xx = np.mgrid[0:H, 0:W]
    ys, xs = np.nonzero(a > 0.5)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    d = ((xx - x0) / max(x1 - x0, 1) + (yy - y0) / max(y1 - y0, 1)) / 2
    hue = (d * 1.15 + 0.05 * np.sin(L * 9)) % 1.0
    # 홀로그램 줄무늬: 대각선 밝은 띠
    band = 0.5 + 0.5 * np.sin((xx + yy) / 38.0)
    v = np.clip(0.30 + 0.80 * L ** 0.85 + 0.10 * band, 0, 1)
    s = np.clip(0.95 - 0.85 * np.clip((L - 0.82) / 0.18, 0, 1), 0, 1)
    h6 = hue * 6; i = np.floor(h6).astype(int) % 6; f = h6 - np.floor(h6)
    p = v * (1 - s); q = v * (1 - s * f); t = v * (1 - s * (1 - f))
    r = np.choose(i, [v, q, p, p, t, v]); g = np.choose(i, [t, v, v, q, p, p]); b = np.choose(i, [p, p, t, v, v, q])
    out = np.dstack([r, g, b]) * 255
    img = Image.fromarray(np.dstack([out, a * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
    return sparkles(img, a, seed + 7, 8)

names = A.names.split(',') if A.names else sorted(f[4:-4] for f in os.listdir(A.master) if f.startswith('col-') and f.endswith('.png'))
for n in names:
    im = np.asarray(Image.open(os.path.join(A.master, f'col-{n}.png')).convert('RGBA')).astype(np.float64)
    rgb, a = im[..., :3], im[..., 3] / 255
    seed = zlib.crc32(n.encode()) % 100000
    for tag, fn in (('gold', gold), ('rainbow', rainbow)):
        o = fn(rgb, a, seed).resize((A.size, A.size), Image.LANCZOS)
        o.save(os.path.join(A.out, f'{n}-{tag}.png'), optimize=True)
        print(n, tag)
