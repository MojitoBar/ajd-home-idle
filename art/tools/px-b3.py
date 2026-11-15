#!/usr/bin/env python3
"""B3 손도트 아이콘 16x16 (함수형 도형 + 자동 외곽선). python3 art/tools/px-b3.py [이름...]"""
import os, sys, json, math
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
P = json.load(open(ROOT + '/art/pixel/palette.json'))
def C(n): v = P[n].lstrip('#'); return tuple(int(v[i:i+2], 16) for i in (0, 2, 4)) + (255,)
N = 16
OFF = 2
class Cv:
    def __init__(s, n=16, off=2):
        global N, OFF
        N, OFF = n, off
        s.n, s.off = n, off; s.p = [[None]*n for _ in range(n)]
    def px(s, x, y, c):
        x += s.off; y += s.off
        if 2 <= x < s.n-2 and 2 <= y < s.n-2: s.p[y][x] = C(c) if c else None
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1+1):
            for x in range(x0, x1+1): s.px(x, y, c)
    def spans(s, d, c):
        for y, (a, b) in d.items():
            for x in range(a, b+1): s.px(x, y, c)
    def where(s, f, c):
        for y in range(s.n - 2*s.off):
            for x in range(s.n - 2*s.off):
                if f(x, y): s.px(x, y, c)
    def disc(s, cx, cy, r, c, ring=None):
        if ring:
            s.where(lambda x, y: math.hypot(x-cx, y-cy) <= r+0.9, ring)
        s.where(lambda x, y: math.hypot(x-cx, y-cy) <= r, c)
    def outline(s):
        N = s.n
        q = [r[:] for r in s.p]
        for y in range(N):
            for x in range(N):
                if s.p[y][x] is None:
                    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                        nx, ny = x+dx, y+dy
                        if 0 <= nx < N and 0 <= ny < N and s.p[ny][nx] is not None and s.p[ny][nx] != C('k1'):
                            q[y][x] = C('k1'); break
        s.p = q
    def save(s, key):
        N = s.n
        im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
        for y in range(N):
            for x in range(N):
                if s.p[y][x]: im.putpixel((x, y), s.p[y][x])
        im.save(f'{ROOT}/public/assets/px/{key}.png')

def fever():
    c = Cv()
    c.spans({0:(6,7),1:(6,7),2:(5,8),3:(5,8),4:(4,9),5:(4,9),6:(3,10),7:(3,10),8:(2,10),9:(2,10),10:(3,9),11:(4,8)}, 'or')
    c.spans({6:(5,7),7:(5,7),8:(4,8),9:(4,8),10:(4,8)}, 'r2')
    c.spans({8:(5,7),9:(5,7),10:(5,7)}, 'g2')
    c.outline(); return c
def crit():
    c = Cv()
    def star(x, y):
        dx, dy = abs(x-5.5), abs(y-5.5)
        sp = lambda a, b: a <= max(0.5, 1.7 - b*0.3) and b <= 5.5
        return sp(dx, dy) or sp(dy, dx) or math.hypot(dx, dy) <= 3.3
    c.where(star, 'g2')
    c.where(lambda x, y: star(x, y) and x + y >= 12, 'g1')
    c.where(lambda x, y: star(x, y) and x + y <= 8 and math.hypot(x-5.5, y-5.5) <= 3.3, 'g3')
    c.rect(4, 4, 5, 5, 'k5')
    c.outline(); return c
def bundle():
    c = Cv()
    def link(x0, y0, x1, y1, col, hi, sh):
        c.rect(x0, y0, x1, y1, col)
        c.rect(x0, y0, x1, y0, hi); c.rect(x0, y1, x1, y1, sh)
        for p in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)): c.px(p[0], p[1], None)
        c.rect(x0+3, y0+2, x1-3, y1-2, None)
    link(3, 5, 11, 11, 'g2', 'g3', 'g1')
    link(0, 0, 8, 6, 'b2', 'b3', 'b1')
    c.rect(6, 5, 8, 6, 'g2'); c.rect(6, 5, 8, 5, 'g3'); c.px(9, 5, 'g2')
    c.outline(); return c
def perk():
    c = Cv()
    c.rect(3, 0, 8, 4, 'g2'); c.spans({5:(4,7), 6:(5,6)}, 'g2')
    c.rect(0, 1, 2, 3, 'g1'); c.rect(9, 1, 11, 3, 'g1'); c.px(1, 2, None); c.px(10, 2, None)
    c.rect(7, 0, 8, 4, 'g1'); c.spans({5:(7,7)}, 'g1')
    c.rect(3, 1, 3, 3, 'g3'); c.px(3, 1, 'k5')
    c.rect(5, 7, 6, 8, 'g1')
    c.rect(2, 9, 9, 11, 'g1'); c.rect(2, 9, 9, 9, 'g2'); c.rect(8, 9, 9, 11, 'g0')
    c.outline(); return c
def box_closed():
    c = Cv()
    c.rect(0, 4, 11, 5, 'b3'); c.rect(11, 4, 11, 5, 'b1'); c.rect(0, 5, 10, 5, 'b2')
    c.rect(1, 6, 10, 11, 'b2'); c.rect(9, 6, 10, 11, 'b1')
    c.rect(5, 3, 6, 11, 'g2'); c.rect(5, 3, 5, 11, 'g3'); c.rect(6, 3, 6, 11, 'g1')
    c.rect(1, 0, 4, 2, 'g2'); c.rect(7, 0, 10, 2, 'g2'); c.rect(5, 1, 6, 3, 'g1')
    c.rect(2, 1, 2, 1, 'g3'); c.rect(7, 1, 7, 1, 'g3')
    c.outline(); return c
def box_open():
    c = Cv()
    c.rect(1, 0, 10, 2, 'b3'); c.rect(1, 0, 10, 0, 'b4'); c.rect(10, 0, 10, 2, 'b2')
    c.rect(1, 3, 10, 3, 'k1')
    c.rect(0, 4, 11, 11, 'b2'); c.rect(1, 4, 10, 5, 'g3'); c.rect(1, 5, 10, 5, 'g2')
    c.rect(0, 6, 11, 6, 'b3'); c.rect(10, 7, 11, 11, 'b1')
    c.rect(5, 6, 6, 11, 'g2'); c.rect(5, 6, 5, 11, 'g3'); c.rect(6, 6, 6, 11, 'g1')
    c.rect(4, 4, 5, 4, 'k5')
    c.outline(); return c
def coin_pile():
    c = Cv()
    def stack(x0, x1, n):
        for k in range(n):
            y = 10 - 3*k
            c.rect(x0, y, x1, y, 'g2'); c.rect(x0, y+1, x1, y+1, 'g1')
            if k: c.rect(x0, y+2, x1, y+2, 'k1')
            c.rect(x0, y, x0+1, y, 'g3')
        yt = 10 - 3*(n-1) - 1
        c.rect(x0+1, yt, x1-1, yt, 'g3'); c.px(x1-1, yt, 'g2')
    stack(0, 4, 3); stack(6, 11, 4)
    c.outline(); return c

def cutter():
    c = Cv(24, 0)
    c.rect(2, 8, 14, 17, 'g2'); c.rect(2, 8, 14, 9, 'g3'); c.rect(2, 15, 14, 17, 'g1'); c.rect(13, 8, 14, 17, 'g1')
    c.rect(6, 5, 10, 7, 'k2'); c.rect(6, 5, 10, 5, 'k3'); c.rect(7, 12, 9, 12, 'g0')
    c.rect(15, 8, 16, 17, 'k3'); c.rect(15, 8, 15, 17, 'k4')
    for ys, xe in (((6, 7), 16), ((8, 9), 18), ((10, 11), 20), ((12, 17), 21)):
        c.rect(17, ys[0], xe, ys[1], 'k4')
    c.rect(17, 14, 21, 17, 'k3'); c.rect(19, 10, 19, 11, 'k5')
    c.rect(15, 6, 16, 7, 'k4'); c.rect(18, 12, 19, 13, 'k5')
    c.outline(); return c
def robot_arm():
    c = Cv(24, 0)
    c.rect(3, 19, 14, 21, 'k3'); c.rect(3, 19, 14, 19, 'k4'); c.rect(11, 20, 14, 21, 'k2')
    c.rect(6, 12, 10, 18, 'b2'); c.rect(6, 12, 7, 18, 'b3'); c.rect(9, 12, 10, 18, 'b1')
    c.disc(8, 8, 3.6, 'k4', None); c.where(lambda x, y: (x-8)**2+(y-8)**2 <= 13 and x+y >= 17, 'k3'); c.rect(6, 6, 7, 7, 'k5')
    c.rect(10, 5, 16, 8, 'k4'); c.rect(10, 5, 16, 5, 'k5'); c.rect(10, 7, 16, 8, 'k3')
    c.rect(17, 3, 18, 10, 'k2'); c.rect(17, 3, 17, 10, 'k3')
    c.rect(19, 3, 21, 4, 'k3'); c.rect(20, 5, 21, 5, 'k3'); c.rect(19, 9, 21, 10, 'k3'); c.rect(20, 8, 21, 8, 'k3')
    c.rect(19, 3, 21, 3, 'k4'); c.rect(19, 9, 21, 9, 'k4')
    c.outline(); return c
ALL = {'tool/cutter': cutter, 'tool/robot-arm': robot_arm, 'icon/fever': fever, 'icon/crit': crit, 'icon/bundle': bundle, 'icon/perk': perk,
       'icon/box-closed': box_closed, 'icon/box-open': box_open, 'icon/coin-pile': coin_pile}
if __name__ == '__main__':
    for k in (sys.argv[1:] or ALL): ALL[k]().save(k); print(k)
