import * as THREE from 'three';
import {seededRandom} from '../../shared/math/seededRandom.ts';

export function createOakMaterial(){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
 const context=canvas.getContext('2d')!;context.fillStyle='#d0c2ac';context.fillRect(0,0,512,512);
 const random=seededRandom(8451);
 for(let board=0;board<4;board++){
  const left=board*128;context.fillStyle=board%2?'rgba(255,244,218,.045)':'rgba(75,48,28,.025)';context.fillRect(left,0,128,512);
  context.fillStyle='rgba(67,46,30,.24)';context.fillRect(left,0,1.2,512);
  for(let line=0;line<34;line++){
   context.beginPath();context.strokeStyle=`rgba(${55+Math.floor(random()*35)},${40+Math.floor(random()*24)},${27+Math.floor(random()*18)},${.035+random()*.075})`;context.lineWidth=.4+random()*1.2;
   const x=left+4+random()*120;context.moveTo(x,0);
   for(let y=0;y<=512;y+=16)context.lineTo(x+Math.sin(y*.018+random()*2)*(.8+random()*2.6),y);
   context.stroke();
  }
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(12,1);
 const bump=texture.clone();bump.colorSpace=THREE.NoColorSpace;bump.needsUpdate=true;
 const material=new THREE.MeshStandardMaterial({map:texture,bumpMap:bump,bumpScale:.002,color:'#ffffff',roughness:.88,metalness:0});
 material.name='light-matte-oak';
 return {material,dispose(){texture.dispose();bump.dispose();material.dispose();}};
}

export function createPlasterMaterial(){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
 const context=canvas.getContext('2d')!;context.fillStyle='#d2d0ca';context.fillRect(0,0,256,256);
 const random=seededRandom(442);
 for(let i=0;i<5200;i++){
  const value=95+Math.floor(random()*95),alpha=.018+random()*.035;
  context.fillStyle=`rgba(${value},${value},${value-4},${alpha})`;
  const radius=.25+random()*1.1;context.fillRect(random()*256,random()*256,radius,radius);
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(4,4);
 const bump=texture.clone();bump.colorSpace=THREE.NoColorSpace;bump.needsUpdate=true;
 const material=new THREE.MeshStandardMaterial({map:texture,bumpMap:bump,bumpScale:.0015,color:'#c2c1bc',roughness:.96,metalness:0});material.name='snowwindow-fine-mineral-plaster';
 return {material,dispose(){texture.dispose();bump.dispose();material.dispose();}};
}

/** Seeded surface relief in metres; condensation is an optical approximation,
 * not a temperature/humidity simulation. The view behind it remains live 3D. */
export function createWinterGlassMaterial(){
 const width=2048,height=1024,spanX=11.94,spanY=3.74;
 const relief=new Float32Array(width*height),random=seededRandom(20260910);
 for(let drop=0;drop<5200;drop++){
  const u=Math.pow(random(),1.85),v=random();
  if(random()>.22+.65*Math.exp(-u*9)+.30*Math.exp(-v*14))continue;
  const radius=.003+Math.pow(random(),2)*.018;
  const rx=Math.max(1.2,radius/spanX*width),ry=Math.max(1.4,radius*(1.1+random()*.6)/spanY*height);
  const cx=u*width,cy=v*height;
  for(let y=Math.max(0,Math.floor(cy-ry));y<Math.min(height,cy+ry);y++){
   for(let x=Math.max(0,Math.floor(cx-rx));x<Math.min(width,cx+rx);x++){
    const r2=((x-cx)/rx)**2+((y-cy)/ry)**2;
    if(r2<1)relief[y*width+x]=Math.max(relief[y*width+x],radius*.55*Math.pow(1-r2,.6));
   }
  }
 }
 const normal=new Uint8Array(width*height*4),surface=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x,k=i*4;
  const nx=-(relief[y*width+Math.min(width-1,x+1)]-relief[y*width+Math.max(0,x-1)])/(2*spanX/width);
  const ny=-(relief[Math.min(height-1,y+1)*width+x]-relief[Math.max(0,y-1)*width+x])/(2*spanY/height);
  const length=Math.hypot(nx,ny,1);
  normal[k]=Math.round((nx/length*.5+.5)*255);normal[k+1]=Math.round((ny/length*.5+.5)*255);normal[k+2]=Math.round((1/length*.5+.5)*255);normal[k+3]=255;
  const edge=Math.max(Math.exp(-y/height*85),Math.exp(-x/width*180)*.5);
  const grain=random();
  const frost=THREE.MathUtils.clamp(edge*(.18+.82*grain)+Math.max(0,edge-.35)*.5,0,1);
  surface[k]=255;surface[k+1]=Math.round(255*(.035+.83*frost));surface[k+2]=255;surface[k+3]=255;
 }
 const normalMap=new THREE.DataTexture(normal,width,height),roughnessMap=new THREE.DataTexture(surface,width,height);
 for(const texture of [normalMap,roughnessMap]){texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;}
 const faces=typeof document==='undefined'?[]:Array.from({length:6},(_,face)=>{
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d')!;
  const gradient=ctx.createLinearGradient(0,0,0,128);
  gradient.addColorStop(0,face===3?'#76818a':'#d9e2e7');gradient.addColorStop(.5,'#b7c4cd');gradient.addColorStop(1,'#657581');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);return canvas;
 });
 const envMap=faces.length?new THREE.CubeTexture(faces):null;if(envMap){envMap.colorSpace=THREE.SRGBColorSpace;envMap.needsUpdate=true;}
 const material=new THREE.MeshPhysicalMaterial({color:'#f5f8fa',metalness:0,roughness:1,roughnessMap,normalMap,normalScale:new THREE.Vector2(1.6,1.6),envMap,envMapIntensity:.65,specularIntensity:.2,transmission:1,ior:1.33,thickness:.028,depthWrite:false,side:THREE.FrontSide});
 material.name='winter-glass-condensation-and-edge-frost';
 return material;
}

// Q2-A8 (candidate, awaiting user confirmation). Each switch set to 0 restores
// the accepted sill snow exactly (no shader change is injected).
/** Sparse specular glints: sky reflected by tilted ice facets. Specular only, never emissive. */
export const SILL_SNOW_SPARKLE=1;
/** Rounded shading over the last few centimetres of the platform's exposed rims. */
export const SILL_SNOW_SOFT_EDGE=1;

export interface SnowPlatformBounds {xMin:number;xMax:number;zNear:number;zFar:number}

/**
 * Adds glints and a soft rim to the exterior sill snow. `visibility` is the
 * shared daylight uniform (moonlight ≈ .25, so glints vanish at night).
 * Rims and facets use platform-local coordinates: the room root slides in x
 * with the viewer's yaw, so world x is not the platform's x.
 * Art approximation, not a snow-crystal BRDF.
 */
export function refineSillSnow(material:THREE.MeshStandardMaterial,visibility:{value:number},bounds:SnowPlatformBounds){
 if(!SILL_SNOW_SPARKLE&&!SILL_SNOW_SOFT_EDGE)return;
 const base=material.onBeforeCompile.bind(material),baseKey=material.customProgramCacheKey();
 const edge={value:new THREE.Vector4(bounds.xMin,bounds.xMax,bounds.zFar,bounds.zNear)};
 material.onBeforeCompile=(shader,renderer)=>{
  base(shader,renderer);
  Object.assign(shader.uniforms,{uSparkleSky:visibility,uSnowEdge:edge,uSparkle:{value:SILL_SNOW_SPARKLE},uSoftEdge:{value:SILL_SNOW_SOFT_EDGE}});
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSnowWorld,vSnowLocal;')
   .replace('#include <project_vertex>','#include <project_vertex>\nvSnowWorld=(modelMatrix*vec4(transformed,1.)).xyz;vSnowLocal=transformed;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vSnowWorld,vSnowLocal;uniform float uSparkleSky,uSparkle,uSoftEdge;uniform vec4 uSnowEdge;
   float sillHash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*15731.743);}`)
   .replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
   vec3 snowWorldNormal=inverseTransformDirection(normal,viewMatrix);
   {
    // Soft rim: over 10–18 cm the top normal rolls toward the open edge (sea side
    // and both ends). The sill snow is lit by a flat sky proxy, so the rolled
    // normal is also used for its sky view (½+½·n.y); the lip then shades off
    // instead of cutting as a ruled line. Exposed side faces get the same sky term.
    float wobble=.5+.5*sin(vSnowLocal.x*23.)*sin(vSnowLocal.x*7.3+1.7);
    float width=.10+.08*wobble;
    float farRim=1.-smoothstep(0.,width,vSnowLocal.z-uSnowEdge.z);
    float leftRim=1.-smoothstep(0.,width,vSnowLocal.x-uSnowEdge.x);
    float rightRim=1.-smoothstep(0.,width,uSnowEdge.y-vSnowLocal.x);
    vec3 outward=vec3(rightRim-leftRim,0.,-farRim);
    float top=step(.5,snowWorldNormal.y);
    float rim=uSoftEdge*max(farRim,max(leftRim,rightRim))*top;
    if(rim>0.){
     snowWorldNormal=normalize(mix(snowWorldNormal,normalize(outward+vec3(0.,.35,0.)),rim*.75));
     normal=normalize((viewMatrix*vec4(snowWorldNormal,0.)).xyz);
    }
    float skyView=.5+.5*clamp(snowWorldNormal.y,-1.,1.);
    diffuseColor.rgb*=mix(1.,skyView,uSoftEdge*max(rim,1.-top));
   }`)
   .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   if(uSparkle>0.){
    // ~1 cm cells; ~12% carry a flat ice facet tilted up to ~30°.
    vec2 cell=floor(vSnowLocal.xz*100.);
    vec2 local=fract(vSnowLocal.xz*100.)-.5;
    float seed=sillHash(cell);
    float present=step(.88,seed)*step(.5,snowWorldNormal.y)*(1.-smoothstep(.30,.42,length(local)));
    vec2 tilt=vec2(sillHash(cell+3.1),sillHash(cell+7.7))*2.-1.;
    vec3 facet=normalize(vec3(tilt.x*.55,1.,tilt.y*.55));
    // Brightest overcast sky sits above the sea beyond the sill.
    vec3 skyDir=normalize(vec3(0.,.8,-.6));
    vec3 toEye=normalize(cameraPosition-vSnowWorld);
    float glint=pow(max(dot(facet,normalize(skyDir+toEye)),0.),40.);
    float lit=smoothstep(.30,.90,uSparkleSky);
    reflectedLight.directSpecular+=diffuseColor.rgb*(.90*uSparkle*present*glint*lit);
   }`);
 };
 material.customProgramCacheKey=()=>`${baseKey}|sill-snow-a8-${SILL_SNOW_SPARKLE}${SILL_SNOW_SOFT_EDGE}`;
}
