import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLongFinKoiSchool, LONG_FIN_KOI_COUNT, LONG_FIN_KOI_HEADING, LONG_FIN_KOI_STEP} from '../src/places/waterlight/LongFinKoiMotion.ts';

function snapshot(school: ReturnType<typeof createLongFinKoiSchool>) {
  return school.poses().map(fish => ({
    position: fish.position.toArray().map(value => Number(value.toFixed(10))),
    velocity: fish.velocity.toArray().map(value => Number(value.toFixed(10))),
    quaternion: fish.quaternion.toArray().map(value => Number(value.toFixed(10))),
    behavior: fish.behavior,
    burst: Number(fish.burst.toFixed(10)),
    actionClock: Number(fish.actionClock.toFixed(10)),
  }));
}

test('sixteen long-fin koi use deterministic fixed-step loose-shoal steering for a long run', () => {
  const school = createLongFinKoiSchool(0x51f15);
  assert.equal(LONG_FIN_KOI_COUNT, 16);
  let minimumSpacing = Infinity, maximumSpeed = 0, maximumBeamRadius = 0;
  let maxActiveBursts = 0, mixedPaceFrames = 0, darkFrames = 0;
  // Q0-6 presented-body contract (shared locomotion heading controller).
  let maxPitch = 0, maxYawStep = 0, maxBank = 0, maxCruiseSlip = 0, holdFrames = 0, maxHoldYawRate = 0, bankSamples = 0, bankInto = 0;
  let previousYaw = school.poses().map(fish => fish.heading.yaw);
  const darkVisitors = new Set<number>(), returnedVisitors = new Set<number>();
  let previous = school.poses().map(fish => fish.position.clone());
  for (let frame = 0; frame < 60 * 20 * 60; frame++) {
    school.update(LONG_FIN_KOI_STEP, {angle: Math.sin(frame / 720) * .8, activity: .5});
    const fish = school.poses();
    assert.equal(fish.length, LONG_FIN_KOI_COUNT);
    maxActiveBursts = Math.max(maxActiveBursts, fish.filter(item => item.burst > 0).length);
    if (fish.some(item => item.velocity.length() > .18) && fish.some(item => item.velocity.length() < .05)) mixedPaceFrames++;
    for (let i = 0; i < fish.length; i++) {
      const current = fish[i];
      assert.ok(current.length >= .28 && current.length <= .45);
      assert.ok(current.position.y >= 2.18 && current.position.y <= 4.82, 'preferred mid-beam heights avoid floor and ceiling');
      assert.ok(current.position.toArray().every(Number.isFinite) && current.velocity.toArray().every(Number.isFinite));
      maximumSpeed = Math.max(maximumSpeed, current.velocity.length());
      const travelled = current.position.distanceTo(previous[i]) / LONG_FIN_KOI_STEP;
      assert.ok(travelled <= .34 + 1e-8, `actual fixed-step displacement stays below cap: ${travelled}`);
      const sun = new THREE.Vector3(.45 - Math.sin(Math.sin(frame / 720) * .8) * .14, 1, .30 - Math.sin(Math.sin(frame / 720) * .8 * .7) * .10).normalize();
      const centre = new THREE.Vector3((current.position.y - 7) * sun.x / sun.y, current.position.y, -.2 + (current.position.y - 7) * sun.z / sun.y);
      maximumBeamRadius = Math.max(maximumBeamRadius, Math.hypot((current.position.x - centre.x) / 1.60, (current.position.z - centre.z) / 1.25));
      const apertureRadius = Math.max(Math.abs(current.position.x-centre.x), Math.abs(current.position.z-centre.z));
      if (apertureRadius > 2.35) { darkFrames++; darkVisitors.add(i); }
      if (apertureRadius < 1.5 && darkVisitors.has(i)) returnedVisitors.add(i);
      assert.ok(current.position.x > -3.7 && current.position.x < 3.7 && current.position.z > -4.7 && current.position.z < 10.7, 'fish stay clear of room walls');
      const nose = new THREE.Vector3(0, 0, -1).applyQuaternion(current.quaternion);
      const speed = current.velocity.length();
      maxPitch = Math.max(maxPitch, Math.abs(Math.asin(THREE.MathUtils.clamp(nose.y, -1, 1))));
      const yawStep = Math.abs(Math.atan2(Math.sin(current.heading.yaw - previousYaw[i]), Math.cos(current.heading.yaw - previousYaw[i])));
      maxYawStep = Math.max(maxYawStep, yawStep); previousYaw[i] = current.heading.yaw;
      maxBank = Math.max(maxBank, Math.abs(current.bank));
      if (speed > .03) {
        const travelYaw = Math.atan2(-current.velocity.x, -current.velocity.z), noseYaw = Math.atan2(-nose.x, -nose.z);
        maxCruiseSlip = Math.max(maxCruiseSlip, Math.abs(Math.atan2(Math.sin(travelYaw - noseYaw), Math.cos(travelYaw - noseYaw))));
      }
      if (speed < LONG_FIN_KOI_HEADING.holdSpeed) { holdFrames++; maxHoldYawRate = Math.max(maxHoldYawRate, Math.abs(current.yawRate)); }
      if (Math.abs(current.yawRate) > THREE.MathUtils.degToRad(20)) { bankSamples++; if (Math.sign(current.bank) === Math.sign(current.yawRate)) bankInto++; }
      for (let j = i + 1; j < fish.length; j++) minimumSpacing = Math.min(minimumSpacing, current.position.distanceTo(fish[j].position));
    }
    previous = fish.map(fish => fish.position.clone());
  }
  const deg = (value: number) => Number(THREE.MathUtils.radToDeg(value).toFixed(3));
  console.log(JSON.stringify({longFinMotion: {minimumSpacing, maximumSpeed, maximumBeamRadius, maxActiveBursts, mixedPaceFrames, darkFrames, returningVisitors: returnedVisitors.size, seconds: 1200},
    longFinHeading: {maxPitchDeg: deg(maxPitch), maxYawRateDegPerS: deg(maxYawStep / LONG_FIN_KOI_STEP), maxBankDeg: deg(maxBank), maxCruiseSlipDeg: deg(maxCruiseSlip), holdFrames, maxHoldYawRateDegPerS: deg(maxHoldYawRate), bankIntoTurnFraction: bankInto / Math.max(1, bankSamples)}}));
  assert.ok(maxPitch <= LONG_FIN_KOI_HEADING.maxPitch + 1e-9, `no vertical posture: body pitch stays within 20 deg (${deg(maxPitch)})`);
  assert.ok(maxYawStep <= LONG_FIN_KOI_HEADING.maxYawRate * LONG_FIN_KOI_STEP + 1e-9, 'presented yaw rate is capped at 40 deg/s');
  assert.ok(holdFrames > 0 && maxHoldYawRate === 0, 'below hold speed the heading does not spin on the spot');
  assert.ok(maxCruiseSlip <= LONG_FIN_KOI_HEADING.maxSlip + 1e-6, `cruising travel stays within 30 deg of the nose (${deg(maxCruiseSlip)})`);
  assert.ok(maxBank > THREE.MathUtils.degToRad(5) && maxBank <= LONG_FIN_KOI_HEADING.maxBank + 1e-9, `turn bank reaches 5-8 deg (${deg(maxBank)})`);
  assert.ok(bankInto / bankSamples > .95, 'fish bank into the turn');
  const check = school.inspect();
  assert.ok(check.finite);
  assert.ok(maxActiveBursts > 0 && maxActiveBursts <= 2);
  assert.ok(mixedPaceFrames > 600, `occasional quick fish coexist with slow fish: ${mixedPaceFrames}`);
  assert.ok(maximumSpeed <= .34 + 1e-9, `speed cap: ${maximumSpeed}`);
  assert.ok(maximumBeamRadius <= 3, `bounded excursions: ${maximumBeamRadius}`);
  assert.ok(darkFrames > 600 && returnedVisitors.size >= 3, 'several fish visit beyond the soft light edge and return');
  assert.ok(minimumSpacing > .45, `loose shoal preserves body-centre spacing without geometry-collision claims: ${minimumSpacing}`);
});

test('fixed steps, pause and reduced-motion preserve the controller contract', () => {
  const a = createLongFinKoiSchool(1234), b = createLongFinKoiSchool(1234);
  for (let i = 0; i < 900; i++) a.update(1 / 60, {angle: .25, activity: .4});
  for (let i = 0; i < 450; i++) b.update(1 / 30, {angle: .25, activity: .4});
  assert.deepEqual(snapshot(b), snapshot(a), 'frame delivery groups do not change fixed-step poses');
  const frozen = snapshot(a); a.update(0, {angle: -.8, activity: 1}); a.update(Number.NaN);
  assert.deepEqual(snapshot(a), frozen, 'pause and invalid dt do not accumulate steering or fin clocks');
  const reduced = createLongFinKoiSchool(9);
  for (let i = 0; i < 1200; i++) reduced.update(LONG_FIN_KOI_STEP, {reducedMotion: true, activity: 1});
  assert.ok(reduced.poses().every(fish => fish.burst === 0), 'reduced motion suppresses short surges');
  assert.ok(reduced.inspect().maxSpeed <= .045 + 1e-9, 'reduced motion limits travel without advancing an alternate clock');
});
