import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createCreatureMotion} from '../src/places/snowwindow/CreatureMotion.ts';
import {anchorFromBeatEvents,createMarineSnow,MARINE_SNOW,WINDOW_SHAFT,windowShaftMask} from '../src/places/snowwindow/MarineSnow.ts';

const setup=(mode:'off'|'particles'|'particles-dense'='particles')=>{const motion=createCreatureMotion(7);const snow=createMarineSnow({sampleFlow:(p,t,out)=>motion.sampleFlow(p,t,undefined,out),anchor:anchorFromBeatEvents(()=>motion.beatEvents),mode});return {motion,snow,update(t:number){motion.update(t);snow.update(t,1);}};};

test('J4 window shaft mask: exactly zero outside the aperture/behind the glass, soft inside',()=>{
 assert.equal(windowShaftMask(1,3,-4.6),0,'behind the glazing');
 const {aperture:a,direction:d,glassZ}=WINDOW_SHAFT,at=(qx:number,qy:number,depth:number)=>windowShaftMask(qx+d.x*depth/d.z,qy+d.y*depth/d.z,glassZ+depth);
 assert.equal(at(a.x0-.01,3.5,1),0);assert.equal(at(a.x1+.01,3.5,1),0);assert.equal(at(1,a.y0-.01,1),0);assert.equal(at(1,a.y1+.01,1),0);
 assert.ok(at(.75,3.5,1)>.5);assert.ok(at(a.x0+.05,3.5,1)<at(.75,3.5,1),'soft inner edge');
 assert.ok(at(.75,3.5,2)<at(.75,3.5,.5),'falls off with depth');
 // a large share of the scene volume is dark: the effect is not scene-wide
 let dark=0,n=0;for(let x=-.6;x<2.8;x+=.2)for(let y=1;y<4.4;y+=.2)for(let z=-4.2;z<-1.9;z+=.2){n++;if(windowShaftMask(x,y,z)===0)dark++;}
 assert.ok(dark/n>.25&&dark/n<.8,`dark share ${dark/n}`);
});
test('J4 marine snow is deterministic across pause, rewind and frame partition; modes change only the count',()=>{
 const a=setup(),b=setup(),dense=setup('particles-dense');
 a.update(40);for(let i=1;i<=40*30;i++)b.update(i/30);dense.update(40);
 const n=a.snow.activeCount;assert.equal(n,MARINE_SNOW.count.particles);assert.equal(dense.snow.activeCount,MARINE_SNOW.count['particles-dense']);
 const slice=(s:typeof a)=>Array.from(s.snow.positions.slice(0,n*3));
 assert.deepEqual(slice(a),slice(b));assert.deepEqual(slice(a),slice(dense));
 const snap=JSON.stringify(slice(a));a.update(40);assert.equal(JSON.stringify(slice(a)),snap);a.update(7);a.update(40);assert.equal(JSON.stringify(slice(a)),snap);
 assert.ok(slice(a).every(Number.isFinite));
 const off=setup('off');off.update(10);assert.equal(off.snow.activeCount,0);assert.equal(off.snow.points.visible,false);
});
test('J4 tracers under a bell are pushed along −axis right after contractions (wake visible in the particles)',()=>{
 const {motion,snow,update}=setup('particles-dense');update(40);
 const events=motion.beatEvents.filter(v=>v.kind==='contraction'&&v.time>12&&v.time<39);
 let wake=0,count=0,last=0;const p=new Vector3(),q=new Vector3();
 const replay=setup('particles-dense');
 for(const e of events){const t0=Math.ceil(e.time*30)/30,t1=t0+.3/e.frequency;if(t0<last)continue;last=t1;
  replay.update(t0);const before=Float64Array.from(replay.snow.positions),gens=Array.from({length:replay.snow.activeCount},(_,i)=>replay.snow.generationOf(i));replay.update(t1);
  const axis=new Vector3(...e.axis),c=new Vector3(...e.position);
  for(let i=0;i<replay.snow.activeCount;i++){if(gens[i]!==replay.snow.generationOf(i))continue;p.fromArray(before,i*3);const rel=p.clone().sub(c),along=rel.dot(axis),radial=rel.clone().addScaledVector(axis,-along).length();
   if(along<-.1*e.diameter&&along>-e.diameter&&radial<.3*e.diameter){q.fromArray(replay.snow.positions,i*3);wake+=q.sub(p).dot(axis);count++;}}}
 assert.ok(count>=15,`tracers under the bells: ${count}`);
 assert.ok(wake/count<-.003,`mean displacement along axis ${wake/count} m over ${count}`);
 assert.ok(snow.activeCount>0);
});
