import * as THREE from 'three';
import {addBendAttribute,animatedStandard,setInstanceBend} from '../chromis/index.ts';
import {FISH_FIN_MEMBRANE,installFishSurface,type FishBodySurface} from '../../shared/biology/fish-surface/index.ts';

/**
 * Pacific/Japanese sardine (Sardinops sagax; Japanese form "melanostictus").
 * Identification cues from FishBase (see docs/biology/sardine.md): elongated,
 * near-cylindrical body; blue-green back; white/silver flanks with 1–3 rows of
 * dark spots along the middle; rounded belly. Proportions and colours below are
 * art-directed from those cues, not measurements. Local frame matches chromis/
 * fusilier: head at z=-.5, tail toward +z, unit length scaled per instance.
 */
export const SARDINE_BODY_SURFACE:FishBodySurface={role:'body',countershade:.16,sheen:.55,sheenTint:new THREE.Color(.90,.97,1)};

export interface SardineVisuals {root:THREE.Group;update(elapsed:number):void;dispose():void;}

export function createSardineVisuals(count:number,phases:Float32Array,lengths:Float32Array):SardineVisuals{
 const root=new THREE.Group();root.name='SARDINOPS_INSTANCED';
 // Guanine-silvered flanks read as a mirror-like sheen: partly metallic so a sky
 // environment (set by the scene) is reflected; stays dark with no environment.
 const bodyMaterial=animatedStandard('#ffffff','sardine-body');bodyMaterial.roughness=.32;bodyMaterial.metalness=.55;
 const body=new THREE.InstancedMesh(sardineBody(),bodyMaterial,count);body.name='SARDINE_BODY';
 const fins=new THREE.InstancedMesh(sardineFins(),animatedStandard('#ffffff','sardine-fins',true),count);fins.name='SARDINE_FINS_AND_FORK';
 const spots=new THREE.InstancedMesh(sardineSpots(),animatedStandard('#1c262b','sardine-spots'),count);spots.name='SARDINE_FLANK_SPOTS';
 const eyes=new THREE.InstancedMesh(pairedEyes(),new THREE.MeshStandardMaterial({color:'#101618',roughness:.3}),count);eyes.name='SARDINE_EYES';
 installFishSurface(body.material,SARDINE_BODY_SURFACE);installFishSurface(fins.material,FISH_FIN_MEMBRANE);
 root.add(body,fins,spots,eyes);
 for(const mesh of [body,fins,spots,eyes]){
  mesh.geometry.setAttribute('aPhase',new THREE.InstancedBufferAttribute(phases,1));
  mesh.geometry.setAttribute('aLength',new THREE.InstancedBufferAttribute(lengths,1));
  mesh.geometry.setAttribute('aTailAmplitude',new THREE.InstancedBufferAttribute(new Float32Array(count).fill(.03),1));
  addBendAttribute(mesh.geometry,count);
  if(!mesh.geometry.getAttribute('aFlutter'))mesh.geometry.setAttribute('aFlutter',new THREE.BufferAttribute(new Float32Array(mesh.geometry.getAttribute('position').count),1));
  // No casting: the fish are frustum-uncullable instances and the shelter lamp's cube shadow would redraw them six times.
  mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;
 }
 const m=new THREE.Matrix4();for(let i=0;i<count;i++){m.makeScale(lengths[i],lengths[i],lengths[i]);for(const mesh of [body,fins,spots,eyes])mesh.setMatrixAt(i,m);}
 return {root,update(){},dispose(){for(const mesh of [body,fins,spots,eyes]){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}root.clear();}};
}
/** Scene-provided sky reflection for the silver body (e.g. a PMREM of the sky dome). */
export function setSardineEnvironment(v:SardineVisuals,texture:THREE.Texture|null,intensity:number){
 const body=v.root.getObjectByName('SARDINE_BODY') as THREE.InstancedMesh|undefined;if(!body)return;
 const m=body.material as THREE.MeshStandardMaterial;if(m.envMap!==texture){m.envMap=texture;m.needsUpdate=true;}m.envMapIntensity=intensity;
}
export function setSardineMatrix(v:SardineVisuals,i:number,m:THREE.Matrix4){for(const c of v.root.children)if(c instanceof THREE.InstancedMesh)c.setMatrixAt(i,m);}
export function commitSardineMatrices(v:SardineVisuals){for(const c of v.root.children)if(c instanceof THREE.InstancedMesh)c.instanceMatrix.needsUpdate=true;}
/** Tail amplitude grows with speed (body lengths/s); bend is the shared-locomotion C-bend. */
export function setSardineMotion(v:SardineVisuals,i:number,phase:number,speedBL:number,bend=0){
 for(const c of v.root.children)if(c instanceof THREE.InstancedMesh){
  const p=c.geometry.getAttribute('aPhase') as THREE.InstancedBufferAttribute,a=c.geometry.getAttribute('aTailAmplitude') as THREE.InstancedBufferAttribute;
  p.setX(i,phase);a.setX(i,Math.min(.07,.012+Math.max(0,speedBL)*.012));p.needsUpdate=true;a.needsUpdate=true;setInstanceBend(c,i,bend);
 }
}

/** Near-cylindrical spindle (FishBase: "elongated cylindrical"): depth ~.18, width ~.145 of length,
 * so a turning fish does not read as a flat plate. Blue-green back to silver-white belly. */
function sardineBody(){
 const rings=14,segments=12,width=.145,height=.18,positions:number[]=[],colors:number[]=[],indices:number[]=[];
 const back=new THREE.Color('#2c5a66'),flank=new THREE.Color('#b9c4c8'),belly=new THREE.Color('#e9eeee');
 for(let i=0;i<=rings;i++){
  const s=i/rings,z=-.5+s*.88,profile=Math.pow(Math.sin(Math.PI*Math.min(1,s*.97+.02)),.55)*(s>.8?Math.max(.08,(1-s)/.2):1);
  for(let j=0;j<segments;j++){
   const a=j*Math.PI*2/segments,y=Math.sin(a)*height*.5*profile;
   positions.push(Math.cos(a)*width*.5*profile,y,z);
   const up=THREE.MathUtils.clamp(y/(height*.5*Math.max(profile,.05)),-1,1);
   const c=up>.15?flank.clone().lerp(back,THREE.MathUtils.smoothstep(up,.15,.7)):flank.clone().lerp(belly,THREE.MathUtils.smoothstep(-up,.0,.6));
   colors.push(c.r,c.g,c.b);
  }
 }
 for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){const a=i*segments+j,b=i*segments+(j+1)%segments,c=(i+1)*segments+(j+1)%segments,d=(i+1)*segments+j;indices.push(a,b,d,b,c,d);}
 const head=positions.length/3;positions.push(0,-.01,-.52);colors.push(back.r,back.g,back.b);
 const tail=positions.length/3;positions.push(0,0,.39);colors.push(.5,.56,.58);
 for(let j=0;j<segments;j++){indices.push(head,j,(j+1)%segments);const base=rings*segments;indices.push(tail,base+(j+1)%segments,base+j);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
/** Deeply forked caudal fin, small mid-back dorsal, pectorals low behind the head. */
function sardineFins(){
 const p=[
  // pectorals (flutter at low speed)
  -.05,-.04,-.28,-.12,-.07,-.18,-.10,-.06,-.12, .05,-.04,-.28,.12,-.07,-.18,.10,-.06,-.12,
  // dorsal
  0,.09,-.08,0,.17,-.02,0,.085,.06,
  // caudal fork: two lobes around a notch
  0,.01,.35,0,.12,.53,0,.02,.44, 0,-.01,.35,0,-.12,.53,0,-.02,.44,
 ];
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 const colors=new Float32Array(p.length),c=new THREE.Color('#8e9ca1');for(let k=0;k<p.length/3;k++)colors.set([c.r,c.g,c.b],k*3);
 g.setAttribute('color',new THREE.BufferAttribute(colors,3));
 g.setAttribute('aFlutter',new THREE.BufferAttribute(new Float32Array([0,1,1,0,1,1,0,0,0,0,0,0,0,0,0]),1));
 g.setIndex([0,1,2,3,5,4,6,7,8,9,10,11,12,14,13]);g.computeVertexNormals();return g;
}
/** One row of seven dark spots on each flank, just above the midline (the "melanostictus" row). */
function sardineSpots(){
 const p:number[]=[],idx:number[]=[],r=.011;
 for(const side of [-1,1])for(let k=0;k<7;k++){
  const s=.2+k*.065,z=-.5+s*.88,prof=Math.pow(Math.sin(Math.PI*s),.55),x=side*(.145*.5*prof*.93+.002),y=.012;
  const o=p.length/3;p.push(x,y-r,z-r,x,y+r,z-r,x,y+r,z+r,x,y-r,z+r);
  if(side>0)idx.push(o,o+1,o+2,o,o+2,o+3);else idx.push(o,o+2,o+1,o,o+3,o+2);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 const colors=new Float32Array(p.length).fill(1);g.setAttribute('color',new THREE.BufferAttribute(colors,3));
 g.setIndex(idx);g.computeVertexNormals();return g;
}
function pairedEyes(){
 const s=new THREE.SphereGeometry(.014,6,4),pos=s.getAttribute('position') as THREE.BufferAttribute,a:number[]=[],i:number[]=[];
 for(const sign of [-1,1]){const o=a.length/3;for(let k=0;k<pos.count;k++)a.push(pos.getX(k)+sign*.046,pos.getY(k)+.012,pos.getZ(k)-.41);for(const index of s.index!.array)i.push(Number(index)+o);}
 s.dispose();const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));g.setIndex(i);g.computeVertexNormals();return g;
}
