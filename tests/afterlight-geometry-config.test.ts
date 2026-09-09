import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDrainGeometry} from '../src/shared/geometry/DrainGeometry.ts';
import {corridor,drainBraces,drainIsOpen,drainOpening,drainRainOrigin,drainSlats,oppositeDrainOpening} from '../src/places/afterlight/DrainOpening.ts';

const config=JSON.parse(readFileSync(new URL('../assets/config/afterlight-geometry.json',import.meta.url),'utf8'));

test('Afterlight runtime derives opening and grate positions from the versioned geometry contract',()=>{
 assert.equal(config.schemaVersion,1);
 assert.equal(config.units,'metres');
 assert.deepEqual(corridor,config.corridor);
 assert.deepEqual(drainOpening,{...config.primaryOpening,frame:config.grate.frame,edgeInset:config.grate.edgeInset,rainInset:config.grate.rainInset,slatWidth:config.grate.slatWidth,braceWidth:config.grate.braceWidth});
 const spaced=(low:number,high:number,count:number)=>Array.from({length:count},(_,i)=>low+(i+1)*(high-low)/(count+1));
 assert.deepEqual(drainSlats,spaced(drainOpening.minX+config.grate.edgeInset,drainOpening.maxX-config.grate.edgeInset,config.grate.slatCount));
 assert.deepEqual(drainBraces,spaced(drainOpening.minZ+config.grate.edgeInset,drainOpening.maxZ-config.grate.edgeInset,config.grate.braceCount));
 assert.equal(oppositeDrainOpening.minX,2*corridor.centerX-drainOpening.maxX);
 assert.equal(oppositeDrainOpening.maxX,2*corridor.centerX-drainOpening.minX);
});

test('rain sampling remains inside a derived open grate cell',()=>{
 for(const [u,v] of [[0,0],[.13,.72],[.999999,.999999]] as const){
  const point=drainRainOrigin(u,v);
  assert.equal(drainIsOpen(point.x,point.z),true);
 }
});

test('shared drain helper validates a studio candidate before it can be previewed',()=>{
 const candidate=structuredClone(config);
 candidate.grate.frame=-.01;
 assert.throws(()=>createDrainGeometry(candidate),/Invalid drain grate dimensions/);
});
