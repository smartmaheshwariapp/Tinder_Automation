from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "assets" / "logo-concepts" / "flirteasy-vector"
S = 1024
BG = "#0A050D"
PINK = "#FF3366"
ROSE = "#FF5E7E"
PEACH = "#FFAA80"
WHITE = "#EDDDF1"


def canvas():
    image = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(image).rounded_rectangle((0, 0, S - 1, S - 1), 224, fill=BG)
    return image


def save(image, name):
    image.save(OUT / name, "PNG", optimize=True)


def signal_f():
    im = canvas(); d = ImageDraw.Draw(im)
    d.rounded_rectangle((282, 160, 446, 890), 78, fill=PINK)
    d.rounded_rectangle((282, 160, 782, 308), 74, fill=PINK)
    d.rounded_rectangle((340, 440, 726, 584), 72, fill=PINK)
    d.polygon(((782, 230), (638, 344), (708, 308)), fill=PEACH)
    d.ellipse((670, 478, 738, 546), fill=WHITE)
    return im


def flow_f():
    im = canvas(); d = ImageDraw.Draw(im)
    d.rounded_rectangle((238, 170, 398, 872), 80, fill=PINK)
    d.rounded_rectangle((238, 170, 798, 298), 64, fill=PINK)
    d.rounded_rectangle((330, 434, 744, 586), 76, fill=ROSE)
    d.polygon(((744, 510), (614, 586), (710, 674)), fill=PEACH)
    return im


def paired_f():
    im = canvas(); d = ImageDraw.Draw(im)
    d.rounded_rectangle((255, 146, 429, 905), 82, fill=PINK)
    d.rounded_rectangle((255, 146, 769, 348), 101, fill=PINK)
    d.rounded_rectangle((338, 482, 698, 656), 87, fill=PINK)
    d.polygon(((769, 247), (638, 348), (769, 449)), fill=PEACH)
    d.polygon(((698, 569), (587, 656), (698, 742)), fill=WHITE)
    return im


def easy_switch():
    im = canvas(); d = ImageDraw.Draw(im)
    d.line(((300, 780), (300, 337), (439, 198), (699, 198)), fill=PINK, width=138, joint="curve")
    for x, y in ((300, 780), (300, 337), (699, 198)):
        d.ellipse((x-69, y-69, x+69, y+69), fill=PINK)
    d.line(((369, 517), (635, 517)), fill=ROSE, width=138)
    d.ellipse((300, 448, 438, 586), fill=ROSE)
    d.ellipse((566, 448, 704, 586), fill=ROSE)
    d.polygon(((753, 198), (609, 314), (753, 426)), fill=PEACH)
    d.ellipse((581, 463, 689, 571), fill=WHITE)
    return im


icons = [signal_f(), flow_f(), paired_f(), easy_switch()]
names = ["01-signal-f.png", "02-flow-f.png", "03-paired-f.png", "04-easy-switch.png"]
for icon, name in zip(icons, names):
    save(icon, name)

board = Image.new("RGB", (1740, 1120), "#F6F2F5")
draw = ImageDraw.Draw(board)
try:
    title = ImageFont.truetype("arialbd.ttf", 58)
    label = ImageFont.truetype("arialbd.ttf", 28)
    body = ImageFont.truetype("arial.ttf", 23)
except OSError:
    title = label = body = ImageFont.load_default()
draw.text((90, 70), "FlirtEasy — handcrafted vector icons", fill="#1A111B", font=title)
for idx, (icon, heading, note) in enumerate(zip(icons, ["01 SIGNAL F", "02 FLOW F", "03 PAIRED F", "04 EASY SWITCH"], ["Reply speed", "Conversation flow", "Two-way messaging", "Human + automation"])):
    x = 90 + (idx % 4) * 410
    board.paste(icon.resize((350, 350), Image.Resampling.LANCZOS), (x, 210), icon.resize((350, 350), Image.Resampling.LANCZOS))
    draw.text((x, 600), heading, fill="#1A111B", font=label)
    draw.text((x, 646), note, fill="#695C67", font=body)
    board.paste(icon.resize((96, 96), Image.Resampling.LANCZOS), (x, 735), icon.resize((96, 96), Image.Resampling.LANCZOS))
    board.paste(icon.resize((48, 48), Image.Resampling.LANCZOS), (x + 125, 759), icon.resize((48, 48), Image.Resampling.LANCZOS))
draw.text((90, 930), "Shown at 350 px, 96 px and 48 px to verify launcher-size clarity.", fill="#695C67", font=body)
board.save(OUT / "concept-board.png", "PNG", optimize=True)
