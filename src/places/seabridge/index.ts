import * as THREE from 'three';
import type {PlaceFactory} from '../../player/contracts.ts';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';
import {seaMaterial} from '../seaward/Materials.ts';
import {seabridgeDaylight} from './Daylight.ts';
import {createGraybox} from './Graybox.ts';
import {GRASS_PATCHES,grassBlocked,SHORE,VIEWS,type SeabridgeView} from './Layout.ts';
import {createGrass} from './Grass.ts';

// Sky dome: time-driven horizon/zenith, soft cloud banks and a low-sun glow.
// Shares the colours the sea reflects; art-directed, not atmospheric scattering.
const skyFragment=`varying vec3 direction;uniform vec3 uHorizon,uZenith,uTint,uSun;uniform float uGlow,uNight;
float cloud(vec2 p){float c=.52+.22*sin(p.x*2.4+p.y*.75)+.16*sin(p.x*5.8-p.y*1.9);c+=.09*sin(p.x*12.+p.y*4.6)+.05*sin(p.x*23.-p.y*9.);return smoothstep(.22,.86,c);}
void main(){vec3 d=normalize(direction);float e=max(d.y,0.);
vec3 col=mix(uHorizon,uZenith,smoothstep(0.,.6,e));
float c=cloud(d.xz/max(.2,d.y+.3));float band=smoothstep(.02,.12,e)*(1.-smoothstep(.45,.8,e));
float sunward=pow(max(dot(d,uSun),0.),6.);
vec3 cloudCol=mix(col*.62,uHorizon*1.35*uTint,clamp(sunward*uGlow,0.,1.));
col=mix(col,cloudCol,c*band*.9);
col+=uTint*pow(max(dot(d,uSun),0.),16.)*uGlow*.6*(1.-uNight);
gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

export async function prepareSeabridge():Promise<PlaceFactory>{
 const factory:PlaceFactory=(scene,renderer)=>{
  const root=new THREE.Group();root.name='seabridge';scene.add(root);
  const oldShadow={enabled:renderer.shadowMap.enabled,type:renderer.shadowMap.type};
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const graybox=createGraybox();root.add(graybox.group);
  const time={value:0},day={value:1},sunU={value:new THREE.Vector3()},tint={value:new THREE.Color()},direct={value:1};
  const horizon={value:new THREE.Color()},zenith={value:new THREE.Color()};
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(1400,1000),seaMaterial(time,day,sunU,tint,direct,horizon,zenith));
  ocean.name='seabridge-sea';ocean.rotation.x=-Math.PI/2;ocean.position.set(0,SHORE.seaY,-520);root.add(ocean);
  const skyUniforms={uHorizon:horizon,uZenith:zenith,uTint:tint,uSun:sunU,uGlow:{value:0},uNight:{value:0}};
  const sky=new THREE.Mesh(new THREE.SphereGeometry(650,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:skyUniforms,
   vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:skyFragment}));
  const grass=createGrass(GRASS_PATCHES,grassBlocked,{sun:sunU,tint,direct});root.add(grass.group);
  sky.name='seabridge-sky';sky.renderOrder=-100;root.add(sky);

  const sun=new THREE.DirectionalLight('#ffffff',2);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0004;sun.shadow.normalBias=.03;
  Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:1,far:90});
  sun.target.position.set(0,2.5,-9);root.add(sun,sun.target);
  const hemi=new THREE.HemisphereLight('#b9c7d2','#5c564c',.3);root.add(hemi);
  // Fluorescent tubes under the roof: the sourceable light for dusk and night.
  const lamps=graybox.tubes.filter((_,i)=>i%2===0).map(p=>{const l=new THREE.PointLight('#ffeccc',0,9,2);l.position.copy(p);root.add(l);return l;});

  const background=new THREE.Color();scene.background=background;
  const requested=typeof location==='undefined'?null:new URLSearchParams(location.search).get('seabridgeView');
  const view=VIEWS[(requested==='b'?'b':'a') as SeabridgeView];
  let disposed=false;
  return {position:[...view.position],target:[...view.target],cameraMode:'fixed-position',yawRange:Math.PI/12,
   get fov(){return typeof window!=='undefined'&&window.innerWidth<700?78:view.fov;},exposure:1.05,hasSimulation:false,waterMode:'',
   update(_dt,elapsed,state){
    const light=seabridgeDaylight(state);
    time.value=elapsed;day.value=light.level;sunU.value.copy(light.sun);tint.value.copy(light.tint);direct.value=light.solar+.4*light.night;
    horizon.value.copy(light.horizon);zenith.value.copy(light.zenith);background.copy(light.horizon);
    skyUniforms.uGlow.value=.4+1.6*light.low;skyUniforms.uNight.value=light.night;
    sun.position.copy(sun.target.position).addScaledVector(light.sun,45);
    sun.color.copy(light.tint);sun.intensity=(3.2*light.solar*light.level+.35*light.night)*(state.beamStrength??1);
    hemi.color.copy(light.zenith).lerp(new THREE.Color(1,1,1),.35);hemi.intensity=.08+.5*light.level*(1-light.night*.8);
    graybox.tubeMat.emissiveIntensity=2.4*light.lamp;
    for(const lamp of lamps)lamp.intensity=5*light.lamp;
    grass.update(elapsed);
    renderer.shadowMap.enabled=true;
   },
   disturb(){},resetWater(){},
   dispose(){if(disposed)return;disposed=true;disposeModelResources(collectModelResources(root),['geometries','materials','textures']);sun.shadow.map?.dispose();root.removeFromParent();renderer.shadowMap.enabled=oldShadow.enabled;renderer.shadowMap.type=oldShadow.type;if(scene.background===background)scene.background=null;},
  };
 };
 return factory;
}
