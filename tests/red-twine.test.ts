import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createRedTwine} from '../src/places/stairlight/RedTwine.ts';

test('red twine is anchored, deforms its two film tails deterministically, and releases resources',()=>{
  const twine=createRedTwine(),scene=new THREE.Scene();scene.add(twine.root);
  assert.equal(twine.root.position.length(),0,'the parent owns attachment placement');
  const tails:THREE.Mesh[]=[];twine.root.traverse(object=>{if(object.name==='red-twine-tail')tails.push(object as THREE.Mesh);});
  assert.equal(tails.length,2,'two tied tails are present');
  const before=(tails[1].geometry.getAttribute('position') as THREE.BufferAttribute).array.slice() as Float32Array;
  twine.update(3,.8);
  const after=(tails[1].geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
  assert.notDeepEqual(after,before,'CPU geometry moves with elapsed time');
  assert.equal(after[0],before[0],'the tie remains pinned at the rail');
  const atThree=after.slice() as Float32Array;
  twine.update(9.25,.2);twine.update(3,.8);
  assert.deepEqual(after,atThree,'the same elapsed time and activity reproduce the same tail geometry');
  const geometryEvents=new Set<THREE.BufferGeometry>();twine.root.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.geometry)geometryEvents.add(mesh.geometry);});
  let disposed=0;geometryEvents.forEach(geometry=>geometry.addEventListener('dispose',()=>disposed++));
  twine.dispose();twine.dispose();
  assert.equal(scene.children.length,0,'dispose detaches the root');
  assert.equal(disposed,geometryEvents.size,'each owned geometry is disposed once');
});
