#!/usr/bin/env python3
"""기존 택배 상자 도트를 팔레트 치환해 특별 상자(gold/bomb/clock) 24장을 만든다.
실행: python3 tools/make-special-boxes.py [--sheet-dir DIR]  (결정적: 항상 같은 결과)"""
import os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOX = os.path.join(ROOT, 'public/assets/px/box')

def h(s): return tuple(int(s[i:i+2], 16) for i in (1, 3, 5)) + (255,)

OUTLINE = h('#16224a')
SRC = {h('#16224a'): '#', h('#8a4f24'): 'd', h('#d08a4a'): 'f',
       h('#ecd3a0'): 't', h('#fff3d6'): 'T'}

# 면 이름 -> 색.  top=윗면, front=앞면, side=옆면, deep=앞면/내부 그늘·찌그러진 자국,
# tape=테이프, tapeShade=테이프 오른쪽 끝 한 줄
THEMES = {
    'gold': dict(top='#ffeaa0', front='#ffc83d', side='#c98a00', deep='#7a4a00',
                 tape='#ffffff', tapeShade='#fff3d6'),
    'bomb': dict(top='#8a96b8', front='#3b4a7a', side='#16224a', deep='#16224a',
                 tape='#e9304b', tapeShade='#a8142d'),
    'clock': dict(top='#5b9bff', front='#145ce6', side='#0b3aa0', deep='#0b3aa0',
                  tape='#ffffff', tapeShade='#bcd6ff'),
}

# 표식(도트). 글자 -> 색
KEY = {'N': '#0d1430', 'W': '#ffffff', 'O': '#ff8a1f', 'Y': '#ffc83d', 'f': '#ecd3a0'}
BOMB9 = ["......OY.", ".....f...", ".....f...", "..NNNNN..", ".NNNNNNN.",
         ".NWNNNNN.", ".NNNNNNN.", ".NNNNNNN.", "..NNNNN.."]
BOMB7 = [".....OY", "....f..", "..NNN..", ".NNNNN.", ".NWNNN.", ".NNNNN.", "..NNN.."]
CLOCK9 = ["..NNNNN..", ".NWWWWWN.", "NWWWWWWWN", "NWWWNWWWN", "NWWWNWWWN",
          "NWWWNNNWN", "NWWWWWWWN", ".NWWWWWN.", "..NNNNN.."]
CLOCK7 = [".NNNNN.", "NWWWWWN", "NWWNWWN", "NWWNNWN", "NWWWWWN", "NWWWWWN", ".NNNNN."]
PLUS = [(0, -1), (-1, 0), (0, 0), (1, 0), (0, 1)]

# 그림별 표식 왼쪽 위 좌표 (앞면 빈 자리). 9x9=normal, 7x7=small
POS = {
    ('normal', '1'): (4, 23), ('normal', '2'): (4, 23), ('normal', '3'): (4, 23),
    ('normal', 'open'): (4, 25),
    ('small', '1'): (14, 19), ('small', '2'): (14, 19), ('small', '3'): (14, 19),
    ('small', 'open'): (14, 18),
}
SPARK = {  # 반짝임 십자 중심들
    'normal': [(7, 26), (11, 31)], 'small': [(16, 21), (19, 25)],
}
SPARK_OPEN = {'normal': [(7, 26), (11, 31)], 'small': [(16, 18), (19, 22)]}

def recolor(src, theme):
    t = {k: h(v) for k, v in theme.items()}
    w, hh = src.size
    out = Image.new('RGBA', src.size, (0, 0, 0, 0))
    code = [[SRC.get(src.getpixel((x, y))) if src.getpixel((x, y))[3] else None
             for x in range(w)] for y in range(hh)]
    # 옆면 판정: 줄마다 윤곽선 뒤 가장 오른쪽 비윤곽 덩어리의 d
    side = set()
    for y in range(hh):
        xs = [x for x in range(w) if code[y][x] not in (None, '#')]
        if not xs: continue
        x = xs[-1]
        while x >= 0 and code[y][x] not in (None, '#'):
            if code[y][x] == 'd': side.add((x, y))
            x -= 1
    seen, small = set(), set()
    for y in range(hh):
        for x in range(w):
            if code[y][x] != 'd' or (x, y) in side or (x, y) in seen: continue
            comp, st = [], [(x, y)]
            seen.add((x, y))
            while st:
                cx, cy = st.pop(); comp.append((cx, cy))
                for nx, ny in ((cx+1, cy), (cx-1, cy), (cx, cy+1), (cx, cy-1)):
                    if 0 <= nx < w and 0 <= ny < hh and code[ny][nx] == 'd' and (nx, ny) not in side and (nx, ny) not in seen:
                        seen.add((nx, ny)); st.append((nx, ny))
            if len(comp) <= 40: small.update(comp)
    for y in range(hh):
        for x in range(w):
            c = code[y][x]
            if c is None: continue
            if c == '#': col = OUTLINE
            elif c == 'd': col = t['deep'] if (x, y) in small else t['side']
            elif c == 'f': col = t['front']
            elif c == 't': col = t['top']
            else:
                shade = x + 1 < w and code[y][x + 1] != 'T'
                col = t['tapeShade'] if shade else t['tape']
            out.putpixel((x, y), col)
    return out

def stamp(img, pattern, x0, y0):
    for dy, row in enumerate(pattern):
        for dx, ch in enumerate(row):
            if ch != '.': img.putpixel((x0 + dx, y0 + dy), h(KEY[ch]))

def make(kind, size, step):
    src = Image.open(os.path.join(BOX, f'{size}-{step}.png')).convert('RGBA')
    img = recolor(src, THEMES[kind])
    x0, y0 = POS[(size, step)]
    big = size == 'normal'
    if kind == 'gold':
        for cx, cy in (SPARK_OPEN if step == 'open' else SPARK)[size]:
            for dx, dy in PLUS: img.putpixel((cx + dx, cy + dy), h('#ffffff'))
    elif kind == 'bomb':
        stamp(img, BOMB9 if big else BOMB7, x0, y0)
    else:
        stamp(img, CLOCK9 if big else CLOCK7, x0, y0)
    return img

def build():
    out = {}
    for kind in THEMES:
        for size in ('small', 'normal'):
            for step in ('1', '2', '3', 'open'):
                out[f'{kind}-{size}-{step}'] = make(kind, size, step)
    return out

def check(imgs):
    pal = {h(c) for c in ['#0d1430', '#16224a', '#3b4a7a', '#8a96b8', '#d6dcec', '#ffffff', '#fff3d6', '#ecd3a0',
           '#8a4f24', '#d08a4a', '#0b3aa0', '#145ce6', '#5b9bff', '#bcd6ff', '#7a4a00', '#c98a00', '#ffc83d',
           '#ffeaa0', '#a8142d', '#e9304b', '#ff8a1f', '#2fb36b', '#8d5cf6', '#ff6fb0']}
    bad = 0
    for name, im in imgs.items():
        size = name.split('-')[1]
        ref = Image.open(os.path.join(BOX, f'{size}-{name.split("-")[2]}.png'))
        if im.size != ref.size: print('크기 불일치', name); bad += 1
        for p in im.getdata():
            if p[3] not in (0, 255): print('반투명', name); bad += 1; break
            if p[3] == 255 and p not in pal: print('팔레트 밖', name, p); bad += 1; break
    return bad

def sheet(imgs, size, path):
    S, G = 8, 8
    kinds = ['normal'] + list(THEMES)
    steps = ['1', '2', '3', 'open']
    w0 = max(Image.open(os.path.join(BOX, f'{size}-1.png')).size)
    W = G + len(steps) * (w0 * S + G); H = G + len(kinds) * (w0 * S + G)
    sh = Image.new('RGBA', (W, H), h('#d08a4a'))
    for r, k in enumerate(kinds):
        for c, st in enumerate(steps):
            im = (Image.open(os.path.join(BOX, f'{size}-{st}.png')).convert('RGBA') if k == 'normal'
                  else imgs[f'{k}-{size}-{st}'])
            im = im.resize((w0 * S, w0 * S), Image.NEAREST)
            sh.alpha_composite(im, (G + c * (w0 * S + G), G + r * (w0 * S + G)))
    sh.save(path)

if __name__ == '__main__':
    imgs = build()
    bad = check(imgs)
    if bad: sys.exit(f'검사 실패 {bad}건')
    for name, im in imgs.items(): im.save(os.path.join(BOX, name + '.png'))
    print(f'{len(imgs)}장 저장, 검사 통과')
    if '--sheet-dir' in sys.argv:
        d = sys.argv[sys.argv.index('--sheet-dir') + 1]
        for size in ('small', 'normal'): sheet(imgs, size, os.path.join(d, f'special-boxes-sheet-{size}.png'))
