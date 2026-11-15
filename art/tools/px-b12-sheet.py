#!/usr/bin/env python3
"""B12 비교 시트: 기준 그림 + 전(backup-b12) / 후(현재). 8배 확대."""
import os, sys
from PIL import Image
R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
P = os.path.join(R, 'public/assets/px'); B = os.path.join(R, 'art/pixel/backup-b12')
refs = ['icon/house-blue', 'icon/house-night', 'ui/truck', 'icon/bundle-rental', 'col/fridge', 'col/washer']
refs = [r for r in refs if os.path.exists(f'{P}/{r}.png')]
tgt = ['icon/box-open', 'icon/house-moon', 'icon/bundle', 'col/massage_chair-rainbow', 'col/coffee_machine-rainbow']
S = 8
def L(p): return Image.open(p).convert('RGBA')
rows = [('ref', [L(f'{P}/{r}.png') for r in refs]),
        ('before', [L(f'{B}/{t.replace("/", "-")}.png') for t in tgt]),
        ('after', [L(f'{P}/{t}.png') for t in tgt])]
cw = 34 * S; ch = 34 * S
W = cw * max(len(r[1]) for r in rows); H = ch * len(rows)
sh = Image.new('RGBA', (W, H), (120, 130, 150, 255))
for ri, (_, ims) in enumerate(rows):
    for ci, im in enumerate(ims):
        im = im.resize((im.width * S, im.height * S), Image.NEAREST)
        sh.alpha_composite(im, (ci * cw + (cw - im.width) // 2, ri * ch + (ch - im.height) // 2))
sh.convert('RGB').save(os.path.join(R, 'art/pixel/sheet-B12.png'))
