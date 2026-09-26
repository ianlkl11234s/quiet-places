import * as THREE from 'three';
import {JELLY_PRESETS} from './CreatureMotion.ts';

/**
 * J4 (2026-09-27) flow visualisation candidate: fine grey "marine snow" / room dust advected by the same
 * sampleFlow the creatures use (background + wake rings), visible only inside the window light shaft.
 * It is the scene's one impossible thing made legible (water that cannot be seen), not a second one:
 * no hue, no emission, no bloom (all colour ≤ .62 linear, below the 1.05 bloom threshold).
 */
export type MarineSnowMode='off'|'particles'|'particles-dense';
export const MARINE_SNOW_MODES:readonly MarineSnowMode[]=['off','particles','particles-dense'];
export const MARINE_SNOW={
 /** simulated = drawn particle count per mode; lowQuality keeps 60% */
 count:{off:0,particles:1800,'particles-dense':3000} as Record<MarineSnowMode,number>,
 /** fixed integration grid (s) and particle life (s); positions depend only on (index, generation, elapsed) */
 step:1/30,life:14,fade:1.6,
 /** slow settling, m/s (C: art value; real marine-snow sinking speeds vary by orders of magnitude) */
 settle:.0003,
 /** spawn volume (scene-local metres) and the share clustered around the three jelly home positions */
 box:{min:[-.85,.9,-4.3],max:[3.0,4.5,-1.7]},cluster:.6,clusterSigma:.34,
 grey:.92,
} as const;
/**
 * Window light shaft (C, art-directed volume, not a shadow computation): light from an aperture on the
 * glazing plane z=−4.42 behind the creatures travels along `direction`; a point is lit if its back-projection
 * onto the glass falls inside the aperture. Soft edge inside the aperture, hard 0 outside, and falloff with
 * depth into the room. Scene-local coordinates (the snowwindow root), same as CreatureMotion.
 */
export const WINDOW_SHAFT={glassZ:-4.42,direction:new THREE.Vector3(.22,-.42,1).normalize(),aperture:{x0:-.95,x1:2.45,y0:2.55,y1:4.45},soft:.32,falloff:2.1} as const;
export function windowShaftMask(x:number,y:number,z:number){
 const {glassZ,direction:d,aperture:a,soft,falloff}=WINDOW_SHAFT,depth=z-glassZ;
 if(depth<=0)return 0;
 const qx=x-d.x*depth/d.z,qy=y-d.y*depth/d.z,ex=Math.min(qx-a.x0,a.x1-qx),ey=Math.min(qy-a.y0,a.y1-qy);
 if(ex<=0||ey<=0)return 0;
 const s=(v:number)=>{const t=Math.min(1,v/soft);return t*t*(3-2*t);};
 return s(ex)*s(ey)*Math.exp(-depth/falloff);
}
const shaftGLSL=/* glsl */`
uniform vec3 uShaftDir;uniform vec4 uAperture;uniform vec3 uShaft; // glassZ, soft, falloff
float windowShaftMask(vec3 p){
 float depth=p.z-uShaft.x;if(depth<=0.)return 0.;
 vec2 q=p.xy-uShaftDir.xy*depth/uShaftDir.z;
 float ex=min(q.x-uAperture.x,uAperture.y-q.x),ey=min(q.y-uAperture.z,uAperture.w-q.y);
 if(ex<=0.||ey<=0.)return 0.;
 return smoothstep(0.,1.,ex/uShaft.y)*smoothstep(0.,1.,ey/uShaft.y)*exp(-depth/uShaft.z);
}`;

const hash=(a:number,b:number)=>{let h=Math.imul(a^0x9e3779b9,0x85ebca6b)^Math.imul(b+0x632be5ab,0xc2b2ae35);h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;return h>>>0;};
const rngFor=(i:number,g:number)=>{let s=hash(i,g)||1;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};};
export type FlowSampler=(p:THREE.Vector3,time:number,out:THREE.Vector3)=>THREE.Vector3;

/** Where jelly k was at (or just before) `time`, scene-local; undefined → its preset home. */
export type JellyAnchor=(k:number,time:number)=>readonly number[]|undefined;
/** Anchor from the creature beat log: jelly k's position at its latest beat with time ≤ t (replayed identically on rewind). */
export function anchorFromBeatEvents(events:()=>readonly {index:number;time:number;position:readonly number[]}[]):JellyAnchor{
 return (k,time)=>{const list=events();for(let i=list.length-1;i>=0;i--)if(list[i].index===k&&list[i].time<=time)return list[i].position;return undefined;};
}
/** Deterministic spawn for particle i, generation g (scene-local metres), clustered around the jellies at spawn time. */
export function marineSnowSpawn(i:number,g:number,out:number[]=[0,0,0],time=0,anchor?:JellyAnchor){
 const r=rngFor(i,g),{min,max}=MARINE_SNOW.box;
 if(r()<MARINE_SNOW.cluster){
  const k=Math.floor(r()*3)%3,home=anchor?.(k,time)??JELLY_PRESETS[k].position,gauss=()=>{const u=Math.max(1e-9,r()),v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
  for(let a=0;a<3;a++)out[a]=THREE.MathUtils.clamp(home[a]+MARINE_SNOW.clusterSigma*gauss(),min[a],max[a]);
 }else for(let a=0;a<3;a++)out[a]=min[a]+(max[a]-min[a])*r();
 return out;
}

export function createMarineSnow(options:{sampleFlow:FlowSampler;mode?:MarineSnowMode;anchor?:JellyAnchor}){
 const capacity=MARINE_SNOW.count['particles-dense'],dt=MARINE_SNOW.step,lifeSteps=Math.round(MARINE_SNOW.life/dt),fadeSteps=MARINE_SNOW.fade/dt;
 let mode:MarineSnowMode=options.mode??'particles',active=0,simStep=Number.NaN,lowQuality=false;
 const cur=new Float64Array(capacity*3),prev=new Float64Array(capacity*3),offset=new Int32Array(capacity),size=new Float32Array(capacity);
 for(let i=0;i<capacity;i++){const r=rngFor(i,-1);offset[i]=Math.floor(r()*lifeSteps);size[i]=.55+.9*r()*r();}
 const geometry=new THREE.BufferGeometry(),positions=new Float32Array(capacity*3),fades=new Float32Array(capacity);
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aFade',new THREE.BufferAttribute(fades,1));geometry.setAttribute('aSize',new THREE.BufferAttribute(size,1));
 geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(1.1,2.7,-3),4);
 const uniforms={uShaftDir:{value:WINDOW_SHAFT.direction.clone()},uAperture:{value:new THREE.Vector4(WINDOW_SHAFT.aperture.x0,WINDOW_SHAFT.aperture.x1,WINDOW_SHAFT.aperture.y0,WINDOW_SHAFT.aperture.y1)},uShaft:{value:new THREE.Vector3(WINDOW_SHAFT.glassZ,WINDOW_SHAFT.soft,WINDOW_SHAFT.falloff)},
  uLight:{value:1},uGrey:{value:MARINE_SNOW.grey},uPixel:{value:900},uOpacity:{value:.8}};
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,blending:THREE.NormalBlending,
  vertexShader:/* glsl */`
   attribute float aFade,aSize;uniform float uPixel,uLight,uOpacity;varying float vAlpha;
   ${shaftGLSL}
   void main(){
    // position is scene-local (parent = snowwindow root), the frame the shaft is defined in
    float shaft=windowShaftMask(position);
    vec4 mv=modelViewMatrix*vec4(position,1.);float dist=-mv.z;
    // micro-dust reading: sub-2 px points, fainter with distance, and faded out right in front of the lens
    gl_PointSize=clamp(aSize*uPixel*.0032/max(.2,dist),1.3,2.4);
    float range=smoothstep(.7,1.5,dist)*(1.-.55*smoothstep(2.,5.5,dist));
    vAlpha=shaft>0.?shaft*aFade*range*uOpacity*(.1+.9*uLight):0.;
    gl_Position=projectionMatrix*mv;
    if(vAlpha<=0.)gl_Position=vec4(2.,2.,2.,1.); // outside the shaft: clipped, never rasterised
   }`,
  fragmentShader:/* glsl */`
   uniform float uGrey,uLight;varying float vAlpha;
   void main(){
    float a=vAlpha*(1.-smoothstep(.2,.5,length(gl_PointCoord-.5)));
    if(a<.003)discard;
    // neutral grey only (R=G=B), scaled by the room light level: no hue, no emission term
    gl_FragColor=vec4(vec3(uGrey*uLight),a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 const points=new THREE.Points(geometry,material);points.name='snowwindow-marine-snow';points.frustumCulled=false;points.renderOrder=0;
 const p=new THREE.Vector3(),u=new THREE.Vector3(),spawn=[0,0,0];
 const generation=(i:number,step:number)=>Math.floor((step-offset[i])/lifeSteps);
 const respawn=(i:number,g:number)=>{marineSnowSpawn(i,g,spawn,(offset[i]+g*lifeSteps)*dt,options.anchor);const j=i*3;cur[j]=prev[j]=spawn[0];cur[j+1]=prev[j+1]=spawn[1];cur[j+2]=prev[j+2]=spawn[2];};
 /** One explicit Euler step of particle i from step n to n+1 (flow sampled at n·dt). Shared by every path. */
 const advect=(i:number,n:number)=>{const j=i*3;p.set(cur[j],cur[j+1],cur[j+2]);options.sampleFlow(p,n*dt,u);prev[j]=cur[j];prev[j+1]=cur[j+1];prev[j+2]=cur[j+2];cur[j]+=u.x*dt;cur[j+1]+=(u.y-MARINE_SNOW.settle)*dt;cur[j+2]+=u.z*dt;};
 /** Rebuild particle i at step `target` from its generation's spawn step (rewind, jump, first frame). */
 const rebuild=(i:number,target:number)=>{const g=generation(i,target),start=offset[i]+g*lifeSteps;respawn(i,g);for(let n=start;n<target;n++)advect(i,n);};
 const advanceTo=(target:number)=>{
  if(!Number.isFinite(simStep)||target<simStep||target-simStep>lifeSteps){for(let i=0;i<active;i++)rebuild(i,target);simStep=target;return;}
  for(let n=simStep;n<target;n++)for(let i=0;i<active;i++){if(generation(i,n+1)!==generation(i,n))respawn(i,generation(i,n+1));else advect(i,n);}
  simStep=target;
 };
 const setCount=()=>{const next=Math.round(MARINE_SNOW.count[mode]*(lowQuality?.6:1));if(next!==active){active=next;simStep=Number.NaN;}geometry.setDrawRange(0,active);points.visible=active>0;};
 setCount();
 let disposed=false;
 return {points,
  get mode(){return mode;},get activeCount(){return active;},
  /** simulated scene-local positions at the last update (read-only view, for tests/tools) */
  get positions():Float64Array{return cur;},
  /** generation index of particle i at the last update (a change means it respawned) */
  generationOf(i:number){return generation(i,simStep);},
  setMode(next:MarineSnowMode){if(!MARINE_SNOW_MODES.includes(next))throw new RangeError(`Unknown marine snow mode ${next}`);mode=next;setCount();},
  update(elapsed:number,light:number,quality=false,pixelScale=900){
   if(disposed)return;
   if(!Number.isFinite(elapsed)||elapsed<0)throw new RangeError('Marine snow elapsed must be finite and nonnegative.');
   if(quality!==lowQuality){lowQuality=quality;setCount();}
   if(active===0)return;
   const target=Math.floor(elapsed/dt+1e-7);advanceTo(target);
   const frac=elapsed/dt-target;
   for(let i=0;i<active;i++){
    const j=i*3,age=((target-offset[i])%lifeSteps+lifeSteps)%lifeSteps,fresh=age===0;
    for(let a=0;a<3;a++)positions[j+a]=fresh?cur[j+a]:cur[j+a]+(cur[j+a]-prev[j+a])*Math.min(1,frac);
    const t=Math.min(age+frac,lifeSteps);fades[i]=Math.min(1,t/fadeSteps,(lifeSteps-t)/fadeSteps);
   }
   (geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;(geometry.getAttribute('aFade') as THREE.BufferAttribute).needsUpdate=true;
   uniforms.uLight.value=THREE.MathUtils.clamp(light,0,1);uniforms.uPixel.value=pixelScale;
  },
  dispose(){if(disposed)return;disposed=true;points.removeFromParent();geometry.dispose();material.dispose();}};
}
