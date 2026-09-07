import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {prepareBlenderKoi} from '../src/places/leaflight/Koi.ts';
import {collectModelResources} from '../src/shared/resources/ModelResources.ts';

// Node's pose tests inspect the embedded PNG header but do not render/decode
// pixels. Browser GPU acceptance uses the real ImageBitmap decoder separately.
Object.assign(globalThis, {
  self: globalThis,
  createImageBitmap: async (blob: Blob) => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(bytes.buffer);
    return {width: view.getUint32(16), height: view.getUint32(20), close() {}};
  },
});

async function loadAsset() {
  const bytes = await readFile(new URL('../public/models/koi.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  return {bytes, gltf};
}

test('shipped koi has weighted body, complete rig and nine usable Actions with a seamless hero loop', async () => {
  const {bytes, gltf} = await loadAsset();
  const metadata = JSON.parse(await readFile(new URL('../public/models/koi.metadata.json', import.meta.url), 'utf8'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.glbSha256);
  for (const name of ['root', 'body_master', 'head', 'spine_01', 'spine_02', 'spine_03', 'spine_04', 'spine_05', 'peduncle', 'tail_base', 'tail_mid', 'tail_tip', 'pectoral_L', 'pectoral_R', 'pelvic_L', 'pelvic_R', 'anal', 'dorsal', 'caudal_L', 'caudal_R']) {
    assert.ok((gltf.scene.getObjectByName(name) as THREE.Bone)?.isBone, `required bone ${name}`);
  }
  for (const name of ['IDLE_HOVER', 'SLOW_CRUISE', 'CRUISE', 'TURN_LEFT', 'TURN_RIGHT', 'RISE', 'DESCEND', 'CIRCLE_SLOW', 'GLIDE']) {
    const clip = gltf.animations.find(a => a.name === 'KOI_ACT_' + name);
    assert.ok(clip && clip.duration >= 5 && clip.tracks.length > 10, name);
  }
  gltf.scene.updateMatrixWorld(true);
  const head = gltf.scene.getObjectByName('head')!.getWorldPosition(new THREE.Vector3());
  const tail = gltf.scene.getObjectByName('tail_tip')!.getWorldPosition(new THREE.Vector3());
  assert.ok(head.z < tail.z - .3, 'actual exported nose faces -Z');
  let body: THREE.SkinnedMesh | undefined;
  gltf.scene.traverse(object => {
    if ((object as THREE.SkinnedMesh).isSkinnedMesh && (object.name.includes('KOI_BODY') || object.parent?.name === 'KOI_BODY')) body = object as THREE.SkinnedMesh;
  });
  assert.ok(body, 'body is skinned rather than static geometry');
  const weightedBones = new Set<string>();
  gltf.scene.traverse(object => {
    if (!(object as THREE.SkinnedMesh).isSkinnedMesh) return;
    const mesh = object as THREE.SkinnedMesh;
    const weights = mesh.geometry.attributes.skinWeight, indices = mesh.geometry.attributes.skinIndex;
    for (let i = 0; i < weights.count; i++) for (const get of ['getX', 'getY', 'getZ', 'getW'] as const) {
      if (weights[get](i) > 1e-5) weightedBones.add(mesh.skeleton.bones[indices[get](i)].name);
    }
  });
  for (const name of ['pectoral_L', 'pectoral_R', 'pelvic_L', 'pelvic_R', 'dorsal', 'anal', 'tail_mid', 'tail_tip', 'caudal_L', 'caudal_R']) {
    assert.ok(weightedBones.has(name), `fin control actually deforms geometry: ${name}`);
  }
  const weights = body.geometry.attributes.skinWeight;
  for (let i = 0; i < weights.count; i++) {
    assert.ok(Math.abs(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i) - 1) < 1e-5);
  }
  const hero = gltf.animations.find(a => a.name === 'KOI_ACT_SLOW_CRUISE')!;
  assert.ok(Math.abs(hero.duration - 12) < 1e-4);
  let animatedTracks = 0;
  for (const track of hero.tracks) {
    const size = track.getValueSize(), values = track.values;
    for (let j = 0; j < size; j++) assert.ok(Math.abs(values[j] - values[values.length - size + j]) < 1e-4, `seamless ${track.name}`);
    if (values.some((value, i) => Math.abs(value - values[i % size]) > 1e-3)) animatedTracks++;
  }
  assert.ok(animatedTracks > 12, 'spine and fins genuinely animate');

  // Measure actual skinned body vertices, not just the input wave equation.
  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(hero).play(); mixer.setTime(0);
  gltf.scene.updateMatrixWorld(true); body.skeleton.update();
  const count = body.geometry.attributes.position.count;
  const restZ = new Float64Array(count), low = new Float64Array(count).fill(Infinity), high = new Float64Array(count).fill(-Infinity);
  const vertex = new THREE.Vector3();
  for (let i = 0; i < count; i++) restZ[i] = body.getVertexPosition(i, vertex).applyMatrix4(body.matrixWorld).z;
  const minZ = Math.min(...restZ), maxZ = Math.max(...restZ);
  for (let time = 0; time < 12; time += .125) {
    mixer.setTime(time); gltf.scene.updateMatrixWorld(true); body.skeleton.update();
    for (let i = 0; i < count; i++) {
      const x = body.getVertexPosition(i, vertex).applyMatrix4(body.matrixWorld).x;
      low[i] = Math.min(low[i], x); high[i] = Math.max(high[i], x);
    }
  }
  let headRange = 0, tailRange = 0;
  for (let i = 0; i < count; i++) {
    const s = (restZ[i] - minZ) / (maxZ - minZ);
    if (s < .15) headRange = Math.max(headRange, high[i] - low[i]);
    if (s > .8) tailRange = Math.max(tailRange, high[i] - low[i]);
  }
  assert.ok(tailRange > .008, `visible posterior propulsion: ${tailRange}m`);
  assert.ok(headRange / tailRange < .25, `actual head/tail lateral excursion ratio: ${headRange / tailRange}`);
  console.log(`Koi skinned body QA: head=${headRange.toFixed(5)}m tail=${tailRange.toFixed(5)}m ratio=${(headRange / tailRange).toFixed(4)}`);
  mixer.stopAllAction();
  const root = gltf.scene.getObjectByName('root')!;
  for (const name of ['TURN_LEFT', 'TURN_RIGHT', 'RISE', 'DESCEND'] as const) {
    const actionClip = gltf.animations.find(a => a.name === 'KOI_ACT_' + name)!;
    const action = mixer.clipAction(actionClip); action.reset().play();
    mixer.setTime(0); gltf.scene.updateMatrixWorld(true);
    const start = root.getWorldPosition(new THREE.Vector3());
    mixer.setTime(actionClip.duration * .9); gltf.scene.updateMatrixWorld(true);
    const movement = root.getWorldPosition(new THREE.Vector3()).sub(start);
    if (name === 'TURN_LEFT') assert.ok(movement.x < -.05 && Math.abs(movement.z) > .05, 'left clip really follows curved travel');
    if (name === 'TURN_RIGHT') assert.ok(movement.x > .05 && Math.abs(movement.z) > .05, 'right clip really follows curved travel');
    if (name === 'RISE') assert.ok(movement.y > .05, 'rise travels upward');
    if (name === 'DESCEND') assert.ok(movement.y < -.05, 'descend travels downward');
    mixer.stopAllAction();
  }
});

test('real koi clones animate, freeze without accumulated steering, stay above floor and dispose once', async () => {
  const {gltf} = await loadAsset();
  const original = GLTFLoader.prototype.loadAsync;
  GLTFLoader.prototype.loadAsync = async () => gltf;
  try {
    const resources = collectModelResources(gltf.scene);
    const disposals = new Map<THREE.BufferGeometry, number>();
    resources.geometries.forEach(geometry => {
      disposals.set(geometry, 0);
      geometry.addEventListener('dispose', () => disposals.set(geometry, disposals.get(geometry)! + 1));
    });
    const factory = await prepareBlenderKoi(), scene = new THREE.Scene();
    const fish = factory(scene, new THREE.DirectionalLight());
    const first = scene.getObjectByName('koi-1')!, second = scene.getObjectByName('koi-2')!;
    assert.notEqual(first.getObjectByName('peduncle'), second.getObjectByName('peduncle'));
    const snapshot = () => {
      const result: number[] = [];
      scene.traverse(object => {
        if ((object as THREE.Bone).isBone) result.push(...object.position.toArray(), ...object.quaternion.toArray());
      });
      return result;
    };
    fish.update(0, 37, 1);
    const pose = snapshot();
    for (let repeat = 0; repeat < 5; repeat++) fish.update(0, 37, 1);
    assert.deepEqual(snapshot(), pose, 'same elapsed must not accumulate additive turn');
    fish.update(0, 39, 1); assert.notDeepEqual(snapshot(), pose);
    fish.update(0, 37, 1); assert.deepEqual(snapshot(), pose, 'seeking restores bone pose exactly');
    let floor = Infinity, ceiling = -Infinity;
    const vertex = new THREE.Vector3();
    for (let time = 0; time <= 156; time += 2) {
      fish.update(0, time, 1);
      scene.updateMatrixWorld(true);
      scene.traverse(object => { if ((object as THREE.SkinnedMesh).isSkinnedMesh) (object as THREE.SkinnedMesh).skeleton.update(); });
      scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          object.getVertexPosition(i, vertex).applyMatrix4(object.matrixWorld);
          floor = Math.min(floor, vertex.y); ceiling = Math.max(ceiling, vertex.y);
          assert.ok(vertex.x > -4 && vertex.x < 4 && vertex.z > -4 && vertex.z < 4, 'deformed vertex remains in room');
        }
      });
    }
    assert.ok(floor > .025, `full deformed fish clears floor: ${floor.toFixed(3)}m`);
    assert.ok(ceiling < .65, `fish stays near floor: ${ceiling.toFixed(3)}m`);
    console.log(`Koi runtime deformed bounds: floor=${floor.toFixed(4)}m ceiling=${ceiling.toFixed(4)}m`);
    fish.dispose(); fish.dispose(); factory.dispose();
    assert.equal(scene.children.length, 0);
    disposals.forEach(count => assert.equal(count, 1));
  } finally {
    GLTFLoader.prototype.loadAsync = original;
  }
});
