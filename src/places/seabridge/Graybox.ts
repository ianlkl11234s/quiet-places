import * as THREE from 'three';
import {seededRandom} from '../../shared/math/seededRandom.ts';
import {DECK,PLATFORM,ROOF_H,SHORE,STAIR,TRACK,stairProfile} from './Layout.ts';
import {createCorrugatedMaterial,createGroundMaterial,createPlatformMaterial} from './Materials.ts';

/**
 * S1 graybox: covered stair of a small-station footbridge (跨線橋) that climbs
 * toward the sea, crosses one coast-parallel track, and descends along the
 * seaside platform. Flat materials only; PBR, rust and baking come after S1.
 */
export function createGraybox(){
 const group=new THREE.Group();group.name='seabridge-graybox';
 const steel=new THREE.MeshStandardMaterial({color:'#d6d1c4',roughness:.62,metalness:.15});
 const concrete=new THREE.MeshStandardMaterial({color:'#7c7a75',roughness:.93});
 const rockMat=new THREE.MeshStandardMaterial({color:'#2f2f30',roughness:.95,flatShading:true});
 const railMat=new THREE.MeshStandardMaterial({color:'#4a4541',roughness:.55,metalness:.6});
 const pipeMat=new THREE.MeshStandardMaterial({color:'#bdb6a8',roughness:.45,metalness:.45});
 const tubeMat=new THREE.MeshStandardMaterial({color:'#f4efe2',emissive:new THREE.Color('#fff1d6'),emissiveIntensity:0,roughness:.4});
 const roofMat=new THREE.MeshStandardMaterial({color:'#cfcabd',roughness:.66,metalness:.12,side:THREE.DoubleSide});

 const add=(name:string,geometry:THREE.BufferGeometry,material:THREE.Material,cast=true)=>{
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=cast;mesh.receiveShadow=true;group.add(mesh);return mesh;
 };
 const box=(name:string,size:[number,number,number],pos:[number,number,number],material:THREE.Material,cast=true)=>{
  const mesh=add(name,new THREE.BoxGeometry(...size),material,cast);mesh.position.set(...pos);return mesh;
 };
 /** Shears a geometry laid along local Z so its centre line runs from (z0,y0) to (z1,y1). */
 const shear=(geometry:THREE.BufferGeometry,z0:number,y0:number,z1:number,y1:number)=>{
  const position=geometry.attributes.position as THREE.BufferAttribute,mid=(z0+z1)/2;
  for(let i=0;i<position.count;i++){const z=position.getZ(i)+mid;position.setXYZ(i,position.getX(i),position.getY(i)+y0+(z0-z)/(z0-z1)*(y1-y0),z);}
  position.needsUpdate=true;geometry.computeVertexNormals();return geometry;
 };
 const pipe=(name:string,a:THREE.Vector3,b:THREE.Vector3,r:number,material:THREE.Material=pipeMat)=>{
  const mesh=add(name,new THREE.CylinderGeometry(r,r,a.distanceTo(b),8),material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return mesh;
 };
 /** Open railing along a 3D line: posts, top and mid rails (bridge deck, seaside stair, platform). */
 const railing=(name:string,a:THREE.Vector3,b:THREE.Vector3,height=1.1,spacing=1.2)=>{
  const n=Math.max(1,Math.round(a.distanceTo(b)/spacing));
  for(let i=0;i<=n;i++){const p=a.clone().lerp(b,i/n);box(`${name}-post-${i}`,[.07,height,.07],[p.x,p.y+height/2,p.z],steel);}
  const up=new THREE.Vector3(0,height,0),mid=new THREE.Vector3(0,height*.5,0);
  pipe(`${name}-top-rail`,a.clone().add(up),b.clone().add(up),.035,steel);
  pipe(`${name}-mid-rail`,a.clone().add(mid),b.clone().add(mid),.022,steel);
 };

 const s=stairProfile(),hw=STAIR.width/2;
 /** Nosing line height of the main stair at depth z. */
 const lineY=(z:number)=>z>=STAIR.footZ?0:z>s.f1End?(STAIR.footZ-z)/STAIR.run*STAIR.rise:z>s.landingEnd?s.f1Top:z>s.f2End?s.f1Top+(s.landingEnd-z)/STAIR.run*STAIR.rise:DECK.y;

 // Main stair: treads, stringer slabs, landing, top landing.
 const steps=(prefix:string,count:number,zStart:number,base:number)=>{
  for(let i=0;i<count;i++){
   const top=base+(i+1)*STAIR.rise,z=zStart-(i+.5)*STAIR.run;
   box(`${prefix}-step-${i}`,[STAIR.width,STAIR.rise+.22,STAIR.run],[0,top-(STAIR.rise+.22)/2,z],concrete);
  }
 };
 steps('flight1',STAIR.flight1,STAIR.footZ,0);steps('flight2',STAIR.flight2,s.landingEnd,s.f1Top);
 // Stringer slab deep enough to swallow the bottoms of the tread boxes (they sit up to .38 m below the nosing line).
 add('flight1-slab',shear(new THREE.BoxGeometry(STAIR.width,.5,s.f1Run),STAIR.footZ,-.35,s.f1End,s.f1Top-.35),steel);
 add('flight2-slab',shear(new THREE.BoxGeometry(STAIR.width,.5,s.f2Run),s.landingEnd,s.f1Top-.35,s.f2End,DECK.y-.35),steel);
 box('mid-landing',[STAIR.width,.3,STAIR.landing],[0,s.f1Top-.15,(s.f1End+s.landingEnd)/2],concrete);
 const deckLength=s.deckStart-DECK.crossEndZ;
 box('deck',[DECK.width,.5,deckLength],[0,DECK.y-.25,(s.deckStart+DECK.crossEndZ)/2],concrete);
 box('deck-girder-left',[.18,.55,deckLength],[-hw-.09,DECK.y-.55,(s.deckStart+DECK.crossEndZ)/2],steel);
 box('deck-girder-right',[.18,.55,deckLength],[hw+.09,DECK.y-.55,(s.deckStart+DECK.crossEndZ)/2],steel);

 // Solid side panels along the covered stair (the reference's look); open railings beyond.
 // They run from .7 m below to 1.2 m above the nosing line so the stepped tread ends and the
 // slab edge stay hidden (a shallower panel left a saw-tooth of tread ends showing beneath it).
 for(const side of [-1,1]){
  const x=side*(hw+.03);
  add(`flight1-panel-${side}`,shear(new THREE.BoxGeometry(.06,1.9,s.f1Run),STAIR.footZ,.25,s.f1End,s.f1Top+.25),steel).position.x=x;
  add(`flight2-panel-${side}`,shear(new THREE.BoxGeometry(.06,1.9,s.f2Run),s.landingEnd,s.f1Top+.25,s.f2End,DECK.y+.25),steel).position.x=x;
  box(`landing-panel-${side}`,[.06,1.9,STAIR.landing],[x,s.f1Top+.25,(s.f1End+s.landingEnd)/2],steel);
  box(`top-landing-panel-${side}`,[.06,1.9,DECK.topLandingDepth],[x,DECK.y+.25,(s.deckStart+s.deckLandingEnd)/2],steel);
  const rx=side*(hw-.07);
  pipe(`handrail-f1-${side}`,new THREE.Vector3(rx,.85,STAIR.footZ+.3),new THREE.Vector3(rx,s.f1Top+.85,s.f1End),.022);
  pipe(`handrail-landing-${side}`,new THREE.Vector3(rx,s.f1Top+.85,s.f1End),new THREE.Vector3(rx,s.f1Top+.85,s.landingEnd),.022);
  pipe(`handrail-f2-${side}`,new THREE.Vector3(rx,s.f1Top+.85,s.landingEnd),new THREE.Vector3(rx,DECK.y+.85,s.f2End),.022);
 }
 railing('deck-rail-left',new THREE.Vector3(-hw-.02,DECK.y,s.deckLandingEnd),new THREE.Vector3(-hw-.02,DECK.y,DECK.crossEndZ));
 railing('deck-rail-right',new THREE.Vector3(hw+.02,DECK.y,s.deckLandingEnd),new THREE.Vector3(hw+.02,DECK.y,DECK.crossEndZ+1.6));
 railing('deck-rail-end',new THREE.Vector3(-hw,DECK.y,DECK.crossEndZ+.02),new THREE.Vector3(hw,DECK.y,DECK.crossEndZ+.02));

 // Barrel-vault roof over both flights and the top landing; columns and fluorescent tubes.
 const roofWidth=STAIR.width+.8;
 const roofGeometry=(length:number)=>{
  const g=new THREE.PlaneGeometry(roofWidth,length,10,1);g.rotateX(-Math.PI/2);
  const position=g.attributes.position as THREE.BufferAttribute;
  for(let i=0;i<position.count;i++){const u=position.getX(i)/(roofWidth/2);position.setY(i,.28*(1-u*u));}
  return g;
 };
 add('roof-flight1',shear(roofGeometry(s.f1Run+.4),STAIR.footZ+.4,ROOF_H,s.f1End,s.f1Top+ROOF_H),roofMat);
 add('roof-landing',shear(roofGeometry(STAIR.landing),s.f1End,s.f1Top+ROOF_H,s.landingEnd,s.f1Top+ROOF_H),roofMat);
 add('roof-flight2',shear(roofGeometry(s.f2Run),s.landingEnd,s.f1Top+ROOF_H,s.f2End,DECK.y+ROOF_H),roofMat);
 add('roof-top-landing',shear(roofGeometry(DECK.topLandingDepth+.3),s.f2End,DECK.y+ROOF_H,s.deckLandingEnd-.3,DECK.y+ROOF_H),roofMat);
 // Flat entrance canopy at the stair foot, reaching over the footpath as in the reference.
 add('roof-entrance',shear(roofGeometry(2.7),STAIR.footZ+2.4,ROOF_H+.2,STAIR.footZ-.3,ROOF_H+.2),roofMat);
 for(const side of [-1,1])box(`entrance-column-${side}`,[.16,ROOF_H+.35,.16],[side*(hw+.14),(ROOF_H+.35)/2,STAIR.footZ+2.25],steel);
 box('entrance-tube',[1.2,.045,.06],[0,ROOF_H+.4,STAIR.footZ+1.1],tubeMat,false);
 const columnZ=[STAIR.footZ+.25,-2.7,s.f1End,s.landingEnd,s.landingEnd-2.55,s.f2End,s.deckLandingEnd];
 const tubes:THREE.Vector3[]=[];
 for(const z of columnZ)for(const side of [-1,1]){
  const bottom=z>=STAIR.footZ?0:lineY(z)-.3;
  box(`roof-column-${z.toFixed(1)}-${side}`,[.16,ROOF_H+.3-(bottom-lineY(z)),.16],[side*(hw+.14),(bottom+lineY(z)+ROOF_H)/2+.15,z],steel);
 }
 for(let i=0;i<columnZ.length-1;i++){
  const z=(columnZ[i]+columnZ[i+1])/2,y=lineY(z)+ROOF_H-.05;
  box(`tube-${i}`,[1.2,.045,.06],[0,y,z],tubeMat,false);tubes.push(new THREE.Vector3(0,y-.4,z));
 }
 tubes.unshift(new THREE.Vector3(0,ROOF_H,STAIR.footZ+1.1));
 // Legs under the landing and bridge piers either side of the track.
 for(const side of [-1,1]){
  box(`landing-leg-${side}`,[.3,s.f1Top-.3,.3],[side*(hw-.2),(s.f1Top-.3)/2,s.landingEnd+.2],steel);
  box(`pier-town-${side}`,[.36,DECK.y-.5-TRACK.bedY,.36],[side*(hw-.1),(DECK.y-.5+TRACK.bedY)/2,s.deckLandingEnd+.5],steel);
  box(`pier-sea-${side}`,[.36,DECK.y-.5-PLATFORM.topY,.36],[side*(hw-.1),PLATFORM.topY+(DECK.y-.5-PLATFORM.topY)/2,DECK.crossEndZ+.4],steel);
 }

 // Seaside stair descends along +X onto the platform.
 const seaSteps=Math.round((DECK.y-PLATFORM.topY)/STAIR.rise),seaRise=(DECK.y-PLATFORM.topY)/seaSteps,seaWidth=1.6;
 const seaZ=DECK.crossEndZ+seaWidth/2+.05;
 for(let i=0;i<seaSteps;i++){
  const top=DECK.y-(i+1)*seaRise;
  box(`sea-step-${i}`,[STAIR.run,seaRise+.22,seaWidth],[hw+(i+.5)*STAIR.run,top-(seaRise+.22)/2+seaRise,seaZ],concrete);
 }
 const seaEndX=hw+seaSteps*STAIR.run;
 for(const [k,z] of [[0,seaZ-seaWidth/2-.02],[1,seaZ+seaWidth/2+.02]] as const){
  railing(`sea-stair-rail-${k}`,new THREE.Vector3(hw,DECK.y,z),new THREE.Vector3(seaEndX,PLATFORM.topY+seaRise,z));
 }
 box('sea-stair-leg',[.3,(DECK.y+PLATFORM.topY)/2-PLATFORM.topY,.3],[(hw+seaEndX)/2,PLATFORM.topY+((DECK.y+PLATFORM.topY)/2-PLATFORM.topY)/2-.6,seaZ],steel);

 // Ground, fence, track, platform, sea wall.
 const B=TRACK.bedY;
 // Where structure meets the ground: concrete plinths under each column foot.
 const feet:[number,number][]=[];
 for(const side of [-1,1])feet.push([side*(hw+.14),STAIR.footZ+2.25],[side*(hw+.14),STAIR.footZ+.25],[side*(hw-.2),s.landingEnd+.2]);
 for(const [x,z] of feet)box(`plinth-${x.toFixed(2)}-${z.toFixed(2)}`,[.42,.12,.42],[x,.05,z],concrete);
 const ground=createGroundMaterial(feet);
 box('town-ground',[600,.2,80],[0,-.1,SHORE.fenceZ+40],ground,false);
 box('retaining-wall',[600,-B+.2,.4],[0,B/2-.1,SHORE.fenceZ-.2],concrete,false);
 box('track-ground',[600,.2,6.1],[0,B-.1,-16.45],ground,false);
 box('platform-ground',[306,.2,2.8],[147,B-.1,-20.9],ground,false);
 box('ballast',[600,.24,2.8],[0,B+.04,TRACK.centerZ],new THREE.MeshStandardMaterial({color:'#5a5752',roughness:1}),false);
 for(const side of [-1,1])box(`rail-${side}`,[600,.15,.07],[0,B+.24,TRACK.centerZ+side*TRACK.gauge/2],railMat,false);
 const sleeperGeometry=new THREE.BoxGeometry(.2,.12,2.0),sleepers=new THREE.InstancedMesh(sleeperGeometry,concrete,200);
 const m=new THREE.Matrix4();for(let i=0;i<200;i++){m.makeTranslation(-60+i*.6,B+.18,TRACK.centerZ);sleepers.setMatrixAt(i,m);}
 sleepers.name='sleepers';sleepers.receiveShadow=true;group.add(sleepers);
 const pw=PLATFORM.xMax-PLATFORM.xMin,pz=(PLATFORM.zNear+PLATFORM.zFar)/2;
 const platformMat=createPlatformMaterial();
 box('platform',[pw,PLATFORM.topY-B+.2,PLATFORM.zNear-PLATFORM.zFar],[(PLATFORM.xMin+PLATFORM.xMax)/2,(PLATFORM.topY+B-.2)/2,pz],platformMat);
 // A small open waiting shelter at the left end of the platform, echoing the reference's booth.
 const shelterX=PLATFORM.xMin+2.2;
 const shelterWall=createCorrugatedMaterial('#9aa49d','wall'),shelterRoof=createCorrugatedMaterial('#6d736f','roof',.62);
 const wood=new THREE.MeshStandardMaterial({color:'#6a5a46',roughness:.85});
 box('shelter-back',[3.2,2.3,.08],[shelterX,PLATFORM.topY+1.15,PLATFORM.zFar+.3],shelterWall);
 for(const side of [-1,1])box(`shelter-side-${side}`,[.08,2.3,1.2],[shelterX+side*1.6,PLATFORM.topY+1.15,PLATFORM.zFar+.9],shelterWall);
 box('shelter-roof',[3.6,.1,1.8],[shelterX,PLATFORM.topY+2.36,PLATFORM.zFar+.95],shelterRoof);
 box('shelter-fascia',[3.6,.16,.04],[shelterX,PLATFORM.topY+2.28,PLATFORM.zFar+1.84],steel);
 box('shelter-bench',[2.6,.05,.36],[shelterX,PLATFORM.topY+.45,PLATFORM.zFar+.6],wood);
 for(const side of [-1,1])box(`shelter-bench-leg-${side}`,[.05,.43,.3],[shelterX+side*1.1,PLATFORM.topY+.215,PLATFORM.zFar+.6],steel);
 // One small lamp under the shelter eave: the only light on the platform at night.
 const shelterLampMat=new THREE.MeshStandardMaterial({color:'#f2eee4',emissive:new THREE.Color('#ffe2b8'),emissiveIntensity:0,roughness:.4});
 box('shelter-lamp',[.5,.05,.08],[shelterX,PLATFORM.topY+2.25,PLATFORM.zFar+1.55],shelterLampMat,false);
 const shelterLamp=new THREE.Vector3(shelterX,PLATFORM.topY+2.1,PLATFORM.zFar+1.5);
 // Station name board: blank on purpose (no signage text in the art language).
 const boardX=PLATFORM.xMin+8.5;
 for(const side of [-1,1])box(`board-post-${side}`,[.08,1.9,.08],[boardX+side*.7,PLATFORM.topY+.95,PLATFORM.zNear-.6],steel);
 box('station-board',[1.8,.5,.05],[boardX,PLATFORM.topY+1.65,PLATFORM.zNear-.6],steel);
 const wallH=PLATFORM.topY+.05-(SHORE.seaY-.3);
 box('sea-wall',[306,wallH,.5],[147,SHORE.seaY-.3+wallH/2,SHORE.wallZ],concrete);
 box('coast-edge-left',[294,B-SHORE.seaY+.3,.5],[-153,(B+SHORE.seaY-.3)/2,-19.5],concrete);

 // Rocks along the revetment and seaward of the wall.
 const random=seededRandom(20260927);
 const rockGeometry=new THREE.IcosahedronGeometry(1,0);
 const rocks=new THREE.InstancedMesh(rockGeometry,rockMat,90);
 const q=new THREE.Quaternion(),e=new THREE.Euler(),scale=new THREE.Vector3(),at=new THREE.Vector3();
 for(let i=0;i<90;i++){
  const x=-70+random()*110,left=x<PLATFORM.xMin-1;
  const z=(left?-19.9:SHORE.wallZ-.6)-random()*(left?7:4.5);
  const r=.45+random()*1.3;
  at.set(x,SHORE.seaY-.2+random()*(left?1.0:.6)+(left?Math.max(0,(z+22)*.35):0),z);
  e.set(random()*3,random()*3,random()*3);q.setFromEuler(e);scale.set(r*(1+random()*.6),r*(.5+random()*.4),r*(1+random()*.5));
  rocks.setMatrixAt(i,m.compose(at,q,scale));
 }
 rocks.name='shore-rocks';rocks.castShadow=true;rocks.receiveShadow=true;group.add(rocks);

 return {group,tubeMat,tubes,shelterLampMat,shelterLamp};
}
