import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleSharkMotion} from '../src/places/stairlight/SharkMotion.ts';

test('shark patrol stays in the stairwell envelope with an always-moving, continuous pose', () => {
  let minimumSpeed = Infinity, maximumSpeed = 0, maximumFrequency = 0;
  for (let time = 0; time <= 20 * 60; time += .25) {
    const pose = sampleSharkMotion(time);
    assert.ok(pose.position.x > -1.35 && pose.position.x < .90, 'body lane keeps wall and rail clearance');
    assert.ok(pose.position.z > -.90 && pose.position.z < 3.68, 'route stays within the sealed stairwell depth');
    assert.ok(pose.position.y > -1.32 && pose.position.y < 2.78, 'route remains between stair/floor and ceiling clearance');
    assert.ok(pose.speed >= .22 && pose.speed <= .46, 'the patrol has no hover or stop');
    assert.ok(pose.frequency >= .4 && pose.frequency <= .9, 'Strouhal tail cadence is calm');
    assert.ok(Math.abs(pose.quaternion.length() - 1) < 1e-6, 'orientation remains normalized');
    assert.ok(Math.abs(pose.bank) <= 15 * Math.PI / 180 + 1e-8, 'corner bank is restrained');
    assert.ok(Math.abs(pose.pitch) <= 8 * Math.PI / 180 + 1e-8, 'stair following keeps a small body pitch');
    assert.equal(pose.spine.length, 16);
    assert.ok(pose.spine[0].amplitude >= .005 * pose.length && pose.spine[0].amplitude <= .015 * pose.length, 'head stays stable');
    assert.ok(pose.spine[15].amplitude >= .08 * pose.length && pose.spine[15].amplitude <= .14 * pose.length, 'tail has the specified peak excursion');
    for (let i = 1; i < pose.spine.length; i++) {
      assert.ok(pose.spine[i].amplitude >= pose.spine[i - 1].amplitude, 's^2.2 envelope grows toward the tail');
      assert.ok(Math.abs(pose.spine[i].tangent.length() - 1) < 1e-6, 'bone tangent is normalized');
    }
    minimumSpeed = Math.min(minimumSpeed, pose.speed);
    maximumSpeed = Math.max(maximumSpeed, pose.speed);
    maximumFrequency = Math.max(maximumFrequency, pose.frequency);
  }
  assert.ok(minimumSpeed >= .22 && maximumSpeed <= .46 && maximumFrequency <= .9);
});

test('shark sampler is deterministic, phase-integrated, and continuous through route laps', () => {
  assert.deepEqual(sampleSharkMotion(17.25), sampleSharkMotion(17.25));
  assert.deepEqual(sampleSharkMotion(Number.NaN), sampleSharkMotion(0));
  let sawNonRepeatingSpeed = false;
  for (let time = .02; time < 300; time += .37) {
    const before = sampleSharkMotion(time - .01), after = sampleSharkMotion(time + .01);
    assert.ok(before.position.distanceTo(after.position) < .012, 'path never teleports');
    assert.ok(before.quaternion.angleTo(after.quaternion) < .12, 'head direction and bank never snap');
    assert.ok(after.phase > before.phase, 'continuous wave phase always advances');
    const hz = (after.phase - before.phase) / (.02 * Math.PI * 2);
    assert.ok(Math.abs(hz - sampleSharkMotion(time).frequency) < .025, 'public frequency agrees with the integrated phase');
    sawNonRepeatingSpeed ||= Math.abs(sampleSharkMotion(time).speed - sampleSharkMotion(time + 43.7).speed) > .002;
  }
  assert.ok(sawNonRepeatingSpeed, 'a second incommensurate speed term prevents an exactly periodic loop');
  const pose = sampleSharkMotion(35.1);
  const nose = new THREE.Vector3(1, 0, 0).applyQuaternion(pose.quaternion);
  assert.ok(nose.dot(pose.direction) > .99999, 'quaternion leads with the posed shark head direction');
});

test('turn bias slows the patrol while increasing tail amplitude and Strouhal-derived cadence', () => {
  let straight: ReturnType<typeof sampleSharkMotion> | undefined;
  let corner: ReturnType<typeof sampleSharkMotion> | undefined;
  for (let time = 0; time < 180; time += .1) {
    const pose = sampleSharkMotion(time);
    if (!straight || pose.turnBias < straight.turnBias) straight = pose;
    if (!corner || pose.turnBias > corner.turnBias) corner = pose;
  }
  assert.ok(corner && straight && corner.turnBias > .35, 'route contains a readable corner demand');
  assert.ok(corner!.speed < straight!.speed, 'turn demand reduces cruise speed without stopping');
  assert.ok(corner!.spine.at(-1)!.amplitude > straight!.spine.at(-1)!.amplitude, 'rear wave widens in the turn');
  assert.ok(corner!.frequency > .27*corner!.speed/(2*.09*corner!.length), 'turn cadence exceeds straight-cruise cadence at the same measured speed');
});


test('reported speed matches world displacement and the wave keeps moving after an hour',()=>{
 for(let t=.01;t<180;t+=.21){
  const p=sampleSharkMotion(t),a=sampleSharkMotion(t-.005),b=sampleSharkMotion(t+.005);
  const actual=a.position.distanceTo(b.position)/.01;
  assert.ok(Math.abs(actual-p.speed)<.018,`world speed ${actual} disagrees with ${p.speed}`);
 }
 for(const t of [1800,3600,3610]){
  const a=sampleSharkMotion(t),b=sampleSharkMotion(t+.02);
  assert.ok(b.phase>a.phase,'long-running wave must not freeze');
  assert.ok(Math.abs((b.phase-a.phase)/(.02*Math.PI*2)-a.frequency)<.02);
 }
});


test('out-and-back patrol crosses flights only at the shared landing',()=>{
 let ascending=false,descending=false,upperTurn=false,lowerTurn=false;
 for(let t=0;t<240;t+=.08){
  const p=sampleSharkMotion(t),{x,y,z}=p.position;
  if(z>.05)assert.ok(x<-.60||x>.15,'must not cross the stair void between flights');
  if(z>2.85){
   if(x<-.6){assert.ok(y>2.3,'upper platform turn stays on its own level');upperTurn=true;}
   else{assert.ok(y<-.8&&y>-1.2,'lower platform turn stays on its own level');lowerTurn=true;}
  }
  if(x<-.6&&z>.4&&z<2.4){ascending ||= p.direction.z>0;descending ||= p.direction.z<0;}
 }
 assert.ok(ascending&&descending&&upperTurn&&lowerTurn,'must retrace upper stairs and turn on both physical platforms');
});
