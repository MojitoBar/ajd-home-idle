#!/usr/bin/env python3
"""B7 시트: 기본·황금·무지개 3줄 (6px 확대, 크림/남색 바탕) -> art/pixel/sheet-B7.png"""
import os, sys
from PIL import Image
R=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
N="fan kettle toaster heating_pad hair_dryer humidifier rice_cooker water_purifier air_purifier air_fryer vacuum coffee_machine dishwasher".split()
Z=5; C=32*Z+6
out=Image.new('RGB',(len(N)*C+6,3*C+6),(255,243,214))
for r,suf in enumerate(['','-gold','-rainbow']):
    for i,n in enumerate(N):
        im=Image.open(f'{R}/public/assets/px/col/{n}{suf}.png').convert('RGBA').resize((32*Z,32*Z),Image.NEAREST)
        out.paste(im,(6+i*C,6+r*C),im)
out.save(R+'/art/pixel/sheet-B7.png'); print(out.size)
