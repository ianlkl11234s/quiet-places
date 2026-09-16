import test from 'node:test';
import assert from 'node:assert/strict';
import {ArcadeAnimalMotion} from '../src/places/last-arcade/biology/Motion.ts';

test('manta strokes remain continuous through initial cycles and later cruise',()=>{
 const motion=new ArcadeAnimalMotion();let previous=motion.sample(0);
 for(let frame=1;frame<=60*90;frame++){
  const current=motion.sample(frame/60);
  for(let i=0;i<3;i++){
   assert.equal(current[i].glide,0);
   // First frame has the existing single fixed-step interpolation latency.
   if(frame>4){const hz=(current[i].phase-previous[i].phase)*60/(Math.PI*2);assert.ok(hz>.22&&hz<.37,`manta ${i}: ${hz} Hz at ${frame/60}s`);}
  }
  previous=current;
 }
 assert.ok(!motion.events.some(event=>event.type==='GLIDE'&&event.id.startsWith('manta')));
 const paused=motion.sample(90);assert.deepEqual(motion.sample(90),paused);
});
