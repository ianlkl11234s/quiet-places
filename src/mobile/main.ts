import {DefaultLoadingManager} from 'three';
import {Capacitor} from '@capacitor/core';
import {places,type PlaceId} from '../places/metadata.ts';
import {setRoomAssetUrls,resolveAssetUrl} from '../shared/resources/AssetLocator.ts';
import {NativeAssets,toWebUrls,type InstalledRoomAssets,type RoomAssetManifest,type NativeAssetFile} from './NativeAssets.ts';
import type {MobileViewer} from '../main.ts';
import './mobile.css';

declare const __QUIET_PLACES_ASSET_BASE__:string;
const source=__QUIET_PLACES_ASSET_BASE__;
const native=Capacitor.isNativePlatform();
DefaultLoadingManager.setURLModifier(resolveAssetUrl);
const host=document.createElement('section');host.id='mobile-entry';host.setAttribute('aria-label','選擇房間');
host.innerHTML='<h1>QUIET PLACES</h1><p class="mobile-intro">選一個房間，停留片刻。</p><div class="mobile-rooms"></div><p class="mobile-storage"></p><p class="mobile-note">已下載的房間，可以在沒有網路的地方陪你。</p><p class="mobile-message" role="status"></p>';
document.body.append(host);document.documentElement.classList.add('mobile-app','mobile-choosing');
const message=host.querySelector<HTMLElement>('.mobile-message')!;
const storage=host.querySelector<HTMLElement>('.mobile-storage')!;
const grid=host.querySelector<HTMLElement>('.mobile-rooms')!;
const recovery=document.createElement('section');recovery.className='mobile-recovery';recovery.hidden=true;recovery.setAttribute('role','status');
const recoveryText=document.createElement('p');const returnButton=document.createElement('button');returnButton.textContent='回到選房';
const reloadButton=document.createElement('button');reloadButton.textContent='重新開啟';reloadButton.onclick=()=>location.reload();
const rollbackButton=document.createElement('button');rollbackButton.textContent='使用上一版';rollbackButton.hidden=true;
recovery.append(recoveryText,returnButton,rollbackButton,reloadButton);document.body.append(recovery);
let viewer:MobileViewer|undefined,bootFailed=false,current:PlaceId|undefined,busy=false,downloading:PlaceId|undefined;
let retainedBytes=0;
const invalid=new Set<string>();
let catalog:{rooms:RoomAssetManifest[];sharedFiles:NativeAssetFile[]};
const installed=new Map<string,InstalledRoomAssets>();
const failures=new Map<string,string>();
const rows=new Map<string,{enter:HTMLButtonElement;state:HTMLElement;download:HTMLButtonElement;remove:HTMLButtonElement}>();
const bytes=(n:number)=>`${(n/1_000_000).toFixed(1)} MB`;
function say(text:string){message.textContent=text;}
function showChooser(){
 viewer?.leaveRoom();current=undefined;host.hidden=false;recovery.hidden=true;
 document.documentElement.classList.add('mobile-choosing');
 document.getElementById('settings')?.setAttribute('hidden','');document.getElementById('music-panel')?.setAttribute('hidden','');document.getElementById('mobile-sleep-panel')?.setAttribute('hidden','');
 render();
}
returnButton.onclick=showChooser;
function render(){
 let total=0;
 const unique=new Map<string,number>();
 for(const room of installed.values())for(const file of room.manifest.files)unique.set(file.sha256,file.bytes);
 for(const size of unique.values())total+=size;
 total=Math.max(total,retainedBytes);
 storage.textContent=installed.size?`已保存 ${installed.size} 個房間 · 共用檔案合計 ${bytes(total)}`:'向海的隧道已內建 · 可離線觀賞';
 for(const place of places){
  const row=rows.get(place.id);if(!row)continue;
  const saved=installed.get(place.id),manifest=catalog.rooms.find(room=>room.roomId===place.id)!;
  const bundled=place.id==='seaward';
  const compatible=saved?.manifest.appSchemaVersion===1;
  const ready=bundled||Boolean(saved&&compatible);
  const update=Boolean(saved&&saved.assetVersion!==manifest.assetVersion);
  row.enter.disabled=busy||Boolean(downloading)||!ready;row.enter.setAttribute('aria-label',`進入${place.name}`);
  row.state.textContent=failures.get(place.id)??(downloading===place.id?'正在下載…':bundled?'已內建 · 可離線':saved?(compatible?(update?'可離線 · 有更新':'可離線觀賞'):'需要更新'): `尚未下載 · ${bytes(manifest.totalBytes)}`);
  row.download.hidden=bundled||Boolean(saved&&!update&&!failures.has(place.id));
  row.download.textContent=downloading===place.id?'取消下載':saved?'更新房間':'下載房間';
  row.download.disabled=busy||Boolean(downloading&&downloading!==place.id)||!native||!source;
  row.remove.hidden=!saved&&!invalid.has(place.id);row.remove.disabled=busy||Boolean(downloading);
 }
}
async function enter(id:PlaceId){
 if(busy||downloading)return;
 busy=true;render();say('光正在進來。');
 try{
  if(bootFailed){location.reload();return;}
  viewer?.leaveRoom();
  const saved=installed.get(id);
  if(saved){const verified=toWebUrls(await NativeAssets.resolve({roomId:id}));setRoomAssetUrls(verified.urls);}
  else if(id==='seaward')setRoomAssetUrls(Object.fromEntries([...catalog.rooms.find(room=>room.roomId===id)!.files,...catalog.sharedFiles].map(file=>[file.path,`/${file.path}`])));
  else throw new Error('請先下載這個房間。');
  const url=new URL(location.href);url.search=`?place=${id}`;history.replaceState(null,'',url);
  if(!viewer){
   const module=await import('../main.ts');
   if(!await module.ready||!module.mobileViewer){bootFailed=true;throw new Error('空間暫時無法載入，請重新開啟。');}
   viewer=module.mobileViewer;attachViewer();
  }else if(!await viewer.enterRoom(id))throw new Error('空間暫時無法載入，可以再試一次。');
  current=id;host.hidden=true;recovery.hidden=true;document.documentElement.classList.remove('mobile-choosing');say('');
 }catch(error){
  viewer?.leaveRoom();rollbackButton.hidden=!installed.has(id);rollbackButton.onclick=async()=>{rollbackButton.disabled=true;try{const restored=await NativeAssets.rollback({roomId:id});installed.set(id,restored);await enter(id);}catch{recoveryText.textContent='沒有可用的上一版，請重新下載或重新開啟。';}finally{rollbackButton.disabled=false;}};say(error instanceof Error?error.message:'房間無法載入，請重試。');
  recoveryText.textContent=message.textContent;recovery.hidden=false;
 }finally{busy=false;render();}
}
function attachViewer(){
 const rooms=document.getElementById('rooms-toggle')!;rooms.setAttribute('aria-label','回到選房');rooms.title='回到選房';
 rooms.querySelector('.dock-button__label')!.textContent='回到選房';rooms.removeAttribute('aria-expanded');rooms.removeAttribute('aria-controls');
 rooms.addEventListener('click',event=>{event.stopImmediatePropagation();showChooser();},{capture:true});
 const timerSection=document.createElement('section');timerSection.className='settings-section mobile-timer';
 timerSection.innerHTML='<label for="sleep-duration">睡眠定時</label><select id="sleep-duration" aria-label="睡眠定時"><option value="0">關閉</option><option value="15">15 分鐘</option><option value="30">30 分鐘</option><option value="60">60 分鐘</option></select><p id="sleep-remaining" role="status"></p>';
 const timerPanel=document.createElement('section');timerPanel.id='mobile-sleep-panel';timerPanel.className='side-panel';timerPanel.hidden=true;timerPanel.setAttribute('aria-label','睡眠定時');
 const timerHead=document.createElement('div');timerHead.className='panel-head';timerHead.innerHTML='<span>讓空間慢慢安靜</span><button aria-label="關閉睡眠定時">×</button>';timerPanel.append(timerHead,timerSection);document.body.append(timerPanel);
 const timerToggle=document.getElementById('about-toggle')!;timerToggle.classList.remove('dock-button--about');timerToggle.setAttribute('aria-label','睡眠定時');timerToggle.title='睡眠定時';timerToggle.setAttribute('aria-controls','mobile-sleep-panel');timerToggle.innerHTML='<span aria-hidden="true">◷</span>';
 const closeTimer=()=>{timerPanel.hidden=true;timerToggle.setAttribute('aria-expanded','false');};
 timerHead.querySelector('button')!.onclick=closeTimer;
 timerToggle.addEventListener('click',event=>{event.stopImmediatePropagation();timerPanel.hidden=!timerPanel.hidden;timerToggle.setAttribute('aria-expanded',String(!timerPanel.hidden));},{capture:true});
 document.addEventListener('pointerdown',event=>{if(event.target instanceof Node&&!timerPanel.contains(event.target)&&!timerToggle.contains(event.target))closeTimer();});
 const select=timerSection.querySelector<HTMLSelectElement>('select')!;
 const remaining=timerSection.querySelector<HTMLElement>('p')!;
 let ended=viewer!.timer.ended;
 select.onchange=()=>{ended=false;if(select.value==='0')viewer!.timer.cancel();else viewer!.timer.setMinutes(Number(select.value) as 15|30|60);updateTimer();};
 function updateTimer(){
  const timer=viewer!.timer;
  if(timer.active){const seconds=Math.ceil(timer.remainingMs/1000);remaining.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} 後，讓空間安靜下來`;}
  else{select.value='0';remaining.textContent=ended?'已結束 · 輕點繼續流動即可再觀賞':'到期停止聲音與流動';}
 }
 const unsubscribe=viewer!.timer.subscribe(updateTimer);const interval=window.setInterval(updateTimer,1000);window.addEventListener('pagehide',()=>{clearInterval(interval);unsubscribe();},{once:true});updateTimer();
 window.addEventListener('quiet-places-mobile-expired',()=>{ended=true;updateTimer();});
}
async function download(id:PlaceId){
 if(downloading===id){await NativeAssets.cancel({roomId:id});return;}
 if(downloading||busy)return;
 downloading=id;failures.delete(id);render();say('下載期間請留在 App。');
 try{
  const manifest=catalog.rooms.find(room=>room.roomId===id)!;
  const result=await NativeAssets.download({manifest,sharedFiles:catalog.sharedFiles,baseUrl:source});
  installed.set(id,result);invalid.delete(id);await refreshStorage();say('房間已保存，可以離線觀賞。');
 }catch{failures.set(id,'下載未完成 · 可重試');say('下載未完成。請確認連線與可用空間後重試；原有房間仍保留。');}
 finally{downloading=undefined;render();}
}
async function remove(id:PlaceId){
 if(busy||downloading)return;busy=true;render();rows.get(id)!.state.textContent='正在刪除…';
 try{if(current===id)showChooser();await NativeAssets.remove({roomId:id});installed.delete(id);invalid.delete(id);failures.delete(id);await refreshStorage();say('房間已移除。其他房間仍然保留。');}
 catch{say('暫時無法移除房間，請重試。');}
 finally{busy=false;render();}
}
window.addEventListener('quiet-places-mobile-context-lost',()=>{recoveryText.textContent='畫面暫時中斷，請重新開啟房間。';recovery.hidden=false;});
window.addEventListener('quiet-places-mobile-context-restored',()=>{recoveryText.textContent='繪圖連線已恢復，請重新開啟以重建房間。';recovery.hidden=false;});
async function refreshStorage(){const result=await NativeAssets.list();retainedBytes=result.retainedBytes;for(const room of result.invalidRooms){invalid.add(room.roomId);failures.set(room.roomId,'下載檔案需修復 · 請重試');}}
async function initialize(){
 const response=await fetch('/room-manifests.json');if(!response.ok)throw new Error('無法讀取房間清單');catalog=await response.json();
 if(native){
  const result=await NativeAssets.list();result.rooms.forEach(room=>installed.set(room.roomId,room));retainedBytes=result.retainedBytes;for(const room of result.invalidRooms){invalid.add(room.roomId);failures.set(room.roomId,'下載檔案需修復 · 請重試');}
  await NativeAssets.addListener('progress',progress=>{const row=rows.get(progress.roomId);if(row)row.state.textContent=progress.phase==='verifying'?'正在校驗…':`正在下載 ${Math.min(100,Math.round(progress.bytesDownloaded/progress.totalBytes*100))}%`;});
 }
 for(const place of places){
  const article=document.createElement('article');article.className='mobile-room-item';
  const enterButton=document.createElement('button');enterButton.className='mobile-room';enterButton.textContent=place.name;enterButton.onclick=()=>void enter(place.id);
  const state=document.createElement('p');state.className='mobile-room-state';
  const actions=document.createElement('div');actions.className='mobile-room-actions';
  const get=document.createElement('button');get.textContent='下載房間';get.onclick=()=>void download(place.id);
  const del=document.createElement('button');del.textContent='移除下載';del.onclick=()=>void remove(place.id);
  actions.append(get,del);article.append(enterButton,state,actions);grid.append(article);rows.set(place.id,{enter:enterButton,state,download:get,remove:del});
 }
 render();if(!source)say('其餘房間的下載服務尚未設定。');
}
void initialize().catch(error=>{console.error('Mobile catalog initialization failed',error);say('房間清單暫時無法開啟，請重新開啟 App。');recoveryText.textContent=message.textContent;recovery.hidden=false;});
