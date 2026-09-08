import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPlantGeometry} from '../src/places/afterlight/PlantGeometry.ts';

test('afterlight plant stays clear of the wall while keeping rain-facing leaves', () => {
  const plant = createPlantGeometry();
  plant.root.updateMatrixWorld(true);
  const mainLeaves = plant.leaves.slice(0, -10);
  const mainBounds = new THREE.Box3();
  let wallMaximum = -Infinity;
  let rainLeaves = 0;
  const rainLayerHeights: number[] = [];
  const camera = new THREE.PerspectiveCamera(53, 16 / 9, .1, 20);
  camera.position.set(.425, .8175, 2.25);
  camera.lookAt(1.25, .72, -.6);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  let projectedMinimum = Infinity;
  let projectedMaximum = -Infinity;
  for (const leaf of mainLeaves) {
    const positions = leaf.mesh.geometry.getAttribute('position');
    let sweptRainSurface = false;
    for (let index = 0; index < positions.count; index++) {
      const world = leaf.mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, index));
      wallMaximum = Math.max(wallMaximum, world.x);
      const screen = world.clone().project(camera);
      projectedMinimum = Math.min(projectedMinimum, screen.x);
      projectedMaximum = Math.max(projectedMaximum, screen.x);
      sweptRainSurface ||= world.x >= 1.12 && world.x <= 1.23 && world.z >= -1.25 && world.z <= -.35;
    }
    const bounds = new THREE.Box3().setFromObject(leaf.mesh);
    mainBounds.union(bounds);
    if (sweptRainSurface) {
      rainLeaves++;
      rainLayerHeights.push(bounds.getCenter(new THREE.Vector3()).y);
    }
  }
  const size = mainBounds.getSize(new THREE.Vector3());
  const projectedWidth = projectedMaximum - projectedMinimum;
  const baselineProjectedWidth = .17626335246395936; // 4213c17, same hero camera and vertex measurement.
  rainLayerHeights.sort((a, b) => a - b);
  const distinctRainLayers = rainLayerHeights.reduce<number[]>((layers, height) => {
    if (!layers.length || height - layers[layers.length - 1] >= .06) layers.push(height);
    return layers;
  }, []);

  assert.ok(wallMaximum <= 1.696, `foliage clears wall: ${wallMaximum}`);
  assert.ok(mainBounds.min.x >= 1.08, `main crown does not overgrow the corridor centre: ${mainBounds.min.x}`);
  assert.ok(size.z >= .28 && size.z <= .32, `main crown keeps its shallow depth: ${size.z}`);
  assert.ok(size.y >= 1.14 && size.y <= 1.27, `main crown retains its baseline height: ${size.y}`);
  assert.ok(size.x / .4457933452745151 >= 1.3 && size.x / .4457933452745151 <= 1.5, `physical crown width grows 30–50%: ${size.x}`);
  assert.ok(projectedWidth / baselineProjectedWidth >= 1.29 && projectedWidth / baselineProjectedWidth <= 1.5, `hero-camera crown width grows about 30–50%: ${projectedWidth}`);
  assert.ok(rainLeaves >= 6, `rain-path surface coverage at x=1.12–1.23: ${rainLeaves}`);
  assert.ok(distinctRainLayers.length >= 4, `rain-bearing leaves retain layered projection: ${distinctRainLayers}`);
  assert.equal(plant.joints.filter(joint => joint.kind === 'weed' && joint.parentIndex < 0).length, 5);
  assert.equal(mainLeaves.length, 39);
  assert.equal(plant.leaves.length, 49);
  const namedBranches: string[] = [];
  plant.root.traverse(object => {
    if (object.name === 'plant-secondary-branch' || object.name === 'plant-tertiary-twig') namedBranches.push(object.name);
  });
  assert.equal(namedBranches.filter(name => name === 'plant-secondary-branch').length, 6);
  assert.equal(namedBranches.filter(name => name === 'plant-tertiary-twig').length, 2);
  plant.dispose();
});

test('afterlight plant has finite normals and disposes owned resources only once', () => {
  const plant = createPlantGeometry();
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  plant.root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    resources.add(object.geometry);
    resources.add(object.material as THREE.Material);
  });
  for (const leaf of plant.leaves) {
    const normals = leaf.mesh.geometry.getAttribute('normal');
    assert.ok(normals && normals.count > 0);
    for (let index = 0; index < normals.count; index++) assert.ok(Number.isFinite(normals.getX(index)) && Number.isFinite(normals.getY(index)) && Number.isFinite(normals.getZ(index)));
  }
  let disposals = 0;
  for (const resource of resources) {
    const dispose = resource.dispose.bind(resource);
    resource.dispose = () => { disposals++; dispose(); };
  }
  plant.dispose();
  plant.dispose();
  assert.equal(disposals, resources.size);
});
