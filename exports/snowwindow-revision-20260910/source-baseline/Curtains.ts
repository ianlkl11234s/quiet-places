import * as THREE from 'three';

const pulse=(t:number,center:number,width:number)=>Math.exp(-Math.pow((t-center)/width,2));

/** Mostly-still indoor air with two unsynchronised coastal gusts per cycle. */
export function curtainWind(elapsed:number){
 const t=((elapsed%97)+97)%97;
 return .045+.014*Math.sin(elapsed*.23)+.010*Math.sin(elapsed*.61)+.42*pulse(t,31,4.8)+.26*pulse(t,74,6.4);
}

export function createCurtains(daylight={value:1}){
 const group=new THREE.Group();group.name='snowwindow-linen-curtains';
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
 const context=canvas.getContext('2d')!;context.fillStyle='#ddd9cf';context.fillRect(0,0,128,128);
 context.strokeStyle='rgba(75,72,67,.10)';context.lineWidth=.55;
 for(let i=0;i<128;i+=4){context.beginPath();context.moveTo(i,0);context.lineTo(i,128);context.stroke();context.beginPath();context.moveTo(0,i+1);context.lineTo(128,i+1);context.stroke();}
 const weave=new THREE.CanvasTexture(canvas);weave.colorSpace=THREE.SRGBColorSpace;weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.repeat.set(4,12);
 const material=new THREE.MeshStandardMaterial({map:weave,color:'#f2eee5',roughness:.96,metalness:0,side:THREE.DoubleSide,transparent:true,opacity:.94});
 material.onBeforeCompile=shader=>{
  shader.uniforms.uCurtainDay=daylight;
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>','#include <common>\nuniform float uCurtainDay;')
   .replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.indirectDiffuse*=.30+.70*uCurtainDay;');
 };
 material.customProgramCacheKey=()=> 'snowwindow-linen-v1';
 const panels:{geometry:THREE.PlaneGeometry;rest:Float32Array;side:number;phase:number}[]=[];
 for(const side of [-1]){
  const geometry=new THREE.PlaneGeometry(1.0,4.0,10,28);
  const position=geometry.getAttribute('position') as THREE.BufferAttribute;
  const rest=new Float32Array(position.array as ArrayLike<number>);
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name=side<0?'left-linen-curtain':'right-linen-curtain';
  mesh.position.set(-2.10,2.58,-4.06);group.add(mesh);
  panels.push({geometry,rest,side,phase:side<0 ? .8 : 2.15});
 }
 return {group,update(elapsed:number){
  const wind=curtainWind(elapsed);
  for(const {geometry,rest,side,phase} of panels){
   const position=geometry.getAttribute('position') as THREE.BufferAttribute;
   for(let i=0;i<position.count;i++){
    const x=rest[i*3],y=rest[i*3+1];
    const free=THREE.MathUtils.clamp((2-y)/4,0,1);
    const folds=Math.sin((x+.81)*15+phase)*.045;
    const travelling=Math.sin(elapsed*(.46+.04*side)+y*1.7+phase)+.45*Math.sin(elapsed*.91-y*.72-phase);
    const inward=-side*wind*free*free*(.13+.035*travelling);
    const billow=folds+wind*free*free*(.22+.055*travelling);
    position.setXYZ(i,x+inward,y-Math.abs(billow)*free*.035,billow);
   }
   position.needsUpdate=true;geometry.computeVertexNormals();
  }
 },dispose(){group.removeFromParent();geometryDispose(group);weave.dispose();material.dispose();}};
}

function geometryDispose(root:THREE.Object3D){root.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});}
