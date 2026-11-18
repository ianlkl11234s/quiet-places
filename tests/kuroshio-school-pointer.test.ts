import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createArcadeSchools} from '../src/systems/schooling/index.ts';
import {arcadeObstacles} from '../src/places/last-arcade/biology/Obstacles.ts';
import {ARCADE_SCHOOL_POINTER_RESPONSE} from '../src/places/last-arcade/biology/index.ts';

// Arcade small schools notice the pointer ray (ARCADE_SCHOOL_POINTER_RESPONSE); B4 switches at their defaults.
const obstacles=arcadeObstacles(),eye=new THREE.Vector3(4.4,1.6,4);
type Dbg={chromis:{state:string;events:number;actualPenetrations:number;agents:{position:number[]}[]};fusilier:{state:string;events:number;actualPenetrations:number;agents:{position:number[]}[]};windows:{penetrations:number}[];candidates:{pointerStartles:number}};
const centroid=(agents:{position:number[]}[])=>{const c=new THREE.Vector3();for(const a of agents)c.add(new THREE.Vector3(...a.position));return c.divideScalar(agents.length);};
const rayTo=(t:THREE.Vector3)=>new THREE.Ray(eye.clone(),t.clone().sub(eye).normalize());
const make=(pointerResponse=ARCADE_SCHOOL_POINTER_RESPONSE)=>createArcadeSchools({seed:91626,obstacles,pointerResponse});

test('response 0 makes pointerRay a no-op',()=>{
 const a=make(0),b=make(0);
 for(let i=0;i<=30*12;i++){const d=a.getDebug() as Dbg;a.pointerRay(rayTo(centroid(d.fusilier.agents)),i%50===0);a.update(1/12,i/12);b.update(1/12,i/12);}
 assert.deepEqual(a.getDebug(),b.getDebug());a.dispose();b.dispose();
});

test('a tap near a school triggers the existing contraction once per cooldown; ignored while a manta event holds rare events',()=>{
 const s=make();s.update(0,0);for(let i=1;i<=24;i++)s.update(1/12,i/12);
 let d=s.getDebug() as Dbg;const before=d.fusilier.events;
 s.pointerRay(rayTo(centroid(d.fusilier.agents)),true);s.update(1/12,25/12);d=s.getDebug() as Dbg;
 assert.equal(d.fusilier.state,'CONTRACT');assert.equal(d.fusilier.events,before+1);const startles=d.candidates.pointerStartles;assert.ok(startles>=1&&startles<=2,'each school the ray passes contracts once');
 s.pointerRay(rayTo(centroid(d.fusilier.agents)),true);s.update(1/12,26/12);assert.equal((s.getDebug() as Dbg).candidates.pointerStartles,startles,'cooldown');
 for(let i=27;i<=12*12;i++)s.update(1/12,i/12);s.setRareEventsEnabled(false);
 s.pointerRay(rayTo(centroid((s.getDebug() as Dbg).chromis.agents)),true);s.update(1/12,145/12);assert.equal((s.getDebug() as Dbg).candidates.pointerStartles,startles,'rare events disabled');
 s.dispose();
});

test('10 minutes of a ray sweeping the arcade and periodic taps: no body penetration, finite, in bounds',()=>{
 const s=make();let near=0;
 for(let i=0;i<=600*12;i++){const t=i/12,d=s.getDebug() as Dbg;
  const target=i%240<120?centroid((i/240|0)%2?d.chromis.agents:d.fusilier.agents):new THREE.Vector3(1+.8*Math.sin(t*.5),1.2+.8*Math.sin(t*.3),-8+7*Math.sin(t*.11));
  s.pointerRay(rayTo(target),i%96===0);s.update(1/12,t);if(i%1200===0)s.pointerRay(undefined,false);if(i%96===0)near++;}
 const d=s.getDebug() as Dbg;s.dispose();
 assert.equal(d.chromis.actualPenetrations+d.fusilier.actualPenetrations,0);assert.ok(d.windows.every(w=>w.penetrations===0));
 assert.ok(d.candidates.pointerStartles>=5,`startles=${d.candidates.pointerStartles}`);
 for(const a of [...d.chromis.agents,...d.fusilier.agents]){assert.ok(a.position.every(Number.isFinite));assert.ok(a.position[0]>=.08&&a.position[0]<=8.75&&a.position[1]>=.18&&a.position[1]<=2.7&&a.position[2]>=-27.8&&a.position[2]<=.7);}
});

test('a moving ray gently parts nearby fusiliers and never contracts the school by itself',()=>{
 const a=make(),b=make();let near=0,control=0;
 const dist=(p:number[],r:THREE.Ray)=>r.distanceToPoint(new THREE.Vector3(...p));
 for(let i=0;i<=40*12;i++){const t=i/12,c=centroid((a.getDebug() as Dbg).fusilier.agents).add(new THREE.Vector3(.3*Math.sin(t*1.3),.15*Math.cos(t),0)),ray=rayTo(c);
  a.pointerRay(ray,false);a.update(1/12,t);b.update(1/12,t);
  if(i%6===0){for(const f of (a.getDebug() as Dbg).fusilier.agents)if(dist(f.position,ray)<.3)near++;for(const f of (b.getDebug() as Dbg).fusilier.agents)if(dist(f.position,ray)<.3)control++;}}
 const d=a.getDebug() as Dbg;a.dispose();b.dispose();console.log(JSON.stringify({near,control}));
 assert.equal(d.candidates.pointerStartles,0);assert.ok(near<control*.85&&near>control*.2,`${near} vs ${control}`);
});
