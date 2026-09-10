import * as THREE from 'three';
import {seededRandom} from '../../shared/math/seededRandom.ts';

export function createOakMaterial(){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
 const context=canvas.getContext('2d')!;context.fillStyle='#d0c2ac';context.fillRect(0,0,512,512);
 const random=seededRandom(8451);
 for(let board=0;board<4;board++){
  const left=board*128;context.fillStyle=board%2?'rgba(255,244,218,.045)':'rgba(75,48,28,.025)';context.fillRect(left,0,128,512);
  context.fillStyle='rgba(67,46,30,.24)';context.fillRect(left,0,1.2,512);
  for(let line=0;line<34;line++){
   context.beginPath();context.strokeStyle=`rgba(${55+Math.floor(random()*35)},${40+Math.floor(random()*24)},${27+Math.floor(random()*18)},${.035+random()*.075})`;context.lineWidth=.4+random()*1.2;
   const x=left+4+random()*120;context.moveTo(x,0);
   for(let y=0;y<=512;y+=16)context.lineTo(x+Math.sin(y*.018+random()*2)*(.8+random()*2.6),y);
   context.stroke();
  }
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(3,7);
 const bump=texture.clone();bump.colorSpace=THREE.NoColorSpace;bump.needsUpdate=true;
 const material=new THREE.MeshStandardMaterial({map:texture,bumpMap:bump,bumpScale:.014,color:'#fff0d9',roughness:.76,metalness:0});
 material.name='warm-clean-nordic-oak';
 return {material,dispose(){texture.dispose();bump.dispose();material.dispose();}};
}

export function createPlasterMaterial(){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
 const context=canvas.getContext('2d')!;context.fillStyle='#d2d0ca';context.fillRect(0,0,256,256);
 const random=seededRandom(442);
 for(let i=0;i<5200;i++){
  const value=95+Math.floor(random()*95),alpha=.018+random()*.035;
  context.fillStyle=`rgba(${value},${value},${value-4},${alpha})`;
  const radius=.25+random()*1.1;context.fillRect(random()*256,random()*256,radius,radius);
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(4,4);
 const bump=texture.clone();bump.colorSpace=THREE.NoColorSpace;bump.needsUpdate=true;
 const material=new THREE.MeshStandardMaterial({map:texture,bumpMap:bump,bumpScale:.022,color:'#c2c1bc',roughness:.96,metalness:0});material.name='snowwindow-fine-mineral-plaster';
 return {material,dispose(){texture.dispose();bump.dispose();material.dispose();}};
}
