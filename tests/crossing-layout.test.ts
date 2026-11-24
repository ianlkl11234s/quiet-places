import assert from 'node:assert/strict';
import test from 'node:test';
import {crossingDaylight,crossingMoonDirection,crossingSunDirection} from '../src/places/crossing/Daylight.ts';
import {DECK,inDeck,inStairHole,ROOF,SOLIDS,VIEWS} from '../src/places/crossing/Layout.ts';
import {createChairs} from '../src/places/crossing/Chairs.ts';
import * as THREE from 'three';
import {sampleTime} from '../src/systems/TimeOfDay.ts';

const alt=(v:{y:number})=>Math.asin(v.y)*180/Math.PI;
const angle=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>Math.acos(Math.min(1,a.x*b.x+a.y*b.y+a.z*b.z))*180/Math.PI;

test('all three standpoints stand on the deck, under the roof, not over the stair opening',()=>{
 for(const [name,v] of Object.entries(VIEWS)){
  const [x,y,z]=v.position;
  assert.ok(inDeck(x,z),`${name} on deck`);assert.ok(!inStairHole(x,z),`${name} not over the stair opening`);
  assert.ok(y>.9&&y<ROOF.underY-.3,`${name} height ${y} under the roof ${ROOF.underY}`);
  assert.ok(x<DECK.xMax-.5,`${name} inside the open-side wall`);
 }
 assert.deepEqual(Object.keys(VIEWS),['a','b','c']);
 assert.ok(VIEWS.a.position[1]<VIEWS.b.position[1],'A is the seated height');
});

test('noon sun is the reference photo light: open side, astern, 40-52 degrees up',()=>{
 const s=crossingSunDirection(12);
 assert.ok(s.x>.3&&s.z<-.3,`noon ${s.x} ${s.z}`);
 assert.ok(alt(s)>=40&&alt(s)<=52,`noon altitude ${alt(s)}`);
});

test('dawn, noon, dusk and moon night differ clearly in direction and strength',()=>{
 const L={dawn:crossingDaylight(sampleTime(6.5)),noon:crossingDaylight(sampleTime(12)),dusk:crossingDaylight(sampleTime(17.5)),night:crossingDaylight(sampleTime(23))};
 assert.ok(L.dawn.sun.x>0&&L.dawn.sun.z>0&&alt(L.dawn.sun)<20,'dawn: low, open side toward the bow');
 assert.ok(L.dusk.sun.x>.3&&L.dusk.sun.z<-.6&&alt(L.dusk.sun)<18,'dusk: low, astern on the open side');
 assert.ok(L.night.sun.x>0&&L.night.sun.z<0&&alt(L.night.sun)>25,'night: moon up on the open side astern');
 const names=Object.keys(L) as (keyof typeof L)[];
 for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++){
  assert.ok(angle(L[names[i]].sun,L[names[j]].sun)>15,`${names[i]} vs ${names[j]} direction`);
  assert.ok(Math.abs(L[names[i]].direct-L[names[j]].direct)>.05,`${names[i]} vs ${names[j]} strength ${L[names[i]].direct} ${L[names[j]].direct}`);
 }
 assert.ok(L.noon.direct>L.dusk.direct&&L.dusk.direct>L.night.direct,'strength ordering');
 assert.ok(L.dusk.tint.r-L.dusk.tint.b>L.noon.tint.r-L.noon.tint.b+.2,'dusk is warmer than noon');
 assert.ok(L.night.night>.9&&L.night.lamp>.9&&L.noon.lamp<.05,'lamp on only at night');
 assert.ok(alt(crossingMoonDirection(23))>25&&crossingMoonDirection(23).x>0&&crossingMoonDirection(23).z<0,'23:00 moon over the open side astern');
});

test('the light path is continuous over the whole day',()=>{
 for(let h=0;h<24;h+=.1){
  const a=crossingDaylight(sampleTime(h)),b=crossingDaylight(sampleTime(h+.1));
  assert.ok(angle(a.sun,b.sun)<4,`hour ${h.toFixed(1)}: light jumps ${angle(a.sun,b.sun).toFixed(2)} deg`);
  assert.ok(angle(crossingSunDirection(h),crossingSunDirection(h+.1))<4,`sun ${h}`);
  assert.ok(angle(crossingMoonDirection(h),crossingMoonDirection(h+.1))<4,`moon ${h}`);
  assert.ok(Math.abs(a.direct-b.direct)<.2,`hour ${h.toFixed(1)}: strength jumps`);
 }
});

test('no chair part (leaning back, arms, legs) touches a wall, bulkhead or post: at least 3 cm clear',()=>{
 const chairs=createChairs();chairs.group.updateMatrixWorld(true);
 const solids=SOLIDS.map(s=>({name:s.name,box:new THREE.Box3(new THREE.Vector3(s.box[0],s.box[2],s.box[4]),new THREE.Vector3(s.box[1],s.box[3],s.box[5]))}));
 for(const row of chairs.group.children){
  const box=new THREE.Box3().setFromObject(row).expandByScalar(.03);
  for(const s of solids)assert.ok(!box.intersectsBox(s.box),`${row.name} within 3 cm of ${s.name}`);
  assert.ok(box.min.x>DECK.xMin&&box.max.x<DECK.xMax&&box.min.z>DECK.zMin&&box.max.z<DECK.zMax,`${row.name} inside the deck`);
 }
 const wall=new THREE.Box3().setFromObject(chairs.group.children[0]);
 assert.ok(wall.max.y>.82&&wall.max.y<.92,`wall-row chair back top ${wall.max.y}`);
 assert.ok(chairs.triangles<60000);
});

test('graybox builds without a DOM (textures optional) and stays inside the triangle budget',async()=>{
 const {createGraybox}=await import('../src/places/crossing/Graybox.ts');
 const g=createGraybox();let tris=0;
 g.group.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh)tris+=(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3;});
 assert.ok(tris>20000&&tris<60000,`triangles ${tris}`);
 g.dispose();
});
