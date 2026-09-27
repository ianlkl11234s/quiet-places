import * as THREE from 'three';
import {seededRandom} from '../../shared/math/seededRandom.ts';
import {headingQuaternion,stepHeading,tailBeatFrequency,type HeadingParams,type TailBeatParams} from '../../shared/biology/locomotion/index.ts';
import {commitSardineMatrices,createSardineVisuals,setSardineEnvironment,setSardineMatrix,setSardineMotion} from '../../creatures/sardine/index.ts';
import {ROOF_H,STAIR,stairProfile} from './Layout.ts';

/**
 * Seabridge sardine schools: the scene's one impossible thing — two sardine
 * schools swimming through the open air around the footbridge, roaming the
 * frame and now and then chasing each other.
 *
 * Boids (separation/alignment/cohesion) + a slow roaming goal per school + a
 * chase/flee episode state machine. Fixed 12 Hz step with render interpolation,
 * seeded and driven only by the player's elapsed time, so it is reproducible and
 * pause-safe. Speeds and episode timing are art calibration; schooling in a
 * real sardine school is not simulated. Units: m, s; website Y-up.
 */

type Box={min:[number,number,number];max:[number,number,number]};
type Mode='cruise'|'chase'|'flee';
interface Fish {p:THREE.Vector3;previous:THREE.Vector3;v:THREE.Vector3;heading:THREE.Vector3;yaw:number;pitch:number;bank:number;bend:number;previousBend:number;
 orientation:THREE.Quaternion;previousOrientation:THREE.Quaternion;length:number;phase:number;previousPhase:number;speedBL:number;previousSpeedBL:number;wander:number;school:number;}
interface School {goal:THREE.Vector3;centroid:THREE.Vector3;velocity:THREE.Vector3;mode:Mode;modeUntil:number;burst:number;path:number[];route:THREE.Vector3[]|null;waypoint:number;nextRoute:number;}

const STEP=1/12,DEG=Math.PI/180,FORWARD=new THREE.Vector3(0,0,-1);
/** Open-air volume the schools roam (town side of the bank, around and over the bridge). */
export const SARDINE_BOUNDS={min:new THREE.Vector3(-9,.75,-12.8),max:new THREE.Vector3(10,6.8,7)};
// Agile clupeid turning: faster yaw and roll than the arcade fusiliers (art calibration).
const HEADING:HeadingParams={maxYawRate:120*DEG,yawTau:.35,maxPitch:25*DEG,maxPitchRate:40*DEG,pitchTau:.5,holdSpeed:0,trackSpeed:0,maxBank:8*DEG,maxBend:.06,yawRateScale:60*DEG,bankTau:.25};
const TAIL:TailBeatParams={f0:.8,k:.7,maxFrequency:6};
const CRUISE_BL=2,CHASE_BL=4.2,FLEE_BL=5;

/** Nosing-line height of the main stair at depth z (0 on the footpath, deck level past the top). */
function stairLine(z:number){
 const s=stairProfile();
 return z>=0?0:z>s.f1End?-z/STAIR.run*STAIR.rise:z>s.landingEnd?s.f1Top:z>s.f2End?s.f1Top+(s.landingEnd-z)/STAIR.run*STAIR.rise:STAIR.rise*(STAIR.flight1+STAIR.flight2);
}

/**
 * Invisible collision proxies for the fish only (no visible geometry changes):
 * treads, side panels, roof and columns of the covered stair, and the entrance
 * canopy — so a school can stream up the stair under the roof and pass beneath
 * the canopy. The sloped parts are stepped every 0.4 m and err on the solid side.
 */
export function sardineObstacles():Box[]{
 const s=stairProfile(),hw=STAIR.width/2,boxes:Box[]=[],step=.4;
 for(let z=0;z>s.deckLandingEnd;z-=step){
  const z1=Math.max(z-step,s.deckLandingEnd),lo=Math.min(stairLine(z),stairLine(z1)),hi=Math.max(stairLine(z),stairLine(z1));
  boxes.push({min:[-hw,0,z1],max:[hw,hi,z]});                                   // treads and the solid mass below
  for(const side of [-1,1])boxes.push({min:[side<0?-hw-.1:hw-.05,0,z1],max:[side<0?-hw+.05:hw+.1,hi+1.25,z]}); // side panels
  boxes.push({min:[-hw-.45,lo+ROOF_H-.05,z1],max:[hw+.45,hi+ROOF_H+.4,z]});       // roof
 }
 const columnZ=[.25,-2.7,s.f1End,s.landingEnd,s.landingEnd-2.55,s.f2End,s.deckLandingEnd];
 for(const z of columnZ)for(const side of [-1,1])boxes.push({min:[side*(hw+.14)-.1,0,z-.1],max:[side*(hw+.14)+.1,stairLine(z)+ROOF_H+.3,z+.1]});
 // Entrance canopy roof and its columns.
 boxes.push({min:[-hw-.45,ROOF_H+.1,-.3],max:[hw+.45,ROOF_H+.6,2.4]});
 for(const side of [-1,1])boxes.push({min:[side*(hw+.14)-.1,0,2.15],max:[side*(hw+.14)+.1,ROOF_H+.4,2.35]});
 // Landing legs under the mid landing.
 for(const side of [-1,1])boxes.push({min:[side*(hw-.2)-.17,0,s.landingEnd+.03],max:[side*(hw-.2)+.17,s.f1Top,s.landingEnd+.37]});
 return boxes;
}

/**
 * Fly-through routes (waypoints): low over the weeds, under the entrance canopy
 * and up or down the covered stair, leaving or entering through the open gap
 * between the side panels and the roof at the mid landing.
 */
export function sardineRoutes():THREE.Vector3[][]{
 const s=stairProfile(),mid=(s.f1End+s.landingEnd)/2,gapY=s.f1Top+1.8;
 const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
 const up=[V(3.2,1.05,3.0),V(0,1.45,1.6),V(0,stairLine(-2.5)+1.45,-2.5),V(0,s.f1Top+1.5,mid),V(-3.6,gapY-.2,mid)];
 const down=[V(3.6,gapY-.2,mid),V(0,s.f1Top+1.5,mid),V(0,stairLine(-2.5)+1.45,-2.5),V(0,1.45,1.2),V(-3.2,1.0,3.0),V(-6.5,1.1,1)];
 const sweep=[V(-7,1.0,.5),V(-3.4,.95,3.1),V(1.2,1.0,3.5),V(4.2,1.0,1.4),V(7.5,1.25,-2)];
 const sweepBack=sweep.map(v=>v.clone()).reverse();
 return [up,down,sweep,sweepBack];
}

export interface SardineSchools {root:THREE.Group;update(elapsed:number):void;setEnvironment(texture:THREE.Texture|null,intensity:number):void;getDebug():{time:number;chases:number;flythroughs:number;penetrations:number;fish:{p:number[];speedBL:number}[];modes:Mode[]};dispose():void;}

export function createSardineSchools(options:{seed:number;count?:number;avoid?:THREE.Vector3[]}):SardineSchools{
 const random=seededRandom(options.seed>>>0),count=options.count??400,obstacles=sardineObstacles(),routes=sardineRoutes(),avoid=options.avoid??[];
 const phases=new Float32Array(count),lengths=new Float32Array(count),fish:Fish[]=[];
 const schools:School[]=[0,1].map(()=>({goal:new THREE.Vector3(),centroid:new THREE.Vector3(),velocity:new THREE.Vector3(),mode:'cruise' as Mode,modeUntil:0,burst:0,route:null,waypoint:0,nextRoute:4+random()*10,
  // Per-axis roaming frequencies (rad/s) and phases: slow, non-repeating-looking loops.
  path:[.031+.012*random(),.043+.01*random(),.027+.012*random(),random()*6.28,random()*6.28,random()*6.28]}));
 for(let i=0;i<count;i++){
  const school=i<count/2?0:1,start=new THREE.Vector3(school?5:-5,3+random()*1.2,school?-2:1);
  const p=start.add(new THREE.Vector3((random()-.5)*2.4,(random()-.5)*1.2,(random()-.5)*2.4)),h=new THREE.Vector3(school?-1:1,0,(random()-.5)*.3).normalize();
  lengths[i]=.16+.05*random();phases[i]=random();
  const q=new THREE.Quaternion().setFromUnitVectors(FORWARD,h);
  fish.push({p,previous:p.clone(),v:h.clone().multiplyScalar(lengths[i]*CRUISE_BL),heading:h,yaw:Math.atan2(-h.x,-h.z),pitch:0,bank:0,bend:0,previousBend:0,orientation:q,previousOrientation:q.clone(),
   length:lengths[i],phase:phases[i],previousPhase:phases[i],speedBL:CRUISE_BL,previousSpeedBL:CRUISE_BL,wander:random()*6.28,school});
 }
 const visuals=createSardineVisuals(count,phases,lengths),root=new THREE.Group();root.name='seabridge-sardines';root.add(visuals.root);
 let simTime=0,accumulator=0,lastElapsed:number|undefined,chases=0,penetrations=0,flythroughs=0,disposed=false;
 let nextChase=12+exponential(random,14);
 const tmpM=new THREE.Matrix4(),tmpQ=new THREE.Quaternion(),tmpS=new THREE.Vector3(),tmpP=new THREE.Vector3();

 function roam(school:School,t:number,index:number){
  const [fx,fy,fz,px,py,pz]=school.path;
  // Following a fly-through: advance when the school's centre reaches the waypoint.
  if(school.route){
   if(school.centroid.distanceTo(school.route[school.waypoint])<1.1&&++school.waypoint>=school.route.length){school.route=null;school.nextRoute=t+2+exponential(random,4);}
   if(school.route){school.goal.copy(school.route[school.waypoint]);return;}
  }
  if(t>=school.nextRoute){
   // Start from the waypoint nearest the school so it does not cross the bridge to begin.
   const others=schools.filter(o=>o!==school&&o.route).map(o=>o.route);
   const free=routes.filter(r=>!others.includes(r)),pick=free[Math.floor(random()*free.length)];let best=0;
   for(let k=0;k<pick.length-1;k++)if(pick[k].distanceTo(school.centroid)<pick[best].distanceTo(school.centroid))best=k;
   school.route=pick;school.waypoint=best===0?0:Math.max(0,best-0);flythroughs++;school.goal.copy(pick[school.waypoint]);return;
  }
  // Low roaming band (y 0.9..3.0) mostly in front of the standpoints, with room behind the bridge.
  school.goal.set(.5+5.5*Math.sin(fx*t+px)+(index?1:-1),1.95+1.05*Math.sin(fy*t+py),-5+6*Math.sin(fz*t+pz));
  // Keep a roaming goal clear of the stair so the school goes around, unless on a route.
  if(Math.abs(school.goal.x)<2.4&&school.goal.z<2.6&&school.goal.z>-14.5)school.goal.x=(school.goal.x<0?-1:1)*2.4;
 }
 function episode(t:number){
  if(t>=nextChase&&schools.every(s=>s.mode==='cruise')){
   const chaser=random()<.5?0:1,target=1-chaser,length=4.5+random()*3.5;
   for(const o of schools){o.route=null;o.nextRoute=t+length+4+random()*6;}
   schools[chaser].mode='chase';schools[target].mode='flee';schools[chaser].modeUntil=schools[target].modeUntil=t+length;schools[target].burst=1;
   chases++;nextChase=t+length+14+exponential(random,16);
  }
  for(const s of schools)if(s.mode!=='cruise'&&t>=s.modeUntil)s.mode='cruise';
 }
 function stepSim(){
  simTime+=STEP;const t=simTime;
  for(const s of schools){s.centroid.set(0,0,0);s.velocity.set(0,0,0);}
  const sizes=[0,0];for(const f of fish){schools[f.school].centroid.add(f.p);schools[f.school].velocity.add(f.v);sizes[f.school]++;}
  schools.forEach((s,i)=>{s.centroid.divideScalar(Math.max(1,sizes[i]));s.velocity.divideScalar(Math.max(1,sizes[i]));});
  episode(t);
  schools.forEach((s,i)=>{
   const other=schools[1-i];
   if(s.mode==='chase')s.goal.copy(other.centroid).addScaledVector(other.velocity,1.2);
   else if(s.mode==='flee'){const away=s.centroid.clone().sub(other.centroid);away.y*=.3;if(away.lengthSq()<1e-6)away.set(1,0,0);s.goal.copy(s.centroid).addScaledVector(away.normalize(),5).add(new THREE.Vector3(0,.8*Math.sin(t*1.7+i),0));s.burst=Math.max(0,s.burst-STEP/2.5);}
   else roam(s,t,i);
  });
  const n=fish.length,px=fish.map(f=>f.p.x),py=fish.map(f=>f.p.y),pz=fish.map(f=>f.p.z);
  for(let i=0;i<n;i++){
   const a=fish[i],s=schools[a.school];a.previous.copy(a.p);a.previousPhase=a.phase;a.previousSpeedBL=a.speedBL;a.previousOrientation.copy(a.orientation);a.previousBend=a.bend;
   let rx=0,ry=0,rz=0,ax=0,ay=0,az=0,ac=0,cx=0,cy=0,cz=0,cc=0;
   for(let j=0;j<n;j++){
    if(i===j)continue;const dx=px[i]-px[j],dy=py[i]-py[j],dz=pz[i]-pz[j],d2=dx*dx+dy*dy+dz*dz,bl=Math.sqrt(d2)/a.length;
    if(bl<1.3){const q=(1.3-bl)/1.3/(Math.sqrt(d2)+1e-5);rx+=dx*q;ry+=dy*q;rz+=dz*q;}
    if(fish[j].school!==a.school)continue;
    if(bl<5){ax+=fish[j].heading.x;ay+=fish[j].heading.y;az+=fish[j].heading.z;ac++;}
    if(bl<10){cx+=px[j];cy+=py[j];cz+=pz[j];cc++;}
   }
   const desired=new THREE.Vector3(rx,ry,rz).multiplyScalar(1.6);
   if(ac)desired.add(new THREE.Vector3(ax/ac,ay/ac,az/ac).multiplyScalar(1.5));
   if(cc)desired.add(new THREE.Vector3(cx/cc-a.p.x,cy/cc-a.p.y,cz/cc-a.p.z).multiplyScalar(.9/Math.max(a.length*4,1e-3)));
   const toGoal=s.goal.clone().sub(a.p),goalDistance=toGoal.length();
   desired.addScaledVector(toGoal.divideScalar(Math.max(goalDistance,1e-3)),s.mode==='cruise'?.9:1.8);
   // Individual meander on its own slow phase (never the tail phase).
   desired.x+=.25*Math.sin(t*.37+a.wander);desired.y+=.12*Math.sin(t*.29+a.wander*1.7);desired.z+=.25*Math.cos(t*.33+a.wander);
   // Structure, viewpoint and volume: soft repulsion ahead of the hard swept check.
   // Broad phase: every proxy lies within |x|<1.6 m and z −14.5…2.6 m.
   const nearBridge=Math.abs(a.p.x)<2.2&&a.p.z<3.2&&a.p.z>-15.2;
   if(nearBridge)for(const b of obstacles){const q=closest(a.p,b),dv=a.p.clone().sub(q),d=dv.length(),safe=.4;if(d<safe){desired.addScaledVector(d>1e-5?dv.divideScalar(d):new THREE.Vector3(Math.sign(a.p.x)||1,0,0),4*(1-d/safe)**2);}}
   for(const c of avoid){const dv=a.p.clone().sub(c),d=dv.length();if(d<2.4)desired.addScaledVector(dv.divideScalar(Math.max(d,1e-3)),3*(1-d/2.4)**2);}
   for(const axis of ['x','y','z'] as const){const lo=SARDINE_BOUNDS.min[axis]+.8,hi=SARDINE_BOUNDS.max[axis]-.8;if(a.p[axis]<lo)desired[axis]+=(lo-a.p[axis])*1.5;else if(a.p[axis]>hi)desired[axis]+=(hi-a.p[axis])*1.5;}
   if(desired.lengthSq()<1e-9)desired.copy(a.heading);
   const turned=stepHeading({yaw:a.yaw,pitch:a.pitch,yawRate:0,bank:a.bank,bend:a.bend},desired.normalize(),Infinity,STEP,HEADING);
   a.yaw=turned.yaw;a.pitch=turned.pitch;a.bank=turned.bank;a.bend=turned.bend;headingQuaternion(turned,a.orientation);a.heading.copy(FORWARD).applyQuaternion(a.orientation);
   const bl=s.mode==='chase'?CHASE_BL:s.mode==='flee'?CRUISE_BL+(FLEE_BL-CRUISE_BL)*Math.max(.35,s.burst):CRUISE_BL*(.9+.15*Math.sin(t*.21+a.wander));
   a.v.lerp(a.heading.clone().multiplyScalar(a.length*bl),1-Math.exp(-STEP/(s.mode==='flee'?.25:.6)));
   // Hard guarantee: reject a step that would enter a slice; keep only the tangential part.
   let next=a.p.clone().addScaledVector(a.v,STEP);
   const hit=nearBridge?obstacles.find(b=>inside(next,b,a.length*.5)):undefined;
   if(hit){const q=closest(a.p,hit),normal=a.p.clone().sub(q);if(normal.lengthSq()<1e-10)normal.set(Math.sign(a.p.x)||1,0,0);normal.normalize();a.v.addScaledVector(normal,-Math.min(0,a.v.dot(normal))*1.0);next=a.p.clone().addScaledVector(a.v,STEP);if(obstacles.some(b=>inside(next,b,a.length*.5))){next.copy(a.p);a.v.multiplyScalar(.3);}}
   a.p.copy(next).clamp(SARDINE_BOUNDS.min,SARDINE_BOUNDS.max);
   if(nearBridge&&obstacles.some(b=>inside(a.p,b,0)))penetrations++;
   a.speedBL=a.v.length()/a.length;a.phase+=tailBeatFrequency(a.v.length(),a.length,TAIL)*STEP;
  }
 }
 function render(alpha:number){
  for(let i=0;i<fish.length;i++){
   const f=fish[i];tmpP.copy(f.previous).lerp(f.p,alpha);tmpQ.copy(f.previousOrientation).slerp(f.orientation,alpha);tmpS.setScalar(f.length);
   setSardineMatrix(visuals,i,tmpM.compose(tmpP,tmpQ,tmpS));
   setSardineMotion(visuals,i,THREE.MathUtils.lerp(f.previousPhase,f.phase,alpha),THREE.MathUtils.lerp(f.previousSpeedBL,f.speedBL,alpha),THREE.MathUtils.lerp(f.previousBend,f.bend,alpha));
  }
  commitSardineMatrices(visuals);
 }
 return {root,update(elapsed){
  if(disposed)return;const safe=Math.max(0,Number.isFinite(elapsed)?elapsed:0);
  if(lastElapsed===undefined||safe<=lastElapsed){lastElapsed=lastElapsed??safe;render(accumulator/STEP);return;}
  accumulator+=Math.min(safe-lastElapsed,1);lastElapsed=safe;
  while(accumulator+1e-9>=STEP){stepSim();accumulator-=STEP;}
  render(accumulator/STEP);
 },setEnvironment(texture,intensity){setSardineEnvironment(visuals,texture,intensity);},getDebug(){return {time:simTime,chases,flythroughs,penetrations,fish:fish.map(f=>({p:f.p.toArray(),speedBL:f.speedBL})),modes:schools.map(s=>s.mode)};},
 dispose(){if(disposed)return;disposed=true;visuals.dispose();root.clear();}};
}

function exponential(random:()=>number,mean:number){return -Math.log(Math.max(1e-9,1-random()))*mean;}
function closest(p:THREE.Vector3,b:Box){return new THREE.Vector3(THREE.MathUtils.clamp(p.x,b.min[0],b.max[0]),THREE.MathUtils.clamp(p.y,b.min[1],b.max[1]),THREE.MathUtils.clamp(p.z,b.min[2],b.max[2]));}
function inside(p:THREE.Vector3,b:Box,r:number){return p.x>b.min[0]-r&&p.x<b.max[0]+r&&p.y>b.min[1]-r&&p.y<b.max[1]+r&&p.z>b.min[2]-r&&p.z<b.max[2]+r;}
