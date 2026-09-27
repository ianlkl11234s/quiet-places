import * as THREE from 'three';
import type {SceneState} from '../../player/contracts.ts';

const smooth=THREE.MathUtils.smoothstep;

const DEG=Math.PI/180;
/** Okinawa-like latitude and the scene's compass: the coast faces west-south-west,
 * so true west is rotated 25° from -Z toward -X (sunset lands behind the bridge). */
export const SKY={latitude:26.5*DEG,compass:25*DEG,
 /** Sun declination near the Mid-Autumn full moon (late September, ~-2°). */
 sunDeclination:-2*DEG,
 /** Full-moon declination (opposite the sun, ~+3°) and apparent motion, 14.5°/h. */
 moonDeclination:3*DEG,moonRate:14.5*DEG,
 /**
  * Moon hour angle at 23:00. A real full moon sits near the meridian (~60° up, out of
  * frame) at 23:00; by user choice (2026-09-27) the path is kept real but shifted in
  * time so the 月夜 moment shows the moon ~27° up over the bridge; it sets ~01:00.
  */
 moonHourAngleAt23:61*DEG};

/** Unit direction toward a body at hour angle H (west positive) and declination d, in world axes. */
export function skyDirection(H:number,d:number,out=new THREE.Vector3()){
 const {latitude:phi,compass:psi}=SKY;
 const east=-Math.cos(d)*Math.sin(H),north=Math.sin(d)*Math.cos(phi)-Math.cos(d)*Math.cos(H)*Math.sin(phi),up=Math.sin(d)*Math.sin(phi)+Math.cos(d)*Math.cos(H)*Math.cos(phi);
 // Unrotated: north=+X, east=+Z. Rotate about Y so true west lands on the scene's sea direction.
 return out.set(north*Math.cos(psi)+east*Math.sin(psi),up,-north*Math.sin(psi)+east*Math.cos(psi)).normalize();
}
/** Sun: hour angle 15°/h from local noon (no equation of time; an art clock, not an ephemeris). */
export const sunDirection=(hour:number,out?:THREE.Vector3)=>skyDirection((hour-12)*15*DEG,SKY.sunDeclination,out);
export const moonDirection=(hour:number,out?:THREE.Vector3)=>{
 let dh=hour-23;if(dh<-12)dh+=24;else if(dh>12)dh-=24;
 return skyDirection(SKY.moonHourAngleAt23+dh*SKY.moonRate,SKY.moonDeclination,out);
};
/** Light directions never graze below this elevation (sin), avoiding light from under the ground. */
const MIN_LIGHT_SIN=Math.sin(3*DEG),MIN_MOONLIGHT_SIN=Math.sin(10*DEG);
const lift=(v:THREE.Vector3,minSin:number)=>{if(v.y>=minSin)return v;const h=Math.hypot(v.x,v.z)||1,c=Math.sqrt(1-minSin*minSin);return v.set(v.x/h*c,minSin,v.z/h*c);};

/**
 * Day–night light for the station. Sun and moon follow real arcs (SKY); the
 * intensity/warmth keyframes stay the shared art curve (TimeOfDay).
 */
export function seabridgeDaylight(state:SceneState){
 const hour=((state.hour??12)%24+24)%24;
 const p=THREE.MathUtils.clamp((hour-6)/12,0,1)*Math.PI;
 const sunTrue=sunDirection(hour),moonTrue=moonDirection(hour);
 const sunUp=smooth(sunTrue.y,Math.sin(-.5*DEG),Math.sin(4*DEG)),moonUp=smooth(moonTrue.y,Math.sin(-1*DEG),Math.sin(8*DEG));
 const sun=lift(sunTrue.clone(),MIN_LIGHT_SIN);
 const solar=smooth(hour,5.6,7)*(1-smooth(hour,17.6,19))*sunUp;
 const night=hour<12?1-smooth(hour,4,5.6):smooth(hour,18.6,20.5);
 const low=solar*Math.pow(1-Math.sin(p),1.6);
 const dusk=low*smooth(hour,13,17.5);
 const tint=new THREE.Color(1,.97,.93).lerp(new THREE.Color(1,.66,.42),low*.8);
 // Moonlight comes from the moon itself (lifted to >=10° so it never only grazes); it fades as the moon sets.
 const moon=lift(moonTrue.clone(),MIN_MOONLIGHT_SIN);
 const lightDir=sun.clone().lerp(moon,night).normalize();
 tint.lerp(new THREE.Color(.66,.76,.95),night);
 const level=.10+.90*THREE.MathUtils.clamp(state.intensity??1,0,1);
 // Day sky is a clear subtropical blue (user reference: Okinawa / Kouri Island):
 // deep saturated zenith, pale hazy horizon. Low sun still warms toward dusk.
 const horizon=new THREE.Color(.50,.68,.88).lerp(new THREE.Color(.86,.56,.40),low*.8).multiplyScalar(level);
 const zenith=new THREE.Color(.07,.24,.66).lerp(new THREE.Color(.30,.32,.52),low*.7).multiplyScalar(level);
 horizon.lerp(new THREE.Color(.04,.055,.09),night);zenith.lerp(new THREE.Color(.015,.025,.055),night);
 // Unmanned-station lighting runs on a timer: on through dusk and night.
 const lamp=Math.max(smooth(hour,16.8,17.3),1-smooth(hour,6.3,6.9));
 return {sun:lightDir,sunTrue,moonTrue,sunUp,moonUp,solar,night,dusk,low,tint,horizon,zenith,lamp,level};
}
export type SeabridgeLight=ReturnType<typeof seabridgeDaylight>;
