import {Vector3} from 'three';

/** Level-C animation medium, not a measurement of the room or today's seawater. */
export const VIRTUAL_SEAWATER={density:1025,viscosity:1.05e-3,gravity:9.81} as const;
const waves=[
 {k:new Vector3(.7,.3,-.4),a:new Vector3(0,1,.2),period:31,phase:.7,amplitude:.0038},
 {k:new Vector3(-.3,.6,.5),a:new Vector3(1,0,.3),period:47,phase:2.1,amplitude:.0031},
 {k:new Vector3(.2,-.4,.8),a:new Vector3(.2,.1,1),period:19,phase:4.3,amplitude:.0024},
].map(w=>({...w,b:new Vector3().crossVectors(w.k,w.a).normalize()}));
/** Analytically divergence-free: every b is perpendicular to its wave vector k. */
export function virtualCurrent(position:Vector3,time:number,gain=1,out=new Vector3()){
 out.set(0,0,0);
 for(const wave of waves)out.addScaledVector(wave.b,wave.amplitude*gain*Math.sin(wave.k.dot(position)+2*Math.PI*time/wave.period+wave.phase));
 return out;
}
export function reynolds(speed:number,diameter:number){return VIRTUAL_SEAWATER.density*Math.abs(speed)*diameter/VIRTUAL_SEAWATER.viscosity;}

// ---------------------------------------------------------------------------
// J3 (2026-09-27): unified flow = analytic background + low-frequency curl layer + Lagrangian wake rings.
// Every term is solenoidal: Fourier modes with b ⟂ k, and regularised Biot–Savart line elements.
// Nothing here multiplies velocity by a spatial window (that would break ∇·u = 0); rings are only
// scaled by functions of their age, and far rings are skipped beyond RING_CUTOFF radii where the
// dipole field is < 1% of the core speed.
// ---------------------------------------------------------------------------

/**
 * Low-frequency curl-noise layer (Bridson 2007 style, band-limited): u = ∇×ψ with ψ a sum of sinusoids,
 * which reduces to extra divergence-free Fourier modes. Wavelengths 2.9–3.5 m, periods 53–97 s. Amplitudes set so the
 * whole background at the default creature gain (.494) has p50 ≈ .55, p95 ≈ .97 cm/s (research band 0.5–2). Level C.
 */
const curlModes=[
 {k:new Vector3(1.9,.4,-.9),c:new Vector3(0,.3,1),period:71,phase:1.3,amplitude:.0110},
 {k:new Vector3(-.6,1.4,.8),c:new Vector3(1,.2,0),period:97,phase:3.9,amplitude:.0095},
 {k:new Vector3(.9,-1.1,1.6),c:new Vector3(.3,1,.1),period:53,phase:5.2,amplitude:.0080},
].map(m=>({...m,b:new Vector3().crossVectors(m.k,m.c).normalize()}));
export function curlNoiseCurrent(position:Vector3,time:number,gain=1,out=new Vector3()){
 out.set(0,0,0);
 for(const m of curlModes)out.addScaledVector(m.b,m.amplitude*gain*Math.cos(m.k.dot(position)+2*Math.PI*time/m.period+m.phase));
 return out;
}
/** Background field shared by creatures and particles: the J2-accepted modes plus the curl layer. */
export function backgroundCurrent(position:Vector3,time:number,gain=1,out=new Vector3()){
 virtualCurrent(position,time,gain,out);
 const x=out.x,y=out.y,z=out.z;curlNoiseCurrent(position,time,gain,out);
 return out.set(out.x+x,out.y+y,out.z+z);
}

/**
 * Wake ring parameters. Mechanism A (Gemmell 2013: starting ring on contraction, stopping ring kept under
 * the bell on relaxation); geometry B; circulation gain C (see WAKE.circulationGain).
 */
export const WAKE={
 /** elements per ring for the Biot–Savart line integral */
 segments:12,
 /** ring radius ÷ bell diameter: starting ring sits just inside the contracted margin (.49·(1−.145) ≈ .42) */
 startRadius:.40,stopRadius:.34,
 /** centre offset below the bell apex along −axis, ÷ diameter (margin plane is at −.16 D) */
 startDepth:.20,stopDepth:.10,
 /** Rosenhead–Moore core radius ÷ ring radius at birth, and core growth (m²/s, eddy-viscosity-like smoothing) */
 core:.22,coreGrowth:6e-4,
 /**
  * Γ_I = impulse ÷ (ρπR²) from the stroke impulse proxy is ~1e-4 m²/s for JELLY_A, i.e. < .05 cm/s on
  * the ring axis — invisible next to the 0.5–2 cm/s background. The gain is an art calibration (C)
  * chosen so the peak downward speed .5 D below the bell after a contraction is ~1.5–3 cm/s
  * (measured 2.9 cm/s for D .30 m, .38 Hz; Γ0 ≈ .011 m²/s). Not a measured Aurelia circulation.
  */
 circulationGain:120,
 /** stopping/starting circulation ratio (Gemmell 2013 reports the stopping ring can be the stronger one; value B) */
 stopRatio:1,
 /** Γ(age) = Γ0 · ramp(age/rise) · exp(−age/(decayBeats·T)) · window → exactly 0 at lifeBeats·T */
 decayBeats:.8,lifeBeats:3,
 /** multiplier on Kelvin's self-induced speed for the prescribed drift; 3 → the starting ring travels ≈ .5 D
  *  in its life, so it clears the stopping ring instead of cancelling it under the bell (C) */
 driftGain:3,
} as const;
const RING_CUTOFF=6;

export interface WakeSource {
 name:string;kind:'contraction'|'relaxation';time:number;
 position:readonly number[];axis:readonly number[];
 /** stroke impulse proxy along the axis, N·s */
 strength:number;diameter:number;frequency:number;
}
export interface VortexRing {
 source:string;kind:'start'|'stop';time:number;
 /** unit vector of the on-axis induced velocity (jet direction) and of self-propulsion */
 jet:[number,number,number];
 e1:[number,number,number];e2:[number,number,number];
 center:[number,number,number];radius:number;circulation:number;
 rise:number;decay:number;life:number;core:number;drift:number;
}
const tmp=new Vector3();
export function ringFromBeat(event:WakeSource):VortexRing{
 const a=tmp.fromArray(event.axis as number[]).normalize(),D=event.diameter,T=1/Math.max(.05,event.frequency),start=event.kind==='contraction';
 const jet=start?a.clone().negate():a.clone(),radius=D*(start?WAKE.startRadius:WAKE.stopRadius);
 const helper=Math.abs(jet.y)<.9?new Vector3(0,1,0):new Vector3(1,0,0),e1=new Vector3().crossVectors(helper,jet).normalize(),e2=new Vector3().crossVectors(jet,e1);
 const depth=D*(start?WAKE.startDepth:WAKE.stopDepth);
 const center=[event.position[0]-a.x*depth,event.position[1]-a.y*depth,event.position[2]-a.z*depth] as [number,number,number];
 const gammaI=event.strength/(VIRTUAL_SEAWATER.density*Math.PI*radius*radius);
 const circulation=gammaI*WAKE.circulationGain*(start?1:WAKE.stopRatio);
 const core=WAKE.core*radius;
 // Kelvin's thin-ring self-induced speed, used only for the prescribed analytic drift (starting ring).
 const self=circulation/(4*Math.PI*radius)*(Math.log(8*radius/core)-.25);
 return {source:event.name,kind:start?'start':'stop',time:event.time,jet:jet.toArray() as [number,number,number],e1:e1.toArray() as [number,number,number],e2:e2.toArray() as [number,number,number],
  center,radius,circulation,rise:.2*T,decay:WAKE.decayBeats*T,life:WAKE.lifeBeats*T,core,drift:start?self*WAKE.driftGain:0};
}
/** Γ(age)/Γ0: smooth rise over the stroke, exponential decay, and a smooth window reaching exactly 0 at `life`. */
export function ringStrength(ring:VortexRing,age:number){
 if(age<=0||age>=ring.life)return 0;
 const r=Math.min(1,age/ring.rise),rise=r*r*(3-2*r);
 const w=Math.min(1,Math.max(0,(ring.life-age)/(.25*ring.life))),window=w*w*(3-2*w);
 return rise*Math.exp(-age/ring.decay)*window;
}
/** Ring centre at absolute time t (analytic: drift ∫U0·e^(−a/τ) da along the jet). */
export function ringCenter(ring:VortexRing,time:number,out=new Vector3()){
 const age=Math.max(0,time-ring.time),s=ring.drift*ring.decay*(1-Math.exp(-age/ring.decay));
 return out.set(ring.center[0]+ring.jet[0]*s,ring.center[1]+ring.jet[1]*s,ring.center[2]+ring.jet[2]*s);
}
const ringCos=Array.from({length:WAKE.segments},(_,i)=>Math.cos(2*Math.PI*(i+.5)/WAKE.segments)),ringSin=Array.from({length:WAKE.segments},(_,i)=>Math.sin(2*Math.PI*(i+.5)/WAKE.segments));
const centerTmp=new Vector3();
/** Adds one ring's induced velocity at p (m/s). Regularised Biot–Savart, midpoint rule on WAKE.segments elements. */
export function addRingVelocity(ring:VortexRing,p:Vector3,time:number,out:Vector3){
 const age=time-ring.time,s=ringStrength(ring,age);if(s===0)return out;
 const c=ringCenter(ring,time,centerTmp),R=ring.radius;
 const dx0=p.x-c.x,dy0=p.y-c.y,dz0=p.z-c.z;
 if(dx0*dx0+dy0*dy0+dz0*dz0>RING_CUTOFF*RING_CUTOFF*R*R)return out;
 const core=Math.sqrt(ring.core*ring.core+4*WAKE.coreGrowth*age),d2=core*core;
 const G=ring.circulation*s/(4*Math.PI),dl=2*Math.PI*R/WAKE.segments,[a1,a2,a3]=ring.e1,[b1,b2,b3]=ring.e2;
 let ux=0,uy=0,uz=0;
 for(let i=0;i<WAKE.segments;i++){
  const co=ringCos[i],si=ringSin[i];
  // element position x = c + R(co e1 + si e2), direction t = −si e1 + co e2 (counter-clockwise about jet)
  const rx=dx0-R*(co*a1+si*b1),ry=dy0-R*(co*a2+si*b2),rz=dz0-R*(co*a3+si*b3);
  const tx=-si*a1+co*b1,ty=-si*a2+co*b2,tz=-si*a3+co*b3;
  const q=rx*rx+ry*ry+rz*rz+d2,inv=1/(q*Math.sqrt(q));
  ux+=(ty*rz-tz*ry)*inv;uy+=(tz*rx-tx*rz)*inv;uz+=(tx*ry-ty*rx)*inv;
 }
 const k=G*dl;
 out.x+=ux*k;out.y+=uy*k;out.z+=uz*k;
 return out;
}
/**
 * Holds the rings built from beat events (chronological). `sample` adds the rings active at `time`,
 * optionally excluding one source's own rings (root drag: its propulsion is already in PULSE/PER).
 */
export function createWakeField(){
 let rings:VortexRing[]=[],maxLife=0;
 return {
  get rings():readonly VortexRing[]{return rings;},
  set(sources:readonly WakeSource[]){rings=sources.map(ringFromBeat);maxLife=rings.reduce((m,r)=>Math.max(m,r.life),0);},
  push(source:WakeSource){const ring=ringFromBeat(source);rings.push(ring);maxLife=Math.max(maxLife,ring.life);return ring;},
  trim(count:number){if(rings.length>count)rings=rings.slice(rings.length-count);},
  clear(){rings=[];maxLife=0;},
  sample(p:Vector3,time:number,exclude?:string,out=new Vector3()){
   // rings are chronological: walk back from the newest until older than the longest life
   for(let i=rings.length-1;i>=0;i--){const r=rings[i];if(r.time>time)continue;if(time-r.time>=maxLife)break;if(exclude!==undefined&&r.source===exclude)continue;addRingVelocity(r,p,time,out);}
   return out;
  },
 };
}
