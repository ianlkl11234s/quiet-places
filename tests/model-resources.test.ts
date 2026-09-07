import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {collectModelResources,disposeModelResources} from '../src/shared/resources/ModelResources.ts';

test('model resources deduplicate shared GLTF assets, retain skinned ownership, and ignore borrowed shader uniforms', () => {
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry();
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const material = new THREE.MeshStandardMaterial({map: texture});
  root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));

  const bone = new THREE.Bone();
  const skinned = new THREE.SkinnedMesh(geometry, material);
  skinned.add(bone);
  skinned.bind(new THREE.Skeleton([bone]));
  root.add(skinned);

  const borrowed = new THREE.Data3DTexture(new Float32Array(8), 2, 2, 2);
  const shader = new THREE.ShaderMaterial({uniforms: {photonVolume: {value: borrowed}}});
  root.add(new THREE.Mesh(new THREE.PlaneGeometry(), shader));

  const resources = collectModelResources(root);
  assert.equal(resources.geometries.size, 2);
  assert.equal(resources.materials.size, 2);
  assert.equal(resources.textures.size, 1, 'only direct material texture slots are owned');
  assert.equal(resources.skeletons.size, 1);

  let geometries = 0, materials = 0, textures = 0, skeletons = 0, borrowedTextures = 0;
  geometry.addEventListener('dispose', () => { geometries += 1; });
  material.addEventListener('dispose', () => { materials += 1; });
  texture.addEventListener('dispose', () => { textures += 1; });
  const releaseSkeleton = skinned.skeleton.dispose.bind(skinned.skeleton);
  skinned.skeleton.dispose = () => { skeletons += 1; releaseSkeleton(); };
  borrowed.addEventListener('dispose', () => { borrowedTextures += 1; });

  disposeModelResources(resources);
  disposeModelResources(collectModelResources(root));

  assert.equal(geometries, 1, 'shared geometry disposes once');
  assert.equal(materials, 1, 'shared material disposes once');
  assert.equal(textures, 1, 'shared material texture disposes once');
  assert.equal(skeletons, 1, 'the skinned model owns one skeleton');
  assert.equal(borrowedTextures, 0, 'shader uniforms remain with their explicit owner');

  borrowed.dispose();
});
