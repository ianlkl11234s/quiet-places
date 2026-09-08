import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPlantGeometry} from '../src/places/afterlight/PlantGeometry.ts';

test('afterlight plant opens into short, upward, multi-directional branch clusters', () => {
  const plant = createPlantGeometry();
  plant.root.updateMatrixWorld(true);
  const mainLeaves = plant.leaves.slice(0, -10);
  const mainBounds = new THREE.Box3();
  let wallMaximum = -Infinity;
  const leafNormalY: number[] = [];
  for (const leaf of mainLeaves) {
    const positions = leaf.mesh.geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index++) {
      const world = leaf.mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, index));
      wallMaximum = Math.max(wallMaximum, world.x);
    }
    const bounds = new THREE.Box3().setFromObject(leaf.mesh);
    mainBounds.union(bounds);
    const normals = leaf.mesh.geometry.getAttribute('normal');
    leafNormalY.push(new THREE.Vector3().fromBufferAttribute(normals, Math.floor(normals.count / 2)).transformDirection(leaf.mesh.matrixWorld).y);
  }
  const size = mainBounds.getSize(new THREE.Vector3());
  const secondaryDirections: THREE.Vector3[] = [];
  plant.root.traverse(object => {
    if (object.name !== 'plant-secondary-branch') return;
    const knee = object.children.find(child => child.name === 'plant-secondary-knee');
    assert.ok(knee, 'secondary branch has its upward knee');
    secondaryDirections.push(knee.getWorldPosition(new THREE.Vector3()).sub(object.getWorldPosition(new THREE.Vector3())).normalize());
  });

  assert.ok(wallMaximum < 1.71, `foliage clears wall: ${wallMaximum}`);
  assert.ok(size.z >= .45 && size.z <= .75, `wall-parallel crown spread: ${size.z}`);
  assert.ok(size.y >= 1.14 && size.y <= 1.27, `main crown retains its baseline height: ${size.y}`);
  assert.equal(secondaryDirections.length, 6);
  assert.ok(secondaryDirections.every(direction => direction.y > .35), `each branch first rises: ${secondaryDirections.map(direction => direction.y)}`);
  assert.ok(secondaryDirections.some(direction => direction.z > .4) && secondaryDirections.some(direction => direction.z < -.4), 'branches spread along both wall directions');
  assert.ok(secondaryDirections.some(direction => Math.abs(direction.z) > Math.abs(direction.x)), 'some branches follow the wall more than they face outward');
  assert.ok(Math.min(...leafNormalY) < .6 && Math.max(...leafNormalY) > .9, `leaf planes vary between tilted and broad-facing: ${leafNormalY}`);
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
