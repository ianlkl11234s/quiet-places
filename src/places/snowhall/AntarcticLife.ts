import * as THREE from 'three';
import {createGlassSquid,createSilverfish} from '../../shared/biology/antarctic/AntarcticModels.ts';
import {AntarcticBehavior} from './AntarcticBehavior.ts';
import type {SnowhallDraft} from './Layout.ts';

/** Room adapter: the original window lights the models; no creature light sources. */
export function createAntarcticLife(parent:THREE.Group,layout:SnowhallDraft,seed:number){
 const root=new THREE.Group();root.name='snowhall-antarctic-life';parent.add(root);
 const simulation=new AntarcticBehavior(seed,{width:layout.corridorWidth,height:3.2,
  cameraPosition:layout.camera.position,cameraTarget:layout.camera.target,windowX:layout.window.x,windowY:layout.window.y,windowWidth:layout.window.width,windowHeight:layout.window.height});
 const squids=simulation.squids.map((_,i)=>{const model=createGlassSquid((seed+i*7919)>>>0);root.add(model.root);return model;});
 const fish=new Map<number,ReturnType<typeof createSilverfish>>();
 let disposed=false;
 return {root,simulation,update(elapsed:number){
  if(disposed)return;
  simulation.update(elapsed);
  simulation.squids.forEach((pose,i)=>{
   const model=squids[i];model.root.position.copy(pose.position);model.root.quaternion.copy(pose.quaternion);model.root.scale.setScalar(pose.scale);model.root.visible=pose.visible;
   model.update(elapsed,pose.speedBL,pose.turn,1);
  });
  simulation.fish.forEach((pose,i)=>{
   let model=fish.get(i);
   if(!model&&pose.visible){model=createSilverfish((seed+104729+i*3571)>>>0);fish.set(i,model);root.add(model.root);}
   if(!model)return;
   model.root.visible=pose.visible;
   if(!pose.visible)return;
   model.root.position.copy(pose.position);model.root.quaternion.copy(pose.quaternion);model.root.scale.setScalar(pose.scale);
   model.update(elapsed,pose.speedBL,pose.turn,1);
  });
 },dispose(){
  if(disposed)return;disposed=true;
  squids.forEach(model=>model.dispose());fish.forEach(model=>model.dispose());fish.clear();root.removeFromParent();root.clear();
 }};
}
