from PIL import Image
import sys
R='public/assets/px/'
items=['air_purifier','coffee_machine','fan','fridge','kettle','rice_cooker','smart_tv','washer']
Z=8
rows=[[f'item/{n}{s}.png' for s in ('','-silver','-gold','-rainbow')] for n in items]
cols=[['col/massage_chair.png','col/massage_chair-gold.png','col/massage_chair-rainbow.png','col/air_conditioner-rainbow.png','col/dishwasher-rainbow.png','col/vacuum-rainbow.png']]
def load(p): return Image.open(R+p).convert('RGBA')
allr=rows+cols
W=max(sum(load(p).width*Z+16 for p in r) for r in allr)+16
H=sum(max(load(p).height*Z for p in r)+16 for r in allr)+16
sh=Image.new('RGBA',(W,H),(0xff,0xf3,0xd6,255))
y=16
for r in allr:
    x=16;rh=0
    for p in r:
        im=load(p).resize((load(p).width*Z,load(p).height*Z),Image.NEAREST)
        sh.paste(im,(x,y),im);x+=im.width+16;rh=max(rh,im.height)
    y+=rh+16
sh.convert('RGB').save('art/pixel/sheet-U3.png');print(sh.size)
