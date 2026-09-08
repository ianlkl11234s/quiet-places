import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleAfterlightDay} from '../src/places/afterlight/DayCycle.ts';

test('Afterlight traverses dawn, high noon, dusk and moon across the full wrapped day',()=>{
 const dawn=sampleAfterlightDay(6.5),noon=sampleAfterlightDay(12),dusk=sampleAfterlightDay(17.5);
 assert.ok(dawn.incoming[0]>.25&&dusk.incoming[0]<-.05);
 assert.ok(-noon.incoming[1]>.95&&-dawn.incoming[1]>.85&&-dusk.incoming[1]>.95);
 assert.equal(sampleAfterlightDay(0).sunStrength,0);assert.equal(sampleAfterlightDay(0).moonStrength,1);
 assert.deepEqual(sampleAfterlightDay(0),sampleAfterlightDay(24));
 let last=sampleAfterlightDay(0);
 for(let minute=1;minute<=1440;minute++){
  const now=sampleAfterlightDay(minute/60);
  assert.equal(now.incoming[2],0,'daily light travels perpendicular to the corridor');
  assert.ok(now.incoming.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...now.incoming)-1)<1e-9);
  for(const k of ['daylight','sunStrength','moonStrength'] as const)assert.ok(Math.abs(now[k]-last[k])<.06);
  assert.ok(Math.abs(now.incoming[0]-last.incoming[0])<.06,'no direction jump through twilight');
  if(now.daylight===0)assert.ok(Math.abs(now.incoming[0]/-now.incoming[1]-.28)<1e-9,'restored high moon basis');
  last=now;
 }
});

test('twilight lasts four hours',()=>{
 assert.equal(sampleAfterlightDay(17).daylight,1);
 assert.equal(sampleAfterlightDay(19).daylight,.5);
 assert.equal(sampleAfterlightDay(21).daylight,0);
});
