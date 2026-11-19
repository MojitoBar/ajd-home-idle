#!/usr/bin/env python3
"""공구함 카드 뒷면 3종(24x24). Codex 원화(art/pixel/card/motif-<키>.png, art/tools/card-gen.py로 생성)를
최근접 다수결로 줄여 팔레트에 맞추고, 희귀도별 틀·색을 Pillow로 얹는다.
실행: python3 tools/make-card-backs.py [--motif A|B|C] [--out DIR] [--preview PATH]  (결정적)"""
import os, sys
from collections import Counter
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N = '#0d1430'
H = lambda c: tuple(int(c[i:i+2], 16) for i in (1, 3, 5))
SRC = {'navy': H(N), 'dark': H('#0b3aa0'), 'mid': H('#145ce6'), 'light': H('#5b9bff'), 'white': H('#ffffff'), 'bg': H('#ff00ff')}
SRC['navy2'] = H('#16224a')

def classify(px):
    best = min(SRC, key=lambda k: sum((a - b) ** 2 for a, b in zip(px, SRC[k])))
    return 'navy' if best == 'navy2' else best

def motif_grid(key, w, h):
    im = Image.open(os.path.join(ROOT, 'art/pixel/card/motif-%s.png' % key)).convert('RGB')
    W, Hh = im.size
    cls = [[classify(im.getpixel((x, y))) for x in range(W)] for y in range(Hh)]
    xs = [x for y in range(Hh) for x in range(W) if cls[y][x] != 'bg']
    ys = [y for y in range(Hh) for x in range(W) if cls[y][x] != 'bg']
    x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
    s = max(x1 - x0, y1 - y0) / max(w, h)
    cw, ch = (x1 - x0) / s, (y1 - y0) / s
    ow, oh = round(cw), round(ch)
    out = {}
    for j in range(oh):
        for i in range(ow):
            cnt = Counter()
            for y in range(int(y0 + j * s), max(int(y0 + (j + 1) * s), int(y0 + j * s) + 1)):
                for x in range(int(x0 + i * s), max(int(x0 + (i + 1) * s), int(x0 + i * s) + 1)):
                    if y < Hh and x < W: cnt[cls[y][x]] += 1
            tot = sum(cnt.values())
            if cnt['bg'] * 2 > tot: continue
            cnt.pop('bg', None)
            # 외곽선 우선: 셀의 절반 가까이 남색이면 남색
            out[(i, j)] = 'navy' if cnt['navy'] * 3 >= tot else cnt.most_common(1)[0][0]
    return out, ow, oh

THEMES = {
    'common': dict(d1='#8a4f24', d2='#ecd3a0', d3='#8a4f24', face='#d08a4a', ramp=dict(dark='#8a4f24', mid='#ecd3a0', light='#fff3d6', white='#ffffff'), stud='#fff3d6'),
    'rare':   dict(d1='#8a96b8', d2='#ffffff', d3='#8a96b8', face='#d6dcec', ramp=dict(dark='#0b3aa0', mid='#145ce6', light='#5b9bff', white='#ffffff'), stud='#145ce6'),
    'legend': dict(d1='#ffc83d', d2='#ffeaa0', d3='#c98a00', face='#16224a', ramp=dict(dark='#c98a00', mid='#ffc83d', light='#ffeaa0', white='#ffffff'), stud='#e9304b'),
}

def render(name, key):
    th = THEMES[name]
    g = {}
    for y in range(24):
        for x in range(24):
            d = min(x, y, 23 - x, 23 - y)
            g[(x, y)] = [N, th['d1'], th['d2'], th['d3']][d] if d < 4 else th['face']
    if name == 'legend':
        pass
    if name == 'common':
        for x in range(4, 20):
            for y in range(4, 20):
                if min(x, y, 23 - x, 23 - y) == 4: g[(x, y)] = '#ecd3a0' if False else th['face']
    # 모서리 장식
    if name == 'common':
        for p in [(3, 3), (20, 3), (3, 20), (20, 20)]: g[p] = '#fff3d6'
    if name == 'rare':
        for (cx, cy) in [(3, 3), (20, 3), (3, 20), (20, 20)]:
            g[(cx, cy)] = N
        for (cx, cy) in [(2, 2), (21, 2), (2, 21), (21, 21)]:
            g[(cx, cy)] = '#5b9bff'
        for (cx, cy) in [(1, 1), (22, 1), (1, 22), (22, 22)]: g[(cx, cy)] = '#145ce6'
    if name == 'legend':
        for (cx, cy) in [(1, 1), (22, 1), (1, 22), (22, 22)]: g[(cx, cy)] = N
        for (cx, cy) in [(2, 2), (21, 2), (2, 21), (21, 21)]: g[(cx, cy)] = '#e9304b'
        for (cx, cy) in [(3, 3), (20, 3), (3, 20), (20, 20)]: g[(cx, cy)] = '#ffffff'
        for (cx, cy) in [(11, 3), (12, 3), (11, 20), (12, 20)]: g[(cx, cy)] = '#ffffff'
    m, ow, oh = motif_grid(key, 15, 15)
    if key == 'A':  # 손도트 보정: 손잡이·걸쇠에 광택
        m[(4, 1)] = 'white'; m[(7, 7)] = 'white'; m[(11, 5)] = 'white'
    ox, oy = (24 - ow) // 2, (24 - oh) // 2 + 1
    line = '#7a4a00' if name == 'legend' else N
    for (i, j), c in m.items():
        g[(ox + i, oy + j)] = line if c == 'navy' else th['ramp'][c]
    if name == 'legend':  # 배경 반짝 점
        for p in [(6, 5), (18, 6), (5, 18), (18, 19)]: g[p] = '#3b4a7a'
        for p in [(5, 7), (17, 18)]: g[p] = '#ffeaa0'
    if name == 'rare':  # 광택: 문양 왼쪽 위 흰 점
        pts = [(p, c) for p, c in m.items() if c == 'light']
        for (i, j), c in sorted(pts, key=lambda t: t[0][0] + t[0][1])[:2]: g[(ox + i, oy + j)] = '#ffffff'
    if name == 'legend':  # 문양 위 반짝임 십자(오른쪽 위)
        cx, cy = ox + ow - 2, oy + 1
        for dx, dy in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]:
            g[(cx + dx, cy + dy)] = '#ffffff'
        for dx, dy in [(0, -2), (0, 2), (2, 0), (-2, 0)]:
            if 4 <= cx + dx <= 19 and 4 <= cy + dy <= 19: g[(cx + dx, cy + dy)] = '#ffeaa0'
    im = Image.new('RGBA', (24, 24))
    for (x, y), c in g.items(): im.putpixel((x, y), H(c) + (255,))
    return im

PAL = [N, '#16224a', '#3b4a7a', '#8a96b8', '#d6dcec', '#ffffff', '#fff3d6', '#ecd3a0', '#8a4f24', '#d08a4a', '#0b3aa0', '#145ce6', '#5b9bff', '#bcd6ff', '#7a4a00', '#c98a00', '#ffc83d', '#ffeaa0', '#a8142d', '#e9304b', '#ff8a1f', '#2fb36b', '#8d5cf6', '#ff6fb0']

def preview(ims, path, scale=8):
    w = 24 * scale
    o = Image.new('RGB', (3 * (w + 16) + 16, 2 * (w + 16) + 16))
    for r, bg in enumerate(['#fff3d6', '#16224a']):
        for y in range(r * (w + 16) + 0, (r + 1) * (w + 16) + (16 if r else 0)): pass
        o.paste(Image.new('RGB', (o.width, w + 16), H(bg)), (0, r * (w + 16)))
        for i, im in enumerate(ims):
            o.paste(im.resize((w, w), 0).convert('RGB'), (16 + i * (w + 16), 8 + r * (w + 16)), im.resize((w, w), 0))
    o.save(path)

def preview2x(ims, path):
    o = Image.new('RGB', (3 * 64 + 16, 2 * 64), H('#fff3d6'))
    o.paste(Image.new('RGB', (o.width, 64), H('#16224a')), (0, 64))
    for r in range(2):
        for i, im in enumerate(ims):
            b = im.resize((48, 48), 0); o.paste(b, (16 + i * 64, 8 + r * 64), b)
    o.save(path)

if __name__ == '__main__':
    a = sys.argv
    key = a[a.index('--motif') + 1] if '--motif' in a else 'A'
    out = a[a.index('--out') + 1] if '--out' in a else os.path.join(ROOT, 'public/assets/px/card')
    os.makedirs(out, exist_ok=True)
    ims = []
    for n in ('common', 'rare', 'legend'):
        im = render(n, key); im.save(os.path.join(out, 'back-%s.png' % n)); ims.append(im)
    pal = {H(c) for c in PAL}
    for n, im in zip(('common', 'rare', 'legend'), ims):
        bad = sum(1 for p in im.getdata() if p[:3] not in pal); alpha = sum(1 for p in im.getdata() if p[3] != 255)
        print(n, im.size, '팔레트밖', bad, '반투명', alpha)
    if '--preview' in a:
        p = a[a.index('--preview') + 1]; preview(ims, p); preview2x(ims, p[:-4] + '-2x.png')
