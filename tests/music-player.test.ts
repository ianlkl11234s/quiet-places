import test from 'node:test';
import assert from 'node:assert/strict';
import {createMusicPlayer} from '../src/systems/MusicPlayer.ts';

class Element extends EventTarget {
  children: Element[] = []; className = ''; textContent = ''; value = ''; checked = false;
  attributes = new Map<string,string>();
  append(...children: Element[]) { this.children.push(...children); }
  setAttribute(key: string,value: string) { this.attributes.set(key,value); }
  remove() {}
}
class TestAudio extends EventTarget {
  static latest: TestAudio;
  src = ''; currentSrc = ''; paused = true; volume = .5; loop = false; currentTime = 0; duration = 10; starts = 0;
  constructor(){super();TestAudio.latest=this;}
  load(){this.currentSrc=this.src?new URL(this.src,'http://localhost/').href:'';this.currentTime=0;}
  async play(){this.paused=false;this.starts++;this.dispatchEvent(new Event('play'));}
  pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
  removeAttribute(key:string){if(key==='src')this.src='';}
  end(){this.paused=true;this.currentTime=this.duration;this.dispatchEvent(new Event('ended'));}
}

test('music playlist advances through distinct tracks, wraps, and respects stop controls',async()=>{
 const oldAudio=globalThis.Audio,oldDocument=globalThis.document;
 Object.assign(globalThis,{Audio:TestAudio,document:{baseURI:'http://localhost/',createElement:()=>new Element(),createTextNode:(text:string)=>Object.assign(new Element(),{textContent:text})}});
 try{
  const container=new Element(),player=createMusicPlayer(container as unknown as HTMLElement),audio=TestAudio.latest;
  const root=container.children[0];
  const find=(name:string):Element=>{const visit=(node:Element):Element|undefined=>node.className===name?node:node.children.map(visit).find(Boolean);return visit(root)!;};
  const select=find('music-player__track'),play=find('music-player__play'),loop=find('music-player__loop');
  assert.equal(select.children.length,8);assert.equal(new Set(select.children.map(x=>x.textContent)).size,8);
  assert.equal(audio.starts,0,'never autoplay');assert.equal(audio.loop,false,'native single-track looping stays disabled');
  play.dispatchEvent(new Event('click'));await Promise.resolve();
  const first=audio.src;
  for(let index=1;index<=8;index++){const previous=audio.src;audio.end();await Promise.resolve();assert.equal(select.value,String(index%8));assert.notEqual(audio.src,previous);assert.equal(audio.paused,false);}
  assert.equal(audio.src,first,'last track wraps to the first');
  loop.checked=false;const starts=audio.starts;audio.end();await Promise.resolve();assert.equal(audio.starts,starts);assert.equal(play.textContent,'播放');
  loop.checked=true;play.dispatchEvent(new Event('click'));await Promise.resolve();player.visibility(true);const stopped=audio.starts;audio.end();assert.equal(audio.starts,stopped,'background pause cannot restart the playlist');
  player.dispose();audio.end();assert.equal(audio.starts,stopped,'disposed player cannot restart');
 }finally{Object.assign(globalThis,{Audio:oldAudio,document:oldDocument});}
});
