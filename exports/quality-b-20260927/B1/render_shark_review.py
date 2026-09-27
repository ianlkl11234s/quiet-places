"""Background review renders of a shark GLB (Q3 B1 before/after).

Usage: blender -b --factory-startup --python render_shark_review.py -- <glb> <out_dir>
Imports the GLB, emulates three.js COLOR_0 x baseColor multiply, and renders
fixed neutral-light views as JPEG. Not the stairlight scene lighting.
"""
import sys, math
from pathlib import Path
import bpy
from mathutils import Vector

glb, out = sys.argv[sys.argv.index('--') + 1:][:2]
out = Path(out); out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)

# three.js multiplies COLOR_0 into every material of a primitive that carries it.
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
scene.render.image_settings.quality = 90
scene.view_settings.view_transform = 'Standard'
world = bpy.data.worlds.new('W'); scene.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.32, .33, .34, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .8
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sun.data.energy = 3.2; sun.data.angle = math.radians(8)
sun.rotation_euler = (math.radians(35), math.radians(-20), math.radians(-30))
scene.collection.objects.link(sun)
fill = bpy.data.objects.new('Fill', bpy.data.lights.new('Fill', 'SUN'))
fill.data.energy = .7; fill.rotation_euler = (math.radians(120), 0, math.radians(150))
scene.collection.objects.link(fill)

cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); scene.collection.objects.link(cam); scene.camera = cam

def shoot(name, loc, target, ortho=None, lens=50):
    cam.location = Vector(loc)
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    if ortho:
        cam.data.type = 'ORTHO'; cam.data.ortho_scale = ortho
    else:
        cam.data.type = 'PERSP'; cam.data.lens = lens
    cam.data.clip_start = .01
    scene.render.filepath = str(out / f'{name}.jpg')
    bpy.ops.render.render(write_still=True)

# Blender axes after import: nose +X, dorsal +Z, glTF +Z lateral -> Blender -Y.
views = [
    ('side', (0, -3, .0), (0, 0, 0), 1.02, 50),
    ('top', (0, 0, 3), (0, 0, 0), 1.02, 50),
    ('three-quarter', (1.0, -1.05, .75), (0, 0, 0), None, 55),
    ('closeup-first-dorsal', (.25, -.42, .30), (.10, 0, .12), None, 60),
    ('closeup-caudal', (-.20, -.50, .05), (-.35, 0, .01), None, 55),
    ('closeup-head', (.62, -.30, .02), (.36, 0, 0), None, 60),
]
for v in views:
    shoot(*v)

clay = bpy.data.materials.new('Clay'); clay.use_nodes = True
b = clay.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (.5, .5, .5, 1); b.inputs['Roughness'].default_value = .6
for ob in [o for o in bpy.data.objects if o.type == 'MESH']:
    for slot in ob.material_slots:
        slot.material = clay
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.85, .85, .85, 1)
for v in [('clay-side', (0, -3, 0), (0, 0, 0), 1.02, 50), ('clay-top', (0, 0, 3), (0, 0, 0), 1.02, 50), ('clay-three-quarter', (1.0, -1.05, .75), (0, 0, 0), None, 55)]:
    shoot(*v)
print('RENDERED', out)
