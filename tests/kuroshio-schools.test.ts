import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createArcadeSchools} from '../src/systems/schooling/index.ts';
import {arcadeObstacles} from '../src/places/last-arcade/biology/Obstacles.ts';

const obstacles=arcadeObstacles();
function run(seed:number,seconds:number){const school=createArcadeSchools({seed,obstacles});for(let i=0;i<=seconds*12;i++)school.update(1/12,i/12);const result=school.getDebug();school.dispose();return result;}
type Agent={heading:[number,number,number];speedBL:number;phase:number};
type Debug={chromis:{agents:Agent[];meanSpeedBL:number};fusilier:{agents:Agent[];meanSpeedBL:number}};
function renderedFish(school:ReturnType<typeof createArcadeSchools>,rootName:string,index:number){
 const root=school.root.getObjectByName(rootName) as THREE.Group;
 const mesh=root.children.find(child=>child instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
 const matrix=new THREE.Matrix4();mesh.getMatrixAt(index,matrix);
 const position=new THREE.Vector3(),orientation=new THREE.Quaternion(),scale=new THREE.Vector3();matrix.decompose(position,orientation,scale);
 const phase=(mesh.geometry.getAttribute('aPhase') as THREE.InstancedBufferAttribute).getX(index);
 return {position,orientation,phase};
}
function angularRate(a:THREE.Vector3,b:THREE.Vector3,dt:number){return Math.acos(THREE.MathUtils.clamp(a.dot(b),-1,1))/dt;}
test('Kuroshio schools are seeded, fixed-step and pause-safe',()=>{
 const a=run(44,600),b=run(44,600);assert.deepEqual(a,b);
 const school=createArcadeSchools({seed:9,obstacles});school.update(1/60,5);const before=school.getDebug();school.update(3,5);assert.deepEqual(school.getDebug(),before);school.dispose();
});
test('Kuroshio pool has 100 shelter Chromis, 50 corridor-roaming Fusilier, and exposes quality metrics',()=>{
 const school=createArcadeSchools({seed:2,obstacles});school.update(1/60,0);const debug=school.getDebug() as {chromis:{count:number;polarization:number};fusilier:{count:number;polarization:number};stepHz:number};assert.equal(debug.stepHz,12);assert.equal(debug.chromis.count,100);assert.equal(debug.fusilier.count,50);assert.ok(debug.fusilier.polarization>=debug.chromis.polarization);school.disturb();school.update(1/12,1/12);school.dispose();
});
test('Kuroshio renders continuous, upright instance poses and controller-owned tail phase between 12Hz steps',()=>{
 const school=createArcadeSchools({seed:71,obstacles}),step=1/12;
 school.update(0,0);school.update(0,step);const start=renderedFish(school,'CHROMIS_VIRIDIS_INSTANCED',0);
 school.update(0,step*1.5);const middle=renderedFish(school,'CHROMIS_VIRIDIS_INSTANCED',0);
 school.update(0,step*2);const end=renderedFish(school,'CHROMIS_VIRIDIS_INSTANCED',0);
 const path=start.orientation.angleTo(end.orientation);
 assert.ok(start.position.distanceTo(end.position)>1e-5,'fixed simulation step produces an observable instance translation');
 assert.ok(middle.position.distanceTo(start.position)>1e-7&&middle.position.distanceTo(end.position)>1e-7,'rendered matrix moves before the next controller step');
 assert.ok(path>1e-5&&Math.abs(start.orientation.angleTo(middle.orientation)-path/2)<.002,'rendered matrix slerps its heading during the frame');
 assert.ok(Math.abs(middle.phase-(start.phase+end.phase)/2)<1e-5,'instance tail phase is interpolated without wrapping');
 const forward=new THREE.Vector3(0,0,-1).applyQuaternion(middle.orientation);
 assert.ok(Math.abs(forward.dot(new THREE.Vector3(0,1,0)))<.35,'rendered fish stays visibly upright while it turns');
 const paused=renderedFish(school,'CHROMIS_VIRIDIS_INSTANCED',0);school.update(99,step*2);const pausedAgain=renderedFish(school,'CHROMIS_VIRIDIS_INSTANCED',0);
 assert.deepEqual(pausedAgain,paused,'a repeated elapsed timestamp cannot jitter the rendered matrix or phase');school.dispose();
});
test('600 seconds against the real arcade proxy fixture has no body penetration and reports ten-second windows',()=>{
 const result=run(917,600) as {windows:{penetrations:number}[];chromis:{actualPenetrations:number};fusilier:{actualPenetrations:number}};
 assert.equal(result.windows.length,60);assert.equal(result.chromis.actualPenetrations,0);assert.equal(result.fusilier.actualPenetrations,0);assert.ok(result.windows.every(w=>w.penetrations===0));
});
test('Kuroshio schools keep gentle vertical travel, bounded turns, and cruising speeds through a one-minute run',()=>{
 const school=createArcadeSchools({seed:808,obstacles}),previous:{chromis:Agent[];fusilier:Agent[]}={chromis:[],fusilier:[]};
 let chromisVertical=false,fusilierVertical=false,maxChromisTurn=0,maxFusilierTurn=0;
 for(let frame=0;frame<=60*12;frame++){
  school.update(0,frame/12);const now=school.getDebug() as Debug;
  for(const kind of ['chromis','fusilier'] as const)now[kind].agents.forEach((agent,index)=>{
   const heading=new THREE.Vector3(...agent.heading),before=previous[kind][index];
   if(before){const prior=new THREE.Vector3(...before.heading);if(kind==='chromis')maxChromisTurn=Math.max(maxChromisTurn,angularRate(prior,heading,1/12));else maxFusilierTurn=Math.max(maxFusilierTurn,angularRate(prior,heading,1/12));}
   if(Math.abs(heading.y)>.01){if(kind==='chromis')chromisVertical=true;else fusilierVertical=true;}
  });
  previous.chromis=now.chromis.agents;previous.fusilier=now.fusilier.agents;
 }
 const final=school.getDebug() as Debug;school.dispose();
 assert.ok(chromisVertical&&fusilierVertical,'both schools make natural, non-flat vertical adjustments');
 assert.ok(maxChromisTurn<THREE.MathUtils.degToRad(40),'Chromis headings change gradually instead of snapping');
 assert.ok(maxFusilierTurn<THREE.MathUtils.degToRad(30),'Fusilier headings change gradually instead of snapping');
 assert.ok(final.chromis.agents.every(agent=>Math.abs(agent.heading[1])<.36),'Chromis pitch remains shallow');
 assert.ok(final.fusilier.agents.every(agent=>Math.abs(agent.heading[1])<.29),'Fusilier pitch remains shallow');
 assert.ok(final.chromis.meanSpeedBL>.55&&final.chromis.meanSpeedBL<1.2,'Chromis remains in a slow cruising band');
 assert.ok(final.fusilier.meanSpeedBL>.85&&final.fusilier.meanSpeedBL<1.65,'Fusilier remains in a measured cruising band');
});
