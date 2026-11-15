#!/usr/bin/env python3
"""B9 시트: 집 아이콘 9장 8배 + 실제 크기 2배 줄 -> art/pixel/sheet-B9.png"""
import os
from PIL import Image
R=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
N="blue mint sunset night moon mars jupiter nebula edge".split()
Z=8; C=24*Z+8
out=Image.new('RGB',(9*C+8,C+24*2+16+8),(255,243,214))
for i,n in enumerate(N):
    im=Image.open(f'{R}/public/assets/px/icon/house-{n}.png').convert('RGBA')
    b=im.resize((24*Z,24*Z),Image.NEAREST); out.paste(b,(8+i*C,8),b)
    s=im.resize((48,48),Image.NEAREST); out.paste(s,(8+i*C,C+8),s)
out.save(R+'/art/pixel/sheet-B9.png'); print(out.size)
