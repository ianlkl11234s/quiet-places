import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import * as THREE from 'three';
import {AntarcticBehavior} from '../src/places/snowhall/AntarcticBehavior.ts';
import biology from '../assets/config/snowhall-biology.json' with {type:'json'};
import {GLASS_SQUID_SAFE_RADIUS,SILVERFISH_SAFE_RADIUS} from '../src/shared/biology/antarctic/AntarcticModels.ts';

function snapshot(model:AntarcticBehavior){const round=(value:number)=>Math.round(value*1e7)/1e7;return JSON.stringify({time:round(model.time),log:model.eventLog.map(e=>({...e,start:round(e.start),end:e.end&&round(e.end),lightPeak:round(e.lightPeak)})),agents:[...model.squids,...model.fish].map(a=>[...a.position.toArray(),...a.quaternion.toArray(),a.visible,a.speedBL].map(v=>typeof v==='number'?round(v):v))});}

test('ten full 600-second simulations keep whole-body bounds, speed caps, quiet phases and behind-camera fish release',()=>{
 assert.equal(biology.squid.safeRadiusMantleUnits,GLASS_SQUID_SAFE_RADIUS);assert.equal(biology.fish.safeRadiusBodyUnits,SILVERFISH_SAFE_RADIUS);
 const rows=[];
 for(let seed=0;seed<10;seed++){
  const model=new AntarcticBehavior(seed);let maxFishSpeed=0,maxSquidSpeed=0,minClearance=Infinity,visibleSeconds=0;
  for(let frame=0;frame<=18000;frame++){
   const before=model.fish.map(f=>f.visible);model.update(frame/30);
   const all=[...model.squids,...model.fish];
   for(const a of all){
    for(const axis of ['x','y','z'] as const){const low=a.position[axis]-a.radius-model.navBounds.min[axis],high=model.navBounds.max[axis]-a.position[axis]-a.radius;minClearance=Math.min(minClearance,low,high);assert.ok(low>=-1e-7&&high>=-1e-7,`${seed}/${frame}/${axis} entire safe sphere in nav`);}
    assert.ok(a.position.toArray().every(Number.isFinite));assert.ok(Math.abs(a.quaternion.length()-1)<1e-6);
   }
   model.squids.forEach(s=>{maxSquidSpeed=Math.max(maxSquidSpeed,s.speedBL);assert.ok(Math.abs(s.turn)<=THREE.MathUtils.degToRad(biology.squid.yawMaxDegreesPerSecond)+1e-8);});
   model.fish.forEach((f,i)=>{maxFishSpeed=Math.max(maxFishSpeed,f.speedBL);assert.ok(f.speedBL<=biology.fish.maxSpeedBL+1e-7);if(before[i]&&!f.visible)assert.ok(model.isBehindCamera(f.position,f.radius),'whole fish exits behind camera, never into a wall');if(!before[i]&&f.visible)assert.ok(model.isBehindCamera(f.position,f.radius),'new school enters from behind camera');});
   if(model.fish.some(f=>f.visible&&model.sampleLight(f.position)>.1))visibleSeconds+=1/30;
   const major=model.events.filter(e=>e.type==='SQUID_CROSS_CORRIDOR'||e.type.includes('TRANSIT'));assert.ok(major.length<=1,'major mutex');
   if(model.events.some(e=>e.type==='LONG_EMPTY_PHASE'))assert.equal(major.length,0,'explicit empty blocks major events');
  }
  assert.equal(model.time,600);
  const metrics=model.getMetrics(),transits=model.eventLog.filter(e=>e.type.includes('TRANSIT'));
  assert.ok(transits.length>=3&&transits.length<=7,`seed ${seed} fish event budget ${transits.length}`);
  assert.ok(metrics.quietRatio>=.05&&metrics.quietRatio<=.75,`seed ${seed} quiet ${metrics.quietRatio}`);
  assert.ok(metrics.brightSquidOccupancy<.12);assert.ok(model.eventLog.some(e=>e.type==='LONG_EMPTY_PHASE'));
  assert.ok(transits.every(e=>e.lightPeak>.10&&e.duration!>45&&e.duration!<220),'completed fish occupy room light and leave after a full route');
  rows.push({seed,...metrics,maxFishSpeed,maxSquidSpeed,minClearance,visibleFishSeconds:visibleSeconds,eventLog:model.eventLog});
 }
 mkdirSync(new URL('../exports/snowhall-biology/',import.meta.url),{recursive:true});
 writeFileSync(new URL('../exports/snowhall-biology/qa.json',import.meta.url),JSON.stringify({scope:'10 seeds x 600 seconds, fixed 60 Hz simulation, assertions at every 30 Hz output sample; not real-time browser observation or device evidence',rows},null,2)+'\n');
});

test('absolute time, 30/60/144 FPS, pause and fractional rewind reproduce the same poses and scheduler',()=>{
 const reference=new AntarcticBehavior(813);reference.update(120.011);const expected=snapshot(reference);
 for(const fps of [30,60,144]){const s=new AntarcticBehavior(813);for(let frame=0;frame<120*fps;frame++)s.update(frame/fps);s.update(120.011);assert.equal(snapshot(s),expected);}
 reference.update(120.011);assert.equal(snapshot(reference),expected);reference.update(3.012);reference.update(3.006);reference.update(120.011);assert.equal(snapshot(reference),expected);
});

test('light geometry and moved study camera preserve field and camera exclusion',()=>{
 const camera:[number,number,number]=[.1,1.4,-7.2],s=new AntarcticBehavior(42,{cameraPosition:camera,windowX:.25,windowWidth:1.4});
 for(let t=0;t<=180;t+=.25){s.update(t);for(const a of [...s.squids,...s.fish.filter(f=>f.visible)])assert.ok(a.position.distanceTo(new THREE.Vector3(...camera))>=a.radius+biology.navigation.cameraMargin-1e-4);}
 assert.ok(s.sampleLight(new THREE.Vector3(0,1.76,-9.5))>s.sampleLight(new THREE.Vector3(0,1.76,-4)));
 assert.equal(s.sampleLight(new THREE.Vector3(0,1.76,-12)),0);
 assert.ok(s.sampleLight(new THREE.Vector3(1.19,1.76,-8.5))<.02);assert.ok(s.sampleLight(new THREE.Vector3(-1.19,1.76,-8.5))<.02);
});


test('silverfish traverse the room depth and finish only behind the observer',()=>{
 const model=new AntarcticBehavior(20260913),depth=new Map<number,{min:number;max:number}>();let exits=0;
 for(let frame=0;frame<=220*60;frame++){
  const previous=model.fish.map(f=>({visible:f.visible,p:f.position.clone()}));model.update(frame/60);
  model.fish.forEach((f,i)=>{
   if(f.visible){const d=depth.get(i)??{min:Infinity,max:-Infinity};d.min=Math.min(d.min,f.position.z);d.max=Math.max(d.max,f.position.z);depth.set(i,d);
    if(previous[i].visible)assert.ok(f.position.distanceTo(previous[i].p)<=f.scale*biology.fish.maxSpeedBL/60+1e-5,'movement is continuous through foreground');}
   if(previous[i].visible&&!f.visible){exits++;assert.ok(model.isBehindCamera(f.position,f.radius));assert.ok(depth.get(i)!.min< -4&&depth.get(i)!.max> .5,'travels deep into corridor and back');}
  });
 }
 assert.ok(exits>=14,'entire first school completes a physical round trip');
});


test('silverfish are the sole cast, vary entry lanes and perform real middle holds and circles',()=>{
 const model=new AntarcticBehavior(20260913);let circleAngle=0,previousAngle:number|undefined,holdSamples=0;
 for(let frame=0;frame<=600*30;frame++){
  model.update(frame/30);assert.equal(model.squids.length,0);
  assert.ok(Number.isFinite(model.getMetrics().maxSpeedBL));
  const event=model.events.find(e=>e.type.includes('TRANSIT')),fish=model.fish[0];
  if(!event||!fish.visible)continue;
  if(event.routeMode==='CIRCLE'){
   const center=event.routeCenter!,p=fish.position;
   if(Math.abs(p.z-center[2])<1.35){const angle=Math.atan2((p.z-center[2])/.95,p.x/.62);if(previousAngle!==undefined)circleAngle+=Math.atan2(Math.sin(angle-previousAngle),Math.cos(angle-previousAngle));previousAngle=angle;}
  }else previousAngle=undefined;
  if(event.routeMode==='MID_HOVER'&&fish.speedBL<.25&&fish.position.z< -3.5)holdSamples++;
 }
 const events=model.eventLog.filter(e=>e.type.includes('TRANSIT'));
 assert.deepEqual(new Set(events.map(e=>e.routeMode)),new Set(['MEANDER','MID_HOVER','CIRCLE']));
 assert.ok(Math.abs(circleAngle)>5,'actual fish executes an orbit, not merely a named event');
 assert.ok(holdSamples/30>5,'actual middle hold slows without freezing tail motion');
 assert.ok(new Set(events.map(e=>e.entrySide)).size===2,'both left and right entry lanes used');
 assert.ok(Math.max(...events.map(e=>e.entryHeight!))-Math.min(...events.map(e=>e.entryHeight!))>.2,'entry heights vary');
 for(let i=1;i<events.length;i++)assert.ok(events[i].start-events[i-1].end!<40,'brief gaps keep silverfish central');
});
