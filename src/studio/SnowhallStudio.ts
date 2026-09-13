import * as THREE from 'three';
import './snowhall-studio.css';
import {prepareSnowhall} from '../places/snowhall/index.ts';
import {applySnowhallLayout,SNOW_HALL_BASELINE,validateSnowhallDraft,type SnowhallDraft} from '../places/snowhall/Layout.ts';
import {createSceneClock} from '../player/SceneClock.ts';
import {sampleTime} from '../systems/TimeOfDay.ts';

const draftKey='quiet-places:snowhall-studio:draft:v1';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const stage=$<HTMLDivElement>('stage'),status=$<HTMLParagraphElement>('status');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','雪光長廊場景預覽');stage.replaceChildren(renderer.domElement);
const camera=new THREE.PerspectiveCamera(50,1,.1,700),scene=new THREE.Scene(),clock=createSceneClock();
let place:ReturnType<Awaited<ReturnType<typeof prepareSnowhall>>>|undefined,root:THREE.Group|undefined;
let draft=structuredClone(SNOW_HALL_BASELINE),raf=0,last=performance.now(),disposed=false;
const controls=new Map<string,{range:HTMLInputElement;number:HTMLInputElement}>();
const setStatus=(message:string)=>{status.textContent=message;};

function valueAt(path:string){
 const [group,key,index]=path.split('.');
 if(group==='corridorWidth'||group==='snowScale')return draft[group];
 if(group==='window')return draft.window[key as keyof SnowhallDraft['window']];
 if(group==='camera'&&(key==='position'||key==='target'))return draft.camera[key][Number(index)];
 return draft.camera.fov;
}
function assign(next:SnowhallDraft,path:string,value:number){
 const [group,key,index]=path.split('.');
 if(group==='corridorWidth'||group==='snowScale'){next[group]=value;return;}
 if(group==='window'){next.window[key as keyof SnowhallDraft['window']]=value;return;}
 if(key==='position'||key==='target'){next.camera[key][Number(index)]=value;return;}
 next.camera.fov=value;
}
function syncControls(){for(const [path,control] of controls){const value=valueAt(path);control.range.value=String(value);control.number.value=String(Number(value.toFixed(2)));}}
function render(dt=0){if(!place)return;place.update(dt,clock.elapsed,{...sampleTime(12),beamStrength:1,lowQuality:false});renderer.render(scene,camera);const size=renderer.getSize(new THREE.Vector2());$<HTMLElement>('viewport-readout').textContent=`${Math.round(size.x)} × ${Math.round(size.y)}`;}
function apply(next:SnowhallDraft,announce=true){
 const valid=validateSnowhallDraft(next);draft=valid;
 if(root)applySnowhallLayout(root,valid);
 camera.position.set(...valid.camera.position);camera.lookAt(...valid.camera.target);camera.fov=valid.camera.fov;camera.updateProjectionMatrix();syncControls();render();
 if(announce)setStatus('候選已更新；正式場景設定未寫入。');
}
function change(path:string,raw:string){
 const value=Number(raw);if(!Number.isFinite(value))return;
 try{const next=structuredClone(draft);assign(next,path,value);apply(next);}catch(error){setStatus(String(error));syncControls();}
}
function setupControls(){
 document.querySelectorAll<HTMLInputElement>('input[data-path][type=range]').forEach(range=>{
  const path=range.dataset.path!,number=range.parentElement!.querySelector<HTMLInputElement>('.numeric')!;controls.set(path,{range,number});
  range.addEventListener('input',()=>change(path,range.value));number.addEventListener('input',()=>{if(number.value.trim()!==''&&Number.isFinite(number.valueAsNumber))change(path,number.value);});number.addEventListener('change',()=>change(path,number.value));
 });syncControls();
}
function resize(){const rect=stage.getBoundingClientRect();if(rect.width<1||rect.height<1)return;renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();render();}
function json(){const size=renderer.getSize(new THREE.Vector2());return JSON.stringify({tool:'snowhall-studio',previewOnly:true,draft,viewport:{width:Math.round(size.x),height:Math.round(size.y)}},null,2);}
async function copy(){const text=json();try{await navigator.clipboard.writeText(text);$<HTMLTextAreaElement>('json-fallback').style.display='none';setStatus('場景參數已複製。');}catch{const fallback=$<HTMLTextAreaElement>('json-fallback');fallback.value=text;fallback.style.display='block';fallback.select();setStatus('剪貼簿不可用，JSON 已選取。');}}
function pause(){clock.setPaused(!clock.paused);$<HTMLButtonElement>('pause').textContent=clock.paused?'繼續流動':'暫停流動';$<HTMLButtonElement>('pause').setAttribute('aria-pressed',String(clock.paused));$<HTMLElement>('flow-readout').textContent=clock.paused?'已暫停':'流動中';}
function saveDraft(){try{localStorage.setItem(draftKey,JSON.stringify(draft));setStatus('本機草稿已儲存；正式設定未改動。');}catch{setStatus('無法寫入本機草稿。');}}
function restoreDraft(){try{const raw=localStorage.getItem(draftKey);if(!raw)throw new Error('尚無本機草稿。');apply(JSON.parse(raw) as SnowhallDraft);setStatus('已還原本機草稿。');}catch(error){setStatus(String(error));}}
function tick(now:number){const dt=(now-last)/1000;last=now;if(!document.hidden&&!clock.paused){clock.advance(dt);render(dt);}raf=requestAnimationFrame(tick);}
function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);resizeObserver.disconnect();clock.dispose();place?.dispose();renderer.dispose();}

setupControls();
$<HTMLButtonElement>('pause').onclick=pause;$<HTMLButtonElement>('reset').onclick=()=>apply(structuredClone(SNOW_HALL_BASELINE));$<HTMLButtonElement>('copy').onclick=()=>void copy();$<HTMLButtonElement>('save-draft').onclick=saveDraft;$<HTMLButtonElement>('restore-draft').onclick=restoreDraft;
$<HTMLButtonElement>('panel-toggle').onclick=()=>{document.body.classList.toggle('panel-hidden');const hidden=document.body.classList.contains('panel-hidden'),button=$<HTMLButtonElement>('panel-toggle');button.textContent=hidden?'顯示控制':'收起控制';button.setAttribute('aria-expanded',String(!hidden));requestAnimationFrame(resize);};
const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);window.addEventListener('pagehide',dispose,{once:true});document.addEventListener('visibilitychange',()=>{if(document.hidden&&!clock.paused)pause();});
try{const factory=await prepareSnowhall();place=factory(scene,renderer);root=scene.getObjectByName('snowhall-corridor') as THREE.Group;renderer.toneMapping=place.toneMapping??THREE.AgXToneMapping;renderer.toneMappingExposure=place.exposure??1;apply(structuredClone(SNOW_HALL_BASELINE),false);resize();raf=requestAnimationFrame(tick);setStatus('場景已就緒；拖曳滑桿即可調整。');}catch(error){setStatus(`載入失敗：${String(error)}`);dispose();}
