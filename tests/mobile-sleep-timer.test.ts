import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SleepTimer,SLEEP_TIMER_STORAGE_KEY} from '../src/mobile/SleepTimer.ts';

class MemoryStorage {values=new Map<string,string>();getItem(key:string){return this.values.get(key)??null;}setItem(key:string,value:string){this.values.set(key,value);}removeItem(key:string){this.values.delete(key);}}
function harness(stored?:string){
 let now=1_000,callback:(()=>void)|undefined;const storage=new MemoryStorage();if(stored)storage.setItem(SLEEP_TIMER_STORAGE_KEY,stored);let expires=0;
 const timer=new SleepTimer({storage,now:()=>now,setTimeout:fn=>{callback=fn;return 1;},clearTimeout:()=>{callback=undefined;},onExpire:()=>expires++});
 return {timer,storage,set now(value:number){now=value;},fire:()=>callback?.(),expires:()=>expires};
}
test('persists absolute 15, 30 and 60 minute deadlines and can reset or cancel',()=>{
 const h=harness();h.timer.setMinutes(15);assert.equal(h.timer.deadline,901_000);h.timer.reset(30);assert.equal(h.timer.deadline,1_801_000);h.timer.reset(60);assert.equal(h.timer.deadline,3_601_000);h.timer.cancel();assert.equal(h.timer.deadline,undefined);assert.equal(h.storage.getItem(SLEEP_TIMER_STORAGE_KEY),null);
});
test('expires across navigation, background time and cold launch exactly once',()=>{
 const h=harness('2000');h.now=2_001;assert.equal(h.timer.check(),true);assert.equal(h.expires(),1);assert.equal(h.timer.check(),false);assert.equal(h.expires(),1);
 const active=harness();active.timer.setMinutes(15);active.now=901_001;active.fire();assert.equal(active.expires(),1);assert.equal(active.timer.active,false);assert.equal(active.timer.ended,true);active.timer.cancel();assert.equal(active.timer.ended,false);
});
