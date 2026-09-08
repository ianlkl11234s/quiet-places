"""Small, self-authored wall-foot weeds for Afterlight.

Blender coordinates are `(Three.x, -Three.z, Three.y)`.  The plants stay
against the right wall and are intentionally independent of the hero plant.
"""
from pathlib import Path
import json
import math
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
ROOT_Y=-.024
TUFTS=(
    # name, Blender y (= -Three z), height metres, blade count, deterministic phase
    ('01', .82, .043, 2, .2),
    ('02', .56, .056, 4, 1.1),
    ('03', .31, .068, 5, 2.0),
    ('04',-.24, .051, 3, 3.1),
    ('05',-1.55, .046, 2, 4.2),
)

def _materials():
    stem=bpy.data.materials.get('Foliage_WallWeed_Stem') or bpy.data.materials.new('Foliage_WallWeed_Stem')
    leaf=bpy.data.materials.get('Foliage_WallWeed_Leaf') or bpy.data.materials.new('Foliage_WallWeed_Leaf')
    for material,color,roughness in ((stem,(.075,.105,.045,1),.82),(leaf,(.155,.205,.095,1),.68)):
        material.use_nodes=True
        principled=material.node_tree.nodes.get('Principled BSDF');principled.inputs['Base Color'].default_value=color;principled.inputs['Roughness'].default_value=roughness
    return stem,leaf

def _tube(points,radii):
    verts=[];faces=[];sides=4
    for point,radius in zip(points,radii):
        for side in range(sides):
            a=math.tau*side/sides;verts.append((point.x+math.cos(a)*radius,point.y+math.sin(a)*radius,point.z))
    for i in range(len(points)-1):
        for side in range(sides):faces.append((i*sides+side,(i+1)*sides+side,(i+1)*sides+(side+1)%sides,i*sides+(side+1)%sides))
    return verts,faces

def _object(collection,name,verts,faces,material,height):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.materials.append(material)
    obj=bpy.data.objects.new(name,mesh);collection.objects.link(obj)
    obj['windRootY']=ROOT_Y;obj['windHeight']=height;obj['windScale']=.08
    obj['threeCoordinateContract']='Blender=(Three.x,-Three.z,Three.y)'
    return obj

def build_weeds(collection):
    """Append five irregular, 1.8–4.6 cm wall-foot weed tufts to collection."""
    stem_material,leaf_material=_materials();objects=[]
    for number,y,height,count,phase in TUFTS:
        root=Vector((1.688,y,ROOT_Y));stem_verts=[];stem_faces=[];leaf_verts=[];leaf_faces=[]
        for blade in range(count):
            angle=-math.pi*.55+(blade/max(1,count-1))*math.pi*.85 + math.sin(phase+blade)*.16
            # Grow a little leftward into the corridor; never form a planter row.
            length=height*(.68+.10*((blade+1)%3));direction=Vector((math.cos(angle)*.42,math.sin(angle)*.36,1)).normalized()
            tip=root+direction*length;mid=root.lerp(tip,.54)+Vector((0,0,.0015*math.sin(blade+phase)))
            vs,fs=_tube((root,mid,tip),(.00075,.00048,.00018));offset=len(stem_verts);stem_verts.extend(vs);stem_faces.extend([tuple(offset+v for v in face) for face in fs])
            # A narrow folded spear leaf, with its base attached to the stem.
            side=Vector((-direction.y,direction.x,0)).normalized();base=root.lerp(tip,.28);leaf_tip=root.lerp(tip,.95)
            width=.0022+.0011*(blade%2);ridge=base.lerp(leaf_tip,.48)+Vector((0,0,.0008))
            offset=len(leaf_verts);leaf_verts.extend((tuple(base-side*width*.24),tuple(base+side*width*.24),tuple(ridge+side*width),tuple(leaf_tip),tuple(ridge-side*width)))
            leaf_faces.extend(((offset,offset+1,offset+2),(offset,offset+2,offset+4),(offset+4,offset+2,offset+3),(offset+2,offset+1,offset+3)))
        objects.append(_object(collection,f'Stem_WallWeed_{number}',stem_verts,stem_faces,stem_material,height))
        objects.append(_object(collection,f'Foliage_WallWeed_{number}',leaf_verts,leaf_faces,leaf_material,height))
    return objects

def _metadata(objects):
    bounds=[(vertex.co.x,vertex.co.y,vertex.co.z) for obj in objects for vertex in obj.data.vertices]
    tufts=[]
    for n,y,h,c,_ in TUFTS:
        tuft_objects=[obj for obj in objects if obj.name.endswith('_'+n)]
        max_z=max(vertex.co.z for obj in tuft_objects for vertex in obj.data.vertices)
        if max_z<=.01:raise RuntimeError(f'Wall weed {n} remains below visible ground threshold: {max_z}')
        tufts.append({'id':n,'threeZ':-y,'bladeLengthMetres':h,'blades':c,'actualMaxWorldZ':max_z})
    return {'asset':'afterlight-weeds','tuftCount':len(TUFTS),'objectCount':len(objects),'rootBlenderZ':ROOT_Y,'windExtras':{'windRootY':ROOT_Y,'windHeightRange':[min(t[2] for t in TUFTS),max(t[2] for t in TUFTS)],'windScale':.08},'boundsBlender':{'min':[min(v[i] for v in bounds) for i in range(3)],'max':[max(v[i] for v in bounds) for i in range(3)]},'triangles':sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in objects),'tufts':tufts}

def export_standalone():
    bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;collection=bpy.data.collections.new('Afterlight_Weeds');scene.collection.children.link(collection);objects=build_weeds(collection)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    out=ROOT/'public/models/afterlight-weeds.glb';out.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_extras=True,use_selection=True,export_cameras=False)
    metadata=_metadata(objects);(ROOT/'public/models/afterlight-weeds.metadata.json').write_text(json.dumps(metadata,indent=2)+'\n');print(json.dumps(metadata))

if __name__=='__main__':export_standalone()
