import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {EXRLoader} from 'three/addons/loaders/EXRLoader.js';
import {createRedTwine} from './RedTwine.ts';
import {createShark} from './Shark.ts';
import {createWindowTransport} from './WindowTransport.ts';
import type {PlaceInstance} from '../../player/contracts.ts';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';

/** The window, frame, room and railing all participate in the same shadow pass. */
function windowSun(root:THREE.Object3D){
  const sun=new THREE.DirectionalLight(new THREE.Color().setRGB(1,.82,.60),3.5);
  const bounds=new THREE.Box3().setFromObject(root);
  const center=bounds.getCenter(new THREE.Vector3());
  // Blender (x,y,z) -> glTF/Three (x,z,-y); source incoming direction (1,2.5,-2.4).
  const incoming=new THREE.Vector3(1,-2.4,-2.5).normalize();
  sun.position.copy(center).addScaledVector(incoming,-14);
  sun.target.position.copy(center);
  sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  // Closed interior corners need both caster faces; compensate front-face self-shadowing.
  sun.shadow.bias=-.00001;sun.shadow.normalBias=.002;
  sun.shadow.camera.near=.1;sun.shadow.camera.far=30;
  sun.target.updateMatrixWorld(true);sun.updateMatrixWorld(true);sun.shadow.updateMatrices(sun);
  // Fit the enclosing sphere for every sun direction, avoiding clipped moving shadows.
  const radius=bounds.getBoundingSphere(new THREE.Sphere()).radius;
  Object.assign(sun.shadow.camera,{left:-radius,right:radius,bottom:-radius,top:radius});
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;
  return sun;
}

export async function prepareStairlight(){
  const rearWindow=new URLSearchParams(location.search).get('window')!=='side';
  const asset=rearWindow?'stairlight-rear':'stairlight';
  const gltf=await new GLTFLoader().loadAsync(`/models/${asset}.glb`);
  const root=gltf.scene;
  // Both faces seal interior shadow corners. Offset packed depth by the local
  // raster slope (PCF footprint), avoiding grazing-angle acne on walls/rails.
  // polygonOffset alone cannot do this: RGBADepthPacking stores unoffset Z.
  const shadowDepth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
  shadowDepth.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('packDepthToRGBA( fragCoordZ )',
      'packDepthToRGBA( min(1., fragCoordZ + 1.5*max(abs(dFdx(fragCoordZ)),abs(dFdy(fragCoordZ)))) )');
  };
  shadowDepth.customProgramCacheKey=()=> 'stairlight-slope-depth-v1';
  const releaseModel=()=>{shadowDepth.dispose();disposeModelResources(collectModelResources(root));root.removeFromParent();};
  let indirect:THREE.DataTexture;
  try{indirect=await new EXRLoader().loadAsync(`/textures/${asset}/room-indirect.exr`);}
  catch(error){releaseModel();throw error;}
  root.updateMatrixWorld(true);
  const hero=root.getObjectByName('Camera_Hero');
  if(!(hero instanceof THREE.PerspectiveCamera)){
    indirect.dispose();releaseModel();throw new Error('樓梯間缺少主鏡頭。');
  }
  const position=hero.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(.45,0,.1));
  // Center the landing return and leave room for a safe 15 degree orbit inside the left wall.
  const target=new THREE.Vector3(-.309,.88,-.10);
  const up=new THREE.Vector3(0,1,0);
  // EXR is linear sky irradiance (direct sky + bounce), without sunlight or albedo. Match exported UV0 orientation.
  indirect.colorSpace=THREE.LinearSRGBColorSpace;indirect.channel=0;indirect.flipY=false;
  indirect.repeat.y=-1;indirect.offset.y=1;
  const skyTint={value:new THREE.Color(1,1,1)};
  const materials:THREE.MeshStandardMaterial[]=[];
  let surfaces=0;
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    object.castShadow=true;object.receiveShadow=true;object.customDepthMaterial=shadowDepth;
    if(!object.geometry.getAttribute('uv'))return;
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      if(!(material instanceof THREE.MeshStandardMaterial))continue;
      material.lightMap=indirect;material.lightMapIntensity=Math.PI;
      material.shadowSide=THREE.DoubleSide;
      material.onBeforeCompile=shader=>{
        shader.uniforms.stairSkyTint=skyTint;
        shader.fragmentShader='uniform vec3 stairSkyTint;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',THREE.ShaderChunk.lights_fragment_maps.replace('lightMapTexel.rgb * lightMapIntensity','lightMapTexel.rgb * lightMapIntensity * stairSkyTint'));
      };
      material.customProgramCacheKey=()=> 'stairlight-sky-tint-v1';
      material.needsUpdate=true;materials.push(material);surfaces++;
    }
  });
  if(!surfaces){indirect.dispose();releaseModel();throw new Error('樓梯間缺少烘焙材質與 UV。');}
  let shark:ReturnType<typeof createShark>;
  let sharkModel:THREE.Group|undefined;
  try{
    sharkModel=(await new GLTFLoader().loadAsync('/models/blacktip-shark.glb')).scene;
    shark=createShark(sharkModel,rearWindow);
  }catch(error){
    if(sharkModel)disposeModelResources(collectModelResources(sharkModel));
    indirect.dispose();releaseModel();throw error;
  }
  let consumed=false,released=false;
  const release=()=>{if(released)return;released=true;shark.dispose();releaseModel();};
  const factory=(scene:THREE.Scene,renderer:THREE.WebGLRenderer):PlaceInstance=>{
    if(consumed)throw new Error('樓梯間資源已使用。');
    consumed=true;
    scene.add(root,shark.root);scene.background=new THREE.Color().setRGB(.55,.64,.80);
    const sun=windowSun(root);scene.add(sun,sun.target);
    const twine=createRedTwine(),tieAngle=THREE.MathUtils.degToRad(165);
    twine.root.position.set(-.309+.17*Math.cos(tieAngle),.88,-(.10+.17*Math.sin(tieAngle)));
    // Reverse the tangent so the knot and tails hang outside the U, facing the camera.
    twine.root.rotation.y=tieAngle+Math.PI/2;scene.add(twine.root);
    // Local diffuse sky bounce for the unbaked moving tape only; never emissive.
    const twineSky={value:new THREE.Color(.55,.64,.8)};
    const twineWindow={value:rearWindow?new THREE.Vector3(-.269,3.0,4.10):new THREE.Vector3(-1.679,3.4,2.5)};
    const twineWindowArea={value:rearWindow?5.0:7.84};
    const tapeMaterials=new Set<THREE.MeshStandardMaterial>();
    twine.root.traverse(o=>{if(o instanceof THREE.Mesh&&o.material instanceof THREE.MeshStandardMaterial)tapeMaterials.add(o.material);});
    for(const material of tapeMaterials){
      material.onBeforeCompile=shader=>{
        shader.uniforms.twineSky=twineSky;shader.uniforms.twineWindow=twineWindow;shader.uniforms.twineWindowArea=twineWindowArea;
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 twineWorld;').replace('#include <project_vertex>','#include <project_vertex>\ntwineWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
        shader.fragmentShader='uniform vec3 twineSky;\nuniform vec3 twineWindow;\nuniform float twineWindowArea;\nvarying vec3 twineWorld;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',`#include <lights_fragment_maps>
vec3 tapeWindowDirection=twineWindow-twineWorld;
float tapeOpening=min(.65,twineWindowArea/max(dot(tapeWindowDirection,tapeWindowDirection),1.));
float tapeFacing=max(dot(inverseTransformDirection(normal,viewMatrix),normalize(tapeWindowDirection)),0.);
irradiance += twineSky*(.018+.65*tapeOpening*tapeFacing);`);
      };
      material.customProgramCacheKey=()=> 'stairlight-twine-window-bounce-v2';
    }
    const transport=createWindowTransport(root,sun,rearWindow);
    scene.add(transport.root);transport.attach(root);transport.attach(shark.root);transport.attach(twine.root);
    const center=sun.target.position.clone(),incoming=new THREE.Vector3();
    const nightTint=new THREE.Color(.48,.65,1),dayTint=new THREE.Color(1,1,1),moonTint=new THREE.Color(.38,.55,1);
    let lastElapsed=-1,lastAngle=NaN;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    let quality:number|undefined;
    return {
      position:position.toArray() as [number,number,number],target:target.toArray() as [number,number,number],
      cameraUp:up.toArray() as [number,number,number],framingAspect:896/1216,
      fov:hero.fov,yawRange:Math.PI/12,exposure:2**1.2,toneMapping:THREE.AgXToneMapping,
      hasSimulation:false,waterMode:'窗光隨時刻移動，一尾幼鯊沿樓梯緩緩巡游',
      update(_dt,elapsed,state){
        const daylight=THREE.MathUtils.clamp((state.intensity-.13)/.72,0,1);
        if(rearWindow)incoming.set(.12+state.angle*.65,-(2.6-Math.abs(state.angle)*1.1),-3.0).normalize();
        else incoming.set(1.1+state.angle*.35,-(2.8-Math.abs(state.angle)*1.6),-(2+state.angle*1.2)).normalize();
        sun.position.copy(center).addScaledVector(incoming,-14);
        sun.color.setRGB(1,1-.32*state.warmth,1-.62*state.warmth).lerp(moonTint,1-Math.min(1,daylight*4));
        sun.intensity=(3.5*daylight+.10*(1-daylight))*(state.beamStrength??1);
        transport.update(incoming,!!state.lowQuality,elapsed);
        skyTint.value.copy(nightTint).lerp(dayTint,Math.min(1,daylight*3));
        for(const material of materials)material.lightMapIntensity=Math.PI*THREE.MathUtils.clamp(state.intensity/.9,.18,1.2);
        twineSky.value.copy(skyTint.value).multiplyScalar(.65*THREE.MathUtils.clamp(state.intensity/.9,.09,1.2));
        shark.update(elapsed,state.intensity);
        if(lastElapsed!==elapsed||lastAngle!==state.angle){
          twine.update(elapsed,state.activity);sun.shadow.needsUpdate=true;lastElapsed=elapsed;lastAngle=state.angle;
        }
        // A preceding scene may release its shadow settings after this scene is prepared.
        renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
        const resolution=state.lowQuality?1024:2048;
        if(resolution!==quality){
          quality=resolution;sun.shadow.map?.dispose();sun.shadow.map=null;
          sun.shadow.mapSize.set(resolution,resolution);sun.shadow.needsUpdate=true;
        }
      },
      disturb(){},resetWater(){},
      dispose(){if(released)return;sun.shadow.map?.dispose();sun.shadow.mapPass?.dispose();sun.removeFromParent();sun.target.removeFromParent();transport.dispose();twine.dispose();release();},
    };
  };
  return Object.assign(factory,{dispose(){if(!consumed){consumed=true;release();}}});
}
