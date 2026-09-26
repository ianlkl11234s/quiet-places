import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {virtualCurrent} from '../src/shared/biology/VirtualFluid.ts';
import {createCreatureMotion,jellyForces,JELLY_ATTITUDE,JELLY_PRESETS} from '../src/places/snowwindow/CreatureMotion.ts';
import {AURELIA_PULSE,sampleAureliaKinematics} from '../src/shared/biology/aurelia/index.ts';

const positions=(m:ReturnType<typeof createCreatureMotion>)=>m.states.map(s=>[...s.position.toArray(),...s.orientation.toArray(),s.phase]);
test('snow creatures retain the population and give the same trajectories on rewind, pause, and different frame partitions',()=>{
 assert.throws(()=>createCreatureMotion(3));assert.throws(()=>createCreatureMotion(8));
 const a=createCreatureMotion(),b=createCreatureMotion();assert.equal(a.states.length,8);a.update(12);for(let i=1;i<=360;i++)b.update(i/30);assert.deepEqual(positions(a),positions(b));
 const snapshot=positions(a);a.update(12);assert.deepEqual(positions(a),snapshot);a.update(2);a.update(12);assert.deepEqual(positions(a),snapshot);
 assert.equal(createCreatureMotion(7).states.length,10);
});
test('unpowered Clione actually sink in the declared terminal-speed range',()=>{
 const sinking=createCreatureMotion(5,{freezeWings:true,currentGain:0});sinking.update(30);
 for(const state of sinking.states.slice(3)){assert.ok(state.velocity.y<-.005&&state.velocity.y>-.012,`${state.name}: ${state.velocity.y}`);assert.equal(state.leftForce,0);assert.equal(state.rightForce,0);}
});
test('three-jelly calibration has nonzero post-relaxation travel within the requested fraction',()=>{
 for(const p of JELLY_PRESETS){let velocity=0,total=0,glide=0;
  for(let step=1;step<=120*90;step++){
   const time=step/120,s=sampleAureliaKinematics(time,p),f=jellyForces(p.diameter,s.frequency,s.cycle,s.contractionRate);
   velocity+=(f.pulse+f.per-f.dragFactor*velocity*Math.abs(velocity))/f.mass/120;
   if(time>30){total+=velocity/120;if(s.cycle>=AURELIA_PULSE.relaxEnd)glide+=velocity/120;}
  }
  assert.ok(glide/total>=.25&&glide/total<=.35,`${p.name}: ${glide/total}`);
 }
});
test('60-second group stays finite, separated, in front of the glazing, and does not synchronize persistently',()=>{
 const motion=createCreatureMotion();let highSynchrony=0,maxHighSynchrony=0;
 for(let frame=0;frame<=60*30;frame++){
  motion.update(frame/30);let re=0,im=0;
  motion.states.forEach((s,index)=>{
   assert.ok([...s.position.toArray(),...s.velocity.toArray(),...s.orientation.toArray()].every(Number.isFinite));
   const radius=index<3?JELLY_PRESETS[index].diameter*.6:.025;
   assert.ok(s.position.z-radius>-4.42&&s.position.y-radius>.78,'never penetrates glazing or sill');
   assert.ok(s.position.x-radius>-.95,'never penetrates side wall');
   if(index<3){re+=Math.cos(s.phase);im+=Math.sin(s.phase);for(let j=0;j<index;j++)assert.ok(s.position.distanceTo(motion.states[j].position)>1.2*(JELLY_PRESETS[index].diameter+JELLY_PRESETS[j].diameter)/2);}
  });
  highSynchrony=Math.hypot(re,im)/3>.9?highSynchrony+1:0;maxHighSynchrony=Math.max(maxHighSynchrony,highSynchrony);
 }
 assert.ok(maxHighSynchrony/30<5,`synchrony lasted ${maxHighSynchrony/30}s`);
});
test('virtual current is bounded and numerically divergence-free',()=>{
 const epsilon=1e-4;
 for(const time of [0,4,19,60]){const p=new Vector3(.4,2,-3),flow=virtualCurrent(p,time);assert.ok(flow.length()<.012);let divergence=0;
  for(let axis=0;axis<3;axis++){const a=p.clone(),b=p.clone();a.setComponent(axis,a.getComponent(axis)+epsilon);b.setComponent(axis,b.getComponent(axis)-epsilon);divergence+=(virtualCurrent(a,time).getComponent(axis)-virtualCurrent(b,time).getComponent(axis))/(2*epsilon);}
  assert.ok(Math.abs(divergence)<1e-8);
 }
});

test('J2 jelly attitude: tilts and turns by asymmetric beats within the research envelope over 60 s',()=>{
 const motion=createCreatureMotion(7),tilt:number[][]=[[],[],[]],axes:Vector3[][]=[[],[],[]],onsets:number[][]=[[],[],[]],last=[1,1,1],contract=[0,0,0],active=[0,0,0];let omega=0;
 for(let k=1;k<=60*120;k++){motion.update(k/120);motion.states.slice(0,3).forEach((s,i)=>{
  const cycle=((s.phase/(2*Math.PI))%1+1)%1,n=new Vector3(0,0,1).applyQuaternion(s.orientation);
  if(cycle<last[i]){onsets[i].push(k/120);axes[i].push(n);}last[i]=cycle;
  tilt[i].push(s.tilt*180/Math.PI);omega=Math.max(omega,s.angularVelocity.length());
  if(s.activity>.2){active[i]++;if(s.pulseRate>0)contract[i]++;}
 });}
 assert.ok(omega<=JELLY_ATTITUDE.maxAngularSpeed+1e-9,`|ω| ${omega}`);
 JELLY_PRESETS.forEach((p,i)=>{
  const measured=(onsets[i].length-1)/(onsets[i][onsets[i].length-1]-onsets[i][0]);
  assert.ok(Math.abs(measured-p.frequency)/p.frequency<.05,`${p.name} frequency ${measured}`);
  const share=contract[i]/active[i];assert.ok(share>=.18&&share<=.22,`${p.name} contraction share ${share}`);
  const sorted=[...tilt[i]].sort((a,b)=>a-b),median=sorted[sorted.length>>1],over=tilt[i].filter(v=>v>25).length/tilt[i].length;
  assert.ok(median>=8&&median<=20,`${p.name} tilt median ${median}`);assert.ok(over>=.05,`${p.name} >25° share ${over}`);
  for(let b=1;b<axes[i].length;b++)assert.ok(Math.acos(Math.min(1,axes[i][b-1].dot(axes[i][b])))<=JELLY_ATTITUDE.maxBeatTurn,`${p.name} beat ${b} turn`);
 });
});
test('J2 beat events are emitted per stroke and rebuilt identically on rewind',()=>{
 const a=createCreatureMotion(),b=createCreatureMotion();a.update(30);for(let i=1;i<=900;i++)b.update(i/30);
 assert.deepEqual(a.beatEvents,b.beatEvents);
 const events=a.beatEvents.filter(e=>e.kind==='contraction');assert.ok(events.length>=10);
 for(const e of events){assert.ok(e.strength>0&&e.index<3&&e.time<=30);assert.ok(Math.abs(Math.hypot(...e.axis)-1)<1e-6);assert.ok(e.position.every(Number.isFinite));}
 assert.ok(a.beatEvents.some(e=>e.kind==='relaxation'));
 const snapshot=JSON.stringify(a.beatEvents);a.update(5);a.update(30);assert.equal(JSON.stringify(a.beatEvents),snapshot);
 assert.deepEqual(a.beatEventsSince(29).map(e=>e.time),a.beatEvents.filter(e=>e.time>29).map(e=>e.time));
});
