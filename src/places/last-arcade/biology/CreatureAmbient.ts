import * as THREE from 'three';
import {arcadeObstacles} from './Obstacles.ts';

const directions=Array.from({length:24},(_,i)=>{const y=(i+.5)/24,a=i*2.3999632297,r=Math.sqrt(1-y*y);return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);});
const boxes=arcadeObstacles().map(o=>new THREE.Box3(new THREE.Vector3(...o.min),new THREE.Vector3(...o.max)));
/** Fixed hemisphere quadrature against the same architecture proxies as navigation.
 * Returns sky visibility / nearby surface clearance. This is ambient visibility,
 * not traced multi-bounce radiance; direct light remains in the shadow map. */
export function sampleCreatureAmbient(position:THREE.Vector3){
 const hit=new THREE.Vector3(),ray=new THREE.Ray(position,new THREE.Vector3());let visible=0,distance=Infinity;
 for(const box of boxes)distance=Math.min(distance,box.distanceToPoint(position));
 for(const direction of directions){ray.direction.copy(direction);let blocked=false;for(const box of boxes){if(ray.intersectBox(box,hit)&&hit.distanceToSquared(position)<35*35){blocked=true;break;}}if(!blocked)visible++;}
 return new THREE.Vector2(visible/directions.length,THREE.MathUtils.smoothstep(distance,.04,1.5));
}

/** Scene adapter only: shared creature models retain their neutral review materials. */
export function installCreatureAmbient(root:THREE.Group){
 const restores:(()=>void)[]=[],seen=new Set<THREE.Material>();
 const actors=new Map<THREE.Object3D,{value:THREE.Vector2;target:THREE.Vector2}[]>();
 const schools=new Map<THREE.Object3D,{mesh:THREE.InstancedMesh;attribute:THREE.InstancedBufferAttribute;target:Float32Array}>();
 root.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  const instanced=object instanceof THREE.InstancedMesh;let actor:THREE.Object3D=object;while(actor.parent&&actor.parent!==root)actor=actor.parent;
  let attribute:THREE.InstancedBufferAttribute|undefined;
  if(instanced){const group=object.parent!;let school=schools.get(group);if(!school){const data=new Float32Array(object.count*2).fill(1);school={mesh:object,attribute:new THREE.InstancedBufferAttribute(data,2),target:data.slice()};schools.set(group,school);}attribute=school.attribute;const prior=object.geometry.getAttribute('arcadeDynamicAmbient');object.geometry.setAttribute('arcadeDynamicAmbient',attribute);restores.push(()=>{if(prior)object.geometry.setAttribute('arcadeDynamicAmbient',prior);else object.geometry.deleteAttribute('arcadeDynamicAmbient');});}
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(!(material instanceof THREE.MeshStandardMaterial)||seen.has(material))continue;seen.add(material);
   const priorCompile=material.onBeforeCompile,priorKey=material.customProgramCacheKey,priorIntensity=material.envMapIntensity,uniform={value:new THREE.Vector2(1,1),target:new THREE.Vector2(1,1)};
   if(!instanced){const list=actors.get(actor)??[];list.push(uniform);actors.set(actor,list);}
   material.envMapIntensity=.38;
   material.onBeforeCompile=(shader,renderer)=>{priorCompile.call(material,shader,renderer);shader.uniforms.arcadeAmbientVisibility=uniform;
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\nvarying vec2 vArcadeDynamicAmbient;\n${instanced?'attribute vec2 arcadeDynamicAmbient;':'uniform vec2 arcadeAmbientVisibility;'}`)
     .replace('#include <begin_vertex>',`#include <begin_vertex>\nvArcadeDynamicAmbient=${instanced?'arcadeDynamicAmbient':'arcadeAmbientVisibility'};`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vArcadeDynamicAmbient;').replace('#include <aomap_fragment>',`#include <aomap_fragment>
float creatureSky=mix(.48,1.,clamp(vArcadeDynamicAmbient.x,0.,1.));
float creatureContact=mix(.48,1.,clamp(vArcadeDynamicAmbient.y,0.,1.));
reflectedLight.indirectDiffuse*=creatureSky*creatureContact;
reflectedLight.indirectSpecular*=creatureSky*mix(.65,1.,clamp(vArcadeDynamicAmbient.y,0.,1.));`);
   };
   material.customProgramCacheKey=()=>`${priorKey.call(material)}-arcade-dynamic-ambient-v1-${instanced}`;material.needsUpdate=true;
   restores.push(()=>{material.onBeforeCompile=priorCompile;material.customProgramCacheKey=priorKey;material.envMapIntensity=priorIntensity;material.needsUpdate=true;});
  }
 });
 const matrix=new THREE.Matrix4(),position=new THREE.Vector3();let last:number|undefined,lastSample=-Infinity;
 return {update(elapsed:number){if(last===elapsed)return;const reset=last===undefined||elapsed<last,dt=reset?0:elapsed-last!;root.updateMatrixWorld(true);
  if(reset||elapsed-lastSample>=1/6){lastSample=elapsed;
   for(const [actor,uniforms]of actors){if(actor instanceof THREE.Mesh){actor.geometry.computeBoundingBox();actor.geometry.boundingBox!.getCenter(position).applyMatrix4(actor.matrixWorld);}else actor.getWorldPosition(position);const value=sampleCreatureAmbient(position);for(const uniform of uniforms){uniform.target.copy(value);if(reset)uniform.value.copy(value);}}
   for(const {mesh,attribute,target}of schools.values())for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld);const value=sampleCreatureAmbient(position);target[i*2]=value.x;target[i*2+1]=value.y;if(reset){attribute.setXY(i,value.x,value.y);}}
  }
  const blend=reset?1:1-Math.exp(-dt/.45);for(const uniforms of actors.values())for(const uniform of uniforms)uniform.value.lerp(uniform.target,blend);for(const {attribute,target}of schools.values()){for(let i=0;i<attribute.count;i++)attribute.setXY(i,THREE.MathUtils.lerp(attribute.getX(i),target[i*2],blend),THREE.MathUtils.lerp(attribute.getY(i),target[i*2+1],blend));attribute.needsUpdate=true;}last=elapsed;
 },dispose(){restores.splice(0).reverse().forEach(restore=>restore());actors.clear();schools.clear();}};
}
