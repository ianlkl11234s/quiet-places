import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAntarcticLife} from '../src/places/snowhall/AntarcticLife.ts';
import {SNOW_HALL_BASELINE} from '../src/places/snowhall/Layout.ts';

test('room adapter poses real creatures and releases every allocated model resource once',()=>{
 const parent=new THREE.Group(),life=createAntarcticLife(parent,SNOW_HALL_BASELINE,20260913);
 life.update(0);assert.equal(parent.children.length,1);assert.equal(life.simulation.squids.length,0);
 const seen=new Set<THREE.BufferGeometry|THREE.Material>(),disposed=new Map<THREE.BufferGeometry|THREE.Material,number>();
 const observe=()=>life.root.traverse(object=>{if(!(object instanceof THREE.Mesh))return;for(const resource of [object.geometry,...(Array.isArray(object.material)?object.material:[object.material])]){if(seen.has(resource))continue;seen.add(resource);disposed.set(resource,0);resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)!+1));}});
 observe();let fishSeen=false;
 for(let t=0;t<=240;t+=1){life.update(t);observe();if(life.simulation.fish.some(f=>f.visible))fishSeen=true;}
 assert.ok(fishSeen,'seed has an actual school transit');
 const meshes:THREE.Mesh[]=[];life.root.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
 const snapshot=()=>meshes.map(m=>({p:m.getWorldPosition(new THREE.Vector3()).toArray(),vertices:Array.from(m.geometry.getAttribute('position').array)}));
 parent.updateMatrixWorld(true);const paused=snapshot();life.update(240);parent.updateMatrixWorld(true);assert.deepEqual(snapshot(),paused,'same elapsed freezes models, not only agent positions');
 life.dispose();life.dispose();assert.equal(parent.children.length,0);assert.ok(seen.size>0);
 for(const [resource,count] of disposed)assert.equal(count,1,`${resource.type} must release once`);
});

test('deformed meshes stay inside the real walls, floor and window at representative event times',()=>{
 const parent=new THREE.Group(),life=createAntarcticLife(parent,SNOW_HALL_BASELINE,20260913),point=new THREE.Vector3();
 for(let t=0;t<=180;t+=1.5){life.update(t);parent.updateMatrixWorld(true);life.root.traverse(object=>{
  if(!(object instanceof THREE.Mesh)||!object.parent?.visible)return;
  const position=object.geometry.getAttribute('position');
  for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i).applyMatrix4(object.matrixWorld);assert.ok(point.x> -1.4&&point.x<1.4&&point.y>0&&point.y<3.2&&point.z> -11.5,`${object.name} at ${t}s inside real corridor`);}
 });}
 life.dispose();
});
