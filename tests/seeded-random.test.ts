import assert from 'node:assert/strict';
import test from 'node:test';
import {seededRandom} from '../src/shared/math/seededRandom.ts';

test('shared random keeps the established sequence and independent scene streams',()=>{
  // Published Numerical Recipes LCG recurrence, checked against the old JS multiply.
  for(const seed of [0,1,-1,0x51f15,0x0cead123,7123]){
    const random=seededRandom(seed),other=seededRandom(seed);
    let previous=seed>>>0;
    for(let i=0;i<1000;i++){
      previous=(previous*1664525+1013904223)>>>0;
      const sample=random();
      assert.equal(sample,previous/4294967296);
      assert.equal(sample,other());
      assert.ok(sample>=0&&sample<1);
    }
  }
});
