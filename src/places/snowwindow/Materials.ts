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
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(12,1);
 const bump=texture.clone();bump.colorSpace=THREE.NoColorSpace;bump.needsUpdate=true;
 const material=new THREE.MeshStandardMaterial({map:texture,bumpMap:bump,bumpScale:.002,color:'#ffffff',roughness:.88,metalness:0});
 material.name='light-matte-oak';
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
 const material=new THREE.MeshStandardMaterial({map:texture,bumpMap:bump,bumpScale:.0015,color:'#c2c1bc',roughness:.96,metalness:0});material.name='snowwindow-fine-mineral-plaster';
 return {material,dispose(){texture.dispose();bump.dispose();material.dispose();}};
}

/** Seeded surface relief in metres; condensation is an optical approximation,
 * not a temperature/humidity simulation. The view behind it remains live 3D. */
export function createWinterGlassMaterial(){
 const width=2048,height=1024,spanX=11.94,spanY=3.74;
 const relief=new Float32Array(width*height),random=seededRandom(20260910);
 for(let drop=0;drop<5200;drop++){
  const u=Math.pow(random(),1.85),v=random();
  if(random()>.22+.65*Math.exp(-u*9)+.30*Math.exp(-v*14))continue;
  const radius=.003+Math.pow(random(),2)*.018;
  const rx=Math.max(1.2,radius/spanX*width),ry=Math.max(1.4,radius*(1.1+random()*.6)/spanY*height);
  const cx=u*width,cy=v*height;
  for(let y=Math.max(0,Math.floor(cy-ry));y<Math.min(height,cy+ry);y++){
   for(let x=Math.max(0,Math.floor(cx-rx));x<Math.min(width,cx+rx);x++){
    const r2=((x-cx)/rx)**2+((y-cy)/ry)**2;
    if(r2<1)relief[y*width+x]=Math.max(relief[y*width+x],radius*.55*Math.pow(1-r2,.6));
   }
  }
 }
 const normal=new Uint8Array(width*height*4),surface=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x,k=i*4;
  const nx=-(relief[y*width+Math.min(width-1,x+1)]-relief[y*width+Math.max(0,x-1)])/(2*spanX/width);
  const ny=-(relief[Math.min(height-1,y+1)*width+x]-relief[Math.max(0,y-1)*width+x])/(2*spanY/height);
  const length=Math.hypot(nx,ny,1);
  normal[k]=Math.round((nx/length*.5+.5)*255);normal[k+1]=Math.round((ny/length*.5+.5)*255);normal[k+2]=Math.round((1/length*.5+.5)*255);normal[k+3]=255;
  const edge=Math.max(Math.exp(-y/height*85),Math.exp(-x/width*180)*.5);
  const grain=random();
  const frost=THREE.MathUtils.clamp(edge*(.18+.82*grain)+Math.max(0,edge-.35)*.5,0,1);
  surface[k]=255;surface[k+1]=Math.round(255*(.035+.83*frost));surface[k+2]=255;surface[k+3]=255;
 }
 const normalMap=new THREE.DataTexture(normal,width,height),roughnessMap=new THREE.DataTexture(surface,width,height);
 for(const texture of [normalMap,roughnessMap]){texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;}
 const faces=typeof document==='undefined'?[]:Array.from({length:6},(_,face)=>{
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d')!;
  const gradient=ctx.createLinearGradient(0,0,0,128);
  gradient.addColorStop(0,face===3?'#76818a':'#d9e2e7');gradient.addColorStop(.5,'#b7c4cd');gradient.addColorStop(1,'#657581');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);return canvas;
 });
 const envMap=faces.length?new THREE.CubeTexture(faces):null;if(envMap){envMap.colorSpace=THREE.SRGBColorSpace;envMap.needsUpdate=true;}
 const material=new THREE.MeshPhysicalMaterial({color:'#f5f8fa',metalness:0,roughness:1,roughnessMap,normalMap,normalScale:new THREE.Vector2(1.6,1.6),envMap,envMapIntensity:.65,specularIntensity:.2,transmission:1,ior:1.33,thickness:.028,depthWrite:false,side:THREE.FrontSide});
 material.name='winter-glass-condensation-and-edge-frost';
 return material;
}
