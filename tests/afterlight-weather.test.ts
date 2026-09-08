import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {rainSample} from '../src/places/afterlight/RainField.ts';
import {createAfterlightWeather} from '../src/places/afterlight/Weather.ts';

test('sunshower stays in the aperture and freezes exactly with the player clock',()=>{
 const scene=new THREE.Scene(),weather=createAfterlightWeather(scene);
 const rain=weather.root.children[0] as THREE.Mesh;
 for(const t of [0,.1,3,30,360]){
  weather.update(t,.65,1,false);
  const a=Array.from(rain.geometry.attributes.position.array);
  weather.update(t,.65,1,false);
  assert.deepEqual(Array.from(rain.geometry.attributes.position.array),a);
  for(let i=0;i<a.length;i+=3){assert.ok(a[i]>.62&&a[i]<1.28);assert.ok(a[i+1]>=0&&a[i+1]<=3);assert.ok(a[i+2]>-1.25&&a[i+2]<-.35);}
 }
 const standard=rain.geometry.drawRange.count;
 weather.update(360,.65,1,true);assert.ok(rain.geometry.drawRange.count<standard);
 weather.update(360,0,1,false);assert.equal(weather.root.visible,false);
 weather.dispose();assert.equal(scene.children.length,0);
});


test('a leaf-intercepted rain drop disappears below the actual hit until its next cycle',()=>{
 const weather=createAfterlightWeather(new THREE.Scene()),rain=weather.root.children[0] as THREE.Mesh;
 const time=1.2,drop=rainSample(0,time);weather.update(time,1,1,false);
 const initial=rain.geometry.getAttribute('alpha').getX(0);assert.ok(initial>0);
 weather.update(time,1,1,false,.25,new Map([[0,{cycle:drop.cycle,y:drop.y+.1}]]));
 assert.equal(rain.geometry.getAttribute('alpha').getX(0),0);
 weather.update(time,1,1,false,.25,new Map([[0,{cycle:drop.cycle-1,y:3}]]));
 assert.equal(rain.geometry.getAttribute('alpha').getX(0),initial);weather.dispose();
});
