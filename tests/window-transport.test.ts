import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWindowTransport} from '../src/places/stairlight/WindowTransport.ts';

test('window bounce follows first geometry hit, fades with sun and releases shadow resources',()=>{
 const room=new THREE.Group();
 const floor=new THREE.Mesh(new THREE.BoxGeometry(12,.1,12),new THREE.MeshStandardMaterial());
 floor.position.y=-.05;room.add(floor);room.updateMatrixWorld(true);
 const sun=new THREE.DirectionalLight(0xffffff,3.5);
 const transport=createWindowTransport(room,sun,true);
 const incoming=new THREE.Vector3(0,-1,-1).normalize();transport.update(incoming,false);
 const lights=transport.root.children.filter(o=>o instanceof THREE.SpotLight);
 assert.equal(lights.length,3);
 for(const light of lights){assert.ok(light.intensity>0);assert.ok(Math.abs(light.position.y-.035)<1e-5);assert.ok(light.target.position.y>light.position.y);assert.ok(light.castShadow);}
 // A slab in front of the floor must become the first receiver, not be penetrated.
 const slab=new THREE.Mesh(new THREE.BoxGeometry(12,.1,12),new THREE.MeshStandardMaterial());slab.position.y=1;room.add(slab);
 sun.intensity=3;transport.update(incoming,false);
 for(const light of lights)assert.ok(Math.abs(light.position.y-1.085)<1e-5);
 sun.intensity=0;transport.update(incoming,true);assert.ok(lights.every(l=>l.intensity===0));
 let disposed=0;
 // LightShadow has no dispose event; observe its method directly.
 for(const light of lights){const original=light.shadow.dispose.bind(light.shadow);light.shadow.dispose=()=>{disposed++;original();};}
 transport.dispose();assert.equal(disposed,3);
 floor.geometry.dispose();(floor.material as THREE.Material).dispose();slab.geometry.dispose();(slab.material as THREE.Material).dispose();
});
