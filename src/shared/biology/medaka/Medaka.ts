import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {collectModelResources, disposeModelResources} from '../../resources/ModelResources.ts';
import type {MedakaMotionSample, MedakaRoute} from './MedakaMotion.ts';

const TAIL_BONES=['Spine_01','Spine_02','Spine_03','Spine_04','Spine_05','Peduncle','Tail_Base','Tail_Tip'];
const REQUIRED_BONES=['MedakaRoot',...TAIL_BONES,'Pectoral_L','Pectoral_R'];
const TAU=Math.PI*2;

export interface PrepareMedakaOptions { modelUrl?:string; }
export interface MedakaAgentOptions { route:MedakaRoute; phaseOffsetSeconds?:number; length?:number; colorVariant?:number; name?:string; }
export interface SharedMedaka { root:THREE.Group; update(elapsed:number):void; dispose():void; }
export interface MedakaFactory { create(parent:THREE.Object3D, options:MedakaAgentOptions):SharedMedaka; dispose():void; }

type BonePose={bone:THREE.Bone;base:THREE.Quaternion;progress:number};
type PectoralPose={bone:THREE.Bone;base:THREE.Quaternion;sign:number};

function releaseTemplate(root:THREE.Object3D):void {
  root.removeFromParent();
  disposeModelResources(collectModelResources(root),['textures','materials','geometries','skeletons']);
}

function variantColor(variant:number):THREE.Color {
  return [new THREE.Color(.72,.76,.64),new THREE.Color(.84,.81,.68),new THREE.Color(.42,.46,.41),new THREE.Color(.76,.68,.48)][variant]??new THREE.Color(.72,.76,.64);
}

function bindQuaternion(root:THREE.Object3D,bone:THREE.Bone):THREE.Quaternion {
  let skeleton:THREE.Skeleton|undefined;
  root.traverse(object=>{if(!skeleton&&object instanceof THREE.SkinnedMesh&&object.skeleton.bones.includes(bone))skeleton=object.skeleton;});
  if(!skeleton)return bone.quaternion.clone();
  const index=skeleton.bones.indexOf(bone);
  const world=skeleton.boneInverses[index].clone().invert();
  const parent=bone.parent instanceof THREE.Bone?skeleton.bones.indexOf(bone.parent):-1;
  if(parent>=0)world.premultiply(skeleton.boneInverses[parent].clone());
  const quaternion=new THREE.Quaternion();
  world.decompose(new THREE.Vector3(),quaternion,new THREE.Vector3());
  return quaternion;
}

function tailTangent(sample:MedakaMotionSample,progress:number):number {
  const s=THREE.MathUtils.clamp(progress,0,1);
  const amplitude=.035*(.65+.55*sample.q)*(1+.2*THREE.MathUtils.clamp(sample.acceleration,0,1));
  const theta=sample.phase-TAU*.9*s;
  return Math.atan(amplitude*(2.2*s**1.2*Math.sin(theta)-TAU*.9*s**2.2*Math.cos(theta)));
}

function cloneMaterials(model:THREE.Object3D,variant:number):THREE.Material[] {
  const owned:THREE.Material[]=[];
  model.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const source=Array.isArray(object.material)?object.material:[object.material];
    const materials=source.map(base=>{
      const material=base.clone();
      owned.push(material);
      if(material instanceof THREE.MeshStandardMaterial||material instanceof THREE.MeshPhysicalMaterial){
        material.color.multiply(variantColor(variant));
        material.emissive.setRGB(0,0,0);
        material.emissiveIntensity=0;
      }
      return material;
    });
    object.material=Array.isArray(object.material)?materials:materials[0];
    object.castShadow=true;
    object.receiveShadow=true;
  });
  return owned;
}

function applyPose(carrier:THREE.Group,bones:BonePose[],pectorals:PectoralPose[],sample:MedakaMotionSample):void {
  carrier.position.copy(sample.position);
  carrier.quaternion.copy(sample.quaternion);
  let previous=0;
  for(const control of bones){
    const current=tailTangent(sample,control.progress);
    control.bone.quaternion.copy(control.base).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),current-previous));
    previous=current;
  }
  const fin=.20*(1-.55*sample.q)*Math.sin(sample.phase);
  for(const control of pectorals)control.bone.quaternion.copy(control.base).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),fin*control.sign));
}

/** Loads one immutable GLB; each instance owns its cloned materials and skeletons. */
export async function prepareMedaka(options:PrepareMedakaOptions={}):Promise<MedakaFactory> {
  const gltf=await new GLTFLoader().loadAsync(options.modelUrl??'/models/medaka.glb');
  const template=gltf.scene;
  let master:THREE.SkinnedMesh|undefined;
  template.traverse(object=>{if(!master&&object instanceof THREE.SkinnedMesh&&object.name.startsWith('Medaka_Master'))master=object;});
  if(!template.getObjectByName('Medaka_Rig')||!master){releaseTemplate(template);throw new Error('青鱂模型缺少骨架主體。');}
  for(const name of REQUIRED_BONES)if(!(template.getObjectByName(name) as THREE.Bone)?.isBone){releaseTemplate(template);throw new Error(`青鱂骨架缺少 ${name}。`);}
  template.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(template);
  const sourceLength=bounds.max.z-bounds.min.z;
  const center=bounds.getCenter(new THREE.Vector3());
  if(!Number.isFinite(sourceLength)||sourceLength<.03||sourceLength>.045){releaseTemplate(template);throw new Error('青鱂主模型身長不在 3–4.5 cm 範圍。');}

  let disposed=false;
  return {
    create(parent,agent){
      if(disposed)throw new Error('青鱂工廠已釋放。');
      const offset=agent.phaseOffsetSeconds??0;
      const initial=agent.route.sample(offset);
      const length=agent.length??initial.length;
      // Reject before SkeletonUtils or material cloning allocates an instance.
      if(!Number.isFinite(length)||length<=0)throw new RangeError('Medaka length must be a positive number in metres.');
      const model=cloneSkinned(template);
      const root=new THREE.Group();
      const carrier=new THREE.Group();
      model.scale.setScalar(length/sourceLength);
      model.position.copy(center).multiplyScalar(-length/sourceLength);
      const materials=cloneMaterials(model,agent.colorVariant??initial.colorVariant);
      const bones=TAIL_BONES.map((name,index)=>{
        const bone=model.getObjectByName(name) as THREE.Bone;
        return {bone,base:bindQuaternion(model,bone),progress:index/(TAIL_BONES.length-1)};
      });
      const pectorals=['Pectoral_L','Pectoral_R'].map((name,index)=>{
        const bone=model.getObjectByName(name) as THREE.Bone;
        return {bone,base:bindQuaternion(model,bone),sign:index?-1:1};
      });
      const skeletons=collectModelResources(model).skeletons;
      carrier.name=agent.name??'medaka';
      carrier.add(model);
      root.add(carrier);
      parent.add(root);
      let released=false;
      const update=(elapsed:number)=>{
        if(released)return;
        const time=(Number.isFinite(elapsed)?elapsed:0)+offset;
        applyPose(carrier,bones,pectorals,agent.route.sample(time));
      };
      update(0);
      return {root,update,dispose(){
        if(released)return;
        released=true;
        parent.remove(root);
        materials.forEach(material=>material.dispose());
        disposeModelResources({skeletons},['skeletons']);
        root.clear();
      }};
    },
    dispose(){
      if(disposed)return;
      disposed=true;
      releaseTemplate(template);
    },
  };
}
