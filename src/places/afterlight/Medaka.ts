import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';
import {prepareMedakaMotion, type MedakaMotionSample} from './MedakaMotion.ts';

const FISH_COUNT = 22;
const TAIL_BONES = ['Spine_01','Spine_02','Spine_03','Spine_04','Spine_05','Peduncle','Tail_Base','Tail_Tip'];
const REQUIRED_BONES = ['MedakaRoot',...TAIL_BONES,'Pectoral_L','Pectoral_R'];
const TAU = Math.PI * 2;

export type Medaka = {
  root: THREE.Group;
  /** Absolute elapsed time makes paused frames and seeks reproduce exactly. */
  update: (elapsed: number, daylight: number) => void;
  dispose: () => void;
};

export type MedakaFactory = ((parent: THREE.Object3D) => Medaka) & {dispose: () => void};

type BonePose = {bone: THREE.Bone; base: THREE.Quaternion; progress: number};
type Fish = {carrier: THREE.Group; model: THREE.Object3D; bones: BonePose[]; pectorals: Array<{bone: THREE.Bone;base: THREE.Quaternion;sign: number}>; materials: THREE.Material[]; skeletons: Set<THREE.Skeleton>; length: number};

function releaseTemplate(root: THREE.Object3D): void {
  root.removeFromParent();
  disposeModelResources(collectModelResources(root), ['textures','materials','geometries','skeletons']);
}

function variantColor(variant: number): THREE.Color {
  // 70 / 15 / 10 / 5: quiet silver olive, cream, dark grey, muted warm pale gold.
  return [new THREE.Color(.72,.76,.64),new THREE.Color(.84,.81,.68),new THREE.Color(.42,.46,.41),new THREE.Color(.76,.68,.48)][variant] ?? new THREE.Color(.72,.76,.64);
}

function cloneMaterials(model: THREE.Object3D, variant: number): THREE.Material[] {
  const owned: THREE.Material[]=[];
  model.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const source=Array.isArray(object.material)?object.material:[object.material];
    const materials=source.map(material=>{
      const clone=material.clone();owned.push(clone);
      if(clone instanceof THREE.MeshStandardMaterial || clone instanceof THREE.MeshPhysicalMaterial){
        clone.color.multiply(variantColor(variant));
        clone.emissive.setRGB(0,0,0);clone.emissiveIntensity=0;
        // Local skylight bounce for this small moving receiver. Room surfaces
        // already have baked indirect light; fish cannot reuse their UV lightmap.
        const bounce={value:0};clone.userData.medakaBounce=bounce;
        clone.onBeforeCompile=shader=>{
          shader.uniforms.medakaBounce=bounce;
          shader.fragmentShader='uniform float medakaBounce;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',`#include <lights_fragment_maps>
            vec3 bounceNormal = inverseTransformDirection(geometryNormal, viewMatrix);
            float bounceFacing = .35 + .65 * max(0., dot(bounceNormal, normalize(vec3(.25, .8, .35))));
            irradiance += vec3(.78, .85, .80) * medakaBounce * bounceFacing;
          `);
        };
        clone.customProgramCacheKey=()=> 'medaka-local-skylight-bounce-v1';
      }
      return clone;
    });
    object.material=Array.isArray(object.material)?materials:materials[0];
    object.castShadow=true;object.receiveShadow=true;
  });
  return owned;
}

function tailTangent(sample: MedakaMotionSample, progress: number): number {
  const s=Math.max(0,Math.min(1,progress));
  const accelerationGain=1+.2*THREE.MathUtils.clamp(sample.acceleration,0,1);
  const amplitude=.035*(.65+.55*sample.q)*accelerationGain;
  const theta=sample.phase-TAU*.9*s;
  return Math.atan(amplitude*(2.2*Math.pow(s,1.2)*Math.sin(theta)-TAU*.9*Math.pow(s,2.2)*Math.cos(theta)));
}

/** Reads the skeleton bind pose rather than a GLTF node's current animated pose. */
function bindQuaternion(root: THREE.Object3D, bone: THREE.Bone): THREE.Quaternion {
  let skeleton: THREE.Skeleton|undefined;
  root.traverse(object=>{if(!skeleton&&object instanceof THREE.SkinnedMesh&&object.skeleton.bones.includes(bone))skeleton=object.skeleton;});
  if(!skeleton)return bone.quaternion.clone();
  const index=skeleton.bones.indexOf(bone),world=skeleton.boneInverses[index].clone().invert();
  const parent=bone.parent instanceof THREE.Bone?skeleton.bones.indexOf(bone.parent):-1;
  if(parent>=0)world.premultiply(skeleton.boneInverses[parent].clone());
  const quaternion=new THREE.Quaternion();world.decompose(new THREE.Vector3(),quaternion,new THREE.Vector3());return quaternion;
}

/** Loads one real, small medaka master and its deterministic 120-second shoal route. */
export async function prepareMedaka(): Promise<MedakaFactory> {
  const gltf=await new GLTFLoader().loadAsync('/models/medaka.glb');
  let motion;
  try{motion=await prepareMedakaMotion();}catch(error){releaseTemplate(gltf.scene);throw error;}
  const template=gltf.scene;
  if(motion.metadata.fishCount!==FISH_COUNT){releaseTemplate(template);throw new Error('青鱂動態快取不是 22 尾。');}
  let master: THREE.SkinnedMesh|undefined;
  template.traverse(object=>{if(!master&&object instanceof THREE.SkinnedMesh&&object.name.startsWith('Medaka_Master'))master=object;});
  if(!template.getObjectByName('Medaka_Rig') || !master){releaseTemplate(template);throw new Error('青鱂模型缺少骨架主體。');}
  for(const name of REQUIRED_BONES)if(!(template.getObjectByName(name) as THREE.Bone)?.isBone){releaseTemplate(template);throw new Error(`青鱂骨架缺少 ${name}。`);}
  template.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(template),sourceLength=bounds.max.z-bounds.min.z;
  if(!Number.isFinite(sourceLength)||sourceLength<.03||sourceLength>.045){releaseTemplate(template);throw new Error('青鱂主模型身長不在 3–4.5 cm 範圍。');}
  const center=bounds.getCenter(new THREE.Vector3());
  let consumed=false;
  const factory=(parent: THREE.Object3D): Medaka=>{
    if(consumed)throw new Error('青鱂工廠只能建立一個場景實例。');consumed=true;
    const root=new THREE.Group();root.name='AfterlightMedaka';parent.add(root);
    const fish:Fish[]=[];
    for(let index=0;index<FISH_COUNT;index++){
      const sample=motion.sample(0,index),model=cloneSkinned(template),carrier=new THREE.Group();
      const scale=sample.length/sourceLength;
      if(sample.length<.036-1e-6||sample.length>.054+1e-6)throw new Error('青鱂個體身長不在放大後 3.6–5.4 cm 範圍。');
      model.scale.setScalar(scale);model.position.copy(center).multiplyScalar(-scale);
      const bones=TAIL_BONES.map((name,i)=>{const bone=model.getObjectByName(name) as THREE.Bone;return {bone,base:bindQuaternion(model,bone),progress:i/(TAIL_BONES.length-1)};});
      const pectorals=['Pectoral_L','Pectoral_R'].map((name,i)=>{const bone=model.getObjectByName(name) as THREE.Bone;return {bone,base:bindQuaternion(model,bone),sign:i?-1:1};});
      const skeletons=collectModelResources(model).skeletons;
      carrier.name=`medaka-${index+1}`;carrier.add(model);root.add(carrier);
      fish.push({carrier,model,bones,pectorals,materials:cloneMaterials(model,sample.colorVariant),skeletons,length:sample.length});
    }
    let disposed=false;
    return {root,
      update(elapsed,daylight){
        if(disposed)return;
        const time=Number.isFinite(elapsed)?elapsed:0;
        const visibility=THREE.MathUtils.clamp(daylight,.02,1);
        fish.forEach((entry,index)=>{
          const sample=motion.sample(time,index);entry.carrier.position.copy(sample.position);entry.carrier.quaternion.copy(sample.quaternion);
          let previous=0;
          for(const control of entry.bones){const tangent=tailTangent(sample,control.progress);control.bone.quaternion.copy(control.base).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),tangent-previous));previous=tangent;}
          // The motion cache owns individual phase. Faster fish fold their
          // pectorals continuously instead of switching amplitude by state.
          const pectoralAngle=.20*(1-.55*sample.q)*Math.sin(sample.phase);
          for(const finControl of entry.pectorals)finControl.bone.quaternion.copy(finControl.base).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),pectoralAngle*finControl.sign));
          // No emissive rescue: the local skylight probe reveals silver sides without emission.
          for(const material of entry.materials)if(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial){
            material.envMapIntensity=.45*visibility;
            const proximity=1-THREE.MathUtils.smoothstep(sample.position.distanceTo(new THREE.Vector3(1.15,.8,-.35)),.30,1.05);
            material.userData.medakaBounce.value=.65*visibility*proximity;
          }
        });
      },
      dispose(){
        if(disposed)return;disposed=true;parent.remove(root);
        const skeletons=new Set<THREE.Skeleton>();
        fish.forEach(entry=>{entry.materials.forEach(material=>material.dispose());entry.skeletons.forEach(skeleton=>skeletons.add(skeleton));entry.carrier.remove(entry.model);});
        disposeModelResources({skeletons},['skeletons']);root.clear();releaseTemplate(template);
      },
    };
  };
  return Object.assign(factory,{dispose(){if(!consumed){consumed=true;releaseTemplate(template);}}});
}
