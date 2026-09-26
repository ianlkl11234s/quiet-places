import {MathUtils,Quaternion,Vector3} from 'three';
import {AURELIA_PULSE,sampleAureliaKinematics} from '../../shared/biology/aurelia/index.ts';
import {sampleClioneWingForces,type ClioneGait} from '../../shared/biology/clione/index.ts';
import {virtualCurrent,VIRTUAL_SEAWATER,reynolds} from '../../shared/biology/VirtualFluid.ts';

const STEP=1/120,TAU=2*Math.PI,up=new Vector3(0,1,0),axisZ=new Vector3(0,0,1),DEG=Math.PI/180;
export const SNOW_CREATURE_SEED=2718;
export const JELLY_PRESETS=[
 // J2: .2–.4 Hz band for 20–30 cm animals, larger = slower (Xu 2020; Yoder & Dabiri 2026; McHenry & Jed 2003). Level B.
 {name:'JELLY_A',diameter:.30,frequency:.32,phase:.13,seed:2718,position:[1.02,2.12,-3.45]},
 {name:'JELLY_B',diameter:.25,frequency:.37,phase:.61,seed:2819,position:[1.48,2.85,-3.77]},
 {name:'JELLY_C',diameter:.20,frequency:.40,phase:.37,seed:2920,position:[.54,3.56,-3.94]},
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
/**
 * J2 attitude model (B-level approximations, not CFD):
 * - steering is latched once per beat; the sector that contracts first/stronger lies opposite the turn,
 *   and a torque impulse is applied only while contracting (asymmetric stroke + skid: velocity is not re-aimed);
 * - a passive statocyst-like righting torque pulls the axis back toward +Y between beats;
 * - |ω| ≤ .4 rad/s and one beat turns ≤ 45°.
 */
export const JELLY_ATTITUDE={maxAngularSpeed:.4,maxBeatTurn:45*DEG,maxTilt:35*DEG,turnGain:1.3,righting:.07,damping:.9} as const;
/** One event per beat for wake/vortex consumers (J3). Positions and axes are world space, metres. */
export interface JellyBeatEvent {
 name:string;index:number;beat:number;kind:'contraction'|'relaxation';time:number;
 position:[number,number,number];axis:[number,number,number];
 /** stroke impulse proxy along the axis, N·s (same force model as jellyForces; not a measured impulse) */
 strength:number;diameter:number;turn:number;turnDirection:number;
}
export interface CreatureState {
 name:string;kind:'aurelia'|'clione';position:Vector3;velocity:Vector3;orientation:Quaternion;angularVelocity:Vector3;
 phase:number;frequency:number;activity:number;turn:number;turnDirection:number;gait:ClioneGait;previousGait:ClioneGait;gaitBlend:number;gaitChangedAt:number;behavior:JellyBehavior;
 pulse:number;pulseRate:number;pulseForce:number;perForce:number;drag:number;distance:number;sinkForce:number;leftForce:number;rightForce:number;current:Vector3;
 /** jelly only: latched beat index, rotation axis for this beat (world), axis tilt from +Y (rad), cycle last step */
 beat:number;turnAxis:Vector3;tilt:number;lastCycle:number;
}
const smooth=(x:number)=>{const t=MathUtils.clamp(x,0,1);return t*t*(3-2*t);};
function createState(p:typeof JELLY_PRESETS[number]|typeof CLIONE_PRESETS[number],kind:CreatureState['kind']):CreatureState{
 return {name:p.name,kind,position:new Vector3(...p.position),velocity:new Vector3(),orientation:new Quaternion().setFromUnitVectors(axisZ,up),angularVelocity:new Vector3(),phase:kind==='aurelia'?p.phase*TAU:p.phase,frequency:p.frequency,activity:1,turn:0,turnDirection:0,gait:'slowhover',previousGait:'slowhover',gaitBlend:1,gaitChangedAt:0,behavior:'J_PULSE_CRUISE',pulse:0,pulseRate:0,pulseForce:0,perForce:0,drag:0,distance:0,sinkForce:0,leftForce:0,rightForce:0,current:new Vector3(),beat:Number.NaN,turnAxis:new Vector3(1,0,0),tilt:0,lastCycle:0};
}
/** Force coefficients and buoyancy are calibrated priors, not CFD or measured physiology. PER_GAIN recalibrated for the .20 contraction (J2). */
const PULSE_GAIN=.63,PER_GAIN=.56;
/** Net negative buoyancy as a fraction of each jelly's mean thrust; keeps the 2026-09-10 accepted vertical balance (old .0022·(D/.3)³ N ÷ old mean thrust). C-level. */
const JELLY_BUOYANCY_RATIO=[.335,.25,.418] as const;
/** Mean pulse+PER thrust over one nominal cycle (N). */
export function jellyMeanThrust(diameter:number,frequency:number){let sum=0;const n=2400;for(let k=0;k<n;k++){const c=k/n,{contract:C,relaxEnd:E}=AURELIA_PULSE;const rate=c<C?.5*Math.PI*Math.sin(Math.PI*c/C)/(C/frequency):c<E?-.5*Math.PI*Math.sin(Math.PI*(c-C)/(E-C))/((E-C)/frequency):0;const f=jellyForces(diameter,frequency,c,rate);sum+=f.pulse+f.per;}return sum/n;}
export function jellyForces(diameter:number,frequency:number,cycle:number,contractionRate:number,activity=1){
 const radius=diameter/2;
 const {contract:C,relaxEnd:E}=AURELIA_PULSE,peak=.5*Math.PI*frequency/C;
 const pulse=PULSE_GAIN*radius**3*Math.max(0,contractionRate)**2;
 // Smooth onset during late refill avoids an artificial impulse at the relaxation end.
 const gate=smooth((cycle-(E-.31))/.21),age=Math.max(0,cycle-E)/frequency;
 const per=PER_GAIN*radius**3*peak**2*gate*Math.exp(-age/(.45/frequency))*activity;
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
 const force=new Vector3(),relative=new Vector3(),normal=new Vector3(),desired=new Vector3(),torque=new Vector3(),rotation=new Quaternion(),tangent=new Vector3(),inverse=new Quaternion();
 let beatEvents:JellyBeatEvent[]=[];
 const buoyancy=JELLY_PRESETS.map((p,i)=>JELLY_BUOYANCY_RATIO[i]*jellyMeanThrust(p.diameter,p.frequency));
 const liftGains=CLIONE_PRESETS.slice(0,clioneCount).map(p=>{
  let mean=0;for(let i=0;i<120;i++)mean+=sampleClioneWingForces(i/120/p.frequency,p,{gait:'slowhover',frequency:p.frequency,phase:i/120*TAU}).total.z;
  return clioneHydrodynamics(p.length).sinkForce/Math.max(1e-12,mean/120);
 });
 const pushBeat=(state:CreatureState,index:number,kind:JellyBeatEvent['kind'],time:number,axis:Vector3,diameter:number,frequency:number)=>{
  const radius=diameter/2,peak=.5*Math.PI*frequency/AURELIA_PULSE.contract,duration=AURELIA_PULSE.contract/frequency;
  // ∫pulse dt over one contraction with the jellyForces pulse model (mean sin² = .5).
  const strength=PULSE_GAIN*radius**3*peak**2*.5*duration*state.activity;
  beatEvents.push({name:state.name,index,beat:state.beat,kind,time,position:state.position.toArray() as [number,number,number],axis:axis.toArray() as [number,number,number],strength,diameter,turn:state.turn,turnDirection:state.turnDirection});
  if(beatEvents.length>64)beatEvents.shift();
 };
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
    state.behavior=resting?(selector<3?'J_PAUSE_OPEN':'J_DRIFT_IDLE'):base.cycle>=AURELIA_PULSE.relaxEnd?'J_GLIDE':softTurn?'J_SOFT_TURN':selector===22?'J_ASCEND':selector===21?'J_DESCEND':selector===20?'J_ACTIVE_CRUISE':'J_PULSE_CRUISE';
    const f=jellyForces(p.diameter,base.frequency,base.cycle,state.pulseRate,state.activity);
    state.pulseForce=f.pulse;state.perForce=f.per;mass=f.mass;dragFactor=f.dragFactor;radius=p.diameter*.58;
    force.addScaledVector(normal,f.pulse+f.per);
    // Slight negative net buoyancy offsets long-term ascent in this bounded art medium.
    force.y-=buoyancy[index];
    if(state.behavior==='J_DESCEND')force.y-=buoyancy[index]*.003/.0022;
    if(state.behavior==='J_ASCEND')force.y+=buoyancy[index]*.0015/.0022;
    const approach=index<2?Math.sin(Math.PI*smooth((((t+index*43)%113)-8)/38))**2:0;
    const cycleStart=block!==state.beat;
    if(cycleStart){
     // J2 steering, latched per beat. Travel wish (horizontal) = slow wander + home/boundary return + approach choreography.
     const home=p.position,seedPhase=p.seed*.0137;
     const wander=.9*Math.sin(t*.041+seedPhase)+.6*Math.sin(t*.0173+2.1*seedPhase);
     desired.set(Math.cos(wander),0,Math.sin(wander)).multiplyScalar(.6);
     desired.x+=2.2*(home[0]-state.position.x)+.35*approach;desired.z+=2.2*(home[2]-state.position.z)+1.2*approach;
     desired.x+=4*(smooth((-.68+p.diameter+.45-state.position.x)/.45)-smooth((state.position.x-(2.8-p.diameter-.45))/.45));
     desired.z+=4*(smooth((-4.25+p.diameter+.45-state.position.z)/.45)-smooth((state.position.z-(-1.92-p.diameter-.45))/.45));
     const heading=Math.hypot(desired.x,desired.z)>1e-6?Math.atan2(desired.z,desired.x):0;
     // Tilt target: smooth deterministic 0–35° distribution; more tilt when above home (less lift), less when low.
     const n1=.5+.5*Math.sin(t*.047+p.seed*.29)*Math.cos(t*.0191+p.seed*.11),n2=.5+.5*Math.sin(t*.113+p.seed*.53);
     // Lean bouts (C choreography): one ~12 s strongly tilted cruise per 41/47/53 s, staggered so the three never lean together.
     const boutPeriod=41+6*index,boutCenter=[17,28,45][index],bout=Math.sin(Math.PI*smooth((((t-boutCenter+9+10*boutPeriod)%boutPeriod))/18))**2;
     let tiltTarget=(5+24*Math.pow(.72*n1+.28*n2,1.2)+23*bout)*DEG+.15*MathUtils.clamp(state.position.y-home[1],-.6,.6);
     tiltTarget=MathUtils.clamp(tiltTarget,0,JELLY_ATTITUDE.maxTilt);
     desired.set(Math.sin(tiltTarget)*Math.cos(heading),Math.cos(tiltTarget),Math.sin(tiltTarget)*Math.sin(heading));
     const error=Math.acos(MathUtils.clamp(normal.dot(desired),-1,1));
     tangent.copy(desired).addScaledVector(normal,-normal.dot(desired));
     const active=!resting&&tangent.lengthSq()>1e-10;
     // One full-strength beat rotates ≈26–30° (turnGain·∫stroke ≈ .45 rad/s, then damped), so asking for ~90% of the error per beat avoids overshoot/ping-pong.
     state.turn=active?MathUtils.clamp(error/(30*DEG),0,1):0;
     if(active){tangent.normalize();state.turnAxis.crossVectors(normal,tangent).normalize();
      // Lead (earlier, stronger) sectors sit opposite the side the axis tips toward.
      const lead=tangent.clone().negate().applyQuaternion(inverse.copy(state.orientation).invert());
      state.turnDirection=Math.atan2(lead.y,lead.x);}
     state.beat=block;
     if(state.activity>.2)pushBeat(state,index,'contraction',t,normal,p.diameter,base.frequency);
    }
    if(state.lastCycle<AURELIA_PULSE.contract&&base.cycle>=AURELIA_PULSE.contract&&state.activity>.2)pushBeat(state,index,'relaxation',t,normal,p.diameter,base.frequency);
    state.lastCycle=base.cycle;
    if(state.turn>.5&&!resting&&base.cycle<AURELIA_PULSE.relaxEnd)state.behavior='J_SOFT_TURN';
    // Torque only while contracting (asymmetric stroke); passive righting and damping always act.
    const stroke=Math.max(0,state.pulseRate)/(.5*Math.PI*base.frequency/AURELIA_PULSE.contract);
    torque.copy(state.turnAxis).multiplyScalar(JELLY_ATTITUDE.turnGain*state.turn*stroke);
    state.tilt=Math.acos(MathUtils.clamp(normal.y,-1,1));
    // Righting grows past ~30° so overshoot beyond the 35° envelope is brief.
    const righting=JELLY_ATTITUDE.righting*(1+8*smooth((state.tilt-30*DEG)/(10*DEG)));
    torque.addScaledVector(relative.crossVectors(normal,up),righting).addScaledVector(state.angularVelocity,-JELLY_ATTITUDE.damping);
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
   state.angularVelocity.addScaledVector(torque,STEP).clampLength(0,isJelly?JELLY_ATTITUDE.maxAngularSpeed:.4363);
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
 /** Most recent beat events (≤64), oldest first; rebuilt deterministically on rewind. */
 return {get states(){return states;},get beatEvents():readonly JellyBeatEvent[]{return beatEvents;},beatEventsSince(time:number){return beatEvents.filter(e=>e.time>time);},controls,update(elapsed:number){
  if(!Number.isFinite(elapsed)||elapsed<0)throw new RangeError('Creature elapsed must be finite and nonnegative.');
  const target=Math.floor(elapsed/STEP+1e-7);
  if(target<stepIndex){states=[...JELLY_PRESETS.map(p=>createState(p,'aurelia')),...CLIONE_PRESETS.slice(0,clioneCount).map(p=>createState(p,'clione'))];stepIndex=0;beatEvents=[];}
  while(stepIndex<target)advance();return states;
 },diagnostics(){return states.map(s=>({name:s.name,speed:s.velocity.length(),Re:reynolds(s.velocity.length(),s.kind==='aurelia'?JELLY_PRESETS.find(p=>p.name===s.name)!.diameter:CLIONE_PRESETS.find(p=>p.name===s.name)!.length),phase:s.phase,behavior:s.kind==='aurelia'?s.behavior:s.gait,distance:s.distance}));}};
}
