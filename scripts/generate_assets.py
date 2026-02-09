"""
Generate plugin icon (128x128) and cover image (1920x960)
for the Image to Layers Figma plugin.
"""

from PIL import Image, ImageDraw, ImageFont
import math

# ─── Colors ───
BG_DARK = (24, 24, 32)
BG_GRADIENT_END = (36, 36, 56)
BLUE = (24, 160, 251)
BLUE_LIGHT = (80, 190, 255)
PURPLE = (130, 80, 220)
WHITE = (255, 255, 255)
GRAY_LIGHT = (200, 200, 210)
GRAY = (140, 140, 155)
ORANGE = (255, 150, 50)
GREEN = (60, 200, 130)
PINK = (240, 80, 140)


def draw_rounded_rect(draw, xy, radius, fill=None, outline=None, width=1):
    """Draw a rounded rectangle."""
    x1, y1, x2, y2 = xy
    r = min(radius, (x2 - x1) // 2, (y2 - y1) // 2)
    draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)


def draw_gradient_bg(img):
    """Fill image with a subtle dark gradient."""
    draw = ImageDraw.Draw(img)
    w, h = img.size
    for y in range(h):
        t = y / h
        r = int(BG_DARK[0] + (BG_GRADIENT_END[0] - BG_DARK[0]) * t)
        g = int(BG_DARK[1] + (BG_GRADIENT_END[1] - BG_DARK[1]) * t)
        b = int(BG_DARK[2] + (BG_GRADIENT_END[2] - BG_DARK[2]) * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))


def draw_image_icon(draw, x, y, size):
    """Draw a stylized image/photo icon (mountain + sun)."""
    s = size
    # Outer frame
    draw_rounded_rect(draw, (x, y, x + s, y + s), radius=s // 8,
                      fill=(50, 50, 70), outline=GRAY, width=2)
    # Sun circle
    sun_r = s // 8
    sun_cx = x + s * 3 // 4
    sun_cy = y + s // 4
    draw.ellipse((sun_cx - sun_r, sun_cy - sun_r, sun_cx + sun_r, sun_cy + sun_r),
                 fill=ORANGE)
    # Mountain
    pts = [
        (x + s // 8, y + s * 3 // 4),
        (x + s // 3, y + s * 2 // 5),
        (x + s // 2, y + s * 3 // 5),
        (x + s * 2 // 3, y + s // 3),
        (x + s * 7 // 8, y + s * 3 // 4),
    ]
    draw.polygon(pts, fill=GREEN)


def draw_arrow(draw, x1, y1, x2, y2, color, width=3):
    """Draw an arrow from (x1,y1) to (x2,y2)."""
    draw.line([(x1, y1), (x2, y2)], fill=color, width=width)
    # Arrowhead
    angle = math.atan2(y2 - y1, x2 - x1)
    head_len = 10
    for da in [2.5, -2.5]:
        ax = x2 - head_len * math.cos(angle + da * 0.3)
        ay = y2 - head_len * math.sin(angle + da * 0.3)
        draw.line([(x2, y2), (int(ax), int(ay))], fill=color, width=width)


def draw_layers_stack(draw, x, y, w, h, colors=None):
    """Draw a stack of offset rectangles representing layers."""
    if colors is None:
        colors = [BLUE, PURPLE, PINK, GREEN]
    layer_h = h // (len(colors) + 1)
    offset = 6
    for i, color in enumerate(colors):
        lx = x + i * offset
        ly = y + i * (layer_h + 4)
        # Shadow
        draw_rounded_rect(draw, (lx + 2, ly + 2, lx + w + 2, ly + layer_h + 2),
                          radius=4, fill=(0, 0, 0, 60))
        # Layer
        draw_rounded_rect(draw, (lx, ly, lx + w, ly + layer_h),
                          radius=4, fill=color, outline=WHITE, width=1)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  ICON — 128x128
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def generate_icon():
    img = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background rounded square
    draw_rounded_rect(draw, (0, 0, 127, 127), radius=24, fill=BG_DARK)

    # Left side: small image icon
    draw_image_icon(draw, 10, 34, 44)

    # Arrow in the middle
    draw_arrow(draw, 58, 64, 72, 64, BLUE_LIGHT, width=3)

    # Right side: layer stack
    layer_colors = [BLUE, PURPLE, PINK, GREEN]
    layer_w = 36
    layer_h = 10
    base_x = 78
    base_y = 28
    offset_x = 3
    for i, color in enumerate(layer_colors):
        lx = base_x + i * offset_x
        ly = base_y + i * 16
        draw_rounded_rect(draw, (lx, ly, lx + layer_w, ly + layer_h),
                          radius=3, fill=color)

    # Bottom accent line
    draw.line([(20, 108), (108, 108)], fill=BLUE, width=2)

    img.save('assets/icon-128.png', 'PNG')
    print('Created assets/icon-128.png')


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  COVER — 1920x960
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def generate_cover():
    img = Image.new('RGB', (1920, 960), BG_DARK)
    draw = ImageDraw.Draw(img)
    draw_gradient_bg(img)
    draw = ImageDraw.Draw(img)

    # ── Left side: "Screenshot" mockup ──
    mock_x, mock_y = 160, 180
    mock_w, mock_h = 600, 560

    # Browser chrome
    draw_rounded_rect(draw, (mock_x, mock_y, mock_x + mock_w, mock_y + mock_h),
                      radius=12, fill=(40, 40, 55), outline=(70, 70, 90), width=2)
    # Title bar
    draw.rectangle((mock_x, mock_y, mock_x + mock_w, mock_y + 36), fill=(50, 50, 65))
    draw_rounded_rect(draw, (mock_x, mock_y, mock_x + mock_w, mock_y + 20),
                      radius=12, fill=(50, 50, 65))
    # Window dots
    for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        cx = mock_x + 20 + i * 22
        cy = mock_y + 18
        draw.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), fill=c)

    # Mock UI elements inside
    content_x = mock_x + 24
    content_y = mock_y + 56

    # Nav bar
    draw_rounded_rect(draw, (content_x, content_y, content_x + mock_w - 48, content_y + 40),
                      radius=6, fill=(55, 55, 75))
    # Hero section
    draw_rounded_rect(draw, (content_x, content_y + 52, content_x + mock_w - 48, content_y + 200),
                      radius=8, fill=BLUE)
    # Text lines in hero
    for i in range(3):
        lw = [300, 220, 160][i]
        ly = content_y + 80 + i * 28
        draw_rounded_rect(draw, (content_x + 24, ly, content_x + 24 + lw, ly + 14),
                          radius=4, fill=(255, 255, 255, 180))
    # Button in hero
    draw_rounded_rect(draw, (content_x + 24, content_y + 170, content_x + 150, content_y + 194),
                      radius=6, fill=WHITE)

    # Card row
    card_y = content_y + 220
    for i in range(3):
        cx = content_x + i * (170 + 12)
        cw = 170
        ch = 180
        draw_rounded_rect(draw, (cx, card_y, cx + cw, card_y + ch),
                          radius=8, fill=(55, 55, 75))
        # Card image area
        draw_rounded_rect(draw, (cx + 8, card_y + 8, cx + cw - 8, card_y + 90),
                          radius=6, fill=[PURPLE, GREEN, ORANGE][i])
        # Card text lines
        draw_rounded_rect(draw, (cx + 8, card_y + 100, cx + cw - 30, card_y + 112),
                          radius=3, fill=GRAY)
        draw_rounded_rect(draw, (cx + 8, card_y + 120, cx + cw - 50, card_y + 130),
                          radius=3, fill=(100, 100, 115))

    # Bottom bar
    draw_rounded_rect(draw, (content_x, card_y + 196, content_x + mock_w - 48, card_y + 226),
                      radius=6, fill=(55, 55, 75))

    # ── Center: Arrow ──
    arrow_y = 460
    # Big arrow
    for thickness in range(6, 0, -1):
        alpha_color = tuple(int(BLUE[j] + (BLUE_LIGHT[j] - BLUE[j]) * (6 - thickness) / 6) for j in range(3))
        draw.line([(820, arrow_y), (1100, arrow_y)], fill=alpha_color, width=thickness)
    # Arrowhead
    head_pts = [(1100, arrow_y - 24), (1140, arrow_y), (1100, arrow_y + 24)]
    draw.polygon(head_pts, fill=BLUE_LIGHT)

    # ── Right side: Exploded layers ──
    layers_x = 1180
    layers_base_y = 160

    layer_configs = [
        {'label': 'Nav Bar', 'color': (55, 55, 75), 'w': 552, 'h': 44, 'offset': 0, 'radius': 6},
        {'label': 'Hero Section', 'color': BLUE, 'w': 552, 'h': 160, 'offset': 16, 'radius': 8},
        {'label': 'Heading Text', 'color': (255, 255, 255), 'w': 300, 'h': 18, 'offset': 32, 'radius': 4},
        {'label': 'Button', 'color': WHITE, 'w': 130, 'h': 28, 'offset': 44, 'radius': 6},
        {'label': 'Card 1', 'color': PURPLE, 'w': 170, 'h': 100, 'offset': 20, 'radius': 8},
        {'label': 'Card 2', 'color': GREEN, 'w': 170, 'h': 100, 'offset': 28, 'radius': 8},
        {'label': 'Card 3', 'color': ORANGE, 'w': 170, 'h': 100, 'offset': 36, 'radius': 8},
        {'label': 'Footer', 'color': (55, 55, 75), 'w': 552, 'h': 34, 'offset': 8, 'radius': 6},
    ]

    y_cursor = layers_base_y
    for i, cfg in enumerate(layer_configs):
        lx = layers_x + cfg['offset']
        ly = y_cursor
        lw = min(cfg['w'], 560 - cfg['offset'])
        lh = cfg['h']

        # Layer shadow
        draw_rounded_rect(draw, (lx + 3, ly + 3, lx + lw + 3, ly + lh + 3),
                          radius=cfg['radius'], fill=(0, 0, 0))

        # Layer body
        draw_rounded_rect(draw, (lx, ly, lx + lw, ly + lh),
                          radius=cfg['radius'], fill=cfg['color'],
                          outline=BLUE_LIGHT, width=1)

        # Label
        label_y = ly + lh // 2 - 6
        try:
            draw.text((lx + 10, label_y), cfg['label'], fill=WHITE)
        except Exception:
            pass

        y_cursor += lh + 16

    # ── Title text ──
    # Main title
    title_y = 820
    try:
        # Try to use a larger font
        title = "Image to Layers"
        subtitle = "Convert screenshots into editable Figma layers"

        # Draw title centered
        title_bbox = draw.textbbox((0, 0), title)
        title_w = title_bbox[2] - title_bbox[0]

        # Use a simple approach - draw text
        draw.text((960 - 100, title_y), title, fill=WHITE)
        draw.text((960 - 160, title_y + 30), subtitle, fill=GRAY_LIGHT)
    except Exception:
        pass

    # ── Decorative dots ──
    for i in range(20):
        dx = 100 + (i * 97) % 1720
        dy = 40 + (i * 73) % 100
        r = 2 + i % 3
        opacity = 40 + (i * 13) % 60
        dot_color = (BLUE[0], BLUE[1], BLUE[2])
        draw.ellipse((dx - r, dy - r, dx + r, dy + r), fill=dot_color)

    # Bottom decorative dots
    for i in range(20):
        dx = 80 + (i * 101) % 1760
        dy = 890 + (i * 37) % 60
        r = 1 + i % 3
        draw.ellipse((dx - r, dy - r, dx + r, dy + r), fill=PURPLE)

    img.save('assets/cover-1920x960.png', 'PNG')
    print('Created assets/cover-1920x960.png')


if __name__ == '__main__':
    import os
    os.makedirs('assets', exist_ok=True)
    generate_icon()
    generate_cover()
    print('Done!')
