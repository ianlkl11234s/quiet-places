"""Deterministic loose-shoal bake for the reusable Blender light-shaft study."""
import math, random, json
import bpy
from mathutils import Vector
from .config import FPS,ACTIONS


def place(rigs, duration=120, controller=None):
 collection=bpy.data.collections['KOI_SCHOOL']
 ctrl=controller or bpy.data.objects.get('KOI_SCHOOL_CTRL')
 if ctrl is None:
  ctrl=bpy.data.objects.new('KOI_SCHOOL_CTRL',None);collection.objects.link(ctrl)
 for k,v in {'school_radius':.75,'cohesion_strength':.45,'separation_strength':.70,'alignment_strength':.18,'wander_strength':.52,'beam_confinement':.65,'vertical_spread':.7,'global_speed_scale':1.,'global_motion_seed':521}.items():
  if k not in ctrl:ctrl[k]=v
 if 'group_center_offset' not in ctrl:ctrl['group_center_offset']=(0.,0.,2.2)
 ctrl.location=Vector(ctrl['group_center_offset'])-Vector((0,0,2.2))
 rng=random.Random(int(ctrl['global_motion_seed']));agents=[]
 for i,rig in enumerate(rigs):
  carrier=bpy.data.objects.get('KOI_AGENT_%02d'%(i+1))
  if carrier is None:
   carrier=bpy.data.objects.new('KOI_AGENT_%02d'%(i+1),None);collection.objects.link(carrier)
  carrier.animation_data_clear();carrier.parent=ctrl;rig.parent=carrier;rig.location=(0,0,0);rig.rotation_euler=(0,0,0)
  if 'preferred_depth' not in rig:rig['preferred_depth']=2.2+(i-3)*.225
  preferred=2.2+(rig['preferred_depth']-2.2)*ctrl['vertical_spread']/.7;theta=i*math.tau/7
  position=Vector((.44*math.cos(theta),.33*math.sin(theta),preferred))
  velocity=Vector((-.045*math.sin(theta),.045*math.cos(theta),0))
  carrier.rotation_mode='QUATERNION'
  if 'beam_affinity' not in rig:rig['beam_affinity']=.65
  if 'pause_tendency' not in rig:rig['pause_tendency']=.16
  agents.append({'carrier':carrier,'rig':rig,'p':position,'v':velocity,'pref':preferred,'phase':rng.random()*math.tau,'speed':rig.get('preferred_speed',.044+i*.003),'state':('IDLE_HOVER' if i%3==0 else 'SLOW_CRUISE'),'next':5+i*1.3,'schedule':[[0,('IDLE_HOVER' if i%3==0 else 'SLOW_CRUISE')]]})
 minimum=float('inf');maximum=0.
 for frame in range(duration*FPS+1):
  time=frame/FPS;snapshot=[(a['p'].copy(),a['v'].copy()) for a in agents]
  for i,a in enumerate(agents):
   p,v=snapshot[i]
   if time>=a['next']:
    a['state']=rng.choices(list(ACTIONS),weights=[2,5,2,1,1,1,1,a['rig'].get('pause_tendency',.16)/.16])[0];a['next']=time+rng.uniform(5,13)
    a['schedule'].append([frame,a['state']])
   state=a['state'];gain=.15 if state=='PAUSE' else .35 if state=='IDLE_HOVER' else .7 if state=='GLIDE' else 1.
   desired=v.normalized()*a['speed']*gain if v.length>1e-8 else Vector((0,.04,0))
   neighbors=[j for j in range(7) if j!=i and (snapshot[j][0]-p).length<1.]
   if neighbors:
    center=sum((snapshot[j][0] for j in neighbors),Vector())/len(neighbors)
    align=sum((snapshot[j][1] for j in neighbors),Vector())/len(neighbors)
    desired+=(center-p)*.016*ctrl['cohesion_strength']+(align-v)*.10*ctrl['alignment_strength']
   for j in range(7):
    if j==i:continue
    delta=p-snapshot[j][0];distance=delta.length;minimum=min(minimum,distance)
    if distance<.47 and distance>1e-6:desired+=delta.normalized()*(.47-distance)*.7*ctrl['separation_strength']
   wander=time*.15+a['phase'];desired+=Vector((math.cos(wander),math.sin(wander),.05*math.sin(wander*.7)))*.024*ctrl['wander_strength']
   radius=math.hypot(p.x/ctrl['school_radius'],p.y/(ctrl['school_radius']*.55/.75))
   if radius>.5:desired+=Vector((-p.x,-p.y,0))*(radius-.5)*.25*ctrl['beam_confinement']*a['rig'].get('beam_affinity',.65)/.65
   target=a['pref']+(.18 if state=='SLIGHT_RISE' else -.18 if state=='SLIGHT_DESCEND' else 0)
   desired.z+=(target-p.z)*.12-v.z*.5
   if state in ('TURN_LEFT','TURN_RIGHT'):desired+=Vector((-v.y,v.x,0))*(.28 if state=='TURN_LEFT' else -.28)
   if p.z<1.15:desired.z+=(1.15-p.z)*.4
   if p.z>3.05:desired.z-=(p.z-3.05)*.4
   if desired.length>.10:desired.normalize();desired*=.10
   a['v']=v.lerp(desired,1-math.exp(-1.35/FPS));a['p']=p+a['v']/FPS*ctrl['global_speed_scale'];maximum=max(maximum,a['v'].length)
   carrier=a['carrier'];carrier.location=a['p']
   target_q=a['v'].to_track_quat('Y','Z')
   carrier.rotation_quaternion=carrier.rotation_quaternion.slerp(target_q,1-math.exp(-5/FPS)) if frame else target_q
   if frame%3==0 or frame==duration*FPS:
    carrier.keyframe_insert('location',frame=frame);carrier.keyframe_insert('rotation_quaternion',frame=frame)
  # Paths are an open 120-second sequence; individual swimming Actions remain seamless loops.
 for rig,agent in zip(rigs,agents):
  rig['behavior_schedule']=json.dumps(agent['schedule']);rig['behavior_duration']=duration
  install_behavior_tracks(rig)
 ctrl['path_duration_seconds']=duration;ctrl['path_loop']=False;ctrl['baked_min_center_spacing']=minimum;ctrl['baked_max_speed']=maximum
 bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=duration*FPS;bpy.context.scene.frame_set(0)
 return {'controller':ctrl.name,'minimumSpacing':minimum,'maximumSpeed':maximum,'duration':duration}


def remove_behavior_tracks(rig):
 for track in list(rig.animation_data.nla_tracks):
  if track.name.startswith('KOI_PERFORMANCE_'):rig.animation_data.nla_tracks.remove(track)

def install_behavior_tracks(rig):
 """Reference the eight reusable Actions in staggered, overlapping NLA strips."""
 remove_behavior_tracks(rig)
 schedule=json.loads(rig['behavior_schedule']);end=rig['behavior_duration']*FPS
 actions={t.name:t.strips[0].action for t in rig.animation_data.nla_tracks if t.name.startswith('KOI_ACT_')}
 for i,(start,kind) in enumerate(schedule):
  action=actions['KOI_ACT_'+kind]
  stop=schedule[i+1][0] if i+1<len(schedule) else end
  track=rig.animation_data.nla_tracks.new();track.name='KOI_PERFORMANCE_%02d'%i
  strip=track.strips.new(kind,int(start),action);strip.action_slot=action.slots[0]
  strip.repeat=(stop-start+(36 if i+1<len(schedule) else 0))/(ACTIONS[kind]*FPS)
  strip.extrapolation='NOTHING';strip.blend_type='REPLACE';strip.blend_in=min(36,stop-start) if i else 0
 rig.animation_data.action=None
