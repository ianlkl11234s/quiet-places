import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {prepareLongFinKoiSchool} from '../src/places/waterlight/FishSchool.ts';
import {LONG_FIN_KOI_LENGTHS} from '../src/places/waterlight/LongFinKoiMotion.ts';
import {collectModelResources} from '../src/shared/resources/ModelResources.ts';

Object.assign(globalThis, {self: globalThis, createImageBitmap: async () => ({width: 1, height: 1, close() {}})});
const required = ['IDLE_HOVER', 'SLOW_CRUISE', 'GLIDE', 'TURN_LEFT', 'TURN_RIGHT', 'SLIGHT_RISE', 'SLIGHT_DESCEND', 'PAUSE'];
async function load() {
  const bytes = await readFile(new URL('../public/models/long-fin-koi-school.glb', import.meta.url));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}

test('long-fin GLB has seven independent rig subtrees, weighted meshes and eight 7-rig Actions', async () => {
  const gltf = await load();
  assert.deepEqual(gltf.scene.children.map(item => item.name), Array.from({length: 7}, (_, index) => `KOI_${String(index + 1).padStart(2, '0')}`));
  for (const root of gltf.scene.children) {
    const bones: THREE.Bone[] = []; let meshCount = 0, weightedVertices = 0;
    root.traverse(item => {
      if ((item as THREE.Bone).isBone) bones.push(item as THREE.Bone);
      if ((item as THREE.SkinnedMesh).isSkinnedMesh) {
        meshCount++; const weights = (item as THREE.SkinnedMesh).geometry.getAttribute('skinWeight') as THREE.BufferAttribute;
        for (let i = 0; i < weights.count; i++) { assert.ok(Math.abs(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i) - 1) < 1e-5); weightedVertices++; }
      }
    });
    assert.equal(bones.length, 24, `${root.name} has 24 rig bones`); assert.ok(meshCount > 0 && weightedVertices > 100, `${root.name} has normalized skin weights`);
  }
  for (const action of required) {
    const clip = gltf.animations.find(item => item.name === `KOI_ACT_${action}`); assert.ok(clip, action); assert.equal(clip.tracks.length, 504, `${action} has 7 × 24 × 3 tracks`);
    for (let index = 0; index < 7; index++) {
      const root = gltf.scene.children[index], names = new Set<string>(); root.traverse(item => names.add(item.name));
      assert.equal(clip.tracks.filter(track => names.has(track.name.slice(0, track.name.lastIndexOf('.')))).length, 72, `${action} affects ${root.name} only through its 24 bones`);
    }
  }
});

test('adapter binds each rig, freezes at dt=0, blends Actions and releases shared resources once', async () => {
  const gltf = await load(), resources = collectModelResources(gltf.scene), disposeCount = new Map<THREE.BufferGeometry, number>();
  resources.geometries.forEach(geometry => { disposeCount.set(geometry, 0); geometry.addEventListener('dispose', () => disposeCount.set(geometry, disposeCount.get(geometry)! + 1)); });
  const original = GLTFLoader.prototype.loadAsync; GLTFLoader.prototype.loadAsync = async () => gltf;
  try {
    const factory = await prepareLongFinKoiSchool(), scene = new THREE.Scene(), school = factory(scene);
    for (let index=0; index<LONG_FIN_KOI_LENGTHS.length; index++) {
      const model=scene.getObjectByName(`KOI_INSTANCE_${String(index+1).padStart(2,'0')}`)!;
      model.updateMatrixWorld(true);const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      assert.ok(Math.abs(Math.max(size.x,size.y,size.z)-LONG_FIN_KOI_LENGTHS[index])<1e-5, 'actual exported scale normalizes to the requested world length');
    }
    for (let i = 0; i < 120; i++) school.update(1 / 60, i / 60, {intensity: 1, warmth: .5, angle: .2, activity: .5});
    const snapshot = () => {
      const values: number[] = [];
      scene.getObjectByName('LongFinKoiSchool')!.traverse(item => {
        if ((item as THREE.Bone).isBone) values.push(...item.position.toArray(), ...item.quaternion.toArray(), ...item.scale.toArray());
        else if (item.parent?.name === 'LongFinKoiSchool') values.push(...item.matrixWorld.elements);
      });
      return values;
    };
    scene.updateMatrixWorld(true); const before = snapshot(); school.update(0, 2, {intensity: 1, warmth: .5, angle: .2, activity: .5}); scene.updateMatrixWorld(true);
    assert.deepEqual(snapshot(), before, 'dt=0 preserves every carrier and animated bone pose');
    assert.equal(scene.getObjectByName('LongFinKoiSchool')!.children.length, 16);
    const first = scene.getObjectByName('KOI_INSTANCE_01')!, second = scene.getObjectByName('KOI_INSTANCE_08')!;
    const firstBone = first.getObjectByName('tail_tip') as THREE.Bone, secondBone = second.getObjectByName('tail_tip') as THREE.Bone;
    assert.notEqual(firstBone, secondBone, 'reused variant owns independent bones');
    assert.ok(firstBone.quaternion.angleTo(secondBone.quaternion) > 1e-6, 'reused variant has independent animation phase');
    const skeletons = collectModelResources(scene).skeletons;
    let skeletonDisposals = 0;
    skeletons.forEach(skeleton => { const dispose = skeleton.dispose.bind(skeleton); skeleton.dispose = () => { skeletonDisposals++; dispose(); }; });
    const a = firstBone.quaternion.clone(), b = secondBone.quaternion.clone(); school.update(1 / 60, 2, {intensity: 1, warmth: .5, angle: .2, activity: .5});
    assert.ok(firstBone.quaternion.angleTo(a) > 1e-6 && secondBone.quaternion.angleTo(b) > 1e-6, 'per-root scoped clips animate every rig');
    school.dispose(); school.dispose(); disposeCount.forEach(count => assert.equal(count, 1)); assert.equal(skeletonDisposals, skeletons.size); assert.equal(scene.children.length, 0);
  } finally { GLTFLoader.prototype.loadAsync = original; }
});

test('actual skinned long-fin body keeps the head stable and all exported clips close their loops', async () => {
  const gltf = await load();
  for (const clip of gltf.animations) for (const track of clip.tracks) {
    const size = track.getValueSize();
    for (let i = 0; i < size; i++) assert.ok(Math.abs(track.values[i] - track.values[track.values.length - size + i]) < 1e-5, `${clip.name} ${track.name} closes`);
  }
  const rig = gltf.scene.getObjectByName('KOI_04')!;
  let body: THREE.SkinnedMesh | undefined;
  rig.traverse(object => {
    if (!(object instanceof THREE.SkinnedMesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.some(material => material.name.startsWith('LFK_BODY_'))) body = object;
  });
  assert.ok(body);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const clip = gltf.animations.find(clip => clip.name === 'KOI_ACT_SLOW_CRUISE')!;
  mixer.clipAction(clip).play();
  const count = body.geometry.attributes.position.count, z = new Float64Array(count);
  const low = new Float64Array(count).fill(Infinity), high = new Float64Array(count).fill(-Infinity), vertex = new THREE.Vector3();
  mixer.setTime(0); gltf.scene.updateMatrixWorld(true); body.skeleton.update();
  for (let i = 0; i < count; i++) z[i] = body.getVertexPosition(i, vertex).applyMatrix4(body.matrixWorld).z;
  const min = Math.min(...z), max = Math.max(...z);
  for (let time = 0; time <= 12; time += .125) {
    mixer.setTime(time); gltf.scene.updateMatrixWorld(true); body.skeleton.update();
    for (let i = 0; i < count; i++) {
      body.getVertexPosition(i, vertex).applyMatrix4(body.matrixWorld);
      assert.ok(vertex.toArray().every(Number.isFinite));
      low[i] = Math.min(low[i], vertex.x); high[i] = Math.max(high[i], vertex.x);
    }
  }
  let head = 0, tail = 0;
  for (let i = 0; i < count; i++) {
    const s = (z[i] - min) / (max - min);
    if (s < .15) head = Math.max(head, high[i] - low[i]);
    if (s > .8) tail = Math.max(tail, high[i] - low[i]);
  }
  assert.ok(tail > .008); assert.ok(head / tail < .25);
  console.log(JSON.stringify({longFinSkinnedBody: {headExcursion: head, tailExcursion: tail, ratio: head / tail}}));
});
