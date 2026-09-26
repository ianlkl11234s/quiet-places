"""Self-authored juvenile 烏翅真鯊 (Carcharhinus melanopterus), Blender +X nose / +Y dorsal.

Q3 B1 rebuild (2026-09-27). No imported geometry or textures: the body is a
lofted, smooth-shaded surface with a procedurally painted 1024x512 base colour
and 512x256 roughness map; fins are Delaunay-filled lens sheets whose thickness
tapers from root to tip and to zero at every free margin, coloured with vertex
colours (soft black tips, pale band under the first dorsal tip).

Contract kept from the 2026-09-09 model (see docs/biology/blacktip-reef-shark.md):
metres, nose +X at x=.45, tail tip x=-.45, dorsal +Y, lateral Z; bones Root,
Spine_00..15 (independent Root children), Pectoral_R, Pectoral_L; no clips.
Change: each pectoral fin is now bound 1.0 to its Pectoral bone (was .18 ADD,
~.153 after normalisation); Shark.ts reads the weight and solves the bone angle.
"""
import json, math, hashlib, os
from pathlib import Path
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix, geometry

ROOT = Path(__file__).resolve().parents[3]
# SHARK_GLB_OUT lets a candidate be exported and tested before replacing the shipped GLB.
OUT = Path(os.environ.get('SHARK_GLB_OUT', ROOT / 'public/models/blacktip-shark.glb'))
BLEND = ROOT / 'assets/blender/blacktip-shark.blend'
REVIEW = ROOT / 'exports/quality-b-20260927/B1'
S = (0,.06,.13,.21,.30,.40,.51,.61,.70,.78,.84,.89,.93,.96,.985,1.)
TAU = math.tau
BODY_END = .75            # body loft length from the snout (x=.45 -> x=-.30)
RINGS, SIDES = 150, 48
TEX_W, TEX_H = 1024, 512  # base colour
ROUGH_W, ROUGH_H = 512, 256

# sRGB art colours (class C, chosen to read as the sources' "yellow-brown above, white below").
DORSAL = np.array((.50, .45, .36)); BELLY = np.array((.90, .885, .835))
FIN = np.array((.46, .42, .345)); BLACK = np.array((.07, .065, .06)); PALE_BAND = np.array((.86, .84, .78))
GILL = np.array((.22, .19, .16))

def srgb_to_linear(c):
    c = np.asarray(c, float)
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)

def smoothstep(a, b, x):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def to_blender(p):
    return (p[0], -p[2], p[1])

# --------------------------------------------------------------------------- body profile
# d = distance behind the snout tip; half-heights dorsal/ventral, lateral half-width, centre y.
# Short, broad, bluntly rounded snout (lateral grows faster than height near d=0).
PROFILE_KEYS = (
    (0, 0, 0, 0, .004), (.008, .012, .010, .017, .003), (.025, .025, .020, .032, .002),
    (.055, .038, .031, .045, 0), (.10, .053, .045, .055, -.002), (.17, .067, .060, .060, -.002),
    (.25, .078, .070, .061, 0), (.34, .082, .073, .058, 0), (.44, .077, .068, .052, 0),
    (.54, .062, .056, .042, 0), (.62, .044, .040, .030, .002), (.67, .028, .026, .018, .004),
    (.70, .018, .016, .010, .005), (.73, .009, .008, .005, .006), (BODY_END, 0, 0, 0, .007))

def _hermite(keys, axis, d, square):
    x = [k[0] for k in keys]; h = [b - a for a, b in zip(x, x[1:])]
    i = next((j for j in range(len(h)) if d <= x[j + 1]), len(h) - 1)
    t = max(0, min(1, (d - x[i]) / h[i]))
    y = [k[axis] ** 2 if square else k[axis] for k in keys]
    dd = [(b - a) / w for a, b, w in zip(y, y[1:], h)]
    m = [0.] * len(x)
    for j in range(1, len(x) - 1):
        if dd[j - 1] * dd[j] > 0:
            w1 = 2 * h[j] + h[j - 1]; w2 = h[j] + 2 * h[j - 1]
            m[j] = (w1 + w2) / (w1 / dd[j - 1] + w2 / dd[j])
    for end, da, db, ha, hb in ((0, dd[0], dd[1], h[0], h[1]), (-1, dd[-1], dd[-2], h[-1], h[-2])):
        slope = ((2 * ha + hb) * da - ha * db) / (ha + hb)
        m[end] = 0 if slope * da <= 0 else math.copysign(min(abs(slope), 3 * abs(da)), da)
    v = (2 * t**3 - 3 * t * t + 1) * y[i] + (t**3 - 2 * t * t + t) * h[i] * m[i] + (-2 * t**3 + 3 * t * t) * y[i + 1] + (t**3 - t * t) * h[i] * m[i + 1]
    return math.sqrt(max(0, v)) if square else v

def profile(d):
    """Shape-preserving Hermite on squared radii (continuous slopes, rounded ends)."""
    d = max(0, min(BODY_END, d))
    return tuple(_hermite(PROFILE_KEYS, a, d, True) for a in (1, 2, 3)) + (_hermite(PROFILE_KEYS, 4, d, False),)

def surface(d, theta):
    D, V, L, yc = profile(d)
    s, c = math.sin(theta), math.cos(theta)
    return (.45 - d, yc + (D if s >= 0 else V) * s, L * c)

def ring_d(i):
    u = i / (RINGS - 1)
    return BODY_END * (.55 * u + .45 * (.5 - .5 * math.cos(math.pi * u)))

# --------------------------------------------------------------------------- textures
EYE_X, EYE_SIN = .388, .42

def paint_body(width, height):
    """Returns (base colour sRGB HxWx3, roughness HxW) in UV space: u=d/BODY_END, v=(theta+pi/2)/2pi."""
    d = (np.arange(width) + .5) / width * BODY_END
    prof = np.array([profile(v) for v in d])
    D, V, L, yc = (prof[:, k][None, :] for k in range(4))
    x = (.45 - d)[None, :]
    theta = ((np.arange(height) + .5) / height * TAU - math.pi / 2)[:, None]
    s, c = np.sin(theta), np.cos(theta)
    z = L * c                                  # lateral position, metres
    e = np.arctan2(s, np.abs(c))               # elevation, mirrored left/right
    R = np.sqrt((D * D + L * L) / 2) + 1e-4
    # Countershading: boundary lower on the head, rising toward the peduncle.
    eb = np.interp(d, [0, .12, .30, .55, .70], [-.34, -.30, -.22, -.16, -.08])[None, :]
    dorsal_t = np.maximum(smoothstep(eb - .09, eb + .09, e), smoothstep(.62, .70, d * np.ones_like(e)))
    col = BELLY[None, None, :] * (1 - dorsal_t[..., None]) + DORSAL[None, None, :] * dorsal_t[..., None]
    col = col * (1 - .08 * smoothstep(.6, 1.4, e))[..., None]          # slightly darker saddle
    # Pale flank band: from above the anal fin forward/upward, tapering above the pectorals.
    q = np.clip((x + .13) / .33, 0, 1)
    ec = -.22 + .36 * q ** .8; hw = .11 * (1 - q) ** .7 + .012
    band = (1 - smoothstep(hw * .3, hw * 1.1, np.abs(e - ec))) * smoothstep(-.18, -.12, x) * (1 - smoothstep(.12, .21, x)) * (1 - .35 * q)
    col = col * (1 - .62 * band[..., None]) + (BELLY * .97)[None, None, :] * .62 * band[..., None]
    # Darker strip left between belly and the band (below first dorsal -> above pelvics).
    strip = smoothstep(eb + .05, eb + .10, e) * (1 - smoothstep(ec - hw - .02, ec - hw + .02, e)) * smoothstep(-.02, .02, x) * (1 - smoothstep(.10, .14, x))
    col = col * (1 - .16 * strip[..., None])
    # Gentle low-frequency mottling (+-3%), avoids a flat CG fill.
    mott = .018 * np.sin(x * 47 + 1.1) * np.sin(e * 4.1 + x * 9) + .010 * np.sin(x * 131 + 2.3 * np.sin(e * 7))
    col = col * (1 + mott[..., None])
    rough = .50 + .07 * (1 - dorsal_t) - .06 * smoothstep(.25, .38, x)
    # Five gill slits: soft dark crease plus a faint lit rear lip, the fifth above the pectoral origin.
    gill_mask = np.zeros_like(e)
    for k in range(5):
        xk = .318 - .017 * k; e0, e1 = -.55 + .02 * k, .25 - .025 * k
        path = xk - .010 * (e - (e0 + e1) / 2) ** 2
        along = smoothstep(e0, e0 + .08, e) * (1 - smoothstep(e1 - .08, e1, e))
        core = np.exp(-((x - path) / .0011) ** 2) * along
        lip = np.exp(-((x - path + .0024) / .0013) ** 2) * along
        gill_mask = np.maximum(gill_mask, core)
        col = col * (1 + .07 * lip[..., None])
    col = col * (1 - .78 * gill_mask[..., None]) + GILL[None, None, :] * .78 * gill_mask[..., None]
    rough = rough + .18 * gill_mask
    # Eye socket: darker lid ring so the eye reads as set into the head, not a stuck-on ball.
    ee = math.asin(EYE_SIN)
    dist = np.sqrt(((x - EYE_X) / 1.25) ** 2 + ((e - ee) * R) ** 2)
    lid = 1 - smoothstep(.0060, .0084, dist)
    col = col * (1 - .32 * lid[..., None]); rough = rough - .06 * lid
    # Ventral mouth arc and nostrils.
    ventral = (s < -.3)
    xm = .392 - 24 * z ** 2
    mouth = np.exp(-((x - xm) / .0012) ** 2) * (1 - smoothstep(.028, .034, np.abs(z))) * ventral
    nost = np.exp(-(((x - .423) / .0040) ** 2 + ((np.abs(z) - .016) / .0020) ** 2)) * ventral
    dark = np.maximum(mouth * .8, nost * .6)
    col = col * (1 - dark[..., None]) + GILL[None, None, :] * .8 * dark[..., None]
    rough = rough + .12 * dark
    # Fine denticle-scale roughness noise (hash noise, deterministic).
    rng = np.random.default_rng(1824)
    rough = rough + .025 * (rng.random(rough.shape) - .5)
    return np.clip(col, 0, 1), np.clip(rough, .3, .85)

def make_image(name, rgb, non_color=False):
    h, w = rgb.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=False)
    if non_color:
        img.colorspace_settings.name = 'Non-Color'
    px = np.ones((h, w, 4), np.float32); px[..., :3] = rgb
    img.pixels.foreach_set(px.ravel())
    img.pack()
    return img

# --------------------------------------------------------------------------- materials
def body_material():
    m = bpy.data.materials.new('SHARK_SKIN'); m.use_nodes = True
    nt = m.node_tree; bs = nt.nodes['Principled BSDF']
    col, rough = paint_body(TEX_W, TEX_H)
    _, rough_small = paint_body(ROUGH_W, ROUGH_H)
    base = nt.nodes.new('ShaderNodeTexImage'); base.image = make_image('shark_basecolor_1024x512', col)
    mr = np.zeros((ROUGH_H, ROUGH_W, 3)); mr[..., 1] = rough_small
    rimg = nt.nodes.new('ShaderNodeTexImage'); rimg.image = make_image('shark_roughness_512x256', mr, True)
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(base.outputs['Color'], bs.inputs['Base Color'])
    nt.links.new(rimg.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'], bs.inputs['Roughness'])
    bs.inputs['Metallic'].default_value = 0
    bs.inputs['Specular IOR Level'].default_value = .38
    return m

def vc_material(name, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bs = nt.nodes['Principled BSDF']
    vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
    nt.links.new(vc.outputs['Color'], bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value = rough; bs.inputs['Specular IOR Level'].default_value = .38
    return m

def plain_material(name, color, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (*srgb_to_linear(color), 1)
    bs.inputs['Roughness'].default_value = rough; bs.inputs['Specular IOR Level'].default_value = .5
    return m

def mesh_object(name, verts, faces, material, uvs=None, colors=None):
    me = bpy.data.meshes.new(name + '_MESH')
    me.from_pydata([to_blender(p) for p in verts], [], faces)
    me.materials.append(material)
    me.shade_smooth()
    if uvs is not None:
        layer = me.uv_layers.new(name='UVMap')
        for poly in me.polygons:
            for li in poly.loop_indices:
                layer.data[li].uv = uvs(poly, me.loops[li].vertex_index)
    if colors is not None:
        ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        lin = srgb_to_linear(np.array(colors))
        for i, c in enumerate(lin):
            ca.data[i].color = (*c, 1)
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    return ob

# --------------------------------------------------------------------------- body
def make_body(material):
    verts = [surface(0, 0)]
    for i in range(1, RINGS - 1):
        d = ring_d(i)
        for j in range(SIDES):
            verts.append(surface(d, -math.pi / 2 + TAU * j / SIDES))
    verts.append(surface(BODY_END, 0))
    tail = len(verts) - 1
    idx = lambda i, j: 1 + (i - 1) * SIDES + (j % SIDES)
    faces = [(0, idx(1, j + 1), idx(1, j)) for j in range(SIDES)]
    for i in range(1, RINGS - 2):
        for j in range(SIDES):
            faces.append((idx(i, j), idx(i, j + 1), idx(i + 1, j + 1), idx(i + 1, j)))
    faces += [(idx(RINGS - 2, j), idx(RINGS - 2, j + 1), tail) for j in range(SIDES)]
    # Winding must face outward (checked by normal test below).
    ring_of = {0: 0, tail: RINGS - 1}
    def uv(poly, vi):
        if vi == 0 or vi == tail:
            others = [v for v in poly.vertices if v not in (0, tail)]
            js = [(v - 1) % SIDES for v in others]
            j = (max(js) if max(js) - min(js) > 1 else min(js)) + .5
            return ((0 if vi == 0 else 1), j / SIDES)
        i = 1 + (vi - 1) // SIDES; j = (vi - 1) % SIDES
        js = [(v - 1) % SIDES for v in poly.vertices if v not in (0, tail)]
        if j == 0 and max(js) == SIDES - 1:
            j = SIDES          # seam column on the ventral midline
        return (ring_d(i) / BODY_END, j / SIDES)
    ob = mesh_object('BLACKTIP_BODY', verts, faces, material, uvs=uv)
    me = ob.data; me.update()
    # Ensure outward normals: a lateral vertex normal must point away from the axis.
    probe = idx(RINGS // 3, SIDES // 4)
    if me.vertices[probe].normal.dot(Vector(me.vertices[probe].co) - Vector((me.vertices[probe].co.x, 0, me.vertices[probe].co.z))) < 0:
        me.flip_normals()
    return ob

# --------------------------------------------------------------------------- fins
def _seg_dist(p, a, b):
    ab = b - a; t = max(0, min(1, (p - a).dot(ab) / max(ab.length_squared, 1e-12)))
    return (p - (a + ab * t)).length

def _poly_dist(p, poly):
    return min(_seg_dist(p, poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly)))

def fin_sheet(outline, h, place, thickness, color, edge_round=.015):
    """Lens-shaped fin: a Delaunay-filled 2D outline, inflated to thickness(a,b)*sqrt(dist/edge_round)
    on both sides, meeting at a knife margin. place(a,b)->(point, normal) maps to the contract frame."""
    pts = [Vector(p) for p in outline]
    area = sum(pts[i].x * pts[(i + 1) % len(pts)].y - pts[(i + 1) % len(pts)].x * pts[i].y for i in range(len(pts))) / 2
    if area < 0:
        pts.reverse()
    boundary = []
    for i, a in enumerate(pts):
        b = pts[(i + 1) % len(pts)]; n = max(1, math.ceil((b - a).length / h))
        boundary += [a.lerp(b, k / n) for k in range(n)]
    nb = len(boundary)
    # Two regular offset rings along every margin give an even edge strip, so the
    # rounded knife edge and the dark margin colours do not zig-zag on the fill grid.
    rings = []
    for delta in (.3 * h, .8 * h):
        for i, p in enumerate(boundary):
            t = (boundary[(i + 1) % nb] - boundary[i - 1]).normalized()
            q = p + Vector((-t.y, t.x)) * delta
            if _inside(q, pts) and _poly_dist(q, pts) > .8 * delta and all((q - r).length > .45 * h * (delta / h + .2) for r in rings[-6:]):
                rings.append(q)
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts))); hi = Vector((max(p.x for p in pts), max(p.y for p in pts)))
    interior = []
    row = 0; y = lo.y + h * .5
    while y < hi.y:
        x = lo.x + (h * .5 if row % 2 else 0)
        while x < hi.x:
            p = Vector((x, y))
            if _inside(p, pts) and _poly_dist(p, boundary) > h * 1.3:
                interior.append(p)
            x += h
        y += h * .866; row += 1
    interior = rings + interior
    coords = boundary + interior
    res = geometry.delaunay_2d_cdt([tuple(p) for p in coords], [], [list(range(nb))], 1, 1e-7)
    tris = [t for t in res[2] if len(t) == 3]
    verts, colors = [], []
    top_index, bot_index = {}, {}
    for k, p in enumerate(coords):
        P, N = place(p.x, p.y)
        u = min(1, _poly_dist(p, pts) / edge_round)
        t = 0 if k < nb else thickness(p.x, p.y) * math.sqrt(u * (2 - u)) * .5
        top_index[k] = len(verts); verts.append(tuple(P + N * t)); colors.append(color(p.x, p.y, True))
        if k < nb:
            bot_index[k] = top_index[k]
        else:
            bot_index[k] = len(verts); verts.append(tuple(P - N * t)); colors.append(color(p.x, p.y, False))
    # The CCW outline faces +N only if the (a,b) frame is right-handed about N; else swap sheets.
    P0, N0 = place(*coords[tris[0][0]]); P1, _ = place(*coords[tris[0][1]]); P2, _ = place(*coords[tris[0][2]])
    flip = (P1 - P0).cross(P2 - P0).dot(N0) < 0
    top = [tuple(top_index[i] for i in (reversed(t) if flip else t)) for t in tris]
    bottom = [tuple(bot_index[i] for i in (t if flip else reversed(t))) for t in tris]
    return verts, top + bottom, colors

def _inside(p, poly):
    inside = False; n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        if (a.y > p.y) != (b.y > p.y) and p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x:
            inside = not inside
    return inside

def planar_xy(a, b):
    return Vector((a, b, 0)), Vector((0, 0, 1))

def mix(c0, c1, t):
    return np.asarray(c0) * (1 - t) + np.asarray(c1) * t

def ss(a, b, x):
    return float(smoothstep(a, b, x))

def merge(parts):
    verts, faces, colors = [], [], []
    for v, f, c in parts:
        o = len(verts); verts += v; colors += c; faces += [tuple(i + o for i in t) for t in f]
    return verts, faces, colors

def first_dorsal():
    outline = [(.190, .060), (.186, .079), (.170, .110), (.150, .145), (.128, .172), (.112, .186), (.100, .192),
               (.090, .190), (.086, .178), (.086, .150), (.082, .122), (.074, .102), (.060, .088), (.090, .081), (.095, .062)]
    def colour(x, y, top):
        edge = .158 + .10 * (x - .10)                       # oblique lower edge of the black cap
        black = ss(edge - .003, edge + .004, y)             # abrupt but not aliased
        band = ss(edge - .026, edge - .014, y) * (1 - black)
        return tuple(mix(mix(FIN, PALE_BAND, .52 * band), BLACK, black))
    thick = lambda x, y: .013 * (1 - .78 * ss(.075, .19, y))
    return fin_sheet(outline, .004, planar_xy, thick, colour, .028)

def second_dorsal():
    outline = [(-.098, .040), (-.100, .058), (-.110, .075), (-.122, .090), (-.132, .098), (-.140, .097),
               (-.144, .088), (-.146, .074), (-.162, .052), (-.142, .050), (-.142, .036)]
    def colour(x, y, top):
        black = ss(.084, .091, y); band = ss(.068, .078, y) * (1 - black)
        return tuple(mix(mix(FIN, PALE_BAND, .35 * band), BLACK, .88 * black))
    thick = lambda x, y: .008 * (1 - .7 * ss(.05, .098, y))
    return fin_sheet(outline, .004, planar_xy, thick, colour)

def anal_fin():
    outline = [(-.105, -.036), (-.108, -.054), (-.118, -.070), (-.128, -.083), (-.138, -.090), (-.146, -.088),
               (-.150, -.078), (-.154, -.064), (-.170, -.046), (-.150, -.050), (-.150, -.034)]
    def colour(x, y, top):
        black = ss(-.078, -.086, y); band = ss(-.064, -.072, y) * (1 - black)
        base = mix(FIN, BELLY, .25)
        return tuple(mix(mix(base, PALE_BAND, .3 * band), BLACK, .85 * black))
    thick = lambda x, y: .008 * (1 - .7 * ss(-.05, -.09, y))
    return fin_sheet(outline, .004, planar_xy, thick, colour)

def caudal_fin():
    outline = [(-.195, .010), (-.200, .030), (-.240, .042), (-.290, .062), (-.340, .083), (-.390, .103), (-.425, .117),
               (-.447, .124), (-.451, .118), (-.442, .108), (-.427, .100), (-.418, .094), (-.410, .093), (-.395, .078),
               (-.375, .058), (-.355, .036), (-.340, .016), (-.325, .000), (-.327, -.030), (-.329, -.060), (-.331, -.080),
               (-.333, -.087), (-.326, -.090), (-.300, -.070), (-.270, -.050), (-.240, -.035), (-.215, -.029), (-.195, -.010)]
    posterior = [Vector(p) for p in [(-.451, .118), (-.442, .108), (-.427, .100), (-.418, .094), (-.410, .093), (-.395, .078), (-.375, .058), (-.355, .036), (-.340, .016)]]
    tip = Vector((-.447, .121))
    def colour(x, y, top):
        p = Vector((x, y))
        lower = ss(-.054, -.064, y)                         # prominent black lower-lobe tip
        lower_band = ss(-.036, -.046, y) * (1 - lower) * ss(-.25, -.29, x)
        upper = 1 - ss(.018, .034, (p - tip).length)
        edging = (1 - ss(.0035, .0075, min(_seg_dist(p, posterior[i], posterior[i + 1]) for i in range(len(posterior) - 1)))) * ss(-.33, -.36, x)
        c = mix(FIN, PALE_BAND, .45 * lower_band)
        c = mix(c, BLACK, max(lower, .85 * upper, .55 * edging))
        return tuple(c)
    thick = lambda x, y: max(.003, .013 * (1 - .8 * min(1, (Vector((x, y)) - Vector((-.22, 0))).length / .21)))
    return fin_sheet(outline, .0058, planar_xy, thick, colour, .022)

def paired_frame(origin, span_dir, droop):
    O = Vector(origin); E1 = Vector((-1, 0, 0)); E2 = Vector(span_dir).normalized()
    N = E1.cross(E2).normalized()
    if N.y < 0:
        N = -N
    def place(a, b):
        return O + E1 * a + E2 * b - N * (droop * max(0, b) ** 2), N
    return place

def pectoral(side):
    ang = math.radians(22)
    place = paired_frame((.262, -.040, .040 * side), (0, -math.sin(ang), math.cos(ang) * side), 1.6)
    outline = [(-.004, -.024), (0, .004), (.012, .030), (.030, .060), (.055, .090), (.085, .115), (.106, .127), (.115, .128),
               (.118, .122), (.105, .100), (.090, .072), (.078, .050), (.075, .030), (.062, .014), (.060, -.024)]
    posterior = [Vector(p) for p in [(.118, .122), (.105, .100), (.090, .072), (.078, .050), (.075, .030)]]
    tip = Vector((.114, .124))
    def colour(a, b, top):
        p = Vector((a, b))
        blacktip = 1 - ss(.012, .024, (p - tip).length)
        edge = (1 - ss(.003, .007, min(_seg_dist(p, posterior[i], posterior[i + 1]) for i in range(len(posterior) - 1)))) * ss(.04, .07, b)
        base = FIN if top else mix(BELLY, FIN, .25)
        return tuple(mix(base, BLACK, max(.8 * blacktip, .45 * edge)))
    thick = lambda a, b: .011 * (1 - .72 * ss(0, .125, b))
    return fin_sheet(outline, .0058, place, thick, colour, .024)

def pelvic(side):
    place = paired_frame((.022, -.058, .020 * side), (0, -.6, .8 * side), .8)
    outline = [(-.002, -.008), (0, .004), (.012, .022), (.028, .036), (.036, .034), (.044, .022), (.058, .010), (.052, .002), (.050, -.008)]
    tip = Vector((.030, .034))
    def colour(a, b, top):
        blacktip = 1 - ss(.006, .013, (Vector((a, b)) - tip).length)
        base = FIN if top else mix(BELLY, FIN, .25)
        return tuple(mix(base, BLACK, .75 * blacktip))
    thick = lambda a, b: .007 * (1 - .6 * ss(0, .036, b))
    return fin_sheet(outline, .0042, place, thick, colour)

def make_fins(material):
    v, f, c = merge([first_dorsal(), second_dorsal(), anal_fin(), caudal_fin(), pelvic(1), pelvic(-1)])
    median = mesh_object('FINS_MEDIAN_PELVIC', v, f, material, None, c)
    pecs = []
    for side, label in ((1, 'R'), (-1, 'L')):
        v, f, c = pectoral(side)
        pecs.append(mesh_object('PECTORAL_' + label, v, f, material, None, c))
    return median, pecs

# --------------------------------------------------------------------------- eyes
def make_eyes(material):
    bm = bmesh.new()
    d = .45 - EYE_X; D, V, L, yc = profile(d)
    for side in (1, -1):
        c = math.sqrt(1 - EYE_SIN ** 2)
        P = Vector((EYE_X, yc + D * EYE_SIN, L * c * side))
        # Outward normal of the ellipse cross-section (x-slope of the profile ignored: small here).
        N = Vector((0, EYE_SIN / D, c * side / L)).normalized()
        T = Vector((1, 0, 0)); B = N.cross(T).normalized()
        centre = P - N * .0034
        geom = bmesh.ops.create_uvsphere(bm, u_segments=18, v_segments=10, radius=1)
        m = Matrix((T * .0085, B * .0060, N * .0042)).transposed()
        for v in geom['verts']:
            v.co = centre + m @ v.co
    verts = [tuple(v.co) for v in bm.verts]; bm.verts.index_update()
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]; bm.free()
    return mesh_object('EYES', verts, faces, material)

# --------------------------------------------------------------------------- rig
def make_rig(meshes, pectorals):
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0)); rig = bpy.context.object
    rig.name = 'BLACKTIP_SHARK_RIG'; rig.data.name = 'BLACKTIP_SHARK_RIG_DATA'
    arm = rig.data; arm.edit_bones.remove(arm.edit_bones[0])
    root = arm.edit_bones.new('Root'); root.head = (0, 0, 0); root.tail = (.06, 0, 0)
    for i, s in enumerate(S):
        b = arm.edit_bones.new(f'Spine_{i:02d}'); x = .45 - .9 * s
        b.head = (x, 0, 0); b.tail = (x - .035, 0, 0); b.parent = root; b.use_connect = False
    # Pivot at the pectoral root quarter-chord (inside the body), tail along the span.
    for side, label in ((1, 'R'), (-1, 'L')):
        b = arm.edit_bones.new('Pectoral_' + label)
        b.head = to_blender((.247, -.042, .043 * side)); b.tail = to_blender((.200, -.080, .130 * side))
        b.parent = root; b.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    def spine_weights(ob):
        groups = [ob.vertex_groups.new(name=f'Spine_{i:02d}') for i in range(16)]
        for v in ob.data.vertices:
            s = max(0, min(1, (.45 - v.co.x) / .9))
            hi = next((i for i, x in enumerate(S) if x >= s), 15); lo = max(0, hi - 1)
            if lo == hi:
                groups[lo].add([v.index], 1, 'REPLACE')
            else:
                t = (s - S[lo]) / (S[hi] - S[lo]); groups[lo].add([v.index], 1 - t, 'REPLACE'); groups[hi].add([v.index], t, 'REPLACE')
    for ob in meshes + pectorals:
        ob.parent = rig; mod = ob.modifiers.new('Armature_Deform', 'ARMATURE'); mod.object = rig
    for ob in meshes:
        spine_weights(ob)
    for fin, label in zip(pectorals, ('R', 'L')):
        # Rigid fin on its control bone; the bone itself follows the body section in Shark.ts.
        fin.vertex_groups.new(name='Pectoral_' + label).add(list(range(len(fin.data.vertices))), 1., 'REPLACE')
    return rig

def triangle_count(obs):
    return sum(sum(len(p.vertices) - 2 for p in ob.data.polygons) for ob in obs)

def main():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.armatures):
        for block in list(coll):
            coll.remove(block)
    skin = body_material(); fin_mat = vc_material('SHARK_FIN', .46)
    eye_mat = plain_material('SHARK_EYE', (.035, .04, .035), .2)
    body = make_body(skin); median, pecs = make_fins(fin_mat); eyes = make_eyes(eye_mat)
    meshes = [body, median, eyes]
    rig = make_rig(meshes, pecs)
    tris = triangle_count(meshes + pecs)
    meta = {'asset': 'blacktip-shark.glb', 'species': 'Carcharhinus melanopterus (烏翅真鯊)', 'revision': 'Q3 B1 2026-09-27',
            'triangles': tris, 'textures': {'baseColor': [TEX_W, TEX_H], 'metallicRoughness': [ROUGH_W, ROUGH_H], 'format': 'JPEG q85'},
            'pectoral_weight': 1.0, 'clips': []}
    scene = bpy.context.scene
    scene['asset'] = 'selfmade juvenile 烏翅真鯊 Carcharhinus melanopterus'
    scene['coordinate_contract'] = 'nose +X; tail -X; dorsal +Y; lateral Z; metres'
    scene['spine_s'] = list(S); scene['q3_b1'] = json.dumps(meta, ensure_ascii=False)
    scene.unit_settings.system = 'METRIC'; scene.unit_settings.length_unit = 'METERS'
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.object.select_all(action='SELECT'); bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
                              export_animations=True, export_skins=True, export_normals=True, export_materials='EXPORT',
                              export_image_format='JPEG', export_jpeg_quality=85, export_extras=True, export_tangents=False)
    data = OUT.read_bytes()
    meta.update({'glb_bytes': len(data), 'glb_sha256': hashlib.sha256(data).hexdigest(), 'bones': [b.name for b in rig.data.bones],
                 'draw_meshes': [o.name for o in meshes + pecs]})
    REVIEW.mkdir(parents=True, exist_ok=True)
    (REVIEW / 'model-metadata.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    (REVIEW / 'model-contract.json').write_text(json.dumps({'asset': 'blacktip-shark.glb', 'units': 'metres', 'length': .9,
        'axes': {'nose': '+X', 'tail': '-X', 'dorsal': '+Y', 'lateral': 'Z'}, 'nose_x': .45, 'tailtip_x': -.45, 'spine_s': S,
        'rest_local_axes': {'+Y': 'world -X tailward', '+Z': 'world +Y dorsal', '+X': 'world +Z lateral'}, 'parent': 'Root',
        'spine_chained': False, 'pectoral_controls': {'Pectoral_R': '+Z side', 'Pectoral_L': '-Z side', 'weight': 1.0,
        'pivot': [.247, -.042, .043]}, 'clips': []}, indent=2))
    print('B1_META', json.dumps(meta, ensure_ascii=False))

if __name__ == '__main__':
    main()
