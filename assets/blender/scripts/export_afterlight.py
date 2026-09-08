"""Export an optimized Afterlight web GLB without modifying authored meshes.

The temporary collection joins evaluated foliage by material and wind contract.
The source scene remains one-editable-leaf-per-object; only the disposable
export copies become compact `Leaf_Group_*` / `Stem_Group_*` meshes.
"""
from pathlib import Path
import json
import os
import ast
import bpy

ROOT=Path(__file__).resolve().parents[3]
PREFIXES=('Foliage_','Leaf_','Stem_')

def pack_baked_images():
    """Make the movable web blend self-contained while retaining relative URIs."""
    for image in bpy.data.images:
        if image.name.startswith('Afterlight_'):
            absolute=bpy.path.abspath(image.filepath)
            if absolute:
                image.filepath='//'+os.path.relpath(absolute, ROOT/'assets/blender')
            image.pack()

def key(obj):
    material=obj.active_material.name if obj.active_material else 'None'
    return (material, obj.get('windRootY',0.0), obj.get('windHeight',0.0), obj.get('windScale',1.0))

def family(name):
    if name.startswith('Leaf_'): return 'Leaf'
    if name.startswith('Stem_'): return 'Stem'
    return 'Foliage'

def evaluated_copy(source, collection, depsgraph):
    mesh=bpy.data.meshes.new_from_object(source.evaluated_get(depsgraph),depsgraph=depsgraph)
    copy=bpy.data.objects.new('__export_'+source.name,mesh)
    copy.matrix_world=source.matrix_world.copy(); collection.objects.link(copy)
    for slot in source.material_slots: mesh.materials.append(slot.material)
    return copy

def join_group(copies, collection, group_key, index):
    if len(copies)==1:
        joined=copies[0]
        joined.name=f'{group_key[0]}_Group_{index:02d}'
        joined.data.name=joined.name
        joined['windRootY']=group_key[2];joined['windHeight']=group_key[3];joined['windScale']=group_key[4]
        joined['export_grouped']=True
        return joined
    bpy.ops.object.select_all(action='DESELECT')
    for copy in copies: copy.select_set(True)
    bpy.context.view_layer.objects.active=copies[0]
    bpy.ops.object.join(); joined=bpy.context.object
    joined.name=f'{group_key[0]}_Group_{index:02d}'
    joined.data.name=joined.name
    joined['windRootY']=group_key[2];joined['windHeight']=group_key[3];joined['windScale']=group_key[4]
    joined['export_grouped']=True
    return joined

def run():
    scene=bpy.context.scene; pack_baked_images()
    # A prior interrupted export must never become a second foliage source.
    for stale in [c for c in bpy.data.collections if c.name.startswith('__Afterlight_Export__')]:
        for obj in list(stale.objects): bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(stale)
    temporary=bpy.data.collections.new('__Afterlight_Export__'); scene.collection.children.link(temporary)
    depsgraph=bpy.context.evaluated_depsgraph_get(); groups={}; source_triangles=0
    for obj in scene.objects:
        if obj.type!='MESH' or not obj.name.startswith(PREFIXES): continue
        source_triangles+=len(obj.data.polygons)
        k=(family(obj.name),)+key(obj); groups.setdefault(k,[]).append(evaluated_copy(obj,temporary,depsgraph))
    joined=[]
    for index,(group_key,copies) in enumerate(sorted(groups.items(), key=lambda item:str(item[0]))):
        joined.append(join_group(copies,temporary,group_key,index))
    room=bpy.data.objects.get('RoomSurface')
    camera=bpy.data.objects.get('Camera_Hero')
    if not room or not camera: raise RuntimeError('RoomSurface or Camera_Hero is missing')
    bpy.ops.object.select_all(action='DESELECT'); room.select_set(True); camera.select_set(True)
    for obj in scene.objects:
        if obj.type=='MESH' and obj.name.startswith(('FarCorridor_', 'DrainRoof_', 'DrainGrate_')): obj.select_set(True)
    for obj in joined: obj.select_set(True)
    output=ROOT/'public/models/afterlight-courtyard.glb'; output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_cameras=True,export_extras=True,export_attributes=True,export_apply=True)
    after_triangles=sum(len(obj.data.polygons) for obj in joined)
    metadata=ROOT/'public/models/afterlight-courtyard.metadata.json'
    data=json.loads(metadata.read_text())
    camera_location=camera.location
    data['camera'].update({
        'name':camera.name,
        'positionThree':[round(camera_location.x,4),round(camera_location.z,4),round(-camera_location.y,4)],
        'targetThree':list(scene.get('camera_target_three',[])),
        'lensMm':camera.data.lens,
    })
    data['foliage'].update({'groupedMeshCount':len(joined),'sourceMeshCount':sum(len(v) for v in groups.values()),'trianglesBefore':source_triangles,'trianglesAfter':after_triangles,'grouping':'material + windRootY + windHeight + windScale; evaluated world transforms joined for export only'})
    floor_stats=ast.literal_eval(scene.get('floor_stats','{}'))
    if floor_stats:
        data['rootBounds']=floor_stats
    plant_stats=ast.literal_eval(scene.get('plant_stats','{}'))
    if plant_stats:
        data['plantGeometry']=plant_stats
    aperture=scene.get('aperture_three')
    if aperture:
        data['aperture']={key:(value.to_list() if hasattr(value,'to_list') else list(value) if hasattr(value,'__iter__') and not isinstance(value,str) else value)
                          for key,value in aperture.items()}
    metadata.write_text(json.dumps(data,indent=2,default=lambda value:list(value) if hasattr(value,'__iter__') else str(value))+'\n')
    # The collection is export-only; source blend retains editable leaves.
    for obj in list(temporary.objects): bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(temporary)
    # Preserve packed, relative images in the movable web source.
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/afterlight-web.blend'))
    return {'groups':len(joined),'sourceMeshes':sum(len(v) for v in groups.values()),'trianglesBefore':source_triangles,'trianglesAfter':after_triangles,'glb':str(output)}

if __name__=='__main__': print(json.dumps(run()))
