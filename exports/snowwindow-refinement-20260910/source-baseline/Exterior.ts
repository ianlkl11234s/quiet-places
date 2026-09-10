import * as THREE from 'three';

export interface WinterExteriorLight {
 sky: THREE.Color;
 horizon: THREE.Color;
 tint: THREE.Color;
 visibility: number;
}

export interface WinterExterior {
 group: THREE.Group;
 update(elapsed: number, light: WinterExteriorLight): void;
 dispose(): void;
}

export const WINTER_EXTERIOR_PLATFORM={xMin:-1.16,xMax:10.84,zNear:-4.5,zFar:-5.9,topY:.75,bottomY:.722} as const;
export const WINTER_SWELL_PERIOD=96;

/**
 * Two broad, smooth arrivals per 96-second loop. The returned amplitude is
 * metres; wave shape remains in the shader. This is an art-directed deep-water
 * approximation, not a hydrodynamic forecast or fluid simulation.
 */
export function winterSwellEnvelope(elapsed:number):number{
 const phase=(((Number.isFinite(elapsed)?elapsed:0)/WINTER_SWELL_PERIOD)%1+1)%1;
 const pulse=(center:number,halfWidth:number)=>{
  const distance=Math.abs(((phase-center+.5)%1+1)%1-.5);
  const edge=THREE.MathUtils.smoothstep(distance,halfWidth,halfWidth*.54);
  return 1-edge;
 };
 return Math.max(.19*pulse(.26,.115),.23*pulse(.71,.145));
}

const skyVertex = /* glsl */`
 varying vec3 vWorld;
 void main(){
  vWorld=(modelMatrix*vec4(position,1.)).xyz;
  gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
 }
`;

const skyFragment = /* glsl */`
 uniform vec3 uSky; uniform vec3 uHorizon; uniform vec3 uTint; uniform float uVisibility;
 varying vec3 vWorld;
 float cloud(vec2 p){
  // Layered, broad cloud banks in angular space. This is deliberately soft:
  // enough structure to read as weather without looking like painted noise.
  float c=.52+.22*sin(p.x*2.4+p.y*.75)+.16*sin(p.x*5.8-p.y*1.9);
  c+=.09*sin(p.x*12.0+p.y*4.6)+.05*sin(p.x*23.0-p.y*9.0);
  return smoothstep(.18,.84,c);
 }
 void main(){
  vec3 d=normalize(vWorld-cameraPosition);
  float up=clamp(d.y*.5+.5,0.,1.);
  float horizonBand=smoothstep(.38,.68,up);
  vec3 col=mix(uHorizon,uSky,pow(horizonBand,.72));
  vec2 cloudSpace=d.xz/max(.22,d.y+.34);
  float overcast=cloud(cloudSpace);
  col=mix(col,col*(.78+.22*uTint),.20+.32*overcast);
  col*=.78+.30*(1.-overcast);
  col*=mix(.14,1.,clamp(uVisibility,0.,1.));
  gl_FragColor=vec4(col,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
`;

const seaVertex = /* glsl */`
 uniform float uTime;
 varying vec3 vWorld; varying vec2 vSlope;
 float heightAt(vec2 p){
  float phase=fract(uTime/96.0);
  float pulseA=1.0-smoothstep(.062,.115,abs(fract(phase-.26+.5)-.5));
  float pulseB=1.0-smoothstep(.078,.145,abs(fract(phase-.71+.5)-.5));
  float swell=max(.19*pulseA,.23*pulseB);
  // Slow, travelling components give the occasional group a coherent crest.
  float groupWave=.76*sin(dot(p,vec2(.45,.16))-uTime*.34)+.24*sin(dot(p,vec2(.79,-.23))-uTime*.48);
  return sin(p.x*.34+p.y*.19+uTime*.20)*.035
   + sin(p.x*.12-p.y*.31-uTime*.14)*.024
   + sin(p.x*.73+p.y*.08+uTime*.34)*.007
   + swell*groupWave;
 }
 void main(){
  vec3 p=position;
  p.y+=heightAt(p.xz);
  float e=.08;
  vSlope=vec2(heightAt(p.xz+vec2(e,0.))-heightAt(p.xz-vec2(e,0.)),heightAt(p.xz+vec2(0.,e))-heightAt(p.xz-vec2(0.,e)))/(2.*e);
  vWorld=(modelMatrix*vec4(p,1.)).xyz;
  gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
 }
`;

const seaFragment = /* glsl */`
 uniform float uTime; uniform vec3 uSky; uniform vec3 uHorizon; uniform vec3 uTint; uniform float uVisibility;
 varying vec3 vWorld; varying vec2 vSlope;
 vec2 fineSlope(vec2 p){
  float a=dot(p,vec2(4.8,1.5))-uTime*.72;
  float b=dot(p,vec2(-2.1,7.3))+uTime*.48;
  float c=dot(p,vec2(12.5,-3.7))-uTime*1.05;
  float d=dot(p,vec2(23.0,9.2))+uTime*1.45;
  return cos(a)*vec2(4.8,1.5)*.006
   + cos(b)*vec2(-2.1,7.3)*.004
   + cos(c)*vec2(12.5,-3.7)*.0018
   + cos(d)*vec2(23.0,9.2)*.0007;
 }
 float cloudReflection(vec2 p){
  return .52+.20*sin(dot(p,vec2(.31,.12)))+.14*sin(dot(p,vec2(.72,-.28)))+.07*sin(dot(p,vec2(1.8,.55)));
 }
 void main(){
  vec3 viewDir=normalize(cameraPosition-vWorld);
  float distanceToCamera=length(cameraPosition-vWorld);
  float detailFade=1.-smoothstep(35.,180.,distanceToCamera);
  vec2 slope=vSlope+fineSlope(vWorld.xz)*detailFade;
  vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
  if(!gl_FrontFacing)normal=-normal;
  float fresnel=.035+.72*pow(1.-max(dot(normal,viewDir),0.),5.);
  vec3 reflected=mix(uHorizon,uSky,clamp(reflect(-viewDir,normal).y*.5+.52,0.,1.));
  reflected*=.76+.30*cloudReflection(vWorld.xz)*detailFade;
  vec3 water=mix(vec3(.085,.11,.14),vec3(.18,.22,.26),uVisibility*.48);
  vec3 col=mix(water,reflected,fresnel);
  float haze=smoothstep(42.,260.,distanceToCamera);
  col=mix(col,uHorizon,haze*.66);
  col=mix(col,col*uTint,.11);
  col*=mix(.15,1.,clamp(uVisibility,0.,1.));
  gl_FragColor=vec4(col,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
`;

function seaGeometry(): THREE.BufferGeometry {
 const columns=96, rows=112, width=300, near=WINTER_EXTERIOR_PLATFORM.zFar, depth=360;
 const positions=new Float32Array((columns+1)*(rows+1)*3); let offset=0;
 for(let z=0;z<=rows;z++){
  const distance=depth*Math.pow(z/rows,1.72);
  for(let x=0;x<=columns;x++){
   const across=x/columns*2-1;
   positions[offset++]=Math.sign(across)*Math.pow(Math.abs(across),1.6)*width*.5;
   positions[offset++]=-.25;
   positions[offset++]=near-distance;
  }
 }
 const indices=new Uint32Array(columns*rows*6);let i=0;
 for(let z=0;z<rows;z++)for(let x=0;x<columns;x++){
  const a=z*(columns+1)+x,b=a+1,c=a+columns+1,d=c+1;
  indices[i++]=a;indices[i++]=b;indices[i++]=c;indices[i++]=b;indices[i++]=d;indices[i++]=c;
 }
 return new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(positions,3)).setIndex(new THREE.BufferAttribute(indices,1));
}

/** A closed, shallow snow volume: irregularity is art-directed, not snow simulation. */
function snowPlatformGeometry(): THREE.BufferGeometry {
 const columns=144,rows=36,count=(columns+1)*(rows+1),positions:number[]=[];
 const top=(x:number,z:number)=>WINTER_EXTERIOR_PLATFORM.topY+.009*Math.sin(x*4.1+z*6.7)+.005*Math.sin(x*12.3-z*3.9)+.002*Math.sin(x*38.0+z*27.0);
 for(let layer=0;layer<2;layer++)for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++){
  const tx=column/columns,tz=row/rows;
  const edgeX=(row===0||row===rows)?Math.sin(tx*19.0)*.012:0;
  const edgeZ=(column===0||column===columns)?Math.sin(tz*17.0)*.015:0;
  const x=WINTER_EXTERIOR_PLATFORM.xMin+(WINTER_EXTERIOR_PLATFORM.xMax-WINTER_EXTERIOR_PLATFORM.xMin)*tx+edgeX;
  const z=WINTER_EXTERIOR_PLATFORM.zNear+(WINTER_EXTERIOR_PLATFORM.zFar-WINTER_EXTERIOR_PLATFORM.zNear)*tz+edgeZ;
  positions.push(x,layer===0?top(x,z):WINTER_EXTERIOR_PLATFORM.bottomY,z);
 }
 const indices:number[]=[];const at=(layer:number,column:number,row:number)=>layer*count+row*(columns+1)+column;
 for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
  const a=at(0,column,row),b=at(0,column+1,row),c=at(0,column,row+1),d=at(0,column+1,row+1);
  indices.push(a,b,c,b,d,c);indices.push(a+count,c+count,b+count,b+count,c+count,d+count);
 }
 const side=(a:number,b:number)=>indices.push(a,b,b+count,a,b+count,a+count);
 for(let column=0;column<columns;column++){side(at(0,column,0),at(0,column+1,0));side(at(0,column+1,rows),at(0,column,rows));}
 for(let row=0;row<rows;row++){side(at(0,0,row+1),at(0,0,row));side(at(0,columns,row),at(0,columns,row+1));}
 const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)).setIndex(indices);
 geometry.computeVertexNormals();
 return geometry;
}

export function createWinterExterior(): WinterExterior {
 const group=new THREE.Group();group.name='snowwindow-winter-exterior';
 const skyUniforms={uSky:{value:new THREE.Color('#788994')},uHorizon:{value:new THREE.Color('#a2adb0')},uTint:{value:new THREE.Color('#d9e0df')},uVisibility:{value:1}};
 const skyMaterial=new THREE.ShaderMaterial({uniforms:skyUniforms,vertexShader:skyVertex,fragmentShader:skyFragment,side:THREE.BackSide,depthWrite:false});
 const sky=new THREE.Mesh(new THREE.SphereGeometry(440,36,20),skyMaterial);sky.name='snowwindow-overcast-sky-dome';sky.position.set(4.84,-.25,-7);group.add(sky);
 const seaUniforms={uTime:{value:0},uSky:skyUniforms.uSky,uHorizon:skyUniforms.uHorizon,uTint:skyUniforms.uTint,uVisibility:skyUniforms.uVisibility};
 const seaMaterial=new THREE.ShaderMaterial({uniforms:seaUniforms,vertexShader:seaVertex,fragmentShader:seaFragment,side:THREE.DoubleSide});
 const sea=new THREE.Mesh(seaGeometry(),seaMaterial);sea.name='snowwindow-calm-winter-sea';group.add(sea);
 const supportDepth=WINTER_EXTERIOR_PLATFORM.zNear-WINTER_EXTERIOR_PLATFORM.zFar;
 const support=new THREE.Mesh(new THREE.BoxGeometry(12,.12,supportDepth),new THREE.MeshStandardMaterial({color:'#9fa5a5',roughness:.94}));support.name='snowwindow-exterior-concrete-sill';support.position.set(4.84,.662,(WINTER_EXTERIOR_PLATFORM.zNear+WINTER_EXTERIOR_PLATFORM.zFar)*.5);group.add(support);
 const snowMaterial=new THREE.MeshStandardMaterial({color:'#f1f5f4',roughness:.92,metalness:0});
 snowMaterial.onBeforeCompile=shader=>{
  shader.uniforms.uSnowSky=skyUniforms.uVisibility;
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uSnowSky;\nfloat snowHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}').replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   // Local diffuse sky/snow multiple-scattering proxy, not emissive light.
   reflectedLight.indirectDiffuse+=diffuseColor.rgb*.55*uSnowSky;
  `).replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
   float snowGrainA=snowHash(floor(vViewPosition.xy*170.0))*2.-1.;
   float snowGrainB=snowHash(floor(vViewPosition.xy*210.0)+17.0)*2.-1.;
   normal=normalize(normal+vec3(snowGrainA*.045,snowGrainB*.045,0.));
   diffuseColor.rgb*=.92+.08*(.5+.5*snowGrainA);`);
 };
 snowMaterial.customProgramCacheKey=()=> 'snowwindow-frost-grain-v2';
 const snow=new THREE.Mesh(snowPlatformGeometry(),snowMaterial);snow.name='snowwindow-thin-snow-platform';snow.receiveShadow=true;group.add(snow);
 let disposed=false;
 return {group,update(elapsed,light){
  if(disposed)return;
  seaUniforms.uTime.value=Number.isFinite(elapsed)?elapsed:0;
  skyUniforms.uSky.value.copy(light.sky);skyUniforms.uHorizon.value.copy(light.horizon);skyUniforms.uTint.value.copy(light.tint);skyUniforms.uVisibility.value=THREE.MathUtils.clamp(light.visibility,0,1);
  snowMaterial.color.copy(light.tint).lerp(new THREE.Color('#f7faf8'),.78).multiplyScalar(.78+.22*skyUniforms.uVisibility.value);
 },dispose(){
  if(disposed)return;disposed=true;group.removeFromParent();sky.geometry.dispose();skyMaterial.dispose();sea.geometry.dispose();seaMaterial.dispose();snow.geometry.dispose();snowMaterial.dispose();support.geometry.dispose();support.material.dispose();
 }};
}
