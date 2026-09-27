import assert from 'node:assert/strict';
import test from 'node:test';
import {createSardineSchools,sardineObstacles,SARDINE_BOUNDS} from '../src/places/seabridge/Sardines.ts';

const run=(seconds:number,seed=20260927)=>{const s=createSardineSchools({seed,count:120});for(let t=0;t<=seconds;t+=1/30)s.update(t);return s;};

test('sardine schools stay finite, in bounds and out of the bridge for 10 minutes',()=>{
 const schools=run(600),debug=schools.getDebug(),obstacles=sardineObstacles();
 assert.equal(debug.penetrations,0);
 for(const f of debug.fish){
  assert.ok(f.p.every(Number.isFinite));
  assert.ok(f.p[0]>=SARDINE_BOUNDS.min.x&&f.p[0]<=SARDINE_BOUNDS.max.x&&f.p[1]>=SARDINE_BOUNDS.min.y&&f.p[1]<=SARDINE_BOUNDS.max.y&&f.p[2]>=SARDINE_BOUNDS.min.z&&f.p[2]<=SARDINE_BOUNDS.max.z);
  for(const b of obstacles)assert.ok(!(f.p[0]>b.min[0]&&f.p[0]<b.max[0]&&f.p[1]>b.min[1]&&f.p[1]<b.max[1]&&f.p[2]>b.min[2]&&f.p[2]<b.max[2]));
 }
 schools.dispose();
});

test('schools chase each other several times in 10 minutes',()=>{
 const schools=run(600);assert.ok(schools.getDebug().chases>=8,`chases=${schools.getDebug().chases}`);schools.dispose();
});

test('same seed and elapsed give the same school; pause does not advance',()=>{
 const a=run(60),b=run(60);assert.deepEqual(a.getDebug().fish,b.getDebug().fish);
 const before=JSON.stringify(a.getDebug().fish);a.update(60);a.update(59);assert.equal(JSON.stringify(a.getDebug().fish),before);
 a.dispose();b.dispose();
});

test('schools fly low over the weeds and through the covered stair',()=>{
 const s=createSardineSchools({seed:20260927,count:200});let under=0,low=0;
 for(let t=0;t<=600;t+=1/30){s.update(t);if(Math.round(t*30)%60===0){for(const f of s.getDebug().fish){const [x,y,z]=f.p;if(Math.abs(x)<1&&z<2.4&&z>-6)under++;if(y<1.3)low++;}}}
 const d=s.getDebug();assert.ok(d.flythroughs>=6,`flythroughs=${d.flythroughs}`);assert.ok(under>200,`under=${under}`);assert.ok(low>200,`low=${low}`);assert.equal(d.penetrations,0);s.dispose();
});
