import * as THREE from 'three';
import {createChairs} from './Chairs.ts';
import {CHAIRS,DECK,DOOR,LAMP,POCKET,POST_Z,RAIL,ROOF,STAIR} from './Layout.ts';

/**
 * S1 graybox: stern corner of a ferry's open upper deck. Flat materials only; no textures.
 * Returns the group, the fluorescent tube material (set emissiveIntensity from outside) and its position.
 */
export function createGraybox(){
 const group=new THREE.Group();group.name='crossing-graybox';
 const paint=new THREE.MeshStandardMaterial({color:'#e4e8e4',roughness:.72,metalness:.05});
 const roofMat=new THREE.MeshStandardMaterial({color:'#dfe3df',roughness:.8,side:THREE.DoubleSide});
 const deckMat=new THREE.MeshStandardMaterial({color:'#2b5c45',roughness:.5});
 const doorMat=new THREE.MeshStandardMaterial({color:'#3d7fd2',roughness:.5});
 const canvas=new THREE.MeshStandardMaterial({color:'#e6dcc0',roughness:.9});
 const strap=new THREE.MeshStandardMaterial({color:'#121212',roughness:.7});
 const signMat=new THREE.MeshStandardMaterial({color:'#f2f2ee',roughness:.6});
 const pipeMat=new THREE.MeshStandardMaterial({color:'#e8ebe8',roughness:.5,metalness:.1});
 const lampBody=new THREE.MeshStandardMaterial({color:'#d8dbd6',roughness:.6});
 const tubeMat=new THREE.MeshStandardMaterial({color:'#f4f1e6',emissive:new THREE.Color('#fff1d6'),emissiveIntensity:0,roughness:.4});
 const chairs=createChairs(),alu=chairs.alu;

 const add=(name:string,g:THREE.BufferGeometry,m:THREE.Material,pos:[number,number,number],cast=true)=>{const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.position.set(...pos);mesh.castShadow=cast;mesh.receiveShadow=true;group.add(mesh);return mesh;};
 /** Box from min/max corners. */
 const slab=(name:string,m:THREE.Material,x0:number,x1:number,y0:number,y1:number,z0:number,z1:number,cast=true)=>add(name,new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),m,[(x0+x1)/2,(y0+y1)/2,(z0+z1)/2],cast);
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
 // Lower deck under the opening: enclosed shaft, six steps descending toward the bow, floor at -2.7.
 {const lo=-2.7;
  slab('shaft-floor',deckMat,STAIR.xMin,STAIR.xMax,lo-.1,lo,STAIR.zMin,STAIR.zMax,false);
  slab('shaft-east',paint,STAIR.xMax,STAIR.xMax+.1,lo,0,STAIR.zMin,STAIR.zMax);
  slab('shaft-aft',paint,STAIR.xMin,STAIR.xMax,lo,0,STAIR.zMin-.1,STAIR.zMin);
  slab('shaft-fwd',paint,STAIR.xMin,STAIR.xMax,lo,0,STAIR.zMax,STAIR.zMax+.1);
  for(let i=0;i<6;i++)slab(`stair-step-${i}`,deckMat,STAIR.xMin,STAIR.xMax-.1,lo,-.4-i*.4,STAIR.zMin+i*.3,STAIR.zMin+(i+1)*.3,false);}

 // Cabin: bulkhead with the blue door, its front wall at the pocket mouth, the west wall.
 slab('bulkhead',paint,-.15,0,0,Y,zMin,pocketFrontZ);
 slab('cabin-front',paint,xMin,0,0,Y,pocketFrontZ-.15,pocketFrontZ);
 slab('west-wall',paint,xMin-.15,xMin,0,Y,pocketFrontZ-.15,zMax);
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
 for(const z of[-2.4,-.8,.8,2.4,4.0])add(`sign-${z}`,new THREE.BoxGeometry(.02,.08,.12),signMat,[1.5-.08,Y-.1,z+.4]);

 // Canvas blinds rolled up at the roof edge, black ties.
 const roll=(name:string,len:number,pos:[number,number,number],alongZ:boolean)=>{
  const m=add(name,new THREE.CylinderGeometry(.065,.065,len,16),canvas,pos);if(alongZ)m.rotation.x=Math.PI/2;else m.rotation.z=Math.PI/2;return m;
 };
 roll('blind-open',zMax-zMin,[xMax-.1,Y-.09,(zMin+zMax)/2],true);
 roll('blind-stern',xMax,[xMax/2,Y-.09,zMin+.1],false);
 for(const z of[-2.2,-.3,1.6,3.5]){const s=add(`tie-open-${z}`,new THREE.CylinderGeometry(.072,.072,.05,16),strap,[xMax-.1,Y-.09,z]);s.rotation.x=Math.PI/2;}
 for(const x of[.6,1.8]){const s=add(`tie-stern-${x}`,new THREE.CylinderGeometry(.072,.072,.05,16),strap,[x,Y-.09,zMin+.1]);s.rotation.z=Math.PI/2;}

 // Fluorescent fixture under the roof.
 add('lamp-body',new THREE.BoxGeometry(.12,.05,LAMP.len+.1),lampBody,[LAMP.x,LAMP.y+.02,LAMP.z],false);
 add('lamp-tube',new THREE.BoxGeometry(.07,.035,LAMP.len),tubeMat,[LAMP.x,LAMP.y-.02,LAMP.z],false);

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

 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 group.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);materials.add(o.material as THREE.Material);}});
 return {group,tubeMat,alu,chairTriangles:chairs.triangles,lampPosition:new THREE.Vector3(LAMP.x,LAMP.y-.12,LAMP.z),
  /** Sets the tube's glow (HDR values feed bloom). */
  setLamp(emissiveIntensity:number){tubeMat.emissiveIntensity=emissiveIntensity;},
  dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.removeFromParent();}};
}
