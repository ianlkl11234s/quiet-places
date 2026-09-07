"""Build a separate, reproducible afternoon study. Never delete existing scenes."""
from pathlib import Path
import bpy
from mathutils import Vector
import math
import sys
import importlib

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))


def stone(name, floor=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    n, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = n.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (.105, .105, .092, 1)
    bsdf.inputs['Roughness'].default_value = .4 if floor else .83
    tex = n.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = .7
    tex.inputs['Detail'].default_value = 4
    coord = n.new('ShaderNodeTexCoord')
    links.new(coord.outputs['Object'], tex.inputs['Vector'])
    ramp = n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = .2
    ramp.color_ramp.elements[0].color = (.070, .075, .065, 1)
    ramp.color_ramp.elements[1].position = .8
    ramp.color_ramp.elements[1].color = (.13, .125, .107, 1)
    links.new(tex.outputs['Fac'], ramp.inputs[0])
    links.new(ramp.outputs[0], bsdf.inputs['Base Color'])
    micro = n.new('ShaderNodeTexNoise')
    micro.inputs['Scale'].default_value = 95
    micro.inputs['Detail'].default_value = 2
    links.new(coord.outputs['Object'], micro.inputs['Vector'])
    bump = n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .22
    bump.inputs['Distance'].default_value = .012 if floor else .022
    links.new(micro.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def box(collection, name, center, dimensions, material, bevel=.025):
    x, y, z = (d / 2 for d in dimensions)
    vertices = [(a*x, b*y, c*z) for a,b,c in
                [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),
                 (1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    faces = [(0,4,6,2),(1,3,7,5),(0,1,5,4),
             (2,6,7,3),(0,2,3,1),(4,5,7,6)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], [tuple(reversed(face)) for face in faces])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.location = center
    obj.data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new('Stone edge', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
    obj['asset_owner'] = 'leaflight-study'
    return obj


def build():
    import camphor
    build_camphor = importlib.reload(camphor).build_camphor
    previous = bpy.data.scenes.get('Leaflight_Study')
    if previous:
        previous.name = 'Leaflight_Study_previous'
    scene = bpy.data.scenes.new('Leaflight_Study')
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    room = bpy.data.collections.new('Room')
    tree = bpy.data.collections.new('TreeRig')
    scene.collection.children.link(room)
    scene.collection.children.link(tree)
    wall = stone('Stone / walls')
    floor = stone('Stone / floor', True)
    # Interior x[-4,4], y[-6,4], z[0,8]; a single opening on +X.
    box(room, 'Floor', (0,-1,-.16), (8.6,10.6,.32), floor)
    box(room, 'Ceiling', (0,-1,8.16), (8.6,10.6,.32), wall)
    box(room, 'Wall_Back', (0,4.18,4), (8.6,.36,8), wall)
    box(room, 'Wall_Left', (-4.18,-1,4), (.36,10,8), wall)
    box(room, 'Wall_Front', (0,-6.18,4), (8.6,.36,8), wall)
    box(room, 'WindowFrame_Below', (4.18,-1,2.3), (.36,10,4.6), wall)
    box(room, 'WindowFrame_Above', (4.18,-1,7.75), (.36,10,.5), wall)
    box(room, 'WindowFrame_Front', (4.18,-4.6,6.05), (.36,2.8,2.9), wall)
    box(room, 'WindowFrame_Back', (4.18,3.6,6.05), (.36,.8,2.9), wall)
    tree_stats = build_camphor(tree, seed=42)
    cam_data = bpy.data.cameras.new('Camera_Hero')
    cam = bpy.data.objects.new('Camera_Hero', cam_data)
    scene.collection.objects.link(cam)
    cam.location = (-1.5,-5.3,2.5)
    target = Vector((1.0,2.8,3.7))
    cam.rotation_euler = (target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam_data.type = 'PERSP'
    cam_data.lens = 23
    cam_data.sensor_fit = 'VERTICAL'
    cam_data.sensor_height = 36
    cam_data.clip_end = 200
    scene.camera = cam
    sun_data = bpy.data.lights.new('Sun_WindowOnly', 'SUN')
    sun_data.energy = 20
    sun_data.color = (1,.75,.45)
    sun_data.angle = math.radians(.65)
    sun = bpy.data.objects.new('Sun_WindowOnly', sun_data)
    scene.collection.objects.link(sun)
    sun.rotation_euler = Vector((-1,.45,-.85)).to_track_quat('-Z','Y').to_euler()
    world = bpy.data.worlds.new('Sky_Exterior')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.32,.45,.65,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.5
    scene.world = world
    # A bounded homogeneous atmosphere receives actual window/leaf occlusion.
    air = bpy.data.materials.new('Air / subtle scatter')
    air.use_nodes = True
    air.node_tree.nodes.clear()
    output = air.node_tree.nodes.new('ShaderNodeOutputMaterial')
    scatter = air.node_tree.nodes.new('ShaderNodeVolumeScatter')
    scatter.inputs['Density'].default_value = .009
    scatter.inputs['Anisotropy'].default_value = .25
    air.node_tree.links.new(scatter.outputs[0],output.inputs['Volume'])
    box(room,'AirVolume',(0,-1,4),(7.98,9.98,7.98),air,bevel=0)
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.cycles.diffuse_bounces = 4
    scene.cycles.volume_bounces = 1
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 2
    scene.render.resolution_x = 512
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = .8
    scene['study_stage'] = 'P1/P2 draft; not visual acceptance'
    scene['camera_target'] = list(target)
    scene['window_bounds'] = [4,-3.2,3.2,4.6,7.5]
    scene['tree_stats'] = str(tree_stats)
    if bpy.context.window:
        bpy.context.window.scene = scene
    return scene, tree_stats


if __name__ == '__main__':
    scene, stats = build()
    out = ROOT / 'assets/blender/leaflight-study.blend'
    out.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(ROOT / 'exports/blender-review/leaflight-afternoon.png')
    Path(scene.render.filepath).parent.mkdir(parents=True, exist_ok=True)
    # Write only this scene and dependencies, not the user's original scene or
    # earlier study iterations. Their live datablocks remain intact.
    bpy.data.libraries.write(str(out), {scene}, fake_user=True, compress=True)
    result = {'scene':scene.name,'file':str(out),'tree':stats}
