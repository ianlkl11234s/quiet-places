"""Bake Afterlight RoomSurface PBR maps and diffuse-indirect EXR with Metal only."""
from pathlib import Path
import os
import bpy, json
ROOT=Path(__file__).resolve().parents[3]; OUT=ROOT/'public/textures/afterlight'; OUT.mkdir(parents=True,exist_ok=True)

def metal(scene):
    p=bpy.context.preferences.addons['cycles'].preferences; p.compute_device_type='METAL'; p.get_devices(); ds=[x for x in p.devices if x.type=='METAL']
    if not ds: raise RuntimeError('Metal GPU required')
    for x in p.devices: x.use=x.type=='METAL'
    scene.render.engine='CYCLES'; scene.cycles.device='GPU'; scene.render.threads_mode='FIXED'; scene.render.threads=2; scene.cycles.samples=16; scene.cycles.use_denoising=True

def image(name,size,space,fmt):
    old=bpy.data.images.get(name)
    if old: bpy.data.images.remove(old)
    im=bpy.data.images.new(name,width=size,height=size,alpha=False,float_buffer=fmt=='OPEN_EXR'); im.colorspace_settings.name=space; return im

def active(room,im):
    for m in room.data.materials:
        m.use_nodes=True; n=m.node_tree.nodes; t=n.get('__AfterlightBake') or n.new('ShaderNodeTexImage'); t.name='__AfterlightBake'; t.image=im
        for q in n:q.select=False
        t.select=True;n.active=t

def bake(room,im,kind,pf=None):
    active(room,im); bpy.context.view_layer.objects.active=room; room.select_set(True); b=bpy.context.scene.render.bake; b.margin=12;b.use_clear=True
    if kind=='NORMAL': b.normal_space='TANGENT'
    kw={'type':kind};
    if pf:kw['pass_filter']=pf
    bpy.ops.object.bake(**kw); room.select_set(False)

def save(im,name,fmt):
    im.filepath_raw=str(OUT/name);im.file_format=fmt;im.save();return '/textures/afterlight/'+name

def run():
    s=bpy.context.scene; metal(s); sources=[o for o in s.objects if o.type=='MESH' and o.name.startswith('RoomSurface_')]
    if not sources:raise RuntimeError('No RoomSurface meshes')
    coll=bpy.data.collections.new('__AfterlightBake');s.collection.children.link(coll); copies=[]; dg=bpy.context.evaluated_depsgraph_get()
    for o in sources:
        me=bpy.data.meshes.new_from_object(o.evaluated_get(dg),depsgraph=dg); q=bpy.data.objects.new('__bake_'+o.name,me);q.matrix_world=o.matrix_world;coll.objects.link(q)
        for slot in o.material_slots: me.materials.append(slot.material)
        copies.append(q);o.hide_render=True
    bpy.ops.object.select_all(action='DESELECT')
    for q in copies:q.select_set(True)
    bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();room=bpy.context.object;room.name='RoomSurface';bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.015);bpy.ops.object.mode_set(mode='OBJECT');room.data.uv_layers.active.name='UV0'
    alb=image('Afterlight_Albedo',2048,'sRGB','PNG');nor=image('Afterlight_Normal',2048,'Non-Color','PNG');rough=image('Afterlight_Roughness',2048,'Non-Color','PNG');ind=image('Afterlight_Indirect',512,'Linear Rec.709','OPEN_EXR')
    bake(room,alb,'DIFFUSE',{'COLOR'});bake(room,nor,'NORMAL');bake(room,rough,'ROUGHNESS');s.cycles.samples=64;bake(room,ind,'DIFFUSE',{'INDIRECT'})
    paths={'albedo':save(alb,'room-albedo.png','PNG'),'normal':save(nor,'room-normal.png','PNG'),'roughness':save(rough,'room-roughness.png','PNG'),'indirect':save(ind,'room-indirect.exr','OPEN_EXR')}
    (OUT/'room-indirect.json').write_text(json.dumps({'mesh':'RoomSurface','uv':'UV0','texture':paths['indirect'],'lightmapIntensity':.65,'containsDirect':False,'calibration':'Diffuse indirect only; runtime adds direct sun.'},indent=2)+'\n')
    mat=bpy.data.materials.new('RoomSurface_Baked');mat.use_nodes=True;n=mat.node_tree.nodes;l=mat.node_tree.links;p=n.get('Principled BSDF')
    for key,im in [('Albedo',alb),('Normal',nor),('Roughness',rough)]: t=n.new('ShaderNodeTexImage');t.name='RoomSurface_'+key;t.image=im
    l.new(n['RoomSurface_Albedo'].outputs['Color'],p.inputs['Base Color']);nm=n.new('ShaderNodeNormalMap');l.new(n['RoomSurface_Normal'].outputs['Color'],nm.inputs['Color']);l.new(nm.outputs['Normal'],p.inputs['Normal']);l.new(n['RoomSurface_Roughness'].outputs['Color'],p.inputs['Roughness']);room.data.materials.clear();room.data.materials.append(mat);room['lightmap_uri']=paths['indirect'];room['lightmap_uv']='UV0';room['lightmap_contains_direct']=False
    web_blend=ROOT/'assets/blender/afterlight-web.blend'
    for baked in (alb,nor,rough,ind):
        baked.filepath='//'+os.path.relpath(OUT/baked.filepath_raw.split('/')[-1],web_blend.parent)
        baked.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(web_blend));return paths
if __name__=='__main__':print(json.dumps(run()))
