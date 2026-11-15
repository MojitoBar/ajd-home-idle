#!/usr/bin/env python3
"""도트 그림 후처리. 사양: DESIGN-PIXEL.md 6절 "후처리 스크립트".
  px.py make <이름|묶음>...   art/raw/px/<폴더>-<이름>.png -> public/assets/px/<폴더>/<이름>.png
  px.py variant <이름> gold|rainbow|silver
  px.py check [묶음|이름]...  (실패 시 종료 코드 1)
  px.py sheet <묶음>          art/pixel/sheet-<묶음>.png
이름은 manifest 키 "폴더/이름"(예: item/fan). 묶음은 B1 같은 manifest의 bundle 값."""
import sys, os, json, argparse
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PIXDIR = os.path.join(ROOT, 'art', 'pixel')
RAWDIR = os.path.join(ROOT, 'art', 'raw', 'px')
OUTDIR = os.path.join(ROOT, 'public', 'assets', 'px')
KEYS = {'magenta': (255, 0, 255), 'green': (0, 255, 0)}
MAX_COLORS = 16
KEY_DIST = 90


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


PAL = {k: hex2rgb(v) for k, v in json.load(open(os.path.join(PIXDIR, 'palette.json'))).items()}
PAL_NAMES = list(PAL)
PAL_RGB = np.array([PAL[k] for k in PAL_NAMES], dtype=np.float64)
MANIFEST = json.load(open(os.path.join(PIXDIR, 'manifest.json')))
ASSETS = MANIFEST['assets']


def oklab(rgb):
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    l = np.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    m = np.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s = np.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
                     1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], -1)


PAL_LAB = oklab(PAL_RGB)


def raw_path(key):
    return os.path.join(RAWDIR, key.replace('/', '-') + '.png')


def out_path(key, suffix=''):
    f, n = key.split('/')
    return os.path.join(OUTDIR, f, n + suffix + '.png')


def resolve(args):
    keys = []
    for a in args:
        if a in ASSETS:
            keys.append(a)
        else:
            m = [k for k, v in ASSETS.items() if v['bundle'] == a]
            if not m:
                sys.exit(f'알 수 없는 이름/묶음: {a}')
            keys += m
    return keys


def edge_connected_key(rgb, key):
    """키 색 근처(거리 < 90) 화소 전부 배경. 설계서는 가장자리와 이어진 것만이지만,
    선풍기 안쪽 구멍처럼 막힌 구멍도 투명이어야 해서 전부 지운다(보라·분홍 몸통은 key: green)."""
    d = np.sqrt(((rgb.astype(np.float64) - np.array(key)) ** 2).sum(-1))
    return d < KEY_DIST


def area_resize(arr, w, h):
    """float HxWxC 배열을 면적 평균으로 (w,h)로."""
    chans = [np.array(Image.fromarray(arr[..., c].astype(np.float32), 'F').resize((w, h), Image.BOX))
             for c in range(arr.shape[-1])]
    return np.stack(chans, -1)


def find_floor(rgb):
    """가장 강한 가로 경계(행 평균색 변화)의 y(경계 아래 첫 행)."""
    h = rgb.shape[0]
    rows = rgb.astype(np.float64).mean(1)
    k = max(2, h // 128)
    diff = np.zeros(h)
    for y in range(k, h - k):
        diff[y] = np.abs(rows[y:y + k].mean(0) - rows[y - k:y].mean(0)).sum()
    lo, hi = int(h * .4), int(h * .85)
    return lo + int(np.argmax(diff[lo:hi]))


def nearest_idx(rgb):
    """OKLab 기준 가장 가까운 팔레트 색 인덱스(행 단위로 나눠 계산)."""
    out = np.zeros(rgb.shape[:2], dtype=np.int16)
    for y in range(0, rgb.shape[0], 64):
        lab = oklab(rgb[y:y + 64])
        out[y:y + 64] = ((lab[..., None, :] - PAL_LAB) ** 2).sum(-1).argmin(-1)
    return out


def merge_limit(idx, op):
    """16색 초과 시 OKLab에서 가장 가까운 두 색을 병합(적게 쓰인 쪽이 흡수됨)."""
    while True:
        used = np.unique(idx[op])
        if len(used) <= MAX_COLORS:
            return idx
        cnt = {u: int((idx[op] == u).sum()) for u in used}
        best = None
        for i, a in enumerate(used):
            for b in used[i + 1:]:
                dd = ((PAL_LAB[a] - PAL_LAB[b]) ** 2).sum()
                if best is None or dd < best[0]:
                    best = (dd, a, b)
        _, a, b = best
        lose, keep = (a, b) if cnt[a] < cnt[b] else (b, a)
        idx[idx == lose] = keep


def mode_reduce(idx, fg, w, h):
    """원본 팔레트 인덱스 지도를 w x h 칸으로 줄인다. 칸마다 최빈 색, 전경이 50% 이상 덮어야 불투명."""
    ys = np.linspace(0, idx.shape[0], h + 1).round().astype(int)
    xs = np.linspace(0, idx.shape[1], w + 1).round().astype(int)
    out = np.zeros((h, w), dtype=np.int16)
    al = np.zeros((h, w), dtype=int)
    for j in range(h):
        for i in range(w):
            cf = fg[ys[j]:ys[j + 1], xs[i]:xs[i + 1]]
            if cf.size == 0 or cf.mean() < .5:
                continue
            ci = idx[ys[j]:ys[j + 1], xs[i]:xs[i + 1]][cf]
            out[j, i] = np.bincount(ci, minlength=len(PAL_NAMES)).argmax()
            al[j, i] = 255
    return out, al


def border_mask(op):
    p = np.pad(op, 1, constant_values=False)
    nb = p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    return op & ~nb


def make(key):
    a = ASSETS[key]
    W, H = a['w'], a['h']
    src = raw_path(key)
    if not os.path.exists(src):
        print(f'[{key}] 원본 없음: {src}')
        return False
    rgba = np.array(Image.open(src).convert('RGB'))
    if a.get('kind') == 'background':
        hr, wr = rgba.shape[:2]
        fy = find_floor(rgba)
        hc = min(wr * H / W, hr)
        t = fy - hc * a.get('floorY', 80) / H
        wc = hc * W / H
        l = (wr - wc) / 2
        pad = int(max(hr, wr) * .6)
        big = np.pad(rgba, ((pad, pad), (pad, pad), (0, 0)), mode='edge')
        box = (round(l + pad), round(t + pad), round(l + pad + wc), round(t + pad + hc))
        img = Image.fromarray(big).crop(box)
        full = np.array(img)
        idx, alpha = mode_reduce(nearest_idx(full), np.ones(full.shape[:2], bool), W, H)
        print(f'[{key}] 원본 바닥선 y={fy}, 자른 영역 {box}')
    else:
        key_rgb = KEYS[a.get('key', 'magenta')]
        bg = edge_connected_key(rgba, key_rgb)
        ys, xs = np.where(~bg)
        if len(ys) == 0:
            print(f'[{key}] 키 색만 있음')
            return False
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        fgm = ~bg[y0:y1, x0:x1]
        ch, cw = fgm.shape
        sc = min((W - 2) / cw, (H - 2) / ch)
        nw, nh = min(max(1, round(cw * sc)), W - 2), min(max(1, round(ch * sc)), H - 2)
        sidx, sal = mode_reduce(nearest_idx(rgba[y0:y1, x0:x1]), fgm, nw, nh)
        ox = (W - nw) // 2
        oy = H - 1 - nh if a.get('anchor', 'center') == 'bottom' else (H - nh) // 2
        idx = np.zeros((H, W), dtype=np.int16)
        alpha = np.zeros((H, W), dtype=int)
        idx[oy:oy + nh, ox:ox + nw] = sidx
        alpha[oy:oy + nh, ox:ox + nw] = sal
    idx = merge_limit(idx, alpha > 0)
    out = np.zeros((H, W, 4), dtype=np.uint8)
    out[..., :3] = PAL_RGB[idx].astype(np.uint8)
    out[..., 3] = alpha
    if a.get('kind') != 'background':
        bm = border_mask(alpha > 0)
        out[bm, :3] = PAL['k1']
    p = out_path(key)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    Image.fromarray(out, 'RGBA').save(p)
    print(f'[{key}] -> {os.path.relpath(p, ROOT)}')
    return True


def lum(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def _dense(im, op, names):
    """names 색 화소 중 3x3 안에 같은 계열이 7개 이상인 것(굵은 면). 얇은 선은 False"""
    cs = [PAL[n] for n in names]
    m = np.zeros(op.shape, bool)
    for c in cs:
        m |= (im[..., :3] == np.array(c, dtype=np.uint8)).all(-1)
    m &= op
    p = np.pad(m, 1).astype(int)
    cnt = sum(p[dy:dy + m.shape[0], dx:dx + m.shape[1]] for dy in range(3) for dx in range(3))
    return m & (cnt >= 7), m


# 무지개 id별 예외: {'bands': [팔레트 이름...]} 로 띠를 칠할 면 색을 직접 지정
RB_CFG = {
    'air_fryer': {'bands': ['k2', 'k3', 'k4']},
    'air_purifier': {'bands': ['k4', 'k3']},
    'massage_chair': {'bands': ['r1', 'r2'], 'dense': 8},
    'coffee_machine': {'bands': ['k2', 'k3', 'k4']},
}


# 은 단계 id별 광택 띠 (주기, 위상, 폭)
RB_SILVER = {'fan': (7, 0, 0)}


def variant(key, kind):
    im = np.array(Image.open(out_path(key)).convert('RGBA'))
    op = im[..., 3] > 0
    border = border_mask(op)
    inner = op & ~border
    out = im.copy()
    if kind == 'gold':
        # 외곽선 k0/k1 중 얇은 선은 유지, 굵은 어두운 면은 면으로 취급
        dense, _ = _dense(im, op, ('k0', 'k1'))
        dense &= inner
        k0, k1, k5 = (np.array(PAL[n], dtype=np.uint8) for n in ('k0', 'k1', 'k5'))
        isline = inner & ((im[..., :3] == k0).all(-1) | (im[..., :3] == k1).all(-1)) & ~dense
        face = inner & ~isline
        cols = {}
        for y, x in zip(*np.where(face)):
            if (im[y, x, :3] == k5).all():
                continue
            cols[tuple(im[y, x, :3])] = cols.get(tuple(im[y, x, :3]), 0) + 1
        ramp = {n: PAL[n] for n in ('g0', 'g1', 'g2', 'g3')}
        mp = {}
        if cols:
            main = max(cols, key=cols.get)
            tot = sum(cols.values())
            dark = sorted([c for c in cols if lum(c) < lum(main)], key=lum, reverse=True)
            for c in cols:
                if c == main:
                    mp[c] = ramp['g2']
                elif lum(c) > lum(main):
                    mp[c] = ramp['g3']
            for c in dark:
                mp[c] = ramp['g1']
            if dark and cols[dark[-1]] < .15 * tot:
                mp[dark[-1]] = ramp['g0']
            elif len(dark) > 1 and cols[dark[-1]] < .30 * tot:
                mp[dark[-1]] = ramp['g0']
        # 반짝이는 점: 원래 k5 중 작은 덩어리만 유지, 나머지는 g3
        wm = (im[..., :3] == k5).all(-1) & inner
        for y, x in zip(*np.where(face)):
            c = tuple(im[y, x, :3])
            if wm[y, x]:
                out[y, x, :3] = PAL['g3']
            else:
                out[y, x, :3] = mp[c]
        # k5가 g3로 바뀐 중 일부만 흰 점으로: 맨 위-왼쪽 하이라이트 최대 3개
        ws = sorted(zip(*np.where(wm)), key=lambda t: (t[0] + t[1]))[:3]
        for y, x in ws[:2]:
            out[y, x, :3] = PAL['k5']
    elif kind == 'rainbow':
        cfg = RB_CFG.get(key.split('/')[-1], {})
        k5 = (im[..., :3] == np.array(PAL['k5'], dtype=np.uint8)).all(-1) & inner
        skip = {tuple(PAL[n]) for n in ('k0', 'k1', 'k2', 'k5')}
        cols = {}
        for y, x in zip(*np.where(inner)):
            c = tuple(int(v) for v in im[y, x, :3])
            if c not in skip:
                cols[c] = cols.get(c, 0) + 1
        order = sorted(cols, key=cols.get, reverse=True)
        total = int(inner.sum())
        if 'bands' in cfg:
            bands = [tuple(PAL[n]) for n in cfg['bands']]
        else:
            bands = order[:1]
            for c in order[1:]:
                if lum(c) >= lum(bands[0]) and cols[c] >= .5 * cols[bands[0]]:
                    bands.append(c)
                    break
            for c in order:
                if sum(cols[b] for b in bands) >= .30 * total:
                    break
                if c not in bands:
                    bands.append(c)
        body = np.zeros(op.shape, bool)
        for c in bands:
            body |= (im[..., :3] == np.array(c, dtype=np.uint8)).all(-1)
        body &= inner
        if 'dense' in cfg:
            pb = np.pad(body, 1).astype(int)
            body &= sum(pb[dy:dy + op.shape[0], dx:dx + op.shape[1]] for dy in range(3) for dx in range(3)) >= cfg['dense']
        ramp = [PAL[n] for n in ('r2', 'or', 'g2', 'gn', 'b3', 'pu')]
        for y, x in zip(*np.where(body)):
            out[y, x, :3] = ramp[((x + y) // 3) % 6]
        H, W = op.shape
        for y, x in zip(*np.where(body)):
            c = tuple(out[y, x, :3])
            nb = [tuple(out[y + dy, x + dx, :3]) for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))
                  if 0 <= y + dy < H and 0 <= x + dx < W and op[y + dy, x + dx]]
            if nb and c not in nb:
                out[y, x, :3] = max(set(nb), key=nb.count)
        # 흰 반짝: 원래 k5는 좌상단 1~2점만 유지, 나머지는 면 색으로
        ws = sorted(zip(*np.where(k5)), key=lambda t: (t[0] + t[1]))
        for y, x in ws[2:]:
            nb = [tuple(out[y + dy, x + dx, :3]) for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))
                  if 0 <= y + dy < H and 0 <= x + dx < W and op[y + dy, x + dx]
                  and tuple(out[y + dy, x + dx, :3]) != tuple(PAL['k5'])]
            if nb:
                out[y, x, :3] = max(set(nb), key=nb.count)
    elif kind == 'silver':
        # 무채색 크롬: 면을 밝기 3단(k2/k3/k4)으로 재배치, 어두운 k0/k1 선·화면은 유지,
        # 가장 밝은 면에 k5 대각 광택 띠와 3x3 흰 십자 반짝
        keep = {tuple(PAL[n]) for n in ('k0', 'k1')}
        k5c = tuple(PAL['k5'])
        cols = {}
        for y, x in zip(*np.where(inner)):
            c = tuple(int(v) for v in im[y, x, :3])
            if c not in keep:
                cols[c] = cols.get(c, 0) + 1
        order = sorted(cols, key=lum)
        tot = sum(cols.values())
        mp, acc = {}, 0
        for c in order:
            f = (acc + cols[c] / 2) / tot
            mp[c] = PAL['k2'] if f < .28 else PAL['k3'] if f < .60 else PAL['k4']
            acc += cols[c]
        for y, x in zip(*np.where(inner)):
            c = tuple(int(v) for v in im[y, x, :3])
            if c in mp:
                out[y, x, :3] = mp[c]
        H, W = op.shape
        lt = (out[..., :3] == np.array(PAL['k4'], dtype=np.uint8)).all(-1) & inner
        p_ = np.pad(lt, 1).astype(int)
        dn = lt & (sum(p_[dy:dy + H, dx:dx + W] for dy in range(3) for dx in range(3)) >= 5)
        sv = RB_SILVER.get(key.split('/')[-1], (7, 0, 2))
        for y, x in zip(*np.where(dn)):
            if (x + y - sv[1]) % sv[0] < sv[2]:
                out[y, x, :3] = PAL['k5']
        # 흰 십자: 3x3이 모두 밝은 면인 자리 중 좌상단 가장 가까운 곳
        cand = [(y, x) for y, x in zip(*np.where(dn)) if 0 < y < H - 1 and 0 < x < W - 1
                and lt[y - 1:y + 2, x - 1:x + 2].all()]
        cand.sort(key=lambda t: (t[0] + t[1], t[0]))
        put = []
        for y, x in cand:
            if len(put) >= 2:
                break
            if all(abs(y - py) + abs(x - px) > 6 for py, px in put):
                put.append((y, x))
        for y, x in put:
            for dy, dx in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
                out[y + dy, x + dx, :3] = PAL['k5']
    else:
        sys.exit('gold|rainbow|silver')
    if key.endswith('rice_cooker'):   # 예외: 작은 그림이라 고립 도트가 6%를 넘어 이웃 색으로 흡수
        for y, x in zip(*np.where(inner)):
            c = tuple(out[y, x, :3])
            nb = [tuple(out[y + dy, x + dx, :3]) for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))
                  if 0 <= y + dy < op.shape[0] and 0 <= x + dx < op.shape[1] and op[y + dy, x + dx]]
            if nb and c not in nb and c != tuple(PAL['k5']):
                out[y, x, :3] = max(set(nb), key=nb.count)
    p = out_path(key, '-' + kind)
    Image.fromarray(out, 'RGBA').save(p)
    print(f'[{key}] -> {os.path.relpath(p, ROOT)}')


def dense_white(m):
    p = np.pad(m, 1).astype(int)
    cnt = sum(p[dy:dy + m.shape[0], dx:dx + m.shape[1]] for dy in range(3) for dx in range(3))
    return m & (cnt >= 5)


def check(key):
    a = ASSETS[key]
    p = out_path(key)
    if not os.path.exists(p):
        return [f'파일 없음 {p}']
    im = np.array(Image.open(p).convert('RGBA'))
    W, H = a['w'], a['h']
    errs = []
    if im.shape[:2] != (H, W):
        return [f'크기 {im.shape[1]}x{im.shape[0]} != {W}x{H}']
    al = im[..., 3]
    if not set(np.unique(al)) <= {0, 255}:
        errs.append('알파가 0/255 이외 값 포함')
    op = al == 255
    cols = {tuple(c) for c in im[op][:, :3]}
    palset = set(PAL.values())
    bad = cols - palset
    if bad:
        errs.append(f'팔레트 밖 색 {len(bad)}개')
    if len(cols) > MAX_COLORS:
        errs.append(f'색 {len(cols)}개 > {MAX_COLORS}')
    kr = np.array(KEYS[a.get('key', 'magenta')])
    if (np.sqrt(((im[op][:, :3].astype(float) - kr) ** 2).sum(-1)) < KEY_DIST).any():
        errs.append('키 색 잔여')
    if min(np.sqrt(((PAL_RGB - kr) ** 2).sum(-1))) < 100:
        errs.append('키 색이 팔레트와 너무 가까움')
    if a.get('kind') != 'background':
        bm = border_mask(op)
        if (im[bm][:, :3] != np.array(PAL['k1'])).any():
            errs.append('바깥 테두리가 k1이 아님')
        if op[0].any() or op[-1].any() or op[:, 0].any() or op[:, -1].any():
            errs.append('가장자리 1도트가 투명하지 않음')
    # 고립 1도트
    lab = np.zeros((H, W), dtype=int)
    for i, c in enumerate(PAL_RGB):
        lab[(im[..., :3] == c.astype(np.uint8)).all(-1)] = i + 1
    lab[~op] = 0
    pl = np.pad(lab, 1)
    same = ((pl[:-2, 1:-1] == lab) | (pl[2:, 1:-1] == lab) | (pl[1:-1, :-2] == lab) | (pl[1:-1, 2:] == lab))
    iso = (op & ~same).sum()
    ratio = iso / max(1, op.sum())
    if ratio > .06:
        errs.append(f'축소 잡음: 고립 도트 {ratio * 100:.1f}% > 6%')
    a['_stat'] = f'색 {len(cols)}, 고립 {ratio * 100:.1f}%'
    return errs


def sheet(bundle):
    keys = resolve([bundle])
    bgs = [PAL['p1'], PAL['k1'], PAL['b1']]
    Z, GAP, MAXW = 4, 16, 1700
    rows_h = []
    for bg in bgs:
        x = y = rh = 0
        for k in keys:
            w, h = ASSETS[k]['w'] * Z, ASSETS[k]['h'] * Z
            if x + w > MAXW and x:
                x, y, rh = 0, y + rh + GAP, 0
            x += w + GAP
            rh = max(rh, h)
        rows_h.append(y + rh + GAP)
    total = sum(rows_h)
    sh = Image.new('RGB', (MAXW + GAP, total), (128, 128, 128))
    oy = 0
    for bg, rhh in zip(bgs, rows_h):
        ImageDraw.Draw(sh).rectangle([0, oy, MAXW + GAP, oy + rhh], fill=bg)
        x = GAP // 2
        y = oy + GAP // 2
        rh = 0
        for k in keys:
            im = Image.open(out_path(k)).convert('RGBA')
            im = im.resize((im.width * Z, im.height * Z), Image.NEAREST)
            if x + im.width > MAXW and x > GAP // 2:
                x, y, rh = GAP // 2, y + rh + GAP, 0
            sh.paste(im, (x, y), im)
            x += im.width + GAP
            rh = max(rh, im.height)
        oy += rhh
    p = os.path.join(PIXDIR, f'sheet-{bundle}.png')
    sh.save(p)
    print('->', os.path.relpath(p, ROOT), sh.size)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('make').add_argument('names', nargs='+')
    v = sub.add_parser('variant')
    v.add_argument('name')
    v.add_argument('kind', choices=['gold', 'rainbow', 'silver'])
    sub.add_parser('check').add_argument('names', nargs='*')
    sub.add_parser('sheet').add_argument('bundle')
    a = ap.parse_args()
    if a.cmd == 'make':
        ok = all([make(k) for k in resolve(a.names)])
        sys.exit(0 if ok else 1)
    elif a.cmd == 'variant':
        variant(a.name, a.kind)
    elif a.cmd == 'check':
        keys = resolve(a.names) if a.names else list(ASSETS)
        fail = 0
        for k in keys:
            e = check(k)
            print(('FAIL ' if e else 'ok   ') + k + ('  ' + '; '.join(e) if e else '  ' + ASSETS[k].get('_stat', '')))
            fail += bool(e)
        print(f'{len(keys) - fail}/{len(keys)} 통과')
        sys.exit(1 if fail else 0)
    else:
        sheet(a.bundle)


if __name__ == '__main__':
    main()
