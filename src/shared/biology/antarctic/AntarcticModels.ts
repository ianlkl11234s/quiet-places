import * as THREE from 'three';

const TAU=Math.PI*2;
const clamp=THREE.MathUtils.clamp;

export interface AntarcticCreature {
  root:THREE.Group;
  /** Conservative local-space sphere radius for the room behaviour's clearance checks. */
  safeRadius:number;
  update(time:number,speedBL:number,turn:number,light:number):void;
  dispose():void;
}

export const GLASS_SQUID_SAFE_RADIUS=1.70;
export const SILVERFISH_SAFE_RADIUS=.74;
/** [C] local rendering calibration, deliberately separate from room behaviour. */
export const ANTARCTIC_MODEL_CALIBRATION={squid:{mantleLength:1,armLength:.58,tentacleLength:.90,finHz:.42},fish:{bodyLength:1,waveHz:2.35,tailAmplitude:.052}} as const;

function random(seed:number){
  let state=(seed>>>0)||1;
  return ()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
}

function dispose(root:THREE.Object3D){
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    geometries.add(object.geometry);
    for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);
  });
  geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());
  root.removeFromParent();root.clear();
}

function ribbonGeometry(segments:number,width:number):THREE.BufferGeometry {
  const geometry=new THREE.BufferGeometry(),positions=new Float32Array((segments+1)*2*3),indices:number[]=[];
  for(let i=0;i<segments;i++){const a=i*2,b=a+1,c=a+2,d=a+3;indices.push(a,c,b,b,c,d);}
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);
  geometry.userData.width=width;
  return geometry;
}

function setRibbon(geometry:THREE.BufferGeometry,points:readonly THREE.Vector3[],widthAt:(s:number)=>number){
  const position=geometry.getAttribute('position') as THREE.BufferAttribute,side=new THREE.Vector3(),forward=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  for(let i=0;i<points.length;i++){
    const previous=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];forward.subVectors(next,previous).normalize();
    side.crossVectors(up,forward);if(side.lengthSq()<1e-7)side.set(1,0,0);else side.normalize();
    const width=widthAt(i/(points.length-1));
    position.setXYZ(i*2,points[i].x+side.x*width,points[i].y+side.y*width,points[i].z+side.z*width);
    position.setXYZ(i*2+1,points[i].x-side.x*width,points[i].y-side.y*width,points[i].z-side.z*width);
  }
  position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
}

function mantleGeometry(seed:number){
  const rings=18,sides=14,positions:number[]=[],indices:number[]=[];
  for(let i=0;i<=rings;i++){
    const s=i/rings,z=.46-s,profile=(.42+.95*Math.sqrt(s)*Math.pow(1-s,.65))*(1-s)**.16,radius=.115*profile;
    for(let j=0;j<sides;j++){const a=TAU*j/sides,asym=1+.009*Math.sin(2*a+seed*.17);positions.push(Math.cos(a)*radius*asym,Math.sin(a)*radius*.86*asym,z);}
  }
  for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=a+sides,d=i*sides+(j+1)%sides+sides;indices.push(a,c,b,b,c,d);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

/** Analytic, damped steady-state response to two slow drive terms.  It is the
 * closed-form second-order approximation used for tentacle inertia, so seeking
 * an elapsed time cannot depend on prior render frame partitioning. */
function dampedResponse(time:number,frequency:number,phase:number,damping:number){
  const omega=TAU*frequency,drive=omega*time+phase;
  const ratio=omega/2.2,gain=1/Math.hypot(1-ratio*ratio,2*damping*ratio);
  const lag=Math.atan2(2*damping*ratio,1-ratio*ratio);
  return gain*Math.sin(drive-lag);
}

function addFresnelAlpha(material:THREE.MeshPhysicalMaterial){
  material.userData.antarcticFresnel={power:4.2,strength:.10};
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nfloat antarcticFresnel=pow(1.0-clamp(abs(dot(normalize(normal),normalize(vViewPosition))),0.0,1.0),4.2);\ndiffuseColor.a=clamp(diffuseColor.a+.10*antarcticFresnel,0.0,.28);');
  };
  material.needsUpdate=true;
}

/** Original low-poly Galiteuthis proxy. Mantle length is 1; local +Z is forward. */
export function createGlassSquid(seed:number):AntarcticCreature {
  const root=new THREE.Group();root.name='antarctic-glass-squid';root.userData={mantleLength:1,forward:'+Z'};
  const individual=random(seed),phase=individual()*TAU,frequencyMultiplier=.88+individual()*.24;
  const mantleMaterial=new THREE.MeshPhysicalMaterial({color:'#c3d4d4',roughness:.31,metalness:0,transparent:true,opacity:.14,transmission:.72,ior:1.34,thickness:.012,side:THREE.DoubleSide,depthWrite:false,emissive:0x000000});
  addFresnelAlpha(mantleMaterial);
  const tissueMaterial=new THREE.MeshPhysicalMaterial({color:'#9ba6a0',roughness:.54,transparent:true,opacity:.26,depthWrite:false,emissive:0x000000});
  const finMaterial=new THREE.MeshPhysicalMaterial({color:'#d5e4e5',roughness:.29,transparent:true,opacity:.13,transmission:.48,side:THREE.DoubleSide,depthWrite:false,emissive:0x000000});
  const armMaterial=new THREE.MeshPhysicalMaterial({color:'#c2d3d1',roughness:.42,transparent:true,opacity:.16,transmission:.25,side:THREE.DoubleSide,depthWrite:false,emissive:0x000000});
  const eyeMaterial=new THREE.MeshStandardMaterial({color:'#172126',roughness:.33,metalness:.04,emissive:0x000000});
  const mantle=new THREE.Mesh(mantleGeometry(seed),mantleMaterial);mantle.name='glass-squid-mantle';root.add(mantle);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.105,12,8),tissueMaterial);head.name='glass-squid-head';head.scale.set(1,.8,1.15);head.position.z=.51;root.add(head);
  for(const sign of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.055,10,8),eyeMaterial);eye.name=sign<0?'glass-squid-eye-left':'glass-squid-eye-right';eye.scale.set(1,.82,.88);eye.position.set(sign*.076,.009,.553);root.add(eye);}
  const organ=new THREE.Mesh(new THREE.CapsuleGeometry(.027,.38,6,8),tissueMaterial);organ.name='glass-squid-visceral-core';organ.rotation.x=Math.PI/2;organ.position.z=.08;root.add(organ);
  const gladius=new THREE.Mesh(new THREE.CylinderGeometry(.006,.004,.76,6),tissueMaterial);gladius.name='glass-squid-gladius-line';gladius.rotation.x=Math.PI/2;gladius.position.z=.04;root.add(gladius);
  const fins:Array<{mesh:THREE.Mesh;material:THREE.MeshPhysicalMaterial;sign:number}>=[];
  for(const sign of [-1,1]){const geometry=ribbonGeometry(5,.12),material=finMaterial,mesh=new THREE.Mesh(geometry,material);mesh.name=sign<0?'glass-squid-fin-left':'glass-squid-fin-right';root.add(mesh);fins.push({mesh,material,sign});}
  const arms:Array<{points:THREE.Vector3[];root:THREE.Vector3;geometry:THREE.BufferGeometry;material:THREE.MeshPhysicalMaterial;phase:number;length:number;angle:number;long:boolean;arc:number}>=[];
  for(let i=0;i<10;i++){
    const long=i>=8,angle=TAU*(i/10)+phase*.12,rootPoint=new THREE.Vector3(Math.cos(angle)*.067,Math.sin(angle)*.052,.57),length=long?.98+(i-8)*.12:.58*(1+(i%3-1)*.10),count=long?9:6,points=Array.from({length:count},()=>new THREE.Vector3()),geometry=ribbonGeometry(count-1,.011),arc=.65+random(seed+i*101)()*.65;
    const mesh=new THREE.Mesh(geometry,armMaterial);mesh.name=long?`glass-squid-tentacle-${i-7}`:`glass-squid-arm-${i+1}`;root.add(mesh);arms.push({points,root:rootPoint,geometry,material:armMaterial,phase:phase+i*.71,length,angle,long,arc});
  }
  let disposed=false;
  const render=(time:number,speed:number,turn:number,light:number)=>{
    const micro=1+.004*Math.sin(TAU*.21*time+phase);mantle.scale.set(micro,micro,1);
    const visible=.28+.72*light;mantleMaterial.opacity=.14*visible;tissueMaterial.opacity=.26*visible;finMaterial.opacity=.13*visible;armMaterial.opacity=.16*visible;
    (organ.material as THREE.MeshPhysicalMaterial).opacity=.26*visible;(gladius.material as THREE.MeshPhysicalMaterial).opacity=.26*visible;
    const slow=ANTARCTIC_MODEL_CALIBRATION.squid.finHz*frequencyMultiplier;
    fins.forEach(({mesh,material,sign})=>{
      material.opacity=.13*visible;
      const geometry=mesh.geometry as THREE.BufferGeometry,position=geometry.getAttribute('position') as THREE.BufferAttribute;
      for(let i=0;i<=5;i++){const s=i/5,z=-.10-s*.23,w=.035+.095*Math.sin(Math.PI*s),wave=Math.sin(TAU*(slow*time-sign*.08)+s*TAU*.78+phase+sign*.17)*(.018+.027*s);position.setXYZ(i*2,sign*(.025+w),wave,z);position.setXYZ(i*2+1,sign*.025,wave*.45,z);}
      position.needsUpdate=true;geometry.computeVertexNormals();
    });
    arms.forEach(arm=>{
      arm.material.opacity=.16*visible;
      for(let i=0;i<arm.points.length;i++){
        const s=i/(arm.points.length-1),inertia=dampedResponse(time,.24,arm.phase,.82)*(.55+.3*speed),cross=dampedResponse(time,.37,arm.phase*1.73,.66)*(.65+.2*speed),radial=new THREE.Vector3(Math.cos(arm.angle),Math.sin(arm.angle)*.72,0);
        // Arms originate at the head and first extend in the swimming direction;
        // their distinct resting arcs and distal inward curl keep them from reading as rods.
        const spread=(arm.long?.105:.072)*Math.sin(Math.PI*s)*arm.arc-(arm.long?.052:.038)*s*s;
        arm.points[i].copy(arm.root).addScaledVector(radial,spread).add(new THREE.Vector3(.030*inertia*s*s+.018*turn*s*s,.017*cross*s*s-.055*s*s*s,arm.length*s-.14*(.25+speed)*s*s));
      }
      setRibbon(arm.geometry,arm.points,s=>{
        const club=arm.long?Math.exp(-(((s-.89)/.105)**2))*.008:0;
        return .0016+.0085*(1-s)*(arm.long?.72:1)+club;
      });
    });
  };
  return {root,safeRadius:GLASS_SQUID_SAFE_RADIUS,update(time,speedBL,turn,light){if(disposed)return;render(Math.max(0,Number.isFinite(time)?time:0),clamp(Number.isFinite(speedBL)?speedBL:0,0,2.5),clamp(Number.isFinite(turn)?turn:0,-1,1),clamp(Number.isFinite(light)?light:0,0,1));
  },dispose(){if(disposed)return;disposed=true;dispose(root);}};
}

function fishGeometry(){
  const rings=24,sides=10,positions=new Float32Array((rings+1)*sides*3),geometry=new THREE.BufferGeometry(),indices:number[]=[];
  for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=a+sides,d=i*sides+(j+1)%sides+sides;indices.push(a,c,b,b,c,d);}
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);return {geometry,rings,sides};
}

function finSurface(points:ReadonlyArray<readonly [number,number,number]>):THREE.BufferGeometry {
  const geometry=new THREE.BufferGeometry(),positions=new Float32Array(points.flat());
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();return geometry;
}

function tailGeometry(){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(4*3),3));geometry.setIndex([0,1,2,0,2,3]);return geometry;
}

/** Original Pleuragramma proxy. Body length is 1; local +Z is forward. */
export function createSilverfish(seed:number):AntarcticCreature {
  const root=new THREE.Group();root.name='antarctic-silverfish';root.userData={bodyLength:1,forward:'+Z'};
  const individual=random(seed),phase=individual()*TAU,frequencyMultiplier=.88+individual()*.24;
  const body=fishGeometry(),material=new THREE.MeshStandardMaterial({color:'#dde2e4',roughness:.42,metalness:.045,emissive:0x000000,envMapIntensity:.55,side:THREE.DoubleSide,vertexColors:true});
  const mesh=new THREE.Mesh(body.geometry,material);mesh.name='silverfish-continuous-body';root.add(mesh);
  const lightReveal={value:1};
  const eyeMaterial=new THREE.MeshStandardMaterial({color:'#172127',roughness:.28,metalness:.08,emissive:0x000000});
  const eyes:Array<{mesh:THREE.Mesh;sign:number}>=[];
  for(const sign of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.031,8,6),eyeMaterial);eye.name=sign<0?'silverfish-eye-left':'silverfish-eye-right';eye.scale.set(1,.86,.92);eye.position.set(sign*.059,.018,.33);root.add(eye);eyes.push({mesh:eye,sign});}
  const fins:Array<THREE.Mesh>=[];
  const finMaterial=new THREE.MeshStandardMaterial({color:'#9eafb3',roughness:.53,metalness:.02,transparent:true,opacity:.78,side:THREE.DoubleSide,emissive:0x000000});
  for(const [name,points] of [
    ['silverfish-dorsal-fin',[[0,.060,.12],[0,.165,-.045],[0,.055,-.23],[0,.055,-.09]]],
    ['silverfish-anal-fin',[[0,-.055,.05],[0,-.135,-.13],[0,-.052,-.28],[0,-.052,-.11]]],
    ['silverfish-pectoral-left',[[-.060,-.005,.26],[-.070,-.004,.08],[-.195,-.035,.10],[-.075,-.015,.30]]],
    ['silverfish-pectoral-right',[[.060,-.005,.26],[.070,-.004,.08],[.195,-.035,.10],[.075,-.015,.30]]],
  ] as const){const fin=new THREE.Mesh(finSurface(points),finMaterial);fin.name=name;root.add(fin);fins.push(fin);}
  const tail=new THREE.Mesh(tailGeometry(),finMaterial);tail.name='silverfish-caudal-fin';root.add(tail);
  // Artistic side-shadow visibility modulates reflected radiance, never emission
  // or a timed opacity pulse. Window direction/specular still come from PBR.
  for(const surface of [material,eyeMaterial,finMaterial]){
    surface.onBeforeCompile=shader=>{shader.uniforms.uAntarcticReveal=lightReveal;shader.fragmentShader='uniform float uAntarcticReveal;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight *= uAntarcticReveal;\n#include <opaque_fragment>');};
  }
  let disposed=false;
  const render=(time:number,speed:number,turn:number,light:number)=>{
    lightReveal.value=Math.pow(clamp(light,0,1),1.3);
    const frequency=ANTARCTIC_MODEL_CALIBRATION.fish.waveHz*frequencyMultiplier,amplitude=.48+.52*clamp(speed,0,1.7),position=body.geometry.getAttribute('position') as THREE.BufferAttribute;
    let colors=body.geometry.getAttribute('color') as THREE.BufferAttribute|undefined;
    if(!colors){colors=new THREE.BufferAttribute(new Float32Array(position.count*3),3);body.geometry.setAttribute('color',colors);}
    for(let ring=0;ring<=body.rings;ring++){
      const s=ring/body.rings,z=.48-s*.96,depth=.105*Math.pow(Math.sin(Math.PI*s),.68)*(1-.16*s)*(1-.58*THREE.MathUtils.smoothstep(.73,1,s))+.028*s**7;
      const wave=(.006+.052*s**1.62)*amplitude*Math.sin(TAU*frequency*time-TAU*.92*s+phase)+turn*.045*s**1.7;
      for(let side=0;side<body.sides;side++){const a=TAU*side/body.sides,vertical=depth*Math.sin(a),lateral=depth*.58*Math.cos(a)+wave,index=ring*body.sides+side;
        position.setXYZ(index,lateral,vertical,z);
        // Dorsal darkens, belly brightens; the restrained lateral modulation is
        // a scale/roughness proxy rather than separate scale geometry.
        const belly=clamp((1-Math.sin(a))*.5,0,1),stripe=.92+.08*Math.cos(TAU*(s*4+a*.12));
        colors.setXYZ(index,(.45+.28*belly)*stripe,(.51+.27*belly)*stripe,(.53+.28*belly)*stripe);
      }
    }
    position.needsUpdate=true;colors.needsUpdate=true;body.geometry.computeVertexNormals();body.geometry.computeBoundingSphere();
    const headS=.156,headWave=(.006+.052*headS**1.62)*amplitude*Math.sin(TAU*frequency*time-TAU*.92*headS+phase)+turn*.045*headS**1.7;
    eyes.forEach(({mesh:eye,sign})=>eye.position.set(sign*.059+headWave,.018,.33));
    const tailPosition=tail.geometry.getAttribute('position') as THREE.BufferAttribute;
    const tailWave=(s:number)=>(.006+.052*s**1.62)*amplitude*Math.sin(TAU*frequency*time-TAU*.92*s+phase)+turn*.045*s**1.7;
    const rootX=tailWave(1),tipX=tailWave(1.14),zRoot=-.48,zTip=-.665,zNotch=-.595;
    tailPosition.setXYZ(0,rootX,0,zRoot);tailPosition.setXYZ(1,tipX,.15,zTip);tailPosition.setXYZ(2,tipX,0,zNotch);tailPosition.setXYZ(3,tipX,-.15,zTip);tailPosition.needsUpdate=true;tail.geometry.computeVertexNormals();tail.geometry.computeBoundingSphere();
    fins.forEach((fin,index)=>{const p=.20*Math.sin(TAU*(frequency*.47)*time+phase+index*1.7);if(index>=2)fin.rotation.z=(index===2?1:-1)*(.28+p*.35);});
    material.envMapIntensity=.12+.60*light;finMaterial.opacity=.28+.5*light;
  };
  return {root,safeRadius:SILVERFISH_SAFE_RADIUS,update(time,speedBL,turn,light){if(disposed)return;render(Math.max(0,Number.isFinite(time)?time:0),clamp(Number.isFinite(speedBL)?speedBL:0,0,2.5),clamp(Number.isFinite(turn)?turn:0,-1,1),clamp(Number.isFinite(light)?light:0,0,1));},dispose(){if(disposed)return;disposed=true;dispose(root);}};
}
