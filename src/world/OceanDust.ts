import * as THREE from 'three';
import {oceanWaveGLSL} from './OceanOptics.ts';
import {oceanAirTransmissionGLSL} from './OceanLightMaterial.ts';

const ROOM_MIN=new THREE.Vector3(-5.91,.095,-4.89), ROOM_MAX=new THREE.Vector3(5.91,6.91,14);

function random(seed:number){
  let state=seed>>>0;
  return ()=>((state=(state*1664525+1013904223)>>>0)/4294967296);
}

/** Sparse single-scattering cue. The photon volume guides refracted paths; it is not GI. */
export function createOceanDust(group:THREE.Group,volume:THREE.Data3DTexture){
  const count=900,r=random(0x0cead123),positions=new Float32Array(count*3),phase=new Float32Array(count*3);
  for(let i=0;i<count;i++){
    const j=i*3;
    // Leave a small margin so drifting particles never cross opaque room surfaces.
    positions[j]=THREE.MathUtils.lerp(ROOM_MIN.x+.16,ROOM_MAX.x-.16,r());
    positions[j+1]=THREE.MathUtils.lerp(ROOM_MIN.y+.16,ROOM_MAX.y-.16,r());
    positions[j+2]=THREE.MathUtils.lerp(ROOM_MIN.z+.16,ROOM_MAX.z-.16,r());
    phase[j]=r()*Math.PI*2;phase[j+1]=r()*Math.PI*2;phase[j+2]=r()*Math.PI*2;
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('aPhase',new THREE.BufferAttribute(phase,3));
  geometry.setDrawRange(0,count);
  const uniforms={uVolume:{value:volume},uSun:{value:new THREE.Vector3()},uTime:{value:0},uLevel:{value:.3},uIntensity:{value:0},uBeam:{value:1}};
  const material=new THREE.ShaderMaterial({
    uniforms,transparent:true,depthTest:true,depthWrite:false,blending:THREE.NormalBlending,
    vertexShader:/* glsl */`
      uniform sampler3D uVolume;uniform vec3 uSun;uniform float uTime,uLevel;
      attribute vec3 aPhase;varying float vPath;
      ${oceanWaveGLSL}
      ${oceanAirTransmissionGLSL}
      void main(){
        vec3 drift=vec3(sin(uTime*.071+aPhase.x),sin(uTime*.053+aPhase.y),sin(uTime*.041+aPhase.z))*.11;
        vec3 world=(modelMatrix*vec4(position+drift,1.)).xyz;
        vec3 uvw=(world-vec3(-5.91,.095,-4.89))/vec3(11.82,6.815,18.89);
        float refracted=texture(uVolume,clamp(uvw,0.,1.)).r;
        // The volume is a fluence-like guide, while dry transmission covers the
        // un-refracted upper-window beam. Neither term represents full GI.
        float caustic=smoothstep(.002,.055,refracted);
        float direct=oceanAirTransmission(world);
        vPath=max(caustic,direct*.5);
        vec4 mv=viewMatrix*vec4(world,1.);
        gl_PointSize=clamp(1.65*220./max(.001,-mv.z),.75,2.0);
        gl_Position=projectionMatrix*mv;
      }
    `,
    fragmentShader:/* glsl */`
      uniform float uIntensity,uBeam;varying float vPath;
      void main(){
        float circle=1.-smoothstep(.18,.5,length(gl_PointCoord-.5));
        float alpha=circle*vPath*uIntensity*uBeam*.18;
        if(alpha<.002)discard;
        gl_FragColor=vec4(vec3(.70,.84,.86),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const points=new THREE.Points(geometry,material);points.name='ocean-light-path-dust';group.add(points);
  return {
    update(time:number,level:number,sunTravel:THREE.Vector3,intensity:number,beam:number,lowQuality:boolean){
      uniforms.uTime.value=time;uniforms.uLevel.value=level;uniforms.uSun.value.copy(sunTravel);
      uniforms.uIntensity.value=intensity;uniforms.uBeam.value=beam;
      geometry.setDrawRange(0,lowQuality?Math.ceil(count/2):count);
    },
    dispose(){group.remove(points);geometry.dispose();material.dispose();},
  };
}
