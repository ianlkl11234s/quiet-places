import test from 'node:test';
import assert from 'node:assert/strict';
import {createWinterExterior,WINTER_EXTERIOR_PLATFORM,WINTER_SWELL_PERIOD,winterSwellEnvelope} from '../src/places/snowwindow/Exterior.ts';

test('winter swell groups stay calm between smooth bounded arrivals and loop continuously',()=>{
 const samples=[0,12,48,92];
 assert.ok(samples.every(time=>winterSwellEnvelope(time)<.001),'most of the loop remains calm');
 assert.ok(winterSwellEnvelope(WINTER_SWELL_PERIOD*.26)>.18);
 assert.ok(winterSwellEnvelope(WINTER_SWELL_PERIOD*.71)>.22);
 assert.equal(winterSwellEnvelope(13.25),winterSwellEnvelope(13.25+WINTER_SWELL_PERIOD));
 assert.ok(Math.abs(winterSwellEnvelope(WINTER_SWELL_PERIOD-.001)-winterSwellEnvelope(.001))<.001,'loop seam is smooth');
});

test('winter platform keeps its shortened closed, positive-thickness snow volume',()=>{
 const exterior=createWinterExterior();
 const snow=exterior.group.getObjectByName('snowwindow-thin-snow-platform') as import('three').Mesh<import('three').BufferGeometry>;
 const positions=snow.geometry.getAttribute('position');
 snow.geometry.computeBoundingBox();const bounds=snow.geometry.boundingBox!;
 assert.ok(bounds.min.z>=WINTER_EXTERIOR_PLATFORM.zFar-.016&&bounds.max.z<=WINTER_EXTERIOR_PLATFORM.zNear+.016);
 assert.ok(bounds.min.x>=WINTER_EXTERIOR_PLATFORM.xMin-.016&&bounds.max.x<=WINTER_EXTERIOR_PLATFORM.xMax+.016);
 const half=positions.count/2;
 for(let index=0;index<half;index++)assert.ok(positions.getY(index)>positions.getY(index+half));
 const index=snow.geometry.index!,edges=new Map<string,number>();
 for(let triangle=0;triangle<index.count;triangle+=3)for(let side=0;side<3;side++){
  const a=index.getX(triangle+side),b=index.getX(triangle+(side+1)%3),key=`${Math.min(a,b)}:${Math.max(a,b)}`;
  edges.set(key,(edges.get(key)??0)+1);
 }
 assert.ok([...edges.values()].every(count=>count===2),'closed snow shell has no open edge');
 exterior.dispose();
});
