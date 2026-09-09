import * as THREE from 'three';

// Procedural concrete and reflected opening. These are art-directed transport
// approximations, not baked GI or a water/caustic solver. World coordinates: metres.
export function tunnelMaterial(kind:'wall'|'floor'|'ceiling',time:{value:number},day:{value:number},beam:{value:number}){
 return new THREE.ShaderMaterial({uniforms:{uTime:time,uDay:day,uBeam:beam,uKind:{value:kind==='floor'?1:kind==='ceiling'?2:0}},
 vertexShader:`varying vec3 p;varying vec3 n;void main(){p=(modelMatrix*vec4(position,1.)).xyz;n=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
 fragmentShader:`varying vec3 p;varying vec3 n;uniform float uTime,uDay,uBeam;uniform int uKind;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
 void main(){
 vec2 uv=uKind==0?vec2(p.z,p.y):p.xz;
 float grain=noise(uv*180.);float mottling=noise(uv*2.7)*.5+noise(uv*12.)*.3+grain*.2;
 float seam=min(abs(fract(uv.x/2.7)-.5)*2.7,abs(fract(uv.y/1.4)-.5)*1.4);
 float joints=mix(.65,1.,smoothstep(.002,.018,seam));
 float exitLight=exp(-max(p.z+11.,0.)*.16);
 // A single oblique daylight direction is clipped against the real exit rectangle.
 vec3 sun=normalize(vec3(.46, .55,-1.));float travel=(-11.-p.z)/sun.z;
 vec3 at=p+sun*travel;
 float opening=smoothstep(-3.4,-3.25,at.x)*(1.-smoothstep(3.25,3.4,at.x))*smoothstep(0.,.12,at.y)*(1.-smoothstep(4.05,4.2,at.y));
 float direct=opening*max(dot(n,sun),0.);
 vec3 concrete=vec3(.24,.255,.25)*(.68+mottling*.5)*joints;
 float ambient=.012+exitLight*(uKind==2?.09:.30);
 vec3 col=concrete*(ambient+direct*1.5)*uDay;
 // Animated reflected water light restricted to the exit-facing portion of the wall.
 float a=sin(uv.x*6.+sin(uv.y*5.+uTime*.33)*1.8+uTime*.22);
 float b=sin(uv.y*7.+sin(uv.x*4.-uTime*.27)*1.6);
 float caustic=pow(max(0.,1.-abs(a+b)*.85),15.);
 col+=vec3(.65,.72,.69)*caustic*exitLight*opening*(uKind==2?0.:.22)*uDay*uBeam;
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

export function seaMaterial(time:{value:number},day:{value:number}){
 return new THREE.ShaderMaterial({uniforms:{uTime:time,uDay:day},side:THREE.DoubleSide,
 vertexShader:`varying vec3 p;void main(){p=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
 fragmentShader:`varying vec3 p;uniform float uTime,uDay;void main(){float waves=sin(p.z*5.+sin(p.x*.7+uTime*.19)+uTime*.45)*sin(p.x*3.2-p.z*1.4+uTime*.2);float sparkle=pow(max(waves,0.),16.);float far=smoothstep(18.,180.,-p.z);vec3 col=mix(vec3(.15,.23,.27),vec3(.39,.48,.51),far);col+=sparkle*vec3(.6,.64,.63)*(.4+.6*sin(p.x*.18)*sin(p.x*.18));gl_FragColor=vec4(col*uDay,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
}
