import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {EXRLoader} from 'three/addons/loaders/EXRLoader.js';
import type {PlaceInstance} from '../places/catalog';
import {installLeaflightMotion} from './LeaflightMotion';
import {createLeaflightLighting} from './LeaflightLighting';

function disposeModel(root:THREE.Object3D){
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    geometries.add(object.geometry);
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      materials.add(material);
      for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);
    }
  });
  textures.forEach(texture=>texture.dispose());materials.forEach(material=>material.dispose());geometries.forEach(geometry=>geometry.dispose());
  root.removeFromParent();
}

export async function prepareLeaflight(){
  // Complete asset loading before the caller replaces its current place.
  const gltf=await new GLTFLoader().loadAsync('/models/leaflight-study.glb');
  const root=gltf.scene;
  let indirect:THREE.DataTexture;
  try{
    indirect=await new EXRLoader().loadAsync('/textures/leaflight/room-indirect.exr');
  }catch(error){disposeModel(root);throw error;}
  indirect.flipY=false;indirect.channel=0;
  // EXRLoader reverses scanlines into bottom-up data; glTF PNG UVs are top-down.
  indirect.repeat.y=-1;indirect.offset.y=1;
  indirect.colorSpace=THREE.LinearSRGBColorSpace;
  root.updateMatrixWorld(true);
  const hero=root.getObjectByName('Camera_Hero');
  if(!(hero instanceof THREE.PerspectiveCamera)){
    indirect.dispose();disposeModel(root);throw new Error('樹影場景缺少主鏡頭。');
  }
  const position=hero.getWorldPosition(new THREE.Vector3());
  const forward=hero.getWorldDirection(new THREE.Vector3());
  const target=position.clone().addScaledVector(forward,8.2);
  const fov=hero.fov;
  const skyDaylight={value:1};
  const roomMaterials=new Set<THREE.MeshStandardMaterial>();
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    object.castShadow=true;object.receiveShadow=true;
    if(object.name==='RoomSurface'){
      const materials=Array.isArray(object.material)?object.material:[object.material];
      for(const material of materials)if(material instanceof THREE.MeshStandardMaterial){
        material.onBeforeCompile=shader=>{
          shader.uniforms.uWindowDaylight=skyDaylight;
          shader.vertexShader=shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWindowWorld;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWindowWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
          shader.fragmentShader=shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWindowWorld;\nuniform float uWindowDaylight;')
            .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
              // Local aperture bounce approximation, restricted to nearby stone.
              // No global ambient lift: remote walls/floor keep their baked darkness.
              vec3 aperture=vec3(4.0,clamp(vWindowWorld.y,4.6,7.5),clamp(vWindowWorld.z,-3.2,3.2));
              float distanceToOpening=length(aperture-vWindowWorld);
              float windowFill=exp(-distanceToOpening*1.8)*.09*uWindowDaylight;
              reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.48,.61,.73)*windowFill;
            `);
        };
        material.customProgramCacheKey=()=> 'leaflight-window-skylight-v1';
        material.lightMap=indirect;
        // Cycles diffuse-indirect excludes albedo; Three applies Lambert / PI.
        material.lightMapIntensity=Math.PI;
        material.needsUpdate=true;roomMaterials.add(material);
      }
    }
  });
  if(!roomMaterials.size){indirect.dispose();disposeModel(root);throw new Error('樹影場景缺少烘焙後的 RoomSurface。');}
  let consumed=false;
  const factory=(scene:THREE.Scene,renderer:THREE.WebGLRenderer):PlaceInstance=>{
    consumed=true;
    scene.add(root);
    const lighting=createLeaflightLighting(scene);
    lighting.fill.intensity=0; // Baked exterior bounce supplies the room's indirect light.
    const motion=installLeaflightMotion(root);
    const originalShadow=renderer.shadowMap.enabled;
    const originalShadowType=renderer.shadowMap.type;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    return {
      position:position.toArray() as [number,number,number],target:target.toArray() as [number,number,number],
      yawRange:Math.PI/12,fov,exposure:2**.8,toneMapping:THREE.AgXToneMapping,
      hasSimulation:false,waterMode:'',
      update(_dt,elapsed,state){
        skyDaylight.value=THREE.MathUtils.clamp(state.intensity/.9,.03,1);
        motion.update(elapsed,.85,skyDaylight.value);
        lighting.update(elapsed,state.beamStrength??1,state.intensity/.9,state.warmth,state.angle);
        // One afternoon indirect basis, gently scaled for other moments. Direct
        // leaf shadows remain live; per-moment rebakes are a later fidelity pass.
        for(const material of roomMaterials)material.lightMapIntensity=Math.PI*(state.intensity/.9);
      },
      disturb(){},resetWater(){},
      dispose(){
        motion.dispose();lighting.dispose();disposeModel(root);
        renderer.shadowMap.enabled=originalShadow;
        renderer.shadowMap.type=originalShadowType;
      },
    };
  };
  return Object.assign(factory,{dispose(){if(!consumed){consumed=true;disposeModel(root);}}});
}
