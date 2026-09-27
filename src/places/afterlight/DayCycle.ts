// Art-directed raised orbit for a deep drain; not astronomical solar elevation.
export function sampleAfterlightDay(hour:number){
 const h=((hour%24)+24)%24,phase=(h-6)*Math.PI/12;
 const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 const daylight=smooth(4.5,8,h)*(1-smooth(17,21,h));
 // Compress the solar arc upward so the narrow roof opening remains useful.
 // Cross-corridor motion is retained; the night basis restores the approved
 // high-angle moonlight instead of sending it below the drain rim.
 const solarSlope=.12+.20*Math.cos(phase),moonSlope=.28;
 const x=moonSlope+(solarSlope-moonSlope)*daylight,length=Math.hypot(x,1);
 return {incoming:[x/length,-1/length,0] as [number,number,number],
  // Q2-A6 candidate: a dawn warmth bump (05:00–09:30) so 06:30 is warm like
  // dusk's low sun instead of sharing noon's .3; noon and night are unchanged.
  daylight,warmth:.3+.6*smooth(15,18,h)*(1-smooth(18,21,h))+.5*smooth(4.8,6.2,h)*(1-smooth(7.2,9.5,h)),sunStrength:daylight,moonStrength:1-daylight};
}
