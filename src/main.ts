import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {waterOrbitLimits,waterCameraClearance} from './places/waterlight/Room.ts';
import {preparePlace,places,moments,isPlaceId,type PlaceId} from './places/catalog.ts';
import {getPlaceMetadata,placeSupports} from './places/metadata.ts';
import {sampleTime,localHour,formatHour,momentName} from './systems/TimeOfDay.ts';
import {createAudioSystem} from './systems/AudioSystem.ts';
import {createMusicPlayer} from './systems/MusicPlayer.ts';
import afterlightStudy from '../assets/config/afterlight-study.json';
import {loadPreferences,savePreferences,getRoomPreferences,saveRoomPreferences} from './systems/Preferences.ts';
import {isOceanLevel,type OceanLevel} from './places/metadata.ts';
import {createSceneClock} from './player/SceneClock.ts';
import './style.css';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const status=el('status');
async function start(){
 const preferences=loadPreferences();
 const roomCards=document.querySelector('.room-cards');
 const placeSelectElement=el<HTMLSelectElement>('place-select');
 for(const metadata of places){
  if(!roomCards?.querySelector(`[data-place="${metadata.id}"]`)){
   const card=document.createElement('button');card.className=`room-card room-card--${metadata.id}`;card.dataset.place=metadata.id;card.setAttribute('aria-pressed','false');
   card.innerHTML=`<span class="room-card__name">${metadata.name}</span>`;roomCards?.append(card);
  }
  if(!placeSelectElement.querySelector(`option[value="${metadata.id}"]`)){
   const option=document.createElement('option');option.value=metadata.id;option.textContent=`${metadata.name} · ${metadata.subtitle}`;placeSelectElement.append(option);
  }
 }
 const afterlightCameraOptions=document.createElement('div');
 afterlightCameraOptions.id='afterlight-camera-options';afterlightCameraOptions.hidden=true;
 afterlightCameraOptions.innerHTML='<label for="afterlight-camera-distance">鏡頭遠近 <output id="afterlight-camera-distance-value">0%</output></label><input id="afterlight-camera-distance" type="range" min="0" max="30" step="1" value="0"><div class="actions"><button id="afterlight-camera-reset">回原位</button></div>';
 document.querySelector('label[for="beam-strength"]')?.before(afterlightCameraOptions);
 const persist=()=>{
  saveRoomPreferences(preferences,currentPlace,{hour,live,beamStrength,weather:preferences.weather,rainIntensity:preferences.rainIntensity,oceanLevel});
  savePreferences(preferences);
 };
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.4:1.75));
 renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 el('space').append(renderer.domElement);
 let scene=new THREE.Scene();scene.background=new THREE.Color('#080e11');
 const camera=new THREE.PerspectiveCamera(53,innerWidth/innerHeight,.1,700);
 const requestedPlace=new URLSearchParams(location.search).get('place');
 let currentPlace:PlaceId=isPlaceId(requestedPlace)?requestedPlace:preferences.place;
 const requestedSea=new URLSearchParams(location.search).get('sea');
 const initialRoom=getRoomPreferences(preferences,currentPlace);
 Object.assign(preferences,initialRoom);
 let oceanLevel:OceanLevel=isOceanLevel(requestedSea)?requestedSea:initialRoom.oceanLevel;
 let place=(await preparePlace(currentPlace))(scene,renderer);
 place.setOceanLevel?.(oceanLevel);
 renderer.toneMapping=place.toneMapping??THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=place.exposure??1.1;
 camera.fov=place.fov??(innerWidth<700?64:53);camera.updateProjectionMatrix();
 camera.position.set(...place.position);
 const controls=new OrbitControls(camera,renderer.domElement);
 // Rotate around the skylight's vertical axis, keeping the room in the composition.
 controls.target.set(...place.target);controls.update();
 let homeAzimuth=controls.getAzimuthalAngle(),homePolar=controls.getPolarAngle();
 const homePosition=camera.position.clone();
 function updateOrbitLimits(){
  if(currentPlace==='waterlight'){
   const limits=waterOrbitLimits(homePosition,controls.target,waterCameraClearance(camera.near,camera.fov,camera.aspect));
   controls.minAzimuthAngle=limits.min;controls.maxAzimuthAngle=limits.max;
  }else{
   controls.minAzimuthAngle=homeAzimuth-place.yawRange;controls.maxAzimuthAngle=homeAzimuth+place.yawRange;
  }
 }
 updateOrbitLimits();
 controls.minPolarAngle=homePolar;controls.maxPolarAngle=homePolar;
 controls.enableZoom=false;controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.08;controls.rotateSpeed=.32;
 controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:null,RIGHT:null};
 controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:null};controls.saveState();
 renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','拖曳環繞天窗，靠近牆面時停止；左右方向鍵旋轉，Home 回到初始視角');
 renderer.domElement.addEventListener('keydown',e=>{
  if(exporting||switching||!['ArrowLeft','ArrowRight','Home'].includes(e.key))return;e.preventDefault();
  if(e.key==='Home'){resetView();return;}
  const angle=THREE.MathUtils.clamp(controls.getAzimuthalAngle()+(e.key==='ArrowLeft'?-.08:.08)*(place.cameraMode==='fixed-position'?-1:1),controls.minAzimuthAngle,controls.maxAzimuthAngle);
  const offset=camera.position.clone().sub(controls.target),radius=Math.hypot(offset.x,offset.z);
  camera.position.set(controls.target.x+Math.sin(angle)*radius,camera.position.y,controls.target.z+Math.cos(angle)*radius);controls.update();
 });

 const audio=createAudioSystem();
 const music=createMusicPlayer(el('music'),{volume:preferences.volume,onVolumeChange:value=>{preferences.volume=value;persist();}});
 if(currentPlace==='afterlight')music.setSelection(afterlightStudy.audio.track,afterlightStudy.audio.loop,afterlightStudy.audio.fadeSeconds);
 const raycaster=new THREE.Raycaster(),waterPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-6.985),hit=new THREE.Vector3();
 let waterDown: {x:number;y:number;id:number}|undefined;
 renderer.domElement.addEventListener('pointerdown',e=>{if(e.isPrimary&&e.button===0)waterDown={x:e.clientX,y:e.clientY,id:e.pointerId};});
 renderer.domElement.addEventListener('pointercancel',()=>{waterDown=undefined;});
 renderer.domElement.addEventListener('pointerup',e=>{
  const start=waterDown;waterDown=undefined;if(switching||exporting||!placeSupports(currentPlace,'water-interaction'))return;if(!start||start.id!==e.pointerId||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)return;
  const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
  if(raycaster.ray.intersectPlane(waterPlane,hit)){const u=hit.x/3.6+.5,v=.5-(hit.z+.2)/3.6;if(u>0&&u<1&&v>0&&v<1)place.disturb(u,v);}
 });
 const composer=new EffectComposer(renderer);
 function updateAntialiasing(){
  const samples=currentPlace==='oceanlight'?Math.min(preferences.quality==='low'?2:4,renderer.capabilities.maxSamples):0;
  for(const target of [composer.renderTarget1,composer.renderTarget2])if(target.samples!==samples){target.samples=samples;target.dispose();}
 }
 updateAntialiasing();const renderPass=new RenderPass(scene,camera);composer.addPass(renderPass);
 const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.19,.65,1.05);composer.addPass(bloom);composer.addPass(new OutputPass());
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');let paused=reduce.matches,last=performance.now(),lastPresented=last,raf=0,lost=false;
 const sceneClock=createSceneClock({paused});
 let beamStrength=preferences.beamStrength;
 let hour=preferences.live?localHour():preferences.hour,live=preferences.live;let state=sampleTime(hour);
 const panel=el('settings'),toggle=el<HTMLButtonElement>('settings-toggle'),pause=el<HTMLButtonElement>('pause');
 let switching=false,exporting=false;
 const transition=el('room-transition');
 async function fadeRoom(covered:boolean){
  const animation=transition.animate([{opacity:getComputedStyle(transition).opacity},{opacity:covered?1:0}],{duration:reduce.matches?80:covered?350:650,easing:'ease-in-out',fill:'forwards'});
  await animation.finished;
  transition.style.opacity=covered?'1':'0';animation.cancel();
 }
 const placeSelect=el<HTMLSelectElement>('place-select');placeSelect.value=currentPlace;
 function describePlace(){
  const metadata=getPlaceMetadata(currentPlace);
  document.body.dataset.place=currentPlace;
  const isWater=placeSupports(currentPlace,'water-interaction');
  const hasWeather=placeSupports(currentPlace,'weather');
  document.querySelectorAll<HTMLButtonElement>('[data-place]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.place===currentPlace)));
  el('water-options').hidden=!hasWeather;
  el('ocean-options').hidden=!placeSupports(currentPlace,'ocean-level');
  el('afterlight-camera-options').hidden=!placeSupports(currentPlace,'camera-distance');
  document.querySelectorAll<HTMLButtonElement>('[data-ocean-level]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.oceanLevel===oceanLevel)));
  el('water-reset').hidden=!isWater;
  el('water-mode').textContent=place.waterMode;
  el<HTMLButtonElement>('water-reset').disabled=!place.hasSimulation;
  el('water-hint').textContent=isWater&&!place.hasSimulation?'拖曳環繞天窗，靠近牆面時停止。':metadata.cameraHint;
  renderer.domElement.setAttribute('aria-label',metadata.cameraAriaLabel);
  weatherLabels();document.title=`${el('place-title').textContent} · Quiet Places／靜隅`;el('space').setAttribute('aria-label',`${el('place-title').textContent}：即時生成的靜謐空間`);
 }
 function homeCamera(resetAfterlightDistance=true){
  if(resetAfterlightDistance)afterlightCameraDistance=0;
  updateAntialiasing();
  renderer.toneMapping=place.toneMapping??THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=place.exposure??1.1;
  camera.fov=place.fov??(innerWidth<700?64:53);camera.updateProjectionMatrix();
  controls.enableDamping=false;controls.update();
  controls.minAzimuthAngle=-Infinity;controls.maxAzimuthAngle=Infinity;controls.minPolarAngle=0;controls.maxPolarAngle=Math.PI;
  camera.position.set(...place.position);homePosition.copy(camera.position);controls.target.set(...place.target);controls.update();
  homeAzimuth=controls.getAzimuthalAngle();homePolar=controls.getPolarAngle();
  updateOrbitLimits();
  controls.minPolarAngle=homePolar;controls.maxPolarAngle=homePolar;controls.saveState();controls.enableDamping=!reduce.matches;
 }
 async function switchPlace(id:PlaceId,save=true){
  if(switching||(!exporting&&id===currentPlace))return;
  switching=true;
   const old={place,scene,id:currentPlace,oceanLevel,hour,live,beamStrength,weather:preferences.weather,rainIntensity:preferences.rainIntensity,elapsed:sceneClock.elapsed,afterlightCameraDistance,position:camera.position.clone(),target:controls.target.clone()};
  let candidate:typeof place|undefined,committed=false;
  const busyInputs=Array.from(document.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement>('#settings input,#settings button,#settings select,[data-place],#place-select')).map(input=>({input,disabled:input.disabled}));
  busyInputs.forEach(({input})=>{input.disabled=true;});controls.enabled=false;
  const loading=window.setTimeout(()=>{if(!exporting){status.hidden=false;status.textContent='正在走進另一個空間。';}},500);
  try{
   if(save)persist();
   const factory=await preparePlace(id);
   const nextScene=new THREE.Scene();nextScene.background=new THREE.Color('#080e11');
   try{candidate=factory(nextScene,renderer);}catch(error){factory.dispose?.();throw error;}
   if(!exporting)await fadeRoom(true);
   const room=save?getRoomPreferences(preferences,id):undefined;
   if(room){hour=room.live?localHour():room.hour;live=room.live;beamStrength=room.beamStrength;oceanLevel=room.oceanLevel;preferences.weather=room.weather;preferences.rainIntensity=room.rainIntensity;}
   place=candidate;scene=nextScene;renderPass.scene=scene;currentPlace=id;place.setOceanLevel?.(oceanLevel);
   homeCamera();sceneClock.reset();state=sampleTime(hour);
   const weatherProfile=getPlaceMetadata(id).weatherProfile;
   const waterRain=weatherProfile==='water'&&preferences.weather==='rain';
   const afterlightHeavyRain=weatherProfile==='afterlight'&&preferences.weather==='heavy-rain';
   const sceneRain=weatherProfile==='water'?preferences.weather==='rain':weatherProfile==='afterlight'&&(preferences.weather==='rain'||afterlightHeavyRain);
   place.update(0,sceneClock.elapsed,{...state,intensity:state.intensity*(waterRain?.72:1),warmth:state.warmth*(waterRain?.45:1),beamStrength,rain:sceneRain?preferences.rainIntensity:0,heavyRain:afterlightHeavyRain,lowQuality:preferences.quality==='low'});
   composer.render();
   // Retiring scenes must not undo the candidate renderer state after its first frame.
   const candidateShadow={enabled:renderer.shadowMap.enabled,type:renderer.shadowMap.type};
   committed=true;old.place.dispose();
   renderer.shadowMap.enabled=candidateShadow.enabled;renderer.shadowMap.type=candidateShadow.type;
   placeSelect.value=id;
   if(save){preferences.place=id;preferences.hour=hour;preferences.live=live;preferences.beamStrength=beamStrength;persist();}
   describePlace();syncRoomInputs();
   clearTimeout(loading);if(!exporting)status.hidden=true;
   if(!exporting)await fadeRoom(false);
  }catch(error){
   if(!committed){
    candidate?.dispose();place=old.place;scene=old.scene;renderPass.scene=scene;currentPlace=old.id;
    ({oceanLevel,hour,live,beamStrength}=old);sceneClock.reset(old.elapsed);afterlightCameraDistance=old.afterlightCameraDistance;preferences.weather=old.weather;preferences.rainIntensity=old.rainIntensity;
    homeCamera(false);camera.position.copy(old.position);controls.target.copy(old.target);controls.update();state=sampleTime(hour);placeSelect.value=currentPlace;
    describePlace();syncRoomInputs();composer.render();
   }
   if(!exporting){await fadeRoom(false);status.hidden=false;status.textContent='房間暫時無法載入，已保留原房間；請重新整理後再試。';}
   throw error;
  }finally{
   clearTimeout(loading);switching=false;controls.enabled=!exporting;
   busyInputs.forEach(({input,disabled})=>{input.disabled=disabled;});el<HTMLButtonElement>('water-reset').disabled=exporting||!place.hasSimulation;requestRender();
  }
 }
 function chooseRoom(id:PlaceId){if(exporting||switching)return;setPanel(false);void switchPlace(id).catch(error=>console.error(error));}
 placeSelect.addEventListener('change',()=>chooseRoom(placeSelect.value as PlaceId));
 document.querySelectorAll<HTMLButtonElement>('[data-place]').forEach(button=>button.addEventListener('click',()=>{if(isPlaceId(button.dataset.place))chooseRoom(button.dataset.place);}));
 document.querySelectorAll<HTMLButtonElement>('[data-ocean-level]').forEach(button=>button.addEventListener('click',()=>{
  const level=button.dataset.oceanLevel;if(exporting||!placeSupports(currentPlace,'ocean-level')||!isOceanLevel(level))return;
  oceanLevel=level;place.setOceanLevel?.(level);persist();describePlace();requestRender();
 }));
 el('water-reset').addEventListener('click',()=>place.resetWater());
 const range=el<HTMLInputElement>('hour'),liveInput=el<HTMLInputElement>('live');
 liveInput.checked=live;
 const beamInput=el<HTMLInputElement>('beam-strength');beamInput.value=String(beamStrength*100);el('beam-value').textContent=`${Math.round(beamStrength*100)}%`;
 const weather=el<HTMLSelectElement>('weather'),quality=el<HTMLSelectElement>('quality'),rainInput=el<HTMLInputElement>('rain-intensity');
 const afterlightCameraDistanceInput=el<HTMLInputElement>('afterlight-camera-distance'),afterlightCameraDistanceValue=el('afterlight-camera-distance-value');
 let afterlightCameraDistance=0;
 function syncAfterlightCameraDistance(){
  afterlightCameraDistanceInput.value=String(Math.round(afterlightCameraDistance*100));afterlightCameraDistanceValue.textContent=`${Math.round(afterlightCameraDistance*100)}%`;
 }
 function applyAfterlightCameraDistance(){
  if(!placeSupports(currentPlace,'camera-distance'))return;
  const distance=homePosition.distanceTo(controls.target)*(1-afterlightCameraDistance);
  const offset=camera.position.clone().sub(controls.target);
  if(offset.lengthSq()===0)offset.copy(homePosition).sub(controls.target);
  camera.position.copy(controls.target).add(offset.setLength(distance));controls.update();
 }
 weather.value=preferences.weather;quality.value=preferences.quality;rainInput.value=String(preferences.rainIntensity*100);
 function weatherLabels(){
  const weatherProfile=getPlaceMetadata(currentPlace).weatherProfile,afterlight=weatherProfile==='afterlight',weatherVisible=placeSupports(currentPlace,'weather');
  const heavyRain=weather.querySelector<HTMLOptionElement>('option[value="heavy-rain"]');
  if(afterlight&&!heavyRain){const option=document.createElement('option');option.value='heavy-rain';option.textContent='雨後天井 · 大雨';weather.append(option);}
  if(!afterlight)heavyRain?.remove();
  weather.value=preferences.weather;
  el('rain-controls').hidden=!weatherVisible||preferences.weather==='clear';el('rain-value').textContent=`${Math.round(preferences.rainIntensity*100)}%`;
  weather.options[0].textContent=afterlight?'雨後天井 · 雨後':'水光之間 · 晴日';
  weather.options[1].textContent=afterlight?'雨後天井 · 太陽雨':'雨落水面 · 雨日';
  el('place-title').textContent=weatherProfile==='water'&&preferences.weather==='rain'?'雨落水面':getPlaceMetadata(currentPlace).name;
 }
 describePlace();
 weather.addEventListener('change',()=>{const profile=getPlaceMetadata(currentPlace).weatherProfile;preferences.weather=profile==='afterlight'&&weather.value==='heavy-rain'?'heavy-rain':weather.value==='rain'?'rain':'clear';if(placeSupports(currentPlace,'water-interaction'))place.resetWater();weatherLabels();persist();requestRender();});
 quality.addEventListener('change',()=>{preferences.quality=quality.value==='low'?'low':'standard';resize();persist();});
 rainInput.addEventListener('input',()=>{preferences.rainIntensity=Number(rainInput.value)/100;weatherLabels();persist();requestRender();});
 function updateLabels(){el('time-label').textContent=formatHour(hour);el('hour-value').textContent=formatHour(hour);el('moment-label').textContent=momentName(hour);range.value=String(hour);pause.textContent=paused?'繼續流動':'暫停流動';pause.setAttribute('aria-pressed',String(paused));}
 const panels=[{panel,toggle},{panel:el('rooms-panel'),toggle:el<HTMLButtonElement>('rooms-toggle')},{panel:el('about-panel'),toggle:el<HTMLButtonElement>('about-toggle')}];
 let activeToggle:HTMLButtonElement|undefined;
 function setPanel(open:boolean,target=panel){
  const previous=activeToggle;
  for(const entry of panels){const visible=open&&entry.panel===target;entry.panel.hidden=!visible;entry.toggle.setAttribute('aria-expanded',String(visible));if(visible)activeToggle=entry.toggle;}
  document.body.classList.remove('resting');
  if(open)target.querySelector<HTMLButtonElement>('button')?.focus();else{activeToggle=undefined;previous?.focus();}
 }
 function syncRoomInputs(){
  liveInput.checked=live;beamInput.value=String(beamStrength*100);el('beam-value').textContent=`${Math.round(beamStrength*100)}%`;
  weather.value=preferences.weather;rainInput.value=String(preferences.rainIntensity*100);syncAfterlightCameraDistance();updateLabels();
 }
 function resetView(){
  if(placeSupports(currentPlace,'camera-distance'))afterlightCameraDistance=0;
  controls.enableDamping=false;controls.update();controls.reset();controls.enableDamping=!reduce.matches;syncAfterlightCameraDistance();
 }
 el('reset-view').addEventListener('click',resetView);
 afterlightCameraDistanceInput.addEventListener('input',()=>{
  if(!placeSupports(currentPlace,'camera-distance'))return;
  afterlightCameraDistance=Number(afterlightCameraDistanceInput.value)/100;applyAfterlightCameraDistance();syncAfterlightCameraDistance();requestRender();
 });
 el('afterlight-camera-reset').addEventListener('click',()=>{if(placeSupports(currentPlace,'camera-distance'))resetView();});
 renderer.domElement.addEventListener('wheel',event=>{
  if(!placeSupports(currentPlace,'camera-distance')||switching||exporting||event.ctrlKey||!controls.enabled)return;
  event.preventDefault();
  // Normalize wheel lines/pages and trackpad pixels into the same bounded dolly.
  const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?renderer.domElement.clientHeight:1);
  const step=THREE.MathUtils.clamp(pixels*.0003,-.06,.06);
  afterlightCameraDistance=THREE.MathUtils.clamp(afterlightCameraDistance-step,0,.30);
  applyAfterlightCameraDistance();syncAfterlightCameraDistance();requestRender();
 },{passive:false});
 panels.forEach(entry=>entry.toggle.addEventListener('click',()=>setPanel(entry.panel.hidden,entry.panel)));
 ['close-settings','close-rooms','close-about'].forEach(id=>el(id).addEventListener('click',()=>setPanel(false)));
 document.addEventListener('pointerdown',event=>{if(activeToggle&&event.target instanceof Node&&!panels.some(entry=>entry.panel.contains(event.target as Node)||entry.toggle.contains(event.target as Node)))setPanel(false);});
 document.addEventListener('keydown',e=>{wake();if(e.key==='Escape'&&activeToggle)setPanel(false)});
 el<HTMLInputElement>('beam-strength').addEventListener('input',e=>{const value=Number((e.target as HTMLInputElement).value);beamStrength=value/100;preferences.beamStrength=beamStrength;persist();el('beam-value').textContent=`${value}%`;requestRender();});
 range.addEventListener('input',()=>{hour=+range.value;live=false;liveInput.checked=false;preferences.hour=hour;preferences.live=false;persist();updateLabels();requestRender();});
 document.querySelectorAll<HTMLButtonElement>('[data-hour]').forEach(button=>button.addEventListener('click',()=>{hour=+button.dataset.hour!;live=false;liveInput.checked=false;preferences.hour=hour;preferences.live=false;persist();updateLabels();requestRender();}));
 liveInput.addEventListener('change',()=>{live=liveInput.checked;if(live)hour=localHour();else preferences.hour=hour;preferences.live=live;persist();updateLabels();requestRender();});
 pause.addEventListener('click',()=>{paused=!paused;sceneClock.setPaused(paused);updateLabels();requestRender();});
 reduce.addEventListener('change',e=>{paused=e.matches;sceneClock.setPaused(paused);updateLabels();requestRender();});
 el('audio').addEventListener('click',async()=>{try{const on=await audio.toggle();el('audio').textContent=on?'關閉環境聲':'開啟環境聲';el('audio').setAttribute('aria-pressed',String(on));}catch{status.hidden=false;status.textContent='環境聲暫時無法開啟，仍可靜靜觀賞。';}});
 el('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{status.hidden=false;status.textContent='此瀏覽器不支援全螢幕，請使用一般視窗觀賞。';}});
 document.addEventListener('fullscreenchange',()=>{el('fullscreen').textContent=document.fullscreenElement?'離開全螢幕':'全螢幕'});
 let idle=0;function wake(){document.body.classList.remove('resting');clearTimeout(idle);idle=window.setTimeout(()=>{if(panels.every(entry=>entry.panel.hidden)&&!document.querySelector(':focus-visible'))document.body.classList.add('resting')},6500)}
 document.addEventListener('pointermove',wake);document.addEventListener('pointerdown',wake);document.addEventListener('focusin',wake);
 const gallery=el('series-gallery');
 const galleryImages=el('series-images');
 const imageUrls:string[]=[];
 const galleryBackground=Array.from(document.querySelectorAll<HTMLElement>('#space,header,footer,.entry-dock,#settings,#rooms-panel,#about-panel'));
 function galleryInert(value:boolean){galleryBackground.forEach(element=>{element.inert=value;});}
 function closeGallery(){gallery.hidden=true;galleryInert(false);audio.visibility(document.hidden);music.visibility(document.hidden);requestRender();el('export-series').focus();}
 el('close-gallery').addEventListener('click',closeGallery);
 document.addEventListener('keydown',event=>{if(gallery.hidden)return;if(event.key==='Escape')closeGallery();if(event.key==='Tab'){const links=Array.from(gallery.querySelectorAll<HTMLElement>('a[href],button'));const first=links[0],last=links[links.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
 let dirtyUntil=0,rendering=false;
 function requestRender(){
  dirtyUntil=performance.now()+650;
  if(!raf&&!rendering&&!exporting&&gallery.hidden&&!document.hidden&&!lost){last=performance.now();lastPresented=last;raf=requestAnimationFrame(frame);}
 }
 // Paused scenes redraw only after input; a short tail lets orbit damping settle.
 controls.addEventListener('change',()=>{
  if(place.cameraMode==='fixed-position'){
   // OrbitControls supplies the look direction; translate its pivot back with
   // the eye so dragging never moves this viewer through a nearby wall.
   const correction=homePosition.clone().sub(camera.position);
   controls.target.add(correction);camera.position.copy(homePosition);
  }
  requestRender();
 });
 document.addEventListener('input',requestRender);
 document.addEventListener('click',requestRender);
 function resize(){
  updateAntialiasing();
  camera.aspect=innerWidth/innerHeight;camera.fov=place.fov??(innerWidth<700?64:53);camera.updateProjectionMatrix();updateOrbitLimits();controls.update();
  renderer.setPixelRatio(Math.min(devicePixelRatio,preferences.quality==='low'?1:innerWidth<700?1.25:1.5));
  renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);requestRender();
 }
 window.addEventListener('resize',resize);resize();
 function frame(now:number){
  raf=0;if(document.hidden||lost||exporting||!gallery.hidden)return;
  const interval=1000/(preferences.quality==='low'?24:30);
  if(now-last<interval-.5){raf=requestAnimationFrame(frame);return;}
  rendering=true;
  const dt=Math.min((now-lastPresented)/1000,.05);lastPresented=now;
  // Preserve the target cadence after a late RAF; simulation uses actual time.
  last+=Math.max(1,Math.floor((now-last+.5)/interval))*interval;
  if(live){const next=localHour();const changed=Math.floor(next*60)!==Math.floor(hour*60);hour=next;if(changed)updateLabels();}
  const target=sampleTime(hour),ease=paused?1:1-Math.exp(-dt*1.5);
  for(const key of ['intensity','warmth','angle','activity'] as const)state[key]+=(target[key]-state[key])*ease;
  state.hour=((state.hour??hour)+(((hour-(state.hour??hour)+36)%24)-12)*ease+24)%24;
  const weatherProfile=getPlaceMetadata(currentPlace).weatherProfile;
  const waterRain=weatherProfile==='water'&&preferences.weather==='rain';
  const afterlightHeavyRain=weatherProfile==='afterlight'&&preferences.weather==='heavy-rain';
  const sceneRain=weatherProfile==='water'?preferences.weather==='rain':weatherProfile==='afterlight'&&(preferences.weather==='rain'||afterlightHeavyRain);
  const lighting=waterRain?{...state,intensity:state.intensity*.72,warmth:state.warmth*.45}:state;
  const sceneDt=switching?0:sceneClock.advance(dt);
  place.update(sceneDt,sceneClock.elapsed,{...lighting,beamStrength,rain:sceneRain?preferences.rainIntensity:0,heavyRain:afterlightHeavyRain,lowQuality:preferences.quality==='low'});
  controls.enableDamping=!reduce.matches;controls.update();composer.render();rendering=false;
  if(!paused||now<dirtyUntil)raf=requestAnimationFrame(frame);
 }
 const exportButton=el<HTMLButtonElement>('export-series');
 const exportCount=places.filter(place=>place.id!=='waterlight').length*moments.length;
 exportButton.textContent=`輸出場景時刻 · ${exportCount} 張圖片`;
 el('series-gallery').setAttribute('aria-label',`${exportCount} 種安靜的時刻`);
 exportButton.addEventListener('click',async()=>{
  if(exporting||switching)return;
  exporting=true;exportButton.disabled=true;placeSelect.disabled=true;controls.enabled=false;
  cancelAnimationFrame(raf);raf=0;audio.visibility(true);music.visibility(true);
  const inputStates=Array.from(panel.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement>('input,button,select')).map(input=>({input,disabled:input.disabled}));
  inputStates.forEach(({input})=>{input.disabled=true;});
  const saved={id:currentPlace,hour,elapsed:sceneClock.elapsed,afterlightCameraDistance,position:camera.position.clone(),target:controls.target.clone()};
  const files:Record<string,Uint8Array>={};
  imageUrls.forEach(url=>URL.revokeObjectURL(url));imageUrls.length=0;galleryImages.replaceChildren();
  try{
   const {zipSync}=await import('three/addons/libs/fflate.module.js');
   let completed=0;
   const exportPlaces=places.filter(place=>place.id!=='waterlight');
   for(const {id} of exportPlaces){
    await switchPlace(id,false);
    renderer.setPixelRatio(1);renderer.setSize(1024,1536,false);composer.setPixelRatio(1);composer.setSize(1024,1536);
    camera.aspect=1024/1536;camera.fov=place.fov??58;camera.updateProjectionMatrix();
    for(const moment of moments){
     if(document.hidden||lost)throw new Error('輸出已暫停，請保持頁面在前景後重試。');
     status.hidden=false;status.textContent=`輸出 ${++completed} / ${exportPlaces.length*moments.length} · ${places.find(p=>p.id===id)!.name} · ${moment.name}`;
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
   el('export-message').textContent=`${exportCount} 張圖片已備妥，可預覽或下載。`;
  }catch(error){el('export-message').textContent=error instanceof Error?error.message:'圖片輸出失敗，請重試。';}
  finally{
   try{await switchPlace(saved.id,false);hour=saved.hour;sceneClock.reset(saved.elapsed);afterlightCameraDistance=saved.afterlightCameraDistance;camera.position.copy(saved.position);controls.target.copy(saved.target);controls.update();syncRoomInputs();}
   finally{exporting=false;inputStates.forEach(({input,disabled})=>{input.disabled=disabled;});controls.enabled=true;exportButton.disabled=false;placeSelect.disabled=false;status.hidden=true;if(gallery.hidden){audio.visibility(document.hidden);music.visibility(document.hidden);}resize();updateLabels();requestRender();}
  }
 });
 document.addEventListener('visibilitychange',()=>{
  cancelAnimationFrame(raf);raf=0;audio.visibility(document.hidden||!gallery.hidden);music.visibility(document.hidden||!gallery.hidden);
  if(!document.hidden&&!lost)requestRender();
 });
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(raf);status.hidden=false;status.textContent='繪圖連線暫時中斷，請重新整理此頁。'});
 window.addEventListener('pagehide',(event)=>{if(event.persisted)return;cancelAnimationFrame(raf);sceneClock.dispose();void audio.dispose();music.dispose();imageUrls.forEach(url=>URL.revokeObjectURL(url));place.dispose();controls.dispose();composer.dispose();renderer.dispose()},{once:true});
 updateLabels();wake();status.hidden=true;requestRender();
}
void start().catch(error=>{console.error(error);status.hidden=false;status.textContent='空間暫時無法載入，請重新整理後重試。';});
