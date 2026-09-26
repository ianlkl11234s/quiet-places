import * as THREE from 'three';

/**
 * Aurelia tissue shading (J1, 2026-09-27). Real-time approximation only:
 * fresnel edge + wrap/back-light forward scattering (Barré-Brisebois GDC 2011 style),
 * thickness from the bell radius, no emission. Every added term is multiplied by scene
 * light, so a dark (moonlit) room cannot make the animal glow.
 *
 * Per-vertex attribute `aTissue` = (thin 0..1, u, v):
 *  bell/subumbrella: u = normalised radius r, v = azimuth θ (radians)
 *  gonad/arm:        u = along 0..1,        v = across 0..1
 */
export type TissueKind='bell'|'subumbrella'|'gonad'|'arm';
export interface TissueShading {
  kind:TissueKind;
  /** alpha where the surface faces the viewer (bell centre); C-level art value */
  centerAlpha:number;
  /** alpha at grazing view (silhouette) */
  edgeAlpha:number;
  fresnelPower:number;
  /** forward (back-light) scattering gain */
  scatter:number;
  scatterPower:number;
  distortion:number;
  /** radial canal band tint and visibility under grazing light (subumbrella only) */
  canalColor?:THREE.ColorRepresentation;
  canalAlpha?:number;
}

const LIGHT_LOOP=/* glsl */`
float tissueLum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
void tissueLights(vec3 P,vec3 N,vec3 V,float distortion,float power,out vec3 forward,out float graze,out float total){
  forward=vec3(0.);graze=0.;total=0.;
  #if NUM_RECT_AREA_LIGHTS > 0
  for(int i=0;i<NUM_RECT_AREA_LIGHTS;i++){
    vec3 c=rectAreaLights[i].position,hw=rectAreaLights[i].halfWidth,hh=rectAreaLights[i].halfHeight;
    float lw=max(length(hw),1e-4),lh=max(length(hh),1e-4);vec3 nw=hw/lw,nh=hh/lh,rel=P-c;
    vec3 q=c+nw*clamp(dot(rel,nw),-lw,lw)+nh*clamp(dot(rel,nh),-lh,lh);
    vec3 Lv=q-P;float d=max(length(Lv),1e-3);vec3 L=Lv/d;
    float area=4.*lw*lh;vec3 E=rectAreaLights[i].color*area/(area+3.14159*d*d);
    forward+=E*pow(saturate(dot(V,-normalize(L+N*distortion))),power);
    float e=tissueLum(E);total+=e;graze+=e*(1.-abs(dot(N,L)));
  }
  #endif
  #if NUM_DIR_LIGHTS > 0
  for(int i=0;i<NUM_DIR_LIGHTS;i++){
    vec3 L=directionalLights[i].direction,E=directionalLights[i].color;
    forward+=E*pow(saturate(dot(V,-normalize(L+N*distortion))),power);
    float e=tissueLum(E);total+=e;graze+=e*(1.-abs(dot(N,L)));
  }
  #endif
  #if NUM_HEMI_LIGHTS > 0
  for(int i=0;i<NUM_HEMI_LIGHTS;i++){vec3 E=getHemisphereLightIrradiance(hemisphereLights[i],-N)/3.14159;forward+=.35*E;total+=tissueLum(E);}
  #endif
}
`;

const CANAL=/* glsl */`
float tissueAngle(float a){return atan(sin(a),cos(a));}
/** 16 radial canals: 8 branched (per-/interradial) fork twice toward the margin, 8 adradial straight; ring canal near r=.9. */
float canalMask(float r,float th){
  float mask=0.;
  for(int k=0;k<16;k++){
    float tk=6.2831853*float(k)/16.;
    float w=mix(.020,.006,r);           // band width in R units, decreasing with radius
    float d=abs(tissueAngle(th-tk))*r;
    if(k%2==0){
      float s1=.075*smoothstep(.46,.78,r),s2=.035*smoothstep(.70,.92,r);
      float a=min(abs(tissueAngle(th-tk-s1-s2)),abs(tissueAngle(th-tk-s1+s2)));
      float b=min(abs(tissueAngle(th-tk+s1-s2)),abs(tissueAngle(th-tk+s1+s2)));
      d=r<.46?d:min(a,b)*r;
      w*=r<.46?1.:.8;
    }
    mask=max(mask,1.-smoothstep(.45*w,w,d));
  }
  mask=max(mask,1.-smoothstep(.004,.010,abs(r-.90)));
  return mask*smoothstep(.10,.18,r)*(1.-smoothstep(.95,.99,r));
}
`;

export function installTissueShading(material:THREE.MeshStandardMaterial,shading:TissueShading){
  const uniforms={
    uCenterAlpha:{value:shading.centerAlpha},uEdgeAlpha:{value:shading.edgeAlpha},uFresnelPower:{value:shading.fresnelPower},
    uScatter:{value:shading.scatter},uScatterPower:{value:shading.scatterPower},uDistortion:{value:shading.distortion},
    uCanalColor:{value:new THREE.Color(shading.canalColor??'#b79cb2')},uCanalAlpha:{value:shading.canalAlpha??0},
  };
  material.userData.tissue={kind:shading.kind,uniforms};
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.defines={...(shader.defines??{}),[`TISSUE_${shading.kind.toUpperCase()}`]:''};
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute vec3 aTissue;\nvarying vec3 vTissue;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvTissue=aTissue;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
varying vec3 vTissue;
uniform float uCenterAlpha,uEdgeAlpha,uFresnelPower,uScatter,uScatterPower,uDistortion,uCanalAlpha;
uniform vec3 uCanalColor;`)
      .replace('#include <lights_pars_begin>',`#include <lights_pars_begin>\n${LIGHT_LOOP}\n${CANAL}`)
      .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
{
  vec3 fwd;float graze,total;
  tissueLights(geometryPosition,geometryNormal,geometryViewDir,uDistortion,uScatterPower,fwd,graze,total);
  float thin=vTissue.x;
  float fres=pow(1.-saturate(abs(dot(geometryNormal,geometryViewDir))),uFresnelPower);
  #if defined(TISSUE_BELL)
    // The thin marginal flap (ring canal, tentacle bulbs) reads denser than the clear centre even when seen face-on.
    fres=max(fres,.42*smoothstep(.76,.98,vTissue.y));
  #endif
  float alpha=mix(uCenterAlpha,uEdgeAlpha,fres);
  // Grazing paths through thin tissue are longer, so the silhouette scatters more than the view-facing centre.
  vec3 scattered=fwd*uScatter*mix(.30,1.,thin)*mix(.30,1.,fres);
  #if defined(TISSUE_SUBUMBRELLA)
    float grazing=total>1e-5?graze/total:0.;
    float canal=canalMask(vTissue.y,vTissue.z);
    float seen=canal*uCanalAlpha*(.05+.95*grazing*grazing);
    diffuseColor.rgb=mix(diffuseColor.rgb,uCanalColor,saturate(canal*1.2));
    alpha+=seen;
  #endif
  #if defined(TISSUE_GONAD)
    float across=vTissue.z,along=vTissue.y;
    float soft=smoothstep(0.,.32,across)*smoothstep(1.,.68,across)*smoothstep(0.,.12,along)*smoothstep(1.,.88,along);
    float fold=.62+.38*(.5+.5*sin(along*46.+sin(across*5.2+along*9.)*2.2));
    alpha*=soft*fold;scattered*=soft;
  #endif
  #if defined(TISSUE_ARM)
    float across=vTissue.z;
    float soft=smoothstep(0.,.18,across)*smoothstep(1.,.82,across);
    alpha*=mix(.55,1.,soft);
  #endif
  reflectedLight.directDiffuse+=scattered*diffuseColor.rgb;
  diffuseColor.a=clamp(alpha+tissueLum(scattered)*.35,0.,.92)*opacity;
}`);
  };
  material.customProgramCacheKey=()=>`aurelia-tissue-${shading.kind}`;
  return material;
}

/** Lit, distance-faded marginal tentacle lines (LineBasicMaterial is unlit and read as a white skirt). */
export function createTentacleMaterial(options:{color:THREE.ColorRepresentation;opacity:number;fadeNear:number;fadeFar:number}){
  const material=new THREE.ShaderMaterial({
    name:'aurelia-tentacle-lit',lights:true,transparent:true,depthWrite:false,
    uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.lights,{uColor:{value:new THREE.Color(options.color)},uOpacity:{value:options.opacity},uNear:{value:options.fadeNear},uFar:{value:options.fadeFar}}]),
    vertexShader:/* glsl */`
varying vec3 vViewPosition;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vViewPosition=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:/* glsl */`
#include <common>
#include <lights_pars_begin>
uniform vec3 uColor;uniform float uOpacity,uNear,uFar;
varying vec3 vViewPosition;
void main(){
  vec3 P=-vViewPosition,V=normalize(vViewPosition),E=vec3(0.);
  #if NUM_RECT_AREA_LIGHTS > 0
  for(int i=0;i<NUM_RECT_AREA_LIGHTS;i++){
    vec3 c=rectAreaLights[i].position,hw=rectAreaLights[i].halfWidth,hh=rectAreaLights[i].halfHeight;
    float lw=max(length(hw),1e-4),lh=max(length(hh),1e-4);vec3 nw=hw/lw,nh=hh/lh,rel=P-c;
    vec3 q=c+nw*clamp(dot(rel,nw),-lw,lw)+nh*clamp(dot(rel,nh),-lh,lh);
    vec3 Lv=q-P;float d=max(length(Lv),1e-3);vec3 L=Lv/d;float area=4.*lw*lh;
    E+=rectAreaLights[i].color*area/(area+3.14159*d*d)*(.25+.75*pow(saturate(dot(V,-L)),3.));
  }
  #endif
  #if NUM_DIR_LIGHTS > 0
  for(int i=0;i<NUM_DIR_LIGHTS;i++)E+=directionalLights[i].color*(.25+.75*pow(saturate(dot(V,-directionalLights[i].direction)),3.));
  #endif
  #if NUM_HEMI_LIGHTS > 0
  for(int i=0;i<NUM_HEMI_LIGHTS;i++)E+=.5*(hemisphereLights[i].skyColor+hemisphereLights[i].groundColor);
  #endif
  float fade=1.-smoothstep(uNear,uFar,vViewPosition.z);
  gl_FragColor=vec4(uColor*E*.55,uOpacity*fade);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  return material;
}
