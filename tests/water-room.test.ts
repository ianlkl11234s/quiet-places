import * as THREE from 'three';
import {WATER_ROOM,waterOrbitLimits,waterCameraClearance} from '../src/world/WaterRoom.js';
const home=new THREE.Vector3(2.6,2.3,9.5),target=new THREE.Vector3(0,3.4,-.2);
const radius=Math.hypot(home.x-target.x,home.z-target.z);
function assert(ok:boolean,message:string){if(!ok)throw new Error(message);}
const inside=(p:THREE.Vector3,padding=0)=>p.x>=WATER_ROOM.minX+padding-1e-8&&p.x<=WATER_ROOM.maxX-padding+1e-8&&p.z>=WATER_ROOM.minZ+padding-1e-8&&p.z<=WATER_ROOM.maxZ-padding+1e-8&&p.y>=0&&p.y<=WATER_ROOM.height;
const position=(a:number)=>new THREE.Vector3(target.x+radius*Math.sin(a),home.y,target.z+radius*Math.cos(a));
for(const [aspect,fov] of [[16/9,53],[390/844,64],[8,53]]){
 const camera=new THREE.PerspectiveCamera(fov,aspect,.1,60);
 const clearance=waterCameraClearance(camera.near,fov,aspect),{min,max}=waterOrbitLimits(home,target,clearance);
 const initial=Math.atan2(home.x-target.x,home.z-target.z);
 assert(min<initial&&initial<max,'Home view remains reachable');
 assert(!inside(position(min-.001),clearance)&&!inside(position(max+.001),clearance),'Endpoints stop at the first wall');
 for(let i=0;i<=200;i++){
  const a=min+(max-min)*i/200;camera.position.copy(position(a));camera.lookAt(target);camera.updateMatrixWorld();
  assert(inside(camera.position,clearance),'Whole allowed orbit is inside the padded room');
  // Test the actual near-plane corners, including both endpoints and wide viewports.
  for(const x of [-1,1])for(const y of [-1,1])assert(inside(new THREE.Vector3(x,y,-1).unproject(camera)),'Near plane cannot clip through a wall');
 }
 assert(inside(position(THREE.MathUtils.clamp(max+100,min,max)),clearance),'Oversized rightward input stays safe');
 assert(inside(position(THREE.MathUtils.clamp(min-100,min,max)),clearance),'Oversized leftward input stays safe');
 assert(max-.01<max&&inside(position(max-.01),clearance),'Moving away from the right wall is allowed');
 console.log(`PASS aspect=${aspect.toFixed(3)} fov=${fov}: ${(min*180/Math.PI).toFixed(2)}..${(max*180/Math.PI).toFixed(2)} degrees`);
}
const rear=waterOrbitLimits({x:2,z:10.6},{x:0,z:9},.35);
assert(Number.isFinite(rear.min)&&Number.isFinite(rear.max),'Rear wall can also constrain the orbit');
let rejected=false;try{waterOrbitLimits({x:8,z:0},target,.35);}catch{rejected=true;}
assert(rejected,'Reject a home camera outside the room');
