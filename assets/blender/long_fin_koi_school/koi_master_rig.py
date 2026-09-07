"""Anatomical chain, continuous skinning and real distal pectoral weights."""
import bpy
from mathutils import Vector
from .koi_master_geometry import base,transform

def make_rig(collection,parts,params,name):
 rig=base.create_rig(collection);rig.name=name;rig.data.name=name+'_ARMATURE'
 for key in base.DEFAULTS:
  if key in rig:del rig[key]
 bpy.context.view_layer.objects.active=rig
 bpy.ops.object.mode_set(mode='EDIT')
 for bone in rig.data.edit_bones:
  bone.head=transform(bone.head,params);bone.tail=transform(bone.tail,params)
 for side,sign in (('L',-1),('R',1)):
  parent=rig.data.edit_bones['pectoral_'+side]
  origin=parent.head.copy()
  for suffix,t in (('mid',.45),('tip',.80)):
   bone=rig.data.edit_bones.new('pectoral_'+side+'_'+suffix)
   bone.head=origin+Vector((sign*.067*t,-.070*t,-.006*t))
   bone.tail=bone.head+Vector((sign*.010,-.015,0));bone.parent=parent;parent=bone
 bpy.ops.object.mode_set(mode='OBJECT')
 # Bind weights in the authored longitudinal parameter, using transformed joints.
 chain=[(name,rig.data.bones[name].head_local.y) for name,_ in base.SPINE]
 def axial(y):
  if y>=chain[0][1]:return {chain[0][0]:1.}
  for (a,ya),(b,yb) in zip(chain,chain[1:]):
   if y>=yb:
    t=max(0.,min(1.,(ya-y)/max(ya-yb,1e-8)));return {a:1-t,b:t}
  return {'tail_tip':1.}
 for ob,kind in parts:
  ob.parent=rig
  modifier=ob.modifiers.new('LONG_FIN_ARMATURE','ARMATURE');modifier.object=rig
  groups={bone.name:ob.vertex_groups.new(name=bone.name) for bone in rig.data.bones}
  for vertex in ob.data.vertices:
   co=vertex.co;weights=axial(co.y)
   if kind=='face':weights={'head':1.}
   elif kind.startswith('pectoral'):
    sign=-1 if kind.endswith('L') else 1
    rx,rz,z=base.profile(.21)
    origin=transform(Vector((sign*rx*.91,base.NOSE-.21*base.BODY,z-rz*.28)),params)
    t=max(0.,min(1.,(abs(co.x)-abs(origin.x))/.067))
    influence=base.smooth(min(1.,t/.22))
    weights={n:w*(1-influence) for n,w in axial(origin.y).items()}
    if t<.5:distal={kind:1-t*2,kind+'_mid':t*2}
    else:distal={kind+'_mid':2-2*t,kind+'_tip':2*t-1}
    for n,w in distal.items():weights[n]=weights.get(n,0)+w*influence
   elif kind.startswith('pelvic'):
    distance=max(0.,abs(co.x)-.017);influence=.85*base.smooth(min(1.,distance/.017))
    weights={n:w*(1-influence) for n,w in weights.items()};weights[kind]=influence
   elif kind in ('dorsal','anal'):
    influence=.22
    weights={n:w*(1-influence) for n,w in weights.items()};weights[kind]=influence
   elif kind=='caudal':
    influence=.10*min(1.,abs(co.z)/.035)
    weights={n:w*(1-influence) for n,w in weights.items()}
    weights['caudal_L' if co.z>=0 else 'caudal_R']=influence
   total=sum(weights.values())
   for n,w in weights.items():
    if w>1e-8:groups[n].add([vertex.index],w/total,'REPLACE')
 return rig

def merge_material_meshes(rig):
 """Keep weighted parts editable while reducing small fin-ray draw calls."""
 buckets={}
 for ob in list(rig.children):
  if ob.type=='MESH':buckets.setdefault(ob.data.materials[0].name,[]).append(ob)
 for name,objects in buckets.items():
  if len(objects)<2:continue
  bpy.ops.object.select_all(action='DESELECT')
  for ob in objects:ob.select_set(True)
  bpy.context.view_layer.objects.active=objects[0]
  bpy.ops.object.join();objects[0].name=rig.name+'_'+name
 return len(buckets)
