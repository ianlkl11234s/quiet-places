import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleKoiMotion} from '../src/places/leaflight/KoiMotion.ts';

test('koi routes preserve floor clearance, separation and nose-forward motion through many laps', () => {
  let separation = Infinity;
  for (let time = 0; time < 900; time += .5) {
    const fish = ([0, 1, 2] as const).map(index => sampleKoiMotion(time, index));
    for (const index of [0, 1, 2] as const) {
      const pose = fish[index];
      assert.ok(pose.position.x > -3.05 && pose.position.x < -.25);
      assert.ok(pose.position.z > -2.6 && pose.position.z < .3);
      assert.ok(pose.position.y > .22 && pose.position.y < .34);
      assert.ok(pose.speed > .06 && pose.speed < .17);
      const previous = sampleKoiMotion(time - .01, index);
      const next = sampleKoiMotion(time + .01, index);
      const velocity = next.position.clone().sub(previous.position).divideScalar(.02);
      const nose = new THREE.Vector3(0, 0, -1).applyQuaternion(pose.quaternion);
      assert.ok(nose.dot(velocity.clone().normalize()) > .99999, 'nose follows full velocity including ascent');
      assert.ok(Math.abs(velocity.length() - pose.speed) < .00001);
      assert.ok(previous.quaternion.angleTo(next.quaternion) < .02, 'turns never snap across a lap');
      const beatHz = (next.animationTime - previous.animationTime) / .02 * .75;
      assert.ok(beatHz > .35 && beatHz < 1.15, 'calm tail cadence scales with travel');
      assert.ok(Math.abs(beatHz * .17 * pose.length - Math.hypot(velocity.x, velocity.z)) < .001);
      for (let other = index + 1; other < 3; other++) {
        separation = Math.min(separation, pose.position.distanceTo(fish[other].position));
      }
    }
  }
  assert.ok(separation > 1.4, `whole fish stay separated: ${separation.toFixed(3)}m`);
});

test('absolute koi clock repeats exactly and non-finite input resets safely', () => {
  for (const index of [0, 1, 2] as const) {
    const a = sampleKoiMotion(37.4, index);
    sampleKoiMotion(100, index);
    assert.deepEqual(sampleKoiMotion(37.4, index), a);
    assert.deepEqual(sampleKoiMotion(NaN, index), sampleKoiMotion(0, index));
  }
});
