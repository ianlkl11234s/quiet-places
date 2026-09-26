import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  advancePhaseCycles, constrainTravelToHeading, createHeadingState, headingQuaternion, hoverTailScale, hoverWeight, pectoralScull,
  stepHeading, tailBeatFrequency, turnPose, type HeadingParams,
} from '../src/shared/biology/locomotion/index.ts';
import {sampleSharkMotion} from '../src/places/stairlight/SharkMotion.ts';

const DEG = Math.PI / 180, UP = new THREE.Vector3(0, 1, 0);
const params: HeadingParams = {maxYawRate: 40 * DEG, yawTau: .25, maxPitch: 20 * DEG, maxPitchRate: 20 * DEG, pitchTau: .6,
  holdSpeed: .01, trackSpeed: .02, maxBank: 8 * DEG, maxBend: .05, yawRateScale: 30 * DEG, bankTau: 0};

function worldTurnSigns(quaternion: THREE.Quaternion, nose: THREE.Vector3) {
  const forward = nose.clone().applyQuaternion(quaternion), dorsal = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
  const left = UP.clone().cross(forward).normalize();
  return {forward, dorsalTowardLeft: dorsal.dot(left)};
}

test('turn pose: bank into the turn and tail inside it, matching the SharkMotion template in world space', () => {
  let checked = 0;
  for (let t = 1; t < 300; t += .37) {
    const shark = sampleSharkMotion(t), before = sampleSharkMotion(t - .05), after = sampleSharkMotion(t + .05);
    const a = before.direction.clone().setY(0).normalize(), b = after.direction.clone().setY(0).normalize();
    const yawRate = Math.atan2(a.clone().cross(b).y, a.dot(b)) / .1;
    if (Math.abs(shark.turnCurvature) < .4 || Math.abs(yawRate) < .05) continue;
    checked++;
    const sharkSign = Math.sign(worldTurnSigns(shark.quaternion, new THREE.Vector3(1, 0, 0)).dorsalTowardLeft);
    const pose = turnPose(yawRate, params);
    const ours = worldTurnSigns(headingQuaternion({yaw: 0, pitch: 0, bank: pose.bank}), new THREE.Vector3(0, 0, -1));
    assert.equal(Math.sign(ours.dorsalTowardLeft), sharkSign, 'same world-space bank direction as the shark');
    assert.equal(sharkSign, Math.sign(yawRate), 'the template banks into the turn');
    // Our bend is +X (fish right) positive; a left turn (yawRate>0) puts the tail on the left: inside.
    assert.equal(Math.sign(pose.bend), -Math.sign(yawRate));
  }
  assert.ok(checked > 50, `enough template turns sampled: ${checked}`);
  const saturated = turnPose(10, params);
  assert.ok(Math.abs(saturated.bank) <= params.maxBank && Math.abs(saturated.bend) <= params.maxBend);
  assert.deepEqual(turnPose(Number.NaN, params), turnPose(0, params));
});

test('heading controller caps yaw rate and pitch, holds at low speed, and never snaps', () => {
  let state = createHeadingState(new THREE.Vector3(0, 0, -1));
  const behind = new THREE.Vector3(.2, .9, 1);
  let maxRate = 0, maxPitch = 0, previousYaw = state.yaw;
  for (let i = 0; i < 600; i++) {
    state = stepHeading(state, behind, .05, 1 / 60, params);
    maxRate = Math.max(maxRate, Math.abs(Math.atan2(Math.sin(state.yaw - previousYaw), Math.cos(state.yaw - previousYaw))) * 60);
    maxPitch = Math.max(maxPitch, Math.abs(state.pitch)); previousYaw = state.yaw;
  }
  assert.ok(maxRate <= params.maxYawRate + 1e-9, `yaw rate capped: ${maxRate / DEG}`);
  assert.ok(maxPitch <= params.maxPitch + 1e-12, 'a near-vertical desired direction is presented at <= 20 deg');
  assert.ok(Math.abs(state.pitch - params.maxPitch) < 1e-6, 'pitch reaches the cap rather than stalling');
  const held = createHeadingState(new THREE.Vector3(1, 0, 0));
  let hold = {...held, pitch: .2};
  for (let i = 0; i < 120; i++) hold = stepHeading(hold, new THREE.Vector3(-1, 0, 0), .004, 1 / 60, params);
  assert.equal(hold.yaw, held.yaw, 'below holdSpeed the heading does not rotate toward a reversed velocity');
  assert.ok(Math.abs(hold.pitch) < .2, 'a holding fish relaxes toward level');
  assert.deepEqual(stepHeading(state, behind, .05, 0, params), state, 'dt = 0 changes nothing');
  assert.deepEqual(stepHeading(state, behind, .05, Number.NaN, params), state);
  // Fixed-step replay is deterministic.
  const run = () => { let s = createHeadingState(new THREE.Vector3(0, 0, -1)); for (let i = 0; i < 300; i++) s = stepHeading(s, new THREE.Vector3(Math.sin(i / 40), .1, Math.cos(i / 40)), .05, 1 / 60, {...params, bankTau: .4}); return s; };
  assert.deepEqual(run(), run());
});

test('travel is kept within the slip cone of the nose and keeps its speed', () => {
  const state = createHeadingState(new THREE.Vector3(0, 0, -1));
  const slip = {maxSlip: 30 * DEG, maxClimb: 30 * DEG, holdSpeed: .01, trackSpeed: .02};
  const velocity = constrainTravelToHeading(new THREE.Vector3(.05, .05, 0), state, slip);
  assert.ok(Math.abs(velocity.length() - Math.hypot(.05, .05)) < 1e-12);
  assert.ok(Math.abs(Math.atan2(-velocity.x, -velocity.z)) <= 30 * DEG + 1e-9);
  assert.ok(Math.atan2(velocity.y, Math.hypot(velocity.x, velocity.z)) <= 30 * DEG + 1e-9);
  const drift = new THREE.Vector3(.005, 0, 0);
  assert.deepEqual(constrainTravelToHeading(drift.clone(), state, slip), drift, 'slow drift is untouched while the heading holds');
});

test('tail-beat frequency f = f0 + U/(k BL) is linear, clamped, and phase integration is step-size independent', () => {
  const tail = {f0: .6, k: .8, maxFrequency: 4};
  assert.equal(tailBeatFrequency(0, .2, tail), .6);
  assert.ok(Math.abs(tailBeatFrequency(.2, .2, tail) - (.6 + 1 / .8)) < 1e-12, 'one body length per second adds 1/k Hz');
  assert.equal(tailBeatFrequency(100, .2, tail), 4);
  assert.equal(tailBeatFrequency(Number.NaN, .2, tail), .6);
  let fine = 0, coarse = 0;
  for (let i = 0; i < 120; i++) fine = advancePhaseCycles(fine, 1.5, 1 / 120);
  for (let i = 0; i < 12; i++) coarse = advancePhaseCycles(coarse, 1.5, 1 / 12);
  assert.ok(Math.abs(fine - coarse) < 1e-9 && Math.abs(fine - 1.5) < 1e-9);
  assert.equal(advancePhaseCycles(2, 3, 0), 2, 'pause does not advance phase');
});

test('hover stills the tail and hands propulsion to alternating pectoral sculling', () => {
  const hover = {hoverSpeedBL: .2, swimSpeedBL: .5, residualTail: 0, pectoralAmplitude: .25};
  assert.equal(hoverWeight(0, .045, hover), 1);
  assert.equal(hoverWeight(.5 * .045, .045, hover), 0);
  let previous = 1;
  for (let bl = 0; bl <= .6; bl += .01) { const weight = hoverWeight(bl * .045, .045, hover); assert.ok(weight <= previous + 1e-12); previous = weight; }
  assert.equal(hoverTailScale(1, hover), 0);
  assert.equal(hoverTailScale(0, hover), 1);
  const scull = pectoralScull(.7, 1, hover);
  assert.ok(Math.abs(scull.left + scull.right) < 1e-12 && Math.abs(scull.left) > 0, 'fins alternate half a cycle apart');
  assert.deepEqual(pectoralScull(.7, 0, hover), {left: 0, right: -0});
});
