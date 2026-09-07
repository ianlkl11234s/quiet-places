import * as THREE from 'three';
import {oceanWaveGLSL} from './OceanOptics.ts';

// Shared geometric window visibility for receivers and suspended dust.
export const oceanAirTransmissionGLSL=/* glsl */`
      float aperture(vec3 p,float penumbra){
        vec2 lo=vec2(-4.645,.755),hi=vec2(4.645,2.745);
        vec2 edge=min(p.xy-lo,hi-p.xy);
        return smoothstep(-penumbra,penumbra+.018,min(edge.x,edge.y));
      }
      float transmit(float ci,float n1,float n2){
        float ct=sqrt(max(0.,1.-pow(n1/n2,2.)*(1.-ci*ci)));
        float rs=(n1*ci-n2*ct)/(n1*ci+n2*ct);
        float rp=(n2*ci-n1*ct)/(n2*ci+n1*ct);
        return 1.-.5*(rs*rs+rp*rp);
      }

      float oceanAirTransmission(vec3 p){
        vec3 toSun=-uSun;float direct=0.;
        // Distance-growing penumbra approximation for a finite angular light source.
        float penumbra=max(.004,length(p-vec3(p.xy,-4.89))*.008);
        if(toSun.z<-.001){
          // Reverse-trace through the two parallel glass faces. The emerging air ray is parallel.
          vec3 frameFront=p+toSun*((-4.75-p.z)/toSun.z);
          vec3 inner=p+toSun*((-4.89-p.z)/toSun.z);
          vec3 glass=refract(toSun,vec3(0.,0.,1.),1./1.5);
          vec3 outer=inner+glass*((-5.11-inner.z)/glass.z);
          float dry=smoothstep(-penumbra,penumbra+.015,outer.y-uLevel-oceanHeight(outer.xz,uTime));
          for(int i=1;i<=8;i++){
            vec3 samplePoint=outer+toSun*(float(i)*.3);
            dry*=smoothstep(-penumbra,penumbra+.015,samplePoint.y-uLevel-oceanHeight(samplePoint.xz,uTime));
          }
          direct=aperture(frameFront,penumbra)*aperture(inner,penumbra)*aperture(outer,penumbra)*dry;
          direct*=transmit(-toSun.z,1.,1.5)*transmit(-glass.z,1.5,1.);
        }
        return direct;
      }
`;

/** Add transported irradiance before tone mapping, using the room's own albedo and bump normal. */
export function oceanLightMaterial(base:THREE.MeshStandardMaterial,texture:THREE.Texture,receiver:number,sun:{value:THREE.Vector3},time:{value:number},level:{value:number},strength:{value:number},tint:{value:THREE.Color}){
  const material=base.clone();
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{uPhotons:{value:texture},uReceiver:{value:receiver},uSun:sun,uTime:time,uLevel:level,uStrength:strength,uTint:tint});
    shader.vertexShader='varying vec3 vOceanWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvOceanWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=`
      uniform sampler2D uPhotons;uniform float uReceiver,uTime,uLevel,uStrength;uniform vec3 uSun,uTint;
      varying vec3 vOceanWorld;
      ${oceanWaveGLSL}
      ${oceanAirTransmissionGLSL}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      vec3 oceanNormal=inverseTransformDirection(normal,viewMatrix);
      vec3 receiverNormal=uReceiver<.5?vec3(0.,1.,0.):(uReceiver<1.5?vec3(1.,0.,0.):vec3(-1.,0.,0.));
      // Box receivers have other faces; only the inward-facing floor/wall receives this map.
      float inward=step(.9,dot(inverseTransformDirection(nonPerturbedNormal,viewMatrix),receiverNormal));
      vec2 oceanUV=uReceiver<.5?vec2((vOceanWorld.x+5.91)/11.82,(vOceanWorld.z+4.89)/18.89):vec2((vOceanWorld.z+4.89)/18.89,(vOceanWorld.y-.095)/6.815);
      vec3 transported=texture2D(uPhotons,clamp(oceanUV,0.,1.)).rgb;
      float direct=oceanAirTransmission(vOceanWorld)*max(dot(oceanNormal,-uSun),0.);
      reflectedLight.directDiffuse+=inward*material.diffuseColor/3.14159265*uTint*uStrength*(vec3(direct)+transported);
    `);
  };
  material.customProgramCacheKey=()=>`ocean-receiver-${receiver}`;
  return material;
}
