import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {breeze,createGrass} from '../src/places/seaward/Grass.ts';
import {collectModelResources,disposeModelResources} from '../src/shared/resources/ModelResources.ts';
test('coastal grass keeps roots anchored and pauses deterministically',()=>{
 const grass=createGrass();const blade=grass.group.children[0] as THREE.Mesh;
 grass.update(12);const first=Array.from(blade.geometry.getAttribute('position').array);
 grass.update(29);const gust=Array.from(blade.geometry.getAttribute('position').array);
 assert.deepEqual(first.slice(0,6),gust.slice(0,6));assert.notDeepEqual(first.slice(-6),gust.slice(-6));
 grass.update(12);assert.deepEqual(Array.from(blade.geometry.getAttribute('position').array),first);
 assert.ok(breeze(29)>breeze(12)*2);
 disposeModelResources(collectModelResources(grass.group),['geometries','materials']);
});
