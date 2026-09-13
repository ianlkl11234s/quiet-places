import * as THREE from 'three';
import type {AntarcticBehavior} from './AntarcticBehavior.ts';
import type {SnowhallDraft} from './Layout.ts';

export const BIO_DEBUG_FLAGS={nav:false,light:false,centroid:false,neighbors:false,targets:false,events:false,avoidance:false};
export type BioDebugFlags=typeof BIO_DEBUG_FLAGS;

/** Explicit opt-in review helpers, never installed by the normal player. */
export function createAntarcticDebug(scene:THREE.Scene,simulation:AntarcticBehavior,layout:SnowhallDraft){
 const root=new THREE.Group();root.name='antarctic-debug';scene.add(root);
 const flags={...BIO_DEBUG_FLAGS};
 const groups=Object.fromEntries(Object.keys(flags).map(key=>{const group=new THREE.Group();group.name=key;root.add(group);return [key,group];})) as Record<keyof BioDebugFlags,THREE.Group>;
 const nav=new THREE.Box3Helper(new THREE.Box3(simulation.navBounds.min.clone(),simulation.navBounds.max.clone()),0x82bba6);groups.nav.add(nav);
 const sphere=new THREE.SphereGeometry(1,10,6);
 const point=(group:THREE.Group,color:number,radius:number,wireframe=false)=>{const mesh=new THREE.Mesh(sphere,new THREE.MeshBasicMaterial({color,wireframe,transparent:true,opacity:wireframe?.3:.65,depthWrite:false}));mesh.scale.setScalar(radius);group.add(mesh);return mesh;};
 for(let z=-10.6;z<=-3;z+=.6)for(let x=-layout.corridorWidth/2+.4;x<layout.corridorWidth/2-.3;x+=.4){
  const p=new THREE.Vector3(x,layout.window.y,z),level=simulation.sampleLight(p),mesh=point(groups.light,new THREE.Color().setHSL(.62-level*.45,.35,.25+level*.4).getHex(),.02+level*.045);mesh.position.copy(p);
 }
 const targets=simulation.squids.map(()=>point(groups.targets,0xd3bd78,.045));
 const center=point(groups.centroid,0x8ac6d3,.07);
 const neighbors=simulation.fish.map(()=>point(groups.neighbors,0x8ac6d3,.25,true));
 const arrows=[...simulation.squids,...simulation.fish].map(()=>{const arrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),.1,0xc78b78,.05,.03);groups.avoidance.add(arrow);return arrow;});
 let disposed=false;
 return {flags,update(){
  if(disposed)return;
  for(const key of Object.keys(flags) as (keyof BioDebugFlags)[])groups[key].visible=flags[key];
  simulation.squids.forEach((s,i)=>targets[i].position.copy(s.target));
  center.position.set(0,0,0);let count=0;
  simulation.fish.forEach((fish,i)=>{neighbors[i].visible=fish.visible;neighbors[i].position.copy(fish.position);neighbors[i].scale.setScalar(fish.scale*1.35);if(fish.visible){center.position.add(fish.position);count++;}});
  center.visible=count>0;if(count)center.position.multiplyScalar(1/count);
  [...simulation.squids,...simulation.fish].forEach((agent,i)=>{
   const vector=(agent as typeof agent&{avoidance?:THREE.Vector3}).avoidance;
   arrows[i].visible=agent.visible&&!!vector&&vector.lengthSq()>1e-8;
   if(!arrows[i].visible||!vector)return;
   arrows[i].position.copy(agent.position);arrows[i].setDirection(vector.clone().normalize());arrows[i].setLength(Math.min(.7,vector.length()),.04,.025);
  });
 },dispose(){if(disposed)return;disposed=true;const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();root.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line){geometries.add(object.geometry);(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>materials.add(material));}});geometries.add(sphere);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}};
}
