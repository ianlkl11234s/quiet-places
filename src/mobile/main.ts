import {places} from '../places/metadata.ts';
import './mobile.css';

// No renderer or audio is constructed until the viewer chooses the pilot room.
const host=document.createElement('section');host.id='mobile-entry';host.setAttribute('aria-label','選擇房間');
const heading=document.createElement('h1');heading.textContent='QUIET PLACES';
const intro=document.createElement('p');intro.textContent='選一個房間，停留片刻。';
const choice=document.createElement('button');choice.className='mobile-room';
const pilot=places.find(place=>place.id==='seaward')!;
choice.textContent=pilot.name;choice.setAttribute('aria-label',`進入${pilot.name}`);
const note=document.createElement('p');note.className='mobile-note';note.textContent='已內建 · 可離線觀賞';
const later=document.createElement('details');const summary=document.createElement('summary');summary.textContent='其他房間 · 尚未開放';later.append(summary);
const list=document.createElement('p');list.textContent=places.filter(place=>place.id!==pilot.id).map(place=>place.name).join(' · ');later.append(list);
const message=document.createElement('p');message.setAttribute('role','status');
host.append(heading,intro,choice,note,later,message);document.body.append(host);
document.documentElement.classList.add('mobile-app','mobile-choosing');
choice.addEventListener('click',async()=>{
 choice.disabled=true;message.textContent='光正在進來。';
 const url=new URL(location.href);url.search='?place=seaward';history.replaceState(null,'',url);
 try{
  const {ready}=await import('../main.ts');
  if(!await ready)throw new Error('Scene initialization failed');
  const rooms=document.getElementById('rooms-toggle')!;
  rooms.setAttribute('aria-label','回到選房');rooms.title='回到選房';
  rooms.querySelector('.dock-button__label')!.textContent='回到選房';
  rooms.removeAttribute('aria-expanded');rooms.removeAttribute('aria-controls');
  rooms.addEventListener('click',event=>{event.stopImmediatePropagation();location.href=location.pathname;},{capture:true});
  host.remove();document.documentElement.classList.remove('mobile-choosing');
 }catch{
  message.textContent='空間暫時無法載入。';choice.disabled=false;choice.textContent='重新開啟';choice.onclick=()=>location.reload();
 }
},{once:true});
