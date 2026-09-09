import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {EXRLoader} from 'three/addons/loaders/EXRLoader.js';
import type {PlaceInstance} from '../../player/contracts.ts';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';
import {installAfterlightFoliage} from './Foliage.ts';
import {createAfterlightWeather} from './Weather.ts';
import {createAfterlightLighting,type AfterlightLightStudy} from './Lighting.ts';
import {installSurfaceMaterials} from './SurfaceMaterials.ts';
import {installContactShadows} from './ShadowFilter.ts';
import {prepareMedaka} from './Medaka.ts';
import studyDefaults from '../../../assets/config/afterlight-study.json';
import {validateStudy} from '../../shared/production/StudyPreset.ts';
import {createMedakaRoute,prepareMedaka as prepareRouteMedaka,type SharedMedaka} from '../../shared/biology/medaka/index.ts';

export async function prepareAfterlight(options?:{lightStudy?:AfterlightLightStudy;ignoreStudyDefaults?:boolean}){
 const study=options?.ignoreStudyDefaults?undefined:validateStudy(studyDefaults);
 const defaultLight:AfterlightLightStudy={intensityScale:study?.light.intensityScale??1};
 if(study?.light.overrideSun){const a=THREE.MathUtils.degToRad(study.light.azimuth),e=THREE.MathUtils.degToRad(study.light.elevation);defaultLight.incoming=[Math.cos(a)*Math.cos(e),-Math.sin(e),Math.sin(a)*Math.cos(e)];}
 const lightStudy=options?.lightStudy??defaultLight;
 const gltf=await new GLTFLoader().loadAsync('/models/afterlight-courtyard.glb');
 const root=gltf.scene;
 const resources=collectModelResources(root);
 // Keep original asset resources owned for disposal, replacing only living meshes.
 const previousPlants:THREE.Object3D[]=[];
 root.traverse(o=>{if(o instanceof THREE.Mesh&&/^(Foliage|Leaf|Stem)/.test(o.name))previousPlants.push(o);});
 previousPlants.forEach(o=>o.removeFromParent());
 let indirect:THREE.DataTexture;
 try{indirect=await new EXRLoader().loadAsync('/textures/afterlight/room-indirect.exr');}
 catch(error){disposeModelResources(resources);throw error;}
 resources.textures.add(indirect);
 let releaseUnusedMedaka=()=>{};
 const release=()=>{releaseUnusedMedaka();root.removeFromParent();disposeModelResources(resources);};
 root.updateMatrixWorld(true);
 const hero=root.getObjectByName('Camera_Hero');
 if(!(hero instanceof THREE.PerspectiveCamera)){release();throw new Error('雨後天井缺少主鏡頭。');}
 const position=hero.getWorldPosition(new THREE.Vector3());
 const target=new THREE.Vector3().fromArray(root.userData.camera_target_three ?? position.clone().addScaledVector(hero.getWorldDirection(new THREE.Vector3()),4).toArray());
 indirect.flipY=false;indirect.channel=0;indirect.repeat.y=-1;indirect.offset.y=1;indirect.colorSpace=THREE.LinearSRGBColorSpace;
 const surfaces=new Set<THREE.MeshStandardMaterial>();
 const farDay={value:1};
 root.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  object.castShadow=true;object.receiveShadow=true;
  const materials=Array.isArray(object.material)?object.material:[object.material];
  if(object.name.startsWith('FarCorridor')){
   object.castShadow=true;object.receiveShadow=false;
   const far=materials.map(source=>{
    const original=source as THREE.MeshStandardMaterial;
    const material=new THREE.MeshBasicMaterial({color:new THREE.Color(.20,.22,.205),map:original.map,side:original.side});
    material.onBeforeCompile=shader=>{
     shader.uniforms.uFarDay=farDay;
     shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFarWorld,vFarNormal;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvFarWorld=(modelMatrix*vec4(transformed,1.)).xyz;vFarNormal=normalize(mat3(modelMatrix)*normal);');
     shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vFarWorld,vFarNormal;uniform float uFarDay;')
      .replace('#include <opaque_fragment>',`float orientation=.35+.5*max(vFarNormal.y,0.)+.1*max(-vFarNormal.x,0.);
       outgoingLight*=orientation*.035*uFarDay;
       float haze=1.-exp(-max(0.,length(vFarWorld-cameraPosition)-4.)*.09);
       outgoingLight=mix(outgoingLight,vec3(.001,.0015,.002)*uFarDay,haze);
       #include <opaque_fragment>`);
    };
    material.customProgramCacheKey=()=> 'afterlight-distant-corridor';resources.materials.add(material);return material;
   });object.material=Array.isArray(object.material)?far:far[0];
  }
  if(object.name.startsWith('RoomSurface'))for(const m of materials)if(m instanceof THREE.MeshStandardMaterial){m.lightMap=indirect;m.lightMapIntensity=Math.PI;m.needsUpdate=true;surfaces.add(m);}
 });
 if(!surfaces.size){release();throw new Error('雨後天井缺少烘焙建築。');}
 const medakaFactory=await prepareMedaka().catch(error=>{release();throw error;});
 releaseUnusedMedaka=()=>medakaFactory.dispose();
 const routeFactory=study?.route.enabled?await prepareRouteMedaka().catch(error=>{release();throw error;}):undefined;
 let consumed=false;
 const factory=(scene:THREE.Scene,renderer:THREE.WebGLRenderer):PlaceInstance=>{
  if(consumed)throw new Error('雨後天井資產已使用。');consumed=true;
  const oldShadow=renderer.shadowMap.enabled,oldType=renderer.shadowMap.type;
  // Oblique wall/floor views need anisotropic mip filtering at this close camera.
  for(const texture of resources.textures)if(texture!==indirect){texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());texture.needsUpdate=true;}
  scene.add(root);
  const foliage=installAfterlightFoliage(root),weather=createAfterlightWeather(scene);
  const medaka=medakaFactory(root);medaka.update(0,1);
  const routeFish:SharedMedaka[]=[];
  if(routeFactory&&study){const route=createMedakaRoute(study.route.points.map(v=>new THREE.Vector3(...v)),{closed:true,speed:study.route.speed,tempo:study.route.tempo});medaka.root.visible=false;for(let i=0;i<3;i++)routeFish.push(routeFactory.create(root,{route,phaseOffsetSeconds:i*route.duration/3}));}
  const lighting=createAfterlightLighting(scene,renderer,root,weather.root,lightStudy);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const environment=lighting.captureEnvironment();
  // Fish share the room's local reflection probe, so their muted skin can
  // catch skylight while crossing it. The scene owns this texture's lifetime.
  medaka.root.traverse(object=>{
   if(!(object instanceof THREE.Mesh))return;
   for(const material of (Array.isArray(object.material)?object.material:[object.material])){
    if(material instanceof THREE.MeshStandardMaterial){material.envMap=environment.texture;material.needsUpdate=true;}
   }
  });
  for(const m of surfaces){
   m.envMap=environment.texture;m.envMapIntensity=.7;
   m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',`#include <lights_fragment_maps>
    // The local probe supplies glossy reflection; baked GI already owns diffuse bounce.
    iblIrradiance=vec3(0.);
   `);};
   m.customProgramCacheKey=()=> 'afterlight-specular-probe';m.needsUpdate=true;
  }
  const surfacesState=installSurfaceMaterials(surfaces);
  const shadows=installContactShadows(root);
  let disposed=false;
  return {
   position:position.toArray(),target:target.toArray(),fov:hero.fov,yawRange:Math.PI/30,
   exposure:study?.light.exposure??1.25,toneMapping:THREE.AgXToneMapping,hasSimulation:false,waterMode:'',
   update(_dt,elapsed,state){
    // A previous scene is disposed after our first frame; reassert ownership on update.
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const heavy=state.heavyRain??false;
    const light=lighting.update(elapsed,(state.beamStrength??1)*(study?.light.beam??1)*(heavy?.55:1),state.intensity*(heavy?.62:1),state.warmth*(heavy?.55:1),state.angle,state.lowQuality??false,state.hour,state.intensity);
    shadows.update(light.incoming);farDay.value=light.indirect;medaka.update(elapsed,light.day);routeFish.forEach(f=>f.update(elapsed));
    for(const m of surfaces){m.lightMapIntensity=Math.PI*.7*light.indirect;m.envMapIntensity=.7*light.indirect;}
    surfacesState.update(elapsed,state.rain??0);foliage.update(elapsed,light.day,state.rain??0,state.angle,heavy);weather.update(elapsed,state.rain??0,light.day,state.lowQuality??false,state.angle,foliage.rainBlocks,heavy);
   },
   disturb(){},resetWater(){},
   dispose(){if(disposed)return;disposed=true;shadows.dispose();surfacesState.dispose();lighting.dispose();routeFish.forEach(f=>f.dispose());routeFactory?.dispose();medaka.dispose();weather.dispose();foliage.dispose();environment.dispose();release();renderer.shadowMap.enabled=oldShadow;renderer.shadowMap.type=oldType;},
  };
 };
 return Object.assign(factory,{dispose(){if(!consumed){consumed=true;routeFactory?.dispose();release();}}});
}
