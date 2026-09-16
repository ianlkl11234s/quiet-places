import * as THREE from 'three';

export interface WhaleSharkPose { phase:number; amplitude:number; glide:number; }
export interface WhaleSharkModel { root:THREE.Group; update(pose:WhaleSharkPose):void; dispose():void; }

const TAU=Math.PI*2;
const clamp=THREE.MathUtils.clamp;

function disposeObject(root:THREE.Object3D){
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  root.traverse(node=>{if(!(node instanceof THREE.Mesh))return;geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])materials.add(material);});
  geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());root.removeFromParent();root.clear();
}

type DynamicMesh={mesh:THREE.Mesh; rest:Float32Array; stations:Float32Array; sides:number; capHead:number; capTail:number};
type Anchor={object:THREE.Object3D;s:number;side?:number};
type SurfaceAnchor={object:THREE.Object3D;s:number;angle:number;offset:number};
type GillTrace={mesh:THREE.Mesh;geometry:THREE.BufferGeometry;s:number;start:number;end:number};

/** 11 measured-looking control sections, not a single generic shark capsule. s is snout -> tail. */
const SECTION=[
  [0,.74,.32,3.3], [.035,1.27,.54,3.15], [.085,1.54,.69,3.0], [.16,1.62,.77,2.85],
  [.28,1.54,.82,2.45], [.42,1.37,.78,2.18], [.56,1.13,.67,2.06], [.68,.86,.51,2.0],
  [.78,.59,.34,2.0], [.875,.31,.19,2.0], [1,.105,.078,2.0],
] as const;

function superellipse(angle:number,a:number,b:number,n:number){
  const c=Math.cos(angle),s=Math.sin(angle);
  return [Math.sign(c)*Math.pow(Math.abs(c),2/n)*a,Math.sign(s)*Math.pow(Math.abs(s),2/n)*b] as const;
}
function catmull(a:number,b:number,c:number,d:number,t:number){return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);}
function sectionAt(s:number){
  const scaled=clamp(s,0,1)*(SECTION.length-1),index=Math.floor(scaled),t=scaled-index;
  const at=(offset:number)=>SECTION[clamp(index+offset,0,SECTION.length-1)];
  const interpolate=(column:1|2|3)=>Math.max(0,catmull(at(-1)[column],at(0)[column],at(1)[column],at(2)[column],t));
  return {a:interpolate(1),b:interpolate(2),n:clamp(interpolate(3),2,3.4)};
}
function surfaceAt(s:number,angle:number,length:number,phase:number,amplitude:number,glide:number){
  const section=sectionAt(s),a=section.a*length/9,b=section.b*length/9,[x,y]=superellipse(angle,a,b,section.n),wave=waveAt(s,length,phase,amplitude,glide);
  const nx=Math.sign(x||1)*section.n/a*Math.pow(Math.abs(x/a),section.n-1),ny=Math.sign(y||1)*section.n/b*Math.pow(Math.abs(y/b),section.n-1);
  return {point:new THREE.Vector3(x+wave.x,y,length*.5-s*length),normal:new THREE.Vector3(nx,ny,0).normalize(),rotation:wave.rotation};
}
function colourAt(s:number,angle:number,seed:number){
  const belly=clamp((-Math.sin(angle)-.12)/.72,0,1);
  // Dense, irregular guide lattice: small circular spots and soft transverse bars,
  // evaluated per vertex so it cannot collapse into a handful of giant patches.
  const u=s*18,v=(angle+Math.PI)/TAU*17,cellU=Math.floor(u),cellV=Math.floor(v);
  let spots=0;
  for(let du=-1;du<=1;du++)for(let dv=-1;dv<=1;dv++){
    const ru=cellU+du,rv=cellV+dv,hash=Math.sin((ru*71+rv*191+seed*.0031)*12.9898)*43758.5453,fraction=hash-Math.floor(hash);
    const hash2=Math.sin((ru*97+rv*43+seed*.009)*78.233)*19341.17,offset=hash2-Math.floor(hash2);
    const dx=u-(ru+.24+fraction*.48),dy=v-(rv+.22+offset*.56),radius=.115+fraction*.09;
    spots=Math.max(spots,1-clamp(Math.hypot(dx,dy)/radius,0,1));
  }
  const bars=Math.max(0,Math.sin(s*TAU*8.4+Math.sin(angle*2.2+seed*.001)*.55)-.64)/.36;
  const mark=clamp((spots*.82+bars*.18)*(1-belly*.86),0,1);
  const dorsal=new THREE.Color('#40565d'), pale=new THREE.Color('#cbd0c9'), spot=new THREE.Color('#cbd7d0');
  dorsal.lerp(pale,belly).lerp(spot,mark*.78);
  return dorsal;
}
function bodyMesh(length:number,seed:number,sides:number,rings:number,material:THREE.MeshStandardMaterial):DynamicMesh{
  const stations=Float32Array.from({length:rings},(_,i)=>i/(rings-1));
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  for(let i=0;i<rings;i++){
    const s=stations[i],profile=sectionAt(s),a=profile.a*length/9,b=profile.b*length/9,z=length*.5-s*length;
    for(let j=0;j<sides;j++){
      const angle=TAU*j/sides,[x,y]=superellipse(angle,a,b,profile.n);
      positions.push(x,y,z);const c=colourAt(s,angle,seed);colors.push(c.r,c.g,c.b);
    }
  }
  for(let i=0;i<rings-1;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=a+sides,d=i*sides+(j+1)%sides+sides;indices.push(a,c,b,b,c,d);}
  const capHead=positions.length/3;positions.push(0,0,length*.5);colors.push(.22,.29,.31);
  const capTail=positions.length/3;positions.push(0,0,-length*.5);colors.push(.22,.29,.31);
  for(let j=0;j<sides;j++){indices.push(capHead,(j+1)%sides,j);const tail=(rings-1)*sides;indices.push(capTail,tail+j,tail+(j+1)%sides);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,material);mesh.name=`whale-shark-body-${sides}`;mesh.castShadow=true;mesh.receiveShadow=true;
  return {mesh,rest:new Float32Array(positions),stations,sides,capHead,capTail};
}
function finGeometry(points:readonly number[],material:THREE.MeshStandardMaterial,name:string,seed:number){
  const geometry=new THREE.BufferGeometry(),positions:number[]=[],colors:number[]=[],count=points.length/3,centroid=new THREE.Vector3();
  // Keep the dorsal-side checkerboard legible across fins. This is a seeded
  // visual continuation rather than a claim that a fin texture is measured.
  for(let i=0;i<count;i++)centroid.add(new THREE.Vector3(points[i*3],points[i*3+1],points[i*3+2]));centroid.multiplyScalar(1/count);
  const put=(point:THREE.Vector3,layer:number,index:number)=>{positions.push(point.x,point.y+layer,point.z);const mark=Math.sin((index+1)*(seed*.00031+2.37)+point.z*4.1)>.36;const c=new THREE.Color(mark?'#9fb6b2':'#40565d');colors.push(c.r,c.g,c.b);};
  // Two surface rings plus a centre give the broad fins continuous normals and
  // enough vertices for the dense dorsal spot field to read at close range.
  for(const layer of [-.024,.024]){for(let i=0;i<count;i++)put(new THREE.Vector3(points[i*3],points[i*3+1],points[i*3+2]),layer,i);for(let i=0;i<count;i++){const outer=new THREE.Vector3(points[i*3],points[i*3+1],points[i*3+2]);put(centroid.clone().lerp(outer,.56),layer,count+i);}put(centroid,layer,count*2);}
  const indices:number[]=[],layerSize=count*2+1,top=0,bottom=layerSize;for(let i=0;i<count;i++){const next=(i+1)%count,inner=count+i,innerNext=count+next;indices.push(top+i,top+next,top+innerNext,top+i,top+innerNext,top+inner);indices.push(bottom+i,bottom+innerNext,bottom+next,bottom+i,bottom+inner,bottom+innerNext);indices.push(top+inner,top+innerNext,top+count*2,bottom+innerNext,bottom+inner,bottom+count*2);indices.push(top+i,bottom+i,top+next,top+next,bottom+i,bottom+next);}
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
function waveAt(s:number,length:number,phase:number,amplitude:number,glide:number){
  // Front 45% stays perceptibly stiff; glide smoothly attenuates the body-caudal wave.
  const tail=clamp((s-.45)/.55,0,1),envelope=(.006+.104*Math.pow(tail,1.8))*length;
  const active=THREE.MathUtils.lerp(1,.18,glide)*amplitude;
  const wave=envelope*active*Math.sin(phase-TAU*.88*s);
  const derivative=envelope*active*TAU*.88*Math.cos(phase-TAU*.88*s);
  return {x:wave,rotation:Math.atan2(-derivative,length)};
}
function deformBody(dynamic:DynamicMesh,length:number,phase:number,amplitude:number,glide:number){
  const attribute=dynamic.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  for(let i=0;i<dynamic.stations.length;i++){
    const wave=waveAt(dynamic.stations[i],length,phase,amplitude,glide);
    for(let side=0;side<dynamic.sides;side++){
      const index=i*dynamic.sides+side,offset=index*3;
      attribute.setXYZ(index,dynamic.rest[offset]+wave.x,dynamic.rest[offset+1],dynamic.rest[offset+2]);
    }
  }
  const head=waveAt(0,length,phase,amplitude,glide),tail=waveAt(1,length,phase,amplitude,glide);
  attribute.setXYZ(dynamic.capHead,head.x,0,length*.5);attribute.setXYZ(dynamic.capTail,tail.x,0,-length*.5);
  attribute.needsUpdate=true;dynamic.mesh.geometry.computeVertexNormals();dynamic.mesh.geometry.computeBoundingSphere();
}
function ridgeMesh(offset:number,material:THREE.MeshStandardMaterial){
  const count=34,positions=new Float32Array(count*3*3),geometry=new THREE.BufferGeometry(),indices:number[]=[];
  for(let i=0;i<count-1;i++){const a=i*3,b=a+1,c=a+2,d=a+3,e=a+4,f=a+5;indices.push(a,d,b,b,d,e,b,e,c,c,e,f);}
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.name=offset===0?'whale-shark-midline-ridge':'whale-shark-lateral-ridge';mesh.castShadow=true;return {mesh,geometry,offset,count};
}
function gillTraceMesh(material:THREE.MeshStandardMaterial,name:string){
  const count=9,geometry=new THREE.BufferGeometry(),positions=new Float32Array(count*2*3),indices:number[]=[];
  for(let i=0;i<count-1;i++){const a=i*2,b=a+1,c=a+2,d=a+3;indices.push(a,c,b,b,c,d);}
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;return {mesh,geometry};
}

/**
 * Original procedural Rhincodon proxy. Local +Z is the broad terminal mouth,
 * +Y dorsal, and +X transverse. The root is centred on the body length.
 */
export function createWhaleSharkModel(length:number,seed:number):WhaleSharkModel {
  const safeLength=clamp(Number.isFinite(length)?length:8.5,2,20),root=new THREE.Group();
  root.name='procedural-whale-shark';root.userData={length:safeLength,forward:'+Z',dorsal:'+Y',transverse:'+X',lodDistances:[28,60]};
  const skin=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:0,side:THREE.DoubleSide});
  const dark=new THREE.MeshStandardMaterial({color:'#263942',roughness:.5,metalness:0,side:THREE.DoubleSide});
  const ridgeSkin=new THREE.MeshStandardMaterial({color:'#465b61',roughness:.5,metalness:0,side:THREE.DoubleSide});
  const pale=new THREE.MeshStandardMaterial({color:'#bdc5bf',roughness:.52,metalness:0,side:THREE.DoubleSide});
  const eyeMaterial=new THREE.MeshStandardMaterial({color:'#111619',roughness:.35,metalness:0});
  const lod=new THREE.LOD();lod.name='whale-shark-lod';root.add(lod);
  const detailed=bodyMesh(safeLength,seed,48,72,skin),mid=bodyMesh(safeLength,seed,24,40,skin),far=bodyMesh(safeLength,seed,16,20,skin);
  const close=new THREE.Group();close.name='whale-shark-anatomy-lod0';close.add(detailed.mesh);lod.addLevel(close,0);
  const midGroup=new THREE.Group();midGroup.name='whale-shark-anatomy-lod1';midGroup.add(mid.mesh);lod.addLevel(midGroup,28);
  const farGroup=new THREE.Group();farGroup.name='whale-shark-anatomy-lod2';farGroup.add(far.mesh);lod.addLevel(farGroup,60);
  const dynamic=[detailed,mid,far];const anchors:Anchor[]=[];const surfaceAnchors:SurfaceAnchor[]=[];const gillTraces:GillTrace[]=[];
  const attach=(parent:THREE.Object3D,object:THREE.Object3D,s:number,side?:number)=>{object.position.z=safeLength*.5-s*safeLength;anchors.push({object,s,side});parent.add(object);return object;};
  // Broad pectorals, two unequal dorsal fins, then a rigid semi-lunate caudal fin.
  const addFins=(parent:THREE.Object3D,suffix:string)=>{
    for(const sign of [-1,1]){const pectoral=finGeometry([sign*.92,0,.27,sign*1.52,-.05,.02,sign*2.16,-.14,-.21,sign*2.42,-.09,-1.12,sign*1.86,-.02,-1.0,sign*1.18,.02,-.82,sign*.82,.05,.18],skin,`whale-shark-pectoral-${sign<0?'left':'right'}-${suffix}`,seed+sign*71);pectoral.scale.setScalar(safeLength/9);attach(parent,pectoral,.23,sign);}
    const dorsal1=finGeometry([0,.49,.24,0,.76,.1,0,1.18,-.18,0,.63,-.43,0,.22,-.64,0,.24,-.25,0,.35,.19],skin,`whale-shark-first-dorsal-${suffix}`,seed+131);dorsal1.scale.setScalar(safeLength/9);attach(parent,dorsal1,.50);
    const dorsal2=finGeometry([0,.25,.12,0,.36,.03,0,.47,-.12,0,.25,-.28,0,.13,-.39,0,.13,-.15,0,.19,.1],skin,`whale-shark-second-dorsal-${suffix}`,seed+197);dorsal2.scale.setScalar(safeLength/9);attach(parent,dorsal2,.72);
    const tail=finGeometry([0,.05,.07,0,.66,-.29,0,1.22,-.77,0,.65,-.63,0,.27,-.43,0,-.51,-.59,0,-.93,-.81,0,-.53,-.36,0,-.16,-.02],skin,`whale-shark-semi-lunate-caudal-${suffix}`,seed+263);tail.scale.setScalar(safeLength/9);attach(parent,tail,.91);
  };
  addFins(close,'lod0');addFins(midGroup,'lod1');addFins(farGroup,'lod2');
  // The terminal mouth is an actual wide dark opening, with eyes and ten separate lateral gill slits.
  const mouth=new THREE.Mesh(new THREE.PlaneGeometry(safeLength*.14,safeLength*.012),dark);mouth.name='whale-shark-terminal-mouth';mouth.position.set(0,-safeLength*.012,safeLength*.4994);close.add(mouth);
  for(const sign of [-1,1]){
    const eye=new THREE.Mesh(new THREE.SphereGeometry(safeLength*.005,8,6),eyeMaterial);eye.name=sign<0?'whale-shark-eye-left':'whale-shark-eye-right';surfaceAnchors.push({object:eye,s:.095,angle:sign<0?Math.PI+.11:-.11,offset:safeLength*.003});close.add(eye);
    for(let i=0;i<5;i++){
      const trace=gillTraceMesh(dark,`whale-shark-gill-${sign<0?'left':'right'}-${i+1}`);gillTraces.push({mesh:trace.mesh,geometry:trace.geometry,s:.155+i*.029,start:sign<0?Math.PI+.05:-.05,end:sign<0?Math.PI+.65:-.65});close.add(trace.mesh);
    }
  }
  const ridges=[ridgeMesh(0,ridgeSkin),ridgeMesh(-1,ridgeSkin),ridgeMesh(1,ridgeSkin)];ridges.forEach(item=>close.add(item.mesh));
  let disposed=false;
  const updateRidges=(phase:number,amplitude:number,glide:number)=>ridges.forEach(({geometry,offset,count})=>{
    const position=geometry.getAttribute('position') as THREE.BufferAttribute;
    for(let i=0;i<count;i++){
      const s=.13+i/(count-1)*.61,angle=Math.PI/2+offset*.34,centre=surfaceAt(s,angle,safeLength,phase,amplitude,glide),left=surfaceAt(s,angle-.018,safeLength,phase,amplitude,glide),right=surfaceAt(s,angle+.018,safeLength,phase,amplitude,glide),height=safeLength*.006,base=safeLength*.003;
      centre.point.addScaledVector(centre.normal,height);left.point.addScaledVector(left.normal,base);right.point.addScaledVector(right.normal,base);
      position.setXYZ(i*3,left.point.x,left.point.y,left.point.z);position.setXYZ(i*3+1,centre.point.x,centre.point.y,centre.point.z);position.setXYZ(i*3+2,right.point.x,right.point.y,right.point.z);
    }
    position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
  });
  const updateGills=(phase:number,amplitude:number,glide:number)=>{
    let minDistance=Infinity,maxDistance=0;
    for(const trace of gillTraces){
      const position=trace.geometry.getAttribute('position') as THREE.BufferAttribute;
      for(let i=0;i<9;i++){
        const t=i/8,angle=THREE.MathUtils.lerp(trace.start,trace.end,t),width=.0015;
        for(const [slot,sectionS] of [[i*2,trace.s-width],[i*2+1,trace.s+width]] as const){
          const surface=surfaceAt(sectionS,angle,safeLength,phase,amplitude,glide),point=surface.point.addScaledVector(surface.normal,safeLength*.0015);
          position.setXYZ(slot,point.x,point.y,point.z);const distance=point.distanceTo(surfaceAt(sectionS,angle,safeLength,phase,amplitude,glide).point);minDistance=Math.min(minDistance,distance);maxDistance=Math.max(maxDistance,distance);
        }
      }
      position.needsUpdate=true;trace.geometry.computeVertexNormals();trace.geometry.computeBoundingSphere();
    }
    root.userData.gillSurfaceDistance={min:minDistance,max:maxDistance,samples:gillTraces.length*18};
  };
  return {root,update(pose){
    if(disposed)return;const phase=Number.isFinite(pose.phase)?pose.phase:0,amplitude=clamp(Number.isFinite(pose.amplitude)?pose.amplitude:1,0,2),glide=clamp(Number.isFinite(pose.glide)?pose.glide:0,0,1);
    dynamic.forEach(item=>deformBody(item,safeLength,phase,amplitude,glide));updateRidges(phase,amplitude,glide);updateGills(phase,amplitude,glide);
    anchors.forEach(({object,s,side})=>{const point=waveAt(s,safeLength,phase,amplitude,glide);object.position.x=point.x;object.rotation.y=point.rotation;if(side!==undefined)object.rotation.z=side*(.055+.025*Math.sin(phase*.5));});
    surfaceAnchors.forEach(({object,s,angle,offset})=>{const surface=surfaceAt(s,angle,safeLength,phase,amplitude,glide);object.position.copy(surface.point).addScaledVector(surface.normal,offset);object.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),surface.normal);object.rotateY(surface.rotation);});
    root.userData.pose={phase,amplitude,glide};root.updateMatrixWorld(true);
  },dispose(){if(disposed)return;disposed=true;disposeObject(root);}};
}
