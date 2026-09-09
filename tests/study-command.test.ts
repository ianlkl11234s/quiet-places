import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {defaultStudy,STUDY_ASSET_PATHS,type StudyPreset} from '../src/shared/production/StudyPreset.ts';

const script=new URL('../scripts/study.mjs',import.meta.url).pathname;
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const writeJson=(file:string,value:unknown)=>writeFileSync(file,`${JSON.stringify(value,null,2)}\n`);

function fixture(){
 const root=mkdtempSync(join(tmpdir(),'quiet-places-study-'));
 mkdirSync(join(root,'assets/config'),{recursive:true});
 const preset=structuredClone(defaultStudy) as StudyPreset;
 preset.baselineRevision='baseline-fixture-1';preset.assets={};
 for(const [index,path] of STUDY_ASSET_PATHS.entries()){
  const asset=Buffer.from(`afterlight fixture asset ${index}`),file=join(root,'public',path);
  mkdirSync(join(file,'..'),{recursive:true});writeFileSync(file,asset);preset.assets[path]=hash(asset);
 }
 writeJson(join(root,'assets/config/afterlight-study.json'),preset);
 writeJson(join(root,'assets/config/afterlight-geometry.json'),{schemaVersion:1,primaryOpening:{minX:.6,maxX:1.7,minZ:-1.13,maxZ:.37,roofY:3}});
 return {root,preset};
}

function run(root:string,args:string[],expect=0){
 const result=spawnSync(process.execPath,['--experimental-strip-types',script,...args,'--root',root],{encoding:'utf8'});
 assert.equal(result.status,expect,`${result.stdout}\n${result.stderr}`);
 return result;
}

test('study validates current assets, stages immutable evidence, then applies and rolls back a non-geometry candidate', () => {
 const {root,preset}=fixture();preset.light.exposure=1.4;
 const input=join(root,'candidate.json'),output=join(root,'stages');writeJson(input,preset);
 run(root,['validate','--input',input]);
 const publicBefore=readFileSync(join(root,'public/models/afterlight-courtyard.glb'));
 const staged=JSON.parse(run(root,['stage','--input',input,'--output-dir',output]).stdout) as {stageDir:string};
 const receipt=JSON.parse(readFileSync(join(staged.stageDir,'receipt.json'),'utf8'));
 assert.equal(receipt.geometryChanged,false);
 assert.ok(receipt.previewSnapshotFields.includes('audio.volume'),'listener volume remains a preview preference');
 assert.deepEqual(receipt.runtimeConfigFields,['light.overrideSun','light.azimuth','light.elevation','light.intensityScale','light.exposure','light.beam','route','audio.track','audio.loop','audio.fadeSeconds']);
 assert.deepEqual(readFileSync(join(root,'public/models/afterlight-courtyard.glb')),publicBefore,'stage never changes public assets');
 run(root,['apply','--input',staged.stageDir],1);
 run(root,['apply','--input',staged.stageDir,'--reason','fixed comparison showed a calmer exposure']);
 assert.equal(JSON.parse(readFileSync(join(root,'assets/config/afterlight-study.json'),'utf8')).light.exposure,1.4);
 run(root,['rollback','--input',staged.stageDir]);
 assert.equal(JSON.parse(readFileSync(join(root,'assets/config/afterlight-study.json'),'utf8')).light.exposure,1.25);
});

test('study refuses applying an opening change and refuses rollback over a different installed file', () => {
 const {root,preset}=fixture();preset.opening.width=1.2;
 const changed=join(root,'changed.json'),output=join(root,'stages');writeJson(changed,preset);
 const staged=JSON.parse(run(root,['stage','--input',changed,'--output-dir',output]).stdout) as {stageDir:string};
 run(root,['apply','--input',staged.stageDir,'--reason','opening test'],1);

 const safe=fixture();safe.preset.light.beam=1.1;const input=join(safe.root,'candidate.json');writeJson(input,safe.preset);
 const accepted=JSON.parse(run(safe.root,['stage','--input',input,'--output-dir',join(safe.root,'stages')]).stdout) as {stageDir:string};
 run(safe.root,['apply','--input',accepted.stageDir,'--reason','adopt beam']);
 writeFileSync(join(safe.root,'assets/config/afterlight-study.json'),'externally changed\n');
  run(safe.root,['rollback','--input',accepted.stageDir],1);
});

test('an accepted experiment supplies the required adoption reason', () => {
 const {root,preset}=fixture();preset.light.beam=1.2;
 const experiment=join(root,'experiment.json');writeJson(experiment,{decision:'accepted',reason:'user selected the softer beam after comparison',candidate:preset});
 const staged=JSON.parse(run(root,['stage','--input',experiment,'--output-dir',join(root,'stages')]).stdout) as {stageDir:string};
 run(root,['apply','--input',staged.stageDir]);
 assert.equal(JSON.parse(readFileSync(join(root,'assets/config/afterlight-study.json'),'utf8')).light.beam,1.2);
});

test('study rejects a subset asset list and preserves the wall-side geometry anchor in a staged override', () => {
 const subset=fixture();subset.preset.assets={'models/afterlight-courtyard.glb':subset.preset.assets['models/afterlight-courtyard.glb']};
 const subsetInput=join(subset.root,'subset.json');writeJson(subsetInput,subset.preset);
 run(subset.root,['validate','--input',subsetInput],1);

 const aligned=fixture();aligned.preset.opening.depth=.8;
 const input=join(aligned.root,'aligned.json');writeJson(input,aligned.preset);
 const staged=JSON.parse(run(aligned.root,['stage','--input',input,'--output-dir',join(aligned.root,'stages')]).stdout) as {stageDir:string};
 const geometry=JSON.parse(readFileSync(join(staged.stageDir,'geometry.override.json'),'utf8'));
 assert.equal(geometry.primaryOpening.maxX,1.7,'wall-side x remains fixed');
 assert.ok(Math.abs(geometry.primaryOpening.minX-.9)<1e-12,'room-facing x follows candidate depth');
});

test('pending experiment retains source provenance and offers validation without adoption', () => {
 const {root,preset}=fixture();preset.light.exposure=1.15;
 const input=join(root,'pending.json');writeJson(input,{candidate:preset,decision:'pending',reason:'independent trial',sourceRevision:'abc123',sourceDirty:true});
 const result=JSON.parse(run(root,['stage','--input',input,'--output-dir',join(root,'stages')]).stdout);
 const receipt=JSON.parse(readFileSync(join(result.stageDir,'receipt.json'),'utf8'));
 assert.equal(receipt.experiment.sourceRevision,'abc123');assert.equal(receipt.experiment.sourceDirty,true);
 const guide=readFileSync(join(result.stageDir,'experiment.md'),'utf8');
 const command=guide.match(/`(node [^`]*study.mjs validate [^`]*)`/)?.[1];assert.ok(command,'a pending candidate must have a read-only reproduction command');
 execFileSync('/bin/sh',['-c',command],{cwd:new URL('..',import.meta.url).pathname});
 assert.equal(JSON.parse(readFileSync(join(root,'assets/config/afterlight-study.json'),'utf8')).light.exposure,1.25);
});
