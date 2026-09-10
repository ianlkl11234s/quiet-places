import * as THREE from 'three';
import {createAurelia} from '../../shared/biology/aurelia/index.ts';
import {createClione} from '../../shared/biology/clione/index.ts';
import {CLIONE_PRESETS,JELLY_PRESETS,createCreatureMotion,type CreatureControls} from './CreatureMotion.ts';

/** Scene adapter only: reusable organisms keep local +Z; orientation maps them to Three +Y. */
export function createSnowCreatures(options:{clioneCount?:number;controls?:Partial<CreatureControls>;environment?:THREE.CubeTexture|null}={}){
 const count=options.clioneCount??5,motion=createCreatureMotion(count,options.controls);
 const group=new THREE.Group();group.name='SNOW_CREATURES';
 const jellies=JELLY_PRESETS.map(p=>createAurelia(p)),clione=CLIONE_PRESETS.slice(0,count).map(p=>createClione(p));
 const instances=[...jellies,...clione];
 const lit=new Set<THREE.MeshStandardMaterial>();
 instances.forEach((instance,index)=>{
  const holder=new THREE.Group();holder.name=motion.states[index].name;holder.add(instance.group);group.add(holder);
  instance.group.traverse(object=>{
   if(object instanceof THREE.Mesh){const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials)if(material instanceof THREE.MeshStandardMaterial){material.envMap=options.environment??null;material.envMapIntensity=.45;lit.add(material);}}
  });
 });
 const relativeFlow=new THREE.Vector3(),inverseOrientation=new THREE.Quaternion();
 let disposed=false;
 const update=(elapsed:number,visibility=1)=>{
  if(disposed)return;
  const states=motion.update(elapsed);
  states.forEach((state,index)=>{
   const holder=group.children[index];holder.position.copy(state.position);holder.quaternion.copy(state.orientation);
   if(index<3){relativeFlow.copy(state.current).sub(state.velocity).applyQuaternion(inverseOrientation.copy(state.orientation).invert());jellies[index].update(elapsed,{activity:state.activity,turn:state.turn,turnDirection:state.turnDirection,relativeFlow});}
   else clione[index-3].update(elapsed,{gait:state.gait,frequency:state.frequency,phase:state.phase,turn:state.turn,previousGait:state.previousGait,gaitBlend:state.gaitBlend});
  });
  for(const material of lit)material.envMapIntensity=.45*visibility;
  group.userData.population={aurelia:3,clione:count};
 };
 update(0);
 return {group,motion,jellies,clione,update,dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const instance of instances)instance.dispose();group.clear();}};
}
