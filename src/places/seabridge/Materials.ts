import * as THREE from 'three';
import {GRASS_PATCHES,PLATFORM,STAIR,stairProfile} from './Layout.ts';

/**
 * Procedural world-space surfaces for the seabridge ground and station.
 * Art-directed: tile size, soil tones and weathering are plausible choices, not
 * measured materials. All added terms only scale received light (no emission).
 */

const noiseGLSL=/* glsl */`
float sbHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float sbNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(sbHash(i),sbHash(i+vec2(1,0)),f.x),mix(sbHash(i+vec2(0,1)),sbHash(i+1.),f.x),f.y);}
float sbFbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*sbNoise(p);p=p*2.03+17.1;a*=.5;}return v;}
float sbBox(vec2 p,vec2 c,vec2 h){vec2 d=abs(p-c)-h;return length(max(d,0.))+min(max(d.x,d.y),0.);}
// Screen-space bump from a scalar height (view-space normal and position).
vec3 sbBump(vec3 n,vec3 pv,float h){
 vec3 dx=dFdx(pv),dy=dFdy(pv);float hx=dFdx(h),hy=dFdy(h);
 vec3 r1=cross(dy,n),r2=cross(n,dx);float det=dot(dx,r1);
 return normalize(abs(det)*n-sign(det)*(hx*r1+hy*r2));
}`;

const worldVarying=(shader:THREE.WebGLProgramParametersWithUniforms)=>{
 shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSbWorld;')
  .replace('#include <begin_vertex>','#include <begin_vertex>\nvSbWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 vSbWorld;\n${noiseGLSL}`);
};

/**
 * Town-side ground: a worn concrete-paver apron around the stair foot whose
 * edge breaks up into coastal soil and gravel; root litter under the weeds;
 * contact darkening at the stair and column feet; a damp drip line under the
 * roof edges. Replaces the former hard-edged paving box.
 */
export function createGroundMaterial(columns:readonly [number,number][]){
 const s=stairProfile(),hw=STAIR.width/2;
 const material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.95});
 const patches=GRASS_PATCHES.filter(p=>p.y===0).map(p=>`cover=max(cover,1.-smoothstep(.55,1.15,length((q-vec2(${p.x.toFixed(2)},${p.z.toFixed(2)}))/vec2(${(p.radius*1.8*1.2+.3).toFixed(2)},${(p.radius*.7*1.2+.3).toFixed(2)}))+(n2-.5)*.6));`).join('\n');
 const feet=columns.map(([x,z])=>`foot=min(foot,length(q-vec2(${x.toFixed(2)},${z.toFixed(2)}))-.21);`).join('\n');
 const stairCz=((STAIR.footZ+s.f1End)/2).toFixed(2),stairHz=((STAIR.footZ-s.f1End)/2).toFixed(2);
 material.onBeforeCompile=shader=>{
  worldVarying(shader);
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec2 q=vSbWorld.xz;
 float n1=sbFbm(q*.9),n2=sbFbm(q*2.7+5.),n3=sbNoise(q*16.);
 // Paver apron: the approach to the stair plus a slab under the first flight.
 float apron=min(sbBox(q,vec2(.3,4.2),vec2(2.1,4.6)),sbBox(q,vec2(0.,${stairCz}),vec2(${(hw+.55).toFixed(2)},${stairHz})));
 apron+=(sbFbm(q*.45+2.)-.5)*2.2+(n2-.5)*.5;
 vec2 t=q/.30;t.x+=step(1.,mod(floor(t.y),2.))*.5;vec2 id=floor(t),f=fract(t)-.5;
 float tileMissing=step(sbHash(id+3.1),smoothstep(-.9,.05,apron));
 float pave=(1.-smoothstep(-.05,.05,apron))*(1.-tileMissing);
 float joint=smoothstep(.43,.485,max(abs(f.x),abs(f.y)));
 vec3 paverCol=vec3(.36,.35,.33)*(.8+.3*sbHash(id))*(.85+.25*n2);
 // Grime and lichen blotches, heavier toward the broken edge.
 paverCol=mix(paverCol,vec3(.24,.24,.20),smoothstep(.45,.8,sbFbm(q*1.7+9.))*(.4+.6*smoothstep(-1.2,0.,apron)));
 paverCol=mix(paverCol,vec3(.15,.17,.11),joint*.9);
 // Soil: brown-grey coastal fill with scattered gravel.
 vec3 soil=mix(vec3(.19,.17,.14),vec3(.26,.24,.19),n1);
 float gravel=smoothstep(.72,.9,n3)*(.6+.4*n2);
 soil=mix(soil,vec3(.36,.34,.30),gravel*.7);
 float cover=0.;
 ${patches}
 soil=mix(soil,mix(vec3(.13,.14,.09),vec3(.21,.20,.13),n2),cover*.9);
 vec3 col=mix(soil,paverCol,pave);
 // Contact darkening where the stair and columns meet the ground.
 float stairD=sbBox(q,vec2(0.,${stairCz}),vec2(${hw.toFixed(2)},${stairHz}));
 float foot=1e3;
 ${feet}
 float contact=(1.-smoothstep(0.,.5,max(stairD,0.)))*.35+(1.-smoothstep(0.,.35,max(foot,0.)))*.4;
 // Drip line under the roof eaves: damp, darker, faintly algae-tinted.
 float drip=exp(-pow(abs(abs(q.x)-${(hw+.42).toFixed(2)})/.12,2.))*step(${(s.f1End).toFixed(2)},q.y)*step(q.y,${(STAIR.footZ+2.4).toFixed(2)})*(.5+.5*n2);
 col=mix(col,col*vec3(.62,.68,.58),drip*.8);
 col*=1.-contact;
 diffuseColor.rgb*=col;
 float sbRough=mix(.97,.86,pave)-drip*.3;
 float sbH=pave*(-.006*joint+.002*sbHash(id))+(1.-pave)*(.003*gravel+.004*n2);`)
   .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n roughnessFactor=sbRough;')
   .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n normal=sbBump(normal,-vViewPosition,sbH);');
 };
 material.customProgramCacheKey=()=> 'seabridge-ground-v1';
 return material;
}

/** Painted corrugated sheet: wall ribs run vertically, roof ribs run front to back. */
export function createCorrugatedMaterial(color:string,kind:'wall'|'roof',roughness=.7){
 const material=new THREE.MeshStandardMaterial({color,roughness,metalness:.25});
 material.onBeforeCompile=shader=>{
  worldVarying(shader);
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec2 q=vec2(vSbWorld.x+vSbWorld.z,vSbWorld.y);
 float along=${kind==='wall'?'q.x':'vSbWorld.x'};
 float rib=sin(along*2.*PI/.076);
 // Chalky paint, salt streaks running down from the top, rust at the lower edge.
 float streak=smoothstep(.55,.9,sbNoise(vec2(q.x*9.,q.y*.6)));
 float rust=smoothstep(.62,.85,sbFbm(q*3.)+(1.-smoothstep(${(PLATFORM.topY).toFixed(2)},${(PLATFORM.topY+.5).toFixed(2)},vSbWorld.y))*.35);
 diffuseColor.rgb*=(.9+.08*rib)*(1.-.12*streak);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.34,.22,.14),rust*.55);
 float sbH=rib*.004;`)
   .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n normal=sbBump(normal,-vViewPosition,sbH);');
 };
 material.customProgramCacheKey=()=>`seabridge-corrugated-${kind}-v1`;
 return material;
}

/**
 * Platform concrete: weathered slab with a white safety line and a strip of
 * dull-yellow tactile blocks (small raised dots) back from the track edge.
 */
export function createPlatformMaterial(){
 const material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.92});
 material.onBeforeCompile=shader=>{
  worldVarying(shader);
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec2 q=vSbWorld.xz;float n=sbFbm(q*1.6),n2=sbNoise(q*20.);
 vec3 col=vec3(.50,.49,.46)*(.82+.25*n)*(.95+.1*n2);
 float top=step(${(PLATFORM.topY-.02).toFixed(3)},vSbWorld.y);
 float fromEdge=${PLATFORM.zNear.toFixed(2)}-q.y;
 float line=top*(1.-step(.06,abs(fromEdge-.25)));
 float tactile=top*(1.-step(.15,abs(fromEdge-.9)));
 vec2 cell=fract(q/.05)-.5;float dot_=1.-smoothstep(.18,.26,length(cell));
 col=mix(col,vec3(.72,.71,.66)*(.85+.15*n),line*.9);
 col=mix(col,vec3(.52,.45,.24)*(.8+.2*n),tactile*.9);
 // Rain-darkened slab joints every 1.5 m and a grimy vertical face.
 float joint=top*(1.-smoothstep(.0,.02,abs(fract(q.x/1.5)-.5)*1.5-.73));
 col*=1.-.35*joint;
 col*=mix(.72,1.,top);
 diffuseColor.rgb*=col;
 float sbH=tactile*dot_*.003-joint*.003;`)
   .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n normal=sbBump(normal,-vViewPosition,sbH);');
 };
 material.customProgramCacheKey=()=> 'seabridge-platform-v1';
 return material;
}

