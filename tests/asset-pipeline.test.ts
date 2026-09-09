import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const repo=fileURLToPath(new URL('../',import.meta.url));
const script=fileURLToPath(new URL('../scripts/asset-pipeline.py',import.meta.url));
const blender='/Applications/Blender.app/Contents/MacOS/Blender';

test('asset recipe registry names both isolated pilot contracts',()=>{
 const data=JSON.parse(readFileSync(new URL('../assets/config/asset-recipes.json',import.meta.url),'utf8'));
 assert.equal(data.schemaVersion,1);
 assert.deepEqual(data.recipes.map((recipe:{id:string})=>recipe.id),['afterlight-drain','medaka-master']);
 for(const name of ['asset-recipe.schema.json','asset-manifest.schema.json'])assert.equal(JSON.parse(readFileSync(new URL('../assets/config/'+name,import.meta.url),'utf8')).properties.schemaVersion.const,1);
 assert.ok(JSON.parse(readFileSync(new URL('../assets/config/asset-manifest.schema.json',import.meta.url),'utf8')).required.includes('recipeRegistry'));
});

test('pipeline rejects an unknown recipe before it creates an output',()=>{
 const output=mkdtempSync(join(tmpdir(),'quiet-places-pipeline-failure-'));
 rmSync(output,{recursive:true,force:true});
 const result=spawnSync('python3',[script,'preflight','--recipe','not-a-recipe','--blender',blender],{cwd:repo,encoding:'utf8'});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/unknown recipe/);
 assert.equal(existsSync(output),false);
});

test('GLB accessor and node-transform readback rejects a corrupted frame location',()=>{
 const output=mkdtempSync(join(tmpdir(),'quiet-places-pipeline-readback-'));
 mkdirSync(join(output,'models'));mkdirSync(join(output,'config'));
 const glb=join(output,'models','afterlight-courtyard.glb'),metadata=join(output,'models','afterlight-courtyard.metadata.json');
 copyFileSync(fileURLToPath(new URL('../public/models/afterlight-courtyard.glb',import.meta.url)),glb);
 const record=JSON.parse(readFileSync(new URL('../public/models/afterlight-courtyard.metadata.json',import.meta.url),'utf8'));record.geometryContract={path:'assets/config/afterlight-geometry.json',schemaVersion:1};writeFileSync(metadata,JSON.stringify(record));
 copyFileSync(fileURLToPath(new URL('../assets/config/afterlight-geometry.json',import.meta.url)),join(output,'config','afterlight-geometry.json'));
 const healthy=spawnSync('python3',[script,'readback','--recipe','afterlight-drain','--output-dir',output],{cwd:repo,encoding:'utf8'});
 assert.equal(healthy.status,0,healthy.stderr);
 const bytes=readFileSync(glb),from=Buffer.from('0.6200000047683716'),to=Buffer.from('0.9200000047683716'),offset=bytes.indexOf(from);
 assert.ok(offset>=0,'fixture must contain the west-frame translation');to.copy(bytes,offset);writeFileSync(glb,bytes);
 const corrupted=spawnSync('python3',[script,'readback','--recipe','afterlight-drain','--output-dir',output],{cwd:repo,encoding:'utf8'});
 assert.notEqual(corrupted.status,0);
 assert.match(corrupted.stderr,/DrainGrate_Frame_West x/);
 rmSync(output,{recursive:true,force:true});
});
