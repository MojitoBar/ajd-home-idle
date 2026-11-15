# 보내기 묶음: python3 tools/shots-send.py  -> screenshots/send-1115/01~12
import os, shutil
from PIL import Image
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'screenshots')
OUT = os.path.join(R, 'send-1115'); os.makedirs(OUT, exist_ok=True)
F = lambda n: os.path.join(R, 'final', n)
U = lambda n: os.path.join(R, 'unpack-final', n)
cp = {'01-m-new': F('390-01-main-early.png'), '02-m-mid': F('390-02-main-mid.png'), '05-place': U('place.png'), '06-care': U('care.png'), '07-tierup': U('tierup.png'),
      '08-m-fever': F('390-22-fever.png'), '09-m-tool': F('390-04-tool-tab.png'), '10-m-box': F('390-05-box-tab.png'), '11-pc-1440': F('1440-02-main-mid.png'), '12-pc-fever': F('1440-22-fever.png')}
for k, v in cp.items(): shutil.copy(v, os.path.join(OUT, k + '.png'))
def stack(name, a, b):
    A, B = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
    w = max(A.width, B.width)
    im = Image.new('RGB', (w, A.height + 16 + B.height), (0x0d, 0x14, 0x30))
    im.paste(A, (0, 0)); im.paste(B, (0, A.height + 16)); im.save(os.path.join(OUT, name + '.png'))
S = os.path.join(R, 'unpack-study')
stack('03-hit-before-after', os.path.join(S, 'hit.png'), U('hit.png'))
stack('04-break-before-after', os.path.join(S, 'break.png'), U('break.png'))
print(sorted(os.listdir(OUT)))
