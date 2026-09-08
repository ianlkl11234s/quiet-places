import * as THREE from 'three';
import {createPlantGeometry} from './PlantGeometry.ts';
import {createRainInteraction} from './RainInteraction.ts';

const STEP=1/60;
const hash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
function noise(t:number,seed:number,period:number){const x=t/period,i=Math.floor(x),f=x-i;return THREE.MathUtils.lerp(hash(i+seed),hash(i+seed+1),f*f*(3-2*f))*2-1;}
function airflow(t:number){
 const gust=THREE.MathUtils.smoothstep(noise(t,19,23),-.15,.65);
 return new THREE.Vector3(noise(t,41,7),.08*noise(t,73,4),noise(t,109,12)).multiplyScalar(.018+.075*gust);
}
type Diagnostics={hits:number,releases:number,visibleDrops:number,maxAngle:number,maxStemAngle:number,maxWetness:number,stationaryBeads:number};
export function createAfterlightPlantPhysics(){
 const geometry=createPlantGeometry(),{root,joints,leaves}=geometry;
 const rainContact=createRainInteraction(leaves);
 root.name='Afterlight_LivingPlants';
 const state=joints.map(()=>({angle:new THREE.Vector2(),velocity:new THREE.Vector2(),force:new THREE.Vector2(),wetness:.26,waterLoad:0}));
 const leafByJoint=new Map(leaves.map(l=>[l.jointIndex,l]));
 const dryColors=leaves.map(l=>l.mesh.material.color.clone());
 const stemMaterials=new Map<THREE.MeshStandardMaterial,{color:THREE.Color,roughness:number}>();
 root.traverse(o=>{if(o instanceof THREE.Mesh&&!leaves.some(l=>l.mesh===o)){const m=o.material as THREE.MeshStandardMaterial;stemMaterials.set(m,{color:m.color.clone(),roughness:m.roughness});}});
 const dropGeometry=new THREE.SphereGeometry(1,7,5),dropMaterial=new THREE.MeshPhysicalMaterial({color:0xb9cdc6,roughness:.16,metalness:0,transparent:true,opacity:.58,depthWrite:false});
 const drops=Array.from({length:3},()=>{const mesh=new THREE.Mesh(dropGeometry,dropMaterial);mesh.name='LeafTip_Water';mesh.visible=false;root.add(mesh);return {mesh,leaf:-1,age:0,forming:false,anchor:new THREE.Vector3(),velocity:new THREE.Vector3()};});
 const beads=new THREE.InstancedMesh(dropGeometry,dropMaterial,6);beads.name='Leaf_Surface_Beads';beads.count=0;beads.frustumCulled=false;root.add(beads);
 const beadMatrix=new THREE.Matrix4(),beadRotation=new THREE.Quaternion(),beadScale=new THREE.Vector3();
 const forming=leaves.map(()=>-1),cooldown=leaves.map(l=>hash(l.seed)*8);
 let tick=0,last=0,stemWet=.26,disposed=false;
 let diag:Diagnostics={hits:0,releases:0,visibleDrops:0,maxAngle:0,maxStemAngle:0,maxWetness:.26,stationaryBeads:0};
 const worldQ=new THREE.Quaternion(),normal=new THREE.Vector3(),center=new THREE.Vector3(),force=new THREE.Vector3(),torque=new THREE.Vector3(),localTorque=new THREE.Vector3();
 function reset(){
  rainContact.reset();
  tick=0;stemWet=.26;state.forEach((s,i)=>{s.angle.set(0,0);s.velocity.set(0,0);s.force.set(0,0);s.wetness=.26;s.waterLoad=0;joints[i].object.quaternion.copy(joints[i].rest);});
  beads.count=0;
  drops.forEach(d=>{d.leaf=-1;d.mesh.visible=false;d.forming=false;d.age=0;});forming.fill(-1);cooldown.forEach((_,i)=>cooldown[i]=hash(leaves[i].seed)*8);
  diag={hits:0,releases:0,visibleDrops:0,maxAngle:0,maxStemAngle:0,maxWetness:.26,stationaryBeads:0};root.updateMatrixWorld(true);
 }
 function step(rain:number){
  const t=tick*STEP,wind=airflow(t);root.updateMatrixWorld(true);state.forEach(s=>s.force.set(0,0));
  const hits=rainContact.update((tick+1)*STEP,STEP,rain);
  for(const hit of hits){
   const leaf=leaves[hit.leafIndex],s=state[leaf.jointIndex];
   const length=Math.max(.01,leaf.tip.length()),mass=Math.max(.000008,leaf.area*.16),inertia=mass*length*length/3*(1+s.wetness*.12);
   const incidence=Math.abs(hit.normal.y);
   const impulse=THREE.MathUtils.clamp(hit.mass*hit.speed*length*hit.lever*incidence/inertia*.075,.006,.10);
   diag.hits++;s.wetness=Math.min(1,s.wetness+.055+hit.mass*22000);s.waterLoad+=.009+hit.mass*6000;
   s.velocity.x-=impulse;
   let parent=joints[leaf.jointIndex].parentIndex,transmitted=impulse*.10;
   for(let depth=0;depth<3&&parent>=0;depth++){state[parent].velocity.x-=transmitted;transmitted*=.12;parent=joints[parent].parentIndex;}
  }
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
   s.wetness=Math.max(0,s.wetness-STEP/150);s.waterLoad=Math.max(0,s.waterLoad-STEP*.0005);
   // As the blade tilts, the low-point adhesion threshold falls a little.
   const threshold=(.056+.025*hash(leaf.seed+9))*(1-.15*Math.min(1,Math.abs(normal.y-.8)));
   if(forming[k]<0&&t>cooldown[k]&&s.waterLoad>threshold*.8){const free=drops.findIndex(d=>d.leaf<0);if(free>=0){const d=drops[free];d.leaf=k;d.forming=true;d.age=0;d.anchor.copy(leaf.tip);d.mesh.visible=true;forming[k]=free;}}
   if(forming[k]>=0){const d=drops[forming[k]];d.age+=STEP;
    // Water travels toward the gravity-low distal edge of the currently bent blade.
    let lowest=leaf.mesh.localToWorld(leaf.tip.clone()),anchor=leaf.tip.clone();
    const vertices=leaf.mesh.geometry.getAttribute('position');
    for(let v=0;v<vertices.count;v+=6){const local=new THREE.Vector3().fromBufferAttribute(vertices,v);if(local.y<leaf.tip.y*.5)continue;const world=leaf.mesh.localToWorld(local.clone());if(world.y<lowest.y){lowest=world;anchor=local;}}
    d.anchor.lerp(anchor,1-Math.exp(-STEP*2));d.mesh.position.copy(root.worldToLocal(leaf.mesh.localToWorld(d.anchor.clone())));d.mesh.scale.setScalar(.00065+.00115*Math.min(1,d.age/3.5));
    if(d.age>2.5+hash(leaf.seed)*3.0&&s.waterLoad>=threshold*.78){d.forming=false;d.age=0;d.velocity.set(0,-.035,0);forming[k]=-1;s.waterLoad=Math.max(0,s.waterLoad-threshold);s.velocity.x+=.05;cooldown[k]=t+8+hash(tick)*12;diag.releases++;}
   }
   leaf.mesh.material.roughness=THREE.MathUtils.lerp(leaf.baseRoughness,Math.max(.27,leaf.baseRoughness-.23),s.wetness);
   leaf.mesh.material.color.copy(dryColors[k]).multiplyScalar(1-.045*s.wetness);
   diag.maxWetness=Math.max(diag.maxWetness,s.wetness);
  }
  // Only near-contact blade centres repel. Projected overlap alone is allowed.
  const bladeCentres=leaves.map(l=>l.mesh.localToWorld(l.tip.clone().multiplyScalar(.5)));
  for(let a=0;a<leaves.length;a++)for(let b=a+1;b<leaves.length;b++){
   const clearance=Math.min(.014,Math.sqrt(Math.min(leaves[a].area,leaves[b].area))*.25),distance=bladeCentres[a].distanceTo(bladeCentres[b]);
   if(distance>=clearance)continue;
   const push=(1-distance/clearance)*.75,sign=bladeCentres[a].y>=bladeCentres[b].y?1:-1;
   state[leaves[a].jointIndex].force.x+=push*sign;state[leaves[b].jointIndex].force.x-=push*sign;
  }
  for(let i=0;i<joints.length;i++){
   const joint=joints[i],s=state[i];
   // Frequencies reflect increasing flexibility AND decreasing effective inertia.
   const leaf=leafByJoint.get(i);
   const omega=(joint.kind==='stem'?4:joint.kind==='branch'?5.5:joint.kind==='petiole'?7:joint.kind==='weed'?10:THREE.MathUtils.clamp(8*Math.pow(.003/Math.max(.0002,leaf?.area??.003),.25),6,12))/Math.sqrt(1+s.wetness*.12);
   const damping=joint.kind==='stem'?1.02:joint.kind==='branch'?.96:.78;
   if(!leaf){const parent=joints[i].parentIndex;const shared=noise(t-(parent<0?0:.12),31,8);s.force.x+=shared*(joint.kind==='stem'?.004:.025);if(parent>=0)s.force.addScaledVector(state[parent].angle,omega*omega*.08);}
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
  let beadCount=0;
  for(let k=0;k<leaves.length&&beadCount<6;k++){
   const leaf=leaves[k],s=state[leaf.jointIndex];if(s.wetness<.36||hash(leaf.seed)>.55)continue;
   const positions=leaf.mesh.geometry.getAttribute('position'),index=Math.floor(positions.count*(.30+.40*hash(leaf.seed+17)));
   const local=new THREE.Vector3().fromBufferAttribute(positions,index);local.z+=.00035;
   const point=root.worldToLocal(leaf.mesh.localToWorld(local));beadScale.setScalar(.00045+.00035*s.wetness);
   beadMatrix.compose(point,beadRotation,beadScale);beads.setMatrixAt(beadCount++,beadMatrix);
  }
  beads.count=beadCount;beads.instanceMatrix.needsUpdate=true;diag.stationaryBeads=beadCount;
  diag.visibleDrops=drops.filter(d=>d.mesh.visible).length;
 }
 root.userData.physicsDebug=()=>({...diag});reset();
 return {root,rainBlocks:rainContact.blocks,update(elapsed:number,rain:number){
  if(disposed||!Number.isFinite(elapsed))return;const time=Math.max(0,elapsed);if(time<last)reset();last=time;
  const target=Math.floor(time/STEP+1e-7);for(;tick<target;tick++)step(THREE.MathUtils.clamp(rain,0,1));
  root.userData.plantDiagnostics={...diag};
 },debug(){return state.map(s=>({angle:s.angle.length(),wetness:s.wetness,waterLoad:s.waterLoad}));},diagnostics(){return {...diag};},dispose(){if(disposed)return;disposed=true;beads.dispose();dropGeometry.dispose();dropMaterial.dispose();geometry.dispose();}};
}
