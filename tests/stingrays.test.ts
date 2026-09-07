import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {prepareStingrays} from '../src/world/Stingrays.ts';

test('two skeletal rays animate independently, freeze and release shared model resources once',async()=>{
  const template=new THREE.Group(),bone=new THREE.Bone();bone.name='L_FIN_U01_V02';
  const tail=new THREE.Bone();tail.name='tail_01';bone.add(tail);
  const geometry=new THREE.PlaneGeometry(1,1,2,2),vertices=geometry.attributes.position.count;
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(vertices*4),4));
  const weights=new Float32Array(vertices*4);for(let i=0;i<vertices;i++)weights[i*4]=1;
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const material=new THREE.MeshStandardMaterial(),mesh=new THREE.SkinnedMesh(geometry,material);
  mesh.add(bone);mesh.bind(new THREE.Skeleton([bone,tail]));template.add(mesh);
  const animations=['SLOW_CRUISE','TURN_LEFT','TURN_RIGHT'].map(name=>new THREE.AnimationClip('SRAY_ACT_'+name,2,[new THREE.VectorKeyframeTrack(bone.name+'.position',[0,1,2],[0,0,0,0,.05,0,0,0,0])]));
  const old=GLTFLoader.prototype.loadAsync;
  GLTFLoader.prototype.loadAsync=async()=>({scene:template,animations}) as never;
  try{
    const factory=await prepareStingrays(),group=new THREE.Group();
    const volume=new THREE.Data3DTexture(new Float32Array(8),2,2,2);
    let geometryDisposals=0,materialDisposals=0,volumeDisposals=0;
    geometry.addEventListener('dispose',()=>geometryDisposals++);material.addEventListener('dispose',()=>materialDisposals++);volume.addEventListener('dispose',()=>volumeDisposals++);
    const rays=factory(group,{sun:{value:new THREE.Vector3(0,-1,1).normalize()},time:{value:0},level:{value:1.75},strength:{value:5},tint:{value:new THREE.Color('white')},volume,floor:new THREE.Texture()});
    rays.update(17);
    const first=group.getObjectByName('stingray-1')!,second=group.getObjectByName('stingray-2')!;
    assert.ok(first&&second);assert.ok(first.position.distanceTo(second.position)>1.5);
    const before=first.position.clone(),rotation=first.quaternion.clone();
    const a=first.getObjectByName(bone.name) as THREE.Bone,b=second.getObjectByName(bone.name) as THREE.Bone;
    assert.notEqual(a,b);assert.notEqual(a.position,b.position);
    const finPose=a.position.clone();assert.ok(finPose.y>0,'baked skeletal clip drives the fin');rays.update(17);
    assert.ok(first.position.equals(before)&&first.quaternion.equals(rotation));assert.ok(a.position.equals(finPose));
    rays.update(18);assert.ok(a.position.distanceTo(finPose)>1e-4,'fin animation advances');
    rays.dispose();rays.dispose();factory.dispose();
    assert.equal(group.children.length,0);assert.equal(geometryDisposals,1);assert.equal(materialDisposals,1);assert.equal(volumeDisposals,0);
    volume.dispose();
  }finally{GLTFLoader.prototype.loadAsync=old;}
});

test('shipped GLB contains weighted body and genuinely animated seamless swim clips',async()=>{
  const {readFile}=await import('node:fs/promises');
  const bytes=await readFile(new URL('../public/models/stingray.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  assert.equal(gltf.animations.length,8);
  let body:THREE.SkinnedMesh|undefined;
  gltf.scene.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh && o.parent?.name==='SRAY_Disc')body=o as THREE.SkinnedMesh;});
  assert.ok(body,'actual body is exported, not just separate details');
  const weights=body.geometry.attributes.skinWeight;
  for(let i=0;i<weights.count;i++)assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-5);
  for(const name of ['SLOW_CRUISE','TURN_LEFT','TURN_RIGHT']){
    const clip=gltf.animations.find(a=>a.name==='SRAY_ACT_'+name)!;assert.ok(clip);assert.ok(Math.abs(clip.duration-2)<1e-5);
    const fins=clip.tracks.filter(t=>t.name.includes('_FIN_'));
    assert.ok(fins.length>=56);
    let varying=false;
    for(const track of fins){const size=track.getValueSize(),v=track.values;
      for(let j=0;j<size;j++)assert.ok(Math.abs(v[j]-v[v.length-size+j])<1e-5,'loop endpoint matches');
      for(let i=size;i<v.length;i++)if(Math.abs(v[i]-v[i%size])>.001)varying=true;
    }
    assert.ok(varying,'exported animation must not be static');
  }
});
