// Architecture and camera clearance share these interior wall coordinates.
export const WATER_ROOM = {minX:-4,maxX:4,minZ:-5,maxZ:11,height:7};
type Point = {x:number;z:number};

// Find the connected part of the horizontal orbit containing the home view.
// OrbitControls clamps input and damping to these wall-derived endpoints.
export function waterOrbitLimits(home:Point,target:Point,clearance:number){
 const room=WATER_ROOM,radius=Math.hypot(home.x-target.x,home.z-target.z);
 const angle=Math.atan2(home.x-target.x,home.z-target.z);
 const inside=(a:number)=>{
  const x=target.x+radius*Math.sin(a),z=target.z+radius*Math.cos(a);
  return x>=room.minX+clearance-1e-9&&x<=room.maxX-clearance+1e-9
   &&z>=room.minZ+clearance-1e-9&&z<=room.maxZ-clearance+1e-9;
 };
 if(!Number.isFinite(clearance)||clearance<0||radius===0||!inside(angle))throw new Error('Water camera home must be inside the room clearance');
 const boundaries:number[]=[];
 const add=(a:number)=>{for(let k=-2;k<=2;k++){const v=a+k*Math.PI*2;if(v>=angle-Math.PI*2&&v<=angle+Math.PI*2)boundaries.push(v);}};
 for(const x of [room.minX+clearance,room.maxX-clearance]){
  const q=(x-target.x)/radius;if(Math.abs(q)<=1){const a=Math.asin(q);add(a);add(Math.PI-a);}
 }
 for(const z of [room.minZ+clearance,room.maxZ-clearance]){
  const q=(z-target.z)/radius;if(Math.abs(q)<=1){const a=Math.acos(q);add(a);add(-a);}
 }
 const min=boundaries.filter(a=>a<=angle&&!inside(a-1e-6)).sort((a,b)=>b-a)[0]??-Infinity;
 const max=boundaries.filter(a=>a>=angle&&!inside(a+1e-6)).sort((a,b)=>a-b)[0]??Infinity;
 return {min,max};
}

export function waterCameraClearance(near:number,fov:number,aspect:number){
 // A sphere around the whole near plane also protects wide desktop viewports.
 const halfHeight=near*Math.tan(fov*Math.PI/360);
 return Math.max(.35,Math.hypot(near,halfHeight,halfHeight*aspect)+.15);
}
