import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {drainOpening,oppositeDrainOpening,drainSlats,drainBraces} from '../src/places/afterlight/DrainOpening.ts';

test('editable drain export and runtime share aperture and metal-bar locations',()=>{
 const metadata=JSON.parse(readFileSync(new URL('../public/models/afterlight-courtyard.metadata.json',import.meta.url),'utf8'));
 assert.deepEqual(metadata.aperture.x,[drainOpening.minX,drainOpening.maxX]);
 assert.deepEqual(metadata.aperture.z,[drainOpening.minZ,drainOpening.maxZ]);
 assert.deepEqual(metadata.secondaryAperture.x,[oppositeDrainOpening.minX,oppositeDrainOpening.maxX]);
 assert.deepEqual(metadata.secondaryAperture.z,metadata.aperture.z);
 const mirror=drainSlats.map(x=>-x).sort((a,b)=>a-b);
 metadata.secondaryDrainGrate.slatX.forEach((x:number,i:number)=>assert.ok(Math.abs(x-mirror[i])<1e-9));
 assert.deepEqual(metadata.secondaryDrainGrate.braceZ,metadata.drainGrate.braceZ);
 metadata.drainGrate.slatX.forEach((x:number,i:number)=>assert.ok(Math.abs(x-drainSlats[i])<1e-9));
 metadata.drainGrate.braceZ.forEach((z:number,i:number)=>assert.ok(Math.abs(z-drainBraces[i])<1e-9));
 const glb=readFileSync(new URL('../public/models/afterlight-courtyard.glb',import.meta.url));
 const scene=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
 const nodes=scene.nodes as {name?:string;mesh?:number}[];
 assert.equal(nodes.filter(n=>n.name?.startsWith('DrainRoof_')).length,1);
 assert.equal(nodes.filter(n=>n.name?.startsWith('DrainGrate_')).length,30);
 assert.equal(nodes.filter(n=>n.name==='Camera_Hero').length,1);
 for(const node of nodes.filter(n=>n.name?.startsWith('DrainGrate_'))){
  for(const primitive of scene.meshes[node.mesh!].primitives){
   const material=scene.materials[primitive.material];
   assert.ok(!material.emissiveFactor||material.emissiveFactor.every((v:number)=>v===0));
  }
 }
});
