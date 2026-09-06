export interface LightState { intensity:number; warmth:number; angle:number; activity:number }
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
  return {intensity:lerp(1),warmth:lerp(2),angle:lerp(3),activity:lerp(4)};
}
export function localHour(){const d=new Date();return d.getHours()+d.getMinutes()/60+d.getSeconds()/3600}
export function formatHour(hour:number){const total=Math.floor(hour*60);return `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
export function momentName(h:number){return h<5||h>=20?'月光靜室':h<8?'晨曦微明':h<12?'上午的光':h<16?'午後的光':h<19?'暮色流金':'入夜之間'}
