import * as THREE from 'three';
import {oceanWaveGLSL} from '../../shared/water/Optics.ts';
import {SHORE} from './Layout.ts';

/**
 * Seabridge sea: the seaward reflection/sparkle model with a subtropical water
 * body colour — pale emerald over the shallow reef flat near shore, deepening
 * to blue beyond the reef edge (user reference: Okinawa / Kouri Island).
 * Distances are art-directed; there is no bathymetry, absorption or caustics.
 * Kept separate so the confirmed seaward material is not changed.
 */
export function createSeaMaterial(time:{value:number},day:{value:number},sun:{value:THREE.Vector3},tint:{value:THREE.Color},direct:{value:number},horizon:{value:THREE.Color},zenith:{value:THREE.Color}){
 return new THREE.ShaderMaterial({uniforms:{uTime:time,uDay:day,uSun:sun,uTint:tint,uDirect:direct,uHorizon:horizon,uZenith:zenith},side:THREE.DoubleSide,
 vertexShader:`varying vec3 p;void main(){p=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
 fragmentShader:`varying vec3 p;uniform float uTime,uDay,uDirect;uniform vec3 uSun,uTint,uHorizon,uZenith;
 ${oceanWaveGLSL}
 float h(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
 float n(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
 void main(){
 vec2 slope=oceanSlope(p.xz,uTime);
 float distanceToEye=length(cameraPosition-p);
 float detail=1.-smoothstep(40.,260.,distanceToEye);
 slope+=vec2(sin(p.x*4.7+p.z*3.1-uTime*1.8),sin(p.x*3.9-p.z*6.4+uTime*1.6))*.012*detail;
 vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
 vec3 view=normalize(cameraPosition-p),reflected=reflect(-view,normal);
 // Reflection scaled by .72 so the lit water body still reads at grazing view (art choice).
 float fresnel=(.025+.975*pow(1.-max(dot(normal,view),0.),5.))*.72;
 vec3 sky=mix(uHorizon*.93,uZenith*.88,sqrt(max(reflected.y,0.)));
 // Distance from the sea wall stands in for depth. The visible sea starts ~80 m out
 // (the bank hides the near water), so the reef flat is kept wide: edge 150–210 m.
 float offshore=${SHORE.wallZ.toFixed(2)}-p.z;
 float edge=180.+22.*sin(p.x*.011)+10.*sin(p.x*.031+1.3);
 float deep=smoothstep(edge-30.,edge+60.,offshore);
 float veryDeep=smoothstep(edge+120.,edge+420.,offshore);
 vec3 shallow=vec3(.06,.42,.40);
 // Dark coral/rock patches seen through the shallow water.
 float reef=smoothstep(.55,.75,n(p.xz*.035)+.25*n(p.xz*.12))*(1.-deep);
 shallow=mix(shallow,vec3(.03,.16,.15),reef*.55);
 vec3 water=mix(shallow,vec3(.02,.13,.30),deep);
 water=mix(water,vec3(.012,.06,.20),veryDeep)*uDay;
 vec3 col=mix(water,sky,fresnel);
 float sparkle=pow(max(dot(normal,normalize(view+uSun)),0.),180.);
 col+=vec3(.55,.56,.52)*sparkle*.7*uDirect*uTint*uDay;
 col=mix(col,uHorizon*.78,smoothstep(150.,650.,distanceToEye)*.75);
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
}
