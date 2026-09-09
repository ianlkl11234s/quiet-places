import * as THREE from 'three';
import {prepareStairlight} from '../src/places/stairlight/index.ts';
import {sampleTime} from '../src/systems/TimeOfDay.ts';
const seconds=document.querySelector<HTMLInputElement>('#seconds')!,hour=document.querySelector<HTMLInputElement>('#hour')!,play=document.querySelector<HTMLButtonElement>('#play')!,result=document.querySelector<HTMLElement>('#result')!;
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(1);renderer.setSize(780,900);document.querySelector('#canvas')!.append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,780/900,.03,100);
async function main(){
 const place=(await prepareStairlight())(scene,renderer);
 camera.position.set(...place.position);camera.up.set(...place.cameraUp!);camera.lookAt(...place.target);
 if(new URLSearchParams(location.search).get('view')==='lower')camera.lookAt(-.309,-1.4,1.4);
 camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(place.fov!)/2)*Math.min(1,(place.framingAspect??camera.aspect)/camera.aspect)));camera.updateProjectionMatrix();
 renderer.toneMapping=place.toneMapping!;renderer.toneMappingExposure=place.exposure!;
 let playing=false,elapsed=Number(seconds.value),last=performance.now();
 seconds.oninput=()=>{elapsed=Number(seconds.value);};play.onclick=()=>{playing=!playing;play.textContent=playing?'暫停':'播放';};
 function frame(now:number){
  const dt=Math.min((now-last)/1000,.05);last=now;if(playing){elapsed+=dt;seconds.value=elapsed.toFixed(2);}
  const transport=scene.getObjectByName('WindowTransport');if(transport)transport.visible=document.querySelector<HTMLInputElement>('#bounce')!.checked;
  place.update(playing?dt:0,elapsed,{...sampleTime(Number(hour.value)),beamStrength:1});renderer.render(scene,camera);
  const shark=scene.getObjectByName('BlacktipReefShark');
  result.textContent=JSON.stringify({elapsed:Math.round(elapsed*100)/100,shark:shark?shark.position.toArray():null,stats:shark?.userData,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles},null,2);
  requestAnimationFrame(frame);
 }requestAnimationFrame(frame);
}
main().catch(error=>{result.textContent=String(error);console.error(error);});
