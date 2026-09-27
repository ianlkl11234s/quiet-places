import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {PlaceInstance} from '../../player/contracts.ts';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {createArcadeEnvironment,updateArcadeEnvironment,installArcadeAmbient} from './Ambient.ts';
import {installTornCloth} from './TornCloth.ts';
import {installCreatureAmbient} from './biology/CreatureAmbient.ts';
import {installArcadeSea} from './Sea.ts';
import {installFullMoon} from '../../shared/sky/FullMoon.ts';

/** Mid-Autumn candidate switch: 0 restores the confirmed moonless night sky. */
const ARCADE_FULL_MOON = 1;
/** 1: moonlight comes from the moon as shown (follows its rise and the sliders); 0: the Q2-A2 authored night direction. */
const ARCADE_MOONLIGHT_FOLLOWS_MOON = 1;
import {createArcadeBiology} from './biology/index.ts';
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

/** Replaces only the exported lettering; the original rust-edged signboard stays in the GLB. */
function installArcadeShopSign(root: THREE.Object3D) {
  const lettering = root.getObjectByName('arcade-sign-lettering');
  // Node-only lifecycle tests deliberately have no canvas implementation. The
  // shipping browser is the rendering authority for this small text overlay.
  if (!lettering || typeof document === 'undefined') return {dispose() {}};
  const canvas = document.createElement('canvas');
  canvas.width = 1280; canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) return {dispose() {}};
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#20251f';
  context.font = '500 272px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';
  context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillText('ミグ商店', canvas.width / 2, canvas.height / 2 + 8);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.MeshStandardMaterial({map: texture, transparent: true, alphaTest: .02, roughness: .9, metalness: 0, side: THREE.FrontSide});
  // The exported lettering occupies the middle of a 0.94 × 0.66 m board. This
  // transparent plane keeps its weathered perimeter and mounting hardware visible.
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(.78, .30), material);
  sign.name = 'arcade-sign-migu-store-lettering';
  sign.position.set(.75, 2.63, -4.553);
  lettering.visible = false;
  root.add(sign);
  return {
    dispose() {
      lettering.visible = true;
      sign.removeFromParent(); sign.geometry.dispose(); material.dispose(); texture.dispose();
    },
  };
}

/**
 * Q2-A2 candidate: ordinary street lamps (防犯灯-style LED heads) on the
 * existing utility poles at glTF (9.52, 0–6.2, z). z=-21 shows its head in the
 * default view; z=-8 is hidden by the arcade columns but lights the near road
 * and throws the railing/column shadows. Warm-white 3000 K-ish,
 * low chroma; inverse-square decay and a real shadow map. It is switched by
 * the scene's own night factor, so dawn/noon/dusk keep intensity 0. The light
 * stays in the scene all day (intensity 0, shadow updates paused) so the
 * shader light count never changes during a time-of-day transition.
 */
function installStreetLamp(LAMP_Z:number,shadowSize:number){
  const group=new THREE.Group();group.name=`arcade-street-lamp-${-LAMP_Z}`;
  const metal=new THREE.MeshStandardMaterial({color:'#4b4f4c',roughness:.62,metalness:.35});
  const lens=new THREE.MeshStandardMaterial({color:'#d9d6cf',roughness:.4,metalness:0,emissive:new THREE.Color('#f3dcb8'),emissiveIntensity:0});
  // Pole centre x=9.52, radius .10 m; arm leans toward the road (-x).
  const armStart=new THREE.Vector3(9.43,4.55,LAMP_Z),armEnd=new THREE.Vector3(8.82,4.78,LAMP_Z);
  const armGeometry=new THREE.CylinderGeometry(.022,.022,armStart.distanceTo(armEnd),8);
  const arm=new THREE.Mesh(armGeometry,metal);arm.position.copy(armStart).lerp(armEnd,.5);
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),armEnd.clone().sub(armStart).normalize());
  const clampGeometry=new THREE.CylinderGeometry(.115,.115,.07,12);
  const clamp=new THREE.Mesh(clampGeometry,metal);clamp.position.set(9.52,4.55,LAMP_Z);
  const headGeometry=new THREE.BoxGeometry(.40,.07,.17);
  const head=new THREE.Mesh(headGeometry,metal);head.position.set(8.74,4.79,LAMP_Z);head.rotation.z=-.08;
  const lensGeometry=new THREE.PlaneGeometry(.30,.12);
  const lensMesh=new THREE.Mesh(lensGeometry,lens);lensMesh.rotation.x=Math.PI/2;lensMesh.position.set(8.74,4.752,LAMP_Z);
  for(const mesh of [arm,clamp,head]){mesh.castShadow=true;mesh.receiveShadow=true;}
  const light=new THREE.SpotLight('#f1d9b8',0,22,1.0,.9,2);light.name='arcade-street-lamp-light';
  light.position.set(8.74,4.70,LAMP_Z);light.target.position.set(7.4,0,LAMP_Z+.4);
  light.castShadow=true;light.shadow.mapSize.set(shadowSize,shadowSize);light.shadow.camera.near=.25;light.shadow.camera.far=26;
  light.shadow.bias=-.0002;light.shadow.normalBias=.02;light.shadow.radius=3;light.shadow.autoUpdate=false;
  group.add(arm,clamp,head,lensMesh,light,light.target);
  return {group,light,
    update(night:number,lowQuality:boolean){
      const on=THREE.MathUtils.smoothstep(night,.35,1);
      // ≈ a ~700 lm residential LED lantern (about 16 cd into the lower hemisphere): intensity is in candela (physical lights, decay 2).
      light.intensity=16*on;
      lens.emissiveIntensity=1.6*on;
      const size=lowQuality?Math.min(512,shadowSize):shadowSize;
      if(light.shadow.mapSize.x!==size){light.shadow.map?.dispose();light.shadow.map=null;light.shadow.mapSize.set(size,size);}
      if(on>0)light.shadow.needsUpdate=true;
    },
    dispose(){light.shadow.map?.dispose();group.removeFromParent();[armGeometry,clampGeometry,headGeometry,lensGeometry].forEach(g=>g.dispose());metal.dispose();lens.dispose();},
  };
}

/**
 * Q2-A2 candidate: the opposite houses were flat grey boxes at viewing distance.
 * World-space facade weathering on the three `arcade-opposite-wall-*`
 * materials and per-pane variation on `arcade-distant-window` only:
 * per-parcel paint tint, a storey datum band, drip streaks under the band and
 * roof edge, and a darker splash zone. All changes multiply albedo (0.78–1.06)
 * or roughness; nothing is emissive, so night stays dark.
 * Parcel starts/widths mirror `street_context()` in assets/blender/scripts/last_arcade.py
 * (Blender y → glTF −z). Metres.
 */
const facadeGLSL=/* glsl */`
varying vec3 vArcadeFacadeWorld;
float arcadeFacadeHash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
float arcadeFacadeNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(arcadeFacadeHash(i),arcadeFacadeHash(i+vec2(1,0)),f.x),mix(arcadeFacadeHash(i+vec2(0,1)),arcadeFacadeHash(i+vec2(1,1)),f.x),f.y);}
// Parcel index along the street from Blender y=-z; tops from street_context().
void arcadeParcel(float y,out float id,out float top){
 id=0.;top=5.75;
 if(y>-1.32){id=1.;top=3.25;} if(y>3.68){id=2.;top=6.0;} if(y>9.60){id=3.;top=4.05;}
 if(y>14.30){id=4.;top=5.55;} if(y>19.95){id=5.;top=3.60;}
}
vec3 arcadeFacadeTint(vec3 p){
 float id,top;arcadeParcel(-p.z,id,top);
 // Restrained paint families: warm concrete, faded sage, pale ivory, grey.
 vec3 tint=id<.5?vec3(1.02,.99,.93):id<1.5?vec3(.90,.99,.94):id<2.5?vec3(1.04,1.02,.97):id<3.5?vec3(.96,.96,.97):id<4.5?vec3(1.03,.96,.89):vec3(.95,.99,.99);
 float h=p.y;
 // Storey datum (2.85 m) and parapet band, 10–14 cm.
 float band=smoothstep(.07,.0,abs(h-2.85))*step(3.2,top);
 float parapet=smoothstep(.16,.0,abs(h-(top-.12)));
 float columns=arcadeFacadeNoise(vec2(-p.z*5.5,1.7))*.6+arcadeFacadeNoise(vec2(-p.z*17.,4.1))*.4;
 // Drips fade over ~1.2 m below the datum and ~1.6 m below the roof edge.
 float dripBand=step(h,2.80)*smoothstep(1.2,0.,2.80-h)*step(3.2,top);
 float dripRoof=step(h,top-.14)*smoothstep(1.6,0.,top-.14-h);
 float drips=smoothstep(.55,.85,columns)*(dripBand*.55+dripRoof);
 float splash=smoothstep(.55,.0,h)*(.6+.4*arcadeFacadeNoise(vec2(-p.z*3.,h*6.)));
 float macro=arcadeFacadeNoise(vec2(-p.z*.9,h*.7))-.5;
 float shade=(1.-band*.16-parapet*.10)*(1.-drips*.30)*(1.-splash*.18)*(1.+macro*.10);
 return tint*shade;
}
`;
function installFacadeDetail(root:THREE.Object3D){
  const restores:Array<()=>void>=[];
  const done=new Set<THREE.Material>();
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      if(!(material instanceof THREE.MeshStandardMaterial)||done.has(material))continue;
      const wall=/^arcade-opposite-wall-\d$/.test(material.name),glass=material.name==='arcade-distant-window';
      if(!wall&&!glass)continue;
      done.add(material);
      const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey,key=previousKey.call(material);
      material.onBeforeCompile=(shader,renderer)=>{
        previous.call(material,shader,renderer);
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vArcadeFacadeWorld;')
          .replace('#include <begin_vertex>','#include <begin_vertex>\nvArcadeFacadeWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\n${facadeGLSL}`)
          .replace('#include <map_fragment>',wall?`#include <map_fragment>
diffuseColor.rgb*=arcadeFacadeTint(vArcadeFacadeWorld);`:`#include <map_fragment>
// Each pane gets its own interior: dark room, drawn pale curtain or blind.
vec2 arcadePane=vec2(floor(-vArcadeFacadeWorld.z*1.35),floor(vArcadeFacadeWorld.y/2.85));
float arcadePaneKind=arcadeFacadeHash(arcadePane+7.);
vec3 arcadeInterior=arcadePaneKind<.45?vec3(.55):arcadePaneKind<.75?vec3(1.55,1.48,1.32):vec3(1.2,1.22,1.18);
float arcadeCurtainFold=.9+.1*sin(-vArcadeFacadeWorld.z*38.);
diffuseColor.rgb*=arcadeInterior*mix(1.,arcadeCurtainFold,step(.45,arcadePaneKind));`)
          .replace('#include <roughnessmap_fragment>',wall?`#include <roughnessmap_fragment>
roughnessFactor=clamp(roughnessFactor+.04*(1.-arcadeFacadeTint(vArcadeFacadeWorld).g),0.,1.);`:`#include <roughnessmap_fragment>
roughnessFactor=clamp(roughnessFactor+.18*arcadeFacadeNoise(vArcadeFacadeWorld.zy*3.),0.,1.);`);
      };
      material.customProgramCacheKey=()=>`${key}|last-arcade-facade-${wall?'wall':'glass'}-v1`;
      material.needsUpdate=true;
      restores.push(()=>{material.onBeforeCompile=previous;material.customProgramCacheKey=previousKey;material.needsUpdate=true;});
    }
  });
  return {dispose(){restores.splice(0).forEach(restore=>restore());}};
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
    const facade=installFacadeDetail(root);
    root.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material instanceof THREE.MeshStandardMaterial) material.envMapIntensity = object.userData.arcade_role === 'foliage' ? .22 : .38;
      }
    });
    const foliage = installFoliageWind(root);
    const shopSign = installArcadeShopSign(root);
    const tornCloth = installTornCloth(root);
    const clothAmbient = installCreatureAmbient(tornCloth.group);
    const sky = new THREE.HemisphereLight(new THREE.Color('#b9d3e2'), new THREE.Color('#a58b65'), .25);
    const sun = new THREE.DirectionalLight(new THREE.Color('#ffe0b2'), arcadeConfig.sun.energy);
    const sunTarget = new THREE.Vector3(0, 0, -9);
    const blenderSun = new THREE.Vector3(...arcadeConfig.sun.directionToLight);
    const afternoonSunDirection = new THREE.Vector3(blenderSun.x, blenderSun.z, -blenderSun.y).normalize();
    sun.position.copy(sunTarget).addScaledVector(afternoonSunDirection, 42); sun.target.position.copy(sunTarget); sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096); sun.shadow.camera.near = .1; sun.shadow.camera.far = 100;
    Object.assign(sun.shadow.camera, {left: -12, right: 12, top: 18, bottom: -8});
    sun.shadow.normalBias = .0015; sun.shadow.bias = -.00004; sun.shadow.radius=2.5; sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true;
    const sea = installArcadeSea(root);
    const biology=createArcadeBiology();scene.add(biology.root);
    const streetLamps=[installStreetLamp(-8,1024),installStreetLamp(-21,512)];streetLamps.forEach(lamp=>scene.add(lamp.group));
    // Broad, upward-facing patches represent sunlight reflected by the open road.
    // RectAreaLight has no occlusion; keep the emitting planes outside the arcade.
    const groundBounces=[-5,-18].map(z=>{const light=new THREE.RectAreaLight('#e8c99a',.8,3.4,12);light.name='arcade-road-bounce';light.position.set(4.8,-.10,z);light.rotation.x=-Math.PI/2;return light;});
    const position:[number,number,number]=[arcadeConfig.camera.position[0], arcadeConfig.camera.position[2], -arcadeConfig.camera.position[1]];
    const target:[number,number,number]=[arcadeConfig.camera.target[0], arcadeConfig.camera.target[2], -arcadeConfig.camera.target[1]];
    // Rises from behind the opposite roofs into the upper-right sky.
    const moon=installFullMoon({position,target,verticalFov:arcadeConfig.camera.verticalFov,enabled:!!ARCADE_FULL_MOON,name:'arcade-full-moon',
      defaults:{size:2.4, brightness:1, x:.70, y:.76}, riseFrom:{x:.12, y:-.55}});
    scene.add(root, sky, sun, sun.target, moon.mesh,...groundBounces); scene.background = background;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    let disposed = false, quality: number | undefined;
    return {
      position, target,
      fov: arcadeConfig.camera.verticalFov,
      cameraMode: 'fixed-position', yawRange: Math.PI / 30, exposure: 1.08, toneMapping: THREE.AgXToneMapping,
      hasSimulation: true, waterMode: '黑潮生物在乾燥街道間巡游；遠海與藤葉隨時間流動',
      update(_dt, elapsed, state) {
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
        foliage.update(elapsed, state.activity);
        tornCloth.update(elapsed, state.activity); clothAmbient.update(elapsed);
        sea.update(elapsed);
        biology.update(_dt,elapsed);
        // This is an art-directed direct/hemisphere-light approximation. The GLB
        // contains no baked GI, so changing time deliberately does not claim a
        // recalculated indirect-light solution.
        const daylight = THREE.MathUtils.clamp(state.intensity/.9, 0, 1.1);
        const hour = state.hour ?? 14;
        const dusk = THREE.MathUtils.smoothstep(hour,14.5,17.5)*(1-THREE.MathUtils.smoothstep(hour,17.5,19));
        // Night factor for the Q2-A2 candidate: 1 at 23:00 (intensity .09),
        // 0 at dawn/noon/dusk moments (daylight ≥ .4), so those stay unchanged.
        const night = 1-THREE.MathUtils.smoothstep(daylight,.12,.38);
        moon.update(night,_dt);
        // Three caches the equirect→cube conversion of a background texture and
        // does not watch its version, so the old dusk-only updates never reached
        // the visible sky. Invalidate only when the night step changes: the
        // moon sky is actually shown, while dawn/noon/dusk keep the confirmed
        // rendering (see docs/scenes/last-arcade.md, Q2-A2).
        const backgroundNight=Math.round(THREE.MathUtils.clamp(night,0,1)*20);
        updateArcadeEnvironment(background,dusk,night);
        if(backgroundNight!==background.userData.nightShown){background.userData.nightShown=backgroundNight;background.dispose();background.needsUpdate=true;}
        const reflectionStep=environment.userData.duskStep;
        updateArcadeEnvironment(environment,dusk,night);
        // Three caches PMREM for ordinary DataTextures: invalidate that cache
        // only when the quantized sky changes, so dusk reaches reflections too.
        if(reflectionStep!==environment.userData.duskStep){environment.dispose();environment.needsUpdate=true;}
        // sampleTime(14:00) has angle .25, which is the authored config baseline.
        const sunDirection = afternoonSunDirection.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (state.angle-.25)*.55).normalize();
        sunDirection.y *= 1-.38*dusk; sunDirection.normalize();
        // Blend by the moon's own visibility so dusk → night turns the light
        // toward the moon together with its fade-in and rise.
        if(ARCADE_MOONLIGHT_FOLLOWS_MOON&&moon.mesh.visible)sunDirection.lerp(moon.direction,THREE.MathUtils.smoothstep(night,.2,1)).normalize();
        // A moon still low behind the roofs gives weaker light than a risen one.
        const moonRise = ARCADE_MOONLIGHT_FOLLOWS_MOON ? 1-night*(1-(.45+.55*moon.risen)) : 1;
        const targetSunIntensity = Math.max(.08, arcadeConfig.sun.energy*daylight)*(1-.45*night)*moonRise;
        const targetSkyIntensity = .025 + .22*Math.min(1, daylight);
        // The night palette is already dark, so its intensities converge to a
        // fixed value instead of being scaled down a second time.
        scene.environmentIntensity=THREE.MathUtils.lerp(.025+.50*Math.min(1,daylight),.9,night);
        scene.backgroundIntensity=THREE.MathUtils.lerp(.06+.94*Math.min(1,daylight),1,night);
        streetLamps.forEach(lamp=>lamp.update(night,!!state.lowQuality));
        for(const light of groundBounces){
          // Sun-on-road bounce; at night the moon's share of it is negligible.
          light.intensity=(.02+.38*Math.min(1,daylight))*(1-.85*night);
          light.color.set('#e8c99a').lerp(new THREE.Color('#efb56f'),dusk);
        }
        sun.position.copy(sunTarget).addScaledVector(sunDirection, 42);
        sun.intensity = targetSunIntensity;
        sun.color.setRGB(1, 1-.20*state.warmth, 1-.40*state.warmth).lerp(new THREE.Color().setRGB(1,.57,.25),dusk);
        // Moonlight: same authored direction, cooler and desaturated (not blue).
        sun.color.lerp(new THREE.Color().setRGB(.66,.74,.86),night);
        sky.intensity = targetSkyIntensity;
        sky.color.set('#b9d3e2').lerp(new THREE.Color('#e8bc88'), state.warmth*.28);

        const resolution = state.lowQuality ? 1024 : 4096;
        if (resolution !== quality) { quality = resolution; sun.shadow.map?.dispose(); sun.shadow.map = null; sun.shadow.mapSize.set(resolution, resolution); }
        sun.shadow.needsUpdate = true;
      },
      moonDefaults: moon.defaults, setMoon(settings) {moon.setSettings(settings);},
      disturb() {biology.disturb();}, resetWater() {},
      dispose() {
        if (disposed) return; disposed = true;
        moon.dispose(); clothAmbient.dispose(); tornCloth.dispose(); streetLamps.forEach(lamp=>lamp.dispose()); facade.dispose(); biology.dispose(); foliage.dispose(); shopSign.dispose(); sea.dispose(); sun.shadow.map?.dispose(); sun.shadow.mapPass?.dispose(); sun.removeFromParent(); sun.target.removeFromParent(); sky.removeFromParent(); release();
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
