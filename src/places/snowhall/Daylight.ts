import * as THREE from 'three';
import type {SceneState} from '../../player/contracts.ts';

/** Art-directed winter light for one north-facing corridor window. */
export function snowHallDaylight(state:SceneState){
 const hour=((state.hour??12)%24+24)%24;
 const day=THREE.MathUtils.smoothstep(hour,5.8,7.4)*(1-THREE.MathUtils.smoothstep(hour,16.6,18.5));
 const night=hour<12?1-THREE.MathUtils.smoothstep(hour,4.7,6.2):THREE.MathUtils.smoothstep(hour,18.2,20.5);
 const tint=new THREE.Color('#d3dde1').lerp(new THREE.Color('#9eb4ca'),night*.72);
 const sky=new THREE.Color('#89979f').lerp(new THREE.Color('#182635'),night*.94);
 // Q1-1 optional candidate: only the view through the window (background and
 // fog) takes a faint dawn-rose / dusk-gold cast. tint, sky and every interior
 // light keep their confirmed values; noon and night are unchanged.
 const phase=(hour-12)*Math.PI/12;
 const lowSun=Math.sqrt(day)*Math.pow(1-Math.max(0,Math.cos(phase)),1.5)*.8;
 const windowSky=sky.clone().lerp(new THREE.Color(hour<12?'#978d97':'#968e82'),lowSun);
 return {
  day,night,tint,sky,windowSky,
  windowIntensity:(.12+3.38*day+.60*night)*(state.beamStrength??1),
  fillIntensity:.012+.030*day+.015*night,
  snowVisibility:.08+.92*Math.max(day,night*.28),
 };
}
