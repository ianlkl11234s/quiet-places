import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';

export interface TunnelRay { update(elapsed:number):void; dispose():void; }
export type TunnelRayFactory=((group:THREE.Group)=>TunnelRay)&{dispose():void};

const FORWARD=new THREE.Vector3(0,0,1);
const TANGENT=new THREE.Vector3();

function tunnelPose(elapsed:number,carrier:THREE.Group):void {
  const time=Number.isFinite(elapsed)?elapsed:0;
  const phase=time*.14;
  carrier.position.set(-.9+.45*Math.sin(phase),.425+.125*Math.sin(phase-.6),-6.2-1.5*Math.cos(phase));
  // The GLB root faces +Z.  This tangent keeps the animal travelling forward
  // around an ellipse wholly inside the tunnel, independent of frame delta.
  TANGENT.set(.45*Math.cos(phase),.125*Math.cos(phase-.6),1.5*Math.sin(phase)).normalize();
  carrier.quaternion.setFromUnitVectors(FORWARD,TANGENT);
}

/** One low, slow visitor for the dry Seaward tunnel; scene lights shade its native materials. */
export async function prepareTunnelRay():Promise<TunnelRayFactory> {
  const {scene:template,animations}=await new GLTFLoader().loadAsync('/models/stingray.glb');
  const resources=collectModelResources(template);
  const clip=animations.find(candidate=>candidate.name==='SRAY_ACT_SLOW_CRUISE');
  let released=false;
  const release=()=>{
    if(released)return;
    released=true;
    template.removeFromParent();
    disposeModelResources(resources,['textures','materials','geometries','skeletons']);
  };
  if(!clip){release();throw new Error('Southern Stingray asset is missing SRAY_ACT_SLOW_CRUISE.');}

  let used=false;
  const factory=((group:THREE.Group):TunnelRay=>{
    if(released)throw new Error('Tunnel ray factory has been disposed.');
    if(used)throw new Error('Tunnel ray factory can create only one scene instance.');
    used=true;
    const carrier=new THREE.Group();
    carrier.name='tunnel-stingray';
    const model=cloneSkinned(template);
    model.name='tunnel-stingray-model';
    model.scale.setScalar(.9);
    model.traverse(object=>{
      if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}
    });
    carrier.add(model);
    group.add(carrier);
    const skeletons=collectModelResources(model).skeletons;
    const mixer=new THREE.AnimationMixer(model);
    const action=mixer.clipAction(clip);
    action.play();
    let disposed=false;
    const update=(elapsed:number)=>{
      if(disposed)return;
      tunnelPose(elapsed,carrier);
      action.time=((Number.isFinite(elapsed)?elapsed:0)%clip.duration+clip.duration)%clip.duration;
      mixer.update(0);
    };
    update(0);
    return {update,dispose(){
      if(disposed)return;
      disposed=true;
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      group.remove(carrier);
      carrier.clear();
      disposeModelResources({skeletons},['skeletons']);
      release();
    }};
  }) as TunnelRayFactory;
  factory.dispose=()=>{if(!used)release();};
  return factory;
}
