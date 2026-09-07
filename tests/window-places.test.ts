import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createFloorKoi } from '../src/legacy/FloorKoi.ts';
import { createWindowPlace, type WindowPlaceKind } from '../src/places/oceanlight/WindowRoom.ts';
import type { StingrayFactory, StingrayLighting } from '../src/places/oceanlight/Stingrays.ts';

const state = { intensity: .7, warmth: .35, angle: .2, activity: .6 };

function ownedResources(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (Array.isArray(mesh.material)) mesh.material.forEach((material) => materials.add(material));
    else if (mesh.material) materials.add(mesh.material);
  });
  return { geometries, materials };
}

for (const kind of ['leaf', 'ocean'] as const satisfies readonly WindowPlaceKind[]) {
  test(`the ${kind} window place releases its scene objects and resources`, () => {
    const scene = new THREE.Scene();
    const place = createWindowPlace(scene, kind);
    assert.equal(scene.children.length, 1, 'place is attached exactly once');
    const { geometries, materials } = ownedResources(scene.children[0]);
    assert.ok(geometries.size > 0, 'place owns geometry');
    assert.ok(materials.size > 0, 'place owns material');
    let disposedGeometry = 0;
    let disposedMaterial = 0;
    geometries.forEach((geometry) => geometry.addEventListener('dispose', () => { disposedGeometry += 1; }));
    materials.forEach((material) => material.addEventListener('dispose', () => { disposedMaterial += 1; }));

    for (let tick = 0; tick < 4; tick += 1) place.update(tick * .25, state);
    place.dispose();

    assert.equal(scene.children.length, 0, 'dispose detaches the complete place');
    assert.equal(disposedGeometry, geometries.size, 'every distinct geometry is disposed once');
    assert.equal(disposedMaterial, materials.size, 'every distinct material is disposed once');
  });
}

test('FloorKoi keeps fish low, bounded, pausable, and safely disposable', () => {
  const scene = new THREE.Scene();
  const koi = createFloorKoi(scene);
  const group = scene.getObjectByName('FloorKoi') as THREE.Group | undefined;
  assert.ok(group, 'fish group is attached');
  const fish = group.children.filter((child): child is THREE.Group => child instanceof THREE.Group);
  assert.equal(fish.length, 7, 'all seven fish are present');

  const initial = fish.map((child) => child.position.clone());
  koi.update(0, 100, state);
  fish.forEach((child, index) => assert.ok(child.position.equals(initial[index]), 'dt=0 does not advance fish'));

  for (let tick = 1; tick <= 6000; tick += 1) koi.update(.05, tick * .05, state);
  fish.forEach((child) => {
    assert.ok(child.position.x >= -3.8 && child.position.x <= 3.8, `x remains in room: ${child.position.x}`);
    assert.ok(child.position.z >= -3 && child.position.z <= 3, `z remains in room: ${child.position.z}`);
    assert.ok(child.position.y >= .16 && child.position.y <= .45, `fish remains near floor: ${child.position.y}`);
  });

  koi.dispose();
  assert.equal(scene.getObjectByName('FloorKoi'), undefined, 'dispose removes fish group');
  assert.doesNotThrow(() => koi.dispose(), 'a second dispose is harmless');
});

test('ocean window eases water level while surface, pane, and ray lighting stay in lockstep', () => {
  const scene = new THREE.Scene();
  let rayLighting: StingrayLighting | undefined;
  const rayUpdates: number[] = [];
  const rayFactory: StingrayFactory = Object.assign((_group: THREE.Group, lighting: StingrayLighting) => {
    rayLighting = lighting;
    return { update: (elapsed: number) => { rayUpdates.push(elapsed); }, dispose() {} };
  }, { dispose() {} });
  const place = createWindowPlace(scene, 'ocean', rayFactory);
  assert.equal(scene.getObjectByName('FloorKoi'), undefined, 'the ocean room does not create interior fish');

  const sea = scene.getObjectByName('ocean-surface') as THREE.Mesh | undefined;
  const underwater = scene.getObjectByName('ocean-exterior-underwater') as THREE.Mesh | undefined;
  assert.ok(sea, 'the exterior sea is present');
  assert.ok(underwater, 'the exterior underwater pane is present');
  assert.ok(rayLighting, 'the ocean place provides transported lighting to the rays');
  const seaPositions = sea.geometry.getAttribute('position') as THREE.BufferAttribute;
  let closestZ = -Infinity;
  for (let index = 0; index < seaPositions.count; index += 1) closestZ = Math.max(closestZ, seaPositions.getZ(index));
  assert.ok(closestZ <= -5.14 + 1e-5, `sea never crosses the dry window plane: ${closestZ}`);

  const seaUniforms = (sea.material as THREE.ShaderMaterial).uniforms;
  const paneUniforms = (underwater.material as THREE.ShaderMaterial).uniforms;
  const assertSharedLevel = (height: number, label: string) => {
    assert.equal(seaUniforms.uLevel.value, height, `${label}: sea height`);
    assert.equal(paneUniforms.uLevel.value, height, `${label}: pane height`);
    assert.equal(rayLighting!.level.value, height, `${label}: ray lighting height`);
  };

  place.setOceanLevel('half');
  place.update(12.5, state);
  assertSharedLevel(1.75, 'initial preset applies immediately');
  assert.ok(Math.abs(seaUniforms.uTime.value - 12.5) < 1 / 15, 'surface stays within one lighting timestep');
  assert.equal(paneUniforms.uTime.value, seaUniforms.uTime.value, 'pane shares the frozen light timestep');

  place.setOceanLevel('submerged');
  place.update(12.5, state);
  assertSharedLevel(1.75, 'a later selection starts from the visible height');
  place.update(16, state);
  const midway = seaUniforms.uLevel.value;
  assert.ok(midway > 1.75 && midway < 3.35, 'the seven-second tide has an intermediate height');
  assert.ok(Math.abs(midway - (1.75 + 3.35) / 2) < 1e-9, 'the smootherstep tide reaches the semantic midpoint halfway through');
  assertSharedLevel(midway, 'mid-tide');

  place.update(16, {...state, activity: .05});
  assertSharedLevel(midway, 'repeated elapsed time pauses the tide');
  place.setOceanLevel('below');
  place.update(16, state);
  assertSharedLevel(midway, 'reselecting during a tide does not jump');
  place.update(23, state);
  assertSharedLevel(.30, 'the new tide reaches its target after seven seconds');
  assert.equal(rayUpdates.at(-1), 23, 'rays update on the shared scene clock');
  place.dispose();
});
