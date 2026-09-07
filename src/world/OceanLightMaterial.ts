import * as THREE from 'three';
import {oceanWaveGLSL} from './OceanOptics.ts';

// Shared geometric window visibility for receivers and suspended dust.
export const oceanAirTransmissionGLSL=/* glsl */`
      float aperture(vec3 p){
        vec2 lo=vec2(-4.645,.755),hi=vec2(4.645,2.745);
        vec2 edge=min(p.xy-lo,hi-p.xy);
        return smoothstep(0.,.018,min(edge.x,edge.y));
      }
      float transmit(float ci,float n1,float n2){
        float ct=sqrt(max(0.,1.-pow(n1/n2,2.)*(1.-ci*ci)));
        float rs=(n1*ci-n2*ct)/(n1*ci+n2*ct);
        float rp=(n2*ci-n1*ct)/(n2*ci+n1*ct);
        return 1.-.5*(rs*rs+rp*rp);
      }

      float oceanAirTransmission(vec3 p){
        vec3 toSun=-uSun;float direct=0.;
        if(toSun.z<-.001){
          // Reverse-trace through the two parallel glass faces. The emerging air ray is parallel.
          vec3 frameFront=p+toSun*((-4.75-p.z)/toSun.z);
          vec3 inner=p+toSun*((-4.89-p.z)/toSun.z);
          vec3 glass=refract(toSun,vec3(0.,0.,1.),1./1.5);
          vec3 outer=inner+glass*((-5.11-inner.z)/glass.z);
          float dry=smoothstep(0.,.015,outer.y-uLevel-oceanHeight(outer.xz,uTime));
          for(int i=1;i<=8;i++){
            vec3 samplePoint=outer+toSun*(float(i)*.3);
            dry*=smoothstep(0.,.015,samplePoint.y-uLevel-oceanHeight(samplePoint.xz,uTime));
          }
          direct=aperture(frameFront)*aperture(inner)*aperture(outer)*dry;
          direct*=transmit(-toSun.z,1.,1.5)*transmit(-glass.z,1.5,1.);
        }
        return direct;
      }
`;

export function oceanLightMaterial(texture:THREE.Texture,receiver:number,sun:{value:THREE.Vector3},time:{value:number},level:{value:number},strength:{value:number},tint:{value:THREE.Color}){
  return new THREE.ShaderMaterial({
    uniforms:{uPhotons:{value:texture},uReceiver:{value:receiver},uSun:sun,uTime:time,uLevel:level,uStrength:strength,uTint:tint,uAlbedo:{value:new THREE.Color(receiver===0?'#434744':'#625e54')}},
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
    fragmentShader:/* glsl */`
      uniform sampler2D uPhotons;uniform float uReceiver,uTime,uLevel,uStrength;uniform vec3 uSun,uTint,uAlbedo;
      varying vec3 vWorld;
      ${oceanWaveGLSL}
      ${oceanAirTransmissionGLSL}
      void main(){
        vec3 toSun=-uSun;
        vec3 normal=uReceiver<.5?vec3(0.,1.,0.):(uReceiver<1.5?vec3(1.,0.,0.):vec3(-1.,0.,0.));
        vec2 uv=uReceiver<.5?vec2((vWorld.x+5.91)/11.82,(vWorld.z+4.89)/18.89):vec2((vWorld.z+4.89)/18.89,(vWorld.y-.095)/6.815);
        vec3 indirect=texture2D(uPhotons,uv).rgb;
        float direct=0.;
        direct=oceanAirTransmission(vWorld)*max(dot(normal,toSun),0.);
        gl_FragColor=vec4(uAlbedo/3.14159265*uTint*uStrength*(vec3(direct)+indirect),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
