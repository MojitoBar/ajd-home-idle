#!/usr/bin/env python3
"""B6 검증 합성본: 방 9곳 x (살림·상자·선반) 3배 확대 -> art/pixel/sheet-B6-rooms.png"""
import os, json
from PIL import Image, ImageDraw
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PX = os.path.join(ROOT, 'public/assets/px')
TOP = {'blue': 58, 'mint': 58, 'sunset': 56, 'night': 54, 'moon': 58, 'mars': 56, 'jupiter': 58, 'nebula': 54, 'edge': 52}
NAMES = ['blue', 'mint', 'sunset', 'night', 'moon', 'mars', 'jupiter', 'nebula', 'edge']
def ld(p): return Image.open(os.path.join(PX, p + '.png')).convert('RGBA')
def sil(im):
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste((236, 211, 160, 255), mask=im.split()[3]); return out
def put(bg, im, cx, bottom):
    bg.alpha_composite(im, (cx - im.width // 2, bottom - im.height))
def compose(n, wide=False):
    bg = ld('room/' + n)
    d = ImageDraw.Draw(bg)
    d.rectangle([10, 24, 169, 27], fill=(138, 79, 36))
    for i, s in enumerate(['internet', 'water', 'air']): bg.alpha_composite(ld('icon/svc-' + s), (10 + 20 * i, 0))
    put(bg, sil(ld('item/fridge')), 20, 86)
    put(bg, ld('item/washer'), 45, 86)
    t = TOP[n] + 3
    put(bg, sil(ld('item/rice_cooker')), 133, t); put(bg, ld('item/kettle'), 146, t); put(bg, ld('item/coffee_machine'), 159, t)
    put(bg, ld('box/normal-1'), 90, 114)
    return bg
if __name__ == '__main__':
    cols = 3; S = 3
    sheet = Image.new('RGB', (cols * (180 * S + 8) + 8, 3 * (130 * S + 8) + 8), (40, 40, 40))
    for i, n in enumerate(NAMES):
        im = compose(n).resize((180 * S, 130 * S), 0).convert('RGB')
        sheet.paste(im, (8 + (i % cols) * (180 * S + 8), 8 + (i // cols) * (130 * S + 8)))
    sheet.save(os.path.join(ROOT, 'art/pixel/sheet-B6-rooms.png'))
    for n in NAMES: compose(n).resize((540, 390), 0).save(f'/private/tmp/claude-501/-Users-judongseok/b87026c5-a45c-41c8-a4a9-ec179e698a7c/scratchpad/c-{n}.png')
