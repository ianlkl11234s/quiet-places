import * as THREE from 'three';
import {sampleSharkMotion} from './SharkMotion.ts';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';

/** A single owned, Blender-skinned juvenile; no mixer clock or independent RAF. */
export function createShark(model:THREE.Group,rearWindow:boolean){
  const root=new THREE.Group();root.name='BlacktipReefShark';
  model.updateMatrixWorld(true);
  const names=[...Array.from({length:16},(_,index)=>`Spine_${String(index).padStart(2,'0')}`),'Pectoral_L','Pectoral_R'];
  const controls=names.map(name=>{
    const bone=model.getObjectByName(name);
    if(!(bone instanceof THREE.Bone))throw new Error(`黑鰭礁鯊缺少 ${name} 骨架`);
    const parentRotation=bone.parent!.getWorldQuaternion(new THREE.Quaternion());
    const inverseParent=parentRotation.clone().invert();
    const position=bone.getWorldPosition(new THREE.Vector3());
    return {bone,s:THREE.MathUtils.clamp((.45-position.x)/.9,0,1),restPosition:bone.position.clone(),restQuaternion:bone.quaternion.clone(),parentRotation,inverseParent,lateral:new THREE.Vector3(0,0,1).applyQuaternion(inverseParent)};
  });
  const sky={value:.12},windowCenter={value:rearWindow?new THREE.Vector3(-.269,3.0,4.10):new THREE.Vector3(-1.679,3.4,2.5)},windowArea={value:rearWindow?5.0:7.84};
  // Match the stairwell's slope-aware packed depth on the skinned animal.
  // Back-face depth alone leaves contour-like self-shadow bands on the snout.
  const shadowDepth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
  shadowDepth.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('packDepthToRGBA( fragCoordZ )',
      'packDepthToRGBA( min(1., fragCoordZ + 1.5*max(abs(dFdx(fragCoordZ)),abs(dFdy(fragCoordZ)))) )');
  };
  shadowDepth.customProgramCacheKey=()=> 'blacktip-slope-depth-v1';
  model.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    object.castShadow=true;object.receiveShadow=true;object.customDepthMaterial=shadowDepth;
    // A moving skinned animal must not use a stale rest-pose culling sphere.
    if(object instanceof THREE.SkinnedMesh)object.frustumCulled=false;
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      if(!(material instanceof THREE.MeshStandardMaterial))continue;
      material.shadowSide=THREE.DoubleSide;
      material.onBeforeCompile=shader=>{
        shader.uniforms.sharkSky=sky;shader.uniforms.sharkWindow=windowCenter;shader.uniforms.sharkWindowArea=windowArea;
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 sharkWorld;').replace('#include <project_vertex>','#include <project_vertex>\nsharkWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 sharkWorld;\nuniform float sharkSky;\nuniform vec3 sharkWindow;\nuniform float sharkWindowArea;')
          .replace('#include <lights_fragment_maps>',`#include <lights_fragment_maps>
vec3 sharkToWindow=sharkWindow-sharkWorld;
vec3 sharkWorldNormal=inverseTransformDirection(normal,viewMatrix);
float sharkOpening=min(.65,sharkWindowArea/max(dot(sharkToWindow,sharkToWindow),1.));
float sharkFacing=max(dot(sharkWorldNormal,normalize(sharkToWindow)),0.);
irradiance += (vec3(.48,.59,.70)*sharkOpening*sharkFacing + vec3(.014,.012,.01))*sharkSky;`);
      };
      material.customProgramCacheKey=()=> 'blacktip-window-diffuse-v1';material.needsUpdate=true;
    }
  });
  root.add(model);
  const delta=new THREE.Quaternion(),converted=new THREE.Quaternion(),forward=new THREE.Vector3(1,0,0),tangent=new THREE.Vector3();
  let disposed=false;
  return {
    root,
    update(elapsed:number,intensity:number){
      if(disposed)return;
      const pose=sampleSharkMotion(elapsed);
      root.position.copy(pose.position);root.quaternion.copy(pose.quaternion);
      for(const control of controls){
        let upper=pose.spine.findIndex(sample=>sample.s>=control.s);if(upper<0)upper=pose.spine.length-1;
        const b=pose.spine[upper],a=pose.spine[Math.max(0,upper-1)];
        const mix=b.s>a.s?(control.s-a.s)/(b.s-a.s):0;
        const lateral=THREE.MathUtils.lerp(a.offset.z,b.offset.z,mix);
        tangent.copy(a.tangent).lerp(b.tangent,mix).normalize();delta.setFromUnitVectors(forward,tangent);
        control.bone.position.copy(control.restPosition).addScaledVector(control.lateral,lateral);
        converted.copy(control.inverseParent).multiply(delta).multiply(control.parentRotation);
        control.bone.quaternion.copy(converted).multiply(control.restQuaternion);
      }
      sky.value=THREE.MathUtils.clamp(intensity/.9,.08,1.2)*.8;
      root.userData={speed:pose.speed,frequency:pose.frequency,pitch:pose.pitch,bank:pose.bank,phase:pose.phase};
      root.updateMatrixWorld(true);
    },
    dispose(){if(disposed)return;disposed=true;shadowDepth.dispose();root.removeFromParent();disposeModelResources(collectModelResources(model));},
  };
}
