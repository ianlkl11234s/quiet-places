import * as THREE from 'three';
import {seededRandom} from '../../shared/math/seededRandom.ts';
import {constrainTravelToHeading, createHeadingState, headingQuaternion, stepHeading, tailBeatFrequency, type TailBeatParams, type HeadingParams, type HeadingState, type SlipParams} from '../../shared/biology/locomotion/index.ts';
import {WATER_ROOM} from './Room.ts';
import {shallowSeaSunDirection} from './ShallowSea.ts';

/** The web shoal is an art-directed kinematic approximation, not collision or fluid simulation. */
export const LONG_FIN_KOI_COUNT = 16;
export const LONG_FIN_KOI_STEP = 1 / 60;
export const LONG_FIN_KOI_LENGTHS = [.28, .37, .31, .42, .34, .45, .39, .32, .40, .29, .36, .43, .33, .41, .30, .38] as const;

export type LongFinKoiBehavior = 'hover' | 'slow' | 'glide' | 'left' | 'right' | 'rise' | 'descend' | 'pause';

export type LongFinKoiPose = {
  index: number;
  length: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  quaternion: THREE.Quaternion;
  behavior: LongFinKoiBehavior;
  actionClock: number;
  motionPhase: number;
  burst: number;
  /** Actual presented yaw rate, rad/s; positive = turning left. */
  yawRate: number;
  /** Roll into the turn, rad (shared locomotion convention). */
  bank: number;
  /** Normalised actual turn strength, -1..1, positive = left; drives TURN_* clips. */
  turn: number;
  /** Smoothed C-bend from the shared steering, body lengths at the tail tip (negative = tail toward fish-left). */
  bend: number;
};

/**
 * B2-2 candidate (art calibration): drive the animation clock from the shared tail-beat
 * relation f = f0 + U/(k*BL) so small fish beat faster than large ones. f0 = .65 and
 * k are chosen so that the school-average clock rate at any common speed equals the
 * former `.65 + 6.5*U` (k uses the harmonic-mean body length of the 16 fish).
 * Revert = set false (the former clock is kept verbatim).
 */
export const KOI_BODY_LENGTH_FREQUENCY = true;
const HARMONIC_LENGTH = LONG_FIN_KOI_LENGTHS.length / LONG_FIN_KOI_LENGTHS.reduce((sum, length) => sum + 1 / length, 0);
export const LONG_FIN_KOI_TAIL_BEAT: TailBeatParams = {f0: .65, k: 1 / (6.5 * HARMONIC_LENGTH), maxFrequency: 4};

/**
 * B1a candidate (art calibration): the pointer ray makes nearby fish notice a shadow.
 * 0 = off (no state is touched, output unchanged), 1 = full strength; default .5.
 * Moving: fish within 2.5 body lengths of the ray steer away by up to .03 m/s of
 * desired velocity (x response), fading to nothing 2 s after the pointer stops.
 * Tap: up to two fish within 3 body lengths take one existing burst, 6 s cooldown;
 * every fish within 4 body lengths is alerted (radius and push enlarged for 3 s).
 * The push is added before the beam/wall return forces, so activity bounds hold.
 */
export const KOI_POINTER_RESPONSE = .5;
export const KOI_POINTER = {hoverRadius: 2.5, tapRadius: 3, alertRadius: 4, push: .03, burstPush: .05, holdTime: .5, idleTime: 2, cooldown: 6, alertTime: 3, burstDuration: 4} as const;

export type LongFinKoiOptions = {bodyLengthFrequency?: boolean; pointerResponse?: number};

export type LongFinKoiSchool = {
  /** Borrowed ray: values are copied. `undefined` = pointer left. */
  pointerRay: (ray: THREE.Ray | undefined, tap: boolean) => void;
  update: (dt: number, lighting?: {angle?: number; activity?: number; reducedMotion?: boolean}) => void;
  poses: () => readonly LongFinKoiPose[];
  inspect: () => {steps: number; finite: boolean; maxSpeed: number; maxBeamRadius: number; minSpacing: number; pointerAlert: number};
};

type Fish = LongFinKoiPose & {heading: HeadingState; preferredHeight: number; preferredSpeed: number; nextChange: number; phase: number; nextBurst: number; burstStart: number; burstDuration: number; startled: boolean};

const UP = new THREE.Vector3(0, 1, 0);
const DEG = Math.PI / 180;
/**
 * Q0-6 candidate (art calibration). Below ~1 cm/s the heading holds instead of
 * spinning on the spot; yaw is capped at 40 deg/s, pitch at +/-20 deg, and the
 * actual yaw rate produces up to 8 deg of bank. While tracking, travel stays
 * within 30 deg of the nose (climb <= 30 deg) so the fish turns through its
 * heading instead of sliding sideways. Steering forces are unchanged. Revert =
 * restore the former slerp(rate 70/s) toward velocity and drop the travel clamp.
 */
export const LONG_FIN_KOI_HEADING: HeadingParams & SlipParams = {
  maxSlip: 30 * DEG, maxClimb: 30 * DEG,
  maxYawRate: 40 * DEG, yawTau: .25,
  maxPitch: 20 * DEG, maxPitchRate: 20 * DEG, pitchTau: .6,
  holdSpeed: .010, trackSpeed: .022,
  maxBank: 8 * DEG, maxBend: .06, yawRateScale: 35 * DEG, bankTau: .4,
};

function clampFinite(value: number | undefined, fallback = 0) { return Number.isFinite(value) ? value! : fallback; }
function beamCenter(height: number, angle: number, target = new THREE.Vector3()) {
  // This is the same ceiling-to-room projection used by Waterlight's shallow
  // sea light field: the moving shoal follows the slanted light, not an
  // unrelated world-origin cylinder.
  const sun = shallowSeaSunDirection(angle);
  return target.set((height - 7) * sun.x / sun.y, height, -.2 + (height - 7) * sun.z / sun.y);
}
function beamRadius(position: THREE.Vector3, angle: number) {
  const center = beamCenter(position.y, angle);
  return Math.hypot((position.x - center.x) / 1.60, (position.z - center.z) / 1.25);
}
// Four staggered visitors range beyond the illuminated aperture, then return.
function excursionOffset(index: number, time: number, target: THREE.Vector3) {
  target.set(0, 0, 0);
  if (index % 4 !== 1) return target;
  const visitor = Math.floor(index / 4);
  const phase = time * (Math.PI * 2 / (100 + visitor * 13)) + visitor * 1.7;
  const reach = (1 - Math.cos(phase)) * .5 * 2.8;
  const angle = [-.35, .40, 1.12, .75][visitor];
  return target.set(Math.cos(angle) * reach, 0, Math.sin(angle) * reach);
}
function chooseBehavior(random: () => number, previous: LongFinKoiBehavior) {
  // Hovering and gentle cruise dominate, while each of the eight states remains reachable.
  const weights: readonly [LongFinKoiBehavior, number][] = [
    ['hover', .20], ['slow', .27], ['glide', .15], ['left', .09], ['right', .09], ['rise', .07], ['descend', .07], ['pause', .06],
  ];
  let pick = random();
  for (const [behavior, weight] of weights) {
    pick -= weight;
    if (pick <= 0 && behavior !== previous) return behavior;
  }
  return previous === 'slow' ? 'hover' : 'slow';
}

/**
 * A deterministic fixed-step loose shoal. Callers own its clock: `dt === 0`
 * deliberately changes neither steering state nor fin/action phase.
 */
export function createLongFinKoiSchool(seed = 0x1f2e3d4c, options: LongFinKoiOptions = {}): LongFinKoiSchool {
  const lengthFrequency = options.bodyLengthFrequency ?? KOI_BODY_LENGTH_FREQUENCY;
  const response = THREE.MathUtils.clamp(clampFinite(options.pointerResponse, KOI_POINTER_RESPONSE), 0, 1);
  const random = seededRandom(seed);
  const fish: Fish[] = LONG_FIN_KOI_LENGTHS.map((length, index) => {
    const height = 2.45 + index / (LONG_FIN_KOI_COUNT - 1) * 1.86 + (random() - .5) * .10;
    const center = beamCenter(height, 0).add(excursionOffset(index, 0, new THREE.Vector3()));
    const theta = index * Math.PI * (3 - Math.sqrt(5)) + .22;
    const position = center.add(new THREE.Vector3(Math.cos(theta) * (.68 + random() * .38), 0, Math.sin(theta) * (.52 + random() * .30)));
    const heading = theta + Math.PI * .5 + (random() - .5) * .45;
    const velocity = new THREE.Vector3(Math.cos(heading), (random() - .5) * .06, Math.sin(heading)).multiplyScalar(.048 + random() * .012);
    const bodyHeading = createHeadingState(velocity, LONG_FIN_KOI_HEADING.maxPitch);
    const quaternion = headingQuaternion(bodyHeading);
    return {index, length, position, velocity, quaternion, heading: bodyHeading, yawRate: 0, bank: 0, turn: 0, bend: 0, startled: false, behavior: index % 3 === 0 ? 'hover' : 'slow', actionClock: random() * 8, motionPhase: random() * Math.PI * 2,
      burst: 0, nextBurst: 4 + index * 2.1 + random() * 8, burstStart: -10, burstDuration: 0,
      preferredHeight: height, preferredSpeed: .044 + random() * .022, nextChange: 4 + random() * 8, phase: random() * Math.PI * 2};
  });
  let accumulator = 0, simulationTime = 0, steps = 0, lastAngle = 0;
  const center = new THREE.Vector3(), desired = new THREE.Vector3(), separation = new THREE.Vector3(), alignment = new THREE.Vector3();
  const excursion = new THREE.Vector3();
  // Pointer awareness state (only touched when response > 0).
  const pointerOrigin = new THREE.Vector3(), pointerDirection = new THREE.Vector3(0, 0, -1), closest = new THREE.Vector3(), away = new THREE.Vector3();
  let pointerActive = false, pointerIdle = Infinity, tapAlert = 0, lastTapBurst = -Infinity, lastReduced = false;
  const toOther = new THREE.Vector3(), beam = new THREE.Vector3(), horizontal = new THREE.Vector3();

  function step(angle: number, activity: number, reducedMotion: boolean) {
    simulationTime += LONG_FIN_KOI_STEP;
    lastReduced = reducedMotion;
    let alert = 0;
    if (response > 0) {
      pointerIdle += LONG_FIN_KOI_STEP; tapAlert = Math.max(0, tapAlert - LONG_FIN_KOI_STEP / KOI_POINTER.alertTime);
      alert = Math.max(tapAlert, 1 - THREE.MathUtils.smoothstep(pointerIdle, KOI_POINTER.holdTime, KOI_POINTER.idleTime));
    }
    // All boid forces read one time-slice. This removes an index-order bias
    // where early fish had otherwise influenced later fish within one step.
    const positions = fish.map(item => item.position.clone());
    const velocities = fish.map(item => item.velocity.clone());
    // Independent short surges; the shared limit keeps most of the shoal quiet.
    let activeBursts = fish.filter(item => simulationTime < item.burstStart + item.burstDuration).length;
    for (const current of fish) {
      if (!reducedMotion && simulationTime >= current.nextBurst && activeBursts < 2) {
        current.burstStart = simulationTime; current.burstDuration = 3.5 + random() * 2;
        current.nextBurst = simulationTime + 30 + random() * 35; activeBursts++;
      }
      const burstProgress = current.burstDuration > 0 ? (simulationTime - current.burstStart) / current.burstDuration : 1;
      current.burst = !reducedMotion && burstProgress >= 0 && burstProgress < 1 ? Math.sin(Math.PI * burstProgress) ** 2 : 0;
      const currentPosition = positions[current.index];
      const currentVelocity = velocities[current.index];
      if (simulationTime >= current.nextChange) {
        current.behavior = chooseBehavior(random, current.behavior);
        current.nextChange = simulationTime + 4.5 + random() * 8.5;
      }
      const stateSpeed = current.behavior === 'pause' ? .004 : current.behavior === 'hover' ? .017 : current.behavior === 'glide' ? .032 : current.preferredSpeed;
      const speedTarget = Math.min(.07, stateSpeed * (reducedMotion ? .34 : 1) * (.92 + activity * .12));
      center.set(0, 0, 0); separation.set(0, 0, 0); alignment.set(0, 0, 0);
      let neighbours = 0, nearest = Infinity;
      for (const other of fish) {
        if (other === current) continue;
        toOther.copy(positions[other.index]).sub(currentPosition);
        const distance = toOther.length();
        nearest = Math.min(nearest, distance);
        if (distance < 1.05) { center.add(positions[other.index]); alignment.add(velocities[other.index]); neighbours++; }
        if (distance > 1e-5 && distance < .95) {
          // Keep most avoidance lateral so neighbours do not collectively pump
          // one another toward the floor or skylight.
          toOther.y *= .22;
          separation.addScaledVector(toOther, -(.95 - distance) / .95);
        }
      }
      desired.copy(currentVelocity);
      if (desired.lengthSq() < 1e-8) desired.set(0, 0, -1);
      desired.normalize().multiplyScalar(speedTarget);
      horizontal.copy(currentVelocity).setY(0);
      if (horizontal.lengthSq() > 1e-8) desired.addScaledVector(horizontal.normalize(), .23 * current.burst * THREE.MathUtils.smoothstep(nearest, .65, 1.10));
      if (neighbours) {
        center.multiplyScalar(1 / neighbours).sub(currentPosition).multiplyScalar(.012);
        alignment.multiplyScalar(1 / neighbours).sub(currentVelocity).multiplyScalar(.045);
        desired.add(center).add(alignment); // deliberately low alignment: it is not a synchronized school.
      }
      desired.addScaledVector(separation, .52);
      const wanderAngle = simulationTime * (.16 + (current.index % 3) * .017) + current.phase;
      desired.add(new THREE.Vector3(Math.cos(wanderAngle), Math.sin(wanderAngle * .7) * .10, Math.sin(wanderAngle)).multiplyScalar(.016));
      if (response > 0 && pointerActive) pointerPush(current, desired, alert, reducedMotion);
      if (current.behavior === 'left' || current.behavior === 'right') {
        horizontal.copy(current.velocity).setY(0);
        if (horizontal.lengthSq() > 1e-7) desired.addScaledVector(horizontal.normalize().cross(UP), current.behavior === 'left' ? .026 : -.026);
      }
      const heightOffset = current.behavior === 'rise' ? .28 : current.behavior === 'descend' ? -.28 : 0;
      desired.y += THREE.MathUtils.clamp((current.preferredHeight + heightOffset - currentPosition.y) * .15, -.035, .035);
      beam.copy(beamCenter(currentPosition.y, angle)).add(excursionOffset(current.index, simulationTime, excursion));
      beam.x = THREE.MathUtils.clamp(beam.x, WATER_ROOM.minX + 1.1, WATER_ROOM.maxX - 1.1);
      beam.z = THREE.MathUtils.clamp(beam.z, WATER_ROOM.minZ + 1.1, WATER_ROOM.maxZ - 1.1);
      beam.sub(currentPosition); beam.y = 0;
      const radius = Math.hypot(beam.x / 1.60, beam.z / 1.25);
      if (radius > .65) desired.addScaledVector(beam, (.28 + current.burst * .55) * (radius - .65));
      if (currentPosition.y < 2.40) desired.y += (2.40 - currentPosition.y) * .34;
      if (currentPosition.y > 4.78) desired.y -= (currentPosition.y - 4.78) * .34;
      // Soft room avoidance acts on steering, never teleports/clamps a fish.
      for (const axis of ['x', 'z'] as const) {
        const low = axis === 'x' ? WATER_ROOM.minX : WATER_ROOM.minZ;
        const high = axis === 'x' ? WATER_ROOM.maxX : WATER_ROOM.maxZ;
        desired[axis] += Math.max(0, low + .8 - currentPosition[axis]) * .8;
        desired[axis] -= Math.max(0, currentPosition[axis] - high + .8) * .8;
      }
      const maximum = reducedMotion ? .045 : .34;
      if (desired.length() > maximum) desired.setLength(maximum);
      current.velocity.lerp(desired, 1 - Math.exp(-LONG_FIN_KOI_STEP * 1.35));
      if (current.velocity.length() > maximum) current.velocity.setLength(maximum);
      // Shared heading controller: hold at low speed, capped yaw/pitch, bank from actual yaw rate.
      current.heading = stepHeading(current.heading, current.velocity, current.velocity.length(), LONG_FIN_KOI_STEP, LONG_FIN_KOI_HEADING);
      headingQuaternion(current.heading, current.quaternion);
      current.yawRate = current.heading.yawRate; current.bank = current.heading.bank; current.bend = current.heading.bend;
      current.turn = LONG_FIN_KOI_HEADING.maxBank > 0 ? current.heading.bank / LONG_FIN_KOI_HEADING.maxBank : 0;
      constrainTravelToHeading(current.velocity, current.heading, LONG_FIN_KOI_HEADING);
      current.position.addScaledVector(current.velocity, LONG_FIN_KOI_STEP);
      current.actionClock += LONG_FIN_KOI_STEP * (current.behavior === 'pause' && current.burst === 0 ? 1.05
        : lengthFrequency ? tailBeatFrequency(current.velocity.length(), current.length, LONG_FIN_KOI_TAIL_BEAT) : .65 + current.velocity.length() * 6.5);
      current.motionPhase += LONG_FIN_KOI_STEP * (.65 + current.index * .027);
      if (current.startled && current.burst === 0) current.startled = false;
    }
    steps++;
  }

  /** Distance from `point` to the pointer ray (forward half-line); fills `closest`. */
  function rayDistance(point: THREE.Vector3) {
    const t = Math.max(0, toOther.copy(point).sub(pointerOrigin).dot(pointerDirection));
    closest.copy(pointerOrigin).addScaledVector(pointerDirection, t);
    return point.distanceTo(closest);
  }
  function pointerPush(current: Fish, desired: THREE.Vector3, alert: number, reducedMotion: boolean) {
    const radius = current.length * (KOI_POINTER.hoverRadius + (KOI_POINTER.alertRadius - KOI_POINTER.hoverRadius) * tapAlert);
    const distance = rayDistance(current.position);
    const startle = current.startled ? current.burst : 0;
    if ((alert <= 0 && startle <= 0) || distance >= radius) return;
    away.copy(current.position).sub(closest);
    if (away.lengthSq() < 1e-10) away.set(-pointerDirection.z, 0, pointerDirection.x);
    away.y *= .3; away.normalize();
    const near = 1 - distance / radius;
    const strength = response * (KOI_POINTER.push * alert * near * near + KOI_POINTER.burstPush * startle) * (reducedMotion ? .34 : 1);
    desired.addScaledVector(away, strength);
  }

  return {
    update(dt, lighting = {}) {
      const delta = THREE.MathUtils.clamp(clampFinite(dt), 0, .25);
      if (delta === 0) return;
      accumulator += delta;
      const angle = THREE.MathUtils.clamp(clampFinite(lighting.angle), -1.1, 1.1);
      lastAngle = angle;
      const activity = THREE.MathUtils.clamp(clampFinite(lighting.activity, .5), 0, 1);
      while (accumulator + 1e-10 >= LONG_FIN_KOI_STEP) { step(angle, activity, Boolean(lighting.reducedMotion)); accumulator -= LONG_FIN_KOI_STEP; }
    },
    pointerRay(ray, tap) {
      if (!(response > 0)) return;
      if (!ray || !Number.isFinite(ray.origin.x + ray.origin.y + ray.origin.z + ray.direction.x + ray.direction.y + ray.direction.z) || ray.direction.lengthSq() < 1e-12) { pointerActive = false; return; }
      const moved = !pointerActive || pointerOrigin.distanceToSquared(ray.origin) > 1e-8 || pointerDirection.distanceToSquared(ray.direction) > 1e-10;
      pointerOrigin.copy(ray.origin); pointerDirection.copy(ray.direction).normalize();
      pointerActive = true;
      if (moved || tap) pointerIdle = 0;
      if (!tap) return;
      tapAlert = 1;
      if (simulationTime - lastTapBurst < KOI_POINTER.cooldown || lastReduced) return;
      // Existing burst state, at most two fish at once (the school-wide cap), nearest to the ray first.
      let active = fish.filter(item => simulationTime < item.burstStart + item.burstDuration).length;
      const candidates = fish.filter(item => !(simulationTime < item.burstStart + item.burstDuration) && rayDistance(item.position) < item.length * KOI_POINTER.tapRadius)
        .map(item => ({item, distance: rayDistance(item.position)})).sort((a, b) => a.distance - b.distance);
      let started = false;
      for (const {item} of candidates) {
        if (active >= 2) break;
        item.burstStart = simulationTime; item.burstDuration = KOI_POINTER.burstDuration; item.startled = true;
        item.nextBurst = Math.max(item.nextBurst, simulationTime + 30); item.burst = 0; active++; started = true;
      }
      if (started) lastTapBurst = simulationTime;
    },
    poses() { return fish; },
    inspect() {
      let finite = true, maxSpeed = 0, maxBeamRadius = 0, minSpacing = Infinity;
      for (let i = 0; i < fish.length; i++) {
        const item = fish[i]; finite &&= item.position.toArray().every(Number.isFinite) && item.velocity.toArray().every(Number.isFinite);
        maxSpeed = Math.max(maxSpeed, item.velocity.length()); maxBeamRadius = Math.max(maxBeamRadius, beamRadius(item.position, lastAngle));
        for (let j = i + 1; j < fish.length; j++) minSpacing = Math.min(minSpacing, item.position.distanceTo(fish[j].position));
      }
      const pointerAlert = response > 0 && pointerActive ? Math.max(tapAlert, 1 - THREE.MathUtils.smoothstep(pointerIdle, KOI_POINTER.holdTime, KOI_POINTER.idleTime)) : 0;
      return {steps, finite, maxSpeed, maxBeamRadius, minSpacing, pointerAlert};
    },
  };
}
