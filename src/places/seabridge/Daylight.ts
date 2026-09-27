import * as THREE from 'three';
import type {SceneState} from '../../player/contracts.ts';

const smooth=THREE.MathUtils.smoothstep;

/**
 * Art-directed sun path for a west-facing coast: dawn light arrives from the
 * land behind the viewer (+Z), noon from the south (-X), dusk sets low over the
 * sea on the left. Not an ephemeris for a real place or date.
 */
export function seabridgeDaylight(state:SceneState){
 const hour=((state.hour??12)%24+24)%24;
 const p=THREE.MathUtils.clamp((hour-6)/12,0,1)*Math.PI;
 const elevation=.05+1.05*Math.pow(Math.sin(p),1.4);
 const horizontal=new THREE.Vector2(-.75*Math.sin(p)-.35*smooth(hour,12,17.5),Math.cos(p)).normalize();
 const sun=new THREE.Vector3(horizontal.x*Math.cos(elevation),Math.sin(elevation),horizontal.y*Math.cos(elevation));
 const solar=smooth(hour,5.6,7)*(1-smooth(hour,17.6,19));
 const night=hour<12?1-smooth(hour,4,5.6):smooth(hour,18.6,20.5);
 const low=solar*Math.pow(1-Math.sin(p),1.6);
 const dusk=low*smooth(hour,13,17.5);
 const tint=new THREE.Color(1,.97,.93).lerp(new THREE.Color(1,.66,.42),low*.8);
 // Moon: high over the sea, cool and weak. No lunar phase is modelled.
 const moon=new THREE.Vector3(-.35,.62,-.7).normalize();
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
 return {sun:lightDir,solar,night,dusk,low,tint,horizon,zenith,lamp,level};
}
export type SeabridgeLight=ReturnType<typeof seabridgeDaylight>;
