import * as THREE from 'three';

/** Sky/ground radiance only: no sun disc, no direct lighting baked into the environment. */
export function createArcadeEnvironment(){
 const width=256,height=128,pixels=new Float32Array(width*height*4);
 const zenith=new THREE.Color('#83afd1'),horizon=new THREE.Color('#d8e0df'),ground=new THREE.Color('#99866b');
 const color=new THREE.Color();
 for(let y=0;y<height;y++){
  const altitude=-Math.cos(Math.PI*y/(height-1));
  if(altitude>=0)color.copy(horizon).lerp(zenith,Math.pow(altitude,.42));
  else color.copy(horizon).lerp(ground,Math.pow(-altitude,.23));
  for(let x=0;x<width;x++){
   const i=(y*width+x)*4;pixels[i]=color.r;pixels[i+1]=color.g;pixels[i+2]=color.b;pixels[i+3]=1;
  }
 }
 const texture=new THREE.DataTexture(pixels,width,height,THREE.RGBAFormat,THREE.FloatType);
 texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.LinearSRGBColorSpace;
 texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;texture.name='arcade-open-sky-ground-radiance';
 return texture;
}

/** Static architectural visibility modulates ambient light only; direct shadows remain live. */
export function installArcadeAmbient(root:THREE.Object3D){
 const modified=new Set<THREE.Material>();
 root.traverse(object=>{
  if(!(object instanceof THREE.Mesh)||object.userData.arcade_role!=='architecture')return;
  const ao=object.geometry.getAttribute('_arcade_ao'),sky=object.geometry.getAttribute('_arcade_sky');
  if(!ao||!sky)return; // Supports an explicit material-only comparison using the earlier GLB.
  object.geometry.setAttribute('arcadeContact',ao);object.geometry.setAttribute('arcadeSky',sky);
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(modified.has(material))continue;modified.add(material);
   const previous=material.onBeforeCompile;
   material.onBeforeCompile=(shader:Parameters<THREE.Material['onBeforeCompile']>[0],renderer:THREE.WebGLRenderer)=>{
    previous.call(material,shader,renderer);
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
attribute float arcadeContact;
attribute float arcadeSky;
varying vec2 arcadeAmbient;`).replace('#include <begin_vertex>',`#include <begin_vertex>
arcadeAmbient=vec2(arcadeContact,arcadeSky);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 arcadeAmbient;')
     .replace('#include <aomap_fragment>',`#include <aomap_fragment>
float arcadeOcclusion=mix(.48,1.,clamp(arcadeAmbient.x,0.,1.));
float arcadeSkyAccess=mix(.48,1.,clamp(arcadeAmbient.y,0.,1.));
reflectedLight.indirectDiffuse*=arcadeOcclusion*arcadeSkyAccess;
reflectedLight.indirectSpecular*=mix(.65,1.,clamp(arcadeAmbient.x,0.,1.));`);
   };
   material.customProgramCacheKey=()=> 'last-arcade-ambient-visibility-v1';material.needsUpdate=true;
  }
 });
}
