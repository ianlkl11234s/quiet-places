import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createArcadeSchools} from '../src/systems/schooling/index.ts';
import {arcadeObstacles} from '../src/places/last-arcade/biology/Obstacles.ts';

type Snapshot={chromis:{actualPenetrations:number};fusilier:{meanAlarm:number;actualPenetrations:number;agents:{position:number[]}[]}};
const sampleThreats=(t:number)=>t<20||t>85?[]:[{position:new THREE.Vector3(6.15,2.9,15-.8*(t-20)),velocity:new THREE.Vector3(0,0,-.8),radius:2.7}];
const create=(threatened=true)=>createArcadeSchools({seed:91626,obstacles:arcadeObstacles(),sampleThreats:threatened?sampleThreats:undefined});
test('approaching manta sends the school into the arcade, then releases it without penetration or teleporting',()=>{
 const reacting=create(),control=create(false);let prior:Snapshot|undefined;
 try{for(let frame=0;frame<=180*12;frame++){
  const t=frame/12;reacting.update(1/12,t);control.update(1/12,t);
  const a=reacting.getDebug() as Snapshot,b=control.getDebug() as Snapshot;
  if(prior)a.fusilier.agents.forEach((f,i)=>assert.ok(Math.hypot(...f.position.map((v,j)=>v-prior!.fusilier.agents[i].position[j]))<.1,'refuge movement stays continuous'));
  if(t===40){assert.ok(a.fusilier.meanAlarm>.9);assert.ok(a.fusilier.agents.filter(f=>f.position[0]<2.7).length>b.fusilier.agents.filter(f=>f.position[0]<2.7).length+20,'fish retreat inside the posts instead of just contracting in the road');}
  if(t===130)assert.ok(a.fusilier.meanAlarm<.01,'alarm settles after the animal leaves');
  assert.equal(a.fusilier.actualPenetrations+a.chromis.actualPenetrations,0);prior=a;
 }}finally{reacting.dispose();control.dispose();}
});
test('encounter sampling is fixed-step and pause-safe',()=>{
 const a=create(),b=create();try{
  a.update(0,0);b.update(0,0);for(let i=1;i<=60*30;i++)a.update(1/30,i/30);b.update(60,60);
  const {interpolation:ai,...astate}=a.getDebug() as Snapshot & {interpolation:number};const {interpolation:bi,...bstate}=b.getDebug() as Snapshot & {interpolation:number};assert.ok(Math.abs(ai-bi)<1e-9);assert.deepEqual(astate,bstate);const before=b.getDebug();b.update(10,60);assert.deepEqual(b.getDebug(),before);
 }finally{a.dispose();b.dispose();}
});
