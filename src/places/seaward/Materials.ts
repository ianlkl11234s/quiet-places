import * as THREE from 'three';
import {oceanWaveGLSL} from '../../shared/water/Optics.ts';

// Procedural concrete and reflected opening. These are art-directed transport
// approximations, not baked GI or a water/caustic solver. World coordinates: metres.
export function tunnelMaterial(kind:'wall'|'floor'|'ceiling',time:{value:number},day:{value:number},beam:{value:number},sun:{value:THREE.Vector3},tint:{value:THREE.Color},direct:{value:number},horizon:{value:THREE.Color}){
 return new THREE.ShaderMaterial({uniforms:{uTime:time,uDay:day,uBeam:beam,uSun:sun,uTint:tint,uDirect:direct,uHorizon:horizon,uKind:{value:kind==='floor'?1:kind==='ceiling'?2:0}},
 vertexShader:`varying vec3 p;varying vec3 n;void main(){p=(modelMatrix*vec4(position,1.)).xyz;n=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
 fragmentShader:`varying vec3 p;varying vec3 n;uniform float uTime,uDay,uBeam;uniform int uKind;uniform vec3 uSun,uTint,uHorizon;uniform float uDirect;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
 void main(){
 vec2 uv=uKind==0?vec2(p.z,p.y):p.xz;
 float grain=noise(uv*180.);float mottling=noise(uv*2.7)*.5+noise(uv*12.)*.3+grain*.2;
 float seam=min(abs(fract(uv.x/2.7)-.5)*2.7,abs(fract(uv.y/1.4)-.5)*1.4);
 float joints=mix(.65,1.,smoothstep(.002,.018,seam));
 float depth=max(p.z+11.,0.);
 float exitLight=exp(-depth*.16);
 float coastal=exp(-depth*.24);
 float baseDamp=(1.-smoothstep(.04,.70,p.y))*coastal;
 float seams=1.-smoothstep(.01,.075,seam);
 float streak=noise(vec2(floor(uv.x*13.)*.71,uv.y*.15));
 float runoff=smoothstep(.67,.88,streak)*coastal;
 float salt=smoothstep(.64,.81,noise(uv*8.+19.))*baseDamp*(1.-smoothstep(.15,.4,p.y));
 // A single oblique daylight direction is clipped against the real exit rectangle.
 vec3 sun=uSun;float travel=(-11.-p.z)/sun.z;
 vec3 at=p+sun*travel;
 // Approximate finite solar-disc softness; widen continuously with travel.
 float penumbra=.025+max(travel,0.)*.0047;
 float opening=smoothstep(-3.4-penumbra,-3.4+penumbra,at.x)*(1.-smoothstep(3.4-penumbra,3.4+penumbra,at.x))*smoothstep(-penumbra,penumbra,at.y)*(1.-smoothstep(4.2-penumbra,4.2+penumbra,at.y));
 float direct=opening*max(dot(n,sun),0.);
 vec3 concrete=vec3(.24,.255,.25)*(.68+mottling*.5)*joints;
 if(uKind==0){
  concrete*=1.-baseDamp*.26-runoff*.14-seams*coastal*.07;
  concrete=mix(concrete,vec3(.34,.345,.31),salt*.12);
  concrete=mix(concrete,concrete*vec3(.82,.91,.76),baseDamp*smoothstep(.65,.85,noise(uv*3.))* .22);
  float crack=1.-smoothstep(.002,.009,abs(uv.x-2.2-sin(uv.y*4.)*.018));
  concrete*=1.-crack*smoothstep(.9,1.3,uv.y)*(1.-smoothstep(1.5,1.8,uv.y))*.15;
 }
 float ambient=.012+exitLight*(uKind==2?.09:.30);
 vec3 col=concrete*(vec3(.87,.94,1.)*ambient+direct*1.5*uDirect*uTint)*uDay;
 // Project the existing pattern in the light frame, rather than revealing a
 // fixed wall decal. At grazing incidence its energy must also tend to zero.
 vec3 lightU=normalize(cross(vec3(0.,1.,0.),sun));
 vec3 lightV=cross(sun,lightU);
 vec2 lightUV=vec2(dot(p,lightU),dot(p,lightV));
 float a=sin(lightUV.x*6.+sin(lightUV.y*5.+uTime*.33)*1.8+uTime*.22);
 float b=sin(lightUV.y*7.+sin(lightUV.x*4.-uTime*.27)*1.6);
 float caustic=pow(max(0.,1.-abs(a+b)*.85),15.);
 col+=vec3(.65,.72,.69)*caustic*exitLight*opening*smoothstep(.015,.32,max(dot(n,sun),0.))*(uKind==2?0.:.22)*uDay*uBeam*uDirect*uTint;
 if(uKind==1){
  float wet=smoothstep(.32,.62,noise(uv*.8)*.6+noise(uv*3.)*.4);
  vec3 v=normalize(p-cameraPosition);
  // Q0-4: the ripple tilt is an angle, so its offset on the exit plane grows
  // with travel. Bound that offset (~.4 m near the camera) and fade ripples at grazing view,
  // then widen the mask edge with travel like the direct-light penumbra.
  vec3 r0=reflect(v,vec3(0.,1.,0.));float d0=max((-11.-p.z)/min(r0.z,-.001),0.);
  float ripple=1./(1.+d0*.12)*smoothstep(.02,.25,-v.y);
  vec2 tilt=vec2(noise(uv*6.)*.5+noise(uv*14.)*.5-.5,noise(uv*5.5+9.)*.5+noise(uv*13.+4.)*.5-.5);
  vec3 normal=normalize(vec3(tilt.x*.055*ripple,1.,tilt.y*.07*ripple));
  vec3 r=reflect(v,normal);float d=(-11.-p.z)/r.z;vec3 q=p+r*d;
  float edge=.18+d0*.03;
  float mask=step(0.,d)*smoothstep(-3.4-edge,-3.4+edge,q.x)*(1.-smoothstep(3.4-edge,3.4+edge,q.x))*smoothstep(-edge*.5,edge,q.y)*(1.-smoothstep(4.1-edge,4.1+edge,q.y));
  float fresnel=.045+.50*pow(1.-max(dot(-v,normal),0.),5.);
  col=mix(col,col*.65,wet);col+=uHorizon*1.02*mask*fresnel*wet;
 }
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
}

export function seaMaterial(time:{value:number},day:{value:number},sun:{value:THREE.Vector3},tint:{value:THREE.Color},direct:{value:number},horizon:{value:THREE.Color},zenith:{value:THREE.Color}){
 return new THREE.ShaderMaterial({uniforms:{uTime:time,uDay:day,uSun:sun,uTint:tint,uDirect:direct,uHorizon:horizon,uZenith:zenith},side:THREE.DoubleSide,
 vertexShader:`varying vec3 p;void main(){p=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
 fragmentShader:`varying vec3 p;uniform float uTime,uDay,uDirect;uniform vec3 uSun,uTint,uHorizon,uZenith;
 ${oceanWaveGLSL}
 void main(){
 vec2 slope=oceanSlope(p.xz,uTime);
 float distanceToEye=length(cameraPosition-p);
 float detail=1.-smoothstep(40.,260.,distanceToEye);
 slope+=vec2(sin(p.x*4.7+p.z*3.1-uTime*1.8),sin(p.x*3.9-p.z*6.4+uTime*1.6))*.012*detail;
 vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
 vec3 view=normalize(cameraPosition-p),reflected=reflect(-view,normal);
 float fresnel=.025+.975*pow(1.-max(dot(normal,view),0.),5.);
 // Q1-1: reflect the same time-driven sky as the dome (already day-scaled).
 vec3 sky=mix(uHorizon*.93,uZenith*.88,sqrt(max(reflected.y,0.)));
 vec3 col=mix(vec3(.075,.14,.16)*uDay,sky,fresnel);
 vec3 light=uSun;
 float sparkle=pow(max(dot(normal,normalize(view+light)),0.),180.);
 col+=vec3(.55,.56,.52)*sparkle*.7*uDirect*uTint*uDay;
 col=mix(col,uHorizon*.78,smoothstep(150.,650.,distanceToEye)*.75);
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
}
