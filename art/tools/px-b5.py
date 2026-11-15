#!/usr/bin/env python3
"""B5 손도트: 특전 아이콘 16x16 12종 + svc-air 24x24 다시 그리기 + wall-phone-ring 20x20. python3 art/tools/px-b5.py [이름...]"""
import sys, math, importlib.util, os
spec = importlib.util.spec_from_file_location('pxb3', os.path.join(os.path.dirname(__file__), 'px-b3.py'))
b3 = importlib.util.module_from_spec(spec); spec.loader.exec_module(b3)
Cv = b3.Cv
spec4 = importlib.util.spec_from_file_location('pxb4', os.path.join(os.path.dirname(__file__), 'px-b4.py'))
b4 = importlib.util.module_from_spec(spec4); spec4.loader.exec_module(b4)
from PIL import Image
ROOT = b3.ROOT

def stamp(c, x0, y0, rows, m):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch in m: c.px(x0 + i, y0 + j, m[ch])

STAR = ["..XX..", "XXXXXX", ".XXXX.", ".XXXX.", "XXX.XX"]

def tap_power():
    c = Cv()
    c.spans({0: (3, 8), 1: (2, 9), 2: (2, 9), 3: (2, 9), 4: (2, 9), 5: (2, 9), 6: (3, 9), 7: (3, 8)}, 'r2')
    c.spans({3: (0, 2), 4: (0, 2), 5: (1, 2), 6: (2, 2)}, 'r2')
    c.rect(2, 1, 4, 2, 'pk'); c.rect(8, 1, 9, 7, 'r1'); c.rect(2, 7, 2, 7, None); c.rect(7, 7, 8, 7, 'r1')
    c.rect(5, 4, 7, 4, 'r1'); c.rect(5, 2, 7, 2, 'r1'); c.rect(5, 2, 5, 2, 'r2')
    c.rect(2, 8, 9, 11, 'b2'); c.rect(2, 8, 9, 8, 'b3'); c.rect(8, 9, 9, 11, 'b1'); c.rect(2, 10, 7, 10, 'b3')
    c.outline(); return c

def crit():
    c = Cv()
    cx, cy = 4.6, 5.6
    d = lambda x, y: math.hypot(x - cx, y - cy)
    c.where(lambda x, y: d(x, y) <= 5.0, 'r2'); c.where(lambda x, y: d(x, y) <= 3.7, 'p1')
    c.where(lambda x, y: d(x, y) <= 2.4, 'r2'); c.where(lambda x, y: d(x, y) <= 1.0, 'p1')
    c.where(lambda x, y: d(x, y) <= 5.0 and x + y >= 12, 'r1')
    c.rect(5, 5, 8, 6, 'k3'); c.rect(5, 5, 8, 5, 'k4')
    c.rect(8, 3, 11, 8, 'b2'); c.rect(8, 3, 11, 3, 'b3'); c.rect(9, 6, 11, 8, 'b1'); c.rect(8, 5, 8, 6, 'k3')
    c.rect(11, 3, 11, 3, None); c.rect(11, 8, 11, 8, None)
    c.outline(); return c

def fever_long():
    c = Cv()
    c.rect(1, 0, 10, 1, 'w2'); c.rect(1, 0, 10, 0, 'g2'); c.rect(1, 1, 10, 1, 'w1')
    c.rect(1, 10, 10, 11, 'w2'); c.rect(1, 10, 10, 10, 'g2'); c.rect(1, 11, 10, 11, 'w1')
    c.spans({2: (2, 9), 3: (2, 9), 4: (3, 8), 5: (3, 8), 6: (5, 6), 7: (3, 8), 8: (3, 8), 9: (2, 9)}, 'b4')
    c.spans({3: (3, 8), 4: (4, 7), 5: (5, 6)}, 'or'); c.spans({3: (3, 8)}, 'g2')
    c.spans({6: (5, 6), 8: (4, 7), 9: (2, 9)}, 'or'); c.spans({7: (5, 6)}, 'or'); c.spans({9: (3, 8)}, 'r2')
    c.outline(); b4.connect(c); return c

def svc_power():
    c = Cv()
    c.rect(3, 1, 8, 6, 'g2'); c.rect(4, 0, 7, 0, 'g2'); c.rect(2, 2, 2, 5, 'g2'); c.rect(9, 2, 9, 5, 'g2')
    c.rect(3, 1, 8, 1, 'g3'); c.rect(4, 0, 5, 0, 'g3'); c.rect(2, 2, 2, 3, 'g3'); c.rect(8, 5, 8, 6, 'g1'); c.rect(9, 3, 9, 5, 'g1'); c.rect(3, 6, 8, 6, 'g1')
    c.rect(5, 3, 6, 4, 'k1')
    c.rect(0, 8, 8, 10, 'k4'); c.rect(0, 8, 8, 8, 'k5'); c.rect(0, 10, 8, 10, 'k3')
    c.rect(7, 7, 11, 11, 'k4'); c.rect(10, 8, 11, 9, None); c.rect(7, 7, 11, 7, 'k5'); c.rect(7, 11, 11, 11, 'k3'); c.rect(11, 10, 11, 11, 'k3')
    c.rect(9, 8, 9, 9, 'k3')
    c.outline(); return c

def offline_rate():
    c = Cv()
    c.rect(2, 0, 9, 5, 'pu'); c.rect(2, 0, 9, 0, 'r2'); c.rect(8, 1, 9, 5, 'r1')
    c.rect(0, 3, 2, 9, 'r2'); c.rect(9, 3, 11, 9, 'r2'); c.rect(0, 3, 0, 9, 'pk'); c.rect(11, 3, 11, 9, 'r1'); c.rect(9, 3, 10, 3, 'pk')
    c.rect(0, 3, 2, 3, 'pk')
    c.rect(2, 6, 9, 9, 'r2'); c.rect(2, 6, 9, 6, 'pk'); c.rect(2, 9, 9, 9, 'r1')
    c.rect(3, 1, 3, 3, 'pu')
    c.rect(1, 10, 2, 11, 'w1'); c.rect(9, 10, 10, 11, 'w1')
    c.outline(); return c

def offline_cap():
    c = Cv()
    c.rect(4, 0, 7, 0, 'k3'); c.rect(4, 1, 4, 2, 'k3'); c.rect(7, 1, 7, 2, 'k3'); c.rect(5, 0, 6, 0, 'k4')
    c.rect(0, 3, 11, 10, 'b2'); c.rect(0, 3, 11, 4, 'b3'); c.rect(10, 5, 11, 10, 'b1'); c.rect(0, 10, 11, 10, 'b1')
    c.rect(2, 3, 2, 10, 'g2'); c.rect(8, 3, 8, 10, 'g2'); c.rect(2, 3, 2, 3, 'g3'); c.rect(8, 3, 8, 3, 'g3')
    c.rect(5, 6, 6, 8, 'g2'); c.rect(5, 6, 6, 6, 'g3'); c.rect(5, 8, 6, 8, 'g1'); c.px(5, 7, 'k1')
    c.rect(2, 11, 3, 11, 'k2'); c.rect(8, 11, 9, 11, 'k2')
    c.outline(); return c

def box_discount():
    c = Cv()
    c.rect(0, 1, 11, 10, 'g2'); c.rect(0, 1, 11, 2, 'g3'); c.rect(0, 9, 11, 10, 'g1')
    c.rect(0, 5, 0, 6, None); c.rect(11, 5, 11, 6, None); c.rect(1, 5, 1, 6, 'g1'); c.rect(10, 5, 10, 6, 'g1')
    c.rect(3, 3, 3, 8, 'g1')
    stamp(c, 5, 3, STAR, {'X': 'r2'})
    c.outline(); return c

def parcel_freq():
    c = Cv()
    c.rect(0, 0, 6, 6, 'w2'); c.rect(0, 0, 6, 1, 'p2'); c.rect(3, 0, 3, 6, 'p1'); c.rect(6, 1, 6, 6, 'w1'); c.rect(0, 6, 6, 6, 'w1')
    c.rect(0, 7, 11, 8, 'k3'); c.rect(0, 7, 6, 7, 'k4')
    c.rect(7, 3, 11, 8, 'r2'); c.rect(7, 3, 8, 3, None); c.rect(7, 3, 9, 3, 'r2'); c.rect(10, 3, 11, 3, None)
    c.rect(9, 4, 11, 5, 'b3'); c.rect(9, 4, 11, 4, 'b4'); c.rect(7, 6, 11, 8, 'r2'); c.rect(7, 8, 11, 8, 'r1'); c.rect(11, 6, 11, 8, 'r1')
    for x0 in (1, 8):
        c.rect(x0, 9, x0 + 2, 11, 'k2'); c.px(x0, 9, None); c.px(x0 + 2, 9, None); c.px(x0, 11, None); c.px(x0 + 2, 11, None)
    c.rect(x0 := 1, 8, 3, 8, 'k3')
    c.outline(); return c

def bundle_boost():
    c = Cv()
    c.rect(0, 1, 4, 6, 'pk'); c.rect(7, 1, 11, 6, 'pk'); c.rect(0, 1, 4, 1, 'pk'); c.rect(0, 6, 4, 6, 'r2'); c.rect(7, 6, 11, 6, 'r2')
    c.rect(1, 2, 3, 5, 'r2'); c.rect(8, 2, 10, 5, 'r2'); c.rect(1, 2, 3, 2, 'pk'); c.rect(8, 2, 10, 2, 'pk')
    c.rect(0, 1, 0, 1, None); c.rect(4, 1, 4, 1, None); c.rect(7, 1, 7, 1, None); c.rect(11, 1, 11, 1, None)
    c.rect(4, 3, 7, 6, 'r1'); c.rect(4, 3, 7, 3, 'r2'); c.rect(4, 3, 4, 3, 'pk')
    c.rect(2, 7, 4, 11, 'pk'); c.rect(7, 7, 9, 11, 'pk'); c.rect(4, 7, 4, 11, 'r2'); c.rect(7, 7, 7, 11, 'r2')
    c.rect(5, 7, 6, 7, 'r1'); c.rect(2, 11, 3, 11, 'r2'); c.rect(8, 11, 9, 11, 'r2')
    c.px(2, 11, None); c.px(9, 11, None); c.rect(2, 10, 2, 10, 'r2'); c.rect(9, 10, 9, 10, 'r2')
    c.outline(); return c

def contract_slot():
    c = Cv()
    c.rect(1, 1, 10, 11, 'w2'); c.rect(1, 1, 1, 11, 'w1'); c.rect(10, 2, 10, 11, 'w1')
    c.rect(2, 3, 9, 10, 'p1'); c.rect(9, 4, 9, 10, 'p2'); c.rect(2, 10, 9, 10, 'p2')
    c.rect(4, 0, 7, 2, 'k3'); c.rect(4, 0, 7, 0, 'k4'); c.rect(5, 1, 6, 1, 'k2')
    stamp(c, 3, 4, ["..XX..", "XXXXXX", ".XXXX.", ".XXXX.", "XX..XX"], {'X': 'g2'})
    c.rect(4, 5, 5, 5, 'g3'); c.rect(6, 8, 7, 8, 'g1'); c.rect(3, 8, 3, 8, 'g1'); c.rect(8, 8, 8, 8, 'g1')
    c.outline(); return c

def penalty_cut():
    c = Cv()
    c.rect(0, 0, 2, 2, 'r2'); c.rect(0, 4, 2, 6, 'r2'); c.rect(0, 0, 2, 0, 'pk'); c.rect(0, 4, 2, 4, 'pk'); c.rect(0, 2, 2, 2, 'r1'); c.rect(0, 6, 2, 6, 'r1')
    c.rect(3, 1, 4, 5, 'k2'); c.rect(3, 3, 4, 3, 'k3')
    c.rect(5, 0, 11, 2, 'k4'); c.rect(5, 0, 11, 0, 'k5'); c.rect(5, 2, 11, 2, 'k3'); c.rect(11, 2, 11, 2, None)
    c.rect(5, 4, 9, 6, 'k4'); c.rect(5, 4, 9, 4, 'k5'); c.rect(5, 6, 9, 6, 'k3'); c.rect(9, 6, 9, 6, None)
    c.rect(0, 8, 11, 11, 'p1'); c.rect(0, 11, 11, 11, 'p2'); c.rect(0, 8, 1, 11, 'p2'); c.rect(10, 8, 11, 11, 'p2')
    c.rect(0, 8, 0, 8, None); c.rect(11, 8, 11, 8, None); c.rect(0, 11, 0, 11, None); c.rect(11, 11, 11, 11, None)
    c.rect(4, 8, 7, 11, 'r2'); c.rect(4, 11, 7, 11, 'r1'); c.rect(5, 9, 6, 9, 'pk')
    c.outline(); return c

def tap_crit_power():
    c = Cv()
    cx, cy = 5.5, 5.5
    def rad(x, y):
        a = math.atan2(y - cy, x - cx)
        return 3.6 + 2.6 * max(0.0, math.cos(4 * a)) ** 0.8
    d = lambda x, y: math.hypot(x - cx, y - cy)
    c.where(lambda x, y: d(x, y) <= rad(x, y), 'or')
    c.where(lambda x, y: d(x, y) <= rad(x, y) * 0.7 and d(x, y) <= 4.4, 'g2')
    c.where(lambda x, y: d(x, y) <= 2.3, 'g3')
    c.where(lambda x, y: d(x, y) <= rad(x, y) and x + y >= 14, 'r2')
    c.rect(5, 5, 6, 6, 'k5')
    c.outline(); return c

def svc_air():
    c = Cv(24, 0)
    c.rect(5, 8, 16, 20, 'k4'); c.rect(5, 8, 16, 9, 'k5'); c.rect(15, 10, 16, 20, 'k3'); c.rect(5, 20, 16, 20, 'k3')
    c.rect(6, 21, 8, 21, 'k2'); c.rect(13, 21, 15, 21, 'k2')
    c.rect(7, 10, 13, 19, 'k2')
    for y in (11, 13, 15, 17):
        c.rect(7, y, 13, y, 'k4')
    c.rect(7, 19, 13, 19, 'k3')
    c.rect(14, 10, 14, 10, 'b2')
    for x0 in (6, 12):
        c.rect(x0, 6, x0 + 1, 7, 'b3'); c.rect(x0 + 1, 4, x0 + 2, 5, 'b3'); c.rect(x0, 2, x0 + 1, 3, 'b3')
    c.outline(); return c

def wall_phone_ring():
    src = Image.open(f'{ROOT}/public/assets/px/ui/wall-phone.png').convert('RGBA')
    c = Cv(20, 0)
    for y in range(20):
        for x in range(20):
            p = src.getpixel((x, y))
            if p[3]: c.p[y][x] = p
    P = lambda n: b3.C(n)
    old = [[c.p[y][x] for x in range(5, 10)] for y in range(20)]
    for y in range(2, 15):
        for i, x in enumerate(range(5, 10)): c.p[y][x] = old[y + 1][i]
    for x in range(5, 10): c.p[15][x] = P('p1')
    c.p[15][5] = P('p1')
    for y in range(2, 15):
        for x in range(5, 10):
            if c.p[y][x] is None: c.p[y][x] = P('p1')
    for x0 in (2, 17):
        for ya, yb in ((3, 4), (7, 10), (13, 14)):
            for y in range(ya, yb + 1): c.p[y][x0] = P('g2')
    c.outline()
    for y in range(20):
        for x in range(20):
            if c.p[y][x] and src.getpixel((x, y))[3] == 0 and c.p[y][x] != P('k1') and x not in (2, 17): c.p[y][x] = None
    c.outline(); return c

ALL = {f'icon/perk-{n}': f for n, f in (('tap_power', tap_power), ('crit', crit), ('fever_long', fever_long), ('svc_power', svc_power),
       ('offline_rate', offline_rate), ('offline_cap', offline_cap), ('box_discount', box_discount), ('parcel_freq', parcel_freq),
       ('bundle_boost', bundle_boost), ('contract_slot', contract_slot), ('penalty_cut', penalty_cut), ('tap_crit_power', tap_crit_power))}
ALL['icon/svc-air'] = svc_air
ALL['ui/wall-phone-ring'] = wall_phone_ring
if __name__ == '__main__':
    for k in (sys.argv[1:] or ALL): ALL[k]().save(k); print(k)
