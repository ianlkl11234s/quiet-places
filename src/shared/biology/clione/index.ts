import * as THREE from 'three';

/** Biological constraints are used for silhouette and timing; force coefficients are scene priors. */
export type ClioneGait='slowhover'|'slowswim'|'glidesink'|'softturn'|'fastescape'|'fasthunt';
/** `phase` accepts a continuously integrated radians value from the trajectory owner. */
export interface ClioneControls { gait?:ClioneGait; previousGait?:ClioneGait; gaitBlend?:number; frequency?:number; turn?:number; phase?:number; }
export interface CreateClioneOptions { length:number; frequency:number; phase:number; seed:number; }
export interface WingForceSample {
  elapsed:number; gait:ClioneGait; frequency:number; phase:number;
  left:THREE.Vector3; right:THREE.Vector3; total:THREE.Vector3;
  leftStroke:number; rightStroke:number; liftMagnitude:number;
}
export interface ClioneDiagnostics {
  length:number; topology:{bodyRings:number; bodySides:number; wingSpanSegments:number; wingChordSegments:number};
  phase:number; gait:ClioneGait; frequency:number; turn:number; wingTipSeparation:number; finite:boolean;
}
export interface Clione {
  group:THREE.Group;
  update(elapsed:number,controls?:ClioneControls):void;
  sampleWingForces(elapsed:number,controls?:ClioneControls):WingForceSample;
  diagnostics():ClioneDiagnostics;
  dispose():void;
}

const TAU=Math.PI*2;
const BODY_PROFILE:[[number,number],[number,number],[number,number],[number,number],[number,number],[number,number],[number,number],[number,number]]=[
  [0,.58],[.12,.82],[.30,1],[.50,.92],[.70,.70],[.86,.42],[.96,.18],[1,.05],
];
const GAITS:Record<ClioneGait,{frequency:number;stroke:number;aoa:number;flex:number;lag:number;rise:number}>={
  slowhover:{frequency:1.35,stroke:75,aoa:39,flex:1,lag:.18,rise:1},
  slowswim:{frequency:1.55,stroke:80,aoa:40,flex:1.07,lag:.21,rise:1.12},
  glidesink:{frequency:0,stroke:0,aoa:0,flex:.35,lag:.1,rise:0},
  softturn:{frequency:1.4,stroke:78,aoa:40,flex:1.08,lag:.22,rise:1},
  fastescape:{frequency:3.65,stroke:88,aoa:48,flex:1.38,lag:.34,rise:1.65},
  fasthunt:{frequency:3.2,stroke:86,aoa:47,flex:1.32,lag:.31,rise:1.52},
};
type GaitSettings=typeof GAITS[ClioneGait];
function blendGait(previous:GaitSettings,current:GaitSettings,amount:number):GaitSettings {
  const t=clamp(amount,0,1);
  return {frequency:current.frequency,stroke:THREE.MathUtils.lerp(previous.stroke,current.stroke,t),aoa:THREE.MathUtils.lerp(previous.aoa,current.aoa,t),flex:THREE.MathUtils.lerp(previous.flex,current.flex,t),lag:THREE.MathUtils.lerp(previous.lag,current.lag,t),rise:THREE.MathUtils.lerp(previous.rise,current.rise,t)};
}

function clamp(value:number,min:number,max:number){return THREE.MathUtils.clamp(value,min,max);}
function smooth(value:number){const t=clamp(value,0,1);return t*t*(3-2*t);}
/** Fritsch-Carlson monotone Hermite interpolation prevents profile overshoot. */
function monotoneProfile(s:number):number {
  const x=clamp(s,0,1), n=BODY_PROFILE.length;
  let i=0;while(i<n-2&&x>BODY_PROFILE[i+1][0])i++;
  const [x0,y0]=BODY_PROFILE[i], [x1,y1]=BODY_PROFILE[i+1], h=x1-x0;
  const slopes=BODY_PROFILE.slice(1).map((point,index)=>(point[1]-BODY_PROFILE[index][1])/(point[0]-BODY_PROFILE[index][0]));
  const tangent=(before:number,after:number)=>before*after<=0?0:2/(1/before+1/after);
  const d0=i===0?slopes[0]:tangent(slopes[i-1],slopes[i]);
  const d1=i===n-2?slopes[n-2]:tangent(slopes[i],slopes[i+1]);
  const t=(x-x0)/h, t2=t*t, t3=t2*t;
  return (2*t3-3*t2+1)*y0+(t3-2*t2+t)*h*d0+(-2*t3+3*t2)*y1+(t3-t2)*h*d1;
}
function bodyGeometry(length:number):THREE.BufferGeometry {
  const rings=40,sides=32,positions:number[]=[],indices:number[]=[];
  for(let ring=0;ring<=rings;ring++){
    const s=ring/rings, radius=length*.128*monotoneProfile(s), z=length*(.5-s);
    for(let side=0;side<sides;side++){const a=TAU*side/sides;positions.push(Math.cos(a)*radius,Math.sin(a)*radius,z);}
  }
  for(let ring=0;ring<rings;ring++)for(let side=0;side<sides;side++){
    const next=(side+1)%sides,a=ring*sides+side,b=ring*sides+next,c=(ring+1)*sides+next,d=(ring+1)*sides+side;indices.push(a,d,b,b,d,c);
  }
  const head=positions.length/3;positions.push(0,0,length*.5);const tail=positions.length/3;positions.push(0,0,-length*.5);
  for(let side=0;side<sides;side++){const next=(side+1)%sides;indices.push(head,side,next);const base=rings*sides;indices.push(tail,base+next,base+side);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function wingChord(u:number):number {
  const a=.33, raw=(u/a)**a*((1-u)/(1-a))**(1-a), peak=1; // beta-like peak normalized analytically at u=a
  return raw/peak;
}
type Wing={sign:number; root:THREE.Group; mesh:THREE.Mesh; positions:Float32Array; geometry:THREE.BufferGeometry; nodes:Record<string,THREE.Group>};
function makeWing(sign:number,length:number,material:THREE.Material):Wing {
  const root=new THREE.Group();root.name=sign>0?'R_WING_ROOT':'L_WING_ROOT';
  const nodes:Record<string,THREE.Group>={};
  for(const name of ['MID','TIP','LEAD','TRAIL']){const node=new THREE.Group();node.name=`${sign>0?'R':'L'}_WING_${name}`;root.add(node);nodes[name]=node;}
  const span=10,chord=6,vertices=(span+1)*(chord+1),positions=new Float32Array(vertices*2*3),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const indices:number[]=[];for(let u=0;u<span;u++)for(let v=0;v<chord;v++){const a=u*(chord+1)+v,b=a+1,c=a+chord+2,d=a+chord+1;indices.push(a,b,d,b,c,d,a+vertices,d+vertices,b+vertices,b+vertices,d+vertices,c+vertices);}
  for(let u=0;u<span;u++)for(const v of [0,chord]){const a=u*(chord+1)+v,b=(u+1)*(chord+1)+v;indices.push(a,a+vertices,b,b,b+vertices,a+vertices);}
  for(let v=0;v<chord;v++)for(const u of [0,span]){const a=u*(chord+1)+v,b=a+1;indices.push(a,b,a+vertices,b,b+vertices,a+vertices);}
  geometry.setIndex(indices);geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(positions.length),3));
  const mesh=new THREE.Mesh(geometry,material);mesh.name=sign>0?'R_WING_SURFACE':'L_WING_SURFACE';mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  return {sign,root,mesh,positions,geometry,nodes};
}
function gaitState(elapsed:number,base:CreateClioneOptions,controls?:ClioneControls){
  const gait=controls?.gait??'slowhover', current=GAITS[gait],setting=controls?.previousGait?blendGait(GAITS[controls.previousGait],current,controls.gaitBlend??1):current;
  // Constructor frequency customizes the default slow hover; a named gait owns its own timing.
  const requested=controls?.frequency??(controls?.gait?setting.frequency:(base.frequency>0?base.frequency:setting.frequency));
  const frequency=clamp(Number.isFinite(requested)?requested:setting.frequency,0,5);
  const generated=TAU*frequency*(Number.isFinite(elapsed)?elapsed:0)+base.phase+((base.seed>>>0)%997)*.006303;
  const phase=Number.isFinite(controls?.phase)?controls!.phase!:generated;
  return {gait,setting,frequency,phase,turn:clamp(controls?.turn??0,-1,1)};
}
function deformWing(wing:Wing,length:number,state:ReturnType<typeof gaitState>){
  const spanSegments=10,chordSegments=6,{sign,positions}=wing,{setting,phase,turn}=state;
  const amplitude=THREE.MathUtils.degToRad(setting.stroke), asymmetry=1+sign*.065*turn;
  const span=length*.32,rootX=sign*length*.112,baseZ=length*.16;
  const layerOffset=(spanSegments+1)*(chordSegments+1);
  for(let i=0;i<=spanSegments;i++)for(let j=0;j<=chordSegments;j++){
    const u=i/spanSegments,v=j/chordSegments,local=phase-sign*.028*turn-setting.lag*v;
    const stroke=amplitude*asymmetry*(.7+.3*smooth(u))*Math.sin(local);
    const pitch=THREE.MathUtils.degToRad(setting.aoa)*Math.tanh(3.1*Math.cos(local));
    const chord=length*(.025+.205*wingChord(u)), trailing=(v-.5)*chord;
    const bend=setting.flex*length*.055*u*u*Math.sin(local-.42);
    // The span rotates through the full sweep: at extremes cos(stroke) pulls tips toward sagittal X=0.
    const x=rootX+sign*(span*u*Math.cos(stroke)+length*.018*Math.sin(Math.PI*u)*Math.sin(local-.2));
    const y=span*u*Math.sin(stroke)+bend+(v-.5)*length*.008*Math.sin(local);
    const z=baseZ+trailing*Math.cos(pitch)-length*.035*u*Math.abs(Math.sin(stroke));
    const thickness=length*.018*(1-.35*u)*(1-.48*v);
    const vertex=i*(chordSegments+1)+j,offset=vertex*3,back=(vertex+layerOffset)*3;
    positions[offset]=x;positions[offset+1]=y+thickness*.5;positions[offset+2]=z+trailing*Math.sin(pitch)*.18;
    positions[back]=x;positions[back+1]=y-thickness*.5;positions[back+2]=z+trailing*Math.sin(pitch)*.18;
  }
  wing.geometry.attributes.position.needsUpdate=true;wing.geometry.computeVertexNormals();wing.geometry.computeBoundingSphere();
  const midStroke=amplitude*.85*Math.sin(phase),tipStroke=amplitude*Math.sin(phase-setting.lag);
  wing.nodes.MID.position.set(rootX+sign*span*.5*Math.cos(midStroke),span*.5*Math.sin(midStroke),baseZ);
  wing.nodes.TIP.position.set(rootX+sign*span*Math.cos(tipStroke),span*Math.sin(tipStroke),baseZ);
  wing.nodes.LEAD.position.set(rootX,0,baseZ+length*.11);wing.nodes.TRAIL.position.set(rootX,0,baseZ-length*.11);
}
function wingForces(length:number,elapsed:number,state:ReturnType<typeof gaitState>):WingForceSample {
  const span=length*.32,rho=1025;
  const one=(sign:number)=>{const force=new THREE.Vector3(),amplitude=THREE.MathUtils.degToRad(state.setting.stroke)*(1+sign*.065*state.turn);for(let element=0;element<8;element++){const u=(element+.5)/8,local=state.phase-sign*.028*state.turn-state.setting.lag*.5;const speed=Math.abs(Math.cos(local))*TAU*state.frequency*span*u*(amplitude/THREE.MathUtils.degToRad(75));const alpha=THREE.MathUtils.degToRad(state.setting.aoa)*Math.tanh(3.1*Math.cos(local));const chord=length*(.025+.205*wingChord(u)),area=chord*span/8,q=.5*rho*speed*speed,cl=1.08*Math.abs(Math.sin(2*alpha)),cd=.23+1.15*Math.sin(alpha)**2,lift=q*cl*area*state.setting.rise;force.add(new THREE.Vector3(sign*(lift*.03*state.turn),-q*cd*area*.08,lift));}return force;};
  const left=one(-1),right=one(1),total=left.clone().add(right);return {elapsed,gait:state.gait,frequency:state.frequency,phase:state.phase,left,right,total,leftStroke:Math.sin(state.phase+.028*state.turn),rightStroke:Math.sin(state.phase-.028*state.turn),liftMagnitude:total.z};
}
/** Geometry-free sampler for the 120 Hz trajectory path; pass its integrated `controls.phase` to lock force and mesh phase. */
export function sampleClioneWingForces(elapsed:number,options:CreateClioneOptions,controls?:ClioneControls):WingForceSample {
  if(!Number.isFinite(options.length)||options.length<=0)throw new RangeError('Clione length must be a positive number in metres.');
  return wingForces(options.length,elapsed,gaitState(elapsed,options,controls));
}
function createInternalMass(length:number):THREE.Mesh {
  const geometry=new THREE.SphereGeometry(1,14,10),material=new THREE.MeshPhysicalMaterial({color:0xb9472e,roughness:.58,metalness:0,transparent:true,opacity:.68,emissive:0x000000,depthWrite:false});
  const mass=new THREE.Mesh(geometry,material);mass.name='CLIONE_VISCERAL_MASS';mass.scale.set(length*.09,length*.072,length*.235);mass.position.z=length*.13;return mass;
}

export function createClione(options:CreateClioneOptions):Clione {
  if(!Number.isFinite(options.length)||options.length<=0)throw new RangeError('Clione length must be a positive number in metres.');
  const length=options.length,group=new THREE.Group();group.name='CLIONE_ROOT';
  const bodyNode=new THREE.Group();bodyNode.name='CLIONE_BODY';const head=new THREE.Group();head.name='CLIONE_HEAD';head.position.z=length*.49;const tail=new THREE.Group();tail.name='CLIONE_TAIL';tail.position.z=-length*.49;group.add(bodyNode,head,tail);
  const bodyMaterial=new THREE.MeshPhysicalMaterial({color:0xddebf0,roughness:.34,metalness:0,transmission:.68,transparent:true,opacity:.32,thickness:length*.025,ior:1.34,emissive:0x000000,side:THREE.DoubleSide,depthWrite:false});
  const body=new THREE.Mesh(bodyGeometry(length),bodyMaterial);body.name='CLIONE_TRANSPARENT_BODY';body.castShadow=true;body.receiveShadow=true;const internal=createInternalMass(length);bodyNode.add(body,internal);
  const headMaterial=new THREE.MeshPhysicalMaterial({color:0xeaf3f2,roughness:.36,transmission:.5,transparent:true,opacity:.36,emissive:0x000000});
  const headMesh=new THREE.Mesh(new THREE.SphereGeometry(length*.075,12,8),headMaterial);headMesh.name='CLIONE_SMALL_HEAD';head.add(headMesh);
  const wingMaterial=new THREE.MeshPhysicalMaterial({color:0xd8eef1,roughness:.3,transmission:.45,transparent:true,opacity:.32,side:THREE.DoubleSide,depthWrite:false,emissive:0x000000});
  const left=makeWing(-1,length,wingMaterial),right=makeWing(1,length,wingMaterial.clone());group.add(left.root,right.root);
  let last=gaitState(0,options),released=false;
  const update=(elapsed:number,controls?:ClioneControls)=>{if(released)return;last=gaitState(elapsed,options,controls);deformWing(left,length,last);deformWing(right,length,last);const pitch=THREE.MathUtils.degToRad((last.setting.rise?2.4:0)*Math.sin(2*last.phase));bodyNode.rotation.x=pitch;};
  const sampleWingForces=(elapsed:number,controls?:ClioneControls):WingForceSample=>sampleClioneWingForces(elapsed,options,controls);
  const diagnostics=():ClioneDiagnostics=>{const tipL=left.nodes.TIP.getWorldPosition(new THREE.Vector3()),tipR=right.nodes.TIP.getWorldPosition(new THREE.Vector3());let finite=true;group.traverse(object=>{finite&&=Number.isFinite(object.position.x)&&Number.isFinite(object.position.y)&&Number.isFinite(object.position.z);});return {length,topology:{bodyRings:40,bodySides:32,wingSpanSegments:10,wingChordSegments:6},phase:last.phase,gait:last.gait,frequency:last.frequency,turn:last.turn,wingTipSeparation:tipL.distanceTo(tipR),finite};};
  update(0);return {group,update,sampleWingForces,diagnostics,dispose(){if(released)return;released=true;for(const material of [bodyMaterial,headMaterial,wingMaterial,internal.material as THREE.Material])material.dispose();(right.mesh.material as THREE.Material).dispose();body.geometry.dispose();headMesh.geometry.dispose();internal.geometry.dispose();left.geometry.dispose();right.geometry.dispose();group.removeFromParent();group.clear();}};
}
