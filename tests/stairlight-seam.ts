import * as THREE from 'three';
import {prepareStairlight} from '../src/places/stairlight/index.ts';
import {sampleTime} from '../src/systems/TimeOfDay.ts';
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(1);renderer.setSize(850,850);document.body.append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.03,100);
const place=(await prepareStairlight())(scene,renderer);renderer.toneMapping=place.toneMapping!;renderer.toneMappingExposure=place.exposure!;
camera.position.set(-.9,1.8,1);camera.lookAt(1.25,.4,-1.1);
const mode=document.querySelector<HTMLSelectElement>('#mode')!,bias=document.querySelector<HTMLSelectElement>('#bias')!;
const side=document.querySelector<HTMLSelectElement>('#side')!,normal=document.querySelector<HTMLSelectElement>('#normal')!;
const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,});
depth.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('packDepthToRGBA( fragCoordZ )','packDepthToRGBA( min(1., fragCoordZ + 1.5*max(abs(dFdx(fragCoordZ)),abs(dFdy(fragCoordZ)))) )');};
scene.traverse(o=>{if(o instanceof THREE.Mesh&&o.name==='StairlightSurface')o.customDepthMaterial=depth;});
const originals=new Map<THREE.MeshStandardMaterial,THREE.Texture|null>();
scene.traverse(o=>{if(o instanceof THREE.Mesh&&o.name==='StairlightSurface')for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial)originals.set(m,m.normalMap);});
function draw(){
 for(const [m,map] of originals){m.shadowSide=side.value==='back'?THREE.BackSide:side.value==='front'?THREE.FrontSide:THREE.DoubleSide;m.normalMap=normal.value==='flat'?null:map;m.needsUpdate=true;}
 place.update(0,0,{...sampleTime(6.5),beamStrength:1});
 const sun=scene.children.find(o=>o instanceof THREE.DirectionalLight) as THREE.DirectionalLight;
 if(mode.value==='sky')sun.intensity=0;
 if(mode.value==='sun')scene.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial)m.lightMapIntensity=0;});
 sun.shadow.normalBias=bias.value==='zero'?0:.002;sun.shadow.bias=bias.value==='zero'?0:bias.value==='tuned'?-.00001:-.00001;sun.shadow.needsUpdate=true;
 renderer.render(scene,camera);
}
mode.onchange=bias.onchange=side.onchange=normal.onchange=draw;draw();
window.addEventListener('pagehide',()=>{place.dispose();depth.dispose();renderer.dispose();},{once:true});
