import * as THREE from 'three';
import {seededRandom} from '../../shared/math/seededRandom.ts';

// Art-directed coastal breeze. Absolute seconds, not measured wind velocity.
export function breeze(t:number){
 const pulse=(center:number,width:number)=>Math.exp(-Math.pow((t-center)/width,2));
 const cycle=((t%83)+83)%83;
 const gust=pulse(29,3.4)+.75*pulse(66,4.2);
 return .16+.055*Math.sin(t*.39)+.035*Math.sin(t*.83)+gust*.7;
}

export function createGrass(day={value:1}){
 const group=new THREE.Group();group.name='seaward-coastal-grass';
 const random=seededRandom(91);
 const materials=[0x77734d,0x8b815b,0x62684a].map(color=>new THREE.MeshStandardMaterial({color,roughness:.94,side:THREE.DoubleSide}));
 // Local open-sky/backlit leaf fill at the mouth of the tunnel, not emission.
 for(const material of materials){
  material.onBeforeCompile=shader=>{
   shader.uniforms.uGrassDay=day;
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uGrassDay;').replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.24,.26,.20)*uGrassDay;');
  };
  material.customProgramCacheKey=()=> 'seaward-grass-sky-fill-v1';
 }
 const blades:{mesh:THREE.Mesh;rest:Float32Array;phase:number;flex:number}[]=[];
 for(let i=0;i<150;i++){
  const side=i<75?-1:1,x=side*(2.65+random()*.65),z=-11.65+random()*.65;
  const height=.22+random()*.67,heading=random()*Math.PI*2,lean=.08+random()*.23;
  const width=.009+random()*.019,positions:number[]=[],indices:number[]=[];
  for(let j=0;j<=9;j++){
   const f=j/9,bend=lean*f*f,w=width*Math.pow(1-f,.7)+.0003;
   for(const edge of [-1,1])positions.push(Math.cos(heading)*bend+Math.sin(heading)*w*edge,height*f,Math.sin(heading)*bend-Math.cos(heading)*w*edge);
   if(j<9){const k=j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,materials[i%3]);mesh.position.set(x,.005,z);mesh.frustumCulled=false;group.add(mesh);
  blades.push({mesh,rest:new Float32Array(positions),phase:random()*6.28,flex:.7+random()*.6});
 }
 return {group,update(elapsed:number){
  for(const {mesh,rest,phase,flex} of blades){
   const wind=breeze(elapsed-phase*.13),array=mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
   for(let j=0;j<=9;j++){
    const f=j/9,weight=f*f;
    const bend=weight*flex*(wind*.18+Math.sin(elapsed*1.6-phase-f*1.4)*(.012+wind*.025));
    for(let edge=0;edge<2;edge++){
     const k=j*2+edge;array.setXYZ(k,rest[k*3]+bend,rest[k*3+1]-Math.abs(bend)*f*.15,rest[k*3+2]+weight*(wind*.075+Math.sin(elapsed*1.1+phase-f)*.012));
    }
   }
   array.needsUpdate=true;mesh.geometry.computeVertexNormals();
  }
 }};
}
