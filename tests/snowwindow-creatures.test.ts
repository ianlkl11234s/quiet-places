import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {virtualCurrent} from '../src/shared/biology/VirtualFluid.ts';
import {createCreatureMotion,jellyForces,JELLY_PRESETS} from '../src/places/snowwindow/CreatureMotion.ts';
import {sampleAureliaKinematics} from '../src/shared/biology/aurelia/index.ts';

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
   if(time>30){total+=velocity/120;if(s.cycle>=.75)glide+=velocity/120;}
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
