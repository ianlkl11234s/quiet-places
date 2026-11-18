import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {SILVERFISH_CRUISE_BL,SILVERFISH_SPEED_PHASE,createSilverfish,silverfishWaveRate} from '../src/shared/biology/antarctic/AntarcticModels.ts';
import {AntarcticBehavior,SILVERFISH_BANK} from '../src/places/snowhall/AntarcticBehavior.ts';

const bodyPositions=(fish:ReturnType<typeof createSilverfish>)=>Array.from(((fish.root.getObjectByName('silverfish-continuous-body') as THREE.Mesh).geometry.getAttribute('position') as THREE.BufferAttribute).array);

test('B3 SILVERFISH_SPEED_PHASE: beat rate is 1 at cruise, low at rest, rises with speed and is capped',()=>{
 assert.equal(SILVERFISH_SPEED_PHASE,true);
 assert.ok(Math.abs(silverfishWaveRate(SILVERFISH_CRUISE_BL)-1)<1e-12,'cruise keeps the legacy frequency');
 assert.ok(Math.abs(silverfishWaveRate(0)-.3)<1e-12);
 assert.ok(silverfishWaveRate(2)>silverfishWaveRate(1)&&silverfishWaveRate(1)>silverfishWaveRate(.4));
 assert.ok(silverfishWaveRate(99)<=1.6+1e-12&&silverfishWaveRate(NaN)>=.3-1e-12);
 // Over 10 s a fish at twice the speed completes clearly more beats.
 const cycles=(speed:number)=>{let c=0;for(let i=0;i<600;i++)c+=silverfishWaveRate(speed)/60;return c*2.35;};
 assert.ok(cycles(1.4)>cycles(.7)*1.35,`${cycles(1.4)} vs ${cycles(.7)}`);
});

test('B3 model: waveClock = elapsed (or omitted) reproduces the legacy pose bit-for-bit; other clocks change the tail only via phase',()=>{
 const a=createSilverfish(5),b=createSilverfish(5),c=createSilverfish(5);
 a.update(4.5,.8,.2,1);b.update(4.5,.8,.2,1,4.5);c.update(4.5,.8,.2,1,7.25);
 assert.deepEqual(bodyPositions(b),bodyPositions(a));
 assert.notDeepEqual(bodyPositions(c),bodyPositions(a));
 c.update(4.5,.8,.2,1,Number.NaN);assert.deepEqual(bodyPositions(c),bodyPositions(a),'invalid clock falls back to elapsed');
 a.dispose();b.dispose();c.dispose();
});

function run(bank:number,seconds:number,hook?:(m:AntarcticBehavior,t:number)=>void){const m=new AntarcticBehavior(813,{bankDegrees:bank});for(let f=0;f<=seconds*60;f++){const t=f/60;m.update(t);hook?.(m,t);}return m;}

test('B3 SILVERFISH_BANK: roll leans into the turn, stays within the cap, never jumps, and does not move the fish',()=>{
 assert.equal(SILVERFISH_BANK,8);
 const cap=THREE.MathUtils.degToRad(SILVERFISH_BANK)+1e-9,maxStep=2*THREE.MathUtils.degToRad(SILVERFISH_BANK)*(1-Math.exp(-1/60/.35))+1e-9;
 const previous=new Map<number,number>();let correlation=0,peak=0,steps=0;
 const m=run(SILVERFISH_BANK,150,(model)=>model.fish.forEach((f,i)=>{
  if(!f.visible){previous.delete(i);return;}
  assert.ok(Math.abs(f.roll)<=cap,`roll ${f.roll}`);
  const last=previous.get(i);if(last!==undefined){assert.ok(Math.abs(f.roll-last)<=maxStep,`roll step ${f.roll-last}`);}
  previous.set(i,f.roll);correlation+=f.turn*f.roll;peak=Math.max(peak,Math.abs(f.roll));steps++;
  // Convention check: negative roll (leaning into a left/+yaw turn) dips the fish's left (+X) side.
  if(Math.abs(f.roll)>.02)assert.equal(Math.sign(new THREE.Vector3(1,0,0).applyQuaternion(f.q).y),Math.sign(f.roll));
 }));
 assert.ok(steps>1000,'fish observed');assert.ok(correlation<0,'roll opposes yaw-rate sign (Z-rotation) = leans into the turn');assert.ok(peak>THREE.MathUtils.degToRad(1),`peak ${peak}`);
 const off=run(0,60),on=run(SILVERFISH_BANK,60);
 off.fish.forEach((f,i)=>{assert.equal(f.roll,0);assert.deepEqual(f.position.toArray(),on.fish[i].position.toArray(),'roll never alters motion');assert.equal(f.waveClock,on.fish[i].waveClock);
  assert.ok(f.q.equals(new THREE.Quaternion().setFromEuler(new THREE.Euler(-f.pitch,f.yaw,0,'YXZ'))),'bank 0 = legacy upright orientation');});
});

test('B3 waveClock: integrated from speed, continuous, deterministic under seek',()=>{
 let maxJump=0;const last=new Map<number,number>();
 const m=run(SILVERFISH_BANK,120,(model)=>model.fish.forEach((f,i)=>{if(!f.visible){last.delete(i);return;}const l=last.get(i);if(l!==undefined)maxJump=Math.max(maxJump,Math.abs(f.waveClock-l));last.set(i,f.waveClock);}));
 assert.ok(maxJump<=1.6/60+1e-9,`per-frame clock advance ${maxJump}`);
 const again=new AntarcticBehavior(813);again.update(120);const clocks=again.fish.map(f=>f.waveClock);
 again.update(30);again.update(120);assert.deepEqual(again.fish.map(f=>f.waveClock),clocks);
 assert.deepEqual(m.fish.map(f=>f.waveClock),clocks);
});
