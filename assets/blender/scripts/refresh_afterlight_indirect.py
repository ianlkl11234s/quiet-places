"""Refresh only Afterlight's diffuse-indirect EXR after a sun-direction change."""
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]

def run():
    scene=bpy.context.scene; room=bpy.data.objects.get('RoomSurface'); sun=bpy.data.objects.get('Sun_Afterlight')
    if not room or not sun: raise RuntimeError('RoomSurface or Sun_Afterlight missing')
    sun.rotation_euler=Vector((.28,-.25,-1)).to_track_quat('-Z','Y').to_euler()
    scene['sun_direction_to_scene_three']=[.28,-1,.25]
    prefs=bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type='METAL';prefs.get_devices()
    if not any(d.type=='METAL' for d in prefs.devices): raise RuntimeError('Metal GPU required')
    for d in prefs.devices:d.use=d.type=='METAL'
    scene.render.engine='CYCLES';scene.cycles.device='GPU';scene.render.threads_mode='FIXED';scene.render.threads=2;scene.cycles.samples=64
    image=bpy.data.images.get('Afterlight_Indirect')
    if not image: raise RuntimeError('Afterlight_Indirect missing')
    material=room.active_material;nodes=material.node_tree.nodes
    target=nodes.get('__AfterlightIndirectTarget') or nodes.new('ShaderNodeTexImage');target.name='__AfterlightIndirectTarget';target.image=image
    for node in nodes:node.select=False
    target.select=True;nodes.active=target
    bpy.ops.object.select_all(action='DESELECT');room.select_set(True);bpy.context.view_layer.objects.active=room
    bake=scene.render.bake;bake.margin=12;bake.use_clear=True;bpy.ops.object.bake(type='DIFFUSE',pass_filter={'INDIRECT'})
    output=ROOT/'public/textures/afterlight/room-indirect.exr';image.filepath_raw=str(output);image.file_format='OPEN_EXR';image.save();image.filepath='//'+str(Path('../../public/textures/afterlight/room-indirect.exr'));image.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/afterlight-web.blend'))
if __name__=='__main__':run()
