#!/usr/bin/env python3
"""B2 상자 손상 단계: box/<size>-1.png 위에 도트 단위로 손상을 그려 -2,-3(,-4)를 만든다 (handFixed).
금은 끊기지 않는 1도트 4방향 연결 지그재그(앞면 w1, 옆면 w2). 2단계 테이프 벗겨짐+옆금, 3단계 +뚜껑 날개 들림+앞금+모서리 찌그러짐, 4단계(큰 상자) +끈 끊김+양쪽 들림+Y 금."""
import os, json
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
P = json.load(open(ROOT + '/art/pixel/palette.json'))
def rgba(n): v = P[n].lstrip('#'); return tuple(int(v[i:i+2], 16) for i in (0, 2, 4)) + (255,)
K, S, T, D, O = rgba('k1'), rgba('p2'), rgba('p1'), rgba('w1'), rgba('w2')
CLEAR = (0, 0, 0, 0)
# L,R: 앞면 안쪽 왼/오른 열, yB: 윗면·앞면 경계 윤곽 행, yf: 앞면 첫 행, yb: 바닥 윤곽 행, tape: 앞면 테이프 열 범위, del: 높이를 줄일 균일한 행들
G = {
 'small': dict(L=2, R=22, yB=10, yf=11, yb=30, tape=(10, 13), dele=(13, 14), peel=4, cut=3),
 'normal': dict(L=2, R=32, yB=17, yf=19, yb=38, tape=(15, 19), dele=(20, 21), peel=5, cut=4),
 'big': dict(L=3, R=37, yB=17, yf=18, yb=50, tape=(18, 23), dele=(20, 21, 22), peel=5, cut=5),
}
def load(n): return Image.open(f'{ROOT}/public/assets/px/box/{n}-1.png').convert('RGBA')

def fix_outline(im):
    """투명 칸이 k1 아닌 불투명 칸과 4방향으로 닿으면 k1로 메운다."""
    px = im.load(); W, H = im.size; add = []
    for y in range(H):
        for x in range(W):
            if px[x, y][3] == 0:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H and px[nx, ny][3] and px[nx, ny] != K:
                        add.append((x, y)); break
    for p in add: px[p] = K

def shrink_shift(im, g, lift):
    """균일한 앞면 행 lift개를 지우고 전체를 lift만큼 내려, 윗면 위에 들림 여유 행을 만든다(바닥선 유지)."""
    px = im.load(); W, H = im.size
    rows = list(g['dele'])[:lift]
    keep = [y for y in range(H) if y not in rows]
    out = Image.new('RGBA', (W, H), CLEAR); po = out.load()
    for i, y in enumerate(keep):
        for x in range(W): po[x, i + lift] = px[x, y]
    return out
def shifted(g, lift, y): return y + lift  # 삭제 행은 yB 아래라 윗부분 좌표는 lift만큼만 내려간다

def peel(im, g, dy=0):
    """가운데 테이프가 위에서부터 벗겨져 옆으로 말림: 골판지 w1 틈 + p1 말린 조각"""
    px = im.load(); a, b = g['tape']; y0 = g['yf'] + dy; n = g['peel']
    for y in range(y0, y0 + n):
        for x in range(a, b + 1): px[x, y] = D
    ye = y0 + n                                   # 벗겨진 끝 첫 테이프 행
    for x in range(b + 1, b + 7): px[x, ye - 1] = T      # 말려 나온 조각(계단식으로 올라감)
    for x in range(b + 2, b + 7): px[x, ye - 2] = T
    for x in range(b + 3, b + 7): px[x, ye - 3] = T
    for x in range(b + 1, b + 6): px[x, ye] = D           # 조각 그림자

def path_zig(im, x, y, moves, color, only):
    """4방향 연결 1도트 선. moves 문자열: D 아래, L 왼, R 오른, U 위"""
    px = im.load()
    pts = [(x, y)]
    for m in moves:
        dx, dy = {'D': (0, 1), 'L': (-1, 0), 'R': (1, 0), 'U': (0, -1)}[m]
        x += dx; y += dy; pts.append((x, y))
    for p in pts:
        if px[p] in only: px[p] = color

def dent(im, g, dy):
    """아랫모서리(왼쪽) 한 곳 찌그러짐"""
    px = im.load(); L, c = 1, g['cut']; yb = g['yb'] + dy
    cut = [(L + dx, yb - ddy) for dx in range(c + 1) for ddy in range(c + 1 - dx)]
    for p in cut: px[p] = CLEAR
    for p in cut:
        for nx, ny in ((p[0] + 1, p[1]), (p[0], p[1] - 1)):
            if px[nx, ny][3] and (nx, ny) not in cut and px[nx, ny] != K: px[nx, ny] = K

def lift_flap(im, g, side, lift):
    """윗면 날개 한쪽(side='R' 테이프 오른쪽, 'L' 왼쪽)을 lift도트 들어 올리고 틈을 k1로 채운다"""
    px = im.load(); W, H = im.size; yB = g['yB']
    # 옆면 w1(윗면 위쪽 대각 끝까지 이어진 덩어리)은 날개가 아니다
    sideD = set(); st = [(x, yB) for x in range(W) if px[x, yB] == D]
    while st:
        p = st.pop()
        if p in sideD or not (0 <= p[0] < W and 0 <= p[1] < H) or px[p] != D: continue
        sideD.add(p); st += [(p[0] + 1, p[1]), (p[0] - 1, p[1]), (p[0], p[1] + 1), (p[0], p[1] - 1)]
    trow = {y: [x for x in range(W) if px[x, y] == T] for y in range(yB)}
    y0 = min(y for y in trow if trow[y])
    flap = {}
    for y in range(yB):
        mx = max(trow[y]) if trow[y] else max(trow[y0]) + (y0 - y)
        mn = min(trow[y]) if trow[y] else min(trow[y0]) + (y0 - y)
        for x in range(W):
            if not px[x, y][3] or (x, y) in sideD: continue
            if (side == 'R' and x > mx) or (side == 'L' and x < mn): flap[(x, y)] = px[x, y]
    for p in flap: px[p] = CLEAR
    for (x, y), c in flap.items():
        if px[x, y - lift] == T: continue
        px[x, y - lift] = c
    for (x, y) in flap:                         # 비워진 칸: 아래가 불투명이면 k1 틈
        if px[x, y][3] == 0:
            below = [yy for yy in range(y, yB + 2) if px[x, yy][3]]
            if below and below[0] - y <= lift + 1:
                for yy in range(y, below[0]): px[x, yy] = K
    fix_outline(im)

def strap_break(im):
    """왼쪽 끈이 끊겨 위 끝이 왼쪽으로 늘어지고 아래 끝은 들쭉날쭉"""
    px = im.load()
    for y in range(30, 36):
        for x in (12, 13, 14): px[x, y] = O
    for x in (11, 12, 13): px[x, 30] = D
    for x in (10, 11, 12): px[x, 31] = D
    for x in (10, 11): px[x, 32] = D
    for x in (9, 10): px[x, 33] = D
    px[9, 34] = D
    px[12, 36] = O; px[14, 36] = O      # 아래 끈 윗끝이 찢긴 모양

# 앞면(w1)/옆면(w2) 금: (시작 x, 시작 y, 이동열)
SIDE = {'small': (26, 14, 'DDRDDLDDRDDLDD'), 'normal': (35, 21, 'DDRDDDLDDDRDDDLDD'), 'big': (43, 24, 'DDRRDDDLLDDDRRDDD')}
FRONT = {'small': (5, 15, 'DDRDDLDDRDDLDDR'), 'normal': (6, 22, 'DDRDDLDDRDDLDDRD'), 'big': (33, 26, 'DDDDRDDDLDDD')}

def build(n, st):
    g = dict(G[n]); im = load(n); big = n == 'big'
    lift = 3 if big else 2
    if st >= 3:
        im = shrink_shift(im, g, lift)
        g['yB'] += lift; g['yf'] += lift
    peel(im, g, dy=g['yf'] - G[n]['yf'])
    x, y, m = SIDE[n]; path_zig(im, x, y, m, O, (D,))
    if st >= 3:
        lift_flap(im, g, 'R', lift)
        dent(im, g, 0)
        x, y, m = FRONT[n]; path_zig(im, x, y, m, D, (O,))
    if st >= 4:
        lift_flap(im, g, 'L', lift)
        strap_break(im)
        path_zig(im, 29, 22, 'DRDRDRDR', D, (O,)); path_zig(im, 36, 22, 'DLDLDLDD', D, (O,))
    im.save(f'{ROOT}/public/assets/px/box/{n}-{st}.png')

if __name__ == '__main__':
    for n, sts in (('small', (2, 3)), ('normal', (2, 3)), ('big', (2, 3, 4))):
        for st in sts: build(n, st)
