import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {sampleKoiMotion, type KoiIndex} from './KoiMotion.ts';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';

export type BlenderKoi = {
  /** `elapsed` is the single animation clock; supplying the same value restores the same pose. */
  update: (dt: number, elapsed: number, daylight: number) => void;
  dispose: () => void;
};

export type BlenderKoiFactory = ((scene: THREE.Scene, sun: THREE.DirectionalLight) => BlenderKoi) & {dispose: () => void};

type KoiInstance = {
  carrier: THREE.Group;
  animatedRoot: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  index: KoiIndex;
  steering: {bone: THREE.Bone; axis: THREE.Vector3; gain: number; baked: THREE.Quaternion}[];
};

const STEERING_BONES = ['spine_02', 'spine_03', 'spine_04', 'spine_05', 'peduncle'];

function disposeTemplateResources(root: THREE.Object3D) {
  const resources = collectModelResources(root);
  root.removeFromParent();
  disposeModelResources(resources, ['textures', 'materials', 'geometries', 'skeletons']);
}

function isOpaque(material: THREE.Material) {
  return !material.transparent && material.opacity >= .999;
}

function installDiffuseFill(material: THREE.Material, daylight: {value: number}, sun: THREE.DirectionalLight) {
  if (!(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial)) return;
  const previous = material.onBeforeCompile;
  const cacheKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.uKoiDiffuseFill = daylight;
    shader.uniforms.uKoiSunMatrix = {value: sun.shadow.matrix};
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vKoiWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvKoiWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uKoiDiffuseFill;\nuniform mat4 uKoiSunMatrix;\nvarying vec3 vKoiWorld;')
      // This adds reflected diffuse radiance after Three has accumulated the
      // ordinary lights. It is intentionally not emissive, so koi still read
      // as shaded bodies and retain the room's direct-light contrast.
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
// Finite opening: angular size falls with distance, and the body normal
// determines which side sees the cool outdoor sky.
vec3 koiNormal = inverseTransformDirection(normal, viewMatrix);
vec3 toWindow = vec3(4.0, 6.05, 0.0) - vKoiWorld;
float skySolidAngle = min(.8, 18.56 / max(dot(toWindow,toWindow), 1.0));
float skyFacing = max(dot(koiNormal, normalize(toWindow)), 0.0);
vec3 skyBounce = vec3(.42,.56,.72) * skySolidAngle * skyFacing * 1.5;
// One nearby floor sample estimates reflected sunlight. It uses the same
// live shadow map as the room, so a dark floor does not glow under the belly.
float floorSun = 0.0;
#if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
  DirectionalLightShadow koiShadow = directionalLightShadows[0];
  vec3 floorPoint = vec3(vKoiWorld.x+.35, .015, vKoiWorld.z);
  vec4 floorCoord = uKoiSunMatrix * vec4(floorPoint, 1.0);
  floorSun = getShadow(directionalShadowMap[0], koiShadow.shadowMapSize,
    koiShadow.shadowIntensity, koiShadow.shadowBias, koiShadow.shadowRadius, floorCoord);
#endif
float floorFacing = max(-koiNormal.y, 0.0);
vec3 floorBounce = vec3(.60,.48,.32) * (.035 + .36*floorSun) * floorFacing;
reflectedLight.indirectDiffuse += diffuseColor.rgb * (skyBounce + floorBounce + vec3(.012)) * uKoiDiffuseFill;`);
  };
  material.customProgramCacheKey = () => `${cacheKey.call(material)}|quiet-places-koi-directional-bounce-v2`;
  material.needsUpdate = true;
}

function cloneMaterialsAndConfigure(root: THREE.Object3D, daylight: {value: number}, ownedMaterials: Set<THREE.Material>, sun: THREE.DirectionalLight) {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const source = Array.isArray(object.material) ? object.material : [object.material];
    const materials = source.map(material => {
      const instance = material.clone();
      ownedMaterials.add(instance);
      if (isOpaque(instance)) installDiffuseFill(instance, daylight, sun);
      return instance;
    });
    object.material = Array.isArray(object.material) ? materials : materials[0];
    const opaque = materials.some(isOpaque);
    object.castShadow = opaque;
    object.receiveShadow = opaque;
  });
}

/**
 * Loads the authored koi once. The returned factory is transactional: calling
 * `dispose()` before it is consumed frees the GLB. Factories are single-use:
 * the returned scene instance releases its cloned materials, mixers, and the
 * shared GLB resources together when it is disposed.
 */
export async function prepareBlenderKoi(): Promise<BlenderKoiFactory> {
  const gltf = await new GLTFLoader().loadAsync('/models/koi.glb');
  const template = gltf.scene;
  const swim = gltf.animations.find(clip => clip.name === 'KOI_ACT_SLOW_CRUISE');
  if (!swim || !template.getObjectByName('KOI_RIG')) {
    disposeTemplateResources(template);
    throw new Error('錦鯉模型缺少 KOI_ACT_SLOW_CRUISE 骨架動畫。');
  }
  for (const name of STEERING_BONES) {
    if (!(template.getObjectByName(name) as THREE.Bone)?.isBone) {
      disposeTemplateResources(template);
      throw new Error(`錦鯉骨架缺少 ${name}。`);
    }
  }
  template.updateMatrixWorld(true);
  const sourceBounds = new THREE.Box3().setFromObject(template);
  const sourceLength = sourceBounds.max.z - sourceBounds.min.z;
  if (!Number.isFinite(sourceLength) || sourceLength <= 1e-4) {
    disposeTemplateResources(template);
    throw new Error('錦鯉模型缺少可用的 -Z 身長。');
  }
  const sourceCenter = sourceBounds.getCenter(new THREE.Vector3());

  let consumed = false;
  const factory = (scene: THREE.Scene, sun: THREE.DirectionalLight): BlenderKoi => {
    if (consumed) throw new Error('錦鯉工廠只能建立一個場景實例。');
    consumed = true;
    const root = new THREE.Group();
    root.name = 'BlenderKoi';
    const daylight = {value: .04};
    const koiInstances: KoiInstance[] = [];
    const ownedMaterials = new Set<THREE.Material>();
    const ownedSkeletons = new Set<THREE.Skeleton>();

    for (const index of [0, 1, 2] as const) {
      // SkeletonUtils preserves both skinned bones and morph-target animation
      // bindings, while sharing immutable GLB geometry and textures.
      const carrier = new THREE.Group();
      const koi = cloneSkinned(template);
      collectModelResources(koi).skeletons.forEach(skeleton => ownedSkeletons.add(skeleton));
      koi.updateMatrixWorld(true);
      const steering = STEERING_BONES.map((name, i) => {
        const bone = koi.getObjectByName(name) as THREE.Bone;
        // Store the exported bone-local dorsal axis, rather than assuming
        // Blender bone roll matches a Three Euler component.
        const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
        return {bone, axis, gain: .012 + .004 * i, baked: bone.quaternion.clone()};
      });
      carrier.name = `koi-${index + 1}`;
      const length = sampleKoiMotion(0, index).length;
      const scale = length / sourceLength;
      koi.scale.setScalar(scale);
      // The GLB's origin is not assumed to be its body centre. This keeps the
      // actual body centre at the requested .24-.32 m swim height.
      koi.position.copy(sourceCenter).multiplyScalar(-scale);
      cloneMaterialsAndConfigure(koi, daylight, ownedMaterials, sun);
      carrier.add(koi);
      root.add(carrier);
      const mixer = new THREE.AnimationMixer(koi);
      mixer.clipAction(swim).play();
      koiInstances.push({carrier, animatedRoot: koi, mixer, index, steering});
    }
    scene.add(root);

    let disposed = false;
    return {
      update(_dt, elapsed, nextDaylight) {
        if (disposed) return;
        const time = Number.isFinite(elapsed) ? elapsed : 0;
        daylight.value = THREE.MathUtils.clamp(Number.isFinite(nextDaylight) ? nextDaylight * .06 : .04, .002, .06);
        koiInstances.forEach(({carrier, mixer, index, steering}) => {
          const pose = sampleKoiMotion(time, index);
          carrier.position.copy(pose.position);
          carrier.quaternion.copy(pose.quaternion);
          // In-place skeletal action: the route exclusively owns world travel.
          // Distance-based absolute time couples propulsion and travel, and
          // restores exactly the same skin/shadow pose when paused or seeking.
          for (const control of steering) control.bone.quaternion.copy(control.baked);
          mixer.setTime(pose.animationTime);
          // A gentle posterior steering bias follows path curvature; the head
          // remains stable, and every update starts from the baked pose.
          for (const {bone, axis, gain, baked} of steering) {
            baked.copy(bone.quaternion);
            bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, pose.turn * gain));
          }
        });
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        scene.remove(root);
        koiInstances.forEach(({mixer, animatedRoot}) => {
          mixer.stopAllAction();
          mixer.uncacheRoot(animatedRoot);
        });
        // SkeletonUtils allocates one skeleton per clone; geometry and textures
        // stay owned by the single-use template released below.
        disposeModelResources({skeletons: ownedSkeletons}, ['skeletons']);
        ownedMaterials.forEach(material => material.dispose());
        root.clear();
        // This is a single-use factory. No other instance can retain these
        // shared GLB geometry or textures once the scene instance is gone.
        disposeTemplateResources(template);
      },
    };
  };
  return Object.assign(factory, {
    dispose() {
      if (!consumed) {
        consumed = true;
        disposeTemplateResources(template);
      }
    },
  });
}
