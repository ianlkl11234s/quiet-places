export const SLEEP_TIMER_STORAGE_KEY='quiet-places-mobile-sleep-deadline-v1';
export type SleepMinutes=15|30|60;

export interface SleepTimerStorage {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void;}
export interface SleepTimerOptions {
 storage?:SleepTimerStorage;
 now?:()=>number;
 setTimeout?:(callback:()=>void,delay:number)=>unknown;
 clearTimeout?:(handle:unknown)=>void;
 onExpire?:()=>void;
}

/** A wall-clock deadline. Scene pause and native background state never pause it. */
export class SleepTimer {
 private readonly storage?:SleepTimerStorage;
 private readonly now:()=>number;
 private readonly schedule:(callback:()=>void,delay:number)=>unknown;
 private readonly cancelSchedule:(handle:unknown)=>void;
 private readonly listeners=new Set<(deadline:number|undefined)=>void>();
 private handle:unknown;
 private _deadline:number|undefined;
 private _ended=false;
 private readonly options:SleepTimerOptions;
 constructor(options:SleepTimerOptions={}){
  this.options=options;
  this.storage=options.storage??safeStorage();this.now=options.now??Date.now;
  this.schedule=options.setTimeout??((callback,delay)=>setTimeout(callback,delay));
  this.cancelSchedule=options.clearTimeout??(handle=>clearTimeout(handle as ReturnType<typeof setTimeout>));
  const stored=this.storage?.getItem(SLEEP_TIMER_STORAGE_KEY);
  const deadline=stored===null?undefined:Number(stored);
  if(Number.isFinite(deadline)&&deadline!>0)this._deadline=deadline!;
  this.check();
 }
 get deadline(){return this._deadline;}
 get active(){return this._deadline!==undefined;}
 /** True after this instance reached its deadline, until cancelled or reset. */
 get ended(){return this._ended;}
 get remainingMs(){return this._deadline===undefined?0:Math.max(0,this._deadline-this.now());}
 setMinutes(minutes:SleepMinutes){this.setDeadline(this.now()+minutes*60_000);}
 reset(minutes:SleepMinutes){this.setMinutes(minutes);}
 cancel(){this.clear(false);}
 /** Call whenever the app returns to foreground; returns true exactly once per expiry. */
 check(){
  if(this._deadline===undefined)return false;
  if(this.now()<this._deadline){this.arm();return false;}
  this.clear(true);return true;
 }
 subscribe(listener:(deadline:number|undefined)=>void){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
 dispose(){if(this.handle!==undefined){this.cancelSchedule(this.handle);this.handle=undefined;}this.listeners.clear();}
 private setDeadline(deadline:number){
  this._ended=false;this._deadline=deadline;this.storage?.setItem(SLEEP_TIMER_STORAGE_KEY,String(deadline));this.arm();this.emit();
 }
 private arm(){
  if(this.handle!==undefined){this.cancelSchedule(this.handle);this.handle=undefined;}
  if(this._deadline===undefined)return;
  this.handle=this.schedule(()=>{this.handle=undefined;this.check();},Math.max(0,this._deadline-this.now()));
 }
 private clear(expired:boolean){
  if(this.handle!==undefined){this.cancelSchedule(this.handle);this.handle=undefined;}
  const fire=expired&&!this._ended;
  this._deadline=undefined;this._ended=expired;this.storage?.removeItem(SLEEP_TIMER_STORAGE_KEY);this.emit();
  if(fire)this.options.onExpire?.();
 }
 private emit(){for(const listener of this.listeners)listener(this._deadline);}
}

function safeStorage():SleepTimerStorage|undefined{
 try{return typeof localStorage==='undefined'?undefined:localStorage;}catch{return undefined;}
}
