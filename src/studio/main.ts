import * as THREE from 'three';
import './style.css';
import {prepareAfterlight} from '../places/afterlight/index.ts';
import type {AfterlightLightStudy} from '../places/afterlight/Lighting.ts';
import {createPlaceHost} from '../player/PlaceHost.ts';
import {createSceneClock} from '../player/SceneClock.ts';
import {prepareMedaka,createMedakaRoute,type SharedMedaka} from '../shared/biology/medaka/index.ts';
import {createMusicPlayer} from '../systems/MusicPlayer.ts';
import {sampleTime} from '../systems/TimeOfDay.ts';
import geometry from '../../assets/config/afterlight-geometry.json';
import adopted from '../../assets/config/afterlight-study.json';
import versions from '../../tools/studio/assets.json';
import {createDrainGeometry} from '../shared/geometry/DrainGeometry.ts';
import {validateStudy,validateStudyAssets,sameOpening,type StudyPreset} from './Preset.ts';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const input=(id:string)=>el<HTMLInputElement>(id),number=(id:string)=>Number(input(id).value);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;el('stage').append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(50,16/9,.1,700),light:AfterlightLightStudy={};
const clock=createSceneClock({elapsed:12,paused:true});
const host=createPlaceHost({renderer,preparePlace:()=>prepareAfterlight({lightStudy:light,ignoreStudyDefaults:true})});
const music=createMusicPlayer(el('music'),{volume:.5});
let preset=validateStudy(adopted),baseline=validateStudy(adopted),viewingBaseline=false,busy=true;
let fish:SharedMedaka[]=[],routeLine:THREE.Line|undefined,openingLines:THREE.LineSegments[]=[];
let factory:Awaited<ReturnType<typeof prepareMedaka>>|undefined;
const urls:string[]=[],captures:Array<{name:string;settings:StudyPreset}>=[];
const status=(message:string)=>{el('status').textContent=message;};
function exportFile(name:string,content:string,type='application/json'){
 const url=URL.createObjectURL(new Blob([content],{type}));urls.push(url);const a=document.createElement('a');a.href=url;a.download=name;a.click();
}
function controls(p:StudyPreset){
 const values:Record<string,string|number>={hour:p.hour,weather:p.weather,azimuth:p.light.azimuth,elevation:p.light.elevation,intensity:p.light.intensityScale,exposure:p.light.exposure,beam:p.light.beam,elapsed:p.elapsed,width:p.opening.width,depth:p.opening.depth,center:p.opening.centerZ,speed:p.route.speed,tempo:p.route.tempo,points:JSON.stringify(p.route.points),fade:p.audio.fadeSeconds,viewport:p.viewport[0]>p.viewport[1]?'landscape':'portrait'};
 for(const [id,value] of Object.entries(values))input(id).value=String(value);input('sun').checked=p.light.overrideSun;input('route').checked=p.route.enabled;
 music.setSelection(p.audio.track,p.audio.loop,p.audio.fadeSeconds);music.setVolume(p.audio.volume);
}
function readControls(){
 const p=structuredClone(preset);p.hour=number('hour');p.weather=input('weather').value as StudyPreset['weather'];p.elapsed=number('elapsed');p.light={overrideSun:input('sun').checked,azimuth:number('azimuth'),elevation:number('elevation'),intensityScale:number('intensity'),exposure:number('exposure'),beam:number('beam')};p.opening={width:number('width'),depth:number('depth'),centerZ:number('center')};p.route={enabled:input('route').checked,points:JSON.parse(input('points').value),speed:number('speed'),tempo:number('tempo')};p.viewport=input('viewport').value==='portrait'?[390,844]:[1280,720];p.audio={...music.getSelection(),volume:music.getVolume(),fadeSeconds:number('fade')};return validateStudy(p);
}
function disposeStudies(){fish.forEach(f=>f.dispose());fish=[];if(routeLine){routeLine.removeFromParent();routeLine.geometry.dispose();(routeLine.material as THREE.Material).dispose();routeLine=undefined;}for(const line of openingLines){line.removeFromParent();line.geometry.dispose();(line.material as THREE.Material).dispose();}openingLines=[];}
async function apply(p:StudyPreset){
 validateStudyAssets(p,baseline.assets);if(p.baselineRevision!==baseline.baselineRevision)throw new Error('候選基準版本不同，請從目前正式版本重新建立。');const current=host.current;if(!current)throw new Error('場景尚未載入');
 // Validate/create the route before touching current resources.
 const route=p.route.enabled?createMedakaRoute(p.route.points.map(v=>new THREE.Vector3(...v)),{closed:true,speed:p.route.speed,tempo:p.route.tempo}):undefined;
 if(route&&!factory)factory=await prepareMedaka();
 const config=structuredClone(geometry);config.primaryOpening.minX=config.primaryOpening.maxX-p.opening.depth;config.primaryOpening.minZ=p.opening.centerZ-p.opening.width/2;config.primaryOpening.maxZ=p.opening.centerZ+p.opening.width/2;
 const drain=createDrainGeometry(config);
 disposeStudies();const official=current.scene.getObjectByName('AfterlightMedaka');if(official)official.visible=!route;
 if(route&&factory){for(let i=0;i<3;i++)fish.push(factory.create(current.scene,{route,phaseOffsetSeconds:i*route.duration/3,name:`StudyMedaka${i}`}));const points=Array.from({length:181},(_,i)=>route.sample(i*route.activeDuration/180).position);routeLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xaabf89,transparent:true,opacity:.45,depthTest:false}));current.scene.add(routeLine);}
 const changed=!sameOpening(p,baseline);el('geometry-status').textContent=changed?'草稿線框：原 GLB／GI 尚未重建，陰影仍屬原開口。匯出後使用 geometry recipe 重建。':'開口與正式版本一致';
 if(changed){const maxX=drain.opening.maxX,minX=drain.opening.minX;
  for(const mirrored of [false,true]){const mirror=(x:number)=>mirrored?2*drain.corridor.centerX-x:x;const points=[[minX,p.opening.centerZ-p.opening.width/2],[maxX,p.opening.centerZ-p.opening.width/2],[maxX,p.opening.centerZ+p.opening.width/2],[minX,p.opening.centerZ+p.opening.width/2]].map(([x,z])=>new THREE.Vector3(mirror(x),drain.opening.roofY-.025,z));const pairs=points.flatMap((v,i)=>[v,points[(i+1)%4]]);const line=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pairs),new THREE.LineBasicMaterial({color:0xe0c18c,depthTest:false}));line.renderOrder=100;current.scene.add(line);openingLines.push(line);}
 }
 const a=THREE.MathUtils.degToRad(p.light.azimuth),e=THREE.MathUtils.degToRad(p.light.elevation);
 light.incoming=p.light.overrideSun?[Math.cos(a)*Math.cos(e),-Math.sin(e),Math.sin(a)*Math.cos(e)]:undefined;light.intensityScale=p.light.intensityScale;
 renderer.setSize(...p.viewport);renderer.toneMapping=current.place.toneMapping??THREE.AgXToneMapping;renderer.toneMappingExposure=p.light.exposure;
 camera.position.set(...p.camera.position);camera.lookAt(...p.camera.target);camera.fov=p.camera.fov;camera.aspect=p.viewport[0]/p.viewport[1];camera.updateProjectionMatrix();clock.reset(p.elapsed);clock.setPaused(true);el('play').textContent='開始流動';
 music.setSelection(p.audio.track,p.audio.loop,p.audio.fadeSeconds);music.setVolume(p.audio.volume);
 draw(p);draw(p);el('view-label').textContent=viewingBaseline?'基準 A · 正式參數':'候選 B · 固定時間試片';status(changed?'候選已顯示；開口／GI 待重建。':'候選已顯示；正式設定保持不變。');
}
function draw(p= viewingBaseline?baseline:preset){const current=host.current;if(!current)return;current.place.update(0,clock.elapsed,{...sampleTime(p.hour),beamStrength:p.light.beam,rain:p.weather==='dry'?0:p.weather==='heavy'?1:.65,heavyRain:p.weather==='heavy',lowQuality:p.quality==='low'});fish.forEach(f=>f.update(clock.elapsed));renderer.render(current.scene,camera);}
async function guarded(action:()=>Promise<void>|void){if(busy)return;busy=true;try{await action();}catch(error){status(String(error));}finally{busy=false;}}
el('apply').onclick=()=>void guarded(async()=>{const candidate=readControls();await apply(candidate);preset=candidate;viewingBaseline=false;el('view-label').textContent='候選 B · 固定時間試片';el('compare').textContent='查看基準 A';});
el('compare').onclick=()=>void guarded(async()=>{viewingBaseline=!viewingBaseline;await apply(viewingBaseline?baseline:preset);el('compare').textContent=viewingBaseline?'返回候選 B':'查看基準 A';});
el('reset').onclick=()=>void guarded(async()=>{preset=structuredClone(baseline);viewingBaseline=false;controls(preset);await apply(preset);el('compare').textContent='查看基準 A';});
el('play').onclick=()=>{if(busy)return;clock.setPaused(!clock.paused);el('play').textContent=clock.paused?'開始流動':'暫停流動';};
el('export').onclick=()=>void guarded(()=>{const candidate=readControls();validateStudyAssets(candidate,baseline.assets);el<HTMLTextAreaElement>('preset').value=JSON.stringify(candidate,null,2);exportFile('afterlight-study.json',JSON.stringify(candidate,null,2));status('候選已匯出；尚未寫入正式參數。');});
el('import').onclick=()=>void guarded(async()=>{const imported=JSON.parse(el<HTMLTextAreaElement>('preset').value);const candidate=validateStudy(imported.candidate??imported);validateStudyAssets(candidate,baseline.assets);await apply(candidate);preset=candidate;viewingBaseline=false;controls(preset);el('compare').textContent='查看基準 A';el('view-label').textContent='候選 B · 固定時間試片';});
el('capture').onclick=()=>{if(busy)return;draw();const p=structuredClone(viewingBaseline?baseline:preset);p.elapsed=clock.elapsed;const name=`${viewingBaseline?'A':'B'}-${captures.length+1}`;captures.push({name,settings:p});const a=document.createElement('a');a.href=renderer.domElement.toDataURL();a.download=name+'.png';const img=document.createElement('img');img.src=a.href;img.alt=name+' 試片';a.append(img,document.createTextNode(name+' · 點擊下載'));el('captures').append(a);status('已保存固定條件畫面；實驗匯出會包含對應參數。');};
el('save-decision').onclick=()=>void guarded(()=>{const reason=el<HTMLTextAreaElement>('reason').value.trim();if(!reason)throw new Error('請填寫觀察與取捨。');const record={schemaVersion:1,createdAt:new Date().toISOString(),decision:input('decision').value,reason,baseline,candidate:preset,captures,geometryRebuildRequired:!sameOpening(preset,baseline),productionApplied:false};el<HTMLTextAreaElement>('preset').value=JSON.stringify(record,null,2);exportFile('afterlight-experiment.json',JSON.stringify(record,null,2));status('實驗紀錄已匯出；正式採用由 study 命令執行。');});
let last=performance.now(),raf=0;function tick(now:number){const dt=(now-last)/1000;last=now;if(!document.hidden&&!busy&&!clock.paused){clock.advance(dt);draw();}raf=requestAnimationFrame(tick);}raf=requestAnimationFrame(tick);
document.addEventListener('visibilitychange',()=>{music.visibility(document.hidden);if(document.hidden){clock.setPaused(true);el('play').textContent='開始流動';}});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);clock.dispose();disposeStudies();factory?.dispose();host.dispose();music.dispose();renderer.dispose();urls.forEach(URL.revokeObjectURL);},{once:true});
try{baseline.assets=versions.assets;baseline.baselineRevision=versions.revision;
 baseline.opening={width:geometry.primaryOpening.maxZ-geometry.primaryOpening.minZ,depth:geometry.primaryOpening.maxX-geometry.primaryOpening.minX,centerZ:(geometry.primaryOpening.maxZ+geometry.primaryOpening.minZ)/2};
 const current=await host.load('afterlight');baseline.camera={position:current.place.position,target:current.place.target,fov:current.place.fov??50};preset=structuredClone(baseline);controls(preset);await apply(preset);el('version').textContent=versions.revision.slice(0,12)+' · 本機試片';
}catch(error){status('載入失敗：'+String(error));}finally{busy=false;}
