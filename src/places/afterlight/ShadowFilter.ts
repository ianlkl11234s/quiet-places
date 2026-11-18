import * as THREE from 'three';
import {corridor,drainOpening as aperture} from './DrainOpening.ts';

// Small blocker search: receiver/blocker separation controls the penumbra.
// This is a bounded shadow-map approximation, not an area-light path tracer.
// The skip variant returns early where lights_fragment_end's drain mask (throughDrain)
// zeroes all direct light anyway, so the 17-tap filter there never reaches the image.
// Same test as throughDrain with a 1 cm margin. Only the baked room surfaces use it:
// other receivers read the shadow outside the mask (leaf getShadowMask(), physical
// clearcoat/sheen terms that the mask does not scale).
const drainSkip=`
  vec3 openingTest=vOpeningWorld-uOpeningSun*((vOpeningWorld.y-3.)/uOpeningSun.y);
  if(openingTest.x<${corridor.centerX.toFixed(3)})openingTest.x=${(2*corridor.centerX).toFixed(3)}-openingTest.x;
  if(openingTest.x<${(aperture.minX-.01).toFixed(3)}||openingTest.x>${(aperture.maxX+.01).toFixed(3)}||openingTest.z<${(aperture.minZ-.01).toFixed(3)}||openingTest.z>${(aperture.maxZ+.01).toFixed(3)})return 1.;`;
const contactShadowChunk=(skip:boolean)=>THREE.ShaderChunk.shadowmap_pars_fragment.replace(
 'if ( frustumTest ) {',`if ( frustumTest ) {${skip?drainSkip:''}
  float blockers=0.,blockerDepth=0.;
  for(int i=0;i<8;i++){
   float a=float(i)*.785398;
   float z=unpackRGBAToDepth(texture2D(shadowMap,shadowCoord.xy+vec2(cos(a),sin(a))*3./shadowMapSize));
   if(z<shadowCoord.z-.00015){blockerDepth+=z;blockers+=1.;}
  }
  float gap=blockers>0.?(shadowCoord.z-blockerDepth/blockers)*29.9:0.;
  float radius=clamp(.55+gap*1.25,.55,2.8);
  float filtered=texture2DCompare(shadowMap,shadowCoord.xy,shadowCoord.z);
  for(int i=0;i<8;i++){
   float a=float(i)*.785398;
   filtered+=texture2DCompare(shadowMap,shadowCoord.xy+vec2(cos(a),sin(a))*radius/shadowMapSize,shadowCoord.z);
  }
  return mix(1.,filtered/9.,shadowIntensity);
 `);

export function installContactShadows(root:THREE.Object3D){
 const sun={value:new THREE.Vector3(.28,-1,.25).normalize()};
 const materials=new Set<THREE.Material>(),roomMaterials=new Set<THREE.Material>();
 root.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial){materials.add(m);if(o.name.startsWith('RoomSurface'))roomMaterials.add(m);}});
 const restore:Array<()=>void>=[];
 for(const material of materials){
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
  material.onBeforeCompile=(shader,renderer)=>{
   compile.call(material,shader,renderer);shader.uniforms.uOpeningSun=sun;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vOpeningWorld;').replace('#include <project_vertex>','#include <project_vertex>\nvOpeningWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   const skip=roomMaterials.has(material)&&!(material instanceof THREE.MeshPhysicalMaterial)&&!shader.fragmentShader.includes('getShadowMask(');
   shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',contactShadowChunk(skip))
    .replace('#include <common>','#include <common>\nvarying vec3 vOpeningWorld;uniform vec3 uOpeningSun;')
    .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      // Restrained aperture-space daylight transmission, shared by all receivers.
      // An authored exterior environment mask; no new offscreen props.
      vec3 opening=vOpeningWorld-uOpeningSun*((vOpeningWorld.y-3.)/uOpeningSun.y);
      if(opening.x<${corridor.centerX.toFixed(3)})opening.x=${(2*corridor.centerX).toFixed(3)}-opening.x;
      float throughDrain=step(${aperture.minX.toFixed(3)},opening.x)*step(opening.x,${aperture.maxX.toFixed(3)})*
       step(${aperture.minZ.toFixed(3)},opening.z)*step(opening.z,${aperture.maxZ.toFixed(3)});
      float outdoor=throughDrain*(.975+.025*sin(opening.x*13.+sin(opening.z*8.))*sin(opening.z*17.+.8));
      reflectedLight.directDiffuse*=outdoor;reflectedLight.directSpecular*=outdoor;
    `);
  };
  const oldKey=key.call(material);material.customProgramCacheKey=()=>oldKey+(roomMaterials.has(material)?'-contact-shadow-v1-drain-skip':'-contact-shadow-v1');material.needsUpdate=true;
  restore.push(()=>{material.onBeforeCompile=compile;material.customProgramCacheKey=key;material.needsUpdate=true;});
 }
 return {update(incoming:THREE.Vector3){sun.value.copy(incoming);},dispose(){restore.splice(0).forEach(fn=>fn());}};
}
