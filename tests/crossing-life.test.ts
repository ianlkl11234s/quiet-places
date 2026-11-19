import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createCrossingLife,crossingWhaleSharkTrack,CROSSING_SARDINE_POINTER_RESPONSE,CROSSING_WHALE_SHARK_LENGTHS} from '../src/places/crossing/Life.ts';
import {DECK,POCKET,RAIL,ROOF,SOLIDS,VIEWS,inDeck} from '../src/places/crossing/Layout.ts';
import {createWhaleSharkModel} from '../src/creatures/whale-shark/index.ts';

const STATE={intensity:1},DT=1/30;
const run=(seconds:number,options:Parameters<typeof createCrossingLife>[0]={},ray?:(t:number)=>{ray:THREE.Ray|undefined;tap:boolean}|undefined)=>{
 const life=createCrossingLife({seed:20261118,...options});
 const samples:ReturnType<typeof life.getDebug>[]=[];
 for(let k=0;k*DT<=seconds;k++){
  const t=k*DT,r=ray?.(t);if(r)life.pointerRay(r.ray,r.tap);
  life.update(DT,t,STATE);if(k%15===0)samples.push(life.getDebug());
 }
 return {life,samples,last:life.getDebug()};
};
const cams=[VIEWS.a.position,VIEWS.c.position];
// Solids written out again from Layout (not from the module's own proxy list).
const solid=(p:number[],margin=0)=>{
 const [x,y,z]=p,{xMin,xMax,zMin,zMax}=DECK;
 if(x>xMax-RAIL.t&&x<xMax&&z>zMin-RAIL.t&&z<zMax&&y<RAIL.h)return 'open-side gunwale';
 if(x>0&&x<xMax&&z>zMin-RAIL.t&&z<zMin&&y<RAIL.h)return 'stern gunwale';
 if(x>xMin&&x<0&&z>zMin-RAIL.t&&z<POCKET.pocketFrontZ)return 'cabin';
 if(x<xMin&&x>xMin-.15&&z>POCKET.pocketFrontZ&&z<zMax)return 'west wall';
 if(y>ROOF.underY&&x>xMin&&x<xMax&&z>zMin&&z<zMax)return 'roof';
 if(y<0&&inDeck(x,z))return 'below deck';
 for(const c of cams)if(Math.hypot(x-c[0],y-c[1],z-c[2])<.6)return 'camera zone';
 return margin?'':'';
};

test('120 s: fish finite, out of every solid and the camera zones, speeds sensible, and they use the openings',()=>{
 const {life,samples}=run(120);
 let near=0,total=0,inDeckCount=0,outsideCount=0,maxSpeed=0,speedSum=0,speedN=0,minLen=1,maxLen=0;
 for(const d of samples){
  assert.equal(d.fish.length,210);
  for(const f of d.fish){
   assert.ok(f.p.every(Number.isFinite)&&Number.isFinite(f.speed));
   assert.equal(solid(f.p),'',`fish at ${f.p.map(v=>v.toFixed(2))} in ${solid(f.p)}`);
   total++;if(cams.some(c=>Math.hypot(f.p[0]-c[0],f.p[1]-c[1],f.p[2]-c[2])<1.2))near++;
   maxSpeed=Math.max(maxSpeed,f.speed);speedSum+=f.speed;speedN++;minLen=Math.min(minLen,f.length);maxLen=Math.max(maxLen,f.length);
   if(inDeck(f.p[0],f.p[2])&&f.p[1]>0)inDeckCount++;if(f.p[0]>DECK.xMax+.3||f.p[2]<DECK.zMin-.3||f.p[2]>DECK.zMax+.3)outsideCount++;
  }
 }
 assert.equal(life.getDebug().penetrations,0);
 assert.ok(maxSpeed<2.6,`max speed ${maxSpeed}`);assert.ok(speedSum/speedN>.15&&speedSum/speedN<1.6,`mean speed ${speedSum/speedN}`);
 assert.ok(near/total<.02,`fish within 1.2 m of a camera: ${near/total}`);
 assert.ok(minLen>=.1-1e-6&&maxLen<=.2+1e-6);
 assert.ok(inDeckCount>samples.length*20,`on deck ${inDeckCount}`);assert.ok(outsideCount>samples.length*5,`outside ${outsideCount}`);
 life.dispose();
});

test('whale sharks in the life object: pose follows the analytic track, pitch/bank capped, tail beats with swum distance',()=>{
 const {life,samples}=run(90),[big,small]=CROSSING_WHALE_SHARK_LENGTHS;
 assert.ok(samples.length>100);
 for(const d of samples){
  d.sharks.forEach((sh,i)=>{
   assert.ok(sh.p.every(Number.isFinite));assert.ok(Math.abs(sh.pitch)<=8*DEG+1e-9);assert.ok(Math.abs(sh.roll)<=12*DEG+1e-9);
   assert.ok(sh.p[1]>=.5&&sh.p[1]<=5.5,`y ${sh.p[1]}`);assert.ok(sh.speed>=.5&&sh.speed<=1.65,`speed ${sh.speed}`);
   assert.ok(Math.abs(sh.frequency-sh.speed/2.4)<1e-9&&sh.frequency>.2&&sh.frequency<.7);
  });
  assert.equal(d.sharks[0].length,big);assert.equal(d.sharks[1].length,small);
 }
 // The debug pose is the pure track at the elapsed time of the last update (90 s).
 const last=life.getDebug();[0,1].forEach(i=>{const k=crossingWhaleSharkTrack(i as 0|1,90);last.sharks[i].p.forEach((v,j)=>assert.ok(Math.abs(v-k.p[j])<1e-6));assert.ok(Math.abs(last.sharks[i].yaw-k.yaw)<1e-6);});
 life.dispose();
});

// --- whale shark route, 0-600 s every 0.5 s (pure track; numbers replace looking at renders) ---
const DEG=Math.PI/180,LENGTHS=CROSSING_WHALE_SHARK_LENGTHS,ASPECT=16/9;
const HULL:[number,number,number,number,number,number]=[DECK.xMin,DECK.xMax,-6,0,DECK.zMin,DECK.zMax];
const ROOF_SLAB:[number,number,number,number,number,number]=[DECK.xMin,DECK.xMax,ROOF.underY,ROOF.underY+.1,DECK.zMin,DECK.zMax];
const BLOCKERS=[...SOLIDS.map(s=>s.box),ROOF_SLAB,HULL];
const segmentHitsBox=(a:readonly number[],b:readonly number[],box:readonly number[])=>{
 let t0=0,t1=1;
 for(let i=0;i<3;i++){const d=b[i]-a[i],lo=box[i*2],hi=box[i*2+1];
  if(Math.abs(d)<1e-12){if(a[i]<lo||a[i]>hi)return false;continue;}
  let u=(lo-a[i])/d,v=(hi-a[i])/d;if(u>v)[u,v]=[v,u];t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1)return false;}
 return true;
};
/** Eye-to-centre line clear of walls, posts, roof and hull and the centre inside the 16:9 frustum; also returns the apparent length in 1080p pixels. */
const look=(view:'a'|'c',p:readonly number[],yaw:number,length:number)=>{
 const eye=VIEWS[view].position as readonly number[],target=VIEWS[view].target as readonly number[];
 if(BLOCKERS.some(b=>segmentHitsBox(eye,p,b)))return {visible:false,px:0};
 let f=[target[0]-eye[0],target[1]-eye[1],target[2]-eye[2]];const fl=Math.hypot(f[0],f[1],f[2]);f=f.map(x=>x/fl);
 const rl=Math.hypot(f[0],f[2]),r=[f[2]/rl,0,-f[0]/rl],u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
 const v=[p[0]-eye[0],p[1]-eye[1],p[2]-eye[2]],z=v[0]*f[0]+v[1]*f[1]+v[2]*f[2];if(z<=0)return {visible:false,px:0};
 const th=Math.tan(VIEWS[view].fov*DEG/2),x=(v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/z/(th*ASPECT),y=(v[0]*u[0]+v[1]*u[1]+v[2]*u[2])/z/th;
 if(Math.abs(x)>1||Math.abs(y)>1)return {visible:false,px:0};
 // Body axis (yaw, level) seen across the line of sight: projected length = length * |sin(angle between axis and view ray)|.
 const dist=Math.hypot(v[0],v[1],v[2]),axis=[Math.sin(yaw),0,Math.cos(yaw)],cos=(axis[0]*v[0]+axis[2]*v[2])/dist,sin=Math.sqrt(Math.max(0,1-cos*cos));
 return {visible:true,px:length*sin/dist/(2*th)*1080};
};
const times=Array.from({length:1201},(_,k)=>k*.5);
const tracks=[times.map(t=>crossingWhaleSharkTrack(0,t)),times.map(t=>crossingWhaleSharkTrack(1,t))];
const boxDistance=(p:readonly number[])=>Math.hypot(Math.max(DECK.xMin-p[0],0,p[0]-DECK.xMax),Math.max(DECK.zMin-p[2],0,p[2]-DECK.zMax));

test('whale shark route 0-600 s: 2-5.5 m up, 12 m of clear water past the hull for the whole body, 22+ m centre-to-ship, up to 50 m, small one never on top of the big one',()=>{
 for(const [i,list] of tracks.entries())list.forEach((k,n)=>{
  assert.ok(k.p.every(Number.isFinite));assert.ok(k.p[1]>=.5&&k.p[1]<=5.5,`shark ${i} y ${k.p[1]} at ${times[n]}`);
  const d=boxDistance(k.p);assert.ok(d-LENGTHS[i]/2>=12&&d<=50,`shark ${i} ${d.toFixed(1)} m from the hull box at ${times[n]} s`);
 });
 tracks[0].forEach((k,n)=>{const o=tracks[1][n].p,sep=Math.hypot(k.p[0]-o[0],k.p[1]-o[1],k.p[2]-o[2]);assert.ok(sep>=5,`centres ${sep.toFixed(1)} m apart at ${times[n]} s`);assert.ok(sep<=40,`small one strayed ${sep.toFixed(1)} m`);});
});

test('whale shark motion: 0.5-1.6 m/s, yaw follows the path (no sliding backwards), yaw change <= 6 deg per 0.5 s, bank <= 12 deg, pitch <= 8 deg',()=>{
 for(const [i,list] of tracks.entries())list.forEach((k,n)=>{
  assert.ok(k.speed>=.5&&k.speed<=1.6,`shark ${i} speed ${k.speed.toFixed(2)} at ${times[n]}`);
  const heading=Math.atan2(k.v[0],k.v[2]),off=Math.abs(Math.atan2(Math.sin(heading-k.yaw),Math.cos(heading-k.yaw)));assert.ok(off<=25*DEG,`velocity off the nose by ${off/DEG}`);
  assert.ok(Math.abs(k.roll)<=12*DEG+1e-9&&Math.abs(k.pitch)<=8*DEG+1e-9);
  if(n+1<list.length){const dyaw=Math.abs(Math.atan2(Math.sin(list[n+1].yaw-k.yaw),Math.cos(list[n+1].yaw-k.yaw)));assert.ok(dyaw<=6*DEG,`shark ${i} yaw jumps ${(dyaw/DEG).toFixed(2)} deg at ${times[n]} s`);}
 });
});

test('whale shark visibility: big one seen 35% of the time from a and 20% from c, neither shark gone for more than 60 s (a) / 90 s (c), big one at least 90 px long in the middle',()=>{
 const need={a:{share:.35,gap:60},c:{share:.2,gap:90}};
 for(const view of ['a','c'] as const){
  let seen=0,gone=0,longest=0;const px:number[]=[];
  times.forEach((_t,n)=>{
   const lookBig=look(view,tracks[0][n].p,tracks[0][n].yaw,LENGTHS[0]),lookSmall=look(view,tracks[1][n].p,tracks[1][n].yaw,LENGTHS[1]);
   if(lookBig.visible){seen++;px.push(lookBig.px);}
   if(lookBig.visible||lookSmall.visible)gone=0;else{gone+=.5;longest=Math.max(longest,gone);}
  });
  px.sort((x,y)=>x-y);const median=px[Math.floor(px.length/2)];
  console.log(`view ${view}: big visible ${(seen/times.length*100).toFixed(1)} %, longest both-hidden ${longest} s, median length ${median.toFixed(0)} px`);
  assert.ok(seen/times.length>=need[view].share,`${view} share ${seen/times.length}`);assert.ok(longest<=need[view].gap,`${view} gap ${longest}`);assert.ok(median>=90,`${view} median ${median}`);
 }
});

test('pointer response 0: pointerRay and tap leave the trajectories bit-identical',()=>{
 const aim=(t:number)=>{const origin=new THREE.Vector3(-.4,1.15,.34),dir=new THREE.Vector3(Math.sin(t*.7),0,-1).normalize();return {ray:new THREE.Ray(origin,dir),tap:Math.round(t*30)%90===0};};
 const plain=run(40,{pointerResponse:0}),poked=run(40,{pointerResponse:0},aim);
 assert.deepEqual(poked.last,plain.last);assert.equal(poked.last.startles,0);
 const live=run(40,{},aim);assert.ok(live.last.startles>0,'default response reacts to a tap');
 assert.ok(CROSSING_SARDINE_POINTER_RESPONSE===.5);
 [plain,poked,live].forEach(r=>r.life.dispose());
});

test('same seed twice gives the same result; a different seed differs',()=>{
 const a=run(60),b=run(60),c=run(60,{seed:7});
 assert.deepEqual(a.last,b.last);assert.notDeepEqual(a.last.fish,c.last.fish);
 const before=JSON.stringify(a.last);a.life.update(DT,60,STATE);a.life.update(DT,59,STATE);assert.equal(JSON.stringify(a.life.getDebug()),before);
 [a,b,c].forEach(r=>r.life.dispose());
});

// --- whale shark model revision 2 (crossing only) -----------------------------------------------------------------
/** Quantised world-space checksum over every mesh (1e-5 grid), so revision 1 can be pinned without storing vertices. */
const modelChecksum=(root:THREE.Object3D)=>{
 let count=0,pos=0,col=0,k=0;const v=new THREE.Vector3();root.updateMatrixWorld(true);
 root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const p=o.geometry.getAttribute('position'),c=o.geometry.getAttribute('color');
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);k++;const w=(k%97)+1;
   pos+=w*(Math.round(v.x*1e5)+2*Math.round(v.y*1e5)+3*Math.round(v.z*1e5));
   if(c)col+=w*(Math.round(c.getX(i)*1e5)+2*Math.round(c.getY(i)*1e5)+3*Math.round(c.getZ(i)*1e5));}
  count+=p.count;});
 return [count,pos,col];
};

test('whale shark without options is revision 1, vertex for vertex (last-arcade and the studio keep their look)',()=>{
 // captured from the revision-1 module before revision 2 existed
 const pinned=[[6.5,1234,[5832,-948172734,41067115374],[5832,13550527543,41067115374]],[8.5,9140,[5832,-1239906343,40584177872],[5832,17719926474,40584177872]]] as const;
 for(const [length,seed,rest,posed] of pinned){
  const m=createWhaleSharkModel(length,seed);assert.deepEqual(modelChecksum(m.root),rest);
  m.update({phase:1.3,amplitude:.95,glide:.3});assert.deepEqual(modelChecksum(m.root),posed);assert.equal(m.root.userData.revision,undefined);m.dispose();
 }
});

test('whale shark revision 2: anatomy nodes, morphometric proportions, unequal caudal lobes, budget, texture and clean dispose',()=>{
 const L=6.5,m=createWhaleSharkModel(L,1234,{revision:2}),other=createWhaleSharkModel(L,4321,{revision:2});
 assert.equal(m.root.userData.revision,2);
 const lod=m.root.getObjectByName('whale-shark-lod') as THREE.LOD;
 assert.deepEqual(lod.levels.map(l=>l.distance),[0,60,130],'LOD0 covers the whole crossing route (22-50 m)');
 const near=lod.levels[0].object,find=(name:string)=>{const o=near.getObjectByName(name) as THREE.Mesh|undefined;assert.ok(o,`missing ${name}`);return o!;};
 for(const name of ['pectoral-left','pectoral-right','first-dorsal','second-dorsal','caudal-upper-lobe','caudal-lower-lobe','pelvic-left','pelvic-right','anal'])find(`whale-shark-${name}-lod0`);
 for(const side of ['left','right'])for(let i=1;i<=5;i++)find(`whale-shark-gill-${side}-${i}`);
 for(const level of lod.levels)assert.ok(level.object.getObjectByName(`whale-shark-pectoral-left-lod${lod.levels.indexOf(level)}`),'every LOD keeps the pectoral silhouette');
 let tris=0;near.traverse(o=>{if(o instanceof THREE.Mesh)tris+=o.geometry.index!.count/3;});assert.ok(tris<=30000,`LOD0 ${tris} triangles`);

 const box=new THREE.Box3().setFromObject(m.root);assert.ok(Math.abs(box.max.z-box.min.z-L)<.01*L,`snout to caudal tip ${box.max.z-box.min.z} for ${L} m`);
 const body=find('whale-shark-v2-body-96'),p=body.geometry.getAttribute('position');
 // width across the head at the eyes (A: interorbital 19.6% TL in a 5.62 m juvenile; B tolerance +-10%); widest overall
 // stays at the head/gills (no oval), deepest point ahead of the first dorsal, peduncle much thinner than the trunk
 const widthAt=(s:number)=>{let w=0;for(let i=0;i<p.count;i++)if(Math.abs(p.getZ(i)-(.5-s)*L)<.004*L)w=Math.max(w,Math.abs(p.getX(i))*2);return w/L;};
 const depthAt=(s:number)=>{let lo=0,hi=0;for(let i=0;i<p.count;i++)if(Math.abs(p.getZ(i)-(.5-s)*L)<.004*L){lo=Math.min(lo,p.getY(i));hi=Math.max(hi,p.getY(i));}return (hi-lo)/L;};
 const head=widthAt(.094);assert.ok(head>.176&&head<.216,`head width ${head.toFixed(3)} TL`);
 assert.ok(widthAt(.2)>widthAt(.45)&&widthAt(.45)>widthAt(.65)*1.6,'tapers from a broad head to a narrow tail');
 assert.ok(depthAt(.4)>depthAt(.1)&&depthAt(.4)>depthAt(.6),'deepest ahead of the first dorsal');
 assert.ok(depthAt(.77)<.045,'thin caudal peduncle');
 assert.ok(widthAt(.03)>.12,'truncated snout, broad terminal mouth (12.8% TL)');
 // fin positions: pectoral origin ~24.9% TL, first dorsal origin ~45.2% TL, second dorsal ~64.8% TL
 const front=(name:string)=>{const g=find(name).geometry;g.computeBoundingBox();return .5-g.boundingBox!.max.z/L;};
 assert.ok(Math.abs(front('whale-shark-pectoral-left-lod0')-.249)<.02);assert.ok(Math.abs(front('whale-shark-first-dorsal-lod0')-.452)<.02);assert.ok(Math.abs(front('whale-shark-second-dorsal-lod0')-.648)<.02);
 const fin=(name:string)=>{const g=find(name).geometry;g.computeBoundingBox();return g.boundingBox!;};
 assert.ok(fin('whale-shark-first-dorsal-lod0').max.y>fin('whale-shark-second-dorsal-lod0').max.y*1.4,'first dorsal much larger than the second');
 // caudal: upper lobe clearly longer than the lower (juvenile), measured from the caudal pit
 const pit=new THREE.Vector3(0,0,(.5-.77)*L),reach=(name:string)=>{const a=find(name).geometry.getAttribute('position');let r=0;for(let i=0;i<a.count;i++)r=Math.max(r,pit.distanceTo(new THREE.Vector3().fromBufferAttribute(a,i)));return r;};
 const upper=reach('whale-shark-caudal-upper-lobe-lod0'),lower=reach('whale-shark-caudal-lower-lobe-lod0');
 assert.ok(upper>lower*1.6,`upper lobe ${upper.toFixed(2)} vs lower ${lower.toFixed(2)}`);assert.ok(upper/L>.22&&upper/L<.30,`upper caudal margin ${(upper/L).toFixed(3)} TL (A 25.3%)`);
 // generated albedo: seeded, mipmapped, sRGB; no emissive
 const map=(body.material as THREE.MeshStandardMaterial).map as THREE.DataTexture;
 assert.ok(map instanceof THREE.DataTexture&&map.image.width===1024&&map.image.height===512&&map.generateMipmaps&&map.minFilter===THREE.LinearMipmapLinearFilter&&map.colorSpace===THREE.SRGBColorSpace);
 const otherMap=((other.root.getObjectByName('whale-shark-v2-body-96') as THREE.Mesh).material as THREE.MeshStandardMaterial).map as THREE.DataTexture;
 let differ=0;const da=map.image.data as Uint8Array,db=otherMap.image.data as Uint8Array;for(let i=0;i<da.length;i+=4)if(da[i]!==db[i])differ++;assert.ok(differ>da.length/4*.1,'seed changes the spot field');
 m.root.traverse(o=>{if(o instanceof THREE.Mesh){const mat=o.material as THREE.MeshStandardMaterial;assert.equal(mat.emissive.getHex(),0);}});
 // motion: rigid front, swinging rear; fins ride the same wave (their roots stay on the body), normals stay unit
 const caudal=find('whale-shark-caudal-upper-lobe-lod0').geometry.getAttribute('position'),caudalRest=Float32Array.from(caudal.array as Float32Array);
 const rest=Float32Array.from(p.array as Float32Array),pectoral=find('whale-shark-pectoral-left-lod0').geometry.getAttribute('position'),pectoralRest=Float32Array.from(pectoral.array as Float32Array);
 m.update({phase:Math.PI/2,amplitude:1,glide:0});
 let frontMove=0,rearMove=0;for(let i=0;i<p.count;i++){const z=rest[i*3+2];if(z>.22*L)frontMove=Math.max(frontMove,Math.abs(p.getX(i)-rest[i*3]));}
 for(let i=0;i<caudal.count;i++)rearMove=Math.max(rearMove,Math.abs(caudal.getX(i)-caudalRest[i*3]));
 assert.ok(rearMove>frontMove*5,`rear ${rearMove} vs front ${frontMove}`);
 let bodyShift=NaN;for(let i=0;i<p.count;i++)if(Math.abs(rest[i*3+2]-(.5-.28)*L)<.004*L){bodyShift=p.getX(i)-rest[i*3];break;}
 let finShift=NaN;for(let i=0;i<pectoral.count;i++)if(Math.abs(pectoralRest[i*3+2]-(.5-.28)*L)<.004*L){finShift=pectoral.getX(i)-pectoralRest[i*3];break;}
 assert.ok(Math.abs(bodyShift-finShift)<.002*L,`pectoral ${finShift} and body ${bodyShift} move together`);
 m.root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const n=o.geometry.getAttribute('normal');for(let i=0;i<n.count;i+=7){const l=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));assert.ok(Math.abs(l-1)<1e-3,`${o.name} normal ${l}`);}});
 let released=0;map.addEventListener('dispose',()=>released++);m.dispose();m.dispose();assert.equal(released,1,'texture released once');other.dispose();
});
