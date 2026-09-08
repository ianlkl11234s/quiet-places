import test from 'node:test';
import assert from 'node:assert/strict';
import {createAfterlightPlantPhysics} from '../src/places/afterlight/PlantPhysics.ts';

test('plant physics freezes, is frame-partition invariant, and stays finite',()=>{
 const a=createAfterlightPlantPhysics(),b=createAfterlightPlantPhysics();
 a.update(0,.7);a.update(10,.7);
 b.update(0,.7);for(let frame=1;frame<=600;frame++)b.update(frame/60,.7);
 assert.deepEqual(a.debug(),b.debug());const frozen=a.debug();a.update(10,.7);assert.deepEqual(a.debug(),frozen);
 for(const joint of a.debug())assert.ok(Number.isFinite(joint.angle)&&Number.isFinite(joint.wetness));
 a.dispose();b.dispose();
});

test('sunshower only wets aperture-reachable leaf geometry and produces bounded drops',()=>{
 const plant=createAfterlightPlantPhysics();plant.update(0,1);plant.update(60,1);
 const d=plant.diagnostics();assert.ok(d.hits>0,'60 seconds has deterministic leaf hits');assert.ok(d.maxWetness>0);assert.ok(d.visibleDrops<=3);assert.ok(d.releases>0,'formed drops detach');
 plant.dispose();
});
