import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';

export interface TunnelRay { update(elapsed:number):void; dispose():void; }
export type TunnelRayFactory=((group:THREE.Group)=>TunnelRay)&{dispose():void};

const UP=new THREE.Vector3(0,1,0);
const FORWARD=new THREE.Vector3(0,0,1);
const ROLL=new THREE.Quaternion();
const CYCLE=2*Math.PI/.14;
const ease=(t:number)=>{const x=THREE.MathUtils.clamp(t,0,1);return THREE.MathUtils.clamp(x*x*x*(x*(x*6-15)+10),0,1);};

/** Seconds: rise 10–15, roll 16–24, settle upright 24–27, descend 27–33. */
export function sampleTunnelFlight(elapsed:number){
 const time=Number.isFinite(elapsed)?elapsed:0;
 const cycle=((time%CYCLE)+CYCLE)%CYCLE;
 const lift=ease((cycle-10)/5)*(1-ease((cycle-27)/6));
 return {height:.545+.555*lift,roll:Math.PI*2*ease((cycle-16)/8)};
}

function tunnelPose(elapsed:number,carrier:THREE.Group):void {
 const time=Number.isFinite(elapsed)?elapsed:0,phase=time*.14;
 const flight=sampleTunnelFlight(time);
 carrier.position.set(-.9+.45*Math.sin(phase),flight.height,-6.2-1.5*Math.cos(phase));
 // Separate heading from roll. Shortest-arc +Z alignment can introduce an
 // unintended bank near reverse headings; the authored roll has its own phase.
 const yaw=Math.atan2(.45*Math.cos(phase),1.5*Math.sin(phase));
 carrier.quaternion.setFromAxisAngle(UP,yaw).multiply(ROLL.setFromAxisAngle(FORWARD,flight.roll));
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
      // Height follows the flight phrase, never the instantaneous soft fin tip.
      // Full-asset clearance is checked across the entire phrase in tests.
      group.updateWorldMatrix(true,false);carrier.updateMatrixWorld(true);
      skeletons.forEach(skeleton=>skeleton.update());
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
