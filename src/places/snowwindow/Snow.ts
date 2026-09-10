import * as THREE from 'three';
import {seededRandom} from '../../shared/math/seededRandom.ts';

export function snowParticlePosition(base:[number,number,number],speed:number,phase:number,elapsed:number){
 const fall=((base[1]+phase-elapsed*speed)%28+28)%28-3;
 const drift=Math.sin(elapsed*.19+phase*.71)*(.16+.018*Math.abs(base[2]))+Math.sin(elapsed*.53+phase)*.09;
 return {x:base[0]+drift,y:fall,z:base[2]+Math.sin(elapsed*.14+phase)*.28};
}

export function createSnowField(){
 const random=seededRandom(20260909),count=620;
 const geometry=new THREE.BufferGeometry(),positions=new Float32Array(count*3),sizes=new Float32Array(count);
 const base:Array<[number,number,number]>=[],speed:number[]=[],phase:number[]=[];
 for(let i=0;i<count;i++){
  const near=random()<.18;
  const point:[number,number,number]=[(-.5+random())*(near?18:90),-3+random()*28,near?-5.4-random()*18:-20-random()*145];
  base.push(point);speed.push(.36+random()*(near?1.25:.72));phase.push(random()*28);sizes[i]=near?.65+random()*.55:.30+random()*.25;
 }
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uSize:{value:4.8},uOpacity:{value:.54}},
  vertexShader:'attribute float aSize;uniform float uSize;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=max(1.1,uSize*aSize*8./max(5.,-mv.z));gl_Position=projectionMatrix*mv;}',
  fragmentShader:'uniform float uOpacity;void main(){float radius=length(gl_PointCoord-.5);float alpha=1.-smoothstep(.28,.5,radius);if(alpha<.01)discard;gl_FragColor=vec4(.96,.98,.98,alpha*uOpacity);}'
 });
 const points=new THREE.Points(geometry,material);points.name='snowwindow-falling-snow';points.frustumCulled=false;
 return {points,update(elapsed:number,visibility:number,lowQuality=false){
  points.visible=visibility>.025;material.uniforms.uOpacity.value=.16+.38*visibility;material.uniforms.uSize.value=lowQuality?3.8:4.8;
  const position=geometry.getAttribute('position') as THREE.BufferAttribute;
  const visibleCount=lowQuality?Math.floor(count*.58):count;geometry.setDrawRange(0,visibleCount);
  for(let i=0;i<visibleCount;i++){const p=snowParticlePosition(base[i],speed[i],phase[i],elapsed);position.setXYZ(i,p.x,p.y,p.z);}
  position.needsUpdate=true;
 },dispose(){geometry.dispose();material.dispose();points.removeFromParent();}};
}
