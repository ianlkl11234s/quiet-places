import * as THREE from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import type {PlaceFactory} from '../../player/contracts.ts';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';
import {snowHallDaylight} from './Daylight.ts';
import {createHallMaterials} from './Materials.ts';
import {createSnowHallField} from './Snow.ts';
import {createAntarcticLife} from './AntarcticLife.ts';
import {applySnowhallLayout,SNOW_HALL_BASELINE,SNOW_HALL_DOORS,validateSnowhallDraft,type SnowhallDraft} from './Layout.ts';

export async function prepareSnowhall(options?:{layout?:SnowhallDraft;sceneSeed?:number}):Promise<PlaceFactory>{
 RectAreaLightUniformsLib.init();
 const layout=validateSnowhallDraft(options?.layout??SNOW_HALL_BASELINE);
 const sceneSeed=Number.isFinite(options?.sceneSeed)?options!.sceneSeed!>>>0:20260913;
 const factory:PlaceFactory=(scene,renderer)=>{
  const root=new THREE.Group();root.name='snowhall-corridor';scene.add(root);
  const materials=createHallMaterials(),snow=createSnowHallField();root.add(snow.points);
  const oldShadow={enabled:renderer.shadowMap.enabled,type:renderer.shadowMap.type};
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const box=(name:string,size:[number,number,number],position:[number,number,number],material:THREE.Material,shadows=true)=>{
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.name=name;mesh.position.set(...position);mesh.castShadow=shadows;mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  box('snowhall-floor',[4.45,.18,19.2],[0,-.09,-2.25],materials.floor);
  box('snowhall-left-wall',[.24,3.42,19.2],[-2.105,1.62,-2.25],materials.plaster);
  box('snowhall-right-wall',[.24,3.42,19.2],[2.105,1.62,-2.25],materials.plaster);
  box('snowhall-ceiling',[4.45,.22,19.2],[0,3.31,-2.25],materials.plaster);
  box('snowhall-left-baseboard',[.055,.10,19.05],[-1.96,.05,-2.25],materials.frame,false);
  box('snowhall-right-baseboard',[.055,.10,19.05],[1.96,.05,-2.25],materials.frame,false);
  // Four end-wall pieces preserve a real architectural opening around the window.
  box('snowhall-end-left',[1.33,3.42,.28],[-1.44,1.62,-11.72],materials.plaster);
  box('snowhall-end-right',[1.33,3.42,.28],[1.44,1.62,-11.72],materials.plaster);
  box('snowhall-end-lintel',[1.55,.63,.28],[0,3.015,-11.72],materials.plaster);
  box('snowhall-end-sill-wall',[1.55,.72,.28],[0,.27,-11.72],materials.plaster);
  box('snowhall-frame-top',[1.88,.09,.18],[0,2.72,-11.53],materials.frame);
  box('snowhall-frame-bottom',[1.88,.09,.18],[0,.68,-11.53],materials.frame);
  box('snowhall-frame-left',[.09,2.13,.18],[-.895,1.70,-11.53],materials.frame);
  box('snowhall-frame-right',[.09,2.13,.18],[.895,1.70,-11.53],materials.frame);
  const glass=box('snowhall-window-glass',[1.70,1.96,.018],[0,1.70,-11.51],materials.glass,false);glass.renderOrder=5;
  box('snowhall-snow-on-sill',[1.72,.055,.32],[0,.755,-11.63],materials.snow,false);
  // Alternating doors establish rooms on both sides; the pair nearest the
  // window shares one cross-corridor position like a compact residential hall.
  for(const {side,z,width} of SNOW_HALL_DOORS){
   const sign=side==='right'?1:-1,x=sign*1.972,jambX=sign*1.94;
   const door=box(`snowhall-${side}-door`,[.035,2.45,width],[x,1.225,z],materials.frame,false);door.userData={doorSide:side,doorPart:'door'};
   const jambA=box(`snowhall-${side}-door-jamb`,[.05,2.55,.055],[jambX,1.275,z-width/2],materials.plaster,false);jambA.userData={doorSide:side,doorPart:'jamb'};
   const jambB=box(`snowhall-${side}-door-jamb`,[.05,2.55,.055],[jambX,1.275,z+width/2],materials.plaster,false);jambB.userData={doorSide:side,doorPart:'jamb'};
   const lintel=box(`snowhall-${side}-door-lintel`,[.05,.055,width],[jambX,2.485,z],materials.plaster,false);lintel.userData={doorSide:side,doorPart:'jamb'};
  }
  const outsideGround=box('snowhall-outside-snow',[22,.14,45],[0,-.22,-34],materials.snow,false);outsideGround.receiveShadow=false;
  // A glazing-sized area light models diffuse winter sky through the window.
  // Its soft falloff avoids a hard aperture shape being read as raised floor.
  const windowFill=new THREE.RectAreaLight('#d3dde1',0,1.70,1.96);windowFill.name='snowhall-window-area-light';windowFill.position.set(0,1.70,-11.46);windowFill.lookAt(0,1.70,-10.46);root.add(windowFill);
  const fill=new THREE.HemisphereLight('#aebbc2','#222425',.04);root.add(fill);
  const background=new THREE.Color('#aebbc2'),fog=new THREE.FogExp2(background,.017);scene.background=background;scene.fog=fog;
  applySnowhallLayout(root,layout);
  let life=createAntarcticLife(root,layout,sceneSeed),biologyLayout=layout;
  root.userData.biology=life.simulation;
  root.userData.onSnowhallLayoutChange=(next:SnowhallDraft)=>{
   if(next.corridorWidth===biologyLayout.corridorWidth&&JSON.stringify(next.window)===JSON.stringify(biologyLayout.window)&&JSON.stringify(next.camera.position)===JSON.stringify(biologyLayout.camera.position)&&JSON.stringify(next.camera.target)===JSON.stringify(biologyLayout.camera.target))return;
   life.dispose();life=createAntarcticLife(root,next,sceneSeed);biologyLayout=next;root.userData.biology=life.simulation;
  };
  let disposed=false;
  return {
   position:[...layout.camera.position],target:[...layout.camera.target],cameraMode:'fixed-position',yawRange:Math.PI/30,
   get fov(){return typeof window!=='undefined'&&window.innerWidth<700?68:layout.camera.fov;},exposure:1.15,toneMapping:THREE.AgXToneMapping,
   hasSimulation:false,waterMode:'雪落在盡端窗外，銀魚在走廊中巡游、緩停與繞圈',
   update(_dt,elapsed,state){
    const light=snowHallDaylight(state);background.copy(light.sky);fog.color.copy(light.sky);
    windowFill.intensity=light.windowIntensity;windowFill.color.copy(light.tint);fill.intensity=light.fillIntensity;fill.color.copy(light.sky);
    snow.update(elapsed,light.snowVisibility,!!state.lowQuality,root.userData.snowScale??1);life.update(elapsed);
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
   },
   disturb(){},resetWater(){},dispose(){
    if(disposed)return;disposed=true;delete root.userData.onSnowhallLayoutChange;delete root.userData.biology;life.dispose();snow.dispose();materials.dispose();
    disposeModelResources(collectModelResources(root),['geometries']);root.removeFromParent();renderer.shadowMap.enabled=oldShadow.enabled;renderer.shadowMap.type=oldShadow.type;
    if(scene.background===background)scene.background=null;if(scene.fog===fog)scene.fog=null;
   },
  };
 };
 return factory;
}
