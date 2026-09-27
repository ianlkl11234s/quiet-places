"""Background review renders of a stingray GLB (Q3 B2 before/after).

Usage: blender -b --factory-startup --python stingray_review.py -- <glb> <out_dir>
Imports the GLB at rest pose, emulates three.js COLOR_0 x baseColor, and renders
fixed neutral-light JPEG views. Not the oceanlight/seaward scene lighting.
Adapted from exports/quality-b-20260927/B1/render_shark_review.py.
"""
import sys, math
from pathlib import Path
import bpy
from mathutils import Vector

glb, out = sys.argv[sys.argv.index('--') + 1:][:2]
out = Path(out); out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
# Rest pose: no clip is applied, so before/after compare the same neutral shape.
for ob in bpy.data.objects:
    if ob.animation_data:
        ob.animation_data.action = None
        for track in ob.animation_data.nla_tracks:
            track.mute = True
    if ob.type == 'ARMATURE':
        for pb in ob.pose.bones:
            pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
bpy.context.scene.frame_set(0)

for ob in [o for o in bpy.data.objects if o.type == 'MESH']:
    attrs = ob.data.color_attributes
    if not len(attrs):
        continue
    name = attrs[0].name
    for slot in ob.material_slots:
        m = slot.material
        if not m or not m.use_nodes or m.get('_vc_done'):
            continue
        nt = m.node_tree
        bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf:
            continue
        sock = bsdf.inputs['Base Color']
        if sock.is_linked and sock.links[0].from_node.type == 'VERTEX_COLOR':
            m['_vc_done'] = 1
            continue
        vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = name
        mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'
        mul.inputs['Factor'].default_value = 1
        if sock.is_linked:
            nt.links.new(sock.links[0].from_socket, mul.inputs['A'])
        else:
            mul.inputs['A'].default_value = sock.default_value
        nt.links.new(vc.outputs['Color'], mul.inputs['B'])
        nt.links.new(mul.outputs['Result'], sock)
        m['_vc_done'] = 1

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
try:
    scene.eevee.taa_render_samples = 32
except AttributeError:
    pass
scene.render.resolution_x, scene.render.resolution_y = 1280, 720
scene.render.image_settings.file_format = 'JPEG'
scene.render.image_settings.quality = 88
scene.view_settings.view_transform = 'Standard'
world = bpy.data.worlds.new('W'); scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (.32, .33, .34, 1); bg.inputs['Strength'].default_value = .8
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sun.data.energy = 3.2; sun.data.angle = math.radians(8)
sun.rotation_euler = (math.radians(35), math.radians(-20), math.radians(-30))
scene.collection.objects.link(sun)
fill = bpy.data.objects.new('Fill', bpy.data.lights.new('Fill', 'SUN'))
fill.data.energy = 1.0; fill.rotation_euler = (math.radians(150), 0, math.radians(150))
scene.collection.objects.link(fill)
cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); scene.collection.objects.link(cam); scene.camera = cam

def shoot(name, loc, target=None, ortho=None, lens=50, euler=None):
    cam.location = Vector(loc)
    cam.rotation_euler = euler if euler else (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    if ortho:
        cam.data.type = 'ORTHO'; cam.data.ortho_scale = ortho
    else:
        cam.data.type = 'PERSP'; cam.data.lens = lens
    cam.data.clip_start = .01
    scene.render.filepath = str(out / f'{name}.jpg')
    bpy.ops.render.render(write_still=True)

# After import: nose -Y, tail +Y, dorsal +Z, span along X. Old tail tip y≈2.2, new ≈1.7.
CY = .8
views = [
    ('top', dict(loc=(0, CY, 4), ortho=3.1, euler=(0, 0, math.pi / 2))),
    ('bottom', dict(loc=(0, CY, -4), ortho=3.1, euler=(math.pi, 0, -math.pi / 2))),
    ('side', dict(loc=(4, CY, 0), target=(0, CY, 0), ortho=3.1)),
    ('three-quarter', dict(loc=(1.7, -1.7, 1.35), target=(0, .25, 0), lens=45)),
    ('closeup-tail', dict(loc=(.34, .52, .20), target=(0, .80, .01), lens=40)),
    ('closeup-eyes', dict(loc=(.42, -.02, .30), target=(0, -.34, .03), lens=50)),
]
for name, kw in views:
    shoot(name, **kw)

clay = bpy.data.materials.new('Clay'); clay.use_nodes = True
b = clay.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (.5, .5, .5, 1); b.inputs['Roughness'].default_value = .6
for ob in [o for o in bpy.data.objects if o.type == 'MESH']:
    for slot in ob.material_slots:
        slot.material = clay
bg.inputs['Color'].default_value = (.85, .85, .85, 1)
for name, kw in [('clay-top', views[0][1]), ('clay-side', views[2][1]), ('clay-three-quarter', views[3][1])]:
    shoot(name, **kw)
print('RENDERED', out)
