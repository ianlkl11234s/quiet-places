import type {LightingState} from '../../player/contracts.ts';
import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {collectModelResources, disposeModelResources} from '../../shared/resources/ModelResources.ts';
import {FISH_FIN_MEMBRANE, installFishSurface, prepareFinMembrane, type FishBodySurface} from '../../shared/biology/fish-surface/index.ts';
import {createLongFinKoiSchool, LONG_FIN_KOI_HEADING, type LongFinKoiBehavior, type LongFinKoiOptions, type LongFinKoiPose, type LongFinKoiSchool} from './LongFinKoiMotion.ts';

export type FishSchoolState = LightingState;
export type FishSchool = {update: (dt: number, elapsed: number, state: FishSchoolState) => void; pointerRay: LongFinKoiSchool['pointerRay']; dispose: () => void; inspect: () => ReturnType<LongFinKoiSchool['inspect']>};
export type FishSchoolOptions = LongFinKoiOptions & {turnBend?: number};

/**
 * B2-1 candidate (art calibration): multiplier on a continuous C-bend laid over the
 * rear spine after the mixer, following the shared steering `bend`. 1 = the tail
 * tip is turned up to 12 deg (spread 10/15/20/25/30 % over spine_02..peduncle) at the
 * largest bend; reduced by up to 75 % while a TURN clip is blended in. 0 = off
 * (nothing is touched). Revert = set 0.
 */
export const KOI_TURN_BEND = 1;
export const KOI_TURN_BEND_MAX_DEG = 12;
const TURN_BEND_BONES = [['spine_02', .10], ['spine_03', .15], ['spine_04', .20], ['spine_05', .25], ['peduncle', .30]] as const;
export type TurnBendRig = {parts: {bone: THREE.Bone; axis: THREE.Vector3; share: number; baked: THREE.Quaternion}[]; applied: boolean};

/** Bone-local dorsal axes of the rear spine, read in the bind pose with the root unrotated. GLTF de-duplication appends _N to bone names. */
export function createTurnBendRig(root: THREE.Object3D): TurnBendRig {
  root.updateMatrixWorld(true);
  const bones: THREE.Bone[] = [];
  root.traverse(object => { if ((object as THREE.Bone).isBone) bones.push(object as THREE.Bone); });
  const rig: TurnBendRig = {parts: [], applied: false};
  for (const [name, share] of TURN_BEND_BONES) {
    const bone = bones.find(item => item.name === name) ?? bones.find(item => item.name.startsWith(`${name}_`) && /^\d+$/.test(item.name.slice(name.length + 1))); if (!bone) return {parts: [], applied: false};
    rig.parts.push({bone, axis: new THREE.Vector3(0, 1, 0).applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert()), share, baked: new THREE.Quaternion()});
  }
  return rig;
}
const BEND_STEP = new THREE.Quaternion();
/**
 * `bend` is the steering bend (body lengths, negative = tail toward fish-left),
 * `maxBend` its maximum, `turnClip` the summed TURN_* blend weight 0..1. Call after
 * the mixer has written the bones. The mixer skips bones whose animated value did
 * not change (e.g. dt = 0), so call `restoreTurnBend` before the next mixer update.
 */
export function applyTurnBend(rig: TurnBendRig, bend: number, maxBend: number, turnClip: number, gain: number) {
  if (!(gain > 0) || !(maxBend > 0) || !Number.isFinite(bend)) return;
  rig.applied = true;
  const normalized = THREE.MathUtils.clamp(bend / maxBend, -1, 1);
  const angle = normalized * gain * KOI_TURN_BEND_MAX_DEG * Math.PI / 180 * (1 - .75 * THREE.MathUtils.clamp(turnClip, 0, 1));
  for (const {bone, axis, share, baked} of rig.parts) { baked.copy(bone.quaternion); bone.quaternion.multiply(BEND_STEP.setFromAxisAngle(axis, angle * share)); }
}
export function restoreTurnBend(rig: TurnBendRig) {
  if (!rig.applied) return;
  rig.applied = false;
  for (const {bone, baked} of rig.parts) bone.quaternion.copy(baked);
}
export type FishSchoolFactory = ((scene: THREE.Scene) => FishSchool) & {dispose: () => void};
const ACTION: Record<LongFinKoiBehavior, string> = {hover: 'IDLE_HOVER', slow: 'SLOW_CRUISE', glide: 'GLIDE', left: 'TURN_LEFT', right: 'TURN_RIGHT', rise: 'SLIGHT_RISE', descend: 'SLIGHT_DESCEND', pause: 'PAUSE'};

/**
 * Q0-6: turn clips follow the presented (actual) yaw rate, not the steering
 * intent. TURN_LEFT bends the tail toward -X (measured on the GLB), which is the
 * inside of a positive-yaw-rate turn in the shared locomotion convention.
 */
function actionFor(pose: LongFinKoiPose): string {
  const swimming = pose.behavior !== 'hover' && pose.behavior !== 'pause';
  if (swimming && Math.abs(pose.turn) > .6) return pose.turn > 0 ? 'TURN_LEFT' : 'TURN_RIGHT';
  if (pose.burst > .15 || pose.behavior === 'left' || pose.behavior === 'right') return 'SLOW_CRUISE';
  return ACTION[pose.behavior];
}

const LONG_FIN_BODY_SURFACE: FishBodySurface = {role: 'body', countershade: .08, sheen: .25, sheenTint: new THREE.Color(.92, .96, 1)};

function configureLongFinMaterials(root: THREE.Object3D) {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    // The Blender ray strips remain in the authored source but alias into
    // bright dotted lines at web-review scale, so the web presentation uses
    // the broader fin membrane only.
    if (object.name.includes('LFK_RAY')) { object.visible = false; return; }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    // Q1-4 candidate: shared fish surface (materials are shared by clones; installation is idempotent).
    if (object.name.includes('LFK_BODY')) materials.forEach(material => installFishSurface(material, LONG_FIN_BODY_SURFACE));
    if (!object.name.includes('LFK_FIN')) return;
    materials.forEach(material => { prepareFinMembrane(material); installFishSurface(material, FISH_FIN_MEMBRANE); });
  });
}

function clipForRoot(clip: THREE.AnimationClip, root: THREE.Object3D) {
  // GLTFLoader de-duplicates Blender's repeated bone names as root, root_1,
  // etc. Membership is therefore based on the actual loaded subtree, rather
  // than a guessed KOI_01/ track prefix.
  const members = new Set<string>(); root.traverse(object => members.add(object.name));
  const tracks = clip.tracks.filter(track => members.has(track.name.slice(0, track.name.lastIndexOf('.')))).map(track => track.clone());
  return new THREE.AnimationClip(`${clip.name}:${root}`, clip.duration, tracks);
}

/** Loads one authored seven-rig GLB before Waterlight replaces its current place. */
export async function prepareLongFinKoiSchool(options: FishSchoolOptions = {}): Promise<FishSchoolFactory> {
  const turnBend = Number.isFinite(options.turnBend) ? Math.max(0, options.turnBend!) : KOI_TURN_BEND;
  let gltf: Awaited<ReturnType<GLTFLoader['loadAsync']>>;
  try { gltf = await new GLTFLoader().loadAsync('/models/long-fin-koi-school.glb'); }
  catch { throw new Error('長鰭錦鯉資產無法載入。'); }
  // Keep seven authored variants as templates; instances share their GPU
  // geometry/materials but own cloned bones and skeleton resources.
  const resources = collectModelResources(gltf.scene);
  const names = Array.from({length: 7}, (_, index) => `KOI_${String(index + 1).padStart(2, '0')}`);
  const roots = names.map(name => gltf.scene.getObjectByName(name));
  if (roots.some(root => !root)) { disposeModelResources(resources, ['textures', 'materials', 'geometries', 'skeletons']); throw new Error('長鰭錦鯉資產缺少 KOI_01 至 KOI_07。'); }
  const clips = new Map<string, THREE.AnimationClip>();
  for (const name of Object.values(ACTION)) {
    const clip = gltf.animations.find(item => item.name === `KOI_ACT_${name}`);
    if (!clip) { disposeModelResources(resources, ['textures', 'materials', 'geometries', 'skeletons']); throw new Error(`長鰭錦鯉資產缺少 KOI_ACT_${name}。`); }
    clips.set(name, clip);
  }
  let consumed = false, released = false;
  const release = () => { if (released) return; released = true; disposeModelResources(resources, ['textures', 'materials', 'geometries', 'skeletons']); gltf.scene.removeFromParent(); };
  const factory = (scene: THREE.Scene): FishSchool => {
    if (consumed) throw new Error('長鰭錦鯉工廠只能建立一個場景實例。'); consumed = true;
    const group = new THREE.Group(); group.name = 'LongFinKoiSchool'; scene.add(group);
    const motion = createLongFinKoiSchool(undefined, options);
    const fish: {carrier: THREE.Group; model: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>; weights: Map<string, number>; bend: TurnBendRig}[] = [];
    try { motion.poses().forEach((pose, index) => {
      const template = roots[index % roots.length]!;
      const root = cloneSkeleton(template);
      root.name = `KOI_INSTANCE_${String(index + 1).padStart(2, '0')}`;
      root.userData.variantSource = template.name;
      // SkeletonUtils clones a skeleton per mesh. Parts of this fish share the
      // same bones/inverse binds, so keep one palette per fish, not per fin.
      const palettes: THREE.Skeleton[] = [];
      root.traverse(object => {
        if (!(object instanceof THREE.SkinnedMesh)) return;
        const skeleton = object.skeleton;
        const shared = palettes.find(candidate => candidate.bones.length === skeleton.bones.length && candidate.bones.every((bone, i) => bone === skeleton.bones[i] && candidate.boneInverses[i].equals(skeleton.boneInverses[i])));
        if (shared) { object.skeleton = shared; skeleton.dispose(); }
        else palettes.push(skeleton);
      });
      collectModelResources(root).skeletons.forEach(skeleton => resources.skeletons.add(skeleton));
      const carrier = new THREE.Group(); carrier.name = `long-fin-koi-${index + 1}`;
      root!.removeFromParent(); carrier.add(root!); group.add(carrier); root!.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } }); configureLongFinMaterials(root!);
      root!.updateMatrixWorld(true); const bounds = new THREE.Box3().setFromObject(root!); const size = bounds.getSize(new THREE.Vector3()); const sourceLength = Math.max(size.x, size.y, size.z);
      if (!Number.isFinite(sourceLength) || sourceLength < 1e-4) throw new Error(`${root!.name} 缺少可用的身長。`);
      root!.scale.multiplyScalar(pose.length / sourceLength);
      const mixer = new THREE.AnimationMixer(root!);
      const actions = new Map<string, THREE.AnimationAction>();
      for (const [name, clip] of clips) {
        const scoped = clipForRoot(clip, root!);
        if (!scoped.tracks.length) throw new Error(`長鰭錦鯉動畫 ${name} 沒有 ${root!.name} tracks。`);
        const action = mixer.clipAction(scoped); action.play(); action.paused = true; action.enabled = true; action.setEffectiveWeight(name === 'SLOW_CRUISE' ? 1 : 0); actions.set(name, action);
      }
      fish.push({carrier, model: root!, mixer, actions, bend: turnBend > 0 ? createTurnBendRig(root!) : {parts: [], applied: false}, weights: new Map(Array.from(actions, ([name]) => [name, name === 'SLOW_CRUISE' ? 1 : 0]))});
    }); } catch (error) { scene.remove(group); group.clear(); release(); throw error; }
    let disposed = false;
    return {
      update(dt, _elapsed, state) {
        if (disposed) return; motion.update(dt, {angle: state.angle, activity: state.activity});
        motion.poses().forEach((pose, index) => {
          const item = fish[index], name = actionFor(pose); item.carrier.position.copy(pose.position); item.carrier.quaternion.copy(pose.quaternion);
          const blend = 1 - Math.exp(-(Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .25) : 0) / 1.5);
          item.actions.forEach((action, key) => {
            const weight = THREE.MathUtils.lerp(item.weights.get(key) ?? 0, key === name ? 1 : 0, blend); item.weights.set(key, weight); action.setEffectiveWeight(weight);
            action.time = pose.actionClock % action.getClip().duration;
          });
          restoreTurnBend(item.bend); item.mixer.update(0);
          if (item.bend.parts.length) applyTurnBend(item.bend, pose.bend, LONG_FIN_KOI_HEADING.maxBend, (item.weights.get('TURN_LEFT') ?? 0) + (item.weights.get('TURN_RIGHT') ?? 0), turnBend);
        });
      },
      pointerRay: (ray, tap) => { if (!disposed) motion.pointerRay(ray, tap); },
      inspect: motion.inspect,
      dispose() { if (disposed) return; disposed = true; scene.remove(group); fish.forEach(item => { item.mixer.stopAllAction(); item.mixer.uncacheRoot(item.model); }); group.clear(); release(); },
    };
  };
  return Object.assign(factory, {dispose() { if (!consumed) { consumed = true; release(); } }});
}
