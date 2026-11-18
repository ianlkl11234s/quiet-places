import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createCrossingLife,CROSSING_SARDINE_POINTER_RESPONSE,CROSSING_WHALE_SHARK_LENGTHS} from '../src/places/crossing/Life.ts';
import {DECK,POCKET,RAIL,ROOF,VIEWS,inDeck} from '../src/places/crossing/Layout.ts';

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

test('whale sharks: pitch within 8 deg, apart, small one stays astern within 2.5 big lengths, cadence slow, in the open-side quadrant',()=>{
 const {life,samples}=run(120),[big,small]=CROSSING_WHALE_SHARK_LENGTHS;
 for(const d of samples){
  const [b,s]=d.sharks;
  for(const sh of d.sharks){assert.ok(sh.p.every(Number.isFinite));assert.ok(Math.abs(sh.pitch)<=8*Math.PI/180+1e-9);assert.ok(sh.p[1]>=-3.5&&sh.p[1]<=-1.5,`y ${sh.p[1]}`);assert.ok(sh.frequency>=.35&&sh.frequency<=.5);assert.ok(sh.p[0]>DECK.xMax+8,'off the open side');}
  const dist=Math.hypot(b.p[0]-s.p[0],b.p[1]-s.p[1],b.p[2]-s.p[2]);
  assert.ok(dist>(big+small)*.4,`too close ${dist}`);assert.ok(dist<big*2.5,`too far ${dist}`);
  assert.ok(s.p[2]<b.p[2],'small one astern');
  // Both inside the stations' view cones (bearing 39-73 deg from +X toward -Z, seen from station a), clear of the glitter axis (~41 deg).
  for(const sh of d.sharks){const az=Math.atan2(-(sh.p[2]-VIEWS.a.position[2]),sh.p[0]-VIEWS.a.position[0])*180/Math.PI;assert.ok(az>46&&az<73,`bearing ${az}`);}
 }
 life.dispose();
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
