#!/usr/bin/env python3
"""U2 열린 상자·납작 상자: box/<size>-1.png 몸통(윗면 앞 윤곽선 아래)은 그대로 두고 윗부분만 다시 그려 box/<size>-open.png, box/flat.png를 만든다."""
import os, json
from PIL import Image, ImageDraw
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
P = json.load(open(ROOT + '/art/pixel/palette.json'))
def rgba(n): v = P[n].lstrip('#'); return tuple(int(v[i:i+2], 16) for i in (0, 2, 4)) + (255,)
K, S, T, D, O, B = rgba('k1'), rgba('p2'), rgba('p1'), rgba('w1'), rgba('w2'), rgba('k0')
CLEAR = (0, 0, 0, 0)
OUT = ROOT + '/public/assets/px/box/'

def shape(im, pts, col, inner=None):
    """다각형을 col로 채우고 가장자리 1도트를 k1로 두른다(안쪽 무늬 inner: [(pts,col)] 는 윤곽 안에서만)."""
    W, H = im.size
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(pts, fill=255, outline=255)
    mp = m.load(); px = im.load()
    edge = [(x, y) for y in range(H) for x in range(W) if mp[x, y] and any(
        not (0 <= x + dx < W and 0 <= y + dy < H) or not mp[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for y in range(H):
        for x in range(W):
            if mp[x, y]: px[x, y] = col
    for ipts, icol in (inner or []):
        mi = Image.new('L', (W, H), 0); ImageDraw.Draw(mi).polygon(ipts, fill=255, outline=255); mq = mi.load()
        for y in range(H):
            for x in range(W):
                if mq[x, y] and mp[x, y]: px[x, y] = icol
    for p in edge: px[p] = K

def clear_top(im, yF):
    """윗면 앞 윤곽선(yF행) 위를 지우되 옆면 w1과 그 윤곽만 남긴다."""
    px = im.load(); W, H = im.size
    keep = set()
    for y in range(yF):
        for x in range(W):
            if px[x, y] == D:
                keep.add((x, y))
    for y in range(yF):
        for x in range(W):
            if (x, y) in keep: continue
            if px[x, y] == K and any((x + dx, y + dy) in keep for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): continue
            px[x, y] = CLEAR


def tape_cut(im, y0, y1, xs, rag):
    """앞면 테이프 y0~y1 행을 w2로 지우고 그 아래 첫 행은 들쭉날쭉 찢김"""
    px = im.load()
    for y in range(y0, y1 + 1):
        for x in xs:
            if px[x, y] == T: px[x, y] = O
    for x in rag:
        if px[x, y1 + 1] == T: px[x, y1 + 1] = O

def generic(im, g):
    yF, R, sx, yb, dx = g['yF'], g['R'], g['sx'], g['yb'], g['dx']
    xl = 1
    shape(im, g['back'], S, [(g['tapeb'], T)])                                       # 뒷날개
    shape(im, g['left'], S)                                                           # 왼날개
    shape(im, g['right'], S)                                                          # 오른날개
    shape(im, [(xl, yF), (R, yF), (sx - 2, yb), (xl + dx, yb)], D, [(g['floor'], K)])  # 입구
    px = im.load()
    for x in range(xl + 1, R): px[x, yF - 1] = S                                      # 앞 입술
    xs = g['tape']
    tape_cut(im, yF + 1, g['fy'] + 3, xs, g['rag'])
    shape(im, [(xl + 1, yF), (R - 1, yF), (R + 1, g['fy']), (xl, g['fy'])], S,
          [([(xs[0], yF + 1), (xs[-1], yF + 1), (xs[-1] + 1, g['fy'] - 2), (xs[0] - 1, g['fy'] - 2)], T)])   # 앞날개
    g.get('extra', lambda im: None)(im)

small = dict(yF=10, R=24, sx=30, yb=4, dx=5,
    back=[(9, 4), (28, 4), (26, 1), (11, 1)], tapeb=[(17, 1), (17, 4), (20, 4), (21, 1)],
    left=[(1, 10), (5, 4), (6, 1), (1, 2)], right=[(24, 10), (28, 4), (30, 2), (30, 8)],
    floor=[(5, 8), (24, 8), (27, 6), (8, 6)], tape=[11, 12, 13, 14], rag=[11, 14], fy=15)
normal = dict(yF=17, R=34, sx=38, yb=9, dx=7,
    back=[(9, 9), (37, 9), (35, 2), (12, 2)], tapeb=[(19, 2), (19, 9), (23, 9), (23, 2)],
    left=[(1, 17), (8, 9), (8, 2), (1, 3)], right=[(34, 17), (37, 9), (38, 2), (38, 15)],
    floor=[(4, 14), (34, 14), (36, 11), (9, 11)], tape=[15, 16, 17, 18, 19], rag=[15, 16, 19], fy=22)
def big_extra(im):
    px = im.load()
    for y in range(24, 28):
        for x in (12, 13, 14):
            if px[x, y] == D: px[x, y] = O
    for y in range(25, 29):
        for x in (25, 26, 27):
            if px[x, y] == D: px[x, y] = O
    for x, y in ((12, 28), (14, 28), (13, 29), (25, 29), (27, 29), (26, 30)): px[x, y] = D
    for y in range(19, 22):
        for x in (12, 13, 14): px[x, y] = D
    for y in range(19, 23):
        for x in (25, 26, 27): px[x, y] = D

big = dict(extra=big_extra, yF=17, R=39, sx=50, yb=7, dx=10,
    back=[(12, 7), (48, 7), (46, 1), (15, 1)], tapeb=[(25, 1), (25, 7), (31, 7), (31, 1)],
    left=[(2, 17), (11, 7), (11, 1), (1, 3)], right=[(38, 17), (48, 7), (50, 2), (50, 14)],
    floor=[(5, 14), (38, 14), (46, 9), (14, 9)], tape=[18, 19, 20, 21, 22, 23], rag=[18, 21, 23], fy=23)

SIZES = {'small': small, 'normal': normal, 'big': big}
def flat():
    im = Image.new('RGBA', (32, 10), CLEAR)
    shape(im, [(1, 7), (26, 7), (30, 1), (6, 1)], O)                      # 접힌 골판지 윗면
    shape(im, [(1, 7), (26, 7), (26, 8), (1, 8)], D)
    px = im.load()
    for x in range(2, 26): px[x, 7] = D                                       # 앞 두께 면
    for x in range(8, 28): px[x, 4] = D if (x % 5) else O                       # 접힘선(끊긴 점선)
    for x, y in ((14, 2), (15, 2), (16, 2), (17, 2), (13, 3), (14, 3), (15, 3), (16, 3), (12, 5), (13, 5), (14, 5), (15, 5), (11, 6), (12, 6), (13, 6)):
        px[x, y] = S
    im.save(OUT + 'flat.png')

if __name__ == '__main__':
    flat()
    for n, f in SIZES.items():
        im = Image.open(f'{ROOT}/public/assets/px/box/{n}-1.png').convert('RGBA')
        clear_top(im, {'small': 10, 'normal': 17, 'big': 17}[n]); generic(im, f)
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                if px[x, y][3] and px[x, y] != K and any(not (0 <= x + dx < im.width and 0 <= y + dy < im.height) or px[x + dx, y + dy][3] == 0 for dx in (-1, 0, 1) for dy in (-1, 0, 1)): px[x, y] = K
        im.save(OUT + f'{n}-open.png')
