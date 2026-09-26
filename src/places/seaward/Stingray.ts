import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';

export interface TunnelRay { update(elapsed:number,daylight?:number):void; dispose():void; }
export type TunnelRayFactory=((group:THREE.Group)=>TunnelRay)&{dispose():void};

const CYCLE=2*Math.PI/.14;
const ease=(t:number)=>{const x=THREE.MathUtils.clamp(t,0,1);return THREE.MathUtils.clamp(x*x*x*(x*(x*6-15)+10),0,1);};

// Q2-A7 candidates (awaiting user confirmation). Each switch set to 0 restores
// the accepted 2026-09-09 behaviour for that item only. Art direction, not a
// measured stingray kinematics model.
/** 1: bank into turns from yaw rate (≤25°); independent of the barrel roll below. */
export const A7_TURN_BANK=1;
/** 1 keeps the user-specified 16–24 s barrel roll (2026-09-09); 0 is the Q2-A7 candidate that drops it. Pending user choice. */
export const A7_KEEP_ROLL=1;
/** 1: the nose follows climb/descent, capped at 20°. */
export const A7_CLIMB_PITCH=1;
/** 1: the route centre moves .5 m left so the body stays off the camera's view axis. */
export const A7_CAMERA_CLEAR=1;
/** 1: runtime countershading — pale ventral albedo and a weak floor-bounce fill on down-facing skin. */
export const A7_BELLY=1;
export const TUNNEL_MAX_BANK=THREE.MathUtils.degToRad(25);
export const TUNNEL_MAX_PITCH=THREE.MathUtils.degToRad(20);
const BANK_PER_YAW_RATE=.9; // seconds: .467 rad/s at the ellipse ends → ~24°
const PITCH_FOLLOW=.4;      // share of the flight-path angle carried by the body
const ROUTE_CLEAR_SHIFT=.5; // metres toward -x

/** Seconds: rise 10–15, roll 16–24 (A7_KEEP_ROLL), level 24–27, descend 27–33. */
export function sampleTunnelFlight(elapsed:number,keepRoll=A7_KEEP_ROLL){
 const time=Number.isFinite(elapsed)?elapsed:0;
 const cycle=((time%CYCLE)+CYCLE)%CYCLE;
 const lift=ease((cycle-10)/5)*(1-ease((cycle-27)/6));
 return {height:.545+.555*lift,roll:keepRoll?Math.PI*2*ease((cycle-16)/8):0};
}

function tunnelRoute(time:number,target=new THREE.Vector3()){
 const phase=time*.14;
 return target.set(-.9-ROUTE_CLEAR_SHIFT*A7_CAMERA_CLEAR+.45*Math.sin(phase),sampleTunnelFlight(time).height,-6.2-1.5*Math.cos(phase));
}

/** Heading (rad about +Y), yaw rate (rad/s), turn bank and nose-up pitch (rad) at elapsed. */
export function tunnelAttitude(elapsed:number){
 const time=Number.isFinite(elapsed)?elapsed:0,phase=time*.14;
 const a=.45*Math.cos(phase),b=1.5*Math.sin(phase);
 const yaw=Math.atan2(a,b);
 // d/dt atan2(.45cos, 1.5sin) for the ellipse; always one turning sense.
 const yawRate=-.14*.675/(a*a+b*b);
 const bank=A7_TURN_BANK*THREE.MathUtils.clamp(-yawRate*BANK_PER_YAW_RATE,-TUNNEL_MAX_BANK,TUNNEL_MAX_BANK);
 const climb=(sampleTunnelFlight(time+.05).height-sampleTunnelFlight(time-.05).height)/.1;
 const pitch=A7_CLIMB_PITCH*THREE.MathUtils.clamp(PITCH_FOLLOW*Math.atan2(climb,.14*Math.hypot(a,b)),-TUNNEL_MAX_PITCH,TUNNEL_MAX_PITCH);
 return {yaw,yawRate,bank,pitch,roll:sampleTunnelFlight(time).roll};
}

// Q0-5: the route has no closed-form arc length (ellipse plus lift), so one
// CYCLE is tabulated once. Travel stays a pure function of elapsed: pause and
// replay remain exact, and it is unwrapped so fin phase never pops per lap.
const ARC_SAMPLES=2048;
const ARC=(()=>{
 const table=new Float64Array(ARC_SAMPLES+1),a=new THREE.Vector3(),b=new THREE.Vector3();
 tunnelRoute(0,a);
 for(let i=1;i<=ARC_SAMPLES;i++){tunnelRoute(CYCLE*i/ARC_SAMPLES,b);table[i]=table[i-1]+b.distanceTo(a);a.copy(b);}
 return table;
})();
const LAP_LENGTH=ARC[ARC_SAMPLES];
/** Metres swum along the route since elapsed=0 (negative before it). */
export function tunnelTravel(elapsed:number){
 const time=Number.isFinite(elapsed)?elapsed:0;
 const laps=Math.floor(time/CYCLE),f=(time-laps*CYCLE)/CYCLE*ARC_SAMPLES;
 const i=Math.min(Math.floor(f),ARC_SAMPLES-1),x=f-i;
 return laps*LAP_LENGTH+ARC[i]+(ARC[i+1]-ARC[i])*x;
}
/**
 * Seconds into the slow-cruise clip. Travel is divided by the route's mean
 * speed, so the lap-average cadence matches the former elapsed clock while
 * fast stretches beat faster and slow ends slower. Art calibration, not a
 * measured stingray stride length.
 */
export function tunnelFinClock(elapsed:number){return tunnelTravel(elapsed)/(LAP_LENGTH/CYCLE);}

const ATTITUDE=new THREE.Euler(0,0,0,'YXZ');
function tunnelPose(elapsed:number,carrier:THREE.Group):void {
 const time=Number.isFinite(elapsed)?elapsed:0;
 tunnelRoute(time,carrier.position);
 // Yaw, pitch and roll stay separate (YXZ): shortest-arc +Z alignment can
 // introduce an unintended bank near reverse headings.
 const attitude=tunnelAttitude(time);
 carrier.quaternion.setFromEuler(ATTITUDE.set(-attitude.pitch,attitude.yaw,attitude.roll+attitude.bank,'YXZ'));
}

/** Q2-A7: pale belly by world normal. uBelly 0 leaves the GLB material unchanged. */
function countershade(material:THREE.Material,belly:{value:number},bounce:{value:number}){
 if(!(material instanceof THREE.MeshStandardMaterial))return;
 material.onBeforeCompile=shader=>{
  shader.uniforms.uBelly=belly;shader.uniforms.uBounce=bounce;
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uBelly,uBounce;')
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    float ventral=uBelly*smoothstep(.10,-.55,inverseTransformDirection(normal,viewMatrix).y);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.66,.62,.54),ventral*.7);`)
   .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
    // Weak bounce from the lit tunnel floor onto down-facing skin; scales with albedo, not emissive.
    reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.20,.19,.17)*ventral*uBounce;`);
 };
 material.customProgramCacheKey=()=> 'seaward-ray-countershade-v1';
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
    const belly={value:A7_BELLY},bounce={value:1};
    model.traverse(object=>{
      if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}
    });
    // Materials are shared with this place's own template load only.
    resources.materials.forEach(material=>countershade(material,belly,bounce));
    carrier.add(model);
    group.add(carrier);
    const skeletons=collectModelResources(model).skeletons;
    const mixer=new THREE.AnimationMixer(model);
    const action=mixer.clipAction(clip);
    action.play();
    let disposed=false;
    const update=(elapsed:number,daylight=1)=>{
      if(disposed)return;
      bounce.value=THREE.MathUtils.clamp(daylight,0,1);
      tunnelPose(elapsed,carrier);
      action.time=(tunnelFinClock(elapsed)%clip.duration+clip.duration)%clip.duration;
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
