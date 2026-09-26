import test from 'node:test';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {A7_CAMERA_CLEAR,A7_CLIMB_PITCH,A7_KEEP_ROLL,A7_TURN_BANK,TUNNEL_MAX_BANK,prepareTunnelRay,sampleTunnelFlight,tunnelAttitude,tunnelFinClock,tunnelTravel} from '../src/places/seaward/Stingray.ts';

function fixture(){
  const root=new THREE.Group(),bone=new THREE.Bone();bone.name='fin';
  const geometry=new THREE.PlaneGeometry(1,1,1,1),material=new THREE.MeshStandardMaterial();
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(16),4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],4));
  const mesh=new THREE.SkinnedMesh(geometry,material);
  mesh.add(bone);mesh.bind(new THREE.Skeleton([bone]));root.add(mesh);
  const clip=new THREE.AnimationClip('SRAY_ACT_SLOW_CRUISE',2,[new THREE.VectorKeyframeTrack('fin.position',[0,1,2],[0,0,0,0,.1,0,0,0,0])]);
  return {root,geometry,material,clip};
}

test('tunnel ray follows a deterministic low ellipse and releases GLB resources once',async()=>{
  const {root,geometry,material,clip}=fixture(),old=GLTFLoader.prototype.loadAsync;
  GLTFLoader.prototype.loadAsync=async()=>({scene:root,animations:[clip]}) as never;
  try{
    let geometryDisposals=0,materialDisposals=0;
    geometry.addEventListener('dispose',()=>geometryDisposals++);material.addEventListener('dispose',()=>materialDisposals++);
    const factory=await prepareTunnelRay(),group=new THREE.Group(),ray=factory(group);
    for(let elapsed=0;elapsed<180;elapsed+=.25){
      ray.update(elapsed);const carrier=group.getObjectByName('tunnel-stingray')!;
      // Q2-A7 moves the route centre .5 m toward -x (away from the view axis).
      assert.ok(carrier.position.x>=-1.850001&&carrier.position.x<=1.600001);
      assert.ok(carrier.position.y>=.299999&&carrier.position.y<=1.2);
      assert.ok(carrier.position.z>=-8.000001&&carrier.position.z<=-2.999999);
    }
    ray.update(17.25);const carrier=group.getObjectByName('tunnel-stingray')!,position=carrier.position.clone(),rotation=carrier.quaternion.clone();
    ray.update(17.25);assert.deepEqual(carrier.position.toArray(),position.toArray());assert.ok(carrier.quaternion.angleTo(rotation)<1e-7);
    const forward=new THREE.Vector3(0,0,1).applyQuaternion(carrier.quaternion);
    assert.ok(forward.length()> .99999,'the +Z model forward axis is carried along the route');
    const fin=carrier.getObjectByName('fin') as THREE.Bone,finAtFirstTime=fin.position.y;
    ray.update(17.75);assert.notEqual(fin.position.y,finAtFirstTime,'the slow cruise clip advances with distance swum');
    ray.dispose();ray.dispose();factory.dispose();
    assert.equal(group.children.length,0);assert.equal(geometryDisposals,1);assert.equal(materialDisposals,1);
  }finally{GLTFLoader.prototype.loadAsync=old;}
});

test('factory releases unused resources once',async()=>{
  const {root,geometry,material,clip}=fixture(),old=GLTFLoader.prototype.loadAsync;
  GLTFLoader.prototype.loadAsync=async()=>({scene:root,animations:[clip]}) as never;
  try{
    let geometryDisposals=0,materialDisposals=0;
    geometry.addEventListener('dispose',()=>geometryDisposals++);material.addEventListener('dispose',()=>materialDisposals++);
    const factory=await prepareTunnelRay();factory.dispose();factory.dispose();
    assert.equal(geometryDisposals,1);assert.equal(materialDisposals,1);
  }finally{GLTFLoader.prototype.loadAsync=old;}
});

test('missing slow cruise is rejected and releases the loaded template',async()=>{
  const {root,geometry,material}=fixture(),old=GLTFLoader.prototype.loadAsync;
  GLTFLoader.prototype.loadAsync=async()=>({scene:root,animations:[]}) as never;
  try{
    let geometryDisposals=0,materialDisposals=0;
    geometry.addEventListener('dispose',()=>geometryDisposals++);material.addEventListener('dispose',()=>materialDisposals++);
    await assert.rejects(prepareTunnelRay(),/SRAY_ACT_SLOW_CRUISE/);
    assert.equal(geometryDisposals,1);assert.equal(materialDisposals,1);
  }finally{GLTFLoader.prototype.loadAsync=old;}
});


test('actual stingray skin stays above the floor through a full turning route',async()=>{
 const bytes=await readFile(new URL('../public/models/stingray.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const old=GLTFLoader.prototype.loadAsync;GLTFLoader.prototype.loadAsync=async()=>gltf;
 try{
  const factory=await prepareTunnelRay(),group=new THREE.Group(),ray=factory(group),bounds=new THREE.Box3();
  let maximumLift=0;
  for(let t=0;t<90;t+=.125){
   ray.update(t);group.updateMatrixWorld(true);
   const model=group.getObjectByName('tunnel-stingray-model')!;
   bounds.setFromObject(model,true);assert.ok(bounds.min.y>=.0799,`floor clearance at ${t}: ${bounds.min.y}`);
   maximumLift=Math.max(maximumLift,group.getObjectByName('tunnel-stingray')!.position.y);
  }
  assert.ok(maximumLift>.55,'turning poses lift above the previous route');
  ray.dispose();
 }finally{GLTFLoader.prototype.loadAsync=old;}
});


test('flight rises, holds level and descends; the user-specified roll is kept by default',()=>{
 assert.equal(A7_TURN_BANK,1);assert.equal(A7_KEEP_ROLL,1);
 assert.ok(sampleTunnelFlight(14).height>sampleTunnelFlight(11).height);
 for(const t of [16,18,20,22,24,26])assert.ok(Math.abs(sampleTunnelFlight(t).height-1.1)<1e-9);
 assert.ok(sampleTunnelFlight(29).height<sampleTunnelFlight(27).height);
 assert.ok(Math.abs(sampleTunnelFlight(33).height-.545)<1e-9);
 const period=2*Math.PI/.14;
 assert.ok(Math.abs(sampleTunnelFlight(period-.001).height-sampleTunnelFlight(period+.001).height)<1e-8);
 // Default keeps the accepted 16–24 s roll; the Q2-A7 candidate (0) drops it.
 assert.equal(sampleTunnelFlight(15).roll,0);assert.equal(sampleTunnelFlight(24).roll,Math.PI*2);
 for(let t=0;t<period;t+=.1)assert.equal(sampleTunnelFlight(t,0).roll,0,`no roll at ${t} with the candidate`);
});

test('turns bank with yaw rate, capped near 25 degrees (Q2-A7)',()=>{
 const period=2*Math.PI/.14;let maxBank=0,maxRate=0;
 for(let t=0;t<period;t+=.05){
  const {bank,yawRate}=tunnelAttitude(t);
  assert.ok(Math.abs(bank)<=TUNNEL_MAX_BANK+1e-12);
  assert.ok(Math.sign(bank)===-Math.sign(yawRate),'bank leans into the turn');
  maxBank=Math.max(maxBank,Math.abs(bank));maxRate=Math.max(maxRate,Math.abs(yawRate));
  const numeric=(tunnelAttitude(t+.01).yaw-tunnelAttitude(t-.01).yaw);
  const wrapped=Math.atan2(Math.sin(numeric),Math.cos(numeric))/.02;
  assert.ok(Math.abs(wrapped-yawRate)<.01,`analytic yaw rate matches heading at ${t}`);
 }
 const deg=maxBank*180/Math.PI;
 assert.ok(deg>=20&&deg<=25,`peak bank ${deg}°`);
 // Gentle stretches stay nearly level.
 assert.ok(Math.abs(tunnelAttitude(.5*Math.PI/.14).bank)*180/Math.PI<3);
});

test('nose lifts 10–20 degrees while rising (Q2-A7)',()=>{
 assert.equal(A7_CLIMB_PITCH,1);
 let maxUp=0,maxDown=0;
 for(let t=10;t<15;t+=.05)maxUp=Math.max(maxUp,tunnelAttitude(t).pitch);
 for(let t=27;t<33;t+=.05)maxDown=Math.min(maxDown,tunnelAttitude(t).pitch);
 const up=maxUp*180/Math.PI,down=maxDown*180/Math.PI;
 assert.ok(up>=10&&up<=20,`rise pitch ${up}°`);
 assert.ok(down<0&&down>=-20,`descent pitch ${down}°`);
 for(const t of [5,20,40])assert.ok(Math.abs(tunnelAttitude(t).pitch)<1e-9,'level flight is level');
});

test('route keeps the body off the camera view axis (Q2-A7)',async()=>{
 // Camera from src/places/seaward/index.ts (position / target).
 assert.equal(A7_CAMERA_CLEAR,1);
 const {root,clip}=fixture(),old=GLTFLoader.prototype.loadAsync;
 GLTFLoader.prototype.loadAsync=async()=>({scene:root,animations:[clip]}) as never;
 try{
  const eye=new THREE.Vector3(2.6,1.35,2.8),axis=new THREE.Vector3(-1.6,1.5,-11).sub(eye).normalize();
  const factory=await prepareTunnelRay(),group=new THREE.Group(),ray=factory(group),carrier=group.getObjectByName('tunnel-stingray')!;
  let clearance=Infinity;
  for(let t=0;t<2*Math.PI/.14;t+=.05){
   ray.update(t);const offset=carrier.position.clone().sub(eye);
   clearance=Math.min(clearance,offset.sub(axis.clone().multiplyScalar(offset.dot(axis))).length());
  }
  // Half-span .60 m (1.34 m × .9 scale / 2) plus .4 m margin; the accepted route reached .62 m.
  assert.ok(clearance>=1.0,`view-axis clearance ${clearance.toFixed(3)} m`);
  ray.dispose();factory.dispose();
 }finally{GLTFLoader.prototype.loadAsync=old;}
});

test('fin clock follows distance swum, not a fixed elapsed clock',()=>{
 const period=2*Math.PI/.14;
 // Mean cadence over a lap equals the former elapsed clock.
 assert.ok(Math.abs(tunnelFinClock(period)-period)<1e-6);
 assert.ok(Math.abs(tunnelFinClock(3*period)-3*period)<1e-5);
 // Monotonic and pure: the same elapsed always gives the same phase.
 let previous=tunnelFinClock(0);
 for(let t=.05;t<2*period;t+=.05){const now=tunnelFinClock(t);assert.ok(now>previous);previous=now;}
 assert.equal(tunnelFinClock(37.3),tunnelFinClock(37.3));
 assert.equal(tunnelTravel(Number.NaN),0);
 // Level cruise at the fast (phase=3π/2, after descent) and slow (phase≈0) ends of the ellipse.
 const speed=(t:number)=>.14*Math.hypot(.45*Math.cos(.14*t),1.5*Math.sin(.14*t));
 const fast=1.5*Math.PI/.14,slow=period-1,dt=.25;
 const advanceFast=tunnelFinClock(fast+dt)-tunnelFinClock(fast-dt),advanceSlow=tunnelFinClock(slow+dt)-tunnelFinClock(slow-dt);
 const ratio=advanceFast/advanceSlow,expected=speed(fast)/speed(slow);
 assert.ok(ratio>2.5,'fast stretch beats clearly faster');
 assert.ok(Math.abs(ratio/expected-1)<.02,`cadence ratio ${ratio} vs speed ratio ${expected}`);
});
