import * as THREE from 'three';
import {createPlantGeometry} from './PlantGeometry.ts';

const STEP=1/60,UP=new THREE.Vector3(0,1,0);
const hash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
function noise(t:number,seed:number,period:number){const x=t/period,i=Math.floor(x),f=x-i;return THREE.MathUtils.lerp(hash(i+seed),hash(i+seed+1),f*f*(3-2*f))*2-1;}
function airflow(t:number){
 const gust=THREE.MathUtils.smoothstep(noise(t,19,11),-.15,.65);
 return new THREE.Vector3(noise(t,41,7),.08*noise(t,73,4),noise(t,109,13)).multiplyScalar(.018+.075*gust);
}
type Diagnostics={hits:number,releases:number,visibleDrops:number,maxAngle:number,maxStemAngle:number,maxWetness:number};
export function createAfterlightPlantPhysics(){
 const geometry=createPlantGeometry(),{root,joints,leaves}=geometry;
 root.name='Afterlight_LivingPlants';
 const state=joints.map(()=>({angle:new THREE.Vector2(),velocity:new THREE.Vector2(),force:new THREE.Vector2(),wetness:.26,waterLoad:0}));
 const leafByJoint=new Map(leaves.map(l=>[l.jointIndex,l]));
 const dryColors=leaves.map(l=>l.mesh.material.color.clone());
 const stemMaterials=new Map<THREE.MeshStandardMaterial,{color:THREE.Color,roughness:number}>();
 root.traverse(o=>{if(o instanceof THREE.Mesh&&!leaves.some(l=>l.mesh===o)){const m=o.material as THREE.MeshStandardMaterial;stemMaterials.set(m,{color:m.color.clone(),roughness:m.roughness});}});
 const dropGeometry=new THREE.SphereGeometry(1,7,5),dropMaterial=new THREE.MeshPhysicalMaterial({color:0xb9cdc6,roughness:.16,metalness:0,transparent:true,opacity:.58,depthWrite:false});
 const drops=Array.from({length:3},()=>{const mesh=new THREE.Mesh(dropGeometry,dropMaterial);mesh.name='LeafTip_Water';mesh.visible=false;root.add(mesh);return {mesh,leaf:-1,age:0,forming:false,velocity:new THREE.Vector3()};});
 const forming=leaves.map(()=>-1),cooldown=leaves.map(l=>hash(l.seed)*8);
 let tick=0,last=0,stemWet=.26,disposed=false;
 let diag:Diagnostics={hits:0,releases:0,visibleDrops:0,maxAngle:0,maxStemAngle:0,maxWetness:.26};
 const worldQ=new THREE.Quaternion(),normal=new THREE.Vector3(),center=new THREE.Vector3(),force=new THREE.Vector3(),torque=new THREE.Vector3(),localTorque=new THREE.Vector3();
 function reset(){
  tick=0;stemWet=.26;state.forEach((s,i)=>{s.angle.set(0,0);s.velocity.set(0,0);s.force.set(0,0);s.wetness=.26;s.waterLoad=0;joints[i].object.quaternion.copy(joints[i].rest);});
  drops.forEach(d=>{d.leaf=-1;d.mesh.visible=false;d.forming=false;d.age=0;});forming.fill(-1);cooldown.forEach((_,i)=>cooldown[i]=hash(leaves[i].seed)*8);
  diag={hits:0,releases:0,visibleDrops:0,maxAngle:0,maxStemAngle:0,maxWetness:.26};root.updateMatrixWorld(true);
 }
 function step(rain:number){
  const t=tick*STEP,wind=airflow(t);root.updateMatrixWorld(true);state.forEach(s=>s.force.set(0,0));
  for(let k=0;k<leaves.length;k++){
   const leaf=leaves[k],s=state[leaf.jointIndex],joint=joints[leaf.jointIndex];
   leaf.mesh.getWorldQuaternion(worldQ);normal.set(0,0,1).applyQuaternion(worldQ).normalize();leaf.mesh.getWorldPosition(center);
   const shelter=THREE.MathUtils.clamp((1.72-center.x)*2.5,.12,1)*( .45+.55*THREE.MathUtils.clamp(center.y/1.35,0,1));
   const speed=wind.length(),incidence=Math.abs(normal.dot(wind.clone().normalize()));
   const lever=Math.max(.01,leaf.tip.length()*.55),mass=Math.max(.000008,leaf.area*.16),inertia=mass*lever*lever/3;
   force.copy(wind).multiplyScalar(.5*1.2*.65*leaf.area*speed*(.12+.88*incidence)*shelter);
   torque.copy(leaf.tip).multiplyScalar(.5).applyQuaternion(worldQ).cross(force);
   localTorque.copy(torque).applyQuaternion(worldQ.clone().invert());
   const effectiveInertia=inertia*(1+s.wetness*.12);
   s.force.set(localTorque.x/effectiveInertia,localTorque.z/effectiveInertia).clampLength(0,.65);
   // Rest geometry already balances dry gravity. Extra retained water moves that equilibrium.
   s.force.x-=s.wetness*.065*64;
   const points=leaf.mesh.geometry.getAttribute('position');let exposed=0;
   for(let v=0;v<points.count;v+=4){const p=new THREE.Vector3().fromBufferAttribute(points,v).applyMatrix4(leaf.mesh.matrixWorld);if(p.x>.62&&p.x<1.28&&p.z>-1.25&&p.z<-.35&&p.y<2.88)exposed++;}
   const exposure=exposed/Math.ceil(points.count/4),rainFacing=Math.abs(normal.dot(UP));
   const rate=rain*exposure*(.15+.85*rainFacing)*THREE.MathUtils.clamp(leaf.area/.003,.25,2)*1.6;
   s.wetness=Math.max(0,s.wetness-STEP/150);s.waterLoad=Math.max(0,s.waterLoad-STEP*.0005);
   if(hash(leaf.seed*.0001+tick*1.137)<rate*STEP){
    diag.hits++;s.wetness=Math.min(1,s.wetness+.075);s.waterLoad+=.011+.009*hash(tick+leaf.seed);
    const impulse=.045*(.2+.8*rainFacing);s.velocity.x-=impulse;
    let p=joint.parentIndex,transmitted=impulse*.10;
    for(let depth=0;depth<3&&p>=0;depth++){state[p].velocity.x-=transmitted;transmitted*=.12;p=joints[p].parentIndex;}
   }
   const threshold=.052+.020*hash(leaf.seed+9);
   if(forming[k]<0&&t>cooldown[k]&&s.waterLoad>threshold*.8){const free=drops.findIndex(d=>d.leaf<0);if(free>=0){const d=drops[free];d.leaf=k;d.forming=true;d.age=0;d.mesh.visible=true;forming[k]=free;}}
   if(forming[k]>=0){const d=drops[forming[k]];d.age+=STEP;d.mesh.position.copy(root.worldToLocal(leaf.mesh.localToWorld(leaf.tip.clone())));d.mesh.scale.setScalar(.00065+.00115*Math.min(1,d.age/1.8));
    if(d.age>1.1+hash(leaf.seed)*1.3&&s.waterLoad>=threshold*.78){d.forming=false;d.age=0;d.velocity.set(0,-.035,0);forming[k]=-1;s.waterLoad=Math.max(0,s.waterLoad-threshold);s.velocity.x+=.05;cooldown[k]=t+12+hash(tick)*14;diag.releases++;}
   }
   leaf.mesh.material.roughness=THREE.MathUtils.lerp(leaf.baseRoughness,Math.max(.27,leaf.baseRoughness-.23),s.wetness);
   leaf.mesh.material.color.copy(dryColors[k]).multiplyScalar(1-.045*s.wetness);
   diag.maxWetness=Math.max(diag.maxWetness,s.wetness);
  }
  for(let i=0;i<joints.length;i++){
   const joint=joints[i],s=state[i];
   // Frequencies reflect increasing flexibility AND decreasing effective inertia.
   const omega=joint.kind==='stem'?4:joint.kind==='branch'?5.5:joint.kind==='petiole'?7:joint.kind==='weed'?10:8;
   const damping=joint.kind==='stem'?1.02:joint.kind==='branch'?.96:.78;
   if(!leafByJoint.has(i)){const a=noise(t,i*31,8);s.force.x+=a*(joint.kind==='stem'?.004:.025);}
   s.velocity.addScaledVector(s.force,STEP).addScaledVector(s.angle,-omega*omega*STEP);
   s.velocity.multiplyScalar(Math.exp(-2*damping*omega*STEP));s.angle.addScaledVector(s.velocity,STEP);
   const cap=joint.kind==='stem'?.0025:joint.kind==='branch'?.014:joint.kind==='petiole'?.025:.085;
   if(s.angle.length()>cap){s.angle.setLength(cap);s.velocity.multiplyScalar(.5);}
   joint.object.quaternion.copy(joint.rest).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(s.angle.x,0,s.angle.y)));
   diag.maxAngle=Math.max(diag.maxAngle,s.angle.length());if(joint.kind==='stem')diag.maxStemAngle=Math.max(diag.maxStemAngle,s.angle.length());
  }
  root.updateMatrixWorld(true);
  for(const d of drops)if(d.leaf>=0&&!d.forming){d.age+=STEP;d.velocity.y-=9.81*STEP;d.mesh.position.addScaledVector(d.velocity,STEP);if(d.mesh.getWorldPosition(center).y<=.002||d.age>2){d.leaf=-1;d.mesh.visible=false;}}
  stemWet=THREE.MathUtils.lerp(stemWet,rain>.01?.65:.12,1-Math.exp(-STEP/(rain>.01?40:150)));
  stemMaterials.forEach((base,m)=>{m.color.copy(base.color).multiplyScalar(1-stemWet*.035);m.roughness=base.roughness-stemWet*.12;});
  diag.visibleDrops=drops.filter(d=>d.mesh.visible).length;
 }
 root.userData.physicsDebug=()=>({...diag});reset();
 return {root,update(elapsed:number,rain:number){
  if(disposed||!Number.isFinite(elapsed))return;const time=Math.max(0,elapsed);if(time<last)reset();last=time;
  const target=Math.floor(time/STEP+1e-7);for(;tick<target;tick++)step(THREE.MathUtils.clamp(rain,0,1));
  root.userData.plantDiagnostics={...diag};
 },debug(){return state.map(s=>({angle:s.angle.length(),wetness:s.wetness,waterLoad:s.waterLoad}));},diagnostics(){return {...diag};},dispose(){if(disposed)return;disposed=true;dropGeometry.dispose();dropMaterial.dispose();geometry.dispose();}};
}
