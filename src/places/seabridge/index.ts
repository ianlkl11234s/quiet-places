import * as THREE from 'three';
import type {PlaceFactory} from '../../player/contracts.ts';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';
import {createSeaMaterial} from './Sea.ts';
import {moonDirection,seabridgeDaylight} from './Daylight.ts';
import {createGraybox} from './Graybox.ts';
import {GRASS_PATCHES,grassBlocked,SHORE,VIEWS,type SeabridgeView} from './Layout.ts';
import {createGrass} from './Grass.ts';
import {createSardineSchools} from './Sardines.ts';
import {installFullMoon} from '../../shared/sky/FullMoon.ts';

/** Full-moon switch: 0 restores the moonless night sky. */
const SEABRIDGE_FULL_MOON = 1;

// Sky dome: time-driven horizon/zenith with subtropical fair-weather cumulus
// (Okinawa-like: deep blue zenith, pale horizon haze, white clouds low on the
// horizon). Shares the colours the sea reflects; art-directed, not scattering.
const skyFragment=`varying vec3 direction;uniform vec3 uHorizon,uZenith,uTint,uSun,uSunDisc;uniform float uGlow,uNight,uDay,uTime,uSunDiscVis;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.05+13.7;a*=.5;}return v;}
void main(){vec3 d=normalize(direction);float e=max(d.y,0.);
vec3 col=mix(uHorizon,uZenith,pow(smoothstep(0.,.55,e),.7));
// Cumulus on a flat cloud layer: puffy tops, flatter greyer bases, denser toward the horizon.
vec2 p=d.xz/max(.06,d.y+.04)*.55+vec2(uTime*.004,0.);
float shape=fbm(p*.9)+.35*fbm(p*3.1)-.08;
float cover=mix(.59,.84,smoothstep(.0,.3,e));
float c=smoothstep(cover,cover+.16,shape)*smoothstep(.0,.05,e)*(1.-smoothstep(.3,.55,e));
float lit=smoothstep(cover,cover+.45,shape);
float sunward=pow(max(dot(d,uSun),0.),6.);
vec3 dayCloud=mix(vec3(.58,.64,.74),vec3(1.,1.,1.),lit)*uDay;
vec3 lowCloud=mix(col*.62,uHorizon*1.35*uTint,clamp(sunward*uGlow,0.,1.));
vec3 cloudCol=mix(lowCloud,dayCloud,clamp(uDay*1.4-.2*uGlow,0.,1.));
col=mix(col,cloudCol,c*.92);
col+=uTint*pow(max(dot(d,uSun),0.),16.)*uGlow*.6*(1.-uNight);
// Sun disc (~0.6°, a little larger than the real 0.53° for legibility): warmer and dimmer
// near the horizon; the sea hides it once it sets. A true highlight, so bloom may catch it.
float sd=dot(d,uSunDisc),core=smoothstep(cos(.0056),cos(.0046),sd),corona=pow(max(sd,0.),900.)*.35;
float high=smoothstep(.0,.35,uSunDisc.y);
col+=(core+corona*(1.-core))*mix(vec3(1.,.58,.32)*3.,vec3(1.,.97,.9)*9.,high)*uSunDiscVis*(1.-c*.85);
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
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(1400,1000),createSeaMaterial(time,day,sunU,tint,direct,horizon,zenith));
  ocean.name='seabridge-sea';ocean.rotation.x=-Math.PI/2;ocean.position.set(0,SHORE.seaY,-520);root.add(ocean);
  const skyUniforms={uHorizon:horizon,uZenith:zenith,uTint:tint,uSun:sunU,uGlow:{value:0},uNight:{value:0},uDay:{value:1},uTime:{value:0},uSunDisc:{value:new THREE.Vector3(0,1,0)},uSunDiscVis:{value:0}};
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
  // Platform shelter lamp: warm, small, on the same timer; its own shadow shows the bench and walls.
  const stationLamp=new THREE.PointLight('#ffe2b8',0,8,2);stationLamp.position.copy(graybox.shelterLamp);stationLamp.castShadow=true;stationLamp.shadow.mapSize.set(256,256);stationLamp.shadow.bias=-.002;root.add(stationLamp);
  const lamps=graybox.tubes.filter((_,i)=>i%2===0).map(p=>{const l=new THREE.PointLight('#ffeccc',0,9,2);l.position.copy(p);root.add(l);return l;});

  const background=new THREE.Color();scene.background=background;
  const requested=typeof location==='undefined'?null:new URLSearchParams(location.search).get('seabridgeView');
  const view=VIEWS[(requested==='a'||requested==='b'?requested:'user') as SeabridgeView];
  // Sardines keep clear of every authored standpoint so they never fill the lens.
  const sardines=createSardineSchools({seed:20260927,avoid:Object.values(VIEWS).map(v=>new THREE.Vector3(...v.position))});root.add(sardines.root);
  // Sky environment: same horizon/zenith as the dome above, warm sunlit-soil bounce below.
  // Used as the scene's weak ambient (shade was lit only by a deep-blue hemisphere and read
  // too cool) and at full strength for the sardines' silver flanks. Rebuilt only when the sky
  // colour moves, at most 5×/s.
  const groundBounce={value:new THREE.Color()},oldEnvironment={map:scene.environment,intensity:scene.environmentIntensity};
  const envScene=new THREE.Scene(),envDome=new THREE.Mesh(new THREE.SphereGeometry(1,24,12),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uHorizon:horizon,uZenith:zenith,uGround:groundBounce},
   vertexShader:'varying vec3 d;void main(){d=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:'varying vec3 d;uniform vec3 uHorizon,uZenith,uGround;void main(){float e=normalize(d).y;vec3 up=mix(uHorizon,uZenith,smoothstep(0.,.6,e));vec3 down=mix(uHorizon*.35,uGround,smoothstep(0.,-.3,e));gl_FragColor=vec4(e>0.?up:down,1.);}'}));
  envScene.add(envDome);
  const pmrem=new THREE.PMREMGenerator(renderer),envKey=new THREE.Color(-1,-1,-1);let envTarget:THREE.WebGLRenderTarget|null=null,envAge=Infinity;
  // The moon follows its sky arc (Daylight.ts moonDirection). FullMoon still draws the disc,
  // laid out in the default view: each frame the arc direction is projected to that view's
  // NDC. The x/y sliders offset the whole arc; size/brightness work as in other rooms.
  const moonView={eye:new THREE.Vector3(...VIEWS.user.position),f:new THREE.Vector3(),r:new THREE.Vector3(),u:new THREE.Vector3(),tan:Math.tan(THREE.MathUtils.degToRad(VIEWS.user.fov)/2)};
  moonView.f.copy(new THREE.Vector3(...VIEWS.user.target)).sub(moonView.eye).normalize();moonView.r.crossVectors(moonView.f,new THREE.Vector3(0,1,0)).normalize();moonView.u.crossVectors(moonView.r,moonView.f);
  const toNdc=(d:THREE.Vector3)=>{const z=d.dot(moonView.f);return z<=.08?null:{x:d.dot(moonView.r)/z/(moonView.tan*16/9),y:d.dot(moonView.u)/z/moonView.tan};};
  const at23=toNdc(moonDirection(23))!;
  const moon=installFullMoon({position:[...VIEWS.user.position],target:[...VIEWS.user.target],verticalFov:VIEWS.user.fov,enabled:!!SEABRIDGE_FULL_MOON,name:'seabridge-full-moon',
   defaults:{size:2.4,brightness:1,x:at23.x,y:at23.y},riseFrom:{x:0,y:0}});
  root.add(moon.mesh);
  const moonUser={...moon.defaults};
  let disposed=false;
  return {position:[...view.position],target:[...view.target],moonDefaults:moon.defaults,setMoon(settings){Object.assign(moonUser,settings);},cameraMode:'fixed-position',yawRange:Math.PI/12,
   get fov(){return typeof window!=='undefined'&&window.innerWidth<700?78:view.fov;},exposure:1.05,hasSimulation:false,waterMode:'',
   update(_dt,elapsed,state){
    const light=seabridgeDaylight(state);
    time.value=elapsed;day.value=light.level*(1-.75*light.night);sunU.value.copy(light.sun);tint.value.copy(light.tint);direct.value=light.solar+.4*light.night*light.moonUp;
    horizon.value.copy(light.horizon);zenith.value.copy(light.zenith);background.copy(light.horizon);
    skyUniforms.uGlow.value=.4+1.6*light.low;skyUniforms.uNight.value=light.night;
    skyUniforms.uDay.value=light.level*(1-light.night)*(1-.7*light.low);skyUniforms.uTime.value=elapsed;
    const ndc=toNdc(light.moonTrue);
    if(ndc)moon.setSettings({size:moonUser.size,brightness:moonUser.brightness,x:ndc.x+moonUser.x-moon.defaults.x,y:ndc.y+moonUser.y-moon.defaults.y});
    moon.update(light.night,_dt);
    if(!ndc)moon.mesh.visible=false; // behind the default view; below the horizon the sea hides it
    skyUniforms.uSunDisc.value.copy(light.sunTrue);skyUniforms.uSunDiscVis.value=light.sunUp*(1-light.night);
    const lightDir=light.sun.clone();
    sun.position.copy(sun.target.position).addScaledVector(lightDir,45);
    sunU.value.copy(lightDir); // sea glint and grass transmission follow the moon at night
    sun.color.copy(light.tint);sun.intensity=(2.5*light.solar*light.level+.35*light.night*light.moonUp)*(state.beamStrength??1);
    // Soil albedo ~(.26,.23,.18) lit by the sun: the warm light bounced up into shaded undersides.
    groundBounce.value.setRGB(.26,.23,.18).multiply(light.tint).multiplyScalar(.9*light.solar*light.level+.02);
    hemi.color.copy(light.horizon).lerp(new THREE.Color(1,1,1),.45);hemi.groundColor.copy(groundBounce.value).multiplyScalar(2.2).lerp(new THREE.Color('#3a352d'),.3);
    hemi.intensity=.06+.34*light.level*(1-light.night*.8);
    scene.environmentIntensity=.3*(.15+.85*light.solar);
    graybox.tubeMat.emissiveIntensity=2.4*light.lamp;
    for(const lamp of lamps)lamp.intensity=5*light.lamp;
    graybox.shelterLampMat.emissiveIntensity=2.2*light.lamp;stationLamp.intensity=4*light.lamp;
    envAge+=Math.max(0,_dt);
    if(envAge>=.2&&Math.abs(envKey.r-light.horizon.r)+Math.abs(envKey.g-light.horizon.g)+Math.abs(envKey.b-light.horizon.b)>.006){
     const next=pmrem.fromScene(envScene,0,.1,10);envTarget?.dispose();envTarget=next;envKey.copy(light.horizon);envAge=0;scene.environment=next.texture;sardines.setEnvironment(next.texture,1);
    }
    grass.update(elapsed);sardines.update(elapsed);
    renderer.shadowMap.enabled=true;
   },
   disturb(){},resetWater(){},
   dispose(){if(disposed)return;disposed=true;moon.dispose();if(envTarget&&scene.environment===envTarget.texture){scene.environment=oldEnvironment.map;scene.environmentIntensity=oldEnvironment.intensity;}sardines.dispose();envTarget?.dispose();pmrem.dispose();envDome.geometry.dispose();(envDome.material as THREE.Material).dispose();disposeModelResources(collectModelResources(root),['geometries','materials','textures']);sun.shadow.map?.dispose();root.removeFromParent();renderer.shadowMap.enabled=oldShadow.enabled;renderer.shadowMap.type=oldShadow.type;if(scene.background===background)scene.background=null;},
  };
 };
 return factory;
}
