import * as THREE from 'three';
import {seededRandom} from '../../shared/math/seededRandom.ts';

// Art-directed coastal breeze. Absolute seconds, not measured wind velocity.
export function breeze(t:number){
 const pulse=(center:number,width:number)=>Math.exp(-Math.pow((t-center)/width,2));
 const cycle=((t%83)+83)%83;
 const gust=pulse(29,3.4)+.75*pulse(66,4.2);
 return .105+.025*Math.sin(t*.39)+.018*Math.sin(t*.83)+gust*.52;
}

type Blade={mesh:THREE.Mesh;rest:Float32Array;phase:number;flex:number;delay:number};

export function createGrass(day={value:1}){
 const group=new THREE.Group();group.name='seaward-coastal-grass';
 const random=seededRandom(91);
 const materials=[0x5f6544,0x73724d,0x8b8059,0x9a8d68].map(color=>new THREE.MeshStandardMaterial({color,roughness:.95,side:THREE.DoubleSide,vertexColors:true}));
 // Local open-sky/backlit leaf fill at the mouth of the tunnel, not emission.
 for(const material of materials){
  material.onBeforeCompile=shader=>{
   shader.uniforms.uGrassDay=day;
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uGrassDay;').replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.20,.22,.16)*uGrassDay;');
  };
  material.customProgramCacheKey=()=> 'seaward-grass-sky-fill-v2';
 }
 const blades:Blade[]=[];
 const makeBlade=(x:number,z:number,height:number,kind:'right'|'left'|'edge')=>{
  const heading=random()*Math.PI*2;
  const width=.0045+random()*.011;
  const lean=.045+random()*.18;
  const old=random()<.26;
  const segments=10,positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const base=new THREE.Color(.78+random()*.1,.82+random()*.08,.62+random()*.1);
  const tip=new THREE.Color(old?.54:.68,old?.51:.64,old?.35:.43);
  for(let j=0;j<=segments;j++){
   const f=j/segments;
   const bend=lean*(old?f*(.55+f*.75):f*f);
   const sideways=old?Math.sin(f*Math.PI)*lean*.18:0;
   const w=width*Math.pow(1-f,.76)+.00022;
   const c=base.clone().lerp(tip,Math.max(0,(f-.55)/.45));
   for(const edge of [-1,1]){
    positions.push(Math.cos(heading)*bend+Math.sin(heading)*(w*edge+sideways),height*f,Math.sin(heading)*bend-Math.cos(heading)*(w*edge+sideways));
    colors.push(c.r,c.g,c.b);
   }
   if(j<segments){const k=j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,materials[Math.floor(random()*materials.length)]);
  mesh.name='seaward-grass-blade';mesh.position.set(x,.006,z);mesh.frustumCulled=false;
  mesh.userData.grassBlade={kind,height};group.add(mesh);
  // Taller leaves take the gust first; short leaves read it a little later.
  blades.push({mesh,rest:new Float32Array(positions),phase:random()*6.28,flex:.65+random()*.65,delay:(1-height/.98)*.72});
 };
 // One rooted, loose-edged clump against the right opening wall. The left side is only a quiet echo.
 for(let i=0;i<174;i++){
  const radius=Math.sqrt(random()),angle=random()*Math.PI*2;
  makeBlade(3.02+Math.cos(angle)*radius*.33,-11.30+Math.sin(angle)*radius*.21,.38+random()*.58,'right');
 }
 for(let i=0;i<24;i++) makeBlade(-2.78+random()*.23,-11.31+random()*.20,.16+random()*.27,'left');
 for(let i=0;i<8;i++) makeBlade(2.58+random()*.22,-11.18+random()*.20,.12+random()*.22,'edge');
 const addGroundPatch=(x:number,z:number,scale:number)=>{
  const sediment=new THREE.Mesh(new THREE.CircleGeometry(scale,16),new THREE.MeshStandardMaterial({color:0x4d493a,roughness:1,transparent:true,opacity:.48,side:THREE.DoubleSide}));
  sediment.name='seaward-grass-sediment';sediment.rotation.x=-Math.PI/2;sediment.position.set(x,.008,z);group.add(sediment);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(scale*.72,16),new THREE.MeshBasicMaterial({color:0x151713,transparent:true,opacity:.26,depthWrite:false,side:THREE.DoubleSide}));
  shadow.name='seaward-grass-crevice-shadow';shadow.rotation.x=-Math.PI/2;shadow.position.set(x+.025,.009,z+.01);group.add(shadow);
 };
 addGroundPatch(3.02,-11.30,.29);addGroundPatch(-2.68,-11.22,.11);
 return {group,update(elapsed:number){
  for(const {mesh,rest,phase,flex,delay} of blades){
   const wind=breeze(elapsed-delay),array=mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
   for(let j=0;j<=10;j++){
    const f=j/10,weight=f*f;
    const tremor=Math.sin(elapsed*1.35-phase-f*1.7)*(.0035+wind*.012)*weight;
    const bend=weight*flex*(wind*.15+tremor);
    for(let edge=0;edge<2;edge++){
     const k=j*2+edge;array.setXYZ(k,rest[k*3]+bend,rest[k*3+1]-Math.abs(bend)*f*.12,rest[k*3+2]+weight*(wind*.052+tremor*.62));
    }
   }
   array.needsUpdate=true;mesh.geometry.computeVertexNormals();
  }
 }};
}
