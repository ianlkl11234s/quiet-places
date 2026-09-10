import * as THREE from 'three';
import type {PlaceFactory} from '../../player/contracts.ts';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';
import {snowWindowDaylight} from './Daylight.ts';
import {createCurtains} from './Curtains.ts';
import {createOakMaterial,createPlasterMaterial} from './Materials.ts';
import {createSnowField} from './Snow.ts';

export async function prepareSnowwindow():Promise<PlaceFactory>{
 const reference=await new THREE.TextureLoader().loadAsync('/textures/snowwindow-background-v2.png');reference.colorSpace=THREE.SRGBColorSpace;reference.wrapS=reference.wrapT=THREE.ClampToEdgeWrapping;
 const factory:PlaceFactory=(scene,renderer)=>{
  const root=new THREE.Group();root.name='snowwindow-room';scene.add(root);
  const oldShadow={enabled:renderer.shadowMap.enabled,type:renderer.shadowMap.type};
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const visibility={value:1},curtainDay={value:1};
  const plaster=createPlasterMaterial(),oak=createOakMaterial();
  const frame=new THREE.MeshStandardMaterial({color:'#202527',roughness:.58,metalness:.62});
  const snow=new THREE.MeshStandardMaterial({color:'#eef1ed',roughness:.99,metalness:0});
  const box=(name:string,size:readonly [number,number,number],position:readonly [number,number,number],material:THREE.Material,cast=false)=>{
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.name=name;mesh.position.set(...position);mesh.receiveShadow=true;mesh.castShadow=cast;root.add(mesh);return mesh;
  };
  box('snowwindow-left-corner-wall',[6.0,5.5,.34],[-4.14,2.75,-4.55],plaster.material);
  box('snowwindow-window-head',[5.5,1,.34],[1.62,4.9,-4.55],plaster.material);
  box('snowwindow-window-base',[5.5,.64,.34],[1.62,.32,-4.55],plaster.material);
  box('oak-window-sill',[5.55,.12,.58],[1.62,.72,-4.27],oak.material,true);
  box('oak-window-sill-apron',[5.55,.52,.06],[1.62,.34,-3.96],oak.material);
  box('sill-shadow-line',[5.55,.12,.08],[1.62,.59,-3.79],plaster.material);
  box('tiny-exterior-platform',[4.05,.17,.78],[1.62,.50,-5.02],plaster.material);
  const snowBankGeometry=new THREE.PlaneGeometry(3.98,.72,22,6);const bankPosition=snowBankGeometry.getAttribute('position') as THREE.BufferAttribute;
  for(let i=0;i<bankPosition.count;i++){const x=bankPosition.getX(i),y=bankPosition.getY(i);bankPosition.setZ(i,.025+.022*Math.sin(x*3.1+y*5.7)+.012*Math.sin(x*8.4-y*2.9));}snowBankGeometry.computeVertexNormals();
  const snowBank=new THREE.Mesh(snowBankGeometry,snow);snowBank.name='platform-soft-snow';snowBank.rotation.x=-Math.PI/2;snowBank.position.set(1.62,.635,-5.02);snowBank.receiveShadow=true;root.add(snowBank);
  for(const [name,size,pos] of [
   ['frame-left',[.055,3.85,.075],[-1.14,2.62,-4.36]],['frame-right',[.055,3.85,.075],[4.38,2.62,-4.36]],
   ['frame-top',[5.61,.095,.10],[1.62,4.53,-4.36]],['frame-bottom',[5.61,.095,.10],[1.62,.71,-4.36]],
  ] as const)box(name,size,pos,frame);
  const glassMaterial=new THREE.MeshPhysicalMaterial({color:'#dce7e9',roughness:.26,metalness:0,transparent:true,opacity:.15,transmission:.14,thickness:.015,depthWrite:false,side:THREE.DoubleSide});
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(5.46,3.74),glassMaterial);glass.name='snowwindow-glass';glass.position.set(1.62,2.62,-4.42);root.add(glass);
  // Keep the supplied image at its native 2:3 aspect and let the real window
  // crop its right-hand sea/snow region; the jellyfish remains outside view.
  const referenceMaterial=new THREE.MeshBasicMaterial({map:reference,color:'#ffffff',toneMapped:false});
  const referenceView=new THREE.Mesh(new THREE.PlaneGeometry(52,78),referenceMaterial);referenceView.name='snowwindow-reference-backing';referenceView.position.set(0,-2,-20);referenceView.renderOrder=-90;root.add(referenceView);
  const falling=createSnowField();root.add(falling.points);
  const curtains=createCurtains(curtainDay);root.add(curtains.group);
  const skyLight=new THREE.HemisphereLight('#d7e0e3','#2a2926',.45);root.add(skyLight);
  // Soft sky irradiance through the glazing; this is a natural-window proxy,
  // not a visible fixture or an artificial source in the depicted room.
  const windowFill=new THREE.RectAreaLight('#d5dfe1',2.4,5.3,3.7);windowFill.position.set(1.62,2.62,-4.08);windowFill.lookAt(.35,1.15,.4);root.add(windowFill);
  const snowBounce=new THREE.AmbientLight('#b8c1c0',.12);root.add(snowBounce);
  const naturalLight=new THREE.DirectionalLight('#dce6e7',2.2);naturalLight.position.set(-5,9,4);naturalLight.target.position.set(0,1.1,-4.4);naturalLight.castShadow=true;naturalLight.shadow.mapSize.set(1024,1024);naturalLight.shadow.camera.left=-7;naturalLight.shadow.camera.right=7;naturalLight.shadow.camera.top=7;naturalLight.shadow.camera.bottom=-3;naturalLight.shadow.camera.near=.1;naturalLight.shadow.camera.far=30;naturalLight.shadow.bias=-.00015;root.add(naturalLight,naturalLight.target);
  const background=new THREE.Color('#9fabb3');scene.background=background;
  let disposed=false;
  return {position:[-.08,1.88,-.95],target:[-.68,2.40,-4.82],cameraMode:'fixed-position',yawRange:0,get fov(){return typeof window!=='undefined'&&window.innerWidth<700?64:56;},framingAspect:1.5,exposure:1.02,hasSimulation:false,waterMode:'',
   update(_dt,elapsed,state){
    const light=snowWindowDaylight(state);visibility.value=light.visibility;curtainDay.value=.16+.84*Math.max(light.solar,light.night*.20);
    background.copy(light.sky).multiplyScalar(light.visibility);skyLight.color.copy(light.sky);skyLight.groundColor.set('#292a29');skyLight.intensity=light.skyIntensity;windowFill.color.copy(light.tint);windowFill.intensity=.14+1.75*light.solar+.16*light.night;snowBounce.intensity=.07+.33*light.solar+.04*light.night;
    naturalLight.position.copy(light.direction).multiplyScalar(12);naturalLight.position.z+=-1.5;naturalLight.color.copy(light.tint);naturalLight.intensity=light.directIntensity;
    referenceMaterial.color.copy(light.tint).multiplyScalar(.28+.72*light.visibility);plaster.material.color.set('#c2c1bc').multiplyScalar(.50+.50*light.visibility);snow.color.set('#eef1ed').multiplyScalar(.40+.60*light.visibility);
    falling.update(elapsed,light.visibility,state.lowQuality);curtains.update(elapsed);
   },
   disturb(){},resetWater(){},dispose(){if(disposed)return;disposed=true;falling.dispose();curtains.dispose();oak.dispose();plaster.dispose();glassMaterial.dispose();disposeModelResources(collectModelResources(root),['geometries','materials','textures']);root.removeFromParent();renderer.shadowMap.enabled=oldShadow.enabled;renderer.shadowMap.type=oldShadow.type;if(scene.background===background)scene.background=null;},
  };
 };
 return Object.assign(factory,{dispose:()=>reference.dispose()});
}
