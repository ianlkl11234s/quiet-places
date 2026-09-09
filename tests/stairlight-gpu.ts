import * as THREE from 'three';
import {sampleTime} from '../src/systems/TimeOfDay.ts';
import {prepareStairlight} from '../src/places/stairlight/index.ts';

const output=document.getElementById('result')!;
const assert=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
async function run(){
 const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(320,432);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;
 document.body.append(renderer.domElement);
 const scene=new THREE.Scene(),target=new THREE.WebGLRenderTarget(256,344,{type:THREE.UnsignedByteType});
 const camera=new THREE.PerspectiveCamera(60,256/344,.03,100);
 renderer.setRenderTarget(target);renderer.render(scene,camera);
 const baseline={...renderer.info.memory};
 const factory=await prepareStairlight(),place=factory(scene,renderer);
 assert(place.yawRange===Math.PI/12,'Expected changing time and 15 degree orbit');
 assert(JSON.stringify(place.target)===JSON.stringify([-.309,.88,-.10]),'Orbit pivot must be return circle center');
 assert(JSON.stringify(place.cameraUp)===JSON.stringify([0,1,0]),'Horizontal orbit must use world up');
 camera.position.set(...place.position);camera.up.set(...place.cameraUp!);camera.lookAt(...place.target);camera.fov=place.fov!;camera.updateProjectionMatrix();
 renderer.toneMappingExposure=place.exposure!;
 place.update(0,0,{intensity:1,warmth:1,angle:0,activity:0});
 const pivot=new THREE.Vector3(...place.target),offset=new THREE.Vector3(...place.position).sub(pivot);
 for(const angle of [-place.yawRange,place.yawRange]){
  const orbit=offset.clone().applyAxisAngle(new THREE.Vector3(0,1,0),angle).add(pivot);
  assert(Math.abs(orbit.y-place.position[1])<1e-8,'Horizontal orbit must preserve camera height');
  assert(orbit.x> -1.55 && orbit.x<1.1,'Orbit camera must remain inside side walls');
 }
 const tape=scene.getObjectByName('stairlight-red-twine')!;
 assert(Math.abs(tape.position.distanceTo(pivot)-.17)<1e-6,'Tape must sit on the .17 m radius return');
 assert(Math.abs(tape.rotation.y-THREE.MathUtils.degToRad(255))<1e-8,'Tape must hang outside the left 165 degree arc');
 const meshes:THREE.Mesh[]=[];scene.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
 assert(meshes.length>0,'Missing baked mesh');
 for(const mesh of meshes){
  assert(mesh.castShadow&&mesh.receiveShadow,'All architecture must cast/receive shadow');
  if(mesh.name!=='StairlightSurface')continue;
  for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   assert(m instanceof THREE.MeshStandardMaterial,'Expected PBR material');
   const material=m as THREE.MeshStandardMaterial;
   assert(material.map&&material.normalMap&&material.roughnessMap&&material.lightMap,'Missing PBR or indirect texture');
  }
 }
 // Independent geometry ray tests: light through the actual window versus an occluded room corner.
 scene.updateMatrixWorld(true);
 const architecture=meshes.filter(mesh=>mesh.name==='StairlightSurface');
 assert(architecture.length===1,'Expected one baked architecture surface');
 const rearWindow=new URLSearchParams(location.search).get('window')!=='side';
 if(rearWindow){
  const down=new THREE.Vector3(0,-1,0);
  for(const [x,y,z,expected] of [[-1,-2,1,-2.8],[.6,-2,1,-4.025],[-.8,-2,-.6,-3.5],[-.309,-1.5,3.45,-1.75]]){
   const hit=new THREE.Raycaster(new THREE.Vector3(x,y,z),down,.001,6).intersectObjects(architecture,false)[0];
   assert(hit&&Math.abs(hit.point.y-expected)<.03,'Lower storey tread/landing missing '+[x,y,z,hit?.point.y]);
  }
  for(const direction of [new THREE.Vector3(0,0,-1),new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,1)])
   assert(new THREE.Raycaster(new THREE.Vector3(0,-4,-.5),direction,.001,6).intersectObjects(architecture,false).length>0,'Lower storey enclosing wall missing');
 }

 const jointHits=new THREE.Raycaster(new THREE.Vector3(-1.60,2,0),new THREE.Vector3(-1,0,0),.001,.5).intersectObjects(meshes,false);
 assert(jointHits.length>0,'Wall joint at sill height must block light');
 const outgoing=(rearWindow?new THREE.Vector3(0,.2,1):new THREE.Vector3(-1,.3,.2)).normalize();
 const openRay=new THREE.Raycaster((rearWindow?new THREE.Vector3(-.8,2.6,3.85):new THREE.Vector3(-1.45,3.4,1.6)),outgoing,.001,1);
 const blockedRay=new THREE.Raycaster((rearWindow?new THREE.Vector3(1.16,2.6,3.85):new THREE.Vector3(1,3.4,-.8)),outgoing,.001,5);
 const openHits=openRay.intersectObjects(meshes,false),blockedHits=blockedRay.intersectObjects(meshes,false);
 if(rearWindow){
  for(const point of [new THREE.Vector3(-.8,4.2,3.85),new THREE.Vector3(-.8,1.8,3.85),new THREE.Vector3(1.15,2.6,3.85)]){
   assert(new THREE.Raycaster(point,new THREE.Vector3(0,0,1),.001,1).intersectObjects(architecture,false).length>0,'Reduced window must block light above, below and beside the opening');
  }
 }
 assert(openHits.length===0,'Expected sunlight ray to pass through the staircase window '+JSON.stringify(openHits.map(h=>({distance:h.distance,point:h.point.toArray()}))));
 assert(blockedHits.length>0,'Expected the far corner to be shadowed by real geometry');
 const sun=scene.children.find(o=>o instanceof THREE.DirectionalLight) as THREE.DirectionalLight;
 const withShadow=new Uint8Array(256*344*4),withoutShadow=new Uint8Array(withShadow.length);
 renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,256,344,withShadow);
 sun.castShadow=false;renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,256,344,withoutShadow);sun.castShadow=true;
 const shark=scene.getObjectByName('BlacktipReefShark');
 assert(shark,'Expected exactly one juvenile shark');
 place.update(0,6,{...sampleTime(12),beamStrength:1});
 renderer.render(scene,camera);const animalPixels=new Uint8Array(withShadow.length);renderer.readRenderTargetPixels(target,0,0,256,344,animalPixels);
 shark!.visible=false;sun.shadow.needsUpdate=true;renderer.render(scene,camera);
 const noAnimalPixels=new Uint8Array(withShadow.length);renderer.readRenderTargetPixels(target,0,0,256,344,noAnimalPixels);
 const sharkPixels=animalPixels.reduce((sum,n,i)=>sum+(i%4!==3&&Math.abs(n-noAnimalPixels[i])>4?1:0),0);
 assert(sharkPixels>30,'Shark and its shadow must reach the real render');
 shark!.visible=true;sun.shadow.needsUpdate=true;
 const pose=shark!.getObjectByName('Spine_13')!.matrix.toArray();
 place.update(0,6,{...sampleTime(12),beamStrength:1});
 assert(JSON.stringify(pose)===JSON.stringify(shark!.getObjectByName('Spine_13')!.matrix.toArray()),'Paused shark must retain its exact bone pose');
 const momentPixels:Uint8Array[]=[];
 for(const hour of [6.5,12,17.5,23]){
  place.update(0,12,{...sampleTime(hour),beamStrength:1});renderer.render(scene,camera);
  const pixels=new Uint8Array(withShadow.length);renderer.readRenderTargetPixels(target,0,0,256,344,pixels);momentPixels.push(pixels);
 }
 const momentTotals=momentPixels.map(p=>p.reduce((sum,n,i)=>sum+(i%4===3?0:n),0));
 assert(new Set(momentTotals).size===4,'Four moments must produce different renders');
 assert(momentTotals[3]<momentTotals[1]*.65,'Night must be darker than noon');
 let changed=0,totalDifference=0;
 for(let i=0;i<withShadow.length;i+=4){const d=Math.abs(withShadow[i]-withoutShadow[i])+Math.abs(withShadow[i+1]-withoutShadow[i+1])+Math.abs(withShadow[i+2]-withoutShadow[i+2]);if(d>9)changed++;totalDifference+=d;}
 assert(changed>200,'Live shadow pass must visibly change the image');
 place.update(0,120,{intensity:0,warmth:0,angle:1,activity:1,lowQuality:true});
 renderer.render(scene,camera);assert(sun.shadow.mapSize.x===1024,'Low quality must reduce shadow resolution');
 // Reproduce the grazing dawn seam against the same shipped geometry and sky.
 camera.position.set(-.9,1.8,1);camera.lookAt(1.25,.4,-1.1);camera.fov=42;camera.updateProjectionMatrix();
 place.update(0,0,{...sampleTime(6.5),beamStrength:1});
 const transport=scene.getObjectByName('WindowTransport');assert(transport,'Window transport missing');
 const bounceLights=transport.children.filter(o=>o instanceof THREE.SpotLight) as THREE.SpotLight[];
 assert(bounceLights.length===3&&bounceLights.some(l=>l.intensity>0),'Window rays must produce bounce receivers');
 renderer.render(scene,camera);const bounceOn=new Uint8Array(withShadow.length);renderer.readRenderTargetPixels(target,0,0,256,344,bounceOn);
 transport.visible=false;renderer.render(scene,camera);const bounceOff=new Uint8Array(withShadow.length);renderer.readRenderTargetPixels(target,0,0,256,344,bounceOff);transport.visible=true;
 let bounceDifference=0;for(let i=0;i<bounceOn.length;i+=4)bounceDifference+=Math.abs(bounceOn[i]-bounceOff[i])+Math.abs(bounceOn[i+1]-bounceOff[i+1])+Math.abs(bounceOn[i+2]-bounceOff[i+2]);
 assert(bounceDifference>100,'Bounce must affect actual shaded pixels');
 const depth=architecture[0].customDepthMaterial;
 assert(depth instanceof THREE.MeshDepthMaterial,'Closed interior must own slope-compensated shadow depth');
 const seamRender=()=>{sun.shadow.needsUpdate=true;renderer.render(scene,camera);const pixels=new Uint8Array(withShadow.length);renderer.readRenderTargetPixels(target,0,0,256,344,pixels);return pixels;};
 const sealedPixels=seamRender(),sunEnergy=sun.intensity;
 sun.intensity=0;const skyPixels=seamRender();sun.intensity=sunEnergy;
 const surfaceMaterial=architecture[0].material as THREE.MeshStandardMaterial;
 const sides=surfaceMaterial.shadowSide;surfaceMaterial.shadowSide=THREE.BackSide;architecture[0].customDepthMaterial=undefined;
 const legacyPixels=seamRender();surfaceMaterial.shadowSide=sides;architecture[0].customDepthMaterial=depth;
 const seamEnergy=(pixels:Uint8Array)=>{
  let total=0;
  for(let y=.3;y<1.8;y+=.025){
   const p=new THREE.Vector3(1.25,y,-1.1).project(camera),px=Math.floor((p.x+1)*128),py=Math.floor((p.y+1)*172);
   if(px<2||px>253||py<2||py>341)continue;
   let peak=0;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const i=((py+dy)*256+px+dx)*4;
    peak=Math.max(peak,pixels[i]+pixels[i+1]+pixels[i+2]-skyPixels[i]-skyPixels[i+1]-skyPixels[i+2]);
   }
   total+=peak;
  }
  return total;
 };
 const seamRegression={legacy:seamEnergy(legacyPixels),fixed:seamEnergy(sealedPixels)};
 if(rearWindow)assert(seamRegression.legacy>100&&seamRegression.fixed<seamRegression.legacy*.15,'Dawn corner must not retain a sunlit outline '+JSON.stringify(seamRegression));
 place.dispose();place.dispose();renderer.render(scene,camera);
 assert(scene.children.length===0,'Scene resources were not detached');
 assert(renderer.info.memory.geometries===baseline.geometries,'Geometry leak after dispose');
 assert(renderer.info.memory.textures===baseline.textures,'Texture/shadow-map leak after dispose');
 const unused=await prepareStairlight();unused.dispose();unused.dispose();
 renderer.setRenderTarget(null);target.dispose();renderer.dispose();
 const result={passed:true,windowLayout:rearWindow?'rear':'side',checks:['baked-PBR-and-indirect','actual-window-ray-clear','room-ray-blocked','live-shadow-pixel-difference','time-of-day-four-renders','sealed-wall-joint','15-degree-orbit','low-quality-shadow-map','idempotent-disposal','unused-factory-disposal','real-skinned-shark-visible','paused-shark-pose'],seamRegression,bounceDifference,sharkPixels,changedPixels:changed,totalDifference,momentTotals,baseline,afterDispose:{...renderer.info.memory}};
 output.textContent=JSON.stringify(result,null,2);output.dataset.passed='true';
}
run().catch(error=>{output.textContent=error.stack??String(error);output.dataset.passed='false';console.error(error);});
