#!/usr/bin/env python3
"""B10 손도트: 트럭 2프레임, 공구 아이콘, 집(화성·달), 선풍기 기둥, 에어컨, 상자 2종. python3 art/tools/px-b10.py [이름...]"""
import os, sys, json, math
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
P = json.load(open(ROOT + '/art/pixel/palette.json'))
def C(n): v = P[n].lstrip('#'); return tuple(int(v[i:i+2], 16) for i in (0, 2, 4)) + (255,)
K1 = C('k1')

class Cv:
    def __init__(s, w, h=None):
        s.w, s.h = w, h or w; s.p = [[None]*s.w for _ in range(s.h)]
    def px(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.p[y][x] = C(c) if c else None
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1+1):
            for x in range(x0, x1+1): s.px(x, y, c)
    def spans(s, d, c):
        for y, (a, b) in d.items():
            for x in range(a, b+1): s.px(x, y, c)
    def where(s, f, c):
        for y in range(s.h):
            for x in range(s.w):
                if f(x, y): s.px(x, y, c)
    def disc(s, cx, cy, r, c, ymax=99):
        s.where(lambda x, y: y <= ymax and math.hypot(x-cx, y-cy) <= r, c)
    def outline(s):
        q = [r[:] for r in s.p]
        for y in range(s.h):
            for x in range(s.w):
                if s.p[y][x] is None:
                    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                        nx, ny = x+dx, y+dy
                        if 0 <= nx < s.w and 0 <= ny < s.h and s.p[ny][nx] is not None and s.p[ny][nx] != K1:
                            q[y][x] = K1; break
        s.p = q
    def save(s, key):
        im = Image.new('RGBA', (s.w, s.h), (0, 0, 0, 0))
        for y in range(s.h):
            for x in range(s.w):
                if s.p[y][x]: im.putpixel((x, y), s.p[y][x])
        im.save(f'{ROOT}/public/assets/px/{key}.png')

def truck(frame):
    c = Cv(48, 32)
    d = 0 if frame == 1 else -1
    R = lambda x0, y0, x1, y1, col: c.rect(x0, y0+d, x1, y1+d, col)
    # 짐칸
    R(2, 4, 30, 27, 'p1'); R(2, 4, 30, 4, 'k5')
    R(2, 25, 30, 27, 'k4'); R(29, 5, 30, 24, 'k4'); R(28, 5, 28, 24, 'p2') if False else None
    R(2, 5, 2, 24, 'k5')
    # 상자 무늬
    R(7, 8, 18, 18, 'k1'); R(8, 9, 17, 17, 'w2'); R(8, 9, 17, 9, 'w2')
    R(16, 10, 17, 17, 'w1'); R(8, 17, 17, 17, 'w1'); R(12, 9, 13, 12, 'w1'); R(8, 9, 11, 9, 'g2')
    # 칸막이 + 캡
    R(31, 12, 31, 27, 'k1')
    for y, (a, b) in {11: (33, 38), 12: (32, 39), 13: (32, 40), 14: (32, 41), 15: (32, 42), 16: (32, 43), 17: (32, 44)}.items():
        R(a, y, b, y, 'b2')
    R(32, 18, 45, 27, 'b2')
    R(33, 11, 38, 11, 'b3'); R(32, 12, 39, 12, 'b3'); R(32, 13, 32, 27, 'b3')
    R(32, 24, 45, 27, 'b1'); R(41, 20, 45, 23, 'b1') if False else None
    # 창
    for y, (a, b) in {13: (34, 38), 14: (34, 39), 15: (34, 40), 16: (34, 41), 17: (34, 42), 18: (34, 42), 19: (34, 42)}.items():
        R(a-1, y, b+1, y, 'b1')
    for y, (a, b) in {14: (34, 38), 15: (34, 39), 16: (34, 40), 17: (34, 41), 18: (34, 41)}.items():
        R(a, y, b, y, 'b4')
    R(34, 14, 35, 14, 'k5'); R(34, 15, 34, 15, 'k5')
    # 문, 손잡이, 후드 빛
    R(40, 20, 40, 26, 'b1'); R(38, 22, 39, 22, 'k4')
    R(42, 19, 45, 19, 'b3')
    # 전조등·범퍼
    R(44, 21, 45, 23, 'g2'); R(44, 21, 44, 21, 'g3')
    R(43, 25, 46, 27, 'k3'); R(43, 25, 46, 25, 'k4')
    R(2, 28, 46, 28, 'k2')
    # 바퀴
    for cx in (11, 38):
        c.disc(cx, 27, 5.3, 'k2', ymax=28 + d)
        c.disc(cx, 27, 4.4, 'k1')
        c.disc(cx, 27, 2.7, 'k3')
        pts = [(0, -1), (0, 1), (-1, 0), (1, 0)] if frame == 1 else [(-1, -1), (1, 1), (1, -1), (-1, 1)]
        for dx, dy in pts[:2] if False else pts: pass
        for dx, dy in (pts[:2] if True else pts): c.px(cx+dx, 27+dy, 'k1')
        c.px(cx, 27, 'k2')
    # 외곽선
    c.outline()
    return c

def tools():
    c = Cv(24)
    # 렌치
    c.rect(13, 2, 18, 5, 'k4'); c.rect(15, 2, 16, 3, None); c.rect(13, 2, 13, 5, 'k5'); c.rect(18, 4, 18, 5, 'k3')
    c.rect(15, 6, 16, 10, 'k4'); c.rect(16, 6, 16, 10, 'k3')
    # 손잡이
    c.rect(5, 7, 12, 8, 'k3'); c.rect(5, 9, 6, 10, 'k3'); c.rect(11, 9, 12, 10, 'k3'); c.rect(5, 7, 12, 7, 'k4')
    # 몸통
    c.rect(2, 11, 21, 21, 'r2'); c.rect(2, 11, 21, 11, 'r2')
    c.rect(2, 20, 21, 21, 'r1'); c.rect(20, 12, 21, 19, 'r1')
    c.rect(2, 15, 21, 15, 'k1'); c.rect(2, 16, 21, 16, 'r1') if False else None
    c.rect(2, 16, 19, 16, 'r1')
    c.rect(3, 12, 19, 12, 'pk') if False else None
    # 힌지, 잠금쇠
    c.rect(4, 12, 5, 13, 'k3'); c.rect(18, 12, 19, 13, 'k3')
    c.rect(10, 13, 13, 17, 'k1'); c.rect(11, 14, 12, 16, 'g2'); c.px(11, 14, 'g3'); c.px(12, 16, 'g1')
    c.outline()
    return c

def mars():
    c = Cv(24)
    c.rect(2, 18, 21, 21, 'r1'); c.rect(3, 17, 20, 17, 'or'); c.rect(2, 18, 21, 18, 'or')
    for x, y in ((4, 20), (5, 20), (15, 20), (16, 20), (10, 21), (11, 21)): c.px(x, y, 'r2')
    # 돔
    cx, cy, r = 11.5, 16.5, 7.2
    c.where(lambda x, y: y <= 16 and math.hypot(x - cx, (y - cy) * 1.15) <= r, 'k4')
    c.where(lambda x, y: y <= 16 and x >= 14 and math.hypot(x - cx, (y - cy) * 1.15) <= r, 'k3')
    c.rect(5, 16, 18, 17, 'k3'); c.rect(5, 16, 18, 16, 'k4'); c.rect(5, 17, 18, 17, 'k2')
    c.rect(8, 11, 9, 11, 'k5'); c.rect(7, 12, 7, 12, 'k5')
    c.rect(9, 13, 13, 15, 'k1'); c.rect(10, 13, 12, 14, 'b4'); c.rect(10, 14, 12, 14, 'b3'); c.px(10, 13, 'k5'); c.px(11, 15, 'b3') if False else None
    c.rect(9, 15, 13, 15, 'k2')
    # 안테나
    c.rect(16, 6, 16, 11, 'k3'); c.px(16, 5, 'r2'); c.px(17, 5, 'r2') if False else None
    c.outline()
    return c

def moon():
    c = Cv(24)
    c.rect(2, 17, 21, 21, 'k3'); c.rect(2, 17, 21, 18, 'k4')
    c.rect(3, 19, 6, 20, 'k2'); c.px(2, 19, 'k4') if False else None
    c.rect(15, 19, 20, 20, 'k2'); c.rect(17, 21, 19, 21, 'k2') if False else None
    c.rect(9, 20, 10, 21, 'k2') if False else None
        # 모듈
    cx, cy = 11, 12.5
    c.where(lambda x, y: y <= 16 and math.hypot((x - cx) / 8.2, (y - cy) / 4.4) <= 1.0, 'k4')
    c.where(lambda x, y: y <= 16 and math.hypot((x - cx) / 8.2, (y - cy) / 4.4) <= 1.0 and (x >= 15 or y >= 15), 'k3')
    c.rect(3, 16, 19, 17, 'k3'); c.rect(3, 16, 19, 16, 'k4'); c.rect(3, 17, 19, 17, 'k2')
    c.rect(7, 10, 9, 10, 'k5'); c.rect(6, 11, 6, 11, 'k5')
    for x0 in (7, 12):
        c.rect(x0, 11, x0 + 2, 13, 'b3'); c.px(x0, 11, None); c.px(x0 + 2, 11, None) if False else None
        c.px(x0, 11, 'b4'); c.px(x0 + 1, 11, 'b4')
    c.rect(16, 12, 16, 13, 'g2')
    # 불빛 + 깃대
    c.rect(11, 7, 11, 7, 'k3'); c.px(10, 7, 'g2'); c.px(11, 7, 'g2'); c.px(11, 6, 'g2')
    c.rect(19, 3, 19, 11, 'k3'); c.rect(15, 3, 18, 5, 'r2'); c.rect(15, 5, 18, 5, 'r1')
    c.outline()
    return c

def fan():
    im = Image.open(f'{ROOT}/public/assets/px/item/fan.png').convert('RGBA')
    c = Cv(14, 28)
    for y in range(28):
        for x in range(14): c.p[y][x] = im.getpixel((x, y)) if im.getpixel((x, y))[3] else None
    for y in range(13, 22):
        for x in (5, 8): c.p[y][x] = K1
        for x in (6, 7): c.p[y][x] = C('k3')
        c.p[y][6] = C('k4')
    c.px(5, 12, 'k1'); c.px(8, 12, 'k1')
    return c

def aircon():
    c = Cv(32)
    c.rect(3, 7, 28, 18, 'p1'); c.rect(3, 7, 28, 7, 'k5')
    c.rect(3, 7, 3, 17, 'k5')
    c.rect(26, 8, 28, 18, 'k4'); c.rect(3, 17, 28, 18, 'k4')
    c.rect(5, 10, 14, 10, 'b3'); c.rect(5, 11, 14, 11, 'b2')
    c.rect(6, 14, 25, 15, 'k3'); c.rect(6, 14, 25, 14, 'k2')
    c.rect(23, 10, 24, 11, 'k1'); c.px(23, 10, 'gn'); c.px(24, 10, 'gn'); c.px(23, 11, 'gn'); c.px(24, 11, 'gn')
    c.px(24, 11, 'k3'); c.px(23, 11, 'k3') if False else None
    # 바람 날개
    c.rect(5, 19, 26, 20, 'k3'); c.rect(5, 19, 26, 19, 'k4'); c.rect(5, 20, 26, 20, 'k2')
    for x0 in (8, 15, 22):
        for y in (23, 24, 25, 27, 28, 29):
            c.px(x0, y, 'b4'); c.px(x0 + 1, y, 'b3')
    c.outline()
    return c

def box_open():
    c = Cv(16)
    c.spans({3: (2, 4), 4: (2, 5), 5: (3, 5), 6: (3, 5)}, 'w2'); c.spans({3: (2, 4)}, 'p2')
    c.spans({3: (11, 13), 4: (10, 13), 5: (10, 12), 6: (10, 12)}, 'w1'); c.spans({3: (11, 13)}, 'w2')
    c.rect(4, 6, 11, 8, 'k1')
    c.rect(2, 8, 13, 13, 'w2'); c.rect(2, 8, 13, 8, 'p2')
    c.rect(12, 9, 13, 13, 'w1'); c.rect(2, 13, 13, 13, 'w1')
    c.rect(7, 9, 8, 10, 'w1')
    c.rect(7, 6, 9, 7, 'g2'); c.px(7, 6, 'g3')
    c.outline()
    return c

def bundle():
    c = Cv(16)
    c.rect(7, 2, 13, 8, 'w2'); c.rect(7, 2, 13, 2, 'p2'); c.rect(12, 3, 13, 8, 'w1')
    c.rect(2, 7, 9, 13, 'w2'); c.rect(2, 7, 9, 7, 'p2'); c.rect(8, 8, 9, 13, 'w1'); c.rect(2, 13, 9, 13, 'w1')
    c.rect(2, 10, 13, 10, 'b2') if False else None
    c.rect(4, 7, 5, 13, 'b2'); c.rect(4, 7, 4, 13, 'b3')
    c.rect(9, 2, 10, 6, 'b2'); c.rect(9, 2, 9, 6, 'b3')
    c.rect(9, 7, 10, 8, 'b2'); c.px(9, 7, 'b3')
    c.outline()
    return c

ALL = {'ui/truck': lambda: truck(1), 'ui/truck-2': lambda: truck(2), 'icon/ui-tools': tools, 'item/fan': fan,
       'icon/house-mars': mars, 'icon/house-moon': moon, 'col/air_conditioner': aircon,
       'icon/box-open': box_open, 'icon/bundle': bundle}

if __name__ == '__main__':
    for k in (sys.argv[1:] or ALL):
        ALL[k]().save(k); print(k)
