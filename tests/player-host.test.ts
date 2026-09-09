import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createPlaceHost} from '../src/player/PlaceHost.ts';
import {createSceneClock} from '../src/player/SceneClock.ts';
import type {PlaceFactory, PlaceInstance} from '../src/player/contracts.ts';
import {getPlaceMetadata, placeSupports} from '../src/places/metadata.ts';

function instance(onDispose: () => void): PlaceInstance {
  return {
    position: [0, 0, 1], target: [0, 0, 0], yawRange: 0,
    hasSimulation: false, waterMode: '', update() {}, disturb() {}, resetWater() {}, dispose: onDispose,
  };
}

test('scene clock clamps late frames and freezes elapsed while paused or disposed', () => {
  const clock = createSceneClock({maxDeltaSeconds: .05});
  assert.equal(clock.advance(.2), .05);
  assert.equal(clock.elapsed, .05);
  clock.setPaused(true);
  assert.equal(clock.advance(.01), 0);
  assert.equal(clock.elapsed, .05);
  clock.reset(3);
  assert.equal(clock.elapsed, 3);
  clock.dispose();
  assert.equal(clock.advance(.01), 0);
  assert.equal(clock.snapshot().disposed, true);
});

test('place host only retires the old place after a candidate is constructed', async () => {
  const disposed: string[] = [];
  let rejectAfterlight = false;
  const preparePlace = async (id: 'waterlight' | 'afterlight'): Promise<PlaceFactory> => {
    const factory: PlaceFactory = scene => {
      if (id === 'afterlight' && rejectAfterlight) throw new Error('asset missing');
      scene.name = id;
      return instance(() => disposed.push(id));
    };
    return factory;
  };
  const host = createPlaceHost({renderer: {shadowMap: {enabled: false, type: 0}} as THREE.WebGLRenderer, preparePlace});
  await host.load('waterlight');
  rejectAfterlight = true;
  await assert.rejects(host.switchTo('afterlight'));
  assert.equal(host.current?.id, 'waterlight');
  assert.deepEqual(disposed, []);
  rejectAfterlight = false;
  await host.switchTo('afterlight');
  assert.equal(host.current?.scene.name, 'afterlight');
  assert.deepEqual(disposed, ['waterlight']);
  host.dispose(); host.dispose();
  assert.deepEqual(disposed, ['waterlight', 'afterlight']);
});

test('place host restores renderer state after a failed candidate and preserves the candidate after retirement', async () => {
  const renderer = {shadowMap: {enabled: false, type: 0}} as THREE.WebGLRenderer;
  let fail = false;
  const preparePlace = async (id: 'waterlight' | 'afterlight'): Promise<PlaceFactory> => {
    const factory: PlaceFactory = () => {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = id === 'waterlight' ? 1 : 2;
      if (id === 'afterlight' && fail) throw new Error('candidate failed after renderer mutation');
      return instance(() => {
        renderer.shadowMap.enabled = false;
        renderer.shadowMap.type = 0;
      });
    };
    return factory;
  };
  const host = createPlaceHost({renderer, preparePlace});
  await host.load('waterlight');
  assert.deepEqual(renderer.shadowMap, {enabled: true, type: 1});
  fail = true;
  await assert.rejects(host.switchTo('afterlight'));
  assert.equal(host.current?.id, 'waterlight');
  assert.deepEqual(renderer.shadowMap, {enabled: true, type: 1});
  fail = false;
  await host.switchTo('afterlight');
  assert.deepEqual(renderer.shadowMap, {enabled: true, type: 2});
});

test('disposing during preparation releases the unused factory without reviving a place', async () => {
  let resolveFactory: ((factory: PlaceFactory) => void) | undefined;
  let released = 0;
  const preparePlace = () => new Promise<PlaceFactory>(resolve => { resolveFactory = resolve; });
  const host = createPlaceHost({renderer: {shadowMap: {enabled: false, type: 0}} as THREE.WebGLRenderer, preparePlace});
  const loading = host.load('waterlight');
  host.dispose();
  const factory = Object.assign((() => instance(() => {})) as PlaceFactory, {dispose: () => { released += 1; }});
  resolveFactory!(factory);
  await assert.rejects(loading, /disposed/);
  assert.equal(released, 1);
  assert.equal(host.current, undefined);
});

test('metadata exposes controls only for rooms that support them', () => {
  assert.equal(placeSupports('waterlight', 'weather'), true);
  assert.equal(placeSupports('waterlight', 'ocean-level'), false);
  assert.equal(placeSupports('oceanlight', 'ocean-level'), true);
  assert.equal(placeSupports('afterlight', 'camera-distance'), true);
  assert.equal(getPlaceMetadata('afterlight').weatherProfile, 'afterlight');
});
