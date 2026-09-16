import {Vector3} from 'three';
/** ART_DIRECTION: analytic curl of a smooth vector potential. Metres/second.
 * Each component excludes its own axis, so divergence is exactly zero.
 * This is a trajectory perturbation, never an atmosphere or fluid solver. */
export function sampleVirtualFlow(p:Vector3,t:number,out=new Vector3()):Vector3 {
 return out.set(.06*(Math.cos(p.y*.09+t*.014)-Math.sin(p.z*.075-t*.011)),
 .025*(Math.cos(p.z*.075-t*.011)-Math.sin(p.x*.08+t*.009)),
 -.035+.06*(Math.cos(p.x*.08+t*.009)-Math.sin(p.y*.09+t*.014)));
}
