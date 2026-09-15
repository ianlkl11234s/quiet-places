"""Reproducible modeled coastal arcade. Run in a fresh background Blender process.
Blender X/Y/Z -> glTF X/Z/-Y. No downloaded assets; maps are original seeded wear studies.
"""
from pathlib import Path
import argparse
import json
import math
import random
import sys
import hashlib

import bpy
import bmesh
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))
CONFIG = json.loads((ROOT / 'assets/config/last-arcade.json').read_text())
RNG = random.Random(CONFIG['seed'])
REVIEW = ROOT / 'exports/last-arcade-review'
TEXTURES = ROOT / 'assets/blender/last-arcade-textures'
BATCHES = {}
BOX_CACHE = {}


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


def image_map(name, pixels, noncolor=False):
    n = pixels.shape[0]
    rgba = np.ones((n, n, 4), dtype=np.float32)
    rgb = pixels[:, :, None] if pixels.ndim == 2 else pixels
    # Image pixels are encoded values: convert linear reflectance to sRGB for color maps.
    rgba[:, :, :3] = rgb if noncolor else np.where(rgb <= .0031308, rgb*12.92, 1.055*np.maximum(rgb,0)**(1/2.4)-.055)
    img = bpy.data.images.new(name, width=n, height=n, alpha=False)
    if noncolor:
        img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw = str(TEXTURES / (name + '.png'))
    img.file_format = 'PNG'
    img.save()
    return img


def material(name, color, rough=.8, metal=0, texture=None, uv_scale=.72):
    m = bpy.data.materials.new('arcade-' + name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    # Projected UV density is a material decision: wall mineral clouds should
    # span several metres, while aggregate remains a small-scale surface cue.
    m['arcade_uv_scale'] = uv_scale
    if texture:
        rng = np.random.default_rng(CONFIG['seed'] + sum(map(ord, name)))
        n = 512
        broad = field(rng, n, 4, 5)
        mid = field(rng, n, 22, 28)
        fine = field(rng, n, 90, 100)
        grain = rng.random((n, n))
        base = np.array(color)[None, None, :]
        metallic = None
        if texture == 'concrete':
            # Broad chalky/mineral shifts, with restrained vertical deposits.
            cloud = (broad - .5) * .13 + (mid - .5) * .045
            mineral = np.clip((field(rng, n, 8, 10) - .67) * 2.2, 0, 1)
            runoff_columns = field(rng, n, 48, 3)
            runoff_breaks = field(rng, n, 5, 16)
            runoff = np.clip((runoff_columns - .74) * 7, 0, 1) * (.25 + .75 * runoff_breaks)
            runoff *= np.clip((broad - .40) * 1.5, 0, 1) * .22
            rgb = base * (1 + cloud[:, :, None])
            rgb = rgb * (1 - mineral[:, :, None] * .07) + np.array([.54, .535, .48]) * mineral[:, :, None] * .07
            rgb *= 1 - runoff[:, :, None] * .12
            roughness = np.clip(.77 + broad * .11 + mineral * .06 + runoff * .09, .74, .96)
            height = broad * .20 + mid * .12 + fine * .035 + mineral * .05
        elif texture == 'steel':
            # Paint remains dielectric. Corrosion is sparse and clustered around
            # paint failure; fine vertical runoff is weaker than the clusters.
            paint = (broad - .5) * .075 + (mid - .5) * .035
            cluster = field(rng, n, 7, 9)
            chips = field(rng, n, 35, 38)
            rust = np.clip((cluster * .70 + chips * .30 - .60) * 5.3, 0, 1)
            streak_columns = field(rng, n, 58, 3)
            streak_breaks = field(rng, n, 5, 17)
            runoff = np.clip((streak_columns - .64) * 8.5, 0, 1) * (.18 + .82 * streak_breaks)
            runoff *= np.clip((cluster - .46) * 2.1, 0, 1) * .38
            rust = np.maximum(rust, runoff * .42)
            exposed = np.clip((chips - .84) * 7.5, 0, 1) * (1 - rust) * .16
            rgb = base * (1 + paint[:, :, None])
            rust_color = np.array([.235, .105, .035])
            rgb = rgb * (1 - rust[:, :, None]) + rust_color * rust[:, :, None]
            rgb = rgb * (1 - exposed[:, :, None]) + np.array([.29, .285, .255]) * exposed[:, :, None]
            roughness = np.clip(.80 + broad * .08 + mid * .04 + rust * .08 - exposed * .12, .42, .96)
            metallic = np.clip(exposed * .72, 0, .72)
            height = mid * .13 + fine * .025 + rust * .075 + exposed * .018
        else:
            # Aggregate is color- and roughness-varied, but its relief stays fine
            # enough that actual paver/kerb geometry remains the dominant cue.
            aggregate = field(rng, n, 48, 54)
            scalar = .93 + (broad - .5) * .10 + (aggregate - .5) * .075 + (grain - .5) * .018
            rgb = base * scalar[:, :, None]
            roughness = np.clip(.76 + broad * .12 + aggregate * .075 + grain * .025, .70, .98)
            height = aggregate * .075 + fine * .035 + grain * .008
        gy, gx = np.gradient(height)
        normal = np.dstack((-gx * 1.45, -gy * 1.45, np.ones((n, n))))
        normal /= np.linalg.norm(normal, axis=2)[:, :, None]
        nodes, links = m.node_tree.nodes, m.node_tree.links
        tex = nodes.new('ShaderNodeTexImage'); tex.image = image_map(name + '-color', np.clip(rgb, 0, 1))
        links.new(tex.outputs['Color'], bs.inputs['Base Color'])
        roughtex = nodes.new('ShaderNodeTexImage'); roughtex.image = image_map(name + '-roughness', roughness, True)
        links.new(roughtex.outputs['Color'], bs.inputs['Roughness'])
        if metallic is not None:
            metaltex = nodes.new('ShaderNodeTexImage'); metaltex.image = image_map(name + '-metallic', metallic, True)
            links.new(metaltex.outputs['Color'], bs.inputs['Metallic'])
        normaltex = nodes.new('ShaderNodeTexImage'); normaltex.image = image_map(name + '-normal', normal * .5 + .5, True)
        normalnode = nodes.new('ShaderNodeNormalMap'); normalnode.inputs['Strength'].default_value = .34
        links.new(normaltex.outputs['Color'], normalnode.inputs['Color']); links.new(normalnode.outputs['Normal'], bs.inputs['Normal'])
    return m


class Batch:
    def __init__(self, name, mat):
        self.name, self.mat = name, mat
        self.uv_scale = float(mat.get('arcade_uv_scale', .72))
        self.v, self.f, self.uv = [], [], []

    def add(self, vertices, faces, uv=None):
        offset = len(self.v)
        self.v.extend(tuple(v) for v in vertices)
        self.f.extend(tuple(offset + i for i in face) for face in faces)
        if uv is None:
            for face in faces:
                a, b, c = (Vector(vertices[i]) for i in face[:3])
                normal = (b-a).cross(c-a)
                axis = max(range(3), key=lambda i: abs(normal[i]))
                axes = ((1, 2), (0, 2), (0, 1))[axis]
                self.uv.extend((vertices[i][axes[0]] * self.uv_scale, vertices[i][axes[1]] * self.uv_scale) for i in face)
        else:
            self.uv.extend(uv)

    def finish(self):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.v, [], self.f); mesh.update()
        mesh.materials.append(self.mat)
        uvs = mesh.uv_layers.new(name='UVMap')
        for loop, uv in zip(uvs.data, self.uv):
            loop.uv = uv
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj['arcade_role'] = 'architecture'
        return obj


def batch(mat, zone=0):
    key = (mat.name, zone)
    if key not in BATCHES:
        BATCHES[key] = Batch(mat.name + '-zone-' + str(zone), mat)
    return BATCHES[key]


def box(center, size, mat, bevel=0, zone=0):
    key = (*size, bevel)
    if key not in BOX_CACHE:
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
        for v in bm.verts:
            for i in range(3): v.co[i] *= size[i]
        if bevel:
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect='EDGES')
        bm.verts.ensure_lookup_table()
        for i, v in enumerate(bm.verts): v.index=i
        BOX_CACHE[key] = ([tuple(v.co) for v in bm.verts], [tuple(v.index for v in f.verts) for f in bm.faces])
        bm.free()
    vertices, faces = BOX_CACHE[key]
    batch(mat, zone).add([tuple(v[i]+center[i] for i in range(3)) for v in vertices], faces)


def tube(points, radius, mat, sides=8, zone=0):
    vertices=[]
    for j, point in enumerate(points):
        tangent = Vector(points[min(j+1, len(points)-1)]) - Vector(points[max(0,j-1)])
        tangent.normalize()
        axis = Vector((0,0,1)) if abs(tangent.z)<.95 else Vector((1,0,0))
        u=tangent.cross(axis).normalized(); v=tangent.cross(u).normalized()
        for i in range(sides):
            vertices.append(Vector(point) + radius*(u*math.cos(i*math.tau/sides)+v*math.sin(i*math.tau/sides)))
    faces=[]
    for j in range(len(points)-1):
        for i in range(sides):
            a=j*sides+i; b=j*sides+(i+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(reversed(range(sides))), tuple((len(points)-1)*sides+i for i in range(sides))])
    batch(mat, zone).add(vertices, faces)


def make_shutter(y0, width, height, mat, trim, zone):
    # Each horizontal slat is extruded from a folded steel profile, not painted lines.
    slat=.081
    for i in range(int(height/slat)):
        z=.06+i*slat
        profile=[(-.035,z),(-.018,z+.008),(-.007,z+.018),(-.007,z+.060),(-.022,z+.071),(-.043,z+.076),(-.049,z+.073),(-.032,z+.065),(-.017,z+.058),(-.017,z+.02),(-.028,z+.011),(-.045,z+.004)]
        vertices=[]
        # Subdivide only the near doors to permit one restrained dent per selected slat.
        for j in range(5):
            y=y0+.10+(width-.20)*j/4
            dent = -.015*math.sin(j*math.pi/4) if i in (7,8,9) and zone==0 else 0
            vertices.extend((x+dent,y,h) for x,h in profile)
        m=len(profile);faces=[]
        for j in range(4):
            for k in range(m): faces.append((j*m+k,j*m+(k+1)%m,(j+1)*m+(k+1)%m,(j+1)*m+k))
        faces.extend([tuple(reversed(range(m))),tuple(4*m+k for k in range(m))])
        batch(mat,zone).add(vertices,[tuple(reversed(f)) for f in faces])
    box((-.018,y0+width/2,.047),(.10,width-.13,.082),trim,.009,zone)
    for y in (y0+.08,y0+width-.08):
        box((.0,y,height/2),(.115,.058,height+.08),trim,.005,zone)
    if zone==0:
        tube([(.022,y0+width*.43,.59),(.080,y0+width*.43,.59),(.080,y0+width*.56,.59),(.022,y0+width*.56,.59)],.009,trim,8,zone)
        for y in (y0+width*.43,y0+width*.56): box((.024,y,.59),(.018,.037,.065),trim,.004,zone)


def street_context(stone, painted, roof, glass, joint, sea):
    """A narrow street, separate parcels and a coastal T junction; metres Z-up."""
    asphalt=material('road-asphalt',(.105,.111,.108),rough=.97,texture='stone',uv_scale=.65)
    patch=material('road-repair',(.088,.091,.087),rough=.98,texture='stone',uv_scale=.74)
    paint=material('road-worn-edge',(.47,.45,.38),rough=.94)
    iron=material('drain-iron',(.055,.062,.060),rough=.88,metal=.22)
    walls=[material('opposite-wall-'+str(i),c,texture='concrete',uv_scale=.24) for i,c in enumerate([(.47,.448,.39),(.53,.50,.43),(.40,.437,.42)])]
    trim=material('opposite-window-frame',(.24,.255,.235),rough=.85,metal=.04)
    door=material('opposite-door',(.19,.205,.18),rough=.9)
    def road_z(x): return -.145+.042*max(0,1-abs(x-6.10)/3.02)
    # Continuous subgrade, with a shallow crown falling into the edge drains.
    box((2,14.4,-.38),(56,46.8,.42),joint)
    xs=[3.08,4.5,6.10,7.6,9.12]
    for xa,xb in zip(xs,xs[1:]):
        for y in range(-9,30,3):
            y2=min(29.6,y+3)
            batch(asphalt,2).add([(xa,y,road_z(xa)),(xb,y,road_z(xb)),(xb,y2,road_z(xb)),(xa,y2,road_z(xa))],[(0,1,2,3)])
    # The local lane meets a coastal road; it does not continue out over water.
    box((2,32.2,-.185),(56,5.2,.08),asphalt)
    box((1.39,29.05,-.055),(2.70,1.10,.11),stone,.006,2)
    box((2,36.4,-.07),(56,3.2,.12),stone,.008,2)
    box((2,38.02,-.22),(56,.28,.66),stone,.014,2)
    box((0,919.15,-.58),(3000,1762,.035),sea)
    # Low curb and slender coastal railing leave a credible sea sightline.
    for x in range(-22,29,4):
        tube([(x,37.97,.11),(x,37.97,1.03)],.024,painted,8,2)
    tube([(-24,37.97,1.03),(30,37.97,1.03)],.023,painted,8,2)
    # Opposite pavement has depth, individual kerbs, and access to the door thresholds.
    box((9.72,10.3,-.063),(1.20,38.6,.126),stone,.009,2)
    for j in range(64):
        yy=-8.8+j*.6
        box((9.16,yy,-.05),(.15,.589,.18),stone,.005,2)
        box((9.065,yy,-.132),(.07,.589,.029),joint,.003,2)
    for yy in (-4.7,4.9,14.5,24.1):
        box((9.035,yy,-.126),(.17,.42,.022),iron,.003,2)
        for k in range(6):box((9.035,yy-.17+k*.066,-.111),(.13,.012,.012),joint,0,2)
    for yy,length in ((-5.8,3.4),(-1.8,2.7),(2,4.2),(7.4,3.2),(12.3,3.9),(18,3.2),(23,3.0)):
        box((3.36,yy+length/2,road_z(3.36)+.001),(.065,length,.002),paint,0,2)
    # Restrained patch seams and two actual inset iron covers, rather than uniform distress.
    for xx,yy,ww,ll in ((4.2,3.1,.8,2.6),(7.75,12.4,1.15,1.7)):
        corners=[(xx-ww/2,yy-ll/2),(xx+ww*.44,yy-ll*.48),(xx+ww/2,yy+ll/2),(xx-ww*.48,yy+ll*.44)]
        batch(patch,2).add([(x,y,road_z(x)+.002) for x,y in corners],[(0,1,2,3)])
    for xx,yy in ((6.5,6.1),(5.7,20.4)):
        z=road_z(xx)
        tube([(xx,yy,z+.002),(xx,yy,z+.012)],.30,iron,32,2)
        tube([(xx,yy,z+.012),(xx,yy,z+.015)],.275,joint,32,2)
        for k in range(5):box((xx-.15+k*.075,yy,z+.018),(.016,.36,.005),iron,0,2)

    # Build facade piers around real recesses; no full box sits behind the openings.
    parcels=[(-6.8,5.1,5.75,.0),(-1.32,4.55,3.25,.14),(3.68,5.5,6.0,.03),(9.60,4.25,4.05,.28),(14.30,5.2,5.55,.08),(19.95,5.65,3.60,.20)]
    for number,(start,width,height,setback) in enumerate(parcels):
        front=10.33+setback;back=front+4.2;mat=walls[number%3]
        box((back-.08,start+width/2,height/2),(.16,width,height),mat,.008,2)
        for yy in (start+.08,start+width-.08):box(((front+back)/2,yy,height/2),(back-front,.16,height),mat,.008,2)
        floors=[(0,2.85),(2.85,height)]
        for floor,(bottom,top) in enumerate(floors):
            if floor==0:
                openings=[(.50,1.40,.05,2.25,'door'),(width*.49,width-.38,.85,2.20,'window')]
            elif top-bottom>1.45:
                openings=[(.55,1.75,bottom+.40,top-.50,'window'),(width-1.85,width-.48,bottom+.40,top-.50,'window')]
            else:openings=[]
            cursor=0
            for ya,yb,za,zb,kind in openings:
                if ya>cursor:box((front+.09,start+(cursor+ya)/2,(bottom+top)/2),(.18,ya-cursor,top-bottom),mat,.005,2)
                for zlo,zhi in ((bottom,za),(zb,top)):
                    if zhi>zlo:box((front+.09,start+(ya+yb)/2,(zlo+zhi)/2),(.18,yb-ya,zhi-zlo),mat,.004,2)
                cy=start+(ya+yb)/2;cz=(za+zb)/2;w=yb-ya;h=zb-za
                box((front+.22,cy,cz),(.035,w,h),joint,.002,2)
                box((front+.18,cy,cz),(.024,w-.08,h-.08),door if kind=='door' else glass,.002,2)
                for edge in (start+ya+.025,start+yb-.025):box((front+.05,edge,cz),(.12,.05,h),trim,.003,2)
                for z in (za+.025,zb-.025):box((front+.05,cy,z),(.12,w,.05),trim,.003,2)
                if kind=='window':
                    box((front+.045,cy,cz),(.075,.032,h-.08),trim,.002,2)
                    box((front-.035,cy,za-.025),(.30,w+.12,.07),stone,.004,2)
                else:
                    box((front-.065,cy,.027),(.30,w+.20,.055),stone,.003,2)
                    tube([(front+.135,start+yb-.16,.88),(front+.095,start+yb-.16,.88),(front+.095,start+yb-.16,1.05)],.009,trim,8,2)
                    # Small entrance canopy with two attached brackets.
                    box((front-.26,cy,2.40),(.65,w+.40,.055),roof,.004,2)
                    for edge in (start+ya,start+yb):tube([(front,edge,2.12),(front-.43,edge,2.36)],.016,trim,6,2)
                cursor=yb
            if cursor<width:box((front+.09,start+(cursor+width)/2,(bottom+top)/2),(.18,width-cursor,top-bottom),mat,.005,2)
        # Different flat and shallow shed roofs, plus connected gutters/downpipes.
        slope=.38 if number%2 else .08
        v=[(front-.20,start-.16,height),(back+.13,start-.16,height+slope),(back+.13,start+width+.16,height+slope),(front-.20,start+width+.16,height)]
        batch(roof,2).add(v,[(0,1,2,3)])
        box((front-.15,start+width/2,height-.045),(.16,width+.32,.12),trim,.003,2)
        tube([(front-.18,start+width-.18,height),(front-.18,start+width-.18,.10),(front-.23,start+width-.18,.02)],.035,trim,8,2)
        # Plinth meets sidewalk; varied facade heights have a consistent floor datum.
        for ya,yb in ((0,.5),(1.4,width)):
            box((front-.018,start+(ya+yb)/2,.12),(.075,yb-ya,.24),stone,.005,2)


def architecture():
    plaster=material('plaster',(.66,.635,.55),texture='concrete',uv_scale=.20)
    ceiling=material('soffit',(.61,.598,.525),texture='concrete',uv_scale=.23)
    steel=material('shutter',(.64,.615,.536),rough=.75,metal=.06,texture='steel',uv_scale=.55)
    steel2=material('shutter-faded',(.56,.585,.548),rough=.78,metal=.04,texture='steel',uv_scale=.55)
    painted=material('painted-support',(.62,.605,.535),rough=.74,metal=.13,texture='steel',uv_scale=.45)
    roof=material('roof-zinc',(.26,.28,.27),rough=.78,metal=.23,texture='steel',uv_scale=.45)
    rust=material('rust',(.22,.104,.036),rough=.97)
    joint=material('recess',(.13,.131,.108),rough=.97)
    soil=material('soil',(.105,.076,.041),texture='stone',uv_scale=.72)
    asphalt=material('asphalt',(.215,.222,.209),rough=.97,texture='stone',uv_scale=.46)
    stone=material('kerb',(.43,.43,.384),rough=.94,texture='stone',uv_scale=.58)
    tiles=[material('paver-'+str(i),c,rough=.89,texture='stone',uv_scale=.82) for i,c in enumerate([(.43,.368,.278),(.46,.393,.302),(.40,.358,.285),(.48,.419,.326),(.35,.262,.187)])]
    ceramic=material('wall-ceramic',(.69,.68,.598),rough=.58,texture='stone',uv_scale=.40)
    glass=material('distant-window',(.19,.24,.25),rough=.34)
    black=material('sign-ink',(.12,.14,.125),rough=.9)
    sea=material('sea',(.033,.165,.193),rough=.22,metal=0)
    sea.node_tree.nodes['Principled BSDF'].inputs['IOR'].default_value=1.333
    # Walkway has a continuous backing even where an individual paver is missing.
    box((1.40,10.5,-.12),(3.15,35,.22),joint,0)
    box((-3.0,10,1.75),(5.7,34,3.5),plaster,.012)
    box((-2.7,10,3.54),(6.2,34,.20),stone,.01)
    street_context(stone,painted,roof,glass,joint,sea)
    # Detailed running-bond paving. Stable grid with millimetre-scale variation.
    for row in range(140):
        y=-6.8+row*.254
        if y>28.5: break
        zone=0 if y<9 else 1 if y<19 else 2
        for col in range(8):
            x=-.13+col*.42+(.21 if row%2 else 0)
            low=max(.045,x); high=min(2.66,x+.408)
            if high-low<.04: continue
            edge=low<.3 or high>2.4
            if edge and RNG.random()<.02: continue
            top=-.009*(x/2.85) + (RNG.uniform(-.003,.002) if edge else 0)
            mat=tiles[RNG.choices(range(5),[30,28,20,20,2])[0]]
            box(((low+high)/2,y,top-.035),(high-low,.243,.07),mat,.004,zone)
    for j in range(108):
        y=-6.7+j*.32
        zone=0 if y<9 else 1 if y<19 else 2
        box((2.75,y,-.06),(.17,.31,.15),stone,.009,zone)
        box((2.94,y,-.145),(.14,.307,.065),joint,.002,zone)
        if j%10<2:
            for k in range(4): box((2.94,y-.115+k*.069,-.099),(.145,.018,.018),roof,.002,zone)
    # Accumulated soil against walls and drain, under rather than above root crowns.
    box((.036,10,-.005),(.11,34,.022),soil,0)
    box((2.83,10,-.065),(.15,34,.045),soil,0)
    for bay in range(CONFIG['bayCount']):
        y=-6.4+bay*3.2; zone=0 if y<9 else 1 if y<19 else 2
        make_shutter(y,3.2,2.70,steel if bay%3 else steel2,painted,zone)
        box((.025,y,1.48),(.235,.265,2.96),plaster,.008,zone)
        # Tiled upper storefront band, with modeled spacing at the near bays.
        box((.04,y+1.60,3.17),(.31,3.18,.90),plaster,.009,zone)
        for j in range(13):
            for k in range(2): box((.202,y+.12+j*.245,3.42+k*.123),(.018,.236,.113),ceramic,.002,zone)
        box((.655,y+1.6,3.065),(1.17,3.19,.105),ceiling,.004,zone)
        box((1.25,y+1.6,3.19),(.13,3.20,.43),plaster,.008,zone)
        for k in range(4):
            box((.65,y+.37+k*.80,3.006),(1.12,.011,.006),joint,0,zone)
        # Recessed unlit downlight has a ring and dark insert.
        tube([(.65,y+1.62,3.003),(.65,y+1.62,2.984)],.073,painted,20,zone)
        tube([(.65,y+1.62,2.983),(.65,y+1.62,2.981)],.052,joint,20,zone)
        # Each roof rib lands on the building beam and a post bearing plate.
        pts=[]
        for k in range(21):
            t=k/20; pts.append((1.23+1.61*t,y,3.35+.22*math.sin(math.pi*t)-.22*t))
        tube(pts,.027,painted,8,zone)
        tube([(2.82,y,-.07),(2.82,y,3.15)],.062,painted,12,zone)
        box((2.82,y,.018),(.215,.225,.037),painted,.007,zone)
        box((2.82,y,3.15),(.19,.19,.035),roof,.003,zone)
        if zone==0:
            for dx in (-.076,.076):
                for dy in (-.076,.076): tube([(2.82+dx,y+dy,.034),(2.82+dx,y+dy,.051)],.013,rust,6,zone)
        # Sheet roof is corrugated across its span and has actual missing strips.
        for strip in range(4):
            if (bay,strip) in ((3,1),(5,2),(7,0)): continue
            y1=y+strip*.80; y2=y1+.803
            vertices=[]
            for edgey in (y1,y2):
                for k in range(97):
                    t=k/96
                    h=3.38+.22*math.sin(math.pi*t)-.22*t+.012*math.cos(t*math.tau*16)
                    vertices.append((1.23+1.61*t,edgey,h))
            faces=[(k,k+1,98+k,97+k) for k in range(96)]
            # Thin end returns reveal sheet thickness; never an infinitely thin silhouette.
            for k in (0,96):
                idx=len(vertices);vertices.extend([(vertices[k][0],y1,vertices[k][2]-.008),(vertices[k][0],y2,vertices[k][2]-.008)])
                faces.append((k,k+97,idx+1,idx))
            batch(roof,zone).add(vertices,faces)
        # Drain is a U-shaped gutter below the exterior sheet edge.
        box((2.91,y+1.6,3.083),(.18,3.20,.021),painted,.002,zone)
        for xx in (2.83,2.99): box((xx,y+1.6,3.125),(.018,3.20,.086),painted,.002,zone)
        if bay%3==0:
            tube([(2.90,y+.11,3.09),(2.98,y+.11,2.91),(3.00,y+.11,.16),(2.96,y+.11,-.06)],.038,painted,10,zone)
            for z in (.38,1.7,2.80): box((2.947,y+.11,z),(.13,.025,.032),roof,.002,zone)
    for t in (.12,.53,.94):
        x=1.23+1.61*t; h=3.35+.22*math.sin(math.pi*t)-.22*t
        tube([(x,-6.4,h),(x,25.6,h)],.023,roof,8)
    # Modest off-white hanging sign: modeled frame, brackets, edge and legible authored lettering.
    y=4.6
    box((.75,y,2.63),(.88,.056,.45),painted,.012)
    box((.75,y-.033,2.63),(.80,.012,.365),ceramic,.006)
    for x in (.39,1.11): tube([(x,y,2.875),(x,y,3.04)],.012,rust,8)
    # English small storefront lettering avoids treating AI image glyphs as an authentic shop name.
    font=bpy.data.curves.new('arcade-sign-lettering','FONT');font.body='SHIO  STORE';font.align_x='CENTER';font.align_y='CENTER';font.size=.092;font.extrude=.0006
    ob=bpy.data.objects.new('arcade-sign-lettering',font);bpy.context.scene.collection.objects.link(ob);ob.location=(.75,y-.042,2.63);ob.rotation_euler=(math.pi/2,0,0);font.materials.append(black)
    # Near guardrail: posts, base plates, long bends and lower rail connect.
    for y in (-2.8,1.8,6.4,11.0,15.6,20.2):
        tube([(3.02,y,-.11),(3.02,y,1.01)],.031,painted,10)
        box((3.02,y,-.097),(.19,.19,.03),roof,.006)
    for z in (.50,1.01):tube([(3.02,-3.2,z-.12),(3.02,-3.0,z),(3.02,20.2,z),(3.02,20.40,z-.12)],.025,painted,12)
    # Utility poles and connected, gently sagging wires give the road a grounded scale.
    for y in (-5,8,21):
        tube([(9.52,y,.0),(9.52,y,6.2)],.10,stone,10,2)
        box((9.52,y,5.7),(1.8,.10,.12),roof,.007,2)
    for x in (8.87,9.52,10.17):
        for ya,yb in ((-5,8),(8,21),(21,34)):
            tube([(x,ya+(yb-ya)*k/20,5.81-.34*math.sin(math.pi*k/20)) for k in range(21)],.011,joint,5,2)
    # A plain, faded locality marker (no invented regulatory traffic symbol).
    tube([(3.06,.75,-.10),(3.06,.75,2.53)],.027,painted,10)
    box((3.06,.75,2.25),(.36,.045,.42),painted,.012)
    for b in BATCHES.values(): b.finish()


def camera(scene, pos, target, width, height, fov=62):
    obj=scene.camera
    if obj is None:
        data=bpy.data.cameras.new('Arcade-camera');obj=bpy.data.objects.new('Arcade-camera',data);scene.collection.objects.link(obj);scene.camera=obj
    obj.location=pos;obj.rotation_euler=(Vector(target)-Vector(pos)).to_track_quat('-Z','Y').to_euler()
    obj.data.sensor_fit='VERTICAL';obj.data.sensor_height=36;obj.data.lens=18/math.tan(math.radians(fov)/2);obj.data.clip_end=4000
    scene.render.resolution_x=width;scene.render.resolution_y=height;scene.render.resolution_percentage=100


def lighting(scene):
    data=bpy.data.lights.new('Arcade-sun','SUN');data.energy=CONFIG['sun']['energy'];data.color=(1,.91,.75);data.angle=math.radians(CONFIG['sun']['angleDegrees'])
    obj=bpy.data.objects.new('Arcade-sun',data);scene.collection.objects.link(obj);obj.rotation_euler=(-Vector(CONFIG['sun']['directionToLight'])).to_track_quat('-Z','Y').to_euler()
    world=bpy.data.worlds.new('Arcade-open-sky');world.use_nodes=True;scene.world=world
    nodes,links=world.node_tree.nodes,world.node_tree.links
    bg=nodes.get('Background');bg.inputs['Color'].default_value=(.55,.68,.82,1);bg.inputs['Strength'].default_value=.95
    scene.render.engine='CYCLES';scene.cycles.samples=CONFIG['render']['samples'];scene.cycles.use_denoising=True
    scene.cycles.max_bounces=6;scene.cycles.diffuse_bounces=3;scene.cycles.transparent_max_bounces=4
    scene.render.threads_mode='FIXED';scene.render.threads=6
    # CPU is a reproducible fallback; an isolated process never edits an interactive .blend.
    try:
        prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
        devices=[d for d in prefs.devices if d.type=='METAL']
        for d in prefs.devices:d.use=d.type=='METAL'
        if devices:scene.cycles.device='GPU'
    except Exception: pass
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.25
    scene.render.image_settings.file_format='PNG'


def export(scene):
    # Export geometry/materials only; runtime owns its camera, sun, sky and elapsed time.
    bpy.ops.object.select_all(action='DESELECT')
    for obj in scene.objects:
        if obj.type in ('MESH','FONT','CURVE'):obj.select_set(True)
    bpy.context.view_layer.objects.active=next(o for o in scene.objects if o.type=='MESH')
    out=ROOT/'public/models/last-arcade.glb';out.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_attributes=True,export_cameras=False,export_lights=False)
    return out


def render(scene, name, pos=None, target=None, width=None, height=None, gray=False):
    c=CONFIG['camera'];r=CONFIG['render']
    camera(scene,pos or c['position'],target or c['target'],width or r['width'],height or r['height'])
    previous=scene.view_layers[0].material_override
    if gray:
        mat=material('clay',(.55,.55,.52),.9)
        scene.view_layers[0].material_override=mat
    scene.render.filepath=str(REVIEW/name)
    bpy.ops.render.render(write_still=True)
    scene.view_layers[0].material_override=previous


def main():
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    parser=argparse.ArgumentParser();parser.add_argument('--no-render',action='store_true');parser.add_argument('--no-plants',action='store_true');parser.add_argument('--views',default='hero,gray,wide,detail')
    opts=parser.parse_args(args)
    if not bpy.app.background:
        raise RuntimeError('Run this builder in an isolated background Blender process.')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    REVIEW.mkdir(parents=True,exist_ok=True);TEXTURES.mkdir(parents=True,exist_ok=True)
    scene=bpy.context.scene;scene.name='Last Arcade / coastal shopping street';scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
    architecture()
    plant_stats={}
    if not opts.no_plants:
        from last_arcade_plants import build_plants
        plant_stats=build_plants(CONFIG['seed'])
        # glTF intentionally drops color alpha for opaque materials; preserve pinning
        # in a custom scalar attribute rather than overloading opacity.
        for obj in scene.objects:
            if obj.type=='MESH' and obj.get('arcade_role')=='foliage':
                colors=obj.data.color_attributes['Color']
                weights=obj.data.attributes.new('_arcade_wind','FLOAT','POINT')
                for dst,src in zip(weights.data,colors.data): dst.value=src.color[3]
    from last_arcade_occlusion import bake_occlusion
    occlusion_stats=bake_occlusion(scene)
    lighting(scene)
    c=CONFIG['camera'];r=CONFIG['render'];camera(scene,c['position'],c['target'],r['width'],r['height'])
    scene['source']='Original modeled study after user reference, 2026-09-15';scene['coordinate_contract']=CONFIG['blenderAxes'];scene['seed']=CONFIG['seed']
    scene['camera_target']=c['target'];scene['plant_stats']=str(plant_stats)
    out=ROOT/'assets/blender/last-arcade.blend';bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out))
    glb=export(scene)
    stats={'blender':bpy.app.version_string,'seed':CONFIG['seed'],'camera':c,'objects':sum(o.type=='MESH' for o in scene.objects),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in scene.objects if o.type=='MESH'),'plantStats':plant_stats,'occlusionStats':occlusion_stats,'glbBytes':glb.stat().st_size,'glbSHA256':hashlib.sha256(glb.read_bytes()).hexdigest(),'blend':str(out.relative_to(ROOT)),'blendSHA256':hashlib.sha256(out.read_bytes()).hexdigest(),'sources':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'assets/config/last-arcade.json',Path(__file__),ROOT/'assets/blender/scripts/last_arcade_plants.py',ROOT/'assets/blender/scripts/last_arcade_occlusion.py']},'renderViews':[]}
    if not opts.no_render:
        for view in opts.views.split(','):
            if view=='hero':render(scene,'hero.png')
            if view=='gray':render(scene,'gray.png',gray=True)
            if view=='wide':render(scene,'wide.png',width=1280,height=720)
            if view=='detail':render(scene,'detail.png',pos=(2.05,1.1,1.35),target=(.04,2.60,1.2),width=1000,height=1000)
            if view=='structure':render(scene,'structure.png',pos=(11,-11,11),target=(.8,8,1.6),width=1100,height=800,gray=True)
            stats['renderViews'].append(view)
    (REVIEW/'manifest.json').write_text(json.dumps(stats,indent=2)+'\n')
    print('ARCADE_RESULT '+json.dumps(stats))

if __name__=='__main__':main()
