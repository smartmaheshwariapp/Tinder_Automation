from pathlib import Path
import math
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "logo-concepts" / "flirteasy-final"
N = 2048

def rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i+2], 16) for i in (0, 2, 4))

start, mid, end = map(rgb, ("#FF7B73", "#F22983", "#7B35DD"))
image = Image.new("RGB", (N, N))
pixels = image.load()
for y in range(N):
    for x in range(N):
        t = (x + y) / (2 * (N - 1))
        if t < .48:
            p = t / .48; a, b = start, mid
        else:
            p = (t - .48) / .52; a, b = mid, end
        pixels[x, y] = tuple(round(a[i] + (b[i] - a[i]) * p) for i in range(3))

mask = Image.new("L", (N, N), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, N-1, N-1), 448, fill=255)
rgba = Image.new("RGBA", (N, N), (0, 0, 0, 0))
rgba.paste(image, (0, 0), mask)
d = ImageDraw.Draw(rgba)

def profile(cx, cy, tint):
    r = 410
    clip = Image.new("L", (N, N), 0)
    ImageDraw.Draw(clip).ellipse((cx-r, cy-r, cx+r, cy+r), fill=255)
    layer = Image.new("RGBA", (N, N), (0, 0, 0, 0)); ld = ImageDraw.Draw(layer)
    ld.ellipse((cx-116, cy-206, cx+116, cy+26), fill=tint)
    ld.ellipse((cx-332, cy+78, cx+332, cy+626), fill=tint)
    rgba.alpha_composite(Image.composite(layer, Image.new("RGBA", (N, N)), clip))
    d.ellipse((cx-r, cy-r, cx+r, cy+r), outline="white", width=56)

profile(814, 878, "#FFF5F5")
profile(1234, 878, "#F8F2FF")

d.ellipse((800, 1110, 1248, 1558), fill="white")
points=[]
for i in range(241):
    t=2*math.pi*i/240
    x=16*math.sin(t)**3
    y=13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t)
    points.append((1024+x*12.5, 1324-y*12.5))
d.polygon(points, fill="#F22983")

rgba.resize((1024, 1024), Image.Resampling.LANCZOS).save(OUT / "flirteasy-app-icon.png", optimize=True)
