#!/usr/bin/env python3
"""특전 4종(강타 단련·손에 익은 리듬·특별 상자 단골·불씨 모으기) 16x16 도트 아이콘 생성. 실행: python3 tools/make-perk-icons.py
기존 특전 아이콘과 같은 팔레트(24색)·남색 외곽선을 쓴다. 안쪽 14x14 그림 + 외곽선 1도트."""
import os
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets', 'px', 'icon')
C = {
    'K': '#16224a', 'd': '#3b4a7a', 'g': '#8a96b8', 'l': '#d6dcec', 'W': '#ffffff',
    'f': '#fff3d6', 'b': '#8a4f24', 'w': '#d08a4a',
    'n': '#0b3aa0', 'B': '#145ce6', 's': '#5b9bff', 'v': '#bcd6ff',
    'o': '#c98a00', 'Y': '#ffc83d', 'y': '#ffeaa0', 'G': '#2fb36b',
    'R': '#e9304b', 'r': '#a8142d', 'O': '#ff8a1f',
}


def make(rows, name):
    px = {}
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.':
                px[(x + 1, y + 1)] = ch
    for (x, y) in list(px):
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                q = (x + dx, y + dy)
                if q not in px and 0 <= q[0] < 16 and 0 <= q[1] < 16:
                    px[q] = 'K'
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for (x, y), ch in px.items():
        h = C[ch]
        im.putpixel((x, y), tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    im.save(os.path.join(OUT, name))


# 강타 단련: 망치 머리(왼쪽 위)와 자루, 튀는 불꽃
STRIKE = [
    '..............',
    '.llllllll.....',
    '.lWWgggggd..Y.',
    '.lWggggggd.Y..',
    '.lgggggggd....',
    '.lgdddddddd...',
    '.dddd.bw......',
    '......bw......',
    '.......bw.....',
    '.......bw.....',
    '........bw....',
    '........bw..y.',
    '.........bw...',
    '..............',
]

# 손에 익은 리듬: 점점 높아지는 막대 3개와 꼭대기 별
STREAK = [
    '..............',
    '..........Y...',
    '.........YyY..',
    '..........Y...',
    '..........sB..',
    '..........sB..',
    '.....sB...sB..',
    '.....sB...sB..',
    '.....sB...sB..',
    '.sB..sB...sB..',
    '.sB..sB...sB..',
    '.sB..sB...sB..',
    '.nn..nn...nn..',
    '..............',
]

# 특별 상자 단골: 노란 선물 상자 + 빨간 리본 + 반짝임
SPECIAL = [
    '..............',
    '..y.....Y.....',
    '.yWy...YWY....',
    '..y....RR.Y...',
    '...RRRRRRRR...',
    '..RrR.RR.RrR..',
    '.YYYYYRRYYYYY.',
    '.YyyyyRRyyyYo.',
    '.YyYYYRRYYYYo.',
    '.YyYYYRRYYYYo.',
    '.YYYYYRRYYYYo.',
    '.YYYYYRRYYYYo.',
    '.oooooRRooooo.',
    '..............',
]

# 불씨 모으기: 불꽃(주황·노랑)과 아래의 불씨 더미
EMBER = [
    '..............',
    '.......O......',
    '......OO......',
    '.....OOR..O...',
    '....OOORR.OO..',
    '...OOYYORROO..',
    '...OOYYYOROO..',
    '..OOYYyYYOROO.',
    '..OOYyyyYOROO.',
    '..ROYyyyYOOR..',
    '...RRYyyYORR..',
    '....RRRRRRR...',
    '..Y..rrrrr..Y.',
    '..............',
]

if __name__ == '__main__':
    make(STRIKE, 'perk-strike_power.png')
    make(STREAK, 'perk-streak_coef.png')
    make(SPECIAL, 'perk-special_freq.png')
    make(EMBER, 'perk-fever_charge.png')
