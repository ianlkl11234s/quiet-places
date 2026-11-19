import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createCrossingLife,crossingWhaleSharkTrack,CROSSING_SARDINE_POINTER_RESPONSE,CROSSING_WHALE_SHARK_LENGTHS} from '../src/places/crossing/Life.ts';
import {DECK,POCKET,RAIL,ROOF,SOLIDS,VIEWS,inDeck} from '../src/places/crossing/Layout.ts';

const STATE={intensity:1},DT=1/30;
const run=(seconds:number,options:Parameters<typeof createCrossingLife>[0]={},ray?:(t:number)=>{ray:THREE.Ray|undefined;tap:boolean}|undefined)=>{
 const life=createCrossingLife({seed:20261118,...options});
 const samples:ReturnType<typeof life.getDebug>[]=[];
 for(let k=0;k*DT<=seconds;k++){
  const t=k*DT,r=ray?.(t);if(r)life.pointerRay(r.ray,r.tap);
  life.update(DT,t,STATE);if(k%15===0)samples.push(life.getDebug());
 }
 return {life,samples,last:life.getDebug()};
};
const cams=[VIEWS.a.position,VIEWS.c.position];
// Solids written out again from Layout (not from the module's own proxy list).
const solid=(p:number[],margin=0)=>{
 const [x,y,z]=p,{xMin,xMax,zMin,zMax}=DECK;
 if(x>xMax-RAIL.t&&x<xMax&&z>zMin-RAIL.t&&z<zMax&&y<RAIL.h)return 'open-side gunwale';
 if(x>0&&x<xMax&&z>zMin-RAIL.t&&z<zMin&&y<RAIL.h)return 'stern gunwale';
 if(x>xMin&&x<0&&z>zMin-RAIL.t&&z<POCKET.pocketFrontZ)return 'cabin';
 if(x<xMin&&x>xMin-.15&&z>POCKET.pocketFrontZ&&z<zMax)return 'west wall';
 if(y>ROOF.underY&&x>xMin&&x<xMax&&z>zMin&&z<zMax)return 'roof';
 if(y<0&&inDeck(x,z))return 'below deck';
 for(const c of cams)if(Math.hypot(x-c[0],y-c[1],z-c[2])<.6)return 'camera zone';
 return margin?'':'';
};

test('120 s: fish finite, out of every solid and the camera zones, speeds sensible, and they use the openings',()=>{
 const {life,samples}=run(120);
 let near=0,total=0,inDeckCount=0,outsideCount=0,maxSpeed=0,speedSum=0,speedN=0,minLen=1,maxLen=0;
 for(const d of samples){
  assert.equal(d.fish.length,210);
  for(const f of d.fish){
   assert.ok(f.p.every(Number.isFinite)&&Number.isFinite(f.speed));
   assert.equal(solid(f.p),'',`fish at ${f.p.map(v=>v.toFixed(2))} in ${solid(f.p)}`);
   total++;if(cams.some(c=>Math.hypot(f.p[0]-c[0],f.p[1]-c[1],f.p[2]-c[2])<1.2))near++;
   maxSpeed=Math.max(maxSpeed,f.speed);speedSum+=f.speed;speedN++;minLen=Math.min(minLen,f.length);maxLen=Math.max(maxLen,f.length);
   if(inDeck(f.p[0],f.p[2])&&f.p[1]>0)inDeckCount++;if(f.p[0]>DECK.xMax+.3||f.p[2]<DECK.zMin-.3||f.p[2]>DECK.zMax+.3)outsideCount++;
  }
 }
 assert.equal(life.getDebug().penetrations,0);
 assert.ok(maxSpeed<2.6,`max speed ${maxSpeed}`);assert.ok(speedSum/speedN>.15&&speedSum/speedN<1.6,`mean speed ${speedSum/speedN}`);
 assert.ok(near/total<.02,`fish within 1.2 m of a camera: ${near/total}`);
 assert.ok(minLen>=.1-1e-6&&maxLen<=.2+1e-6);
 assert.ok(inDeckCount>samples.length*20,`on deck ${inDeckCount}`);assert.ok(outsideCount>samples.length*5,`outside ${outsideCount}`);
 life.dispose();
});

test('whale sharks in the life object: pose follows the analytic track, pitch/bank capped, tail beats with swum distance',()=>{
 const {life,samples}=run(90),[big,small]=CROSSING_WHALE_SHARK_LENGTHS;
 assert.ok(samples.length>100);
 for(const d of samples){
  d.sharks.forEach((sh,i)=>{
   assert.ok(sh.p.every(Number.isFinite));assert.ok(Math.abs(sh.pitch)<=8*DEG+1e-9);assert.ok(Math.abs(sh.roll)<=12*DEG+1e-9);
   assert.ok(sh.p[1]>=.5&&sh.p[1]<=5.5,`y ${sh.p[1]}`);assert.ok(sh.speed>=.5&&sh.speed<=1.65,`speed ${sh.speed}`);
   assert.ok(Math.abs(sh.frequency-sh.speed/2.4)<1e-9&&sh.frequency>.2&&sh.frequency<.7);
  });
  assert.equal(d.sharks[0].length,big);assert.equal(d.sharks[1].length,small);
 }
 // The debug pose is the pure track at the elapsed time of the last update (90 s).
 const last=life.getDebug();[0,1].forEach(i=>{const k=crossingWhaleSharkTrack(i as 0|1,90);last.sharks[i].p.forEach((v,j)=>assert.ok(Math.abs(v-k.p[j])<1e-6));assert.ok(Math.abs(last.sharks[i].yaw-k.yaw)<1e-6);});
 life.dispose();
});

// --- whale shark route, 0-600 s every 0.5 s (pure track; numbers replace looking at renders) ---
const DEG=Math.PI/180,LENGTHS=CROSSING_WHALE_SHARK_LENGTHS,ASPECT=16/9;
const HULL:[number,number,number,number,number,number]=[DECK.xMin,DECK.xMax,-6,0,DECK.zMin,DECK.zMax];
const ROOF_SLAB:[number,number,number,number,number,number]=[DECK.xMin,DECK.xMax,ROOF.underY,ROOF.underY+.1,DECK.zMin,DECK.zMax];
const BLOCKERS=[...SOLIDS.map(s=>s.box),ROOF_SLAB,HULL];
const segmentHitsBox=(a:readonly number[],b:readonly number[],box:readonly number[])=>{
 let t0=0,t1=1;
 for(let i=0;i<3;i++){const d=b[i]-a[i],lo=box[i*2],hi=box[i*2+1];
  if(Math.abs(d)<1e-12){if(a[i]<lo||a[i]>hi)return false;continue;}
  let u=(lo-a[i])/d,v=(hi-a[i])/d;if(u>v)[u,v]=[v,u];t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1)return false;}
 return true;
};
/** Eye-to-centre line clear of walls, posts, roof and hull and the centre inside the 16:9 frustum; also returns the apparent length in 1080p pixels. */
const look=(view:'a'|'c',p:readonly number[],yaw:number,length:number)=>{
 const eye=VIEWS[view].position as readonly number[],target=VIEWS[view].target as readonly number[];
 if(BLOCKERS.some(b=>segmentHitsBox(eye,p,b)))return {visible:false,px:0};
 let f=[target[0]-eye[0],target[1]-eye[1],target[2]-eye[2]];const fl=Math.hypot(f[0],f[1],f[2]);f=f.map(x=>x/fl);
 const rl=Math.hypot(f[0],f[2]),r=[f[2]/rl,0,-f[0]/rl],u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
 const v=[p[0]-eye[0],p[1]-eye[1],p[2]-eye[2]],z=v[0]*f[0]+v[1]*f[1]+v[2]*f[2];if(z<=0)return {visible:false,px:0};
 const th=Math.tan(VIEWS[view].fov*DEG/2),x=(v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/z/(th*ASPECT),y=(v[0]*u[0]+v[1]*u[1]+v[2]*u[2])/z/th;
 if(Math.abs(x)>1||Math.abs(y)>1)return {visible:false,px:0};
 // Body axis (yaw, level) seen across the line of sight: projected length = length * |sin(angle between axis and view ray)|.
 const dist=Math.hypot(v[0],v[1],v[2]),axis=[Math.sin(yaw),0,Math.cos(yaw)],cos=(axis[0]*v[0]+axis[2]*v[2])/dist,sin=Math.sqrt(Math.max(0,1-cos*cos));
 return {visible:true,px:length*sin/dist/(2*th)*1080};
};
const times=Array.from({length:1201},(_,k)=>k*.5);
const tracks=[times.map(t=>crossingWhaleSharkTrack(0,t)),times.map(t=>crossingWhaleSharkTrack(1,t))];
const boxDistance=(p:readonly number[])=>Math.hypot(Math.max(DECK.xMin-p[0],0,p[0]-DECK.xMax),Math.max(DECK.zMin-p[2],0,p[2]-DECK.zMax));

test('whale shark route 0-600 s: 2-5.5 m up, 12 m of clear water past the hull for the whole body, 22+ m centre-to-ship, up to 50 m, small one never on top of the big one',()=>{
 for(const [i,list] of tracks.entries())list.forEach((k,n)=>{
  assert.ok(k.p.every(Number.isFinite));assert.ok(k.p[1]>=.5&&k.p[1]<=5.5,`shark ${i} y ${k.p[1]} at ${times[n]}`);
  const d=boxDistance(k.p);assert.ok(d-LENGTHS[i]/2>=12&&d<=50,`shark ${i} ${d.toFixed(1)} m from the hull box at ${times[n]} s`);
 });
 tracks[0].forEach((k,n)=>{const o=tracks[1][n].p,sep=Math.hypot(k.p[0]-o[0],k.p[1]-o[1],k.p[2]-o[2]);assert.ok(sep>=5,`centres ${sep.toFixed(1)} m apart at ${times[n]} s`);assert.ok(sep<=40,`small one strayed ${sep.toFixed(1)} m`);});
});

test('whale shark motion: 0.5-1.6 m/s, yaw follows the path (no sliding backwards), yaw change <= 6 deg per 0.5 s, bank <= 12 deg, pitch <= 8 deg',()=>{
 for(const [i,list] of tracks.entries())list.forEach((k,n)=>{
  assert.ok(k.speed>=.5&&k.speed<=1.6,`shark ${i} speed ${k.speed.toFixed(2)} at ${times[n]}`);
  const heading=Math.atan2(k.v[0],k.v[2]),off=Math.abs(Math.atan2(Math.sin(heading-k.yaw),Math.cos(heading-k.yaw)));assert.ok(off<=25*DEG,`velocity off the nose by ${off/DEG}`);
  assert.ok(Math.abs(k.roll)<=12*DEG+1e-9&&Math.abs(k.pitch)<=8*DEG+1e-9);
  if(n+1<list.length){const dyaw=Math.abs(Math.atan2(Math.sin(list[n+1].yaw-k.yaw),Math.cos(list[n+1].yaw-k.yaw)));assert.ok(dyaw<=6*DEG,`shark ${i} yaw jumps ${(dyaw/DEG).toFixed(2)} deg at ${times[n]} s`);}
 });
});

test('whale shark visibility: big one seen 35% of the time from a and 20% from c, neither shark gone for more than 60 s (a) / 90 s (c), big one at least 90 px long in the middle',()=>{
 const need={a:{share:.35,gap:60},c:{share:.2,gap:90}};
 for(const view of ['a','c'] as const){
  let seen=0,gone=0,longest=0;const px:number[]=[];
  times.forEach((_t,n)=>{
   const lookBig=look(view,tracks[0][n].p,tracks[0][n].yaw,LENGTHS[0]),lookSmall=look(view,tracks[1][n].p,tracks[1][n].yaw,LENGTHS[1]);
   if(lookBig.visible){seen++;px.push(lookBig.px);}
   if(lookBig.visible||lookSmall.visible)gone=0;else{gone+=.5;longest=Math.max(longest,gone);}
  });
  px.sort((x,y)=>x-y);const median=px[Math.floor(px.length/2)];
  console.log(`view ${view}: big visible ${(seen/times.length*100).toFixed(1)} %, longest both-hidden ${longest} s, median length ${median.toFixed(0)} px`);
  assert.ok(seen/times.length>=need[view].share,`${view} share ${seen/times.length}`);assert.ok(longest<=need[view].gap,`${view} gap ${longest}`);assert.ok(median>=90,`${view} median ${median}`);
 }
});

test('pointer response 0: pointerRay and tap leave the trajectories bit-identical',()=>{
 const aim=(t:number)=>{const origin=new THREE.Vector3(-.4,1.15,.34),dir=new THREE.Vector3(Math.sin(t*.7),0,-1).normalize();return {ray:new THREE.Ray(origin,dir),tap:Math.round(t*30)%90===0};};
 const plain=run(40,{pointerResponse:0}),poked=run(40,{pointerResponse:0},aim);
 assert.deepEqual(poked.last,plain.last);assert.equal(poked.last.startles,0);
 const live=run(40,{},aim);assert.ok(live.last.startles>0,'default response reacts to a tap');
 assert.ok(CROSSING_SARDINE_POINTER_RESPONSE===.5);
 [plain,poked,live].forEach(r=>r.life.dispose());
});

test('same seed twice gives the same result; a different seed differs',()=>{
 const a=run(60),b=run(60),c=run(60,{seed:7});
 assert.deepEqual(a.last,b.last);assert.notDeepEqual(a.last.fish,c.last.fish);
 const before=JSON.stringify(a.last);a.life.update(DT,60,STATE);a.life.update(DT,59,STATE);assert.equal(JSON.stringify(a.life.getDebug()),before);
 [a,b,c].forEach(r=>r.life.dispose());
});
