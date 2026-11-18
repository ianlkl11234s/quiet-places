import * as THREE from 'three';
import type {PlaceFactory} from '../../player/contracts.ts';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';
import {createCrossingSeaMaterial} from './Sea.ts';
import {crossingDaylight} from './Daylight.ts';
import {createGraybox} from './Graybox.ts';
import {SEA_Y,VIEWS,type CrossingView} from './Layout.ts';

// Sky dome for open water: clean deep-blue zenith, fair-weather cumulus packed into a band hugging
// the horizon, and a low hazy island ridge above the horizon on the open-side-to-stern half only.
// Shares horizon/zenith with the sea's reflection; art-directed, not scattering.
const skyFragment=`varying vec3 direction;uniform vec3 uHorizon,uZenith,uTint,uSun,uSunDisc;uniform float uGlow,uNight,uDay,uTime,uSunDiscVis;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.05+13.7;a*=.5;}return v;}
void main(){vec3 d=normalize(direction);float e=max(d.y,0.);
vec3 col=mix(uHorizon,uZenith,pow(smoothstep(0.,.45,e),.75));
// Cumulus bank on the horizon: flat bases, billowing tops, gaps between clumps. Seam-free (noise on the unit circle).
vec2 u=normalize(d.xz+1e-5);
float clump=fbm(u*3.2+4.);
float topH=.03+.085*pow(smoothstep(.2,.55,clump),1.0)+.02*fbm(u*11.);
float base=.020+.004*n(u*30.);
float ee=(d.y-base)/max(topH-base,.01);
float nz=fbm(vec2(atan(d.z,d.x)*26.,d.y*26.+3.));
float cloud=smoothstep(0.,.07,d.y-base)*(1.-smoothstep(.55,1.,ee+(nz-.5)*.75))*step(.03,topH-base)*smoothstep(.0,.22,ee+.15);
float lit=clamp(ee*.9+.25+(nz-.5)*.5,0.,1.);
float sunward=pow(max(dot(d,uSun),0.),6.);
vec3 dayCloud=mix(vec3(.55,.64,.80),vec3(1.1),lit)*uDay;
vec3 lowCloud=mix(col*.95,uHorizon*1.5*uTint,clamp(sunward*uGlow,0.,1.));
vec3 cloudCol=mix(lowCloud,dayCloud,clamp(uDay*1.4-.2*uGlow,0.,1.));
float c=clamp(cloud,0.,1.);
// One or two faint high wisps only.
float wisp=smoothstep(.62,.8,fbm(vec2(atan(d.z,d.x)*2.,d.y*14.)))*smoothstep(.2,.3,e)*(1.-smoothstep(.45,.6,e))*.22*uDay;
col=mix(col,vec3(1.),wisp);
col=mix(col,cloudCol,c*.96);
col+=uTint*pow(max(dot(d,uSun),0.),16.)*uGlow*.5*(1.-uNight);
// Island ridge under the cloud bank, open side to stern only (azimuth atan(z,x) -150..+25 deg).
float az=atan(d.z,d.x);
float ridge=.007+.011*n(vec2(az*7.,1.7))+.005*n(vec2(az*23.,4.1))+.006*smoothstep(.0,1.,n(vec2(az*2.4,8.)));
float mask=smoothstep(-2.7,-2.4,az)*(1.-smoothstep(.3,.45,az));
float isle=(1.-smoothstep(ridge-.0012,ridge,d.y))*step(-.01,d.y)*mask;
vec3 isleCol=mix(uHorizon,vec3(.20,.33,.50)*max(uDay,.15),.75);
col=mix(col,isleCol,isle*(1.-uNight*.7));
float sd=dot(d,uSunDisc),core=smoothstep(cos(.0056),cos(.0046),sd),corona=pow(max(sd,0.),900.)*.35;
float high=smoothstep(.0,.35,uSunDisc.y);
col+=(core+corona*(1.-core))*mix(vec3(1.,.58,.32)*3.,vec3(1.,.97,.9)*9.,high)*uSunDiscVis*(1.-c*.85);
gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

export async function prepareCrossing():Promise<PlaceFactory>{
 const factory:PlaceFactory=(scene,renderer)=>{
  const root=new THREE.Group();root.name='crossing';scene.add(root);
  const oldShadow={enabled:renderer.shadowMap.enabled,type:renderer.shadowMap.type};
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const graybox=createGraybox();root.add(graybox.group);
  // "The outside world" (sea, sky, island) rolls as one group against the fixed deck and camera.
  const world=new THREE.Group();world.name='crossing-world';root.add(world);
  const time={value:0},day={value:1},sunU={value:new THREE.Vector3()},tint={value:new THREE.Color()},direct={value:1};
  const horizon={value:new THREE.Color()},zenith={value:new THREE.Color()};
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(1400,1400),createCrossingSeaMaterial(time,day,sunU,tint,direct,horizon,zenith));
  ocean.name='crossing-sea';ocean.rotation.x=-Math.PI/2;ocean.position.set(0,SEA_Y,0);world.add(ocean);
  const skyUniforms={uHorizon:horizon,uZenith:zenith,uTint:tint,uSun:sunU,uGlow:{value:0},uNight:{value:0},uDay:{value:1},uTime:{value:0},uSunDisc:{value:new THREE.Vector3(0,1,0)},uSunDiscVis:{value:0}};
  const sky=new THREE.Mesh(new THREE.SphereGeometry(650,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:skyUniforms,
   vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:skyFragment}));
  sky.name='crossing-sky';sky.renderOrder=-100;world.add(sky);

  // Shadow camera wraps the deck only (about 4.6 x 8 m).
  const sun=new THREE.DirectionalLight('#ffffff',2);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0004;sun.shadow.normalBias=.03;
  Object.assign(sun.shadow.camera,{left:-6.5,right:6.5,top:6.5,bottom:-6.5,near:1,far:60});
  sun.target.position.set(.1,1,1);root.add(sun,sun.target);
  const hemi=new THREE.HemisphereLight('#bcd0e6','#5d6e68',.4);root.add(hemi);
  // Sea bounce: a weak unshadowed light from below (the water reflects sky and sun onto the roof and wall undersides).
  const bounce=new THREE.DirectionalLight('#a9c8f5',0);bounce.position.set(1,-10,2);bounce.target.position.set(0,1,0);root.add(bounce,bounce.target);
  // Fluorescent fixture: on at night only, no shadow.
  const lamp=new THREE.PointLight('#ffeccc',0,9,2);lamp.position.copy(graybox.lampPosition);root.add(lamp);

  const background=new THREE.Color();scene.background=background;
  const requested=typeof location==='undefined'?null:new URLSearchParams(location.search).get('crossingView');
  const view=VIEWS[(requested==='a'||requested==='b'||requested==='c'?requested:'a') as CrossingView];
  const tmp=new THREE.Color(1,1,1);
  let disposed=false;
  return {position:[...view.position],target:[...view.target],cameraMode:'fixed-position',yawRange:Math.PI/10,
   get fov(){return typeof window!=='undefined'&&window.innerWidth<700?view.fov+14:view.fov;},exposure:1,msaaSamples:2,hasSimulation:false,waterMode:'',
   update(_dt,elapsed,state){
    const light=crossingDaylight(state);
    time.value=elapsed;day.value=light.level*(1-.75*light.night);sunU.value.copy(light.sun);tint.value.copy(light.tint);direct.value=light.direct;
    horizon.value.copy(light.horizon);zenith.value.copy(light.zenith);background.copy(light.horizon);
    skyUniforms.uGlow.value=.4+1.6*light.low;skyUniforms.uNight.value=light.night;
    skyUniforms.uDay.value=light.level*(1-light.night)*(1-.7*light.low);skyUniforms.uTime.value=elapsed;
    skyUniforms.uSunDisc.value.copy(light.sunTrue);skyUniforms.uSunDiscVis.value=light.sunUp*(1-light.night);
    sun.position.copy(sun.target.position).addScaledVector(light.sun,30);
    sun.color.copy(light.tint);sun.intensity=2.2*light.direct*(state.beamStrength??1);
    const lvl=light.level*(1-light.night*.85);
    hemi.color.copy(light.horizon).lerp(tmp,.5);hemi.groundColor.setRGB(.42,.58,.82).lerp(light.tint,.2).multiplyScalar(lvl);hemi.intensity=.12+1.4*lvl;
    bounce.intensity=.7*lvl;
    graybox.setLamp(1.5*light.lamp);lamp.intensity=2.2*light.lamp;
    // Hull roll: two incommensurate periods (8.2 s and 5.1 s), under 0.5 degree each way; the world turns, the camera does not.
    world.rotation.z=.0060*Math.sin(elapsed*2*Math.PI/8.2)+.0027*Math.sin(elapsed*2*Math.PI/5.1+1);
    renderer.shadowMap.enabled=true;
   },
   disturb(){},resetWater(){},
   dispose(){if(disposed)return;disposed=true;graybox.dispose();disposeModelResources(collectModelResources(root),['geometries','materials','textures']);sun.shadow.map?.dispose();root.removeFromParent();renderer.shadowMap.enabled=oldShadow.enabled;renderer.shadowMap.type=oldShadow.type;if(scene.background===background)scene.background=null;},
  };
 };
 return factory;
}
