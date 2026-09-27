import * as THREE from 'three';

/**
 * Shared fish steering (Q1-3a), extracted from the SharkMotion.ts:173-235
 * template. Everything here is kinematic art direction, not hydrodynamics.
 *
 * Conventions (all consumers):
 * - Three.js Y-up, model nose along local -Z, dorsal +Y, fish's left = -X.
 * - yaw: radians about world +Y, 0 = nose toward -Z; positive = turning left
 *   (counter-clockwise seen from above). `yaw = atan2(-dir.x, -dir.z)`.
 * - pitch: radians, positive = nose up. `pitch = asin(dir.y)`.
 * - yawRate: rad/s, same sign as yaw.
 * - bank: radians of roll about the nose axis (Euler 'YXZ' third component).
 *   Positive bank tilts the dorsal side toward the fish's left. Fish bank into
 *   the turn, so a left turn (yawRate > 0) produces bank > 0; this matches the
 *   sign of SharkMotion's `bank` measured in world space (tests verify it).
 * - bend: signed C-shape tail offset in body lengths (BL) at the tail tip,
 *   toward local +X (the fish's right). The body follows the arc, so in a
 *   left turn the tail lies inside the turn: bend < 0 (again as the shark).
 */

export interface TurnPoseParams {
  /** Maximum roll into the turn, rad. */
  maxBank: number;
  /** Maximum tail-tip C-bend, body lengths. */
  maxBend: number;
  /** Yaw rate (rad/s) at which tanh() reaches ~76% of the maxima. */
  yawRateScale: number;
}

export interface TurnPose {
  /** Normalised turn strength, -1..1, positive = left. */
  turn: number;
  bank: number;
  bend: number;
}

/** Stateless yaw-rate -> bank + C-bend mapping. Pure: equal input, equal output. */
export function turnPose(yawRate: number, params: TurnPoseParams): TurnPose {
  const rate = Number.isFinite(yawRate) ? yawRate : 0;
  const scale = Math.max(1e-6, params.yawRateScale);
  const turn = Math.tanh(rate / scale);
  return {turn, bank: params.maxBank * turn, bend: -params.maxBend * turn};
}

export interface HeadingParams extends TurnPoseParams {
  /** Hard cap on |yawRate|, rad/s. */
  maxYawRate: number;
  /** Yaw error time constant, s. The step uses yawError*(1-exp(-dt/tau)). */
  yawTau: number;
  /** Presented body pitch is clamped to +/- this, rad. */
  maxPitch: number;
  /** Hard cap on |pitch rate|, rad/s. */
  maxPitchRate: number;
  /** Pitch error time constant, s. */
  pitchTau: number;
  /**
   * Below `holdSpeed` (m/s) the heading is held (no yaw toward velocity, pitch
   * relaxes toward level); above `trackSpeed` it fully tracks. 0/0 disables.
   */
  holdSpeed: number;
  trackSpeed: number;
  /** Bank/bend smoothing time constant, s. 0 = follow instantly. */
  bankTau: number;
}

export interface HeadingState {
  yaw: number;
  pitch: number;
  /** Actual yaw rate of the last step, rad/s (after caps). */
  yawRate: number;
  bank: number;
  bend: number;
}

export function yawOf(direction: THREE.Vector3): number { return Math.atan2(-direction.x, -direction.z); }
export function pitchOf(direction: THREE.Vector3): number {
  const length = direction.length();
  return length > 1e-12 ? Math.asin(THREE.MathUtils.clamp(direction.y / length, -1, 1)) : 0;
}
export function wrapAngle(angle: number): number { return Math.atan2(Math.sin(angle), Math.cos(angle)); }

export function createHeadingState(direction: THREE.Vector3, maxPitch = Math.PI / 2): HeadingState {
  const valid = direction.lengthSq() > 1e-12;
  return {yaw: valid ? yawOf(direction) : 0, pitch: valid ? THREE.MathUtils.clamp(pitchOf(direction), -maxPitch, maxPitch) : 0, yawRate: 0, bank: 0, bend: 0};
}

/** 0 at/below holdSpeed, 1 at/above trackSpeed (smoothstep). */
export function trackingWeight(speed: number, params: Pick<HeadingParams, 'holdSpeed' | 'trackSpeed'>): number {
  if (!(params.trackSpeed > params.holdSpeed)) return 1;
  return THREE.MathUtils.smoothstep(Number.isFinite(speed) ? speed : 0, params.holdSpeed, params.trackSpeed);
}

/**
 * One fixed step of the heading controller. Pure: returns a new state.
 * `desired` is the direction the body should face (usually velocity); its
 * length is ignored. `speed` (m/s) only gates heading hold. `dt` in seconds.
 */
export function stepHeading(state: HeadingState, desired: THREE.Vector3, speed: number, dt: number, params: HeadingParams): HeadingState {
  if (!(dt > 0) || !Number.isFinite(dt)) return {...state};
  const track = desired.lengthSq() > 1e-12 ? trackingWeight(speed, params) : 0;
  let yawStep = 0;
  if (track > 0) {
    const error = wrapAngle(yawOf(desired) - state.yaw);
    const limit = params.maxYawRate * dt;
    yawStep = THREE.MathUtils.clamp(error * (1 - Math.exp(-dt / params.yawTau)) * track, -limit, limit);
  }
  // Holding fish level out: a hovering body is not left pointing up or down.
  const targetPitch = THREE.MathUtils.clamp(track > 0 ? pitchOf(desired) * track : 0, -params.maxPitch, params.maxPitch);
  const pitchLimit = params.maxPitchRate * dt;
  const pitch = THREE.MathUtils.clamp(
    state.pitch + THREE.MathUtils.clamp((targetPitch - state.pitch) * (1 - Math.exp(-dt / params.pitchTau)), -pitchLimit, pitchLimit),
    -params.maxPitch, params.maxPitch);
  const yawRate = yawStep / dt;
  const target = turnPose(yawRate, params);
  const follow = params.bankTau > 0 ? 1 - Math.exp(-dt / params.bankTau) : 1;
  return {
    yaw: wrapAngle(state.yaw + yawStep), pitch, yawRate,
    bank: state.bank + (target.bank - state.bank) * follow,
    bend: state.bend + (target.bend - state.bend) * follow,
  };
}

export interface SlipParams {
  /** Largest horizontal angle between travel and nose while tracking, rad. */
  maxSlip: number;
  /** Largest climb/descent angle of travel while tracking, rad (>= maxPitch). */
  maxClimb: number;
}

const HORIZONTAL = new THREE.Vector3();
/**
 * Fish propel along the body: once a fish is tracking (speed above holdSpeed)
 * its travel may only deviate from the nose by `maxSlip` horizontally and
 * climb at most `maxClimb`. Speed magnitude is preserved. Below holdSpeed the
 * velocity is untouched (slow drift while the heading holds). Mutates and
 * returns `velocity`.
 */
export function constrainTravelToHeading(velocity: THREE.Vector3, state: HeadingState, params: SlipParams & Pick<HeadingParams, 'holdSpeed' | 'trackSpeed'>): THREE.Vector3 {
  const speed = velocity.length();
  const track = trackingWeight(speed, params);
  if (track <= 0 || speed < 1e-9) return velocity;
  const slip = THREE.MathUtils.lerp(Math.PI, params.maxSlip, track);
  const climb = THREE.MathUtils.lerp(Math.PI / 2, params.maxClimb, track);
  HORIZONTAL.set(velocity.x, 0, velocity.z);
  const horizontal = HORIZONTAL.length();
  const travelYaw = horizontal > 1e-12 ? Math.atan2(-velocity.x, -velocity.z) : state.yaw;
  const yaw = state.yaw + THREE.MathUtils.clamp(wrapAngle(travelYaw - state.yaw), -slip, slip);
  const pitch = THREE.MathUtils.clamp(Math.atan2(velocity.y, horizontal), -climb, climb);
  return velocity.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(speed);
}

const EULER = new THREE.Euler(0, 0, 0, 'YXZ');
/** Body quaternion for a -Z-nose model: yaw, then pitch, then bank about the nose. */
export function headingQuaternion(state: Pick<HeadingState, 'yaw' | 'pitch' | 'bank'>, target = new THREE.Quaternion()): THREE.Quaternion {
  return target.setFromEuler(EULER.set(state.pitch, state.yaw, state.bank, 'YXZ'));
}
