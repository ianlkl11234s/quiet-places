/** Runtime is the single geometry/motion source. Export snapshots for Blender PC2 and glTF QA. */
import * as THREE from 'three';
import {mkdirSync,writeFileSync,openSync,writeSync,closeSync} from 'node:fs';
import {resolve} from 'node:path';
import {createSnowCreatures} from '../src/places/snowwindow/Creatures.ts';

const output=resolve(process.argv[2]??'exports/snowwindow-biology-20260910/bake-input');
mkdirSync(resolve(output,'frames'),{recursive:true});
const fps=15,frameCount=900,system=createSnowCreatures();
system.update(0);system.group.updateMatrixWorld(true);
const inverse=new THREE.Matrix4(),local=new THREE.Matrix4(),p=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),axis=new THREE.Vector3(),side=new THREE.Vector3(),cross=new THREE.Vector3();
type Part={object:THREE.Mesh|THREE.LineSegments;count:number;offset:number;line:boolean};
const records:Array<{name:string;creature:string;type:string;parts:Part[];holder:THREE.Object3D;array:Float32Array;indices:number[];material:Record<string,unknown>;fd:number;rootFd:number}> = [];
for(const holder of system.group.children){
 const materials=new Map<THREE.Material,{parts:Part[];vertices:number;indices:number[]}>();
 holder.traverse(object=>{
  if(!(object instanceof THREE.Mesh||object instanceof THREE.LineSegments))return;
  const material=Array.isArray(object.material)?object.material[0]:object.material;
  let bucket=materials.get(material);if(!bucket){bucket={parts:[],vertices:0,indices:[]};materials.set(material,bucket);}
  const geometry=object.geometry,position=geometry.getAttribute('position'),line=object instanceof THREE.LineSegments,offset=bucket.vertices;
  const count=line?position.count/2*6:position.count;
  if(line){for(let j=0;j<position.count/2;j++)for(let s=0;s<3;s++){const at=offset+j*6,k=(s+1)%3;bucket.indices.push(at+s,at+k,at+3+s,at+k,at+3+k,at+3+s);}}
  else if(geometry.index){for(let j=0;j<geometry.index.count;j++)bucket.indices.push(offset+geometry.index.getX(j));}
  else{for(let j=0;j<position.count;j++)bucket.indices.push(offset+j);}
  bucket.parts.push({object,count,offset,line});bucket.vertices+=count;
 });
 let m=0;for(const [material,bucket] of materials){
  const name=`${holder.name}_material_${m++}`,physical=material as THREE.MeshPhysicalMaterial;
  records.push({name,creature:holder.name,type:holder.name.startsWith('JELLY')?'aurelia':'clione',parts:bucket.parts,holder,array:new Float32Array(bucket.vertices*3),indices:bucket.indices,material:{color:physical.color?.toArray()??[.8,.8,.8],opacity:material.opacity,roughness:physical.roughness??.45,transmission:physical.transmission??0,ior:physical.ior??1.34},fd:openSync(resolve(output,'frames',`${name}.f32le`),'w'),rootFd:openSync(resolve(output,'frames',`${name}.roots.f32le`),'w')});
 }
}
const rootData=new Float32Array(7),diagnostics:string[]=['time,name,phase,C,C_dot,speed,pulse_force,PER_force,drag,distance,gait,frequency,left_force,right_force,vertical_speed,sink_force'];
for(let frame=0;frame<frameCount;frame++){
 const time=frame/fps;system.update(time);system.group.updateMatrixWorld(true);
 for(const record of records){
  inverse.copy(record.holder.matrixWorld).invert();
  for(const part of record.parts){
   local.multiplyMatrices(inverse,part.object.matrixWorld);const position=part.object.geometry.getAttribute('position');
   if(!part.line){for(let i=0;i<position.count;i++){p.fromBufferAttribute(position,i).applyMatrix4(local);p.toArray(record.array,(part.offset+i)*3);}}
   else{for(let i=0;i<position.count;i+=2){
    a.fromBufferAttribute(position,i).applyMatrix4(local);b.fromBufferAttribute(position,i+1).applyMatrix4(local);axis.subVectors(b,a).normalize();side.set(1,0,0);if(Math.abs(axis.x)>.8)side.set(0,1,0);side.cross(axis).normalize().multiplyScalar(.00018);cross.crossVectors(axis,side);
    for(let end=0;end<2;end++)for(let s=0;s<3;s++){p.copy(end?b:a).addScaledVector(side,Math.cos(s*2*Math.PI/3)).addScaledVector(cross,Math.sin(s*2*Math.PI/3));p.toArray(record.array,(part.offset+i/2*6+end*3+s)*3);}
   }}
  }
  writeSync(record.fd,new Uint8Array(record.array.buffer));
  record.holder.position.toArray(rootData,0);record.holder.quaternion.toArray(rootData,3);writeSync(record.rootFd,new Uint8Array(rootData.buffer));
 }
 for(const state of system.motion.states)diagnostics.push([time,state.name,state.phase,state.pulse,state.pulseRate,state.velocity.length(),state.pulseForce,state.perForce,state.drag,state.distance,state.kind==='aurelia'?state.behavior:state.gait,state.frequency,state.leftForce,state.rightForce,state.velocity.y,state.sinkForce].join(','));
 if(frame%150===0)console.log(`sample ${frame}/${frameCount}`);
}
for(const record of records){closeSync(record.fd);closeSync(record.rootFd);}
writeFileSync(resolve(output,'scene.json'),JSON.stringify({schema:'snow-creatures-bake/v1',version:1,units:'m',fps,durationSeconds:60,coordinateSystem:{source:'three-y-up',blender:'z-up',positionMap:'[x,y,z]→[x,-z,y]'},meshes:records.map(r=>({name:r.name,creature:r.creature,type:r.type,positions:{path:`frames/${r.name}.f32le`,frameCount,vertexCount:r.array.length/3,components:3,space:'local'},indices:r.indices,material:r.material,rootPoses:{path:`frames/${r.name}.roots.f32le`,layout:'px,py,pz,qx,qy,qz,qw',space:'world'}}))}));
writeFileSync(resolve(output,'../motion-60s.csv'),diagnostics.join('\n')+'\n');
console.log(JSON.stringify({output,meshes:records.length,vertices:records.reduce((n,r)=>n+r.array.length/3,0),frames:frameCount}));system.dispose();
