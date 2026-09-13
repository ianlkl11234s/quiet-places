import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {GLASS_SQUID_SAFE_RADIUS,SILVERFISH_SAFE_RADIUS,createGlassSquid,createSilverfish,type AntarcticCreature} from '../src/shared/biology/antarctic/AntarcticModels.ts';

function meshes(creature:AntarcticCreature){const out:THREE.Mesh[]=[];creature.root.traverse(object=>{if(object instanceof THREE.Mesh)out.push(object);});return out;}
function geometrySnapshot(creature:AntarcticCreature){return meshes(creature).map(mesh=>[mesh.name,Array.from((mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array)] as const);}
function assertFiniteUnitNormals(creature:AntarcticCreature){for(const mesh of meshes(creature)){const normal=mesh.geometry.getAttribute('normal') as THREE.BufferAttribute|undefined;assert.ok(normal&&normal.count>0,`${mesh.name} has normals`);for(let i=0;i<normal.count;i++){const length=Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i));assert.ok(Number.isFinite(length),`${mesh.name} normal ${i} finite`);assert.ok(Math.abs(length-1)<1e-4,`${mesh.name} normal ${i} normalized: ${length}`);}}}
function assertNonEmissive(creature:AntarcticCreature){for(const mesh of meshes(creature))for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(material instanceof THREE.MeshStandardMaterial)assert.equal(material.emissive.getHex(),0,`${mesh.name} has no emission`);}
function maximumRootDistance(creature:AntarcticCreature){
 creature.root.updateMatrixWorld(true);let maximum=0;
 for(const mesh of meshes(creature)){const position=mesh.geometry.getAttribute('position') as THREE.BufferAttribute;for(let i=0;i<position.count;i++)maximum=Math.max(maximum,new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld).length());}
 return maximum;
}

test('Antarctic procedural creatures have stable deformation, finite unit normals, and nonemissive materials',()=>{
 const squid=createGlassSquid(17),fish=createSilverfish(29);
 for(const creature of [squid,fish]){creature.update(3.25,.72,-.18,.64);assertFiniteUnitNormals(creature);assertNonEmissive(creature);}
 const fishBody=fish.root.getObjectByName('silverfish-continuous-body') as THREE.Mesh,colors=fishBody.geometry.getAttribute('color') as THREE.BufferAttribute;
 assert.ok(colors&&colors.count===fishBody.geometry.getAttribute('position').count,'silverfish carries dorsal-to-ventral vertex colour variation');
 assert.notEqual(colors.getX(0),colors.getX(Math.floor(colors.count*.5)),'silverfish surface is not uniform grey');
 squid.dispose();fish.dispose();
});

test('same elapsed and rewind are deterministic, including flexible squid arms',()=>{
 const squid=createGlassSquid(71),fish=createSilverfish(71);
 for(const creature of [squid,fish]){
  creature.update(4.5,.85,.22,.55);const expected=geometrySnapshot(creature);
  creature.update(4.5,.85,.22,.55);assert.deepEqual(geometrySnapshot(creature),expected,'pause does not drift');
  creature.update(.75,.85,.22,.55);creature.update(4.5,.85,.22,.55);assert.deepEqual(geometrySnapshot(creature),expected,'seek rebuilds the same pose');
 }
 squid.dispose();fish.dispose();
});

test('local +Z puts squid head and arms forward, fins aft, and the fish tail behind its body',()=>{
 const squid=createGlassSquid(3),fish=createSilverfish(4);squid.update(1,.4,0,1);fish.update(1,.4,0,1);
 const mantle=squid.root.getObjectByName('glass-squid-mantle') as THREE.Mesh,head=squid.root.getObjectByName('glass-squid-head')!,arms=meshes(squid).filter(mesh=>mesh.name.startsWith('glass-squid-arm')||mesh.name.startsWith('glass-squid-tentacle')),fins=meshes(squid).filter(mesh=>mesh.name.startsWith('glass-squid-fin'));
 mantle.geometry.computeBoundingBox();assert.ok(head.position.z>(mantle.geometry.boundingBox!.max.z),'squid head is anterior (+Z)');
 assert.ok(Math.max(...arms.flatMap(arm=>Array.from((arm.geometry.getAttribute('position') as THREE.BufferAttribute).array).filter((_value,index)=>index%3===2)))>head.position.z,'arms first extend forward of head');
 assert.ok(Math.max(...fins.flatMap(fin=>Array.from((fin.geometry.getAttribute('position') as THREE.BufferAttribute).array).filter((_value,index)=>index%3===2)))<0,'posterior fins remain aft');
 const body=fish.root.getObjectByName('silverfish-continuous-body') as THREE.Mesh,tail=fish.root.getObjectByName('silverfish-caudal-fin') as THREE.Mesh;body.geometry.computeBoundingBox();tail.geometry.computeBoundingBox();assert.ok(tail.geometry.boundingBox!.max.z<body.geometry.boundingBox!.min.z+.02,'forked caudal fin lies behind the tail peduncle');
 squid.dispose();fish.dispose();
});

test('safe radii conservatively bound every local vertex across motion and owned resources dispose once',()=>{
 for(const [creature,radius] of [[createGlassSquid(12),GLASS_SQUID_SAFE_RADIUS],[createSilverfish(13),SILVERFISH_SAFE_RADIUS]] as const){
  let maximum=0;for(const [time,speed,turn] of [[0,0,0],[1.2,.3,.2],[6.4,1.2,-.5],[31,2.2,1]] as const){creature.update(time,speed,turn,.3);maximum=Math.max(maximum,maximumRootDistance(creature));}assert.ok(radius>=maximum,`${creature.root.name}: ${radius} covers root vertex distance ${maximum}`);assert.equal(creature.safeRadius,radius);
  const resources=new Set<THREE.BufferGeometry|THREE.Material>();for(const mesh of meshes(creature)){resources.add(mesh.geometry);for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])resources.add(material);}
  let releases=0;for(const resource of resources){const release=resource.dispose.bind(resource);resource.dispose=()=>{releases++;release();};}
  creature.dispose();creature.dispose();assert.equal(releases,resources.size,'all owned resources release exactly once');
 }
});
