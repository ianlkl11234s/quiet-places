import assert from 'node:assert/strict';
import test from 'node:test';
import {OCEAN_AMBIENT_CAP, fillOceanAmbient, oceanAmbientHorizon, oceanAmbientIntensity, oceanDawnWeight} from '../src/places/oceanlight/Ambient.ts';

test('ocean ambient is capped, fades out at the moon keyframe and follows water level', () => {
  assert.equal(oceanAmbientIntensity(.09), 0, 'moon keyframe (.09) has no image-based fill');
  assert.ok(oceanAmbientIntensity(1) <= OCEAN_AMBIENT_CAP + 1e-9, 'noon stays at or below the cap');
  assert.ok(oceanAmbientIntensity(.36) < oceanAmbientIntensity(.9), 'dawn is weaker than afternoon');
  assert.ok(oceanAmbientIntensity(1, .35) < oceanAmbientIntensity(1), 'a submerged window dims the fill');
});

test('ocean ambient horizon keeps the confirmed palette at warmth <= .5 and warms dawn/sunset', () => {
  const afternoon = oceanAmbientHorizon(.48);
  // Same linear mix as the pre-candidate Surface.ts skyColor horizon.
  assert.ok(Math.abs(afternoon.r - (.23 + (.77 - .23) * .48)) < 1e-6);
  const dawn = oceanAmbientHorizon(.66), sunset = oceanAmbientHorizon(.95);
  assert.ok(dawn.r > dawn.b && sunset.r > sunset.b, 'dawn and sunset are warm');
  assert.ok(sunset.r - sunset.b > dawn.r - dawn.b, 'sunset is warmer than dawn');
  // 16:00 (warmth ~.77, positive angle) must not borrow the dawn palette.
  assert.equal(oceanDawnWeight(.77, .5), 0, 'afternoon keeps the dawn stage off');
  assert.ok(oceanDawnWeight(.66, -.7) > .85, 'dawn keyframe uses almost the full dawn stage');
});

test('ocean ambient radiance only comes from the window side (-Z) and a faint floor', () => {
  const width = 64, height = 32, pixels = new Float32Array(width * height * 4);
  fillOceanAmbient(pixels, .48);
  // three.js equirectUv: u = atan(z, x) / 2π + .5, v = asin(y) / π + .5.
  const at = (x: number, y: number, z: number) => {
    const u = Math.atan2(z, x) / (Math.PI * 2) + .5, v = Math.asin(y) / Math.PI + .5;
    const i = (Math.min(height - 1, Math.floor(v * height)) * width + Math.min(width - 1, Math.floor(u * width))) * 4;
    return pixels[i] + pixels[i + 1] + pixels[i + 2];
  };
  assert.ok(at(0, 0, -1) > .5, 'window direction is bright');
  assert.equal(at(0, 0, 1), 0, 'the back of the room is black');
  assert.equal(at(1, 0, 0), 0, 'side walls are black');
  assert.equal(at(0, .99, 0), 0, 'no sky dome above');
  assert.ok(at(0, -.99, 0) > 0 && at(0, -.99, 0) < .2, 'only a faint floor return below');
});
