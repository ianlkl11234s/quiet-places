import * as THREE from 'three';
import type {SceneState} from '../../player/contracts.ts';

/** Art-directed coastal winter daylight; not an ephemeris for a real location. */
export function snowWindowDaylight(state:SceneState){
 const hour=((state.hour??12)%24+24)%24;
 const solar=THREE.MathUtils.smoothstep(hour,5.7,7.2)*(1-THREE.MathUtils.smoothstep(hour,17.1,19.2));
 const night=hour<12?1-THREE.MathUtils.smoothstep(hour,4.7,6.2):THREE.MathUtils.smoothstep(hour,18.7,20.8);
 const phase=(hour-12)*Math.PI/12;
 const direction=new THREE.Vector3(-.34+1.05*Math.sin(phase),.20+.72*Math.max(0,Math.cos(phase)),.86).normalize();
 const moonDirection=new THREE.Vector3(-.48,.46,.78).normalize();
 direction.lerp(moonDirection,night).normalize();
 const sky=new THREE.Color('#788994').lerp(new THREE.Color('#121d2a'),night*.92);
 const horizonColor=new THREE.Color('#a2adb0').lerp(new THREE.Color('#223141'),night*.86);
 const tint=new THREE.Color('#d9e0df').lerp(new THREE.Color('#9fb6cf'),night*.58);
 // Q1-1 candidate: a faint low-sun cast through overcast. Dawn leans rose,
 // dusk warm grey-gold, noon stays neutral cool white. Zero at noon and at
 // night (solar=0), so the confirmed moonlight frame is unchanged.
 const lowSun=Math.sqrt(solar)*Math.pow(1-Math.max(0,Math.cos(phase)),1.5)*.8;
 const morning=hour<12;
 sky.lerp(new THREE.Color(morning?'#8f8589':'#8a8479'),lowSun);
 horizonColor.lerp(new THREE.Color(morning?'#c0aca7':'#b9ac97'),lowSun);
 tint.lerp(new THREE.Color(morning?'#e8dad6':'#e6dccb'),lowSun);
 return {
  hour,solar,night,direction,sky,horizon:horizonColor,tint,
  directIntensity:.025+.12*solar+.025*night,
  skyIntensity:.045+.38*solar+.07*night,
  visibility:.045+.955*Math.max(solar,night*.22),
 };
}
