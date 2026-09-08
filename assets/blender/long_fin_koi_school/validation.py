"""Real weights, bones and baked action seams; fails loudly on incomplete assets."""
import math
import bpy
from .config import ACTIONS
from koi_motion import action_curves

def validate(rigs):
 report={'fishCount':len(rigs),'rigs':[],'maxWeightError':0.,'maxLoopError':0.,'actions':list(ACTIONS)}
 assert len(rigs)==7
 for rig in rigs:
  weighted=set();vertices=0
  for ob in rig.children:
   if ob.type!='MESH':continue
   assert any(m.type=='ARMATURE' and m.object==rig for m in ob.modifiers)
   for v in ob.data.vertices:
    total=sum(g.weight for g in v.groups);report['maxWeightError']=max(report['maxWeightError'],abs(1-total));vertices+=1
    for g in v.groups:
     if g.weight>1e-5:weighted.add(ob.vertex_groups[g.group].name)
  for bone in ('head','spine_05','peduncle','tail_mid','tail_tip','pectoral_L_mid','pectoral_L_tip','pectoral_R_mid','pectoral_R_tip'):
   assert bone in weighted,(rig.name,bone,'unweighted')
  tracks={t.name:t for t in rig.animation_data.nla_tracks}
  for kind in ACTIONS:
   track=tracks['KOI_ACT_'+kind];action=track.strips[0].action
   assert action['in_place'] and action['loop']
   for curve in action_curves(action):
    keys=curve.keyframe_points
    assert all(math.isfinite(k.co.y) for k in keys)
    error=abs(keys[0].co.y-keys[-1].co.y);report['maxLoopError']=max(report['maxLoopError'],error)
    assert error<1e-5,(rig.name,kind,curve.data_path,error)
  report['rigs'].append({'name':rig.name,'bones':len(rig.data.bones),'weightedBones':sorted(weighted),'vertices':vertices})
 assert report['maxWeightError']<1e-5
 report['PASS']=True
 return report
