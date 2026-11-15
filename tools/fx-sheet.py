# 프레임 접지: python3 tools/fx-sheet.py <프레임폴더> <케이스> <출력png> [열수] [최대장수]
import sys, glob, json, os
from PIL import Image, ImageDraw
d, name, out = sys.argv[1:4]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 6
maxn = int(sys.argv[5]) if len(sys.argv) > 5 else 18
files = sorted(glob.glob(f'{d}/{name}-*.jpg'))
meta = {m['i']: m for m in json.load(open(f'{d}/{name}.json')) if 'i' in m}
if len(files) > maxn:
    idx = [round(k * (len(files) - 1) / (maxn - 1)) for k in range(maxn)]
    files = [files[k] for k in idx]
S = float(os.environ.get('FX_SCALE', '0.6'))
C0, C1 = [float(v) for v in os.environ.get('FX_CROP', '0.08,0.92').split(',')]
frames = []
for f in files:
    im = Image.open(f).convert('RGB')
    w, h = im.size
    im = im.crop((0, int(h * C0), w, int(h * C1))).resize((int(w * S), int(h * (C1 - C0) * S)))
    i = int(f.split('-')[-1].split('.')[0])
    ImageDraw.Draw(im).text((4, 3), f"{meta[i]['t']}ms", fill=(255, 255, 0))
    frames.append(im)
rows = (len(frames) + cols - 1) // cols
fw, fh = frames[0].size
sheet = Image.new('RGB', (cols * fw, rows * fh), (20, 20, 20))
for k, im in enumerate(frames):
    sheet.paste(im, ((k % cols) * fw, (k // cols) * fh))
sheet.save(out)
print(out, sheet.size, len(frames))
