import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {corridor,drainOpening,oppositeDrainOpening,drainSlats,drainBraces} from '../src/places/afterlight/DrainOpening.ts';

test('editable drain export and runtime share aperture and metal-bar locations',()=>{
 const metadata=JSON.parse(readFileSync(new URL('../public/models/afterlight-courtyard.metadata.json',import.meta.url),'utf8'));
 assert.deepEqual(metadata.aperture.x,[drainOpening.minX,drainOpening.maxX]);
 assert.deepEqual(metadata.aperture.z,[drainOpening.minZ,drainOpening.maxZ]);
 metadata.secondaryAperture.x.forEach((x:number,i:number)=>assert.ok(Math.abs(x-[oppositeDrainOpening.minX,oppositeDrainOpening.maxX][i])<1e-9));
 assert.deepEqual(metadata.secondaryAperture.z,metadata.aperture.z);
 const area=(drainOpening.maxX-drainOpening.minX)*(drainOpening.maxZ-drainOpening.minZ);
 assert.ok(area<=1.15*1.3*.5,'each opening at most half the previous area');
 assert.ok(Math.abs((drainOpening.maxX-drainOpening.minX)-(drainOpening.maxZ-drainOpening.minZ))<1e-9,'square opening');
 assert.ok(corridor.maxX-corridor.minX>3.6,'wider corridor');
 assert.deepEqual(metadata.corridorBounds.x,[corridor.minX,corridor.maxX]);
 assert.equal(metadata.corridorBounds.centerX,corridor.centerX);
 const mirror=drainSlats.map(x=>2*corridor.centerX-x).sort((a,b)=>a-b);
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
