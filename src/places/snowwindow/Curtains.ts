import * as THREE from 'three';

const pulse=(t:number,center:number,width:number)=>Math.exp(-Math.pow((t-center)/width,2));

/** Slow room-air movement, independent of the snow outside the closed glazing. */
export function curtainWind(elapsed:number){
 const t=((elapsed%97)+97)%97;
 return .045+.014*Math.sin(elapsed*.23)+.010*Math.sin(elapsed*.61)+.42*pulse(t,31,4.8)+.26*pulse(t,74,6.4);
}

/** Full-height cloth gathered along the wall, with a fixed hanging top.
 * The folds represent stored fabric; this is not a cloth solver. */
export function gatheredCurtainPoint(u:number,v:number,elapsed:number){
 const free=1-v,wind=curtainWind(elapsed);
 const phase=u*Math.PI*20+.45*Math.sin(u*13)+.58*free*free*Math.sin(u*31)+.22*free*Math.sin(v*5+u*14);
 const flutter=wind*free*free*(.012*Math.sin(elapsed*.39+u*7+v*3));
 const taper=.82+.18*free;
 return {
  x:-2.90+1.65*u+.012*Math.sin(phase)*free+.10*free*(u-.5),
  y:.08+4.64*v-.012*(1-Math.cos(phase))*free,
  z:-4.025+Math.cos(phase)*(.076+.016*Math.sin(u*17))*taper+.012*Math.sin(phase*2.07)+flutter-.07*Math.pow(1-u,5),
 };
}

export function createCurtains(){
 const group=new THREE.Group();group.name='snowwindow-linen-curtains';
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
 const context=canvas.getContext('2d')!;context.fillStyle='#d6d8d7';context.fillRect(0,0,128,128);
 context.strokeStyle='rgba(70,75,78,.10)';context.lineWidth=.55;
 for(let i=0;i<128;i+=4){context.beginPath();context.moveTo(i,0);context.lineTo(i,128);context.stroke();context.beginPath();context.moveTo(0,i+1);context.lineTo(128,i+1);context.stroke();}
 const weave=new THREE.CanvasTexture(canvas);weave.colorSpace=THREE.SRGBColorSpace;weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.repeat.set(18,16);
 const material=new THREE.MeshStandardMaterial({map:weave,color:'#dce0e1',roughness:.96,metalness:0,side:THREE.DoubleSide});
 const geometry=new THREE.PlaneGeometry(1,1,192,40),uv=geometry.getAttribute('uv');
 const mesh=new THREE.Mesh(geometry,material);mesh.name='full-curtain-gathered-along-left-wall';mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;group.add(mesh);
 // A slim track continues past the window onto the wall; normally above crop.
 const track=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,2.0,8),new THREE.MeshStandardMaterial({color:'#727b7e',roughness:.9}));
 track.rotation.z=Math.PI/2;track.position.set(-2.08,4.75,-4.025);track.name='curtain-track-wall-return';group.add(track);
 return {group,update(elapsed:number){
  const position=geometry.getAttribute('position') as THREE.BufferAttribute;
  for(let i=0;i<position.count;i++){
   const p=gatheredCurtainPoint(uv.getX(i),uv.getY(i),elapsed);position.setXYZ(i,p.x,p.y,p.z);
  }
  position.needsUpdate=true;geometry.computeVertexNormals();
 },dispose(){group.removeFromParent();geometry.dispose();weave.dispose();material.dispose();track.geometry.dispose();track.material.dispose();}};
}
