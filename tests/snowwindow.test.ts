import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleTime} from '../src/systems/TimeOfDay.ts';
import {snowWindowDaylight} from '../src/places/snowwindow/Daylight.ts';
import {curtainWind} from '../src/places/snowwindow/Curtains.ts';
import {snowParticlePosition} from '../src/places/snowwindow/Snow.ts';

test('snow window uses daylight by day and restrained cool moonlight at night',()=>{
 const dawn=snowWindowDaylight(sampleTime(6.5));
 const noon=snowWindowDaylight(sampleTime(12));
 const night=snowWindowDaylight(sampleTime(23));
 assert.ok(noon.solar>dawn.solar&&dawn.solar>0);
 assert.ok(noon.directIntensity>night.directIntensity);
 assert.ok(noon.skyIntensity>night.skyIntensity);
 assert.ok(night.night>.99&&night.visibility<noon.visibility);
 assert.deepEqual(snowWindowDaylight(sampleTime(0)),snowWindowDaylight(sampleTime(24)));
});

test('linen remains mostly still and occasionally receives an irregular gust',()=>{
 const calm=Math.max(curtainWind(4),curtainWind(12),curtainWind(52));
 assert.ok(curtainWind(31)>calm*3);
 assert.notEqual(curtainWind(30),curtainWind(32));
});

test('snow is deterministic and wraps below the window without accumulating drift',()=>{
 const base:[number,number,number]=[2,9,-18];
 const a=snowParticlePosition(base,.8,3.2,12);
 const b=snowParticlePosition(base,.8,3.2,12);
 const later=snowParticlePosition(base,.8,3.2,48);
 assert.deepEqual(a,b);
 for(const point of [a,later]){
  assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y)&&Number.isFinite(point.z));
  assert.ok(point.y>=-3&&point.y<25);
 }
 assert.notDeepEqual(a,later);
});

test('glass has independent droplet relief and stronger edge frost, without a scene image',async()=>{
 const {createWinterGlassMaterial}=await import('../src/places/snowwindow/Materials.ts');
 const glass=createWinterGlassMaterial();
 assert.equal(glass.map,null);
 assert.equal(glass.transmission,1);
 const normals=glass.normalMap!.image as {data:Uint8Array;width:number;height:number};
 const surface=glass.roughnessMap!.image as {data:Uint8Array;width:number;height:number};
 let reliefCount=0,bottom=0,center=0;
 for(let x=0;x<surface.width;x++){
  bottom+=surface.data[x*4+1];center+=surface.data[(512*surface.width+x)*4+1];
 }
 for(let i=0;i<normals.data.length;i+=4)if(Math.abs(normals.data[i]-128)>3||Math.abs(normals.data[i+1]-128)>3)reliefCount++;
 assert.ok(bottom>center*2,'thin frost must remain concentrated at glass edge');
 assert.ok(reliefCount>1000&&reliefCount<normals.width*normals.height*.25,'mostly clear glass with local droplet normals');
 glass.normalMap!.dispose();glass.roughnessMap!.dispose();glass.dispose();
});

test('winter exterior has upward sea, closed positive-thickness snow, and deterministic animation',async()=>{
 const {createWinterExterior}=await import('../src/places/snowwindow/Exterior.ts');
 const THREE=await import('three');
 const exterior=createWinterExterior();
 const snow=exterior.group.getObjectByName('snowwindow-thin-snow-platform') as import('three').Mesh;
 const sea=exterior.group.getObjectByName('snowwindow-calm-winter-sea') as import('three').Mesh<import('three').BufferGeometry,import('three').ShaderMaterial>;
 const positions=snow.geometry.getAttribute('position'),indices=snow.geometry.index!;
 const edges=new Map<string,number>();
 for(let i=0;i<indices.count;i+=3)for(let e=0;e<3;e++){
  const a=indices.getX(i+e),b=indices.getX(i+(e+1)%3),key=`${Math.min(a,b)}:${Math.max(a,b)}`;
  edges.set(key,(edges.get(key)??0)+1);
 }
 assert.ok([...edges.values()].every(count=>count===2),'snow volume must be watertight');
 const half=positions.count/2;
 for(let i=0;i<half;i++)assert.ok(positions.getY(i)>positions.getY(i+half),'snow has real positive thickness');
 for(const mesh of [snow,sea]){
  const p=mesh.geometry.getAttribute('position'),idx=mesh.geometry.index!;
  const a=new THREE.Vector3().fromBufferAttribute(p,idx.getX(0)),b=new THREE.Vector3().fromBufferAttribute(p,idx.getX(1)),c=new THREE.Vector3().fromBufferAttribute(p,idx.getX(2));
  assert.ok(b.sub(a).cross(c.sub(a)).y>0,'top triangles must face upward');
 }
 const light=snowWindowDaylight(sampleTime(12));
 exterior.update(12,light);assert.equal(sea.material.uniforms.uTime.value,12);
 exterior.update(12,light);assert.equal(sea.material.uniforms.uTime.value,12);
 exterior.update(24,light);assert.equal(sea.material.uniforms.uTime.value,24);
 let disposed=0;sea.geometry.addEventListener('dispose',()=>disposed++);
 exterior.dispose();exterior.dispose();assert.equal(disposed,1);
});

test('gathered curtain extends along the wall with full height, cloth depth and a fixed top',async()=>{
 const {gatheredCurtainPoint}=await import('../src/places/snowwindow/Curtains.ts');
 const left=gatheredCurtainPoint(0,0,0),right=gatheredCurtainPoint(1,0,0);
 assert.ok(left.x<-2.8&&right.x<-1.15,'gathered panel must extend onto wall without covering glazing');
 assert.ok(left.y<.1&&gatheredCurtainPoint(0,1,0).y>4.7,'full-height cloth is gathered, not cropped to a towel');
 assert.deepEqual(gatheredCurtainPoint(.4,1,0),gatheredCurtainPoint(.4,1,31),'track attachment stays fixed');
 let arc=0;let previous=gatheredCurtainPoint(0,.5,0);
 for(let i=1;i<=192;i++){const point=gatheredCurtainPoint(i/192,.5,0);arc+=Math.hypot(point.x-previous.x,point.z-previous.z);previous=point;}
 assert.ok(arc>3,'folds hold more cloth than the projected gathered width');
});
