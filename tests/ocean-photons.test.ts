import * as THREE from 'three';
import {createOceanPhotonMap,traceOceanPhoton} from '../src/world/OceanPhotonMap.ts';
import {refractRay} from '../src/world/OceanOptics.ts';
function assert(ok:boolean,message:string){if(!ok)throw new Error(message);}

// Flat water makes the pane path reproducible: low-angle light can leave the vertical pane and reaches the floor.
const floorHit=traceOceanPhoton(new THREE.Vector3(0,0,-5.12),new THREE.Vector3(0,.3,-.954).normalize(),0,1.75,true);
assert(floorHit?.receiver==='floor','A refracted ray must use the floor before any sidewall');
assert(Math.abs(floorHit.position.y-.095)<1e-7,'Floor hit is on the dry-room floor');
assert(Math.abs(floorHit.entry.z+4.89)<1e-7&&floorHit.entry.y>floorHit.position.y,'Air segment starts at the inner pane before the floor');

// Independent planar Snell oracle, including the finite glass slab translation.
const s=new THREE.Vector3(0,.3,-.954).normalize(),wz=-s.z/1.333,wy=-Math.sqrt(1-wz*wz);
const gy=wy*1.333/1.5,gz=Math.sqrt(1-gy*gy),ay=gy*1.5,az=Math.sqrt(1-ay*ay);
const yExit=1.75+wy*(.01/wz)+gy*(.22/gz);
const expectedZ=-4.89+az*(.095-yExit)/ay;
assert(Math.abs(floorHit.position.z-expectedZ)<1e-7,'Flat-water hit agrees with independent Snell geometry');

// A source whose refracted path misses the framed opening must not light the room.
const frameBlocked=traceOceanPhoton(new THREE.Vector3(13,0,-5.12),new THREE.Vector3(0,.3,-.954).normalize(),0,1.75,true);
assert(frameBlocked===null,'The opaque frame blocks rays outside the true aperture');

// Steep tangential travel in glass reaches the glass-to-air critical angle and is blocked by TIR.
const tir=refractRay(new THREE.Vector3(.9,0,.43589),new THREE.Vector3(0,0,-1),1.5,1);
assert(tir===null,'Glass-to-air total internal reflection must not create an interior photon');
const map=createOceanPhotonMap();
map.update(0,1.75,new THREE.Vector3(0,.3,-.954).normalize(),true);
assert(map.stats.rays>0&&map.stats.emitted>0,'The finite source grid records projected emitted flux');
assert(map.stats.received>0&&map.stats.transmitted>=map.stats.received,'Received flux has transmission accounting');
let mapped=0;
for(const [receiver,texture] of Object.entries(map.textures)){
 const data=texture.image.data as Float32Array;
 const area=receiver==='floor'?11.82*18.89:18.89*6.815;
 let energy=0;for(let i=0;i<data.length;i+=4)energy+=(data[i]+data[i+1]+data[i+2])/3;
 mapped+=energy*area/(texture.image.width*texture.image.height);
}
assert(Math.abs(mapped-map.stats.received)<1e-5,'Receiver splat conserves transmitted flux');
assert(Math.abs(map.stats.emitted-map.stats.received-map.stats.unreceived)<1e-7,'Flux is accounted for as received or unreceived');
const volumeData=map.volume.image.data as Float32Array;
assert(volumeData.every(v=>Number.isFinite(v)&&v>=0)&&volumeData.some(v=>v>0),'Air volume contains finite positive light paths');
const lowFlux=map.stats.received;map.update(0,1.75,new THREE.Vector3(0,.3,-.954).normalize(),false);
assert(Math.abs(map.stats.received-lowFlux)/map.stats.received<.12,'Fourfold photon sampling keeps total flux stable');
map.update(0,1.75,new THREE.Vector3(0,.3,-.954).normalize(),true);
const updates=map.stats.updates;map.update(.01,1.75,new THREE.Vector3(0,.3,-.954).normalize(),true);
assert(map.stats.updates===updates,'Unchanged input is capped at 15 Hz');
let volumeDisposals=0;map.volume.addEventListener('dispose',()=>volumeDisposals++);
map.dispose();map.dispose();
assert(volumeDisposals===1,'Air volume is released exactly once');
console.log('PASS ocean photon aperture, pane refraction, TIR and nearest receiver');
