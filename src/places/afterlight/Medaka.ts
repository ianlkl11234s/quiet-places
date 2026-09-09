import * as THREE from 'three';
import {prepareMedaka as prepareSharedMedaka, type SharedMedaka} from '../../shared/biology/medaka/Medaka.ts';
import type {MedakaRoute} from '../../shared/biology/medaka/MedakaMotion.ts';
import {prepareMedakaMotion, type MedakaMotionSample} from './MedakaMotion.ts';

const FISH_COUNT=26;
export type Medaka={root:THREE.Group;update:(elapsed:number,daylight:number)=>void;dispose:()=>void};
export type MedakaFactory=((parent:THREE.Object3D)=>Medaka)&{dispose:()=>void};

/** Afterlight owns only this local indirect-light approximation; rigging lives in shared. */
function installAfterlightMaterials(root:THREE.Object3D):THREE.Material[]{
  const materials:THREE.Material[]=[];
  root.traverse(object=>{if(!(object instanceof THREE.Mesh))return;const source=Array.isArray(object.material)?object.material:[object.material];for(const material of source){materials.push(material);if(!(material instanceof THREE.MeshStandardMaterial||material instanceof THREE.MeshPhysicalMaterial))continue;
    // `prepareSharedMedaka` has already cloned and variant-tinted this material.
    // Keep this shader byte-for-byte equivalent to the established room adapter.
    const bounce={value:0};material.userData.medakaBounce=bounce;
    material.onBeforeCompile=shader=>{shader.uniforms.medakaBounce=bounce;shader.fragmentShader='uniform float medakaBounce;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',`#include <lights_fragment_maps>
            vec3 bounceNormal = inverseTransformDirection(geometryNormal, viewMatrix);
            float bounceFacing = .35 + .65 * max(0., dot(bounceNormal, normalize(vec3(.25, .8, .35))));
            irradiance += vec3(.78, .85, .80) * medakaBounce * bounceFacing;
          `);};material.customProgramCacheKey=()=> 'medaka-local-skylight-bounce-v1';material.needsUpdate=true;
  }});return materials;
}

function cachedRoute(motion:Awaited<ReturnType<typeof prepareMedakaMotion>>,index:number):MedakaRoute{return {duration:motion.metadata.duration,activeDuration:motion.metadata.duration,controlPoints:[],sample(elapsed){return motion.sample(elapsed,index);}};}

/**
 * Afterlight keeps its frozen 26-fish cache, spatial bounds and local bounce.
 * Model loading, skeleton validation, bind poses, clone ownership and fin/tail
 * deformation are delegated to the shared Medaka factory.
 */
export async function prepareMedaka():Promise<MedakaFactory>{
  const shared=await prepareSharedMedaka();
  let motion:Awaited<ReturnType<typeof prepareMedakaMotion>>;
  try { motion=await prepareMedakaMotion(); }
  catch(error) { shared.dispose();throw error; }
  if(motion.metadata.fishCount!==FISH_COUNT){shared.dispose();throw new Error('青鱂動態快取不是 26 尾。');}
  let consumed=false;
  const factory=(parent:THREE.Object3D):Medaka=>{
    if(consumed)throw new Error('青鱂工廠只能建立一個場景實例。');consumed=true;
    const root=new THREE.Group();root.name='AfterlightMedaka';parent.add(root);
    const fish:Array<{instance:SharedMedaka;materials:THREE.Material[]}>=[];
    try {
      for(let index=0;index<FISH_COUNT;index++){
        const sample=motion.sample(0,index);
        if(sample.length<.036-1e-6||sample.length>.054+1e-6)throw new Error('青鱂個體身長不在放大後 3.6–5.4 cm 範圍。');
        const instance=shared.create(root,{route:cachedRoute(motion,index),length:sample.length,colorVariant:sample.colorVariant,name:`medaka-${index+1}`});
        fish.push({instance,materials:installAfterlightMaterials(instance.root)});
      }
    } catch(error) {
      fish.forEach(entry=>entry.instance.dispose());
      root.removeFromParent();root.clear();shared.dispose();throw error;
    }
    let disposed=false;
    return {root,update(elapsed,daylight){if(disposed)return;const time=Number.isFinite(elapsed)?elapsed:0,visibility=THREE.MathUtils.clamp(daylight,.02,1);fish.forEach((entry,index)=>{const sample:MedakaMotionSample=motion.sample(time,index);entry.instance.update(time);for(const material of entry.materials)if(material instanceof THREE.MeshStandardMaterial||material instanceof THREE.MeshPhysicalMaterial){material.envMapIntensity=.45*visibility;const proximity=1-THREE.MathUtils.smoothstep(sample.position.distanceTo(new THREE.Vector3(1.15,.8,-.35)),.30,1.05);material.userData.medakaBounce.value=.65*visibility*proximity;}});},dispose(){if(disposed)return;disposed=true;fish.forEach(entry=>entry.instance.dispose());root.removeFromParent();root.clear();shared.dispose();}};
  };
  return Object.assign(factory,{dispose(){if(!consumed){consumed=true;shared.dispose();}}});
}
