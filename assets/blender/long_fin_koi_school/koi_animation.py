"""Periodic in-place action baking. Artist controls require rebaking; no live physics."""
import math
import bpy
from mathutils import Vector, Quaternion
from .config import ACTIONS, FPS
from .koi_master_geometry import base
from koi_motion import SPINE, tangent, periodic_phase, action_curves

PRESETS = {
 'IDLE_HOVER':(.45,.32,1.2), 'SLOW_CRUISE':(.72,.82,.7),
 'GLIDE':(.375,.25,.4), 'TURN_LEFT':(.75,.8,.75),
 'TURN_RIGHT':(.75,.8,.75), 'SLIGHT_RISE':(.833,.75,.8),
 'SLIGHT_DESCEND':(.667,.65,.7), 'PAUSE':(.333,.20,1.0),
}

def pose(rig, time, kind, bases):
 duration=ACTIONS[kind]; frequency, gain, pgain=PRESETS[kind]
 frequency*=rig.get('body_wave_frequency',.72)/.72
 config={'wave_count':rig.get('wave_count',.84), 'motion_seed':rig['motion_seed'], 'organic_variation_amount':1.}
 amplitude=.29*rig.get('body_wave_amplitude_ratio',.058)*gain
 cycle=math.tau*time/duration
 turn=-1 if kind=='TURN_LEFT' else 1 if kind=='TURN_RIGHT' else 0
 def rotate(name, axis, angle):
  if name in rig.pose.bones: rig.pose.bones[name].rotation_quaternion=Quaternion(bases[name]@Vector(axis),angle)
 for b in rig.pose.bones:
  b.location=(0,0,0);b.rotation_quaternion=(1,0,0,0);b.scale=(1,1,1)
 previous=0.
 for name,s in SPINE:
  sample_s=min(s,1.)
  lag=max(0,s-1)*rig.get('tail_follow_lag',.03)/.11
  angle=tangent(sample_s,time-lag,duration,amplitude,frequency,config,.29)
  if s>1:angle*=.94
  angle+=turn*.06*min(s,1)**1.7
  rotate(name,(0,0,1),angle-previous);previous=angle
 finfreq=rig.get('pectoral_frequency',.5)
 for side,label in ((-1,'L'),(1,'R')):
  previous=0.
  for segment,lag,weight in (('',0,1.),('_mid',.035,.96),('_tip',.07,.92)):
   phase=periodic_phase(time-lag,duration,finfreq,.3,rig['motion_seed']+11)
   angle=side*math.radians(10)*pgain*weight*math.sin(phase+side*.22)
   rotate('pectoral_'+label+segment,(0,0,1),angle-previous)
   previous=angle
 for name,side in (('pelvic_L',-1),('pelvic_R',1),('anal',1),('dorsal',1)):
  rotate(name,(0,0,1),side*.014*math.sin(periodic_phase(time,duration,.4,.2,rig['motion_seed'])-.4))
 for name,side in (('caudal_L',-1),('caudal_R',1)):
  rotate(name,(0,1,0),side*.018*math.sin(periodic_phase(time-.05,duration,frequency,.2,rig['motion_seed'])))
 rotate('body_master',(0,1,0),math.radians(1.2)*math.sin(cycle*2+rig['motion_seed']))
 rig.pose.bones['body_master'].location=bases['body_master']@Vector((0,0,.002*math.sin(cycle)))
 # Rise/descend are reusable attitude clips: world travel belongs to the shoal controller.
 if kind in ('SLIGHT_RISE','SLIGHT_DESCEND'):
  rotate('root',(1,0,0),math.radians(2)*(1 if kind=='SLIGHT_RISE' else -1))

def make_actions(rig, seed=None):
 rig.animation_data_create()
 for track in list(rig.animation_data.nla_tracks):
  if track.name.startswith('KOI_ACT_'):rig.animation_data.nla_tracks.remove(track)
 for key,value in {'body_wave_frequency':.72,'body_wave_amplitude_ratio':.058,'wave_count':.84,'pectoral_frequency':.5,'tail_follow_lag':.03}.items():
  if key not in rig:rig[key]=value
 bases={b.name:b.bone.matrix_local.to_3x3().inverted() for b in rig.pose.bones}
 for b in rig.pose.bones:b.rotation_mode='QUATERNION'
 actions={}
 for kind,duration in ACTIONS.items():
  name='KOI_ACT_'+kind
  action=bpy.data.actions.new(rig.name+'__'+name);action.use_fake_user=True
  slot=action.slots.new('OBJECT',rig.name)
  rig.animation_data.action=action;rig.animation_data.action_slot=slot
  for frame in range(round(duration*FPS)+1):
   pose(rig,frame/FPS,kind,bases)
   for bone in rig.pose.bones:
    bone.keyframe_insert('rotation_quaternion',frame=frame,group=bone.name)
    if bone.name=='body_master':bone.keyframe_insert('location',frame=frame,group=bone.name)
  for curve in action_curves(action):
   for key in curve.keyframe_points:key.interpolation='LINEAR'
  action['loop']=True;action['in_place']=True;action['duration_seconds']=duration
  action['frequency_hz']=round(PRESETS[kind][0]*duration)/duration
  track=rig.animation_data.nla_tracks.new();track.name=name
  strip=track.strips.new(name,0,action);strip.action_slot=slot;track.mute=True
  actions[kind]=action
 rig.animation_data.action=actions['SLOW_CRUISE'];rig.animation_data.action_slot=actions['SLOW_CRUISE'].slots[0]
 return actions
