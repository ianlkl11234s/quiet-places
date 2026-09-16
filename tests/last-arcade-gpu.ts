import * as THREE from 'three';
import {prepareLastArcade} from '../src/places/last-arcade/index.ts';
import {sampleTime} from '../src/systems/TimeOfDay.ts';

const output=document.getElementById('result')!;
const assert=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
const difference=(a:Uint8Array,b:Uint8Array)=>{let sum=0,count=0;for(let i=0;i<a.length;i+=4){const d=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);sum+=d;if(d>6)count++;}return {sum,pixels:count};};
async function run(){
 const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(384,512);renderer.setPixelRatio(1);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;document.body.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(62,.75,.03,4000),target=new THREE.WebGLRenderTarget(384,512);
 renderer.setRenderTarget(target);renderer.render(scene,camera);
 // Three r180 retains its PMREM generator, background cube and LTC lookup
 // textures until renderer disposal. Warm this renderer-owned path once, then
 // require the next complete scene lifecycle to return to the exact baseline.
 const warmFactory=await prepareLastArcade(),warm=warmFactory(scene,renderer);
 camera.position.set(...warm.position);camera.lookAt(...warm.target);
 warm.update(0,12,{...sampleTime(14),lowQuality:false});renderer.render(scene,camera);
 warm.dispose();renderer.render(scene,camera);
 const baseline={...renderer.info.memory};
 assert(baseline.geometries===10&&baseline.textures===4,'Unexpected renderer cache footprint '+JSON.stringify(baseline));
 const started=performance.now(),factory=await prepareLastArcade(),place=factory(scene,renderer),loadMs=performance.now()-started;
 camera.position.set(...place.position);camera.lookAt(...place.target);camera.fov=place.fov!;camera.updateProjectionMatrix();renderer.toneMappingExposure=place.exposure!;
 scene.updateMatrixWorld(true);
 const meshes:THREE.Mesh[]=[];scene.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
 const foliage=meshes.filter(m=>m.userData.arcade_role==='foliage');assert(foliage.length===2,'Expected separate broadleaf and grass wind meshes');
 for(const mesh of foliage){assert(mesh.customDepthMaterial&&mesh.customDistanceMaterial,'Missing matching moving shadow pass');assert(mesh.geometry.getAttribute('arcadeWindWeight'),'Lost exported leaf root-to-tip weights');assert(mesh.geometry.getAttribute('_arcade_sky')&&mesh.geometry.getAttribute('arcadeLeafSky'),'Missing exported foliage sky visibility');}
 // Full-height architecture, a walkable floor, a real open roadside, and ocean below pavement.
 const architecture=meshes.filter(m=>m.userData.arcade_role==='architecture');
 for(const y of [1,6,14,24]){
  const hit=new THREE.Raycaster(new THREE.Vector3(1.3,1,-y),new THREE.Vector3(0,-1,0),0,2).intersectObjects(architecture,false)[0];
  assert(hit&&Math.abs(hit.point.y)<.03,'Missing connected walking surface at '+y);
 }
 assert(new THREE.Raycaster(new THREE.Vector3(.8,1.4,-1.6),new THREE.Vector3(-1,0,0),0,2).intersectObjects(architecture,false).length>0,'Storefront does not enclose the left side');
 assert(new THREE.Raycaster(new THREE.Vector3(2,1.7,-1.6),new THREE.Vector3(1,0,0),0,2).intersectObjects(architecture,false).length===0,'Roadside opening blocked at eye height');
 // Road, raised opposite pavement and recessed doors use actual exported geometry.
 const roadHit=new THREE.Raycaster(new THREE.Vector3(6.1,1,-6),new THREE.Vector3(0,-1,0),0,2).intersectObjects(architecture,false)[0];
 assert(roadHit&&roadHit.point.y>-.15&&roadHit.point.y<-.08,'Road crown must sit below the pavement');
 const pavementHit=new THREE.Raycaster(new THREE.Vector3(9.6,1,-6),new THREE.Vector3(0,-1,0),0,2).intersectObjects(architecture,false)[0];
 assert(pavementHit&&Math.abs(pavementHit.point.y)<.015,'Opposite entrances need a raised pavement');
 const doorHit=new THREE.Raycaster(new THREE.Vector3(9.8,1.1,.37),new THREE.Vector3(1,0,0),0,2).intersectObjects(architecture,false)[0];
 const pierHit=new THREE.Raycaster(new THREE.Vector3(9.8,1.1,-.68),new THREE.Vector3(1,0,0),0,2).intersectObjects(architecture,false)[0];
 assert(doorHit&&pierHit&&doorHit.point.x-pierHit.point.x>.12,'Entrance must be recessed behind a real wall pier');
 const water=meshes.flatMap(mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material]).find(material=>material.name==='arcade-sea');
 assert(water instanceof THREE.MeshPhysicalMaterial&&water.metalness===0&&Math.abs(water.ior-1.333)<.001,'Sea must use dielectric water reflection');
 const read=(time:number,hour=14)=>{place.update(0,time,{...sampleTime(hour),lowQuality:false});renderer.render(scene,camera);const pixels=new Uint8Array(384*512*4);renderer.readRenderTargetPixels(target,0,0,384,512,pixels);return pixels;};
 const day=read(12),paused=read(12),night=read(12,23),wind=read(48);
 const savedPosition=camera.position.clone(),savedRotation=camera.quaternion.clone();
 camera.position.set(0,2,-40);camera.lookAt(0,-.58,-65);
 const seaDifference=difference(read(12),read(48));assert(seaDifference.pixels>20,'Shared waves must change actual water pixels');
 camera.position.copy(savedPosition);camera.quaternion.copy(savedRotation);camera.updateMatrixWorld();
 const pauseDifference=difference(day,paused),dayNight=difference(day,night),windDifference=difference(day,wind);
 assert(pauseDifference.sum===0,'Same elapsed and light must render identical pixels');assert(dayNight.pixels>5000,'Day and moonlight controls do not affect real pixels');assert(windDifference.pixels>8,'Wind does not affect the rendered foliage/sea');
 read(12);const sun=scene.children.find(o=>o instanceof THREE.DirectionalLight) as THREE.DirectionalLight;
 sun.castShadow=false;renderer.render(scene,camera);const noShadow=new Uint8Array(day.length);renderer.readRenderTargetPixels(target,0,0,384,512,noShadow);sun.castShadow=true;
 const shadowDifference=difference(day,noShadow);assert(shadowDifference.pixels>1000,'Roof and posts must cast real shadows');
 const renderStart=performance.now();for(let i=0;i<30;i++){place.update(1/60,12+i/60,{...sampleTime(14),lowQuality:false});renderer.render(scene,camera);}const submitMs=(performance.now()-renderStart)/30;
 const rendered={...renderer.info.render},loadedMemory={...renderer.info.memory};
 place.update(0,12,{...sampleTime(14),lowQuality:true});renderer.render(scene,camera);assert(sun.shadow.mapSize.x===1024,'Low quality shadow map does not reduce size');
 place.dispose();place.dispose();renderer.render(scene,camera);
 const afterDispose={...renderer.info.memory};assert(scene.children.length===0,'Scene left attached objects');assert(afterDispose.geometries===baseline.geometries,'Geometry leak '+JSON.stringify({baseline,afterDispose}));assert(afterDispose.textures===baseline.textures,'Texture or shadow leak');
 const unused=await prepareLastArcade();unused.dispose();unused.dispose();
 renderer.setRenderTarget(null);target.dispose();renderer.dispose();
 const result={passed:true,checks:['real-GLB','road-and-pavement-height','recessed-door-rays','physical-water-IOR','isolated-sea-wave-pixels','floor-and-storefront-rays','open-roadside','pinned-wind-weights','foliage-sky-visibility','moving-shadow-materials','pause-pixel-repeatability','day-night-pixels','wind-pixels','shadow-pixels','low-quality','double-dispose','unused-factory-dispose'],meshCount:meshes.length,foliageMeshes:foliage.length,loadMs,submissionMsPerFrame:submitMs,performanceScope:'384x512 offscreen CPU submission only; not device fps or GPU timing',rendered,loadedMemory,baseline,afterDispose,pauseDifference,dayNight,windDifference,shadowDifference,seaDifference};
 output.textContent=JSON.stringify(result,null,2);output.dataset.passed='true';
}
run().catch(error=>{output.textContent=error.stack??String(error);output.dataset.passed='false';console.error(error);});
