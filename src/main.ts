import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {createEnvironment} from './world/Environment';
import {createFishSchool} from './world/FishSchool';
import {sampleTime,localHour,formatHour,momentName} from './systems/TimeOfDay';
import {createAudioSystem} from './systems/AudioSystem';
import './style.css';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const status=el('status');
function start(){
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.4:1.75));
 renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 el('space').append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#080e11');
 const camera=new THREE.PerspectiveCamera(53,innerWidth/innerHeight,.1,60);
 const base=new THREE.Vector3(2.6,2.3,9.5);camera.position.copy(base);camera.lookAt(-.25,3.4,-.8);
 const env=createEnvironment(scene);const fish=createFishSchool(scene);const audio=createAudioSystem();
 const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
 const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.19,.65,1.05);composer.addPass(bloom);composer.addPass(new OutputPass());
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');let paused=reduce.matches,elapsed=0,last=performance.now(),raf=0,lost=false;
 let hour=14,live=false;let state=sampleTime(hour);const pointer=new THREE.Vector2();
 const panel=el('settings'),toggle=el<HTMLButtonElement>('settings-toggle'),pause=el<HTMLButtonElement>('pause');
 const range=el<HTMLInputElement>('hour'),liveInput=el<HTMLInputElement>('live');
 function updateLabels(){el('time-label').textContent=formatHour(hour);el('hour-value').textContent=formatHour(hour);el('moment-label').textContent=momentName(hour);range.value=String(hour);pause.textContent=paused?'繼續流動':'暫停流動';pause.setAttribute('aria-pressed',String(paused));}
 function setPanel(open:boolean){panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));document.body.classList.remove('resting');if(open)el('close-settings').focus();else toggle.focus();}
 toggle.addEventListener('click',()=>setPanel(panel.hidden));el('close-settings').addEventListener('click',()=>setPanel(false));
 document.addEventListener('keydown',e=>{wake();if(e.key==='Escape'&&!panel.hidden)setPanel(false)});
 range.addEventListener('input',()=>{hour=+range.value;live=false;liveInput.checked=false;updateLabels();});
 document.querySelectorAll<HTMLButtonElement>('[data-hour]').forEach(button=>button.addEventListener('click',()=>{hour=+button.dataset.hour!;live=false;liveInput.checked=false;updateLabels();}));
 liveInput.addEventListener('change',()=>{live=liveInput.checked;if(live)hour=localHour();updateLabels();});
 pause.addEventListener('click',()=>{paused=!paused;updateLabels();});
 reduce.addEventListener('change',e=>{paused=e.matches;updateLabels();});
 el('audio').addEventListener('click',async()=>{try{const on=await audio.toggle();el('audio').textContent=on?'關閉環境聲':'開啟環境聲';el('audio').setAttribute('aria-pressed',String(on));}catch{status.hidden=false;status.textContent='環境聲暫時無法開啟，仍可靜靜觀賞。';}});
 el('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{status.hidden=false;status.textContent='此瀏覽器不支援全螢幕，請使用一般視窗觀賞。';}});
 document.addEventListener('fullscreenchange',()=>{el('fullscreen').textContent=document.fullscreenElement?'離開全螢幕':'全螢幕'});
 let idle=0;function wake(){document.body.classList.remove('resting');clearTimeout(idle);idle=window.setTimeout(()=>{if(panel.hidden&&!document.querySelector(':focus-visible'))document.body.classList.add('resting')},6500)}
 document.addEventListener('pointermove',e=>{pointer.set((e.clientX/innerWidth-.5)*2,(e.clientY/innerHeight-.5)*2);wake()});document.addEventListener('pointerdown',wake);document.addEventListener('focusin',wake);
 function resize(){camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<700?64:53;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.4:1.75));renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight)}
 window.addEventListener('resize',resize);resize();
 function frame(now:number){if(document.hidden||lost)return;const dt=Math.min((now-last)/1000,.05);last=now;if(live){hour=localHour();updateLabels()}
 const target=sampleTime(hour),ease=paused?1:1-Math.exp(-dt*1.5);for(const key of ['intensity','warmth','angle','activity'] as const)state[key]+=(target[key]-state[key])*ease;
 fish.update(paused?0:dt,elapsed,state);if(!paused){elapsed+=dt;}env.update(elapsed,state);
 const px=paused?0:pointer.x*.075,py=paused?0:pointer.y*.045;if(!paused)camera.position.lerp(new THREE.Vector3(base.x+px,base.y-py,base.z),.03);camera.lookAt(-.25,3.4,-.8);
 composer.render();raf=requestAnimationFrame(frame);
 }
 document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(raf);audio.visibility(document.hidden);if(!document.hidden&&!lost){last=performance.now();raf=requestAnimationFrame(frame)}});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(raf);status.hidden=false;status.textContent='繪圖連線暫時中斷，請重新整理此頁。'});
 window.addEventListener('pagehide',(event)=>{if(event.persisted)return;cancelAnimationFrame(raf);void audio.dispose();fish.dispose();env.dispose();composer.dispose();renderer.dispose()},{once:true});
 updateLabels();wake();status.hidden=true;raf=requestAnimationFrame(frame);
}
try{start()}catch(error){console.error(error);status.hidden=false;status.textContent='這個空間需要 WebGL 2。請開啟瀏覽器硬體加速後重新整理，或換用支援的瀏覽器。';}
