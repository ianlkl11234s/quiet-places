import * as THREE from 'three';
import {seededRandom} from '../../shared/math/seededRandom.ts';
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
};

export type LongFinKoiSchool = {
  update: (dt: number, lighting?: {angle?: number; activity?: number; reducedMotion?: boolean}) => void;
  poses: () => readonly LongFinKoiPose[];
  inspect: () => {steps: number; finite: boolean; maxSpeed: number; maxBeamRadius: number; minSpacing: number};
};

type Fish = LongFinKoiPose & {preferredHeight: number; preferredSpeed: number; turn: number; nextChange: number; phase: number};

const FORWARD = new THREE.Vector3(0, 0, -1);
const UP = new THREE.Vector3(0, 1, 0);

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
export function createLongFinKoiSchool(seed = 0x1f2e3d4c): LongFinKoiSchool {
  const random = seededRandom(seed);
  const fish: Fish[] = LONG_FIN_KOI_LENGTHS.map((length, index) => {
    const height = 2.45 + index / (LONG_FIN_KOI_COUNT - 1) * 1.86 + (random() - .5) * .10;
    const center = beamCenter(height, 0);
    const theta = index * Math.PI * (3 - Math.sqrt(5)) + .22;
    const position = center.add(new THREE.Vector3(Math.cos(theta) * (.68 + random() * .38), 0, Math.sin(theta) * (.52 + random() * .30)));
    const heading = theta + Math.PI * .5 + (random() - .5) * .45;
    const velocity = new THREE.Vector3(Math.cos(heading), (random() - .5) * .06, Math.sin(heading)).multiplyScalar(.048 + random() * .012);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(FORWARD, velocity.clone().normalize());
    return {index, length, position, velocity, quaternion, behavior: index % 3 === 0 ? 'hover' : 'slow', actionClock: random() * 8, motionPhase: random() * Math.PI * 2,
      preferredHeight: height, preferredSpeed: .044 + random() * .022, turn: 0, nextChange: 4 + random() * 8, phase: random() * Math.PI * 2};
  });
  let accumulator = 0, simulationTime = 0, steps = 0, lastAngle = 0;
  const center = new THREE.Vector3(), desired = new THREE.Vector3(), separation = new THREE.Vector3(), alignment = new THREE.Vector3();
  const toOther = new THREE.Vector3(), beam = new THREE.Vector3(), horizontal = new THREE.Vector3(), targetQuaternion = new THREE.Quaternion();

  function step(angle: number, activity: number, reducedMotion: boolean) {
    simulationTime += LONG_FIN_KOI_STEP;
    // All boid forces read one time-slice. This removes an index-order bias
    // where early fish had otherwise influenced later fish within one step.
    const positions = fish.map(item => item.position.clone());
    const velocities = fish.map(item => item.velocity.clone());
    for (const current of fish) {
      const currentPosition = positions[current.index];
      const currentVelocity = velocities[current.index];
      if (simulationTime >= current.nextChange) {
        current.behavior = chooseBehavior(random, current.behavior);
        current.nextChange = simulationTime + 4.5 + random() * 8.5;
      }
      const stateSpeed = current.behavior === 'pause' ? .004 : current.behavior === 'hover' ? .017 : current.behavior === 'glide' ? .032 : current.preferredSpeed;
      const speedTarget = Math.min(.07, stateSpeed * (reducedMotion ? .34 : 1) * (.92 + activity * .12));
      center.set(0, 0, 0); separation.set(0, 0, 0); alignment.set(0, 0, 0);
      let neighbours = 0;
      for (const other of fish) {
        if (other === current) continue;
        toOther.copy(positions[other.index]).sub(currentPosition);
        const distance = toOther.length();
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
      if (neighbours) {
        center.multiplyScalar(1 / neighbours).sub(currentPosition).multiplyScalar(.012);
        alignment.multiplyScalar(1 / neighbours).sub(currentVelocity).multiplyScalar(.045);
        desired.add(center).add(alignment); // deliberately low alignment: it is not a synchronized school.
      }
      desired.addScaledVector(separation, .42);
      const wanderAngle = simulationTime * (.16 + (current.index % 3) * .017) + current.phase;
      desired.add(new THREE.Vector3(Math.cos(wanderAngle), Math.sin(wanderAngle * .7) * .10, Math.sin(wanderAngle)).multiplyScalar(.016));
      if (current.behavior === 'left' || current.behavior === 'right') {
        horizontal.copy(current.velocity).setY(0);
        if (horizontal.lengthSq() > 1e-7) desired.addScaledVector(horizontal.normalize().cross(UP), current.behavior === 'left' ? .026 : -.026);
      }
      const heightOffset = current.behavior === 'rise' ? .28 : current.behavior === 'descend' ? -.28 : 0;
      desired.y += THREE.MathUtils.clamp((current.preferredHeight + heightOffset - currentPosition.y) * .15, -.035, .035);
      beam.copy(beamCenter(currentPosition.y, angle)).sub(currentPosition); beam.y = 0;
      const radius = beamRadius(currentPosition, angle);
      if (radius > .65) desired.addScaledVector(beam, .28 * (radius - .65));
      if (currentPosition.y < 2.30) desired.y += (2.30 - currentPosition.y) * .34;
      if (currentPosition.y > 4.78) desired.y -= (currentPosition.y - 4.78) * .34;
      const maximum = reducedMotion ? .045 : .14;
      if (desired.length() > maximum) desired.setLength(maximum);
      current.velocity.lerp(desired, 1 - Math.exp(-LONG_FIN_KOI_STEP * 1.35));
      if (current.velocity.length() > maximum) current.velocity.setLength(maximum);
      current.position.addScaledVector(current.velocity, LONG_FIN_KOI_STEP);
      if (current.velocity.lengthSq() > 1e-8) {
        targetQuaternion.setFromUnitVectors(FORWARD, current.velocity.clone().normalize());
        current.quaternion.slerp(targetQuaternion, 1 - Math.exp(-LONG_FIN_KOI_STEP * 44));
      }
      current.turn = THREE.MathUtils.lerp(current.turn, current.behavior === 'left' ? .18 : current.behavior === 'right' ? -.18 : 0, .06);
      current.actionClock += LONG_FIN_KOI_STEP * (current.behavior === 'pause' ? 1.05 : .65 + current.velocity.length() * 6.5);
      current.motionPhase += LONG_FIN_KOI_STEP * (.65 + current.index * .027);
    }
    steps++;
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
    poses() { return fish; },
    inspect() {
      let finite = true, maxSpeed = 0, maxBeamRadius = 0, minSpacing = Infinity;
      for (let i = 0; i < fish.length; i++) {
        const item = fish[i]; finite &&= item.position.toArray().every(Number.isFinite) && item.velocity.toArray().every(Number.isFinite);
        maxSpeed = Math.max(maxSpeed, item.velocity.length()); maxBeamRadius = Math.max(maxBeamRadius, beamRadius(item.position, lastAngle));
        for (let j = i + 1; j < fish.length; j++) minSpacing = Math.min(minSpacing, item.position.distanceTo(fish[j].position));
      }
      return {steps, finite, maxSpeed, maxBeamRadius, minSpacing};
    },
  };
}
