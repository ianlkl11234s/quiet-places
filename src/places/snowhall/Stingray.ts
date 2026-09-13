import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';

export function sampleHallRay(elapsed:number){
 const time=Number.isFinite(elapsed)?elapsed:0,phase=time*Math.PI/44;
 return {
  position:new THREE.Vector3(-.72+.42*Math.sin(phase),.38+.035*Math.sin(phase*2+1.2),-1.15-.72*Math.cos(phase)),
  heading:Math.atan2(.42*Math.cos(phase),.72*Math.sin(phase)),
 };
}

export async function prepareHallRay(){
 const {scene:template,animations}=await new GLTFLoader().loadAsync('/models/stingray.glb');
 const resources=collectModelResources(template),clip=animations.find(candidate=>candidate.name==='SRAY_ACT_SLOW_CRUISE');
 let released=false,used=false;
 const release=()=>{if(released)return;released=true;disposeModelResources(resources,['textures','materials','geometries','skeletons']);template.removeFromParent();};
 if(!clip){release();throw new Error('Snow hallway stingray is missing SRAY_ACT_SLOW_CRUISE.');}
 const factory=(root:THREE.Group)=>{
  if(released||used)throw new Error('Snow hallway stingray factory is no longer available.');used=true;
  const carrier=new THREE.Group();carrier.name='snowhall-stingray';
  const model=cloneSkinned(template);model.name='snowhall-stingray-model';model.scale.setScalar(.43);
  model.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});
  carrier.add(model);root.add(carrier);
  const skeletons=collectModelResources(model).skeletons,mixer=new THREE.AnimationMixer(model),action=mixer.clipAction(clip);action.play();
  let disposed=false;
  return {carrier,update(elapsed:number){
   if(disposed)return;const pose=sampleHallRay(elapsed);carrier.position.copy(pose.position);carrier.rotation.set(0,pose.heading,0);
   action.time=(((Number.isFinite(elapsed)?elapsed:0)*.58)%clip.duration+clip.duration)%clip.duration;mixer.update(0);
   root.updateWorldMatrix(true,false);carrier.updateMatrixWorld(true);skeletons.forEach(skeleton=>skeleton.update());
  },dispose(){if(disposed)return;disposed=true;mixer.stopAllAction();mixer.uncacheRoot(model);carrier.removeFromParent();carrier.clear();disposeModelResources({skeletons},['skeletons']);release();}};
 };
 return Object.assign(factory,{dispose(){if(!used)release();}});
}
