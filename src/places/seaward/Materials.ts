import * as THREE from 'three';
import {oceanWaveGLSL} from '../../shared/water/Optics.ts';

// Procedural concrete and reflected opening. These are art-directed transport
// approximations, not baked GI or a water/caustic solver. World coordinates: metres.
export function tunnelMaterial(kind:'wall'|'floor'|'ceiling',time:{value:number},day:{value:number},beam:{value:number},sun:{value:THREE.Vector3},tint:{value:THREE.Color},direct:{value:number}){
 return new THREE.ShaderMaterial({uniforms:{uTime:time,uDay:day,uBeam:beam,uSun:sun,uTint:tint,uDirect:direct,uKind:{value:kind==='floor'?1:kind==='ceiling'?2:0}},
 vertexShader:`varying vec3 p;varying vec3 n;void main(){p=(modelMatrix*vec4(position,1.)).xyz;n=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
 fragmentShader:`varying vec3 p;varying vec3 n;uniform float uTime,uDay,uBeam;uniform int uKind;uniform vec3 uSun,uTint;uniform float uDirect;
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
 float opening=smoothstep(-3.4,-3.25,at.x)*(1.-smoothstep(3.25,3.4,at.x))*smoothstep(0.,.12,at.y)*(1.-smoothstep(4.05,4.2,at.y));
 float direct=opening*max(dot(n,sun),0.);
 vec3 concrete=vec3(.24,.255,.25)*(.86+mottling*.20)*joints;
 if(uKind==0){
  concrete*=1.-baseDamp*.26-runoff*.14-seams*coastal*.07;
  concrete=mix(concrete,vec3(.34,.345,.31),salt*.12);
  concrete=mix(concrete,concrete*vec3(.82,.91,.76),baseDamp*smoothstep(.65,.85,noise(uv*3.))* .22);
  float crack=1.-smoothstep(.002,.009,abs(uv.x-2.2-sin(uv.y*4.)*.018));
  concrete*=1.-crack*smoothstep(.9,1.3,uv.y)*(1.-smoothstep(1.5,1.8,uv.y))*.15;
 }
 float ambient=.012+exitLight*(uKind==2?.09:.30);
 vec3 col=concrete*(vec3(.87,.94,1.)*ambient+direct*1.5*uDirect*uTint)*uDay;
 // Broad fragmented sea reflections, not underwater cellular refraction.
 vec2 seaUV=uv*vec2(.73,.94)+vec2(uTime*.031,-uTime*.023);
 float seaPatch=noise(seaUV+vec2(noise(seaUV*.6),noise(seaUV*.8+12.)));
 float ribbon=noise(vec2(seaUV.x*.62,seaUV.y*3.2)+seaPatch*1.8);
 float alignment=.45+.55*pow(.5+.5*sin(uTime*.39+uv.x*.7),5.);
 float reflected=smoothstep(.48,.70,seaPatch)*smoothstep(.48,.77,ribbon);
 float reach=exp(-depth*.48)*(1.-smoothstep(2.6,4.1,p.y));
 col+=uTint*vec3(.44,.48,.47)*reflected*alignment*reach*(uKind==2?0.:.25)*uDay*uBeam*uDirect;
 if(uKind==1){
  float lowArea=noise(uv*.56+vec2(7.,21.))*.63+noise(uv*2.4)*.25+noise(uv*12.)*.12;
  float damp=smoothstep(.28,.63,lowArea)*(.25+.75*coastal);
  float film=smoothstep(.57,.78,lowArea)*(.35+.65*coastal);
  float puddle=smoothstep(.73,.83,lowArea);
  float wet=film*.16+puddle*.68;
  col*=1.-damp*.27;
  col*=.96+.04*noise(uv*55.);
  vec3 v=normalize(p-cameraPosition);vec3 normal=normalize(vec3((noise(uv*18.)-.5)*mix(.22,.045,puddle),1.,(noise(uv*17.+9.)-.5)*mix(.24,.06,puddle)));
  vec3 r=reflect(v,normal);float d=(-11.-p.z)/r.z;vec3 q=p+r*d;
  float mask=step(0.,d)*smoothstep(-3.6,-3.25,q.x)*(1.-smoothstep(3.25,3.6,q.x))*smoothstep(0.,.3,q.y)*(1.-smoothstep(3.9,4.3,q.y));
  float fresnel=.025+.42*pow(1.-max(dot(-v,normal),0.),5.);
  col+=mix(vec3(.48,.59,.65),uTint*.58,.2)*mask*fresnel*wet*uDay;
 }
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
}

export function seaMaterial(time:{value:number},day:{value:number},sun:{value:THREE.Vector3},tint:{value:THREE.Color},direct:{value:number}){
 return new THREE.ShaderMaterial({uniforms:{uTime:time,uDay:day,uSun:sun,uTint:tint,uDirect:direct},side:THREE.DoubleSide,
 vertexShader:`varying vec3 p;void main(){p=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
 fragmentShader:`varying vec3 p;uniform float uTime,uDay,uDirect;uniform vec3 uSun,uTint;
 ${oceanWaveGLSL}
 void main(){
 vec2 slope=oceanSlope(p.xz,uTime);
 float distanceToEye=length(cameraPosition-p);
 float detail=1.-smoothstep(40.,260.,distanceToEye);
 slope+=vec2(sin(p.x*4.7+p.z*3.1-uTime*1.8),sin(p.x*3.9-p.z*6.4+uTime*1.6))*.012*detail;
 vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
 vec3 view=normalize(cameraPosition-p),reflected=reflect(-view,normal);
 float fresnel=.025+.975*pow(1.-max(dot(normal,view),0.),5.);
 vec3 sky=mix(mix(vec3(.49,.56,.58),uTint*.60,.28*uDirect),vec3(.28,.39,.45),sqrt(max(reflected.y,0.)));
 vec3 col=mix(vec3(.075,.14,.16),sky,fresnel);
 vec3 light=uSun;
 float sparkle=pow(max(dot(normal,normalize(view+light)),0.),180.);
 col+=vec3(.55,.56,.52)*sparkle*.7*uDirect*uTint;
 col=mix(col,vec3(.40,.48,.50),smoothstep(150.,650.,distanceToEye)*.75);
 gl_FragColor=vec4(col*uDay,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
}
