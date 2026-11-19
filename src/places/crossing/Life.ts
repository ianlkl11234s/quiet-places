import * as THREE from 'three';
import {seededRandom} from '../../shared/math/seededRandom.ts';
import {headingQuaternion,stepHeading,tailBeatFrequency,type HeadingParams,type TailBeatParams} from '../../shared/biology/locomotion/index.ts';
import {commitSardineMatrices,createSardineVisuals,setSardineEnvironment,setSardineMatrix,setSardineMotion} from '../../creatures/sardine/index.ts';
import {createWhaleSharkModel} from '../../creatures/whale-shark/index.ts';
import {burstCoastSpeed,burstCoastTail,createPointerState,insertNearest,notePointer,pointerWeight,rayDistance,resolveSchoolCandidates,POINTER_TAP_COOLDOWN,type BurstCoastParams} from '../../systems/schooling/candidates.ts';
import {CHAIRS,DECK,POCKET,POST_Z,RAIL,ROOF,STAIR,VIEWS} from './Layout.ts';

/**
 * Crossing life: the scene's one impossible thing. Two sardine schools (Sardinella look: no flank spots,
 * yellowish fins, 10-20 cm) swim through the air of the stern deck, between the posts, over the chair backs
 * and out through the openings (open side above the 1.0 m gunwale, stern opening, past the bow end behind the
 * camera) and back; a big and a small whale shark cruise slowly through the air far off the open side and astern
 * (22-45 m out, 2-4.5 m up, above the 1.0 m gunwale line of sight), turning along a long closed loop that crosses station a's
 * view and swings round to station c, heading always along their path. Boids + roaming goals, fixed 12 Hz step driven only by `elapsed` (seeded,
 * reproducible, pause-safe). Speeds and timing are art calibration. Units: m, s; website Y-up.
 */

/** Pointer awareness of the sardines, 0..1; 0 = off. */
export const CROSSING_SARDINE_POINTER_RESPONSE=.5;
/**
 * Whale shark loop, in polar form about the ship centre: bearing (degrees from +X toward -Z) swings -20..104 (station a sees about
 * -20..64, station c 36..109), centre distance 23-45 m, one lap about 2 min. Heights are art calibration for the 1.0 m gunwale and
 * the 2.25 m roof edge: both stations look out through the opening, so the sharks fly 2-4.5 m up, a few degrees above the horizon.
 */
const SHIP_CENTRE=[(DECK.xMin+DECK.xMax)/2,(DECK.zMin+DECK.zMax)/2] as const;
const SHARK_LOOP={bearing:42,distance:36,along:25,across:13,squareness:2.4,height:{centre:3.4,swing:1.0,second:.3},period:120,speedWave:{amount:.18,period:41},wavelength:2.4};
export const CROSSING_WHALE_SHARK_LENGTHS=[6.5,4.0] as const;
export interface CrossingSharkTrack {p:[number,number,number];v:[number,number,number];speed:number;yaw:number;yawRate:number;pitch:number;roll:number;}
const D2R=Math.PI/180;
const wrapAngle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
/** Closed ground track (u 0..1 once round): a rounded rectangle (superellipse) in polar coordinates about the ship centre, `along` m of sweep each way and `across` m in and out. Tabulated by arc length so speed is set directly. */
const LOOP_N=8192;let loopTable:{x:Float64Array;z:Float64Array;length:number}|null=null;
const rounded=(c:number,n:number)=>Math.sign(c)*Math.abs(c)**(2/n);
function loopAt(u:number,out:number[]){
 const L=SHARK_LOOP,f=Math.PI*2*u;
 const th=(L.bearing)*D2R+rounded(Math.cos(f),L.squareness)*L.along/L.distance,r=L.distance+rounded(Math.sin(f),L.squareness)*L.across;
 out[0]=SHIP_CENTRE[0]+r*Math.cos(th);out[2]=SHIP_CENTRE[1]-r*Math.sin(th);return out;
}
function loop(){
 if(loopTable)return loopTable;
 const x=new Float64Array(LOOP_N+1),z=new Float64Array(LOOP_N+1),tmp=[0,0,0],fx=new Float64Array(4*LOOP_N+1),fz=new Float64Array(4*LOOP_N+1);
 for(let i=0;i<=4*LOOP_N;i++){loopAt(i/(4*LOOP_N),tmp);fx[i]=tmp[0];fz[i]=tmp[2];}
 let len=0;const fs=new Float64Array(4*LOOP_N+1);
 for(let i=1;i<=4*LOOP_N;i++){len+=Math.hypot(fx[i]-fx[i-1],fz[i]-fz[i-1]);fs[i]=len;}
 // resample at equal arc length
 let j=0;for(let k=0;k<=LOOP_N;k++){const target=len*k/LOOP_N;while(j<4*LOOP_N-1&&fs[j+1]<target)j++;const w=(target-fs[j])/Math.max(fs[j+1]-fs[j],1e-12);x[k]=fx[j]+(fx[j+1]-fx[j])*w;z[k]=fz[j]+(fz[j+1]-fz[j])*w;}
 return loopTable={x,z,length:len};
}
/** Distance swum by the big shark at time t: constant mean speed with a slow +-18 % swell, one lap in about `period` s. */
function swum(t:number){
 const {length}=loop(),{amount,period}=SHARK_LOOP.speedWave,v0=length/SHARK_LOOP.period,k=Math.PI*2/period;
 return v0*(t+amount*(Math.cos(.7)-Math.cos(k*t+.7))/k);
}
function onLoop(s:number,out:number[]){
 const {x,z,length}=loop(),q=((s/length)%1+1)%1*LOOP_N,i=Math.min(Math.floor(q),LOOP_N-1),w=q-i;
 out[0]=x[i]+(x[i+1]-x[i])*w;out[2]=z[i]+(z[i+1]-z[i])*w;return out;
}
const bigHeight=(t:number)=>SHARK_LOOP.height.centre+SHARK_LOOP.height.swing*Math.sin(.061*t+1.1)+SHARK_LOOP.height.second*Math.sin(.137*t+.4);
const scratchRad=[0,0,0];
/** Position of shark 0 (big) or 1 (small: the big one's track 9.5-16.5 m behind along the loop, 3.5 m inboard to 2.5 m outboard, a little lower; it drops back and closes up). */
function sharkPosition(index:number,t:number,out:number[]){
 if(index===0){onLoop(swum(t),out);out[1]=bigHeight(t);return out;}
 const gap=13+3.5*Math.sin(.045*t+.9),off=-.5+3*Math.sin(.061*t+1.3);
 onLoop(swum(t)-gap,out);
 const dx=out[0]-SHIP_CENTRE[0],dz=out[2]-SHIP_CENTRE[1],d=Math.hypot(dx,dz)||1;scratchRad[0]=dx/d;scratchRad[2]=dz/d;
 out[0]+=scratchRad[0]*off;out[2]+=scratchRad[2]*off;out[1]=bigHeight(t)-.4+.5*Math.sin(.09*t+2.2);return out;
}
const pa=[0,0,0],pb=[0,0,0];
function sharkVelocity(index:number,t:number,out:[number,number,number]){
 const h=.2;sharkPosition(index,t+h,pa);sharkPosition(index,t-h,pb);
 out[0]=(pa[0]-pb[0])/(2*h);out[1]=(pa[1]-pb[1])/(2*h);out[2]=(pa[2]-pb[2])/(2*h);return out;
}
const MAX_BANK=12*D2R,MAX_PITCH=8*D2R;
/** Analytic track and pose of a crossing whale shark at time t (s), no state: yaw follows the path tangent (local +Z is the mouth), bank from yaw rate, pitch from vertical speed. */
export function crossingWhaleSharkTrack(index:0|1,t:number):CrossingSharkTrack{
 const p:[number,number,number]=[0,0,0],v:[number,number,number]=[0,0,0],v1:[number,number,number]=[0,0,0],v2:[number,number,number]=[0,0,0];
 sharkPosition(index,t,p);sharkVelocity(index,t,v);
 const horizontal=Math.hypot(v[0],v[2]),yaw=Math.atan2(v[0],v[2]),g=.4;
 sharkVelocity(index,t+g,v1);sharkVelocity(index,t-g,v2);
 const yawRate=wrapAngle(Math.atan2(v1[0],v1[2])-Math.atan2(v2[0],v2[2]))/(2*g);
 return {p,v,speed:Math.hypot(v[0],v[1],v[2]),yaw,yawRate,pitch:THREE.MathUtils.clamp(Math.atan2(v[1],Math.max(horizontal,.2)),-MAX_PITCH,MAX_PITCH),
  roll:-THREE.MathUtils.clamp(yawRate*1.0,-MAX_BANK,MAX_BANK)};
}
export const CROSSING_FISH_BOUNDS={min:new THREE.Vector3(-1.9,.45,-9),max:new THREE.Vector3(9,1.95,8)};
export const CROSSING_FISH_COUNT=210;

type Box={min:[number,number,number];max:[number,number,number]};
interface Fish {p:THREE.Vector3;previous:THREE.Vector3;v:THREE.Vector3;heading:THREE.Vector3;yaw:number;pitch:number;bank:number;bend:number;previousBend:number;
 orientation:THREE.Quaternion;previousOrientation:THREE.Quaternion;length:number;phase:number;previousPhase:number;speedBL:number;previousSpeedBL:number;
 wander:number;school:number;gain:number;yBias:number;bc:number;bcRate:number;tail:number;previousTail:number;}
interface School {goal:THREE.Vector3;centroid:THREE.Vector3;velocity:THREE.Vector3;route:THREE.Vector3[]|null;routeIndex:number;lastRoute:number;roamLeft:number;goalUntil:number;
 nextDash:number;dashUntil:number;startleUntil:number;startle:THREE.Vector3|null;}
export interface CrossingLifeOptions {seed?:number;count?:number;sun?:{value:THREE.Vector3};pointerResponse?:number;burstCoast?:boolean;topologicalNeighbours?:number;flashBank?:number;}
export interface CrossingLife {group:THREE.Group;update(dt:number,elapsed:number,state:{hour?:number;intensity:number}):void;pointerRay(ray:THREE.Ray|undefined,tap:boolean):void;
 /** Optional sky reflection for the silver sardine flanks (no environment leaves them dark). */
 setEnvironment(texture:THREE.Texture|null,intensity:number):void;
 getDebug():CrossingLifeDebug;dispose():void;}
export interface CrossingLifeDebug {time:number;penetrations:number;startles:number;fish:{p:number[];speed:number;length:number}[];sharks:{p:number[];length:number;pitch:number;yaw:number;roll:number;speed:number;frequency:number}[];}

const STEP=1/12,DEG=Math.PI/180,FORWARD=new THREE.Vector3(0,0,-1);
const HEADING:HeadingParams={maxYawRate:110*DEG,yawTau:.35,maxPitch:25*DEG,maxPitchRate:40*DEG,pitchTau:.5,holdSpeed:0,trackSpeed:0,maxBank:8*DEG,maxBend:.06,yawRateScale:60*DEG,bankTau:.25};
const TAIL:TailBeatParams={f0:.8,k:.7,maxFrequency:6};
const BURST_COAST:BurstCoastParams={periodMin:1,periodMax:1.8,burstFraction:.4,burstGain:.3,coastTail:.12};
const CRUISE_BL=3.5,DASH_GAIN=2.2,STARTLE_GAIN=2,TAP_STARTLE_S=2.2;
const POINTER_RADIUS_BL=4,POINTER_GAIN=2.4;
/** Hard keep-out radius around each station camera and the soft radius (1.2 m clear in front is the goal) that keeps fish from lingering by it. */
const CAMERA_HARD=.6,CAMERA_SOFT=2;
const CAMERAS=[VIEWS.a.position,VIEWS.b.position,VIEWS.c.position].map(p=>new THREE.Vector3(p[0],p[1],p[2]));

/**
 * Fish-only collision proxies (no visible geometry): gunwales below the 1.0 m rim, posts, cabin block, west wall,
 * the stair-opening rail, and one box per chair (backs ~1.1 m). Fish pass above the rim and the chair backs, and
 * between the posts. The roof and the deck are enforced by the y band of CROSSING_FISH_BOUNDS.
 */
export function crossingFishObstacles():Box[]{
 const {xMin,xMax,zMin,zMax}=DECK,under=ROOF.underY,boxes:Box[]=[];
 boxes.push({min:[xMax-RAIL.t,-2,zMin-RAIL.t],max:[xMax,RAIL.h,zMax]});          // open-side gunwale
 boxes.push({min:[0,-2,zMin-RAIL.t],max:[xMax,RAIL.h,zMin]});                    // stern gunwale (opening x 0..xMax)
 for(const z of POST_Z)boxes.push({min:[xMax-.07,RAIL.h,z-.03],max:[xMax-.015,under,z+.03]});
 boxes.push({min:[0,RAIL.h,zMin-.07],max:[.07,under,zMin]});                     // stern corner post
 boxes.push({min:[xMin,-2,zMin-RAIL.t],max:[0,under,POCKET.pocketFrontZ]});       // cabin block (bulkhead, door, front wall)
 boxes.push({min:[xMin-.15,-2,POCKET.pocketFrontZ-.15],max:[xMin,under,zMax]});   // west wall
 boxes.push({min:[STAIR.xMin,0,STAIR.zMin],max:[STAIR.xMax,1.1,STAIR.zMax]});     // stair opening with its pipe rail
 const h=.3,top=1.1;
 for(const z of CHAIRS.wallRowZ)boxes.push({min:[CHAIRS.wallRowX-h,0,z-h],max:[xMax,top,z+h]});
 for(const x of CHAIRS.sternRowsX)for(const z of CHAIRS.sternRowsZ)boxes.push({min:[x-h,0,z-h],max:[x+h,top,z+h]});
 return boxes;
}

/** Fly-through routes (waypoints, y in the opening band 1.3-1.7): over the chairs and out of the open side, out of the stern opening, past the bow end behind the camera. */
function crossingRoutes():THREE.Vector3[][]{
 const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
 const side=[V(1.1,1.55,2.2),V(2.4,1.6,2.6),V(4.6,1.5,2.4),V(6.6,1.3,.2),V(5.4,1.4,-1.6),V(3.4,1.6,-1.2),V(2.4,1.6,-.6),V(1.1,1.5,-1.0)];
 const stern=[V(1.1,1.5,-1.0),V(1.2,1.6,-2.4),V(1.2,1.6,-4.4),V(3.2,1.5,-6.2),V(4.8,1.4,-4.2),V(3.6,1.6,-2.2),V(2.4,1.6,-2.2),V(1.1,1.5,-1.6)];
 const behind=[V(-.9,1.6,2.6),V(-.7,1.5,4.7),V(1.2,1.4,6.8),V(3.6,1.5,6.4),V(3.2,1.6,4.2),V(2.4,1.6,4.2),V(.8,1.5,3.9),V(-.4,1.6,2.8)];
 const reverse=side.map(v=>v.clone()).reverse();
 return [side,stern,behind,reverse];
}

export function createCrossingLife(options:CrossingLifeOptions={}):CrossingLife{
 const seed=(options.seed??20261118)>>>0,random=seededRandom(seed),count=options.count??CROSSING_FISH_COUNT;
 const C=resolveSchoolCandidates({burstCoast:options.burstCoast,topologicalNeighbours:options.topologicalNeighbours,flashBank:options.flashBank,pointerResponse:options.pointerResponse},CROSSING_SARDINE_POINTER_RESPONSE);
 const candidateRandom=seededRandom((seed^0x5b0c0a57)>>>0),K=C.neighbours,nearestDist=new Float64Array(Math.max(1,K)),nearestIndex=new Int32Array(Math.max(1,K));
 const obstacles=crossingFishObstacles(),routes=crossingRoutes(),pointer=createPointerState(),nearSchool=[false,false],away=new THREE.Vector3();
 const {min:BMIN,max:BMAX}=CROSSING_FISH_BOUNDS;

 // --- sardines -------------------------------------------------------------------------------------------------
 const phases=new Float32Array(count),lengths=new Float32Array(count),fish:Fish[]=[];
 const schools:School[]=[0,1].map(()=>({goal:new THREE.Vector3(),centroid:new THREE.Vector3(),velocity:new THREE.Vector3(),route:null,routeIndex:0,lastRoute:-1,roamLeft:2,goalUntil:0,
  nextDash:14+random()*14,dashUntil:0,startleUntil:0,startle:null as THREE.Vector3|null}));
 const hitSolid=(p:THREE.Vector3,r:number,normal?:THREE.Vector3,from?:THREE.Vector3):boolean=>{
  for(const b of obstacles)if(inside(p,b,r)){if(normal)normal.copy(from??p).sub(closest(from??p,b));return true;}
  for(const c of CAMERAS)if(p.distanceToSquared(c)<(CAMERA_HARD+r)**2){if(normal)normal.copy(from??p).sub(c);return true;}
  return false;
 };
 for(let i=0;i<count;i++){
  const school=i<count/2?0:1,centre=school?new THREE.Vector3(4,1.4,3):new THREE.Vector3(-1,1.6,2),p=new THREE.Vector3();
  do p.set(centre.x+(random()-.5)*1.4,centre.y+(random()-.5)*.5,centre.z+(random()-.5)*1.4);while(hitSolid(p,.1));
  const h=new THREE.Vector3(school?-1:.6,0,(random()-.5)*.4).normalize();
  lengths[i]=.10+.10*random();phases[i]=random();const q=new THREE.Quaternion().setFromUnitVectors(FORWARD,h);
  fish.push({p,previous:p.clone(),v:h.clone().multiplyScalar(lengths[i]*CRUISE_BL),heading:h,yaw:Math.atan2(-h.x,-h.z),pitch:0,bank:0,bend:0,previousBend:0,orientation:q,previousOrientation:q.clone(),
   length:lengths[i],phase:phases[i],previousPhase:phases[i],speedBL:CRUISE_BL,previousSpeedBL:CRUISE_BL,wander:random()*6.28,school,gain:.85+.3*random(),yBias:(random()-.5)*.3,
   bc:candidateRandom(),bcRate:1/(BURST_COAST.periodMin+(BURST_COAST.periodMax-BURST_COAST.periodMin)*candidateRandom()),tail:1,previousTail:1});
 }
 const visuals=createSardineVisuals(count,phases,lengths),group=new THREE.Group();group.name='crossing-life';
 // Sardinella look from the species research: no row of flank spots, yellowish dorsal/caudal fins (material tint over the grey-blue fin colours).
 const spotsMesh=visuals.root.getObjectByName('SARDINE_FLANK_SPOTS'),finsMesh=visuals.root.getObjectByName('SARDINE_FINS_AND_FORK') as THREE.InstancedMesh|undefined;
 if(spotsMesh)spotsMesh.visible=false;
 if(finsMesh)(finsMesh.material as THREE.MeshStandardMaterial).color.setRGB(2.3,1.55,.38);
 visuals.root.name='crossing-sardines';group.add(visuals.root);

 // --- whale sharks ---------------------------------------------------------------------------------------------
 const [bigLength,smallLength]=CROSSING_WHALE_SHARK_LENGTHS,sharkSeeds=[(seed^0x7ac1)>>>0,(seed^0x91d3)>>>0];
 const sharkModels=[createWhaleSharkModel(bigLength,sharkSeeds[0]),createWhaleSharkModel(smallLength,sharkSeeds[1])];
 sharkModels[0].root.name='crossing-whale-shark-large';sharkModels[1].root.name='crossing-whale-shark-small';
 sharkModels.forEach(m=>group.add(m.root));
 for(let k=0;k<7;k++)random();   // the sardine random sequence predates the track and is kept as it was
 const sharkPhase=[random(),random()],sharkState=sharkModels.map(()=>({p:new THREE.Vector3(),pitch:0,yaw:0,roll:0,speed:0,frequency:.4,phase:0,poseAt:-1}));
 /** Pose from the analytic track. Tail phase integrates swum distance (one beat per `wavelength` metres), so it never runs on a fixed clock. */
 function sharkPose(index:number,t:number,dt:number){
  const s=sharkState[index],k=crossingWhaleSharkTrack(index as 0|1,t);
  s.p.set(k.p[0],k.p[1],k.p[2]);s.pitch=k.pitch;s.yaw=k.yaw;s.roll=k.roll;s.speed=k.speed;
  s.frequency=k.speed/SHARK_LOOP.wavelength;s.phase+=Math.PI*2*k.speed*dt/SHARK_LOOP.wavelength;
  const model=sharkModels[index];model.root.position.copy(s.p);model.root.rotation.order='YXZ';model.root.rotation.set(-s.pitch,s.yaw,s.roll);
  if(Math.abs(s.phase-s.poseAt)>.12){s.poseAt=s.phase;model.update({phase:s.phase+sharkPhase[index]*6.28,amplitude:.95,glide:.25+.1*Math.sin(.11*t+index)});}
 }

 // --- simulation -----------------------------------------------------------------------------------------------
 let simTime=0,accumulator=0,lastElapsed:number|undefined,penetrations=0,disposed=false,visible=true;
 const tmpM=new THREE.Matrix4(),tmpQ=new THREE.Quaternion(),tmpS=new THREE.Vector3(),tmpP=new THREE.Vector3(),desired=new THREE.Vector3(),normal=new THREE.Vector3(),toGoal=new THREE.Vector3(),nextP=new THREE.Vector3();

 function pickGoal(school:School,t:number){
  const probe=new THREE.Vector3();
  for(let k=0;k<30;k++){
   probe.set(-1.6+3.7*random(),.85+.9*random(),-2.6+7.1*random());
   if(probe.x<.35&&probe.z<-.2)continue;                    // the cabin
   if(CAMERAS.some(c=>c.distanceTo(probe)<2.6)||hitSolid(probe,.15))continue;
   school.goal.copy(probe);school.goalUntil=t+22;return;
  }
  school.goal.set(1.1,1.5,-1.2);school.goalUntil=t+22;
 }
 function steerSchool(school:School,index:number,t:number){
  if(t<school.startleUntil&&school.startle){
   const dir=school.centroid.clone().sub(school.startle);dir.y*=.3;if(dir.lengthSq()<1e-6)dir.set(1,0,0);
   school.goal.copy(school.centroid).addScaledVector(dir.normalize(),4);school.goal.y=THREE.MathUtils.clamp(school.goal.y,.9,1.7);return;
  }
  if(school.route){
   const wp=school.route[school.routeIndex];school.goal.copy(wp);
   if(school.centroid.distanceTo(wp)<1.3||t>school.goalUntil){
    if(++school.routeIndex>=school.route.length){school.route=null;school.roamLeft=2+Math.floor(random()*3);pickGoal(school,t);}
    else school.goalUntil=t+14;
   }
   return;
  }
  if(school.centroid.distanceTo(school.goal)<1.1||t>school.goalUntil){
   if(school.roamLeft--<=0){
    const other=schools[1-index].route,free=routes.map((r,k)=>k).filter(k=>routes[k]!==other&&k!==school.lastRoute),k=free[Math.floor(random()*free.length)];
    school.route=routes[k];school.lastRoute=k;school.routeIndex=0;school.goalUntil=t+24;school.goal.copy(school.route[0]);
    if(t>=school.nextDash){school.dashUntil=t+3.5+random()*1.5;school.nextDash=t+22+random()*22;}   // now and then a school sweeps through fast
   }else pickGoal(school,t);
  }
 }
 function pointerStep(t:number){
  nearSchool[0]=nearSchool[1]=false;
  if(!pointer.active)return 0;
  const pw=pointerWeight(pointer,C.pointerResponse,t),tap=pointer.tapPending;pointer.tapPending=false;
  if(pw<=0&&!tap)return 0;
  let startled=false;
  schools.forEach((s,i)=>{
   let reach=0;for(const f of fish)if(f.school===i)reach=Math.max(reach,f.p.distanceTo(s.centroid));
   const d=rayDistance(pointer,s.centroid.x,s.centroid.y,s.centroid.z,away);
   nearSchool[i]=pw>0&&d<reach+POINTER_RADIUS_BL*.15;
   if(tap&&t>=pointer.cooldownUntil&&t>=s.startleUntil&&d<reach+.6){s.startleUntil=t+TAP_STARTLE_S;s.startle=s.centroid.clone().sub(away);startled=true;pointer.startles++;}
  });
  if(startled)pointer.cooldownUntil=t+POINTER_TAP_COOLDOWN;
  return pw;
 }
 function stepSim(){
  simTime+=STEP;const t=simTime;
  for(const s of schools){s.centroid.set(0,0,0);s.velocity.set(0,0,0);}
  const sizes=[0,0];for(const f of fish){schools[f.school].centroid.add(f.p);schools[f.school].velocity.add(f.v);sizes[f.school]++;}
  schools.forEach((s,i)=>{s.centroid.divideScalar(Math.max(1,sizes[i]));s.velocity.divideScalar(Math.max(1,sizes[i]));steerSchool(s,i,t);});
  const pw=pointerStep(t),n=fish.length,px=fish.map(f=>f.p.x),py=fish.map(f=>f.p.y),pz=fish.map(f=>f.p.z);
  for(let i=0;i<n;i++){
   const a=fish[i],s=schools[a.school];a.previous.copy(a.p);a.previousPhase=a.phase;a.previousSpeedBL=a.speedBL;a.previousOrientation.copy(a.orientation);a.previousBend=a.bend;a.previousTail=a.tail;
   let rx=0,ry=0,rz=0,ax=0,ay=0,az=0,ac=0,cx=0,cy=0,cz=0,cc=0;
   const sep2=(1.3*a.length)**2,coh2=(10*a.length)**2;let found=0;
   for(let j=0;j<n;j++){
    if(i===j)continue;const dx=px[i]-px[j],dy=py[i]-py[j],dz=pz[i]-pz[j],d2=dx*dx+dy*dy+dz*dz;
    if(d2<sep2){const d=Math.sqrt(d2),bl=d/a.length,q=(1.3-bl)/1.3/(d+1e-5);rx+=dx*q;ry+=dy*q;rz+=dz*q;}
    if(fish[j].school!==a.school)continue;
    if(found<K||d2<nearestDist[K-1])found=insertNearest(nearestDist,nearestIndex,K,found,d2,j);
    if(d2<coh2){cx+=px[j];cy+=py[j];cz+=pz[j];cc++;}
   }
   for(let m=0;m<found;m++){const h=fish[nearestIndex[m]].heading;ax+=h.x;ay+=h.y;az+=h.z;}ac=found;
   desired.set(rx,ry,rz).multiplyScalar(1.6);
   if(ac)desired.x+=ax/ac*1.5,desired.y+=ay/ac*1.5,desired.z+=az/ac*1.5;
   if(cc)desired.x+=(cx/cc-a.p.x)*.9/Math.max(a.length*4,1e-3),desired.y+=(cy/cc-a.p.y)*.9/Math.max(a.length*4,1e-3),desired.z+=(cz/cc-a.p.z)*.9/Math.max(a.length*4,1e-3);
   toGoal.copy(s.goal);toGoal.y+=a.yBias;toGoal.sub(a.p);const goalDistance=toGoal.length();
   desired.addScaledVector(toGoal.divideScalar(Math.max(goalDistance,1e-3)),t<s.startleUntil?1.8:.9);
   desired.x+=.25*Math.sin(t*.37+a.wander);desired.y+=.12*Math.sin(t*.29+a.wander*1.7);desired.z+=.25*Math.cos(t*.33+a.wander);
   // Soft repulsion ahead of the hard swept check: collision proxies, station cameras (hard .6 m, soft 2 m).
   for(const b of obstacles){const q=closest(a.p,b),dx=a.p.x-q.x,dy=a.p.y-q.y,dz=a.p.z-q.z,d=Math.hypot(dx,dy,dz),safe=.42;
    if(d<safe){const k=4*(1-d/safe)**2/Math.max(d,1e-5);if(d>1e-5)desired.x+=dx*k,desired.y+=dy*k,desired.z+=dz*k;else desired.y+=4;}}
   for(const c of CAMERAS){const dx=a.p.x-c.x,dy=a.p.y-c.y,dz=a.p.z-c.z,d=Math.hypot(dx,dy,dz);if(d<CAMERA_SOFT){const k=14*(1-d/CAMERA_SOFT)/Math.max(d,1e-3);desired.x+=dx*k;desired.y+=dy*k;desired.z+=dz*k;}}
   if(nearSchool[a.school]){const R=POINTER_RADIUS_BL*a.length,d=rayDistance(pointer,a.p.x,a.p.y,a.p.z,away);if(d<R&&d>1e-4)desired.addScaledVector(away,POINTER_GAIN*pw*(1-d/R)**2/d);}
   for(const axis of ['x','y','z'] as const){const lo=BMIN[axis]+.35,hi=BMAX[axis]-.35;if(a.p[axis]<lo)desired[axis]+=(lo-a.p[axis])*2.2;else if(a.p[axis]>hi)desired[axis]+=(hi-a.p[axis])*2.2;}
   if(desired.lengthSq()<1e-9)desired.copy(a.heading);
   const turned=stepHeading({yaw:a.yaw,pitch:a.pitch,yawRate:0,bank:a.bank,bend:a.bend},desired.normalize(),Infinity,STEP,HEADING);
   a.yaw=turned.yaw;a.pitch=turned.pitch;a.bank=turned.bank;a.bend=turned.bend;
   headingQuaternion(turned,a.orientation);a.heading.copy(FORWARD).applyQuaternion(a.orientation);
   let bl=CRUISE_BL*a.gain*(.9+.15*Math.sin(t*.21+a.wander));
   if(t<s.dashUntil&&s.route)bl*=DASH_GAIN;else if(t<s.startleUntil)bl*=STARTLE_GAIN;
   if(C.burstCoast){bl*=burstCoastSpeed(a.bc,BURST_COAST);a.tail=burstCoastTail(a.bc,BURST_COAST);a.bc+=STEP*a.bcRate;}
   a.v.lerp(tmpP.copy(a.heading).multiplyScalar(a.length*bl),1-Math.exp(-STEP/(t<s.startleUntil||t<s.dashUntil?.3:.6)));
   // Hard guarantee: a step that would enter a solid keeps only its tangential part, else the fish holds position.
   const r=a.length*.5;nextP.copy(a.p).addScaledVector(a.v,STEP);
   if(hitSolid(nextP,r,normal,a.p)){
    if(normal.lengthSq()<1e-10)normal.set(0,1,0);normal.normalize();a.v.addScaledVector(normal,-Math.min(0,a.v.dot(normal)));nextP.copy(a.p).addScaledVector(a.v,STEP);
    if(hitSolid(nextP,r)){nextP.copy(a.p);a.v.multiplyScalar(.3);}
   }
   a.p.copy(nextP).clamp(BMIN,BMAX);
   if(hitSolid(a.p,0))penetrations++;
   a.speedBL=a.v.length()/a.length;a.phase+=tailBeatFrequency(a.v.length(),a.length,TAIL)*STEP;
  }
 }
 function render(alpha:number){
  for(let i=0;i<fish.length;i++){
   const f=fish[i];tmpP.copy(f.previous).lerp(f.p,alpha);tmpQ.copy(f.previousOrientation).slerp(f.orientation,alpha);tmpS.setScalar(f.length);
   setSardineMatrix(visuals,i,tmpM.compose(tmpP,tmpQ,tmpS));
   setSardineMotion(visuals,i,THREE.MathUtils.lerp(f.previousPhase,f.phase,alpha),THREE.MathUtils.lerp(f.previousSpeedBL,f.speedBL,alpha),THREE.MathUtils.lerp(f.previousBend,f.bend,alpha),THREE.MathUtils.lerp(f.previousTail,f.tail,alpha));
  }
  commitSardineMatrices(visuals);
 }
 for(let k=0;k<2;k++)schools[k].goal.set(1.1,1.5,2.4),pickGoal(schools[k],0);
 sharkModels.forEach((_,i)=>sharkPose(i,0,0));

 return {group,
  update(_dt,elapsed,state){
   if(disposed)return;
   const show=!(state.intensity<=0.001);if(show!==visible){visible=show;group.visible=show;}
   const safe=Math.max(0,Number.isFinite(elapsed)?elapsed:0);
   if(lastElapsed===undefined||safe<=lastElapsed){lastElapsed=lastElapsed??safe;render(accumulator/STEP);return;}
   const delta=Math.min(safe-lastElapsed,1);lastElapsed=safe;accumulator+=delta;
   while(accumulator+1e-9>=STEP){stepSim();accumulator-=STEP;}
   sharkModels.forEach((_m,i)=>sharkPose(i,safe,delta));render(accumulator/STEP);
  },
  pointerRay(ray,tap){if(disposed||C.pointerResponse<=0)return;notePointer(pointer,ray,tap,simTime);},
  setEnvironment(texture,intensity){
   setSardineEnvironment(visuals,texture,intensity);
   // The sharks fly in sky light only, so give them the same reflection (no emissive); never below 0.6 so they do not go dull.
   for(const m of sharkModels)m.root.traverse(o=>{const mat=(o as THREE.Mesh).material;for(const x of Array.isArray(mat)?mat:mat?[mat]:[])if(x instanceof THREE.MeshStandardMaterial){x.envMap=texture;x.envMapIntensity=texture?Math.max(.6,intensity):1;x.needsUpdate=true;}});
  },
  getDebug(){return {time:simTime,penetrations,startles:pointer.startles,fish:fish.map(f=>({p:f.p.toArray(),speed:f.v.length(),length:f.length})),
   sharks:sharkState.map((s,i)=>({p:s.p.toArray(),length:CROSSING_WHALE_SHARK_LENGTHS[i],pitch:s.pitch,yaw:s.yaw,roll:s.roll,speed:s.speed,frequency:s.frequency}))};},
  dispose(){if(disposed)return;disposed=true;visuals.dispose();sharkModels.forEach(m=>m.dispose());group.clear();}};
}

function closest(p:THREE.Vector3,b:Box){return new THREE.Vector3(THREE.MathUtils.clamp(p.x,b.min[0],b.max[0]),THREE.MathUtils.clamp(p.y,b.min[1],b.max[1]),THREE.MathUtils.clamp(p.z,b.min[2],b.max[2]));}
function inside(p:THREE.Vector3,b:Box,r:number){return p.x>b.min[0]-r&&p.x<b.max[0]+r&&p.y>b.min[1]-r&&p.y<b.max[1]+r&&p.z>b.min[2]-r&&p.z<b.max[2]+r;}
