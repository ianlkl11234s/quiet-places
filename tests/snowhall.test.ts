import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {snowHallDaylight} from '../src/places/snowhall/Daylight.ts';
import {createSnowHallField,snowHallParticle} from '../src/places/snowhall/Snow.ts';
import {applySnowhallLayout,SNOW_HALL_BASELINE,SNOW_HALL_DOORS,snowhallGeometry,validateSnowhallDraft} from '../src/places/snowhall/Layout.ts';

import {prepareSnowhall} from '../src/places/snowhall/index.ts';

const state=(hour:number)=>({hour,intensity:1,warmth:0,angle:0,activity:0});

test('snow hallway keeps a stronger cold window by day and a restrained night fill',()=>{
 const noon=snowHallDaylight(state(12)),night=snowHallDaylight(state(23));
 assert.ok(noon.windowIntensity>night.windowIntensity*4.5);
 assert.ok(noon.fillIntensity<noon.windowIntensity*.08);
 assert.ok(night.fillIntensity<night.windowIntensity*.2);
 assert.ok(night.windowIntensity>.7&&night.fillIntensity<.03,'snow bounce brightens moonlight without lifting the whole room');
 assert.equal('directIntensity' in noon,false,'corridor light has no hard parallel component');
});

test('residential hallway distributes doors across both sides and pairs the window-end rooms',()=>{
 assert.ok(SNOW_HALL_DOORS.some(door=>door.side==='left'));
 assert.ok(SNOW_HALL_DOORS.some(door=>door.side==='right'));
 const windowEnd=Math.min(...SNOW_HALL_DOORS.map(door=>door.z));
 assert.deepEqual(SNOW_HALL_DOORS.filter(door=>door.z===windowEnd).map(door=>door.side).sort(),['left','right']);
});

test('snow hallway study preserves the selected narrow-hall baseline and rejects impossible windows',()=>{
 const baseline=snowhallGeometry(SNOW_HALL_BASELINE);
 assert.equal(baseline.floorWidth,3.28);assert.equal(baseline.wallX,1.52);assert.equal(baseline.draft.window.width,1.76);assert.equal(baseline.draft.camera.position[2],-.07);assert.equal(baseline.draft.snowScale,1.83);
 const wider=structuredClone(SNOW_HALL_BASELINE);wider.corridorWidth=5;wider.window.x=.4;wider.window.width=2.2;
 const changed=snowhallGeometry(wider);assert.equal(changed.floorWidth,5.48);assert.equal(changed.wallX,2.62);assert.equal(changed.draft.window.x,.4);
 const invalid=structuredClone(SNOW_HALL_BASELINE);invalid.window.x=2;
 assert.throws(()=>validateSnowhallDraft(invalid),/超出走廊端牆/);
});

test('snow particle size is a live preview multiplier independent of density',()=>{
 const field=createSnowHallField(),material=field.points.material as THREE.ShaderMaterial;
 field.update(0,1,false,1.8);assert.equal(material.uniforms.uSize.value,5.4*1.8);assert.equal(field.points.geometry.drawRange.count,760);
 field.dispose();
});

test('snow particles remain deterministic',()=>{
 const base:[number,number,number]=[1,4,-18];
 assert.deepEqual(snowHallParticle(base,.4,2,8),snowHallParticle(base,.4,2,8));
});


test('target-only studio changes rebuild the camera-relative biology and dispose the old models',async()=>{
 const oldDocument=globalThis.document;
 const context={fillStyle:'',strokeStyle:'',lineWidth:1,fillRect(){},beginPath(){},moveTo(){},bezierCurveTo(){},stroke(){}};
 Object.assign(globalThis,{document:{createElement:()=>({width:0,height:0,getContext:()=>context})}});
 let place:Awaited<ReturnType<typeof prepareSnowhall>> extends (...args:any[])=>infer T?T:never;
 try{
  const factory=await prepareSnowhall(),scene=new THREE.Scene(),renderer={shadowMap:{enabled:false,type:THREE.PCFShadowMap}} as THREE.WebGLRenderer;
  place=factory(scene,renderer);place.update(0,30,state(12));
  const root=scene.getObjectByName('snowhall-corridor')!,before=root.userData.biology,oldLife=root.getObjectByName('snowhall-antarctic-life')!;
  const changed=structuredClone(SNOW_HALL_BASELINE);changed.camera.target=[.34,1.03,5];
  const probe=new THREE.Vector3(.34,1.03,-3);assert.equal(before.isBehindCamera(probe,.2),false);
  applySnowhallLayout(root,changed);
  assert.notEqual(root.userData.biology,before);assert.equal(oldLife.parent,null);
  assert.equal(root.userData.biology.isBehindCamera(probe,.2),true,'uses the new view direction');
  const after=root.userData.biology;applySnowhallLayout(root,structuredClone(changed));assert.equal(root.userData.biology,after,'unchanged layout does not recreate biology');
  place.dispose();
 }finally{Object.assign(globalThis,{document:oldDocument});}
});
