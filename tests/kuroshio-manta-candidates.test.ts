import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createMantaModel} from '../src/creatures/manta/index.ts';
import {TAIL_FOLLOW_LIMIT} from '../src/creatures/manta/MantaModel.ts';
import {ArcadeAnimalMotion,profiles,MANTA_SPEED_COUPLED_FLAP,MANTA_TAIL_FOLLOW,MANTA_FLAP_RATIO_RANGE,MANTA_YIELD_AMPLITUDE_DROP,MANTA_TAIL_MAX_RAD} from '../src/places/last-arcade/biology/Motion.ts';

const tailPositions=(model:ReturnType<typeof createMantaModel>)=>{let out:number[]=[];model.root.traverse(o=>{if(o.name==='manta-long-thin-tail')out=Array.from(((o as THREE.Mesh).geometry.getAttribute('position') as THREE.BufferAttribute).array);});return out;};

test('B5 MANTA_TAIL_FOLLOW model: zero lag is the exact rest pose; lag trails the turn, keeps the root fixed, is bounded and restores',()=>{
 const model=createMantaModel(5.4,77),rest=tailPositions(model);
 model.update({phase:1,amplitude:1,asymmetry:0,glide:0,tailYaw:0,tailPitch:0});assert.deepEqual(tailPositions(model),rest,'0 lag = untouched static tail');
 model.update({phase:1,amplitude:1,asymmetry:0,glide:0});assert.deepEqual(tailPositions(model),rest,'omitted fields = legacy');
 model.update({phase:1,amplitude:1,asymmetry:0,glide:0,tailYaw:-.2,tailPitch:-.1});const bent=tailPositions(model);
 // Tail vertices run root -> tip; compare the first and last ring centres (7 vertices each, last one a seam duplicate).
 const centre=(a:number[],ring:number)=>{const v=new THREE.Vector3();for(let i=0;i<6;i++)v.add(new THREE.Vector3(a[(ring*7+i)*3],a[(ring*7+i)*3+1],a[(ring*7+i)*3+2]));return v.multiplyScalar(1/6);};
 assert.ok(centre(bent,0).distanceTo(centre(rest,0))<1e-5,'root stays fixed');
 const tip=centre(bent,14).sub(centre(rest,14));assert.ok(tip.x<-.4&&tip.x>-1.2*Math.sin(.2)*.45*5.4,`tip swings toward -X ${tip.x}`);assert.ok(tip.y<0,'tip drops for negative pitch lag');
 model.update({phase:1,amplitude:1,asymmetry:0,glide:0,tailYaw:9,tailPitch:-9});const capped=centre(tailPositions(model),14).sub(centre(rest,14));
 assert.ok(Math.abs(capped.x)<=Math.sin(TAIL_FOLLOW_LIMIT)*.45*5.4+1e-4&&Math.abs(capped.y)<=Math.sin(TAIL_FOLLOW_LIMIT)*.45*5.4+1e-4,'model clamps absurd input');
 model.update({phase:1,amplitude:1,asymmetry:0,glide:0,tailYaw:0,tailPitch:0});assert.deepEqual(tailPositions(model),rest,'recovers exactly');
 model.dispose();
});

function observe(options:{speedCoupledFlap?:boolean,tailFollow?:boolean},seconds=900){
 const m=new ArcadeAnimalMotion(false,options),rows:{i:number,t:number,s:(typeof m.states)[number],yawRate:number}[]=[];
 let lastYaw=[0,0,0];
 for(let t=0;t<=seconds;t+=.25){m.advance(t);m.states.forEach((s,i)=>{const f=new THREE.Vector3(0,0,1).applyQuaternion(s.quaternion),yaw=Math.atan2(f.x,f.z);rows.push({i,t,s:{...s,position:s.position.clone(),quaternion:s.quaternion.clone(),velocity:s.velocity.clone()},yawRate:t?Math.atan2(Math.sin(yaw-lastYaw[i]),Math.cos(yaw-lastYaw[i]))/.25:0});lastYaw[i]=yaw;});}
 return {m,rows};
}

test('B5 MANTA_SPEED_COUPLED_FLAP: flap tracks speed within the ratio range, amplitude eases down only while yielding, cruise unchanged',()=>{
 assert.equal(MANTA_SPEED_COUPLED_FLAP,true);
 const {rows}=observe({tailFollow:false});
 let minAmp=1,slow=0,fast=0,slowF=0,fastF=0;
 for(const {i,s} of rows){
  const p=profiles[i],ratio=s.frequency/p.frequency;
  assert.ok(s.frequency>=.23-1e-12&&s.frequency<=.36+1e-12,`frequency stays in the existing clamp ${s.frequency}`);
  assert.ok(s.amplitude<=1+1e-12&&s.amplitude>=1-MANTA_YIELD_AMPLITUDE_DROP-1e-9,`amplitude ${s.amplitude}`);minAmp=Math.min(minAmp,s.amplitude);
  const speedRatio=s.speed/p.speed;if(speedRatio<.8){slow++;slowF+=ratio;}else if(speedRatio>1.0){fast++;fastF+=ratio;}
 }
 assert.ok(minAmp<.9,'yielding lowers amplitude at least somewhere');
 assert.ok(slow>50&&fast>50&&slowF/slow<fastF/fast-.1,`slower mantas flap slower (${slowF/slow} vs ${fastF/fast})`);
 assert.ok(MANTA_FLAP_RATIO_RANGE[0]===.55&&MANTA_FLAP_RATIO_RANGE[1]===1.25);
});

test('B5 flags off: legacy amplitude/frequency/tail, identical routes; whale shark never changes',()=>{
 const off=observe({speedCoupledFlap:false,tailFollow:false},300),on=observe({},300);
 off.rows.forEach((r,k)=>{assert.equal(r.s.amplitude,1);assert.equal(r.s.tailYaw,0);assert.equal(r.s.tailPitch,0);assert.ok(r.s.frequency>=.23-1e-12&&r.s.frequency<=.36+1e-12);
  assert.ok(r.s.position.equals(on.rows[k].s.position),'coupling never moves a route');assert.ok(r.s.quaternion.equals(on.rows[k].s.quaternion));});
 const whaleOff=new ArcadeAnimalMotion(true,{speedCoupledFlap:false,tailFollow:false}),whaleOn=new ArcadeAnimalMotion(true);
 for(let t=0;t<=300;t+=.5){whaleOff.advance(t);whaleOn.advance(t);const a=whaleOff.states[3],b=whaleOn.states[3];assert.equal(b.frequency,a.frequency);assert.equal(b.phase,a.phase);assert.equal(b.amplitude,1);assert.equal(b.tailYaw,0);}
});

test('B5 MANTA_TAIL_FOLLOW: lag opposes the heading change, stays bounded, relaxes on straights, is deterministic',()=>{
 assert.equal(MANTA_TAIL_FOLLOW,true);
 const {rows}=observe({speedCoupledFlap:false});
 let cross=0,relaxed=0,peak=0,pitchPeak=0;
 for(const {i,s,yawRate} of rows){if(i>2)continue;assert.ok(Math.abs(s.tailYaw)<=MANTA_TAIL_MAX_RAD+1e-12&&Math.abs(s.tailPitch)<=MANTA_TAIL_MAX_RAD*.6+1e-12);cross+=s.tailYaw*yawRate;if(Math.abs(s.tailYaw)<.02)relaxed++;peak=Math.max(peak,Math.abs(s.tailYaw));pitchPeak=Math.max(pitchPeak,Math.abs(s.tailPitch));}
 assert.ok(cross<0,'tail lags behind (opposite to) the body turn');assert.ok(relaxed>rows.length*.02,'tail returns to straight');assert.ok(peak>.05,`visible lag ${peak}`);
 const again=observe({speedCoupledFlap:false});assert.deepEqual(again.rows.map(r=>r.s.tailYaw),rows.map(r=>r.s.tailYaw));
 // Interpolated sample() stays inside the step values.
 const m=new ArcadeAnimalMotion(false);const s=m.sample(100.013);s.forEach((x,i)=>assert.ok(Math.abs(x.tailYaw)<=MANTA_TAIL_MAX_RAD&&Number.isFinite(x.tailPitch)&&x.amplitude<=1,String(i)));
});
