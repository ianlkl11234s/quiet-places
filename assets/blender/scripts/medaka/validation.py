"""Contract and behavioural QA for the generated medaka cache."""
from __future__ import annotations
import json, math, struct
from pathlib import Path
from .config import *
ROOT=Path(__file__).resolve().parents[4]
def main() -> None:
 m=json.loads((ROOT/'public/models/medaka-motion.json').read_text()); raw=(ROOT/'public/models/medaka-motion.bin').read_bytes()
 assert (m['duration'],m['fps'],m['frameCount'],m['fishCount'],m['stride'])==(120.,30,3601,22,12)
 values=struct.unpack('<%sf'%(len(raw)//4),raw); assert len(values)==3601*22*12
 min_sep=99.; seen=set(); max_speed=0.
 for frame in range(m['frameCount']):
  poses=[]
  for i in range(FISH_COUNT):
   b=(frame*FISH_COUNT+i)*STRIDE; x,y,z=values[b:b+3]; speed=values[b+7]; state=round(values[b+10]); q=values[b+11]
   assert -.8<=x<=1.6 and .18<=y<=1.6 and -1.7<=z<=.9
   assert math.isfinite(speed) and .0001<speed<.30 and 0<=state<9 and 0<=q<=1
   poses.append((x,y,z)); seen.add(state); max_speed=max(max_speed,speed)
  for i in range(FISH_COUNT):
   for j in range(i): min_sep=min(min_sep,math.dist(poses[i],poses[j]))
 # Oriented capsule clearance: body half-axis=.38 length, radius=.10 length,
 # plus 1 mm. This admits a natural small-fish pass without treating each
 # 3–4.5 cm animal as an implausible 4 cm sphere.
 def segment_distance(p1,q1,p2,q2):
  u=[q1[k]-p1[k] for k in range(3)];v=[q2[k]-p2[k] for k in range(3)];w=[p1[k]-p2[k] for k in range(3)]
  a=sum(x*x for x in u);b=sum(u[k]*v[k] for k in range(3));c=sum(x*x for x in v);d=sum(u[k]*w[k] for k in range(3));e=sum(v[k]*w[k] for k in range(3));den=a*c-b*b
  s=max(0,min(1,(b*e-c*d)/den)) if den>1e-10 else 0.;t=max(0,min(1,(a*e-b*d)/den)) if den>1e-10 else max(0,min(1,e/c))
  return math.dist([p1[k]+s*u[k] for k in range(3)],[p2[k]+t*v[k] for k in range(3)])
 capsule_clearance=99.
 for frame in range(0,m['frameCount'],2):
  for i in range(FISH_COUNT):
   oi=(frame*FISH_COUNT+i)*STRIDE;pi=list(values[oi:oi+3]);qi=list(values[oi+3:oi+7]);di=[0,0,-1]
   # quaternion rotate local -Z
   x,y,z,w=qi;di=[-2*(x*z+y*w),2*(x*w-y*z),-1+2*(x*x+y*y)]
   li=m['fish'][i]['length'];a=[pi[k]-di[k]*.38*li for k in range(3)];b=[pi[k]+di[k]*.38*li for k in range(3)]
   for j in range(i):
    oj=(frame*FISH_COUNT+j)*STRIDE;pj=list(values[oj:oj+3]);qj=list(values[oj+3:oj+7]);x,y,z,w=qj;dj=[-2*(x*z+y*w),2*(x*w-y*z),-1+2*(x*x+y*y)];lj=m['fish'][j]['length'];c1=[pj[k]-dj[k]*.38*lj for k in range(3)];d1=[pj[k]+dj[k]*.38*lj for k in range(3)]
    capsule_clearance=min(capsule_clearance,segment_distance(a,b,c1,d1)-.10*(li+lj))
 assert capsule_clearance>.001, capsule_clearance
 assert {0,1,2,3,4,5,6,7,8} <= seen, seen
 assert max_speed>=.14, max_speed
 # Seam is a returning macrostate: no teleport, no heading flip or phase pop.
 for i in range(FISH_COUNT):
  a=i*STRIDE; b=((3600*FISH_COUNT)+i)*STRIDE
  assert math.dist(values[a:a+3],values[b:b+3])<1e-5
  assert abs(values[a+7]-values[b+7])<.01
  assert abs(sum(values[a+3+k]*values[b+3+k] for k in range(4)))>.999
  assert abs(((values[a+8]-values[b+8]+math.pi)%math.tau)-math.pi)<.01
 # Actual aperture volume: trace the stated incoming sun direction down from
 # y=3, rather than treating its x/z roof rectangle as a vertical light box.
 def light(frame, fish):
  b=(frame*FISH_COUNT+fish)*STRIDE; x,y,z=values[b:b+3]; drop=3-y
  return .62+.28*drop<=x<=1.28+.28*drop and -1.25+.25*drop<=z<=-.35+.25*drop
 def shadow_light_shadow(frames):
  return any(not frames[a] and frames[a+1] and not frames[a+2] for a in range(len(frames)-2))
 occupancy={}
 for angle in (-.16,0.,.16):
  sx=.28*math.cos(angle)+.25*math.sin(angle);sz=.25*math.cos(angle)-.28*math.sin(angle)
  counts=[]
  for frame in range(m['frameCount']):
   lit_count=0
   for fish in range(FISH_COUNT):
    o=(frame*FISH_COUNT+fish)*STRIDE;x,y,z=values[o:o+3];drop=3-y
    lit_count += .62<=x-sx*drop<=1.28 and -1.25<=z-sz*drop<=-.35
   counts.append(lit_count)
  occupancy[str(angle)]={'min':min(counts),'max':max(counts)}
  assert min(counts)>=(3 if angle==0 else 2), occupancy
 triangle_visits=[]
 for fish in range(12):
  visits=[]
  for ax,az in ((.55,-.90),(1.03,-.38),(1.30,-.38)):
   inside=[]
   for frame in range(m['frameCount']):
    o=(frame*FISH_COUNT+fish)*STRIDE
    inside.append(math.hypot(values[o]-ax,values[o+2]-az)<.07)
   visits.append(sum(inside[i] and not inside[i-1] for i in range(1,len(inside))))
  assert min(visits)>=2, (fish,visits)
  triangle_visits.append(visits)
 event_evidence=[]
 for event in m['events']:
  start=max(0,round((event['time']-3)*FPS)); end=min(m['frameCount']-1,round((event['time']+8)*FPS))
  crossed=[]
  for fish in event['members']:
   trace=[light(frame,fish) for frame in range(start,end+1)]
   # A visible run must be bounded by darkness, not only start/end state.
   if any(trace) and any(not x for x in trace[:trace.index(True)]) and any(not x for x in trace[trace.index(True)+1:]): crossed.append(fish)
  event_evidence.append({'time':event['time'],'members':len(event['members']),'lightSamples':sum(light(frame,fish) for frame in range(start,end+1) for fish in event['members']),'shadowLightShadowFish':crossed})
 assert any(row['shadowLightShadowFish'] for row in event_evidence), event_evidence
 # Plant volumes match shoal.py: report penetration after the complete loop
 # correction, and count gathering/exit from the readable plant-side annulus.
 plant_penetrations=0; gathered=[]
 for frame in range(m['frameCount']):
  near=0
  for fish in range(FISH_COUNT):
   b=(frame*FISH_COUNT+fish)*STRIDE;x,y,z=values[b:b+3]
   near += math.dist((x,y,z),(1.30,.90,-.38))<.46
   for cx,cy,cz,rx,ry,rz in [(1.57,.67,-.38,.16,.80,.13),(1.28,.92,-.13,.18,.23,.17),(1.28,.92,-.63,.18,.23,.17)]:
    if ((x-cx)/rx)**2+((y-cy)/ry)**2+((z-cz)/rz)**2 < 1: plant_penetrations+=1
  gathered.append(near)
 assert plant_penetrations==0, plant_penetrations
 # Sampling phase is unwrapped; measure its true tail cadence and positional
 # acceleration/heading rather than trusting authored range constants.
 tail_hz=[]; accelerations=[]; turns=[]; body_turns=[]
 for frame in range(1,m['frameCount']-1):
  for fish in range(FISH_COUNT):
   a=((frame-1)*FISH_COUNT+fish)*STRIDE;b=(frame*FISH_COUNT+fish)*STRIDE;c=((frame+1)*FISH_COUNT+fish)*STRIDE
   dot=abs(sum(values[a+3+k]*values[b+3+k] for k in range(4)))
   body_turns.append(2*math.acos(min(1.,dot))*FPS)
   tail_hz.append((values[c+8]-values[a+8])/(2/FPS)/math.tau)
   va=[(values[c+k]-values[a+k])/(2/FPS) for k in range(3)]
   pa=[(values[b+k]-values[a+k])*FPS for k in range(3)]; pb=[(values[c+k]-values[b+k])*FPS for k in range(3)]
   accelerations.append(math.dist(pa,pb)*FPS)
   if math.hypot(va[0],va[2])>.005:
    prev=[(values[b+k]-values[a+k])*FPS for k in range(3)]; nxt=[(values[c+k]-values[b+k])*FPS for k in range(3)]
    turns.append(abs(math.atan2(math.sin(math.atan2(nxt[0],nxt[2])-math.atan2(prev[0],prev[2])),math.cos(math.atan2(nxt[0],nxt[2])-math.atan2(prev[0],prev[2]))))*FPS)
 assert max(body_turns)<math.radians(365), math.degrees(max(body_turns))
 assert min(tail_hz)>=1.9 and max(tail_hz)<=7.1 and max(accelerations)<=.6, (min(tail_hz),max(tail_hz),max(accelerations))
 evidence={'occupancyBySunRotation':occupancy,'triangleVisits':triangle_visits,'events':event_evidence,'light':{'fishCount':len({fish for frame in range(m['frameCount']) for fish in range(FISH_COUNT) if light(frame,fish)}),'samples':sum(light(frame,fish) for frame in range(m['frameCount']) for fish in range(FISH_COUNT))},'plant':{'penetrationSamples':plant_penetrations,'gatheredFishRange':[min(gathered),max(gathered)],'entryExitTransitions':sum((gathered[i-1]<4<=gathered[i]) or (gathered[i-1]>=4>gathered[i]) for i in range(1,len(gathered)))},'actual':{'tailHz':[round(min(tail_hz),3),round(max(tail_hz),3)],'accelerationMax':round(max(accelerations),3),'pathTangentTurnMaxDegPerSec':round(math.degrees(max(turns)),2),'bodyTurnMaxDegPerSec':round(math.degrees(max(body_turns)),2),'speedMax':round(max_speed,3),'minCenterSeparation':round(min_sep,4),'bodyCapsuleClearance':round(capsule_clearance,5)}}
 review=ROOT/'exports/medaka-review';review.mkdir(parents=True,exist_ok=True);(review/'behavior-evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
 print(f'PASS min separation={min_sep:.4f}m max speed={max_speed:.3f}m/s states={sorted(seen)}; evidence={evidence}')
if __name__=='__main__': main()
