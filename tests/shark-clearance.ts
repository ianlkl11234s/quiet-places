import * as THREE from 'three';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {readFileSync} from 'node:fs';
import {createShark} from '../src/places/stairlight/Shark.ts';
const bytes=readFileSync('public/models/blacktip-shark.glb');
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const shark=createShark(gltf.scene,true),point=new THREE.Vector3();
const worst={wall:Infinity,floor:Infinity,rail:Infinity};const times={wall:0,floor:0,rail:0};
let count=0;
for(let t=0;t<600;t+=.2){
 shark.update(t,.9);shark.root.updateMatrixWorld(true);
 shark.root.traverse(o=>{
  if(!(o instanceof THREE.SkinnedMesh))return;o.skeleton.update();
  for(let i=0;i<o.geometry.attributes.position.count;i++){
   o.getVertexPosition(i,point);point.applyMatrix4(o.matrixWorld);count++;
   const {x,y,z}=point;
   const wall=Math.min(x+1.679,1.25-x,z+1.1,4.1-z,5-y);
   let floor=-2;
   if(z<0)floor=0;
   else if(z>=2.8){if(x<-.479)floor=1.75;else if(x>-.139)floor=-1.75;}
   else if(z<2.8){if(x<-.479)floor=Math.ceil(z/.28)*.175;else if(x>-.139)floor=-Math.floor(z/.28)*.175;}
   const clearance=y-floor;
   let rail=Infinity;
   if(z>=0&&z<=2.8){
    for(const [rx,ry] of [[-.479,.88+.625*z],[-.139,.88-.625*z]])rail=Math.min(rail,Math.hypot(x-rx,y-ry)-.035);
   }
   if(z<0&&z>-.3)rail=Math.min(rail,Math.hypot(Math.hypot(x+.309,z+.1)-.17,y-.88)-.035);
   for(const [key,val] of Object.entries({wall,floor:clearance,rail})){if(val<worst[key as keyof typeof worst]){worst[key as keyof typeof worst]=val;times[key as keyof typeof times]=t;}}
  }
 });
}
console.log(JSON.stringify({count,worst,times,durationSeconds:600,sampleStepSeconds:.2,scope:'all skinned vertices; analytic wall/tread/handrail envelopes, not swept-volume collision'},null,2));shark.dispose();
assert.ok(worst.wall>.03&&worst.floor>.015&&worst.rail>.05,'shark must clear architecture envelopes');
