"""Recolor the Vegaqura logo so all letters share the gold gradient currently
applied only to the Q. Vegaqura asked Eugene for "all letters lit up in the
same color as the letter Q".

Approach:
  1. Load the PNG with alpha intact.
  2. Identify the Q's gold pixels (where R>G and R>B in opaque region) and
     compute a per-row median gold color → that's the gradient.
  3. Identify the green letter pixels (G>R and G>B in opaque region) including
     anti-aliased edges.
  4. Replace each green pixel with the gold color from its row, scaling by
     the original pixel's saturation so anti-aliased edges blend cleanly.
  5. Save back to PNG and regenerate the 480w webp asset.
"""
from PIL import Image
import numpy as np
import subprocess
from pathlib import Path

import sys
ROOT = Path(r"C:/Users/Usuario/Desktop/bussines model")
APPLY = "--apply" in sys.argv
DEEP = "--deep" in sys.argv  # use a richer/darker gold instead of sampling Q
SRC_PNG = ROOT / "assets/logo-vegaqura.png"
PREVIEW_PNG = ROOT / ("assets/logo-vegaqura-allgold-preview-deep.png" if DEEP else "assets/logo-vegaqura-allgold-preview.png")
SRC_PNGS = [
    ROOT / "assets/logo-vegaqura.png",
    ROOT / "branding/studio/partner-logos/logo-vegaqura.png",
]
WEBP_OUT = ROOT / "assets/optimized/logo-vegaqura.480w.webp"

src = SRC_PNG
img = Image.open(src).convert("RGBA")
arr = np.array(img).astype(int)
H, W = arr.shape[:2]

r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
opaque = a > 30
gold_mask = opaque & (r > g) & (r > b)
green_mask = opaque & (g > r) & (g > b)

# Per-row median gold color. Fall back to nearest populated row if a given
# row has no gold pixels.
gold_per_row = np.full((H, 3), np.nan)
for y in range(H):
    row_mask = gold_mask[y]
    if row_mask.any():
        gold_per_row[y] = np.median(arr[y, row_mask, :3], axis=0)

# Fill nan rows with nearest-non-nan value
filled = gold_per_row.copy()
last = None
for y in range(H):
    if not np.isnan(filled[y, 0]):
        last = filled[y]
    elif last is not None:
        filled[y] = last
last = None
for y in range(H - 1, -1, -1):
    if not np.isnan(filled[y, 0]):
        last = filled[y]
    elif last is not None and np.isnan(filled[y, 0]):
        filled[y] = last

# Anything still nan (image fully without gold) — fall back to the global mean
global_gold = arr[gold_mask, :3].mean(axis=0)
for y in range(H):
    if np.isnan(filled[y, 0]):
        filled[y] = global_gold

filled = np.clip(filled, 0, 255).astype(np.uint8)

# Deep mode: shift the per-row gradient toward a richer/darker gold so the
# wordmark survives over warm-sky / sunset backgrounds. Top stays warm but no
# longer cream; bottom drops into deep amber/bronze.
if DEEP:
    deep_top = np.array([212, 168, 102])  # rich gold, like BookVoice accent
    deep_bot = np.array([139, 106, 43])   # deep amber/bronze
    H_filled = filled.shape[0]
    y_norm = np.arange(H_filled) / max(H_filled - 1, 1)
    target_grad = (1 - y_norm[:, None]) * deep_top + y_norm[:, None] * deep_bot
    # Blend 80% target, 20% original so the Q's natural shading is partly kept
    filled = (target_grad * 0.8 + filled * 0.2).clip(0, 255).astype(np.uint8)

# Replace green pixels with the per-row gold color, preserving the original
# pixel's intensity (anti-aliased edges keep their fade-out look).
out = arr.copy()
ys, xs = np.where(green_mask)
for y, x in zip(ys, xs):
    # Original green letter pixels are essentially flat colour with anti-
    # aliased edges. Use the alpha-equivalent intensity to scale.
    orig = arr[y, x, :3]
    # Estimate "ink density" by how saturated/dark the green is. Letters that
    # are fully painted have low brightness; AA edges have mid brightness.
    # We just blend with white by (1 - density) so edges read as soft gold.
    base = filled[y].astype(float)
    bright = (orig.sum() / 3) / 255.0   # 0 = full ink, ~0.6+ = AA edge
    density = 1.0 - bright              # 1 at full ink, ~0.4 at edges
    blended = base * density + np.array([255, 255, 255]) * (1 - density)
    out[y, x, :3] = np.clip(blended, 0, 255).astype(np.uint8)

out_img = Image.fromarray(out.astype(np.uint8))

if not APPLY:
    out_img.save(PREVIEW_PNG)
    label = "DEEP " if DEEP else ""
    print(f"{label}PREVIEW saved -> {PREVIEW_PNG.relative_to(ROOT)}  {PREVIEW_PNG.stat().st_size//1024} KB")
    print("Run with --apply to overwrite the live PNGs and regenerate the webp.")
else:
    for dst in SRC_PNGS:
        out_img.save(dst)
        print(f"saved -> {dst.relative_to(ROOT)}  {dst.stat().st_size//1024} KB")
    WEBP_OUT.parent.mkdir(parents=True, exist_ok=True)
    new_w = 480
    new_h = int(round(out_img.height * new_w / out_img.width))
    out_img.resize((new_w, new_h), Image.LANCZOS).save(WEBP_OUT, "WEBP", quality=88, method=6)
    print(f"saved -> {WEBP_OUT.relative_to(ROOT)}  {WEBP_OUT.stat().st_size//1024} KB")

print("\nDone.")
