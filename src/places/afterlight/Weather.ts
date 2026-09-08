import * as THREE from 'three';
import {drainIsOpen} from './DrainOpening.ts';
import {activeRainCount,rainDrops,rainSample,rainOrigin,type RainBlock} from './RainField.ts';

export function createAfterlightWeather(scene:THREE.Scene){
 const root=new THREE.Group();root.name='afterlight-sunshower';scene.add(root);
 const drops=rainDrops,count=drops.length;
 const positions=new Float32Array(count*18),alphas=new Float32Array(count*6);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('alpha',new THREE.BufferAttribute(alphas,1));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
  vertexShader:'attribute float alpha; varying float vAlpha; void main(){vAlpha=alpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying float vAlpha; void main(){gl_FragColor=vec4(.72,.78,.76,vAlpha);}',
 });
 const rain=new THREE.Mesh(geometry,material);rain.frustumCulled=false;rain.renderOrder=3;root.add(rain);
 // Small broken arcs suggest shallow wet concrete instead of a pond full of rings.
 const ringGeometry=new THREE.RingGeometry(.94,1,20,1,0,Math.PI*1.4);ringGeometry.rotateX(-Math.PI/2);
 const rings=drops.slice(0,24).map(()=>{
  const mat=new THREE.MeshBasicMaterial({color:0x9caeaa,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(ringGeometry,mat);mesh.renderOrder=2;root.add(mesh);return mesh;
 });
 const splashGeometry=new THREE.SphereGeometry(.0014,4,3),splashMaterial=new THREE.MeshBasicMaterial({color:0x647b79,transparent:true,opacity:.34,depthWrite:false});
 const splashes=new THREE.InstancedMesh(splashGeometry,splashMaterial,48);splashes.name='afterlight-heavy-splashes';splashes.count=0;splashes.frustumCulled=false;root.add(splashes);
 const splashMatrix=new THREE.Matrix4();
 const hash=(n:number)=>{const v=Math.sin(n*12.9898)*43758.5453;return v-Math.floor(v);};
 const origin=rainOrigin;
 return {root,
  update(time:number,strength:number,day:number,low:boolean,angle=.25,blocked?:ReadonlyMap<number,RainBlock>,heavy=false){
   const n=Math.floor(activeRainCount(strength,heavy)*(low?.45:1));root.visible=n>0;
   geometry.setDrawRange(0,n*6);
   const turn=THREE.MathUtils.clamp(angle-.25,-.16,.16),sx=.28*Math.cos(turn)+.25*Math.sin(turn),sz=.25*Math.cos(turn)-.28*Math.sin(turn);
   let splashCount=0;
   drops.forEach((d,i)=>{
    const {cycle:index,phase,y,x,z}=rainSample(i,time);
    const length=d.length*(heavy?1.25:1),topX=x-.012*length,topY=Math.min(3,y+length),topZ=z-.0042*length,w=d.width*.5;
    positions.set([x-w,y,z,x+w,y,z,topX+w,topY,topZ,x-w,y,z,topX+w,topY,topZ,topX-w,topY,topZ],i*18);
    const qx=x-sx*(3-y),qz=z-sz*(3-y),smooth=THREE.MathUtils.smoothstep;
    const lit=(drainIsOpen(qx,qz)?1:0);
    const fade=smooth(y,0,.12)*(1-smooth(y,2.88,3));
    const intercepted=blocked?.get(i);
    const alpha=intercepted?.cycle===index&&y<intercepted.y?0:d.brightness*fade*(.018+.19*lit)*(.25+.75*day);
    alphas.set([alpha,alpha,alpha*.08,alpha,alpha*.08,alpha*.08],i*6);
    if(i<rings.length){
     const age=phase*3/d.speed,ring=rings[i],impact=origin(d.seed,index-1);
     ring.visible=i<(heavy?24:10)&&i<n&&age<.36&&blocked?.get(i)?.cycle!==index-1;
     if(heavy&&ring.visible&&age<.075){
      for(let j=0;j<2;j++){
       const direction=hash(d.seed+index+j*29)*Math.PI*2,travel=age*(.065+j*.035);
       splashMatrix.makeTranslation(impact.x+.036+Math.cos(direction)*travel,.003+.38*age-4.905*age*age,impact.z+.0126+Math.sin(direction)*travel);
       splashes.setMatrixAt(splashCount++,splashMatrix);
      }
     }
     ring.position.set(impact.x+.036,.003,impact.z+.0126);ring.rotation.y=hash(d.seed+index)*Math.PI*2;
     ring.scale.setScalar(.008+age*.09);
     (ring.material as THREE.MeshBasicMaterial).opacity=Math.sin(Math.min(1,age/.36)*Math.PI)*.075*(.25+.75*day)*d.brightness*(heavy?1.5:1);
    }
   });
   splashes.count=splashCount;splashes.instanceMatrix.needsUpdate=true;
   geometry.attributes.position.needsUpdate=true;geometry.attributes.alpha.needsUpdate=true;
  },
  dispose(){root.removeFromParent();splashes.dispose();splashGeometry.dispose();splashMaterial.dispose();geometry.dispose();material.dispose();ringGeometry.dispose();rings.forEach(r=>(r.material as THREE.Material).dispose());},
 };
}
