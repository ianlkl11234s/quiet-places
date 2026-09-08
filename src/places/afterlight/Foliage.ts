import * as THREE from 'three';
import {createAfterlightPlantPhysics} from './PlantPhysics.ts';

export function installAfterlightFoliage(root:THREE.Object3D){
 const plant=createAfterlightPlantPhysics();root.add(plant.root);
 const day={value:1},sun={value:new THREE.Vector3(.28,-1,.25).normalize()};
 plant.root.traverse(object=>{if(!(object instanceof THREE.Mesh)||object.name!=='plant-leaf')return;
  const material=object.material as THREE.MeshStandardMaterial;
  material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,{uAfterDay:day,uAfterSun:sun});
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uAfterDay;uniform vec3 uAfterSun;')
    .replace('#include <shadowmap_pars_fragment>','#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
    .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      vec3 worldNormal=inverseTransformDirection(normal,viewMatrix);
      float facing=pow(max(0.,dot(worldNormal,uAfterSun)),2.);
      reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.24,.31,.13)*facing*getShadowMask()*.16*uAfterDay;
    `);
  };material.customProgramCacheKey=()=> 'afterlight-physical-thin-leaf-v2';
 });
 return {rainBlocks:plant.rainBlocks,update(elapsed:number,daylight:number,rain=0,angle=.25){day.value=daylight;sun.value.set(.28,-1,.25).normalize().applyAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.clamp(angle-.25,-.16,.16));plant.update(elapsed,rain);},dispose(){plant.dispose();}};
}
