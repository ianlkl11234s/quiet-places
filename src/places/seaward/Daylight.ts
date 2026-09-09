import * as THREE from 'three';
import type {SceneState} from '../../player/contracts.ts';

/** Art-directed exit-facing path, not an astronomical sun for a real location. */
export function seawardDaylight(state:SceneState){
 const hour=((state.hour??12)%24+24)%24;
 const phase=(hour-12)*Math.PI/12;
 const sun=new THREE.Vector3(.46+1.15*Math.sin(phase),.12+.43*Math.max(0,Math.cos(phase)),-1).normalize();
 const direct=THREE.MathUtils.smoothstep(hour,5.5,7)*(1-THREE.MathUtils.smoothstep(hour,17.5,19));
 const warmth=direct*Math.pow(1-Math.max(0,Math.cos(phase)),.65);
 const tint=new THREE.Color(1,1,1).lerp(new THREE.Color(1,.68,.40),warmth*.65);
 return {sun,direct,tint};
}
