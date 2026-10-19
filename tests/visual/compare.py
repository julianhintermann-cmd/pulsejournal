#!/usr/bin/env python3
"""Pixel diff of two screenshot folders from capture.mjs (desktop: section 0.2, "pixel-identical").

    python3 tests/visual/compare.py BEFORE_DIR AFTER_DIR

Needs Pillow. Lists every file whose pixels differ by more than a small anti-aliasing tolerance.
Expected noise: the time-of-day greeting, relative times, the build date and session count in Einstellungen.
"""
import sys, os
from PIL import Image, ImageChops
a, b = sys.argv[1], sys.argv[2]
bad = []
for name in sorted(os.listdir(a)):
    pa, pb = os.path.join(a, name), os.path.join(b, name)
    if not os.path.exists(pb): bad.append((name, 'missing')); continue
    ia, ib = Image.open(pa).convert('RGB'), Image.open(pb).convert('RGB')
    if ia.size != ib.size: bad.append((name, f'size {ia.size} vs {ib.size}')); continue
    diff = ImageChops.difference(ia, ib)
    bbox = diff.getbbox()
    if bbox:
        px = sum(1 for p in (diff.get_flattened_data() if hasattr(diff, 'get_flattened_data') else diff.getdata()) if max(p) > 24)
        if px > 0: bad.append((name, f'{px} px differ, bbox {bbox}'))
print(f'{len(os.listdir(a))} compared, {len(bad)} differ')
for x in bad: print(' ', x)
sys.exit(1 if bad else 0)
