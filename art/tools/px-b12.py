#!/usr/bin/env python3
"""B12 손도트: icon/box-open, icon/bundle (16x16), icon/house-moon (24x24). python3 art/tools/px-b12.py [이름...]"""
import sys, os, json, math
from PIL import Image
R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PAL = {k: tuple(int(v.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)) for k, v in json.load(open(R + '/art/pixel/palette.json')).items()}

class C:
    def __init__(s, n, off):
        s.n, s.off = n, off; s.p = {}
    def px(s, x, y, c):
        s.p[(x + s.off, y + s.off)] = c
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.px(x, y, c)
    def spans(s, d, c):
        for y, (a, b) in d.items(): s.rect(a, y, b, y, c)
    def outline(s):
        q = dict(s.p)
        for y in range(s.n):
            for x in range(s.n):
                if (x, y) not in s.p and any(s.p.get((x + dx, y + dy)) not in (None, 'k1') for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    q[(x, y)] = 'k1'
        s.p = q
    def save(s, key):
        im = Image.new('RGBA', (s.n, s.n), (0, 0, 0, 0))
        for (x, y), c in s.p.items():
            if 0 <= x < s.n and 0 <= y < s.n: im.putpixel((x, y), PAL[c] + (255,))
        im.save(f'{R}/public/assets/px/{key}.png')

def grid(c, rows, leg):
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.': c.px(x, y, leg[ch])

def box_open():
    c = C(16, 2)
    rows = [
        '............',
        '....GGGG....',
        'pp..GYYGwwpp',
        'ppp.GGGGwwwd',
        '.ppwccccwwd.',
        '..wdddddddd.',
        '.hhhhRrRhhdd',
        '.hhhhRrRhhdd',
        '.hhhhRrRhhdd',
        '.hhhhhhhhhdd',
        '.hhhhhhhhhdd',
        '.dddddddddd.',
    ]
    leg = dict(y='g3', G='g2', Y='g3', h='w2', w='w2', p='p2', d='w1', R='r1', r='r2')
    leg['c'] = 'g1'
    grid(c, rows, leg)
    c.outline(); return c

def bundle():
    c = C(16, 2)
    ids = {}
    def ring(x0, y0, x1, y1, rid, pal, rows=None):
        for y in range(y0, y1 + 1):
            if rows and y not in rows: continue
            for x in range(x0, x1 + 1):
                if (x in (x0, x1)) and (y in (y0, y1)): continue
                inner = x0 + 2 <= x <= x1 - 2 and y0 + 2 <= y <= y1 - 2
                if inner: continue
                col = pal[0] if (y == y0 or x == x0) else pal[2] if (y == y1 or x == x1) else pal[1]
                if (x in (x0 + 1, x1 - 1)) and (y in (y0 + 1, y1 - 1)): col = pal[1]
                c.px(x, y, col); ids[(x + 2, y + 2)] = rid
    A = ('b3', 'b2', 'b1'); B = ('g3', 'g2', 'g1')
    ring(0, 0, 7, 7, 'A', A)
    ring(4, 3, 11, 10, 'B', B)
    # A가 B 아래쪽 띠 위로 지나가도록 아래쪽 겹침만 A로 덮기
    ring(0, 0, 7, 7, 'A', A, rows=range(5, 8))
    q = dict(c.p)
    for (x, y), i in ids.items():
        nb = [ids.get((x + dx, y + dy)) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
        over = 'A' if y - 2 >= 5 else 'B'
        if i != over and over in nb and i in ('A', 'B') and (x, y) in ids:
            if 4 + 2 <= x <= 7 + 2 + 0 or True:
                if 6 <= x <= 9 and 4 <= y <= 12: q[(x, y)] = 'k1'
    c.p = q
    c.outline()
    for (x, y), col in list(c.p.items()):
        nb = [c.p.get((x + dx, y + dy)) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
        if col != 'k1' and col not in nb:
            c.p[(x, y)] = max((n for n in nb if n and n != 'k1'), key=nb.count)
    return c

def house_moon():
    c = C(24, 2)
    # 달 지면
    for y in range(15, 20):
        for x in range(20):
            if math.hypot((x - 9.5) / 10.4, (y - 20) / 5.6) <= 1.0: c.px(x, y, 'k3')
    c.spans({15: (4, 15)}, 'k4')
    c.rect(1, 18, 3, 18, 'k2'); c.rect(15, 17, 17, 17, 'k2'); c.rect(8, 19, 10, 19, 'k2')
    # 집
    c.spans({4: (7, 10), 5: (7, 10), 6: (5, 12), 7: (5, 12), 8: (3, 14)}, 'k3')
    c.spans({4: (7, 8), 5: (7, 8), 6: (5, 7), 7: (5, 7), 8: (3, 5)}, 'k4')
    c.spans({4: (10, 10), 5: (10, 10), 6: (11, 12), 7: (11, 12), 8: (13, 14)}, 'k2')
    c.rect(2, 9, 15, 9, 'k2')
    c.rect(3, 10, 14, 16, 'p1'); c.rect(11, 10, 14, 16, 'k4')
    c.rect(3, 16, 14, 16, 'k3')
    c.rect(5, 12, 7, 16, 'k2'); c.rect(5, 12, 5, 16, 'k1'); c.px(7, 14, 'g2'); c.px(7, 15, 'g2')
    c.rect(9, 11, 12, 14, 'k2'); c.rect(10, 12, 11, 13, 'b3'); c.px(10, 12, 'b4'); c.px(11, 12, 'b4')
    # 안테나
    c.rect(16, 3, 17, 9, 'k3'); c.rect(16, 1, 17, 2, 'r2')
    # 지구
    for y in range(6):
        for x in range(6):
            if math.hypot(x - 2.5, y - 2.5) <= 2.9: c.px(x, y, 'b3')
    c.rect(1, 1, 2, 1, 'b4'); c.rect(2, 2, 3, 3, 'gn'); c.rect(3, 4, 4, 4, 'gn')
    c.outline(); return c

ALL = {'icon/box-open': box_open, 'icon/bundle': bundle, 'icon/house-moon': house_moon}
if __name__ == '__main__':
    for k in (sys.argv[1:] or ALL):
        ALL[k]().save(k); print(k)
