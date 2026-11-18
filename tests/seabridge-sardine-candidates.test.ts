import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createSardineSchools} from '../src/places/seabridge/Sardines.ts';
import {FLASH_DURATION,FLASH_MAX_ROLL,insertNearest} from '../src/systems/schooling/candidates.ts';

// B4 candidates on the seabridge sardines. Golden hashes were recorded from the code before B4
// (same seeds, same run), so "switched off" is checked bit for bit, simulation and instance buffers.
const OFF={burstCoast:false,topologicalNeighbours:0,flashBank:0,pointerResponse:0};
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,16);
const sim=(d:ReturnType<ReturnType<typeof createSardineSchools>['getDebug']>)=>{const {candidates:_c,...rest}=d;return hash(rest);};
function buffers(root:THREE.Object3D){const out:number[][]=[];root.traverse(o=>{if(o instanceof THREE.InstancedMesh){out.push(Array.from(o.instanceMatrix.array));for(const n of ['aPhase','aTailAmplitude','aBend']){const a=o.geometry.getAttribute(n);if(a)out.push(Array.from(a.array as Float32Array));}}});return hash(out);}
const rms=(ps:number[][])=>{const c=[0,0,0];for(const p of ps)for(let k=0;k<3;k++)c[k]+=p[k]/ps.length;return Math.sqrt(ps.reduce((v,p)=>v+(p[0]-c[0])**2+(p[1]-c[1])**2+(p[2]-c[2])**2,0)/ps.length);};

test('all B4 switches off reproduces the former sardines bit for bit',()=>{
 const a=createSardineSchools({seed:20260927,count:120,...OFF});for(let t=0;t<=90;t+=1/30)a.update(t);
 assert.equal(sim(a.getDebug()),'4314d6c58b193aae');assert.equal(buffers(a.root),'e053ccb06f2a9af1');a.dispose();
 const b=createSardineSchools({seed:7,...OFF});for(let t=0;t<=30;t+=1/30)b.update(t);
 assert.equal(sim(b.getDebug()),'063e72f950926f0d');assert.equal(buffers(b.root),'f5e80e403b1df8a6');b.dispose();
});

test('flash bank alone is presentation only: trajectories equal the former run, only orientations differ',()=>{
 const a=createSardineSchools({seed:20260927,count:120,...OFF,flashBank:.6});let flashed=0;
 for(let t=0;t<=90;t+=1/30){a.update(t);if(a.getDebug().candidates.flash.some(f=>f!==0))flashed++;}
 assert.ok(flashed>0,'some fish flashed during the run');assert.equal(sim(a.getDebug()),'4314d6c58b193aae');a.dispose();
});

test('flash: bounded, only while startled (or finishing its envelope), and smooth',()=>{
 const s=createSardineSchools({seed:20260927,count:120,...OFF,flashBank:.6});
 let lastStartled=[-Infinity,-Infinity],max=0,flashes=0,prev:number[]=[];
 for(let i=1;i<=240*12;i++){const t=i/12;s.update(t+1e-9);const d=s.getDebug(),half=d.fish.length/2;
  d.modes.forEach((m,k)=>{if(m!=='cruise')lastStartled[k]=t;});
  d.candidates.flash.forEach((f,j)=>{const k=j<half?0:1;max=Math.max(max,Math.abs(f));if(f!==0&&!(prev[j]))flashes++;
   if(f!==0)assert.ok(t-lastStartled[k]<=FLASH_DURATION.max+1/12+1e-9,`flash in calm cruise at t=${t}`);
   if(prev[j]!==undefined)assert.ok(Math.abs(f-prev[j])<=.6*FLASH_MAX_ROLL*.5,'no roll jumps between steps');});
  prev=d.candidates.flash;}
 s.dispose();
 assert.ok(flashes>20,`flashes=${flashes}`);assert.ok(max>10*Math.PI/180&&max<=.6*FLASH_MAX_ROLL+1e-12,`max=${max*180/Math.PI}`);
});

test('burst-and-coast: desynchronised glides in cruise, continuous beat in chase and flee',()=>{
 const s=createSardineSchools({seed:20260927,count:120,...OFF,burstCoast:true});let coastFrac=0,samples=0,startledSamples=0;
 for(let i=1;i<=240*12;i++){s.update(i/12+1e-9);if(i%6)continue;const d=s.getDebug(),half=d.fish.length/2;
  d.candidates.tail.forEach((tail,j)=>{const mode=d.modes[j<half?0:1];assert.ok(tail>=.12-1e-9&&tail<=1+1e-9);if(mode==='cruise'){samples++;if(tail<.5)coastFrac++;}else{startledSamples++;assert.equal(tail,1);}});}
 s.dispose();coastFrac/=samples;
 assert.ok(startledSamples>0);assert.ok(coastFrac>.35&&coastFrac<.75,`coasting fraction=${coastFrac}`);
});

function averages(opts:object){let speed=0,spread=0,nn=0;const seeds=[1,2,3,4];
 for(const seed of seeds){const s=createSardineSchools({seed,count:200,...OFF,...opts});let a=0,b=0,c=0,n=0;
  for(let i=1;i<=240*12;i++){s.update(i/12+1e-9);if(i%24)continue;const d=s.getDebug(),h=d.fish.length/2;n++;a+=d.fish.reduce((v,f)=>v+f.speedBL,0)/d.fish.length;
   const groups=[d.fish.slice(0,h).map(f=>f.p),d.fish.slice(h).map(f=>f.p)];b+=(rms(groups[0])+rms(groups[1]))/2;
   for(const g of groups){const m=g.map((p,i)=>{let best=Infinity;g.forEach((q,j)=>{if(i!==j)best=Math.min(best,Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]));});return best;}).sort((x,y)=>x-y);c+=m[m.length>>1]/2;}}
  s.dispose();speed+=a/n/seeds.length;spread+=b/n/seeds.length;nn+=c/n/seeds.length;}
 return {speed,spread,nn};}
const within=(a:number,b:number,tol=.05)=>Math.abs(a/b-1)<=tol;

test('burst-and-coast and topological neighbours keep the confirmed speed, extent and spacing (within 5%)',()=>{
 const off=averages({}),bc=averages({burstCoast:true}),topo=averages({topologicalNeighbours:7});
 console.log(JSON.stringify({off,bc,topo}));
 for(const [name,v] of [['burst-coast',bc],['topological',topo]] as const){
  assert.ok(within(v.speed,off.speed),`${name} speed ${v.speed} vs ${off.speed}`);
  assert.ok(within(v.spread,off.spread),`${name} extent ${v.spread} vs ${off.spread}`);
  assert.ok(within(v.nn,off.nn),`${name} spacing ${v.nn} vs ${off.nn}`);
 }
});

test('insertNearest keeps the k smallest distances in order without allocation',()=>{
 const values=[5,3,9,1,7,2,8,6,4,0.5,10],k=4,dist=new Float64Array(k),index=new Int32Array(k);let count=0;
 values.forEach((v,j)=>{count=insertNearest(dist,index,k,count,v,j);});
 assert.equal(count,4);assert.deepEqual(Array.from(dist),[.5,1,2,3]);assert.deepEqual(Array.from(index),[9,3,5,1]);
});
