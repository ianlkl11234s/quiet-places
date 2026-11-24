import * as THREE from 'three';

/**
 * B4 schooling candidates shared by the seabridge sardines and the Kuroshio
 * arcade schools (QUALITY_WORKFLOW §4: one switch each; switched off, both
 * systems run their former code paths and reproduce the former output bit for
 * bit). Every value is art calibration of a qualitative behaviour, not a
 * measurement; see docs/biology/sardine.md and kuroshio-small-schools.md.
 */

/** Burst-and-coast: a few tail beats, then a glide. false = former continuous swimming. */
export const SCHOOL_BURST_COAST=true;
/** Alignment and cohesion use the k nearest school mates (separation stays metric). 0 = former radius rule. */
export const SCHOOL_TOPOLOGICAL_NEIGHBOURS=7;
/** Extra roll during escapes and sharp startle turns (0..1 of FLASH_MAX_ROLL). 0 = off. */
export const SCHOOL_FLASH_BANK=.6;

export interface SchoolCandidateOptions {burstCoast?:boolean;topologicalNeighbours?:number;flashBank?:number;pointerResponse?:number}
export interface SchoolCandidates {burstCoast:boolean;neighbours:number;flashBank:number;pointerResponse:number}
export function resolveSchoolCandidates(options:SchoolCandidateOptions,pointerDefault=0):SchoolCandidates{
 const k=Math.max(0,Math.floor(options.topologicalNeighbours??SCHOOL_TOPOLOGICAL_NEIGHBOURS));
 return {burstCoast:options.burstCoast??SCHOOL_BURST_COAST,neighbours:Number.isFinite(k)?k:0,
  flashBank:THREE.MathUtils.clamp(options.flashBank??SCHOOL_FLASH_BANK,0,1),pointerResponse:THREE.MathUtils.clamp(options.pointerResponse??pointerDefault,0,1)};
}

/* ---------------------------------------------------------------- burst and coast */
export interface BurstCoastParams {
 /** Per-fish cycle length range, s. */
 periodMin:number;periodMax:number;
 /** Fraction of the cycle spent beating, 0..1. */
 burstFraction:number;
 /** Target-speed gain during the burst; the coast target is lowered so the cycle mean stays 1. */
 burstGain:number;
 /** Tail amplitude multiplier left while coasting. */
 coastTail:number;
}
const RAMP=.08;
/** Desired-speed multiplier over one cycle (u in cycles): piecewise constant, cycle mean exactly 1. */
export function burstCoastSpeed(u:number,p:BurstCoastParams){
 const c=u-Math.floor(u);return c<p.burstFraction?1+p.burstGain:1-p.burstGain*p.burstFraction/(1-p.burstFraction);
}
/** Tail amplitude multiplier: 1 while beating, coastTail while gliding, smooth edges, continuous across the wrap. */
export function burstCoastTail(u:number,p:BurstCoastParams){
 const c=u-Math.floor(u),on=THREE.MathUtils.smoothstep(c,0,RAMP)*(1-THREE.MathUtils.smoothstep(c,p.burstFraction,p.burstFraction+RAMP));
 return p.coastTail+(1-p.coastTail)*on;
}

/* ---------------------------------------------------------- topological neighbours */
/**
 * Keeps the k smallest distances seen so far in fixed, preallocated arrays
 * (ascending). Returns the new fill count. No allocation; O(k) only when the
 * candidate beats the current k-th neighbour.
 */
export function insertNearest(dist:Float64Array,index:Int32Array,k:number,count:number,d:number,j:number){
 let pos:number;
 if(count<k)pos=count++;else if(d>=dist[k-1])return count;else pos=k-1;
 while(pos>0&&dist[pos-1]>d){dist[pos]=dist[pos-1];index[pos]=index[pos-1];pos--;}
 dist[pos]=d;index[pos]=j;return count;
}

/* ---------------------------------------------------------------------- flash bank */
/** Largest extra roll at SCHOOL_FLASH_BANK = 1, rad (0.6 gives ~21°). */
export const FLASH_MAX_ROLL=35*Math.PI/180;
/** Envelope length range (s) and the wait before the same fish can flash again (s). */
export const FLASH_DURATION={min:.55,max:.85},FLASH_REFRACTORY=1.2;
export interface FlashState {flashAge:number;flashSign:number;flashDuration:number;flash:number}
/**
 * One fixed step. A flash starts only while the fish is startled and turning
 * faster than `yawThreshold`; it rises and falls on a sin² envelope (zero slope
 * at both ends), so the roll always returns smoothly to the turn bank.
 */
export function stepFlash(f:FlashState,startled:boolean,yawRate:number,yawThreshold:number,gain:number,dt:number){
 f.flashAge+=dt;
 if(startled&&Math.abs(yawRate)>yawThreshold&&f.flashAge>f.flashDuration+FLASH_REFRACTORY){f.flashAge=0;f.flashSign=Math.sign(yawRate);}
 if(f.flashAge<f.flashDuration){const s=Math.sin(Math.PI*f.flashAge/f.flashDuration);f.flash=f.flashSign*Math.min(FLASH_MAX_ROLL,gain*FLASH_MAX_ROLL)*s*s;}
 else f.flash=0;
 return f.flash;
}

/* ------------------------------------------------------------------ pointer ray */
/** Pointer still for longer than this (s) starts to habituate; fully ignored after HABITUATE_END. */
export const HABITUATE_START=1.8,HABITUATE_END=2.8;
/** Tap startle cooldown, s. */
export const POINTER_TAP_COOLDOWN=7;
const STILL_DOT=Math.cos(.25*Math.PI/180),STILL_MOVE2=.01*.01;
export interface PointerState {active:boolean;origin:THREE.Vector3;direction:THREE.Vector3;lastMove:number;tapPending:boolean;cooldownUntil:number;startles:number}
export function createPointerState():PointerState{return {active:false,origin:new THREE.Vector3(),direction:new THREE.Vector3(0,0,-1),lastMove:-Infinity,tapPending:false,cooldownUntil:-Infinity,startles:0};}
/** Copies the borrowed ray's values; a camera that drifts by less than .25° / 1 cm counts as still. */
export function notePointer(s:PointerState,ray:THREE.Ray|undefined,tap:boolean,now:number){
 if(!ray){s.active=false;s.tapPending=false;return;}
 const moved=!s.active||s.origin.distanceToSquared(ray.origin)>STILL_MOVE2||s.direction.dot(ray.direction)<STILL_DOT;
 if(moved){s.lastMove=now;s.origin.copy(ray.origin);s.direction.copy(ray.direction).normalize();}
 s.active=true;if(tap)s.tapPending=true;
}
/** Avoidance weight 0..response: full while the pointer moves, habituates when it rests. */
export function pointerWeight(s:PointerState,response:number,now:number){
 if(!s.active||response<=0)return 0;
 return response*(1-THREE.MathUtils.smoothstep(now-s.lastMove,HABITUATE_START,HABITUATE_END));
}
/** Distance from a point to the ray (to the origin when behind it). Writes the away vector (unnormalised) to `out`. */
export function rayDistance(s:PointerState,x:number,y:number,z:number,out?:THREE.Vector3){
 const ox=x-s.origin.x,oy=y-s.origin.y,oz=z-s.origin.z,t=Math.max(0,ox*s.direction.x+oy*s.direction.y+oz*s.direction.z);
 const ax=ox-s.direction.x*t,ay=oy-s.direction.y*t,az=oz-s.direction.z*t;
 if(out)out.set(ax,ay,az);
 return Math.hypot(ax,ay,az);
}
