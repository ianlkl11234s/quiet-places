import * as THREE from 'three';
import {createTentacleMaterial,installTissueShading} from './AureliaShading.ts';
import {addRingVelocity,ringFromBeat,type VortexRing} from '../VirtualFluid.ts';

const TAU=Math.PI*2;
const STEP=1/120;
const SECTORS=8;
const clamp=THREE.MathUtils.clamp;
const modulo=(value:number,divisor:number)=>((value%divisor)+divisor)%divisor;
/** J2 (2026-09-27) pulse timing as cycle fractions. A: ~20% of the cycle is active contraction (Gemmell 2013); relaxation/pause split is B. */
export const AURELIA_PULSE={contract:.20,relaxEnd:.70} as const;
/** J2 sector asymmetry at |turn|=1: onset lead in cycles and stroke gain (B, chosen so the lead side is visibly first in the mesh). */
export const AURELIA_TURN={onsetLead:.07,amplitude:.16} as const;
/**
 * J3 appendage coupling to the sampled (body-relative) flow u: node acceleration = drag·u − restore·(x − x_rest),
 * x_rest = the chain hanging straight from its root. Replaces the J2 ARM_WAKE proxy: the ¼-beat lag now comes
 * from the real wake rings (ring rise + transit) plus this overdamped response. B mechanism, C values.
 */
export const APPENDAGE_FLOW={arm:{drag:90,restore:28},tentacle:{drag:16,restore:26}} as const;
/** Body-relative fluid velocity (m/s) in the organism's local frame at a local point and absolute time. */
export type AureliaFlowSampler=(x:number,y:number,z:number,time:number,out:THREE.Vector3)=>THREE.Vector3;

export interface AureliaOptions { diameter:number; frequency:number; phase:number; seed:number; }
export interface AureliaControls { turn?:number; turnDirection?:number; activity?:number;
  /** legacy constant body-relative flow (local, m/s), used only when no sampler is given */
  relativeFlow?:THREE.Vector3;
  /** J3: per-node flow sampler (local frame); arms and tentacle guides read it every fixed step */
  sampleFlow?:AureliaFlowSampler; }
export interface AureliaKinematics { phase:number; cycle:number; frequency:number; contraction:number; contractionRate:number; }
export interface AureliaDiagnostics extends AureliaKinematics { marginResponse:number; marginVelocity:number; sectorMarginResponse:readonly number[]; sectorMarginVelocity:readonly number[]; marginRadial:number; marginVertical:number; hysteresisArea:number; sectorOnset:readonly number[]; sectorAmplitude:readonly number[]; thrustProxy:number; passiveEnergyRecapture:number; force:THREE.Vector3; }
export interface AureliaInstance { group:THREE.Group; update(elapsed:number,controls?:AureliaControls):void; dispose():void; }

/** Pure, deterministic oscillator. phase accepts a normalized cycle (usual scene use) or radians. */
export function sampleAureliaKinematics(elapsed:number,options:Pick<AureliaOptions,'frequency'|'phase'|'seed'>,activity=1):AureliaKinematics {
  const frequency=options.frequency;
  if(!Number.isFinite(frequency)||frequency<=0)throw new RangeError('Aurelia frequency must be a positive number in Hz.');
  const time=Number.isFinite(elapsed)?elapsed:0;
  const seed=Number.isFinite(options.seed)?options.seed:0;
  const basePhase=Math.abs(options.phase)<=1?options.phase*TAU:options.phase;
  const f1=.019+modulo(seed*.017,1)*.012, f2=.052+modulo(seed*.031,1)*.018;
  const p1=seed*1.731,p2=seed*2.417;
  const modulation=.025*Math.sin(TAU*f1*time+p1)+.012*Math.sin(TAU*f2*time+p2);
  const integral=time+.025*(Math.cos(p1)-Math.cos(TAU*f1*time+p1))/(TAU*f1)+.012*(Math.cos(p2)-Math.cos(TAU*f2*time+p2))/(TAU*f2);
  // Activity is an envelope owned by the behaviour adapter; never scale elapsed here or a control change will jump phase.
  const phase=basePhase+TAU*frequency*integral;
  const cycle=modulo(phase,TAU)/TAU;
  const currentFrequency=frequency*(1+modulation);
  const amplitude=clamp(Number.isFinite(activity)?activity:1,0,1.35);
  let contraction=0,contractionRate=0;
  const {contract:C,relaxEnd:E}=AURELIA_PULSE;
  if(cycle<C){const p=cycle/C;contraction=.5*(1-Math.cos(Math.PI*p));contractionRate=.5*Math.PI*Math.sin(Math.PI*p)/(C/currentFrequency);}
  else if(cycle<E){const p=(cycle-C)/(E-C);contraction=.5*(1+Math.cos(Math.PI*p));contractionRate=-.5*Math.PI*Math.sin(Math.PI*p)/((E-C)/currentFrequency);}
  return {phase,cycle,frequency:currentFrequency,contraction:contraction*amplitude,contractionRate:contractionRate*amplitude};
}

/** Integrates only the flexible margin response at fixed 120 Hz; it deliberately has state. */
export function createAureliaDynamics(options:Pick<AureliaOptions,'diameter'|'frequency'|'phase'|'seed'>){
  const response=new Float64Array(SECTORS),velocity=new Float64Array(SECTORS),onset=new Float64Array(SECTORS),amplitude=new Float64Array(SECTORS);
  let elapsed=0,initialized=false,peakThrust=0;
  const update=(nextElapsed:number,controls:AureliaControls={})=>{
    const targetTime=Number.isFinite(nextElapsed)?Math.max(0,nextElapsed):0;
    if(!initialized||targetTime<elapsed){elapsed=0;peakThrust=0;response.fill(0);velocity.fill(0);initialized=true;}
    const turn=clamp(controls.turn??0,-1,1),direction=Number.isFinite(controls.turnDirection)?controls.turnDirection!:0;
    // Positive onset advances the sector's phase: sectors facing `direction` start first and stroke harder (lead side).
    for(let k=0;k<SECTORS;k++){const g=Math.cos(TAU*k/SECTORS-direction);onset[k]=AURELIA_TURN.onsetLead*g*Math.abs(turn);amplitude[k]=1+AURELIA_TURN.amplitude*g*Math.abs(turn);}
    const end=targetTime;
    while(elapsed+STEP<=end+1e-9){elapsed+=STEP;step(elapsed,STEP,controls);}
    if(elapsed<end){step(end,end-elapsed,controls);elapsed=end;}
    return sample(end,controls);
  };
  const step=(time:number,dt:number,controls:AureliaControls)=>{
    const activity=controls.activity??1;
    for(let k=0;k<SECTORS;k++){
      const base=sampleAureliaKinematics(time,options,activity);
      const shifted=samplePulse(base.phase+TAU*onset[k],base.frequency)*amplitude[k]*clamp(controls.activity??1,0,1.35);
      const omega=TAU*base.frequency*3.2,acceleration=omega*omega*(shifted-response[k])-2*.76*omega*velocity[k];
      velocity[k]+=acceleration*dt;response[k]+=velocity[k]*dt;
      peakThrust=Math.max(peakThrust*.992,Math.max(0,base.contractionRate)**2*(options.diameter*.5)**3);
    }
  };
  const sample=(time:number,controls:AureliaControls={}):AureliaDiagnostics=>{
    const base=sampleAureliaKinematics(time,options,controls.activity??1);
    const turn=clamp(controls.turn??0,-1,1),direction=Number.isFinite(controls.turnDirection)?controls.turnDirection!:0;
    // This stays useful before the first stateful update, including exporter sampling.
    const sectorOnset=Array.from(onset),sectorAmplitude=Array.from(amplitude),sectorMarginResponse=Array.from(response),sectorMarginVelocity=Array.from(velocity);
    const mean=response.reduce((sum,value)=>sum+value,0)/SECTORS;
    const meanVelocity=velocity.reduce((sum,value)=>sum+value,0)/SECTORS;
    const local=(1-.92)*base.contraction+.92*mean;
    const radial=1-.145*local;
    const vertical=-.16*local-.034*meanVelocity/Math.max(.1,base.frequency);
    const thrustProxy=Math.max(0,base.contractionRate)**2*(options.diameter*.5)**3;
    const elapsedFromRelax=base.cycle<AURELIA_PULSE.relaxEnd?0:(base.cycle-AURELIA_PULSE.relaxEnd)/Math.max(.01,base.frequency);
    // .30 is a scene calibration proxy for post-relaxation contribution, not a universal biological fraction.
    const passiveEnergyRecapture=base.cycle>=AURELIA_PULSE.relaxEnd?.30*peakThrust*Math.exp(-elapsedFromRelax/.38):0;
    const force=new THREE.Vector3(0,0,thrustProxy+passiveEnergyRecapture);
    if(controls.relativeFlow)force.addScaledVector(controls.relativeFlow,-.008*options.diameter*options.diameter);
    // The sampled area is a bounded diagnostic proxy for the radial/vertical loop, not a biological measurement.
    const hysteresisArea=Math.abs(meanVelocity)*.010*options.diameter;
    return {...base,marginResponse:mean,marginVelocity:meanVelocity,sectorMarginResponse,sectorMarginVelocity,marginRadial:radial,marginVertical:vertical,hysteresisArea,sectorOnset,sectorAmplitude,thrustProxy,passiveEnergyRecapture,force};
  };
  return {update,sample,reset(){initialized=false;elapsed=0;peakThrust=0;response.fill(0);velocity.fill(0);}};
}

export function sampleAureliaDiagnostics(elapsed:number,options:Pick<AureliaOptions,'diameter'|'frequency'|'phase'|'seed'>,controls:AureliaControls={}):AureliaDiagnostics {
  const dynamics=createAureliaDynamics(options);return dynamics.update(elapsed,controls);
}

/** Measures a radial/vertical loop from the deformed bell vertex buffer, for geometry QA only. */
export function measureAureliaMarginLoop(options:AureliaOptions,samples=120){
  const jelly=createAurelia(options),bell=jelly.group.getObjectByName('aurelia-closed-bell') as THREE.Mesh,position=bell.geometry.getAttribute('position') as THREE.BufferAttribute;
  const row=73,outer=20*row,inner=7*row,points:Array<[number,number]>=[],outerStart=new THREE.Vector3(),innerStart=new THREE.Vector3();
  const read=(vertex:number,target:THREE.Vector3)=>target.fromBufferAttribute(position,vertex);
  read(outer,outerStart);read(inner,innerStart);let outerDisplacement=0,innerDisplacement=0;
  for(let i=0;i<=samples;i++){jelly.update(i/(Math.max(2,samples)*options.frequency));const a=read(outer,new THREE.Vector3()),b=read(inner,new THREE.Vector3());points.push([Math.hypot(a.x,a.y),a.z]);outerDisplacement=Math.max(outerDisplacement,a.distanceTo(outerStart));innerDisplacement=Math.max(innerDisplacement,b.distanceTo(innerStart));}
  let signedArea=0;for(let i=0;i<points.length-1;i++)signedArea+=points[i][0]*points[i+1][1]-points[i+1][0]*points[i][1];jelly.dispose();return {area:Math.abs(signedArea)*.5,outerDisplacement,innerDisplacement};
}

function samplePulse(phase:number,frequency:number):number {const cycle=modulo(phase,TAU)/TAU,{contract:C,relaxEnd:E}=AURELIA_PULSE;if(cycle<C)return .5*(1-Math.cos(Math.PI*cycle/C));if(cycle<E)return .5*(1+Math.cos(Math.PI*(cycle-C)/(E-C)));return 0;}
function smooth(edge0:number,edge1:number,x:number):number {const p=clamp((x-edge0)/(edge1-edge0),0,1);return p*p*(3-2*p);}
function rng(seed:number){let state=(seed>>>0)||1;return ()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};}

type BellVertex={r:number;theta:number;inside:boolean};
/** J1: one position/normal/aTissue set shared by three index sets so passes can be ordered: exumbrella back, subumbrella, exumbrella front. */
function bellGeometry(diameter:number){
  const radial=20,angular=72,vertices:BellVertex[]=[],positions:number[]=[],tissue:number[]=[];
  for(const inside of [false,true])for(let j=0;j<=radial;j++)for(let i=0;i<=angular;i++){const r=j/radial,theta=TAU*(i%angular)/angular;vertices.push({r,theta,inside});positions.push(0,0,0);
    // thin = 1 at the margin, 0 at the thick centre; same profile as the geometric thickness below.
    tissue.push(1-(.005+.045*Math.pow(1-r,1.8))/.05,r,TAU*i/angular);}
  const row=angular+1,sideCount=(radial+1)*row,outer:number[]=[],inner:number[]=[];
  for(let side=0;side<2;side++)for(let j=0;j<radial;j++)for(let i=0;i<angular;i++){const a=side*sideCount+j*row+i,b=a+1,c=a+row,d=c+1;if(side===0)outer.push(a,c,b,b,c,d);else inner.push(a,b,c,b,d,c);}
  for(let i=0;i<angular;i++){const o0=radial*row+i,o1=o0+1,n0=sideCount+radial*row+i,n1=n0+1;outer.push(o0,n0,o1,o1,n0,n1);}
  const position=new THREE.Float32BufferAttribute(positions,3),normal=new THREE.Float32BufferAttribute(new Float32Array(positions.length),3),aTissue=new THREE.Float32BufferAttribute(tissue,3);
  // computeVertexNormals() on the full closed shell refills this shared normal attribute in place.
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',position);geometry.setAttribute('normal',normal);geometry.setAttribute('aTissue',aTissue);geometry.setIndex([...outer,...inner]);
  const view=(index:number[])=>{const g=new THREE.BufferGeometry();g.setAttribute('position',position);g.setAttribute('normal',normal);g.setAttribute('aTissue',aTissue);g.setIndex(index);return g;};
  return {geometry,exumbrella:view(outer),subumbrella:view(inner),vertices};
}
/** Lightweight topology guard for runtime and Blender-export consumers. */
export function validateAureliaTopology(geometry:THREE.BufferGeometry):{valid:boolean;maxIndex:number;triangleCount:number;reason?:string}{
  const position=geometry.getAttribute('position') as THREE.BufferAttribute|undefined,index=geometry.index;
  if(!position||!index||index.count%3)return {valid:false,maxIndex:-1,triangleCount:0,reason:'Aurelia geometry needs indexed triangles.'};
  let maxIndex=-1;for(let i=0;i<index.count;i++){const value=index.getX(i);maxIndex=Math.max(maxIndex,value);if(value<0||value>=position.count)return {valid:false,maxIndex,triangleCount:index.count/3,reason:'Aurelia index exceeds its position buffer.'};}
  for(let i=0;i<index.count;i++){const at=index.getX(i)*3,array=position.array as ArrayLike<number>;if(!Number.isFinite(array[at])||!Number.isFinite(array[at+1])||!Number.isFinite(array[at+2]))return {valid:false,maxIndex,triangleCount:index.count/3,reason:'Aurelia triangle has non-finite coordinates.'};}
  return {valid:true,maxIndex,triangleCount:index.count/3};
}
function setBellPositions(target:Float32Array,vertices:BellVertex[],diameter:number,diagnostic:AureliaDiagnostics){
  const R=diameter*.5,H=diameter*.16;
  for(let index=0;index<vertices.length;index++){
    const {r,theta,inside}=vertices[index],notch=Math.pow(r,10)*notchAt(theta),radius=R*r*(1-.008*notch);
    const broad=.14+(.86*Math.pow(smooth(.32,1,r),1.45));
    // The source's ~83% exumbrellar arclength flexion point is approximated in radial space here.
    const flap=Math.pow(smooth(.80,1,r),1.4);
    const sectorFloat=modulo(theta/TAU*SECTORS,SECTORS),sector=Math.floor(sectorFloat),next=(sector+1)%SECTORS,mix=sectorFloat-sector;
    const sectorResponse=THREE.MathUtils.lerp(diagnostic.sectorMarginResponse[sector],diagnostic.sectorMarginResponse[next],mix);
    const sectorVelocity=THREE.MathUtils.lerp(diagnostic.sectorMarginVelocity[sector],diagnostic.sectorMarginVelocity[next],mix);
    // J2: sector responses reach in to r≈.4 so a turning stroke visibly starts on one side of the bell, not only at the flap.
    const sectorWeight=Math.max(flap,Math.pow(smooth(.40,1,r),1.2));
    const local=(1-sectorWeight)*diagnostic.contraction+sectorWeight*(sectorResponse*(1+.025*Math.cos(theta)));
    const deformedRadius=radius*(1-.145*broad*local)*(1+.008*diagnostic.sectorAmplitude[sector]*flap);
    // Velocity-dependent rollout makes the contraction and relaxation paths physically distinct in the actual mesh.
    const z=-H*Math.pow(r,1.55)-.10*R*broad*local-.020*R*flap*sectorVelocity/Math.max(.12,diagnostic.frequency);
    const thickness=diameter*(.005+.045*Math.pow(1-r,1.8));
    target[index*3]=deformedRadius*Math.cos(theta);target[index*3+1]=deformedRadius*Math.sin(theta);target[index*3+2]=z+(inside?-thickness*.5:thickness*.5);
  }
}
function notchAt(theta:number){let sum=0;for(let k=0;k<SECTORS;k++){const delta=Math.atan2(Math.sin(theta-TAU*k/SECTORS),Math.cos(theta-TAU*k/SECTORS));sum+=Math.exp(-(delta*delta)/(2*.05*.05));}return sum;}
/** Horseshoe gonad as a soft arched ribbon (u along, v across) lying under the subumbrella. */
function gonadGeometry(R:number,angle:number,undersurface:(radius:number)=>number,lift:number){
  const along=40,across=6,positions:number[]=[],tissue:number[]=[],indices:number[]=[],width=.075*R;
  for(let n=0;n<=along;n++)for(let m=0;m<=across;m++){
    const u=n/along,v=m/across,s=THREE.MathUtils.lerp(-.78*Math.PI,.78*Math.PI,u);
    const cx=.28*R+.135*R*Math.cos(s),cy=.10*R*Math.sin(s),nx=Math.cos(s),ny=Math.sin(s)*.10/.135,nl=Math.hypot(nx,ny)||1;
    const off=(v-.5)*width*(1-.35*Math.abs(2*u-1)),x=cx+nx/nl*off,y=cy+ny/nl*off,radius=Math.hypot(x,y);
    // Arched cross-section and gentle folds give volume without a hard tube silhouette.
    const z=undersurface(radius)+lift-.018*R*Math.sin(Math.PI*v)-.004*R*Math.sin(u*34)*Math.sin(Math.PI*v);
    positions.push(x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle),z);tissue.push(.7,u,v);
  }
  for(let n=0;n<along;n++)for(let m=0;m<across;m++){const a=n*(across+1)+m,b=a+1,c=a+across+1,d=c+1;indices.push(a,c,b,b,c,d);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('aTissue',new THREE.Float32BufferAttribute(tissue,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function addInternals(group:THREE.Group,diameter:number){
  const R=diameter*.5;
  // A: mauve/violet/pink organs (MarLIN); C: exact tint and opacity (≤ .35).
  const gonadMaterial=installTissueShading(new THREE.MeshStandardMaterial({color:'#bfa1b8',roughness:.5,metalness:0,transparent:true,opacity:1,side:THREE.DoubleSide,depthWrite:false}),{kind:'gonad',centerAlpha:.24,edgeAlpha:.35,fresnelPower:2,scatter:.55,scatterPower:3,distortion:.25});
  const internals=new THREE.Group();internals.name='aurelia-internal-anatomy';group.add(internals);
  const undersurface=(radius:number)=>-.16*diameter*Math.pow(radius/R,1.55)-diameter*(.005+.045*Math.pow(1-radius/R,1.8))*.5;
  for(let k=0;k<4;k++){const mesh=new THREE.Mesh(gonadGeometry(R,k*Math.PI*.5,undersurface,-diameter*.004),gonadMaterial);mesh.name=`aurelia-gonad-${k}`;mesh.renderOrder=2;internals.add(mesh);}
  // Radial and ring canals are no longer tubes: they are a grazing-light band pattern in the subumbrella shader.
  internals.userData.radialCanals={main:16,branched:8,ring:1,representation:'subumbrella band alpha'};
  return {group:internals,materials:[gonadMaterial]};
}

function oralGeometry(){const segments=16,across=10,count=(segments+1)*(across+1),positions=new Float32Array(count*3),tissue=new Float32Array(count*3),indices:number[]=[];for(let j=0;j<segments;j++)for(let i=0;i<across;i++){const a=j*(across+1)+i,b=a+1,c=a+across+1,d=c+1;indices.push(a,c,b,b,c,d);}for(let j=0;j<=segments;j++)for(let i=0;i<=across;i++){const at=(j*(across+1)+i)*3;tissue[at]=.55+.45*Math.abs(2*i/across-1);tissue[at+1]=j/segments;tissue[at+2]=i/across;}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aTissue',new THREE.BufferAttribute(tissue,3));geometry.setIndex(indices);return {geometry,segments,across};}
type PbdChain={nodes:Float32Array;previous:Float32Array;rest:number;count:number};
function makePbdChain(count:number,rest:number){const nodes=new Float32Array(count*3),previous=new Float32Array(count*3);for(let i=0;i<count;i++){nodes[i*3+2]=previous[i*3+2]=-i*rest;}return {nodes,previous,rest,count};}
/** Verlet/PBD secondary chain: 4 constraint passes, fixed 120Hz, with a rooted first node. */
function stepPbd(chain:PbdChain,rootX:number,rootY:number,rootZ:number,dt:number,flowX:number,flowY:number,flowZ:number,coupling?:{sample:AureliaFlowSampler;time:number;drag:number;restore:number}){const d=Math.min(Math.max(dt,0),1/30),d2=d*d;chain.nodes[0]=rootX;chain.nodes[1]=rootY;chain.nodes[2]=rootZ;chain.previous[0]=rootX;chain.previous[1]=rootY;chain.previous[2]=rootZ;for(let i=1;i<chain.count;i++){const at=i*3,x=chain.nodes[at],y=chain.nodes[at+1],z=chain.nodes[at+2];let ax=flowX,ay=flowY,az=flowZ;if(coupling){const u=coupling.sample(x,y,z,coupling.time,pbdFlow);ax+=coupling.drag*u.x-coupling.restore*(x-rootX);ay+=coupling.drag*u.y-coupling.restore*(y-rootY);az+=coupling.drag*u.z-coupling.restore*(z-(rootZ-i*chain.rest));}chain.nodes[at]=x+(x-chain.previous[at])*.84+ax*d2;chain.nodes[at+1]=y+(y-chain.previous[at+1])*.84+ay*d2;chain.nodes[at+2]=z+(z-chain.previous[at+2])*.84+az*d2;chain.previous[at]=x;chain.previous[at+1]=y;chain.previous[at+2]=z;}for(let pass=0;pass<4;pass++)for(let i=1;i<chain.count;i++){const a=(i-1)*3,b=i*3,dx=chain.nodes[b]-chain.nodes[a],dy=chain.nodes[b+1]-chain.nodes[a+1],dz=chain.nodes[b+2]-chain.nodes[a+2],length=Math.hypot(dx,dy,dz)||1,scale=chain.rest/length;if(i===1){chain.nodes[b]=chain.nodes[a]+dx*scale;chain.nodes[b+1]=chain.nodes[a+1]+dy*scale;chain.nodes[b+2]=chain.nodes[a+2]+dz*scale;}else{const correction=(1-scale)*.5;chain.nodes[a]+=dx*correction;chain.nodes[a+1]+=dy*correction;chain.nodes[a+2]+=dz*correction;chain.nodes[b]-=dx*correction;chain.nodes[b+1]-=dy*correction;chain.nodes[b+2]-=dz*correction;}}}
const pbdFlow=new THREE.Vector3();
/** J1: each arm is a curled, gently frilled gutter (smooth across the width), not a zig-zag folded strip. */
function updateArm(position:Float32Array,geometry:{segments:number;across:number},diameter:number,angle:number,time:number,margin:number,chain:PbdChain){const R=diameter*.5,sideX=Math.cos(angle+Math.PI*.5),sideY=Math.sin(angle+Math.PI*.5),outX=Math.cos(angle),outY=Math.sin(angle);for(let j=0;j<=geometry.segments;j++){const s=j/geometry.segments,f=s*(chain.count-1),n0=Math.min(chain.count-2,Math.floor(f)),w=f-n0,a=n0*3,b=a+3,cx=chain.nodes[a]+(chain.nodes[b]-chain.nodes[a])*w,cy=chain.nodes[a+1]+(chain.nodes[b+1]-chain.nodes[a+1])*w,cz=chain.nodes[a+2]+(chain.nodes[b+2]-chain.nodes[a+2])*w,width=.085*R*Math.pow(1-s,.9)+.016*R,curl=.95+.35*s;for(let i=0;i<=geometry.across;i++){const u=i/geometry.across-.5,edge=Math.abs(2*u),theta=u*Math.PI*curl,frill=.010*R*edge*edge*Math.sin(s*TAU*2.2+Math.sign(u)*1.4+angle*3+.4*margin),side=width*Math.sin(theta)*.62,depth=width*.42*(1-Math.cos(theta))+frill,at=(j*(geometry.across+1)+i)*3;position[at]=cx+sideX*side+outX*depth;position[at+1]=cy+sideY*side+outY*depth;position[at+2]=cz+.006*R*edge*Math.sin(s*TAU*1.5+angle);}}}

function tentacleGeometry(count:number){const nodes=4,positions=new Float32Array(count*(nodes-1)*2*3);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));return {geometry,count,nodes};}
function updateTentacles(out:Float32Array,count:number,nodes:number,diameter:number,margin:number,seed:number,guides:PbdChain[]){const random=rng(seed),R=diameter*.5;let cursor=0;for(let i=0;i<count;i++){const theta=TAU*(i/count)+(random()-.5)*.025,guide=guides[Math.floor(i*guides.length/count)],lengthGain=.45+.50*random(),rootR=R*(.98-.006*notchAt(theta))*(1-.145*margin);for(let n=1;n<nodes;n++){const source=Math.min(guide.count-1,n)*3,previous=Math.min(guide.count-1,n-1)*3;out[cursor++]=rootR*Math.cos(theta)+guide.nodes[previous]-guide.nodes[0];out[cursor++]=rootR*Math.sin(theta)+guide.nodes[previous+1]-guide.nodes[1];out[cursor++]=-.16*diameter-margin*.02*R+(guide.nodes[previous+2]-guide.nodes[2])*lengthGain;out[cursor++]=rootR*Math.cos(theta)+guide.nodes[source]-guide.nodes[0];out[cursor++]=rootR*Math.sin(theta)+guide.nodes[source+1]-guide.nodes[1];out[cursor++]=-.16*diameter-margin*.02*R+(guide.nodes[source+2]-guide.nodes[2])*lengthGain;}}
}

/** Reusable local-space Aurelia mesh. It does not translate or orient its root; callers own trajectory and world-axis conversion. */
export function createAurelia(options:AureliaOptions):AureliaInstance {
  if(!Number.isFinite(options.diameter)||options.diameter<=0)throw new RangeError('Aurelia diameter must be a positive number in metres.');
  const group=new THREE.Group();group.name='aurelia';group.userData.localForward='+Z apex / propulsion';
  const dynamics=createAureliaDynamics(options),bell=bellGeometry(options.diameter);
  // J1 (2026-09-27): colourless bell shaped by fresnel edge + back-light scattering, no transmission pass, no emission.
  // Fixed pass order (renderOrder): 1 exumbrella back → 2 gonads → 3 subumbrella (canal bands) → 4 arms/tentacles/rhopalia → 5 exumbrella front.
  const bellShading={kind:'bell' as const,centerAlpha:.03,edgeAlpha:.30,fresnelPower:3.0,scatter:.85,scatterPower:2.4,distortion:.35};
  const bellMaterial=installTissueShading(new THREE.MeshStandardMaterial({color:'#e3e8ea',roughness:.24,metalness:0,transparent:true,opacity:1,side:THREE.FrontSide,depthWrite:false}),bellShading);
  const bellBackMaterial=installTissueShading(new THREE.MeshStandardMaterial({color:'#e3e8ea',roughness:.24,metalness:0,transparent:true,opacity:.45,side:THREE.BackSide,depthWrite:false}),bellShading);
  const subumbrellaMaterial=installTissueShading(new THREE.MeshStandardMaterial({color:'#e6e6ea',roughness:.3,metalness:0,transparent:true,opacity:1,side:THREE.DoubleSide,depthWrite:false}),{kind:'subumbrella',centerAlpha:.012,edgeAlpha:.10,fresnelPower:3,scatter:.45,scatterPower:2.4,distortion:.35,canalColor:'#b99db3',canalAlpha:.16});
  const bellBack=new THREE.Mesh(bell.exumbrella,bellBackMaterial);bellBack.name='aurelia-exumbrella-back';bellBack.renderOrder=1;group.add(bellBack);
  const subumbrella=new THREE.Mesh(bell.subumbrella,subumbrellaMaterial);subumbrella.name='aurelia-subumbrella';subumbrella.renderOrder=3;group.add(subumbrella);
  const bellMesh=new THREE.Mesh(bell.exumbrella,bellMaterial);bellMesh.name='aurelia-closed-bell';bellMesh.renderOrder=5;group.add(bellMesh);
  const internals=addInternals(group,options.diameter);
  const materials:THREE.Material[]=[bellMaterial,bellBackMaterial,subumbrellaMaterial,...internals.materials];
  const armMaterial=installTissueShading(new THREE.MeshStandardMaterial({color:'#d3c2cc',roughness:.45,metalness:0,transparent:true,opacity:1,side:THREE.DoubleSide,depthWrite:false}),{kind:'arm',centerAlpha:.10,edgeAlpha:.36,fresnelPower:2,scatter:.6,scatterPower:2.4,distortion:.3});materials.push(armMaterial);
  const arms:Array<{mesh:THREE.Mesh;shape:ReturnType<typeof oralGeometry>;angle:number;chain:PbdChain}> = [];for(let k=0;k<4;k++){const shape=oralGeometry(),mesh=new THREE.Mesh(shape.geometry,armMaterial),chain=makePbdChain(8,options.diameter*.5*.095);mesh.name=`aurelia-oral-arm-${k}`;mesh.renderOrder=4;group.add(mesh);arms.push({mesh,shape,angle:k*Math.PI*.5+Math.PI*.25,chain});}
  // Lit and distance-faded: at the scene's 2.5–4 m viewing distance the 128 lines must not read as a white skirt.
  const tentacles=tentacleGeometry(128),tentacleMaterial=createTentacleMaterial({color:'#dcd8de',opacity:.22,fadeNear:.5,fadeFar:4.6});materials.push(tentacleMaterial);const tentacleLines=new THREE.LineSegments(tentacles.geometry,tentacleMaterial);tentacleLines.name='aurelia-marginal-tentacles-128';tentacleLines.renderOrder=4;group.add(tentacleLines);
  const rhopalia=new THREE.Group();rhopalia.name='aurelia-rhopalia-regions-8';const rhopaliumMaterial=new THREE.MeshStandardMaterial({color:'#b7a3b1',roughness:.5,metalness:0,transparent:true,opacity:.30,depthWrite:false});materials.push(rhopaliumMaterial);for(let k=0;k<8;k++){const theta=TAU*k/8,r=options.diameter*.493,mesh=new THREE.Mesh(new THREE.SphereGeometry(options.diameter*.008,8,6),rhopaliumMaterial);mesh.name=`aurelia-rhopalium-${k}`;mesh.renderOrder=4;mesh.position.set(r*Math.cos(theta),r*Math.sin(theta),-options.diameter*.16);rhopalia.add(mesh);}group.add(rhopalia);
  const guides=Array.from({length:32},()=>makePbdChain(4,options.diameter*.5*.065));
  let disposed=false,lastElapsed=0,pbdElapsed=0;
  const initializeChain=(chain:PbdChain,x:number,y:number,z:number)=>{for(let i=0;i<chain.count;i++){const at=i*3;chain.nodes[at]=chain.previous[at]=x;chain.nodes[at+1]=chain.previous[at+1]=y;chain.nodes[at+2]=chain.previous[at+2]=z-i*chain.rest;}};
  const resetPbd=()=>{for(const arm of arms)initializeChain(arm.chain,options.diameter*.125*Math.cos(arm.angle),options.diameter*.125*Math.sin(arm.angle),-options.diameter*.11);for(let i=0;i<guides.length;i++){const theta=TAU*i/guides.length;initializeChain(guides[i],options.diameter*.49*Math.cos(theta),options.diameter*.49*Math.sin(theta),-options.diameter*.16);}};
  const advancePbd=(time:number,controls:AureliaControls)=>{
    const pulse=sampleAureliaKinematics(time,options,controls.activity??1).contraction;
    // J3: with a sampler, arms/tentacles read the unified flow (background + wake rings, body-relative) per node;
    // the legacy constant relativeFlow acceleration is kept only for callers without a sampler.
    const sampler=controls.sampleFlow,flow=sampler?undefined:controls.relativeFlow,fx=(flow?.x??0)*.8,fy=(flow?.y??0)*.8,fz=(flow?.z??0)*.8;
    const armCoupling=sampler?{sample:sampler,time,...APPENDAGE_FLOW.arm}:undefined,tentacleCoupling=sampler?{sample:sampler,time,...APPENDAGE_FLOW.tentacle}:undefined;
    for(const arm of arms){const r=options.diameter*.125*(1-.07*pulse);stepPbd(arm.chain,r*Math.cos(arm.angle),r*Math.sin(arm.angle),-options.diameter*(.11+.018*pulse),STEP,fx,fy,fz-.02*options.diameter,armCoupling);}
    for(let i=0;i<guides.length;i++){const theta=TAU*i/guides.length,r=options.diameter*.49*(1-.145*pulse);stepPbd(guides[i],r*Math.cos(theta),r*Math.sin(theta),-options.diameter*(.16+.05*pulse),STEP,fx,fy,fz-.012*options.diameter,tentacleCoupling);}
  };
  resetPbd();
  const update=(elapsed:number,controls:AureliaControls={})=>{if(disposed)return;const safeElapsed=Number.isFinite(elapsed)?Math.max(0,elapsed):0;if(safeElapsed<lastElapsed){dynamics.reset();resetPbd();pbdElapsed=0;}const d=dynamics.update(safeElapsed,controls),position=bell.geometry.getAttribute('position') as THREE.BufferAttribute;while(pbdElapsed+STEP<=safeElapsed+1e-9){advancePbd(pbdElapsed+STEP,controls);pbdElapsed+=STEP;}lastElapsed=safeElapsed;setBellPositions(position.array as Float32Array,bell.vertices,options.diameter,d);position.needsUpdate=true;bell.geometry.computeVertexNormals();internals.group.scale.set(1-.07*d.marginResponse,1-.07*d.marginResponse,1);internals.group.position.z=-options.diameter*.018*d.marginResponse;for(const arm of arms){const attr=arm.shape.geometry.getAttribute('position') as THREE.BufferAttribute;updateArm(attr.array as Float32Array,arm.shape,options.diameter,arm.angle,safeElapsed,d.marginResponse,arm.chain);attr.needsUpdate=true;arm.shape.geometry.computeVertexNormals();}const tentaclePosition=tentacles.geometry.getAttribute('position') as THREE.BufferAttribute;updateTentacles(tentaclePosition.array as Float32Array,tentacles.count,tentacles.nodes,options.diameter,d.marginResponse,options.seed,guides);tentaclePosition.needsUpdate=true;for(let k=0;k<rhopalia.children.length;k++){const theta=TAU*k/8,r=options.diameter*.493*(1-.145*d.marginResponse);rhopalia.children[k].position.set(r*Math.cos(theta),r*Math.sin(theta),-options.diameter*.16-.10*options.diameter*d.marginResponse);}group.userData.aureliaDiagnostics=d;let tipR=0,tipZ=0;for(const arm of arms){const at=(arm.chain.count-1)*3;tipR+=Math.hypot(arm.chain.nodes[at],arm.chain.nodes[at+1])/arms.length;tipZ+=arm.chain.nodes[at+2]/arms.length;}group.userData.aureliaAppendage={armTipRadial:tipR,armTipZ:tipZ};};
  update(0);
  return {group,update,dispose(){if(disposed)return;disposed=true;group.removeFromParent();group.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line)object.geometry.dispose();});bell.geometry.dispose();for(const material of materials)material.dispose();group.clear();}};
}

/**
 * Test/inspection fixture: the wake of ONE stationary jelly at the local origin (axis +Z), built from its own
 * beats with the same ringFromBeat/addRingVelocity used by the scene's sampleFlow. Not a second wake model.
 * `impulse` defaults to the CreatureMotion stroke proxy (PULSE_GAIN .63 · r³ · peak² · ½ · T_contract).
 */
export function createLocalWakeSampler(options:Pick<AureliaOptions,'diameter'|'frequency'|'phase'|'seed'>,activity=1,impulse=(frequency:number)=>{const r=options.diameter/2,peak=.5*Math.PI*frequency/AURELIA_PULSE.contract;return .63*r**3*peak**2*.5*(AURELIA_PULSE.contract/frequency)*activity;}):AureliaFlowSampler&{rings:VortexRing[]}{
  const rings:VortexRing[]=[];let scanned=0,lastCycle=-1;const p=new THREE.Vector3();
  const extend=(time:number)=>{while(scanned<=time){const k=sampleAureliaKinematics(scanned,options,activity);
    if(lastCycle>=0&&k.cycle<lastCycle)rings.push(ringFromBeat({name:'self',kind:'contraction',time:scanned,position:[0,0,0],axis:[0,0,1],strength:impulse(k.frequency),diameter:options.diameter,frequency:k.frequency}));
    if(lastCycle>=0&&lastCycle<AURELIA_PULSE.contract&&k.cycle>=AURELIA_PULSE.contract)rings.push(ringFromBeat({name:'self',kind:'relaxation',time:scanned,position:[0,0,0],axis:[0,0,1],strength:impulse(k.frequency),diameter:options.diameter,frequency:k.frequency}));
    lastCycle=k.cycle;scanned+=STEP;}};
  const sampler=((x:number,y:number,z:number,time:number,out:THREE.Vector3)=>{extend(time);out.set(0,0,0);p.set(x,y,z);for(let i=rings.length-1;i>=0;i--){const r=rings[i];if(r.time>time)continue;if(time-r.time>=r.life*1.5)break;addRingVelocity(r,p,time,out);}return out;}) as AureliaFlowSampler&{rings:VortexRing[]};
  sampler.rings=rings;return sampler;
}
