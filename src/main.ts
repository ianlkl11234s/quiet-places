import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {preparePlace,places,moments,type PlaceId} from './places/catalog';
import {sampleTime,localHour,formatHour,momentName} from './systems/TimeOfDay';
import {createAudioSystem} from './systems/AudioSystem';
import {createMusicPlayer} from './systems/MusicPlayer';
import {loadPreferences,savePreferences} from './systems/Preferences';
import './style.css';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const status=el('status');
async function start(){
 const preferences=loadPreferences();
 const persist=()=>{savePreferences(preferences);};
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.4:1.75));
 renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 el('space').append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#080e11');
 const camera=new THREE.PerspectiveCamera(53,innerWidth/innerHeight,.1,700);
 let currentPlace:PlaceId=preferences.place;
 let place=(await preparePlace(currentPlace))(scene,renderer);
 camera.position.set(...place.position);
 const controls=new OrbitControls(camera,renderer.domElement);
 // Rotate around the skylight's vertical axis, keeping the room in the composition.
 controls.target.set(...place.target);controls.update();
 let homeAzimuth=controls.getAzimuthalAngle(),homePolar=controls.getPolarAngle();
 controls.minAzimuthAngle=homeAzimuth-place.yawRange;controls.maxAzimuthAngle=homeAzimuth+place.yawRange;
 controls.minPolarAngle=homePolar;controls.maxPolarAngle=homePolar;
 controls.enableZoom=false;controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.08;controls.rotateSpeed=.32;
 controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:null,RIGHT:null};
 controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:null};controls.saveState();
 renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','拖曳環繞天窗，範圍 90 度；左右方向鍵旋轉，Home 回到初始視角');
 renderer.domElement.addEventListener('keydown',e=>{
  if(exporting||!['ArrowLeft','ArrowRight','Home'].includes(e.key))return;e.preventDefault();
  if(e.key==='Home'){resetView();return;}
  const angle=THREE.MathUtils.clamp(controls.getAzimuthalAngle()+(e.key==='ArrowLeft'?-.08:.08),controls.minAzimuthAngle,controls.maxAzimuthAngle);
  const offset=camera.position.clone().sub(controls.target),radius=Math.hypot(offset.x,offset.z);
  camera.position.set(controls.target.x+Math.sin(angle)*radius,camera.position.y,controls.target.z+Math.cos(angle)*radius);controls.update();
 });

 const audio=createAudioSystem();
 const music=createMusicPlayer(el('music'),{volume:preferences.volume,onVolumeChange:value=>{preferences.volume=value;persist();}});
 const raycaster=new THREE.Raycaster(),waterPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-6.985),hit=new THREE.Vector3();
 let waterDown: {x:number;y:number;id:number}|undefined;
 renderer.domElement.addEventListener('pointerdown',e=>{if(e.isPrimary&&e.button===0)waterDown={x:e.clientX,y:e.clientY,id:e.pointerId};});
 renderer.domElement.addEventListener('pointercancel',()=>{waterDown=undefined;});
 renderer.domElement.addEventListener('pointerup',e=>{
  const start=waterDown;waterDown=undefined;if(currentPlace!=='waterlight')return;if(!start||start.id!==e.pointerId||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)return;
  const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
  if(raycaster.ray.intersectPlane(waterPlane,hit)){const u=hit.x/3.6+.5,v=.5-(hit.z+.2)/3.6;if(u>0&&u<1&&v>0&&v<1)place.disturb(u,v);}
 });
 const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
 const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.19,.65,1.05);composer.addPass(bloom);composer.addPass(new OutputPass());
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');let paused=reduce.matches,elapsed=0,last=performance.now(),raf=0,lost=false;
 let beamStrength=preferences.beamStrength;
 let hour=preferences.live?localHour():preferences.hour,live=preferences.live;let state=sampleTime(hour);
 const panel=el('settings'),toggle=el<HTMLButtonElement>('settings-toggle'),pause=el<HTMLButtonElement>('pause');
 let switching=false,exporting=false,switchId=0;
 const placeSelect=el<HTMLSelectElement>('place-select');placeSelect.value=currentPlace;
 function describePlace(){
  const isWater=currentPlace==='waterlight';
  el('water-options').hidden=!isWater;
  el('water-reset').hidden=!isWater;
  el('water-mode').textContent=place.waterMode;
  el<HTMLButtonElement>('water-reset').disabled=!place.hasSimulation;
  el('water-hint').textContent=isWater?(place.hasSimulation?'輕點天窗產生漣漪。拖曳環繞，左右各 45°。':'拖曳環繞天窗，左右各 45°。'):'拖曳微調視角，左右各 15°。錦鯉貼近地面游動。';
  renderer.domElement.setAttribute('aria-label',isWater?'拖曳環繞天窗，左右各45度；方向鍵旋轉，Home重設':'拖曳觀看窗景，左右各15度；方向鍵旋轉，Home重設');
  weatherLabels();document.title=`${el('place-title').textContent} · Quiet Places`;el('space').setAttribute('aria-label',`${el('place-title').textContent}：即時生成的靜謐空間`);
 }
 function homeCamera(){
  controls.enableDamping=false;controls.update();
  controls.minAzimuthAngle=-Infinity;controls.maxAzimuthAngle=Infinity;controls.minPolarAngle=0;controls.maxPolarAngle=Math.PI;
  camera.position.set(...place.position);controls.target.set(...place.target);controls.update();
  homeAzimuth=controls.getAzimuthalAngle();homePolar=controls.getPolarAngle();
  controls.minAzimuthAngle=homeAzimuth-place.yawRange;controls.maxAzimuthAngle=homeAzimuth+place.yawRange;
  controls.minPolarAngle=homePolar;controls.maxPolarAngle=homePolar;controls.saveState();controls.enableDamping=!reduce.matches;
 }
 async function switchPlace(id:PlaceId,save=true){
  const token=++switchId;switching=true;
  if(!exporting){status.hidden=false;status.textContent='正在走進另一個空間。';}
  try{
   const factory=await preparePlace(id);if(token!==switchId)return;
   place.dispose();place=factory(scene,renderer);currentPlace=id;
   homeCamera();elapsed=0;state=sampleTime(hour);
   placeSelect.value=id;if(save){preferences.place=id;persist();}
   describePlace();
  }catch(error){
   console.error(error);status.hidden=false;status.textContent='場景暫時無法載入，請重新整理後重試。';
   throw error;
  }finally{if(token===switchId){switching=false;if(!exporting)status.hidden=true;requestRender();}}
 }
 placeSelect.addEventListener('change',()=>{if(!exporting)void switchPlace(placeSelect.value as PlaceId).catch(()=>{status.hidden=false;});});
 el('water-reset').addEventListener('click',()=>place.resetWater());
 const range=el<HTMLInputElement>('hour'),liveInput=el<HTMLInputElement>('live');
 liveInput.checked=live;
 const beamInput=el<HTMLInputElement>('beam-strength');beamInput.value=String(beamStrength*100);el('beam-value').textContent=`${Math.round(beamStrength*100)}%`;
 const weather=el<HTMLSelectElement>('weather'),quality=el<HTMLSelectElement>('quality'),rainInput=el<HTMLInputElement>('rain-intensity');
 weather.value=preferences.weather;quality.value=preferences.quality;rainInput.value=String(preferences.rainIntensity*100);
 function weatherLabels(){el('rain-controls').hidden=preferences.weather!=='rain';el('rain-value').textContent=`${Math.round(preferences.rainIntensity*100)}%`;el('place-title').textContent=currentPlace==='waterlight'?(preferences.weather==='rain'?'雨落水面':'水光之間'):places.find(p=>p.id===currentPlace)!.name;}
 describePlace();
 weather.addEventListener('change',()=>{preferences.weather=weather.value==='rain'?'rain':'clear';place.resetWater();weatherLabels();persist();requestRender();});
 quality.addEventListener('change',()=>{preferences.quality=quality.value==='low'?'low':'standard';resize();persist();});
 rainInput.addEventListener('input',()=>{preferences.rainIntensity=Number(rainInput.value)/100;weatherLabels();persist();requestRender();});
 function updateLabels(){el('time-label').textContent=formatHour(hour);el('hour-value').textContent=formatHour(hour);el('moment-label').textContent=momentName(hour);range.value=String(hour);pause.textContent=paused?'繼續流動':'暫停流動';pause.setAttribute('aria-pressed',String(paused));}
 function setPanel(open:boolean){panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));document.body.classList.remove('resting');if(open)el('close-settings').focus();else toggle.focus();}
 function resetView(){controls.enableDamping=false;controls.update();controls.reset();controls.enableDamping=!reduce.matches;}
 el('reset-view').addEventListener('click',resetView);
 toggle.addEventListener('click',()=>setPanel(panel.hidden));el('close-settings').addEventListener('click',()=>setPanel(false));
 document.addEventListener('keydown',e=>{wake();if(e.key==='Escape'&&!panel.hidden)setPanel(false)});
 el<HTMLInputElement>('beam-strength').addEventListener('input',e=>{const value=Number((e.target as HTMLInputElement).value);beamStrength=value/100;preferences.beamStrength=beamStrength;persist();el('beam-value').textContent=`${value}%`;requestRender();});
 range.addEventListener('input',()=>{hour=+range.value;live=false;liveInput.checked=false;preferences.hour=hour;preferences.live=false;persist();updateLabels();requestRender();});
 document.querySelectorAll<HTMLButtonElement>('[data-hour]').forEach(button=>button.addEventListener('click',()=>{hour=+button.dataset.hour!;live=false;liveInput.checked=false;preferences.hour=hour;preferences.live=false;persist();updateLabels();requestRender();}));
 liveInput.addEventListener('change',()=>{live=liveInput.checked;if(live)hour=localHour();else preferences.hour=hour;preferences.live=live;persist();updateLabels();requestRender();});
 pause.addEventListener('click',()=>{paused=!paused;updateLabels();requestRender();});
 reduce.addEventListener('change',e=>{paused=e.matches;updateLabels();requestRender();});
 el('audio').addEventListener('click',async()=>{try{const on=await audio.toggle();el('audio').textContent=on?'關閉環境聲':'開啟環境聲';el('audio').setAttribute('aria-pressed',String(on));}catch{status.hidden=false;status.textContent='環境聲暫時無法開啟，仍可靜靜觀賞。';}});
 el('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{status.hidden=false;status.textContent='此瀏覽器不支援全螢幕，請使用一般視窗觀賞。';}});
 document.addEventListener('fullscreenchange',()=>{el('fullscreen').textContent=document.fullscreenElement?'離開全螢幕':'全螢幕'});
 let idle=0;function wake(){document.body.classList.remove('resting');clearTimeout(idle);idle=window.setTimeout(()=>{if(panel.hidden&&!document.querySelector(':focus-visible'))document.body.classList.add('resting')},6500)}
 document.addEventListener('pointermove',wake);document.addEventListener('pointerdown',wake);document.addEventListener('focusin',wake);
 const gallery=el('series-gallery');
 const galleryImages=el('series-images');
 const imageUrls:string[]=[];
 const galleryBackground=Array.from(document.querySelectorAll<HTMLElement>('#space,header,footer,#settings'));
 function galleryInert(value:boolean){galleryBackground.forEach(element=>{element.inert=value;});}
 function closeGallery(){gallery.hidden=true;galleryInert(false);audio.visibility(document.hidden);music.visibility(document.hidden);requestRender();el('export-series').focus();}
 el('close-gallery').addEventListener('click',closeGallery);
 document.addEventListener('keydown',event=>{if(gallery.hidden)return;if(event.key==='Escape')closeGallery();if(event.key==='Tab'){const links=Array.from(gallery.querySelectorAll<HTMLElement>('a[href],button'));const first=links[0],last=links[links.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
 let dirtyUntil=0,rendering=false;
 function requestRender(){
  dirtyUntil=performance.now()+650;
  if(!raf&&!rendering&&!exporting&&gallery.hidden&&!document.hidden&&!lost){last=performance.now();raf=requestAnimationFrame(frame);}
 }
 // Paused scenes redraw only after input; a short tail lets orbit damping settle.
 controls.addEventListener('change',requestRender);
 document.addEventListener('input',requestRender);
 document.addEventListener('click',requestRender);
 function resize(){
  camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<700?64:53;camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio,preferences.quality==='low'?1:innerWidth<700?1.25:1.5));
  renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);requestRender();
 }
 window.addEventListener('resize',resize);resize();
 function frame(now:number){
  raf=0;if(document.hidden||lost||exporting||!gallery.hidden)return;
  const interval=1000/(preferences.quality==='low'?24:30);
  if(now-last<interval-.5){raf=requestAnimationFrame(frame);return;}
  rendering=true;
  const dt=Math.min((now-last)/1000,.05);last=now;
  if(live){const next=localHour();const changed=Math.floor(next*60)!==Math.floor(hour*60);hour=next;if(changed)updateLabels();}
  const target=sampleTime(hour),ease=paused?1:1-Math.exp(-dt*1.5);
  for(const key of ['intensity','warmth','angle','activity'] as const)state[key]+=(target[key]-state[key])*ease;
  const rainy=currentPlace==='waterlight'&&preferences.weather==='rain';
  const lighting=rainy?{...state,intensity:state.intensity*.72,warmth:state.warmth*.45}:state;
  if(!paused&&!switching)elapsed+=dt;
  place.update(paused||switching?0:dt,elapsed,{...lighting,beamStrength,rain:rainy?preferences.rainIntensity:0,lowQuality:preferences.quality==='low'});
  controls.enableDamping=!reduce.matches;controls.update();composer.render();rendering=false;
  if(!paused||now<dirtyUntil)raf=requestAnimationFrame(frame);
 }
 const exportButton=el<HTMLButtonElement>('export-series');
 exportButton.addEventListener('click',async()=>{
  if(exporting||switching)return;
  exporting=true;exportButton.disabled=true;placeSelect.disabled=true;controls.enabled=false;
  cancelAnimationFrame(raf);raf=0;audio.visibility(true);music.visibility(true);
  const inputStates=Array.from(panel.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement>('input,button,select')).map(input=>({input,disabled:input.disabled}));
  inputStates.forEach(({input})=>{input.disabled=true;});
  const saved={id:currentPlace,hour,elapsed,position:camera.position.clone(),target:controls.target.clone()};
  const files:Record<string,Uint8Array>={};
  imageUrls.forEach(url=>URL.revokeObjectURL(url));imageUrls.length=0;galleryImages.replaceChildren();
  try{
   const {zipSync}=await import('three/addons/libs/fflate.module.js');
   let completed=0;
   for(const id of ['leaflight','oceanlight'] as const){
    await switchPlace(id,false);
    renderer.setPixelRatio(1);renderer.setSize(1024,1536,false);composer.setPixelRatio(1);composer.setSize(1024,1536);
    camera.aspect=1024/1536;camera.fov=58;camera.updateProjectionMatrix();
    for(const moment of moments){
     if(document.hidden||lost)throw new Error('輸出已暫停，請保持頁面在前景後重試。');
     status.hidden=false;status.textContent=`輸出 ${++completed} / 8 · ${places.find(p=>p.id===id)!.name} · ${moment.name}`;
     // Seeded geometry, frozen elapsed and exact keyframes make the series comparable.
     place.update(0,12,{...sampleTime(moment.hour),beamStrength:1,lowQuality:false});
     composer.render();
     const blob=await new Promise<Blob>((resolve,reject)=>renderer.domElement.toBlob(value=>value?resolve(value):reject(new Error('圖片輸出失敗。')),'image/png'));
     const filename=`${id}-${moment.id}.png`;
     files[filename]=new Uint8Array(await blob.arrayBuffer());
     const imageUrl=URL.createObjectURL(blob);imageUrls.push(imageUrl);
     const figure=document.createElement('figure');const image=document.createElement('img');image.src=imageUrl;image.alt=`${places.find(p=>p.id===id)!.name} · ${moment.name}`;image.width=1024;image.height=1536;
     const caption=document.createElement('figcaption');const download=document.createElement('a');download.href=imageUrl;download.download=filename;download.textContent=`${image.alt} · PNG`;caption.append(download);figure.append(image,caption);galleryImages.append(figure);
     await new Promise<void>(resolve=>setTimeout(resolve,40));
    }
   }
   const archive=zipSync(files,{level:0});
   const url=URL.createObjectURL(new Blob([archive as Uint8Array<ArrayBuffer>],{type:'application/zip'}));
   imageUrls.push(url);const link=el<HTMLAnchorElement>('download-series');link.href=url;link.download='quiet-places-eight-moments.zip';gallery.hidden=false;galleryInert(true);el('close-gallery').focus();
   el('export-message').textContent='八張圖片已備妥，可預覽或下載。';
  }catch(error){el('export-message').textContent=error instanceof Error?error.message:'圖片輸出失敗，請重試。';}
  finally{
   try{await switchPlace(saved.id,false);hour=saved.hour;elapsed=saved.elapsed;camera.position.copy(saved.position);controls.target.copy(saved.target);controls.update();}
   finally{exporting=false;inputStates.forEach(({input,disabled})=>{input.disabled=disabled;});controls.enabled=true;exportButton.disabled=false;placeSelect.disabled=false;status.hidden=true;if(gallery.hidden){audio.visibility(document.hidden);music.visibility(document.hidden);}resize();updateLabels();requestRender();}
  }
 });
 document.addEventListener('visibilitychange',()=>{
  cancelAnimationFrame(raf);raf=0;audio.visibility(document.hidden||!gallery.hidden);music.visibility(document.hidden||!gallery.hidden);
  if(!document.hidden&&!lost)requestRender();
 });
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(raf);status.hidden=false;status.textContent='繪圖連線暫時中斷，請重新整理此頁。'});
 window.addEventListener('pagehide',(event)=>{if(event.persisted)return;cancelAnimationFrame(raf);void audio.dispose();music.dispose();imageUrls.forEach(url=>URL.revokeObjectURL(url));place.dispose();controls.dispose();composer.dispose();renderer.dispose()},{once:true});
 updateLabels();wake();status.hidden=true;requestRender();
}
void start().catch(error=>{console.error(error);status.hidden=false;status.textContent='這個空間需要 WebGL 2。請開啟瀏覽器硬體加速後重新整理，或換用支援的瀏覽器。';});
