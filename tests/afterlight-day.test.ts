import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleAfterlightDay} from '../src/places/afterlight/DayCycle.ts';

test('Afterlight traverses dawn, high noon, dusk and moon across the full wrapped day',()=>{
 const dawn=sampleAfterlightDay(6.5),noon=sampleAfterlightDay(12),dusk=sampleAfterlightDay(17.5);
 assert.ok(dawn.incoming[2]>.8&&dusk.incoming[2]<-.8);
 assert.ok(-noon.incoming[1]>.95&&-dawn.incoming[1]<.2);
 assert.equal(sampleAfterlightDay(0).sunStrength,0);assert.equal(sampleAfterlightDay(0).moonStrength,1);
 assert.deepEqual(sampleAfterlightDay(0),sampleAfterlightDay(24));
 let last=sampleAfterlightDay(0);
 for(let minute=1;minute<=1440;minute++){
  const now=sampleAfterlightDay(minute/60);
  assert.ok(now.incoming.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...now.incoming)-1)<1e-9);
  for(const k of ['daylight','sunStrength','moonStrength'] as const)assert.ok(Math.abs(now[k]-last[k])<.06);
  if(Math.abs(now.incoming[2]-last.incoming[2])>1)assert.ok(now.sunStrength+now.moonStrength===0&&last.sunStrength+last.moonStrength===0);
  last=now;
 }
});
