import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPlantGeometry} from '../src/places/afterlight/PlantGeometry.ts';

test('afterlight plant stays clear of the wall while keeping rain-facing leaves', () => {
  const plant = createPlantGeometry();
  plant.root.updateMatrixWorld(true);
  let wallMaximum = -Infinity;
  let rainLeaves = 0;
  for (const leaf of plant.leaves) {
    const positions = leaf.mesh.geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index++) {
      const world = leaf.mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, index));
      wallMaximum = Math.max(wallMaximum, world.x);
    }
    const bounds = new THREE.Box3().setFromObject(leaf.mesh);
    if (bounds.min.x <= 1.28 && bounds.max.x >= 1.15 && bounds.min.z <= -.4 && bounds.max.z >= -.8) rainLeaves++;
  }
  assert.ok(wallMaximum <= 1.696, `foliage clears wall: ${wallMaximum}`);
  assert.ok(rainLeaves >= 3, `rain-facing leaf intersections: ${rainLeaves}`);
  assert.equal(plant.joints.filter(joint => joint.kind === 'weed' && joint.parentIndex < 0).length, 5);
  assert.ok(plant.leaves.length >= 25 && plant.leaves.length <= 35);
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
