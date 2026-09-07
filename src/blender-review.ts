import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {prepareLeaflight} from './places/leaflight/index.ts';
import type {PlaceInstance} from './player/contracts.ts';
import {sampleTime} from './systems/TimeOfDay.ts';

const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const wrap=document.querySelector<HTMLElement>('.canvas-wrap')!;
const status=el('status'),exportButton=el<HTMLButtonElement>('export');
const shadows=el<HTMLInputElement>('shadows'),bounce=el<HTMLInputElement>('sky-fill');
const pause=el<HTMLButtonElement>('pause'),beam=el<HTMLInputElement>('beam');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;
wrap.append(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(76,2/3,.1,200);
let place:PlaceInstance|undefined,controls:OrbitControls|undefined;
let raf=0,last=0,elapsed=0,frames=0,disposed=false;
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
let paused=reduce.matches;

function render(){
  if(!place||disposed||document.hidden)return;
  place.update(0,elapsed,{...sampleTime(14),beamStrength:Number(beam.value),lowQuality:false});
  if(!bounce.checked)scene.traverse(o=>{
    if(o instanceof THREE.Mesh&&o.name==='RoomSurface'){
      for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial)m.lightMapIntensity=0;
    }
  });
  renderer.render(scene,camera);
  wrap.dataset.frames=String(++frames);wrap.dataset.elapsed=elapsed.toFixed(3);
}
function frame(now:number){
  raf=0;if(paused||document.hidden||disposed)return;
  if(!last)last=now;
  if(now-last>=1000/30){elapsed+=Math.min((now-last)/1000,.1);last=now;render();}
  raf=requestAnimationFrame(frame);
}
function startClock(){if(!raf&&!paused&&!document.hidden&&!disposed){last=0;raf=requestAnimationFrame(frame);}}
function pauseLabel(){pause.textContent=paused?'繼續微風':'暫停微風';pause.setAttribute('aria-pressed',String(paused));}
function resize(){
  renderer.setSize(wrap.clientWidth,wrap.clientHeight,false);
  camera.aspect=wrap.clientWidth/wrap.clientHeight;camera.updateProjectionMatrix();render();
}
async function load(){
  status.textContent='正在準備枝葉、石材與光線。';exportButton.disabled=true;
  try{
    const factory=await prepareLeaflight();
    if(disposed){factory.dispose();return;}
    place=factory(scene,renderer);
    renderer.toneMapping=place.toneMapping??THREE.AgXToneMapping;
    renderer.toneMappingExposure=place.exposure??1;
    camera.position.set(...place.position);camera.fov=place.fov??76;
    controls=new OrbitControls(camera,renderer.domElement);
    controls.target.set(...place.target);controls.enablePan=false;controls.enableZoom=false;controls.enableDamping=false;controls.update();
    const azimuth=controls.getAzimuthalAngle(),polar=controls.getPolarAngle();
    controls.minAzimuthAngle=azimuth-place.yawRange;controls.maxAzimuthAngle=azimuth+place.yawRange;
    controls.minPolarAngle=controls.maxPolarAngle=polar;controls.saveState();
    controls.addEventListener('change',()=>{if(paused)render();});
    resize();pauseLabel();startClock();exportButton.disabled=false;
    status.textContent='午後微風 · 枝葉、葉影與光束同步變化。拖曳環繞，Home 回到主鏡頭。';
  }catch(error){
    status.textContent=error instanceof Error?error.message:'場景載入失敗。';
    const retry=document.createElement('button');retry.textContent='重試載入';
    retry.onclick=()=>{retry.remove();void load();};status.append(retry);
  }
}
shadows.addEventListener('change',()=>{
  renderer.shadowMap.enabled=shadows.checked;
  scene.traverse(o=>{
    if(o instanceof THREE.DirectionalLight)o.castShadow=shadows.checked;
    if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.needsUpdate=true;
  });render();
});
bounce.addEventListener('change',render);beam.addEventListener('input',render);
pause.addEventListener('click',()=>{paused=!paused;cancelAnimationFrame(raf);raf=0;pauseLabel();render();startClock();});
reduce.addEventListener('change',event=>{paused=event.matches;cancelAnimationFrame(raf);raf=0;pauseLabel();render();startClock();});
exportButton.addEventListener('click',()=>{
  render();renderer.domElement.toBlob(blob=>{
    if(!blob)return;const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='leaflight-dynamic.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },'image/png');
});
window.addEventListener('resize',resize);
document.addEventListener('keydown',event=>{if(event.key==='Home'){event.preventDefault();controls?.reset();render();}});
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(raf);raf=0;if(!document.hidden){render();startClock();}});
window.addEventListener('pagehide',event=>{if(event.persisted){cancelAnimationFrame(raf);raf=0;return;}disposed=true;cancelAnimationFrame(raf);controls?.dispose();place?.dispose();renderer.dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted){render();startClock();}});
void load();
