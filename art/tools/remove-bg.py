#!/usr/bin/env python3
"""마젠타 배경 제거 + 색 번짐(분홍 테두리) 제거.
사용: remove-bg.py <raw_dir> <master_dir> [icons_dir] [--lo 0.08] [--hi 0.45] [--erode 2] [--core 3] [--names a,b]
raw_dir/*.png -> master_dir/*.png (1024 투명 캔버스, 긴 변 84%), icons_dir 지정 시 256px(tap-phone·box-closed·box-open은 512) 내보내기.
방법: 마젠타-ness m=(min(R,B)-G)/255 로 알파 산출 -> 알파를 erode px 만큼 안쪽으로 -> 불투명 코어(알파>0.98, core px 침식)
밖의 모든 화소 색을 가장 가까운 코어 화소 색으로 대체(마젠타 성분 제거). 알파 가장자리는 부드럽게 유지."""
import sys, os, argparse, numpy as np
from PIL import Image, ImageFilter, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument('raw'); ap.add_argument('master'); ap.add_argument('icons', nargs='?')
ap.add_argument('--lo', type=float, default=0.08); ap.add_argument('--hi', type=float, default=0.45)
ap.add_argument('--erode', type=float, default=3); ap.add_argument('--core', type=int, default=4)
ap.add_argument('--names'); ap.add_argument('--keep-holes', action='store_true')
A = ap.parse_args()
BIG = {'tap-phone', 'box-closed', 'box-open'}

def erode(arr, n):  # 십자형 최소값 침식 n회 (arr: float 2D)
    for _ in range(n):
        p = np.pad(arr, 1, mode='edge')
        arr = np.minimum.reduce([arr, p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]])
    return arr

def outside_bg(bgmask):  # 가장자리에서 이어진 배경만 True (내부 구멍 보호)
    im = Image.fromarray((bgmask * 255).astype(np.uint8)).convert('RGB')
    h, w = bgmask.shape
    for x in range(0, w, 8):
        for y in (0, h - 1):
            if im.getpixel((x, y)) == (255, 255, 255): ImageDraw.floodfill(im, (x, y), (255, 0, 0))
    for y in range(0, h, 8):
        for x in (0, w - 1):
            if im.getpixel((x, y)) == (255, 255, 255): ImageDraw.floodfill(im, (x, y), (255, 0, 0))
    return (np.asarray(im)[..., 1] == 0) & (np.asarray(im)[..., 0] == 255)

def fill_nearest(c, core):  # 코어 밖 화소를 가장 가까운 코어 색으로 채움 (반복 팽창)
    c = c.copy(); known = core.copy()
    for _ in range(80):
        if known.all(): break
        p = np.pad(known, 1); pc = np.pad(c, ((1, 1), (1, 1), (0, 0)))
        new = np.zeros_like(known); acc = np.zeros_like(c)
        for dy, dx in ((0, 1), (2, 1), (1, 0), (1, 2)):
            k = p[dy:dy + known.shape[0], dx:dx + known.shape[1]]
            take = k & ~known & ~new
            acc[take] = pc[dy:dy + known.shape[0], dx:dx + known.shape[1]][take]
            new |= take
        c[new] = acc[new]; known |= new
    return c

def process(path):
    a0 = np.asarray(Image.open(path).convert('RGB')).astype(float)
    m = (np.minimum(a0[..., 0], a0[..., 2]) - a0[..., 1]) / 255
    a = 1 - np.clip((m - A.lo) / (A.hi - A.lo), 0, 1)
    bgmask = a < 0.5
    out = outside_bg(bgmask)
    if A.keep_holes: a[bgmask & ~out] = 1
    a = erode(a, int(A.erode))
    core = erode((a > 0.98).astype(float), A.core) > 0.5
    if not core.any(): core = a > 0.98
    c = fill_nearest(a0, core)
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(float) / 255
    a[a < 0.02] = 0
    return Image.fromarray(np.dstack([c, a * 255]).clip(0, 255).astype(np.uint8), 'RGBA')

os.makedirs(A.master, exist_ok=True)
if A.icons: os.makedirs(A.icons, exist_ok=True)
names = A.names.split(',') if A.names else sorted(f[:-4] for f in os.listdir(A.raw) if f.endswith('.png'))
for n in names:
    o = process(os.path.join(A.raw, n + '.png'))
    bb = o.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    o = o.crop(bb); w, h = o.size; k = int(1024 * 0.84) / max(w, h)
    o = o.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    can = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)); can.paste(o, ((1024 - o.width) // 2, (1024 - o.height) // 2))
    can.save(os.path.join(A.master, n + '.png'))
    if A.icons:
        s = 512 if n in BIG else 256
        can.resize((s, s), Image.LANCZOS).save(os.path.join(A.icons, n + '.png'), optimize=True)
    print(n, bb)
