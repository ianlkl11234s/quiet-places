import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CHAIRS} from './Layout.ts';

/**
 * Woven ferry chairs, procedural. Chair frame (local, seat faces +Z, floor at y=0): 2.2 cm tube back frame leaning 15 degrees
 * with rounded top corners, a wide curved aluminium armrest band per side; weave of 3.7 cm flat straps on a 4.6 cm pitch
 * (vertical cream, horizontal teal) that alternate over/under by 2.5 mm per cell, with ~9 mm gaps. Rows share one base
 * (rails + slim legs) and all chairs share the same merged geometry. Straps are double-sided planes (cheap, light passes the gaps).
 */
const R=.011,PITCH=.046,STRAP=.037,PITCH_ROW=.6,SEAT_Y=CHAIRS.seatH,LEAN=-.26,HALF_W=.27;
const flat=(g:THREE.BufferGeometry)=>g.index?g.toNonIndexed():g;
const tube=(a:THREE.Vector3,b:THREE.Vector3,r=R)=>{
 const g=new THREE.CylinderGeometry(r,r,a.distanceTo(b),6,1,true);
 g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()),new THREE.Vector3(1,1,1)));
 return flat(g);
};
const v3=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);

function chairParts(){
 const teal:THREE.BufferGeometry[]=[],cream:THREE.BufferGeometry[]=[],frame:THREE.BufferGeometry[]=[];
 const backM=new THREE.Matrix4().makeTranslation(0,SEAT_Y,-.2).multiply(new THREE.Matrix4().makeRotationX(LEAN));
 const L=.43; // back frame length along its lean
 // Weave over/under: cell (i,j) puts the vertical strap in front when (i+j) is even, else behind (2.5 mm).
 const weave=(cols:number,rows:number,origin:THREE.Vector2,m:THREE.Matrix4)=>{
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
   const cx=(i-(cols-1)/2)*PITCH,cy=origin.y+(j+.5)*PITCH,front=(i+j)%2===0?.0025:-.0025;
   const vert=new THREE.PlaneGeometry(STRAP,PITCH);vert.translate(cx,cy,front);vert.applyMatrix4(m);cream.push(flat(vert));
   const hor=new THREE.PlaneGeometry(PITCH,STRAP);hor.translate(cx,cy,-front);hor.applyMatrix4(m);teal.push(flat(hor));
  }
 };
 weave(10,9,new THREE.Vector2(0,.02),backM);
 // Seat weave lies flat at seat height: local plane XY -> XZ.
 weave(10,10,new THREE.Vector2(0,-.23),new THREE.Matrix4().makeTranslation(0,SEAT_Y,0).multiply(new THREE.Matrix4().makeRotationX(-Math.PI/2)));
 // Back frame: two uprights, rounded top corners (radius .08, 4 segments), top bar. Points in back-local (x, v along the lean).
 const toWorld=(x:number,v:number)=>v3(x,v,0).applyMatrix4(backM);
 for(const s of[-1,1])frame.push(tube(toWorld(s*HALF_W,0),toWorld(s*HALF_W,L-.08)));
 // Rounded top as an explicit arc: centre (x=±(HALF_W-rc), v=top-rc).
 for(const s of[-1,1]){
  const rc=.08,cx=s*(HALF_W-rc),cv=L-rc;let prev=toWorld(s*HALF_W,cv);
  for(let k=1;k<=4;k++){const a=k/4*Math.PI/2,p=toWorld(cx+s*rc*Math.cos(a),cv+rc*Math.sin(a));frame.push(tube(prev,p));prev=p;}
 }
 frame.push(tube(toWorld(-(HALF_W-.08),L),toWorld(HALF_W-.08,L)));
 frame.push(tube(toWorld(-HALF_W,.02),toWorld(HALF_W,.02))); // lower back cross tube
 // Armrest: wide band (4 cm, bright aluminium), a quadratic arc from the back frame sideways-up to the seat front edge.
 for(const s of[-1,1]){
  const p0=toWorld(0,.3),p2=v3(0,SEAT_Y+.07,.26),p1=v3(0,p0.y+.07,.14);
  let prev=p0.clone();
  for(let k=1;k<=8;k++){
   const t=k/8,u=1-t,p=v3(0,u*u*p0.y+2*u*t*p1.y+t*t*p2.y,u*u*p0.z+2*u*t*p1.z+t*t*p2.z),d=p.clone().sub(prev),len=d.length();d.normalize();
   const seg=new THREE.PlaneGeometry(.04,len+.004);
   seg.applyMatrix4(new THREE.Matrix4().makeBasis(v3(1,0,0),d,v3(1,0,0).cross(d)).setPosition(prev.clone().add(p).multiplyScalar(.5).setX(s*(HALF_W+.012))));
   frame.push(flat(seg));prev=p;
  }
  frame.push(tube(v3(s*HALF_W,SEAT_Y,.26),v3(s*HALF_W,SEAT_Y+.07,.26))); // armrest end post
 }
 const merge=(a:THREE.BufferGeometry[])=>{const g=mergeGeometries(a)!;a.forEach(x=>x.dispose());return g;};
 return {teal:merge(teal),cream:merge(cream),frame:merge(frame)};
}

/** Row base: continuous front and back seat rails plus slim leg pairs between chairs (n chairs, pitch .6, local x along the row). */
function rowBase(n:number){
 const g:THREE.BufferGeometry[]=[],half=n*PITCH_ROW/2;
 g.push(tube(v3(-half,SEAT_Y,.25),v3(half,SEAT_Y,.25)),tube(v3(-half,SEAT_Y,-.21),v3(half,SEAT_Y,-.21)));
 for(let k=0;k<=n;k++){
  const x=-half+k*PITCH_ROW;
  for(const z of[.25,-.21])g.push(tube(v3(x,0,z),v3(x,SEAT_Y,z)));
  g.push(tube(v3(x,.12,.25),v3(x,.12,-.21)),tube(v3(x,SEAT_Y,.25),v3(x,SEAT_Y,-.21)));
 }
 const m=mergeGeometries(g)!;g.forEach(x=>x.dispose());return m;
}

export function createChairs(){
 const group=new THREE.Group();group.name='crossing-chairs';
 const tealMat=new THREE.MeshStandardMaterial({color:'#3caaaf',roughness:.55,side:THREE.DoubleSide});
 const creamMat=new THREE.MeshStandardMaterial({color:'#decd96',roughness:.55,side:THREE.DoubleSide});
 const alu=new THREE.MeshStandardMaterial({color:'#d6d6d3',metalness:.9,roughness:.45,envMapIntensity:.3,side:THREE.DoubleSide});
 const parts=chairParts(),bases=new Map<number,THREE.BufferGeometry>();
 let tris=0;
 const count=(g:THREE.BufferGeometry)=>(g.index?g.index.count:g.attributes.position.count)/3;
 const row=(name:string,n:number,x:number,z:number,yaw:number)=>{
  if(!bases.has(n))bases.set(n,rowBase(n));
  const r=new THREE.Group();r.name=name;r.position.set(x,0,z);r.rotation.y=yaw;
  const mk=(geo:THREE.BufferGeometry,m:THREE.Material,px=0)=>{const mesh=new THREE.Mesh(geo,m);mesh.position.x=px;mesh.castShadow=true;mesh.receiveShadow=true;r.add(mesh);tris+=count(geo);};
  mk(bases.get(n)!,alu);
  for(let i=0;i<n;i++){const px=(i+.5-n/2)*PITCH_ROW;mk(parts.teal,tealMat,px);mk(parts.cream,creamMat,px);mk(parts.frame,alu,px);}
  group.add(r);
 };
 // Wall row: local x runs along +Z with yaw -90 degrees; the stern rows run along -X with yaw 180.
 row('chairs-wall',CHAIRS.wallRowZ.length,CHAIRS.wallRowX,(CHAIRS.wallRowZ[0]+CHAIRS.wallRowZ[CHAIRS.wallRowZ.length-1])/2,-Math.PI/2);
 const sx=(CHAIRS.sternRowsX[0]+CHAIRS.sternRowsX[CHAIRS.sternRowsX.length-1])/2;
 CHAIRS.sternRowsZ.forEach((z,i)=>row(`chairs-stern-${i}`,CHAIRS.sternRowsX.length,sx,z,Math.PI));
 return {group,alu,triangles:tris,geometries:[...Object.values(parts),...bases.values()],materials:[tealMat,creamMat,alu]};
}
