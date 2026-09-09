import test from 'node:test';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {prepareTunnelRay,sampleTunnelFlight} from '../src/places/seaward/Stingray.ts';

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
      assert.ok(carrier.position.x>=-1.600001&&carrier.position.x<=1.600001);
      assert.ok(carrier.position.y>=.299999&&carrier.position.y<=1.2);
      assert.ok(carrier.position.z>=-8.000001&&carrier.position.z<=-2.999999);
    }
    ray.update(17.25);const carrier=group.getObjectByName('tunnel-stingray')!,position=carrier.position.clone(),rotation=carrier.quaternion.clone();
    ray.update(17.25);assert.deepEqual(carrier.position.toArray(),position.toArray());assert.ok(carrier.quaternion.angleTo(rotation)<1e-7);
    const forward=new THREE.Vector3(0,0,1).applyQuaternion(carrier.quaternion);
    assert.ok(forward.length()> .99999,'the +Z model forward axis is carried along the route');
    const fin=carrier.getObjectByName('fin') as THREE.Bone,finAtFirstTime=fin.position.y;
    ray.update(17.75);assert.notEqual(fin.position.y,finAtFirstTime,'the original slow cruise clip uses absolute elapsed time');
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
  for(let t=0;t<46;t+=.125){
   ray.update(t);group.updateMatrixWorld(true);
   const model=group.getObjectByName('tunnel-stingray-model')!;
   bounds.setFromObject(model,true);assert.ok(bounds.min.y>=.0799,`floor clearance at ${t}: ${bounds.min.y}`);
   maximumLift=Math.max(maximumLift,group.getObjectByName('tunnel-stingray')!.position.y);
  }
  assert.ok(maximumLift>.55,'turning poses lift above the previous route');
  ray.dispose();
 }finally{GLTFLoader.prototype.loadAsync=old;}
});


test('flight rises before rolling and stays level until the roll has settled',()=>{
 assert.equal(sampleTunnelFlight(10).roll,0);
 assert.ok(sampleTunnelFlight(14).height>sampleTunnelFlight(11).height);
 assert.equal(sampleTunnelFlight(15).roll,0);
 for(const t of [16,18,20,22,24,26])assert.ok(Math.abs(sampleTunnelFlight(t).height-1.1)<1e-9);
 assert.equal(sampleTunnelFlight(24).roll,Math.PI*2);
 assert.ok(sampleTunnelFlight(29).height<sampleTunnelFlight(27).height);
 assert.ok(Math.abs(sampleTunnelFlight(33).height-.545)<1e-9);
 const period=2*Math.PI/.14;
 assert.ok(Math.abs(sampleTunnelFlight(period-.001).height-sampleTunnelFlight(period+.001).height)<1e-8);
});
