import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {sampleOceanWave,refractRay,oceanSunDirection} from '../src/world/OceanOptics.ts';

test('wave slope equals finite-difference derivative of the rendered height',()=>{
 for(const t of [0,2.5,18])for(const x of [-3,0,4]){
  const z=-8,eps=1e-4,w=sampleOceanWave(x,z,t);
  assert.ok(Math.abs(w.dx-(sampleOceanWave(x+eps,z,t).height-sampleOceanWave(x-eps,z,t).height)/(2*eps))<1e-6);
  assert.ok(Math.abs(w.dz-(sampleOceanWave(x,z+eps,t).height-sampleOceanWave(x,z-eps,t).height)/(2*eps))<1e-6);
 }
});
test('Snell angle and Fresnel transmission at normal incidence and critical boundary',()=>{
 const normal=new THREE.Vector3(0,1,0);
 const r=refractRay(new THREE.Vector3(0,-1,0),normal,1,1.333)!;
 assert.ok(Math.abs(r.transmission-(1-((1-1.333)/(1+1.333))**2))<1e-12);
 const a=Math.PI/4,oblique=refractRay(new THREE.Vector3(Math.sin(a),-Math.cos(a),0),normal,1,1.333)!;
 assert.ok(Math.abs(oblique.direction.x-Math.sin(a)/1.333)<1e-12);
 const critical=Math.asin(1/1.333);
 for(const offset of [-1e-5,1e-5]){
  const angle=critical+offset,result=refractRay(new THREE.Vector3(Math.sin(angle),-Math.cos(angle),0),normal,1.333,1);
  assert.equal(result===null,offset>0);
 }
});
test('shared sun gives noon total reflection but permits low-evening window transmission',()=>{
 const top=new THREE.Vector3(0,1,0),pane=new THREE.Vector3(0,0,-1);
 for(const [angle,passes] of [[0,false],[.75,true]] as const){
  const water=refractRay(oceanSunDirection(angle).negate(),top,1,1.333)!;
  const glass=refractRay(water.direction,pane,1.333,1.5)!;
  const air=refractRay(glass.direction,pane,1.5,1);
  assert.equal(air!==null,passes);
 }
});
