import * as THREE from 'three';

// A small kinematic breeze, shared by the beauty, light-shadow and camera-depth passes.
const wind=/* glsl */`
 uniform float uAfterTime,uAfterRoot,uAfterHeight,uAfterScale;
 uniform mat4 uAfterInverse;
 vec3 afterWind(vec3 p){
  float h=clamp((p.y-uAfterRoot)/max(.05,uAfterHeight),0.,1.);
  float phase=dot(p.xz,vec2(1.3,2.1));
  return vec3(sin(uAfterTime*.67+phase)*.016, sin(uAfterTime*2.3+phase*3.)*.002,
   cos(uAfterTime*.49+phase)*.009)*h*h*uAfterScale;
 }
`;

export function installAfterlightFoliage(root:THREE.Object3D){
 const clock={value:0},day={value:1};
 const restores:Array<()=>void>=[];
 const bindings:Array<{mesh:THREE.Mesh,inverse:THREE.IUniform<THREE.Matrix4>}>=[];
 root.updateMatrixWorld(true);
 root.traverse(object=>{
  if(!(object instanceof THREE.Mesh)||! /^(Foliage|Leaf|Stem)/.test(object.name))return;
  const bounds=new THREE.Box3().setFromObject(object),inverse={value:object.matrixWorld.clone().invert()};
  const uniforms={uAfterTime:clock,uAfterRoot:{value:object.userData.windRootY??bounds.min.y},
   uAfterHeight:{value:object.userData.windHeight??Math.max(.1,bounds.max.y-bounds.min.y)},
   uAfterScale:{value:object.userData.windScale??1},uAfterInverse:inverse,uAfterDay:day};
  const inject=(material:THREE.Material,leaf=false)=>{
   material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\n${wind}`)
     .replace('#include <begin_vertex>',`#include <begin_vertex>
      vec3 afterWorld=(modelMatrix*vec4(transformed,1.)).xyz;
      transformed+=(uAfterInverse*vec4(afterWind(afterWorld),0.)).xyz;`);
    if(leaf)shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nuniform float uAfterDay;`)
     .replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
     .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      // Thin-leaf backlight approximation, limited to sun-facing leaf backs.
      vec3 afterN=inverseTransformDirection(normal,viewMatrix);
      float backLight=pow(max(dot(-afterN,normalize(vec3(-.28,1.,-.25))),0.),2.);
      reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.34,.42,.17)*(.035+.13*backLight*getShadowMask())*uAfterDay;
     `);
   };
   material.customProgramCacheKey=()=>`afterlight-wind-${leaf}`;
  };
  const original=object.material,originalDepth=object.customDepthMaterial;
  const originals=Array.isArray(original)?original:[original];
  const clones=originals.map(m=>{const clone=m.clone();inject(clone,!object.name.startsWith('Stem'));return clone;});
  const source=originals[0] as THREE.MeshStandardMaterial;
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:source.map,alphaMap:source.alphaMap,alphaTest:source.alphaTest,side:source.side});
  inject(depth);
  object.material=Array.isArray(original)?clones:clones[0];object.customDepthMaterial=depth;
  bindings.push({mesh:object,inverse});
  restores.push(()=>{object.material=original;object.customDepthMaterial=originalDepth;clones.forEach(m=>m.dispose());depth.dispose();});
 });
 return {
  update(elapsed:number,daylight:number){clock.value=elapsed;day.value=daylight;bindings.forEach(({mesh,inverse})=>inverse.value.copy(mesh.matrixWorld).invert());},
  dispose(){restores.splice(0).forEach(fn=>fn());},
 };
}
