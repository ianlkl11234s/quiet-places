import type {LightingState} from '../../player/contracts.ts';
import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {collectModelResources, disposeModelResources} from '../../shared/resources/ModelResources.ts';
import {createLongFinKoiSchool, type LongFinKoiBehavior, type LongFinKoiSchool} from './LongFinKoiMotion.ts';

export type FishSchoolState = LightingState;
export type FishSchool = {update: (dt: number, elapsed: number, state: FishSchoolState) => void; dispose: () => void; inspect: () => ReturnType<LongFinKoiSchool['inspect']>};
export type FishSchoolFactory = ((scene: THREE.Scene) => FishSchool) & {dispose: () => void};
const ACTION: Record<LongFinKoiBehavior, string> = {hover: 'IDLE_HOVER', slow: 'SLOW_CRUISE', glide: 'GLIDE', left: 'TURN_LEFT', right: 'TURN_RIGHT', rise: 'SLIGHT_RISE', descend: 'SLIGHT_DESCEND', pause: 'PAUSE'};

function configureLongFinMaterials(root: THREE.Object3D) {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    // The Blender ray strips remain in the authored source but alias into
    // bright dotted lines at web-review scale, so the web presentation uses
    // the broader fin membrane only.
    if (object.name.includes('LFK_RAY')) { object.visible = false; return; }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (!object.name.includes('LFK_FIN')) return;
    materials.forEach(material => {
      material.transparent = true; material.depthWrite = false;
      if (material instanceof THREE.MeshPhysicalMaterial) material.transmission = 0;
      material.needsUpdate = true;
    });
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
export async function prepareLongFinKoiSchool(): Promise<FishSchoolFactory> {
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
    const motion = createLongFinKoiSchool();
    const fish: {carrier: THREE.Group; model: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>; weights: Map<string, number>}[] = [];
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
      fish.push({carrier, model: root!, mixer, actions, weights: new Map(Array.from(actions, ([name]) => [name, name === 'SLOW_CRUISE' ? 1 : 0]))});
    }); } catch (error) { scene.remove(group); group.clear(); release(); throw error; }
    let disposed = false;
    return {
      update(dt, _elapsed, state) {
        if (disposed) return; motion.update(dt, {angle: state.angle, activity: state.activity});
        motion.poses().forEach((pose, index) => {
          const item = fish[index], name = pose.burst > .15 ? 'SLOW_CRUISE' : ACTION[pose.behavior]; item.carrier.position.copy(pose.position); item.carrier.quaternion.copy(pose.quaternion);
          const blend = 1 - Math.exp(-(Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .25) : 0) / 1.5);
          item.actions.forEach((action, key) => {
            const weight = THREE.MathUtils.lerp(item.weights.get(key) ?? 0, key === name ? 1 : 0, blend); item.weights.set(key, weight); action.setEffectiveWeight(weight);
            action.time = pose.actionClock % action.getClip().duration;
          });
          item.mixer.update(0);
        });
      },
      inspect: motion.inspect,
      dispose() { if (disposed) return; disposed = true; scene.remove(group); fish.forEach(item => { item.mixer.stopAllAction(); item.mixer.uncacheRoot(item.model); }); group.clear(); release(); },
    };
  };
  return Object.assign(factory, {dispose() { if (!consumed) { consumed = true; release(); } }});
}
