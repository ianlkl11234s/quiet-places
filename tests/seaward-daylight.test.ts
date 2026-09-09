import test from 'node:test';
import assert from 'node:assert/strict';
import {seawardDaylight} from '../src/places/seaward/Daylight.ts';
import {sampleTime} from '../src/systems/TimeOfDay.ts';
test('seaward light crosses the opening and removes direct sun at night',()=>{
 const morning=seawardDaylight(sampleTime(7)),noon=seawardDaylight(sampleTime(12)),evening=seawardDaylight(sampleTime(17.5));
 assert.ok(morning.sun.x<0&&evening.sun.x>0);assert.ok(noon.sun.y>morning.sun.y&&noon.sun.y>evening.sun.y);
 assert.equal(seawardDaylight(sampleTime(23)).direct,0);assert.equal(noon.direct,1);
 assert.ok(evening.tint.b<noon.tint.b);
 assert.deepEqual(seawardDaylight(sampleTime(0)),seawardDaylight(sampleTime(24)));
});
