import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {prepareMedaka} from '../src/places/afterlight/Medaka.ts';
import {prepareMedaka as prepareSharedMedaka} from '../src/shared/biology/medaka/Medaka.ts';
import {createMedakaRoute} from '../src/shared/biology/medaka/MedakaMotion.ts';
import {collectModelResources} from '../src/shared/resources/ModelResources.ts';

async function loadAsset() {
  const bytes=await readFile(new URL('../public/models/medaka.glb',import.meta.url));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}

const tailBones=['Spine_01','Spine_02','Spine_03','Spine_04','Spine_05','Peduncle','Tail_Base','Tail_Tip'];
function tangent(phase:number, progress:number) { const s=progress,theta=phase-Math.PI*2*.9*s,amplitude=.035*.65;return Math.atan(amplitude*(2.2*s**1.2*Math.sin(theta)-Math.PI*2*.9*s**2.2*Math.cos(theta))); }
function expectClipParity(scene:THREE.Object3D, clip:THREE.AnimationClip, time:number, pectoralBases:Map<string,THREE.Quaternion>) {
  const mixer=new THREE.AnimationMixer(scene);mixer.clipAction(clip).play();mixer.setTime(time);const phase=Math.PI*2*2*time;let previous=0;
  tailBones.forEach((name,index)=>{const current=tangent(phase,index/(tailBones.length-1)),expected=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),current-previous),bone=scene.getObjectByName(name) as THREE.Bone;assert.ok(bone.quaternion.angleTo(expected)<.0015,`${name} matches runtime tail pose at ${time}s`);previous=current;});
  const fin=.20*Math.sin(phase);for(const [name,sign] of [['Pectoral_L',1],['Pectoral_R',-1]] as const){const expected=pectoralBases.get(name)!.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),fin*sign)),bone=scene.getObjectByName(name) as THREE.Bone;assert.ok(bone.quaternion.angleTo(expected)<.005,`${name} matches runtime pectoral pose at ${time}s`);}
}

function motionResponse(url: string): Response {
  if(url.endsWith('.json'))return Response.json({duration:120,fps:1,frameCount:121,fishCount:26,stride:12,states:['LOCAL_CRUISE'],fish:Array.from({length:26},(_,index)=>({length:(.03+index%4*.005)*1.2,colorVariant:index%4,motionPhase:index,motionSeed:index})),events:[]});
  const values=new Float32Array(121*26*12);
  for(let frame=0;frame<=120;frame++)for(let index=0;index<26;index++){
    const offset=(frame*26+index)*12;
    values.set([-.5+index*.035,.28+(index%3)*.03,-.7,0,0,0,1,.04,frame*.31+index,.12,0,.03],offset);
  }
  return new Response(values.buffer);
}

test('real medaka GLB creates 26 small independently skinned fish with deterministic bone poses and one-time release',async()=>{
  const gltf=await loadAsset(),originalLoad=GLTFLoader.prototype.loadAsync,originalFetch=globalThis.fetch;
  GLTFLoader.prototype.loadAsync=async()=>gltf;
  globalThis.fetch=(async(input: string|URL|Request)=>motionResponse(String(input))) as typeof fetch;
  try{
    let master: THREE.SkinnedMesh|undefined;gltf.scene.traverse(object=>{if(!master&&object instanceof THREE.SkinnedMesh&&object.name.startsWith('Medaka_Master'))master=object;});
    assert.ok(master?.isSkinnedMesh,'master is an actual skinned mesh');
    gltf.scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(gltf.scene);
    assert.ok(bounds.max.z-bounds.min.z>=.03&&bounds.max.z-bounds.min.z<=.045,'original master remains 3–4.5 cm; clone scale owns the requested enlargement');
    const clip=gltf.animations.find(animation=>animation.name==='MEDAKA_ACT_INPLACE_SWIM_1S');assert.ok(clip,'master includes the in-place 2 Hz swim clip');
    const pectoralBases=new Map(['Pectoral_L','Pectoral_R'].map(name=>[name,(gltf.scene.getObjectByName(name) as THREE.Bone).quaternion.clone()]));
    expectClipParity(gltf.scene,clip,0,pectoralBases);expectClipParity(gltf.scene,clip,.125,pectoralBases);
    const mixer=new THREE.AnimationMixer(gltf.scene);mixer.clipAction(clip).play();mixer.setTime(0);gltf.scene.updateMatrixWorld(true);master.skeleton.update();
    const vertex=new THREE.Vector3(),restZ=Array.from({length:master.geometry.attributes.position.count},(_,index)=>master.getVertexPosition(index,vertex).applyMatrix4(master.matrixWorld).z),minZ=Math.min(...restZ),maxZ=Math.max(...restZ),low=new Float64Array(restZ.length).fill(Infinity),high=new Float64Array(restZ.length).fill(-Infinity);
    for(let time=0;time<1;time+=1/30){mixer.setTime(time);gltf.scene.updateMatrixWorld(true);master.skeleton.update();for(let index=0;index<restZ.length;index++){const x=master.getVertexPosition(index,vertex).applyMatrix4(master.matrixWorld).x;low[index]=Math.min(low[index],x);high[index]=Math.max(high[index],x);}}
    let headRange=0,tailRange=0;for(let index=0;index<restZ.length;index++){const progress=(restZ[index]-minZ)/(maxZ-minZ),range=high[index]-low[index];if(progress<.15)headRange=Math.max(headRange,range);if(progress>.75)tailRange=Math.max(tailRange,range);}assert.ok(tailRange>.0005,`tail has real skinned propulsion (${tailRange}m)`);assert.ok(headRange/tailRange<.25,`head/tail excursion ratio is restrained (${headRange/tailRange})`);
    const resources=collectModelResources(gltf.scene),disposals=new Map<THREE.BufferGeometry,number>();
    resources.geometries.forEach(geometry=>{disposals.set(geometry,0);geometry.addEventListener('dispose',()=>disposals.set(geometry,disposals.get(geometry)!+1));});
    const factory=await prepareMedaka(),parent=new THREE.Group(),shoal=factory(parent);
    assert.equal(shoal.root.parent,parent);assert.equal(shoal.root.children.length,26);
    const first=shoal.root.getObjectByName('medaka-1')!,second=shoal.root.getObjectByName('medaka-2')!;
    assert.notEqual(first.getObjectByName('Tail_Tip'),second.getObjectByName('Tail_Tip'),'each clone has an independent skeleton');
    const poses=()=>{const values:number[]=[];shoal.root.traverse(object=>{if((object as THREE.Bone).isBone)values.push(...object.quaternion.toArray());});return values;};
    shoal.update(12,1);const frozen=poses();shoal.update(12,1);assert.deepEqual(poses(),frozen,'same elapsed restores the exact tail pose');
    shoal.update(13,1);assert.notDeepEqual(poses(),frozen,'absolute phase animates at a new elapsed time');
    let minLength=Infinity,maxLength=0;shoal.root.traverse(object=>{if(object instanceof THREE.Mesh){assert.equal(object.castShadow,true);assert.equal(object.receiveShadow,true);}if(!object.name.startsWith('medaka-'))return;const box=new THREE.Box3().setFromObject(object);minLength=Math.min(minLength,box.max.z-box.min.z);maxLength=Math.max(maxLength,box.max.z-box.min.z);});
    assert.ok(minLength>.03&&maxLength<.06,`runtime fish retain centimetre scale (${minLength}–${maxLength}m)`);
    shoal.dispose();shoal.dispose();factory.dispose();assert.equal(parent.children.length,0);disposals.forEach(count=>assert.equal(count,1));
  }finally{GLTFLoader.prototype.loadAsync=originalLoad;globalThis.fetch=originalFetch;}
});

test('shared medaka factory gives a studio route consumer independent rig ownership',async()=>{
  const gltf=await loadAsset(),originalLoad=GLTFLoader.prototype.loadAsync;
  GLTFLoader.prototype.loadAsync=async()=>gltf;
  try {
    const route=createMedakaRoute([new THREE.Vector3(0,.4,0),new THREE.Vector3(.4,.45,-.2),new THREE.Vector3(0,.5,-.6)],{speed:.1});
    const factory=await prepareSharedMedaka(),parent=new THREE.Group();
    const first=factory.create(parent,{route,phaseOffsetSeconds:0,name:'studio-medaka-1'});
    const second=factory.create(parent,{route,phaseOffsetSeconds:route.duration/2,name:'studio-medaka-2'});
    first.update(2);second.update(2);
    assert.notEqual(first.root.getObjectByName('Tail_Tip'),second.root.getObjectByName('Tail_Tip'),'studio agents clone skeletons');
    assert.ok(first.root.children[0].position.distanceTo(second.root.children[0].position)>.02,'agents update through their own route offsets');
    first.dispose();second.dispose();factory.dispose();assert.equal(parent.children.length,0);
  } finally { GLTFLoader.prototype.loadAsync=originalLoad; }
});

test('Afterlight releases the shared GLB when its motion cache fails to load',async()=>{
  const gltf=await loadAsset(),originalLoad=GLTFLoader.prototype.loadAsync,originalFetch=globalThis.fetch;
  const disposals=new Map<THREE.BufferGeometry,number>();
  collectModelResources(gltf.scene).geometries.forEach(geometry=>{disposals.set(geometry,0);geometry.addEventListener('dispose',()=>disposals.set(geometry,disposals.get(geometry)!+1));});
  GLTFLoader.prototype.loadAsync=async()=>gltf;
  globalThis.fetch=(async()=>{throw new Error('motion unavailable');}) as typeof fetch;
  try {
    await assert.rejects(prepareMedaka(),/motion unavailable/);
    disposals.forEach(count=>assert.equal(count,1,'shared source is released after motion load failure'));
  } finally { GLTFLoader.prototype.loadAsync=originalLoad;globalThis.fetch=originalFetch; }
});

test('shared factory rejects an invalid agent length before cloning resources',async()=>{
  const gltf=await loadAsset(),originalLoad=GLTFLoader.prototype.loadAsync;
  const disposals=new Map<THREE.BufferGeometry,number>();
  collectModelResources(gltf.scene).geometries.forEach(geometry=>{disposals.set(geometry,0);geometry.addEventListener('dispose',()=>disposals.set(geometry,disposals.get(geometry)!+1));});
  GLTFLoader.prototype.loadAsync=async()=>gltf;
  try {
    const route=createMedakaRoute([new THREE.Vector3(),new THREE.Vector3(.2,0,0),new THREE.Vector3(.1,0,-.2)]),factory=await prepareSharedMedaka(),parent=new THREE.Group();
    assert.throws(()=>factory.create(parent,{route,length:NaN}),/positive number/);
    assert.equal(parent.children.length,0);disposals.forEach(count=>assert.equal(count,0,'invalid input did not allocate or dispose a clone'));
    factory.dispose();disposals.forEach(count=>assert.equal(count,1));
  } finally { GLTFLoader.prototype.loadAsync=originalLoad; }
});
