import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultStudy,validateStudy,validateStudyAssets,sameOpening,STUDY_ASSET_PATHS} from '../src/shared/production/StudyPreset.ts';
import {createDrainGeometry} from '../src/shared/geometry/DrainGeometry.ts';
import geometry from '../assets/config/afterlight-geometry.json' with {type:'json'};
test('portable study rejects incompatible scene/assets and nonfinite parameters',()=>{
 const p=validateStudy(defaultStudy);p.assets=Object.fromEntries(STUDY_ASSET_PATHS.map(path=>[path,'a'.repeat(64)]));validateStudyAssets(p,p.assets);
 for(const change of [(x:any)=>x.schemaVersion=2,(x:any)=>x.sceneId='oceanlight',(x:any)=>x.route.points=[[0,0,0]],(x:any)=>x.light.exposure=Infinity,(x:any)=>x.audio.track=1.5]){const invalid=structuredClone(p);change(invalid);assert.throws(()=>validateStudy(invalid));}
 assert.throws(()=>validateStudyAssets(p,{'models/medaka.glb':'b'.repeat(64)}));
 const copy=validateStudy(p);copy.route.points[0][0]=.8;assert.notEqual(copy.route.points[0][0],p.route.points[0][0]);
});
test('studio candidate opening shares the production geometry validator and keeps roundoff neutral',()=>{
 const base=structuredClone(defaultStudy),copy=structuredClone(base);copy.opening.depth=1.0999999999999999;assert.ok(sameOpening(base,copy));copy.opening.depth=.8;assert.ok(!sameOpening(base,copy));
 const config=structuredClone(geometry);config.primaryOpening.minX=config.primaryOpening.maxX-copy.opening.depth;const candidate=createDrainGeometry(config);assert.equal(candidate.opening.minX,.8999999999999999);assert.ok(candidate.isOpen(candidate.rainOrigin(.3,.6).x,candidate.rainOrigin(.3,.6).z));
});
