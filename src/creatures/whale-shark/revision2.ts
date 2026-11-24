import * as THREE from 'three';
import type {WhaleSharkModel} from './index.ts';

/**
 * Whale shark revision 2: a morphometric rebuild of the procedural Rhincodon proxy.
 * Every length below is a fraction of total length (TL); s runs snout (0) -> upper caudal tip (1).
 * Proportions come from a measured 5.62 m juvenile (Silas & Rajagopalan 1963) and the species
 * diagnoses (FishBase / Compagno / Florida Museum); see docs/biology/kuroshio-whale-model.md, "v2 形態依據".
 * Ridges and fins are part of the same deformation as the body (per-vertex station s), so they never separate.
 */

const TAU=Math.PI*2,clamp=THREE.MathUtils.clamp;
const smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const DEG=Math.PI/180;

/** Body loft ends at the caudal peduncle; the caudal lobes carry on to s = 1. */
const BODY_END=.80;
/** Snout rounding depth: the front is cut off almost flat (a short, near-vertical face), not pointed. */
const NOSE=.028;
/** Exponent of the snout rounding: high = squarer; the front edge stays nearly straight in plan and only the corners are rounded. */
const NOSE_POWER=7;
// [s, half width, dorsal height, ventral depth, top exponent, bottom exponent] in TL.
// Width 0.19-0.20 TL at the eyes and gill region (interorbital 19.6% TL); girth at the pectoral base ~0.50 TL;
// deepest ahead of the first dorsal; peduncle least height ~0.028 TL. Flat, wide head; flatter belly.
const PROFILE:readonly (readonly [number,number,number,number,number,number])[]=[
 [0,   .066,.031,.027,3.0,3.5],
 [.03, .082,.037,.032,3.0,3.5],
 [.06, .092,.045,.036,2.9,3.4],
 [.10, .097,.053,.040,2.7,3.3],
 [.16, .100,.061,.046,2.55,3.2],
 [.24, .098,.070,.051,2.4,3.0],
 [.32, .093,.082,.056,2.3,2.9],
 [.40, .085,.088,.058,2.25,2.8],
 [.48, .074,.084,.053,2.2,2.7],
 [.56, .058,.070,.044,2.2,2.6],
 [.64, .041,.049,.032,2.15,2.4],
 [.70, .029,.034,.023,2.1,2.3],
 [.76, .020,.018,.014,2.05,2.2],
 [.80, .007,.009,.008,2.0,2.0],
];
type Section={s:number;hw:number;up:number;dn:number;nt:number;nb:number;ridges:{theta:number;amp:number;sigma:number}[]};

function catmull(a:number,b:number,c:number,d:number,t:number){return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);}
/** Squared-off (superellipse, high exponent) rounding: nearly full width and height right up to a short flat front face. */
function noseScale(s:number){if(s>=NOSE)return 1;const t=1-s/NOSE;return Math.max(.035,Math.pow(Math.max(0,1-Math.pow(t,NOSE_POWER)),1/NOSE_POWER));}

/** Three lateral ridges a side (they start above and behind the head); the lowest becomes the caudal keel. */
function ridgesAt(s:number){
 const keel=smooth(.52,.77,s);
 return [
  {theta:62*DEG,amp:.0042*smooth(.12,.19,s)*(1-smooth(.56,.68,s)),sigma:.12},
  {theta:36*DEG,amp:.0048*smooth(.13,.21,s)*(1-smooth(.62,.74,s)),sigma:.12},
  {theta:(11-11*keel)*DEG,amp:(.0048+.0045*keel)*smooth(.15,.23,s)*(1-smooth(.785,.80,s)),sigma:.13+.08*keel},
 ].filter(r=>r.amp>1e-6);
}

export function whaleSectionAt(s:number):Section{
 const x=clamp(s,0,BODY_END);let i=0;while(i<PROFILE.length-2&&x>PROFILE[i+1][0])i++;
 const t=(x-PROFILE[i][0])/(PROFILE[i+1][0]-PROFILE[i][0]),at=(k:number)=>PROFILE[clamp(i+k,0,PROFILE.length-1)];
 const v=(c:number)=>catmull(at(-1)[c],at(0)[c],at(1)[c],at(2)[c],t),f=noseScale(x);
 return {s:x,hw:Math.max(.002,v(1))*f,up:Math.max(.002,v(2))*f,dn:Math.max(.002,v(3))*f,nt:clamp(v(4),2,3.6),nb:clamp(v(5),2,3.6),ridges:ridgesAt(x).map(r=>({...r,amp:r.amp*f}))};
}
/** Surface point in TL units; theta 0 = right flank (+X), pi/2 = dorsal midline. */
export function whalePointOn(sec:Section,theta:number,out:THREE.Vector3){
 const c=Math.cos(theta),sn=Math.sin(theta),n=sn>=0?sec.nt:sec.nb,h=sn>=0?sec.up:sec.dn;
 let x=Math.sign(c)*Math.pow(Math.abs(c),2/n)*sec.hw,y=Math.sign(sn)*Math.pow(Math.abs(sn),2/n)*h;
 let bump=0;
 for(const r of sec.ridges)for(let side=0;side<2;side++){const centre=side?Math.PI-r.theta:r.theta,d=Math.atan2(Math.sin(theta-centre),Math.cos(theta-centre))/r.sigma;bump+=r.amp*Math.exp(-d*d);}
 if(bump){const l=Math.hypot(x,y)||1;x+=x/l*bump;y+=y/l*bump;}
 return out.set(x,y,.5-sec.s);
}
const N_E=1e-3,np0=new THREE.Vector3(),np1=new THREE.Vector3(),nq0=new THREE.Vector3(),nq1=new THREE.Vector3();
/** Outward normal by central differences; pass the sections at s-e, s+e and s (cache them per ring). */
function normalFrom(before:Section,after:Section,sec:Section,theta:number,out:THREE.Vector3){
 whalePointOn(before,theta,np0);whalePointOn(after,theta,np1);whalePointOn(sec,theta-N_E,nq0);whalePointOn(sec,theta+N_E,nq1);
 out.crossVectors(np1.sub(np0),nq1.sub(nq0));if(out.lengthSq()<1e-14)out.set(0,0,sec.s<.5?1:-1);return out.normalize();
}
function surfaceNormal(s:number,theta:number,out:THREE.Vector3){
 return normalFrom(whaleSectionAt(Math.max(0,s-N_E)),whaleSectionAt(Math.min(BODY_END,s+N_E)),whaleSectionAt(s),theta,out);
}

/** Body texture u runs in meridional surface distance (so the rounded snout gets as many texels per metre as the flank). */
/** Tabulated with stations bunched towards the snout (s ~ w^3), so the nearly flat front face is resolved too. */
let meridianTable:{s:Float64Array;u:Float64Array;total:number}|undefined;const MERIDIAN_N=4096;
function meridian(){
 if(meridianTable)return meridianTable;const s=new Float64Array(MERIDIAN_N+1),u=new Float64Array(MERIDIAN_N+1);let prev=0;
 for(let i=0;i<=MERIDIAN_N;i++){s[i]=BODY_END*Math.pow(i/MERIDIAN_N,3);const sec=whaleSectionAt(s[i]),r=(sec.hw+sec.up)*.5;u[i]=i?u[i-1]+Math.hypot(s[i]-s[i-1],r-prev):0;prev=r;}
 return meridianTable={s,u,total:u[MERIDIAN_N]};
}
function bracket(a:Float64Array,x:number){let lo=0,hi=MERIDIAN_N;while(hi-lo>1){const m=(lo+hi)>>1;if(a[m]<=x)lo=m;else hi=m;}return lo;}
function uOfS(s:number){const t=meridian(),x=clamp(s,0,BODY_END),i=bracket(t.s,x);return (t.u[i]+(t.u[i+1]-t.u[i])*(x-t.s[i])/Math.max(1e-12,t.s[i+1]-t.s[i]))/t.total;}
function sOfU(u:number){const t=meridian(),target=clamp(u,0,1)*t.total,i=bracket(t.u,target);return t.s[i]+(t.s[i+1]-t.s[i])*(target-t.u[i])/Math.max(1e-12,t.u[i+1]-t.u[i]);}

// --- deformation -----------------------------------------------------------------------------------------------
type Deformable={geometry:THREE.BufferGeometry;rest:Float32Array;restNormal:Float32Array;s:Float32Array};
function deformable(geometry:THREE.BufferGeometry,s:Float32Array):Deformable{
 return {geometry,rest:Float32Array.from((geometry.getAttribute('position') as THREE.BufferAttribute).array),restNormal:Float32Array.from((geometry.getAttribute('normal') as THREE.BufferAttribute).array),s};
}
/** Same travelling wave as revision 1 (front 45% stiff), plus its s-derivative for closed-form normals. */
function wave(s:number,length:number,phase:number,active:number,out:{w:number;dws:number}){
 const tail=clamp((s-.45)/.55,0,1),env=(.006+.104*Math.pow(tail,1.8))*length,dEnv=s>.45&&s<1?.104*1.8*Math.pow(tail,.8)/.55*length:0;
 const arg=phase-TAU*.88*s,sa=Math.sin(arg),ca=Math.cos(arg);
 out.w=env*active*sa;out.dws=active*(dEnv*sa-env*TAU*.88*ca);return out;
}
/** x-shear by the wave; normals corrected exactly with the inverse transpose (n.z -= dw/dz * n.x). */
function deform(item:Deformable,length:number,phase:number,active:number){
 const pos=item.geometry.getAttribute('position') as THREE.BufferAttribute,nor=item.geometry.getAttribute('normal') as THREE.BufferAttribute;
 const p=pos.array as Float32Array,n=nor.array as Float32Array,r=item.rest,rn=item.restNormal,ss=item.s,w={w:0,dws:0};
 let last=NaN,shift=0,k=0;
 for(let i=0;i<ss.length;i++){
  const s=ss[i];if(s!==last){wave(s,length,phase,active,w);shift=w.w;k=w.dws/length;last=s;}
  const o=i*3;p[o]=r[o]+shift;p[o+1]=r[o+1];p[o+2]=r[o+2];
  const nx=rn[o],ny=rn[o+1],nz=rn[o+2]+k*rn[o],l=1/Math.sqrt(nx*nx+ny*ny+nz*nz);n[o]=nx*l;n[o+1]=ny*l;n[o+2]=nz*l;
 }
 pos.needsUpdate=true;nor.needsUpdate=true;
}

// --- body ------------------------------------------------------------------------------------------------------
function bodyGeometry(length:number,sides:number,rings:number){
 const noseRings=Math.min(8,Math.floor(rings/5)),stations:number[]=[];
 for(let i=0;i<noseRings;i++)stations.push(NOSE*(1-Math.cos(Math.PI/2*i/noseRings)));
 for(let i=0;i<rings-noseRings;i++)stations.push(NOSE+(BODY_END-NOSE)*i/(rings-noseRings-1));
 const positions:number[]=[],normals:number[]=[],uvs:number[]=[],sv:number[]=[],indices:number[]=[],p=new THREE.Vector3(),n=new THREE.Vector3(),row=sides+1;
 for(const s of stations){const sec=whaleSectionAt(s),sn=Math.max(s,.002),before=whaleSectionAt(Math.max(0,sn-N_E)),after=whaleSectionAt(Math.min(BODY_END,sn+N_E)),mid=whaleSectionAt(sn);for(let j=0;j<=sides;j++){
  // the texture seam sits on the white belly (theta = -pi/2)
  const theta=-Math.PI/2+TAU*j/sides;whalePointOn(sec,theta,p);normalFrom(before,after,mid,theta,n);
  positions.push(p.x*length,p.y*length,p.z*length);normals.push(n.x,n.y,n.z);uvs.push(uOfS(s),j/sides);sv.push(s);
 }}
 for(let i=0;i<stations.length-1;i++)for(let j=0;j<sides;j++){const a=i*row+j,b=a+1,c=a+row,d=c+1;indices.push(a,c,b,b,c,d);}
 const head=positions.length/3,frontSec=whaleSectionAt(0);positions.push(0,(frontSec.up-frontSec.dn)*.5*length*.5,length*.5);normals.push(0,0,1);uvs.push(0,.5);sv.push(0);
 const tail=positions.length/3;positions.push(0,0,(.5-BODY_END)*length);normals.push(0,0,-1);uvs.push(1,.5);sv.push(BODY_END);
 const last=(stations.length-1)*row;for(let j=0;j<sides;j++){indices.push(head,j,j+1);indices.push(tail,last+j+1,last+j);}
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
 return {geometry,s:Float32Array.from(sv)};
}

// --- fins ------------------------------------------------------------------------------------------------------
type V2=readonly [number,number];
interface FinSpec{rootLE:V2;rootTE:V2;tip:V2;leCtrl:V2;teCtrl:V2;thick:number;place:(a:number,b:number,out:THREE.Vector3)=>THREE.Vector3;normal:THREE.Vector3}
const bez=(a:V2,c:V2,b:V2,t:number):[number,number]=>{const u=1-t;return [u*u*a[0]+2*u*t*c[0]+t*t*b[0],u*u*a[1]+2*u*t*c[1]+t*t*b[1]];};
const FIN_TILE=.12;
/** Two-sided fin surface between a leading-edge and a trailing-edge Bezier; (a,b) are (station s, span) in TL. */
function finGeometry(spec:FinSpec,length:number,uvOffset:number,rows=12,cols=8){
 const positions:number[]=[],uvs:number[]=[],sv:number[]=[],indices:number[]=[],p=new THREE.Vector3();
 for(const side of [1,-1]){for(let i=0;i<=rows;i++){const t=i/rows,le=bez(spec.rootLE,spec.leCtrl,spec.tip,t),te=bez(spec.rootTE,spec.teCtrl,spec.tip,t);
  for(let k=0;k<=cols;k++){const c=k/cols,a=le[0]+(te[0]-le[0])*c,b=le[1]+(te[1]-le[1])*c,h=spec.thick*(1-.82*t)*Math.pow(Math.sin(Math.PI*Math.min(1,c*1.08)),.6)*side;
   spec.place(a,b,p).addScaledVector(spec.normal,h);positions.push(p.x*length,p.y*length,p.z*length);uvs.push(a/FIN_TILE+uvOffset,b/FIN_TILE+uvOffset*.7);sv.push(a);}}}
 const layer=(rows+1)*(cols+1);
 for(const [side,off] of [[1,0],[-1,layer]] as const)for(let i=0;i<rows;i++)for(let k=0;k<cols;k++){const a=off+i*(cols+1)+k,b=a+1,c=a+cols+1,d=c+1;if(side>0)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 return {geometry,s:Float32Array.from(sv)};
}
function finSpecs(){
 const p=new THREE.Vector3(),topY=(a:number)=>whalePointOn(whaleSectionAt(a),Math.PI/2,p).y,botY=(a:number)=>whalePointOn(whaleSectionAt(a),-Math.PI/2,p).y;
 const flank=(sign:number,theta:number,drop:number,embed:number):Pick<FinSpec,'place'|'normal'>=>{
  const d=new THREE.Vector3(sign*Math.cos(drop),-Math.sin(drop),0),angle=sign>0?theta:Math.PI-theta,q=new THREE.Vector3();
  return {normal:new THREE.Vector3().crossVectors(d,new THREE.Vector3(0,0,1)).normalize(),place:(a,b,out)=>{whalePointOn(whaleSectionAt(a),angle,q);const l=Math.hypot(q.x,q.y);q.x-=q.x/l*embed;q.y-=q.y/l*embed;return out.copy(q).addScaledVector(d,b);}};
 };
 const median=(y:(a:number,b:number)=>number):Pick<FinSpec,'place'|'normal'>=>({normal:new THREE.Vector3(1,0,0),place:(a,b,out)=>out.set(0,y(a,b),.5-a)});
 const specs:Record<string,FinSpec>={};
 for(const sign of [-1,1]){const side=sign<0?'left':'right';
  // Pectoral: origin 24.9% TL, anterior margin 17.8% TL, inner margin 14.6% TL; long, narrow, falcate, swept back and drooping.
  specs[`pectoral-${side}`]={rootLE:[.249,0],rootTE:[.312,0],tip:[.372,.142],leCtrl:[.268,.095],teCtrl:[.333,.072],thick:.0085,...flank(sign,-24*DEG,18*DEG,.007)};
  // Pelvic: origin 51.6% TL, length 5.3% TL.
  specs[`pelvic-${side}`]={rootLE:[.516,0],rootTE:[.548,0],tip:[.556,.037],leCtrl:[.526,.026],teCtrl:[.55,.017],thick:.0045,...flank(sign,-58*DEG,52*DEG,.004)};
 }
 // First dorsal: origin 45.2% TL, height 8.7% TL, length 11.0% TL; apex behind mid-base, concave rear margin.
 specs['first-dorsal']={rootLE:[.452,-.008],rootTE:[.562,-.008],tip:[.532,.087],leCtrl:[.488,.074],teCtrl:[.544,.03],thick:.0065,...median((a,b)=>topY(a)+b)};
 // Second dorsal: origin 64.8% TL, height 3.9% TL, length 6.2% TL.
 specs['second-dorsal']={rootLE:[.648,-.006],rootTE:[.708,-.006],tip:[.697,.039],leCtrl:[.664,.032],teCtrl:[.7,.012],thick:.0042,...median((a,b)=>topY(a)+b)};
 // Anal: origin 67.6% TL, small.
 specs.anal={rootLE:[.676,-.006],rootTE:[.722,-.006],tip:[.718,.03],leCtrl:[.69,.026],teCtrl:[.72,.01],thick:.0038,...median((a,b)=>botY(a)-b)};
 // Caudal: dorsal margin ~25-26% TL from the caudal pit (A: 25.3% TL), raised ~33 deg; lower lobe about half the upper (C, juvenile).
 specs['caudal-upper-lobe']={rootLE:[.735,.010],rootTE:[.84,-.008],tip:[1,.15],leCtrl:[.86,.095],teCtrl:[.93,.048],thick:.0055,...median((_a,b)=>b)};
 specs['caudal-lower-lobe']={rootLE:[.75,-.012],rootTE:[.83,-.002],tip:[.87,-.11],leCtrl:[.785,-.075],teCtrl:[.835,-.045],thick:.0045,...median((_a,b)=>b)};
 return specs;
}

// --- texture ---------------------------------------------------------------------------------------------------
function hash(a:number,b:number,seed:number){let h=Math.imul(a|0,374761393)^Math.imul(b|0,668265263)^Math.imul(seed|0,2246822519);h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967296;}
const fract=(x:number)=>x-Math.floor(x);
const rgb=(hex:string)=>{const v=parseInt(hex.slice(1),16);return [(v>>16)&255,(v>>8)&255,v&255] as const;};
const DORSAL=rgb('#38566a'),FLANK=rgb('#46677a'),SPOT=rgb('#eef0e8'),BAR=rgb('#cfd8d4'),BELLY=rgb('#e2e5df'),GILL=rgb('#36525f'),MOUTH=rgb('#151c20');
export const WHALE_TEXTURE_SIZE=[1024,512] as const;
/**
 * Five gill slits a side, front to back: station of the slit, tilt (station shift per radian away from the back line, they lean
 * backwards towards the belly), bow (rearward bulge of the middle), and the angular extent from the dorsal midline (phi, rad).
 * Spacing is uneven and the slits get shorter towards the back; the posterior three sit over the pectoral base.
 */
const GILLS=[
 {s:.194,tilt:.0072,bow:.0024,top:.74,bottom:2.20},
 {s:.2145,tilt:.0066,bow:.0017,top:.78,bottom:2.14},
 {s:.2365,tilt:.0056,bow:.0021,top:.83,bottom:1.95},
 {s:.2555,tilt:.0047,bow:.0013,top:.88,bottom:1.84},
 {s:.2745,tilt:.0038,bow:.0010,top:.96,bottom:1.72},
] as const;
/** Station of gill g at angle phi from the dorsal midline (shared by the texture and the ribbon geometry). */
const gillStation=(g:number,phi:number)=>{const k=GILLS[g],x=clamp((phi-k.top)/(k.bottom-k.top),0,1);return k.s+k.tilt*(phi-1.5)+k.bow*Math.sin(Math.PI*x);};
function dataTexture(data:Uint8Array,w:number,h:number,wrapS:THREE.Wrapping){
 const t=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.UnsignedByteType);
 t.wrapS=wrapS;t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=8;t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;
}
/** Jittered field of small round head spots (cell HEAD_CELL, TL units); slightly larger towards the gills. */
const HEAD_CELL=.0165;
function headField(x:number,y:number,s:number,seed:number,size:number){
 let m=0;const ci=Math.floor(x/HEAD_CELL),cj=Math.floor(y/HEAD_CELL),grow=.2+.11*smooth(0,.2,s);
 for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const u=ci+a,v=cj+b,h1=hash(u,v,seed),h2=fract(h1*53.73),h3=fract(h1*137.11);
  const cx=(u+.2+.6*h1)*HEAD_CELL,cy=(v+.2+.6*h2)*HEAD_CELL,r=size*HEAD_CELL*grow*(.8+.45*h3),d=Math.hypot(x-cx,y-cy);
  m=Math.max(m,1-smooth(r-.0007,r+.0007,d));}
 return m;
}
/**
 * Seeded checkerboard laid out in surface distance (TL): small dense head spots; behind the gills pale
 * transverse bars every ~4.2% TL with one column of round spots between them and pale lines along the ridges;
 * white belly; five dark gill slits; dark terminal mouth across the snout.
 */
function bodyTexture(seed:number){
 const [W,H]=WHALE_TEXTURE_SIZE,data=new Uint8Array(W*H*4),COARSE=128,pts:THREE.Vector3[]=Array.from({length:COARSE+1},()=>new THREE.Vector3()),coarseArc=new Float32Array(COARSE+1),arc=new Float32Array(H),P=new THREE.Vector3();
 const BAR_D=.042,BAR_X0=.214,ROW=.031;
 const barCache=new Map<number,number>(),bars=(k:number)=>{let x=barCache.get(k);if(x===undefined){x=BAR_X0+k*BAR_D+(hash(k,7,seed)-.5)*.008;barCache.set(k,x);}return x;};
 const thetas=new Float32Array(H),phis=new Float32Array(H);
 for(let j=0;j<H;j++){const theta=-Math.PI/2+TAU*(j+.5)/H;thetas[j]=theta;phis[j]=Math.abs(Math.atan2(Math.sin(theta-Math.PI/2),Math.cos(theta-Math.PI/2)));}
 // columns are uniform in meridional distance X (TL); X is aligned with s at s = 0.3 so the anatomy positions below stay in s
 const total=meridian().total,offset=uOfS(.3)*total-.3;
 for(let i=0;i<W;i++){
  const u=(i+.5)/W,st=sOfU(u),s=u*total-offset,sec=whaleSectionAt(st);
  // arc length around the section from the belly, sampled coarsely and interpolated
  for(let j=0;j<=COARSE;j++)whalePointOn(sec,-Math.PI/2+TAU*j/COARSE,pts[j]);
  coarseArc[0]=0;for(let j=1;j<=COARSE;j++)coarseArc[j]=coarseArc[j-1]+pts[j].distanceTo(pts[j-1]);
  for(let j=0;j<H;j++){const f=(j+.5)/H*COARSE,k=Math.min(COARSE-1,Math.floor(f));arc[j]=coarseArc[k]+(coarseArc[k+1]-coarseArc[k])*(f-k);}
  const columnRidges=sec.ridges,radius=(sec.hw+(sec.up+sec.dn)*.5)*.5,head=1-smooth(.17,.25,s),kBar=Math.floor((s-BAR_X0)/BAR_D);
  for(let j=0;j<H;j++){
   const theta=thetas[j],phi=phis[j],Y=arc[j];
   const belly=smooth(1.74,2.1,phi);
   // head: jittered field of small spots, a little larger towards the gills
   let headMark=0;
   if(head>0&&belly<1){
    // the rounded snout face is a disc: spots there are laid out in the front plane (x, y), blending into the
    // cylindrical (meridional, around) layout behind it, so they stay round instead of bending into arcs
    const planar=1-smooth(.0015,.007,st);
    headMark=planar<1?headField(s,Y,s,seed,1):0;
    if(planar>0){whalePointOn(sec,theta,P);headMark=headMark*(1-planar)+headField(P.x+1,P.y+1,s,seed+101,.78)*planar;}
   }
   // trunk: transverse bars, ridge lines and one column of spots between bars
   let trunk=0;
   if(head<1&&belly<1&&s>BAR_X0-BAR_D){
    for(let k=kBar-1;k<=kBar+1;k++){const x=bars(k)+.0032*Math.sin(Y*48+k*1.9),d=Math.abs(s-x);trunk=Math.max(trunk,.72*(1-smooth(.0011,.0025,d)));
     const cx=(bars(k)+bars(k+1))*.5,row=Math.floor(Y/ROW);
     for(let rj=row-1;rj<=row+1;rj++){const h1=hash(k,rj,seed+53),h2=fract(h1*53.73),h3=fract(h1*137.11);
      const px=cx+(h1-.5)*.006,py=(rj+.5)*ROW+(h2-.5)*.008,r=.0068*(.78+.44*h3)*(1-.18*smooth(.55,.78,s)),dd=Math.hypot(s-px,Y-py);
      trunk=Math.max(trunk,1-smooth(r-.0007,r+.0007,dd));}}
    for(const r of columnRidges)for(let side=0;side<2;side++){const centre=side?Math.PI-r.theta:r.theta,d=Math.abs(Math.atan2(Math.sin(theta-centre),Math.cos(theta-centre)))*radius;trunk=Math.max(trunk,.58*(1-smooth(.001,.0024,d)));}
   }
   let mark=Math.max(headMark*head,trunk*(1-head))*(1-belly);
   // gill slits: long, slightly curved and tilted, soft-edged, from the upper flank down towards the belly
   let gill=0;for(let g=0;g<GILLS.length;g++){const k=GILLS[g],d=Math.abs(s-gillStation(g,phi));gill=Math.max(gill,(1-smooth(.0010,.0040,d))*smooth(k.top,k.top+.22,phi)*(1-smooth(k.bottom-.3,k.bottom,phi)));}
   // mouth: a dark band across the very front of the flat snout, edges feathered so the lip line is not stepped
   whalePointOn(sec,theta,P);
   const mouth=(1-smooth(.85*NOSE,NOSE,st))*(1-smooth(.054,.062,Math.abs(P.x)))*smooth(-.0112,-.0098,P.y)*(1-smooth(-.0042,-.0028,P.y));
   const noise=.94+.12*hash(i>>2,j>>2,seed+5),flank=smooth(.5,1.5,phi),o=(j*W+i)*4;
   for(let c=0;c<3;c++){
    let v=(DORSAL[c]+(FLANK[c]-DORSAL[c])*flank)*noise;
    const spot=trunk>.75||headMark>.5?SPOT[c]:BAR[c];v+=(spot-v)*mark;v+=(BELLY[c]-v)*belly;
    v+=(GILL[c]-v)*gill*.75;v+=(MOUTH[c]-v)*mouth;data[o+c]=clamp(Math.round(v),0,255);
   }
   data[o+3]=255;
  }
 }
 return dataTexture(data,W,H,THREE.ClampToEdgeWrapping);
}
/** Periodic spot tile for the fins (4 x 4 cells per FIN_TILE). */
function finTexture(seed:number){
 const N=256,data=new Uint8Array(N*N*4),cells=4,cell=FIN_TILE/cells;
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const u=(x+.5)/N*FIN_TILE,v=(y+.5)/N*FIN_TILE,ci=Math.floor(u/cell),cj=Math.floor(v/cell);let m=0;
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const cu=ci+a,cv=cj+b,wu=((cu%cells)+cells)%cells,wv=((cv%cells)+cells)%cells,h1=hash(wu,wv,seed+211),h2=hash(wu,wv,seed+223),h3=hash(wu,wv,seed+227);
   const r=cell*.21*(.75+.5*h3),d=Math.hypot(u-(cu+.2+.6*h1)*cell,v-(cv+.2+.6*h2)*cell);m=Math.max(m,1-smooth(r-.0008,r+.0008,d));}
  const o=(y*N+x)*4,noise=.94+.12*hash(x>>2,y>>2,seed+9);
  for(let c=0;c<3;c++){const base=DORSAL[c]*noise*.97;data[o+c]=clamp(Math.round(base+(SPOT[c]-base)*m*.95),0,255);}data[o+3]=255;
 }
 return dataTexture(data,N,N,THREE.RepeatWrapping);
}

// --- model -----------------------------------------------------------------------------------------------------
export function createWhaleSharkModelV2(length:number,seed:number,lodDistances:readonly [number,number]):WhaleSharkModel{
 const L=length,root=new THREE.Group(),deformables:Deformable[]=[];
 root.name='procedural-whale-shark';
 const bodyMap=bodyTexture(seed),finMap=finTexture(seed);
 const skin=new THREE.MeshStandardMaterial({map:bodyMap,roughness:.55,metalness:0,side:THREE.DoubleSide});
 const finSkin=new THREE.MeshStandardMaterial({map:finMap,roughness:.55,metalness:0,side:THREE.DoubleSide});
 const eyeMaterial=new THREE.MeshStandardMaterial({color:'#0d1113',roughness:.35,metalness:0});
 const lod=new THREE.LOD();lod.name='whale-shark-lod';root.add(lod);
 const levels=[new THREE.Group(),new THREE.Group(),new THREE.Group()];
 levels.forEach((g,i)=>{g.name=`whale-shark-anatomy-lod${i}`;lod.addLevel(g,i===0?0:lodDistances[i-1]);});
 const sphere=new THREE.Sphere(new THREE.Vector3(),L*.62);
 const meshOf=(geometry:THREE.BufferGeometry,material:THREE.Material,name:string)=>{geometry.boundingSphere=sphere.clone();const m=new THREE.Mesh(geometry,material);m.name=name;m.castShadow=true;m.receiveShadow=true;return m;};
 ([[96,110],[48,56],[24,28]] as const).forEach(([sides,rings],i)=>{const b=bodyGeometry(L,sides,rings);deformables.push(deformable(b.geometry,b.s));levels[i].add(meshOf(b.geometry,skin,`whale-shark-v2-body-${sides}`));});
 // Fin geometry is shared by the three levels (one deformation, one Mesh per level).
 let finIndex=0;
 for(const [name,spec] of Object.entries(finSpecs())){
  const f=finGeometry(spec,L,hash(finIndex++,3,seed));deformables.push(deformable(f.geometry,f.s));
  levels.forEach((g,i)=>g.add(meshOf(f.geometry,finSkin,`whale-shark-${name}-lod${i}`)));
 }
 // Close level: five soft gill slits a side (posterior three over the pectoral base) and small lateral eyes at the front corners.
 // Each slit is a ribbon three vertices wide whose vertex alpha fades out sideways and at both ends, so it reads as a shadowed fold, not a cut.
 const p=new THREE.Vector3(),n=new THREE.Vector3(),gillColor=new THREE.Color('#36525f');
 const gillSkin=new THREE.MeshStandardMaterial({vertexColors:true,transparent:true,depthWrite:false,roughness:.7,metalness:0,side:THREE.DoubleSide});
 for(const sign of [-1,1])GILLS.forEach((k,g)=>{
  const positions:number[]=[],colors:number[]=[],sv:number[]=[],indices:number[]=[],steps=12;
  for(let i=0;i<=steps;i++){const x=i/steps,phi=k.top+(k.bottom-k.top)*x,theta=sign>0?Math.PI/2-phi:Math.PI/2+phi,fade=smooth(0,.16,x)*(1-smooth(.78,1,x));
   for(const [ds,alpha] of [[-.0016,0],[0,.5*fade],[.0016,0]] as const){const s=gillStation(g,phi)+ds;whalePointOn(whaleSectionAt(s),theta,p);surfaceNormal(s,theta,n);p.addScaledVector(n,.0012);
    positions.push(p.x*L,p.y*L,p.z*L);colors.push(gillColor.r,gillColor.g,gillColor.b,alpha);sv.push(k.s);}}
  for(let i=0;i<steps;i++)for(let j=0;j<2;j++){const a=i*3+j,b=a+1,c=a+3,d=c+1;indices.push(a,c,b,b,c,d);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));geometry.setIndex(indices);geometry.computeVertexNormals();
  deformables.push(deformable(geometry,Float32Array.from(sv)));const mesh=meshOf(geometry,gillSkin,`whale-shark-gill-${sign<0?'left':'right'}-${g+1}`);mesh.castShadow=false;mesh.renderOrder=1;levels[0].add(mesh);
 });
 for(const sign of [-1,1]){
  const theta=sign>0?.12:Math.PI-.12,s=.094;whalePointOn(whaleSectionAt(s),theta,p);surfaceNormal(s,theta,n);p.addScaledVector(n,.0012);
  const geometry=new THREE.SphereGeometry(L*.0042,10,8);geometry.translate(p.x*L,p.y*L,p.z*L);
  deformables.push(deformable(geometry,new Float32Array(geometry.getAttribute('position').count).fill(s)));levels[0].add(meshOf(geometry,eyeMaterial,`whale-shark-eye-${sign<0?'left':'right'}`));
 }
 const head=whaleSectionAt(.094),mouthSec=whaleSectionAt(NOSE);
 root.userData={length:L,forward:'+Z',dorsal:'+Y',transverse:'+X',lodDistances:[...lodDistances],revision:2,textureSize:[...WHALE_TEXTURE_SIZE],
  morphometricsTL:{headWidthAtEyes:head.hw*2,mouthWidth:mouthSec.hw*2*.88,firstDorsalOrigin:.452,pectoralOrigin:.249,caudalUpperLobe:.27,caudalLowerLobe:.14}};
 let disposed=false;
 return {root,update(pose){
  if(disposed)return;const phase=Number.isFinite(pose.phase)?pose.phase:0,amplitude=clamp(Number.isFinite(pose.amplitude)?pose.amplitude:1,0,2),glide=clamp(Number.isFinite(pose.glide)?pose.glide:0,0,1);
  const active=THREE.MathUtils.lerp(1,.18,glide)*amplitude;
  for(const item of deformables)deform(item,L,phase,active);
  root.userData.pose={phase,amplitude,glide};root.updateMatrixWorld(true);
 },dispose(){
  if(disposed)return;disposed=true;
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  root.traverse(node=>{if(!(node instanceof THREE.Mesh))return;geometries.add(node.geometry);for(const m of Array.isArray(node.material)?node.material:[node.material])materials.add(m);});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());bodyMap.dispose();finMap.dispose();root.removeFromParent();root.clear();
 }};
}
