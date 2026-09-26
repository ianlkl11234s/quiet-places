import test from 'node:test';
import assert from 'node:assert/strict';
import {seawardDaylight} from '../src/places/seaward/Daylight.ts';
import {sampleTime} from '../src/systems/TimeOfDay.ts';
test('seaward light crosses the opening and uses weaker cool moonlight at night',()=>{
 const morning=seawardDaylight(sampleTime(7)),noon=seawardDaylight(sampleTime(12)),evening=seawardDaylight(sampleTime(17.5));
 assert.ok(morning.sun.x<0&&evening.sun.x>0);assert.ok(noon.sun.y>morning.sun.y&&noon.sun.y>evening.sun.y);
 const night=seawardDaylight(sampleTime(23));
 assert.equal(night.solar,0);assert.ok(night.direct>0&&night.direct<noon.direct);
 assert.ok(night.tint.b>night.tint.r);assert.ok(night.sun.y>0&&night.sun.z<0);
 assert.equal(seawardDaylight(sampleTime(12)).moonlight,0);
 assert.equal(seawardDaylight(sampleTime(19)).moonlight,0);
 assert.equal(noon.direct,1);
 assert.ok(evening.tint.b<noon.tint.b);
 assert.deepEqual(seawardDaylight(sampleTime(0)),seawardDaylight(sampleTime(24)));
});

test('seaward sky warms at dusk, darkens blue at night and stays below white at noon',()=>{
 const noon=seawardDaylight(sampleTime(12)),dusk=seawardDaylight(sampleTime(17.5)),night=seawardDaylight(sampleTime(23));
 const luma=(c:{r:number;g:number;b:number})=>.2126*c.r+.7152*c.g+.0722*c.b;
 assert.ok(dusk.horizon.r>dusk.horizon.b,'dusk horizon is warm, not neutral grey');
 assert.ok(noon.horizon.b>noon.horizon.r&&luma(noon.horizon)<.56,'noon horizon stays cool and below the former flat grey');
 assert.ok(night.horizon.b>night.horizon.r*1.8&&night.zenith.b>night.zenith.r,'night sky is blue');
 assert.ok(luma(night.horizon)<luma(noon.horizon)*.12,'night sky is its own dark, not a scaled day sky');
 assert.ok(luma(noon.zenith)<luma(noon.horizon));
});
