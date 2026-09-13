import * as THREE from 'three';
import config from '../../../assets/config/snowhall-biology.json' with {type:'json'};
import {seededRandom} from '../../shared/math/seededRandom.ts';

const STEP=config.simulation.fixedStepSeconds,FORWARD=new THREE.Vector3(0,0,1);
const clamp=THREE.MathUtils.clamp,smooth=THREE.MathUtils.smoothstep;
type Random=()=>number;
export type SquidState='IDLE_HOVER'|'SLOW_CRUISE'|'GENTLE_TURN'|'DEPTH_ADJUST'|'MICRO_JET_REPOSITION';
export type BioEventType='SQUID_APPROACH_LIGHT'|'SQUID_CROSS_CORRIDOR'|'SQUID_SILVERFISH_NEAR_PASS'|'SILVERFISH_SMALL_TRANSIT'|'SILVERFISH_MAIN_TRANSIT'|'SILVERFISH_SPLIT_AROUND_SQUID'|'LONG_EMPTY_PHASE'|'MICRO_JET_REPOSITION';
export type FishRouteMode='MEANDER'|'MID_HOVER'|'CIRCLE';
export type AntarcticEvent={type:BioEventType;start:number;end?:number;duration?:number;lightPeak:number;count?:number;agent?:number;routeSeed?:number;routeMode?:FishRouteMode;entrySide?:number;entryHeight?:number;routeCenter?:[number,number,number];state:'ACTIVE'|'DONE'};
export type AntarcticAgent={position:THREE.Vector3;quaternion:THREE.Quaternion;speedBL:number;turn:number;scale:number;visible:boolean;target:THREE.Vector3;avoidance:THREE.Vector3;state:SquidState|'TRANSIT'|'DORMANT'};
export type AntarcticBehaviorOptions={width?:number;height?:number;windowX?:number;windowY?:number;windowWidth?:number;windowHeight?:number;cameraPosition?:[number,number,number];cameraTarget?:[number,number,number]};
type Body=AntarcticAgent&{p:THREE.Vector3;previous:THREE.Vector3;q:THREE.Quaternion;previousQ:THREE.Quaternion;velocity:THREE.Vector3;random:Random;radius:number;yaw:number;pitch:number;phase:number};
type Squid=Body&{nextTarget:number;nextJet:number;jetStart:number;stateUntil:number;restState:SquidState;cruise:number};
type Fish=Body&{route:THREE.Curve<THREE.Vector3>;travelDuration:number;holdSeconds:number;routeMode:FishRouteMode;start:THREE.Vector3;control:THREE.Vector3;finish:THREE.Vector3;launch:number;duration:number;launched:boolean;finished:boolean;cruise:number};
const mix=(seed:number,stream:number)=>(Math.imul(seed^Math.imul(stream+1,0x9e3779b9),0x85ebca6b)>>>0);
const between=(random:Random,limits:readonly number[])=>limits[0]+random()*(limits[1]-limits[0]);
const wrap=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
function logInterval(random:Random,limits:readonly number[]){const normal=Math.sqrt(-2*Math.log(Math.max(1e-8,random())))*Math.cos(2*Math.PI*random());return clamp(Math.sqrt(limits[0]*limits[1])*Math.exp(.35*normal),limits[0],limits[1]);}

/** Fixed-step choreography, not animal biomechanics. Window radiance remains
 * authored by Daylight.ts; this scalar field is a separate artistic proxy. */
export class AntarcticBehavior {
 readonly squids:Squid[]=[];readonly fish:Fish[]=[];
 readonly events:AntarcticEvent[]=[];readonly eventLog:AntarcticEvent[]=[];
 readonly navBounds:{min:THREE.Vector3;max:THREE.Vector3};
 schoolCentroid:THREE.Vector3|null=null;time=0;
 private readonly seed:number;private readonly options:Required<AntarcticBehaviorOptions>;private readonly camera:THREE.Vector3;private readonly cameraForward:THREE.Vector3;
 private eventRandom:Random=()=>0;private schoolRandom:Random=()=>0;
 private tick=0;private lastElapsed=0;private alpha=0;
 private nextFish=0;private nextApproach=0;private nextCross=0;private nextEmpty=0;private majorCooldown=0;private nextInteraction=0;
 private activeFish:AntarcticEvent|null=null;private activeSquid:AntarcticEvent|null=null;private emptyEvent:AntarcticEvent|null=null;
 private schoolSequence=0;private schoolCount=0;private interaction:AntarcticEvent|null=null;private splitEvent:AntarcticEvent|null=null;
 private samples=0;private quietSamples=0;private majorSamples=0;private brightSamples=0;private fishCountSamples=0;private fishCountSum=0;
 constructor(seed:number,options:AntarcticBehaviorOptions={}){
  this.seed=Number.isFinite(seed)?seed>>>0:0;
  this.options={width:options.width??2.8,height:options.height??3.2,windowX:options.windowX??0,windowY:options.windowY??1.76,windowWidth:options.windowWidth??1.76,windowHeight:options.windowHeight??2.05,cameraPosition:options.cameraPosition??[.34,1.03,-.07],cameraTarget:options.cameraTarget??[0,1.31,-10.85]};
  this.camera=new THREE.Vector3(...this.options.cameraPosition);this.cameraForward=new THREE.Vector3(...this.options.cameraTarget).sub(this.camera).normalize();
  this.navBounds={min:new THREE.Vector3(-this.options.width/2+.025,.08,-11.3),max:new THREE.Vector3(this.options.width/2-.025,this.options.height-.08,6.9)};
  this.reset();
 }
 private body(index:number,scale:number,radius:number,stream:number):Body{
  const random=seededRandom(mix(this.seed,stream+index));return {position:new THREE.Vector3(),quaternion:new THREE.Quaternion(),p:new THREE.Vector3(),previous:new THREE.Vector3(),q:new THREE.Quaternion(),previousQ:new THREE.Quaternion(),velocity:new THREE.Vector3(),target:new THREE.Vector3(),avoidance:new THREE.Vector3(),speedBL:0,turn:0,scale,radius,visible:false,state:'DORMANT',random,yaw:0,pitch:0,phase:random()*Math.PI*2};
 }
 reset(){
  this.tick=0;this.time=0;this.lastElapsed=0;this.alpha=0;this.squids.length=0;this.fish.length=0;this.events.length=0;this.eventLog.length=0;
  this.activeFish=null;this.activeSquid=null;this.emptyEvent=null;this.schoolCentroid=null;this.interaction=null;this.splitEvent=null;this.majorCooldown=0;this.nextInteraction=0;this.schoolCount=0;this.schoolSequence=0;
  this.samples=0;this.quietSamples=0;this.majorSamples=0;this.brightSamples=0;this.fishCountSamples=0;this.fishCountSum=0;
  this.eventRandom=seededRandom(mix(this.seed,0));this.schoolRandom=seededRandom(mix(this.seed,100));
  const countRandom=seededRandom(mix(this.seed,1)),count=config.squid.countMin+Math.floor(countRandom()*(config.squid.countMax-config.squid.countMin+1));
  for(let i=0;i<count;i++){
   const random=seededRandom(mix(this.seed,10+i)),scale=between(random,config.squid.mantleLengthMetres);
   const s=Object.assign(this.body(i,scale,scale*(config.squid.safeRadiusMantleUnits+config.squid.wallMarginBodyLengths),10),{nextTarget:between(random,[8,18]),nextJet:between(random,[20,55]),jetStart:-10,restState:'IDLE_HOVER' as SquidState,stateUntil:between(random,[12,22]),cruise:between(random,config.squid.speedBLPerSecond)});
   s.p.set(i===0?-.35:between(random,[.15,.35]),between(random,[.80,.94]),i===0?-2.8:between(random,[-3.8,-3.2]));this.constrain(s);s.target.copy(s.p).add(new THREE.Vector3(.3,.05,-.15));this.clampTarget(s);s.yaw=i===0?1.25:-1.3;s.pitch=.03;s.state='IDLE_HOVER';s.visible=true;this.setRotation(s);s.position.copy(s.p);s.previous.copy(s.p);s.quaternion.copy(s.q);s.previousQ.copy(s.q);this.squids.push(s);
  }
  for(let i=0;i<config.fish.maxCount;i++){
   const random=seededRandom(mix(this.seed,200+i)),scale=between(random,config.fish.bodyLengthMetres);
   const f=Object.assign(this.body(i,scale,scale*(config.fish.safeRadiusBodyUnits+config.fish.wallMarginBodyLengths),200),{route:new THREE.CubicBezierCurve3(),travelDuration:1,holdSeconds:0,routeMode:'MEANDER' as FishRouteMode,start:new THREE.Vector3(),control:new THREE.Vector3(),finish:new THREE.Vector3(),launch:0,duration:1,launched:false,finished:true,cruise:between(random,config.fish.speedBLPerSecond)});
   f.p.set(0,1.4,-4);this.constrain(f);f.position.copy(f.p);f.previous.copy(f.p);this.fish.push(f);
  }
  this.nextFish=between(this.eventRandom,config.scheduler.firstFishSeconds);this.nextApproach=between(this.eventRandom,config.scheduler.approachIntervalSeconds);this.nextCross=between(this.eventRandom,config.scheduler.crossIntervalSeconds);this.nextEmpty=between(this.eventRandom,config.scheduler.emptyIntervalSeconds);
 }
 rewind(){this.reset();}
 update(elapsed:number){
  const target=Math.max(0,Number.isFinite(elapsed)?elapsed:0);if(target+1e-9<this.lastElapsed)this.reset();
  const ticks=Math.floor(target/STEP+1e-8);while(this.tick<ticks)this.step();
  this.alpha=clamp((target-this.time)/STEP,0,1);this.lastElapsed=target;
  for(const a of [...this.squids,...this.fish]){a.position.lerpVectors(a.previous,a.p,this.alpha);a.quaternion.slerpQuaternions(a.previousQ,a.q,this.alpha);}
 }
 sampleLight(p:THREE.Vector3){
  const dx=p.x-this.options.windowX,dy=p.y-this.options.windowY,dz=p.z+11.5;if(dz<=0)return 0;
  const d2=dx*dx+dy*dy+dz*dz,facing=dz/Math.sqrt(d2),aperture=Math.min(this.options.windowWidth/2,this.options.width/2-.24);
  // Restrained lateral penumbra lets an opaque silver body pass into side shadow.
  const edge=Math.min(1-smooth(Math.abs(dx),aperture*.73,this.options.width/2-.20),1-smooth(Math.abs(p.x),aperture*.73,this.options.width/2-.20));
  const vertical=1-smooth(Math.abs(dy),this.options.windowHeight*.6,this.options.height*.62);
  return clamp(facing*edge*vertical/(1+config.light.distanceFalloff*d2),0,1);
 }
 private startEvent(type:BioEventType,duration:number,extra:Partial<AntarcticEvent>={}){
  const event:AntarcticEvent={type,start:this.time,end:this.time+duration,duration,lightPeak:0,state:'ACTIVE',...extra};this.events.push(event);return event;
 }
 private finishEvent(event:AntarcticEvent){event.end=this.time;event.duration=this.time-event.start;event.state='DONE';this.eventLog.push({...event});const index=this.events.indexOf(event);if(index>=0)this.events.splice(index,1);}
 private schedule(){
  if(this.emptyEvent&&this.time>=this.emptyEvent.end!){this.finishEvent(this.emptyEvent);this.emptyEvent=null;}
  if(this.activeSquid&&this.time>=this.activeSquid.end!){const event=this.activeSquid;this.finishEvent(event);if(event.type==='SQUID_CROSS_CORRIDOR')this.majorCooldown=this.time+between(this.eventRandom,config.scheduler.majorCooldownSeconds);this.activeSquid=null;}
  if(this.activeFish&&this.fish.slice(0,this.schoolCount).every(f=>f.finished)){
   this.finishEvent(this.activeFish);if(this.splitEvent){this.finishEvent(this.splitEvent);this.splitEvent=null;}if(this.interaction){this.finishEvent(this.interaction);this.interaction=null;}this.activeFish=null;this.schoolCentroid=null;
   this.majorCooldown=this.time+between(this.eventRandom,config.scheduler.majorCooldownSeconds);this.nextFish=this.time+logInterval(this.eventRandom,config.scheduler.fishIntervalSeconds);
  }
  if(this.emptyEvent)return;
  if(!this.activeFish&&!this.activeSquid&&this.time>=this.nextEmpty){
   this.emptyEvent=this.startEvent('LONG_EMPTY_PHASE',between(this.eventRandom,config.scheduler.emptyPhaseSeconds));this.nextEmpty=this.emptyEvent.end!+logInterval(this.eventRandom,config.scheduler.emptyIntervalSeconds);
   for(const s of this.squids){s.state='IDLE_HOVER';s.stateUntil=this.emptyEvent.end!;s.target.set(s.p.x,s.p.y,Math.max(s.p.z,-3.5));this.clampTarget(s);}return;
  }
  if(!this.activeFish&&!this.activeSquid&&this.time>=this.majorCooldown&&this.time>=this.nextFish){this.launchSchool();return;}
  if(this.squids.length&&!this.activeFish&&!this.activeSquid&&this.time>=this.majorCooldown&&this.time>=this.nextCross){
   const i=Math.floor(this.eventRandom()*this.squids.length),s=this.squids[i],duration=between(this.eventRandom,[18,28]);
   this.activeSquid=this.startEvent('SQUID_CROSS_CORRIDOR',duration,{agent:i});s.target.set(-Math.sign(s.p.x||1)*.38,s.p.y+.05,clamp(s.p.z,-3.7,-2.6));this.clampTarget(s);s.state='GENTLE_TURN';s.stateUntil=this.activeSquid.end!;s.nextTarget=s.stateUntil;
   this.nextCross=this.activeSquid.end!+logInterval(this.eventRandom,config.scheduler.crossIntervalSeconds);return;
  }
  if(this.squids.length&&!this.activeFish&&!this.activeSquid&&this.time>=this.nextApproach){
   const candidates=this.squids.map((s,i)=>({i,d:Math.abs(s.p.z+8.8)})).sort((a,b)=>a.d-b.d),i=candidates[0].i,s=this.squids[i];
   this.activeSquid=this.startEvent('SQUID_APPROACH_LIGHT',between(this.eventRandom,[14,25]),{agent:i});s.target.set(between(this.eventRandom,[-.28,.28]),clamp(s.p.y,.80,.94),Math.max(-3.8,s.p.z-.5));this.clampTarget(s);s.state='SLOW_CRUISE';s.stateUntil=this.activeSquid.end!;s.nextTarget=s.stateUntil;
   this.nextApproach=this.activeSquid.end!+logInterval(this.eventRandom,config.scheduler.approachIntervalSeconds);
  }
 }
 private launchSchool(){
  const main=this.eventRandom()<config.scheduler.largeSchoolProbability,limits=main?config.fish.mainTransitCount:config.fish.transitCount;
  this.schoolCount=Math.floor(between(this.eventRandom,[limits[0],limits[1]+1]));const routeSeed=Math.floor(this.schoolRandom()*4294967296),random=seededRandom(routeSeed),side=random()<.5?-1:1;
  const modes:FishRouteMode[]=['CIRCLE','MID_HOVER','MEANDER'],routeMode=modes[(this.schoolSequence++ + this.seed%3+1)%modes.length];
  const centerY=between(random,[1.25,1.85]),centerZ=between(random,[-5.8,-4.4]);
  const entryHeight=between(random,[.95,2.2]),exitHeight=between(random,[1.0,2.2]),holdSeconds=routeMode==='MID_HOVER'?between(random,config.fish.lingerSeconds):0;
  const rear=this.camera.clone().addScaledVector(this.cameraForward,-1.6);let end=this.time;
  for(let i=0;i<this.schoolCount;i++){
   const f=this.fish[i],lane=Math.min(.76,this.options.width/2-f.radius-.32),offsetX=between(random,[-.12,.12]),offsetY=between(random,[-.17,.17]),offsetZ=between(random,[-.16,.16]);
   f.start.set(side*lane,entryHeight+offsetY,rear.z+between(random,[0,.2]));f.finish.set(-side*lane,exitHeight+offsetY,rear.z+between(random,[0,.2]));
   const bounds=this.marginBounds(f);f.start.clamp(bounds.min,bounds.max);f.finish.clamp(bounds.min,bounds.max);
   const point=(x:number,y:number,z:number)=>new THREE.Vector3(x+offsetX,y+offsetY,z+offsetZ).clamp(bounds.min,bounds.max);
   const points=[f.start.clone(),point(side*lane,centerY,-2.4)];
   if(routeMode==='CIRCLE'){
    // One broad, level orbit in real corridor space; clockwise/counterclockwise
    // follows the entry lane. A small Y drift keeps the school from a flat ring.
    for(let k=0;k<=12;k++){const angle=k/12*Math.PI*2;points.push(point(side*.62*Math.cos(angle),centerY+.10*Math.sin(angle),centerZ-.95*Math.sin(angle)));}
   }else if(routeMode==='MID_HOVER'){
    points.push(point(side*.38,centerY,centerZ+.6),point(0,centerY,centerZ),point(-side*.38,centerY,centerZ+.6));
   }else{
    points.push(point(side*.35,centerY+.18,-4.5),point(-side*.50,centerY,-7.5),point(-side*.68,centerY-.15,-4.0));
   }
   points.push(point(-side*lane,exitHeight,-2.4),f.finish.clone());
   f.route=new THREE.CatmullRomCurve3(points,false,'centripetal');f.control.copy(points[Math.floor(points.length/2)]);f.routeMode=routeMode;f.holdSeconds=holdSeconds;
   f.cruise=config.fish.schoolSpeedMetresPerSecond/f.scale;f.travelDuration=f.route.getLength()/config.fish.schoolSpeedMetresPerSecond;
   f.launch=this.time+i*config.fish.launchStaggerSeconds+between(random,[0,.15]);f.duration=f.travelDuration+holdSeconds;f.p.copy(f.start);f.target.copy(f.start);this.constrain(f);f.previous.copy(f.p);f.position.copy(f.p);
   f.velocity.copy(f.route.getTangentAt(0)).multiplyScalar(f.scale*f.cruise);f.yaw=Math.atan2(f.velocity.x,f.velocity.z);f.pitch=0;this.setRotation(f);f.previousQ.copy(f.q);f.quaternion.copy(f.q);f.visible=false;f.launched=false;f.finished=false;f.state='DORMANT';f.avoidance.set(0,0,0);end=Math.max(end,f.launch+f.duration);
  }
  this.activeFish=this.startEvent(main?'SILVERFISH_MAIN_TRANSIT':'SILVERFISH_SMALL_TRANSIT',end-this.time,{count:this.schoolCount,routeSeed,routeMode,entrySide:side,entryHeight,routeCenter:[0,centerY,centerZ]});
 }
 private step(){
  this.tick++;this.time=this.tick*STEP;
  for(const a of [...this.squids,...this.fish]){a.previous.copy(a.p);a.previousQ.copy(a.q);}
  this.schedule();this.stepSquids();this.stepFish();
  this.samples++;const visibleFish=this.fish.filter(f=>f.visible&&this.sampleLight(f.p)>.1).length;
  const subtleApproach=this.squids.some(s=>this.sampleLight(s.p)>.60&&s.speedBL>.1);
  if(!visibleFish&&!subtleApproach&&!this.activeSquid)this.quietSamples++;if(this.activeFish||this.activeSquid?.type==='SQUID_CROSS_CORRIDOR')this.majorSamples++;
  this.brightSamples+=this.squids.filter(s=>this.sampleLight(s.p)>.78).length;
  if(visibleFish){this.fishCountSamples++;this.fishCountSum+=visibleFish;}
 }
 private stepSquids(){
  for(const [i,s] of this.squids.entries()){
   const directed=this.activeSquid?.agent===i;
   if(!directed&&!this.emptyEvent&&this.time>=s.nextTarget){
    const z=between(s.random,[-3.8,-2.6]);
    s.target.set(between(s.random,[-.4,.4]),between(s.random,[.80,.94]),z);this.clampTarget(s);s.nextTarget=this.time+between(s.random,[18,40]);
    const choice=s.random();s.state=choice<.25?'IDLE_HOVER':choice<.50?'GENTLE_TURN':choice<.65?'DEPTH_ADJUST':'SLOW_CRUISE';s.stateUntil=s.nextTarget;
   }
   if(s.state==='MICRO_JET_REPOSITION'&&this.time-s.jetStart>.5)s.state=s.restState;
   if(!this.emptyEvent&&!directed&&this.time>=s.nextJet){
    s.restState=s.state as SquidState;s.state='MICRO_JET_REPOSITION';
    s.jetStart=this.time;s.nextJet=this.time+config.squid.jetMinimumSeconds-Math.log(Math.max(1e-8,1-s.random()))/config.squid.jetHazardPerSecond;
    this.eventLog.push({type:'MICRO_JET_REPOSITION',start:this.time,duration:.45,end:this.time+.45,state:'DONE',lightPeak:this.sampleLight(s.p),agent:i});
   }
   const pulse=Math.exp(-.5*((this.time-s.jetStart-.18)/.09)**2),goal=s.target.clone().sub(s.p);s.avoidance.set(0,0,0);
   this.wallForce(s,goal);this.cameraForce(s,goal);
   if(this.schoolCentroid){const glance=this.schoolCentroid.clone().sub(s.p).normalize().multiplyScalar(.03);goal.add(glance);}
   this.heading(s,goal,config.squid.yawMaxDegreesPerSecond,config.squid.pitchMaxDegreesPerSecond);
   const state=s.state==='IDLE_HOVER'?.035:s.state==='DEPTH_ADJUST'?.06:s.cruise,near=clamp(s.p.distanceTo(s.target)/.3,.18,1),speed=s.scale*(state*near+pulse*.19);
   const desired=FORWARD.clone().applyQuaternion(s.q).multiplyScalar(speed);s.velocity.lerp(desired,1-Math.exp(-STEP/config.squid.speedResponseSeconds));this.move(s);
   s.speedBL=s.velocity.length()/s.scale;s.visible=true;
   if(directed)this.activeSquid!.lightPeak=Math.max(this.activeSquid!.lightPeak,this.sampleLight(s.p));
  }
 }
 private curve(f:Fish,t:number){return f.route.getPointAt(t);}
 isBehindCamera(position:THREE.Vector3,radius:number){return position.clone().sub(this.camera).dot(this.cameraForward)<-radius-.25;}
 private stepFish(){
  if(!this.activeFish)return;
  const agents=this.fish.slice(0,this.schoolCount),positions=agents.map(f=>f.p.clone()),velocities=agents.map(f=>f.velocity.clone());
  for(const [i,f] of agents.entries()){
   if(f.finished||this.time<f.launch)continue;f.launched=true;f.state='TRANSIT';f.visible=true;
   const age=this.time-f.launch,holdStart=f.travelDuration*.5,held=clamp(age-holdStart,0,f.holdSeconds),holding=f.holdSeconds>0&&age>=holdStart&&age<holdStart+f.holdSeconds;
   const progress=clamp((age-held)/f.travelDuration,0,1),route=this.curve(f,progress),tangent=f.route.getTangentAt(progress).multiplyScalar(holding?0:f.scale*f.cruise);
   if(holding)route.add(new THREE.Vector3(Math.sin(this.time*.18+f.phase)*.035,Math.sin(this.time*.23+f.phase)*.025,Math.cos(this.time*.18+f.phase)*.035));
   const remaining=f.finish.clone().sub(f.p),flow=remaining.length()<.22?remaining.clone().multiplyScalar(2.8):tangent;
   f.target.copy(route);const force=route.clone().sub(f.p).multiplyScalar(config.fish.routeGain).add(flow),alignment=new THREE.Vector3(),cohesion=new THREE.Vector3(),separation=new THREE.Vector3();let alignWeight=0,cohereWeight=0;
   for(const [j,other] of agents.entries()){
    if(i===j||!other.launched||other.finished)continue;const away=positions[i].clone().sub(positions[j]),d=away.length();
    const sep=f.scale*config.fish.separationBL;if(d>1e-6)separation.addScaledVector(away,Math.exp(-((d/sep)**2))/(d*d+.004)*.025);
    const wa=Math.exp(-((d/(f.scale*config.fish.alignmentBL))**2)),wc=Math.exp(-((d/(f.scale*config.fish.cohesionBL))**2));alignment.addScaledVector(velocities[j],wa);alignWeight+=wa;cohesion.addScaledVector(positions[j],wc);cohereWeight+=wc;
   }
   const release=1-smooth(progress,.72,.96),light=this.sampleLight(f.p);
   if(alignWeight)force.addScaledVector(alignment.multiplyScalar(1/alignWeight).sub(f.velocity),config.fish.weights.alignment*release);
   if(cohereWeight)force.addScaledVector(cohesion.multiplyScalar(1/cohereWeight).sub(f.p),config.fish.weights.cohesion*(1+.16*light)*release);
   force.addScaledVector(separation,config.fish.weights.separation*release);
   force.y+=Math.sin(this.time*.37+f.phase)*config.fish.weights.noise*release;
   f.avoidance.set(0,0,0);
   for(const s of this.squids){
    const away=f.p.clone().sub(s.p),d=away.length(),outer=Math.max(f.scale*3,s.scale*.9),gate=1-smooth(d,f.scale,outer);
    if(gate<=0||d<1e-6)continue;
    const avoid=away.multiplyScalar(gate*config.fish.weights.avoidance/d);avoid.z+=Math.sign(f.control.z-s.p.z||i%2-.5)*gate*.045;f.avoidance.add(avoid);force.add(avoid);
    if(gate>.55&&this.interaction&&!this.splitEvent)this.splitEvent=this.startEvent('SILVERFISH_SPLIT_AROUND_SQUID',Math.max(0,this.activeFish.end!-this.time),{routeSeed:this.activeFish.routeSeed,lightPeak:light});
    if(gate>.15&&!this.interaction&&this.time>=this.nextInteraction){this.interaction=this.startEvent('SQUID_SILVERFISH_NEAR_PASS',this.activeFish.end!-this.time,{routeSeed:this.activeFish.routeSeed});this.nextInteraction=this.time+config.scheduler.interactionCooldownSeconds;}
   }
   if(this.interaction)this.interaction.lightPeak=Math.max(this.interaction.lightPeak,light);if(this.splitEvent)this.splitEvent.lightPeak=Math.max(this.splitEvent.lightPeak,light);
   this.wallForce(f,force);this.cameraForce(f,force);force.clampLength(0,f.scale*config.fish.maxSpeedBL);
   f.velocity.lerp(force,1-Math.exp(-STEP/config.fish.speedResponseSeconds));this.move(f);this.heading(f,f.velocity,config.fish.yawMaxDegreesPerSecond,30);f.speedBL=f.velocity.length()/f.scale;
   this.activeFish.lightPeak=Math.max(this.activeFish.lightPeak,light);
   // Recycle only after the whole body has passed behind the camera.
   // Darkness and proximity to a wall never trigger disappearance.
   if(progress>=1&&remaining.length()<.085&&this.isBehindCamera(f.p,f.radius)&&this.isBehindCamera(f.previous,f.radius)){f.finished=true;f.visible=false;f.state='DORMANT';f.velocity.set(0,0,0);f.speedBL=0;}
  }
  const visible=agents.filter(f=>f.visible);this.schoolCentroid=visible.length?visible.reduce((p,f)=>p.add(f.p),new THREE.Vector3()).multiplyScalar(1/visible.length):null;
 }
 private marginBounds(a:Body){const min=this.navBounds.min.clone(),max=this.navBounds.max.clone();if(!('route' in a)){min.z=config.squid.foregroundBounds.minZ;max.z=config.squid.foregroundBounds.maxZ;max.y=config.squid.foregroundBounds.maxY;}return {min:min.addScalar(a.radius),max:max.addScalar(-a.radius)};}
 private clampTarget(a:Body){const b=this.marginBounds(a);a.target.clamp(b.min,b.max);}
 private wallForce(a:Body,force:THREE.Vector3){const b=this.marginBounds(a);for(const axis of ['x','y','z'] as const){const buffer=a.state==='TRANSIT'?.045:.20;force[axis]+=Math.max(0,b.min[axis]+buffer-a.p[axis])*config.navigation.wallGain;force[axis]-=Math.max(0,a.p[axis]-(b.max[axis]-buffer))*config.navigation.wallGain;}}
 private cameraForce(a:Body,force:THREE.Vector3){const away=a.p.clone().sub(this.camera),d=away.length(),r=a.radius+config.navigation.cameraMargin;if(d<r+.3&&d>1e-6)force.addScaledVector(away,(r+.3-d)*1.2/d);}
 private move(a:Body){
  const delta=a.velocity.clone().multiplyScalar(STEP),relative=a.p.clone().sub(this.camera),radius=a.radius+config.navigation.cameraMargin;
  const aa=delta.lengthSq(),bb=2*relative.dot(delta),cc=relative.lengthSq()-radius*radius,discriminant=bb*bb-4*aa*cc;
  // Swept camera-sphere collision: stop at contact and retain tangential velocity.
  // Never repair an in-frame collision by teleporting to the sphere's surface.
  if(aa>1e-16&&bb<0&&discriminant>=0){
   const hit=(-bb-Math.sqrt(discriminant))/(2*aa);
   if(hit>=-1e-6&&hit<=1){a.p.addScaledVector(delta,Math.max(0,hit-1e-5));const normal=a.p.clone().sub(this.camera).normalize();a.velocity.addScaledVector(normal,-Math.min(0,a.velocity.dot(normal)));a.p.addScaledVector(a.velocity,STEP*(1-Math.max(0,hit)));this.constrain(a);return;}
  }
  a.p.add(delta);this.constrain(a);
 }
 private constrain(a:Body){
  const b=this.marginBounds(a);a.p.clamp(b.min,b.max);
  const radius=a.radius+config.navigation.cameraMargin,away=a.p.clone().sub(this.camera);
  if(away.length()<radius){if(away.lengthSq()<1e-8)away.set(0,0,-1);a.p.copy(this.camera).addScaledVector(away.normalize(),radius).clamp(b.min,b.max);
   // A camera can be moved inside the studio's nav volume. Resolve along Z if
   // a radial projection would be clipped back into its exclusion sphere.
   if(a.p.distanceTo(this.camera)<radius){const z=this.camera.z-radius>=b.min.z?this.camera.z-radius:this.camera.z+radius;a.p.z=clamp(z,b.min.z,b.max.z);}
  }
 }
 private setRotation(a:Body){a.q.setFromEuler(new THREE.Euler(-a.pitch,a.yaw,0,'YXZ'));}
 private heading(a:Body,direction:THREE.Vector3,yawDegrees:number,pitchDegrees:number){
  if(direction.lengthSq()<1e-10)return;const yaw=Math.atan2(direction.x,direction.z),pitch=Math.atan2(direction.y,Math.hypot(direction.x,direction.z)),error=wrap(yaw-a.yaw);
  const rate=clamp(error/1.8,-THREE.MathUtils.degToRad(yawDegrees),THREE.MathUtils.degToRad(yawDegrees));a.yaw=wrap(a.yaw+rate*STEP);a.pitch+=clamp((pitch-a.pitch)/2.1,-THREE.MathUtils.degToRad(pitchDegrees),THREE.MathUtils.degToRad(pitchDegrees))*STEP;a.turn=rate;this.setRotation(a);
 }
 getMetrics(){
  const active=[...this.squids,...this.fish.filter(f=>f.visible)];let spacing=Infinity;for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)spacing=Math.min(spacing,active[i].position.distanceTo(active[j].position));
  return {time:this.time,events:this.eventLog.filter(e=>e.type!=='MICRO_JET_REPOSITION').length,empty:!!this.emptyEvent,visibleSquids:this.squids.filter(s=>this.sampleLight(s.position)>.15).length,visibleFish:this.fish.filter(f=>f.visible).length,minSpacing:Number.isFinite(spacing)?spacing:null,maxSpeedBL:Math.max(0,...active.map(a=>a.speedBL)),quietRatio:this.samples?this.quietSamples/this.samples:1,majorRatio:this.samples?this.majorSamples/this.samples:0,brightSquidOccupancy:this.samples&&this.squids.length?this.brightSamples/(this.samples*this.squids.length):0,meanVisibleSchoolSize:this.fishCountSamples?this.fishCountSum/this.fishCountSamples:0,bounds:this.navBounds};
 }
 getDebug(){return {time:this.time,centroid:this.schoolCentroid,activeEvent:this.activeFish??this.activeSquid??this.emptyEvent,nav:this.navBounds,squidTargets:this.squids.map(s=>s.target),squidStates:this.squids.map(s=>s.state)};}
 snapshot(){return {time:this.time,interpolation:this.alpha,metrics:this.getMetrics(),events:this.eventLog,activeEvents:this.events,squids:this.squids.map(s=>({position:s.position.toArray(),state:s.state,speedBL:s.speedBL})),fish:this.fish.filter(f=>f.visible).map(f=>({position:f.position.toArray(),speedBL:f.speedBL}))};}
}
