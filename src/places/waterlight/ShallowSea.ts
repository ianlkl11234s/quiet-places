import * as THREE from 'three';

export const SHALLOW_SEA_BOTTOM = 7;
export const SHALLOW_SEA_DEPTH = .8;

// Waterlight keeps its accepted left/back wall composition. The vector points
// from the room toward the sun and is used by every visible and lighting pass.
export function shallowSeaSunDirection(angle: number) {
  return new THREE.Vector3(
    .45 - Math.sin(angle) * .14,
    1,
    .30 - Math.sin(angle * .7) * .10,
  ).normalize();
}
