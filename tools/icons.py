"""Generate the PWA icons (public/icon-192.png, public/icon-512.png) from a 32x32 pixel-art crown.
Run: python3 tools/icons.py   (stdlib only)"""
import struct, zlib, pathlib

BG, BG2, GOLD, GOLD_D, RUBY, WHITE, OUT = (28, 18, 38), (44, 32, 62), (242, 193, 78), (192, 136, 42), (211, 58, 58), (255, 242, 176), (13, 10, 20)

def art():
    g = [[BG] * 32 for _ in range(32)]
    for y in range(32):  # soft vignette band
        for x in range(32):
            if 6 <= x <= 25 and 6 <= y <= 25: g[y][x] = BG2
    def fill(x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): g[y][x] = c
    fill(7, 17, 24, 22, GOLD); fill(7, 21, 24, 22, GOLD_D)          # crown band
    for cx in (8, 16, 23):                                            # three points
        for i in range(7): fill(cx - (3 - i // 2) // 2, 16 - i, cx + (3 - i // 2) // 2, 16 - i, GOLD)
    fill(15, 18, 16, 19, RUBY); fill(10, 19, 10, 19, RUBY); fill(21, 19, 21, 19, RUBY)
    fill(8, 17, 9, 17, WHITE)                                         # shine
    fill(14, 24, 17, 26, (200, 191, 174)); fill(15, 24, 15, 24, WHITE)  # the sling stone
    # 1px outline around everything that isn't background
    out = [row[:] for row in g]
    for y in range(32):
        for x in range(32):
            if g[y][x] in (BG, BG2) and any(0 <= x + dx < 32 and 0 <= y + dy < 32 and g[y + dy][x + dx] not in (BG, BG2) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y][x] = OUT
    return out

def png(path, size):
    g, s = art(), size // 32
    raw = b''.join(b'\x00' + b''.join(bytes(g[y // s][x // s]) for x in range(size)) for y in range(size))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    pathlib.Path(path).write_bytes(data)

root = pathlib.Path(__file__).resolve().parent.parent / 'public'
root.mkdir(exist_ok=True)
for n in (192, 512):
    png(root / f'icon-{n}.png', n)
print('ok')
