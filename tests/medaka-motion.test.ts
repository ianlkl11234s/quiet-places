import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {decodeMedakaMotion, type MedakaMetadata} from '../src/places/afterlight/MedakaMotion.ts';

const metadata = JSON.parse(await readFile(new URL('../public/models/medaka-motion.json', import.meta.url), 'utf8')) as MedakaMetadata;
const binary = await readFile(new URL('../public/models/medaka-motion.bin', import.meta.url));
const motion = decodeMedakaMotion(metadata, binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength));

test('medaka cache preserves its 120-second, 26-fish binary contract', () => {
  assert.deepEqual([metadata.duration, metadata.fps, metadata.frameCount, metadata.fishCount, metadata.stride], [120, 30, 3601, 26, 12]);
  assert.equal(binary.byteLength, 3601 * 26 * 12 * 4);
  assert.deepEqual(metadata.states, ['LOCAL_CRUISE','PLANT_HOVER','LOOSE_SHOAL','GROUP_ACCELERATE','FAST_TRANSIT','GROUP_DECELERATE','REGROUP','SCATTER_MINOR','SHADOW_ROAM']);
});

test('medaka sampler is bounded, nose-forward, separated, and contains every behavioural state', () => {
  const states = new Set<number>(); let minSeparation = Infinity; let fast = 0;
  for (let time = 0; time < 120; time += .1) {
    const fish = Array.from({length: 26}, (_, index) => motion.sample(time, index));
    for (let index=0; index<fish.length; index++) {
      const pose=fish[index]; states.add(pose.state); if (pose.speed >= .14) fast++;
      assert.ok(pose.position.x >= -.8 && pose.position.x <= 1.6 && pose.position.y >= .18 && pose.position.y <= 1.6 && pose.position.z >= -1.7 && pose.position.z <= .9);
      assert.ok(pose.speed > .0001 && pose.speed < .27 && pose.q >= 0 && pose.q <= 1 && pose.state >= 0 && pose.state < 9);
      const before=motion.sample(time-.01,index).position.clone(), after=motion.sample(time+.01,index).position.clone();
      const velocity=after.sub(before); const nose=new THREE.Vector3(0,0,-1).applyQuaternion(pose.quaternion);
      if(pose.speed>.08) assert.ok(nose.dot(velocity.normalize()) > .75, 'cruising fish nose follows motion with bounded turn lag');
      for(let other=0;other<index;other++) minSeparation=Math.min(minSeparation,pose.position.distanceTo(fish[other].position));
    }
  }
  assert.deepEqual([...states].sort((a,b)=>a-b), [0,1,2,3,4,5,6,7,8]);
  assert.ok(fast > 20, 'fast transits are present'); assert.ok(minSeparation > .012, `clearance=${minSeparation}`);
});

test('medaka loop has a continuous return and phase interpolation survives wrapping', () => {
  for(let i=0;i<26;i++) {
    const a=motion.sample(0,i), end=motion.sample(120-1/30,i), seam=motion.sample(120,i);
    assert.ok(end.position.distanceTo(seam.position)<.02, 'no positional seam teleport');
    assert.ok(end.quaternion.angleTo(seam.quaternion)<.45, 'no heading flip at seam');
    assert.ok(Math.abs(end.speed-seam.speed)<.03, 'no speed spike at seam');
    assert.equal(motion.sample(NaN,i).position.distanceTo(a.position),0);
  }
});


test('medaka baked headings stay bounded through hover and the loop seam', () => {
  for(let index=0;index<26;index++) {
    let previous=motion.sample(-1/30,index).quaternion;
    for(let frame=0;frame<3600;frame++) {
      const current=motion.sample(frame/30,index).quaternion;
      assert.ok(previous.angleTo(current)*30 < THREE.MathUtils.degToRad(365), 'no instantaneous hover spin');
      previous=current;
    }
  }
});

test('plant-side sunlight stays occupied throughout the triangle circuit', () => {
  for(let time=0;time<120;time+=.1) {
    const positions=Array.from({length:22},(_,index)=>motion.sample(time,index).position);
    for(const angle of [-.16,0,.16]) {
      const sx=.28*Math.cos(angle)+.25*Math.sin(angle),sz=.25*Math.cos(angle)-.28*Math.sin(angle);
      const count=positions.filter(({x,y,z})=>{const drop=3-y;return x-sx*drop>=.62&&x-sx*drop<=1.28&&z-sz*drop>=-1.25&&z-sz*drop<=-.35;}).length;
      assert.ok(count>=(angle===0?3:2),`sunlight emptied at ${time}s / ${angle}`);
    }
  }
  for(const fish of metadata.fish)assert.ok(fish.length>=.036&&fish.length<=.054,'individual lengths include exactly the authorized 20% display enlargement');
});
