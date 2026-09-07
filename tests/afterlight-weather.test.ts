import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAfterlightWeather} from '../src/places/afterlight/Weather.ts';

test('sunshower stays in the aperture and freezes exactly with the player clock',()=>{
 const scene=new THREE.Scene(),weather=createAfterlightWeather(scene);
 const rain=weather.root.children[0] as THREE.LineSegments;
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
