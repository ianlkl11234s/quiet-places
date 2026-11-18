import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createArcadeSchools} from '../src/systems/schooling/index.ts';
import {arcadeObstacles} from '../src/places/last-arcade/biology/Obstacles.ts';
import {FLASH_DURATION,FLASH_MAX_ROLL} from '../src/systems/schooling/candidates.ts';

// B4 candidates on the Kuroshio arcade schools. Golden hashes were recorded from the code before B4.
const OFF={burstCoast:false,topologicalNeighbours:0,flashBank:0,pointerResponse:0};
const obstacles=arcadeObstacles();
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,16);
const sim=(d:unknown)=>{const {candidates:_c,...rest}=d as {candidates:unknown};return hash(rest);};
function buffers(root:THREE.Object3D){const out:number[][]=[];root.traverse(o=>{if(o instanceof THREE.InstancedMesh){out.push(Array.from(o.instanceMatrix.array));for(const n of ['aPhase','aTailAmplitude','aBend']){const a=o.geometry.getAttribute(n);if(a)out.push(Array.from(a.array as Float32Array));}}});return hash(out);}
const sampleThreats=(t:number)=>t<20||t>85?[]:[{position:new THREE.Vector3(6.15,2.9,15-.8*(t-20)),velocity:new THREE.Vector3(0,0,-.8),radius:2.7}];
type Cand={chromis:{tail:number[];flash:number[]};fusilier:{tail:number[];flash:number[]}};
type Dbg={candidates:Cand;chromis:{state:string;meanSpeedBL:number;medianNearestNeighborBL:number;agents:{position:number[];alarm:number}[]};fusilier:{state:string;meanSpeedBL:number;medianNearestNeighborBL:number;agents:{position:number[];alarm:number}[]}};

test('all B4 switches off reproduces the former arcade schools bit for bit (calm, threatened + disturb, long)',()=>{
 const a=createArcadeSchools({seed:44,obstacles,...OFF});for(let i=0;i<=120*12;i++)a.update(1/12,i/12+.03);
 assert.equal(sim(a.getDebug()),'507fafc83798fc77');assert.equal(buffers(a.root),'e467fc0f527d61d8');a.dispose();
 const b=createArcadeSchools({seed:91626,obstacles,sampleThreats,...OFF});for(let i=0;i<=100*12;i++){if(i===120)b.disturb();b.update(1/12,i/12);}
 assert.equal(sim(b.getDebug()),'7a660fe467f60d0a');assert.equal(buffers(b.root),'78639d1715873f40');b.dispose();
 const c=createArcadeSchools({seed:3,obstacles,...OFF});for(let i=0;i<=400*12;i++)c.update(1/12,i/12);
 assert.equal(sim(c.getDebug()),'03b6c0659eff4452');assert.equal(buffers(c.root),'1ff3c4b0447af72f');c.dispose();
});

test('flash: presentation only, bounded, only while startled or finishing its envelope',()=>{
 const s=createArcadeSchools({seed:91626,obstacles,sampleThreats,...OFF,flashBank:.6});
 const lastAlarm:Record<'chromis'|'fusilier',number[]>={chromis:[],fusilier:[]};let max=0,count=0;
 for(let i=0;i<=100*12;i++){const t=i/12;if(i===120)s.disturb();s.update(1/12,t);const d=s.getDebug() as Dbg;
  for(const k of ['chromis','fusilier'] as const)d.candidates[k].flash.forEach((f,j)=>{
   const agent=d[k].agents[j],startled=d[k].state==='CONTRACT'||agent.alarm>.08;if(startled)lastAlarm[k][j]=t;
   max=Math.max(max,Math.abs(f));if(f!==0){count++;assert.ok(t-(lastAlarm[k][j]??-Infinity)<=FLASH_DURATION.max+.2,`${k} flash while calm at ${t}`);}});}
 assert.equal(sim(s.getDebug()),'7a660fe467f60d0a','flash never changes the trajectories');s.dispose();
 assert.ok(count>0,'startled fish flash');assert.ok(max<=.6*FLASH_MAX_ROLL+1e-12);
});

test('burst-and-coast: calm fish glide out of step; alarmed fish beat continuously',()=>{
 const s=createArcadeSchools({seed:91626,obstacles,sampleThreats,...OFF,burstCoast:true});let calm=0,coast=0,alarmed=0;
 for(let i=0;i<=70*12;i++){s.update(1/12,i/12);if(i%6)continue;const d=s.getDebug() as Dbg;
  for(const k of ['chromis','fusilier'] as const)d.candidates[k].tail.forEach((tail,j)=>{const a=d[k].agents[j];
   if(d[k].state==='NORMAL'&&a.alarm<1e-6){calm++;if(tail<.5)coast++;}else if(a.alarm>.2){alarmed++;assert.equal(tail,1);}});}
 s.dispose();assert.ok(alarmed>0);assert.ok(coast/calm>.3&&coast/calm<.75,`coasting fraction ${coast/calm}`);
});

function averages(opts:object){const seeds=[1,2,3,4,5,6],acc={cSpeed:0,fSpeed:0,cNN:0,fNN:0,fRms:0};
 for(const seed of seeds){const s=createArcadeSchools({seed,obstacles,...OFF,...opts});const m={cSpeed:0,fSpeed:0,cNN:0,fNN:0,fRms:0};let n=0;
  for(let i=0;i<=300*12;i++){s.update(1/12,i/12);if(i%12)continue;const d=s.getDebug() as Dbg;n++;m.cSpeed+=d.chromis.meanSpeedBL;m.fSpeed+=d.fusilier.meanSpeedBL;m.cNN+=d.chromis.medianNearestNeighborBL;m.fNN+=d.fusilier.medianNearestNeighborBL;
   const ps=d.fusilier.agents.map(a=>a.position),c=[0,0,0];for(const p of ps)for(let k=0;k<3;k++)c[k]+=p[k]/ps.length;m.fRms+=Math.sqrt(ps.reduce((v,p)=>v+(p[0]-c[0])**2+(p[1]-c[1])**2+(p[2]-c[2])**2,0)/ps.length);}
  s.dispose();for(const k of Object.keys(acc) as (keyof typeof acc)[])acc[k]+=m[k]/n/seeds.length;}
 return acc;}
test('burst-and-coast and topological neighbours keep the confirmed speed, spacing and extent (within 5%)',()=>{
 const off=averages({}),bc=averages({burstCoast:true}),topo=averages({topologicalNeighbours:7});console.log(JSON.stringify({off,bc,topo}));
 for(const [name,v] of [['burst-coast',bc],['topological',topo]] as const)for(const k of Object.keys(off) as (keyof typeof off)[])
  assert.ok(Math.abs(v[k]/off[k]-1)<=.05,`${name} ${k}: ${v[k]} vs ${off[k]}`);
});
