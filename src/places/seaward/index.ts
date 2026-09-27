import * as THREE from 'three';
import type {PlaceFactory} from '../../player/contracts.ts';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';
import {seawardDaylight} from './Daylight.ts';
import {createGrass} from './Grass.ts';
import {prepareTunnelRay} from './Stingray.ts';
import {tunnelMaterial,seaMaterial} from './Materials.ts';
import {installFullMoon} from '../../shared/sky/FullMoon.ts';

/** Mid-Autumn candidate switch: 0 restores the confirmed moonless night sky. */
const SEAWARD_FULL_MOON = 1;
/** 1: moonlight comes from the moon as shown (follows its rise and the sliders); 0: the authored Daylight.ts moon path. */
const SEAWARD_MOONLIGHT_FOLLOWS_MOON = 1;

export async function prepareSeaward():Promise<PlaceFactory>{
 const createRay=await prepareTunnelRay();
 const factory:PlaceFactory=(scene,renderer)=>{
  const root=new THREE.Group();root.name='seaward-tunnel';scene.add(root);
  const time={value:0},day={value:1},beam={value:1},sun={value:new THREE.Vector3()},tint={value:new THREE.Color()},direct={value:1};
  const horizon={value:new THREE.Color()},zenith={value:new THREE.Color()};
  const wall=tunnelMaterial('wall',time,day,beam,sun,tint,direct,horizon),floor=tunnelMaterial('floor',time,day,beam,sun,tint,direct,horizon),ceiling=tunnelMaterial('ceiling',time,day,beam,sun,tint,direct,horizon);
  const box=(name:string,size:[number,number,number],pos:[number,number,number],material:THREE.Material)=>{
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.name=name;mesh.position.set(...pos);root.add(mesh);return mesh;
  };
  box('wet-concrete-floor',[7.4,.22,23],[0,-.11,-.5],floor);
  box('left-wall',[.35,4.5,20],[-3.575,2.1,-1],wall);
  box('right-wall',[.35,4.5,20],[3.575,2.1,-1],wall);
  box('low-ceiling',[7.5,.3,20],[0,4.35,-1],ceiling);
  box('seaward-parapet',[15,.62,.4],[0,.16,-13.6],wall);
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(1100,1000),seaMaterial(time,day,sun,tint,direct,horizon,zenith));ocean.rotation.x=-Math.PI/2;ocean.position.set(0,-.32,-513);root.add(ocean);
  const skyShell=new THREE.Mesh(new THREE.SphereGeometry(600,24,12),new THREE.ShaderMaterial({
   side:THREE.BackSide,depthWrite:false,uniforms:{uHorizon:horizon,uZenith:zenith},
   vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`varying vec3 direction;uniform vec3 uHorizon,uZenith;void main(){float elevation=max(normalize(direction).y,0.);vec3 color=mix(uHorizon,uZenith,smoothstep(0.,.65,elevation));gl_FragColor=vec4(color,1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   }`}));skyShell.renderOrder=-100;root.add(skyShell);
  const mountainMaterial=new THREE.MeshBasicMaterial({color:'#abb9bb',fog:false});
  for(const [x,z,w,h] of [[-170,-430,210,12],[120,-390,200,23],[270,-440,180,35]]){
   const shape=new THREE.Shape();shape.moveTo(-w/2,0);
   for(let i=0;i<=40;i++){const t=i/40;shape.lineTo((t-.5)*w,Math.pow(Math.sin(t*Math.PI),1.8)*h*(.82+.12*Math.sin(t*17.)+.06*Math.cos(t*31.)));}
   shape.lineTo(w/2,0);shape.closePath();const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),mountainMaterial);mesh.position.set(x,-.3,z);root.add(mesh);
  }
  const metal=new THREE.MeshStandardMaterial({color:'#343c3e',roughness:.73,metalness:.55});
  const pipe=(a:THREE.Vector3,b:THREE.Vector3,r:number)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,a.distanceTo(b),8),metal);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());root.add(mesh);};
  pipe(new THREE.Vector3(3.22,1.05,7),new THREE.Vector3(3.22,1.05,-10.8),.035);
  for(let z=-10;z<8;z+=2)pipe(new THREE.Vector3(3.22,1.05,z),new THREE.Vector3(3.4,.90,z),.022);
  const grass=createGrass(day);root.add(grass.group);
  const sky=new THREE.HemisphereLight('#b7cbd6','#292623',.14);root.add(sky);
  const opening=new THREE.PointLight('#e3e7df',65,35,2);opening.position.set(1.7,3.1,-12);root.add(opening);
  const ray=createRay(root);
  const shadowMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uOpacity:{value:.14}},
   vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:'varying vec2 v;uniform float uOpacity;void main(){float r=length((v-.5)*2.);gl_FragColor=vec4(0.,0.,0.,(1.-smoothstep(.1,1.,r))*uOpacity);}'});
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.1),shadowMaterial);shadow.rotation.x=-Math.PI/2;root.add(shadow);
  const visitor=root.getObjectByName('tunnel-stingray')!;
  const background=new THREE.Color('#c0ccd0');scene.background=background;
  // Q1-2: weak image-based bounce for standard materials (handrail, ray, grass).
  // A low-res PMREM of the same time-driven sky over a dark tunnel-coloured
  // lower hemisphere; regenerated only when the sky colour moves, at most 5×/s.
  const envScene=new THREE.Scene(),envDome=new THREE.Mesh(new THREE.SphereGeometry(1,24,12),new THREE.ShaderMaterial({
   side:THREE.BackSide,depthWrite:false,uniforms:{uHorizon:horizon,uZenith:zenith},
   vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:'varying vec3 direction;uniform vec3 uHorizon,uZenith;void main(){float e=normalize(direction).y;vec3 up=mix(uHorizon,uZenith,smoothstep(0.,.65,e));vec3 down=mix(uHorizon*.30,uHorizon*.06,smoothstep(0.,-.35,e));gl_FragColor=vec4(e>0.?up:down,1.);}'}));
  envScene.add(envDome);
  const pmrem=new THREE.PMREMGenerator(renderer),envKey=new THREE.Color(-1,-1,-1),oldEnvironment={map:scene.environment,intensity:scene.environmentIntensity};
  let envTarget:THREE.WebGLRenderTarget|null=null,envAge=Infinity;
  // Rises out of the sea (hidden by the ocean's depth) to the upper right of the opening.
  const moon=installFullMoon({position:[2.6,1.35,2.8],target:[-1.6,1.5,-11],verticalFov:53,enabled:!!SEAWARD_FULL_MOON,name:'seaward-full-moon',
   defaults:{size:2.4,brightness:1,x:.30,y:.29},riseFrom:{x:-.06,y:-.40}});
  root.add(moon.mesh);
  let disposed=false;
  return {position:[2.6,1.35,2.8],target:[-1.6,1.5,-11],moonDefaults:moon.defaults,setMoon(settings){moon.setSettings(settings);},cameraMode:'fixed-position',yawRange:Math.PI/12,get fov(){return typeof window!=='undefined'&&window.innerWidth<700?90:53;},exposure:1.15,hasSimulation:false,waterMode:'',
   update(_dt,elapsed,state){
    const light=seawardDaylight(state);
    const night=light.moonlight/.5;moon.update(night,_dt);
    sun.value.copy(light.sun);tint.value.copy(light.tint);direct.value=light.direct;
    if(SEAWARD_MOONLIGHT_FOLLOWS_MOON&&moon.mesh.visible){
     // Turn the opening's light toward the moon with its fade-in and rise; a moon
     // still low over the sea gives weaker light than a risen one.
     sun.value.lerp(moon.direction,THREE.MathUtils.smoothstep(night,.2,1)).normalize();
     direct.value=light.solar+light.moonlight*(.45+.55*moon.risen);
    }
    time.value=elapsed;beam.value=state.beamStrength??1;
    day.value=.10+.90*Math.min(1,Math.max(0,state.intensity));
    horizon.value.copy(light.horizon);zenith.value.copy(light.zenith);
    background.copy(light.horizon);
    opening.intensity=65*day.value;opening.color.copy(tint.value);
    opening.position.x=THREE.MathUtils.clamp(sun.value.x/-sun.value.z*4,-3,3);opening.position.y=1+sun.value.y*3;
    sky.intensity=.14*day.value;
    // Distant ridges sit in the same air as the horizon: a slightly darker, bluer share of it.
    mountainMaterial.color.copy(light.horizon).lerp(light.zenith,.3).multiplyScalar(.9);
    envAge+=Math.max(0,_dt);
    if(envAge>=.2&&Math.abs(envKey.r-light.horizon.r)+Math.abs(envKey.g-light.horizon.g)+Math.abs(envKey.b-light.horizon.b)>.006){
     const next=pmrem.fromScene(envScene,0,.1,10);envTarget?.dispose();envTarget=next;envKey.copy(light.horizon);envAge=0;scene.environment=next.texture;
    }
    // Cap .30; follows the sun, so moonlight leaves only a trace on a dark-blue dome.
    scene.environmentIntensity=.30*(.12+.88*light.solar);
    grass.update(elapsed);ray.update(elapsed,day.value);
    shadow.position.set(visitor.position.x,.012,visitor.position.z);shadow.scale.setScalar(1+visitor.position.y*.25);shadowMaterial.uniforms.uOpacity.value=.16/(1+visitor.position.y);
   },
   disturb(){},resetWater(){},dispose(){if(disposed)return;disposed=true;if(envTarget&&scene.environment===envTarget.texture){scene.environment=oldEnvironment.map;scene.environmentIntensity=oldEnvironment.intensity;}envTarget?.dispose();pmrem.dispose();envDome.geometry.dispose();(envDome.material as THREE.Material).dispose();ray.dispose();moon.dispose();disposeModelResources(collectModelResources(root),['geometries','materials','textures']);root.removeFromParent();if(scene.background===background)scene.background=null;},
  };
 };
 return Object.assign(factory,{dispose:createRay.dispose});
}
