#!/usr/bin/env python3
# edge.png는 2026-11-15에 창 x104~119를 벽 기둥으로 손으로 고쳤다(왼쪽 창 x12~103, 오른쪽 창 x120~167) — 스크립트를 다시 돌리면 사라진다, 원본 백업 art/legacy-assets/edge-room-before-g4.png
"""B6 방 배경 9장(blue 러그 포함) 손도트. 180x130, 바닥선 y80~81(k1 2행), 위 30도트 빈 벽.
python3 art/tools/px-b6.py [방이름...]  -> art/raw/px 아님: public/assets/px/room/<이름>.png 직접 저장(handFixed)"""
import sys, os, json, math
import numpy as np
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PAL = {k: tuple(int(v[i:i+2], 16) for i in (1, 3, 5)) for k, v in json.load(open(os.path.join(ROOT, 'art/pixel/palette.json'))).items() if v.startswith('#')}
W, H = 180, 130

class Cv:
    def __init__(s): s.a = np.zeros((H, W, 3), np.uint8)
    def px(s, x, y, c):
        if 0 <= x < W and 0 <= y < H and c: s.a[y, x] = PAL[c]
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.px(x, y, c)
    def get(s, x, y):
        v = tuple(s.a[y, x]); return next(k for k, c in PAL.items() if c == v)
    def circle(s, cx, cy, r, c):
        for y in range(int(cy - r) - 1, int(cy + r) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r: s.px(x, y, c)
    def save(s, name):
        p = os.path.join(ROOT, 'public/assets/px/room', name + '.png')
        os.makedirs(os.path.dirname(p), exist_ok=True)
        im = np.zeros((H, W, 4), np.uint8); im[..., :3] = s.a; im[..., 3] = 255
        Image.fromarray(im).save(p)

SEAMX = [(44, 14), (120, 60), (8, 100), (150, 33), (70, 90), (30, 130), (110, 20), (160, 75)]

def floor(c, base, seam, kind='planks', cell=34, rivet=None):
    c.rect(0, 80, W - 1, 81, 'k1')
    c.rect(0, 82, W - 1, H - 1, base)
    if kind == 'planks':
        for i, y in enumerate(range(91, H, 10)):
            c.rect(0, y, W - 1, y, seam)
            for j in range(1 + i % 2):
                x = (SEAMX[(i * 2 + j) % 8][0] * 7 + i * 37 + j * 61) % W
                c.rect(x, y - 9, x, y - 1, seam)
    elif kind == 'grid':
        rows = [92, 104, 118]
        for y in rows: c.rect(0, y, W - 1, y, seam)
        for y in range(82, H):
            s_ = cell * (1 + 0.35 * (y - 82) / 48)
            for k in range(-6, 6):
                c.px(round(90 + (k + 0.5) * s_), y, seam)
        if rivet:
            for yt in [83] + [r + 1 for r in rows]:
                s_ = cell * (1 + 0.35 * (yt - 82) / 48)
                for k in range(-6, 6):
                    xs = round(90 + (k + 0.5) * s_)
                    for dx in (-3, 3): c.px(xs + dx, yt + 1, rivet)

def plant_sill(c, cx, by):
    c.rect(cx - 7, by - 1, cx + 7, by, 'w2'); c.rect(cx - 5, by + 0, cx + 5, by, 'w1') if False else None
    c.rect(cx - 5, by - 6, cx + 5, by - 2, 'w1'); c.rect(cx - 7, by - 8, cx + 7, by - 7, 'w2')
    c.rect(cx - 1, by - 22, cx, by - 9, 'gn')
    c.rect(cx - 6, by - 17, cx - 2, by - 13, 'gn'); c.rect(cx + 2, by - 21, cx + 6, by - 16, 'gn'); c.rect(cx - 3, by - 26, cx + 2, by - 21, 'gn')

def plant_floor(c, cx, by):
    for (dx, dy, r) in [(-7, -22, 6), (7, -26, 6), (0, -32, 7)]:
        c.circle(cx + dx, by + dy, r + 1, 'k1')
    c.rect(cx - 1, by - 22, cx, by - 9, 'k1')
    for (dx, dy, r) in [(-7, -22, 6), (7, -26, 6), (0, -32, 7)]:
        c.circle(cx + dx, by + dy, r, 'gn')
    c.rect(cx - 9, by - 12, cx + 9, by + 1, 'k1'); c.rect(cx - 8, by - 11, cx + 8, by - 10, 'w2')
    c.rect(cx - 7, by - 9, cx + 7, by, 'w1')

def window(c, x, y, w, h, frame, glass_fn, sill, sill_edge='k1', mull=None):
    c.rect(x, y, x + w - 1, y + h - 1, frame)
    gx, gy, gw, gh = x + 2, y + 2, w - 4, h - 4
    glass_fn(c, gx, gy, gw, gh)
    if mull:
        for mx in mull: c.rect(mx, gy, mx + 1, gy + gh - 1, frame)
    c.rect(x - 3, y + h, x + w + 2, y + h + 1, 'k1')
    c.rect(x - 2, y + h + 1, x + w + 1, y + h + 2, sill)
    c.rect(x - 2, y + h + 3, x + w + 1, y + h + 3, 'k1')

def counter(c, x0, x1, top, cap, front, handle='k1', line='k1'):
    c.rect(x0, top, x1, 78, 'k1')
    c.rect(x0 + 1, top + 2, x1 - 1, top + 4, cap)
    c.rect(x0 + 1, top + 8, x1 - 1, 78, front)
    c.rect(x0, 79, x1, 79, 'k1')
    mid = (x0 + x1) // 2
    c.rect(mid, top + 8, mid, 78, line)
    c.rect(mid - 4, top + 12, mid - 3, top + 15, handle)
    c.rect(mid + 3, top + 12, mid + 4, top + 15, handle)

def rug(c, inner, border, y0=92, y1=120, xl0=56, xr0=124, xl1=44, xr1=136, bw=3):
    for y in range(y0, y1 + 1):
        t = (y - y0) / (y1 - y0)
        l = round(xl0 + (xl1 - xl0) * t); r = round(xr0 + (xr1 - xr0) * t)
        ycolor = border if (y - y0 < bw or y1 - y < bw) else None
        for x in range(l, r + 1):
            edge = x - l < 1 or r - x < 1 or y == y0 or y == y1
            inb = x - l < bw + 1 or r - x < bw + 1
            c.px(x, y, 'k1' if edge else (border if (inb or ycolor) else inner))
    for x in range(xl0 + 1, xr0): pass

# ---------- 창밖 풍경 ----------
def sc_blue(c, x, y, w, h):
    c.rect(x, y, x + w - 1, y + h - 1, 'b3')
    c.rect(x + 10, y + 12, x + 22, y + 13, 'k5'); c.rect(x + 12, y + 10, x + 20, y + 11, 'k5'); c.rect(x + 14, y + 9, x + 18, y + 9, 'k5')

def cloud(c, x, y, col='k5'):
    c.rect(x, y + 2, x + 12, y + 3, col); c.rect(x + 2, y, x + 9, y + 1, col); c.rect(x + 4, y - 1, x + 7, y - 1, col)

def sc_mint(c, x, y, w, h):
    c.rect(x, y, x + w - 1, y + h - 1, 'b3'); cloud(c, x + 3, y + 5)
    c.rect(x, y + h - 5, x + w - 1, y + h - 1, 'gn')

def sc_sunset(c, x, y, w, h):
    bands = ['pu', 'pk', 'or', 'g2']
    bh = (h - 10) // 4
    for i, b in enumerate(bands): c.rect(x, y + i * bh, x + w - 1, y + (i + 1) * bh - 1 + (1 if i == 3 else 0), b)
    c.rect(x, y + 4 * bh, x + w - 1, y + h - 1, 'g2')
    sx = x + w // 2; sy = y + h - 8
    for dy in range(0, 7):
        hw = int(math.sqrt(max(0, 49 - (6 - dy + 0) ** 2 * 1.0)) * 1.2) if False else int(math.sqrt(max(0, 36 - (6 - dy) ** 2)))
        c.rect(sx - hw, sy + dy - 6 + 1, sx + hw, sy + dy - 6 + 1, 'g3')
    for bx, bw2, bh2 in [(0, 6, 8), (6, 5, 12), (11, 7, 6), (w - 13, 6, 10), (w - 7, 7, 14), (w - 20, 7, 6)]:
        c.rect(x + bx, y + h - bh2, x + bx + bw2 - 1, y + h - 1, 'k1')
    c.rect(x, y + h - 1, x + w - 1, y + h - 1, 'k1')

def sc_night(c, x, y, w, h):
    c.rect(x, y, x + w - 1, y + h - 1, 'k0')
    for sx, sy in [(5, 3), (17, 7), (31, 2), (47, 6), (58, 3), (70, 8), (24, 11), (40, 11)]:
        if sx < w and sy < h: c.px(x + sx, y + sy, 'k5')
    c.circle(x + w - 12, y + 9, 4, 'g3')
    blds = [(0, 9, 10), (9, 6, 16), (15, 8, 8), (23, 7, 14), (30, 9, 20), (39, 6, 9), (45, 8, 15), (53, 7, 11), (60, 9, 17), (69, 8, 7)]
    for bx, bw2, bh2 in blds:
        if bx >= w: continue
        bw2 = min(bw2, w - bx); col = 'k1' if bx % 2 == 0 else 'k2'
        c.rect(x + bx, y + h - bh2, x + bx + bw2 - 1, y + h - 1, col)
        for wy in range(y + h - bh2 + 2, y + h - 2, 4):
            for wx in range(x + bx + 2, x + bx + bw2 - 1, 3):
                if (wx * 7 + wy * 3) % 5 < 3: c.px(wx, wy, 'g2')

def sc_moon(c, x, y, w, h):
    c.rect(x, y, x + w - 1, y + h - 1, 'k0')
    for sx, sy in [(4, 5), (20, 3), (9, 20), (23, 15), (3, 14)]: c.px(x + sx, y + sy, 'k5')
    cx, cy, r = x + w * 0.62, y + h * 0.58, h * 0.34
    c.circle(cx, cy, r, 'b2')
    for dx, dy, ww, hh in [(-5, -3, 7, 4), (1, 1, 6, 4), (-4, 4, 4, 2), (-3, -7, 4, 2)]:
        c.rect(int(cx + dx), int(cy + dy), int(cx + dx + ww), int(cy + dy + hh), 'gn')
    c.rect(int(cx - 3), int(cy - 1), int(cx + 4), int(cy), 'k5')
    c.rect(int(cx - 6), int(cy + 3), int(cx - 1), int(cy + 3), 'b3')
    c.rect(x, y + h - 4, x + w - 1, y + h - 1, 'k3'); c.rect(x, y + h - 4, x + w - 1, y + h - 4, 'k4')

def sc_mars(c, x, y, w, h):
    c.rect(x, y, x + w - 1, y + h - 1, 'or')
    c.rect(x, y, x + w - 1, y + 5, 'g2')
    c.circle(x + 7, y + 7, 2, 'g3'); c.px(x + w - 8, y + 6, 'k4')
    c.rect(x, y + h - 8, x + w - 1, y + h - 1, 'r2')
    for hx in range(0, w): c.px(x + hx, y + h - 8 - int(2 * math.sin(hx / 6.0) + 2), 'r2') if False else None
    for dx, dy, ww in [(3, 9, 14), (22, 10, 12), (38, 8, 16)]:
        if dx < w: c.rect(x + dx, y + h - dy, x + min(w - 1, dx + ww), y + h - 8, 'r2')
    c.rect(x, y + h - 4, x + w - 1, y + h - 1, 'r1')
    c.rect(x + 9, y + h - 6, x + 14, y + h - 5, 'r1')

def sc_jupiter(c, x, y, w, h):
    c.rect(x, y, x + w - 1, y + h - 1, 'k0')
    for sx, sy in [(4, 4), (w - 6, 3), (w - 4, h - 7), (8, h - 6)]: c.px(x + sx, y + sy, 'k5')
    cx, cy, r = x + w * 0.5, y + h * 0.78, h * 0.78
    bands = ['w2', 'p1', 'or', 'w2', 'g1', 'p1', 'w2', 'or']
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r:
                c.px(xx, yy, bands[((yy - y) // 3) % len(bands)])
    c.rect(int(cx - 9), int(y + h * 0.46), int(cx - 3), int(y + h * 0.46) + 2, 'r2')
    c.rect(int(cx - 10), int(y + h * 0.46) + 1, int(cx - 2), int(y + h * 0.46) + 1, 'r1')
    c.circle(x + w - 8, y + 7, 2, 'k4')

def sc_nebula(c, x, y, w, h):
    c.rect(x, y, x + w - 1, y + h - 1, 'k0')
    blobs = [(0.3, 0.5, 0.34, 'pu'), (0.55, 0.4, 0.26, 'pk'), (0.75, 0.6, 0.3, 'pu'), (0.5, 0.7, 0.2, 'pu')]
    for fx, fy, fr, col in blobs:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if ((xx - x - fx * w) / 1.8) ** 2 + (yy - y - fy * h) ** 2 <= (fr * h * 1.3) ** 2: c.px(xx, yy, col)
    for fx, fy, fr, col in [(0.55, 0.42, 0.11, 'g3'), (0.3, 0.5, 0.12, 'pk')]:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if ((xx - x - fx * w) / 1.8) ** 2 + (yy - y - fy * h) ** 2 <= (fr * h * 1.3) ** 2: c.px(xx, yy, col)
    for sx, sy in [(3, 4), (12, 20), (w // 2, 3), (w - 9, 7), (w - 4, h - 6), (w // 3, h - 5), (w - 20, h - 12)]:
        c.px(x + sx, y + sy, 'k5')
    for sx, sy in [(8, h - 8), (w - 14, 4)]: c.px(x + sx, y + sy, 'b3')

def sc_edge(c, x, y, w, h):
    c.rect(x, y, x + w - 1, y + h - 1, 'k0')
    st = [(3, 4), (11, 15), (20, 7), (27, 21), (36, 4), (44, 17), (52, 9), (61, 22), (70, 5), (78, 14), (87, 8), (95, 20), (104, 4), (112, 13),
          (121, 22), (130, 7), (138, 16), (146, 5), (9, 24), (33, 11), (66, 12), (99, 12), (127, 14)]
    for i, (sx, sy) in enumerate(st):
        if sx < w and sy < h: c.px(x + sx, y + sy, 'k5' if i % 3 else 'g3')
    for sx, sy in [(15, 9), (58, 15), (83, 4), (118, 9), (142, 21)]:
        if sx < w and sy < h: c.px(x + sx, y + sy, 'b3')
    c.circle(x + w - 22, y + 11, 4, 'b4'); c.px(x + w - 23, y + 10, 'k5')
    c.rect(x + w - 26, y + 11, x + w - 19, y + 11, 'b4')
    c.rect(x, y + h - 3, x + w - 1, y + h - 1, 'b1')

# ---------- 방 ----------
def wall(c, col, stripe=None, step=30):
    c.rect(0, 0, W - 1, 79, col)
    if stripe:
        for x in range(step // 2, W, step): c.rect(x, 31, x, 79, stripe)

ROOMS = {}
def room(name):
    def d(f): ROOMS[name] = f; return f
    return d

META = {}

@room('blue')
def _(c):
    # 원룸은 기존 그림에 러그만 얹는다
    im = np.array(Image.open(os.path.join(ROOT, 'art/pixel/blue-base.png')).convert('RGB'))
    c.a[:] = im
    rug(c, 'b4', 'b3')
    META['blue'] = dict(rug=[44, 92, 136, 120])

@room('mint')
def _(c):
    wall(c, 'k4'); c.rect(0, 64, W - 1, 79, 'gn'); c.rect(0, 64, W - 1, 64, 'k3')
    floor(c, 'k4', 'k3', 'planks')
    window(c, 56, 33, 25, 26, 'k1', sc_mint, 'p2'); window(c, 99, 33, 25, 26, 'k1', sc_mint, 'p2')
    c.rect(78, 59, 102, 59, 'k1'); c.rect(78, 60, 102, 61, 'p2'); c.rect(78, 62, 102, 62, 'k1')
    plant_sill(c, 90, 58)
    plant_floor(c, 153, 120)
    counter(c, 124, 168, 58, 'p2', 'b4', 'k2')
    rug(c, 'b3', 'gn')
    META['mint'] = dict(counterTop=58, counter=[124, 168], windows=[[56, 33, 25, 26], [99, 33, 25, 26]], rug=[44, 92, 136, 120])

@room('sunset')
def _(c):
    wall(c, 'g3'); floor(c, 'w1', 'k1', 'planks')
    window(c, 62, 31, 52, 30, 'k1', sc_sunset, 'p2', mull=[87])
    # 소파
    c.rect(66, 63, 112, 79, 'k1'); c.rect(67, 64, 111, 78, 'r2'); c.rect(67, 64, 111, 66, 'pk')
    c.rect(66, 70, 112, 79, 'k1'); c.rect(67, 71, 111, 78, 'r1'); c.rect(76, 71, 76, 78, 'k1'); c.rect(102, 71, 102, 78, 'k1')
    c.rect(67, 70, 111, 70, 'k1')
    counter(c, 124, 168, 56, 'p2', 'k2', 'g2')
    rug(c, 'b4', 'pu')
    META['sunset'] = dict(counterTop=56, counter=[124, 168], windows=[[62, 31, 52, 30]], rug=[44, 92, 136, 120], sofa=[66, 63, 112, 79])

@room('night')
def _(c):
    wall(c, 'k2'); floor(c, 'k1', 'k0', 'planks')
    window(c, 36, 31, 86, 24, 'k4', sc_night, 'k3', mull=[78])
    counter(c, 124, 168, 54, 'k4', 'b1', 'g2')
    rug(c, 'b3', 'b2')
    META['night'] = dict(counterTop=54, counter=[124, 168], windows=[[36, 31, 86, 24]], rug=[44, 92, 136, 120])

@room('moon')
def _(c):
    wall(c, 'k2', 'k1', 30); floor(c, 'k3', 'k2', 'grid', 34, 'k4')
    cx, cy, r = 89, 48, 17
    c.circle(cx, cy, r, 'k4'); c.circle(cx, cy, r - 2, 'k1'); c.circle(cx, cy, r - 4, 'k0')
    sc = Cv(); sc_moon(sc, 0, 0, 2 * (r - 4) + 1, 2 * (r - 4) + 1)
    for yy in range(2 * (r - 4) + 1):
        for xx in range(2 * (r - 4) + 1):
            if (xx - (r - 4)) ** 2 + (yy - (r - 4)) ** 2 <= (r - 4) ** 2: c.px(cx - (r - 4) + xx, cy - (r - 4) + yy, sc.get(xx, yy))
    c.rect(cx - r - 3, cy + r + 1, cx + r + 3, cy + r + 2, 'k4'); c.rect(cx - r - 3, cy + r + 3, cx + r + 3, cy + r + 3, 'k1')
    counter(c, 124, 168, 58, 'k4', 'k3', 'g2')
    rug(c, 'k4', 'g2')
    META['moon'] = dict(counterTop=58, counter=[124, 168], windows=[[72, 31, 35, 35]], rug=[44, 92, 136, 120], note='둥근 창 중심(89,48) 반지름 17')

@room('mars')
def _(c):
    wall(c, 'w1', 'r1', 30); floor(c, 'k2', 'k1', 'grid', 34, 'k3')
    window(c, 62, 32, 56, 26, 'k1', sc_mars, 'w2')
    counter(c, 124, 168, 56, 'w2', 'k2', 'k4')
    rug(c, 'k3', 'r2')
    META['mars'] = dict(counterTop=56, counter=[124, 168], windows=[[62, 32, 56, 26]], rug=[44, 92, 136, 120])

@room('jupiter')
def _(c):
    wall(c, 'w2'); floor(c, 'w1', 'k1', 'planks')
    cx = 90
    window(c, 40, 31, 84, 28, 'k1', sc_jupiter, 'p1', mull=[80])
    counter(c, 124, 168, 58, 'p1', 'w1', 'g2')
    rug(c, 'b4', 'b2')
    META['jupiter'] = dict(counterTop=58, counter=[124, 168], windows=[[40, 31, 84, 28]], rug=[44, 92, 136, 120])

@room('nebula')
def _(c):
    wall(c, 'k0', 'k1', 20); floor(c, 'pu', 'k1', 'grid', 36)
    window(c, 34, 31, 90, 28, 'k4', sc_nebula, 'k3', mull=[78])
    counter(c, 124, 168, 54, 'k4', 'b1', 'pk')
    rug(c, 'pk', 'g3')
    META['nebula'] = dict(counterTop=54, counter=[124, 168], windows=[[34, 31, 90, 28]], rug=[44, 92, 136, 120])

@room('edge')
def _(c):
    wall(c, 'b1'); floor(c, 'k1', 'b1', 'grid', 36)
    window(c, 12, 31, 156, 28, 'k4', sc_edge, 'k3', mull=[62, 118])
    counter(c, 120, 170, 52, 'k4', 'k2', 'g2')
    rug(c, 'g3', 'g2')
    META['edge'] = dict(counterTop=52, counter=[120, 170], windows=[[12, 31, 156, 28]], rug=[44, 92, 136, 120])

if __name__ == '__main__':
    names = sys.argv[1:] or list(ROOMS)
    for n in names:
        c = Cv(); ROOMS[n](c); c.save(n); print(n)
    json.dump(META, open(os.path.join(ROOT, 'art/pixel/b6-meta.json'), 'w'), ensure_ascii=False, indent=1) if not sys.argv[1:] else None
