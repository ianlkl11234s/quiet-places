import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMobileLifecycle} from '../src/mobile/Lifecycle.ts';
test('native and visibility inactivity are combined; foreground does not request playback',()=>{
 const events:string[]=[];const lifecycle=createMobileLifecycle(()=>events.push('stop'),()=>events.push('show'));
 lifecycle.native(false);lifecycle.document(false);lifecycle.native(true);
 assert.deepEqual(events,['stop']);assert.equal(lifecycle.inactive,true);
 lifecycle.document(true);lifecycle.native(true);assert.deepEqual(events,['stop','show']);
 lifecycle.document(false);assert.deepEqual(events,['stop','show','stop']);
 lifecycle.dispose();lifecycle.native(false);lifecycle.document(true);assert.deepEqual(events,['stop','show','stop']);
});
