import bpy
from swimming import pose
from pathlib import Path
import json, struct, math
from mathutils import Matrix, Quaternion

def _write_curve(action, datablock, path, index, values):
    # Blender 5 Actions are layered; this also makes the rig's action slot.
    curve=action.fcurve_ensure_for_datablock(datablock,data_path=path,index=index)
    # A newly ensured Blender 5 FCurve starts empty, so add every sample.
    points=curve.keyframe_points;points.add(len(values))
    co=[]
    for frame,value in enumerate(values):co.extend((frame,value))
    points.foreach_set('co',co)
    # 30fps binary samples are intentional piecewise samples; do not let
    # Bezier handles create clearance-violating interpolated excursions.
    for point in points:point.interpolation='LINEAR'
    return curve

def _write_quaternion(action, datablock, path, samples):
    for component in range(4):_write_curve(action,datablock,path,component,[sample[component] for sample in samples])

def bake_master_loop(rig,fps=30):
    action=bpy.data.actions.new('MEDAKA_ACT_INPLACE_SWIM_1S');rig.animation_data_create();rig.animation_data.action=action
    for frame in range(31):
        pose(rig,frame/fps*2*3.141592653589793*2)
        for bone in rig.pose.bones:bone.keyframe_insert('rotation_quaternion',frame=frame)
    return action

def bake_shoal_from_motion(scene, master_mesh, master_rig, root):
    """Bake motion-bin roots and 120s pose keys; mesh data stays shared."""
    meta=json.loads((root/'public/models/medaka-motion.json').read_text());raw=(root/'public/models/medaka-motion.bin').read_bytes()
    frames,count,stride=meta['frameCount'],meta['fishCount'],meta['stride'];values=struct.unpack('<'+str(len(raw)//4)+'f',raw)
    if (frames*count*stride)!=len(values):raise RuntimeError('medaka motion binary shape mismatch')
    collection=bpy.data.collections.new('Medaka_Shoal_Baked');scene.collection.children.link(collection)
    convert=Matrix(((1,0,0),(0,0,-1),(0,1,0)));cq=convert.to_quaternion()
    # Must match Medaka.ts `variantColor`: glTF vertex colours are multiplied by
    # that palette at runtime, so the editable baked shoal multiplies the actual
    # COLOR attribute rather than a material diffuse colour that the VertexColor
    # node ignores.
    palette=((.72,.76,.64),(.84,.81,.68),(.42,.46,.41),(.76,.68,.48))
    mesh_variants={}
    for variant,multiplier in enumerate(palette):
        data=master_mesh.data.copy();data.name=f'Medaka_Master_Mesh_Variant_{variant}'
        colors=data.color_attributes.get('MedakaColor')
        if not colors: raise RuntimeError('MedakaColor vertex attribute is required for palette bake')
        for item in colors.data:
            r,g,b,a=item.color;item.color=(r*multiplier[0],g*multiplier[1],b*multiplier[2],a)
        mesh_variants[variant]=data
    ys=[vertex.co.y for vertex in master_mesh.data.vertices];actual_source_length=max(ys)-min(ys)
    for fish in range(count):
        rig=master_rig.copy();rig.data=master_rig.data.copy();rig.name=f'Medaka_Rig_{fish:02d}';collection.objects.link(rig)
        variant=int(meta['fish'][fish].get('colorVariant',0))%4
        body=master_mesh.copy();body.data=mesh_variants[variant];body.name=f'Medaka_{fish:02d}';collection.objects.link(body);body.parent=rig;body.modifiers.get('Medaka_Armature').object=rig
        scale=float(meta['fish'][fish]['length'])/actual_source_length;rig.scale=(scale,scale,scale);rig['colorVariant']=variant;rig['sourceLengthMetres']=float(meta['fish'][fish]['length']);rig['masterActualSourceLengthMetres']=actual_source_length
        action=bpy.data.actions.new(f'MEDAKA_BAKED_{fish:02d}_120S');rig.animation_data_create();rig.animation_data.action=action
        locations=[];root_rotations=[];bone_rotations={bone.name:[] for bone in rig.pose.bones}
        for frame in range(frames):
            k=(frame*count+fish)*stride;x,y,z,qx,qy,qz,qw,speed,iphase,q,state,accel=values[k:k+stride]
            locations.append((x,-z,y));root_rotations.append(tuple(cq@Quaternion((qw,qx,qy,qz))@cq.inverted()))
            # iphase in the binary already includes this fish's individual phase.
            pose(rig,iphase,speed=speed,accel=accel)
            for bone in rig.pose.bones:bone_rotations[bone.name].append(tuple(bone.rotation_quaternion))
        for component in range(3):_write_curve(action,rig,'location',component,[value[component] for value in locations])
        _write_quaternion(action,rig,'rotation_quaternion',root_rotations)
        for component in range(3):_write_curve(action,rig,'scale',component,[scale]*frames)
        for name,samples in bone_rotations.items():_write_quaternion(action,rig,f'pose.bones["{name}"].rotation_quaternion',samples)
    scene.render.fps=meta['fps'];scene.frame_start=0;scene.frame_end=frames-1;scene['medakaMotionBaked']=True;return {'fish':count,'frames':frames,'fps':meta['fps'],'sharedMeshVariants':len(mesh_variants),'palette':palette,'actualSourceLengthMetres':actual_source_length}
