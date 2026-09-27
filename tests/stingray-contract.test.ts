import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';

// Q3 B2: the remodelled stingray must keep the GLB contract that both consumers
// rely on (oceanlight A5 resets fins to clip pose; seaward advances the clip by
// distance). The fixture was extracted from the pre-B2 GLB (sha256 e5909d09…).
// STINGRAY_GLB tests a Blender candidate before it replaces the shipped model.
// STINGRAY_CONTRACT_WRITE=1 rewrites the fixture from STINGRAY_GLB (baseline only).
const GLB=process.env.STINGRAY_GLB??'public/models/stingray.glb';
const FIXTURE=new URL('./fixtures/stingray-contract.json',import.meta.url);

type Json=Record<string,any>;
function parse(path:string){
  const b=readFileSync(path),jsonLength=b.readUInt32LE(12);
  const json:Json=JSON.parse(b.subarray(20,20+jsonLength).toString('utf8'));
  const binStart=20+jsonLength+8,bin=b.subarray(binStart);
  const floats=(accessorIndex:number)=>{
    const a=json.accessors[accessorIndex],view=json.bufferViews[a.bufferView];
    assert.equal(a.componentType,5126,'animation data stays float');
    const size={SCALAR:1,VEC3:3,VEC4:4}[a.type as 'SCALAR'|'VEC3'|'VEC4'];
    const offset=(view.byteOffset??0)+(a.byteOffset??0);
    return new Float32Array(bin.buffer.slice(bin.byteOffset+offset,bin.byteOffset+offset+a.count*size*4));
  };
  return {json,floats};
}

/** Everything the consumers can observe apart from mesh surface detail. */
function extract(path:string){
  const {json,floats}=parse(path);
  const parent=new Map<number,number>();
  json.nodes.forEach((n:Json,i:number)=>(n.children??[]).forEach((c:number)=>parent.set(c,i)));
  const name=(i:number)=>json.nodes[i].name;
  const round=(v:number[]|undefined)=>v?.map(x=>Number(x.toFixed(6)));
  const nodes=json.nodes.map((n:Json,i:number)=>({name:n.name,parent:parent.has(i)?name(parent.get(i)!):null,
    children:(n.children??[]).map(name),mesh:n.mesh!==undefined,skin:n.skin!==undefined,
    translation:round(n.translation),rotation:round(n.rotation),scale:round(n.scale)}));
  const skins=json.skins.map((s:Json)=>({joints:s.joints.map(name),skeleton:s.skeleton===undefined?null:name(s.skeleton),
    inverseBind:Array.from(floats(s.inverseBindMatrices)).map(x=>Number(x.toFixed(5)))}));
  const animations=json.animations.map((a:Json)=>{
    let duration=0;
    const channels=a.channels.map((c:Json)=>{
      const s=a.samplers[c.sampler],input=floats(s.input),output=floats(s.output);
      duration=Math.max(duration,input[input.length-1]);
      let sum=0,abs=0,sq=0;for(const v of output){sum+=v;abs+=Math.abs(v);sq+=v*v;}
      return {target:name(c.target.node),path:c.target.path,interpolation:s.interpolation??'LINEAR',keys:input.length,
        sum:Number(sum.toFixed(4)),abs:Number(abs.toFixed(4)),sq:Number(sq.toFixed(4)),
        first:Array.from(output.slice(0,output.length/input.length)).map(x=>Number(x.toFixed(5)))};
    });
    return {name:a.name,duration:Number(duration.toFixed(5)),channels};
  });
  return {scene:json.scenes[json.scene??0].nodes.map(name),extensionsUsed:json.extensionsUsed??[],nodes,skins,animations};
}

if(process.env.STINGRAY_CONTRACT_WRITE==='1'){
  writeFileSync(FIXTURE,JSON.stringify(extract(GLB)));
  console.log('wrote',FIXTURE.pathname);
}

const close=(a:number[]|undefined,b:number[]|undefined,tol:number,label:string)=>{
  assert.equal(a?.length,b?.length,label);
  a?.forEach((x,i)=>assert.ok(Math.abs(x-b![i])<=tol,`${label}[${i}] ${x} vs ${b![i]}`));
};

test('stingray GLB keeps the rig, node and clip contract of the pre-B2 asset',()=>{
  const want=JSON.parse(readFileSync(FIXTURE,'utf8')),got=extract(GLB);
  assert.deepEqual(got.scene,want.scene,'scene root (SRAY_ROOT__Three_Z_Forward)');
  assert.deepEqual(got.extensionsUsed,want.extensionsUsed,'no new glTF extensions (e.g. specular/transmission would switch three to MeshPhysicalMaterial)');
  // Node names, order, hierarchy and rest transforms (forward axis and scale live on the root/rig nodes).
  assert.deepEqual(got.nodes.map((n:Json)=>n.name),want.nodes.map((n:Json)=>n.name),'node names and order');
  got.nodes.forEach((n:Json,i:number)=>{
    const w=want.nodes[i];
    assert.equal(n.parent,w.parent,`${n.name} parent`);assert.deepEqual(n.children,w.children,`${n.name} children`);
    assert.equal(n.mesh,w.mesh,`${n.name} mesh`);assert.equal(n.skin,w.skin,`${n.name} skin`);
    for(const key of ['translation','rotation','scale'] as const)close(n[key],w[key],2e-5,`${n.name}.${key}`);
  });
  assert.equal(got.skins.length,want.skins.length);
  got.skins.forEach((s:Json,i:number)=>{
    assert.deepEqual(s.joints,want.skins[i].joints,'joint names and order');
    assert.equal(s.joints.length,72);assert.equal(s.skeleton,want.skins[i].skeleton);
    close(s.inverseBind,want.skins[i].inverseBind,2e-4,'inverse bind matrices');
  });
  assert.deepEqual(got.animations.map((a:Json)=>a.name),want.animations.map((a:Json)=>a.name),'clip names');
  got.animations.forEach((a:Json,i:number)=>{
    const w=want.animations[i];
    assert.ok(Math.abs(a.duration-w.duration)<1e-5,`${a.name} duration`);
    assert.equal(a.channels.length,w.channels.length,`${a.name} channels`);
    a.channels.forEach((c:Json,j:number)=>{
      const d=w.channels[j],label=`${a.name} ${c.target}.${c.path}`;
      assert.equal(c.target,d.target,label);assert.equal(c.path,d.path,label);
      assert.equal(c.interpolation,d.interpolation,label);assert.equal(c.keys,d.keys,label);
      for(const key of ['sum','abs','sq'] as const)assert.ok(Math.abs(c[key]-d[key])<=2e-3+1e-5*Math.abs(d[key]),`${label} ${key} ${c[key]} vs ${d[key]}`);
      close(c.first,d.first,2e-5,`${label} first key`);
    });
  });
});

test('stingray GLB keeps disc scale and the multi-primitive SRAY_Disc body',()=>{
  const {json,floats}=parse(GLB);
  const disc=json.nodes.find((n:Json)=>n.name==='SRAY_Disc');
  assert.ok(disc&&disc.mesh!==undefined);
  // stingrays.test.ts finds the body as a SkinnedMesh whose parent is SRAY_Disc,
  // which three only creates for a multi-primitive mesh.
  assert.ok(json.meshes[disc.mesh].primitives.length>=2);
  let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const p of json.meshes[disc.mesh].primitives){
    const a=json.accessors[p.attributes.POSITION];
    min=min.map((v,i)=>Math.min(v,a.min[i]));max=max.map((v,i)=>Math.max(v,a.max[i]));
  }
  void floats;
  // Blender +Y nose / +Z dorsal is exported Y-up: glTF x = span, -z = nose (before the root's 180° turn).
  const span=max[0]-min[0],length=max[2]-min[2];
  assert.ok(Math.abs(span/1.34-1)<.02,`disc span ${span}`);
  // Length includes the pelvic lobes behind the disc; the disc itself is 1.117 m.
  assert.ok(length>1.117*.98&&length<1.117*1.12,`disc length ${length}`);
});
