import * as THREE from 'three';
import {createChairs} from './Chairs.ts';
import {createMaterials,disposeMaterialTextures} from './Materials.ts';
import {createFittings,worldUV} from './Fittings.ts';
import {DECK,DOOR,LAMP,POCKET,POST_Z,RAIL,ROOF,STAIR} from './Layout.ts';

/**
 * Stern corner of a ferry's open upper deck: structure here, small fittings in Fittings.ts, textures in Textures.ts.
 * Returns the group, the fluorescent tube material (set emissiveIntensity from outside) and its position.
 */
export function createGraybox(){
 const group=new THREE.Group();group.name='crossing-graybox';
 const m=createMaterials();
 const {paint,roof:roofMat,deck:deckMat,doorMat,pipe:pipeMat,lampBody}=m;
 const tubeMat=new THREE.MeshStandardMaterial({color:'#f4f1e6',emissive:new THREE.Color('#fff1d6'),emissiveIntensity:0,roughness:.4});
 const chairs=createChairs(),alu=chairs.alu;

 const add=(name:string,g:THREE.BufferGeometry,m:THREE.Material,pos:[number,number,number],cast=true)=>{const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.position.set(...pos);mesh.castShadow=cast;mesh.receiveShadow=true;group.add(mesh);return mesh;};
 /** Box from min/max corners. */
 const slab=(name:string,mat:THREE.Material,x0:number,x1:number,y0:number,y1:number,z0:number,z1:number,cast=true)=>{
  const g=new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),c:[number,number,number]=[(x0+x1)/2,(y0+y1)/2,(z0+z1)/2];
  if(mat!==doorMat&&mat!==pipeMat)worldUV(g,...c);return add(name,g,mat,c,cast);
 };
 const pipe=(name:string,a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material=pipeMat)=>{
  const mesh=add(name,new THREE.CylinderGeometry(r,r,a.distanceTo(b),10),m,[0,0,0]);
  mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return mesh;
 };
 const {xMin,xMax,zMin,zMax}=DECK,{pocketFrontZ}=POCKET,H=RAIL.h,Y=ROOF.underY,t=RAIL.t;

 // Deck: four slabs leaving the stair opening.
 const fl=-.1;
 slab('deck-east',deckMat,0,xMax,fl,0,zMin,zMax,false);
 slab('deck-west-aft',deckMat,xMin,0,fl,0,pocketFrontZ,STAIR.zMin,false);
 slab('deck-stair-lip',deckMat,STAIR.xMax,0,fl,0,STAIR.zMin,STAIR.zMax,false);
 slab('deck-west-fwd',deckMat,xMin,0,fl,0,STAIR.zMax,zMax,false);
 // Lower deck under the opening: a fully enclosed box (floor + four walls). Walls sit inside the opening and run into the deck
 // slabs and the west wall (no gap to the sea, no coplanar faces); steps are nested boxes that end inside the walls.
 {const lo=-2.7,x0=STAIR.xMin,x1=STAIR.xMax,z0=STAIR.zMin,z1=STAIR.zMax,top=-.03;
  slab('shaft-floor',deckMat,x0-.15,x1+.15,lo-.15,lo,z0-.15,z1+.15,false);
  slab('shaft-east',paint,x1-.15,x1+.05,lo-.05,top,z0-.15,z1+.15);
  slab('shaft-aft',paint,x0-.15,x1+.05,lo-.05,top,z0-.05,z0+.1);
  slab('shaft-fwd',paint,x0-.15,x1+.05,lo-.05,top,z1-.1,z1+.15);
  for(let i=0;i<6;i++)slab(`stair-step-${i}`,deckMat,x0-.1,x1-.1,lo-.03,-.4-i*.4,z0+.05,z0+.1+(i+1)*.3,false);}
 // Cabin: bulkhead with the blue door, its front wall at the pocket mouth, the west wall.
 slab('bulkhead',paint,-.15,0,0,Y,zMin,pocketFrontZ);
 slab('cabin-front',paint,xMin,0,0,Y,pocketFrontZ-.15,pocketFrontZ);
 slab('west-wall',paint,xMin-.15,xMin,-2.9,Y,pocketFrontZ-.15,zMax);
 slab('door',doorMat,0,.04,0,DOOR.h,DOOR.z-DOOR.w/2,DOOR.z+DOOR.w/2).position.x=.02;
 add('door-handle',new THREE.BoxGeometry(.04,.03,.12),alu,[.06,1.0,DOOR.z+.3]);

 // Gunwales: open side and stern (1 m), thin white posts up to the roof.
 slab('gunwale-open',paint,xMax-t,xMax,0,H,zMin,zMax);
 slab('gunwale-stern',paint,0,xMax,0,H,zMin-t,zMin);
 for(const z of POST_Z)slab(`post-${z}`,pipeMat,xMax-.07,xMax-.015,H,Y,z-.0275,z+.0275);
 slab('post-stern-corner',pipeMat,.0,.07,H,Y,zMin-.07,zMin);

 // Roof: slab, cross beams, one long beam along the open side carrying blank number plates.
 slab('roof',roofMat,xMin,xMax+ROOF.margin,Y,Y+ROOF.t,zMin-ROOF.margin,zMax+ROOF.margin);
 for(const z of[-2.4,-.8,.8,2.4,4.0])slab(`beam-${z}`,paint,xMin,xMax,Y-ROOF.beamH,Y,z-.04,z+.04);
 slab('beam-long',paint,1.5-.05,1.5+.05,Y-ROOF.beamH,Y,zMin,zMax);

 // Fluorescent fixture hung below the beams on two rods: trough, end caps, diffuser, tube.
 {const lx=LAMP.x,lz=LAMP.z,hl=LAMP.len/2+.05;
  slab('lamp-trough-top',lampBody,lx-.075,lx+.075,2.05,2.07,lz-hl,lz+hl,false);
  for(const e of[-1,1])slab(`lamp-trough-side-${e}`,lampBody,lx+e*.068-.007,lx+e*.068+.007,2.0,2.07,lz-hl,lz+hl,false);
  for(const e of[-1,1])slab(`lamp-cap-${e}`,lampBody,lx-.08,lx+.08,1.995,2.075,lz+e*hl-(e>0?0:.012),lz+e*hl+(e>0?.012:0),false);
  slab('lamp-lens',m.lens,lx-.058,lx+.058,1.992,1.998,lz-hl+.01,lz+hl-.01,false);
  add('lamp-tube',new THREE.BoxGeometry(.04,.022,LAMP.len),tubeMat,[lx,2.013,lz],false);
  for(const z of[-.8,-1.6])slab(`lamp-rod-${z}`,lampBody,lx-.012,lx+.012,2.07,z===-.8?2.09:Y,z-.012,z+.012,false);}

 // Damp patches along the wall feet (low roughness, dark, soft edge).
 {const wet=(name:string,len:number,wd:number,x:number,z:number,rotY:number)=>{
   const g=new THREE.PlaneGeometry(len,wd);g.rotateX(-Math.PI/2);const mesh=add(name,g,m.wetMat,[x,.004,z],false);mesh.rotation.y=rotY;mesh.renderOrder=2;};
  wet('wet-stern',2.0,.22,1.2,zMin+.11,Math.PI);wet('wet-open',7.0,.18,xMax-t-.09,.9,Math.PI/2);wet('wet-pool',.8,.35,.9,-1.9,Math.PI*.8);}

 // Stair opening: pipe handrail on the three sides that face the deck, posts every 1.0 m.
 const hr=(name:string,a:[number,number],b:[number,number])=>{
  pipe(`${name}-top`,new THREE.Vector3(a[0],1.0,a[1]),new THREE.Vector3(b[0],1.0,b[1]),.025);
  pipe(`${name}-mid`,new THREE.Vector3(a[0],.55,a[1]),new THREE.Vector3(b[0],.55,b[1]),.02);
  const n=Math.max(1,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/1.0));
  for(let i=0;i<=n;i++){const x=a[0]+(b[0]-a[0])*i/n,z=a[1]+(b[1]-a[1])*i/n;pipe(`${name}-post-${i}`,new THREE.Vector3(x,0,z),new THREE.Vector3(x,1.0,z),.025);}
 };
 hr('stair-east',[STAIR.xMax,STAIR.zMin],[STAIR.xMax,STAIR.zMax]);
 hr('stair-aft',[STAIR.xMin,STAIR.zMin],[STAIR.xMax,STAIR.zMin]);
 hr('stair-fwd',[STAIR.xMin,STAIR.zMax],[STAIR.xMax,STAIR.zMax]);

 group.add(chairs.group);
 group.add(createFittings(m));

 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 group.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);materials.add(o.material as THREE.Material);}});
 Object.values(m).forEach(x=>materials.add(x));
 return {group,tubeMat,alu,chairTriangles:chairs.triangles,lampPosition:new THREE.Vector3(LAMP.x,LAMP.y-.12,LAMP.z),
  /** Sets the tube's glow (HDR values feed bloom). */
  setLamp(emissiveIntensity:number){tubeMat.emissiveIntensity=emissiveIntensity;},
  dispose(){geometries.forEach(g=>g.dispose());materials.forEach(x=>{disposeMaterialTextures(x);x.dispose();});group.removeFromParent();}};
}
