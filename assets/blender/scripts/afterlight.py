"""Build the editable Afterlight courtyard study.  Coordinates in custom props use Three Y-up."""
from pathlib import Path
import bpy
from mathutils import Vector
from math import radians, sin, cos
import random
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))

def mat_concrete(name, base, wet=False):
    m=bpy.data.materials.new(name); m.use_nodes=True
    n=m.node_tree.nodes; l=m.node_tree.links; p=n.get('Principled BSDF')
    is_wet_floor=name=='RoomSurface_Wet_Floor'
    p.inputs['Base Color'].default_value=(*base,1); p.inputs['Roughness'].default_value=.28 if wet else .82
    if wet: p.inputs['Coat Weight'].default_value=.22; p.inputs['Coat Roughness'].default_value=.18
    coord=n.new('ShaderNodeTexCoord'); tex=n.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value=2.1; tex.inputs['Detail'].default_value=2 if is_wet_floor else 5; l.new(coord.outputs['Object'],tex.inputs['Vector'])
    ramp=n.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color=(*(v*(.78 if is_wet_floor else .58) for v in base),1); ramp.color_ramp.elements[1].color=(*(min(1,v*(1.05 if is_wet_floor else 1.22)) for v in base),1)
    l.new(tex.outputs['Fac'],ramp.inputs['Fac']); l.new(ramp.outputs['Color'],p.inputs['Base Color'])
    micro=n.new('ShaderNodeTexNoise'); micro.inputs['Scale'].default_value=38; micro.inputs['Detail'].default_value=2; l.new(coord.outputs['Object'],micro.inputs['Vector']); bump=n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.13 if is_wet_floor else .30; bump.inputs['Distance'].default_value=.012 if is_wet_floor else .032; l.new(micro.outputs['Fac'],bump.inputs['Height']); l.new(bump.outputs['Normal'],p.inputs['Normal'])
    if wet:
        wetmask=n.new('ShaderNodeTexNoise'); wetmask.inputs['Scale'].default_value=.72; wetmask.inputs['Detail'].default_value=3; l.new(coord.outputs['Object'],wetmask.inputs['Vector'])
        rr=n.new('ShaderNodeValToRGB'); rr.color_ramp.elements[0].position=.36; rr.color_ramp.elements[0].color=(.15,.15,.15,1); rr.color_ramp.elements[1].position=.62; rr.color_ramp.elements[1].color=(.72,.72,.72,1); l.new(wetmask.outputs['Fac'],rr.inputs['Fac']); l.new(rr.outputs['Color'],p.inputs['Roughness'])
    return m

def mat_leaf():
    m=bpy.data.materials.new('Leaf_Rainlit'); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(.075,.23,.055,1); p.inputs['Roughness'].default_value=.48
    p.inputs['Subsurface Weight'].default_value=.055; p.inputs['Subsurface Radius'].default_value=(.25,.8,.2)
    m.diffuse_color=(.075,.23,.055,1); return m

def box(c,name,loc,scale,material,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(location=loc); o=bpy.context.object; o.name=name; o.data.name=name; o.scale=[v/2 for v in scale]; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel: mod=o.modifiers.new('Worn edge','BEVEL'); mod.width=bevel; mod.segments=2
    o.data.materials.append(material); c.objects.link(o); bpy.context.collection.objects.unlink(o); return o

def leaf(c,name,loc,angle,scale,material):
    # Slightly tapered quad: close foliage reads as individual leaves, not cards.
    mesh=bpy.data.meshes.new(name); mesh.from_pydata([(0,0,0),(.42,.14,0),(.84,0,0),(.42,-.14,0),(.42,0,.035)],[],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)]); mesh.materials.append(material)
    o=bpy.data.objects.new(name,mesh); c.objects.link(o); o.location=loc; o.rotation_euler=(radians(angle[0]),radians(angle[1]),radians(angle[2])); o.scale=scale; return o

def cylinder(c,name,a,b,r,material):
    mid=(Vector(a)+Vector(b))/2; d=Vector(b)-Vector(a); bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=d.length,location=mid)
    o=bpy.context.object; o.name=name; o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); o.data.materials.append(material); c.objects.link(o); bpy.context.collection.objects.unlink(o); return o

def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene; scene.name='Afterlight_Courtyard'; scene.unit_settings.system='METRIC'; scene.render.engine='CYCLES'; scene.cycles.device='GPU'; scene.cycles.samples=48; scene.cycles.use_denoising=True; scene.render.threads_mode='FIXED'; scene.render.threads=2
    scene.render.resolution_x=768; scene.render.resolution_y=1024; scene.render.resolution_percentage=100; scene.render.image_settings.file_format='PNG'; scene.view_settings.look='AgX - Medium High Contrast'; scene.view_settings.exposure=.45
    room=bpy.data.collections.new('Room'); foliage=bpy.data.collections.new('Foliage'); scene.collection.children.link(room); scene.collection.children.link(foliage)
    wall=mat_concrete('RoomSurface_Concrete_Wall',(.23,.245,.225)); damp=mat_concrete('RoomSurface_Damp_Concrete',(.16,.185,.16),True); floor=mat_concrete('RoomSurface_Wet_Floor',(.12,.14,.125),True); soil=mat_concrete('RoomSurface_RootSoil',(.055,.042,.022),True); stem=mat_concrete('Foliage_Stem',(.07,.10,.035)); lm=mat_leaf()
    # Blender X/Y/Z corresponds to Three X/-Z/Y.  Near room is [-4,2] in
    # Blender Y; the quiet, unlit corridor then continues to Three z=-43.
    from afterlight_floor import build_floor
    floor_stats=build_floor(room,floor,soil)
    box(room,'FarCorridor_Floor',(0,23.5,-.08),(3.6,43,.16),wall,.008)
    box(room,'RoomSurface_LeftWall',(-1.8,-1,1.5),(.18,6,3),wall,.02)
    box(room,'RoomSurface_RightWall',(1.8,-1,1.5),(.18,6,3),damp,.02)
    box(room,'FarCorridor_LeftWall',(-1.8,23.5,1.5),(.18,43,3),wall,.01)
    box(room,'FarCorridor_RightWall',(1.8,23.5,1.5),(.18,43,3),damp,.01)
    box(room,'FarCorridor_End',(0,45,1.5),(3.6,.16,3),wall,.01)
    # Full underground roof: the only sky path is this fixed rectangular aperture.
    # Three x[.62,1.28], z[-1.25,-.35] => Blender x[.62,1.28], y[.35,1.25].
    box(room,'RoomSurface_Roof_Fore',(0,-1.825,3),(3.6,4.35,.24),wall,.03)
    box(room,'RoomSurface_Roof_Back',(0,1.625,3),(3.6,.75,.24),wall,.03)
    box(room,'RoomSurface_Roof_ApertureLeft',(-.59,.8,3),(2.42,.9,.24),wall,.03)
    box(room,'RoomSurface_Roof_ApertureRight',(1.54,.8,3),(.52,.9,.24),wall,.03)
    box(room,'FarCorridor_Roof',(0,23.5,3),(3.6,43,.24),wall,.01)
    # Sparse old cross-beams and joints give the far corridor scale without a bright exit.
    for i,y in enumerate((4.5,10,16,23,31,39)):
        box(room,f'FarCorridor_Beam_{i}',(0,y,2.86),(3.42,.18,.28),wall,.018)
        box(room,f'FarCorridor_Joint_{i}',(0,y-.11,.012),(3.42,.025,.012),damp,0)
    # Kept isolated so web wind can distinguish living meshes from RoomSurface.
    from afterlight_plants import build_plants
    plant_stats = build_plants(foliage)
    # Three (.15,.85,3.20) -> Blender (.15,-3.20,.85), aimed into the right-wall planting seam.
    cam_data=bpy.data.cameras.new('Camera_Hero'); cam=bpy.data.objects.new('Camera_Hero',cam_data); scene.collection.objects.link(cam); cam.location=(.425,-2.25,.8175); target=Vector((1.25,.60,.72)); cam.rotation_euler=(target-Vector(cam.location)).to_track_quat('-Z','Y').to_euler(); cam.data.lens=24; cam.data.sensor_fit='VERTICAL'; scene.camera=cam
    sun_data=bpy.data.lights.new('Sun_Afterlight','SUN'); sun_data.energy=3.2; sun_data.color=(1,.8,.55); sun_data.angle=radians(.7); sun=bpy.data.objects.new('Sun_Afterlight',sun_data); scene.collection.objects.link(sun); sun.rotation_euler=Vector((.28,-.25,-1)).to_track_quat('-Z','Y').to_euler()
    world=bpy.data.worlds.new('Afterlight_Sky'); world.use_nodes=True; world.node_tree.nodes['Background'].inputs['Color'].default_value=(.20,.27,.38,1); world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5; scene.world=world
    scene['three_coordinate_contract']='x[-1.8,1.8], z[-9,4], ground y=0; Blender=(x,-z,y)'; scene['camera_target_three']=[1.25,.72,-.60]; scene['sun_direction_to_scene_three']=[.28,-1,.25]; scene['lightmap_role']='diffuse indirect only; direct excluded'
    scene['plant_stats']=str(plant_stats)
    scene['floor_stats']=str(floor_stats)
    scene['aperture_three']={'x':[.62,1.28],'z':[-1.25,-.35],'roofY':3.0,'blenderY':[.35,1.25]}
    scene.render.filepath=str(ROOT/'exports/afterlight-review/afterlight-hero.png'); return scene

if __name__=='__main__':
    s=build(); out=ROOT/'assets/blender/afterlight-courtyard.blend'; out.parent.mkdir(parents=True,exist_ok=True); bpy.ops.wm.save_as_mainfile(filepath=str(out)); bpy.ops.render.render(write_still=True)
