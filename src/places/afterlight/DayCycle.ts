// Art-directed 24-hour orbit: 06:00 sunrise, 18:00 sunset; no location/date ephemeris.
export function sampleAfterlightDay(hour:number){
 const h=((hour%24)+24)%24,phase=(h-6)*Math.PI/12;
 const altitude=Math.sin(phase),day=altitude>=0;
 const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 // The moon follows the opposite half-orbit. At either horizon direct light
 // fades to zero before the active emitter switches; sky fill bridges twilight.
 const y=Math.max(.02,Math.abs(altitude)),z=Math.cos(phase)*(day?1:-1);
 const length=Math.hypot(.28*y,y,z);
 return {incoming:[.28*y/length,-y/length,z/length] as [number,number,number],
  daylight:smooth(-.12,.12,altitude),sunStrength:smooth(.02,.3,altitude),moonStrength:smooth(.05,.6,-altitude)};
}
