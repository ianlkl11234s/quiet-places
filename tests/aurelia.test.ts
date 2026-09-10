import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAurelia,createAureliaDynamics,measureAureliaMarginLoop,sampleAureliaKinematics,validateAureliaTopology} from '../src/shared/biology/aurelia/index.ts';

const preset={diameter:.30,frequency:.38,phase:.13,seed:41};

test('Aurelia builds a closed shallow bell with the required named anatomy',()=>{
  const jelly=createAurelia(preset);
  const bell=jelly.group.getObjectByName('aurelia-closed-bell') as THREE.Mesh;
  assert.ok(bell?.geometry.index?.count);
  assert.deepEqual(validateAureliaTopology(bell.geometry),{valid:true,maxIndex:bell.geometry.getAttribute('position').count-1,triangleCount:bell.geometry.index!.count/3});
  assert.equal(jelly.group.children.filter(child=>child.name.startsWith('aurelia-oral-arm-')).length,4);
  assert.equal(jelly.group.getObjectByName('aurelia-internal-anatomy')!.children.filter(child=>child.name.startsWith('aurelia-gonad-')).length,4);
  assert.equal(jelly.group.getObjectByName('aurelia-internal-anatomy')!.children.filter(child=>/^aurelia-radial-canal-\d+$/.test(child.name)).length,16);
  assert.equal(jelly.group.getObjectByName('aurelia-internal-anatomy')!.children.filter(child=>child.name.includes('-branch-')).length,16);
  assert.equal(jelly.group.getObjectByName('aurelia-rhopalia-regions-8')!.children.length,8);
  assert.equal(jelly.group.getObjectByName('aurelia-marginal-tentacles-128')!.type,'LineSegments');
  assert.equal(jelly.group.userData.localForward,'+Z apex / propulsion');
  jelly.dispose();
});

test('Aurelia pulse uses fast contraction, slower relaxation, and activity changes amplitude without phase jumps',()=>{
  const early=sampleAureliaKinematics(.13,preset,1),later=sampleAureliaKinematics(.60,preset,1);
  assert.ok(early.contractionRate>0);
  assert.ok(later.contractionRate<0);
  const idle=sampleAureliaKinematics(2.4,preset,0),active=sampleAureliaKinematics(2.4,preset,1);
  assert.equal(idle.phase,active.phase);
  assert.equal(idle.contraction,0);
});

test('fixed-step flexible margin has a real hysteretic rollout and sector turn asymmetry',()=>{
  const dynamics=createAureliaDynamics(preset);
  let response=0;
  for(let t=0;t<2.5;t+=1/120)response=dynamics.update(t,{turn:.8,turnDirection:Math.PI*.25,activity:1});
  assert.equal(response.sectorMarginResponse.length,8);
  assert.notEqual(response.sectorMarginResponse[0],response.sectorMarginResponse[4]);
  assert.ok(response.sectorOnset.some(value=>value<0));
  assert.ok(response.sectorOnset.some(value=>value>0));
  const relaxed=dynamics.update(2.9,{activity:1});
  assert.ok(relaxed.passiveEnergyRecapture>=0);
  assert.ok(Number.isFinite(relaxed.marginVertical));
});

test('Aurelia updates stable topology and leaves its root trajectory untouched',()=>{
  const jelly=createAurelia(preset),position=jelly.group.position.clone();
  const bell=jelly.group.getObjectByName('aurelia-closed-bell') as THREE.Mesh;
  const indexCount=bell.geometry.index!.count,vertexCount=bell.geometry.getAttribute('position').count;
  jelly.update(1.2,{turn:.4,turnDirection:0,activity:1,relativeFlow:new THREE.Vector3(.01,0,0)});
  assert.deepEqual(jelly.group.position.toArray(),position.toArray());
  assert.equal(bell.geometry.index!.count,indexCount);
  assert.equal(bell.geometry.getAttribute('position').count,vertexCount);
  assert.ok((bell.geometry.getAttribute('normal') as THREE.BufferAttribute).count===vertexCount);
  jelly.dispose();
});

test('Aurelia fixed-step appendage simulation is repeat-safe and frame-partition invariant',()=>{
  const a=createAurelia(preset),b=createAurelia(preset);
  a.update(1,{activity:1});
  for(let t=1/30;t<=1+1e-9;t+=1/30)b.update(t,{activity:1});
  const lineA=a.group.getObjectByName('aurelia-marginal-tentacles-128') as THREE.LineSegments;
  const lineB=b.group.getObjectByName('aurelia-marginal-tentacles-128') as THREE.LineSegments;
  assert.deepEqual(Array.from((lineA.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array),Array.from((lineB.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array));
  const before=Array.from((lineA.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array);a.update(1,{activity:1});
  assert.deepEqual(Array.from((lineA.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array),before);
  a.dispose();b.dispose();
});

test('Aurelia margin QA measures a nonzero loop from actual geometry and a larger outer response',()=>{
  const qa=measureAureliaMarginLoop(preset,96);
  assert.ok(qa.area>0);
  assert.ok(qa.outerDisplacement>qa.innerDisplacement);
});

test('relative flow and moving pulse anchors drive actual appendage vertices, not just diagnostics',()=>{
 const calm=createAurelia(preset),flow=createAurelia(preset);
 for(let frame=0;frame<=90;frame++){calm.update(frame/30);flow.update(frame/30,{relativeFlow:new THREE.Vector3(.01,0,0)});}
 const positions=(j:ReturnType<typeof createAurelia>)=>Array.from(((j.group.getObjectByName('aurelia-oral-arm-0') as THREE.Mesh).geometry.getAttribute('position') as THREE.BufferAttribute).array);
 const a=positions(calm),b=positions(flow);assert.ok(a.some((n,i)=>Math.abs(n-b[i])>1e-6));
 const before=positions(flow);flow.update(3,{relativeFlow:new THREE.Vector3(.01,0,0)});assert.deepEqual(positions(flow),before);calm.dispose();flow.dispose();
});
