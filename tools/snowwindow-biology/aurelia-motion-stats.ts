/**
 * J2 60-second motion statistics for the three snowwindow Aurelia (deterministic, 120 Hz).
 * CLI: node --experimental-strip-types tools/snowwindow-biology/aurelia-motion-stats.ts [outDir]
 * Writes aurelia-motion-60s.csv (per 1/30 s row) and aurelia-motion-summary.json.
 */
import {Vector3} from 'three';
import {JELLY_PRESETS,jellyForces} from '../../src/places/snowwindow/CreatureMotion.ts';
import {createSnowCreatures} from '../../src/places/snowwindow/Creatures.ts';
import {AURELIA_PULSE,sampleAureliaKinematics} from '../../src/shared/biology/aurelia/index.ts';

const STEP=1/120,TAU=2*Math.PI,DEG=180/Math.PI;
export interface JellyMotionSummary {
 name:string;nominalHz:number;measuredHz:number;frequencyError:number;contractionShare:number;
 /** perShare: in-scene axial displacement share during the pause (includes current, buoyancy, home/boundary forces); perShareCalibrated: isolated still-water calibration (acceptance metric, same as the test) */
 perShare:number;perShareCalibrated:number;
 tiltMedianDeg:number;tiltP90Deg:number;tiltMaxDeg:number;tiltOver25Share:number;tiltHistogramDeg:number[];
 beats:number;maxBeatTurnDeg:number;medianBeatTurnDeg:number;maxAngularSpeed:number;armLagBeats:number;armLagCorrelation:number;
}
export function measureJellyMotion(seconds=60,warmup=0){
 const creatures=createSnowCreatures({clioneCount:7}),motion=creatures.motion,rows:string[]=['t,name,cycle,pulseRate,activity,behavior,tiltDeg,omega,turn,x,y,z,vx,vy,vz,armTipRadial,margin'];
 const n=Math.round(seconds/STEP),acc=JELLY_PRESETS.map(()=>({tilt:[] as number[],omegaMax:0,contract:0,active:0,axial:0,glide:0,beatAxes:[] as Vector3[],margin:[] as number[],arm:[] as number[],startPhase:0,endPhase:0,onsets:[] as number[],lastCycle:-1}));
 for(let k=0;k<=n;k++){
  const t=warmup+k*STEP;creatures.update(t);
  motion.states.slice(0,3).forEach((s,i)=>{
   const a=acc[i],cycle=((s.phase/TAU)%1+1)%1,normal=new Vector3(0,0,1).applyQuaternion(s.orientation);
   if(k===0)a.startPhase=s.phase;a.endPhase=s.phase;
   if(a.lastCycle>=0&&cycle<a.lastCycle){a.onsets.push(t);a.beatAxes.push(normal.clone());}a.lastCycle=cycle;
   a.tilt.push(s.tilt*DEG);a.omegaMax=Math.max(a.omegaMax,s.angularVelocity.length());
   if(s.activity>.2){a.active++;if(s.pulseRate>0)a.contract++;const d=s.velocity.dot(normal)*STEP;a.axial+=d;if(cycle>=AURELIA_PULSE.relaxEnd)a.glide+=d;}
   const diag=creatures.jellies[i].group.userData.aureliaDiagnostics,app=creatures.jellies[i].group.userData.aureliaAppendage;
   a.margin.push(diag.marginResponse);a.arm.push(-app.armTipRadial);
   if(k%4===0)rows.push([t.toFixed(4),s.name,cycle.toFixed(4),s.pulseRate.toFixed(4),s.activity.toFixed(2),s.behavior,(s.tilt*DEG).toFixed(2),s.angularVelocity.length().toFixed(4),s.turn.toFixed(3),...s.position.toArray().map(v=>v.toFixed(4)),...s.velocity.toArray().map(v=>v.toFixed(5)),app.armTipRadial.toFixed(5),diag.marginResponse.toFixed(4)].join(','));
  });
 }
 creatures.dispose();
 const summaries:JellyMotionSummary[]=acc.map((a,i)=>{
  const p=JELLY_PRESETS[i],sorted=[...a.tilt].sort((x,y)=>x-y),q=(f:number)=>sorted[Math.min(sorted.length-1,Math.floor(f*sorted.length))];
  const measuredHz=a.onsets.length>1?(a.onsets.length-1)/(a.onsets[a.onsets.length-1]-a.onsets[0]):0;
  const turns:number[]=[];for(let b=1;b<a.beatAxes.length;b++)turns.push(Math.acos(Math.min(1,a.beatAxes[b-1].dot(a.beatAxes[b])))*DEG);
  const ts=[...turns].sort((x,y)=>x-y);
  const hist=Array.from({length:8},(_,b)=>a.tilt.filter(v=>v>=b*5&&(b===7||v<b*5+5)).length/a.tilt.length);
  const lag=phaseLag(a.margin,a.arm,Math.round(1/(p.frequency*STEP)));
  return {name:p.name,nominalHz:p.frequency,measuredHz,frequencyError:Math.abs(measuredHz-p.frequency)/p.frequency,contractionShare:a.contract/Math.max(1,a.active),perShare:a.glide/Math.max(1e-9,a.axial),perShareCalibrated:calibratedPer(p),
   tiltMedianDeg:q(.5),tiltP90Deg:q(.9),tiltMaxDeg:sorted[sorted.length-1],tiltOver25Share:a.tilt.filter(v=>v>25).length/a.tilt.length,tiltHistogramDeg:hist,
   beats:a.onsets.length,maxBeatTurnDeg:ts[ts.length-1]??0,medianBeatTurnDeg:ts[Math.floor(ts.length/2)]??0,maxAngularSpeed:a.omegaMax,armLagBeats:lag.beats,armLagCorrelation:lag.correlation};
 });
 return {summaries,rows};
}
/** Still-water 1-D calibration (no current, walls, buoyancy or steering): share of travel during the pause. */
export function calibratedPer(p:typeof JELLY_PRESETS[number]){let v=0,total=0,glide=0;for(let k=1;k<=120*90;k++){const t=k/120,s=sampleAureliaKinematics(t,p),f=jellyForces(p.diameter,s.frequency,s.cycle,s.contractionRate);v+=(f.pulse+f.per-f.dragFactor*v*Math.abs(v))/f.mass/120;if(t>30){total+=v/120;if(s.cycle>=AURELIA_PULSE.relaxEnd)glide+=v/120;}}return glide/total;}
/** Lag (in beats) that maximises corr(x(t), y(t+lag)) over one period; both signals zero-meaned. */
export function phaseLag(x:number[],y:number[],period:number){
 const mean=(v:number[])=>v.reduce((s,a)=>s+a,0)/v.length,mx=mean(x),my=mean(y),X=x.map(v=>v-mx),Y=y.map(v=>v-my);
 let best=-Infinity,bestLag=0;
 for(let lag=0;lag<period;lag++){let s=0,sx=0,sy=0;for(let i=0;i+lag<X.length;i++){s+=X[i]*Y[i+lag];sx+=X[i]*X[i];sy+=Y[i+lag]*Y[i+lag];}const c=s/Math.sqrt(sx*sy||1);if(c>best){best=c;bestLag=lag;}}
 return {beats:bestLag/period,correlation:best};
}
if(process.argv[1]&&import.meta.url===(await import("node:url")).pathToFileURL(process.argv[1]).href){
 const {writeFileSync,mkdirSync}=await import('node:fs');
 const out=process.argv[2]??'exports/quality-j-20260927/J1-J2';mkdirSync(out,{recursive:true});
 const {summaries,rows}=measureJellyMotion(60);
 writeFileSync(`${out}/aurelia-motion-60s.csv`,rows.join('\n')+'\n');
 const summaryCsv=['name,nominalHz,measuredHz,frequencyError,contractionShare,perShareInScene,perShareCalibrated,tiltMedianDeg,tiltP90Deg,tiltMaxDeg,tiltOver25Share,beats,maxBeatTurnDeg,medianBeatTurnDeg,maxAngularSpeed,armLagBeats,armLagCorrelation',
  ...summaries.map(s=>[s.name,s.nominalHz,s.measuredHz.toFixed(4),s.frequencyError.toFixed(4),s.contractionShare.toFixed(3),s.perShare.toFixed(3),s.perShareCalibrated.toFixed(3),s.tiltMedianDeg.toFixed(1),s.tiltP90Deg.toFixed(1),s.tiltMaxDeg.toFixed(1),s.tiltOver25Share.toFixed(3),s.beats,s.maxBeatTurnDeg.toFixed(1),s.medianBeatTurnDeg.toFixed(1),s.maxAngularSpeed.toFixed(3),s.armLagBeats.toFixed(3),s.armLagCorrelation.toFixed(3)].join(','))];
 writeFileSync(`${out}/aurelia-motion-summary.csv`,summaryCsv.join('\n')+'\n');
 writeFileSync(`${out}/aurelia-motion-summary.json`,JSON.stringify(summaries,null,1)+'\n');
 console.log(summaryCsv.join('\n'));
}
