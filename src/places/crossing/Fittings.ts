import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {CrossingMaterials} from './Materials.ts';
import {TILE} from './Textures.ts';
import {DECK,DOOR,POCKET,RAIL,ROOF,STAIR} from './Layout.ts';

/** World-metric UVs (one texture tile = TILE metres) projected along the dominant normal axis; for geometry positioned at c. */
export function worldUV(g:THREE.BufferGeometry,cx:number,cy:number,cz:number){
 const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv as THREE.BufferAttribute;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i)+cx,y=p.getY(i)+cy,z=p.getZ(i)+cz,ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));
  let u:number,v:number;
  if(ax>=ay&&ax>=az){u=z;v=y;}else if(ay>=az){u=x;v=z;}else{u=x;v=y;}
  uv.setXY(i,u/TILE,v/TILE);
 }
}
const v3=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
const Z_UP=v3(0,1,0);

/** Collects small parts per material and merges each material into one mesh (few draw calls). */
class Bucket{
 private map=new Map<THREE.Material,THREE.BufferGeometry[]>();
 add(m:THREE.Material,g:THREE.BufferGeometry){const a=this.map.get(m)??[];a.push(g.index?g.toNonIndexed():g);this.map.set(m,a);}
 box(m:THREE.Material,x0:number,x1:number,y0:number,y1:number,z0:number,z1:number,world=false){
  const g=new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),c=[(x0+x1)/2,(y0+y1)/2,(z0+z1)/2] as const;
  if(world)worldUV(g,...c);g.translate(...c);this.add(m,g);
 }
 cyl(m:THREE.Material,a:THREE.Vector3,b:THREE.Vector3,r:number,seg=8){
  const g=new THREE.CylinderGeometry(r,r,a.distanceTo(b),seg);
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(Z_UP,b.clone().sub(a).normalize()),v3(1,1,1)));this.add(m,g);
 }
 sphere(m:THREE.Material,p:THREE.Vector3,r:number,sx=1,sy=1,sz=1,seg=8){const g=new THREE.SphereGeometry(r,seg,Math.max(4,seg>>1));g.scale(sx,sy,sz);g.translate(p.x,p.y,p.z);this.add(m,g);}
 build(group:THREE.Group,name:string,cast=true){
  for(const [m,list] of this.map){const g=mergeGeometries(list)!;list.forEach(x=>x.dispose());const mesh=new THREE.Mesh(g,m);mesh.name=`${name}-${m.type}${(m as THREE.MeshStandardMaterial).color?.getHexString()??''}`;mesh.castShadow=cast;mesh.receiveShadow=true;group.add(mesh);}
 }
}

const scaleUV=(g:THREE.BufferGeometry,su:number,sv:number)=>{const uv=g.attributes.uv as THREE.BufferAttribute;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*su,uv.getY(i)*sv);};

/** Rolled-up awning: cylinder whose radius wobbles in creases along its length. Axis along local Y. */
function rollGeometry(len:number,r:number){
 const g=new THREE.CylinderGeometry(r,r,len,14,Math.round(len/.03),false),p=g.attributes.position;
 for(let i=0;i<p.count;i++){
  const y=p.getY(i),f=1+.13*Math.sin(y*41+1.3)*Math.sin(y*7.1+.4)+.05*Math.sin(y*113)+.03*Math.sin(y*9);
  p.setX(i,p.getX(i)*f);p.setZ(i,p.getZ(i)*f);
 }
 g.computeVertexNormals();scaleUV(g,2*Math.PI*r/.25,len/.25);return g;
}
/** Partly lowered awning valance with soft pleats: plane in XY (width along x), pleats displace along z. */
function flapGeometry(width:number,height:number){
 const g=new THREE.PlaneGeometry(width,height,Math.round(width/.025),4),p=g.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),low=(height/2-y)/height;
  p.setZ(i,(.011*Math.sin(x*2*Math.PI/.19+.7)+.004*Math.sin(x*2*Math.PI/.071))*(.35+.65*low));
  p.setY(i,y-.012*low*(.5+.5*Math.sin(x*2*Math.PI/.19+.7)));
 }
 g.computeVertexNormals();scaleUV(g,width/.25,height/.25);return g;
}

export function createFittings(m:CrossingMaterials){
 const group=new THREE.Group();group.name='crossing-fittings';
 const {xMin,xMax,zMin,zMax}=DECK,{pocketFrontZ}=POCKET,H=RAIL.h,t=RAIL.t,Y=ROOF.underY;
 const b=new Bucket();

 // Gunwale cap plates (white steel, a little wider than the wall) and vertical stiffener ribs on the inside.
 b.box(m.paint,xMax-t-.02,xMax+.02,H-.005,H+.025,zMin-t-.02,zMax+.02,true);
 b.box(m.paint,0,xMax-t-.02,H-.005,H+.025,zMin-t-.02,zMin+.02,true);
 for(const z of[-.2,.5,1.2,1.9,2.6,3.3,4.0,4.7])b.box(m.paint,xMax-t-.04,xMax-t+.02,-.02,H,z-.025,z+.025,true);
 for(const x of[.55,1.15,1.75])b.box(m.paint,x-.025,x+.025,-.02,H,zMin,zMin+.04,true);
 // Post base plates and roof flanges with bolts.
 const POSTS=[-3.0,-1.4,.2,1.8,3.4,5.0];
 for(const z of POSTS){
  b.box(m.paint,xMax-.092,xMax+.007,H+.025,H+.04,z-.06,z+.06,true);b.box(m.paint,xMax-.092,xMax+.007,Y-.014,Y,z-.06,z+.06,true);
  for(const dz of[-.04,.04])for(const y of[H+.04,Y-.014])b.sphere(m.buckle,v3(xMax-.04,y+(y>H+.1?-.002:.002),z+dz),.009,1,.6,1,6);
 }
 // Roof: flat-bar flanges under the cross beams and the long beam.
 for(const z of[-2.4,-.8,.8,2.4,4.0])b.box(m.paint,xMin,xMax,Y-ROOF.beamH-.012,Y-ROOF.beamH,z-.07,z+.07,true);
 b.box(m.paint,1.5-.08,1.5+.08,Y-ROOF.beamH-.012,Y-ROOF.beamH,zMin,zMax,true);
 // Blank number plates with a red dot (no text) on the long beam.
 for(const z of[-2.4,-.8,.8,2.4,4.0]){
  b.box(m.signMat,1.44,1.452,Y-.14,Y-.06,z+.34,z+.46);
  const d=new THREE.CircleGeometry(.022,12);d.rotateY(-Math.PI/2);d.translate(1.4385,Y-.1,z+.375);b.add(m.redMat,d);
 }
 // Conduits: ceiling run to the lamp, bulkhead run above the door, stern-wall run; clamps every ~55 cm.
 const conduit=(a:THREE.Vector3,c:THREE.Vector3,clampAxis:'x'|'z')=>{
  b.cyl(m.pipe,a,c,.017,8);
  const n=Math.floor(a.distanceTo(c)/.55);
  for(let i=0;i<=n;i++){const q=a.clone().lerp(c,i/Math.max(1,n));
   if(clampAxis==='x')b.box(m.pipe,q.x-.012,q.x+.012,q.y-.03,q.y+.03,q.z-.03,q.z+.03);else b.box(m.pipe,q.x-.03,q.x+.03,q.y-.03,q.y+.03,q.z-.012,q.z+.012);}
 };
 conduit(v3(0,Y-.02,-1.6),v3(1.2,Y-.02,-1.6),'x');
 conduit(v3(.03,2.13,zMin),v3(.03,2.13,pocketFrontZ),'z');
 conduit(v3(.1,.72,zMin+.045),v3(1.5,.72,zMin+.045),'x');
 b.box(m.darkMetal,.0,.07,2.07,2.19,pocketFrontZ-.16,pocketFrontZ-.04); // junction box on the bulkhead
 // Life ring (orange with white bands, no lettering) on the bulkhead beside the door, on two hooks.
 {const ring=new THREE.TorusGeometry(.19,.05,10,28);ring.rotateY(Math.PI/2);ring.translate(.06,1.35,-2.6);b.add(m.orange,ring);
  for(let k=0;k<4;k++){const band=new THREE.TorusGeometry(.19,.0535,10,5,Math.PI/5);band.rotateZ(k*Math.PI/2+Math.PI*.4);band.rotateY(Math.PI/2);band.translate(.06,1.35,-2.6);b.add(m.signMat,band);}
  for(const dz of[-.12,.12])b.box(m.darkMetal,0,.05,1.62,1.65,-2.6+dz-.012,-2.6+dz+.012);}
 // Fire extinguisher cabinet (blank red box with a window) on the cabin front wall.
 b.box(m.redMat,-1.5,-1.0,.95,1.55,pocketFrontZ,pocketFrontZ+.13);
 b.box(m.signMat,-1.4,-1.1,1.15,1.4,pocketFrontZ+.128,pocketFrontZ+.134);
 b.box(m.darkMetal,-1.27,-1.23,.9,.95,pocketFrontZ,pocketFrontZ+.05);
 // Life-jacket sacks removed 2026-11-19: read as orange blobs on the deck from station c (material kept, unused).

 // Scuppers (drain slots with a frame) at the wall foot.
 for(const [x,z,rot] of[[xMax-t-.07,3.8,0],[.95,zMin+.07,1]] as const){
  const w=rot?.18:.1,d=rot?.1:.18;
  b.box(m.paint,x-w/2-.025,x+w/2+.025,0,.012,z-d/2-.025,z+d/2+.025,true);b.box(m.darkMetal,x-w/2,x+w/2,0,.016,z-d/2,z+d/2);
  for(let k=1;k<4;k++){const f=-.5+k/4;if(rot)b.box(m.paint,x+f*w-.004,x+f*w+.004,0,.02,z-d/2,z+d/2,true);else b.box(m.paint,x-w/2,x+w/2,0,.02,z+f*d-.004,z+f*d+.004,true);}
 }
 // Blue door: frame, sill, three hinges, porthole, louvre, handle plate.
 const dz=DOOR.z,hw=DOOR.w/2;
 b.box(m.frameBlue,0,.07,0,DOOR.h+.05,dz-hw-.05,dz-hw);b.box(m.frameBlue,0,.07,0,DOOR.h+.05,dz+hw,dz+hw+.05);b.box(m.frameBlue,0,.07,DOOR.h,DOOR.h+.05,dz-hw-.05,dz+hw+.05);
 b.box(m.paint,0,.1,0,.075,dz-hw-.05,dz+hw+.05,true);
 for(const y of[.3,1.0,1.7])b.cyl(m.buckle,v3(.055,y-.05,dz-hw+.015),v3(.055,y+.05,dz-hw+.015),.013,8);
 {const ring=new THREE.TorusGeometry(.115,.016,8,20);ring.rotateY(Math.PI/2);ring.translate(.046,1.55,dz);b.add(m.buckle,ring);
  const gl=new THREE.CircleGeometry(.108,20);gl.rotateY(Math.PI/2);gl.translate(.041,1.55,dz);b.add(m.glass,gl);}
 for(let k=0;k<6;k++){const s=new THREE.BoxGeometry(.012,.02,.5);s.rotateZ(-.5);s.translate(.047,.18+k*.045,dz);b.add(m.frameBlue,s);}
 b.box(m.buckle,.04,.05,.97,1.1,dz+.3-.03,dz+.3+.03);
 b.sphere(m.darkMetal,v3(.052,.93,dz+.3),.008,.5,1,1,6);

 // Awnings: rolled up at the roof edge, partly lowered valance, black ties with buckle and a hanging tail.
 const rollMeshes:{g:THREE.BufferGeometry;pos:THREE.Vector3;alongZ:boolean}[]=[
  {g:rollGeometry(zMax-zMin,.065),pos:v3(xMax-.1,Y-.09,(zMin+zMax)/2),alongZ:true},
  {g:rollGeometry(xMax,.065),pos:v3(xMax/2,Y-.09,zMin+.1),alongZ:false},
 ];
 for(const r of rollMeshes){
  if(r.alongZ)r.g.rotateX(Math.PI/2);else r.g.rotateZ(Math.PI/2);
  r.g.translate(r.pos.x,r.pos.y,r.pos.z);b.add(m.canvas,r.g);
 }
 {const f=flapGeometry(zMax-zMin,.17);f.rotateY(Math.PI/2);f.translate(xMax+.0,Y-.205,(zMin+zMax)/2);b.add(m.canvas,f);
  const g2=flapGeometry(xMax,.17);g2.translate(xMax/2,Y-.205,zMin-.03);b.add(m.canvas,g2);}
 const tie=(x:number,z:number,alongZ:boolean)=>{
  const cy=Y-.09,inX=alongZ?-1:0,inZ=alongZ?0:1;
  const band=new THREE.CylinderGeometry(.071,.071,.05,16);if(alongZ)band.rotateX(Math.PI/2);else band.rotateZ(Math.PI/2);band.translate(x,cy,z);b.add(m.strap,band);
  const bx=x+inX*.074,bz=z+inZ*.074;
  b.box(m.buckle,bx-.014,bx+.014,cy-.045,cy-.005,bz-.016,bz+.016); // buckle
  if(alongZ)b.box(m.strap,bx-.004,bx+.004,cy-.32,cy-.005,z-.014,z+.014);else b.box(m.strap,x-.014,x+.014,cy-.32,cy-.005,bz-.004,bz+.004);
  b.box(m.buckle,alongZ?bx-.008:x-.012,alongZ?bx+.008:x+.012,cy-.35,cy-.31,alongZ?z-.012:bz-.008,alongZ?z+.012:bz+.008); // hook at the tail end
 };
 for(const z of[-2.2,-.3,1.6,3.5])tie(xMax-.1,z,true);
 for(const x of[.6,1.8])tie(x,zMin+.1,false);

 // Stair-opening handrail: base flanges and weld nodes at every post/rail joint.
 for(const [a,c] of[[[STAIR.xMax,STAIR.zMin],[STAIR.xMax,STAIR.zMax]],[[STAIR.xMin,STAIR.zMin],[STAIR.xMax,STAIR.zMin]],[[STAIR.xMin,STAIR.zMax],[STAIR.xMax,STAIR.zMax]]] as const){
  const n=Math.max(1,Math.round(Math.hypot(c[0]-a[0],c[1]-a[1])/1.0));
  for(let i=0;i<=n;i++){const x=a[0]+(c[0]-a[0])*i/n,z=a[1]+(c[1]-a[1])*i/n;
   b.sphere(m.pipe,v3(x,1.0,z),.034,1,1,1,8);b.sphere(m.pipe,v3(x,.55,z),.027,1,1,1,8);
   b.cyl(m.pipe,v3(x,.002,z),v3(x,.012,z),.05,12);
  }
 }
 b.build(group,'fit');
 return group;
}
