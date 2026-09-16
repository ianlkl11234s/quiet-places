import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {PlaceInstance} from '../../player/contracts.ts';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {createArcadeEnvironment,updateArcadeEnvironment,installArcadeAmbient} from './Ambient.ts';
import {installArcadeSea} from './Sea.ts';
import arcadeConfig from '../../../assets/config/last-arcade.json' with {type:'json'};

type FoliageMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;

interface WindBinding {
  mesh: FoliageMesh;
  uniforms: {uArcadeWindTime: THREE.IUniform<number>; uArcadeWindStrength: THREE.IUniform<number>; uArcadeWindWorldToLocal: THREE.IUniform<THREE.Matrix4>};
}

function windShader(material: THREE.Material, binding: WindBinding): void {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.(shader, renderer);
    Object.assign(shader.uniforms, binding.uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
uniform float uArcadeWindTime;
uniform float uArcadeWindStrength;
uniform mat4 uArcadeWindWorldToLocal;
attribute float arcadeWindWeight;
attribute float arcadeLeafSky;
varying float arcadeLeafSkyAccess;
`).replace('#include <begin_vertex>', `#include <begin_vertex>
arcadeLeafSkyAccess=arcadeLeafSky;
float arcadeTip = clamp(arcadeWindWeight,0.,1.);
vec3 arcadeWorldBase = (modelMatrix*vec4(transformed,1.)).xyz;
float arcadePhase = dot(arcadeWorldBase.xz,vec2(.83,1.17))+arcadeWorldBase.y*.61;
vec2 arcadeBreeze = vec2(sin(uArcadeWindTime*.58+arcadePhase),cos(uArcadeWindTime*.43+arcadePhase*.71));
// A 0.6–1.6 cm local breeze. The world vector is converted back to the mesh's
// local axes, so an exporter-preserved node rotation cannot tilt the wind plane.
float arcadeAmplitude=.006+.010*(.5+.5*sin(uArcadeWindTime*.13+arcadePhase*.2));
transformed += (uArcadeWindWorldToLocal*vec4(vec3(arcadeBreeze.x,0.,arcadeBreeze.y)*arcadeAmplitude*arcadeTip*arcadeTip*uArcadeWindStrength,0.)).xyz;
`);
    if (material instanceof THREE.MeshStandardMaterial) {
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float arcadeLeafSkyAccess;')
        .replace('#include <aomap_fragment>', `#include <aomap_fragment>
// Building-only sky access; direct sun and moving leaf shadows stay live.
reflectedLight.indirectDiffuse*=mix(.55,1.,clamp(arcadeLeafSkyAccess,0.,1.));`);
    }
  };
  material.customProgramCacheKey = () => `${material.type}-last-arcade-foliage-wind-sky-v2`;
  material.needsUpdate = true;
}

/** Installs a conservative local-space breeze on explicitly tagged GLB foliage only. */
function installFoliageWind(root: THREE.Object3D) {
  const restores: Array<() => void> = [];
  const bindings: WindBinding[] = [];
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.userData.arcade_role !== 'foliage') return;
    const mesh = object as FoliageMesh;
    const position = mesh.geometry.getAttribute('position');
    if (!position) return;
    // Blender's opaque glTF exporter strips vertex-colour alpha. The builder
    // exports this explicit scalar instead; a local-height fallback would move
    // attached leaf roots, so a missing attribute is an asset-contract error.
    const weight = mesh.geometry.getAttribute('_arcade_wind');
    if (!weight || weight.itemSize !== 1) throw new Error(`潮風商店街植被 ${mesh.name} 缺少 _arcade_wind 根到梢權重。`);
    if (!mesh.geometry.getAttribute('arcadeWindWeight')) mesh.geometry.setAttribute('arcadeWindWeight', weight);
    // Earlier review GLBs have no sky field; open-sky fallback keeps them comparable.
    mesh.geometry.setAttribute('arcadeLeafSky',mesh.geometry.getAttribute('_arcade_sky') ?? new THREE.BufferAttribute(new Float32Array(position.count).fill(1),1));
    const uniforms: WindBinding['uniforms'] = {
      uArcadeWindTime: {value: 0}, uArcadeWindStrength: {value: 1},
      uArcadeWindWorldToLocal: {value: new THREE.Matrix4()},
    };
    const binding: WindBinding = {mesh, uniforms};
    const originalMaterial = mesh.material;
    const originals = Array.isArray(originalMaterial) ? originalMaterial : [originalMaterial];
    const copies = originals.map(source => source.clone());
    copies.forEach(material => windShader(material, binding));
    const originalDepth = mesh.customDepthMaterial, originalDistance = mesh.customDistanceMaterial;
    const source = copies.find((material): material is THREE.MeshStandardMaterial => material instanceof THREE.MeshStandardMaterial);
    if (!source) { copies.forEach(material => material.dispose()); return; }
    const depth = new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking, alphaTest: source.alphaTest, map: source.map, alphaMap: source.alphaMap, side: source.side});
    const distance = new THREE.MeshDistanceMaterial({alphaTest: source.alphaTest, map: source.map, alphaMap: source.alphaMap, side: source.side});
    windShader(depth, binding); windShader(distance, binding);
    mesh.material = Array.isArray(originalMaterial) ? copies : copies[0];
    mesh.customDepthMaterial = depth; mesh.customDistanceMaterial = distance;
    bindings.push(binding);
    restores.push(() => { mesh.material = originalMaterial; mesh.customDepthMaterial = originalDepth; mesh.customDistanceMaterial = originalDistance; copies.forEach(material => material.dispose()); depth.dispose(); distance.dispose(); });
  });
  return {
    update(elapsed: number, activity: number) {
      for (const {mesh, uniforms} of bindings) {
        mesh.updateWorldMatrix(true, false);
        uniforms.uArcadeWindTime.value = Number.isFinite(elapsed) ? elapsed : 0;
        uniforms.uArcadeWindStrength.value = THREE.MathUtils.clamp(.72 + activity*.28, .5, 1);
        uniforms.uArcadeWindWorldToLocal.value.copy(mesh.matrixWorld).invert();
      }
    },
    dispose() { restores.splice(0).forEach(restore => restore()); },
  };
}

export async function prepareLastArcade() {
  let gltf: Awaited<ReturnType<GLTFLoader['loadAsync']>>;
  try { gltf = await new GLTFLoader().loadAsync('/models/last-arcade.glb'); }
  catch (cause) { throw new Error('無法載入潮風商店街模型 /models/last-arcade.glb。', {cause}); }
  const root = gltf.scene;
  const resources = collectModelResources(root);
  const release = () => { root.removeFromParent(); disposeModelResources(resources, ['textures', 'materials', 'geometries', 'skeletons']); };
  // Validate before installing shaders, so a rejected asset still releases its resources.
  try { root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.userData.arcade_role !== 'foliage') return;
    const weight=object.geometry.getAttribute('_arcade_wind');
    if (!weight || weight.itemSize!==1) throw new Error(`潮風商店街植被 ${object.name} 缺少 _arcade_wind 根到梢權重。`);
  }); } catch (error) { release(); throw error; }
  let consumed = false;
  const factory = (scene: THREE.Scene, renderer: THREE.WebGLRenderer): PlaceInstance => {
    if (consumed) throw new Error('潮風商店街資源已使用。');
    consumed = true;
    const oldShadow = {enabled: renderer.shadowMap.enabled, type: renderer.shadowMap.type};
    if (!('LTC_FLOAT_1' in THREE.UniformsLib)) RectAreaLightUniformsLib.init();
    const priorAmbient={environment:scene.environment,background:scene.background,environmentIntensity:scene.environmentIntensity,backgroundIntensity:scene.backgroundIntensity};
    const background=createArcadeEnvironment(),environment=createArcadeEnvironment();scene.environment=environment;
    installArcadeAmbient(root);
    root.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material instanceof THREE.MeshStandardMaterial) material.envMapIntensity = object.userData.arcade_role === 'foliage' ? .22 : .38;
      }
    });
    const foliage = installFoliageWind(root);
    const sky = new THREE.HemisphereLight(new THREE.Color('#b9d3e2'), new THREE.Color('#a58b65'), .25);
    const sun = new THREE.DirectionalLight(new THREE.Color('#ffe0b2'), arcadeConfig.sun.energy);
    const sunTarget = new THREE.Vector3(0, 0, -9);
    const blenderSun = new THREE.Vector3(...arcadeConfig.sun.directionToLight);
    const afternoonSunDirection = new THREE.Vector3(blenderSun.x, blenderSun.z, -blenderSun.y).normalize();
    sun.position.copy(sunTarget).addScaledVector(afternoonSunDirection, 15); sun.target.position.copy(sunTarget); sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096); sun.shadow.camera.near = .1; sun.shadow.camera.far = 46;
    Object.assign(sun.shadow.camera, {left: -12, right: 12, top: 18, bottom: -8});
    sun.shadow.normalBias = .0015; sun.shadow.bias = -.00004; sun.shadow.radius=2.5; sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true;
    const sea = installArcadeSea(root);
    // Broad, upward-facing patches represent sunlight reflected by the open road.
    // RectAreaLight has no occlusion; keep the emitting planes outside the arcade.
    const groundBounces=[-5,-18].map(z=>{const light=new THREE.RectAreaLight('#e8c99a',.8,3.4,12);light.name='arcade-road-bounce';light.position.set(4.8,-.10,z);light.rotation.x=-Math.PI/2;return light;});
    scene.add(root, sky, sun, sun.target,...groundBounces); scene.background = background;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    let disposed = false, quality: number | undefined;
    return {
      position: [arcadeConfig.camera.position[0], arcadeConfig.camera.position[2], -arcadeConfig.camera.position[1]],
      target: [arcadeConfig.camera.target[0], arcadeConfig.camera.target[2], -arcadeConfig.camera.target[1]],
      fov: arcadeConfig.camera.verticalFov,
      cameraMode: 'fixed-position', yawRange: Math.PI / 30, exposure: 1.08, toneMapping: THREE.AgXToneMapping,
      hasSimulation: false, waterMode: '遠海由模型提供；藤葉隨播放器時間輕擺',
      update(_dt, elapsed, state) {
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
        foliage.update(elapsed, state.activity);
        sea.update(elapsed);
        // This is an art-directed direct/hemisphere-light approximation. The GLB
        // contains no baked GI, so changing time deliberately does not claim a
        // recalculated indirect-light solution.
        const daylight = THREE.MathUtils.clamp(state.intensity/.9, 0, 1.1);
        const hour = state.hour ?? 14;
        const dusk = THREE.MathUtils.smoothstep(hour,14.5,17.5)*(1-THREE.MathUtils.smoothstep(hour,17.5,19));
        updateArcadeEnvironment(background,dusk);
        // sampleTime(14:00) has angle .25, which is the authored config baseline.
        const sunDirection = afternoonSunDirection.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (state.angle-.25)*.55).normalize();
        sunDirection.y *= 1-.38*dusk; sunDirection.normalize();
        const targetSunIntensity = Math.max(.08, arcadeConfig.sun.energy*daylight);
        const targetSkyIntensity = .025 + .22*Math.min(1, daylight);
        scene.environmentIntensity=.025+.50*Math.min(1,daylight);
        scene.backgroundIntensity=.06+.94*Math.min(1,daylight);
        for(const light of groundBounces){
          light.intensity=.02+.38*Math.min(1,daylight);
          light.color.set('#e8c99a').lerp(new THREE.Color('#efb56f'),dusk);
        }
        sun.position.copy(sunTarget).addScaledVector(sunDirection, 15);
        sun.intensity = targetSunIntensity;
        sun.color.setRGB(1, 1-.20*state.warmth, 1-.40*state.warmth).lerp(new THREE.Color().setRGB(1,.57,.25),dusk);
        sky.intensity = targetSkyIntensity;
        sky.color.set('#b9d3e2').lerp(new THREE.Color('#e8bc88'), state.warmth*.28);

        const resolution = state.lowQuality ? 1024 : 4096;
        if (resolution !== quality) { quality = resolution; sun.shadow.map?.dispose(); sun.shadow.map = null; sun.shadow.mapSize.set(resolution, resolution); }
        sun.shadow.needsUpdate = true;
      },
      disturb() {}, resetWater() {},
      dispose() {
        if (disposed) return; disposed = true;
        foliage.dispose(); sea.dispose(); sun.shadow.map?.dispose(); sun.shadow.mapPass?.dispose(); sun.removeFromParent(); sun.target.removeFromParent(); sky.removeFromParent(); release();
        groundBounces.forEach(light=>light.removeFromParent());
        if(scene.environment===environment)scene.environment=priorAmbient.environment;
        if(scene.background===background)scene.background=priorAmbient.background;
        scene.environmentIntensity=priorAmbient.environmentIntensity;scene.backgroundIntensity=priorAmbient.backgroundIntensity;
        background.dispose();environment.dispose();
        renderer.shadowMap.enabled = oldShadow.enabled; renderer.shadowMap.type = oldShadow.type;
      },
    };
  };
  return Object.assign(factory, {dispose() { if (!consumed) { consumed = true; release(); } }});
}
