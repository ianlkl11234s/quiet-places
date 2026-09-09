import {moments} from '../places/metadata.ts';
import type {LightingState} from '../player/contracts.ts';
export type LightState=LightingState;
// Art-directed keyframes; local time is device time, not astronomical solar position.
const frames = [
  [0,.09,0,-.15,.3],[5,.11,.1,-.3,.3],[6.5,.36,.35,-.7,.5],
  [9,.77,.45,-.4,.72],[12,1,.3,0,.85],[14,.9,.48,.25,.8],
  [17.5,.47,.95,.75,.55],[19,.12,.22,.35,.35],[21,.09,0,-.15,.3],[24,.09,0,-.15,.3],
];
export function sampleTime(hour:number):LightState {
  const h=((hour%24)+24)%24;
  let i=0;while(i<frames.length-2&&frames[i+1][0]<=h)i++;
  const a=frames[i],b=frames[i+1];const x=(h-a[0])/(b[0]-a[0]);const t=x*x*(3-2*x);
  const lerp=(n:number)=>a[n]+(b[n]-a[n])*t;
  return {hour:h,intensity:lerp(1),warmth:lerp(2),angle:lerp(3),activity:lerp(4)};
}
export function localHour(){const d=new Date();return d.getHours()+d.getMinutes()/60+d.getSeconds()/3600}
export function formatHour(hour:number){const total=Math.floor(hour*60);return `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
export function momentName(h:number){return h<5||h>=20?'月夜靜室':h<8?'晨曦微明':h<12?'上午的光':h<13?'正午晴光':h<16?'午後的光':h<19?'暮色流金':'入夜之間'}

// Each adjacent named moment takes two seconds; partial intervals are proportional.
const stops=[...moments.map(moment=>moment.hour),moments[0].hour+24];
function timePhase(hour:number){
 const h=((hour-stops[0])%24+24)%24+stops[0];
 let i=0;while(i<stops.length-2&&h>=stops[i+1])i++;
 return i+(h-stops[i])/(stops[i+1]-stops[i]);
}
export function sampleForwardTime(from:number,to:number,seconds:number){
 const start=timePhase(from),distance=(timePhase(to)-start+4)%4;
 const travel=Math.min(distance,Math.max(0,seconds)/2);
 const phase=(start+travel)%4,index=Math.floor(phase);
 const hour=stops[index]+(stops[index+1]-stops[index])*(phase-index);
 const done=travel>=distance;
 return {hour:done?((to%24)+24)%24:hour%24,done};
}
