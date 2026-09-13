import * as THREE from 'three';
import {seededRandom} from '../../shared/math/seededRandom.ts';

export function snowHallParticle(base:[number,number,number],speed:number,phase:number,elapsed:number){
 const fall=((base[1]+phase-elapsed*speed)%10+10)%10-1;
 const gust=Math.sin(elapsed*.083+phase*.61)*(.10+.012*Math.abs(base[2]+12));
 return {x:base[0]+gust,y:fall,z:base[2]+Math.sin(elapsed*.16+phase)*.18};
}

export function createSnowHallField(){
 const random=seededRandom(20260912),count=760;
 const geometry=new THREE.BufferGeometry(),positions=new Float32Array(count*3),sizes=new Float32Array(count);
 const base:Array<[number,number,number]>=[],speed:number[]=[],phase:number[]=[];
 for(let i=0;i<count;i++){
  const near=random()<.34;
  base.push([(-.5+random())*(near?5:24),-1+random()*10,-12.3-random()*(near?10:48)]);
  speed.push(.20+random()*(near?.62:.42));phase.push(random()*10);sizes[i]=near?.78+random()*1.05:.30+random()*.42;
 }
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uOpacity:{value:.72},uSize:{value:5.4}},
  vertexShader:'attribute float aSize;uniform float uSize;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=max(1.,uSize*aSize*8./max(4.,-mv.z));gl_Position=projectionMatrix*mv;}',
  fragmentShader:'uniform float uOpacity;void main(){float d=length(gl_PointCoord-.5);float a=1.-smoothstep(.22,.5,d);if(a<.01)discard;gl_FragColor=vec4(.95,.98,1.,a*uOpacity);}'
 });
 const points=new THREE.Points(geometry,material);points.name='snowhall-window-snow';points.frustumCulled=false;points.renderOrder=6;
 return {points,update(elapsed:number,visibility:number,lowQuality=false){
  material.uniforms.uOpacity.value=.18+.54*visibility;material.uniforms.uSize.value=lowQuality?4.2:5.4;
  const visible=lowQuality?Math.floor(count*.58):count;geometry.setDrawRange(0,visible);
  const attribute=geometry.getAttribute('position') as THREE.BufferAttribute;
  for(let i=0;i<visible;i++){const p=snowHallParticle(base[i],speed[i],phase[i],elapsed);attribute.setXYZ(i,p.x,p.y,p.z);}
  attribute.needsUpdate=true;
 },dispose(){geometry.dispose();material.dispose();points.removeFromParent();}};
}
