import * as THREE from 'three';
import type {SceneState} from '../../player/contracts.ts';

/** Art-directed coastal winter daylight; not an ephemeris for a real location. */
export function snowWindowDaylight(state:SceneState){
 const hour=((state.hour??12)%24+24)%24;
 const solar=THREE.MathUtils.smoothstep(hour,5.7,7.2)*(1-THREE.MathUtils.smoothstep(hour,17.1,19.2));
 const night=hour<12?1-THREE.MathUtils.smoothstep(hour,4.7,6.2):THREE.MathUtils.smoothstep(hour,18.7,20.8);
 const phase=(hour-12)*Math.PI/12;
 const horizon=Math.pow(Math.max(0,1-Math.abs(hour-12)/7),.7);
 const edgeWarmth=solar*Math.pow(1-horizon,1.5);
 const direction=new THREE.Vector3(-.34+1.05*Math.sin(phase),.20+.72*Math.max(0,Math.cos(phase)),.86).normalize();
 const moonDirection=new THREE.Vector3(-.48,.46,.78).normalize();
 direction.lerp(moonDirection,night).normalize();
 const sky=new THREE.Color('#788994').lerp(new THREE.Color('#c59e7d'),edgeWarmth*.24).lerp(new THREE.Color('#121d2a'),night*.92);
 const horizonColor=new THREE.Color('#a2adb0').lerp(new THREE.Color('#d5b18d'),edgeWarmth*.28).lerp(new THREE.Color('#223141'),night*.86);
 const tint=new THREE.Color('#d9e0df').lerp(new THREE.Color('#ffd2a4'),edgeWarmth*.42).lerp(new THREE.Color('#9fb6cf'),night*.58);
 return {
  hour,solar,night,direction,sky,horizon:horizonColor,tint,
  directIntensity:.16+1.65*solar+.18*night,
  skyIntensity:.045+.38*solar+.07*night,
  visibility:.045+.955*Math.max(solar,night*.22),
 };
}
