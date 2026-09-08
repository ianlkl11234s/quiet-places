import * as THREE from 'three';
import {sampleAfterlightDay} from './DayCycle.ts';

// Metres. A few water-rounded fragments caught along the root seam.
const pieces=[
 [1.646,.003,-.42,.013,.7],[1.677,.001,-.48,.008,.42],
 [1.61,.003,-.33,.010,1],[1.657,.002,-.23,.009,.58],
 [1.63,.001,-.58,.015,.3],[1.68,.002,-.37,.007,.8],
];
export function seaGlassGlow(hour:number){
 const h=((hour%24)+24)%24,day=sampleAfterlightDay(h).daylight;
 const dark=1-day,nightAge=h<8?h+6:Math.max(0,h-18);
 return dark*dark*(.55+.45*Math.exp(-nightAge/12));
}
export function installSeaGlass(root:THREE.Object3D,surfaces:Set<THREE.MeshStandardMaterial>,environment?:THREE.Texture){
 const group=new THREE.Group();group.name='Afterlight_SeaGlass';root.add(group);
 const glow={value:0},wet={value:0};
 const meshes=pieces.map(([x,y,z,r,variation],i)=>{
  const geometry=new THREE.IcosahedronGeometry(r,2),a=geometry.getAttribute('position');
  for(let v=0;v<a.count;v++){
   const px=a.getX(v),py=a.getY(v),pz=a.getZ(v);
   const wobble=1+.07*Math.sin(px/r*4+py/r*3+pz/r*2+i);
   a.setXYZ(v,px*wobble,py*wobble*.48,pz*wobble*(.72+i*.07));
  }
  geometry.computeVertexNormals();
  // Milky scattering approximation; no transmission render target or light rig.
  const material=new THREE.MeshStandardMaterial({color:new THREE.Color(.26+i*.018,.34+i*.013,.33+i*.014),roughness:.38+i*.035,metalness:0,transparent:true,opacity:.86+i*.022,depthWrite:false,envMap:environment,envMapIntensity:.3,emissive:new THREE.Color(.35,.53,.50),emissiveIntensity:0});
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.rotation.y=i*2.39;mesh.receiveShadow=true;mesh.castShadow=false;group.add(mesh);
  return {mesh,variation};
 });
 const plantMaterials=new Set<THREE.MeshStandardMaterial>();
 root.getObjectByName('Afterlight_LivingPlants')?.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial)plantMaterials.add(m);});
 const restore:Array<()=>void>=[];
 for(const material of new Set([...surfaces,...plantMaterials])){
  const previous=material.onBeforeCompile,cache=material.customProgramCacheKey;
  const plant=plantMaterials.has(material);
  material.onBeforeCompile=(shader,renderer)=>{
   previous.call(material,shader,renderer);shader.uniforms.uGlassGlow=glow;shader.uniforms.uGlassWet=wet;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGlassWorld;').replace('#include <project_vertex>','#include <project_vertex>\nvGlassWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vGlassWorld;uniform float uGlassGlow,uGlassWet;');
   if(!plant){
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
     float film=(1.-smoothstep(.02,.13,distance(vGlassWorld,vec3(1.64,0.,-.38))))*(1.-smoothstep(.015,.045,abs(vGlassWorld.y)));
     roughnessFactor=mix(roughnessFactor,min(roughnessFactor,.28),film*(.35+.35*uGlassWet));
    `).replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
     float seamShade=mix(.2,1.,smoothstep(.055,.23,distance(vGlassWorld,vec3(1.69,0.,-.38))));
     reflectedLight.directDiffuse*=seamShade;reflectedLight.directSpecular*=seamShade;
    `);
   }
   if(plant)shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
    float edgeLight=mix(.025,.22,smoothstep(.25,1.55,vGlassWorld.y));
    reflectedLight.directDiffuse*=edgeLight;reflectedLight.directSpecular*=edgeLight;
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
    float glassBounce=0.;
    ${pieces.map(([x,y,z,,v])=>`glassBounce+=${v.toFixed(3)}*pow(max(0.,1.-distance(vGlassWorld,vec3(${x},${y},${z}))/.115),3.);`).join('\n')}
    outgoingLight+=vec3(.35,.53,.50)*glassBounce*uGlassGlow*.008;
    #include <opaque_fragment>`);
  };
  const oldKey=cache.call(material);material.customProgramCacheKey=()=>oldKey+'-sea-glass-'+plant;material.needsUpdate=true;
  restore.push(()=>{material.onBeforeCompile=previous;material.customProgramCacheKey=cache;material.needsUpdate=true;});
 }
 return {group,update(hour:number,rain:number){
  glow.value=seaGlassGlow(hour);wet.value=Math.min(1,Math.max(0,rain));
  meshes.forEach(({mesh,variation},i)=>{mesh.material.emissiveIntensity=.12*glow.value*variation;mesh.material.roughness=.38+i*.035-Math.min(1,Math.max(0,rain))*.1;});
 },dispose(){restore.forEach(fn=>fn());group.removeFromParent();meshes.forEach(({mesh})=>{mesh.geometry.dispose();mesh.material.dispose();});}};
}
