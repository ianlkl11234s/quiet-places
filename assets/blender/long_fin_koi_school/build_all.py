"""Stageable non-destructive Blender MCP build. Never resets an existing file."""
from pathlib import Path
import sys,json,hashlib
import bpy
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'assets/blender'))
if not __package__:__package__='long_fin_koi_school'
from .koi_variants import build_school
from .koi_animation import make_actions
from .config import FPS,ACTIONS
OUT=ROOT/'exports/long-fin-koi-blender'
BLEND=ROOT/'assets/blender/long_fin_koi_school.blend'
GLB=ROOT/'public/models/long-fin-koi-school.glb'

def collection(name,parent):
 c=bpy.data.collections.new(name);parent.children.link(c);return c

def build_geometry():
 if bpy.data.scenes.get('LONG_FIN_KOI_SCHOOL'):raise RuntimeError('Long-fin scene already exists; use its stage functions or rebuild in an empty Blender file.')
 scene=bpy.data.scenes.new('LONG_FIN_KOI_SCHOOL');bpy.context.window.scene=scene
 scene.unit_settings.system='METRIC';scene.render.fps=FPS
 scene.world=bpy.data.worlds.new('LONG_FIN_KOI_WORLD')
 top=collection('KOI_SCENE',scene.collection)
 for name in ('KOI_MASTER','KOI_VARIANTS','KOI_SCHOOL','KOI_LIGHTING','KOI_ENV','KOI_CAMERAS','KOI_DEBUG'):collection(name,top)
 rigs=build_school(bpy.data.collections['KOI_VARIANTS'])
 from .koi_master_rig import merge_material_meshes
 for rig in rigs:merge_material_meshes(rig)
 scene['rig_names']=[r.name for r in rigs];scene['production']='Long-fin koi / MCP / original procedural asset'
 return {'scene':scene.name,'rigs':[r.name for r in rigs],'objects':len(scene.objects)}

def bake_one(index):
 rig=bpy.data.objects[bpy.context.scene['rig_names'][index]]
 actions=make_actions(rig)
 return {'rig':rig.name,'actions':{k:a.name for k,a in actions.items()}}

def save_and_export():
 from .validation import validate
 scene=bpy.context.scene;rigs=[bpy.data.objects[n] for n in scene['rig_names']]
 report=validate(rigs)
 from .school_controller import remove_behavior_tracks,install_behavior_tracks
 performances=[r for r in rigs if 'behavior_schedule' in r]
 for rig in performances:
  remove_behavior_tracks(rig);action=next(t.strips[0].action for t in rig.animation_data.nla_tracks if t.name=='KOI_ACT_SLOW_CRUISE')
  rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
 OUT.mkdir(parents=True,exist_ok=True)
 bpy.ops.object.select_all(action='DESELECT')
 saved=[]
 for rig in rigs:
  saved.append((rig,rig.location.copy(),rig.rotation_euler.copy(),rig.parent))
  rig.parent=None;rig.location=(0,0,0);rig.rotation_euler=(0,0,0)
  rig.select_set(True)
  for ob in rig.children_recursive:ob.select_set(True)
 bpy.context.view_layer.objects.active=rigs[0];scene.frame_set(0)
 bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,use_active_scene=True,
   export_yup=True,export_apply=False,export_materials='EXPORT',export_animations=True,
   export_animation_mode='NLA_TRACKS',export_merge_animation='NLA_TRACK',export_force_sampling=True,export_extras=True)
 for rig,location,rotation,parent in saved:rig.parent=parent;rig.location=location;rig.rotation_euler=rotation
 for rig in performances:install_behavior_tracks(rig)
 scene.frame_set(0)
 bpy.data.libraries.write(str(BLEND),{scene},fake_user=True,compress=True)
 meta={'name':'Long-fin koi school','units':'metres','roots':[r.name for r in rigs],
       'actions':['KOI_ACT_'+k for k in ACTIONS],'variants':[r['variant'] for r in rigs],
       'coordinates':{'Blender':'head +Y dorsal +Z','glTF':'head -Z dorsal +Y'},
       'glbSha256':hashlib.sha256(GLB.read_bytes()).hexdigest(),'validation':report,
       'limitations':'Art-directed kinematics, original coats and approximate translucent fins; no fluid or muscle solver.'}
 (ROOT/'public/models/long-fin-koi-school.metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
 (OUT/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
 return {'blend':str(BLEND),'glb':str(GLB),'bytes':GLB.stat().st_size,'validation':report}

def build():
 result=build_geometry()
 for i in range(7):bake_one(i)
 from .scene_layout import setup
 from .school_controller import place
 setup();create_master();place([bpy.data.objects[n] for n in bpy.context.scene['rig_names']])
 return save_and_export()

def create_master():
 scene=bpy.context.scene;source=bpy.data.objects[scene['rig_names'][3]]
 master=source.copy();master.data=source.data.copy();master.name='KOI_MASTER_RIG';master.parent=None;master.location=(0,0,0);master.rotation_euler=(0,0,0);master.scale=(1,1,1)
 collection=bpy.data.collections['KOI_MASTER'];collection.objects.link(master)
 for ob in source.children:
  duplicate=ob.copy();duplicate.data=ob.data.copy();duplicate.name='KOI_MASTER_BODY' if 'BODY' in ob.name else 'KOI_MASTER_'+ob.name
  collection.objects.link(duplicate);duplicate.parent=master
  for modifier in duplicate.modifiers:
   if modifier.type=='ARMATURE':modifier.object=master
  duplicate.hide_render=True
 master.hide_render=True;collection.hide_render=True;collection.hide_viewport=True
 return {'master':master.name,'meshes':len(master.children),'bones':len(master.data.bones)}

def save_scene():
 OUT.mkdir(parents=True,exist_ok=True)
 bpy.data.libraries.write(str(BLEND),{bpy.context.scene},fake_user=True,compress=True)
 return {'blend':str(BLEND)}

if __name__=='__main__':build()
