import * as THREE from 'three';
import {sampleStingrayMotion} from '../src/places/oceanlight/StingrayMotion.ts';

function assert(ok: boolean, message: string): void { if (!ok) throw new Error(message); }
const forward = new THREE.Vector3(0, 0, 1);
let minimumSeparation = Infinity;
let highestSpeed = 0;

function independentLoopLength(): number {
  const point = (phase: number) => new THREE.Vector3(3.1 * Math.sin(phase), .47 + .05 * Math.sin(phase - .72), 2.75 * Math.sin(2 * phase));
  let length = 0, previous = point(0);
  for (let step = 1; step <= 4096; step++) {
    const next = point(step / 4096 * Math.PI * 2);
    length += previous.distanceTo(next); previous = next;
  }
  return length;
}
const loopLength = independentLoopLength();

// Half-second sampling covers 15 minutes and several surge cycles without
// turning this deterministic bounds test into a long-running render benchmark.
for (let elapsed = 0; elapsed <= 15 * 60; elapsed += .5) {
  const a = sampleStingrayMotion(elapsed, 0), b = sampleStingrayMotion(elapsed, 1);
  for (const [ray, index] of [[a, 0], [b, 1]] as const) {
    assert(ray.position.x >= -3.3 && ray.position.x <= 3.3, 'Ray stays inside horizontal x route');
    assert(ray.position.z >= -2.75 && ray.position.z <= 4.75, 'Ray stays inside horizontal z route');
    assert(ray.position.y >= .35 && ray.position.y <= .75, 'Ray remains near the floor with fin clearance');
    assert(Number.isFinite(ray.speed) && ray.speed >= .2 - 1e-8 && ray.speed <= .48 + 1e-8, 'Speed is finite and calm');
    assert(Number.isFinite(ray.finPhase) && Number.isFinite(ray.finAmplitude), 'Fin animation values are finite');
    assert(ray.finAmplitude >= .8 && ray.finAmplitude <= 1.1, 'Fin multiplier stays within the authored morph range');
    assert(Number.isFinite(ray.turn) && Math.abs(ray.turn) <= 1, 'Turn demand is finite and normalized');
    assert(Number.isFinite(ray.yawRate) && Number.isFinite(ray.bank) && Math.abs(ray.bank) < 5 * Math.PI / 180, 'Heading and broad bank are finite and restrained');
    assert(Math.abs(ray.quaternion.length() - 1) < 1e-5, 'Orientation is normalized');
    const orientedForward = forward.clone().applyQuaternion(ray.quaternion);
    assert(Number.isFinite(orientedForward.x) && Number.isFinite(orientedForward.y) && Number.isFinite(orientedForward.z), 'Quaternion can transform local forward');
    assert(new THREE.Vector3(0, -1, 0).applyQuaternion(ray.quaternion).y < -.94, 'Ray belly generally faces downward');
    const prior = sampleStingrayMotion(elapsed - .01, index), next = sampleStingrayMotion(elapsed + .01, index);
    assert(Math.abs(next.position.y - prior.position.y) / .02 < .12, 'Lift and glide vertical derivative remains gentle');
    assert(Math.abs(next.speed - prior.speed) / .02 < .08, 'Surge acceleration remains gentle');
    highestSpeed = Math.max(highestSpeed, ray.speed);
  }
  minimumSeparation = Math.min(minimumSeparation, a.position.distanceTo(b.position));
}
assert(minimumSeparation >= 1.5, `Rays keep body clearance (${minimumSeparation.toFixed(3)} m)`);
assert(highestSpeed <= .48 + 1e-8, 'Surges remain gentle');

for (const index of [0, 1] as const) {
  const start = sampleStingrayMotion(37.25, index), same = sampleStingrayMotion(37.25, index);
  assert(start.position.distanceTo(same.position) === 0 && start.quaternion.angleTo(same.quaternion) < 1e-6, 'Identical elapsed time freezes exactly');
  for (const elapsed of [0, 29.6, 61.4, 899.9]) {
    const before = sampleStingrayMotion(elapsed - .01, index), after = sampleStingrayMotion(elapsed + .01, index);
    assert(before.position.distanceTo(after.position) < .02, 'Position remains continuous');
    assert(before.quaternion.angleTo(after.quaternion) < .12, 'Pose remains continuous');
    assert(Math.abs(before.speed - after.speed) < .01, 'Surge changes smoothly');
    const finTurn = Math.hypot(Math.sin(before.finPhase) - Math.sin(after.finPhase), Math.cos(before.finPhase) - Math.cos(after.finPhase));
    assert(finTurn < .12 && after.finPhase > before.finPhase, 'Fin sine/cosine pose remains continuous and advancing');
    const finHz = (after.finPhase - before.finPhase) / (.02 * Math.PI * 2);
    const discLength = 1.117 * (index === 0 ? 1 : .9);
    const expectedHz = sampleStingrayMotion(elapsed, index).speed * 1.25 / (discLength * .65);
    assert(finHz >= .3 && finHz <= .95, 'Fin frequency stays in the calm authored range');
    assert(Math.abs(finHz - expectedHz) < .025, 'Fin wave speed follows distance, scale, and calibrated slip');
  }
  // Reconstruct the sampler's unwrapped distance from its public fin phase,
  // then locate a true spatial lap using an independently integrated curve.
  const distanceAt = (time: number) => (sampleStingrayMotion(time, index).finPhase - index * 1.37) * (1.117 * (index === 0 ? 1 : .9) * .65) / (Math.PI * 2 * 1.25);
  let lo = 0, hi = 120;
  while (distanceAt(hi) < loopLength) hi *= 2;
  for (let step = 0; step < 28; step++) {
    const mid = (lo + hi) * .5;
    if (distanceAt(mid) < loopLength) lo = mid; else hi = mid;
  }
  const lapTime = (lo + hi) * .5, beforeLap = sampleStingrayMotion(lapTime - .01, index), afterLap = sampleStingrayMotion(lapTime + .01, index);
  assert(beforeLap.position.distanceTo(afterLap.position) < .025, 'Position stays continuous across an actual path lap');
  assert(beforeLap.quaternion.angleTo(afterLap.quaternion) < .12, 'Pose stays continuous across an actual path lap');
  const lapFinTurn = Math.hypot(Math.sin(beforeLap.finPhase) - Math.sin(afterLap.finPhase), Math.cos(beforeLap.finPhase) - Math.cos(afterLap.finPhase));
  assert(lapFinTurn < .12 && afterLap.finPhase > beforeLap.finPhase, 'Fin sine/cosine stays continuous across an actual path lap');
}
console.log(`PASS min separation=${minimumSeparation.toFixed(3)}m peak speed=${highestSpeed.toFixed(3)}m/s`);
