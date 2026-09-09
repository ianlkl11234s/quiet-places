import * as THREE from 'three';

/** First-hit solar bounce and restrained single scattering; scene-local approximation. */
export function createWindowTransport(room:THREE.Object3D,sun:THREE.DirectionalLight,rear:boolean){
  const root=new THREE.Group();root.name='WindowTransport';
  const ray=new THREE.Raycaster(),normal=new THREE.Vector3(),point=new THREE.Vector3();
  const slots=Array.from({length:3},()=>{
    const light=new THREE.SpotLight(0xffffff,0,5,Math.PI*.47,1,2);
    light.castShadow=true;light.shadow.mapSize.set(256,256);light.shadow.bias=-.00002;light.shadow.normalBias=.012;
    light.shadow.camera.near=.025;light.shadow.camera.far=5;
    light.shadow.autoUpdate=false;root.add(light,light.target);return light;
  });
  const scatterColor={value:new THREE.Color()},shadowMatrix={value:sun.shadow.matrix};
  const steps={value:12};let previous='',disposed=false,lastElapsed=NaN;
  const attached=new Set<THREE.Material>();
  function attach(model:THREE.Object3D){
    model.traverse(o=>{
      if(!(o instanceof THREE.Mesh))return;
      for(const mat of Array.isArray(o.material)?o.material:[o.material]){
        if(!(mat instanceof THREE.MeshStandardMaterial)||attached.has(mat))continue;attached.add(mat);
        const compile=mat.onBeforeCompile,key=mat.customProgramCacheKey();
        mat.onBeforeCompile=(shader,renderer)=>{
          compile.call(mat,shader,renderer);
          Object.assign(shader.uniforms,{transportSun:scatterColor,transportShadowMatrix:shadowMatrix,transportSteps:steps});
          shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 transportWorld;').replace('#include <project_vertex>','#include <project_vertex>\ntransportWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
          shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 transportWorld;
uniform vec3 transportSun;
uniform mat4 transportShadowMatrix;
uniform int transportSteps;`);
          shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
#if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
vec3 transportRay=transportWorld-cameraPosition;
float transportLength=min(length(transportRay),8.);
vec3 transportDirection=normalize(transportRay);
float transportLit=0.;float transportAir=0.;
for(int k=0;k<12;k++){
 if(k>=transportSteps)break;
 float d=(float(k)+.5)*transportLength/float(transportSteps);
 vec3 p=transportWorld-transportDirection*d;
 if(p.x< -1.67||p.x>1.24||p.y< -5.49||p.y>4.99||p.z< -1.09||p.z>4.09)continue;
 float ds=transportLength/float(transportSteps);transportAir+=ds;
 vec4 q=transportShadowMatrix*vec4(p,1.);q.xyz/=q.w;
 if(q.x<0.||q.x>1.||q.y<0.||q.y>1.||q.z<0.||q.z>1.)continue;
 float depth=unpackRGBAToDepth(texture2D(directionalShadowMap[0],q.xy));
 transportLit+=step(q.z-.00002,depth)*ds*exp(-.012*(transportLength-d));
}
gl_FragColor.rgb=gl_FragColor.rgb*exp(-.012*transportAir)+transportSun*(.008/(4.*PI))*transportLit;
#endif`);
        };
        mat.customProgramCacheKey=()=>key+'-window-single-scatter-v1';mat.needsUpdate=true;
      }
    });
  }
  return {root,attach,
    update(incoming:THREE.Vector3,lowQuality:boolean,elapsed=0){
      if(lastElapsed!==elapsed){for(const light of slots)light.shadow.needsUpdate=true;lastElapsed=elapsed;}
      scatterColor.value.copy(sun.color).multiplyScalar(sun.intensity);steps.value=lowQuality?6:12;
      const signature=incoming.toArray().join(',')+sun.intensity+sun.color.getHex();
      if(signature===previous)return;previous=signature;room.updateMatrixWorld(true);
      slots.forEach((light,i)=>{
        // Three aperture strata; rays terminate at actual room geometry, including frames.
        point.copy(rear?new THREE.Vector3(-.269+(i-1)*.72,3,4.11):new THREE.Vector3(-1.69,3.4,2.5+(i-1)*.8));
        ray.set(point,incoming);ray.far=12;
        const hit=ray.intersectObject(room,true).find(h=>h.distance>.02);
        light.intensity=0;if(!hit?.face)return;
        normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
        if(normal.dot(incoming)>0)normal.negate();
        const incidence=Math.max(0,-normal.dot(incoming));
        // Representative plaster/terrazzo reflectance, not sampled texture albedo.
        light.color.copy(sun.color).multiply(new THREE.Color().setRGB(.43,.37,.28));
        light.intensity=sun.intensity*incidence*Math.abs(rear?incoming.z:incoming.x)*(rear?5:7.84)/3/Math.PI*.55;
        light.position.copy(hit.point).addScaledVector(normal,.035);
        light.target.position.copy(light.position).add(normal);
        light.target.updateMatrixWorld(true);light.shadow.needsUpdate=true;
      });
    },
    dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const light of slots)light.shadow.dispose();},
  };
}
