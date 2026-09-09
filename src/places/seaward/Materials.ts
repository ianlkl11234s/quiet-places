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
 float exitLight=exp(-max(p.z+11.,0.)*.16);
 // A single oblique daylight direction is clipped against the real exit rectangle.
 vec3 sun=uSun;float travel=(-11.-p.z)/sun.z;
 vec3 at=p+sun*travel;
 float opening=smoothstep(-3.4,-3.25,at.x)*(1.-smoothstep(3.25,3.4,at.x))*smoothstep(0.,.12,at.y)*(1.-smoothstep(4.05,4.2,at.y));
 float direct=opening*max(dot(n,sun),0.);
 vec3 concrete=vec3(.24,.255,.25)*(.68+mottling*.5)*joints;
 float ambient=.012+exitLight*(uKind==2?.09:.30);
 vec3 col=concrete*(vec3(ambient)+direct*1.5*uDirect*uTint)*uDay;
 // Animated reflected water light restricted to the exit-facing portion of the wall.
 float a=sin(uv.x*6.+sin(uv.y*5.+uTime*.33)*1.8+uTime*.22);
 float b=sin(uv.y*7.+sin(uv.x*4.-uTime*.27)*1.6);
 float caustic=pow(max(0.,1.-abs(a+b)*.85),15.);
 col+=vec3(.65,.72,.69)*caustic*exitLight*opening*(uKind==2?0.:.22)*uDay*uBeam*uDirect*uTint;
 if(uKind==1){
  float wet=smoothstep(.32,.62,noise(uv*.8)*.6+noise(uv*3.)*.4);
  vec3 v=normalize(p-cameraPosition);vec3 normal=normalize(vec3((noise(uv*18.)-.5)*.055,1.,(noise(uv*17.+9.)-.5)*.07));
  vec3 r=reflect(v,normal);float d=(-11.-p.z)/r.z;vec3 q=p+r*d;
  float mask=step(0.,d)*smoothstep(-3.6,-3.25,q.x)*(1.-smoothstep(3.25,3.6,q.x))*smoothstep(0.,.3,q.y)*(1.-smoothstep(3.9,4.3,q.y));
  float fresnel=.045+.50*pow(1.-max(dot(-v,normal),0.),5.);
  col=mix(col,col*.65,wet);col+=vec3(.48,.59,.65)*mask*fresnel*wet*uDay;
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
 vec3 sky=mix(vec3(.49,.56,.58),vec3(.28,.39,.45),sqrt(max(reflected.y,0.)));
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
