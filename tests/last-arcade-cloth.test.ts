import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {installTornCloth} from '../src/places/last-arcade/TornCloth.ts';

function panels(cloth: ReturnType<typeof installTornCloth>): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  cloth.root.traverse(object => { if (object.name.startsWith('arcade-torn-cloth-panel-')) result.push(object as THREE.Mesh); });
  return result;
}

test('torn shopfront cloth pins its upper seam, stays clear of the wall, and has a broken hem', () => {
  const root = new THREE.Group(), cloth = installTornCloth(root), meshes = panels(cloth);
  assert.equal(meshes.length, 2, 'two separated remnants leave a visible tear between them');
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    let minY = Infinity, maxY = -Infinity;
    for (let vertex = 0; vertex < position.count; vertex++) {
      assert.ok(Number.isFinite(position.getX(vertex)) && Number.isFinite(position.getY(vertex)) && Number.isFinite(position.getZ(vertex)));
      assert.ok(position.getX(vertex) > .27, `cloth vertex ${vertex} remains outside the shop wall`);
      minY = Math.min(minY, position.getY(vertex)); maxY = Math.max(maxY, position.getY(vertex));
    }
    assert.equal(maxY, 2.5, 'the top edge is fixed beneath the roller shutter');
    assert.ok(minY < 1.48, 'the cloth has the requested roughly one metre drop');
  }
  const first = meshes[0].geometry.getAttribute('position') as THREE.BufferAttribute;
  assert.ok(first.getZ(first.count - 1) < -6.4, 'cloth occupies the shopfront behind the sign rather than the near shop');
  cloth.dispose();
});

test('torn cloth uses deterministic absolute elapsed time and releases its owned mesh resources', () => {
  const root = new THREE.Group(), cloth = installTornCloth(root), mesh = panels(cloth)[1];
  const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const before = position.array.slice() as Float32Array;
  cloth.update(7.25, .8);
  const moved = position.array.slice() as Float32Array;
  assert.notDeepEqual(moved, before, 'CPU positions move with the breeze');
  for (let vertex = 0; vertex < position.count; vertex++) assert.ok(position.getX(vertex) > .27 && Number.isFinite(position.getX(vertex)));
  cloth.update(20, .2); cloth.update(7.25, .8);
  assert.deepEqual(position.array, moved, 'repeating elapsed and activity freezes the exact visible and shadow mesh');
  const resources = panels(cloth).map(panel => panel.geometry);
  let disposals = 0; resources.forEach(geometry => geometry.addEventListener('dispose', () => disposals++));
  cloth.dispose(); cloth.dispose();
  assert.equal(root.children.length, 0, 'dispose detaches the cloth group');
  assert.equal(disposals, resources.length, 'each owned cloth geometry disposes once');
});
