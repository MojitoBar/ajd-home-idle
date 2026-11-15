#!/usr/bin/env python3
"""B9 손도트: 집 단계 아이콘 24x24 9장 + col/fridge 32x32. python3 art/tools/px-b9.py [이름...]"""
import sys, math, importlib.util, os
spec = importlib.util.spec_from_file_location('pxb3', os.path.join(os.path.dirname(__file__), 'px-b3.py'))
b3 = importlib.util.module_from_spec(spec); spec.loader.exec_module(b3)
Cv = b3.Cv
def H(): return Cv(24, 0)

def win(c, x, y, w, h, fr, gl):
    c.rect(x, y, x + w - 1, y + h - 1, fr); c.rect(x + 1, y + 1, x + w - 2, y + h - 2, gl)

def blue():
    c = H()
    c.spans({5: (6, 11), 6: (5, 12), 7: (4, 13), 8: (3, 14), 9: (2, 15), 10: (1, 16)}, 'b2')
    c.spans({5: (6, 8), 6: (5, 7), 7: (4, 6), 8: (3, 5), 9: (2, 4)}, 'b3')
    c.rect(1, 10, 16, 10, 'b1')
    c.rect(3, 11, 14, 21, 'p1'); c.rect(15, 11, 17, 21, 'p2')
    c.rect(5, 15, 8, 21, 'w2'); c.rect(5, 15, 5, 21, 'w1'); c.px(8, 18, 'g2')
    win(c, 11, 13, 4, 4, 'b1', 'b3')
    c.rect(1, 18, 2, 21, 'gn')
    c.outline(); return c

def mint():
    c = H()
    c.spans({5: (5, 11), 6: (4, 12), 7: (3, 13), 8: (2, 14), 9: (1, 15)}, 'w2')
    c.spans({5: (5, 7), 6: (4, 6), 7: (3, 5), 8: (2, 4), 9: (1, 3)}, 'g2')
    c.rect(1, 9, 15, 9, 'w1')
    c.rect(2, 10, 14, 21, 'k4'); c.rect(2, 10, 14, 11, 'k3'); c.rect(2, 10, 14, 10, 'k4')
    c.rect(2, 17, 14, 21, 'gn') ; c.rect(2, 17, 14, 17, 'k3')
    win(c, 3, 11, 4, 5, 'k1', 'b3'); win(c, 9, 11, 4, 5, 'k1', 'b3')
    c.rect(7, 18, 8, 21, 'w2')
    c.disc(18, 9, 3.4, 'gn'); c.rect(18, 12, 18, 21, 'w1'); c.rect(19, 12, 19, 21, 'w2'); c.rect(17, 12, 17, 12, 'gn')
    c.where(lambda x, y: math.hypot(x - 17, y - 8) <= 1.6, 'gn')
    c.outline(); return c

def sunset():
    c = H()
    c.rect(4, 2, 16, 21, 'w2'); c.rect(17, 3, 19, 21, 'w1')
    c.rect(4, 2, 16, 3, 'r1'); c.rect(17, 3, 19, 3, 'k1')
    c.rect(4, 2, 16, 2, 'pu')
    for y in (5, 9, 13, 17):
        for x in (6, 10, 14):
            c.rect(x, y, x + 1, y + 2, 'g3' if (x + y) % 8 else 'g2')
    c.rect(9, 19, 11, 21, 'w1'); c.rect(10, 19, 10, 21, 'g1')
    c.rect(17, 5, 17, 20, 'w2') if False else None
    for y in (6, 10, 14):
        c.rect(18, y, 18, y + 1, 'g1')
    c.outline(); return c

def night():
    c = H()
    c.rect(5, 6, 16, 21, 'k2'); c.rect(17, 6, 19, 21, 'k1')
    c.rect(3, 4, 18, 5, 'k3'); c.rect(3, 4, 18, 4, 'k4')
    for x in (3, 7, 12, 17): c.rect(x, 2, x + 1, 3, 'gn')
    c.rect(5, 2, 6, 3, 'gn'); c.rect(9, 1, 10, 3, 'gn'); c.rect(14, 2, 15, 3, 'gn')
    for y in (7, 11, 15, 19):
        c.rect(6, y, 15, y + 2, 'b3'); c.rect(10, y, 10, y + 2, 'k2')
        c.rect(6, y, 8, y, 'b4')
    c.rect(18, 8, 18, 9, 'g2'); c.rect(18, 14, 18, 15, 'g2')
    c.rect(4, 6, 4, 21, 'k3') if False else None
    c.outline(); return c

def moon():
    c = H()
    c.rect(1, 18, 21, 21, 'k3'); c.rect(1, 18, 21, 18, 'k4')
    c.rect(15, 20, 17, 21, 'k2'); c.rect(4, 20, 5, 20, 'k2')
    c.where(lambda x, y: y <= 18 and math.hypot(x - 11, y - 18) <= 8.6, 'k4')
    c.where(lambda x, y: y <= 18 and math.hypot(x - 11, y - 18) <= 8.6 and x >= 13 and y > 12, 'k3')
    c.where(lambda x, y: y <= 18 and math.hypot(x - 11, y - 18) <= 8.6 and x <= 8 and y < 14 and math.hypot(x - 11, y - 18) > 6, 'k5')
    c.rect(8, 14, 13, 18, 'k2'); c.rect(9, 15, 12, 18, 'b3'); c.rect(9, 15, 10, 15, 'b4')
    c.rect(18, 4, 18, 13, 'k3'); c.rect(17, 12, 19, 13, 'k3'); c.rect(18, 4, 18, 4, 'r2'); c.rect(17, 5, 17, 5, 'r2')
    c.rect(20, 8, 20, 8, 'k5') if False else None
    c.rect(3, 12, 4, 12, 'k4') if False else None
    c.outline(); return c

def mars():
    c = H()
    c.where(lambda x, y: y >= 18 and math.hypot((x - 11) / 14.0, (y - 24) / 6.5) <= 1.0, 'r2')
    c.rect(1, 20, 21, 21, 'r2'); c.rect(1, 21, 21, 21, 'r1')
    c.rect(2, 19, 4, 19, 'r1'); c.rect(17, 18, 19, 18, 'r1'); c.rect(11, 20, 13, 20, 'r1')
    def dome(cx, base, r, win):
        f = lambda x, y: y <= base and math.hypot(x - cx, y - base) <= r
        c.where(f, 'k4')
        c.where(lambda x, y: f(x, y) and x > cx + r * 0.35, 'k3')
        ri = int(r); c.rect(cx - ri, base + 1, cx + ri, base + 1, 'k2')
        if win: c.rect(cx - 2, base - 3, cx - 1, base, 'b3'); c.rect(cx + 1, base - 3, cx + 2, base, 'b3'); c.px(cx - 2, base - 3, 'b4')
    dome(13, 18, 6.5, True)
    dome(3, 18, 3.4, False); dome(21, 19, 2.6, False)
    c.rect(16, 12, 16, 12, 'or') if False else None
    c.rect(13, 6, 13, 10, 'k3'); c.px(13, 5, 'or')
    c.outline(); return c

def jupiter():
    c = H()
    cx, cy, r = 11.5, 14.5, 7.6
    inside = lambda x, y: math.hypot(x - cx, y - cy) <= r
    cols = ['or', 'p1', 'p1', 'w2', 'r1', 'r1', 'or', 'or', 'p1', 'w2', 'w2', 'or', 'r1', 'w2', 'w2', 'w2']
    for y in range(7, 22):
        c.where(lambda x, yy, y=y: yy == y and inside(x, yy), cols[y - 7])
    c.rect(15, 14, 17, 15, 'r2')
    c.rect(1, 3, 4, 6, 'b2'); c.rect(1, 3, 4, 3, 'b3'); c.rect(2, 4, 2, 5, 'b1')
    c.rect(19, 3, 22, 6, 'b2'); c.rect(19, 3, 22, 3, 'b3'); c.rect(21, 4, 21, 5, 'b1')
    c.rect(5, 4, 18, 5, 'k3'); c.rect(5, 4, 18, 4, 'k4')
    c.rect(8, 2, 15, 5, 'k4'); c.rect(8, 2, 15, 2, 'k5'); c.rect(8, 5, 15, 5, 'k3'); c.rect(10, 3, 13, 3, 'b3')
    c.rect(11, 1, 12, 1, 'r2')
    c.outline(); return c

def nebula():
    c = H()
    c.where(lambda x, y: y >= 13 and (math.hypot((x - 11) / 11.0, (y - 18) / 5.2) <= 1.0 or math.hypot((x - 5) / 5.0, (y - 16) / 4.0) <= 1.0 or math.hypot((x - 17) / 5.0, (y - 17) / 4.5) <= 1.0), 'pu')
    c.rect(3, 19, 7, 21, 'pk'); c.rect(16, 18, 20, 20, 'pk'); c.rect(9, 20, 14, 21, 'pk')
    c.rect(5, 15, 6, 16, 'pk')
    # 수정탑
    c.spans({2: (11, 12), 3: (10, 13), 4: (10, 13), 5: (9, 14), 6: (9, 14), 7: (9, 14), 8: (9, 14), 9: (9, 14), 10: (9, 14), 11: (9, 14), 12: (9, 14), 13: (9, 14), 14: (10, 13)}, 'b3')
    c.spans({3: (10, 11), 4: (10, 11), 5: (9, 11), 6: (9, 10), 7: (9, 10), 8: (9, 10), 9: (9, 10), 10: (9, 10), 11: (9, 10), 12: (9, 10)}, 'b4')
    c.rect(13, 5, 14, 13, 'b2'); c.rect(14, 8, 14, 13, 'b1')
    c.spans({6: (3, 4), 7: (3, 4), 8: (2, 5), 9: (2, 5), 10: (2, 5), 11: (3, 4)}, 'pk')
    c.rect(3, 7, 3, 9, 'k5')
    c.spans({9: (18, 19), 10: (18, 19), 11: (17, 20), 12: (17, 20), 13: (17, 20), 14: (18, 19)}, 'b3')
    c.rect(18, 10, 18, 12, 'b4')
    c.outline(); return c

def edge():
    c = H()
    c.rect(1, 18, 22, 21, 'b2') if False else None
    c.rect(2, 17, 21, 21, 'b1'); c.rect(2, 17, 21, 17, 'b3')
    for x, y in ((4, 19), (10, 21), (15, 19), (19, 21)): c.px(x, y, 'k5')
    def tower(x0, x1, top, col='g2', lit=True):
        c.rect(x0, top, x1, 16, col); c.rect(x0, top, x0, 16, 'g3'); c.rect(x1, top, x1, 16, 'g1')
        if lit:
            for y in range(top + 2, 16, 3):
                c.rect(x0 + 1, y, x1 - 1, y, 'g0') if x1 - x0 >= 3 else None
    tower(2, 5, 11); tower(6, 9, 8); tower(14, 17, 7); tower(18, 21, 12)
    c.rect(10, 5, 13, 16, 'g3'); c.rect(10, 5, 10, 16, 'g3'); c.rect(12, 5, 13, 16, 'g2'); c.rect(13, 5, 13, 16, 'g1')
    c.rect(10, 5, 11, 16, 'g3'); c.rect(12, 5, 12, 16, 'g2')
    for y in (8, 11, 14): c.rect(10, y, 13, y, 'g1')
    c.rect(11, 3, 12, 4, 'g2'); c.rect(11, 1, 12, 2, 'g3')
    c.rect(7, 6, 8, 7, 'g2'); c.rect(15, 5, 16, 6, 'g3')
    c.outline(); return c

def fridge():
    c = Cv(32, 0)
    # Cv 여백 2 제한을 피해 직접 그린다
    p = [[None] * 32 for _ in range(32)]
    def R(x0, y0, x1, y1, col):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): p[y][x] = b3.C(col)
    R(7, 2, 25, 28, 'k4')
    R(21, 2, 25, 28, 'k3'); R(21, 2, 21, 28, 'k2')
    R(7, 2, 20, 2, 'k5'); R(7, 2, 7, 27, 'k5')
    R(7, 13, 25, 13, 'k2')
    R(7, 14, 20, 14, 'k3')
    R(9, 4, 14, 8, 'b1'); R(10, 5, 13, 7, 'b3'); R(10, 5, 11, 5, 'b4')
    R(17, 4, 18, 11, 'k2'); R(17, 4, 17, 11, 'k3')
    R(17, 16, 18, 24, 'k2'); R(17, 16, 17, 24, 'k3')
    R(7, 27, 20, 28, 'k3'); R(21, 27, 25, 28, 'k2')
    R(8, 29, 10, 29, 'k2'); R(22, 29, 24, 29, 'k2')
    # 외곽선
    q = [r[:] for r in p]
    k1 = b3.C('k1')
    for y in range(32):
        for x in range(32):
            if p[y][x] is None:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < 32 and 0 <= ny < 32 and p[ny][nx] is not None:
                        q[y][x] = k1; break
    c.p = q; c.n = 32
    return c

ALL = {'icon/house-blue': blue, 'icon/house-mint': mint, 'icon/house-sunset': sunset, 'icon/house-night': night,
       'icon/house-moon': moon, 'icon/house-mars': mars, 'icon/house-jupiter': jupiter, 'icon/house-nebula': nebula,
       'icon/house-edge': edge, 'col/fridge': fridge}

if __name__ == '__main__':
    for k in (sys.argv[1:] or ALL):
        ALL[k]().save(k); print(k)
