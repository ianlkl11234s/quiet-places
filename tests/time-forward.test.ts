import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleForwardTime,sampleTime} from '../src/systems/TimeOfDay.ts';

test('named moments move forward at two seconds per interval, including midnight',()=>{
 assert.deepEqual(sampleForwardTime(6.5,12,2),{hour:12,done:true});
 assert.deepEqual(sampleForwardTime(23,12,2),{hour:6.5,done:false});
 assert.deepEqual(sampleForwardTime(23,12,4),{hour:12,done:true});
 assert.deepEqual(sampleForwardTime(17.5,12,2),{hour:23,done:false});
 assert.deepEqual(sampleForwardTime(17.5,12,4),{hour:6.5,done:false});
 assert.deepEqual(sampleForwardTime(17.5,12,6),{hour:12,done:true});
});
test('intermediate lighting follows sampled hours and never runs backwards',()=>{
 let previous=17.5;
 for(let t=0;t<=6;t+=.025){
  const {hour}=sampleForwardTime(17.5,12,t);
  assert.ok((hour-previous+24)%24<.11);
  assert.ok(Math.abs(sampleTime(hour).hour!-hour)<1e-10);
  previous=hour;
 }
 assert.ok(sampleForwardTime(23,12,1).hour<6.5);
});
test('retargeting starts from displayed time, same selection stays still, completion clamps',()=>{
 const current=sampleForwardTime(17.5,12,3).hour;
 assert.equal(sampleForwardTime(current,17.5,0).hour,current);
 assert.deepEqual(sampleForwardTime(12,12,0),{hour:12,done:true});
 assert.deepEqual(sampleForwardTime(17.5,12,100),{hour:12,done:true});
 assert.deepEqual(sampleForwardTime(23,12,-1),{hour:23,done:false});
});
