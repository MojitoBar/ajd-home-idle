#!/usr/bin/env python3
"""실드 칸 작은 안전모 3종(8x6 도트): 찬 칸·빈 칸 외곽선·번쩍. 팔레트 색만 쓴다. 실행: python3 tools/make-shield-icons.py"""
import os
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets', 'px', 'tool')
SHAPE = [
    '..KKKK..',
    '.KyyYYK.',
    'KyYYYYoK',
    'KYYYYYoK',
    'KooooooK',
    '.KKKKKK.',
]
FULL = {'K': '#0d1430', 'y': '#ffeaa0', 'Y': '#ffc83d', 'o': '#c98a00'}
EMPTY = {'K': '#8a96b8'}
FLASH = {'K': '#0d1430', 'y': '#ffffff', 'Y': '#ffffff', 'o': '#d6dcec'}


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def make(name, pal):
    im = Image.new('RGBA', (8, 6), (0, 0, 0, 0))
    for y, row in enumerate(SHAPE):
        for x, ch in enumerate(row):
            if ch in pal:
                im.putpixel((x, y), rgb(pal[ch]))
    im.save(os.path.join(OUT, name))


make('hardhat-s.png', FULL)
make('hardhat-s-empty.png', EMPTY)
make('hardhat-s-flash.png', FLASH)
