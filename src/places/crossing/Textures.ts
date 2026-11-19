import * as THREE from 'three';

/**
 * Procedural PBR textures for the crossing deck, generated once at load (no fragment-shader noise, no image files, no text).
 * Every generator returns null when there is no DOM (node tests), so geometry code stays testable.
 * Tiles: paint and deck repeat every 2.4 m of world space (meshes get world-metric UVs, see worldUV in Graybox.ts).
 */
export interface Pbr{map:THREE.Texture;normalMap:THREE.Texture;roughnessMap?:THREE.Texture}
export const TILE=2.4;
/** Master strength of all surface wear and relief (rust, dirt, chips, seams, wear, damp, normal maps). 1 = the first, heavy pass; user asked for subtle (2026-11-19). */
export const SURFACE_STRENGTH=.45;
const S=SURFACE_STRENGTH;

function makeNoise(seed:number){
 const G=512,t=new Float32Array(G*G);let s=seed>>>0;
 const rnd=()=>{s=(s+0x6D2B79F5)>>>0;let z=s;z=Math.imul(z^(z>>>15),z|1);z^=z+Math.imul(z^(z>>>7),z|61);return((z^(z>>>14))>>>0)/4294967296;};
 for(let i=0;i<t.length;i++)t[i]=rnd();
 const at=(x:number,y:number,p:number)=>{
  const xi=Math.floor(x),yi=Math.floor(y);let fx=x-xi,fy=y-yi;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
  const x0=((xi%p)+p)%p,x1=(x0+1)%p,y0=((yi%p)+p)%p,y1=(y0+1)%p;
  const a=t[y0*G+x0],b=t[y0*G+x1],c=t[y1*G+x0],d=t[y1*G+x1];
  return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;
 };
 /** Tileable fractal noise, u,v in 0..1 (one tile), f = lattice cells per tile at the first octave. */
 const fbm=(u:number,v:number,f:number,oct:number)=>{let s2=0,a=.5,n=0;for(let o=0;o<oct;o++){s2+=a*at(u*f,v*f,f);n+=a;f*=2;a*=.5;}return s2/n;};
 return {rnd,fbm};
}
const sstep=(a:number,b:number,x:number)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const clamp01=(x:number)=>x<0?0:x>1?1:x;

/** Height field -> tangent-space normal map (OpenGL convention, wraps at the borders). */
function heightToNormal(H:Float32Array,w:number,h:number,strength:number){
 const out=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const xl=(x+w-1)%w,xr=(x+1)%w,yu=(y+h-1)%h,yd=(y+1)%h;
  const dx=(H[y*w+xr]-H[y*w+xl])*strength,dy=(H[yd*w+x]-H[yu*w+x])*strength;
  let nx=-dx,ny=dy,nzv=1;const l=Math.hypot(nx,ny,nzv);nx/=l;ny/=l;nzv/=l;
  const i=(y*w+x)*4;out[i]=(nx*.5+.5)*255;out[i+1]=(ny*.5+.5)*255;out[i+2]=(nzv*.5+.5)*255;out[i+3]=255;
 }
 return out;
}
function toTexture(w:number,h:number,rgba:Uint8ClampedArray,srgb:boolean){
 const c=document.createElement('canvas');c.width=w;c.height=h;
 const ctx=c.getContext('2d')!;ctx.putImageData(new ImageData(rgba as unknown as Uint8ClampedArray<ArrayBuffer>,w,h),0,0);
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=8;t.needsUpdate=true;
 return t;
}
function rgbaFromFloats(A:Float32Array,w:number,h:number){
 const o=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<w*h;i++){o[i*4]=A[i*3]*255;o[i*4+1]=A[i*3+1]*255;o[i*4+2]=A[i*3+2]*255;o[i*4+3]=255;}
 return o;
}
function roughnessRgba(R:Float32Array,w:number,h:number){
 const o=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<w*h;i++){const v=clamp01(R[i])*255;o[i*4]=v;o[i*4+1]=v;o[i*4+2]=v;o[i*4+3]=255;}
 return o;
}
const hasDom=()=>typeof document!=='undefined';

/** White steel plate paint: orange peel, 1.2 m plate seams (welded verticals, riveted lap seams), bolts, rust runs, chips, touch-up patches. */
export function paintTextures():Pbr|null{
 if(!hasDom())return null;
 const N=1024,T=TILE,PPM=N/T,nz=makeNoise(11),{rnd}=nz;
 const H=new Float32Array(N*N),R=new Float32Array(N*N),A=new Float32Array(N*N*3);
 const seam=(w:number,off:number)=>{const m=(((w-off)%1.2)+1.2)%1.2;return Math.min(m,1.2-m);};
 for(let y=0;y<N;y++){const v=1-(y+.5)/N,wv=v*T;
  for(let x=0;x<N;x++){const u=(x+.5)/N,wu=u*T,i=y*N+x;
   const peel=nz.fbm(u,v,48,2),fine=nz.fbm(u,v,170,1),blot=nz.fbm(u,v,4,3),mid=nz.fbm(u,v,14,2);
   const du=seam(wu,0),dv=seam(wv,.6);
   const gU=Math.exp(-((du/.0035)**2)),gV=Math.exp(-((dv/.0035)**2));
   const weldN=.65+.35*nz.fbm(v*3,.37,24,2);
   const bead=Math.exp(-((du/.011)**2))*weldN,lap=Math.exp(-(((dv-.012)/.005)**2));
   H[i]=.5+(peel-.5)*.55+(fine-.5)*.4-.5*gU-.4*gV+.34*bead+.24*lap;
   let al=.945+.055*peel+(blot-.5)*.09-(mid-.5)*.03;
   al*=1-.4*Math.max(gU,gV)-.07*bead;
   R[i]=.6+(peel-.5)*.24+.22*Math.max(gU,gV)-.06*bead;
   al=1-(1-al)*S*1.3;
   const k=i*3;A[k]=al*1.0;A[k+1]=al*1.0;A[k+2]=al*(1-.015*S);
  }}
 const dome=(cx:number,cy:number,r:number,amp:number,dark:number)=>{
  for(let dy=-r-2;dy<=r+2;dy++)for(let dx=-r-2;dx<=r+2;dx++){
   const d=Math.hypot(dx,dy),x=((Math.round(cx)+dx)%N+N)%N,y=((Math.round(cy)+dy)%N+N)%N,i=y*N+x;
   if(d<r){H[i]+=amp*(1-(d/r)**2);const hl=1-dark*(dx+dy>0?.8:.1)*(d/r);A[i*3]*=hl;A[i*3+1]*=hl;A[i*3+2]*=hl;R[i]=.5;}
   else if(d<r+2){A[i*3]*=1-dark*.8;A[i*3+1]*=1-dark*.8;A[i*3+2]*=1-dark*.8;H[i]-=amp*.2;}
  }};
 const streaks:number[][]=[];
 const px=(wu:number)=>(wu/T)*N,py=(wv:number)=>(1-wv/T)*N;
 // Rivet rows on both sides of each horizontal lap seam.
 for(const sv of[.6,1.8])for(const off of[-.024,.028])for(let k=0;k<24;k++){
  const cx=px(k*.1+.05),cy=py(sv+off);dome(cx,cy,6,1.1,.16*S);
  if(rnd()<.1)streaks.push([cx,cy+4,70+rnd()*100,2+rnd()*2,(.28+rnd()*.2)*S]);
 }
 // Bolts at plate corners.
 for(const bu of[0,1.2])for(const bv of[.6,1.8]){dome(px(bu),py(bv),10,1.4,.2*S);streaks.push([px(bu),py(bv)+8,120+rnd()*60,3.2,.42*S]);}
 // Rust runs: long, thin, faint; a few wider salt-water marks hanging from the lap seams.
 for(let k=0;k<2;k++)streaks.push([px(rnd()*T),py(.6+1.2*Math.floor(rnd()*2))+4,160+rnd()*100,5+rnd()*4,.12*S]);
 for(const [sx,sy,len,w,a] of streaks){
  for(let k=0;k<len;k++){
   const t=k/len,wob=Math.sin(k*.06+sx)*1.3,al=a*(1-t)**1.3*(.65+.35*rnd());
   for(let dx=-Math.ceil(w);dx<=Math.ceil(w);dx++){
    const wgt=Math.max(0,1-Math.abs(dx)/(w+.5)),xx=((Math.round(sx+wob)+dx)%N+N)%N,yy=(Math.round(sy+k)%N+N)%N,i=yy*N+xx,m=al*wgt;
    A[i*3]+=(.66-A[i*3])*m;A[i*3+1]+=(.40-A[i*3+1])*m;A[i*3+2]+=(.26-A[i*3+2])*m;R[i]=R[i]*(1-m)+.8*m;
   }}
 }
 // Chipped paint showing grey primer, mostly sparse.
 for(let c=0;c<3;c++){
  const cx=rnd()*N,cy=rnd()*N,r=2+rnd()*4,sd=rnd()*100;
  for(let dy=-12;dy<=12;dy++)for(let dx=-12;dx<=12;dx++){
   const a=Math.atan2(dy,dx),rr=r*(.7+.5*Math.sin(a*3+sd)*Math.sin(a*5+sd*2)),d=Math.hypot(dx,dy);if(d>rr)continue;
   const x=((Math.round(cx)+dx)%N+N)%N,y=((Math.round(cy)+dy)%N+N)%N,i=y*N+x,edge=d>rr*.7;
   A[i*3]=edge?.86:.76;A[i*3+1]=edge?.84:.78;A[i*3+2]=edge?.80:.80;H[i]-=.14*S;R[i]=.92;
  }}
 // Touch-up patches: slightly different white.
 for(const [rx,ry,rw,rh,s] of[[.2,.1,.45,.3,.97],[.62,.55,.3,.38,1.025],[.1,.7,.34,.22,.975]]){
  for(let y=Math.floor(ry*N);y<(ry+rh)*N;y++)for(let x=Math.floor(rx*N);x<(rx+rw)*N&&x<N;x++){
   const i=(y%N)*N+x;const ss=1+(s-1)*S;A[i*3]*=ss;A[i*3+1]*=ss;A[i*3+2]*=ss;
   if(x===Math.floor(rx*N)||y===Math.floor(ry*N)||x===Math.floor((rx+rw)*N)-1)H[i]+=.18;
  }}
 return {map:toTexture(N,N,rgbaFromFloats(A,N,N),true),normalMap:toTexture(N,N,heightToNormal(H,N,N,3.4*S),false),roughnessMap:toTexture(N,N,roughnessRgba(R,N,N),false)};
}

/** Dark green anti-slip deck paint: grit, 1.2 m weld seams, pale salt-scuffed patches, damp patches. Colour is baked (use white material colour). */
export function deckTextures():Pbr|null{
 if(!hasDom())return null;
 const N=1024,T=TILE,nz=makeNoise(29),{rnd}=nz;
 const H=new Float32Array(N*N),R=new Float32Array(N*N),A=new Float32Array(N*N*3);
 const base=[.18,.42,.31],pale=[.46,.58,.50],seam=(w:number)=>{const m=((w%1.2)+1.2)%1.2;return Math.min(m,1.2-m);};
 for(let y=0;y<N;y++){const v=1-(y+.5)/N;
  for(let x=0;x<N;x++){const u=(x+.5)/N,i=y*N+x;
   const wear=sstep(.5,.7,nz.fbm(u,v,9,4)*.7+nz.fbm(u,v,38,2)*.3)*S,damp=sstep(.58,.7,nz.fbm(u+.31,v+.17,5,3))*S;
   const g=rnd(),g2=nz.fbm(u,v,220,1),sc=nz.fbm(u*1.0,v*.14,60,2);
   const sdu=seam(u*T),sdv=seam(v*T),gr=Math.exp(-((Math.min(sdu,sdv)/.004)**2));
   const salt=sstep(.55,.75,nz.fbm(u,v,24,3))*wear;
   let k=1+((g2-.5)*.18+(sc-.5)*.1)*S;k*=1-.3*gr*S;
   const sp=g<.06?1.7:g<.09?.55:1;
   for(let c=0;c<3;c++){let col=base[c]+(pale[c]-base[c])*(wear*.78+salt*.2);col*=k*(1-damp*.3)*(1+(sp-1)*S*(c===1?.55:.8));A[i*3+c]=col;}
   H[i]=(g-.5)*.7+(g2-.5)*.6-.5*gr+.15*wear;
   R[i]=.5+wear*.32-damp*.3+(g<.06?.12:0)-.06*salt+.18*gr+(sc-.5)*.08;
  }}
 // Faint dried drain-water streaks, mostly along one direction.
 for(let k=0;k<26;k++){const sx=rnd()*N,sy=rnd()*N,len=80+rnd()*240;for(let j=0;j<len;j++){const t=j/len,xx=Math.round(sx+Math.sin(j*.03+sx)*2+j*.1)%N,yy=Math.round(sy+j)%N,i=yy*N+xx,m=.16*S*Math.sin(t*Math.PI);for(let c=0;c<3;c++)A[i*3+c]+=(pale[c]-A[i*3+c])*m;R[i]+=.12*m;}}
 return {map:toTexture(N,N,rgbaFromFloats(A,N,N),true),normalMap:toTexture(N,N,heightToNormal(H,N,N,2.8*S),false),roughnessMap:toTexture(N,N,roughnessRgba(R,N,N),false)};
}

/** Canvas awning: plain weave (3.9 mm thread pitch), dirty cream with brown stains. Tile 0.25 m. */
export function canvasTextures():Pbr|null{
 if(!hasDom())return null;
 const N=512,nz=makeNoise(53),P=8;
 const H=new Float32Array(N*N),A=new Float32Array(N*N*3);
 for(let y=0;y<N;y++){const v=1-(y+.5)/N;
  for(let x=0;x<N;x++){const u=(x+.5)/N,i=y*N+x,ix=Math.floor(x/P),iy=Math.floor(y/P),over=(ix+iy)%2===0;
   const fx=(x%P)/P,fy=(y%P)/P,cu=Math.sin(fx*Math.PI),cv=Math.sin(fy*Math.PI);
   const h=over?cu*(.55+.45*cv):cv*(.55+.45*cu);
   H[i]=h*.8+(nz.fbm(u,v,128,1)-.5)*.3;
   const stain=nz.fbm(u,v,3,3),slub=nz.fbm(u,v,64,1);
   const k=.9+.1*h+(slub-.5)*.08,st=sstep(.45,.85,stain)*.11*S;
   A[i*3]=.90*k*(1-st*.45);A[i*3+1]=.84*k*(1-st*.8);A[i*3+2]=.70*k*(1-st*1.2);
  }}
 return {map:toTexture(N,N,rgbaFromFloats(A,N,N),true),normalMap:toTexture(N,N,heightToNormal(H,N,N,3.2*S),false)};
}

/** One woven strap (3.7 x 4.6 cm quad, own UV 0..1): crowned cross-section, lengthwise fibres, bulge over the crossing strap, darker ends. */
export function strapTextures(rgb:[number,number,number],alongV:boolean):Pbr|null{
 if(!hasDom())return null;
 const N=128,nz=makeNoise(alongV?71:73),H=new Float32Array(N*N),A=new Float32Array(N*N*3);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const u=x/N,v=1-y/N,c=alongV?u:v,l=alongV?v:u,i=y*N+x;
  const crown=Math.pow(Math.sin(Math.PI*Math.min(.999,Math.max(.001,c))),.55),bulge=.5-.5*Math.cos(2*Math.PI*l);
  const fib=Math.sin(c*Math.PI*22+nz.fbm(l,c,6,1)*6)*.5+.5;
  H[i]=crown*(.55+.45*bulge)+fib*.05;
  const edge=1-.28*Math.pow(1-crown,1.5),end=1-.38*(1-sstep(0,.2,l))-.38*(1-sstep(0,.2,1-l)),sp=.95+.1*fib+(nz.fbm(l,c,24,1)-.5)*.08;
  for(let ch=0;ch<3;ch++)A[i*3+ch]=rgb[ch]*edge*end*sp;
 }
 return {map:toTexture(N,N,rgbaFromFloats(A,N,N),true),normalMap:toTexture(N,N,heightToNormal(H,N,N,5*S),false)};
}

/** Blue cabin door: painted steel with scratches, edge wear and a dirty foot. Own UV per face. */
export function doorTexture():THREE.Texture|null{
 if(!hasDom())return null;
 const W=256,Hh=512,nz=makeNoise(97),{rnd}=nz,A=new Float32Array(W*Hh*3);
 const base=[.25,.51,.84];
 for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){
  const u=x/W,v=1-y/Hh,i=y*W+x,b=nz.fbm(u,v,5,3),foot=sstep(.22,0,v)*.35,edge=sstep(.05,0,Math.min(u,1-u,v,1-v))*.25;
  const k=.93+(b-.5)*.14-foot*.35+edge*.4;
  A[i*3]=base[0]*k+edge*.3;A[i*3+1]=base[1]*k+edge*.3;A[i*3+2]=base[2]*k+edge*.2;
 }
 for(let s=0;s<Math.round(22*S);s++){ // scratches: short light lines
  let sx=rnd()*W,sy=rnd()*Hh;const a=rnd()*Math.PI,len=10+rnd()*50,al=.18+rnd()*.25;
  for(let k=0;k<len;k++){const xx=Math.round(sx+Math.cos(a)*k),yy=Math.round(sy+Math.sin(a)*k);if(xx<0||xx>=W||yy<0||yy>=Hh)break;const i=yy*W+xx;
   for(let c=0;c<3;c++)A[i*3+c]+=((c===2?.75:.82)-A[i*3+c])*al;}
 }
 return toTexture(W,Hh,rgbaFromFloats(A,W,Hh),true);
}

/** Soft wet-patch decal (alpha only matters): irregular puddle edge along one long side. */
export function wetDecalTexture():THREE.Texture|null{
 if(!hasDom())return null;
 const W=256,Hh=64,nz=makeNoise(131),A=new Uint8ClampedArray(W*Hh*4);
 for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){
  const u=x/W,v=1-y/Hh,edge=.5+.45*(nz.fbm(u,.2,8,3)-.5)*2,a=sstep(edge,edge-.35,v)*sstep(0,.08,u)*sstep(0,.08,1-u),i=(y*W+x)*4;
  A[i]=255;A[i+1]=255;A[i+2]=255;A[i+3]=a*255;
 }
 const t=toTexture(W,Hh,A,false);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;return t;
}
