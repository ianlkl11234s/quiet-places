import * as THREE from 'three';
import {createSnowCreatures} from '../places/snowwindow/Creatures.ts';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const scene=new THREE.Scene();scene.background=new THREE.Color('#263b47');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
$('stage').append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(38,1,.001,100);
scene.add(new THREE.HemisphereLight('#dce9f1','#38434d',1.6));const key=new THREE.DirectionalLight('#f4f8fa',2);key.position.set(3,5,4);scene.add(key);
let creatures=createSnowCreatures(),elapsed=0,playing=false,last=performance.now();scene.add(creatures.group);
const gray=new THREE.MeshStandardMaterial({color:'#a2a2a2',roughness:.9});
const resize=()=>{renderer.setSize(innerWidth,innerHeight*.7);camera.aspect=innerWidth/(innerHeight*.7);camera.updateProjectionMatrix();};addEventListener('resize',resize);resize();
function draw(){
 creatures.update(elapsed);const choice=$<HTMLSelectElement>('view').value;
 creatures.group.children.forEach((child,i)=>{child.visible=choice==='group'||(choice==='aurelia'?i===0:i===3);});
 const target=creatures.group.children[choice==='clione'?3:0].position;
 if(choice==='group'){camera.position.set(3.4,3.4,.4);camera.lookAt(.9,2.6,-3.4);}
 else if(choice==='aurelia'){camera.position.copy(target).add(new THREE.Vector3(.28,.27,.56));camera.lookAt(target.x,target.y-.04,target.z);}
 else{camera.position.copy(target).add(new THREE.Vector3(.013,.013,.115));camera.lookAt(target);}
 scene.overrideMaterial=$<HTMLInputElement>('gray').checked?gray:null;
 renderer.render(scene,camera);
 $<HTMLOutputElement>('seconds').value=elapsed.toFixed(2);$<HTMLInputElement>('time').value=String(elapsed);
 $('diagnostics').textContent=JSON.stringify({elapsed:Number(elapsed.toFixed(3)),population:{aurelia:3,clione:5},...creatures.motion.diagnostics()[choice==='clione'?3:0],position:target.toArray(),verticalSpeed:creatures.motion.states[choice==='clione'?3:0].velocity.y},null,2);
}
function restart(){scene.remove(creatures.group);creatures.dispose();creatures=createSnowCreatures({controls:{freezeRoots:$<HTMLInputElement>('freeze').checked,freezeWings:$<HTMLInputElement>('wings').checked}});scene.add(creatures.group);elapsed=0;draw();}
$<HTMLInputElement>('freeze').onchange=restart;$<HTMLInputElement>('wings').onchange=restart;
$<HTMLSelectElement>('view').onchange=draw;$<HTMLInputElement>('gray').onchange=draw;
$<HTMLInputElement>('time').oninput=()=>{elapsed=Number($<HTMLInputElement>('time').value);draw();};
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'暫停':'播放';last=performance.now();};
let raf=0;function tick(now:number){if(playing){elapsed=Math.min(60,elapsed+Math.min(.05,(now-last)/1000));draw();if(elapsed===60){playing=false;$('play').textContent='播放';}}last=now;raf=requestAnimationFrame(tick);}draw();raf=requestAnimationFrame(tick);
addEventListener('pagehide',()=>{cancelAnimationFrame(raf);creatures.dispose();gray.dispose();renderer.dispose();},{once:true});
