/**
 * J3 flow-field statistics for snowwindow (deterministic, no browser).
 * CLI: node --experimental-strip-types tools/snowwindow-biology/flow-stats.ts [outDir]
 * Writes J3-flow-summary.json, J3-ring-decay.csv (Γ and probe speed vs beats) and
 * J3-below-bell-60s.csv (flow along −axis .5 D below each jelly, wake vs background, 60 Hz).
 */
import {Vector3} from 'three';
import {createCreatureMotion,DEFAULT_CREATURE_CONTROLS,JELLY_PRESETS} from '../../src/places/snowwindow/CreatureMotion.ts';
import {addRingVelocity,backgroundCurrent,ringCenter,ringStrength} from '../../src/shared/biology/VirtualFluid.ts';

const out=process.argv[2]??'exports/quality-j-20260927/J3-J4/after';
const {writeFileSync,mkdirSync}=await import('node:fs');mkdirSync(out,{recursive:true});
const gain=DEFAULT_CREATURE_CONTROLS.currentGain*(1-.3*DEFAULT_CREATURE_CONTROLS.quietness);
let seed=11;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const speeds:number[]=[];for(let i=0;i<20000;i++)speeds.push(backgroundCurrent(new Vector3(-.68+3.48*rnd(),1+3.3*rnd(),-4.25+2.33*rnd()),rnd()*600,gain).length()*100);
speeds.sort((a,b)=>a-b);const pct=(q:number)=>+speeds[Math.min(speeds.length-1,Math.floor(q*speeds.length))].toFixed(3);
const motion=createCreatureMotion(7),rows=['t,name,wakeAlongAxis_cm_s,backgroundAlongAxis_cm_s,cycle'];
const peaks=JELLY_PRESETS.map(()=>[] as number[]),perBeat=JELLY_PRESETS.map(()=>({beat:NaN,peak:0}));
let maxRelDiv=0;
for(let k=1;k<=60*60;k++){const t=k/60;motion.update(t);
 motion.states.slice(0,3).forEach((s,i)=>{const axis=new Vector3(0,0,1).applyQuaternion(s.orientation),p=s.position.clone().addScaledVector(axis,-.5*JELLY_PRESETS[i].diameter);
  const all=motion.sampleFlow(p,t),bg=backgroundCurrent(p,t,gain),wake=-all.clone().sub(bg).dot(axis)*100;
  rows.push([t.toFixed(4),s.name,wake.toFixed(4),(-bg.dot(axis)*100).toFixed(4),(((s.phase/(2*Math.PI))%1+1)%1).toFixed(4)].join(','));
  if(s.beat!==perBeat[i].beat){if(t>5&&perBeat[i].peak>0)peaks[i].push(perBeat[i].peak);perBeat[i]={beat:s.beat,peak:0};}perBeat[i].peak=Math.max(perBeat[i].peak,wake);
  if(k%120===0){const e=1e-4;let div=0,grad=0;for(let a=0;a<3;a++){const hi=p.clone(),lo=p.clone();hi.setComponent(a,hi.getComponent(a)+e);lo.setComponent(a,lo.getComponent(a)-e);const d=(motion.sampleFlow(hi,t).getComponent(a)-motion.sampleFlow(lo,t).getComponent(a))/(2*e);div+=d;grad+=Math.abs(d);}maxRelDiv=Math.max(maxRelDiv,Math.abs(div)/Math.max(grad,1e-9));}
 });}
const ring=motion.wakeRings.find(r=>r.kind==='start'&&r.source==='JELLY_A')!,T=ring.life/3,decay=['beats,gammaRatio,probeSpeed_cm_s'];
for(let b=0;b<=3.2001;b+=.05){const t=ring.time+b*T;decay.push([b.toFixed(2),ringStrength(ring,b*T).toFixed(5),(addRingVelocity(ring,ringCenter(ring,t),t,new Vector3()).length()*100).toFixed(4)].join(','));}
const med=(v:number[])=>{const s=[...v].sort((a,b)=>a-b);return +(s[s.length>>1]??0).toFixed(3);};
const summary={background_cm_s:{gain,p5:pct(.05),p50:pct(.5),p95:pct(.95),max:pct(1)},
 wakeDownBelowBell_cm_s:JELLY_PRESETS.map((p,i)=>({name:p.name,beats:peaks[i].length,medianPeak:med(peaks[i]),maxPeak:+Math.max(0,...peaks[i]).toFixed(3)})),
 ringJELLY_A:{circulation_m2_s:+ring.circulation.toFixed(5),radius_m:+ring.radius.toFixed(3),gammaAt2Beats:+ringStrength(ring,2*T).toFixed(4),gammaAt3Beats:ringStrength(ring,3*T)},
 maxRelativeDivergence:maxRelDiv};
writeFileSync(`${out}/J3-flow-summary.json`,JSON.stringify(summary,null,1)+'\n');writeFileSync(`${out}/J3-ring-decay.csv`,decay.join('\n')+'\n');writeFileSync(`${out}/J3-below-bell-60s.csv`,rows.join('\n')+'\n');
console.log(JSON.stringify(summary,null,1));
