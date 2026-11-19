#!/usr/bin/env python3
"""card-gen.py <A|B|C> : Codex로 카드 뒷면 문양 원화 1장 -> art/pixel/card/motif-<키>.png (순차 실행)"""
import sys, os, glob, subprocess, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SUBJ = {
 'A': "a front view of a toolbox: a wide rectangular box body with a lid band across the top, a chunky carry handle arched over the top, a small square latch in the exact center, and two small corner brackets. Symmetric, left-right mirrored.",
 'B': "ONE large open-end spanner (wrench) lying on a perfect 45-degree diagonal from lower-left to upper-right, one thick bold stroke, with a big C-shaped open jaw at the upper-right end and a round hole ring at the lower-left end. Nothing else. It must not look like a letter.",
 'C': "ONE big gear (cog wheel) with 8 chunky square teeth and a round hole in the center, front view, symmetric. Nothing else.",
}
STYLE = ("Pixel art drawn on a tiny 16x16 pixel canvas and then enlarged with nearest-neighbor, so every block is big and hard-edged. The subject fills about 80% of the square canvas. "
 "Chunky simple shapes, flat colors, no fine detail, no single-pixel specks. A continuous 1-pixel-thick dark navy (#0d1430) outline around the whole subject. "
 "Use ONLY three blue tones for the body so it can be recolored: dark #0b3aa0, mid #145ce6, light #5b9bff, plus navy outline and at most two white pixel highlights. Light comes from the top-left. "
 "No anti-aliasing, no gradient, no glow, no shadow. Background: perfectly flat solid pure magenta #FF00FF, nothing else. Never use magenta in the subject. "
 "No text, letters, numbers, logos, people, hands.")
k = sys.argv[1]
p = "Generate exactly ONE image containing only this single subject, centered: " + SUBJ[k] + " " + STYLE
if len(sys.argv) > 2: p += " " + sys.argv[2]
G = os.path.expanduser('~/.codex/generated_images/**/*.png')
before = set(glob.glob(G, recursive=True))
r = subprocess.run(['codex', 'exec', '--skip-git-repo-check', '-i', '/private/tmp/claude-501/-Users-judongseok/b87026c5-a45c-41c8-a4a9-ec179e698a7c/scratchpad/tools8.png', '-'], input="Attached image is an approved sprite from the same game; match its pixel block look, navy outline and shading, but draw the different subject described.\n" + p, text=True, capture_output=True, cwd=ROOT, timeout=280)
new = sorted(set(glob.glob(G, recursive=True)) - before, key=os.path.getmtime)
if not new: print('FAIL', r.stdout[-400:], r.stderr[-400:]); sys.exit(1)
dst = os.path.join(ROOT, 'art/pixel/card/motif-%s.png' % k)
shutil.copy(new[-1], dst); print('ok', dst)
