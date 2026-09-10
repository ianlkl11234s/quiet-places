import * as THREE from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import type {PlaceFactory} from '../../player/contracts.ts';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';
import {snowWindowDaylight} from './Daylight.ts';
import {createCurtains} from './Curtains.ts';
import {createOakMaterial,createPlasterMaterial,createWinterGlassMaterial} from './Materials.ts';
import {createSnowField} from './Snow.ts';
import {createWinterExterior} from './Exterior.ts';
import {createSnowCreatures} from './Creatures.ts';

export async function prepareSnowwindow():Promise<PlaceFactory>{
 RectAreaLightUniformsLib.init();
 const factory:PlaceFactory=(scene,renderer)=>{
  const root=new THREE.Group();root.name='snowwindow-room';scene.add(root);
  const oldShadow={enabled:renderer.shadowMap.enabled,type:renderer.shadowMap.type};
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const plaster=createPlasterMaterial(),oak=createOakMaterial();
  const frame=new THREE.MeshStandardMaterial({color:'#202527',roughness:.82,metalness:.15});
  const box=(name:string,size:readonly [number,number,number],position:readonly [number,number,number],material:THREE.Material,cast=false)=>{
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.name=name;mesh.position.set(...position);mesh.receiveShadow=true;mesh.castShadow=cast;root.add(mesh);return mesh;
  };
  // Extend the room envelope beyond wide-camera rays; keep the visible left/bottom edges fixed.
  box('snowwindow-left-corner-wall',[120,40,.34],[-61.14,2.75,-4.55],plaster.material);
  box('snowwindow-window-base',[60,40,.34],[28.86,-19.28,-4.55],plaster.material);
  box('oak-window-sill',[60,.065,.70],[28.86,.72,-4.11],oak.material,true);
  for(const [name,size,pos] of [
   ['frame-left',[.032,19.22,.045],[-1.14,10.39,-4.36]],['frame-right',[.032,19.22,.045],[58.86,10.39,-4.36]],
   ['frame-top',[60,.035,.045],[28.86,20,-4.36]],['frame-bottom',[60,.035,.045],[28.86,.78,-4.36]],
  ] as const)box(name,size,pos,frame);
  const glassMaterial=createWinterGlassMaterial();
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(59.968,19.185),glassMaterial);glass.name='snowwindow-glass';
  for(const texture of [glassMaterial.normalMap])if(texture){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(59.968/11.94,19.185/3.74);texture.needsUpdate=true;}glass.position.set(28.86,10.39,-4.42);root.add(glass);
  const exterior=createWinterExterior();root.add(exterior.group);
  const creatures=createSnowCreatures({clioneCount:7,environment:glassMaterial.envMap as THREE.CubeTexture|null});root.add(creatures.group);
  const falling=createSnowField();root.add(falling.points);
  const curtains=createCurtains();root.add(curtains.group);
  // A small residual room bounce, not unoccluded exterior illumination.
  const skyLight=new THREE.HemisphereLight('#c1ccd2','#171b20',.04);root.add(skyLight);
  // Two aperture patches approximate overcast sky and snow-reflected daylight.
  // Keep both on the glazing plane, facing inward; RectAreaLight has no shadows.
  const windowFill=new THREE.RectAreaLight('#d5dfe1',.7,11.86,2.18);windowFill.position.set(4.84,3.40,-4.42);windowFill.lookAt(4.84,3.40,-3.42);root.add(windowFill);
  const snowBounce=new THREE.RectAreaLight('#c7d2d8',.16,11.86,1.48);snowBounce.position.set(4.84,1.57,-4.42);snowBounce.lookAt(4.84,1.57,-3.42);root.add(snowBounce);
  const background=new THREE.Color('#9fabb3');scene.background=background;
  let disposed=false;
  return {position:[2.38,2.92,-1.28],target:[-.1,2.35,-4.82],cameraMode:'fixed-position',yawRange:Math.PI/24,fov:52,exposure:1.02,hasSimulation:false,waterMode:'',
   update(_dt,elapsed,state){
    // Preserve a narrow left corner at every aspect while retaining vertical
    // sky/platform framing. The exterior shares the same world-space corner and depth.
    const aspect=renderer.domElement.clientWidth/Math.max(1,renderer.domElement.clientHeight);
    const yaw=Math.atan2(-1.5,3.87),slope=-.62*aspect*Math.tan(28*Math.PI/180);
    root.position.x=2.54-3.41*(-slope*Math.cos(yaw)-Math.sin(yaw))/(Math.cos(yaw)-slope*Math.sin(yaw));
    const light=snowWindowDaylight(state);
    background.copy(light.sky).multiplyScalar(light.visibility);
    skyLight.color.copy(light.tint);skyLight.intensity=.012+.10*light.visibility;
    windowFill.color.copy(light.tint);windowFill.intensity=.015+.70*light.visibility;
    snowBounce.color.copy(light.tint);snowBounce.intensity=.004+.16*light.visibility;
    glassMaterial.envMapIntensity=.65*light.visibility;exterior.update(elapsed,light);
    falling.update(elapsed,light.visibility,state.lowQuality);curtains.update(elapsed);creatures.update(elapsed,light.visibility);
   },
   disturb(){},resetWater(){},dispose(){if(disposed)return;disposed=true;creatures.dispose();falling.dispose();curtains.dispose();exterior.dispose();exterior.group.removeFromParent();oak.dispose();plaster.dispose();disposeModelResources(collectModelResources(root),['geometries','materials','textures']);root.removeFromParent();renderer.shadowMap.enabled=oldShadow.enabled;renderer.shadowMap.type=oldShadow.type;if(scene.background===background)scene.background=null;},
  };
 };
 return factory;
}
