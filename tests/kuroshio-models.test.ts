import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createMantaModel} from '../src/creatures/manta/index.ts';
import {createWhaleSharkModel} from '../src/creatures/whale-shark/index.ts';
import {createChromisVisuals, setChromisMotion} from '../src/creatures/chromis/index.ts';
import {createFusilierVisuals, setFusilierMotion} from '../src/creatures/fusilier/index.ts';

function meshes(root: THREE.Object3D) {
  const result: THREE.Mesh[] = [];
  root.traverse(object => { if (object instanceof THREE.Mesh) result.push(object); });
  return result;
}

function mesh(root: THREE.Object3D, name: string) {
  const object = root.getObjectByName(name);
  assert.ok(object instanceof THREE.Mesh, `${name} is a mesh`);
  return object;
}

function vectorArray(attribute: THREE.BufferAttribute) { return Array.from(attribute.array); }

function assertFiniteUnitNormals(root: THREE.Object3D) {
  for (const item of meshes(root)) {
    const normal = item.geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
    assert.ok(normal && normal.count > 0, `${item.name} has normals`);
    for (let index = 0; index < normal.count; index++) {
      const length = Math.hypot(normal.getX(index), normal.getY(index), normal.getZ(index));
      assert.ok(Number.isFinite(length), `${item.name} normal ${index} is finite`);
      assert.ok(Math.abs(length - 1) < 1e-4, `${item.name} normal ${index} is normalized`);
    }
  }
}

function assertFiniteNondegenerateNormals(root: THREE.Object3D) {
  for (const item of meshes(root)) {
    const normal = item.geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
    assert.ok(normal && normal.count > 0, `${item.name} has normals`);
    let nondegenerate = 0;
    for (let index = 0; index < normal.count; index++) {
      const length = Math.hypot(normal.getX(index), normal.getY(index), normal.getZ(index));
      assert.ok(Number.isFinite(length), `${item.name} normal ${index} is finite`);
      if (length > 1e-7) { nondegenerate++; assert.ok(Math.abs(length - 1) < 1e-4, `${item.name} nondegenerate normal ${index} is normalized`); }
    }
    assert.ok(nondegenerate > 0, `${item.name} has a nondegenerate shaded surface`);
  }
}

function maximumAbsX(item: THREE.Mesh) {
  const position = item.geometry.getAttribute('position') as THREE.BufferAttribute;
  let maximum = 0;
  for (let index = 0; index < position.count; index++) maximum = Math.max(maximum, Math.abs(position.getX(index)));
  return maximum;
}

function releaseCount(root: THREE.Object3D) {
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  for (const item of meshes(root)) {
    resources.add(item.geometry);
    for (const value of Array.isArray(item.material) ? item.material : [item.material]) resources.add(value);
  }
  let count = 0;
  for (const resource of resources) {
    const release = resource.dispose.bind(resource);
    resource.dispose = () => { count++; release(); };
  }
  return {resources, count: () => count};
}

function tailCentre(tail: THREE.Mesh) {
  const position = tail.geometry.getAttribute('position') as THREE.BufferAttribute;
  // TubeGeometry uses radialSegments vertices for its first ring (not the
  // duplicate seam vertex); their mean is the centreline's attachment point.
  const centre = new THREE.Vector3();
  for (let index = 0; index < 6; index++) centre.add(new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index)));
  return centre.multiplyScalar(1 / 6);
}

test('manta retains anatomical proportions, tapered wings and attached features across LODs and poses', () => {
  const span = 5.8, first = createMantaModel(span, 101), second = createMantaModel(span, 102);
  const neutral = {phase: 0, amplitude: 0, asymmetry: 0, glide: 0};
  first.update(neutral); second.update(neutral);
  const lod = first.root.getObjectByName('manta-lod') as THREE.LOD;
  assert.deepEqual(lod.levels.map(level => level.distance), [0, 18, 40]);
  const near = mesh(first.root, 'manta-body-lod-0'), far = mesh(first.root, 'manta-body-lod-40');
  near.geometry.computeBoundingBox();
  const dimensions = near.geometry.boundingBox!.getSize(new THREE.Vector3());
  assert.ok(Math.abs(dimensions.x - span) < .002, 'disc width fits requested span');
  assert.ok(dimensions.z / span >= .42 && dimensions.z / span <= .47, 'short broad disc follows measured ratio range');
  assert.ok(dimensions.y / span >= .085 && dimensions.y / span <= .11, 'central body thickness is measured on the mesh');
  const position = near.geometry.getAttribute('position') as THREE.BufferAttribute;
  const before = vectorArray(position), initialWidth = maximumAbsX(near);
  const normals = near.geometry.getAttribute('normal') as THREE.BufferAttribute;
  const upper = near.geometry.getAttribute('mantaUpper') as THREE.BufferAttribute;
  let normalChecks = 0;
  for (let i = 0; i < position.count; i++) if (Math.abs(position.getX(i)) < span * .02 && Math.abs(position.getZ(i)) < span * .03) {
    assert.ok(normals.getY(i) * (upper.getX(i) ? 1 : -1) > .5, 'dorsal and ventral normals face outward'); normalChecks++;
  }
  assert.ok(normalChecks > 0);
  const chord = near.geometry.getAttribute('mantaS') as THREE.BufferAttribute;
  let concaveSamples = 0;
  for (let i = 0; i < position.count; i++) {
    const x = Math.abs(position.getX(i)) / span;
    if (chord.getX(i) > .999 && x > .28 && x < .32) {
      const linearRear = -.17 + .15 * (x - .115) / .385;
      assert.ok(position.getZ(i) / span > linearRear + .02, 'trailing edge cuts inward instead of forming a straight kite'); concaveSamples++;
    }
  }
  assert.ok(concaveSamples > 0, 'inspect actual middle-wing rear vertices');
  let outerThickness = 0;
  for (let i = 0; i < position.count; i++) if (Math.abs(position.getX(i)) > span * .4) outerThickness = Math.max(outerThickness, Math.abs(position.getY(i)));
  assert.ok(outerThickness < span * .015, 'outer wing tapers to a thin edge');
  let tipMin = Infinity, tipMax = -Infinity;
  for (let i = 0; i < position.count; i++) if (Math.abs(position.getX(i)) > span * .4999) { tipMin = Math.min(tipMin, position.getY(i)); tipMax = Math.max(tipMax, position.getY(i)); }
  assert.ok(tipMax - tipMin < span * .001, 'tip converges instead of becoming a blunt vertical wall');
  for (const phase of [0, Math.PI / 2, Math.PI, 1.5 * Math.PI]) {
    first.update({phase, amplitude: 1.2, asymmetry: .3, glide: .18});
    assert.ok(Math.abs(maximumAbsX(near) - initialWidth) < 1e-7, 'stroke never expands collision width');
    for (const item of meshes(first.root)) assert.ok(vectorArray(item.geometry.getAttribute('position') as THREE.BufferAttribute).every(Number.isFinite), `${item.name} has finite deformed positions`);
    for (const side of [-1, 1]) {
      const tip: number[] = []; for (let i = 0; i < position.count; i++) if (position.getX(i) * side > span * .4999) tip.push(position.getY(i));
      assert.ok(Math.max(...tip) - Math.min(...tip) < span * .001, 'chord lag converges at each tip through the entire stroke');
    }
    assertFiniteNondegenerateNormals(first.root);
  }
  first.update(neutral);
  assert.deepEqual(vectorArray(position), before, 'neutral pose restores geometry without residual stroke');
  assert.ok(far.geometry.getAttribute('position').count < position.count, 'far LOD reduces geometry');
  for (const level of lod.levels) {
    for (const name of ['manta-terminal-mouth', 'manta-cephalic-lobe-left', 'manta-cephalic-lobe-right', 'manta-dorsal-fin']) assert.ok(level.object.getObjectByName(name), `${name} remains recognizable at distance ${level.distance}`);
  }
  assert.equal(meshes(lod.levels[0].object).filter(item => item.name.startsWith('manta-gill-slit-')).length, 10, 'five paired ventral gills');
  const colors = (model: typeof first) => vectorArray(mesh(model.root, 'manta-body-lod-0').geometry.getAttribute('color') as THREE.BufferAttribute);
  assert.notDeepEqual(colors(first), colors(second), 'individual markings are seeded into the skin');
  first.root.updateMatrixWorld(true);
  const mouth = mesh(first.root, 'manta-terminal-mouth');
  const mouthCenter = mouth.getWorldPosition(new THREE.Vector3());
  assert.ok(mouthCenter.z > span * .18 && Math.abs(mouthCenter.y) < span * .015, 'mouth is terminal at the middle of the front cap, not on the belly');
  for (const side of ['left', 'right']) {
    const eye = mesh(first.root, `manta-eye-${side}`); eye.geometry.computeBoundingBox();
    assert.ok(eye.geometry.boundingBox!.getSize(new THREE.Vector3()).x < span * .014, 'eyes stay small relative to disc width');
    const center = eye.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(center.x) < span * .14 && center.z > span * .10, 'eyes stay on the lateral head');
  }
  const tail = mesh(first.root, 'manta-long-thin-tail'), tailRoot = tail.parent!.userData.tailRoot as THREE.Vector3;
  assert.ok(tailCentre(tail).distanceTo(tailRoot) < 1e-4, 'tail begins at the exact disc root');
  tail.geometry.computeBoundingBox();
  assert.ok(tail.geometry.boundingBox!.getSize(new THREE.Vector3()).z < span * .51, 'whip tail no longer exceeds half the disc width');
  first.dispose(); second.dispose();
});

test('whale shark uses three LODs, seeded checkerboard surface colours, rigid forebody and flexible rear geometry', () => {
  const length = 8.5, first = createWhaleSharkModel(length, 201), second = createWhaleSharkModel(length, 202);
  const lod = first.root.getObjectByName('whale-shark-lod') as THREE.LOD;
  assert.deepEqual(lod.levels.map(level => level.distance), [0, 28, 60]);
  const near = mesh(first.root, 'whale-shark-body-48'), far = mesh(first.root, 'whale-shark-body-16');
  near.geometry.computeBoundingBox();
  assert.ok(Math.abs(near.geometry.boundingBox!.getSize(new THREE.Vector3()).z - length) < 1e-5, 'body length matches requested length');
  assert.ok(far.geometry.getAttribute('position').count < near.geometry.getAttribute('position').count, 'far whale LOD is lower density');
  assert.ok((lod.levels[0].object as THREE.Group).getObjectByName('whale-shark-pectoral-left-lod0'), 'near LOD carries pectoral fin geometry');
  assert.ok((lod.levels[2].object as THREE.Group).getObjectByName('whale-shark-pectoral-left-lod2'), 'far LOD retains major pectoral silhouette');
  const firstColors = vectorArray(near.geometry.getAttribute('color') as THREE.BufferAttribute), secondColors = vectorArray(mesh(second.root, 'whale-shark-body-48').geometry.getAttribute('color') as THREE.BufferAttribute);
  assert.notDeepEqual(firstColors, secondColors, 'seed changes checkerboard spot field');
  const before = vectorArray(near.geometry.getAttribute('position') as THREE.BufferAttribute);
  first.update({phase: Math.PI / 2, amplitude: 1, glide: 0});
  const after = near.geometry.getAttribute('position') as THREE.BufferAttribute;
  let front = 0, rear = 0;
  for (let index = 0; index < after.count; index++) {
    const z = before[index * 3 + 2], displacement = Math.abs(after.getX(index) - before[index * 3]);
    if (z > length * .22) front = Math.max(front, displacement);
    if (z < -length * .22) rear = Math.max(rear, displacement);
  }
  assert.ok(rear > front * 5, `rear wave ${rear} exceeds rigid-front motion ${front}`);
  assert.ok(near.castShadow, 'CPU-deformed body remains the shadow-casting geometry');
  assertFiniteUnitNormals(first.root);
  const gillDistance = first.root.userData.gillSurfaceDistance as {max: number; samples: number};
  assert.equal(gillDistance.samples, 180); assert.ok(gillDistance.max <= length * .00151, 'gill traces remain close to their sampled surface');
  first.dispose(); second.dispose();
});

test('manta and whale shark release every owned geometry and material exactly once', () => {
  for (const model of [createMantaModel(5.4, 301), createWhaleSharkModel(8.5, 302)]) {
    const releases = releaseCount(model.root);
    model.dispose(); model.dispose();
    assert.equal(releases.count(), releases.resources.size, `${model.root.name} releases all owned resources once`);
  }
});

function instanced(root: THREE.Group, name: string) {
  const object = root.getObjectByName(name);
  assert.ok(object instanceof THREE.InstancedMesh, `${name} is an InstancedMesh`);
  return object;
}

function scaleAt(mesh: THREE.InstancedMesh, index: number) {
  const matrix = new THREE.Matrix4(); mesh.getMatrixAt(index, matrix);
  return new THREE.Vector3().setFromMatrixScale(matrix);
}

function localBounds(mesh: THREE.InstancedMesh) { mesh.geometry.computeBoundingBox(); return mesh.geometry.boundingBox!; }

test('Chromis instances retain their normalized -Z silhouette, paired eyes, per-fish phase, and actual dimensions', () => {
  const phases = new Float32Array([.12, .47, .91]), lengths = new Float32Array([.04, .047, .055]), fish = createChromisVisuals(3, phases, lengths);
  const body = instanced(fish.root, 'CHROMIS_BODY'), fins = instanced(fish.root, 'CHROMIS_TRANSPARENT_FINS'), eyes = instanced(fish.root, 'CHROMIS_EYES');
  assert.equal(fish.root.children.length, 3, 'Chromis owns body, fins, and eyes only');
  const bounds = localBounds(body), dimensions = bounds.getSize(new THREE.Vector3());
  assert.ok(Math.abs(dimensions.x - .16) < 1e-6 && dimensions.y > .38 && dimensions.y < .4, 'normalized body is side-compressed (about .16 wide and .40 high)');
  assert.ok(bounds.min.z <= -.5 && bounds.max.z < .4, 'body head faces local -Z and peduncle remains aft');
  assert.ok(Math.abs(dimensions.x * scaleAt(body, 2).x - lengths[2] * .16) < 1e-7, 'instance scale yields requested actual body width');
  assert.ok(Math.abs(dimensions.y * scaleAt(body, 2).y - lengths[2] * dimensions.y) < 1e-7, 'instance matrix yields the measured actual body height');
  const eyeBounds = localBounds(eyes); assert.ok(eyeBounds.min.x < 0 && eyeBounds.max.x > 0 && eyeBounds.min.z < -.3, 'paired lateral eyes sit on both sides of the forward head');
  for (const mesh of [body, fins, eyes]) {
    const phase = mesh.geometry.getAttribute('aPhase') as THREE.InstancedBufferAttribute;
    assert.deepEqual(Array.from({length: 3}, (_, index) => phase.getX(index)), Array.from(phases), `${mesh.name} receives unique controller phases`);
  }
  const before = vectorArray(body.geometry.getAttribute('aPhase') as THREE.BufferAttribute); fish.update(42.75);
  assert.deepEqual(vectorArray(body.geometry.getAttribute('aPhase') as THREE.BufferAttribute), before, 'elapsed is not added again to shader-integrated phase');
  setChromisMotion(fish, 1, .73, 2.5);
  assert.ok(Math.abs((body.geometry.getAttribute('aPhase') as THREE.InstancedBufferAttribute).getX(1) - .73) < 1e-6, 'controller can replace exactly one Chromis phase');
  assertFiniteNondegenerateNormals(fish.root);
  const releases = releaseCount(fish.root); fish.dispose(); assert.equal(releases.count(), releases.resources.size, 'one dispose call releases every Chromis resource once');
});

test('Fusilier instances keep spindle proportions, four physical gold ribbons, dark fork tips, and controller-owned phases', () => {
  const phases = new Float32Array([.03, .31, .62, .94]), lengths = new Float32Array([.18, .21, .25, .28]), fish = createFusilierVisuals(4, phases, lengths);
  const body = instanced(fish.root, 'FUSILIER_SPINDLE_BODY'), fins = instanced(fish.root, 'FUSILIER_FINS_AND_FORK'), eyes = instanced(fish.root, 'FUSILIER_LATERAL_EYES'), stripes = instanced(fish.root, 'FUSILIER_FINE_GOLD_BANDS');
  assert.equal(fish.root.children.length, 4, 'Fusilier owns body, fins/fork, eyes, and stripe ribbons');
  const dimensions = localBounds(body).getSize(new THREE.Vector3());
  assert.ok(Math.abs(dimensions.x - .12) < 1e-6 && dimensions.y > .26 && dimensions.y < .27, 'normalized spindle body has the intended narrow width and height');
  assert.ok(Math.abs(dimensions.x * scaleAt(body, 3).x - lengths[3] * .12) < 1e-7, 'instance scale gives actual fusilier width');
  assert.ok(Math.abs(dimensions.y * scaleAt(body, 3).y - lengths[3] * dimensions.y) < 1e-7, 'instance matrix gives measured actual fusilier height');
  const eyeBounds = localBounds(eyes); assert.ok(eyeBounds.min.x < 0 && eyeBounds.max.x > 0 && eyeBounds.min.z < -.3, 'paired eyes remain laterally separated at the -Z head');
  const stripePosition = stripes.geometry.getAttribute('position') as THREE.BufferAttribute;
  assert.equal(stripePosition.count, 4 * 38, 'four stripe ribbons each contain a 19-pair strip');
  assert.equal(stripes.geometry.index!.count, 4 * 18 * 6, 'each ribbon has its own continuous quad chain');
  assert.ok(stripePosition.getX(0) < 0 && stripePosition.getX(76) > 0, 'two ribbons occupy each lateral side');
  const finColors = fins.geometry.getAttribute('color') as THREE.BufferAttribute;
  const brightness = (index: number) => finColors.getX(index) + finColors.getY(index) + finColors.getZ(index);
  assert.ok(brightness(17) < brightness(16) * .45 && brightness(19) < brightness(16) * .45, 'fork-tip vertices are materially darker than fin blue');
  for (const mesh of [body, fins, eyes, stripes]) assert.deepEqual(Array.from({length: 4}, (_, index) => (mesh.geometry.getAttribute('aPhase') as THREE.InstancedBufferAttribute).getX(index)), Array.from(phases), `${mesh.name} carries unique GLSL phases`);
  const before = vectorArray(body.geometry.getAttribute('aPhase') as THREE.BufferAttribute); fish.update(83.5);
  assert.deepEqual(vectorArray(body.geometry.getAttribute('aPhase') as THREE.BufferAttribute), before, 'elapsed cannot double-advance fusilier phase');
  setFusilierMotion(fish, 2, .77, 2); assert.ok(Math.abs((body.geometry.getAttribute('aPhase') as THREE.InstancedBufferAttribute).getX(2) - .77) < 1e-6, 'controller updates only selected fusilier phase');
  assertFiniteNondegenerateNormals(fish.root);
  const releases = releaseCount(fish.root); fish.dispose(); assert.equal(releases.count(), releases.resources.size, 'one dispose call releases every Fusilier resource once');
});

