#!/usr/bin/env python3
"""B11 시트: 20종 x (기본 | 옛 무지개 | 새 무지개), 6배 -> art/pixel/sheet-B11.png"""
import os
from PIL import Image
R=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
N="fan kettle toaster heating_pad hair_dryer humidifier rice_cooker water_purifier air_purifier air_fryer vacuum coffee_machine dishwasher air_conditioner washer smart_tv fridge massage_chair robot_vacuum space_purifier".split()
Z=6; C=32*Z+4; COLS=4
rows=(len(N)+COLS-1)//COLS
out=Image.new('RGB',(COLS*3*C+8,rows*C+8),(255,243,214))
def ld(p): return Image.open(p).convert('RGBA').resize((32*Z,32*Z),Image.NEAREST)
for i,n in enumerate(N):
    for j,p in enumerate([f'{R}/public/assets/px/col/{n}.png',f'{R}/art/pixel/backup-b11/{n}-rainbow.png',f'{R}/public/assets/px/col/{n}-rainbow.png']):
        im=ld(p); out.paste(im,(8+(i%COLS*3+j)*C,8+(i//COLS)*C),im)
out.save(R+'/art/pixel/sheet-B11.png'); print(out.size)
