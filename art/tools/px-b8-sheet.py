#!/usr/bin/env python3
"""B8 시트: 수집품 20종 x 기본·황금·무지개 3줄 (4px 확대, 두 판으로 나눔) -> art/pixel/sheet-B8.png"""
import os
from PIL import Image
R=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
N="fan kettle toaster heating_pad hair_dryer humidifier rice_cooker water_purifier air_purifier air_fryer vacuum coffee_machine dishwasher air_conditioner washer smart_tv fridge massage_chair robot_vacuum space_purifier".split()
Z=5; C=32*Z+6
rows=[N[:10],N[10:]]
out=Image.new('RGB',(10*C+6,6*C+6),(255,243,214))
for g,names in enumerate(rows):
    for r,suf in enumerate(['','-gold','-rainbow']):
        for i,n in enumerate(names):
            im=Image.open(f'{R}/public/assets/px/col/{n}{suf}.png').convert('RGBA').resize((32*Z,32*Z),Image.NEAREST)
            out.paste(im,(6+i*C,6+(g*3+r)*C),im)
out.save(R+'/art/pixel/sheet-B8.png'); print(out.size)
