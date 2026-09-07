import * as THREE from 'three';

const TAU = Math.PI * 2;
const PERIOD = 78;
const SAMPLES = 1024;
const LENGTHS = [.92, .86, 1] as const;
const HEIGHTS = [.28, .25, .31] as const;
const PHASES = [.3, 2.1, 4.5] as const;

export type KoiIndex = 0 | 1 | 2;

function point(u: number, index: KoiIndex): THREE.Vector3 {
  return new THREE.Vector3(
    -1.65 + 1.22 * Math.cos(u) + .13 * Math.sin(2 * u + PHASES[index]),
    0,
    -1.15 + 1.35 * Math.sin(u),
  );
}

const arcs = LENGTHS.map((_, index) => {
  const lengths = new Float64Array(SAMPLES + 1);
  let previous = point(0, index as KoiIndex);
  for (let i = 1; i <= SAMPLES; i++) {
    const next = point(i / SAMPLES * TAU, index as KoiIndex);
    lengths[i] = lengths[i - 1] + previous.distanceTo(next);
    previous = next;
  }
  return lengths;
});

function distanceAt(u: number, index: KoiIndex): number {
  const laps = Math.floor(u / TAU);
  const fraction = (u / TAU - laps) * SAMPLES;
  const cell = Math.min(SAMPLES - 1, Math.floor(fraction));
  const arc = arcs[index];
  return laps * arc[SAMPLES] + arc[cell] + (arc[cell + 1] - arc[cell]) * (fraction - cell);
}

function samplePath(time: number, index: KoiIndex) {
  const phase = PHASES[index];
  const start = 1.93 + index * TAU / 3;
  // Small independent speed changes keep the circuit calm without a rigid
  // three-fish formation. Absolute time makes reverse seeking reproducible.
  const u = start + time * TAU / PERIOD
    + .08 * (Math.sin(time * TAU / 31 + phase) - Math.sin(phase));
  const du = TAU / PERIOD + .08 * TAU / 31 * Math.cos(time * TAU / 31 + phase);
  const position = point(u, index);
  position.y = HEIGHTS[index] + .012 * Math.sin(time * TAU / 19 + phase)
    + .009 * Math.sin(time * TAU / 37 + phase);
  const velocity = new THREE.Vector3(
    (-1.22 * Math.sin(u) + .26 * Math.cos(2 * u + phase)) * du,
    .012 * TAU / 19 * Math.cos(time * TAU / 19 + phase)
      + .009 * TAU / 37 * Math.cos(time * TAU / 37 + phase),
    1.35 * Math.cos(u) * du,
  );
  return {position, velocity, distance: distanceAt(u, index) - distanceAt(start, index)};
}

/** Scene choreography in metres/seconds, not a hydrodynamic or schooling model. */
export function sampleKoiMotion(elapsed: number, index: KoiIndex) {
  const time = Number.isFinite(elapsed) ? elapsed : 0;
  const state = samplePath(time, index);
  const direction = state.velocity.clone().normalize();
  // Blender +Y forward becomes glTF -Z forward, with dorsal +Y after export.
  const yaw = Math.atan2(-direction.x, -direction.z);
  const before = samplePath(time - .02, index).velocity;
  const after = samplePath(time + .02, index).velocity;
  const delta = Math.atan2(after.x, after.z) - Math.atan2(before.x, before.z);
  const yawRate = Math.atan2(Math.sin(delta), Math.cos(delta)) / .04;
  const turn = THREE.MathUtils.clamp(yawRate / .25, -1, 1);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1)), yaw, -turn * .025, 'YXZ',
  ));
  return {
    position: state.position, quaternion, turn,
    speed: state.velocity.length(), length: LENGTHS[index],
    // A visual stride of 17% displayed length per beat links the tail clock
    // to distance. The exported hero action contains nine beats in 12 s.
    animationTime: state.distance / (.17 * LENGTHS[index] * .75) + PHASES[index],
  };
}
