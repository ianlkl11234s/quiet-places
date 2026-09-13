import * as THREE from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {prepareSnowhall} from '../src/places/snowhall/index.ts';
import {SNOW_HALL_BASELINE} from '../src/places/snowhall/Layout.ts';
import {createAntarcticDebug,BIO_DEBUG_FLAGS,type BioDebugFlags} from '../src/places/snowhall/AntarcticDebug.ts';
import type {AntarcticBehavior} from '../src/places/snowhall/AntarcticBehavior.ts';
import {createGlassSquid,createSilverfish,type AntarcticCreature} from '../src/shared/biology/antarctic/AntarcticModels.ts';
import type {PlaceInstance} from '../src/player/contracts.ts';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=document.querySelector('canvas')!,renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,1,.05,100);
let instance:PlaceInstance|undefined,debug:ReturnType<typeof createAntarcticDebug>|undefined,simulation:AntarcticBehavior|undefined,model:AntarcticCreature|undefined;
let elapsed=0,previous=performance.now(),lastReadback=-1,disposeReadback:unknown=null;
let frameDurations:number[]=[],renderDurations:number[]=[];
const debugLabels:Record<keyof BioDebugFlags,string>={nav:'導航安全範圍',light:'窗光場取樣',centroid:'魚群中心',neighbors:'鄰居半徑',targets:'魷魚目標',events:'事件紀錄',avoidance:'避讓方向'};
for(const key of Object.keys(BIO_DEBUG_FLAGS) as (keyof BioDebugFlags)[]){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.id=`debug-${key}`;input.addEventListener('change',()=>{if(debug)debug.flags[key]=input.checked;render(true);});label.append(input,debugLabels[key]);$('debug').append(label);}
function resize(){const format=$<HTMLSelectElement>('format').value,[width,height]=format==='desktop'?[1280,720]:format==='phone'?[390,844]:[innerWidth,innerHeight];renderer.setSize(width,height,true);camera.aspect=width/height;
 if(instance)camera.fov=width<700?68:SNOW_HALL_BASELINE.camera.fov;
 if(model){const distance=Math.max(1,1.1/camera.aspect);camera.position.set(2.3*distance,.65*distance,1.4*distance);camera.lookAt(0,0,$<HTMLSelectElement>('view').value==='squid'?.35:0);}
 camera.updateProjectionMatrix();render(true);
}
function render(force=false){
 const started=performance.now(),hour=Number($<HTMLSelectElement>('hour').value);
 instance?.update(0,elapsed,{hour,intensity:1,warmth:0,angle:0,activity:0});
 model?.update(elapsed,$<HTMLSelectElement>('view').value==='squid'?.15:1,.08,.8);
 debug?.update();renderer.render(scene,camera);renderDurations.push(performance.now()-started);if(renderDurations.length>120)renderDurations.shift();
 if(force||elapsed-lastReadback>.5){lastReadback=elapsed;
  const poses=(agents:AntarcticBehavior['squids'])=>agents.filter(a=>a.visible).map(a=>({p:a.position.toArray().map(x=>Number(x.toFixed(4))),scale:a.scale,speedBL:a.speedBL,light:simulation?.sampleLight(a.position)}));
  const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
  const data={elapsed,hour,frameIntervalMs:mean(frameDurations),updateAndRenderCpuMs:mean(renderDurations),seed:Number($<HTMLInputElement>('seed').value),view:$<HTMLSelectElement>('view').value,stingray:!!scene.getObjectByName('snowhall-stingray'),squids:simulation?poses(simulation.squids):[],fish:simulation?poses(simulation.fish):[],metrics:simulation?.getMetrics(),activeEvents:simulation?.events,eventLog:debug?.flags.events?simulation?.eventLog.slice(-8):undefined,memory:renderer.info.memory,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,disposeReadback};
  $('readback').textContent=JSON.stringify(data,null,2);
 }
}
async function rebuild(){
 debug?.dispose();debug=undefined;instance?.dispose();instance=undefined;model?.dispose();model=undefined;simulation=undefined;
 scene.clear();renderer.render(scene,camera);disposeReadback={...renderer.info.memory};
 frameDurations=[];renderDurations=[];elapsed=Number($<HTMLInputElement>('time').value)||0;lastReadback=-1;
 const seed=Number($<HTMLInputElement>('seed').value)>>>0,view=$<HTMLSelectElement>('view').value;
 if(view==='room'){
  const factory=await prepareSnowhall({sceneSeed:seed});instance=factory(scene,renderer);camera.position.fromArray(instance.position);camera.lookAt(new THREE.Vector3(...instance.target));camera.fov=instance.fov??50;
  simulation=scene.getObjectByName('snowhall-corridor')!.userData.biology;debug=createAntarcticDebug(scene,simulation!,SNOW_HALL_BASELINE);
  for(const key of Object.keys(BIO_DEBUG_FLAGS) as (keyof BioDebugFlags)[])debug.flags[key]=$<HTMLInputElement>(`debug-${key}`).checked;
 }else{
  RectAreaLightUniformsLib.init();scene.background=new THREE.Color('#131a1f');scene.fog=null;
  model=view==='squid'?createGlassSquid(seed):createSilverfish(seed);scene.add(model.root);
  camera.position.set(2.3,.65,1.4);camera.lookAt(0,0,view==='squid'?.15:0);camera.fov=45;
  const window=new THREE.RectAreaLight('#d3dde1',4,2,2);window.position.set(-1,1,1);window.lookAt(0,0,0);scene.add(window,new THREE.HemisphereLight('#aebbc2','#222425',.1));
 }
 resize();
}
$('capture').addEventListener('click',()=>{render(true);const link=$<HTMLAnchorElement>('capture-link');link.href=canvas.toDataURL('image/png');link.textContent='下載目前 PNG';});
$('format').addEventListener('change',resize);
$('reload').addEventListener('click',()=>void rebuild());$('view').addEventListener('change',()=>void rebuild());
function seek(){elapsed=Math.max(0,Number($<HTMLInputElement>('time').value)||0);render(true);}
$('time').addEventListener('change',seek);$('seek').addEventListener('click',seek);
$('hour').addEventListener('change',()=>render(true));
$('next').addEventListener('click',()=>{
 if(!simulation)return;
 for(let i=0;i<900;i++){elapsed+=1;simulation.update(elapsed);if(simulation.fish.some(fish=>fish.visible&&simulation!.sampleLight(fish.position)>.18))break;}
 $<HTMLInputElement>('time').value=elapsed.toFixed(1);render(true);
});
$('clean').addEventListener('click',()=>document.body.classList.toggle('clean'));
addEventListener('keydown',event=>{if(event.key.toLowerCase()==='h'&&!(event.target instanceof HTMLInputElement))document.body.classList.toggle('clean');});
addEventListener('resize',resize);
await rebuild();resize();
function frame(now:number){const frameMs=now-previous,dt=Math.min(.1,frameMs/1000);previous=now;if($<HTMLInputElement>('play').checked){frameDurations.push(frameMs);if(frameDurations.length>120)frameDurations.shift();elapsed+=dt;$<HTMLInputElement>('time').value=elapsed.toFixed(1);render();}requestAnimationFrame(frame);}requestAnimationFrame(frame);
