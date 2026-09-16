import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ArcadeAnimalMotion,profiles,animalClearanceRadii} from '../src/places/last-arcade/biology/Motion.ts';
import {envelopeClear} from '../src/places/last-arcade/biology/Obstacles.ts';
import {sampleVirtualFlow} from '../src/systems/virtual-flow/index.ts';

test('900 second large-animal run has bounded speeds, turns, safe envelopes and rare events',()=>{
 const m=new ArcadeAnimalMotion();let low=false,pair=false,glide=false;const max=[0,0,0,0];
 for(let frame=0;frame<=18000;frame++){const time=frame/20;m.advance(time);assert.ok(m.noticeableEvents<=2);
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)assert.ok(m.states[i].position.distanceTo(m.states[j].position)>animalClearanceRadii[i]+animalClearanceRadii[j],`animated-body clearance ${i}/${j} at ${time}`);
  m.states.forEach((s,i)=>{const speed=s.velocity.length();max[i]=Math.max(max[i],speed);assert.ok(Number.isFinite(speed));assert.ok(speed<(i===3?.86:1.4),`no route jump ${s.id} at ${time}: ${speed}`);assert.ok(Math.abs(s.bank)<=THREE.MathUtils.degToRad(i===3?18:50)+.0001);
   if(i===3&&Math.abs(s.curvature)>0)assert.ok(1/Math.abs(s.curvature)>21.25,'whale keeps 2.5L turn radius');
   const lowFlight=s.position.y<7,half=i===3?new THREE.Vector3(4.65,1.65,4.65):new THREE.Vector3(profiles[i].size/2+.16,lowFlight?1.18:1.45,profiles[i].size/2+.16);
   assert.ok(envelopeClear(s.position,half),`${s.id} body envelope intersects architecture at ${time}`);
   low ||= s.state==='LOW_PASS';pair ||= s.state==='PAIR_SYNC';glide ||= s.state==='GLIDE';
  });
 }
 assert.ok(low&&pair&&glide,'seed visits low pass, pair association and glide');
 const snapshot=JSON.stringify(m.debug());m.advance(900);assert.equal(JSON.stringify(m.debug()),snapshot,'pause does not accumulate hidden simulation');
});
test('motion is independent of render scheduling and finite curl has zero divergence',()=>{
 const a=new ArcadeAnimalMotion(),b=new ArcadeAnimalMotion();for(let t=0;t<50;t+=1/60)a.advance(t);a.advance(50);b.advance(50);assert.deepEqual(a.debug(),b.debug());
 const p=new THREE.Vector3(2,8,-11),eps=1e-4;let divergence=0;for(const axis of ['x','y','z'] as const){const plus=p.clone(),minus=p.clone();plus[axis]+=eps;minus[axis]-=eps;divergence+=(sampleVirtualFlow(plus,100)[axis]-sampleVirtualFlow(minus,100)[axis])/(2*eps);}assert.ok(Math.abs(divergence)<1e-8);
});

// The avoidance radius must enclose deformed wings and tails at every tested phase.
test('large-animal collision spheres enclose the animated model vertices',async()=>{
 const {createMantaModel}=await import('../src/creatures/manta/index.ts');
 const {createWhaleSharkModel}=await import('../src/creatures/whale-shark/index.ts');
 const models=[...profiles.slice(0,3).map(p=>createMantaModel(p.size,p.seed)),createWhaleSharkModel(8.5,9140)];
 const point=new THREE.Vector3();
 try{for(let phase=0;phase<24;phase++)models.forEach((m,i)=>{
  m.update({phase:phase/24*Math.PI*2,amplitude:1,glide:phase%2,asymmetry:phase%2?.26:-.26});m.root.updateMatrixWorld(true);
  m.root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const attr=o.geometry.getAttribute('position');for(let v=0;v<attr.count;v++){
   point.fromBufferAttribute(attr,v).applyMatrix4(o.matrixWorld);assert.ok(point.length()<animalClearanceRadii[i],`${profiles[i].id} ${o.name} exceeds safety sphere`);
  }});
 });}finally{models.forEach(m=>m.dispose());}
});
