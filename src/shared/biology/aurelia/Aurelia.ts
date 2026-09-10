import * as THREE from 'three';

const TAU=Math.PI*2;
const STEP=1/120;
const SECTORS=8;
const clamp=THREE.MathUtils.clamp;
const modulo=(value:number,divisor:number)=>((value%divisor)+divisor)%divisor;

export interface AureliaOptions { diameter:number; frequency:number; phase:number; seed:number; }
export interface AureliaControls { turn?:number; turnDirection?:number; activity?:number; relativeFlow?:THREE.Vector3; }
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
  if(cycle<.30){const p=cycle/.30;contraction=.5*(1-Math.cos(Math.PI*p));contractionRate=.5*Math.PI*Math.sin(Math.PI*p)/(.30/currentFrequency);}
  else if(cycle<.75){const p=(cycle-.30)/.45;contraction=.5*(1+Math.cos(Math.PI*p));contractionRate=-.5*Math.PI*Math.sin(Math.PI*p)/(.45/currentFrequency);}
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
    for(let k=0;k<SECTORS;k++){const g=Math.cos(TAU*k/SECTORS-direction);onset[k]=-.045*g*turn;amplitude[k]=1+.075*g*Math.abs(turn);}
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
    const elapsedFromRelax=base.cycle<.75?0:(base.cycle-.75)/Math.max(.01,base.frequency);
    // .30 is a scene calibration proxy for post-relaxation contribution, not a universal biological fraction.
    const passiveEnergyRecapture=base.cycle>=.75?.30*peakThrust*Math.exp(-elapsedFromRelax/.38):0;
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

function samplePulse(phase:number,frequency:number):number {const cycle=modulo(phase,TAU)/TAU;if(cycle<.30)return .5*(1-Math.cos(Math.PI*cycle/.30));if(cycle<.75)return .5*(1+Math.cos(Math.PI*(cycle-.30)/.45));return 0;}
function smooth(edge0:number,edge1:number,x:number):number {const p=clamp((x-edge0)/(edge1-edge0),0,1);return p*p*(3-2*p);}
function rng(seed:number){let state=(seed>>>0)||1;return ()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};}

type BellVertex={r:number;theta:number;inside:boolean};
function bellGeometry(diameter:number){
  const radial=20,angular=72,vertices:BellVertex[]=[],positions:number[]=[];
  for(const inside of [false,true])for(let j=0;j<=radial;j++)for(let i=0;i<=angular;i++){const r=j/radial,theta=TAU*(i%angular)/angular;vertices.push({r,theta,inside});positions.push(0,0,0);}
  const row=angular+1,sideCount=(radial+1)*row,indices:number[]=[];
  for(let side=0;side<2;side++)for(let j=0;j<radial;j++)for(let i=0;i<angular;i++){const a=side*sideCount+j*row+i,b=a+1,c=a+row,d=c+1;if(side===0)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);}
  for(let i=0;i<angular;i++){const o0=radial*row+i,o1=o0+1,n0=sideCount+radial*row+i,n1=n0+1;indices.push(o0,n0,o1,o1,n0,n1);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);return {geometry,vertices};
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
    const local=(1-flap)*diagnostic.contraction+flap*(sectorResponse*(1+.025*Math.cos(theta)));
    const deformedRadius=radius*(1-.145*broad*local)*(1+.008*diagnostic.sectorAmplitude[sector]*flap);
    // Velocity-dependent rollout makes the contraction and relaxation paths physically distinct in the actual mesh.
    const z=-H*Math.pow(r,1.55)-.10*R*broad*local-.020*R*flap*sectorVelocity/Math.max(.12,diagnostic.frequency);
    const thickness=diameter*(.005+.045*Math.pow(1-r,1.8));
    target[index*3]=deformedRadius*Math.cos(theta);target[index*3+1]=deformedRadius*Math.sin(theta);target[index*3+2]=z+(inside?-thickness*.5:thickness*.5);
  }
}
function notchAt(theta:number){let sum=0;for(let k=0;k<SECTORS;k++){const delta=Math.atan2(Math.sin(theta-TAU*k/SECTORS),Math.cos(theta-TAU*k/SECTORS));sum+=Math.exp(-(delta*delta)/(2*.05*.05));}return sum;}
function tube(points:THREE.Vector3[],radius:number,material:THREE.Material,name:string){const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(12,points.length*3),radius,6,false),material);mesh.name=name;return mesh;}
function addInternals(group:THREE.Group,diameter:number){
  const R=diameter*.5,gonadMaterial=new THREE.MeshPhysicalMaterial({color:'#cfb7c6',roughness:.45,metalness:0,transparent:true,opacity:.72,side:THREE.DoubleSide,depthWrite:false}),canalMaterial=new THREE.MeshPhysicalMaterial({color:'#e8d9dc',roughness:.5,transparent:true,opacity:.24,side:THREE.DoubleSide,depthWrite:false});
  const internals=new THREE.Group();internals.name='aurelia-internal-anatomy';group.add(internals);
  const undersurface=(radius:number)=>-.16*diameter*Math.pow(radius/R,1.55)-diameter*(.005+.045*Math.pow(1-radius/R,1.8))*.12;
  for(let k=0;k<4;k++){const angle=k*Math.PI*.5,points:THREE.Vector3[]=[];for(let n=0;n<=20;n++){const s=THREE.MathUtils.lerp(-.75*Math.PI,.75*Math.PI,n/20),x=.28*R+.135*R*Math.cos(s),y=.10*R*Math.sin(s),radius=Math.hypot(x,y);points.push(new THREE.Vector3(x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle),undersurface(radius)+diameter*.006));}internals.add(tube(points,.017*R,gonadMaterial,`aurelia-gonad-${k}`));}
  for(let k=0;k<16;k++){const theta=TAU*k/16,points:THREE.Vector3[]=[];for(let n=0;n<=7;n++){const f=n/7,r=R*(.14+.74*f);points.push(new THREE.Vector3(r*Math.cos(theta),r*Math.sin(theta),undersurface(r)+diameter*.004));}internals.add(tube(points,.006*R,canalMaterial,`aurelia-radial-canal-${k}`));if(k%2===0)for(const sign of [-1,1]){const branch:THREE.Vector3[]=[];for(let n=0;n<=6;n++){const f=n/6,r=R*(.52+.38*f),offset=sign*.055*smooth(0,1,f);branch.push(new THREE.Vector3(r*Math.cos(theta+offset),r*Math.sin(theta+offset),undersurface(r)+diameter*.004));}internals.add(tube(branch,.0048*R,canalMaterial,`aurelia-radial-canal-${k}-branch-${sign<0?'left':'right'}`));}}
  const ring:THREE.Vector3[]=[];for(let n=0;n<=48;n++){const theta=TAU*n/48,r=.88*R;ring.push(new THREE.Vector3(r*Math.cos(theta),r*Math.sin(theta),undersurface(r)+diameter*.004));}internals.add(tube(ring,.007*R,canalMaterial,'aurelia-ring-canal'));
  return {group:internals,materials:[gonadMaterial,canalMaterial]};
}

function oralGeometry(){const segments=13,across=8,positions=new Float32Array((segments+1)*(across+1)*3),indices:number[]=[];for(let j=0;j<segments;j++)for(let i=0;i<across;i++){const a=j*(across+1)+i,b=a+1,c=a+across+1,d=c+1;indices.push(a,c,b,b,c,d);}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);return {geometry,segments,across};}
type PbdChain={nodes:Float32Array;previous:Float32Array;rest:number;count:number};
function makePbdChain(count:number,rest:number){const nodes=new Float32Array(count*3),previous=new Float32Array(count*3);for(let i=0;i<count;i++){nodes[i*3+2]=previous[i*3+2]=-i*rest;}return {nodes,previous,rest,count};}
/** Verlet/PBD secondary chain: 4 constraint passes, fixed 120Hz, with a rooted first node. */
function stepPbd(chain:PbdChain,rootX:number,rootY:number,rootZ:number,dt:number,flowX:number,flowY:number,flowZ:number){const d=Math.min(Math.max(dt,0),1/30),d2=d*d;chain.nodes[0]=rootX;chain.nodes[1]=rootY;chain.nodes[2]=rootZ;chain.previous[0]=rootX;chain.previous[1]=rootY;chain.previous[2]=rootZ;for(let i=1;i<chain.count;i++){const at=i*3,x=chain.nodes[at],y=chain.nodes[at+1],z=chain.nodes[at+2];chain.nodes[at]=x+(x-chain.previous[at])*.84+flowX*d2;chain.nodes[at+1]=y+(y-chain.previous[at+1])*.84+flowY*d2;chain.nodes[at+2]=z+(z-chain.previous[at+2])*.84+flowZ*d2;chain.previous[at]=x;chain.previous[at+1]=y;chain.previous[at+2]=z;}for(let pass=0;pass<4;pass++)for(let i=1;i<chain.count;i++){const a=(i-1)*3,b=i*3,dx=chain.nodes[b]-chain.nodes[a],dy=chain.nodes[b+1]-chain.nodes[a+1],dz=chain.nodes[b+2]-chain.nodes[a+2],length=Math.hypot(dx,dy,dz)||1,scale=chain.rest/length;if(i===1){chain.nodes[b]=chain.nodes[a]+dx*scale;chain.nodes[b+1]=chain.nodes[a+1]+dy*scale;chain.nodes[b+2]=chain.nodes[a+2]+dz*scale;}else{const correction=(1-scale)*.5;chain.nodes[a]+=dx*correction;chain.nodes[a+1]+=dy*correction;chain.nodes[a+2]+=dz*correction;chain.nodes[b]-=dx*correction;chain.nodes[b+1]-=dy*correction;chain.nodes[b+2]-=dz*correction;}}}
function updateArm(position:Float32Array,geometry:{segments:number;across:number},diameter:number,angle:number,time:number,margin:number,chain:PbdChain){const R=diameter*.5,sideX=Math.cos(angle+Math.PI*.5),sideY=Math.sin(angle+Math.PI*.5),rootX=.25*R*Math.cos(angle),rootY=.25*R*Math.sin(angle);for(let j=0;j<=geometry.segments;j++){const s=j/geometry.segments,node=Math.min(chain.count-1,Math.round(s*(chain.count-1))),base=node*3,width=(.10*R*Math.pow(1-s,1.05)+.014*R);for(let i=0;i<=geometry.across;i++){const u=i/geometry.across-.5,frill=.018*R*Math.sin(s*TAU*3+i*Math.PI),at=(j*(geometry.across+1)+i)*3;position[at]=chain.nodes[base]+sideX*(u*2*width+frill);position[at+1]=chain.nodes[base+1]+sideY*(u*2*width+frill);position[at+2]=chain.nodes[base+2]+.018*R*Math.sin(u*Math.PI*2+s*TAU*2);}}}

function tentacleGeometry(count:number){const nodes=4,positions=new Float32Array(count*(nodes-1)*2*3);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));return {geometry,count,nodes};}
function updateTentacles(out:Float32Array,count:number,nodes:number,diameter:number,margin:number,seed:number,guides:PbdChain[]){const random=rng(seed),R=diameter*.5;let cursor=0;for(let i=0;i<count;i++){const theta=TAU*(i/count)+(random()-.5)*.025,guide=guides[Math.floor(i*guides.length/count)],lengthGain=.45+.50*random(),rootR=R*(.98-.006*notchAt(theta))*(1-.145*margin);for(let n=1;n<nodes;n++){const source=Math.min(guide.count-1,n)*3,previous=Math.min(guide.count-1,n-1)*3;out[cursor++]=rootR*Math.cos(theta)+guide.nodes[previous]-guide.nodes[0];out[cursor++]=rootR*Math.sin(theta)+guide.nodes[previous+1]-guide.nodes[1];out[cursor++]=-.16*diameter-margin*.02*R+(guide.nodes[previous+2]-guide.nodes[2])*lengthGain;out[cursor++]=rootR*Math.cos(theta)+guide.nodes[source]-guide.nodes[0];out[cursor++]=rootR*Math.sin(theta)+guide.nodes[source+1]-guide.nodes[1];out[cursor++]=-.16*diameter-margin*.02*R+(guide.nodes[source+2]-guide.nodes[2])*lengthGain;}}
}

/** Reusable local-space Aurelia mesh. It does not translate or orient its root; callers own trajectory and world-axis conversion. */
export function createAurelia(options:AureliaOptions):AureliaInstance {
  if(!Number.isFinite(options.diameter)||options.diameter<=0)throw new RangeError('Aurelia diameter must be a positive number in metres.');
  const group=new THREE.Group();group.name='aurelia';group.userData.localForward='+Z apex / propulsion';
  const dynamics=createAureliaDynamics(options),bell=bellGeometry(options.diameter),bellMaterial=new THREE.MeshPhysicalMaterial({color:'#dbe4e6',roughness:.26,metalness:0,transparent:true,opacity:.42,side:THREE.DoubleSide,depthWrite:false,transmission:.72,ior:1.35,thickness:options.diameter*.025});
  const bellMesh=new THREE.Mesh(bell.geometry,bellMaterial);bellMesh.name='aurelia-closed-bell';bellMesh.renderOrder=2;group.add(bellMesh);
  const internals=addInternals(group,options.diameter);
  const materials:THREE.Material[]=[bellMaterial,...internals.materials];
  const armMaterial=new THREE.MeshPhysicalMaterial({color:'#d8cdd2',roughness:.48,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false});materials.push(armMaterial);
  const arms:Array<{mesh:THREE.Mesh;shape:ReturnType<typeof oralGeometry>;angle:number;chain:PbdChain}> = [];for(let k=0;k<4;k++){const shape=oralGeometry(),mesh=new THREE.Mesh(shape.geometry,armMaterial),chain=makePbdChain(8,options.diameter*.5*.095);mesh.name=`aurelia-oral-arm-${k}`;group.add(mesh);arms.push({mesh,shape,angle:k*Math.PI*.5+Math.PI*.25,chain});}
  const tentacles=tentacleGeometry(128),tentacleMaterial=new THREE.LineBasicMaterial({color:'#d9d8df',transparent:true,opacity:.16,depthWrite:false});materials.push(tentacleMaterial);const tentacleLines=new THREE.LineSegments(tentacles.geometry,tentacleMaterial);tentacleLines.name='aurelia-marginal-tentacles-128';group.add(tentacleLines);
  const rhopalia=new THREE.Group();rhopalia.name='aurelia-rhopalia-regions-8';const rhopaliumMaterial=new THREE.MeshBasicMaterial({color:'#baa5b5',transparent:true,opacity:.46,side:THREE.DoubleSide,depthWrite:false});materials.push(rhopaliumMaterial);for(let k=0;k<8;k++){const theta=TAU*k/8,r=options.diameter*.493,mesh=new THREE.Mesh(new THREE.SphereGeometry(options.diameter*.012,6,4),rhopaliumMaterial);mesh.name=`aurelia-rhopalium-${k}`;mesh.position.set(r*Math.cos(theta),r*Math.sin(theta),-options.diameter*.16);rhopalia.add(mesh);}group.add(rhopalia);
  const guides=Array.from({length:32},()=>makePbdChain(4,options.diameter*.5*.065));
  let disposed=false,lastElapsed=0,pbdElapsed=0;
  const initializeChain=(chain:PbdChain,x:number,y:number,z:number)=>{for(let i=0;i<chain.count;i++){const at=i*3;chain.nodes[at]=chain.previous[at]=x;chain.nodes[at+1]=chain.previous[at+1]=y;chain.nodes[at+2]=chain.previous[at+2]=z-i*chain.rest;}};
  const resetPbd=()=>{for(const arm of arms)initializeChain(arm.chain,options.diameter*.125*Math.cos(arm.angle),options.diameter*.125*Math.sin(arm.angle),-options.diameter*.11);for(let i=0;i<guides.length;i++){const theta=TAU*i/guides.length;initializeChain(guides[i],options.diameter*.49*Math.cos(theta),options.diameter*.49*Math.sin(theta),-options.diameter*.16);}};
  const advancePbd=(time:number,controls:AureliaControls)=>{
    const pulse=sampleAureliaKinematics(time,options,controls.activity??1).contraction;
    const flow=controls.relativeFlow,fx=(flow?.x??0)*.8,fy=(flow?.y??0)*.8,fz=(flow?.z??0)*.8;
    for(const arm of arms){const r=options.diameter*.125*(1-.07*pulse);stepPbd(arm.chain,r*Math.cos(arm.angle),r*Math.sin(arm.angle),-options.diameter*(.11+.018*pulse),STEP,fx,fy,fz-.02*options.diameter);}
    for(let i=0;i<guides.length;i++){const theta=TAU*i/guides.length,r=options.diameter*.49*(1-.145*pulse);stepPbd(guides[i],r*Math.cos(theta),r*Math.sin(theta),-options.diameter*(.16+.05*pulse),STEP,fx,fy,fz-.012*options.diameter);}
  };
  resetPbd();
  const update=(elapsed:number,controls:AureliaControls={})=>{if(disposed)return;const safeElapsed=Number.isFinite(elapsed)?Math.max(0,elapsed):0;if(safeElapsed<lastElapsed){dynamics.reset();resetPbd();pbdElapsed=0;}const d=dynamics.update(safeElapsed,controls),position=bell.geometry.getAttribute('position') as THREE.BufferAttribute;while(pbdElapsed+STEP<=safeElapsed+1e-9){advancePbd(pbdElapsed+STEP,controls);pbdElapsed+=STEP;}lastElapsed=safeElapsed;setBellPositions(position.array as Float32Array,bell.vertices,options.diameter,d);position.needsUpdate=true;bell.geometry.computeVertexNormals();internals.group.scale.set(1-.07*d.marginResponse,1-.07*d.marginResponse,1);internals.group.position.z=-options.diameter*.018*d.marginResponse;for(const arm of arms){const attr=arm.shape.geometry.getAttribute('position') as THREE.BufferAttribute;updateArm(attr.array as Float32Array,arm.shape,options.diameter,arm.angle,safeElapsed,d.marginResponse,arm.chain);attr.needsUpdate=true;arm.shape.geometry.computeVertexNormals();}const tentaclePosition=tentacles.geometry.getAttribute('position') as THREE.BufferAttribute;updateTentacles(tentaclePosition.array as Float32Array,tentacles.count,tentacles.nodes,options.diameter,d.marginResponse,options.seed,guides);tentaclePosition.needsUpdate=true;for(let k=0;k<rhopalia.children.length;k++){const theta=TAU*k/8,r=options.diameter*.493*(1-.145*d.marginResponse);rhopalia.children[k].position.set(r*Math.cos(theta),r*Math.sin(theta),-options.diameter*.16-.10*options.diameter*d.marginResponse);}group.userData.aureliaDiagnostics=d;};
  update(0);
  return {group,update,dispose(){if(disposed)return;disposed=true;group.removeFromParent();group.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line)object.geometry.dispose();});for(const material of materials)material.dispose();group.clear();}};
}
