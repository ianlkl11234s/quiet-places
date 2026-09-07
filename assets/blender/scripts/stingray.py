"""Deterministic armature-driven Southern stingray. Native +Y nose/+Z dorsal."""
from __future__ import annotations
import bpy,math,json,hashlib,bmesh
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]; BLEND=ROOT/'assets/blender/stingray.blend';GLB=ROOT/'public/models/stingray.glb';REV=ROOT/'exports/blender-review'
W,L,TL,FPS=1.34,1.117,1.65,30; U,V=7,4
UP=SOL=LOW=DARK=None
def M(n,c,r):
 m=bpy.data.materials.new(n);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=r;return m
def width(u):
 k=[(0,.02),(.1,.30),(.22,.63),(.42,.94),(.52,1),(.68,.78),(.84,.43),(1,.12)]
 for(a,x),(b,y)in zip(k,k[1:]):
  if u<=b:t=(u-a)/(b-a);t=t;return (x+(y-x)*t)*W/2
 return .12*W/2
def surf(x,y,top=True):
 u=max(0,min(1,(L/2-y)/L));v=min(1,abs(x)/max(width(u),.001));core=math.exp(-((u-.43)/.28)**2)*(1-v)**2
 return (.012+.07*core+.028*math.exp(-((u-.16)/.16)**2-(v/.25)**2)) if top else (-.01-.03*core)
def disc():
 R,C=49,33;vs=[];fs=[];ids=[]
 for q in(0,1):
  for i in range(R):
   u=i/(R-1);y=L/2-u*L
   for j in range(C):
    s=j/(C-1)*2-1;x=width(u)*s;core=math.exp(-((u-.43)/.28)**2)*(1-abs(s))**2;vs.append((x,y,.012+.07*core+.028*math.exp(-((u-.16)/.16)**2-(abs(s)/.25)**2)if q==0 else -.01-.03*core))
 N=R*C
 for q in(0,1):
  o=q*N
  for i in range(R-1):
   for j in range(C-1):
    a=o+i*C+j;b=a+1;c=b+C;d=a+C;fs.append((a,b,c,d)if q==0 else(d,c,b,a));ids.append(q)
 for i in range(R-1):
  for j in(0,C-1):
   a=i*C+j;b=(i+1)*C+j;c=N+(i+1)*C+j;d=N+i*C+j;fs.append((a,b,c,d)if j else(b,a,d,c));ids.append(0)
 for row in (0,R-1):
  for j in range(C-1):
   a=row*C+j;fs.append((a,a+1,N+a+1,N+a));ids.append(0)
 me=bpy.data.meshes.new('SRAY_SectionQuadDisc');me.from_pydata(vs,[],fs);me.materials.append(UP);me.materials.append(LOW)
 for p,q in zip(me.polygons,ids):p.material_index=q;p.use_smooth=True
 ca=me.color_attributes.new('SRAY_Mottle','FLOAT_COLOR','CORNER')
 # Keep pale ventral albedo on the underside, not interpolated onto the rim.
 for poly in me.polygons:
  for li in poly.loop_indices:
   x,y,_=me.vertices[me.loops[li].vertex_index].co
   t=max(.55,min(1.05,.82+.12*math.sin(13*x+7*y)+.06*math.sin(31*x-18*y)))
   ca.data[li].color=(.14*t,.122*t,.086*t,1) if poly.material_index==0 else (1,1,1,1)
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 o=bpy.data.objects.new('SRAY_Disc',me);bpy.context.collection.objects.link(o);return o,R,C
def sph(n,l,s,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=14,ring_count=8,location=l);o=bpy.context.object;o.name=n;o.scale=s;o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 return o
def details():
 a=[]
 for x in(-.155,.155):
  z=surf(x,.265);a += [sph('SRAY_EyeSocket',(x,.265,z+.003),(.044,.038,.014),SOL),sph('SRAY_Eye',(x,.265,z+.01),(.027,.022,.014),DARK),sph('SRAY_Eyelid',(x,.252,z+.022),(.041,.033,.01),SOL),sph('SRAY_Spiracle',(x,.1,surf(x,.1)+.001),(.03,.018,.005),DARK)]
 a.append(sph('SRAY_Mouth',(0,.27,surf(0,.27,False)-.003),(.092,.018,.006),DARK))
 for x in(-.15,.15):
  for n in range(5):
   y=.13-n*.065;a.append(sph('SRAY_Gill',(x,y,surf(x,y,False)-.003),(.05,.008,.004),DARK))
 return a
def tail():
 S,Q=41,8;vs=[];fs=[]
 for i in range(S):
  t=i/(S-1);y=-L/2-TL*t;x=.018*math.sin(t*math.pi*.75)*t**1.5;r=.034*(1-t)**1.18+.003
  for j in range(Q):a=2*math.pi*j/Q;vs.append((x+r*math.cos(a),y,-.005+r*.55*math.sin(a)))
 for i in range(S-1):
  for j in range(Q):fs.append((i*Q+j,i*Q+(j+1)%Q,(i+1)*Q+(j+1)%Q,(i+1)*Q+j))
 fs.extend([tuple(range(Q-1,-1,-1)),tuple((S-1)*Q+j for j in range(Q))])
 me=bpy.data.meshes.new('SRAY_TailMesh');me.from_pydata(vs,[],fs);me.materials.append(SOL)
 for p in me.polygons:p.use_smooth=True
 o=bpy.data.objects.new('SRAY_Tail',me);bpy.context.collection.objects.link(o)
 # modest ventral fold and defensive proximal barb
 f=[]
 for i in range(16):
  t=.2+i/15*.62;y=-L/2-TL*t;f += [(-.01,y,-.025),(.01,y,-.025),(0,y,-.065*(1-t))]
 fm=bpy.data.meshes.new('SRAY_VentralFold');fm.from_pydata(f,[],[(i*3+k,i*3+(k+1)%3,(i+1)*3+(k+1)%3,(i+1)*3+k)for i in range(15)for k in range(3)]);fm.materials.append(LOW);fo=bpy.data.objects.new('SRAY_VentralTailFold',fm);bpy.context.collection.objects.link(fo);bar=sph('SRAY_ProximalBarb',(0,-.78,.015),(.012,.095,.009),DARK);return o,fo,bar
def rig(d,R,C,ta,fo,ba):
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
    v=vi/V;x=Sg*width(u)*v;B(f'{le}_FIN_U{ui:02d}_V{vi:02d}',(x,y,0),(x,y,.12),mid,role='fin',side=le,u=u,v=v)
 prev=back;tn=[]
 for i in range(10):
  y=-L/2-TL*i/10;prev=B(f'tail_{i+1:02d}',(0,y,0),(0,y-TL/10,0),prev,role='tail',order=i+1);tn.append(prev.name)
 bpy.ops.object.mode_set(mode='POSE')
 for p in r.pose.bones:p.rotation_mode='QUATERNION'
 bpy.ops.object.mode_set(mode='OBJECT')
 for o in(d,ta,fo,ba):o.parent=r;m=o.modifiers.new('SRAY_Armature','ARMATURE');m.object=r
 d.vertex_groups.new(name='body_mid')
 for le in('L','R'):
  for ui in range(U):
   for vi in range(1,V+1):d.vertex_groups.new(name=f'{le}_FIN_U{ui:02d}_V{vi:02d}')
 for i,z in enumerate(d.data.vertices):
  x,y,_=z.co;u=max(0,min(1,(L/2-y)/L));v=min(1,abs(x)/max(width(u),.001));uf=u*(U-1);vf=v*V
  ui=min(U-2,int(uf));vi=min(V-1,int(vf));weights={}
  for ud,uw in ((0,1-(uf-ui)),(1,uf-ui)):
   for vd,vw in ((0,1-(vf-vi)),(1,vf-vi)):
    n='body_mid' if vi+vd==0 else f'{"R" if x>=0 else "L"}_FIN_U{ui+ud:02d}_V{vi+vd:02d}'
    weights[n]=weights.get(n,0)+uw*vw
  for n,w in weights.items():
   if w>0:d.vertex_groups[n].add([i],w,'REPLACE')
 for o in(ta,fo,ba):
  bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.select_set(False)
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
  u=max(0,min(1,(L/2-y)/L));v=min(1,abs(x)/max(width(u),.001));gain=1
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
 UP=M('SRAY_Upper_Mottled',(.16,.14,.105),.76);n=UP.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='SRAY_Mottle';UP.node_tree.links.new(n.outputs['Color'],UP.node_tree.nodes['Principled BSDF'].inputs['Base Color']);SOL=M('SRAY_Upper_Solid',(.14,.122,.086),.76);LOW=M('SRAY_Underside',(.63,.58,.47),.80);DARK=M('SRAY_Detail',(.025,.02,.012),.66)
 s=bpy.context.scene;s.name='Southern_Stingray_Procedural';s.render.engine='BLENDER_EEVEE';s.render.resolution_x=900;s.render.resolution_y=700;s.render.image_settings.file_format='PNG';s.render.fps=FPS;s.world=bpy.data.worlds.new('SRAY_World');s.world.color=(.012,.02,.025)
 d,R,C=disc();ds=details();ta,fo,ba=tail();r,tn=rig(d,R,C,ta,fo,ba);names=['IDLE_HOVER','SLOW_CRUISE','CRUISE','TURN_LEFT','TURN_RIGHT','RISE','SETTLE','RISE_AND_SETTLE']
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
 for o in ds:
  o.parent=r;vg=o.vertex_groups.new(name='body_mid');vg.add(list(range(len(o.data.vertices))),1,'REPLACE');mod=o.modifiers.new('SRAY_Armature','ARMATURE');mod.object=r
 r.animation_data.action=bpy.data.actions['SRAY_ACT_SLOW_CRUISE'];r.animation_data.action_slot=r.animation_data.action.slots[0];s.frame_start=0;s.frame_end=60;s.frame_set(0)
 BLEND.parent.mkdir(parents=True,exist_ok=True);REV.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
 bpy.ops.object.select_all(action='DESELECT');root.select_set(True);r.select_set(True)
 for o in [d,ta,fo,ba,*ds]:o.select_set(True)
 bpy.context.view_layer.objects.active=r;bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_extras=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True)
 s.render.filepath=str(REV/'stingray-top.png');bpy.ops.render.render(write_still=True);cam.location=(3.6,-2.9,1.15);cam.rotation_euler=(Vector((0,-.32,.02))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(REV/'stingray-side.png');bpy.ops.render.render(write_still=True)
 print('SRAY_REPORT='+json.dumps({'clips':['SRAY_ACT_'+n for n in names],'fin_bones':56,'tail_bones':tn,'triangles':sum(len(p.vertices)-2 for o in[d,ta,fo,*ds]for p in o.data.polygons),'sha256':hashlib.sha256(GLB.read_bytes()).hexdigest()}))
if __name__=='__main__':run()
