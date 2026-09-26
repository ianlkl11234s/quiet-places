import * as THREE from 'three';

/**
 * Clione tissue shading (B3, 2026-09-27). Real-time approximation only, same family as the
 * Aurelia J1 look but kept in its own file: fresnel edge alpha + forward (back-light) scattering
 * (Barré-Brisebois & Bouchard, GDC 2011 style), no emission, no transmission pass. Every added
 * term is multiplied by scene light, so a moonlit room cannot make the animal glow.
 *
 * Per-vertex attribute `aTissue` = (thin 0..1, u, v):
 *  body:    u = s along the trunk (0 neck → 1 tail), v = azimuth / 2π
 *  head:    u = 0 neck → 1 cone tip, v = azimuth / 2π
 *  wing:    u = span (0 root → 1 tip), v = chord (0 leading → 1 trailing)
 *  viscera: none (sphere); alpha falls toward the silhouette so the organ edge stays soft
 */
export type ClioneTissueKind='body'|'head'|'wing'|'viscera';
export interface ClioneTissueShading {
  kind:ClioneTissueKind;
  /** alpha where the surface faces the viewer; C-level art value */
  centerAlpha:number;
  /** alpha at grazing view (silhouette); lower than centre for viscera */
  edgeAlpha:number;
  fresnelPower:number;
  /** forward (back-light) scattering gain */
  scatter:number;
  scatterPower:number;
  distortion:number;
  /** pale orange-red tint toward the head tip (buccal region); head only */
  tintColor?:THREE.ColorRepresentation;
  tintAmount?:number;
  /** extra alpha on the thin wing margin; wing only */
  marginAlpha?:number;
}

const LIGHT_LOOP=/* glsl */`
float clioneLum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 clioneForward(vec3 P,vec3 N,vec3 V,float distortion,float power){
  vec3 forward=vec3(0.);
  #if NUM_RECT_AREA_LIGHTS > 0
  for(int i=0;i<NUM_RECT_AREA_LIGHTS;i++){
    vec3 c=rectAreaLights[i].position,hw=rectAreaLights[i].halfWidth,hh=rectAreaLights[i].halfHeight;
    float lw=max(length(hw),1e-4),lh=max(length(hh),1e-4);vec3 nw=hw/lw,nh=hh/lh,rel=P-c;
    vec3 q=c+nw*clamp(dot(rel,nw),-lw,lw)+nh*clamp(dot(rel,nh),-lh,lh);
    vec3 Lv=q-P;float d=max(length(Lv),1e-3);vec3 L=Lv/d;
    float area=4.*lw*lh;vec3 E=rectAreaLights[i].color*area/(area+3.14159*d*d);
    forward+=E*pow(saturate(dot(V,-normalize(L+N*distortion))),power);
  }
  #endif
  #if NUM_DIR_LIGHTS > 0
  for(int i=0;i<NUM_DIR_LIGHTS;i++){
    vec3 L=directionalLights[i].direction,E=directionalLights[i].color;
    forward+=E*pow(saturate(dot(V,-normalize(L+N*distortion))),power);
  }
  #endif
  #if NUM_HEMI_LIGHTS > 0
  for(int i=0;i<NUM_HEMI_LIGHTS;i++)forward+=.35*getHemisphereLightIrradiance(hemisphereLights[i],-N)/3.14159;
  #endif
  return forward;
}
`;

export function installClioneShading<T extends THREE.MeshStandardMaterial>(material:T,shading:ClioneTissueShading):T {
  const uniforms={
    uCenterAlpha:{value:shading.centerAlpha},uEdgeAlpha:{value:shading.edgeAlpha},uFresnelPower:{value:shading.fresnelPower},
    uScatter:{value:shading.scatter},uScatterPower:{value:shading.scatterPower},uDistortion:{value:shading.distortion},
    uTintColor:{value:new THREE.Color(shading.tintColor??'#c8654a')},uTintAmount:{value:shading.tintAmount??0},uMarginAlpha:{value:shading.marginAlpha??0},
  };
  material.userData.tissue={kind:shading.kind,uniforms};
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.defines={...(shader.defines??{}),[`CLIONE_${shading.kind.toUpperCase()}`]:''};
    const hasAttribute=shading.kind!=='viscera';
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>',`#include <common>\n${hasAttribute?'attribute vec3 aTissue;':''}\nvarying vec3 vTissue;`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>\nvTissue=${hasAttribute?'aTissue':'vec3(.5)'};`);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
varying vec3 vTissue;
uniform float uCenterAlpha,uEdgeAlpha,uFresnelPower,uScatter,uScatterPower,uDistortion,uTintAmount,uMarginAlpha;
uniform vec3 uTintColor;`)
      .replace('#include <lights_pars_begin>',`#include <lights_pars_begin>\n${LIGHT_LOOP}`)
      .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
{
  vec3 fwd=clioneForward(geometryPosition,geometryNormal,geometryViewDir,uDistortion,uScatterPower);
  float thin=vTissue.x;
  float fres=pow(1.-saturate(abs(dot(geometryNormal,geometryViewDir))),uFresnelPower);
  float alpha=mix(uCenterAlpha,uEdgeAlpha,fres);
  // Grazing paths through thin tissue are longer, so the silhouette scatters more than the view-facing centre.
  vec3 scattered=fwd*uScatter*mix(.6,1.,thin)*mix(.15,1.,fres);
  #if defined(CLIONE_BODY)
    // The anterior dome sits inside the clear head cone; fade it so the neck reads as one surface, not a double line.
    float neck=smoothstep(.02,.11,vTissue.y);alpha*=neck;scattered*=neck;
  #endif
  #if defined(CLIONE_HEAD)
    float tint=uTintAmount*smoothstep(.45,1.,vTissue.y);
    diffuseColor.rgb=mix(diffuseColor.rgb,uTintColor,tint);
    alpha+=.20*tint;
  #endif
  #if defined(CLIONE_WING)
    // Thin parapodial margin: the outline reads as a fine line while the blade stays clear.
    float span=vTissue.y,chord=vTissue.z;
    float margin=max(smoothstep(.86,1.,span),1.-smoothstep(.0,.16,min(chord,1.-chord)));
    alpha+=uMarginAlpha*margin*smoothstep(.04,.2,span);
  #endif
  #if defined(CLIONE_VISCERA)
    // Pigmented organ: back light passes through it tinted by the carotenoid colour (the multiply by
    // diffuseColor below), denser toward the centre and fading at the silhouette; no light of its own.
    scattered=fwd*uScatter*(1.-.7*fres);
  #endif
  reflectedLight.directDiffuse+=scattered*diffuseColor.rgb;
  #if defined(CLIONE_WING)
  float maxAlpha=.42,scatterAlpha=.35;
  #elif defined(CLIONE_VISCERA)
  // Stays semi-transparent however strong the back light: scattering tints it, never makes it opaque.
  float maxAlpha=.45,scatterAlpha=0.;
  #else
  float maxAlpha=.85,scatterAlpha=.35;
  #endif
  diffuseColor.a=clamp(alpha+clioneLum(scattered)*scatterAlpha,0.,maxAlpha)*opacity;
}`);
  };
  material.customProgramCacheKey=()=>`clione-tissue-${shading.kind}`;
  return material;
}
