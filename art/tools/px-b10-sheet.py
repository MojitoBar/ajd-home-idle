#!/usr/bin/env python3
"""B10 시트 -> art/pixel/sheet-B10.png (8배, 옛|새, 어두운/밝은 배경 띠)"""
import os
from PIL import Image
R=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
A=R+'/public/assets/px/'; B=R+'/art/pixel/backup-b10/'
Z=8
def L(p): return Image.open(p).convert('RGBA')
def big(im): return im.resize((im.width*Z,im.height*Z),Image.NEAREST)
redo=[('icon/house-mars','icon_house-mars'),('icon/house-moon','icon_house-moon'),('item/fan','item_fan'),('col/air_conditioner','col_air_conditioner'),('icon/box-open','icon_box-open'),('icon/bundle','icon_bundle')]
new=['ui/truck','ui/truck-2','icon/ui-tools']
W=1700; rows=[]
# row1: redo pairs
sheet=Image.new('RGB',(W,1500),(120,120,140))
x=10;y=10;rh=0
def put(im,bg=(255,243,214)):
    global x,y,rh
    if x+im.width+10>W: x=10;y+=rh+14;rh=0
    sheet.paste(Image.new('RGB',im.size,bg),(x,y)); sheet.paste(im,(x,y),im); x+=im.width+10; rh=max(rh,im.height)
for k,b in redo:
    put(big(L(B+b+'.png')),(22,34,74)); put(big(L(A+k+'.png')),(22,34,74)); x+=20
x=10;y+=rh+30;rh=0
for k in new:
    put(big(L(A+k+'.png')),(255,243,214)); put(big(L(A+k+'.png')),(22,34,74)); x+=10
for k in ['item/fan']:
    put(big(L(A+k+'.png')),(22,34,74)); put(big(L(A+k+'.png')),(255,243,214))
y+=rh+20
sheet.crop((0,0,W,y)).save(R+'/art/pixel/sheet-B10.png'); print(sheet.size,y)
