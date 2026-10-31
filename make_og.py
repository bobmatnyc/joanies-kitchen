#!/usr/bin/env python3
"""Generate Joanie's Kitchen 1200x630 OG image with the site's own brand tokens.

Tokens from src/app/globals.css + public/ai-tomato-logo.svg:
  --color-jk-linen:  #faf5ee  (background / warm cream)
  --color-jk-tomato: #e65f45  (CTAs / primary highlight)
  tomato red:        #e74c3c / #c0392b  (logo body)
  leaves:            #27ae60 / #2ecc71  (stem/leaf greens)
Site: joanieskitchen.com — stop food waste, cook from your fridge.
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
LINEN = (250, 245, 238, 255)
TOMATO = (230, 95, 69, 255)
TOMATO_DARK = (192, 57, 43, 255)
TOMATO_SHINE = (236, 112, 99, 255)
LEAF = (46, 204, 113, 255)
LEAF_DARK = (39, 174, 96, 255)
LEAF_DEEP = (34, 153, 84, 255)
INK = (31, 30, 28, 255)   # warm near-black for text on linen
INK_SOFT = (89, 82, 74, 255)
WHITE = (255, 255, 255, 255)

img = Image.new("RGBA", (W, H), LINEN)
d = ImageDraw.Draw(img)

# --- soft tomato-tinted vignette bands (subtle, brand-first) ---
d.rounded_rectangle([0, 0, W - 1, 14], radius=7, fill=TOMATO)
d.ellipse([-140, -160, 260, 260], fill=(230, 95, 69, 26))
d.ellipse([980, 420, 1380, 820], fill=(230, 95, 69, 22))
d.ellipse([880, -140, 1240, 220], fill=(46, 204, 113, 20))

# --- hero panel: tomato logo motif (drawn to match ai-tomato-logo.svg) ---
cx, cy = 205, 268
d.ellipse([cx - 85, cy - 40, cx + 85, cy + 100], fill=TOMATO)
d.ellipse([cx - 85, cy - 35, cx + 85, cy + 95], fill=TOMATO_DARK)
d.ellipse([cx - 45, cy - 12, cx - 5, cy + 38], fill=TOMATO_SHINE)
# stem
d.rounded_rectangle([cx - 6, cy - 68, cx + 6, cy - 30], radius=3, fill=LEAF_DEEP)
# leaves
d.polygon([(cx - 30, cy - 58), (cx - 52, cy - 74), (cx - 46, cy - 50), (cx - 30, cy - 52)], fill=LEAF)
d.polygon([(cx + 30, cy - 58), (cx + 52, cy - 74), (cx + 46, cy - 50), (cx + 30, cy - 52)], fill=LEAF)
d.polygon([(cx - 12, cy - 66), (cx - 26, cy - 88), (cx - 16, cy - 62), (cx - 4, cy - 64)], fill=LEAF)
d.polygon([(cx + 12, cy - 66), (cx + 26, cy - 88), (cx + 16, cy - 62), (cx + 4, cy - 64)], fill=LEAF_DARK)
# AI circuit overlay (from the logo's circuit pattern)
d.line([cx, cy + 25, cx + 30, cy - 15], fill=(52, 152, 219, 110), width=4)
d.line([cx, cy + 25, cx - 32, cy - 12], fill=(52, 152, 219, 110), width=4)
d.line([cx, cy + 25, cx - 12, cy + 62], fill=(52, 152, 219, 110), width=4)
for px, py in [(cx + 30, cy - 15), (cx - 32, cy - 12), (cx - 12, cy + 62)]:
    r = 6
    d.ellipse([px - r, py - r, px + r, py + r], fill=(52, 152, 219, 200))

# --- text ---
def font(path, size):
    return ImageFont.truetype(path, size)

F_BOLD = "/home/paperclip/.fonts/Montserrat-Bold.ttf"
F_EB = "/home/paperclip/.fonts/Montserrat-ExtraBold.ttf"
F_SEMI = "/home/paperclip/.fonts/Montserrat-SemiBold.ttf"

x0 = 330
d.text((x0, 108), "Joanie's Kitchen", font=font(F_SEMI, 34), fill=TOMATO)
d.text((x0, 158), "Stop food waste.", font=font(F_EB, 62), fill=INK)
d.text((x0, 236), "Cook from your fridge.", font=font(F_EB, 62), fill=INK)

d.text((x0, 330), "Enter what's in your fridge and get delicious", font=font(F_SEMI, 30), fill=INK_SOFT)
d.text((x0, 372), "meals you can make right now — no waste, no", font=font(F_SEMI, 30), fill=INK_SOFT)
d.text((x0, 414), "shopping list, no leftovers forgotten.", font=font(F_SEMI, 30), fill=INK_SOFT)

# CTA pill
pw, ph = 34, 76
pyy = 492
d.rounded_rectangle([x0, pyy, x0 + 352, pyy + 66], radius=33, fill=TOMATO)
d.text((x0 + 28, pyy + 12), "Start cooking smart", font=font(F_BOLD, 30), fill=WHITE)

# footer
d.line([x0, 580, W - 60, 580], fill=(230, 95, 69, 60), width=2)
d.text((x0, 592), "joanieskitchen.com", font=font(F_BOLD, 22), fill=INK_SOFT)

img = img.convert("RGB")
img.save("public/og-image.png", "PNG")
print("saved", img.size)
