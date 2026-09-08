import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAfterlightPlantPhysics} from '../src/places/afterlight/PlantPhysics.ts';

test('plant physics freezes, is frame-partition invariant, and stays finite',()=>{
 const a=createAfterlightPlantPhysics(),b=createAfterlightPlantPhysics();
 a.update(0,.7);a.update(10,.7);
 b.update(0,.7);for(let frame=1;frame<=600;frame++)b.update(frame/60,.7);
 assert.deepEqual(a.debug(),b.debug());const frozen=a.debug();a.update(10,.7);assert.deepEqual(a.debug(),frozen);
 for(const joint of a.debug())assert.ok(Number.isFinite(joint.angle)&&Number.isFinite(joint.wetness));
 a.dispose();b.dispose();
});

test('sunshower only wets aperture-reachable leaf geometry and produces bounded drops',()=>{
 const plant=createAfterlightPlantPhysics();plant.update(0,1);plant.update(60,1);
 const d=plant.diagnostics();assert.ok(d.hits>0,'60 seconds has deterministic leaf hits');assert.ok(d.maxWetness>0);assert.ok(d.visibleDrops<=3);assert.ok(d.releases>0,'formed drops detach');
 plant.dispose();
});


test('heavy rain shares extra leaf contacts and remains pausable with bounded drops',()=>{
 const normal=createAfterlightPlantPhysics(),heavy=createAfterlightPlantPhysics();normal.update(30,1);heavy.update(30,1,true);
 assert.ok(heavy.diagnostics().hits>normal.diagnostics().hits);assert.ok(heavy.diagnostics().visibleDrops<=3);
 const frozen=heavy.debug();heavy.update(30,1,true);assert.deepEqual(heavy.debug(),frozen);
 normal.dispose();heavy.dispose();
});


test('main plant moves visibly at the hero camera while leaves stay clear of the wall',()=>{
 const plant=createAfterlightPlantPhysics(),camera=new THREE.PerspectiveCamera(53,1280/720,.1,100);
 camera.position.set(.425,.8175,2.25);camera.lookAt(1.25,.72,-.6);camera.updateMatrixWorld();
 const meshes:THREE.Mesh[]=[];
 plant.root.traverse(o=>{if(o instanceof THREE.Mesh&&o.name==='plant-leaf'&&o.geometry.getAttribute('position').getY(o.geometry.getAttribute('position').count-4)>.04)meshes.push(o);});
 const ranges=meshes.map(()=>new THREE.Box2()),point=new THREE.Vector3();const root=plant.root.position.clone();
 for(let frame=0;frame<=2400;frame++){
  plant.update(frame/60,1,true);if(frame%6||frame<600)continue;
  meshes.forEach((m,i)=>{const a=m.geometry.getAttribute('position');
   for(let v=0;v<a.count;v++){point.fromBufferAttribute(a,v);m.localToWorld(point);assert.ok(point.x<1.71,'animated leaf clears the wall');}
   point.fromBufferAttribute(a,a.count-4);m.localToWorld(point).project(camera);ranges[i].expandByPoint(new THREE.Vector2(point.x*640,point.y*360));
  });
 }
 const excursion=Math.max(...ranges.map(b=>b.getSize(new THREE.Vector2()).length()));
 assert.ok(excursion>3&&excursion<30,`visible but restrained excursion: ${excursion}px`);
 assert.deepEqual(plant.root.position,root);plant.dispose();
});
