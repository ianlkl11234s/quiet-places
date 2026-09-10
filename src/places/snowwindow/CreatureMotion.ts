import {MathUtils,Quaternion,Vector3} from 'three';
import {sampleAureliaKinematics} from '../../shared/biology/aurelia/index.ts';
import {sampleClioneWingForces,type ClioneGait} from '../../shared/biology/clione/index.ts';
import {virtualCurrent,VIRTUAL_SEAWATER,reynolds} from '../../shared/biology/VirtualFluid.ts';

const STEP=1/120,TAU=2*Math.PI,up=new Vector3(0,1,0),axisZ=new Vector3(0,0,1);
export const SNOW_CREATURE_SEED=2718;
export const JELLY_PRESETS=[
 {name:'JELLY_A',diameter:.30,frequency:.38,phase:.13,seed:2718,position:[1.02,2.12,-3.45]},
 {name:'JELLY_B',diameter:.25,frequency:.44,phase:.61,seed:2819,position:[1.48,2.85,-3.77]},
 {name:'JELLY_C',diameter:.20,frequency:.34,phase:.37,seed:2920,position:[.54,3.56,-3.94]},
] as const;
export const CLIONE_PRESETS=[
 {name:'CLIONE_1',length:.038,frequency:1.14,phase:.2,seed:3101,position:[1.68,2.25,-2.25]},
 {name:'CLIONE_2',length:.036,frequency:1.27,phase:2.7,seed:3202,position:[.48,1.58,-3.61]},
 {name:'CLIONE_3',length:.034,frequency:1.39,phase:4.1,seed:3303,position:[1.35,3.55,-3.88]},
 {name:'CLIONE_4',length:.040,frequency:1.51,phase:1.5,seed:3404,position:[1.84,2.03,-3.80]},
 {name:'CLIONE_5',length:.032,frequency:1.63,phase:5.1,seed:3505,position:[.08,2.78,-3.73]},
 {name:'CLIONE_6',length:.035,frequency:1.32,phase:3.3,seed:3606,position:[2.12,3.02,-3.44]},
 {name:'CLIONE_7',length:.037,frequency:1.47,phase:5.8,seed:3707,position:[.78,1.82,-3.97]},
] as const;
export type JellyBehavior='J_DRIFT_IDLE'|'J_PULSE_CRUISE'|'J_ACTIVE_CRUISE'|'J_GLIDE'|'J_SOFT_TURN'|'J_ASCEND'|'J_DESCEND'|'J_PAUSE_OPEN';
export interface CreatureControls {motionGain:number;currentGain:number;quietness:number;freezeRoots:boolean;freezeWings:boolean;}
export const DEFAULT_CREATURE_CONTROLS:CreatureControls={motionGain:1,currentGain:.65,quietness:.8,freezeRoots:false,freezeWings:false};
export interface CreatureState {
 name:string;kind:'aurelia'|'clione';position:Vector3;velocity:Vector3;orientation:Quaternion;angularVelocity:Vector3;
 phase:number;frequency:number;activity:number;turn:number;turnDirection:number;gait:ClioneGait;previousGait:ClioneGait;gaitBlend:number;gaitChangedAt:number;behavior:JellyBehavior;
 pulse:number;pulseRate:number;pulseForce:number;perForce:number;drag:number;distance:number;sinkForce:number;leftForce:number;rightForce:number;current:Vector3;
}
const smooth=(x:number)=>{const t=MathUtils.clamp(x,0,1);return t*t*(3-2*t);};
function createState(p:typeof JELLY_PRESETS[number]|typeof CLIONE_PRESETS[number],kind:CreatureState['kind']):CreatureState{
 return {name:p.name,kind,position:new Vector3(...p.position),velocity:new Vector3(),orientation:new Quaternion().setFromUnitVectors(axisZ,up),angularVelocity:new Vector3(),phase:kind==='aurelia'?p.phase*TAU:p.phase,frequency:p.frequency,activity:1,turn:0,turnDirection:0,gait:'slowhover',previousGait:'slowhover',gaitBlend:1,gaitChangedAt:0,behavior:'J_PULSE_CRUISE',pulse:0,pulseRate:0,pulseForce:0,perForce:0,drag:0,distance:0,sinkForce:0,leftForce:0,rightForce:0,current:new Vector3()};
}
/** Force coefficients and buoyancy are calibrated priors, not CFD or measured physiology. */
export function jellyForces(diameter:number,frequency:number,cycle:number,contractionRate:number,activity=1){
 const radius=diameter/2;
 const peak=.5*Math.PI*frequency/.30;
 const pulse=.9*radius**3*Math.max(0,contractionRate)**2;
 // Smooth onset during late refill avoids an artificial impulse at phase .75.
 const gate=smooth((cycle-.44)/.21),age=Math.max(0,cycle-.75)/frequency;
 const per=.9*radius**3*peak**2*gate*Math.exp(-age/(.45/frequency))*activity;
 return {pulse,per,mass:VIRTUAL_SEAWATER.density*Math.PI*radius**2*diameter*.030+ .65*VIRTUAL_SEAWATER.density*Math.PI*radius**2*diameter*.16*.60,dragFactor:.5*VIRTUAL_SEAWATER.density*1.05*Math.PI*radius**2};
}
export function clioneHydrodynamics(length:number){
 const radius=length*.128,area=Math.PI*radius*radius,mass=VIRTUAL_SEAWATER.density*area*length*.55;
 const dragFactor=.5*VIRTUAL_SEAWATER.density*1.1*area;
 return {mass:mass*1.5,dragFactor,sinkForce:dragFactor*.008**2};
}
function softBoundary(position:Vector3,radius:number,out:Vector3){
 const lower=[-.68,1.0,-4.25],upper=[2.8,4.30,-1.92];
 for(let a=0;a<3;a++){
  const x=position.getComponent(a),low=lower[a]+radius,high=upper[a]-radius;
  out.setComponent(a,out.getComponent(a)+.07*smooth((low+.28-x)/.28)**2-.07*smooth((x-high+.28)/.28)**2);
 }
}
export function createCreatureMotion(clioneCount=5,overrides:Partial<CreatureControls>={}){
 if(!Number.isInteger(clioneCount)||clioneCount<4||clioneCount>7)throw new RangeError('Clione count must be 4–7.');
 const controls={...DEFAULT_CREATURE_CONTROLS,...overrides};
 let states=[...JELLY_PRESETS.map(p=>createState(p,'aurelia')),...CLIONE_PRESETS.slice(0,clioneCount).map(p=>createState(p,'clione'))],stepIndex=0;
 const force=new Vector3(),relative=new Vector3(),normal=new Vector3(),desired=new Vector3(),torque=new Vector3(),rotation=new Quaternion();
 const liftGains=CLIONE_PRESETS.slice(0,clioneCount).map(p=>{
  let mean=0;for(let i=0;i<120;i++)mean+=sampleClioneWingForces(i/120/p.frequency,p,{gait:'slowhover',frequency:p.frequency,phase:i/120*TAU}).total.z;
  return clioneHydrodynamics(p.length).sinkForce/Math.max(1e-12,mean/120);
 });
 const advance=()=>{
  const t=(++stepIndex)*STEP;
  for(let index=0;index<states.length;index++){
   const state=states[index],isJelly=index<3;
   virtualCurrent(state.position,t,controls.currentGain*(1-.3*controls.quietness),state.current);
   force.set(0,0,0);normal.set(0,0,1).applyQuaternion(state.orientation);
   let mass:number,dragFactor:number,radius:number;
   if(isJelly){
    const p=JELLY_PRESETS[index],base=sampleAureliaKinematics(t,p),block=Math.floor(base.phase/TAU),selector=((block*17+p.seed)%23+23)%23;
    // Pause whole cycles; the pulse envelope is zero at a cycle boundary.
    const resting=selector<6,softTurn=selector===8||selector===17;
    state.activity=resting?.05:selector===20?1.18:1;state.phase=base.phase;state.frequency=base.frequency;
    state.pulse=base.contraction*state.activity;state.pulseRate=base.contractionRate*state.activity;
    state.behavior=resting?(selector<3?'J_PAUSE_OPEN':'J_DRIFT_IDLE'):base.cycle>.75?'J_GLIDE':softTurn?'J_SOFT_TURN':selector===22?'J_ASCEND':selector===21?'J_DESCEND':selector===20?'J_ACTIVE_CRUISE':'J_PULSE_CRUISE';
    const f=jellyForces(p.diameter,base.frequency,base.cycle,state.pulseRate,state.activity);
    state.pulseForce=f.pulse;state.perForce=f.per;mass=f.mass;dragFactor=f.dragFactor;radius=p.diameter*.58;
    force.addScaledVector(normal,f.pulse+f.per);
    // Slight negative net buoyancy offsets long-term ascent in this bounded art medium.
    force.y-=.0022*(p.diameter/.30)**3;
    if(state.behavior==='J_DESCEND')force.y-=.003*(p.diameter/.30)**3;
    if(state.behavior==='J_ASCEND')force.y+=.0015*(p.diameter/.30)**3;
    const approach=index<2?Math.sin(Math.PI*smooth((((t+index*43)%113)-8)/38))**2:0;
    desired.set(.22*Math.sin(t*.057+p.seed)+.35*approach,1-.35*approach,.23*Math.cos(t*.071+index)+1.2*approach).normalize();
    if(softTurn)desired.x+=.12*Math.sin(t*.4+index);
    state.turn=softTurn?.55*Math.sin(base.cycle*Math.PI):.08*Math.sin(t*.13+index);
    state.turnDirection=Math.atan2(desired.z,desired.x);
    torque.crossVectors(normal,desired).multiplyScalar(.16).addScaledVector(state.angularVelocity,-1.8);
   }else{
    const i=index-3,p=CLIONE_PRESETS[i],schedule=(t+i*13.7)%111;
    const nextGait:ClioneGait=schedule<42?'slowhover':schedule<81?'slowswim':schedule<91?'glidesink':schedule<108?'softturn':i===0&&controls.quietness<.9?'fastescape':'slowhover';
    if(nextGait!==state.gait){state.previousGait=state.gait;state.gait=nextGait;state.gaitChangedAt=t;}state.gaitBlend=smooth((t-state.gaitChangedAt)/.35);
    const targetF=controls.freezeWings||state.gait==='glidesink'?0:state.gait==='fastescape'?3.2:p.frequency*(1+.045*Math.sin(t*.14+p.seed));
    // Continuous phase through gait changes. No f(t)*t shortcut.
    state.frequency+=(targetF-state.frequency)*(1-Math.exp(-STEP*3));
    if(controls.freezeWings)state.frequency=0;
    state.phase+=TAU*state.frequency*STEP;
    state.turn=state.gait==='softturn'?.36*Math.sin(t*.25+i):.06*Math.sin(t*.14+i);
    const sampled=sampleClioneWingForces(t,p,{gait:state.gait,frequency:state.frequency,phase:state.phase,turn:state.turn,previousGait:state.previousGait,gaitBlend:state.gaitBlend});
    const hydro=clioneHydrodynamics(p.length);mass=hydro.mass;dragFactor=hydro.dragFactor;radius=.07;
    state.leftForce=sampled.left.z*liftGains[i];state.rightForce=sampled.right.z*liftGains[i];state.sinkForce=hydro.sinkForce;
    force.addScaledVector(normal,state.leftForce+state.rightForce);force.y-=state.sinkForce;
    desired.set(.11*Math.sin(t*.13+i*1.7),1,.12*Math.cos(t*.091+i)).normalize();
    torque.crossVectors(normal,desired).multiplyScalar(.5).addScaledVector(state.angularVelocity,-3);
    torque.z+=(state.leftForce-state.rightForce)/Math.max(1e-8,mass)*.3;
   }
   state.angularVelocity.addScaledVector(torque,STEP).clampLength(0,isJelly?.1396:.4363);
   const angularSpeed=state.angularVelocity.length();if(angularSpeed>1e-9){rotation.setFromAxisAngle(torque.copy(state.angularVelocity).divideScalar(angularSpeed),angularSpeed*STEP);state.orientation.premultiply(rotation).normalize();}
   relative.copy(state.velocity).sub(state.current);state.drag=dragFactor*relative.lengthSq();force.addScaledVector(relative,-dragFactor*relative.length());
   force.divideScalar(mass);
   const home=isJelly?JELLY_PRESETS[index].position:CLIONE_PRESETS[index-3].position;
   // Very weak region preference, not Boids alignment or a prescribed circular path.
   force.x+=(home[0]-state.position.x)*.0015;
   const jellyApproach=isJelly&&index<2?.45*Math.sin(Math.PI*smooth((((t+index*43)%113)-8)/38))**2:0;
   const foreground=index===3?.18*Math.sin(Math.PI*smooth(((t%47)-12)/18))**2:jellyApproach;
   force.z+=(home[2]+foreground-state.position.z)*.0015;
   if(isJelly)force.y+=(home[1]-state.position.y)*.002;
   softBoundary(state.position,radius,force);
   for(let j=0;j<states.length;j++)if(j!==index){const other=states[j],d=relative.copy(state.position).sub(other.position),distance=d.length(),safe=isJelly&&j<3?1.5*(JELLY_PRESETS[index].diameter+JELLY_PRESETS[j].diameter)/2:.14;if(distance<safe&&distance>1e-8)force.addScaledVector(d,.014*(1-distance/safe)**2/distance);}
   if(!controls.freezeRoots){state.velocity.addScaledVector(force,STEP).clampLength(0,isJelly?.045:.035);state.position.addScaledVector(state.velocity,STEP*controls.motionGain);state.distance+=state.velocity.length()*STEP*controls.motionGain;}
  }
 };
 return {get states(){return states;},controls,update(elapsed:number){
  if(!Number.isFinite(elapsed)||elapsed<0)throw new RangeError('Creature elapsed must be finite and nonnegative.');
  const target=Math.floor(elapsed/STEP+1e-7);
  if(target<stepIndex){states=[...JELLY_PRESETS.map(p=>createState(p,'aurelia')),...CLIONE_PRESETS.slice(0,clioneCount).map(p=>createState(p,'clione'))];stepIndex=0;}
  while(stepIndex<target)advance();return states;
 },diagnostics(){return states.map(s=>({name:s.name,speed:s.velocity.length(),Re:reynolds(s.velocity.length(),s.kind==='aurelia'?JELLY_PRESETS.find(p=>p.name===s.name)!.diameter:CLIONE_PRESETS.find(p=>p.name===s.name)!.length),phase:s.phase,behavior:s.kind==='aurelia'?s.behavior:s.gait,distance:s.distance}));}};
}
