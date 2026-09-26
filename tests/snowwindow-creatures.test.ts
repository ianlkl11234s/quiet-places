import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {addRingVelocity,backgroundCurrent,ringCenter,ringFromBeat,ringStrength,virtualCurrent} from '../src/shared/biology/VirtualFluid.ts';
import {createCreatureMotion,DEFAULT_CREATURE_CONTROLS,jellyForces,JELLY_ATTITUDE,JELLY_PRESETS} from '../src/places/snowwindow/CreatureMotion.ts';
import {AURELIA_PULSE,sampleAureliaKinematics} from '../src/shared/biology/aurelia/index.ts';

const positions=(m:ReturnType<typeof createCreatureMotion>)=>m.states.map(s=>[...s.position.toArray(),...s.orientation.toArray(),s.phase]);
test('snow creatures retain the population and give the same trajectories on rewind, pause, and different frame partitions',()=>{
 assert.throws(()=>createCreatureMotion(3));assert.throws(()=>createCreatureMotion(8));
 const a=createCreatureMotion(),b=createCreatureMotion();assert.equal(a.states.length,8);a.update(12);for(let i=1;i<=360;i++)b.update(i/30);assert.deepEqual(positions(a),positions(b));
 const snapshot=positions(a);a.update(12);assert.deepEqual(positions(a),snapshot);a.update(2);a.update(12);assert.deepEqual(positions(a),snapshot);
 assert.equal(createCreatureMotion(7).states.length,10);
});
test('unpowered Clione actually sink in the declared terminal-speed range',()=>{
 const sinking=createCreatureMotion(5,{freezeWings:true,currentGain:0});sinking.update(30);
 for(const state of sinking.states.slice(3)){assert.ok(state.velocity.y<-.005&&state.velocity.y>-.012,`${state.name}: ${state.velocity.y}`);assert.equal(state.leftForce,0);assert.equal(state.rightForce,0);}
});
test('three-jelly calibration has nonzero post-relaxation travel within the requested fraction',()=>{
 for(const p of JELLY_PRESETS){let velocity=0,total=0,glide=0;
  for(let step=1;step<=120*90;step++){
   const time=step/120,s=sampleAureliaKinematics(time,p),f=jellyForces(p.diameter,s.frequency,s.cycle,s.contractionRate);
   velocity+=(f.pulse+f.per-f.dragFactor*velocity*Math.abs(velocity))/f.mass/120;
   if(time>30){total+=velocity/120;if(s.cycle>=AURELIA_PULSE.relaxEnd)glide+=velocity/120;}
  }
  assert.ok(glide/total>=.25&&glide/total<=.35,`${p.name}: ${glide/total}`);
 }
});
test('60-second group stays finite, separated, in front of the glazing, and does not synchronize persistently',()=>{
 const motion=createCreatureMotion();let highSynchrony=0,maxHighSynchrony=0;
 for(let frame=0;frame<=60*30;frame++){
  motion.update(frame/30);let re=0,im=0;
  motion.states.forEach((s,index)=>{
   assert.ok([...s.position.toArray(),...s.velocity.toArray(),...s.orientation.toArray()].every(Number.isFinite));
   const radius=index<3?JELLY_PRESETS[index].diameter*.6:.025;
   assert.ok(s.position.z-radius>-4.42&&s.position.y-radius>.78,'never penetrates glazing or sill');
   assert.ok(s.position.x-radius>-.95,'never penetrates side wall');
   if(index<3){re+=Math.cos(s.phase);im+=Math.sin(s.phase);for(let j=0;j<index;j++)assert.ok(s.position.distanceTo(motion.states[j].position)>1.2*(JELLY_PRESETS[index].diameter+JELLY_PRESETS[j].diameter)/2);}
  });
  highSynchrony=Math.hypot(re,im)/3>.9?highSynchrony+1:0;maxHighSynchrony=Math.max(maxHighSynchrony,highSynchrony);
 }
 assert.ok(maxHighSynchrony/30<5,`synchrony lasted ${maxHighSynchrony/30}s`);
});
test('virtual current is bounded and numerically divergence-free',()=>{
 const epsilon=1e-4;
 for(const time of [0,4,19,60]){const p=new Vector3(.4,2,-3),flow=virtualCurrent(p,time);assert.ok(flow.length()<.012);let divergence=0;
  for(let axis=0;axis<3;axis++){const a=p.clone(),b=p.clone();a.setComponent(axis,a.getComponent(axis)+epsilon);b.setComponent(axis,b.getComponent(axis)-epsilon);divergence+=(virtualCurrent(a,time).getComponent(axis)-virtualCurrent(b,time).getComponent(axis))/(2*epsilon);}
  assert.ok(Math.abs(divergence)<1e-8);
 }
});

test('J2 jelly attitude: tilts and turns by asymmetric beats within the research envelope over 60 s',()=>{
 const motion=createCreatureMotion(7),tilt:number[][]=[[],[],[]],axes:Vector3[][]=[[],[],[]],onsets:number[][]=[[],[],[]],last=[1,1,1],contract=[0,0,0],active=[0,0,0];let omega=0;
 for(let k=1;k<=60*120;k++){motion.update(k/120);motion.states.slice(0,3).forEach((s,i)=>{
  const cycle=((s.phase/(2*Math.PI))%1+1)%1,n=new Vector3(0,0,1).applyQuaternion(s.orientation);
  if(cycle<last[i]){onsets[i].push(k/120);axes[i].push(n);}last[i]=cycle;
  tilt[i].push(s.tilt*180/Math.PI);omega=Math.max(omega,s.angularVelocity.length());
  if(s.activity>.2){active[i]++;if(s.pulseRate>0)contract[i]++;}
 });}
 assert.ok(omega<=JELLY_ATTITUDE.maxAngularSpeed+1e-9,`|ω| ${omega}`);
 JELLY_PRESETS.forEach((p,i)=>{
  const measured=(onsets[i].length-1)/(onsets[i][onsets[i].length-1]-onsets[i][0]);
  assert.ok(Math.abs(measured-p.frequency)/p.frequency<.05,`${p.name} frequency ${measured}`);
  const share=contract[i]/active[i];assert.ok(share>=.18&&share<=.22,`${p.name} contraction share ${share}`);
  const sorted=[...tilt[i]].sort((a,b)=>a-b),median=sorted[sorted.length>>1],over=tilt[i].filter(v=>v>25).length/tilt[i].length;
  assert.ok(median>=8&&median<=20,`${p.name} tilt median ${median}`);assert.ok(over>=.05,`${p.name} >25° share ${over}`);
  for(let b=1;b<axes[i].length;b++)assert.ok(Math.acos(Math.min(1,axes[i][b-1].dot(axes[i][b])))<=JELLY_ATTITUDE.maxBeatTurn,`${p.name} beat ${b} turn`);
 });
});
test('J2 beat events are emitted per stroke and rebuilt identically on rewind',()=>{
 const a=createCreatureMotion(),b=createCreatureMotion();a.update(30);for(let i=1;i<=900;i++)b.update(i/30);
 assert.deepEqual(a.beatEvents,b.beatEvents);
 const events=a.beatEvents.filter(e=>e.kind==='contraction');assert.ok(events.length>=10);
 for(const e of events){assert.ok(e.strength>0&&e.index<3&&e.time<=30);assert.ok(Math.abs(Math.hypot(...e.axis)-1)<1e-6);assert.ok(e.position.every(Number.isFinite));}
 assert.ok(a.beatEvents.some(e=>e.kind==='relaxation'));
 const snapshot=JSON.stringify(a.beatEvents);a.update(5);a.update(30);assert.equal(JSON.stringify(a.beatEvents),snapshot);
 assert.deepEqual(a.beatEventsSince(29).map(e=>e.time),a.beatEvents.filter(e=>e.time>29).map(e=>e.time));
});

// ---- J3 flow field and one-way coupling ----
test('J3 unified flow is numerically divergence-free, including next to live wake rings',()=>{
 const motion=createCreatureMotion();motion.update(40);
 const e=1e-4,points:Vector3[]=[];
 for(const ring of motion.wakeRings.slice(-6)){const c=ringCenter(ring,40);points.push(c.clone(),c.clone().add(new Vector3(...ring.e1).multiplyScalar(ring.radius*.8)),c.clone().add(new Vector3(...ring.jet).multiplyScalar(ring.radius*.5)));}
 points.push(new Vector3(.4,2,-3),new Vector3(1.5,3.1,-2.6));
 let checked=0;
 for(const p of points){const u=motion.sampleFlow(p,40).length();let div=0,grad=0;
  for(let a=0;a<3;a++){const hi=p.clone(),lo=p.clone();hi.setComponent(a,hi.getComponent(a)+e);lo.setComponent(a,lo.getComponent(a)-e);const d=(motion.sampleFlow(hi,40).getComponent(a)-motion.sampleFlow(lo,40).getComponent(a))/(2*e);div+=d;grad+=Math.abs(d);}
  assert.ok(Math.abs(div)<=1e-5*Math.max(grad,1e-3)+1e-9,`div ${div} vs |∂u| ${grad} at ${p.toArray()} (|u| ${u})`);checked++;}
 assert.ok(checked>=5);
});
test('J3 wake rings: Γ decays to ≤10% within 2–3 beats and is exactly zero at 3 beats; probe speed follows',()=>{
 const ring=ringFromBeat({name:'X',kind:'contraction',time:10,position:[0,2,-3],axis:[0,1,0],strength:.0042,diameter:.3,frequency:.32}),T=1/.32;
 assert.ok(ringStrength(ring,.2*T)>.7);assert.ok(ringStrength(ring,2*T)<=.1,`${ringStrength(ring,2*T)}`);
 assert.equal(ringStrength(ring,3*T),0);assert.equal(ringStrength(ring,0),0);
 const probe=(age:number)=>{const c=ringCenter(ring,10+age);return addRingVelocity(ring,c,10+age,new Vector3()).length();};
 const peak=Math.max(...[.3,.5,.8,1].map(b=>probe(b*T)));
 assert.ok(peak>.005,`peak ${peak}`);assert.ok(probe(2*T)<.12*peak);assert.equal(probe(3*T),0);
 // starting ring: on-axis jet points away from the bell (−axis) and the ring drifts that way
 const below=addRingVelocity(ring,ringCenter(ring,10+.5*T),10+.5*T,new Vector3());assert.ok(below.y<0);
 assert.ok(ringCenter(ring,10+2*T).y<ring.center[1]);
 const stop=ringFromBeat({name:'X',kind:'relaxation',time:10,position:[0,2,-3],axis:[0,1,0],strength:.0042,diameter:.3,frequency:.32});
 assert.ok(addRingVelocity(stop,new Vector3(...stop.center),10+.5*T,new Vector3()).y>0,'stopping ring draws water up under the bell');
});
test('J3 coupling: a contraction pushes water down below the bell; roots exclude only their own rings',()=>{
 const motion=createCreatureMotion();motion.update(40);
 const event=[...motion.beatEvents].reverse().find(e=>e.kind==='contraction'&&e.time<39)!,t=event.time+.25/event.frequency;
 motion.update(t);
 const axis=new Vector3(...event.axis),below=new Vector3(...event.position).addScaledVector(axis,-.5*event.diameter);
 const all=motion.sampleFlow(below,t),own=motion.sampleFlow(below,t,event.name);
 assert.ok(all.clone().sub(own).dot(axis)<-.005,`wake along −axis ${all.clone().sub(own).dot(axis)}`);
 const background=backgroundCurrent(below,t,DEFAULT_CREATURE_CONTROLS.currentGain*(1-.3*DEFAULT_CREATURE_CONTROLS.quietness));
 assert.ok(own.distanceTo(background)<.02,'excluded sample is background plus only other jellies\' far rings');
});
test('J3 background band and deterministic flow on rewind / pause / frame partition',()=>{
 const gain=DEFAULT_CREATURE_CONTROLS.currentGain*(1-.3*DEFAULT_CREATURE_CONTROLS.quietness),speeds:number[]=[];let s=1;
 const rnd=()=>((s=Math.imul(s,1664525)+1013904223>>>0)/4294967296);
 for(let i=0;i<4000;i++)speeds.push(backgroundCurrent(new Vector3(-.68+3.48*rnd(),1+3.3*rnd(),-4.25+2.33*rnd()),rnd()*600,gain).length());
 speeds.sort((a,b)=>a-b);assert.ok(speeds[2000]>=.004&&speeds[2000]<=.008,`p50 ${speeds[2000]}`);assert.ok(speeds[3999]<.02,`max ${speeds[3999]}`);
 const a=createCreatureMotion(),b=createCreatureMotion(),p=new Vector3(1.1,2.3,-3.3);a.update(45);for(let i=1;i<=45*30;i++)b.update(i/30);
 const samples=(m:typeof a)=>[44.2,44.9,45].map(t=>m.sampleFlow(p,t).toArray());
 assert.deepEqual(samples(a),samples(b));const snap=JSON.stringify(samples(a));
 a.update(45);assert.equal(JSON.stringify(samples(a)),snap);a.update(3);a.update(45);assert.equal(JSON.stringify(samples(a)),snap);
 assert.equal(a.wakeRings.length,a.beatEvents.length);
});
