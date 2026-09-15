import * as THREE from 'three';
import {prepareLastArcade} from '../src/places/last-arcade/index.ts';
import {sampleTime} from '../src/systems/TimeOfDay.ts';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const status=document.getElementById('status')!;
async function run(){
 const query=new URLSearchParams(location.search),hour=Number(query.get('hour')??14),elapsed=12;
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(1.25);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
 document.body.append(renderer.domElement);
 const scene=new THREE.Scene(),place=(await prepareLastArcade())(scene,renderer);
 renderer.toneMapping=place.toneMapping??THREE.AgXToneMapping;renderer.toneMappingExposure=place.exposure??1;
 const camera=new THREE.PerspectiveCamera(place.fov,innerWidth/innerHeight,.1,700);camera.position.set(...place.position);camera.lookAt(...place.target);
 const composer=new EffectComposer(renderer);composer.renderTarget1.samples=composer.renderTarget2.samples=4;
 composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.19,.65,1.05));composer.addPass(new OutputPass());
 const render=()=>{place.update(0,elapsed,{...sampleTime(hour),lowQuality:false});composer.render();status.textContent=`${innerWidth}×${innerHeight} · ${hour}:00 · elapsed ${elapsed}s`;status.dataset.ready='true';};
 render();addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();render();});
 addEventListener('pagehide',()=>{place.dispose();composer.dispose();renderer.dispose();},{once:true});
}
run().catch(error=>{status.textContent=String(error);status.dataset.ready='error';console.error(error);});
