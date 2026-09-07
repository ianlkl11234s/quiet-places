import * as THREE from 'three';
import {seededRandom} from '../../shared/math/seededRandom.ts';

export function createAfterlightWeather(scene:THREE.Scene){
 const root=new THREE.Group();root.name='afterlight-sunshower';scene.add(root);
 const random=seededRandom(74019),count=80;
 const drops=Array.from({length:count},()=>({phase:random(),seed:random()*1000,speed:4+random()*2.5,length:.035+random()*.065,brightness:.35+random()*.65}));
 const positions=new Float32Array(count*6),alphas=new Float32Array(count*2);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('alpha',new THREE.BufferAttribute(alphas,1));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
  vertexShader:'attribute float alpha; varying float vAlpha; void main(){vAlpha=alpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying float vAlpha; void main(){gl_FragColor=vec4(.72,.78,.76,vAlpha);}',
 });
 const rain=new THREE.LineSegments(geometry,material);rain.frustumCulled=false;rain.renderOrder=3;root.add(rain);
 // Small broken arcs suggest shallow wet concrete instead of a pond full of rings.
 const ringGeometry=new THREE.RingGeometry(.94,1,20,1,0,Math.PI*1.4);ringGeometry.rotateX(-Math.PI/2);
 const rings=drops.slice(0,10).map(()=>{
  const mat=new THREE.MeshBasicMaterial({color:0x9caeaa,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(ringGeometry,mat);mesh.renderOrder=2;root.add(mesh);return mesh;
 });
 const hash=(n:number)=>{const v=Math.sin(n*12.9898)*43758.5453;return v-Math.floor(v);};
 const origin=(seed:number,cycle:number)=>({x:.68+hash(seed+cycle*7.13)*.51,z:-1.19+hash(seed+cycle*13.71+4)*.77});
 return {root,
  update(time:number,strength:number,day:number,low:boolean,angle=.25){
   const n=Math.floor(count*THREE.MathUtils.clamp(strength,0,1)*(low?.45:1));root.visible=n>0;
   geometry.setDrawRange(0,n*2);
   const turn=THREE.MathUtils.clamp(angle-.25,-.16,.16),sx=.28*Math.cos(turn)+.25*Math.sin(turn),sz=.25*Math.cos(turn)-.28*Math.sin(turn);
   drops.forEach((d,i)=>{
    const cycle=time*d.speed/3+d.phase,index=Math.floor(cycle),phase=cycle-index,y=3*(1-phase),o=origin(d.seed,index);
    // Slight shared drift, with a new deterministic entry point on each descent.
    const drift=.012*(3-y),x=o.x+drift,z=o.z+drift*.35;
    positions.set([x,y,z,x-.012*d.length,Math.min(3,y+d.length),z-.0042*d.length],i*6);
    const qx=x-sx*(3-y),qz=z-sz*(3-y),smooth=THREE.MathUtils.smoothstep;
    const lit=smooth(qx,.62,.68)*(1-smooth(qx,1.22,1.28))*smooth(qz,-1.25,-1.19)*(1-smooth(qz,-.41,-.35));
    const fade=smooth(y,0,.12)*(1-smooth(y,2.88,3));
    const alpha=d.brightness*fade*(.018+.19*lit)*(.25+.75*day);
    alphas[i*2]=alpha;alphas[i*2+1]=alpha*.08;
    if(i<rings.length){
     const age=phase*3/d.speed,ring=rings[i],impact=origin(d.seed,index-1);
     ring.visible=i<n&&age<.36;
     ring.position.set(impact.x+.036,.003,impact.z+.0126);ring.rotation.y=hash(d.seed+index)*Math.PI*2;
     ring.scale.setScalar(.008+age*.09);
     (ring.material as THREE.MeshBasicMaterial).opacity=Math.sin(Math.min(1,age/.36)*Math.PI)*.075*(.25+.75*day)*d.brightness;
    }
   });
   geometry.attributes.position.needsUpdate=true;geometry.attributes.alpha.needsUpdate=true;
  },
  dispose(){root.removeFromParent();geometry.dispose();material.dispose();ringGeometry.dispose();rings.forEach(r=>(r.material as THREE.Material).dispose());},
 };
}
