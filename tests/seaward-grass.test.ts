import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {breeze,createGrass} from '../src/places/seaward/Grass.ts';
import {collectModelResources,disposeModelResources} from '../src/shared/resources/ModelResources.ts';

const grassBlades=(group:THREE.Group)=>group.children.filter((child):child is THREE.Mesh=>child instanceof THREE.Mesh&&child.name==='seaward-grass-blade');

test('coastal grass is an asymmetric right-wall clump with a sparse left echo',()=>{
 const grass=createGrass();const blades=grassBlades(grass.group);
 const right=blades.filter(blade=>blade.userData.grassBlade.kind==='right');
 const left=blades.filter(blade=>blade.userData.grassBlade.kind==='left');
 assert.equal(blades.length,206);assert.equal(right.length,174);assert.equal(left.length,24);
 assert.ok(right.every(blade=>blade.position.x>2.58&&blade.position.z>-11.52&&blade.position.z<-11.08));
 assert.ok(left.every(blade=>blade.position.x<-2.5));
 assert.ok(Math.max(...right.map(blade=>blade.userData.grassBlade.height))>.9);
 assert.ok(Math.max(...left.map(blade=>blade.userData.grassBlade.height))<.45);
 assert.equal(grass.group.getObjectByName('seaward-grass-sediment')?.type,'Mesh');
 disposeModelResources(collectModelResources(grass.group),['geometries','materials']);
});

test('coastal grass keeps roots anchored, pauses deterministically, and bends in a gust',()=>{
 const grass=createGrass();const blade=grassBlades(grass.group)[0];
 grass.update(12);const first=Array.from(blade.geometry.getAttribute('position').array);
 grass.update(29);const gust=Array.from(blade.geometry.getAttribute('position').array);
 assert.deepEqual(first.slice(0,6),gust.slice(0,6));assert.notDeepEqual(first.slice(-6),gust.slice(-6));
 grass.update(12);assert.deepEqual(Array.from(blade.geometry.getAttribute('position').array),first);
 assert.ok(breeze(29)>breeze(12)*2);
 disposeModelResources(collectModelResources(grass.group),['geometries','materials']);
});
