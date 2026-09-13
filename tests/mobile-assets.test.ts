import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,rmSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=join(root,'.mobile-public');
const hash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');

test('mobile asset preparation creates the Seaward-only offline public set with an inspectable eight-scene inventory',()=>{
  rmSync(output,{recursive:true,force:true});
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
  }finally{rmSync(output,{recursive:true,force:true});}
});
