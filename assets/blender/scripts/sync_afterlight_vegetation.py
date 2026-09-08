"""Replace only living geometry in editable courtyard files; keep cameras and room.
Run export_afterlight_vegetation.mjs first. Website physics remains in TypeScript.
"""
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[3]
for filename in ('afterlight-courtyard.blend','afterlight-web.blend'):
    path=ROOT/'assets/blender'/filename
    bpy.ops.wm.open_mainfile(filepath=str(path))
    existing=bpy.data.collections.get('Afterlight_Vegetation_Rebuilt')
    if existing:
        for obj in list(existing.all_objects):bpy.data.objects.remove(obj,do_unlink=True)
        bpy.data.collections.remove(existing)
    # The imported rest plants have a dedicated root; legacy living meshes use these prefixes.
    for obj in list(bpy.data.objects):
        if obj.type=='MESH' and obj.name.startswith(('Foliage','Leaf','Stem')):
            bpy.data.objects.remove(obj,do_unlink=True)
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/afterlight-vegetation.glb'))
    imported=set(bpy.data.objects)-before
    collection=bpy.data.collections.new('Afterlight_Vegetation_Rebuilt')
    bpy.context.scene.collection.children.link(collection)
    for obj in imported:
        for old in list(obj.users_collection):old.objects.unlink(obj)
        collection.objects.link(obj)
    bpy.context.scene['vegetationSource']='src/places/afterlight/PlantGeometry.ts'
    bpy.context.scene['vegetationPhysics']='Website fixed 60 Hz hierarchical springs; editable rest geometry here, not a Blender physics bake'
    bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
    print('SYNC',filename,len(imported),'objects')
