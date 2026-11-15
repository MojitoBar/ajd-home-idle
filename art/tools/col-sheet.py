#!/usr/bin/env python3
"""수집품 확인 시트: col-sheet.py <collectibles_dir> <out.png>. 등급 순 20종 x (기본·황금·무지개)."""
import sys, os
from PIL import Image, ImageDraw
ORDER = "fan kettle toaster heating_pad hair_dryer humidifier rice_cooker water_purifier air_purifier air_fryer vacuum coffee_machine dishwasher air_conditioner washer smart_tv fridge massage_chair robot_vacuum space_purifier".split()
D, OUT = sys.argv[1], sys.argv[2]
SKY, NAVY = (0xdb, 0xe8, 0xff), (0x10, 0x18, 0x30)
B, T, PAD, PER = 150, 56, 4, 4
cw = 3 * B + 2 * PAD; ch = B + T + 22
W = PER * cw + (PER - 1) * 10; rows = (len(ORDER) + PER - 1) // PER
sheet = Image.new('RGB', (W, rows * (ch + 8)), SKY)
d = ImageDraw.Draw(sheet)
for i, n in enumerate(ORDER):
    x0 = (i % PER) * (cw + 10); y0 = (i // PER) * (ch + 8)
    d.rectangle([x0, y0 + B, x0 + cw, y0 + ch], fill=NAVY)
    for k, suf in enumerate(['', '-gold', '-rainbow']):
        im = Image.open(os.path.join(D, f'{n}{suf}.png')).convert('RGBA')
        x = x0 + k * (B + PAD)
        big = im.resize((B, B), Image.LANCZOS); sheet.paste(big, (x, y0), big)
        sm = im.resize((T, T), Image.LANCZOS)
        d.rectangle([x, y0 + B, x + B // 2, y0 + B + T + 4], fill=SKY)
        sheet.paste(sm, (x + 8, y0 + B + 2), sm)
        nv = Image.new('RGBA', (T, T), NAVY + (255,)); nv.alpha_composite(sm)
        sheet.paste(nv.convert('RGB'), (x + B // 2 + 8, y0 + B + 2))
    d.text((x0 + 4, y0 + B + T + 8), f'{i+1} {n}', fill=(255, 255, 255))
sheet.save(OUT)
print(sheet.size)
