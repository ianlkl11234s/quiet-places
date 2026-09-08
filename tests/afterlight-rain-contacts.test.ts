import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createRainInteraction} from '../src/places/afterlight/RainInteraction.ts';
import {rainSample} from '../src/places/afterlight/RainField.ts';
import type {PlantLeaf} from '../src/places/afterlight/PlantGeometry.ts';

function leafAt(point: {x: number; y: number; z: number}, offsetY = 0): PlantLeaf {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.15, 0, -.15, .15, 0, -.15, 0, 0, .15], 3));
  geometry.setIndex([0, 1, 2]); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({side: THREE.DoubleSide}));
  mesh.position.set(point.x, point.y + offsetY, point.z); mesh.updateMatrixWorld(true);
  return {jointIndex: 0, mesh, tip: new THREE.Vector3(0, .1, 0), area: .02, seed: 1, baseRoughness: .5};
}

function pathTime() {
  for (let time = .1; time < 3; time += .01) {
    const now = rainSample(0, time), before = rainSample(0, time - .02);
    if (now.cycle === before.cycle && now.y > .2 && now.y < 2.8) return time;
  }
  throw new Error('no stable rain path');
}

test('a swept deterministic rain path contacts a curved leaf triangle', () => {
  const time = pathTime(), now = rainSample(0, time);
  const interaction = createRainInteraction([leafAt(now, .03)]);
  const contacts = interaction.update(time, .02, 1 / 80);
  assert.equal(contacts.length, 1); assert.equal(contacts[0].leafIndex, 0);
  assert.ok(contacts[0].mass > 0); assert.ok(contacts[0].lever >= .1 && contacts[0].lever <= 1);
});

test('the nearest leaf shelters the lower leaf', () => {
  const time = pathTime(), now = rainSample(0, time);
  const interaction = createRainInteraction([leafAt(now, .035), leafAt(now, -.01)]);
  const contacts = interaction.update(time, .02, 1 / 80);
  assert.equal(contacts.length, 1); assert.equal(contacts[0].leafIndex, 0);
});

test('rain outside a triangle does not create a contact', () => {
  const time = pathTime(), now = rainSample(0, time);
  const interaction = createRainInteraction([leafAt({...now, x: now.x + .3}, .03)]);
  assert.deepEqual(interaction.update(time, .02, 1 / 80), []);
});

test('a cycle cannot hit twice and reset permits the deterministic contact again', () => {
  const time = pathTime(), now = rainSample(0, time);
  const interaction = createRainInteraction([leafAt(now, .03)]);
  assert.equal(interaction.update(time, .02, 1 / 80).length, 1);
  assert.equal(interaction.update(time, .02, 1 / 80).length, 0);
  interaction.reset();
  assert.equal(interaction.update(time, .02, 1 / 80).length, 1);
});
