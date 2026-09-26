import * as THREE from 'three';
import type {SceneState} from '../../player/contracts.ts';

/** Art-directed exit-facing path, not an astronomical sun for a real location. */
export function seawardDaylight(state:SceneState){
 const hour=((state.hour??12)%24+24)%24;
 const phase=(hour-12)*Math.PI/12;
 const sun=new THREE.Vector3(.46+1.15*Math.sin(phase),.12+.43*Math.max(0,Math.cos(phase)),-1).normalize();
 const solar=THREE.MathUtils.smoothstep(hour,5.5,7)*(1-THREE.MathUtils.smoothstep(hour,17.5,19));
 const warmth=solar*Math.pow(1-Math.max(0,Math.cos(phase)),.65);
 const tint=new THREE.Color(1,1,1).lerp(new THREE.Color(1,.68,.40),warmth*.65);
 // A restrained moonlight cue; no date, lunar phase or astronomical claim.
 const night=hour<12?1-THREE.MathUtils.smoothstep(hour,3.5,5.5):THREE.MathUtils.smoothstep(hour,19,21);
 const moon=new THREE.Vector3(.65+.12*Math.sin(phase),.38+.08*Math.cos(phase),-1).normalize();
 sun.lerp(moon,night).normalize();
 tint.lerp(new THREE.Color(.72,.83,1),night);
 // Q1-1 sky (linear, pre-exposure): noon slightly bluer and lower than the
 // former flat grey so it does not clip white; low sun warms the horizon;
 // night is its own dark blue, not the day sky scaled down.
 const level=.10+.90*THREE.MathUtils.clamp(state.intensity??1,0,1);
 const horizon=new THREE.Color(.45,.53,.59).lerp(new THREE.Color(.72,.50,.33),warmth*.72).multiplyScalar(level);
 const zenith=new THREE.Color(.29,.40,.50).lerp(new THREE.Color(.42,.37,.41),warmth*.50).multiplyScalar(level);
 horizon.lerp(new THREE.Color(.035,.05,.085),night);zenith.lerp(new THREE.Color(.018,.03,.06),night);
 return {sun,direct:solar+.5*night,tint,solar,moonlight:.5*night,horizon,zenith};
}
