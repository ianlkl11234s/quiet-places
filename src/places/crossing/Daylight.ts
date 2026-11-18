import * as THREE from 'three';
import type {SceneState} from '../../player/contracts.ts';

const smooth=THREE.MathUtils.smoothstep,DEG=Math.PI/180;

/**
 * Art-directed light path for the ferry deck (not an ephemeris). A key is [hour, azimuth°, elevation°];
 * azimuth is atan2(z,x) in the deck frame (0 = +X open side, -90 = stern -Z, +90 = bow +Z).
 * Noon is the reference photo: sun on the open side, behind the stern, ~45° up.
 */
const SUN_KEYS=[[0,-70,-30],[5.5,40,-1],[6.5,35,11],[9,15,30],[12,-40.9,45],[14.5,-50,36],[17.5,-60,8],[18.3,-63,3],[19.2,-67,-1.5],[24,-70,-30]] as const;
/** Moon (hour+24 before noon): rises astern where the sun set, crosses over the open side, sets toward the bow where the sun rises, so the night-to-day handover never swings the light. At 23:00 a full moon over the open side, slightly astern and lower than the noon sun so night light reads differently. */
const MOON_KEYS=[[12,40,-40],[18,-66,-2],[20,-50,15],[23,-15,30],[26,10,25],[29.5,40,0],[33,40,-35],[36,40,-40]] as const;

type Keys=readonly(readonly [number,number,number])[];
/** Smoothstep segment interpolation: continuous, zero slope at the keys. */
function path(keys:Keys,h:number,out=new THREE.Vector3()){
 let i=0;while(i<keys.length-2&&keys[i+1][0]<=h)i++;
 const a=keys[i],b=keys[i+1],x=THREE.MathUtils.clamp((h-a[0])/(b[0]-a[0]),0,1),k=x*x*(3-2*x);
 const az=(a[1]+(b[1]-a[1])*k)*DEG,el=(a[2]+(b[2]-a[2])*k)*DEG;
 return out.set(Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az)).normalize();
}
const wrap=(hour:number)=>((hour%24)+24)%24;
export const crossingSunDirection=(hour:number,out?:THREE.Vector3)=>{const h=wrap(hour);return path(SUN_KEYS,h,out);};
export const crossingMoonDirection=(hour:number,out?:THREE.Vector3)=>{const h=wrap(hour);return path(MOON_KEYS,h<12?h+24:h,out);};

/** Spherical blend: a plain lerp of near-opposite directions swings through the middle too fast. */
const slerp=(a:THREE.Vector3,b:THREE.Vector3,t:number)=>{const w=Math.acos(THREE.MathUtils.clamp(a.dot(b),-1,1)),s=Math.sin(w);if(s<1e-4)return a.clone();return a.clone().multiplyScalar(Math.sin((1-t)*w)/s).addScaledVector(b,Math.sin(t*w)/s).normalize();};
/** Sun strength by hour: weak right at sunrise/sunset, near full for most of the day. */
const POWER_KEYS=[[5.6,0],[6.5,.75],[9,.92],[12,1],[14.5,.96],[17.5,.9],[18.3,.7],[19.2,.2]] as const;
function sunPower(h:number){
 if(h<=POWER_KEYS[0][0]||h>=POWER_KEYS[POWER_KEYS.length-1][0])return h<=POWER_KEYS[0][0]?0:POWER_KEYS[POWER_KEYS.length-1][1];
 let i=0;while(POWER_KEYS[i+1][0]<=h)i++;
 const a=POWER_KEYS[i],b=POWER_KEYS[i+1],x=(h-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*x*x*(3-2*x);
}
const MIN_SIN=Math.sin(3*DEG),MIN_MOON_SIN=Math.sin(10*DEG);
const lift=(v:THREE.Vector3,minSin:number)=>{if(v.y>=minSin)return v;const h=Math.hypot(v.x,v.z)||1,c=Math.sqrt(1-minSin*minSin);return v.set(v.x/h*c,minSin,v.z/h*c);};

/**
 * Day-night light for the deck. `sun` is the direction the scene light comes from (sun by day,
 * moon at night); `direct` its relative strength. 6.5 dawn, 12 noon, 17.5 dusk, 23 moon night.
 */
export function crossingDaylight(state:{hour?:number;intensity?:number}|SceneState){
 const hour=wrap(state.hour??12);
 const sunTrue=crossingSunDirection(hour),moonTrue=crossingMoonDirection(hour);
 const sunUp=smooth(sunTrue.y,Math.sin(-1*DEG),Math.sin(7*DEG)),moonUp=smooth(moonTrue.y,Math.sin(-1*DEG),Math.sin(8*DEG));
 const solar=sunUp;
 const night=hour<12?1-smooth(hour,4,5.6):smooth(hour,18.6,20.5);
 // Own strength curve (the shared time-of-day table is too dim at dawn and dusk to carry warm light into the deck).
 const level=.10+.90*sunPower(hour);
 // low: 1 near the horizon, 0 with a high sun; warms tint and sky. am: morning (pinker, paler) vs evening (deeper gold).
 const low=solar*Math.pow(1-THREE.MathUtils.clamp(Math.asin(sunTrue.y)/(34*DEG),0,1),1.25);
 const am=1-smooth(hour,9,13);
 const warm=new THREE.Color(1,.50,.22).lerp(new THREE.Color(1,.66,.36),am);
 const tint=new THREE.Color(1,.97,.92).lerp(warm,Math.min(1,low*1.15));
 const sun=lift(sunTrue.clone(),MIN_SIN),moon=lift(moonTrue.clone(),MIN_MOON_SIN);
 const lightDir=slerp(sun,moon,night);
 tint.lerp(new THREE.Color(.66,.76,.95),night);
 const skyLevel=THREE.MathUtils.lerp(.55,1,level);
 // Day blue (reference photo): clean deep zenith, paler horizon. Low sun turns the horizon gold and the zenith blue-violet;
 // the sky shader adds the gold glow toward the sun itself.
 const horizon=new THREE.Color(.46,.70,.97).lerp(new THREE.Color(1,.56,.30).lerp(new THREE.Color(1,.74,.46),am),Math.min(1,low*1.35)).multiplyScalar(skyLevel);
 const zenith=new THREE.Color(.03,.20,.78).lerp(new THREE.Color(.16,.16,.60).lerp(new THREE.Color(.34,.38,.72),am),Math.min(1,low*(.9-.4*am))).multiplyScalar(skyLevel);
 horizon.lerp(new THREE.Color(.04,.055,.10),night);zenith.lerp(new THREE.Color(.015,.025,.06),night);
 const lamp=Math.max(smooth(hour,18.3,19.5),1-smooth(hour,5,6));
 const direct=solar*level+.14*night*moonUp;
 return {sun:lightDir,sunTrue,moonTrue,sunUp,moonUp,solar,night,low,tint,horizon,zenith,lamp,level,direct};
}
export type CrossingLight=ReturnType<typeof crossingDaylight>;
