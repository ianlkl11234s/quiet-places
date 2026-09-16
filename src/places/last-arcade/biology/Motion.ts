import * as THREE from 'three';
import {seededRandom} from '../../../shared/math/seededRandom.ts';
import {sampleVirtualFlow} from '../../../systems/virtual-flow/index.ts';
import {envelopeClear} from './Obstacles.ts';
export const animalClearanceRadii=[4.5,4.2,4.0,5.2] as const;
const TAU=Math.PI*2,STEP=1/20,UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,1);
const clamp=THREE.MathUtils.clamp;
export const profiles=[
 {id:'manta-a',species:'Mobula birostris',size:5.8,seed:9101,height:8.8,speed:1.02,frequency:.288,tau:1.1},
 {id:'manta-b',species:'Mobula birostris',size:5.4,seed:9102,height:9.2,speed:1.09,frequency:.309,tau:.9},
 {id:'manta-c',species:'Mobula birostris',size:5.1,seed:9103,height:10.6,speed:.97,frequency:.294,tau:1.3},
 {id:'whale-shark',species:'Rhincodon typus',size:8.5,seed:9140,height:3.0,speed:.68,frequency:.38,tau:2.4},
] as const;
export type AnimalState={id:string,position:THREE.Vector3,quaternion:THREE.Quaternion,velocity:THREE.Vector3,speed:number,frequency:number,phase:number,bank:number,curvature:number,glide:number,asymmetry:number,state:string,distance:number};
type Route={curve:THREE.CatmullRomCurve3,length:number,closed:boolean};
function route(points:THREE.Vector3[],closed=true):Route{const curve=new THREE.CatmullRomCurve3(points,closed,'centripetal');curve.arcLengthDivisions=8192;curve.updateArcLengths();return {curve,length:curve.getLength(),closed};}
function loop(i:number,variation=0):Route{
 const whale=i===3,a=whale?25:8.5+(i===2?1.5:0),b=whale?25:14.5+(i===2?2:0),h=profiles[i].height;
 return route(Array.from({length:32},(_,j)=>{const t=j/32*TAU;const blend=whale?Math.pow(Math.sin(t*.5),4)*variation:0;return new THREE.Vector3(5.8+(a+blend)*Math.sin(t),h+(whale?.25:.55)*Math.sin(t+.6*i)+.18*Math.sin(2*t+.4)+blend*.15,(whale?-65:-11)+(b+blend)*Math.cos(t));}));
}
const cloneState=(s:AnimalState):AnimalState=>({...s,position:s.position.clone(),quaternion:s.quaternion.clone(),velocity:s.velocity.clone()});
const poseFor=(direction:THREE.Vector3,bank:number)=>{const right=new THREE.Vector3().crossVectors(UP,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,direction)).multiply(new THREE.Quaternion().setFromAxisAngle(FORWARD,bank));};
export class ArcadeAnimalMotion {
 states:AnimalState[]=[];previous:AnimalState[]=[];time=0;events:{time:number,type:string,id:string}[]=[];
 private rng=seededRandom(91526);private random=profiles.map(p=>seededRandom(p.seed));
 private routes=profiles.map((_,i)=>loop(i));private distances=[.12,.43,.76,.98].map((u,i)=>u*this.routes[i].length);
 private glideUntil=[0,0,0,0];private nextGlide=[0,0,0,45];private frequencies=profiles.map(p=>Number(p.frequency));
 private nextPair=45;private pairUntil=0;private nextLow=70;private nextSwitch=60;private lowIndex=-1;private returnDistance=0;
 private lowPending=false;
 private routeOffset=profiles.map(()=>new THREE.Vector3());private pairWeight=0;
 constructor(includeWhale=true){
  this.states=profiles.slice(0,includeWhale?4:3).map((p,i)=>{const r=this.routes[i],position=r.curve.getPointAt(this.distances[i]/r.length),dir=r.curve.getTangentAt(this.distances[i]/r.length);return {id:p.id,position,quaternion:poseFor(dir,0),velocity:dir.multiplyScalar(p.speed),speed:p.speed,frequency:p.frequency,phase:i*1.71,bank:0,curvature:0,glide:0,asymmetry:0,state:'CRUISE',distance:0};});this.previous=this.states.map(cloneState);
 }
 private gaussian(random:()=>number){return Math.sqrt(-2*Math.log(Math.max(1e-9,random())))*Math.cos(TAU*random());}
 private log(type:string,i:number){this.events.push({time:this.time,type,id:profiles[i].id});if(this.events.length>200)this.events.shift();}
 get noticeableEvents(){return Number(this.pairUntil>this.time)+Number(this.lowIndex>=0);}
 private startLow(){
  // B is narrower; line-up begins well outside the end of the arcade. Only the
  // eye-level segment lasts ~10s; descent/return take longer at safe swim speeds.
  const i=1,s=this.states[i],r=this.routes[i],ret=r.length*.5,exit=r.curve.getPointAt(.5);
  const points=[s.position.clone(),new THREE.Vector3(13,10,5),new THREE.Vector3(19,10,13),new THREE.Vector3(16,10,23),new THREE.Vector3(8,9,27),new THREE.Vector3(6.15,6,19),new THREE.Vector3(6.15,3.9,9),new THREE.Vector3(6.15,2.9,-5),new THREE.Vector3(6.15,2.9,-16),new THREE.Vector3(5.95,3.9,-25),new THREE.Vector3(5.95,8,-30),new THREE.Vector3(5.93,12,-40),new THREE.Vector3(5.93,12,-50),new THREE.Vector3(13,10,-58),new THREE.Vector3(26,10,-56),new THREE.Vector3(32,10,-44),new THREE.Vector3(25,10,-30),new THREE.Vector3(14,10,-25.5),exit];
  const candidate=route(points,false),half=new THREE.Vector3(2.87,1.18,2.87);
  for(let n=0;n<=500;n++)if(!envelopeClear(candidate.curve.getPointAt(n/500),half))return false;
  this.routes[i]=candidate;this.distances[i]=0;this.routeOffset[i].set(0,0,0);this.lowIndex=i;this.returnDistance=ret;this.log('LOW_DESCENT',i);return true;
 }
 private step(){
  this.previous=this.states.map(cloneState);this.time+=STEP;
  if(this.time>this.nextPair&&this.lowIndex<0&&this.states[0].position.distanceTo(this.states[1].position)<12&&this.rng()<1-Math.exp(-STEP/125)){
   this.pairUntil=this.time+15+this.rng()*20;this.nextPair=this.pairUntil+75;this.log('PAIR_APPROACH',1);
  }
  if(this.time>this.nextLow&&this.lowIndex<0&&this.pairUntil<this.time&&this.rng()<1-Math.exp(-STEP/150))this.lowPending=true;
  if(this.lowPending&&this.lowIndex<0&&this.pairUntil<this.time&&this.distances[1]/this.routes[1].length<.012){
   if(this.startLow()){this.nextLow=this.time+150;this.lowPending=false;}
  }
  // A new wide loop is approached gradually as a vertical excursion. Its
  // horizontal curvature stays above the 2.5L radius bound; no root teleport.
  if(this.states.length>3&&this.time>this.nextSwitch&&this.rng()<1-Math.exp(-STEP/120)){this.nextSwitch=this.time+120;this.whaleRoutePending=true;this.whaleAltitudeTarget=.3*(this.rng()-.5);}
  this.pairWeight=THREE.MathUtils.lerp(this.pairWeight,this.pairUntil>this.time?1:0,1-Math.exp(-STEP/4));
  const oldDistances=[...this.distances],oldRoutes=[...this.routes],oldOffsets=this.routeOffset.map(v=>v.clone());
  for(let i=0;i<this.states.length;i++)this.stepAnimal(i);
  // Swept bounding spheres protect animated bodies and trailing tails, not just roots.
  const blocked=new Set<number>();
  for(let pass=0;pass<4;pass++){
  for(let i=0;i<this.states.length;i++)for(let j=i+1;j<this.states.length;j++){
   const start=this.previous[i].position.clone().sub(this.previous[j].position);
   const relative=this.states[i].position.clone().sub(this.states[j].position).sub(start);
   const t=clamp(-start.dot(relative)/Math.max(1e-12,relative.lengthSq()),0,1);
   if(start.addScaledVector(relative,t).length()<animalClearanceRadii[i]+animalClearanceRadii[j]+.2){blocked.add(i);blocked.add(j);}
  }
  for(const i of blocked){this.states[i].position.copy(this.previous[i].position);this.states[i].quaternion.copy(this.previous[i].quaternion);this.states[i].velocity.set(0,0,0);this.distances[i]=oldDistances[i];this.routes[i]=oldRoutes[i];this.routeOffset[i].copy(oldOffsets[i]);}
  }

 }
 private whaleAltitudeTarget=0;private whaleRoutePending=false;private whaleVariant=0;
 private stepAnimal(i:number){
  const s=this.states[i],p=profiles[i],random=this.random[i],whale=i===3,low=this.lowIndex===i;
  const noise=this.gaussian(random);let targetSpeed=p.speed*(low?.96:1);
  if(i===1&&!low&&this.pairWeight>.01){const length=this.routes[i].length,gap=((this.distances[0]-this.distances[1]+length*1.5)%length)-length*.5;targetSpeed+=this.pairWeight*clamp((gap-7)*.08,-.18,.18);}
  // Start yielding several metres before the hard swept-body guard.
  let clearancePace=1;
  for(let j=0;j<this.states.length;j++)if(j!==i){const delta=this.previous[j].position.clone().sub(s.position),distance=delta.length(),closing=s.velocity.dot(delta)/Math.max(distance,.001);if(closing>0){const gap=distance-animalClearanceRadii[i]-animalClearanceRadii[j]-.5;clearancePace=Math.min(clearancePace,THREE.MathUtils.smoothstep(gap,0,5));}}
  targetSpeed*=clearancePace;
  s.speed=clamp(s.speed+(targetSpeed-s.speed)*(whale?.18:.25)*STEP+(whale?.025:.05)*Math.sqrt(STEP)*noise,clearancePace<.99?0:(whale?.55:.8),whale?.8:1.3);
  this.frequencies[i]=clamp(this.frequencies[i]+.15*(p.frequency-this.frequencies[i])*STEP+.015*Math.sqrt(STEP)*this.gaussian(random),whale?.32:.23,whale?.48:.36);
  if(whale&&this.time>this.nextGlide[i]&&random()<1-Math.exp(-STEP/45)){this.glideUntil[i]=this.time+4+random()*10;this.nextGlide[i]=this.glideUntil[i]+30;this.log('GLIDE',i);}
  // Mantas keep a continuous stroke; short random phase holds read as animation stalls.
  const glideTarget=whale&&this.time<this.glideUntil[i]?1:0;s.glide=THREE.MathUtils.lerp(s.glide,glideTarget,1-Math.exp(-STEP/(whale?1.1:.22)));
  s.frequency=this.frequencies[i]*(1-s.glide*(whale?.82:.97));
  let coupling=0;if(i<2)coupling=.025*this.pairWeight*Math.sin(this.states[1-i].phase-s.phase-(i===0?1.1:-1.1));
  s.phase+=(TAU*s.frequency+coupling)*STEP;
  let r=this.routes[i];this.distances[i]+=s.speed*STEP;s.distance+=s.speed*STEP;
  if(this.distances[i]>=r.length){
   if(low){this.routes[i]=loop(i);this.distances[i]=this.returnDistance+(this.distances[i]-r.length);this.lowIndex=-1;this.nextLow=this.time+70;this.log('RETURN',i);}
   else {this.distances[i]%=r.length;if(whale&&this.whaleRoutePending){this.whaleVariant=this.whaleVariant===0?2:0;this.routes[i]=loop(i,this.whaleVariant);this.whaleRoutePending=false;this.log('ROUTE_SWITCH',i);}}
   r=this.routes[i];
  }
  const u=clamp(this.distances[i]/r.length,0,.999999),base=r.curve.getPointAt(u),direction=r.curve.getTangentAt(u).normalize();
  const ds=.25,ub=clamp((this.distances[i]-ds)/r.length,0,1),ua=clamp((this.distances[i]+ds)/r.length,0,1);
  const before=r.curve.getTangentAt(ub),after=r.curve.getTangentAt(ua);
  const curvature=Math.atan2(before.clone().cross(after).y,before.dot(after))/(Math.max(.001,(ua-ub)*r.length));s.curvature=curvature;
  const flow=sampleVirtualFlow(base,this.time).multiplyScalar(whale?.5:1);
  const drift=new THREE.Vector3(Math.sin(this.time/67+i)*.22,Math.sin(this.time/83+i)*.15,Math.sin(this.time/97+i)*.18).add(flow);
  if(whale)drift.y+=this.whaleAltitudeTarget;
  // The high cruisers yield above B's low-pass/rejoin corridor well in advance.
  if(i!==1&&i<3&&this.lowIndex===1){const distance=base.distanceTo(this.previous[1].position);drift.y+=6*THREE.MathUtils.smoothstep(28-distance,0,16);}
  // Weak relative-velocity/spacing correction, capped at 18% route steering.
  if(i===1&&this.pairWeight>.001&&!low){const delta=this.states[0].position.clone().sub(base),d=delta.length(),spring=delta.normalize().multiplyScalar(clamp((d-7)*.018,-.18,.18));drift.addScaledVector(spring,this.pairWeight);}
  if(low)drift.multiplyScalar(0);
  this.routeOffset[i].lerp(drift,1-Math.exp(-STEP/8));
  const proposed=base.add(this.routeOffset[i]);
  const maxBank=whale?18:50,targetBank=low?0:clamp(-Math.atan(s.speed*s.speed*curvature/.22),-THREE.MathUtils.degToRad(maxBank),THREE.MathUtils.degToRad(maxBank));
  s.bank=THREE.MathUtils.lerp(s.bank,targetBank,1-Math.exp(-STEP/.8));s.asymmetry=THREE.MathUtils.lerp(s.asymmetry,clamp(-curvature*2,-.26,.26),1-Math.exp(-STEP/.8));
  // Conservative look-ahead swept envelope. Climb early at route planning
  // scale, never wait for the visible body to strike a roof or cable.
  const half=whale?new THREE.Vector3(4.65,1.65,4.65):new THREE.Vector3(p.size*.5+.16,low?1.18:2.0,p.size*.5+.16);
  for(let ahead=0;ahead<=(whale?12:6);ahead+=2){const futureDistance=this.distances[i]+s.speed*ahead,fu=r.closed?(futureDistance%r.length)/r.length:Math.min(1,futureDistance/r.length),future=r.curve.getPointAt(fu).add(this.routeOffset[i]);if(!envelopeClear(future,half)){proposed.y=Math.max(proposed.y,8.6+half.y);break;}}
  s.position.copy(proposed);s.velocity.copy(s.position).sub(this.previous[i].position).divideScalar(STEP);
  const actualDirection=s.velocity.lengthSq()>1e-8?s.velocity.clone().normalize():direction;
  s.quaternion.slerp(poseFor(actualDirection,s.bank),1-Math.exp(-STEP/p.tau));
  s.state=low?(s.position.y<3.2?'LOW_PASS':s.velocity.y<0?'LOW_DESCENT':'ASCEND'):i<2&&this.pairWeight>.15?(this.pairUntil>this.time?'PAIR_SYNC':'PAIR_RELEASE'):s.glide>.5?'GLIDE':whale&&Math.abs(this.routeOffset[i].y-this.whaleAltitudeTarget)>.2?'ROUTE_SWITCH':Math.abs(s.bank)>.1?'BANK_TURN':'CRUISE';
 }
 advance(elapsed:number){const target=Math.max(0,Number.isFinite(elapsed)?elapsed:0);if(target+1e-8<this.time){throw new Error('Recreate ArcadeAnimalMotion before seeking backwards');}while(this.time+STEP<=target+1e-8)this.step();}
 sample(elapsed:number){this.advance(elapsed);const alpha=clamp((elapsed-this.time)/STEP,0,1);return this.states.map((s,i)=>{const a=this.previous[i];return {...s,position:a.position.clone().lerp(s.position,alpha),quaternion:a.quaternion.clone().slerp(s.quaternion,alpha),phase:THREE.MathUtils.lerp(a.phase,s.phase,alpha),glide:THREE.MathUtils.lerp(a.glide,s.glide,alpha),asymmetry:THREE.MathUtils.lerp(a.asymmetry,s.asymmetry,alpha)};});}
 debug(){return {time:this.time,events:this.events,activeEvents:this.noticeableEvents,animals:this.states.map(s=>({id:s.id,state:s.state,position:s.position.toArray(),speed:s.velocity.length(),targetSpeed:s.speed,frequency:s.frequency,curvature:s.curvature,radius:1/Math.max(1e-8,Math.abs(s.curvature)),bank:s.bank*180/Math.PI,phase:s.phase,glide:s.glide}))};}
}
