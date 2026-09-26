import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {readFileSync} from 'node:fs';
import {createShark} from '../src/places/stairlight/Shark.ts';
import {collectModelResources} from '../src/shared/resources/ModelResources.ts';
async function load(){const bytes=readFileSync('public/models/blacktip-shark.glb');return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;}

test('shipped shark body actually uses the spine and deforms more at the tail',async()=>{
 const model=await load(),bodies:THREE.SkinnedMesh[]=[];
 model.traverse(o=>{if(o instanceof THREE.SkinnedMesh&&o.name.startsWith('BLACKTIP_BODY'))bodies.push(o);});
 assert.equal(bodies.length,2);
 const joints=new Set<string>();
 for(const body of bodies){
  const weights=body.geometry.getAttribute('skinWeight'),indices=body.geometry.getAttribute('skinIndex');
  for(let i=0;i<weights.count;i++){
   let sum=0;for(let j=0;j<4;j++){const w=weights.getComponent(i,j);sum+=w;if(w>.001)joints.add(body.skeleton.bones[indices.getComponent(i,j)].name);}
   assert.ok(Math.abs(sum-1)<1e-5);
  }
 }
 assert.ok([...joints].filter(n=>n.startsWith('Spine_')).length>=12,'body must not silently bind to Root');
 const shark=createShark(model,true),mesh=bodies[0];
 const candidates=[.41,-.33].map(x=>{let selected=0,d=Infinity;for(let i=0;i<mesh.geometry.attributes.position.count;i++){const p=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);const distance=Math.abs(p.x-x)+Math.abs(p.y)*.1;if(distance<d){d=distance;selected=i;}}return selected;});
 const ranges=candidates.map(()=>({min:Infinity,max:-Infinity}));
 for(let t=0;t<4;t+=.025){
  shark.update(t,.9);mesh.skeleton.update();
  const inverse=shark.root.matrixWorld.clone().invert();
  candidates.forEach((i,n)=>{const p=mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);ranges[n].min=Math.min(ranges[n].min,p.z);ranges[n].max=Math.max(ranges[n].max,p.z);});
 }
 const head=ranges[0].max-ranges[0].min,tail=ranges[1].max-ranges[1].min;
 assert.ok(tail>.05&&head<tail*.3,`head=${head}, tail=${tail}`);
 shark.update(17,.9);mesh.skeleton.update();const before=mesh.getVertexPosition(candidates[1],new THREE.Vector3());
 shark.update(42,.9);shark.update(17,.9);mesh.skeleton.update();
 assert.ok(before.distanceTo(mesh.getVertexPosition(candidates[1],new THREE.Vector3()))<1e-7,'seeking must not accumulate deformation');
 const resources=collectModelResources(model),counts:number[]=[];
 resources.materials.add(mesh.customDepthMaterial!);
 for(const set of Object.values(resources))for(const resource of set){const n=counts.length;counts.push(0);const dispose=resource.dispose.bind(resource);resource.dispose=()=>{counts[n]++;dispose();};}
 shark.dispose();shark.dispose();assert.ok(counts.every(n=>n===1),'every owned resource releases exactly once');
 console.log(`Shark head excursion ${head.toFixed(4)}m, rear body ${tail.toFixed(4)}m`);
});

test('pectoral bone angle realises the requested fin incidence on the shipped skin (Q2 A1-5)',async()=>{
 const {pectoralBoneAngle}=await import('../src/places/stairlight/Shark.ts');
 const {sampleSharkMotion}=await import('../src/places/stairlight/SharkMotion.ts');
 for(const w of [.153,.5,1])for(const a of [-.1,.02,.08]){
  const t=pectoralBoneAngle(a,w),eff=Math.atan2(w*Math.sin(t),1-w+w*Math.cos(t));
  assert.ok(Math.abs(eff-a)<1e-4,`w=${w} a=${a}`);
 }
 const model=await load(),shark=createShark(model,true);
 const fin=model.getObjectByName('PECTORAL_L') as THREE.SkinnedMesh;
 assert.ok(fin instanceof THREE.SkinnedMesh);
 const n=fin.geometry.attributes.position.count;
 const incidence=()=>{fin.skeleton.update();const inv=shark.root.matrixWorld.clone().invert();
  const pts=Array.from({length:n},(_,i)=>fin.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(fin.matrixWorld).applyMatrix4(inv));
  const front=pts.reduce((a,b)=>b.x>a.x?b:a),back=pts.reduce((a,b)=>b.x<a.x?b:a);
  return Math.atan2(front.y-back.y,front.x-back.x);};
 const xs:number[]=[],ys:number[]=[];
 for(let t=0;t<120;t+=.5){shark.update(t,.9);xs.push(sampleSharkMotion(t).pectoralAttack.left);ys.push(incidence());}
 const mx=xs.reduce((a,b)=>a+b)/xs.length,my=ys.reduce((a,b)=>a+b)/ys.length;
 let sxy=0,sxx=0;xs.forEach((x,i)=>{sxy+=(x-mx)*(ys[i]-my);sxx+=(x-mx)**2;});
 const slope=sxy/sxx;
 // Leading/trailing vertices also ride the body wave, so allow a loose band.
 assert.ok(slope>.6&&slope<1.4,`measured fin chord follows requested incidence, slope ${slope.toFixed(3)}`);
 console.log(`Pectoral_L chord incidence vs requested slope ${slope.toFixed(3)} over 120 s`);
 shark.dispose();
});
