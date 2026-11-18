import * as THREE from 'three';

/** Ship speed relative to the water, m/s: the surface and wake stream toward -Z (astern) at this rate. */
export const SHIP_SPEED=8;
/** Wake: a white foam band behind the stern, centre x, starting half width, spread per metre astern, fade length. */
export const WAKE={centerX:-1.2,startZ:-3,halfWidth:8,spread:.1,fade:330} as const;

/**
 * Open-sea surface seen from a moving ferry: saturated deep blue, a strong glint path toward the
 * light (sun by day, moon at night; uDirect carries the strength), and a white wake with broken
 * edges. Ship frame: the texture scrolls astern, the ship does not move. Art-directed, no bathymetry.
 */
export function createCrossingSeaMaterial(time:{value:number},day:{value:number},sun:{value:THREE.Vector3},tint:{value:THREE.Color},direct:{value:number},horizon:{value:THREE.Color},zenith:{value:THREE.Color}){
 return new THREE.ShaderMaterial({uniforms:{uTime:time,uDay:day,uSun:sun,uTint:tint,uDirect:direct,uHorizon:horizon,uZenith:zenith},side:THREE.DoubleSide,
 vertexShader:`varying vec3 p;void main(){p=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
 fragmentShader:`varying vec3 p;uniform float uTime,uDay,uDirect;uniform vec3 uSun,uTint,uHorizon,uZenith;
 float h(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
 float n(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
 float fbm(vec2 q){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(q);q=q*2.1+7.3;a*=.5;}return v;}
 // One dot per active cell: random cell, offset and twinkle phase; radius about a quarter of the cell.
 float sparkle(vec2 w,float k,float thresh,float t){
  vec2 g=w*k,id=floor(g),f=fract(g)-.5;float r=h(id);
  vec2 off=(vec2(h(id+3.1),h(id+7.7))-.5)*.5;
  float on=step(thresh,r),tw=.5+.5*sin(t*(3.+6.*h(id+1.3))+6.2832*h(id+9.));
  return on*smoothstep(.34,.0,length(f-off))*tw*tw;
 }
 vec2 vn(vec2 q){return vec2(n(q),n(q+17.3))-.5;}
 mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
 void main(){
 float t=uTime;
 vec3 toEye=cameraPosition-p;float dist=length(toEye);vec3 view=toEye/dist;
 // Water frame: big swell slides astern at ship speed, finer chop slower (a calmer shimmer, no flicker).
 vec2 w0=p.xz+vec2(0.,${SHIP_SPEED.toFixed(1)}*t);
 vec2 w1=rot(.7)*(p.xz+vec2(0.,6.*t));
 vec2 w2=rot(-.5)*(p.xz+vec2(0.,3.*t));
 vec2 w3=rot(1.3)*(p.xz+vec2(0.,1.5*t));
 // Irregular slope: four noise layers at different scales and directions; fine ones fade with distance.
 float f1=1.-smoothstep(150.,500.,dist),f2=1.-smoothstep(60.,260.,dist),f3=1.-smoothstep(25.,110.,dist);
 vec2 slope=vn(w0*.11)*.42+vn(w1*.37)*.30*f1+vn(w2*1.1)*.22*f2+vn(w3*3.1)*.16*f3;
 vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
 vec3 refl=reflect(-view,normal);
 float fresnel=(.02+.98*pow(1.-max(dot(normal,view),0.),5.))*.55;
 vec3 sky=mix(uHorizon*.9,uZenith*.9,sqrt(max(refl.y,0.)));
 // Deep saturated blue (about sRGB 20,60,130 near, slightly lighter far); darker troughs, lighter swell faces.
 float shade=clamp(.5+slope.x*1.6+slope.y*.8,0.,1.);
 vec3 near=mix(vec3(.006,.040,.19),vec3(.012,.075,.30),shade);
 vec3 far=mix(vec3(.012,.07,.27),vec3(.03,.13,.40),shade);
 vec3 water=mix(near,far,smoothstep(20.,400.,dist))*uDay;
 vec3 col=mix(water,sky,fresnel);
 // Glitter: point sparkles, not a lobe. The path lies along the light's bearing (a 45-degree sun cannot reflect to the
 // horizon from real slopes, so it is placed by azimuth): wide near, thin far. Near sparkles are big and sparse, far ones
 // fine and dense; the density rises toward the axis and only the axis centre joins into a band. Each dot twinkles.
 vec2 toP=p.xz-cameraPosition.xz;vec2 hd=normalize(toP),sd=normalize(uSun.xz);
 float ang=acos(clamp(dot(hd,sd),-1.,1.));
 float sig=.11+.5*view.y;
 float axis=exp(-pow(ang/sig,2.));
 float wA=1.-smoothstep(25.,90.,dist),wB=smoothstep(15.,50.,dist)*(1.-smoothstep(160.,380.,dist)),wC=smoothstep(110.,260.,dist);
 float spark=wA*sparkle(w3,3.,mix(.99,.86,axis),t)+wB*sparkle(w2,1.15,mix(.98,.80,axis),t)+wC*sparkle(w1,.38,mix(.97,.72,axis),t);
 float band=pow(axis,3.)*smoothstep(80.,260.,dist)*.5;
 float glint=spark*9.*(.35+.65*axis)+band;
 col+=glint*uDirect*uTint*(.5+.5*uDay);
 // Wake: dense white foam from the stern aft, widening and thinning, swirled edges, scrolling with the water.
 float d=max(-p.z+(${WAKE.startZ.toFixed(1)}),0.);
 float hw=${WAKE.halfWidth.toFixed(2)}+d*${WAKE.spread.toFixed(3)};
 float across=abs(p.x-(${WAKE.centerX.toFixed(2)}))/hw;
 float edge=1.-smoothstep(.5,1.,across+(fbm(vec2(w0.x*.35,w0.y*.09))-.5)*.55);
 float body=(1.-smoothstep(0.,1.,d/${WAKE.fade.toFixed(1)}))*step(0.,-p.z+(${WAKE.startZ.toFixed(1)}));
 float swirl=fbm(vec2(w0.x*.7,w0.y*.18)+fbm(w0*.3)*1.5);
 float streak=fbm(vec2(w0.x*2.4,w0.y*.5+4.));
 float foam=clamp(edge*body*(.55+1.1*swirl+.5*streak-.45),0.,1.);
 foam=smoothstep(.15,.7,foam)*edge+smoothstep(0.,.5,edge)*(1.-smoothstep(0.,60.,d))*step(0.,d);
 vec3 foamCol=vec3(.95,.97,.98)*mix(.5,1.,uDay)*mix(vec3(1),uTint,.5);
 col=mix(col,foamCol,clamp(foam,0.,1.)*.95);
 col=mix(col,mix(vec3(.03,.15,.42)*uDay,uHorizon*.8,.4),smoothstep(200.,680.,dist)*.5);
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
}
