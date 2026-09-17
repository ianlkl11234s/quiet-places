import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,rmSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {assetVersionFor} from '../scripts/mobile-assets.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=join(root,'.mobile-public');
const downloads=join(root,'.mobile-downloads');
const hash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');

const expectedInventory={
  waterlight:['models/long-fin-koi-school.glb'],
  leaflight:['models/leaflight-study.glb','textures/leaflight/room-indirect.exr','models/koi.glb'],
  oceanlight:['models/stingray.glb'],
  afterlight:['models/afterlight-courtyard.glb','textures/afterlight/room-indirect.exr','models/medaka.glb','models/medaka-motion.json','models/medaka-motion.bin'],
  seaward:['models/stingray.glb'],
  stairlight:['models/stairlight.glb','textures/stairlight/room-indirect.exr','models/stairlight-rear.glb','textures/stairlight-rear/room-indirect.exr','models/blacktip-shark.glb'],
  snowwindow:[],snowhall:[],
};

const loaderSources:{path:string;assets:string[]}[]=[
  {path:'src/places/waterlight/FishSchool.ts',assets:['/models/long-fin-koi-school.glb']},
  {path:'src/places/leaflight/index.ts',assets:['/models/leaflight-study.glb','/textures/leaflight/room-indirect.exr']},
  {path:'src/places/leaflight/Koi.ts',assets:['/models/koi.glb']},
  {path:'src/places/oceanlight/Stingrays.ts',assets:['/models/stingray.glb']},
  {path:'src/places/afterlight/index.ts',assets:['/models/afterlight-courtyard.glb','/textures/afterlight/room-indirect.exr']},
  {path:'src/shared/biology/medaka/Medaka.ts',assets:['/models/medaka.glb']},
  {path:'src/shared/biology/medaka/MedakaMotion.ts',assets:['/models/medaka-motion.json','/models/medaka-motion.bin']},
  {path:'src/places/seaward/Stingray.ts',assets:['/models/stingray.glb']},
  {path:'src/places/stairlight/index.ts',assets:['/models/${asset}.glb','/textures/${asset}/room-indirect.exr','/models/blacktip-shark.glb']},
];

test('mobile asset preparation creates the Seaward-only offline public set with an inspectable eight-scene inventory',()=>{
  rmSync(output,{recursive:true,force:true});rmSync(downloads,{recursive:true,force:true});
  try{
    execFileSync(process.execPath,['scripts/mobile-assets.mjs'],{cwd:root,encoding:'utf8'});
    const manifest=JSON.parse(readFileSync(join(output,'mobile-assets.manifest.json'),'utf8'));
    assert.equal(manifest.pilot.sceneId,'seaward');
    assert.equal(manifest.pilot.status,'bundled-for-iphone-pilot-only');
    assert.deepEqual(Object.keys(manifest.inventory).sort(),['afterlight','leaflight','oceanlight','seaward','snowhall','snowwindow','stairlight','waterlight']);
    assert.equal(manifest.sharedAudio.length,8);
    assert.deepEqual(manifest.inventory.snowhall,[],'snowhall active runtime uses procedural AntarcticLife, not its retained stingray history');
    assert.deepEqual(manifest.files.map((file:{path:string})=>file.path).sort(),['models/stingray.glb',...manifest.sharedAudio].sort());
    for(const file of manifest.files){const path=join(output,file.path);assert.ok(existsSync(path));assert.equal(statSync(path).size,file.bytes);assert.equal(hash(path),file.sha256);}
    assert.ok(!existsSync(join(output,'models','stairlight.glb')));
  }finally{rmSync(output,{recursive:true,force:true});rmSync(downloads,{recursive:true,force:true});}
});

test('room manifests contain every loader dependency and a complete local download payload',()=>{
  rmSync(output,{recursive:true,force:true});rmSync(downloads,{recursive:true,force:true});
  try{
    execFileSync(process.execPath,['scripts/mobile-assets.mjs'],{cwd:root,encoding:'utf8'});
    const manifests=JSON.parse(readFileSync(join(output,'room-manifests.json'),'utf8'));
    const downloaded=JSON.parse(readFileSync(join(downloads,'room-manifests.json'),'utf8'));
    const config=JSON.parse(readFileSync(join(root,'assets/config/mobile-assets.json'),'utf8'));
    assert.equal(manifests.schemaVersion,1);assert.equal(manifests.appSchemaVersion,1);
    assert.deepEqual(manifests,downloaded,'bundle and local download use the same immutable manifest contract');
    assert.deepEqual(config.inventory,expectedInventory,'inventory follows every current public loader, including stairlight query variants');
    for(const loader of loaderSources){
      const source=readFileSync(join(root,loader.path),'utf8');
      for(const asset of loader.assets)assert.ok(source.includes(asset),`${loader.path} loader is covered by the inventory: ${asset}`);
    }
    assert.equal(manifests.rooms.length,8);
    for(const room of manifests.rooms){
      assert.equal(room.schemaVersion,1);assert.equal(room.appSchemaVersion,1);
      assert.match(room.assetVersion,/^sha256-[a-f0-9]{16}$/);
      assert.deepEqual(room.files.map((file:{path:string})=>file.path),expectedInventory[room.roomId as keyof typeof expectedInventory]);
      assert.deepEqual(room.sharedAssets,config.sharedAudio);
      assert.equal(room.provenance,config.provenance[room.roomId]);
      assert.equal(room.licenseStatus,config.licenseStatus);
      const resolved=[...room.files,...manifests.sharedFiles];
      assert.equal(room.totalBytes,resolved.reduce((total:number,file:{bytes:number})=>total+file.bytes,0));
      for(const file of resolved){const path=join(downloads,file.path);assert.ok(existsSync(path),`${room.roomId} dependency is downloadable: ${file.path}`);assert.equal(statSync(path).size,file.bytes);assert.equal(hash(path),file.sha256);}
    }
    assert.ok(!existsSync(join(output,'models','afterlight-courtyard.glb')),'unbundled rooms remain outside the pilot app');
  }finally{rmSync(output,{recursive:true,force:true});rmSync(downloads,{recursive:true,force:true});}
});

test('room assetVersion changes when a shared asset hash changes',()=>{
  const roomFiles=[{path:'models/stingray.glb',bytes:100,sha256:'a'.repeat(64)}];
  const shared=[{path:'audio/submerged-sunlight.m4a',bytes:200,sha256:'b'.repeat(64)}];
  const changedShared=[{...shared[0],sha256:'c'.repeat(64)}];
  assert.notEqual(assetVersionFor(roomFiles,shared),assetVersionFor(roomFiles,changedShared));
});
