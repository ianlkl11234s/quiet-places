import * as THREE from 'three';

export interface StingrayMotionSample {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  /** Horizontal path speed in metres per second; an art-directed value. */
  speed: number;
  finPhase: number;
  finAmplitude: number;
  /** Signed horizontal turn demand, suitable for tail articulation. */
  turn: number;
  /** Heading angular velocity in radians per second, with wrap removed. */
  yawRate: number;
  /** Broad local roll in radians. */
  bank: number;
}

// The asset is authored facing +Z with +Y up. The Southern rig is 1.34 m across
// (the second instance is 0.9 scale), so the routes retain ample crossing room.
const LOOP_STEPS = 512;
const X_RADIUS = 3.1;
const Z_RADIUS = 2.75;
const CENTRE_Z = [0.0, 2.0] as const;
const RAY_SCALE = [1, .9] as const;
const DISC_LENGTH = 1.117;
const FIN_SLIP = .65;
const FIN_WAVES_PER_LENGTH = 1.25;
const ARC_LENGTHS = buildArcLengths();
const LOOP_LENGTH = ARC_LENGTHS[LOOP_STEPS];

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

/** Gerono's lemniscate, with the two routes placed on separate z lanes. */
function pathPosition(phase: number, index: 0 | 1, target = new THREE.Vector3()): THREE.Vector3 {
  const u = phase + index * Math.PI;
  return target.set(
    X_RADIUS * Math.sin(u),
    .47 + .05 * Math.sin(u - 0.72),
    CENTRE_Z[index] + Z_RADIUS * Math.sin(2 * u),
  );
}

function buildArcLengths(): Float64Array {
  const lengths = new Float64Array(LOOP_STEPS + 1);
  let total = 0;
  const previous = pathPosition(0, 0);
  const next = new THREE.Vector3();
  for (let step = 1; step <= LOOP_STEPS; step++) {
    pathPosition((step / LOOP_STEPS) * Math.PI * 2, 0, next);
    total += next.distanceTo(previous);
    lengths[step] = total;
    previous.copy(next);
  }
  return lengths;
}

// A raised cosine cubed gives short, smooth drive pulses without hard starts.
function surgeAmount(time: number): number {
  const wave = (1 + Math.sin(time * Math.PI * 2 / 29.6)) * 0.5;
  return wave * wave * wave;
}

function travelledDistance(elapsed: number, index: 0 | 1): number {
  const period = 29.6;
  const omega = Math.PI * 2 / period;
  const offset = index * 1.91;
  const t = elapsed + offset;
  // Integral of ((1 + sin(omega*t)) / 2)^3.  This makes path speed agree with
  // the returned surge profile instead of speeding up at arbitrary figure-eight
  // control points.
  const integral = (time: number) => .3125 * time
    - .46875 * Math.cos(omega * time) / omega
    - .09375 * Math.sin(2 * omega * time) / omega
    + (1 / 96) * Math.cos(3 * omega * time) / omega;
  return .20 * elapsed + .28 * (integral(t) - integral(offset));
}

function phaseAtDistance(distance: number): number {
  let lo = 0, hi = Math.PI * 2;
  const wanted = modulo(distance, LOOP_LENGTH);
  // The monotonic chord-length approximation is enough to remove the visibly
  // uneven parameter speed while keeping the sampler pure and allocation-light.
  for (let iteration = 0; iteration < 22; iteration++) {
    const mid = (lo + hi) * .5;
    const fraction = arcFraction(mid);
    if (fraction * LOOP_LENGTH < wanted) lo = mid; else hi = mid;
  }
  return (lo + hi) * .5;
}

function samplePosition(time: number, index: 0 | 1, target = new THREE.Vector3()): {phase: number; distance: number; position: THREE.Vector3} {
  const distance = travelledDistance(time, index);
  const phase = phaseAtDistance(distance);
  pathPosition(phase, index, target);
  // The rise arrives before its drive pulse, then settles while the ray glides.
  target.y += .20 * surgeAmount(time + index * 1.91 + 2.35);
  return {phase, distance, position: target};
}

function wrappedAngleDifference(to: number, from: number): number {
  return modulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
}

function headingAt(time: number, index: 0 | 1): number {
  const before = samplePosition(time - .012, index).position;
  const after = samplePosition(time + .012, index).position;
  return Math.atan2(after.x - before.x, after.z - before.z);
}

function arcFraction(phase: number): number {
  const scaled = phase / (Math.PI * 2) * LOOP_STEPS;
  const full = Math.floor(scaled);
  const fraction = scaled - full;
  const length = ARC_LENGTHS[full] + fraction * (ARC_LENGTHS[Math.min(full + 1, LOOP_STEPS)] - ARC_LENGTHS[full]);
  return length / LOOP_LENGTH;
}

/**
 * Samples a pure time-based, near-floor figure-eight route for one of two rays.
 * Supplying an unchanged elapsed value freezes the result exactly.
 */
export function sampleStingrayMotion(elapsed: number, index: 0 | 1): StingrayMotionSample {
  const time = Number.isFinite(elapsed) ? elapsed : 0;
  const state = samplePosition(time, index);
  const surge = surgeAmount(time + index * 1.91);
  const position = state.position;
  // Sample the complete path in time so a surge's short lift is also reflected
  // in pitch.  This is still a pure function: no prior-frame state is used.
  const before = samplePosition(time - .01, index).position;
  const after = samplePosition(time + .01, index).position;
  const tangent = after.sub(before).normalize();
  const yaw = Math.atan2(tangent.x, tangent.z);
  const pitch = -Math.asin(THREE.MathUtils.clamp(tangent.y, -1, 1));
  const headingBefore = headingAt(time - .02, index);
  const headingAfter = headingAt(time + .02, index);
  const yawRate = wrappedAngleDifference(headingAfter, headingBefore) / .04;
  const turn = THREE.MathUtils.clamp(yawRate / .55, -1, 1);
  const bank = THREE.MathUtils.clamp(turn * .075, -.085, .085);
  // YXZ keeps yaw, velocity-derived pitch, and local roll explicit.  It avoids
  // setFromUnitVectors' 180-degree ambiguity when the ray heads along -Z.
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, bank, 'YXZ'));
  const speed = .20 + .28 * surge;
  // The caller applies this unitless multiplier to its roughly 0.1 m fin morph.
  return {
    position, quaternion, speed,
    // Distance is unwrapped, so phase never pops at a path lap. The smaller
    // ray has a shorter 1.117 m-scale disc length and therefore a matching
    // higher fin cadence at the same swim speed; .65 is art calibration.
    finPhase: state.distance * Math.PI * 2 * FIN_WAVES_PER_LENGTH / (DISC_LENGTH * RAY_SCALE[index] * FIN_SLIP) + index * 1.37,
    finAmplitude: .8 + .3 * surge,
    turn, yawRate, bank,
  };
}
