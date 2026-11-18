import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {createLongFinKoiSchool, LONG_FIN_KOI_HEADING, LONG_FIN_KOI_LENGTHS, LONG_FIN_KOI_STEP, LONG_FIN_KOI_TAIL_BEAT, KOI_POINTER, type LongFinKoiSchool} from '../src/places/waterlight/LongFinKoiMotion.ts';
import {applyTurnBend, createTurnBendRig, prepareLongFinKoiSchool, KOI_TURN_BEND_MAX_DEG} from '../src/places/waterlight/FishSchool.ts';
import {tailBeatFrequency} from '../src/shared/biology/locomotion/index.ts';

Object.assign(globalThis, {self: globalThis, createImageBitmap: async () => ({width: 1, height: 1, close() {}})});
async function load() {
  const bytes = await readFile(new URL('../public/models/long-fin-koi-school.glb', import.meta.url));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}
const OFF = {bodyLengthFrequency: false, pointerResponse: 0} as const;
function run(school: LongFinKoiSchool, steps: number, ray?: (frame: number) => void) {
  for (let i = 0; i < steps; i++) { ray?.(i); school.update(LONG_FIN_KOI_STEP, {angle: Math.sin(i / 300) * .6, activity: .5}); }
}
function digest(school: LongFinKoiSchool, clocks = true) {
  const v: number[] = [];
  for (const f of school.poses()) { v.push(...f.position.toArray(), ...f.velocity.toArray(), ...f.quaternion.toArray(), f.burst, f.yawRate, f.bank, f.turn); if (clocks) v.push(f.actionClock, f.motionPhase); }
  return createHash('sha256').update(Buffer.from(new Float64Array(v).buffer)).digest('hex');
}
/** sha256 of the pre-candidate (HEAD) school, seed 1234, 3600 steps; clock + motion fields in the original order. */
const HEAD_DIGEST = '2eb03f9386d4e4baddcadeed7ccc527df60908bcca05252c29e3d94807e7e8d9';
function headDigest(school: LongFinKoiSchool) {
  const v: number[] = [];
  for (const f of school.poses()) v.push(...f.position.toArray(), ...f.velocity.toArray(), ...f.quaternion.toArray(), f.actionClock, f.motionPhase, f.burst, f.yawRate, f.bank, f.turn);
  return createHash('sha256').update(Buffer.from(new Float64Array(v).buffer)).digest('hex');
}
function rayAt(origin: THREE.Vector3, direction = new THREE.Vector3(0, 0, -1)) { return new THREE.Ray(origin.clone(), direction.clone()); }
/** A ray that passes `offset` metres beside the fish, travelling along -Z. */
function rayBeside(school: LongFinKoiSchool, index: number, offset: number, wobble = 0) {
  const p = school.poses()[index].position;
  return rayAt(new THREE.Vector3(p.x + offset + wobble, p.y, p.z + 10));
}

test('B2-2 off: the clock and every pose are bit-identical to the pre-candidate school; pointer calls are inert at response 0', () => {
  const school = createLongFinKoiSchool(1234, OFF);
  run(school, 3600, frame => { school.pointerRay(rayAt(new THREE.Vector3(Math.sin(frame / 50), 3.5, 5)), frame % 120 === 0); });
  assert.equal(headDigest(school), HEAD_DIGEST);
  const plain = createLongFinKoiSchool(1234, {bodyLengthFrequency: false});
  run(plain, 3600, () => {});
  assert.equal(headDigest(plain), HEAD_DIGEST, 'pointer response alone, never called, does not perturb the school');
  assert.equal(school.inspect().pointerAlert, 0);
});

test('B2-2 body-length clock: small fish beat faster, the school mean at a common speed is unchanged, positions are untouched', () => {
  assert.equal(LONG_FIN_KOI_LENGTHS.length, 16);
  for (const speed of [.017, .032, .05, .06, .12]) {
    const mean = LONG_FIN_KOI_LENGTHS.reduce((sum, length) => sum + tailBeatFrequency(speed, length, LONG_FIN_KOI_TAIL_BEAT), 0) / 16;
    const former = .65 + 6.5 * speed;
    assert.ok(Math.abs(mean / former - 1) < .03, `speed ${speed}: ${mean} vs ${former}`);
  }
  const small = tailBeatFrequency(.05, .28, LONG_FIN_KOI_TAIL_BEAT), large = tailBeatFrequency(.05, .45, LONG_FIN_KOI_TAIL_BEAT);
  assert.ok(small > large * 1.05, `${small} > ${large}`);
  assert.ok(tailBeatFrequency(.34, .28, LONG_FIN_KOI_TAIL_BEAT) <= LONG_FIN_KOI_TAIL_BEAT.maxFrequency);
  const on = createLongFinKoiSchool(1234, {bodyLengthFrequency: true, pointerResponse: 0}), off = createLongFinKoiSchool(1234, OFF);
  run(on, 1800); run(off, 1800);
  assert.equal(digest(on, false), digest(off, false), 'the clock never feeds back into steering');
  // Over the run, the clock advances differently per fish but equally on average (<=3%).
  const total = (school: LongFinKoiSchool) => school.poses().reduce((sum, f) => sum + f.actionClock, 0);
  assert.notEqual(digest(on), digest(off));
  const advance = (school: LongFinKoiSchool) => total(school);
  assert.ok(Math.abs(advance(on) / advance(off) - 1) < .03, `${advance(on)} vs ${advance(off)}`);
  const ratio = (school: LongFinKoiSchool, a: number, b: number) => school.poses()[a].actionClock / school.poses()[b].actionClock;
  assert.notEqual(ratio(on, 0, 5), ratio(off, 0, 5));
});

test('B1a moving pointer: fish beside the ray turn away, far fish are unaffected, the response decays after about 2 s of stillness', () => {
  const control = createLongFinKoiSchool(77, {bodyLengthFrequency: false, pointerResponse: 0}), school = createLongFinKoiSchool(77, {bodyLengthFrequency: false, pointerResponse: .5});
  run(control, 300); run(school, 300);
  assert.equal(digest(control), digest(school), 'identical until the pointer arrives');
  const poses = school.poses();
  // Choose the fish and put the ray .5 body length beside it.
  const target = 3, offset = poses[target].length * .5;
  const rayAtStart = rayBeside(school, target, offset);
  const distanceTo = (s: LongFinKoiSchool, ray: THREE.Ray, i: number) => ray.distanceToPoint(s.poses()[i].position);
  const far = poses.map((f, i) => ({i, d: distanceTo(school, rayAtStart, i)})).sort((a, b) => b.d - a.d)[0];
  assert.ok(far.d > KOI_POINTER.alertRadius * poses[far.i].length, 'the farthest fish is outside the alert radius');
  const before = poses[target].position.clone(), controlBefore = control.poses()[target].position.clone();
  run(control, 60);
  run(school, 60, frame => school.pointerRay(rayAt(rayAtStart.origin.clone().add(new THREE.Vector3(frame * 1e-4, 0, 0))), false));
  const moved = school.poses()[target].position, still = control.poses()[target].position;
  const gap = (p: THREE.Vector3, q: THREE.Vector3) => p.distanceTo(q);
  assert.ok(gap(moved, still) > 5e-4, `the near fish departs from the control: ${gap(moved, still)}`);
  const lateral = (p: THREE.Vector3) => Math.abs(p.x - (rayAtStart.origin.x + 59e-4));
  assert.ok(lateral(moved) > lateral(still), 'the near fish ends farther from the ray than the control');
  assert.ok(gap(school.poses()[far.i].position, control.poses()[far.i].position) < gap(moved, still) * .2, 'a distant fish is essentially unaffected');
  void before; void controlBefore;
  assert.equal(school.inspect().pointerAlert, 1);
  // Still pointer (the same ray every frame) decays to 0 after ~2 s; undefined also ends it.
  run(school, 60, () => school.pointerRay(rayAt(rayAtStart.origin.clone().add(new THREE.Vector3(59e-4, 0, 0))), false));
  assert.ok(school.inspect().pointerAlert < 1);
  run(school, 80, () => school.pointerRay(rayAt(rayAtStart.origin.clone().add(new THREE.Vector3(59e-4, 0, 0))), false));
  assert.equal(school.inspect().pointerAlert, 0, 'about 2 s after the pointer stops the response is 0');
  school.pointerRay(rayAtStart, false); assert.equal(school.inspect().pointerAlert, 1);
  school.pointerRay(undefined, false); assert.equal(school.inspect().pointerAlert, 0);
});

test('B1a response scales the push; 1 is stronger than .5', () => {
  const gaps = [.25, .5, 1].map(response => {
    const control = createLongFinKoiSchool(77, OFF), school = createLongFinKoiSchool(77, {bodyLengthFrequency: false, pointerResponse: response});
    run(control, 300); run(school, 300);
    const ray = rayBeside(school, 3, .15);
    run(control, 90); run(school, 90, frame => school.pointerRay(rayAt(ray.origin.clone().add(new THREE.Vector3(frame * 1e-4, 0, 0))), false));
    return school.poses()[3].position.distanceTo(control.poses()[3].position);
  });
  assert.ok(gaps[0] < gaps[1] && gaps[1] < gaps[2], gaps.join(' < '));
});

test('B1a tap: nearby fish take one existing burst (at most two), distant fish only get alert, 6 s cooldown, reduced motion stays quiet', () => {
  const school = createLongFinKoiSchool(31, {bodyLengthFrequency: false, pointerResponse: .5});
  run(school, 60); // t = 1 s, before any scheduled burst
  const tapped = () => school.poses().filter(f => (f as unknown as {startled: boolean}).startled).map(f => f.index);
  assert.ok(school.poses().every(f => f.burst === 0));
  // A ray passing right through fish 5 and 6's neighbourhood.
  const p = school.poses()[5].position;
  school.pointerRay(rayAt(new THREE.Vector3(p.x + .05, p.y, p.z + 10)), true);
  const first = tapped();
  assert.ok(first.includes(5) && first.length <= 2, `tapped fish: ${first}`);
  for (const index of first) assert.ok(school.poses()[index].position.distanceTo(new THREE.Vector3(p.x + .05, p.y, p.z)) < LONG_FIN_KOI_LENGTHS[index] * KOI_POINTER.tapRadius + 1e-9);
  run(school, 90);
  assert.ok(school.poses()[5].burst > .2, 'fish 5 is in the existing burst envelope');
  assert.ok(school.poses().filter(f => f.burst > 0).length <= 2);
  assert.ok(Math.abs(school.inspect().pointerAlert - .5) < .02, 'tap alert has decayed half way after 1.5 s of its 3 s');
  // Second tap inside the cooldown, near another fish: only alert, no new burst.
  const q = school.poses().find(f => !first.includes(f.index))!.position;
  school.pointerRay(rayAt(new THREE.Vector3(q.x, q.y, q.z + 10)), true);
  assert.deepEqual(tapped(), first, 'cooldown: no further tap bursts within 6 s');
  // After the cooldown a tap can start a burst again (when a slot is free).
  run(school, 60 * 7);
  const free = school.poses().filter(f => f.burst === 0 && !(f as unknown as {startled: boolean}).startled);
  const r = free[0].position;
  const active = school.poses().filter(f => f.burst > 0).length;
  school.pointerRay(rayAt(new THREE.Vector3(r.x, r.y, r.z + 10)), true);
  const startedNow = school.poses().filter(f => (f as unknown as {startled: boolean}).startled && f.burst === 0 && f.actionClock >= 0).length;
  assert.ok(active >= 2 || startedNow >= 1, 'after the cooldown a tap starts a burst when the two-burst cap allows');
  // Reduced motion: taps never create bursts.
  const quiet = createLongFinKoiSchool(31, {pointerResponse: 1});
  for (let i = 0; i < 60; i++) quiet.update(LONG_FIN_KOI_STEP, {reducedMotion: true});
  const w = quiet.poses()[5].position; quiet.pointerRay(rayAt(new THREE.Vector3(w.x, w.y, w.z + 10)), true);
  for (let i = 0; i < 120; i++) quiet.update(LONG_FIN_KOI_STEP, {reducedMotion: true});
  assert.ok(quiet.poses().every(f => f.burst === 0));
});

test('B1a robustness: invalid rays are ignored; a ray is copied, not retained', () => {
  const school = createLongFinKoiSchool(5, {pointerResponse: 1});
  run(school, 120);
  const ray = rayBeside(school, 2, .1);
  school.pointerRay(ray, false);
  ray.origin.set(1e9, 1e9, 1e9); ray.direction.set(0, 0, 0);
  run(school, 120);
  school.pointerRay(new THREE.Ray(new THREE.Vector3(NaN, 0, 0), new THREE.Vector3(0, 0, -1)), true);
  school.pointerRay(new THREE.Ray(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, 0, 0)), true);
  run(school, 120);
  assert.ok(school.inspect().finite);
});

test('B1a bounded: twenty minutes of sweeping pointer and taps keep the school inside its activity limits', () => {
  const school = createLongFinKoiSchool(0x51f15, {pointerResponse: 1});
  let minSpacing = Infinity, maxSpeed = 0, maxBeam = 0, maxBursts = 0;
  const angleOf = (frame: number) => Math.sin(frame / 720) * .8;
  for (let frame = 0; frame < 60 * 1200; frame++) {
    // The pointer sweeps through the shoal and pauses; a tap every 7 s through the nearest-to-ray fish.
    const phase = frame / 60, sweep = Math.floor(phase / 11) % 2 === 0;
    if (sweep || frame % 7 === 0) {
      const p = school.poses()[Math.floor(phase / 7) % 16].position;
      school.pointerRay(rayAt(new THREE.Vector3(p.x + Math.sin(phase * .9) * .25, p.y + Math.cos(phase) * .1, p.z + 10)), frame % 420 === 0);
    }
    school.update(LONG_FIN_KOI_STEP, {angle: angleOf(frame), activity: .5});
    const fish = school.poses();
    maxBursts = Math.max(maxBursts, fish.filter(f => f.burst > 0).length);
    for (const f of fish) {
      assert.ok(f.position.x > -3.7 && f.position.x < 3.7 && f.position.z > -4.7 && f.position.z < 10.7 && f.position.y >= 2.18 && f.position.y <= 4.82, 'inside walls and floor/ceiling margins');
      maxSpeed = Math.max(maxSpeed, f.velocity.length());
    }
    if (frame % 30 === 0) { const check = school.inspect(); maxBeam = Math.max(maxBeam, check.maxBeamRadius); minSpacing = Math.min(minSpacing, check.minSpacing); }
  }
  assert.ok(maxBeam <= 3, `beam radius ${maxBeam}`);
  assert.ok(maxSpeed <= .34 + 1e-9, `speed ${maxSpeed}`);
  assert.ok(maxBursts <= 2, `bursts ${maxBursts}`);
  assert.ok(minSpacing > .45, `spacing ${minSpacing}`);
  console.log(JSON.stringify({pointerRun: {maxBeam, maxSpeed, maxBursts, minSpacing}}));
});

test('B2-1 turn bend: rear spine bends toward the inside of the turn, capped, zero when straight, softened under a TURN clip, off at 0', async () => {
  const gltf = await load();
  for (const template of gltf.scene.children) assert.equal(createTurnBendRig(cloneSkeleton(template)).parts.length, 5, `${template.name} finds its five (possibly de-duplicated) spine bones`);
  const maxBend = LONG_FIN_KOI_HEADING.maxBend;
  const measure = (bend: number, clip = 0, gain = 1) => {
    const root = cloneSkeleton(gltf.scene.getObjectByName('KOI_04')!);
    const rig = createTurnBendRig(root);
    applyTurnBend(rig, bend, maxBend, clip, gain);
    root.updateMatrixWorld(true);
    const at = (name: string) => { let found!: THREE.Object3D; root.traverse(o => { if (o.name === name || o.name.startsWith(`${name}_`) && /^\d+$/.test(o.name.slice(name.length + 1))) found = o; }); return found.getWorldPosition(new THREE.Vector3()); };
    const head = at('head'), tip = at('tail_tip');
    return {x: tip.x - head.x, angle: Math.atan2(tip.x - head.x, Math.abs(tip.z - head.z))};
  };
  const straight = measure(0), left = measure(-maxBend), right = measure(maxBend), half = measure(-maxBend / 2);
  assert.ok(left.x < straight.x - .005, `left turn (bend<0) puts the tail inside, toward -X: ${left.x} vs ${straight.x}`);
  assert.ok(right.x > straight.x + .005, 'right turn bends toward +X');
  assert.ok(Math.abs((left.x - straight.x) + (right.x - straight.x)) < 1e-3, 'symmetric');
  assert.ok(Math.abs(half.x - straight.x) < Math.abs(left.x - straight.x) && Math.abs(half.x - straight.x) > 0, 'continuous in bend');
  const deflection = Math.abs(left.angle - straight.angle) * 180 / Math.PI;
  assert.ok(deflection > 3 && deflection <= KOI_TURN_BEND_MAX_DEG + 1e-6, `tail-tip deflection ${deflection} deg is capped at ${KOI_TURN_BEND_MAX_DEG}`);
  assert.deepEqual(measure(-5 * maxBend), left, 'over-range bend is clamped');
  assert.ok(Math.abs(measure(-maxBend, 1).x - straight.x) < Math.abs(left.x - straight.x) * .3, 'a fully blended TURN clip takes most of the bend away');
  assert.deepEqual(measure(-maxBend, 0, 0), straight, 'gain 0 changes nothing');
  assert.deepEqual(measure(Number.NaN), straight, 'non-finite bend is ignored');
  console.log(JSON.stringify({turnBend: {tailTipDeflectionDeg: deflection, tailTipOffsetBL: left.x - straight.x}}));
});

test('B2-1 wired into the school: with the candidate on, turning fish differ from off by a bend that points to the turn', async () => {
  const build = async (turnBend: number) => {
    const gltf = await load(), original = GLTFLoader.prototype.loadAsync; GLTFLoader.prototype.loadAsync = async () => gltf;
    try { const scene = new THREE.Scene(); return {scene, school: (await prepareLongFinKoiSchool({turnBend, pointerResponse: 0}))(scene)}; }
    finally { GLTFLoader.prototype.loadAsync = original; }
  };
  const on = await build(1), off = await build(0);
  let compared = 0, agreeing = 0, identicalStraight = 0, straight = 0;
  const tail = (scene: THREE.Scene, i: number) => {
    const root = scene.getObjectByName(`KOI_INSTANCE_${String(i + 1).padStart(2, '0')}`)!; root.updateMatrixWorld(true);
    let tip!: THREE.Object3D; root.traverse(o => { if (/^tail_tip(_\d+)?$/.test(o.name)) tip = o; });
    return tip.getWorldPosition(new THREE.Vector3()).applyMatrix4(root.parent!.matrixWorld.clone().invert()).x;
  };
  for (let frame = 0; frame < 60 * 90; frame++) {
    const state = {intensity: 1, warmth: .5, angle: Math.sin(frame / 300) * .6, activity: .5};
    on.school.update(1 / 60, frame / 60, state); off.school.update(1 / 60, frame / 60, state);
    if (frame % 20) continue;
    on.scene.updateMatrixWorld(true); off.scene.updateMatrixWorld(true);
    for (let i = 0; i < 16; i++) {
      const delta = tail(on.scene, i) - tail(off.scene, i);
      const carrierOn = on.scene.getObjectByName('LongFinKoiSchool')!.children[i], q = carrierOn.quaternion;
      // Carrier bank is the roll into the turn (positive = left); a left turn must move the tail toward -X (negative delta).
      const bank = new THREE.Euler().setFromQuaternion(q, 'YXZ').z;
      if (Math.abs(bank) > THREE.MathUtils.degToRad(3)) { compared++; if (Math.sign(delta) === -Math.sign(bank)) agreeing++; }
      else if (Math.abs(bank) < THREE.MathUtils.degToRad(.2)) { straight++; if (Math.abs(delta) < .004) identicalStraight++; }
    }
  }
  console.log(JSON.stringify({turnBendWiring: {compared, agreeing, straight, identicalStraight}}));
  assert.ok(compared > 20 && agreeing / compared > .95, `bend agrees with bank direction: ${agreeing}/${compared}`);
  assert.ok(identicalStraight / Math.max(1, straight) > .9, 'near-straight fish are barely changed');
  on.school.dispose(); off.school.dispose();
  assert.equal(typeof on.school.pointerRay, 'function');
});
