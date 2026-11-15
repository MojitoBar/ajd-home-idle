#!/usr/bin/env python3
"""B4 손도트: 화면·결합 아이콘 16x16, 사은품 상자 40x40, 커터칼 24x24. python3 art/tools/px-b4.py [이름...]"""
import sys, math, importlib.util, os
spec = importlib.util.spec_from_file_location('pxb3', os.path.join(os.path.dirname(__file__), 'px-b3.py'))
b3 = importlib.util.module_from_spec(spec); spec.loader.exec_module(b3)
Cv = b3.Cv

def settings():
    c = Cv()
    for r in ((4, 0, 7, 1), (4, 10, 7, 11), (0, 4, 1, 7), (10, 4, 11, 7), (1, 1, 2, 2), (9, 1, 10, 2), (1, 9, 2, 10), (9, 9, 10, 10)):
        c.rect(*r, 'k4')
    c.where(lambda x, y: math.hypot(x - 5.5, y - 5.5) <= 4.7, 'k4')
    c.where(lambda x, y: x + y >= 13 and (c.p[y + 2][x + 2] is not None), 'k3')
    c.rect(4, 1, 6, 1, 'k5'); c.rect(1, 4, 1, 6, 'k5'); c.rect(3, 3, 4, 3, 'k5'); c.rect(3, 3, 3, 4, 'k5')
    c.where(lambda x, y: math.hypot(x - 5.5, y - 5.5) <= 1.9, 'k1')
    c.outline(); return c

def dex():
    c = Cv()
    c.rect(0, 0, 10, 10, 'b2'); c.rect(0, 0, 10, 0, 'b3'); c.rect(0, 0, 1, 10, 'b1'); c.rect(1, 0, 1, 0, 'b3')
    c.rect(2, 0, 2, 10, 'b3'); c.rect(2, 1, 2, 10, 'b3')
    c.rect(1, 0, 10, 0, 'b3'); c.rect(0, 0, 0, 0, None)
    c.rect(10, 1, 11, 11, 'p2'); c.rect(1, 11, 11, 11, 'p2'); c.rect(11, 1, 11, 11, 'p1'); c.rect(1, 11, 10, 11, 'p1')
    c.rect(10, 1, 10, 10, 'p2')
    c.rect(4, 3, 9, 7, 'g2'); c.rect(4, 3, 9, 3, 'g3'); c.rect(4, 7, 9, 7, 'g1'); c.rect(9, 3, 9, 7, 'g1')
    c.rect(5, 4, 6, 5, 'g3')
    c.outline(); return c

def rocket():
    c = Cv()
    c.spans({0: (5, 6), 1: (3, 8), 2: (3, 8)}, 'r2'); c.rect(3, 1, 3, 2, 'r1'); c.rect(8, 1, 8, 2, 'r1')
    c.spans({y: (3, 8) for y in range(3, 9)}, 'k4'); c.rect(7, 3, 8, 8, 'k3'); c.rect(3, 3, 3, 8, 'k5')
    c.rect(4, 4, 6, 6, 'b3'); c.rect(4, 6, 6, 6, 'b2'); c.rect(4, 4, 4, 5, 'b4')
    c.spans({6: (1, 2), 7: (1, 2), 8: (0, 2), 9: (0, 2)}, 'r2'); c.spans({6: (9, 10), 7: (9, 10), 8: (9, 11), 9: (9, 11)}, 'r2')
    c.rect(3, 9, 8, 9, 'k2')
    c.rect(4, 10, 7, 11, 'or'); c.rect(5, 10, 6, 11, 'g2')
    c.outline(); return c

def event():
    c = Cv()
    sp = {0: (8, 9), 1: (6, 9), 2: (5, 9), 3: (4, 9), 4: (0, 9), 5: (0, 9), 6: (0, 9), 7: (0, 9), 8: (4, 9), 9: (5, 9), 10: (6, 9), 11: (8, 9)}
    c.spans(sp, 'r2')
    c.spans({0: (8, 9), 1: (6, 9), 2: (5, 9), 3: (4, 9)}, 'or'); c.rect(4, 3, 9, 3, 'or')
    c.spans({8: (4, 9), 9: (5, 9), 10: (6, 9), 11: (8, 9)}, 'r1'); c.rect(0, 7, 3, 7, 'r1')
    c.rect(0, 4, 3, 7, 'k3'); c.rect(0, 4, 3, 4, 'k4'); c.rect(0, 7, 3, 7, 'k2')
    c.rect(10, 0, 11, 11, 'k4'); c.rect(11, 0, 11, 11, 'k3'); c.rect(10, 0, 10, 1, 'k5')
    c.rect(10, 0, 11, 0, None); c.rect(10, 11, 11, 11, None)
    c.rect(2, 8, 3, 11, 'k2'); c.rect(2, 8, 2, 11, 'k3')
    c.outline(); return c

def move():
    c = Cv()
    c.rect(0, 0, 7, 7, 'b3'); c.rect(0, 0, 7, 0, 'b4'); c.rect(7, 1, 7, 7, 'b2'); c.rect(0, 6, 6, 7, 'b2')
    c.rect(3, 2, 5, 4, 'g2'); c.rect(3, 2, 5, 2, 'g3'); c.rect(3, 4, 5, 4, 'g1')
    c.rect(8, 2, 11, 7, 'r2'); c.rect(11, 2, 11, 2, None); c.rect(8, 2, 10, 2, 'r2'); c.rect(11, 3, 11, 7, 'r1')
    c.rect(9, 3, 10, 4, 'b4'); c.rect(9, 4, 10, 4, 'b3')
    c.rect(0, 8, 11, 8, 'k2')
    for x0 in (1, 8):
        c.spans({8: (x0, x0 + 3), 9: (x0, x0 + 3), 10: (x0, x0 + 3), 11: (x0 + 1, x0 + 2)}, 'k2'); c.rect(x0 + 1, 9, x0 + 2, 10, 'k4')
    c.rect(11, 7, 11, 7, 'g2')
    c.outline(); return c

def connect(c):
    """1칸 계단 윤곽이 고립 도트가 되지 않게 4방향으로 이어 준다(윤곽 k1 한 칸 보탬)"""
    K1 = b3.C('k1'); n = c.n
    for _ in range(2):
        for y in range(n):
            for x in range(n):
                if c.p[y][x] != K1: continue
                if any(0 <= x + dx < n and 0 <= y + dy < n and c.p[y + dy][x + dx] == K1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): continue
                for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 1 <= nx < n - 1 and 1 <= ny < n - 1 and c.p[ny][nx] is None and any(
                            0 <= nx + ex < n and 0 <= ny + ey < n and (nx + ex, ny + ey) != (x, y) and c.p[ny + ey][nx + ex] == K1
                            for ex, ey in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1))):
                        c.p[ny][nx] = K1; break

def comm():
    c = Cv()
    cx, cy, r = 4.6, 6.0, 5.3
    inside = lambda x, y: math.hypot(x - cx, y - cy) <= r and x - y <= 3
    c.where(inside, 'k4')
    c.where(lambda x, y: inside(x, y) and x + y >= 10, 'k3')
    c.where(lambda x, y: inside(x, y) and 0 <= x - y <= 3 and math.hypot(x - cx, y - cy) <= r - 1.2, 'b3')
    c.where(lambda x, y: inside(x, y) and 1 <= x - y <= 3 and x + y >= 9, 'b2')
    c.where(lambda x, y: inside(x, y) and 0 <= x - y <= 1 and x + y <= 8, 'b4')
    c.rect(5, 3, 6, 4, 'k2'); c.rect(7, 1, 8, 2, 'k2')
    c.rect(9, 0, 11, 1, 'g2'); c.rect(9, 0, 11, 0, 'g3'); c.rect(11, 1, 11, 1, 'g1')
    c.rect(4, 10, 5, 10, 'k2'); c.rect(2, 11, 8, 11, 'k3')
    c.outline(); connect(c); return c

def thrifty():
    c = Cv()
    c.spans({6: (0, 11), 7: (0, 11), 8: (1, 10), 9: (1, 10), 10: (1, 10), 11: (1, 10)}, 'w2')
    c.rect(0, 6, 11, 6, 'p2'); c.rect(1, 8, 10, 8, 'w1'); c.rect(1, 10, 10, 10, 'w1')
    c.rect(9, 7, 11, 7, 'w1'); c.rect(8, 9, 10, 9, 'w1'); c.rect(1, 11, 10, 11, 'w1')
    for cx, cy, r, col, sh in ((3.5, 4.0, 2.5, 'r2', 'r1'), (8.0, 3.2, 2.4, 'or', 'g1')):
        c.where(lambda x, y, cx=cx, cy=cy, r=r: math.hypot(x - cx, y - cy) <= r, col)
        c.where(lambda x, y, cx=cx, cy=cy, r=r: math.hypot(x - cx, y - cy) <= r and x + y >= cx + cy + 2.5, sh)
    c.rect(2, 3, 2, 4, 'k5'); c.rect(7, 2, 7, 3, 'k5')
    c.rect(4, 0, 5, 1, 'gn'); c.rect(3, 1, 3, 1, 'gn')
    c.outline(); return c

def rental():
    c = Cv()
    c.rect(0, 3, 11, 5, 'p2'); c.rect(0, 3, 11, 3, 'p1'); c.rect(9, 3, 11, 5, 'w2')
    c.rect(0, 6, 8, 11, 'w2'); c.rect(9, 6, 11, 11, 'w1'); c.rect(0, 6, 8, 6, 'w2'); c.rect(0, 11, 8, 11, 'w1')
    c.rect(5, 3, 6, 11, 'r2'); c.rect(5, 3, 5, 11, 'r2'); c.rect(6, 3, 6, 11, 'r1')
    c.rect(1, 8, 3, 9, 'b2'); c.rect(1, 8, 3, 8, 'b3')
    c.rect(2, 0, 4, 2, 'r2'); c.rect(7, 0, 9, 2, 'r2'); c.rect(3, 1, 3, 1, None); c.rect(8, 1, 8, 1, None)
    c.rect(2, 2, 4, 2, 'r1'); c.rect(7, 2, 9, 2, 'r1'); c.rect(5, 1, 6, 3, 'r1'); c.rect(5, 1, 5, 1, 'r2')
    c.outline(); return c

def chores():
    c = Cv()
    c.spans({4: (3, 11), 5: (3, 11), 6: (4, 11), 7: (4, 11), 8: (4, 10), 9: (5, 10), 10: (5, 10), 11: (5, 10)}, 'b2')
    c.rect(3, 4, 11, 4, 'b4'); c.rect(4, 5, 4, 8, 'b3'); c.rect(10, 6, 11, 10, 'b1'); c.rect(5, 6, 5, 10, 'b3')
    c.rect(1, 1, 7, 5, 'g2'); c.rect(1, 1, 7, 1, 'g3'); c.rect(1, 5, 7, 5, 'g1'); c.rect(7, 1, 7, 5, 'g1')
    c.rect(1, 1, 2, 3, 'g3'); c.rect(1, 1, 1, 1, 'g3')
    c.outline(); return c

def newhome():
    c = Cv()
    c.where(lambda x, y: math.hypot(x - 5.5, y - 2.5) <= 3.3 and y <= 5, 'g2')
    c.where(lambda x, y: math.hypot(x - 5.5, y - 2.5) <= 3.3 and y <= 5 and (x - 5.5) + (y - 2.5) >= 1.5, 'g1')
    c.rect(3, 0, 5, 0, 'g3'); c.rect(3, 1, 3, 1, 'g3')
    c.where(lambda x, y: math.hypot(x - 5.5, y - 2.5) <= 1.3, None)
    c.rect(5, 5, 6, 11, 'g2'); c.rect(5, 5, 5, 11, 'g3'); c.rect(6, 5, 6, 11, 'g1')
    c.rect(7, 9, 9, 10, 'g2'); c.rect(7, 9, 8, 9, 'g3'); c.rect(7, 11, 8, 11, 'g1')
    c.rect(2, 6, 4, 7, 'r2'); c.rect(7, 6, 9, 7, 'r2'); c.rect(3, 7, 4, 7, 'r1'); c.rect(7, 7, 8, 7, 'r1')
    c.rect(5, 6, 6, 8, 'r1'); c.rect(5, 6, 5, 6, 'r2')
    c.rect(3, 8, 4, 11, 'r2'); c.rect(3, 8, 3, 11, 'r2'); c.rect(4, 9, 4, 11, 'r1')
    c.outline(); return c

def cutter():
    c = Cv(24, 0)
    c.rect(9, 9, 21, 14, 'g2'); c.rect(9, 9, 21, 9, 'g3'); c.rect(9, 13, 21, 14, 'g1'); c.rect(20, 10, 21, 14, 'g1')
    c.rect(9, 9, 9, 14, 'k2')
    c.rect(12, 11, 18, 11, 'g0'); c.rect(13, 9, 16, 10, 'k2'); c.rect(13, 9, 16, 9, 'k3')
    c.spans({9: (2, 8), 10: (3, 8), 11: (4, 8), 12: (5, 8), 13: (6, 8), 14: (7, 8)}, 'k4')
    c.rect(2, 9, 8, 9, 'k5'); c.rect(5, 10, 5, 11, 'k3'); c.rect(7, 10, 7, 12, 'k3'); c.rect(7, 13, 8, 14, 'k3')
    c.outline(); return c

def gift(opened):
    c = Cv(40, 0)
    fx0, fx1 = 10, 33
    rx = (fx0 + fx1) // 2 - 1
    for x in range(fx1 + 1, fx1 + 7):          # 옆면
        k = x - fx1; c.rect(x, 19 - k, x, 38 - k, 'b1')
    c.rect(fx0 + 1, 25, fx1, 38, 'b2'); c.rect(fx0 + 1, 25, fx0 + 2, 38, 'b3')
    c.rect(rx, 19, rx + 3, 38, 'g2'); c.rect(rx, 19, rx, 38, 'g3'); c.rect(rx + 3, 19, rx + 3, 38, 'g1')
    if not opened:
        c.rect(fx0 + 1, 25, fx1, 25, 'b1')
        c.rect(fx0, 19, fx1, 24, 'b3'); c.rect(fx0, 19, fx1, 19, 'b4'); c.rect(fx0, 24, fx1, 24, 'b2')
        for k in range(6): c.rect(fx1 + 1 + k, 19 - k, fx1 + 1 + k, 24 - k, 'b2')
        for y in range(12, 19):
            d = 18 - y
            c.rect(fx0 + d, y, fx1 + d, y, 'b4' if y < 14 else 'b3')
            c.rect(rx + d, y, rx + 3 + d, y, 'g2'); c.rect(rx + d, y, rx + d, y, 'g3'); c.rect(rx + 3 + d, y, rx + 3 + d, y, 'g1')
        bx = rx + 3
        for x0 in (bx - 8, bx + 5):
            c.rect(x0, 6, x0 + 5, 11, 'g2'); c.rect(x0, 6, x0 + 5, 6, 'g3'); c.rect(x0, 11, x0 + 5, 11, 'g1')
            c.rect(x0 + 1, 8, x0 + 4, 9, 'g1')
        c.rect(bx - 3, 7, bx + 3, 11, 'g1'); c.rect(bx - 2, 7, bx + 2, 7, 'g2'); c.rect(bx - 2, 8, bx - 1, 9, 'g2')
    else:
        c.rect(fx0, 19, fx1, 19, 'b4'); c.rect(fx0, 20, fx1, 20, 'b3'); c.rect(fx0 + 1, 21, fx1, 24, 'b2')
        c.rect(rx, 19, rx + 3, 38, 'g2'); c.rect(rx, 19, rx, 38, 'g3'); c.rect(rx + 3, 19, rx + 3, 38, 'g1')
        for y in range(12, 19):
            d = 18 - y
            c.rect(fx0 + d, y, fx1 + d, y, 'b3')
            if y >= 13: c.rect(fx0 + d + 1, y, fx1 + d - 1, y, 'b1' if y < 16 else 'k1')
        mid = rx + 4
        for y, (a, b2) in {14: (-2, 3), 15: (-4, 5), 16: (-5, 6), 17: (-5, 6), 18: (-5, 6)}.items():
            c.rect(mid + a, y, mid + b2, y, 'g2'); c.rect(mid + a, y, mid + a + 1, y, 'g3'); c.rect(mid + b2 - 1, y, mid + b2, y, 'g1')
        c.rect(mid - 4, 17, mid + 5, 17, 'g1')
        c.rect(mid - 1, 15, mid + 1, 16, 'g3')
        # 들어올린 뚜껑(왼쪽 위): 윗면 + 앞띠 + 옆면
        for y in range(3, 7):
            d = 6 - y; c.rect(7 + d, y, 28 + d, y, 'b4' if y < 5 else 'b3')
        c.rect(7, 7, 28, 10, 'b3'); c.rect(7, 7, 28, 7, 'b4'); c.rect(7, 10, 28, 10, 'b2')
        for k in range(4): c.rect(29 + k, 6 - k, 29 + k, 10 - k, 'b1')
        c.rect(15, 3, 18, 10, 'g2'); c.rect(15, 3, 15, 10, 'g3'); c.rect(18, 3, 18, 10, 'g1')
    c.outline(); return c

ALL = {'icon/ui-settings': settings, 'icon/ui-dex': dex, 'icon/ui-rocket': rocket, 'icon/ui-event': event, 'icon/ui-move': move,
       'icon/bundle-comm': comm, 'icon/bundle-thrifty': thrifty, 'icon/bundle-rental': rental, 'icon/bundle-chores': chores,
       'icon/bundle-newhome': newhome, 'tool/cutter': cutter, 'ui/gift-closed': lambda: gift(False), 'ui/gift-open': lambda: gift(True)}
if __name__ == '__main__':
    for k in (sys.argv[1:] or ALL): ALL[k]().save(k); print(k)
