import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {sampleStingrayMotion} from './StingrayMotion.ts';
import {oceanWaveGLSL} from './OceanOptics.ts';
import {oceanAirTransmissionGLSL} from './OceanLightMaterial.ts';

export interface StingrayLighting {
  sun:{value:THREE.Vector3};time:{value:number};level:{value:number};
  strength:{value:number};tint:{value:THREE.Color};volume:THREE.Data3DTexture;floor:THREE.Texture;
}
export interface StingraySchool {update(elapsed:number):void;dispose():void}
export type StingrayFactory=((group:THREE.Group,lighting:StingrayLighting)=>StingraySchool)&{dispose():void};

function lightSkin(material:THREE.MeshStandardMaterial,lighting:StingrayLighting){
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{uSun:lighting.sun,uTime:lighting.time,uLevel:lighting.level,uStrength:lighting.strength,uTint:lighting.tint,uRayVolume:{value:lighting.volume},uRayFloor:{value:lighting.floor}});
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRayWorld;')
      .replace('#include <project_vertex>','#include <project_vertex>\nvRayWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vRayWorld;uniform vec3 uSun,uTint;uniform float uTime,uLevel,uStrength;
      uniform sampler3D uRayVolume;uniform sampler2D uRayFloor;
      ${oceanWaveGLSL}
      ${oceanAirTransmissionGLSL}
    `).replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      vec3 rayNormal=inverseTransformDirection(normal,viewMatrix);
      float rayDirect=oceanAirTransmission(vRayWorld)*max(dot(rayNormal,-uSun),0.);
      vec3 volumeUV=(vRayWorld-vec3(-5.91,.095,-4.89))/vec3(11.82,6.815,18.89);
      float refracted=texture(uRayVolume,clamp(volumeUV,0.,1.)).r;
      // Match BlenderKoi: opening-facing sky and light-dependent floor bounce.
      // The room's unoccluded area lamp cannot represent pane/water visibility
      // on this moving animal; replace that lamp response with transported light.
      reflectedLight.directDiffuse=vec3(0.);
      reflectedLight.directSpecular=vec3(0.);
      reflectedLight.indirectDiffuse=vec3(0.);
      float waterFill=min(refracted,.6)*max(rayNormal.y,0.);
      reflectedLight.directDiffuse+=material.diffuseColor/3.14159265*uTint*uStrength*(rayDirect+waterFill);
      vec3 towardWindow=vec3(0.,1.75,-4.89)-vRayWorld;
      float windowSolidAngle=min(.8,18.5/max(dot(towardWindow,towardWindow),1.));
      float facingWindow=max(dot(rayNormal,normalize(towardWindow)),0.);
      vec3 skyBounce=vec3(.42,.56,.72)*windowSolidAngle*facingWindow*1.5;
      vec3 floorPoint=vec3(vRayWorld.x+.35,.096,vRayWorld.z);
      vec2 floorUV=vec2((floorPoint.x+5.91)/11.82,(floorPoint.z+4.89)/18.89);
      vec3 floorPhotons=texture2D(uRayFloor,clamp(floorUV,0.,1.)).rgb;
      float floorSun=oceanAirTransmission(floorPoint)*max(-uSun.y,0.);
      vec3 floorIrradiance=clamp(uTint*(vec3(floorSun)+floorPhotons),0.,1.);
      vec3 floorBounce=vec3(.60,.48,.32)*(vec3(.035)+.36*floorIrradiance)*max(-rayNormal.y,0.);
      float daylight=clamp(uStrength/10.8,.03,1.);
      reflectedLight.indirectDiffuse+=diffuseColor.rgb*(skyBounce+floorBounce+vec3(.012))*daylight;
    `);
  };
  material.customProgramCacheKey=()=> 'ocean-stingray-koi-bounce-v2';
}

export async function prepareStingrays():Promise<StingrayFactory>{
  const {scene:template,animations}=await new GLTFLoader().loadAsync('/models/stingray.glb');
  const clipNames=['SRAY_ACT_SLOW_CRUISE','SRAY_ACT_TURN_LEFT','SRAY_ACT_TURN_RIGHT'];
  const skeletons=new Set<THREE.Skeleton>(),geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  template.traverse(node=>{
    if(!(node instanceof THREE.Mesh))return;
    geometries.add(node.geometry);if(node instanceof THREE.SkinnedMesh)skeletons.add(node.skeleton);
    for(const material of Array.isArray(node.material)?node.material:[node.material]){
      materials.add(material);
      for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);
    }
  });
  let disposed=false;
  const release=()=>{if(disposed)return;disposed=true;skeletons.forEach(s=>s.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());};
  const clips=clipNames.map(name=>animations.find(clip=>clip.name===name));
  if(clips.some(clip=>!clip)){release();throw new Error('Southern Stingray asset is missing required skeletal animation clips');}
  const locomotionClips=clips as THREE.AnimationClip[];
  const factory:StingrayFactory=Object.assign((group:THREE.Group,lighting:StingrayLighting)=>{
    const school=new THREE.Group();school.name='ocean-stingrays';group.add(school);
    const skinMaterials=new Map<THREE.Material,THREE.Material>();
    const rays=([0,1] as const).map(index=>{
      const carrier=new THREE.Group();carrier.name=`stingray-${index+1}`;
      const model=cloneSkinned(template);model.scale.setScalar(index===0?1:.9);carrier.add(model);school.add(carrier);
      const mixer=new THREE.AnimationMixer(model);
      const clips=locomotionClips;
      const actions=clips.map(clip=>mixer.clipAction(clip).setLoop(THREE.LoopRepeat,Infinity).play());
      model.updateMatrixWorld(true);
      const tails: {bone:THREE.Bone;rest:THREE.Quaternion;up:THREE.Vector3;right:THREE.Vector3}[]=[];
      model.traverse(node=>{
        if(node instanceof THREE.Bone&&/^tail_\d+$/.test(node.name)){
          const up=new THREE.Vector3(0,1,0).applyQuaternion(node.getWorldQuaternion(new THREE.Quaternion()).invert());
          const right=new THREE.Vector3(1,0,0).applyQuaternion(node.getWorldQuaternion(new THREE.Quaternion()).invert());
          tails.push({bone:node,rest:node.quaternion.clone(),up,right});
        }
      });
      tails.sort((a,b)=>a.bone.name.localeCompare(b.bone.name));
      model.traverse(node=>{
        if(!(node instanceof THREE.Mesh))return;

        const patch=(original:THREE.Material)=>{
          let skin=skinMaterials.get(original);
          if(!skin){skin=original.clone();if(skin instanceof THREE.MeshStandardMaterial)lightSkin(skin,lighting);skinMaterials.set(original,skin);}
          return skin;
        };
        node.material=Array.isArray(node.material)?node.material.map(patch):patch(node.material);
      });
      // Broad, low-opacity proximity shadow anchors the floating body. This is an artistic AO cue.
      const shadowMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uOpacity:{value:.1}},
        vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:'varying vec2 vUv;uniform float uOpacity;void main(){float r=length((vUv-.5)*2.);gl_FragColor=vec4(0.,0.,0.,(1.-smoothstep(.15,1.,r))*uOpacity);}' });
      const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2,2),shadowMaterial);shadow.rotation.x=-Math.PI/2;school.add(shadow);
      return {index,carrier,model,mixer,actions,clips,tails,shadow,shadowMaterial};
    });
    let released=false;
    return {
      update(elapsed:number){
        for(const ray of rays){
          const pose=sampleStingrayMotion(elapsed,ray.index);
          ray.carrier.position.copy(pose.position);ray.carrier.quaternion.copy(pose.quaternion);
          const turnWeight=Math.min(.7,Math.abs(pose.turn)*.7);
          const finGain=Math.min(1,pose.finAmplitude);
          ray.actions[0].setEffectiveWeight((1-turnWeight)*finGain);
          ray.actions[1].setEffectiveWeight(pose.turn<0?turnWeight*finGain:0);
          ray.actions[2].setEffectiveWeight(pose.turn>0?turnWeight*finGain:0);
          ray.actions.forEach((action,i)=>{
            const duration=ray.clips[i].duration;
            // Every exported locomotion clip has one complete cycle. Absolute time preserves pause/replay.
            action.time=((pose.finPhase/(Math.PI*2)*duration)%duration+duration)%duration;
          });
          ray.mixer.update(0);
          const orientation=(t:number)=>{
            const f=new THREE.Vector3(0,0,1).applyQuaternion(sampleStingrayMotion(t,ray.index).quaternion);
            return {yaw:Math.atan2(f.x,f.z),elevation:Math.asin(THREE.MathUtils.clamp(f.y,-1,1))};
          };
          const delta=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
          const current=orientation(elapsed);
          let previous=0,previousPitch=0;
          ray.tails.forEach((tail,i)=>{
            // Tail root remains fixed. Distal joints follow a smoothed history of body heading.
            const delay=i*.07;
            const history=[0,.05,.1].map(offset=>orientation(elapsed-delay-offset));
            const lag=i===0?0:history.reduce((sum,o)=>sum+delta(o.yaw,current.yaw),0)/3*.82;
            const pitchLag=i===0?0:history.reduce((sum,o)=>sum+o.elevation-current.elevation,0)/3*.65;
            const pitchBend=THREE.MathUtils.clamp(pitchLag-previousPitch,-.06,.06);previousPitch=pitchLag;
            const bend=THREE.MathUtils.clamp(lag-previous,-.10,.10);previous=lag;
            tail.bone.quaternion.copy(tail.rest).multiply(new THREE.Quaternion().setFromAxisAngle(tail.up,bend)).multiply(new THREE.Quaternion().setFromAxisAngle(tail.right,-pitchBend));
          });
          ray.shadow.position.set(pose.position.x,.098,pose.position.z);
          const forward=new THREE.Vector3(0,0,1).applyQuaternion(pose.quaternion);
          ray.shadow.rotation.z=Math.atan2(forward.x,forward.z);
          const size=1+pose.position.y*.35;ray.shadow.scale.set(size,size*.75,1);
          ray.shadowMaterial.uniforms.uOpacity.value=.16/(1+pose.position.y*1.8);
        }
      },
      dispose(){if(released)return;released=true;school.removeFromParent();rays.forEach(ray=>{ray.mixer.stopAllAction();ray.mixer.uncacheRoot(ray.model);const skeletons=new Set<THREE.Skeleton>();ray.model.traverse(node=>{if(node instanceof THREE.SkinnedMesh)skeletons.add(node.skeleton);});skeletons.forEach(skeleton=>skeleton.dispose());ray.shadow.geometry.dispose();ray.shadowMaterial.dispose();});skinMaterials.forEach(m=>m.dispose());release();},
    };
  },{dispose:release});
  return factory;
}
