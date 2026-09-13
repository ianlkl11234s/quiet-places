import * as THREE from 'three';
import {seededRandom} from '../../shared/math/seededRandom.ts';

function mineralTexture(seed:number,base:string,grain:number,streaks=false){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
 const context=canvas.getContext('2d')!;context.fillStyle=base;context.fillRect(0,0,512,512);
 const random=seededRandom(seed);
 for(let i=0;i<8200;i++){
  const value=70+Math.floor(random()*105),alpha=.012+random()*.035;
  context.fillStyle=`rgba(${value},${value},${value+2},${alpha})`;
  const width=.35+random()*(streaks?5.2:1.5),height=.25+random()*(streaks?.7:1.5);
  context.fillRect(random()*512,random()*512,width,height);
 }
 if(streaks)for(let i=0;i<28;i++){
  const y=random()*512;context.strokeStyle=`rgba(220,225,226,${.008+random()*.018})`;context.lineWidth=.4+random()*1.4;
  context.beginPath();context.moveTo(0,y);context.bezierCurveTo(140,y+random()*4,360,y-random()*5,512,y+random()*3);context.stroke();
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(streaks?3:5,streaks?11:8);
 const bump=texture.clone();bump.colorSpace=THREE.NoColorSpace;bump.needsUpdate=true;
 return {texture,bump};
}

export function createHallMaterials(){
 const plasterMap=mineralTexture(92061,'#aaa9a5',1),floorMap=mineralTexture(92062,'#676b6c',1,true);
 const plaster=new THREE.MeshStandardMaterial({map:plasterMap.texture,bumpMap:plasterMap.bump,bumpScale:.0018,color:'#b9b9b5',roughness:.95,metalness:0});
 plaster.name='snowhall-fine-winter-plaster';
 const floor=new THREE.MeshPhysicalMaterial({map:floorMap.texture,bumpMap:floorMap.bump,bumpScale:.0012,color:'#737777',roughness:.69,metalness:0,clearcoat:.035,clearcoatRoughness:.78});
 floor.name='snowhall-worn-matte-mineral-floor';
 const frame=new THREE.MeshStandardMaterial({color:'#3a3d3e',roughness:.78,metalness:.18});frame.name='snowhall-dark-painted-frame';
 const snow=new THREE.MeshStandardMaterial({color:'#edf1f2',roughness:.96,metalness:0});snow.name='snowhall-window-sill-snow';
 const glass=new THREE.MeshPhysicalMaterial({color:'#d8e1e6',roughness:.55,metalness:0,transmission:.32,opacity:.18,transparent:true,depthWrite:false,ior:1.45,thickness:.008});
 glass.name='snowhall-cold-window-glass';
 return {plaster,floor,frame,snow,glass,dispose(){
  plasterMap.texture.dispose();plasterMap.bump.dispose();floorMap.texture.dispose();floorMap.bump.dispose();
  plaster.dispose();floor.dispose();frame.dispose();snow.dispose();glass.dispose();
 }};
}
