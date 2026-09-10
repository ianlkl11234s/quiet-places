import * as THREE from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import type {PlaceFactory} from '../../player/contracts.ts';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';
import {snowWindowDaylight} from './Daylight.ts';
import {createCurtains} from './Curtains.ts';
import {createOakMaterial,createPlasterMaterial,createWinterGlassMaterial} from './Materials.ts';
import {createSnowField} from './Snow.ts';
import {createWinterExterior} from './Exterior.ts';

export async function prepareSnowwindow():Promise<PlaceFactory>{
 RectAreaLightUniformsLib.init();
 const factory:PlaceFactory=(scene,renderer)=>{
  const root=new THREE.Group();root.name='snowwindow-room';scene.add(root);
  const oldShadow={enabled:renderer.shadowMap.enabled,type:renderer.shadowMap.type};
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const curtainDay={value:1};
  const plaster=createPlasterMaterial(),oak=createOakMaterial();
  const frame=new THREE.MeshStandardMaterial({color:'#202527',roughness:.82,metalness:.15});
  const box=(name:string,size:readonly [number,number,number],position:readonly [number,number,number],material:THREE.Material,cast=false)=>{
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.name=name;mesh.position.set(...position);mesh.receiveShadow=true;mesh.castShadow=cast;root.add(mesh);return mesh;
  };
  box('snowwindow-left-corner-wall',[6.0,15,.34],[-4.14,2.75,-4.55],plaster.material);
  box('snowwindow-window-base',[12,4,.34],[4.84,-1.28,-4.55],plaster.material);
  box('oak-window-sill',[12,.065,.70],[4.84,.72,-4.11],oak.material,true);
  for(const [name,size,pos] of [
   ['frame-left',[.032,3.85,.045],[-1.14,2.62,-4.36]],['frame-right',[.032,3.85,.045],[10.82,2.62,-4.36]],
   ['frame-top',[12,.035,.045],[4.84,4.53,-4.36]],['frame-bottom',[12,.035,.045],[4.84,.78,-4.36]],
  ] as const)box(name,size,pos,frame);
  const glassMaterial=createWinterGlassMaterial();
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(11.94,3.74),glassMaterial);glass.name='snowwindow-glass';glass.position.set(4.84,2.62,-4.42);root.add(glass);
  const exterior=createWinterExterior();root.add(exterior.group);
  const falling=createSnowField();root.add(falling.points);
  const curtains=createCurtains(curtainDay);root.add(curtains.group);
  const skyLight=new THREE.HemisphereLight('#d7e0e3','#2a2926',.45);root.add(skyLight);
  // Soft sky irradiance through the glazing; this is a natural-window proxy,
  // not a visible fixture or an artificial source in the depicted room.
  const windowFill=new THREE.RectAreaLight('#d5dfe1',2.4,5.3,3.7);windowFill.position.set(1.62,2.62,-4.08);windowFill.lookAt(.35,1.15,.4);root.add(windowFill);
  const snowBounce=new THREE.AmbientLight('#b8c1c0',.12);root.add(snowBounce);
  const naturalLight=new THREE.DirectionalLight('#dce6e7',2.2);naturalLight.position.set(-5,9,4);naturalLight.target.position.set(0,1.1,-4.4);naturalLight.castShadow=false;naturalLight.shadow.mapSize.set(1024,1024);naturalLight.shadow.camera.left=-7;naturalLight.shadow.camera.right=7;naturalLight.shadow.camera.top=7;naturalLight.shadow.camera.bottom=-3;naturalLight.shadow.camera.near=.1;naturalLight.shadow.camera.far=30;naturalLight.shadow.bias=-.00015;root.add(naturalLight,naturalLight.target);
  const background=new THREE.Color('#9fabb3');scene.background=background;
  let disposed=false;
  return {position:[1.4,2.35,-.95],target:[-.1,2.35,-4.82],cameraMode:'fixed-position',yawRange:0,fov:56,exposure:1.02,hasSimulation:false,waterMode:'',
   update(_dt,elapsed,state){
    // Preserve a narrow left corner at every aspect while retaining vertical
    // sky/platform framing. The exterior shares the same world-space corner and depth.
    const aspect=renderer.domElement.clientWidth/Math.max(1,renderer.domElement.clientHeight);
    const yaw=Math.atan2(-1.5,3.87),slope=-.62*aspect*Math.tan(28*Math.PI/180);
    root.position.x=2.54-3.41*(-slope*Math.cos(yaw)-Math.sin(yaw))/(Math.cos(yaw)-slope*Math.sin(yaw));
    const light=snowWindowDaylight(state);curtainDay.value=.16+.84*Math.max(light.solar,light.night*.20);
    background.copy(light.sky).multiplyScalar(light.visibility);skyLight.color.copy(light.sky);skyLight.groundColor.set('#292a29');skyLight.intensity=light.skyIntensity;windowFill.color.copy(light.tint);windowFill.intensity=.14+1.75*light.solar+.16*light.night;snowBounce.intensity=.07+.33*light.solar+.04*light.night;
    naturalLight.position.copy(light.direction).multiplyScalar(12);naturalLight.position.z+=-1.5;naturalLight.color.copy(light.tint);naturalLight.intensity=light.directIntensity;
    glassMaterial.envMapIntensity=.65*light.visibility;exterior.update(elapsed,light);plaster.material.color.set('#c2c1bc').multiplyScalar(.50+.50*light.visibility);
    falling.update(elapsed,light.visibility,state.lowQuality);curtains.update(elapsed);
   },
   disturb(){},resetWater(){},dispose(){if(disposed)return;disposed=true;falling.dispose();curtains.dispose();exterior.dispose();exterior.group.removeFromParent();oak.dispose();plaster.dispose();disposeModelResources(collectModelResources(root),['geometries','materials','textures']);root.removeFromParent();renderer.shadowMap.enabled=oldShadow.enabled;renderer.shadowMap.type=oldShadow.type;if(scene.background===background)scene.background=null;},
  };
 };
 return factory;
}
