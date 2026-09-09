import * as THREE from 'three';
import {preparePlace} from '../src/places/catalog.ts';
import {places} from '../src/places/metadata.ts';
import {sampleTime} from '../src/systems/TimeOfDay.ts';
const status=document.querySelector('#status')!,result=document.querySelector('#result')!;
document.querySelector<HTMLButtonElement>('#run')!.onclick=async()=>{
 const button=document.querySelector<HTMLButtonElement>('#run')!;button.disabled=true;
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;document.querySelector('#stage')!.replaceChildren(renderer.domElement);
 const records:unknown[]=[];
 try{
 for(const {id} of places){
  status.textContent=`載入 ${id}`;
  const scene=new THREE.Scene(),factory=await preparePlace(id);
  const originalRandom=Math.random;let seed=1701;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  let place;try{place=factory(scene,renderer);}finally{Math.random=originalRandom;}
  const camera=new THREE.PerspectiveCamera(place.fov??50,16/9,.1,700);camera.position.set(...place.position);camera.lookAt(...place.target);renderer.toneMapping=place.toneMapping??THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=place.exposure??1;
  for(const portrait of [false,true])for(const hour of [12,17.5,23]){
   const [w,h]=portrait?[390,844]:[1280,720];renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();
   const state={...sampleTime(hour),rain:0,beamStrength:1,heavyRain:false,lowQuality:false};
   if(place.setOceanLevel)place.setOceanLevel('half');
   const draw=()=>{place.update(0,12,state);renderer.render(scene,camera);};draw();draw();
   const pixels=()=>{const gl=renderer.getContext(),p=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
   const a=pixels();draw();const b=pixels();let changed=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])changed++;
   records.push({id,constructionRandomSeed:1701,hour,viewport:[w,h],camera:{position:camera.position.toArray(),target:place.target,fov:camera.fov},exposure:renderer.toneMappingExposure,elapsed:12,rain:0,quality:'standard',pauseChangedChannels:changed,memory:{...renderer.info.memory},image:renderer.domElement.toDataURL('image/png')});
   status.textContent=`${id} ${hour} ${w}×${h}`;await new Promise(requestAnimationFrame);
  }
  const intervals:number[]=[];let previous=performance.now();
  for(let frame=0;frame<30;frame++){await new Promise(requestAnimationFrame);const now=performance.now();intervals.push(now-previous);previous=now;place.update(1/60,12+frame/60,{...sampleTime(12),rain:id==='afterlight'?1:.65,heavyRain:id==='afterlight',beamStrength:1});renderer.render(scene,camera);}
  intervals.sort((a,b)=>a-b);place.dispose();place.dispose();renderer.render(scene,camera);
  records.push({id,frameIntervalP50:intervals[15],frameIntervalP95:intervals[28],afterDispose:{...renderer.info.memory},remainingChildren:scene.children.length});
 }
 result.textContent=JSON.stringify({userAgent:navigator.userAgent,records});status.textContent='矩陣完成';
 }catch(error){status.textContent=`失敗：${error}`;result.textContent=JSON.stringify({error:String(error),records});}
 finally{renderer.dispose();button.disabled=false;}
};
