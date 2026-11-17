#!/usr/bin/env python3
"""공구 강화 5종(24x24)·특전 2종(16x16) 도트 아이콘 생성. 실행: python3 tools/make-gear-icons.py"""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets', 'px')
C = {
    'K': '#16224a', 'd': '#3b4a7a', 'g': '#8a96b8', 'l': '#d6dcec', 'W': '#ffffff',
    'f': '#fff3d6', 'c': '#ecd3a0', 'b': '#8a4f24', 'w': '#d08a4a',
    'n': '#0b3aa0', 'B': '#145ce6', 's': '#5b9bff', 'v': '#bcd6ff',
    'o': '#c98a00', 'Y': '#ffc83d', 'y': '#ffeaa0', 'G': '#2fb36b',
}


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


class Canvas:
    def __init__(self, n):
        self.n = n
        self.p = {}

    def set(self, x, y, ch):
        if 0 <= x < self.n and 0 <= y < self.n:
            self.p[(x, y)] = ch

    def rect(self, x0, y0, x1, y1, ch):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, ch)

    def rows(self, y0, rows):
        for dy, r in enumerate(rows):
            x0 = (self.n - len(r)) // 2
            for dx, ch in enumerate(r):
                if ch != '.':
                    self.set(x0 + dx, y0 + dy, ch)

    def stroke(self, pts, cols, wide=True):
        """대각선 막대: 점 목록을 채우고 자동 명암(lit, mid, shade)."""
        core = set()
        for x, y in pts:
            core.add((x, y))
            if wide:
                core.add((x + 1, y))
            if wide == 2:
                core.add((x, y + 1))
        for (x, y) in core:
            if (x - 1, y) not in core or (x, y - 1) not in core:
                ch = cols[0]
            elif (x + 1, y) not in core or (x, y + 1) not in core:
                ch = cols[2]
            else:
                ch = cols[1]
            self.set(x, y, ch)

    def outline(self):
        add = []
        for (x, y) in list(self.p):
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    q = (x + dx, y + dy)
                    if q not in self.p and 0 <= q[0] < self.n and 0 <= q[1] < self.n:
                        add.append(q)
        for q in add:
            self.p[q] = 'K'

    def save(self, path):
        im = Image.new('RGBA', (self.n, self.n), (0, 0, 0, 0))
        for (x, y), ch in self.p.items():
            im.putpixel((x, y), rgb(C[ch]))
        path = os.path.normpath(os.path.join(ROOT, path))
        im.save(path)


def line(a, b):
    (x0, y0), (x1, y1) = a, b
    n = max(abs(x1 - x0), abs(y1 - y0))
    return [(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)) for i in range(n + 1)]


def level():
    c = Canvas(24)
    c.rect(2, 8, 21, 15, 'Y')
    c.rect(2, 8, 21, 8, 'y')
    c.rect(2, 14, 21, 15, 'o')
    c.rect(8, 10, 15, 13, 'K')
    c.rect(9, 11, 14, 12, 'v')
    for x in (10, 13):
        c.rect(x, 11, x, 12, 'K')
    c.rect(11, 11, 12, 12, 'W')
    for x in (4, 19):
        c.set(x, 11, 'o')
        c.set(x, 12, 'o')
    c.outline()
    return c


def hardhat():
    c = Canvas(24)
    c.rows(3, [
        'KKKK',
        'KKYyyYKK',
        'KYyyYYYYoK',
        'KYyyYYYYYYoK',
        'KYyYYYYYYYYoK',
        'KYyYYYYYYYYYooK',
        'KYYYYYYYYYYYYooK',
        'KKKKKKKKKKKKKKKKKK',
        'KYYYYYYYYYYYYYYYYooK',
        'KooooooooooooooooooK',
        'KKKKKKKKKKKKKKKKKKKK',
    ])
    c.rect(11, 5, 12, 10, 'o')
    c.rect(11, 5, 11, 10, 'y')
    c.rect(12, 5, 12, 10, 'o')
    return c


def shade(c, cells, cols):
    """집합 전체에 이웃 기준 3단 명암(왼쪽·위가 밝음)."""
    for (x, y) in cells:
        if (x - 1, y) not in cells or (x, y - 1) not in cells:
            ch = cols[0]
        elif (x + 1, y) not in cells or (x, y + 1) not in cells:
            ch = cols[2]
        else:
            ch = cols[1]
        c.set(x, y, ch)


def crowbar():
    c = Canvas(24)
    cells = set()
    # 몸통: 대각선, 줄마다 6도트(수직 굵기 약 4)
    for i in range(0, 13):
        y = 17 - i
        x = 5 + i
        for dx in range(6):
            cells.add((x + dx - 2, y))
    # 납작하게 벌어진 날(왼쪽 아래)
    for y, x0, x1 in [(18, 1, 7), (19, 1, 6), (20, 0, 5), (21, 0, 4)]:
        for x in range(x0, x1 + 1):
            cells.add((x, y))
    # 위쪽 끝이 왼쪽으로 꺾이는 갈고리
    for y, x0, x1 in [(5, 9, 11), (4, 9, 19), (3, 12, 18), (2, 6, 16), (1, 5, 13)]:
        for x in range(x0, x1 + 1):
            cells.add((x, y))
    # 갈래 사이 홈
    for q in [(9, 3), (10, 3), (11, 3), (8, 2), (9, 2), (10, 2), (11, 2)]:
        cells.discard(q)
    shade(c, cells, 'sBn')
    c.outline()
    return c


def awl():
    c = Canvas(24)
    handle = set()
    for y in range(24):
        for x in range(24):
            ax, ay, bx, by = 13, 10, 18, 5
            dx, dy = bx - ax, by - ay
            t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
            if (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 <= 3.9 ** 2:
                handle.add((x, y))
    ring = {q for q in handle if 9 <= q[0] - q[1] + 0 <= 9 + 0} | {q for q in handle if q[0] - q[1] == 8 or q[0] - q[1] == 9}
    wood = handle - ring
    for (x, y) in wood:
        pass
    shade(c, wood, 'cwb')
    shade(c, ring, 'gdd')
    needle = set()
    for i in range(0, 8):
        x, y = 11 - i, 12 + i
        needle.add((x, y))
        if i < 6:
            needle.add((x + 1, y))
        if i < 3:
            needle.add((x, y + 1))
    shade(c, needle, 'lgd')
    c.outline()
    return c


def magnifier():
    c = Canvas(24)
    for y in range(24):
        for x in range(24):
            d = ((x - 9.5) ** 2 + (y - 9.5) ** 2) ** 0.5
            if d <= 6.6:
                c.set(x, y, 'l' if x + y < 17 else ('d' if d > 5.4 and x + y > 20 else 'g'))
            if d <= 4.6:
                c.set(x, y, 'v')
    for (x, y) in [(6, 8), (6, 7), (7, 6), (8, 6), (7, 8)]:
        c.set(x, y, 'W')
    for (x, y) in [(12, 13), (13, 12), (12, 12), (13, 13), (11, 13), (13, 11)]:
        c.set(x, y, 's')
    c.stroke(line((15, 15), (20, 20)), 'cwb', wide=2)
    c.set(14, 14, 'd')
    c.set(15, 14, 'd')
    c.set(14, 15, 'd')
    c.outline()
    return c


def perk_home():
    c = Canvas(16)
    c.rows(5, ['B'])
    c.rect(5, 5, 5, 5, 'B')
    c.rect(4, 6, 6, 6, 'B')
    c.rect(3, 7, 7, 7, 'B')
    c.rect(2, 8, 8, 8, 'B')
    c.rect(1, 9, 9, 9, 'B')
    c.rect(1, 9, 9, 9, 'n')
    for x, y in [(5, 5), (4, 6), (3, 7), (2, 8), (1, 9)]:
        c.set(x, y, 's')
    c.rect(2, 10, 8, 14, 'f')
    c.rect(8, 10, 8, 14, 'c')
    c.rect(4, 11, 5, 14, 'w')
    c.rect(4, 11, 4, 14, 'w')
    c.rect(5, 11, 5, 14, 'b')
    c.rect(11, 4, 13, 8, 'G')
    c.rect(10, 3, 14, 3, 'G')
    c.rect(11, 2, 13, 2, 'G')
    c.set(12, 1, 'G')
    c.set(12, 1, 'G')
    c.outline()
    return c


def perk_dex():
    c = Canvas(16)
    c.rect(1, 5, 9, 14, 'B')
    c.rect(1, 5, 2, 14, 'n')
    c.rect(3, 5, 9, 5, 's')
    c.rect(3, 14, 9, 14, 'n')
    c.rect(5, 8, 7, 10, 'Y')
    c.set(5, 8, 'y')
    c.set(7, 10, 'o')
    c.rect(11, 4, 13, 8, 'G')
    c.rect(10, 3, 14, 3, 'G')
    c.rect(11, 2, 13, 2, 'G')
    c.set(12, 1, 'G')
    c.outline()
    return c


if __name__ == '__main__':
    level().save('tool/level.png')
    hardhat().save('tool/hardhat.png')
    crowbar().save('tool/crowbar.png')
    awl().save('tool/awl.png')
    magnifier().save('tool/magnifier.png')
    perk_home().save('icon/perk-home_boost.png')
    perk_dex().save('icon/perk-dex_boost.png')
