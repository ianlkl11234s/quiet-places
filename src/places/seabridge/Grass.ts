import * as THREE from 'three';
import {seededRandom} from '../../shared/math/seededRandom.ts';

/**
 * Coastal weeds: GPU-instanced blades and seed-head stems in clumps. Original
 * procedural grass (not an identified species). Wind is an art-directed onshore
 * breeze: mostly near still, an occasional gust travelling inland, roots fixed.
 * Bending happens in the vertex shader from local height f=position.y (0..1).
 */
export interface GrassPatch {x:number;z:number;y:number;radius:number;clumps:number;density:number;height:number}

const SEGMENTS=5;

/** Folded strip, height 1, width 1 at the root; the fold adds a lit/shaded side. */
function bladeGeometry(){
 const positions:number[]=[],indices:number[]=[];
 for(let j=0;j<=SEGMENTS;j++){
  const f=j/SEGMENTS,w=.5*Math.pow(1-f,.85)+.01;
  positions.push(-w,f,0, 0,f,.28*w, w,f,0);
  if(j<SEGMENTS){const k=j*3;indices.push(k,k+1,k+3, k+1,k+4,k+3, k+1,k+2,k+4, k+2,k+5,k+4);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

/** Thin stem with a drooping, open panicle of short spikelets near the top. */
function seedHeadGeometry(random:()=>number){
 const positions:number[]=[],indices:number[]=[];
 const strip=(x0:number,y0:number,z0:number,x1:number,y1:number,z1:number,w0:number,w1:number)=>{
  const k=positions.length/3;
  positions.push(x0-w0,y0,z0, x0+w0,y0,z0, x1-w1,y1,z1, x1+w1,y1,z1);indices.push(k,k+1,k+2,k+1,k+3,k+2);
 };
 for(let j=0;j<SEGMENTS;j++)strip(0,j/SEGMENTS*.8,0,0,(j+1)/SEGMENTS*.8,0,.012,.01);
 strip(0,.8,0,.02,1,.01,.01,.004);
 for(let i=0;i<9;i++){
  const y=.72+i*.03,a=random()*Math.PI*2,l=.06+random()*.07;
  // Spikelets hang slightly downward so the head nods instead of fanning out.
  strip(0,y,0,Math.cos(a)*l*.35,y-l*.45,Math.sin(a)*l*.35,.005,.0012);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function createGrass(patches:readonly GrassPatch[],blocked:(x:number,z:number,y:number)=>boolean,light:{sun:{value:THREE.Vector3};tint:{value:THREE.Color};direct:{value:number}}){
 const group=new THREE.Group();group.name='seabridge-coastal-weeds';
 const random=seededRandom(4127);
 const uniforms={uTime:{value:0},uWindDir:{value:new THREE.Vector2(.28,1).normalize()},uSun:light.sun,uSunTint:light.tint,uDirect:light.direct};
 const makeMaterial=(key:string)=>{
  const material=new THREE.MeshStandardMaterial({roughness:.78,side:THREE.DoubleSide,vertexColors:false});
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,uniforms);
   shader.vertexShader=shader.vertexShader
    .replace('#include <common>',`#include <common>
uniform float uTime;uniform vec2 uWindDir;
attribute vec3 aTone;attribute vec2 aBend;
varying vec3 vTone;varying float vF;
// Onshore breeze envelope (seconds): ~85% near still, two gusts per 83 s cycle.
float gustPulse(float t,float c,float w){float d=mod(t-c+41.5,83.)-41.5;return exp(-d*d/(w*w));}
float breeze(float t){return .12+.04*sin(t*.39)+.03*sin(t*.83)+.8*gustPulse(t,29.,3.4)+.6*gustPulse(t,66.,4.2);}`)
    .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
objectNormal=normalize(objectNormal+vec3(0.,.9,0.));`)
    .replace('#include <begin_vertex>',`#include <begin_vertex>
vF=position.y;vTone=aTone;`)
    .replace('#include <project_vertex>',`vec4 wp=modelMatrix*instanceMatrix*vec4(transformed,1.);
float rootH=(modelMatrix*instanceMatrix*vec4(0.,1.,0.,0.)).y;
vec3 root=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
// Rest lean (aBend.x) along the blade's facing grows with f^2 so the root stays planted.
vec3 facing=normalize((modelMatrix*instanceMatrix*vec4(0.,0.,1.,0.)).xyz);
wp.xyz+=facing*aBend.x*vF*vF*rootH;
// Gust arrives later further inland; each plant keeps its own flex and flutter phase.
float arrive=uTime-dot(root.xz,-uWindDir)*.12;
float w=breeze(arrive);
float flutter=sin(uTime*(1.4+aBend.y)+aBend.y*9.+root.x*.7)*(.015+.05*w);
float sway=(w*.32+flutter)*vF*vF*rootH*(.6+.5*aBend.y);
wp.xz+=uWindDir*sway;wp.y-=abs(sway)*vF*.25;
vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;`);
   shader.fragmentShader=shader.fragmentShader
    .replace('#include <common>',`#include <common>
uniform vec3 uSun,uSunTint;uniform float uDirect;varying vec3 vTone;varying float vF;`)
    .replace('#include <color_fragment>',`#include <color_fragment>
// Darker, damper base; drier, paler tips.
diffuseColor.rgb=vTone*mix(.45,1.12,smoothstep(0.,.85,vF));`)
    .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
// Thin-leaf transmission when the low sun is behind the blade: scaled by the
// same direct light, so it disappears at night; not emission.
vec3 V=normalize(cameraPosition-vWorldGrass);
float back=pow(max(dot(-V,normalize(uSun)),0.),4.);
reflectedLight.indirectDiffuse+=diffuseColor.rgb*uSunTint*back*uDirect*.9*smoothstep(.2,1.,vF);`)
    .replace('void main() {','varying vec3 vWorldGrass;\nvoid main() {');
   shader.vertexShader=shader.vertexShader.replace('void main() {','varying vec3 vWorldGrass;\nvoid main() {').replace('vec4 mvPosition=viewMatrix*wp;','vWorldGrass=wp.xyz;vec4 mvPosition=viewMatrix*wp;');
  };
  material.customProgramCacheKey=()=>`seabridge-grass-${key}-v1`;
  return material;
 };
 // Palette: muted coastal greens with a share of sun-dried straw, low saturation.
 const greens=[[.20,.26,.13],[.25,.30,.16],[.17,.22,.12],[.28,.31,.17],[.23,.27,.17]],straw=[[.38,.35,.22],[.43,.39,.26],[.33,.31,.20]];
 const pick=(a:number[][])=>a[Math.floor(random()*a.length)];

 type Item={x:number;y:number;z:number;h:number;w:number;heading:number;tilt:number;lean:number;flex:number;tone:number[]};
 const blades:Item[]=[],heads:Item[]=[];
 for(const patch of patches)for(let c=0;c<patch.clumps;c++){
  const a=random()*Math.PI*2,r=Math.sqrt(random())*patch.radius;
  const cx=patch.x+Math.cos(a)*r*1.8,cz=patch.z+Math.sin(a)*r*.7;
  const size=.5+random()*.8,count=Math.round(patch.density*(.5+random()));
  const dry=random()<.22;
  for(let i=0;i<count;i++){
   const ang=random()*Math.PI*2,d=Math.pow(random(),1.5)*.18*size;
   // Longer leaves arch further; short ones stay nearly upright.
   const h=patch.height*size*(.45+random()*.75);
   if(blocked(cx+Math.cos(ang)*d,cz+Math.sin(ang)*d,patch.y))continue;
   blades.push({x:cx+Math.cos(ang)*d,y:patch.y,z:cz+Math.sin(ang)*d,h,w:.014+random()*.016,
    heading:ang+Math.PI/2+(random()-.5)*.6,tilt:.12+random()*.35,lean:(.15+random()*.45)*Math.min(1,h/.45),flex:random(),tone:random()<(dry?.5:.12)?pick(straw):pick(greens)});
  }
  // Low turf between clumps so the ground reads as covered, not isolated tufts.
  for(let i=0;i<count*.45;i++){
   const ang=random()*Math.PI*2,d=.15+random()*.45*size;
   if(blocked(cx+Math.cos(ang)*d,cz+Math.sin(ang)*d,patch.y))continue;
   blades.push({x:cx+Math.cos(ang)*d,y:patch.y,z:cz+Math.sin(ang)*d,h:.08+random()*.16,w:.012+random()*.01,
    heading:random()*Math.PI*2,tilt:.2+random()*.5,lean:.05+random()*.15,flex:random(),tone:pick(greens)});
  }
  const stems=random()<.3?Math.round(1+random()*1.5*size):0;
  for(let i=0;i<stems;i++){
   const ang=random()*Math.PI*2,d=random()*.08;
   if(blocked(cx,cz,patch.y))continue;
   heads.push({x:cx+Math.cos(ang)*d,y:patch.y,z:cz+Math.sin(ang)*d,h:patch.height*size*(1.1+random()*.7),w:1,
    heading:random()*Math.PI*2,tilt:.03+random()*.12,lean:.05+random()*.2,flex:random(),tone:pick(straw)});
  }
 }
 const build=(name:string,geometry:THREE.BufferGeometry,items:Item[],material:THREE.Material)=>{
  const mesh=new THREE.InstancedMesh(geometry,material,items.length);mesh.name=name;
  const tone=new Float32Array(items.length*3),bend=new Float32Array(items.length*2);
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),s=new THREE.Vector3(),p=new THREE.Vector3();
  items.forEach((it,i)=>{
   // Blades lean outward from the clump centre; tilt tips the whole plant.
   e.set(it.tilt*Math.cos(it.heading),it.heading,it.tilt*Math.sin(it.heading),'YXZ');q.setFromEuler(e);
   s.set(name==='seed-heads'?1:it.w,it.h,name==='seed-heads'?1:it.w);
   mesh.setMatrixAt(i,m.compose(p.set(it.x,it.y,it.z),q,s));
   tone.set(it.tone,i*3);bend[i*2]=it.lean;bend[i*2+1]=it.flex;
  });
  geometry.setAttribute('aTone',new THREE.InstancedBufferAttribute(tone,3));geometry.setAttribute('aBend',new THREE.InstancedBufferAttribute(bend,2));
  mesh.receiveShadow=true;mesh.castShadow=false;mesh.frustumCulled=false;group.add(mesh);return mesh;
 };
 build('grass-blades',bladeGeometry(),blades,makeMaterial('blade'));
 build('seed-heads',seedHeadGeometry(random),heads,makeMaterial('head'));
 return {group,count:{blades:blades.length,heads:heads.length},update(elapsed:number){uniforms.uTime.value=Number.isFinite(elapsed)?elapsed:0;}};
}
