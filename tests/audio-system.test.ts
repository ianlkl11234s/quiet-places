import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAudioSystem} from '../src/systems/AudioSystem.ts';

test('leaving while audio resume is pending cannot re-enable sound',async()=>{
 let finishResume!:()=>void;const gainValues:number[]=[];
 const parameter=()=>({value:0,setTargetAtTime:(value:number)=>gainValues.push(value),cancelScheduledValues:()=>{},setValueAtTime:(value:number)=>gainValues.push(value)});
 class FakeContext{
  sampleRate=1;currentTime=0;destination={};
  createGain(){return {gain:parameter(),connect:()=>{}};}
  createBuffer(){return {getChannelData:()=>new Float32Array(8)};}
  createBufferSource(){return {connect:()=>{},start:()=>{}};}
  createBiquadFilter(){return {frequency:parameter(),connect:()=>{}};}
  createOscillator(){return {frequency:parameter(),connect:()=>{},start:()=>{}};}
  resume(){return new Promise<void>(resolve=>{finishResume=resolve;});}
  suspend(){return Promise.resolve();}close(){return Promise.resolve();}
 }
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'AudioContext');
 Object.defineProperty(globalThis,'AudioContext',{value:FakeContext,configurable:true});
 try{
  const audio=createAudioSystem();const pending=audio.toggle();audio.stop();finishResume();
  assert.equal(await pending,false);assert.deepEqual(gainValues,[0]);
  const explicitRestart=audio.toggle();finishResume();assert.equal(await explicitRestart,true);
  assert.equal(gainValues.at(-1),.055);await audio.dispose();
 }finally{if(descriptor)Object.defineProperty(globalThis,'AudioContext',descriptor);else Reflect.deleteProperty(globalThis,'AudioContext');}
});
