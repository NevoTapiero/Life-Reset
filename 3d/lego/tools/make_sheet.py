"""Combine a character's level renders into one comparison sheet (renders/<character>_levels_sheet.webp).

Usage (from this tools/ folder): python make_sheet.py warrior
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

LEGO = Path(__file__).resolve().parent.parent
character = sys.argv[1] if len(sys.argv) > 1 else "warrior"
data = json.loads((LEGO / "characters" / character / "levels.json").read_text())
slots = json.loads((LEGO / "catalog" / "slots.json").read_text())["slots"]

W, H, PAD = 700, 480, 60
sheet = Image.new("RGB", (W * 3, (H + PAD) * 2), (10, 42, 56))
draw = ImageDraw.Draw(sheet)
try:
    big, small = ImageFont.truetype("arialbd.ttf", 30), ImageFont.truetype("arial.ttf", 20)
except OSError:
    big = small = ImageFont.load_default()

for i, lv in enumerate(data["levels"][:5]):
    img = Image.open(LEGO / "renders" / f"{character}_L{lv['level']}.png").convert("RGB").resize((W, H))
    x, y = (i % 3) * W, (i // 3) * (H + PAD)
    sheet.paste(img, (x, y + PAD))
    draw.text((x + 16, y + 12), f"Level {lv['level']}  {lv['title']}", fill=(255, 139, 31), font=big)

x, y = 2 * W, H + PAD
draw.text((x + 40, y + 60), f"{character.upper()}: {len(slots)} upgrade slots", fill=(255, 196, 110), font=big)
for k, s in enumerate(slots):
    draw.text((x + 40, y + 120 + k * 34), f"{k + 1}  {s['name']}", fill=(255, 255, 255), font=small)
sheet.save(LEGO / "renders" / f"{character}_levels_sheet.webp", quality=88)
print("sheet saved")
