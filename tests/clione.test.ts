import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createClione,sampleClioneWingForces} from '../src/shared/biology/clione/index.ts';

function vertices(mesh:THREE.Mesh){return (mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;}
test('Clione preserves the centimetre morphology, named multi-control rig, and finite stable topology',()=>{
 const clione=createClione({length:.036,frequency:1.35,phase:.2,seed:17});const names=['CLIONE_ROOT','CLIONE_BODY','CLIONE_HEAD','CLIONE_TAIL','L_WING_ROOT','L_WING_MID','L_WING_TIP','L_WING_LEAD','L_WING_TRAIL','R_WING_ROOT','R_WING_MID','R_WING_TIP','R_WING_LEAD','R_WING_TRAIL'];
 for(const name of names)assert.ok(clione.group.getObjectByName(name),name);assert.equal(clione.group.position.length(),0);
 const body=clione.group.getObjectByName('CLIONE_TRANSPARENT_BODY') as THREE.Mesh,box=new THREE.Box3().setFromObject(body);assert.ok(box.max.z-box.min.z>.034&&box.max.z-box.min.z<.038);assert.ok(clione.group.getObjectByName('CLIONE_VISCERAL_MASS'));assert.equal((body.material as THREE.MeshPhysicalMaterial).emissive.getHex(),0);
 const count=body.geometry.getAttribute('position').count,left=clione.group.getObjectByName('L_WING_SURFACE') as THREE.Mesh,right=clione.group.getObjectByName('R_WING_SURFACE') as THREE.Mesh,wingCount=left.geometry.getAttribute('position').count;for(let time=0;time<8;time+=.037){clione.update(time,{gait:'slowhover'});assert.equal(body.geometry.getAttribute('position').count,count);assert.equal(left.geometry.getAttribute('position').count,wingCount);assert.equal(right.geometry.getAttribute('position').count,wingCount);assert.ok([...vertices(left),...vertices(right)].every(Number.isFinite));assert.ok(clione.diagnostics().finite);}
 clione.dispose();clione.dispose();
});
test('slow gait stays in range; fast gait changes frequency, sweep, flex and force',()=>{
 const clione=createClione({length:.036,frequency:1.35,phase:0,seed:2}),slow=clione.sampleWingForces(.113,{gait:'slowhover'}),fast=clione.sampleWingForces(.113,{gait:'fastescape'});
 assert.ok(slow.frequency>=1&&slow.frequency<=2);assert.ok(fast.frequency>=2&&fast.frequency<=5);assert.ok(fast.liftMagnitude>slow.liftMagnitude,'fast gait has increased force proxy');
 clione.update(.113,{gait:'slowhover'});const slowY=vertices(clione.group.getObjectByName('L_WING_SURFACE') as THREE.Mesh).slice();clione.update(.113,{gait:'fastescape'});const fastY=vertices(clione.group.getObjectByName('L_WING_SURFACE') as THREE.Mesh);assert.notDeepEqual([...slowY],[...fastY]);clione.dispose();
});
test('trailing edge has phase lag on both half-strokes and wings retain chordwise deformation',()=>{
 const clione=createClione({length:.036,frequency:1.4,phase:0,seed:0}),wing=clione.group.getObjectByName('L_WING_SURFACE') as THREE.Mesh;
 for(const time of [.07,.43]){clione.update(time,{gait:'slowswim'});for(const surface of [wing,clione.group.getObjectByName('R_WING_SURFACE') as THREE.Mesh]){const p=vertices(surface),stride=7,mid=5*stride;const lead=p[(mid+0)*3+1],trail=p[(mid+6)*3+1];assert.ok(Math.abs(lead-trail)>.00003,`lag at ${time}`);}}
 clione.dispose();
});
test('zero frequency produces no wing lift proxy and release cannot grow geometry',()=>{
 const clione=createClione({length:.036,frequency:1.35,phase:0,seed:9}),stopped=clione.sampleWingForces(1,{frequency:0,gait:'glidesink'});assert.equal(stopped.liftMagnitude,0);const root=clione.group;clione.dispose();assert.equal(root.children.length,0);clione.update(10);assert.equal(root.children.length,0);
});
test('geometry-free sampler matches the visible rig with an integrated phase override',()=>{
 const options={length:.036,frequency:1.35,phase:.4,seed:6},controls={gait:'fastescape' as const,turn:.3,phase:8.14};const clione=createClione(options),pure=sampleClioneWingForces(99,options,controls),instance=clione.sampleWingForces(99,controls);
 assert.deepEqual(instance.total.toArray(),pure.total.toArray());clione.update(99,controls);assert.equal(clione.diagnostics().phase,8.14);clione.dispose();
});
test('full sweep draws tips inward and steering creates bounded wing asymmetry',()=>{
 const options={length:.036,frequency:1.35,phase:0,seed:0},clione=createClione(options);clione.update(0,{gait:'slowhover',phase:0});const open=clione.diagnostics().wingTipSeparation;clione.update(0,{gait:'fastescape',phase:Math.PI/2});const swept=clione.diagnostics().wingTipSeparation;
 assert.ok(swept<open*.45,`swept tips approach sagittal plane: ${swept}/${open}`);const force=sampleClioneWingForces(0,options,{gait:'softturn',turn:.8,phase:.6});assert.notEqual(force.left.z,force.right.z);clione.dispose();
});
test('main-owned gait blend gives force and mesh a continuous shared parameter transition',()=>{
 const options={length:.036,frequency:1.35,phase:0,seed:13},phase=2.17,clione=createClione(options),previous={gait:'slowswim' as const,phase,frequency:1.35},start={...previous,gait:'glidesink' as const,previousGait:'slowswim' as const,gaitBlend:0},end={...start,gaitBlend:1};
 const before=sampleClioneWingForces(0,options,previous),atStart=sampleClioneWingForces(0,options,start),atEnd=sampleClioneWingForces(0,options,end);assert.deepEqual(atStart.total.toArray(),before.total.toArray(),'blend zero preserves previous force');assert.equal(atEnd.liftMagnitude,0,'blend one reaches glide force');
 clione.update(0,start);const first=[...vertices(clione.group.getObjectByName('L_WING_SURFACE') as THREE.Mesh)];clione.update(0,{...start,gaitBlend:.01});const next=[...vertices(clione.group.getObjectByName('L_WING_SURFACE') as THREE.Mesh)];const delta=Math.max(...first.map((value,index)=>Math.abs(value-next[index])));assert.ok(delta<.0002,`first blend increment remains continuous (${delta})`);clione.dispose();
});

test('closed Clione body faces point outward for opaque silhouette and glTF rendering',()=>{
 const clione=createClione({length:.036,frequency:1.35,phase:0,seed:1});
 const mesh=clione.group.getObjectByName('CLIONE_TRANSPARENT_BODY') as THREE.Mesh,p=mesh.geometry.getAttribute('position'),idx=mesh.geometry.index!;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let volume=0;
 for(let i=0;i<idx.count;i+=3){a.fromBufferAttribute(p,idx.getX(i));b.fromBufferAttribute(p,idx.getX(i+1));c.fromBufferAttribute(p,idx.getX(i+2));volume+=a.dot(b.cross(c))/6;}
 assert.ok(volume>0,'positive signed volume is required for outward faces');clione.dispose();
});
