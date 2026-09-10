import assert from 'node:assert/strict';
import test from 'node:test';
import {places} from '../src/places/metadata.ts';
import {layoutMemoryBubbles} from '../src/ui/RoomBrowser.ts';
import {bubblePresentation,createBubbleMotionModel,hashBubbleSeed,stepBubbleMotion,thinFilmRgb} from '../src/ui/RoomBubbleMotion.ts';

const anchors=()=>{
  const layout=layoutMemoryBubbles(places.map(place=>place.id),'waterlight');
  return [...layout].map(([id,position])=>({id,x:position.x,y:position.y,scale:position.scale}));
};

test('seeded bubble motion is deterministic, finite and bounded',()=>{
  const seed=hashBubbleSeed('quiet-places-ui-test');
  const first=createBubbleMotionModel(anchors(),seed);
  const second=createBubbleMotionModel(anchors(),seed);
  for(let frame=0;frame<7200;frame++){stepBubbleMotion(first,1/60);stepBubbleMotion(second,1/60);}
  assert.deepEqual(first,second);
  for(const body of first.bodies){
    assert.ok(Number.isFinite(body.x)&&Number.isFinite(body.y)&&Number.isFinite(body.shape));
    assert.ok(body.x>=.30+body.radius&&body.x<=.98-body.radius);
    assert.ok(body.y>=.035+body.radius&&body.y<=.96-body.radius);
    assert.ok(body.shape>=.955&&body.shape<=1.065);
    const pose=bubblePresentation(body);
    assert.ok(Math.abs(pose.stretchX*pose.stretchY-1)<1e-12);
  }
});

test('focus damping pulls a moving bubble back toward its anchor',()=>{
  const model=createBubbleMotionModel(anchors(),42);
  for(let frame=0;frame<900;frame++)stepBubbleMotion(model,1/60);
  const body=model.bodies[0],before=Math.hypot(body.x-body.anchorX,body.y-body.anchorY);
  for(let frame=0;frame<360;frame++)stepBubbleMotion(model,1/60,new Set([body.id]));
  const after=Math.hypot(body.x-body.anchorX,body.y-body.anchorY);
  assert.ok(after<before);
});

test('pointer pressure gently displaces a nearby unpinned bubble',()=>{
  const anchor=[{id:'nearby',x:60,y:50,scale:1}];
  const baseline=createBubbleMotionModel(anchor,77),interacted=createBubbleMotionModel(anchor,77);
  const pointer={x:.52,y:.5,vx:.08,vy:0,active:true,pressed:false};
  for(let frame=0;frame<90;frame++){stepBubbleMotion(baseline,1/60);stepBubbleMotion(interacted,1/60,new Set(),pointer);}
  assert.ok(interacted.bodies[0].x>baseline.bodies[0].x+.002);
  assert.ok(Math.hypot(interacted.bodies[0].vx,interacted.bodies[0].vy)<=interacted.bodies[0].maxSpeed+1e-12);
});

test('thin-film lookup stays bounded and responds to thickness and angle',()=>{
  const normal=thinFilmRgb(420,1),thicker=thinFilmRgb(560,1),grazing=thinFilmRgb(420,.2);
  for(const sample of [normal,thicker,grazing])for(const channel of sample)assert.ok(Number.isFinite(channel)&&channel>=0&&channel<=1);
  assert.notDeepEqual(normal,thicker);
  assert.notDeepEqual(normal,grazing);
});
