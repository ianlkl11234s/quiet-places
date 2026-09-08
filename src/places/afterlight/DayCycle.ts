// Art-directed raised orbit for a deep drain; not astronomical solar elevation.
export function sampleAfterlightDay(hour:number){
 const h=((hour%24)+24)%24,phase=(h-6)*Math.PI/12;
 const altitude=Math.sin(phase);
 const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 const daylight=smooth(-.12,.12,altitude);
 // Compress the solar arc upward so the narrow roof opening remains useful.
 // Cross-corridor motion is retained; the night basis restores the approved
 // high-angle moonlight instead of sending it below the drain rim.
 const solarSlope=.12+.20*Math.cos(phase),moonSlope=.28;
 const x=moonSlope+(solarSlope-moonSlope)*daylight,length=Math.hypot(x,1);
 return {incoming:[x/length,-1/length,0] as [number,number,number],
  daylight,sunStrength:daylight,moonStrength:1-daylight};
}
