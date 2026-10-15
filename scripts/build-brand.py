#!/usr/bin/env python3
"""
Icons and share cards for zakariakortam.com, drawn from the site's own assets.

  python3 -I scripts/build-brand.py

Writes public/brand/*.png|svg (favicons, touch and app icons) and public/og/*.png (1200x630 share
cards: the real portrait on the home card, each product's real screen on its project card).
The mark is the Z from the Geist 600 wordmark (src/lib/wordmark.ts), drawn as a polygon so it is
exact at every size.
"""
import json, math, os, re, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)

OX, OX_DEEP, BONE, INK = (20, 6, 10), (11, 3, 6), (243, 237, 232), (22, 12, 13)
ROSE = (178, 62, 76)
F500, F600 = P('src/og/Geist-500.ttf'), P('src/og/Geist-600.ttf')

# --- The mark --------------------------------------------------------------------------------
# From WORDMARK.zakaria path: the Z occupies x 27..550, y 0..710 (y down).
Z = [(550, 710), (27, 710), (27, 598), (380, 113), (42, 113), (42, 0), (538, 0), (538, 112), (182, 597), (550, 597)]
ZW, ZH = 550 - 27, 710


def z_points(cx, cy, height):
    s = height / ZH
    return [(cx + (x - 27 - ZW / 2) * s, cy + (y - ZH / 2) * s) for x, y in Z]


def draw_mark(size, color, ground=None, scale=0.62, radius=0.0, ss=8):
    """A square icon. `scale` is the Z height as a share of the square."""
    S = size * ss
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if ground:
        if radius:
            d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius), fill=ground + (255,))
        else:
            d.rectangle([0, 0, S, S], fill=ground + (255,))
    # Optical centring: a Z's weight sits evenly, so true centre is right.
    d.polygon(z_points(S / 2, S / 2, S * scale), fill=color + (255,))
    return im.resize((size, size), Image.LANCZOS)


def svg_mark():
    pts = ' '.join(f'{x - 27:.0f},{y:.0f}' for x, y in Z)
    pad = 110
    vb = f'{-pad - (ZH - ZW) / 2:.0f} {-pad} {ZH + 2 * pad} {ZH + 2 * pad}'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">'
        '<style>polygon{fill:#160C0D}@media (prefers-color-scheme:dark){polygon{fill:#F3EDE8}}</style>'
        f'<polygon points="{pts}"/></svg>\n'
    )


# --- Type helpers ----------------------------------------------------------------------------
def font(path, px):
    return ImageFont.truetype(path, px, layout_engine=ImageFont.Layout.RAQM)


def text_width(f, s, track):
    return f.getlength(s) + track * f.size * max(0, len(s) - 1)


def draw_text(d, xy, s, f, fill, track=0.0):
    """Draws with kerning (from pair widths) plus tracking in em."""
    x, y = xy
    for i, ch in enumerate(s):
        d.text((x, y), ch, font=f, fill=fill, anchor='ls')
        if i + 1 < len(s):
            pair = f.getlength(s[i:i + 2])
            x += pair - f.getlength(s[i + 1]) + track * f.size
    return x


def wrap(f, s, width, track=0.0):
    words, lines, cur = s.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if text_width(f, t, track) <= width or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# --- Grounds ---------------------------------------------------------------------------------
W, H = 1200, 630
rng = np.random.default_rng(11)


def dither(arr):
    arr = arr + (rng.random(arr.shape[:2] + (1,)) + rng.random(arr.shape[:2] + (1,)) - 1.0) * 1.4
    return Image.fromarray(np.clip(np.round(arr), 0, 255).astype('uint8'))


def ground_glow(base, glow, cx, cy, r, strength):
    ys, xs = np.mgrid[0:H, 0:W]
    d = np.sqrt(((xs - cx * W) / (r * W)) ** 2 + ((ys - cy * H) / (r * W)) ** 2)
    t = np.clip(1 - d, 0, 1) ** 2 * strength
    arr = np.zeros((H, W, 3))
    for c in range(3):
        arr[..., c] = base[c] + (glow[c] - base[c]) * t
    return dither(arr)


def ground_linear(stops, ang=110):
    a = math.radians(ang - 90)
    xs = np.linspace(-0.5, 0.5, W)[None, :] * W
    ys = np.linspace(-0.5, 0.5, H)[:, None] * H
    t = (xs * math.cos(a) + ys * math.sin(a)) / (abs(W * math.cos(a)) + abs(H * math.sin(a))) + 0.5
    arr = np.zeros((H, W, 3))
    pos = [p for p, _ in stops]
    for c in range(3):
        arr[..., c] = np.interp(t, pos, [col[c] for _, col in stops])
    return dither(arr)


def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# --- Pieces ----------------------------------------------------------------------------------
def shadowed(img, radius, blur=38, offset=24, alpha=0.45):
    w, h = img.size
    pad = blur * 3
    sh = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([pad, pad + offset, pad + w, pad + h + offset], radius=radius, fill=(0, 0, 0, int(255 * alpha)))
    return sh.filter(ImageFilter.GaussianBlur(blur)), pad


def rounded(img, radius):
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], radius=radius, fill=255)
    out = img.convert('RGBA')
    out.putalpha(m)
    return out


def header(im, tone):
    """Small mark and name, top left, like a masthead."""
    d = ImageDraw.Draw(im)
    col = BONE if tone == 'dark' else INK
    m = draw_mark(30, col, scale=1.0)
    im.alpha_composite(m, (64, 56))
    draw_text(d, (106, 81), 'Zakaria Kortam', font(F500, 26), col + (235,), -0.01)


def title_block(im, tone, title, line, maxw):
    d = ImageDraw.Draw(im)
    col = BONE if tone == 'dark' else INK
    sub = col + (175,)
    big = 104 if len(title) <= 9 else 88 if len(title) <= 14 else 72
    ft, fl = font(F600, big), font(F500, 30)
    lines = wrap(fl, line, maxw)[:3]
    y = H - 64 - (len(lines) - 1) * 40
    for i, l in enumerate(lines):
        draw_text(d, (64, y + i * 40), l, fl, sub, -0.01)
    draw_text(d, (60, y - 62), title, ft, col + (255,), -0.045)


def save(im, name):
    os.makedirs(P('public/og'), exist_ok=True)
    im.convert('RGB').save(P('public/og', name), 'PNG', optimize=True)


# --- Cards -----------------------------------------------------------------------------------
def home_card():
    im = ground_glow(OX_DEEP, (110, 26, 44), 0.74, 0.42, 0.62, 0.95).convert('RGBA')
    portrait = Image.open(P('public/portrait/zakaria-plate.webp')).convert('RGBA')
    ph = 640
    portrait = portrait.resize((ph, ph), Image.LANCZOS)
    im.alpha_composite(portrait, (W - ph + 30, H - ph + 60))
    # soft floor fade so the cutout's crop never reads as an edge
    fade = np.zeros((H, W, 4), dtype='uint8')
    fade[..., :3] = OX_DEEP
    fade[..., 3] = (np.clip((np.arange(H)[:, None] - (H - 120)) / 120, 0, 1) * 200).astype('uint8')
    im.alpha_composite(Image.fromarray(fade, 'RGBA'))
    header(im, 'dark')
    title_block(im, 'dark', 'Zakaria Kortam', 'Product Manager at DigiCert. I build products from zero to one.', 560)
    save(im, 'home.png')


PROJECT_ART = {
    # id: (image, kind, ground)
    'helio': ('public/work/video/helio.webp', 'card', 'light-warm'),
    'surf': ('public/work/hd/surf-app.webp', 'phone', '#05070C'),
    'surf-messenger': ('public/work/hd/surf-messenger-app.webp', 'phone', '#06071A'),
    'spice-plus-plus': ('public/work/hd/spice-plus-plus-app.webp', 'card', '#07090F'),
    'rtl-plus-plus': ('public/work/hd/rtlpp-app.webp', 'card', 'light-cool'),
    'airofind': ('public/work/derived/airofind-results.webp', 'card', '#000000'),
}


def project_card(pid, title, line):
    art = PROJECT_ART.get(pid)
    if not art:
        im = ground_glow(OX_DEEP, (96, 22, 38), 0.82, 0.12, 0.7, 0.9).convert('RGBA')
        header(im, 'dark')
        title_block(im, 'dark', title, line, 900)
        return save(im, f'{pid}.png')
    src, kind, g = art
    if g == 'light-warm':
        im, tone = ground_linear([(0, hexc('#FBEBDD')), (0.45, hexc('#F6F1EA')), (1, hexc('#E6F0F8'))]).convert('RGBA'), 'light'
    elif g == 'light-cool':
        im, tone = ground_linear([(0, hexc('#E6ECF4')), (0.5, hexc('#F1F1EE')), (1, hexc('#E3E9F2'))]).convert('RGBA'), 'light'
    else:
        base = hexc(g)
        glow = tuple(min(255, c + 22) for c in base)
        im, tone = ground_glow(base, glow, 0.75, 0.3, 0.6, 0.9).convert('RGBA'), 'dark'
    img = Image.open(P(src)).convert('RGBA')
    if kind == 'phone':
        h = 760
        w = int(img.size[0] * h / img.size[1])
        img = img.resize((w, h), Image.LANCZOS)
        im.alpha_composite(img, (W - w - 90, 120))
    else:
        w = 700
        h = int(img.size[1] * w / img.size[0])
        img = img.resize((w, h), Image.LANCZOS)
        r = 18
        sh, pad = shadowed(img, r, alpha=0.5 if tone == 'dark' else 0.22)
        x, y = W - w + 70, 150
        im.alpha_composite(sh, (x - pad, y - pad))
        im.alpha_composite(rounded(img, r), (x, y))
    # keep the text side clean of the art
    fade = np.zeros((H, W, 4), dtype='uint8')
    base = np.array(im.convert('RGB'))[H // 2, 30]
    fade[..., :3] = base
    xs = np.arange(W)[None, :]
    fade[..., 3] = (np.clip((560 - xs) / 140, 0, 1) * 255 * (np.arange(H)[:, None] > H - 260)).astype('uint8')
    im.alpha_composite(Image.fromarray(fade, 'RGBA'))
    header(im, tone)
    title_block(im, tone, title, line, 520)
    save(im, f'{pid}.png')


def projects():
    src = open(P('src/lib/projects-data.ts')).read()
    out = []
    for m in re.finditer(r"\n  \{\n    id: '([^']+)',(.*?)\n  \},", src, re.S):
        body = m.group(2)
        t = re.search(r"\n    title: '([^']+)'", body)
        l = re.search(r"\n    line: '((?:[^'\\]|\\.|’)+)'", body)
        org = re.search(r"\n    org: '([^']+)'", body)
        role = re.search(r"\n    role: '([^']+)'", body)
        kind = re.search(r"\n    kind: '([^']+)'", body)
        if t and l:
            title = t.group(1)
            line = l.group(1).replace("\\'", "'")
            if kind and kind.group(1) == 'work' and role:
                line = f'{role.group(1)}. {line}'
            out.append((m.group(1), title, line))
    return out


def icons():
    os.makedirs(P('public/brand'), exist_ok=True)
    open(P('public/brand/icon.svg'), 'w').write(svg_mark())
    # Tab icons for browsers without SVG favicons: the brand maroon reads on light and dark tabs.
    for s in (16, 32, 48):
        draw_mark(s, ROSE, scale=0.94).save(P(f'public/brand/icon-{s}.png'))
    # Home screen and app icons need a ground: oxblood with the bone Z, no gradients.
    draw_mark(180, BONE, ground=OX, scale=0.46).save(P('public/brand/apple-touch-icon.png'))
    for s in (192, 512):
        draw_mark(s, BONE, ground=OX, scale=0.46).save(P(f'public/brand/icon-{s}.png'))
    draw_mark(512, BONE, ground=OX, scale=0.36).save(P('public/brand/icon-maskable-512.png'))
    # Multi-size .ico for the oldest callers.
    ims = [draw_mark(s, ROSE, scale=0.94) for s in (16, 32, 48)]
    ims[2].save(P('public/favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)], append_images=ims[:2])


if __name__ == '__main__':
    icons()
    home_card()
    for pid, title, line in projects():
        project_card(pid, title, line)
    print('brand: icons in public/brand, cards in public/og')
