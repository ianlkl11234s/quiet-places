import * as THREE from 'three';
import {prepareAfterlight} from '../src/places/afterlight/index.ts';
import {sampleTime} from '../src/systems/TimeOfDay.ts';

const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(1280,720);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
document.querySelector('#stage')!.append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,1280/720,.1,700);
let place=(await prepareAfterlight())(scene,renderer);
const setup=()=>{camera.position.set(...place.position);camera.lookAt(...place.target);camera.fov=place.fov!;camera.updateProjectionMatrix();renderer.toneMapping=place.toneMapping!;renderer.toneMappingExposure=place.exposure!;};setup();
let rain=0,beam=1,hour=14,portrait=false;
const plants=()=>scene.getObjectByName('Afterlight_LivingPlants')?.userData.plantDiagnostics;
const result=document.querySelector('#result')!;
function draw(time=12){place.update(0,time,{...sampleTime(hour),beamStrength:beam,rain});renderer.render(scene,camera);}
draw();
result.textContent='實際場景已載入。固定 elapsed=12s，點擊驗證取得 GPU readback 與 dispose 結果。';
document.querySelector('#rain')!.addEventListener('click',()=>{rain=rain?0:.65;draw();});
document.querySelector('#beam')!.addEventListener('click',()=>{beam=beam?0:1;draw();});
document.querySelector('#portrait')!.addEventListener('click',()=>{portrait=!portrait;renderer.setSize(portrait?390:1280,portrait?844:720);camera.aspect=portrait?390/844:1280/720;camera.updateProjectionMatrix();draw();});
document.querySelector('#hour')!.addEventListener('change',event=>{hour=Number((event.target as HTMLSelectElement).value);draw();});
document.querySelector('#verify')!.addEventListener('click',async()=>{
 const pixels=()=>{const gl=renderer.getContext(),p=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
 const reports:unknown[]=[];
 for(const wet of [0,.65]){
  rain=wet;draw();const initial=pixels();draw();const a=pixels();draw();const b=pixels();let changes=0;let settlingChanges=0;for(let i=0;i<a.length;i++)if(initial[i]!==a[i])settlingChanges++;for(let i=0;i<a.length;i++)if(a[i]!==b[i])changes++;
  draw(12.5);const c=pixels();let animationChanges=0;for(let i=0;i<a.length;i++)if(a[i]!==c[i])animationChanges++;
  reports.push({rain:wet,settlingChanges,pauseExact:changes===0,changedChannels:changes,animationChanges});
 }
 const memory=[];
 for(let i=0;i<3;i++){
  draw();memory.push({...renderer.info.memory});place.dispose();place.dispose();renderer.render(scene,camera);
  reports.push({cycle:i,afterDispose:{...renderer.info.memory},remainingSceneChildren:scene.children.length});
  place=(await prepareAfterlight())(scene,renderer);setup();
 }
 draw();
 result.textContent=JSON.stringify({reports,loadedMemory:memory,renderer:renderer.getContext().getParameter(renderer.getContext().RENDERER)},null,2);
});

// Full, unscripted wall-clock viewing of the real scene; never skip to events.
document.querySelector('#play-loop')!.addEventListener('click',()=>{
 const controls=Array.from(document.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select'));
 controls.forEach(control=>control.disabled=true);
 const start=performance.now(),intervals:number[]=[];let last=start,frames=0,lastReport=-1;
 const tick=(now:number)=>{
  const elapsed=(now-start)/1000;intervals.push(now-last);last=now;frames++;draw(Math.min(elapsed,120));
  const second=Math.floor(elapsed);
  if(second!==lastReport){lastReport=second;result.textContent=`連續播放 ${Math.min(second,120)} / 120 秒 · ${frames} frames`;}
  if(elapsed<120){requestAnimationFrame(tick);return;}
  const sorted=intervals.slice(2).sort((a,b)=>a-b);
  result.textContent=JSON.stringify({continuousSeconds:elapsed,plant:plants(),frames,averageFps:frames/elapsed,frameIntervalP50:sorted[Math.floor(sorted.length*.5)],frameIntervalP95:sorted[Math.floor(sorted.length*.95)],viewport:[renderer.domElement.width,renderer.domElement.height],memory:renderer.info.memory,render:renderer.info.render},null,2);
  controls.forEach(control=>control.disabled=false);
 };
 requestAnimationFrame(tick);
});
