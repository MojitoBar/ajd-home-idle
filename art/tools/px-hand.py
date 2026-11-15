#!/usr/bin/env python3
"""손으로 찍는 도트: 문자 격자 -> public/assets/px/<키>.png  (B2 rice_cooker 등)"""
import json, os
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PAL = json.load(open(os.path.join(ROOT, 'art/pixel/palette.json')))
def pal(n):
    v = PAL[n] if n in PAL else None
    if isinstance(v, str): return v
    raise SystemExit('palette.json 구조 확인 필요: ' + n)
def draw(key, rows, legend):
    h, w = len(rows), len(rows[0])
    assert all(len(r) == w for r in rows), [len(r) for r in rows]
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != '.':
                v = legend[c].lstrip('#'); im.putpixel((x, y), tuple(int(v[i:i+2], 16) for i in (0, 2, 4)) + (255,))
    p = os.path.join(ROOT, 'public/assets/px', key + '.png'); im.save(p); return p
