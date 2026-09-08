import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {seaGlassGlow,installSeaGlass} from '../src/places/afterlight/SeaGlass.ts';
import {sampleAfterlightDay} from '../src/places/afterlight/DayCycle.ts';
test('twilight lasts four hours and residual glow is dark-adaptive and midnight-continuous',()=>{
 assert.equal(sampleAfterlightDay(17).daylight,1);
 assert.equal(sampleAfterlightDay(19).daylight,.5);
 assert.equal(sampleAfterlightDay(21).daylight,0);
 assert.equal(seaGlassGlow(12),0);assert.ok(seaGlassGlow(23)>0&&seaGlassGlow(23)<1);
 assert.equal(seaGlassGlow(0),seaGlassGlow(24));
 for(let m=1;m<=1440;m++)assert.ok(Math.abs(seaGlassGlow(m/60)-seaGlassGlow((m-1)/60))<.02);
});
test('six varied glass fragments contain no lamps and own their disposable assets',()=>{
 const root=new THREE.Group(),glass=installSeaGlass(root,new Set());
 assert.equal(glass.group.children.length,6);assert.ok(glass.group.children.every(o=>o instanceof THREE.Mesh));
 glass.update(12,1);const meshes=glass.group.children as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[];
 assert.ok(meshes.every(m=>m.material.emissiveIntensity===0));glass.update(23,1);
 assert.ok(new Set(meshes.map(m=>m.material.emissiveIntensity)).size>3);
 assert.ok(meshes.every(m=>m.material.emissiveIntensity<.12));
 let disposed=0;meshes.forEach(m=>{m.geometry.addEventListener('dispose',()=>disposed++);m.material.addEventListener('dispose',()=>disposed++);});
 glass.dispose();assert.equal(root.children.length,0);assert.equal(disposed,12);
});
