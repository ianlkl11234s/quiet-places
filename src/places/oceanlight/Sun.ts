import * as THREE from 'three';

// An art-directed solar trajectory, not a geographic/astronomical ephemeris.
// Shared by sky, sea specular, aperture direct light and the photon solver.
export function oceanSunDirection(angle:number){
  return new THREE.Vector3(.12+angle*.16,Math.max(.12,.90-Math.abs(angle)*.95),-1).normalize();
}
