import * as THREE from 'three';
import {refractRay, sampleOceanWave, oceanAbsorption} from './OceanOptics.ts';

export type OceanPhotonReceiver = 'floor' | 'left' | 'right';
export interface OceanPhotonHit { receiver: OceanPhotonReceiver; entry: THREE.Vector3; position: THREE.Vector3; energy: THREE.Vector3; }
export interface OceanPhotonStats { emitted: number; transmitted: number; received: number; unreceived: number; rays: number; updates: number; }

const PANE_WATER_Z = -5.11, PANE_AIR_Z = -4.89;
const OPENING = {minX: -4.645, maxX: 4.645, minY: .755, maxY: 2.745};
const ROOM = {minX: -5.91, maxX: 5.91, floorY: .095, maxY: 6.91, minZ: -4.89, maxZ: 14};
const ABSORPTION = oceanAbsorption;
const SOURCE = {minX: -14, maxX: 14, minZ: -22, maxZ: -5.14};

function wave(x: number, z: number, time: number, flat: boolean) {
  return flat ? {height: 0, dx: 0, dz: 0} : sampleOceanWave(x, z, time);
}
function inOpening(p: THREE.Vector3) {
  return p.x >= OPENING.minX && p.x <= OPENING.maxX && p.y >= OPENING.minY && p.y <= OPENING.maxY;
}
function attenuate(distance: number) {
  return new THREE.Vector3(Math.exp(-ABSORPTION.x * distance), Math.exp(-ABSORPTION.y * distance), Math.exp(-ABSORPTION.z * distance));
}

/**
 * Sends one solar photon through the exterior surface and the actual thin pane.
 * `sun` points toward the sun, therefore the incident propagation direction is -sun.
 */
export function traceOceanPhoton(source: THREE.Vector3, sun: THREE.Vector3, time: number, level: number, flat = false): OceanPhotonHit | null {
  const surface = wave(source.x, source.z, time, flat);
  const origin = new THREE.Vector3(source.x, level + surface.height, source.z);
  const incident = sun.clone().negate().normalize();
  const normal = new THREE.Vector3(-surface.dx, 1, -surface.dz).normalize();
  const water = refractRay(incident, normal, 1, 1.333);
  if (!water || water.direction.z <= 1e-8) return null;

  const toWaterFace = (PANE_WATER_Z - origin.z) / water.direction.z;
  if (!(toWaterFace > 0)) return null;
  const waterFace = origin.addScaledVector(water.direction, toWaterFace);
  // The ray must remain below the local exterior surface when it reaches the pane.
  if (waterFace.y >= level + wave(waterFace.x, PANE_WATER_Z, time, flat).height || !inOpening(waterFace)) return null;

  // Reject direct solar rays hidden by another crest before reaching this facet.
  if(!flat)for(let i=1;i<=12;i++){
    const p=new THREE.Vector3(source.x,level+surface.height,source.z).addScaledVector(sun,i*.3);
    if(p.y<level+sampleOceanWave(p.x,p.z,time).height)return null;
  }

  const glass = refractRay(water.direction, new THREE.Vector3(0, 0, -1), 1.333, 1.5);
  if (!glass || glass.direction.z <= 1e-8) return null;
  const glassDistance = (PANE_AIR_Z - PANE_WATER_Z) / glass.direction.z;
  const airFace = waterFace.addScaledVector(glass.direction, glassDistance);
  if (!inOpening(airFace)) return null;
  const air = refractRay(glass.direction, new THREE.Vector3(0, 0, -1), 1.5, 1);
  if (!air) return null;
  const frameFront=airFace.clone().addScaledVector(air.direction,(-4.75-airFace.z)/air.direction.z);
  if(!inOpening(frameFront))return null;

  const candidates: Array<{receiver: OceanPhotonReceiver; t: number}> = [];
  if (air.direction.y < -1e-8) candidates.push({receiver: 'floor', t: (ROOM.floorY - airFace.y) / air.direction.y});
  if (air.direction.x < -1e-8) candidates.push({receiver: 'left', t: (ROOM.minX - airFace.x) / air.direction.x});
  if (air.direction.x > 1e-8) candidates.push({receiver: 'right', t: (ROOM.maxX - airFace.x) / air.direction.x});
  const backT = air.direction.z > 1e-8 ? (ROOM.maxZ - airFace.z) / air.direction.z : Infinity;
  let selected: {receiver: OceanPhotonReceiver; t: number} | undefined;
  for (const candidate of candidates) {
    if (!(candidate.t > 0) || candidate.t >= backT || (selected && candidate.t >= selected.t)) continue;
    const p = airFace.clone().addScaledVector(air.direction, candidate.t);
    const valid = candidate.receiver === 'floor'
      ? p.x >= ROOM.minX && p.x <= ROOM.maxX && p.z >= ROOM.minZ && p.z <= ROOM.maxZ
      : p.y >= ROOM.floorY && p.y <= ROOM.maxY && p.z >= ROOM.minZ && p.z <= ROOM.maxZ;
    if (valid) selected = candidate;
  }
  if (!selected) return null;
  // Keep the air-side pane position: this is the start of the valid indoor path.
  const entry = airFace.clone();
  const position = entry.clone().addScaledVector(air.direction, selected.t);
  const waterLength = toWaterFace;
  const energy = attenuate(waterLength).multiplyScalar(water.transmission * glass.transmission * air.transmission);
  return {receiver: selected.receiver, entry, position, energy};
}

type ReceiverTexture = {data: Float32Array; width: number; height: number; texture: THREE.DataTexture;};
function createTexture(width: number, height: number): ReceiverTexture {
  const data = new Float32Array(width * height * 4);
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return {data, width, height, texture};
}
function clear(texture: ReceiverTexture) { texture.data.fill(0); }
const VOLUME = {width: 32, height: 20, depth: 48, min: new THREE.Vector3(ROOM.minX, ROOM.floorY, ROOM.minZ), max: new THREE.Vector3(ROOM.maxX, ROOM.maxY, ROOM.maxZ)};
function splatVolume(data: Float32Array, point: THREE.Vector3, value: number) {
  const u=(point.x-VOLUME.min.x)/(VOLUME.max.x-VOLUME.min.x)*(VOLUME.width-1);
  const v=(point.y-VOLUME.min.y)/(VOLUME.max.y-VOLUME.min.y)*(VOLUME.height-1);
  const w=(point.z-VOLUME.min.z)/(VOLUME.max.z-VOLUME.min.z)*(VOLUME.depth-1);
  const x0=Math.floor(u),y0=Math.floor(v),z0=Math.floor(w),fx=u-x0,fy=v-y0,fz=w-z0;
  for(let dz=0;dz<=1;dz++)for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++){
    const x=x0+dx,y=y0+dy,z=z0+dz;
    if(x<0||y<0||z<0||x>=VOLUME.width||y>=VOLUME.height||z>=VOLUME.depth)continue;
    const weight=(dx?fx:1-fx)*(dy?fy:1-fy)*(dz?fz:1-fz);
    data[(z*VOLUME.height+y)*VOLUME.width+x]+=value*weight;
  }
}
function splat(texture: ReceiverTexture, u: number, v: number, energy: THREE.Vector3, area: number) {
  const x=THREE.MathUtils.clamp(u,0,1)*(texture.width-1),y=THREE.MathUtils.clamp(v,0,1)*(texture.height-1);
  const x0=Math.round(x),y0=Math.round(y);
  // Finite reconstruction footprint, normalized including receiver edges.
  let total=0;
  for(let oy=-3;oy<=3;oy++)for(let ox=-3;ox<=3;ox++){
    const ix=x0+ox,iy=y0+oy;if(ix<0||iy<0||ix>=texture.width||iy>=texture.height)continue;
    total+=Math.exp(-((ix-x)**2+(iy-y)**2)/(2*1.25**2));
  }
  for(let oy=-3;oy<=3;oy++)for(let ox=-3;ox<=3;ox++){
    const ix=x0+ox,iy=y0+oy;if(ix<0||iy<0||ix>=texture.width||iy>=texture.height)continue;
    const weight=Math.exp(-((ix-x)**2+(iy-y)**2)/(2*1.25**2))/total;
    const i=(iy*texture.width+ix)*4,scale=weight/area;
    texture.data[i]+=energy.x*scale;texture.data[i+1]+=energy.y*scale;texture.data[i+2]+=energy.z*scale;texture.data[i+3]+=weight;
  }
}

export function createOceanPhotonMap() {
  const floor = createTexture(192, 256), left = createTexture(256, 128), right = createTexture(256, 128);
  const volumeData=new Float32Array(VOLUME.width*VOLUME.height*VOLUME.depth);
  const volume=new THREE.Data3DTexture(volumeData,VOLUME.width,VOLUME.height,VOLUME.depth);
  volume.format=THREE.RedFormat;volume.type=THREE.FloatType;volume.colorSpace=THREE.NoColorSpace;
  volume.minFilter=THREE.LinearFilter;volume.magFilter=THREE.LinearFilter;volume.generateMipmaps=false;volume.needsUpdate=true;
  const voxelVolume=(VOLUME.max.x-VOLUME.min.x)*(VOLUME.max.y-VOLUME.min.y)*(VOLUME.max.z-VOLUME.min.z)/(VOLUME.width*VOLUME.height*VOLUME.depth);
  const stats: OceanPhotonStats = {emitted: 0, transmitted: 0, received: 0, unreceived: 0, rays: 0, updates: 0};
  let disposed = false, lastTime = -Infinity, lastLevel = NaN, lastQuality = false;
  const lastSun = new THREE.Vector3(NaN, NaN, NaN);
  const update = (time: number, level: number, sun: THREE.Vector3, lowQuality = false) => {
    if (disposed) return;
    const changed = level !== lastLevel || lowQuality !== lastQuality || !sun.equals(lastSun);
    if (!changed && time >= lastTime && time - lastTime < 1 / 15 - 1e-7) return;
    lastTime = time; lastLevel = level; lastQuality = lowQuality; lastSun.copy(sun);
    clear(floor); clear(left); clear(right); volumeData.fill(0);
    Object.assign(stats, {emitted: 0, transmitted: 0, received: 0, unreceived: 0, rays: 0});
    const nx = lowQuality ? 64 : 128, nz = lowQuality ? 48 : 96;
    const xEdge=(i:number)=>{const q=i/nx*2-1;return Math.sign(q)*Math.abs(q)**1.6*SOURCE.maxX;};
    const zEdge=(i:number)=>SOURCE.maxZ-(SOURCE.maxZ-SOURCE.minZ)*(i/nz)**2.5;
    const direction = sun.clone().negate().normalize();
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const x0=xEdge(ix),x1=xEdge(ix+1),z0=zEdge(iz),z1=zEdge(iz+1);
      const horizontalArea=(x1-x0)*(z0-z1);
      const source = new THREE.Vector3((x0+x1)/2,0,(z0+z1)/2);
      const w = wave(source.x, source.z, time, false), normal = new THREE.Vector3(-w.dx, 1, -w.dz).normalize();
      const flux = horizontalArea * Math.max(0, -direction.dot(normal)) / normal.y;
      if (!(flux > 0)) continue;
      stats.emitted += flux; stats.rays++;
      const hit = traceOceanPhoton(source, sun, time, level);
      if (!hit) { stats.unreceived += flux; continue; }
      const fluxEnergy = hit.energy.multiplyScalar(flux);
      // Deliberately no depletion: sparse dust uses this fluence-like guide only,
      // not a full volumetric multiple-scattering or GI solution.
      const segment=hit.position.clone().sub(hit.entry),distance=segment.length();
      if(distance>0){
        const steps=Math.max(1,Math.ceil(distance/.3)),scalar=(fluxEnergy.x+fluxEnergy.y+fluxEnergy.z)/3;
        for(let step=0;step<steps;step++){
          const p=hit.entry.clone().addScaledVector(segment,(step+.5)/steps);
          splatVolume(volumeData,p,scalar*(distance/steps)/voxelVolume);
        }
      }
      const receiver = hit.receiver === 'floor' ? floor : hit.receiver === 'left' ? left : right;
      let u: number, v: number, cellArea: number;
      if (hit.receiver === 'floor') { u = (hit.position.x - ROOM.minX) / (ROOM.maxX - ROOM.minX); v = (hit.position.z - ROOM.minZ) / (ROOM.maxZ - ROOM.minZ); cellArea = (ROOM.maxX - ROOM.minX) * (ROOM.maxZ - ROOM.minZ) / (floor.width * floor.height); }
      else { u = (hit.position.z - ROOM.minZ) / (ROOM.maxZ - ROOM.minZ); v = (hit.position.y - ROOM.floorY) / (ROOM.maxY - ROOM.floorY); cellArea = (ROOM.maxZ - ROOM.minZ) * (ROOM.maxY - ROOM.floorY) / (receiver.width * receiver.height); }
      splat(receiver, u, v, fluxEnergy, cellArea);
      const power = (fluxEnergy.x + fluxEnergy.y + fluxEnergy.z) / 3;
      stats.transmitted += power; stats.received += power;stats.unreceived+=Math.max(0,flux-power);
    }
    floor.texture.needsUpdate = left.texture.needsUpdate = right.texture.needsUpdate = volume.needsUpdate = true;
    stats.updates++;
  };
  return {textures: {floor: floor.texture, left: left.texture, right: right.texture}, volume, update, dispose() { if (disposed) return; disposed = true; floor.texture.dispose(); left.texture.dispose(); right.texture.dispose(); volume.dispose(); }, stats};
}
