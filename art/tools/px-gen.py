#!/usr/bin/env python3
"""gen.py <manifestkey> [--refs a,b] [--extra 문장]  : Codex로 1장 생성해 art/raw/px/<폴더>-<이름>.png 저장"""
import sys, os, json, glob, subprocess, time, shutil
ROOT='/Users/judongseok/Developer/ajd-home-idle'
S=os.path.join(ROOT,'art','pixel','refs')
SUBJ=json.load(open(ROOT+'/art/pixel/subjects-B1.json')); SUBJ.update(json.load(open(ROOT+'/art/pixel/subjects-B2.json'))); SUBJ.update(json.load(open(ROOT+'/art/pixel/subjects-B3.json'))); SUBJ.update(json.load(open(ROOT+'/art/pixel/subjects-B7.json'))); SUBJ.update(json.load(open(ROOT+'/art/pixel/subjects-B8.json')))
STYLE=("Style: 16-bit pixel art drawn on a tiny {W}x{H} pixel canvas and then enlarged with nearest-neighbor. "
"The whole object is only about {W}x{H} big hard-edged square pixel blocks, so every block is large and clearly visible. "
"Use chunky simple shapes and big flat color areas, no fine detail, no tiny single-pixel specks, no noise, no texture dots. "
"A continuous 1-pixel-thick dark navy (#16224a) outline around the whole object; flat shading with only 2 or 3 tones per surface, light from the top-left; at most one or two small white pixel highlights. "
"Colors only from this palette: navy #16224a, steel #3b4a7a, grey #8a96b8, light grey #d6dcec, white, cream #fff3d6, sand #ecd3a0, dark brown #8a4f24, cardboard orange #d08a4a, blue #0b3aa0 #145ce6 #5b9bff #bcd6ff, gold #c98a00 #ffc83d #ffeaa0, red #e9304b. "
"Absolutely no anti-aliasing, no gradient, no glow, no sparkles, no shine, no drop shadow. Viewed from slightly above in a 3/4 front view. "
"Background: perfectly flat solid pure magenta #FF00FF, nothing else in the background. Never use magenta or pink in the object. No text, letters, numbers, logos, brand marks, people, hands or body parts.")
def main():
    key=sys.argv[1]; refs=[]; extra=''
    if '--refs' in sys.argv: refs=sys.argv[sys.argv.index('--refs')+1].split(',')
    if '--extra' in sys.argv: extra=sys.argv[sys.argv.index('--extra')+1]
    m=json.load(open(ROOT+'/art/pixel/manifest.json'))['assets'][key]
    W,H=m['w'],m['h']
    if m.get('kind')=='background':
        p=("Generate exactly ONE landscape image (3:2) of the empty interior wall-and-floor of a small studio apartment: "+SUBJ[key]+" "
           "Pixel art drawn on a 180x130 pixel canvas then enlarged with nearest-neighbor: every pixel is a big hard-edged square block about 8 image pixels wide, chunky simple shapes, flat colors, 2 tones per surface, no fine detail, no stray pixels, no anti-aliasing, no gradient, no shadows, no glow. "
           "Same exact art style, line weight, pixel block size and color mood as the attached sample room (cream wall, yellow-tan wood plank floor, navy outlines), but with the different layout given. Full-bleed picture with no border. No furniture, no shelves, no pictures on the wall, no text, no people.")
    else:
        p=("Generate exactly ONE image containing only this single object: "+SUBJ[key]+" Single object only, centered, filling about 75% of a square canvas. "
           +(("Attached image(s) are approved sprites from the same game: match their pixel block look, outline, shading and color mood exactly, but draw the different object described. Do not copy the attached object. ") if refs else '')
           +STYLE.format(W=W,H=H)+" "+extra+" Reminder: only one object.")
    before=set(glob.glob(os.path.expanduser('~/.codex/generated_images/**/*.png'),recursive=True))
    cmd=['codex','exec','--skip-git-repo-check']
    for r in refs: cmd+=['-i',S+'/'+r+'.png']
    cmd+=['-']
    t=time.time()
    r=subprocess.run(cmd,input=p,text=True,capture_output=True,cwd=ROOT,timeout=280)
    new=[f for f in glob.glob(os.path.expanduser('~/.codex/generated_images/**/*.png'),recursive=True) if f not in before]
    if not new: print(key,'FAIL no image',r.stdout[-300:],r.stderr[-300:]); return
    new.sort(key=os.path.getmtime)
    dst=ROOT+'/art/raw/px/'+key.replace('/','-')+'.png'
    if os.path.exists(dst): shutil.copy(dst, dst[:-4]+'.prev%d.png'%int(time.time()))
    shutil.copy(new[-1],dst)
    print(key,'ok',round(time.time()-t),'s',dst)
main()
