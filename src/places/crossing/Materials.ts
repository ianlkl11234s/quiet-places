import * as THREE from 'three';
import {SURFACE_STRENGTH,canvasTextures,deckTextures,doorTexture,paintTextures,wetDecalTexture,type Pbr} from './Textures.ts';

/**
 * Materials for the crossing deck. Surface detail comes from load-time textures (Textures.ts) on world-metric UVs; the only shader
 * addition is a noise-free height gradient (dirt at the wall foot and under the roof), so the fragment cost stays flat.
 */
function grime<T extends THREE.MeshStandardMaterial>(mat:T,key:string):T{
 mat.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vWY;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvWY=(modelMatrix*vec4(transformed,1.)).y;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vWY;')
   .replace('#include <color_fragment>','#include <color_fragment>\nfloat gr=clamp(smoothstep(.3,0.,vWY)*.75+smoothstep(2.02,2.26,vWY)*.45,0.,1.);diffuseColor.rgb*=mix(vec3(1.),vec3(.82,.79,.73),gr*'+(.5*SURFACE_STRENGTH).toFixed(3)+');');
 };
 mat.customProgramCacheKey=()=>`crossing-grime-${key}`;
 return mat;
}
const apply=(mat:THREE.MeshStandardMaterial,t:Pbr|null,normalScale:number)=>{
 if(!t)return mat;
 mat.map=t.map;mat.normalMap=t.normalMap;mat.normalScale.set(normalScale,normalScale);
 if(t.roughnessMap){mat.roughnessMap=t.roughnessMap;mat.roughness=1;}
 return mat;
};

export function createMaterials(){
 const paintTex=paintTextures(),deckTex=deckTextures(),canvasTex=canvasTextures(),door=doorTexture(),wet=wetDecalTexture();
 const std=(p:THREE.MeshStandardMaterialParameters)=>new THREE.MeshStandardMaterial(p);
 const paint=grime(apply(std({color:'#ebeeea',roughness:.7}),paintTex,.4),'paint');
 const roof=grime(apply(std({color:'#e6e9e4',roughness:.8,side:THREE.DoubleSide}),paintTex,.25),'roof');
 // Beams are 8-10 cm strips: the plate texture's rivet domes, bolts and seam grooves land on them as bright specks under a grazing lamp,
 // and its roughness map adds glints. Smooth white paint: albedo only, near-flat relief, constant roughness.
 const beam=grime(apply(std({color:'#ebeeea',roughness:.75}),paintTex&&{map:paintTex.map,normalMap:paintTex.normalMap},.08),'beam');
 const deck=apply(std({color:'#ffffff',roughness:.55}),deckTex,1.25);
 const canvas=apply(std({color:'#ffffff',roughness:.95,side:THREE.DoubleSide}),canvasTex,1.4);
 const pipe=grime(std({color:'#eceeea',roughness:.5,metalness:.05}),'pipe');
 const doorMat=std({color:'#ffffff',roughness:.5,map:door});
 const frameBlue=std({color:'#2f67b0',roughness:.55});
 const strap=std({color:'#141414',roughness:.65});
 const buckle=std({color:'#b9bbb9',roughness:.45,metalness:.55,envMapIntensity:.3});
 const darkMetal=std({color:'#2a2c2e',roughness:.6,metalness:.3});
 const rubber=std({color:'#1b1b1c',roughness:.92});
 const signMat=std({color:'#f2f2ee',roughness:.6});
 const redMat=std({color:'#c42b2b',roughness:.5});
 const lampBody=std({color:'#d6d9d4',roughness:.55,metalness:.1});
 const lens=std({color:'#e9efe9',roughness:.3,transparent:true,opacity:.3,depthWrite:false});
 const glass=std({color:'#233845',roughness:.12,metalness:.1});
 const orange=std({color:'#e0561c',roughness:.55});
 const bagPlastic=std({color:'#ff6a2a',roughness:.35});
 const wetMat=std({color:'#0b1f17',roughness:.06,transparent:true,opacity:.55,depthWrite:false,map:wet,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 return {paint,beam,roof,deck,canvas,pipe,doorMat,frameBlue,strap,buckle,darkMetal,rubber,signMat,redMat,lampBody,lens,glass,orange,bagPlastic,wetMat};
}
export type CrossingMaterials=ReturnType<typeof createMaterials>;

/** Frees every texture a material holds (materials themselves are disposed by the caller). */
export function disposeMaterialTextures(m:THREE.Material){
 const x=m as THREE.MeshStandardMaterial;
 for(const t of[x.map,x.normalMap,x.roughnessMap])t?.dispose();
}
