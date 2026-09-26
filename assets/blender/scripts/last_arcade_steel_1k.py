"""Q2-A2 candidate: 1K roller-shutter maps without re-exporting last-arcade.glb.

Why: the two shutter materials were 512² and their rust read as soft colour
blobs when the near shutters fill the frame. A full Blender rebuild also
rewrites geometry, plants, occlusion weights and the packed .blend, so this
script only regenerates `shutter` and `shutter-faded` and swaps those three
images (colour, normal, metallic-roughness) inside the existing GLB.

Pattern continuity: the base fields are drawn from the exact same numpy RNG
sequence as `material(..., texture='steel')` in last_arcade.py (including the
512² `grain` draw that steel never uses), so rust clusters/runoff stay where
they were; only a second, independently seeded 1K octave adds rust-edge
breakup, pitting and colour mottling. `--check512` proves the base path by
reproducing the shipped 512² PNGs.

Run with plain python3 (numpy + Pillow), from the repo root:
  python3 assets/blender/scripts/last_arcade_steel_1k.py --check512
  python3 assets/blender/scripts/last_arcade_steel_1k.py --write-glb
The original GLB must be backed up first (see docs/scenes/last-arcade.md).
"""
from pathlib import Path
import argparse
import hashlib
import io
import json
import struct
import sys

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
CONFIG = json.loads((ROOT / 'assets/config/last-arcade.json').read_text())
TEXTURES = ROOT / 'assets/blender/last-arcade-textures'
GLB = ROOT / 'public/models/last-arcade.glb'
# name -> base colour, identical to architecture() in last_arcade.py.
SHUTTERS = {'shutter': (.64, .615, .536), 'shutter-faded': (.56, .585, .548)}
BASE_N = 512


def field(rng, n, nx, ny):
    grid = rng.random((ny + 1, nx + 1))
    xx = np.linspace(0, nx, n, endpoint=False)
    yy = np.linspace(0, ny, n, endpoint=False)
    ix, iy = xx.astype(int), yy.astype(int)
    fx, fy = xx - ix, yy - iy
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a = grid[iy[:, None], ix[None, :]]
    b = grid[iy[:, None], ix[None, :] + 1]
    c = grid[iy[:, None] + 1, ix[None, :]]
    d = grid[iy[:, None] + 1, ix[None, :] + 1]
    return (a * (1-fx) + b * fx) * (1-fy[:, None]) + (c * (1-fx) + d * fx) * fy[:, None]


def srgb(rgb):
    return np.where(rgb <= .0031308, rgb*12.92, 1.055*np.maximum(rgb, 0)**(1/2.4)-.055)


def steel_maps(name, color, n=BASE_N, detail=False):
    """Returns linear rgb, roughness, metallic, tangent normal (numpy, row 0 = image bottom like Blender)."""
    rng = np.random.default_rng(CONFIG['seed'] + sum(map(ord, name)))
    broad = field(rng, n, 4, 5)
    mid = field(rng, n, 22, 28)
    fine = field(rng, n, 90, 100)
    rng.random((BASE_N, BASE_N))  # `grain` in last_arcade.py: unused by steel, but advances the RNG.
    base = np.array(color)[None, None, :]
    paint = (broad - .5) * .075 + (mid - .5) * .035
    cluster = field(rng, n, 7, 9)
    chips = field(rng, n, 35, 38)
    rust_input = cluster * .70 + chips * .30 - .60
    if detail:
        # Independent RNG: never perturbs the base sequence above.
        drng = np.random.default_rng(CONFIG['seed'] * 7 + sum(map(ord, name)) + 1024)
        edge = field(drng, n, 150, 170) * .6 + field(drng, n, 330, 360) * .4
        mottle = field(drng, n, 60, 66)
        pits = np.clip((field(drng, n, 240, 260) - .78) * 6, 0, 1)
        # Ragged rust boundaries at 1–4 mm instead of a smooth threshold contour.
        rust_input = rust_input + (edge - .5) * .075
    rust = np.clip(rust_input * 5.3, 0, 1)
    streak_columns = field(rng, n, 58, 3)
    streak_breaks = field(rng, n, 5, 17)
    runoff = np.clip((streak_columns - .64) * 8.5, 0, 1) * (.18 + .82 * streak_breaks)
    runoff *= np.clip((cluster - .46) * 2.1, 0, 1) * .38
    rust = np.maximum(rust, runoff * .42)
    exposed = np.clip((chips - .84) * 7.5, 0, 1) * (1 - rust) * .16
    rgb = base * (1 + paint[:, :, None])
    rust_color = np.array([.235, .105, .035])
    if detail:
        # Dark scale vs. orange bloom inside each patch (low chroma, same mean).
        tone = (mottle - .5) * .55 + (edge - .5) * .25
        rust_rgb = rust_color[None, None, :] * (1 + tone[:, :, None]) + np.array([-.02, -.012, -.004]) * pits[:, :, None]
        rgb = rgb * (1 - rust[:, :, None]) + rust_rgb * rust[:, :, None]
    else:
        rgb = rgb * (1 - rust[:, :, None]) + rust_color * rust[:, :, None]
    rgb = rgb * (1 - exposed[:, :, None]) + np.array([.29, .285, .255]) * exposed[:, :, None]
    roughness = np.clip(.80 + broad * .08 + mid * .04 + rust * .08 - exposed * .12, .42, .96)
    metallic = np.clip(exposed * .72, 0, .72)
    height = mid * .13 + fine * .025 + rust * .075 + exposed * .018
    if detail:
        height = height + rust * (edge - .5) * .02 - pits * rust * .012
    gy, gx = np.gradient(height)
    # Gradients are per pixel: scale so relief per metre matches the 512² map.
    k = 1.45 * n / BASE_N
    normal = np.dstack((-gx * k, -gy * k, np.ones((n, n))))
    normal /= np.linalg.norm(normal, axis=2)[:, :, None]
    return np.clip(rgb, 0, 1), roughness, metallic, normal


def to_png(array, color=False):
    """Blender writes image row 0 at the bottom; PNG row 0 is the top."""
    a = srgb(array) if color else array
    if a.ndim == 2:
        a = np.dstack([a, a, a])
    data = np.flipud(np.round(np.clip(a, 0, 1) * 255).astype(np.uint8))
    buffer = io.BytesIO()
    Image.fromarray(data, 'RGB').save(buffer, 'PNG', optimize=True)
    return buffer.getvalue()


def packed_mr(roughness, metallic):
    # glTF metallicRoughness as exported: R=1, G=roughness, B=metallic.
    return np.dstack([np.ones_like(roughness), roughness, metallic])


def check512():
    worst = 0
    for name, color in SHUTTERS.items():
        rgb, rough, metal, normal = steel_maps(name, color)
        for suffix, data in (('color', to_png(rgb, True)), ('roughness', to_png(rough)), ('metallic', to_png(metal)), ('normal', to_png(normal * .5 + .5))):
            mine = np.array(Image.open(io.BytesIO(data))).astype(int)
            shipped = np.array(Image.open(TEXTURES / f'{name}-{suffix}.png').convert('RGB')).astype(int)
            diff = np.abs(mine - shipped)
            worst = max(worst, int(diff.max()))
            print(f'{name}-{suffix}: max |Δ|={diff.max()} mean={diff.mean():.4f}')
    return worst


def read_glb(path):
    raw = path.read_bytes()
    json_len = struct.unpack('<I', raw[12:16])[0]
    doc = json.loads(raw[20:20 + json_len])
    bin_header = 20 + json_len
    bin_len = struct.unpack('<I', raw[bin_header:bin_header + 4])[0]
    return doc, raw[bin_header + 8:bin_header + 8 + bin_len]


def write_glb(path, doc, binary):
    body = json.dumps(doc, separators=(',', ':')).encode()
    body += b' ' * (-len(body) % 4)
    binary += b'\0' * (-len(binary) % 4)
    total = 12 + 8 + len(body) + 8 + len(binary)
    path.write_bytes(struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(body), 0x4E4F534A) + body + struct.pack('<II', len(binary), 0x004E4942) + binary)


def replace_images(doc, binary, replacements):
    """Rewrites only the named images' bufferViews; all geometry views are copied unchanged."""
    targets = {doc['images'][i]['bufferView']: replacements[im['name']] for i, im in enumerate(doc['images']) if im.get('name') in replacements}
    missing = set(replacements) - {im.get('name') for im in doc['images']}
    if missing:
        raise SystemExit(f'GLB lacks images {sorted(missing)}')
    out = bytearray()
    for index, view in enumerate(doc['bufferViews']):
        data = targets.get(index)
        if data is None:
            start = view.get('byteOffset', 0)
            data = binary[start:start + view['byteLength']]
        out += b'\0' * (-len(out) % 4)
        view['byteOffset'] = len(out)
        view['byteLength'] = len(data)
        out += data
    doc['buffers'][0]['byteLength'] = len(out)
    return bytes(out)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check512', action='store_true')
    parser.add_argument('--write-glb', action='store_true')
    parser.add_argument('--size', type=int, default=1024)
    opts = parser.parse_args()
    if opts.check512:
        worst = check512()
        print('CHECK512', 'identical' if worst == 0 else f'max |Δ|={worst}')
        if worst > 1:
            sys.exit(1)
    if opts.write_glb:
        before = GLB.read_bytes()
        doc, binary = read_glb(GLB)
        replacements = {}
        for name, color in SHUTTERS.items():
            rgb, rough, metal, normal = steel_maps(name, color, opts.size, detail=True)
            files = {'color': to_png(rgb, True), 'normal': to_png(normal * .5 + .5), 'roughness': to_png(rough), 'metallic': to_png(metal)}
            for suffix, data in files.items():
                (TEXTURES / f'{name}-{suffix}.png').write_bytes(data)
            replacements[f'{name}-color'] = files['color']
            replacements[f'{name}-normal'] = files['normal']
            replacements[f'{name}-metallic-{name}-roughness'] = to_png(packed_mr(rough, metal))
        binary = replace_images(doc, binary, replacements)
        write_glb(GLB, doc, binary)
        after = GLB.read_bytes()
        print(json.dumps({'size': opts.size, 'beforeBytes': len(before), 'afterBytes': len(after), 'beforeSHA256': hashlib.sha256(before).hexdigest(), 'afterSHA256': hashlib.sha256(after).hexdigest()}))


if __name__ == '__main__':
    main()
