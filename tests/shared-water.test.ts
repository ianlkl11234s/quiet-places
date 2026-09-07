import assert from 'node:assert/strict';
import test from 'node:test';
import {oceanAbsorption, sampleOceanWave} from '../src/shared/water/Optics.ts';
import {disturbedSurfaceGLSL, disturbedSurfaceSlopeGLSL} from '../src/places/waterlight/SurfaceSampling.ts';

test('shared optics retains the calibrated water field', () => {
  assert.deepEqual(oceanAbsorption.toArray(), [.065,.035,.027]);
  const calibration = sampleOceanWave(1.25, -2.5, 3.75);
  assert.ok(Math.abs(calibration.height - .0787417414045981) < 1e-15);
  assert.ok(Math.abs(calibration.dx + .025414667301098606) < 1e-15);
  assert.ok(Math.abs(calibration.dz + .014512616530151162) < 1e-15);

});

test('shared interactive slopes retain Waterlight sampling orientation and gain', () => {
  for (const source of [disturbedSurfaceGLSL, disturbedSurfaceSlopeGLSL]) {
    assert.match(source, /surfaceSlope\(vec2 xz\)/);
    assert.match(source, /\.5-\(xz\.y\+\.2\)\/3\.6/);
    assert.match(source, /clamp\(vec2\(xz\.x\/3\.6\+\.5/);
    assert.match(source, /slope\+=3\.\*vec2/);
    assert.match(source, /-\(texture2D\(uWaves,clamp\(uv\+vec2\(0\.,e\.y\)/);
  }
  assert.match(disturbedSurfaceGLSL, /texture2D\(uWaves,uv\)\.r\*3\./);
});
