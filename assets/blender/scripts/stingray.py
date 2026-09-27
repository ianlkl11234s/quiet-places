"""Deterministic armature-driven Southern stingray (Hypanus americanus). Native +Y nose/+Z dorsal.

Q3 B2 (2026-09-27): new disc surface, pelvic fins, whip tail, conformal eye/spiracle
details and embedded JPEG textures. The rig (`rig_width`, bone layout) and the eight
baked clips are the frozen pre-B2 contract shared by oceanlight and seaward; only
meshes, weights-by-surface and materials changed. tests/stingray-contract.test.ts
checks node/bone/clip identity against the pre-B2 GLB.
"""
from __future__ import annotations
import bpy,math,json,hashlib,bmesh,os
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
# STINGRAY_GLB_OUT / STINGRAY_BLEND_OUT export a candidate without touching the shipped files;
# STINGRAY_REVIEW_DIR (optional) renders the legacy top/side review PNGs.
BLEND=Path(os.environ.get('STINGRAY_BLEND_OUT',ROOT/'assets/blender/stingray.blend'));GLB=Path(os.environ.get('STINGRAY_GLB_OUT',ROOT/'public/models/stingray.glb'));REV=Path(os.environ['STINGRAY_REVIEW_DIR']) if os.environ.get('STINGRAY_REVIEW_DIR') else None
W,L,TL,FPS=1.34,1.117,1.65,30; U,V=7,4
# The whip covers the whole frozen tail chain (TL, ~1.5x disc length) so every tail bone
# drives skin; sources report intact tails up to ~2x (see biology doc).
TAIL_MESH=TL
SPINE0,SPINE_LEN=.11,.21  # spine origin behind the tail root (m, kept proximal) and length
# Disc grid; bounded by the 2 MB GLB budget (the frozen clips alone are ~1.46 MB).
R_ROWS,C_COLS=64,39
TEX,ROUGH_TEX=1024,256
# Planar UV window (native metres) shared by the dorsal (upper half) and ventral (lower half) atlas.
UVX=W/2+.02;UVY0,UVY1=-.68,L/2+.01
UP=SOL=LOW=DARK=None

def clamp(x,a=0.,b=1.):return max(a,min(b,x))
def ss(a,b,x):t=clamp((x-a)/(b-a));return t*t*(3-2*t)
def srgb_to_linear(c):c=np.asarray(c,dtype=np.float64);return np.where(c<=.04045,c/12.92,((c+.055)/1.055)**2.4)

# --------------------------------------------------------------------------- frozen rig outline
def rig_width(u):
 """Pre-B2 disc half-width. Frozen: fin bone rest positions and clip values depend on it."""
 k=[(0,.02),(.1,.30),(.22,.63),(.42,.94),(.52,1),(.68,.78),(.84,.43),(1,.12)]
 for(a,x),(b,y)in zip(k,k[1:]):
  if u<=b:t=(u-a)/(b-a);t=t;return (x+(y-x)*t)*W/2
 return .12*W/2

# --------------------------------------------------------------------------- B2 surface
UC=.40      # outer corner, fraction of disc length from the snout
HB=.045     # half-width where the posterior margins meet the tail base (m)
def smin(a,b,k):h=max(k-abs(a-b),0.);return min(a,b)-h*h/(4*k)
def outline(u):
 """Rhomboid disc half-width (m) at u (0 snout, 1 tail base).
 Anterior: 1.6s-.6s^2 gives a ~135 deg snout angle (STRI) and a mildly convex margin;
 the corner is a narrow smooth-min rounding; posterior margin slightly convex."""
 s=u/UC;ha=W/2*(1.6*s-.6*s*s)
 t=(u-UC)/(1-UC);hp=HB+(W/2-HB)*(1-t)*(1+.2*t)
 return max(.004,smin(ha,hp,.03))
def uv_of(x,y):
 u=clamp((L/2-y)/L);return u,min(1.,abs(x)/max(outline(u),.001))
def envelope(u):return ss(0,.30,u)*(1-.45*ss(.78,1,u))
def trunk(u):return .10+.09*math.exp(-((u-.52)/.30)**2)
EYES=[(sx*.095,.38) for sx in(-1,1)]
SPIRACLES=[(sx*.104,.318) for sx in(-1,1)]
def fin_thickness(u,v):return (1-v)**1.25*(.35+.65*ss(0,.14,u))
def top(x,y):
 """Dorsal height: thin margin, raised trunk, orbits blended into the head, midline tubercle ridge."""
 u,v=uv_of(x,y);core=envelope(u)*math.exp(-(x/trunk(u))**2)
 z=.0025+.016*fin_thickness(u,v)+.052*core
 for ex,ey in EYES:z+=.012*math.exp(-((x-ex)**2+((y-ey)*.8)**2)/.03**2)
 for sx,sy in SPIRACLES:z-=.004*math.exp(-((x-sx)**2+(y-sy)**2)/.018**2)
 return z+.0025*math.exp(-(x/.01)**2)*ss(.30,.40,u)
def bottom(x,y):
 u,v=uv_of(x,y);core=envelope(u)*math.exp(-(x/trunk(u))**2)
 return -.0015-.007*fin_thickness(u,v)-.022*core
def atlas_uv(x,y,dorsal):
 return ((x+UVX)/(2*UVX),.5*clamp((y-UVY0)/(UVY1-UVY0),.001,.999)+(.5 if dorsal else 0.))

def M(n,c,r):
 m=bpy.data.materials.new(n);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=r;return m

def mesh(name,obname,vs,fs,mats,ids=None,uvs=None):
 """uvs(face_index, vertex_index) -> (u,v) or None."""
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs)
 for m in mats:me.materials.append(m)
 for i,p in enumerate(me.polygons):p.use_smooth=True;p.material_index=ids[i] if ids else 0
 if uvs:
  layer=me.uv_layers.new(name='UVMap')
  for p in me.polygons:
   for li in p.loop_indices:layer.data[li].uv=uvs(p.index,me.loops[li].vertex_index)
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 o=bpy.data.objects.new(obname,me);bpy.context.collection.objects.link(o);return o

# --------------------------------------------------------------------------- disc + pelvic fins
def pelvic(sign,vs,fs,ids,face_dorsal,pel):
 """Small lobe with a tightly rounded apex under the rear disc, tip just past the margin."""
 A,Bn=10,6;root=(sign*.036,-.45);tip=(sign*.078,-.605)
 dx,dy=tip[0]-root[0],tip[1]-root[1];ln=math.hypot(dx,dy);ax,ay=dx/ln,dy/ln;nx,ny=-ay,ax
 base=len(vs);ring=[]
 for i in range(A+1):
  a=i/A;hw=.028*math.sin(math.pi*(.12+.88*a))**.7*(1-.25*a)
  for j in range(Bn+1):
   b=j/Bn*2-1;x=root[0]+ax*ln*a+nx*hw*b;y=root[1]+ay*ln*a+ny*hw*b
   th=.0045*(1-abs(b)**2)*(1-.6*a)+.0008;zc=-.017+.004*(1-a)
   ring.append((x,y,zc+th,zc-th))
 n=len(ring)
 for x,y,zt,zb in ring:vs.append((x,y,zt));pel.add(len(vs)-1)
 for x,y,zt,zb in ring:vs.append((x,y,zb));pel.add(len(vs)-1)
 for q in(0,1):
  o=base+q*n
  for i in range(A):
   for j in range(Bn):
    a=o+i*(Bn+1)+j;b=a+1;c=b+Bn+1;d=a+Bn+1;fs.append((a,b,c,d)if q==0 else(d,c,b,a));ids.append(q);face_dorsal.append(q==0)
 # closed rim: sides and apex
 for i in range(A):
  for j in(0,Bn):
   a=base+i*(Bn+1)+j;b=a+Bn+1;fs.append((a,b,b+n,a+n));ids.append(0);face_dorsal.append(True)
 for j in range(Bn):
  a=base+A*(Bn+1)+j;fs.append((a,a+1,a+1+n,a+n));ids.append(0);face_dorsal.append(True)
def disc():
 R,C=R_ROWS,C_COLS;vs=[];fs=[];ids=[];dors=[]
 for q in(0,1):
  for i in range(R):
   u=i/(R-1);y=L/2-u*L;h=outline(u)
   for j in range(C):
    x=h*(j/(C-1)*2-1);vs.append((x,y,top(x,y) if q==0 else bottom(x,y)))
 N=R*C
 for q in(0,1):
  o=q*N
  for i in range(R-1):
   for j in range(C-1):
    a=o+i*C+j;b=a+1;c=b+C;d=a+C;fs.append((a,b,c,d)if q==0 else(d,c,b,a));ids.append(q);dors.append(q==0)
 for i in range(R-1):
  for j in(0,C-1):
   a=i*C+j;b=(i+1)*C+j;c=N+(i+1)*C+j;d=N+i*C+j;fs.append((a,b,c,d)if j else(b,a,d,c));ids.append(0);dors.append(True)
 for row in (0,R-1):
  for j in range(C-1):
   a=row*C+j;fs.append((a,a+1,N+a+1,N+a));ids.append(0);dors.append(True)
 pel=set()
 for sign in(-1,1):pelvic(sign,vs,fs,ids,dors,pel)
 def uv(f,v):
  x,y,_=vs[v]
  # Pelvic lobes sample a plain interior skin patch, not the tinted disc margin they lie under.
  if v in pel:return atlas_uv(.22+.5*(abs(x)-.03),-.10+.5*(y+.45),dors[f])
  return atlas_uv(x,y,dors[f])
 o=mesh('SRAY_SectionQuadDisc','SRAY_Disc',vs,fs,[UP,LOW],ids,uv)
 return o,pel

# --------------------------------------------------------------------------- conformal details
def patch(name,obname,centre,rx,ry,surface,lift,mat,rings=5,seg=20,angle=0.,arc=(0,2*math.pi),inner=0.,uv=None):
 """Elliptical (or annular/crescent) sheet that follows the disc surface; lift(r)->offset (m)."""
 cx,cy=centre;vs=[];fs=[];ca,sa=math.cos(angle),math.sin(angle)
 full=abs(arc[1]-arc[0]-2*math.pi)<1e-6;S=seg if full else seg+1
 for i in range(rings+1):
  r=inner+(1-inner)*i/rings
  for j in range(S):
   a=arc[0]+(arc[1]-arc[0])*j/seg;lx,ly=r*rx*math.cos(a),r*ry*math.sin(a)
   x=cx+lx*ca-ly*sa;y=cy+lx*sa+ly*ca;vs.append((x,y,surface(x,y)+lift(r,a)))
 start=0
 if inner==0:
  # collapse the centre ring into one vertex
  vs=[(cx,cy,surface(cx,cy)+lift(0,0))]+vs[S:];off=1
  for j in range(seg if full else seg):fs.append((0,off+j,off+(j+1)%S) if full else (0,off+j,off+j+1))
  start=1;rows=rings-1;base=1
 else:rows=rings;base=0
 for i in range(rows):
  for j in range(seg):
   a=base+i*S+j;b=base+i*S+(j+1)%S;fs.append((a,b,b+S,a+S))
 return mesh(obname+'_Mesh',obname,vs,fs,[mat],uvs=(lambda f,v:uv(vs[v][0],vs[v][1])) if uv else None)
def details():
 a=[];dorsal_uv=lambda x,y:atlas_uv(x,y,True)
 names=['SRAY_EyeSocket','SRAY_Eye','SRAY_Eyelid','SRAY_Spiracle']
 for k,((ex,ey),(sx,sy)) in enumerate(zip(EYES,SPIRACLES)):
  suffix='' if k==0 else '.001';side=1 if ex>0 else -1
  # Orbit margin: narrow skin rim that overlaps the eyeball edge and fades into the orbit swelling,
  # so the eye reads as set into the head rather than a separate button.
  a.append(patch('SRAY_EyeSocketMesh','SRAY_EyeSocket'+suffix,(ex,ey),.0215,.0182,top,lambda r,t:.0003+.0016*(1-(r-.78)/.22)**2,UP,rings=3,seg=24,inner=.78,uv=dorsal_uv))
  # Eye: dark cornea cap sunk into the orbit swelling; only ~5 mm stands proud.
  cap=lambda r,t:-.0045+.0080*math.sqrt(max(0.,1-r*r))
  a.append(patch('SRAY_EyeMesh','SRAY_Eye'+suffix,(ex,ey),.0175,.014,top,cap,DARK,rings=5,seg=18))
  # Upper lid: crescent fold over the medial/dorsal edge of the eye, same skin texture.
  a0=math.pi*.15 if side>0 else math.pi*.85
  arc=(math.pi*.10,math.pi*.95) if side>0 else (math.pi*.05,math.pi*.90)
  a.append(patch('SRAY_EyelidMesh','SRAY_Eyelid'+suffix,(ex,ey),.021,.018,top,lambda r,t:.0006+.0028*math.sin(math.pi*(r-.6)/.4)**1.5,UP,rings=3,seg=14,inner=.6,arc=arc,uv=dorsal_uv))
  # Spiracle: dark opening lying in the shallow depression just behind the eye.
  a.append(patch('SRAY_SpiracleMesh','SRAY_Spiracle'+suffix,(sx,sy),.017,.010,top,lambda r,t:.0007,DARK,rings=2,seg=14,angle=side*.35))
 # Ventral mouth and five pairs of gill slits: thin dark sheets just under the belly.
 under=lambda x,y:bottom(x,y)
 a.append(patch('SRAY_MouthMesh','SRAY_Mouth',(0,.300),.045,.0045,under,lambda r,t:-.0008,DARK,rings=2,seg=18))
 gi=0
 for side in(-1,1):
  for n in range(5):
   x=side*(.098+.009*n);y=.238-.034*n
   a.append(patch('SRAY_GillMesh','SRAY_Gill'+('' if gi==0 else f'.{gi:03d}'),(x,y),.022-.002*n,.0028,under,lambda r,t:-.0008,DARK,rings=1,seg=10,angle=side*(.30+.05*n)));gi+=1
 return a

# --------------------------------------------------------------------------- tail, fold, spine
Y0=-L/2+.05  # tail mesh starts inside the disc so the root is buried
def tail_section(t):
 a=.050*(1-t)**2.2+.0012;b=a*(.62+.30*t);zc=.012*(1-t)**2-.002
 return a,b,zc
def tail():
 S,Q=64,10;vs=[];fs=[]
 for i in range(S):
  t=(i/(S-1))**1.15;y=Y0-TAIL_MESH*t;a,b,zc=tail_section(t)
  d=t*TAIL_MESH;keel=.0035*ss(SPINE0+.08,SPINE0+.17,d)*(1-ss(SPINE0+.35,SPINE0+.55,d))  # low dorsal keel behind the spine (STRI)
  for j in range(Q):
   g=2*math.pi*j/Q;sg=math.sin(g);vs.append((a*math.cos(g),y,zc+b*sg+keel*max(0.,sg)**8))
 for i in range(S-1):
  for j in range(Q):fs.append((i*Q+j,i*Q+(j+1)%Q,(i+1)*Q+(j+1)%Q,(i+1)*Q+j))
 fs.extend([tuple(range(Q-1,-1,-1)),tuple((S-1)*Q+j for j in range(Q))])
 o=mesh('SRAY_TailMesh','SRAY_Tail',vs,fs,[SOL])
 # Ventral fin-fold: from below the spine almost to the tip, about as deep as the tail is high.
 f=[];K=40
 for i in range(K):
  t0=(SPINE0+.05)/TAIL_MESH;t=t0+i/(K-1)*(.94-t0);y=Y0-TAIL_MESH*t;a,b,zc=tail_section(t)
  depth=2*b*ss(t0,t0+.08,t)*(1-ss(.80,.94,t))+.0008;th=.0022*(1-t)+.0005
  f += [(-th,y,zc-b*.6),(th,y,zc-b*.6),(th*.4,y,zc-b-depth),(-th*.4,y,zc-b-depth)]
 ff=[(i*4+k,i*4+(k+1)%4,(i+1)*4+(k+1)%4,(i+1)*4+k)for i in range(K-1)for k in range(4)]+[(3,2,1,0),tuple((K-1)*4+k for k in range(4))]
 fo=mesh('SRAY_VentralFold','SRAY_VentralTailFold',f,ff,[SOL])
 # Serrated spine lying on the tail top, pointing back; length ~ outer inter-orbital width (Florida Museum).
 sp=[];N=48;ts=SPINE0/TAIL_MESH;length=SPINE_LEN
 for i in range(N+1):
  s=i/N;y=Y0-TAIL_MESH*ts-length*s;t=(Y0-y)/TAIL_MESH;a,b,zc=tail_section(t)
  w=.0065*(1-s**1.4)+.0003+(.0010*(1-s) if i%2 else 0.);h=.0022*(1-s)+.0004;z=zc+b+.0015+.004*s
  sp += [(-w,y,z),(0,y,z+h),(w,y,z),(0,y,z-h)]
 sf=[(i*4+k,i*4+(k+1)%4,(i+1)*4+(k+1)%4,(i+1)*4+k)for i in range(N)for k in range(4)]+[(3,2,1,0),tuple(N*4+k for k in range(4))]
 ba=mesh('SRAY_ProximalBarbMesh','SRAY_ProximalBarb',sp,sf,[DARK])
 return o,fo,ba

# --------------------------------------------------------------------------- textures
def value_noise(X,Y,cell,seed):
 """Smooth deterministic value noise, cell size in metres; range about [-1,1]."""
 g=np.random.default_rng(seed).random((int(2/cell)+4,int(2/cell)+4))*2-1
 gx=(X+1)/cell;gy=(Y+1)/cell;ix=np.floor(gx).astype(int);iy=np.floor(gy).astype(int);fx=gx-ix;fy=gy-iy
 fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy)
 a=g[iy,ix];b=g[iy,ix+1];c=g[iy+1,ix];d=g[iy+1,ix+1]
 return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy
def fbm(X,Y,seed,freqs):
 out=sum(amp*value_noise(X,Y,cell,seed+i) for i,(cell,amp) in enumerate(freqs))
 return out/sum(a for _,a in freqs)
def paint(res):
 """Returns (sRGB base colour, roughness) for the res x res atlas (row 0 = v 0)."""
 half=res//2;cols=(np.arange(res)+.5)/res;rows=(np.arange(half)+.5)/half
 X=-UVX+cols[None,:]*2*UVX;Y=UVY0+rows[:,None]*(UVY1-UVY0);X=np.broadcast_to(X,(half,res));Y=np.broadcast_to(Y,(half,res))
 u=np.clip((L/2-Y)/L,0,1);ol=np.vectorize(outline)(u[:,0])[:,None];v=np.clip(np.abs(X)/ol,0,1)
 behind=Y< -L/2  # pelvic lobes beyond the disc
 v=np.where(behind,.3,v)
 lo=fbm(X,Y,7,[(.16,1.),(.08,.6)]);mid=fbm(X,Y,11,[(.03,1.),(.015,.5)]);grain=np.random.default_rng(3).random(X.shape)-.5
 # Dorsal: grey-brown/olive (FishBase, STRI); faint mottle only (sources: "uniform").
 base=np.array([.37,.355,.285]);lum=1+.07*lo+.03*mid+.012*grain
 eyes=np.exp(-((X/.13)**2+((Y-.36)/.055)**2))          # dusky between/below eyes
 for ex,ey in EYES:eyes=eyes+.8*np.exp(-(((X-ex)/.035)**2+((Y-ey+.012)/.03)**2))
 lum=lum*(1-.11*np.clip(eyes,0,1))
 spot=np.exp(-((X/.017)**2+((Y-.447)/.020)**2))        # pale snout spot before the eyes (STRI)
 band=np.exp(-(X/.035)**2)*np.clip((.33-Y)/.05,0,1)    # central denticle band behind the eyes
 tub=np.exp(-(X/.0055)**2)*np.clip(np.cos(2*math.pi*Y/.024),0,1)**6*np.clip((.30-Y)/.03,0,1)*(Y> -L/2+.02)
 dorsal=base[None,None,:]*lum[...,None]
 dorsal=dorsal*(1+.03*band[...,None])+.05*tub[...,None]+.13*spot[...,None]
 rim=np.clip((v-.90)/.10,0,1)**1.5*(~behind)             # thin margin: warmer and lighter (art cue, not transmission)
 dorsal=dorsal*(1-.45*rim[...,None])+np.array([.47,.43,.33])*.45*rim[...,None]
 # Ventral: white with a grey-brown disc margin (FishBase, STRI).
 white=np.array([.90,.89,.85]);edge=np.array([.55,.50,.43]);m=np.clip((v-.80)/.20,0,1)**1.3
 ventral=white*(1-m[...,None])+edge*m[...,None];ventral=ventral*(1+.012*mid[...,None]+.008*grain[...,None])
 rd=.70+.03*lo+.02*mid+.07*band+.08*tub-.08*rim;rv=.56+.03*mid+.04*m
 col=np.concatenate([ventral,dorsal],0);rough=np.concatenate([rv,rd],0)
 return np.clip(col,0,1),np.clip(rough,.35,.9)
def image(name,rgb,non_color=False):
 h,w=rgb.shape[:2];img=bpy.data.images.new(name,w,h,alpha=False)
 if non_color:img.colorspace_settings.name='Non-Color'
 px=np.ones((h,w,4),np.float32);px[...,:3]=rgb;img.pixels.foreach_set(px.ravel());img.pack();return img
def skin_materials():
 col,_=paint(TEX);_,rough=paint(ROUGH_TEX)
 mr=np.zeros((ROUGH_TEX,ROUGH_TEX,3));mr[...,1]=rough
 base=image(f'sray_basecolor_{TEX}',col);rimg=image(f'sray_roughness_{ROUGH_TEX}',mr,True)
 out=[]
 for name in('SRAY_Upper_Mottled','SRAY_Underside'):
  m=bpy.data.materials.new(name);m.use_nodes=True;nt=m.node_tree;bs=nt.nodes['Principled BSDF']
  b=nt.nodes.new('ShaderNodeTexImage');b.image=base;r=nt.nodes.new('ShaderNodeTexImage');r.image=rimg
  sep=nt.nodes.new('ShaderNodeSeparateColor');nt.links.new(b.outputs['Color'],bs.inputs['Base Color'])
  nt.links.new(r.outputs['Color'],sep.inputs['Color']);nt.links.new(sep.outputs['Green'],bs.inputs['Roughness'])
  out.append(m)
 return out,float(np.mean(col[TEX//2:],axis=(0,1)).mean())

# --------------------------------------------------------------------------- rig (bones frozen)
def disc_weights(x,y):
 """Pre-B2 grid weights, with v normalised by the new outline so each mesh point keeps its grid cell."""
 u=clamp((L/2-y)/L);v=min(1,abs(x)/max(outline(u),.001));uf=u*(U-1);vf=v*V
 ui=min(U-2,int(uf));vi=min(V-1,int(vf));weights={}
 for ud,uw in ((0,1-(uf-ui)),(1,uf-ui)):
  for vd,vw in ((0,1-(vf-vi)),(1,vf-vi)):
   n='body_mid' if vi+vd==0 else f'{"R" if x>=0 else "L"}_FIN_U{ui+ud:02d}_V{vi+vd:02d}'
   weights[n]=weights.get(n,0)+uw*vw
 return weights
def rig(d,pel,ta,fo,ba,ds):
 bpy.ops.object.armature_add(enter_editmode=True);r=bpy.context.object;r.name='SRAY_RIG';e=r.data.edit_bones;e.remove(e[0])
 def B(n,h,t,p=None,**z):
  b=e.new(n);b.head=h;b.tail=t;b.parent=p
  for k,v in z.items():b[k]=v
  return b
 root=B('root',(0,0,0),(0,0,.12),None,role='root');master=B('body_master',(0,0,0),(0,.18,.08),root,role='body');front=B('body_front',(0,.1,.03),(0,.38,.08),master,role='body');mid=B('body_mid',(0,0,.03),(0,.18,.08),master,role='body');back=B('body_back',(0,-.16,.02),(0,-.38,.06),master,role='body');B('head_ctrl',(0,.3,.04),(0,.48,.08),front,role='head')
 for Sg,le in((-1,'L'),(1,'R')):
  for ui in range(U):
   u=ui/(U-1);y=L/2-u*L
   for vi in range(1,V+1):
    v=vi/V;x=Sg*rig_width(u)*v;B(f'{le}_FIN_U{ui:02d}_V{vi:02d}',(x,y,0),(x,y,.12),mid,role='fin',side=le,u=u,v=v)
 prev=back;tn=[]
 for i in range(10):
  y=-L/2-TL*i/10;prev=B(f'tail_{i+1:02d}',(0,y,0),(0,y-TL/10,0),prev,role='tail',order=i+1);tn.append(prev.name)
 bpy.ops.object.mode_set(mode='POSE')
 for p in r.pose.bones:p.rotation_mode='QUATERNION'
 bpy.ops.object.mode_set(mode='OBJECT')
 for o in(d,ta,fo,ba,*ds):o.parent=r;m=o.modifiers.new('SRAY_Armature','ARMATURE');m.object=r
 fin_groups=['body_mid']+[f'{le}_FIN_U{ui:02d}_V{vi:02d}' for le in('L','R') for ui in range(U) for vi in range(1,V+1)]
 for o in(d,*ds):
  for n in fin_groups:o.vertex_groups.new(name=n)
  for i,z in enumerate(o.data.vertices):
   x,y,_=z.co
   if o is d and i in pel:
    # Pelvic lobes copy the disc point above them so the flapping rear margin cannot pass through.
    y=max(y,-L/2);u=clamp((L/2-y)/L);x=math.copysign(min(abs(x),outline(u)*.98),x)
   for n,w in disc_weights(x,y).items():
    if w>0:o.vertex_groups[n].add([i],w,'REPLACE')
 for o in(ta,fo,ba):
  for n in tn:o.vertex_groups.new(name=n)
  for i,z in enumerate(o.data.vertices):
   t=max(0,min(9,(-z.co.y-L/2)/TL*10));j=min(8,int(t));f=t-j
   o.vertex_groups[tn[j]].add([i],1-f,'REPLACE');o.vertex_groups[tn[j+1]].add([i],f,'REPLACE')
 return r,tn
def clip(r,n,k):
 a=bpy.data.actions.new(n);slot=a.slots.new('OBJECT',r.name);r.animation_data_create();r.animation_data.action=a;r.animation_data.action_slot=slot
 # A complete wave per clip. Runtime integrates swim distance into this phase.
 settings={'IDLE_HOVER':(.016,4),'SLOW_CRUISE':(.040,2),'CRUISE':(.048,1.4),'TURN_LEFT':(.040,2),'TURN_RIGHT':(.040,2),'RISE':(.040,3),'SETTLE':(.025,3),'RISE_AND_SETTLE':(.036,6)}
 amplitude,duration=settings[k];frames=round(duration*FPS)
 def height(x,y,t,side):
  u=max(0,min(1,(L/2-y)/L));v=min(1,abs(x)/max(rig_width(u),.001));gain=1
  if k=='TURN_LEFT':gain=1.25 if side=='L' else .55
  if k=='TURN_RIGHT':gain=1.25 if side=='R' else .55
  return amplitude*gain*v**1.9*math.sin(2*math.pi*(t-1.25*u))
 for f in range(frames+1):
  t=f/frames
  for p in r.pose.bones:
   p.location=(0,0,0);p.rotation_quaternion=(1,0,0,0);role=p.bone.get('role');basis=p.bone.matrix_local.to_quaternion()
   if role=='fin':
    x,y,_=p.bone.head_local;side=p.bone['side'];h=height(x,y,t,side);eps=.002
    dx=(height(x+eps,y,t,side)-height(x-eps,y,t,side))/(2*eps);dy=(height(x,y+eps,t,side)-height(x,y-eps,t,side))/(2*eps)
    p.location=basis.inverted()@Vector((0,0,h));q=Vector((0,0,1)).rotation_difference(Vector((-dx*.55,-dy*.55,1)).normalized());p.rotation_quaternion=basis.inverted()@q@basis
   if p.name=='body_master' and k in ('RISE','SETTLE','RISE_AND_SETTLE'):
    z=.10*math.sin(math.pi*t)**2 if k=='RISE_AND_SETTLE' else .07*(t*t*(3-2*t))*(1 if k=='RISE' else -1)
    p.location=basis.inverted()@Vector((0,0,z))
   if role in ('fin','tail') or p.name=='body_master':
    p.keyframe_insert('location',frame=f);p.keyframe_insert('rotation_quaternion',frame=f)
 a['cycles']=1;a['duration_seconds']=duration;a['in_place']=True;a['loop']=k not in ('RISE','SETTLE')
 for layer in a.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for key in fc.keyframe_points:key.interpolation='LINEAR'
def run():
 bpy.ops.wm.read_factory_settings(use_empty=True);global UP,SOL,LOW,DARK
 (UP,LOW),dorsal_mean=skin_materials()
 # Tail/fold: plain upper tone matching the dorsal texture average (linear).
 tail_lin=tuple(float(c) for c in srgb_to_linear([.345,.330,.265]))
 SOL=M('SRAY_Upper_Solid',tail_lin,.72);DARK=M('SRAY_Detail',(.028,.025,.021),.48)
 s=bpy.context.scene;s.name='Southern_Stingray_Procedural';s.render.engine='BLENDER_EEVEE';s.render.resolution_x=900;s.render.resolution_y=700;s.render.image_settings.file_format='PNG';s.render.fps=FPS;s.world=bpy.data.worlds.new('SRAY_World');s.world.color=(.012,.02,.025)
 d,pel=disc();ds=details();ta,fo,ba=tail();r,tn=rig(d,pel,ta,fo,ba,ds);names=['IDLE_HOVER','SLOW_CRUISE','CRUISE','TURN_LEFT','TURN_RIGHT','RISE','SETTLE','RISE_AND_SETTLE']
 for n in names:
  action_name='SRAY_ACT_'+n;clip(r,action_name,n)
  # Keep every action as an NLA-ready datablock user. Blender's glTF action
  # exporter otherwise drops unreferenced procedural actions.
  track=r.animation_data.nla_tracks.new();track.name=action_name;strip=track.strips.new(action_name,0,bpy.data.actions[action_name]);strip.action_slot=bpy.data.actions[action_name].slots[0];track.mute=True
 bpy.ops.mesh.primitive_plane_add(size=12,location=(0,0,-.42));g=bpy.context.object;g.data.materials.append(M('Ground',(.025,.04,.045),.58))
 for loc,pow in[((-2,2,3),750),((2,-2,2),350)]:bpy.ops.object.light_add(type='AREA',location=loc);bpy.context.object.data.energy=pow;bpy.context.object.data.size=4
 bpy.ops.object.camera_add(location=(2.8,3.8,2.5));cam=bpy.context.object;cam.data.lens=55;cam.rotation_euler=(Vector((0,-.28,0))-cam.location).to_track_quat('-Z','Y').to_euler();s.camera=cam
 bpy.ops.object.empty_add(type='PLAIN_AXES');root=bpy.context.object;root.name='SRAY_ROOT__Three_Z_Forward';root.rotation_euler[2]=math.pi
 for o in[r]:o.parent=root
 r.animation_data.action=bpy.data.actions['SRAY_ACT_SLOW_CRUISE'];r.animation_data.action_slot=r.animation_data.action.slots[0];s.frame_start=0;s.frame_end=60;s.frame_set(0)
 meshes=[d,ta,fo,ba,*ds];tris=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
 meta={'asset':'stingray.glb','species':'Southern stingray (Hypanus americanus)','revision':'Q3 B2 2026-09-27 (candidate)',
  'triangles':tris,'disc_grid':[R_ROWS,C_COLS],'disc':{'span_m':W,'length_m':L,'corner_u':UC,'snout_angle_deg':135},
  'tail_mesh_m':round(TAIL_MESH,4),'tail_rig_m':TL,'textures':{'baseColor':[TEX,TEX],'metallicRoughness':[ROUGH_TEX,ROUGH_TEX],'format':'JPEG q85','atlas':'upper half dorsal, lower half ventral; planar XY'},
  'contract':'pre-B2 rig, 72 joints, 8 clips unchanged (tests/stingray-contract.test.ts)'}
 s['q3_b2']=json.dumps(meta,ensure_ascii=False)
 BLEND.parent.mkdir(parents=True,exist_ok=True);GLB.parent.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
 bpy.ops.object.select_all(action='DESELECT');root.select_set(True);r.select_set(True)
 for o in meshes:o.select_set(True)
 bpy.context.view_layer.objects.active=r;bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_extras=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_image_format='JPEG',export_jpeg_quality=85,export_tangents=False)
 if REV:
  REV.mkdir(parents=True,exist_ok=True);s.render.filepath=str(REV/'stingray-top.png');bpy.ops.render.render(write_still=True);cam.location=(3.6,-2.9,1.15);cam.rotation_euler=(Vector((0,-.32,.02))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(REV/'stingray-side.png');bpy.ops.render.render(write_still=True)
 data=GLB.read_bytes()
 print('SRAY_REPORT='+json.dumps({**meta,'clips':['SRAY_ACT_'+n for n in names],'fin_bones':56,'tail_bones':tn,'glb_bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()},ensure_ascii=False))
if __name__=='__main__':run()
