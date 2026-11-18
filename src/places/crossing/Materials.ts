import * as THREE from 'three';

/**
 * Restrained procedural surface variation for MeshStandardMaterial (no texture files): world-space value noise nudges
 * colour and roughness. paint: faint plate seams, dirt at the foot and under the roof, sparse rust specks near seams;
 * deck: worn lighter/rougher patches and low-roughness (never mirror) damp patches; canvas: faint roll-wrap bands.
 */
export type SurfaceKind='paint'|'deck'|'canvas';
const NOISE=`varying vec3 vWPos;
float hs(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float ns(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(hs(i),hs(i+vec3(1,0,0)),f.x),mix(hs(i+vec3(0,1,0)),hs(i+vec3(1,1,0)),f.x),f.y),mix(mix(hs(i+vec3(0,0,1)),hs(i+vec3(1,0,1)),f.x),mix(hs(i+vec3(0,1,1)),hs(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
const COLOR:Record<SurfaceKind,string>={
 paint:`float lf=ns(vWPos*1.7)*.5+ns(vWPos*6.)*.5;
  vec3 sq=abs(fract(vWPos/1.2+.5)-.5)*1.2;float seam=1.-smoothstep(0.,.012,min(min(sq.x,sq.y),sq.z));
  float near=1.-smoothstep(0.,.18,min(min(sq.x,sq.y),sq.z));
  float dirt=clamp(seam*.9+smoothstep(.28,0.,vWPos.y)*.6+smoothstep(2.0,2.25,vWPos.y)*.35+ns(vWPos*3.)*.18,0.,1.);
  float rust=step(.965,ns(vWPos*38.))*near*step(.4,ns(vWPos*2.3));
  diffuseColor.rgb*=.975+.05*lf;diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.82,.80,.76),dirt*.35);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.42,.22,.12),rust*.4);`,
 deck:`float lf=ns(vWPos*1.7)*.5+ns(vWPos*6.)*.5;
  float wear=smoothstep(.58,.78,ns(vWPos*vec3(1.5,0.,1.5))*.65+ns(vWPos*vec3(5.,0.,5.))*.35);
  float damp=smoothstep(.64,.74,ns(vWPos*vec3(.9,0.,.9)+7.));
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.20,.36,.29),wear*.55);diffuseColor.rgb*=1.-damp*.28;diffuseColor.rgb*=.96+.08*lf;`,
 canvas:`float lf=ns(vWPos*3.)*.5+ns(vWPos*14.)*.5;
  float wrap=sin(vWPos.y*260.+ns(vWPos*2.)*4.)*.5+.5;
  diffuseColor.rgb*=.95+.05*lf;diffuseColor.rgb*=.975+.045*wrap;`,
};
const ROUGH:Record<SurfaceKind,string>={
 paint:`roughnessFactor=clamp(roughnessFactor+(lf-.5)*.14+dirt*.16,.25,1.);`,
 deck:`roughnessFactor=clamp(roughnessFactor+wear*.4-damp*.28+(lf-.5)*.1,.2,.95);`,
 canvas:`roughnessFactor=clamp(roughnessFactor+(lf-.5)*.08,.7,1.);`,
};

export function patchSurface<T extends THREE.MeshStandardMaterial>(mat:T,kind:SurfaceKind):T{
 mat.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWPos;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvWPos=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+NOISE)
   .replace('#include <color_fragment>','#include <color_fragment>\n'+COLOR[kind])
   .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n'+ROUGH[kind]);
 };
 mat.customProgramCacheKey=()=>`crossing-${kind}`;
 return mat;
}
