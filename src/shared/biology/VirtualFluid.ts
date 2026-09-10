import {Vector3} from 'three';

/** Level-C animation medium, not a measurement of the room or today's seawater. */
export const VIRTUAL_SEAWATER={density:1025,viscosity:1.05e-3,gravity:9.81} as const;
const waves=[
 {k:new Vector3(.7,.3,-.4),a:new Vector3(0,1,.2),period:31,phase:.7,amplitude:.0038},
 {k:new Vector3(-.3,.6,.5),a:new Vector3(1,0,.3),period:47,phase:2.1,amplitude:.0031},
 {k:new Vector3(.2,-.4,.8),a:new Vector3(.2,.1,1),period:19,phase:4.3,amplitude:.0024},
].map(w=>({...w,b:new Vector3().crossVectors(w.k,w.a).normalize()}));
/** Analytically divergence-free: every b is perpendicular to its wave vector k. */
export function virtualCurrent(position:Vector3,time:number,gain=1,out=new Vector3()){
 out.set(0,0,0);
 for(const wave of waves)out.addScaledVector(wave.b,wave.amplitude*gain*Math.sin(wave.k.dot(position)+2*Math.PI*time/wave.period+wave.phase));
 return out;
}
export function reynolds(speed:number,diameter:number){return VIRTUAL_SEAWATER.density*Math.abs(speed)*diameter/VIRTUAL_SEAWATER.viscosity;}
