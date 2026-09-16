import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleCreatureAmbient,installCreatureAmbient} from '../src/places/last-arcade/biology/CreatureAmbient.ts';
import {createChromisVisuals,setChromisMatrix} from '../src/creatures/chromis/index.ts';
test('ambient visibility distinguishes the arcade, wall foot, open street and sky',()=>{
 const porch=sampleCreatureAmbient(new THREE.Vector3(1,2,-4)),foot=sampleCreatureAmbient(new THREE.Vector3(.6,.5,-2)),road=sampleCreatureAmbient(new THREE.Vector3(6,2,-5)),sky=sampleCreatureAmbient(new THREE.Vector3(6,9,-5));
 assert.ok(porch.x<road.x&&road.x<sky.x,'roof and opposite buildings occlude different sky fractions');
 assert.ok(foot.y<porch.y&&porch.y<road.y,'near-wall contact falls off into the open');assert.equal(sky.x,1);
});
test('individual fish use local ambient visibility, pause safely, and restore neutral materials',()=>{
 const root=new THREE.Group(),fish=createChromisVisuals(2,new Float32Array(2),new Float32Array([.05,.05]));root.add(fish.root);
 const matrix=new THREE.Matrix4();setChromisMatrix(fish,0,matrix.makeTranslation(1,2,-4));setChromisMatrix(fish,1,matrix.makeTranslation(6,2,-5));
 const mesh=fish.root.children[0] as THREE.InstancedMesh,material=mesh.material as THREE.MeshStandardMaterial,old=material.envMapIntensity,ambient=installCreatureAmbient(root);
 ambient.update(0);const attribute=mesh.geometry.getAttribute('arcadeDynamicAmbient');assert.ok(attribute.getX(0)<attribute.getX(1));assert.equal(material.envMapIntensity,.38);
 const before=Array.from(attribute.array);ambient.update(0);assert.deepEqual(Array.from(attribute.array),before);
 ambient.dispose();assert.equal(material.envMapIntensity,old);assert.equal(mesh.geometry.getAttribute('arcadeDynamicAmbient'),undefined);fish.dispose();
});
