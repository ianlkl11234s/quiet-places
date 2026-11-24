import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createSardineSchools,sardineObstacles,SARDINE_BOUNDS} from '../src/places/seabridge/Sardines.ts';
import {VIEWS} from '../src/places/seabridge/Layout.ts';
import {createPointerState,notePointer,pointerWeight,rayDistance} from '../src/systems/schooling/candidates.ts';

// B1b: sardines notice the pointer ray (SARDINE_POINTER_RESPONSE). B4 switches stay at their defaults.
const eye=new THREE.Vector3(...VIEWS.user.position);
const centroid=(fish:{p:number[]}[],school:number)=>{const h=fish.length/2,g=school?fish.slice(h):fish.slice(0,h),c=new THREE.Vector3();for(const f of g)c.add(new THREE.Vector3(...f.p));return c.divideScalar(g.length);};
const rayTo=(target:THREE.Vector3)=>new THREE.Ray(eye.clone(),target.clone().sub(eye).normalize());

test('response 0 makes pointerRay a no-op',()=>{
 const a=createSardineSchools({seed:5,count:120,pointerResponse:0}),b=createSardineSchools({seed:5,count:120,pointerResponse:0});
 for(let i=1;i<=30*12;i++){const t=i/12;const c=centroid(a.getDebug().fish,0);a.pointerRay(rayTo(c.add(new THREE.Vector3(Math.sin(t),0,0))),i%60===0);a.update(t);b.update(t);}
 assert.deepEqual(a.getDebug(),b.getDebug());a.dispose();b.dispose();
});

test('a moving ray parts nearby fish gently (no flee); the borrowed ray is copied',()=>{
 const a=createSardineSchools({seed:5,count:120}),b=createSardineSchools({seed:5,count:120});let near=0,nearControl=0;const probe=createPointerState();
 for(let i=1;i<=40*12;i++){const t=i/12;const c=centroid(a.getDebug().fish,0).add(new THREE.Vector3(.4*Math.sin(t*1.3),.2*Math.cos(t),0));const ray=rayTo(c);
  a.pointerRay(ray,false);ray.origin.set(99,99,99);ray.direction.set(1,0,0); // mutating the borrowed ray must not matter
  a.update(t+1e-9);b.update(t+1e-9);notePointer(probe,rayTo(c),false,t);
  if(i%6===0){for(const f of a.getDebug().fish.slice(0,60))if(rayDistance(probe,f.p[0],f.p[1],f.p[2])<.25)near++;for(const f of b.getDebug().fish.slice(0,60))if(rayDistance(probe,f.p[0],f.p[1],f.p[2])<.25)nearControl++;}}
 const d=a.getDebug();a.dispose();b.dispose();
 assert.equal(d.candidates.pointerStartles,0,'moving alone never startles');
 console.log(JSON.stringify({near,nearControl}));assert.ok(near<nearControl*.85,`fish near the ray ${near} vs control ${nearControl}`);
 assert.ok(near>nearControl*.2,`avoidance stays gentle (${near} vs ${nearControl})`);
});

test('a resting pointer habituates after about 2 s; small camera drift still counts as resting',()=>{
 const s=createPointerState(),ray=new THREE.Ray(new THREE.Vector3(),new THREE.Vector3(0,0,-1));
 notePointer(s,ray,false,0);assert.equal(pointerWeight(s,.5,1),.5);
 ray.direction.set(.001,0,-1).normalize();notePointer(s,ray,false,1.5); // ~0.06° drift
 assert.ok(pointerWeight(s,.5,2.2)<.5&&pointerWeight(s,.5,2.2)>0);assert.equal(pointerWeight(s,.5,2.9),0);
 ray.direction.set(.1,0,-1).normalize();notePointer(s,ray,false,3);assert.equal(pointerWeight(s,.5,3.1),.5,'moving again wakes them');
 notePointer(s,undefined,false,4);assert.equal(pointerWeight(s,.5,4),0,'pointer left');
});

test('a tap startles the school under it once per cooldown, without counting a chase',()=>{
 const s=createSardineSchools({seed:5,count:120});for(let i=1;i<=6*12;i++)s.update(i/12);
 let d=s.getDebug();assert.deepEqual(d.modes,['cruise','cruise']);const chases=d.chases;
 s.pointerRay(rayTo(centroid(d.fish,0)),true);s.update(6+1/12);d=s.getDebug();
 assert.equal(d.modes[0],'flee');assert.equal(d.modes[1],'cruise');assert.equal(d.candidates.pointerStartles,1);assert.equal(d.chases,chases);
 for(let i=2;i<=4*12;i++)s.update(6+i/12);s.pointerRay(rayTo(centroid(s.getDebug().fish,1)),true);s.update(10.1);
 assert.equal(s.getDebug().candidates.pointerStartles,1,'cooldown');
 // A tap far from both schools does nothing.
 for(let i=1;i<=8*12;i++)s.update(10.1+i/12);s.pointerRay(new THREE.Ray(eye.clone(),new THREE.Vector3(0,1,0)),true);s.update(18.3);
 assert.equal(s.getDebug().candidates.pointerStartles,1);s.dispose();
});

test('10 minutes of a ray sweeping the bridge and periodic taps: in bounds and out of the bridge',()=>{
 const s=createSardineSchools({seed:20260927,count:120}),obstacles=sardineObstacles();let startles=0;
 for(let i=1;i<=600*30;i++){const t=i/30,d=s.getDebug();
  const target=i%600<300?centroid(d.fish,(i/600|0)%2):new THREE.Vector3(1.6*Math.sin(t*.7),1+1.5*(.5+.5*Math.sin(t*.3)),-6+6*Math.sin(t*.2));
  s.pointerRay(rayTo(target),i%240===0);s.update(t);if(i%3000===0)s.pointerRay(undefined,false);}
 const d=s.getDebug();startles=d.candidates.pointerStartles;assert.equal(d.penetrations,0);assert.ok(startles>=10,`startles=${startles}`);
 for(const f of d.fish){assert.ok(f.p.every(Number.isFinite));
  assert.ok(f.p[0]>=SARDINE_BOUNDS.min.x&&f.p[0]<=SARDINE_BOUNDS.max.x&&f.p[1]>=SARDINE_BOUNDS.min.y&&f.p[1]<=SARDINE_BOUNDS.max.y&&f.p[2]>=SARDINE_BOUNDS.min.z&&f.p[2]<=SARDINE_BOUNDS.max.z);
  for(const b of obstacles)assert.ok(!(f.p[0]>b.min[0]&&f.p[0]<b.max[0]&&f.p[1]>b.min[1]&&f.p[1]<b.max[1]&&f.p[2]>b.min[2]&&f.p[2]<b.max[2]));}
 s.dispose();
});
