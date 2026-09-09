"""Self-authored juvenile blacktip reef shark, Blender +X nose / +Y dorsal.

No imported geometry or textures.  The sixteen Spine bones are deliberately
independent Root children: the web patrol owns absolute centreline poses.
"""
import json, math
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/models/blacktip-shark.glb'
BLEND = ROOT / 'assets/blender/blacktip-shark.blend'
REVIEW = ROOT / 'exports/shark-review'
S = (0,.06,.13,.21,.30,.40,.51,.61,.70,.78,.84,.89,.93,.96,.985,1.)
TAU = math.tau

def mat(name, color, rough=.42):
    m=bpy.data.materials.new(name); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=rough; bs.inputs['Specular IOR Level'].default_value=.28
    return m

def obj_mesh(name, vs, fs, material):
    # Blender Z-up -> GLB Y-up: author all anatomy in the published contract
    # (x nose, y dorsal, z lateral), then map it to Blender coordinates.
    vs=[(p[0],-p[2],p[1]) for p in vs]
    me=bpy.data.meshes.new(name+'_MESH'); me.from_pydata(vs,[],fs); me.materials.append(material)
    ob=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(ob)
    for p in me.polygons:p.use_smooth=True
    return ob

def profile(s):
    # half-height dorsal/ventral and lateral radius, metres: blunt juvenile head
    keys=((0,.003,.003,.003,0),(.035,.037,.034,.027,0),(.10,.062,.056,.043,0),(.16,.075,.065,.050,0),
          (.34,.082,.073,.056,0),(.55,.074,.066,.050,0),(.72,.056,.050,.038,0),
          (.87,.032,.029,.022,0),(1,.010,.010,.008,0))
    # Shape-preserving Hermite interpolation of squared radii: a rounded
    # snout and continuous slopes, without flattening at every body station.
    # Interpolating each interval with smoothstep made visible annular shoulders.
    x=[k[0] for k in keys]; h=[b-a for a,b in zip(x,x[1:])]
    i=next((j for j in range(len(h)) if s<=x[j+1]),len(h)-1)
    t=max(0,min(1,(s-x[i])/h[i])); result=[]
    for axis in range(1,4):
        y=[k[axis]**2 for k in keys]
        d=[(b-a)/width for a,b,width in zip(y,y[1:],h)]
        m=[0.]*len(x)
        for j in range(1,len(x)-1):
            if d[j-1]*d[j]>0:
                w1=2*h[j]+h[j-1]; w2=h[j]+2*h[j-1]
                m[j]=(w1+w2)/(w1/d[j-1]+w2/d[j])
        for end,da,db,ha,hb in ((0,d[0],d[1],h[0],h[1]),(-1,d[-1],d[-2],h[-1],h[-2])):
            slope=((2*ha+hb)*da-ha*db)/(ha+hb)
            m[end]=0 if slope*da<=0 else math.copysign(min(abs(slope),3*abs(da)),da)
        radius2=(2*t**3-3*t*t+1)*y[i]+(t**3-2*t*t+t)*h[i]*m[i]+(-2*t**3+3*t*t)*y[i+1]+(t**3-t*t)*h[i]*m[i+1]
        result.append(math.sqrt(max(0,radius2)))
    return (*result,0.)

def make_body(grey, pale):
    rings,sides=121,48; vs=[]; faces=[]
    for i in range(rings):
        s=(i/(rings-1))**1.5; lateral, dorsal, ventral, yc=profile(s); x=.45-.84*s
        for j in range(sides):
            a=TAU*j/sides; y=yc+(dorsal if math.sin(a)>=0 else ventral)*math.sin(a); z=lateral*math.cos(a)
            vs.append((x,y,z))
    for i in range(rings-1):
        for j in range(sides): faces.append((i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j,i*sides+j))
    faces += [tuple(range(sides-1,-1,-1)),tuple((rings-1)*sides+j for j in range(sides))]
    ob=obj_mesh('BLACKTIP_BODY',vs,faces,grey); ob.data.materials.append(pale)
    # A real underside material remains legible in renderers that elect not to
    # use COLOR_0; vertex color is retained as a gentle within-region variation.
    for poly in ob.data.polygons:
        poly.material_index=1 if sum(ob.data.vertices[i].co.z for i in poly.vertices)/len(poly.vertices)<-.022 else 0
    # Vertex colors make the belly softly pale without a texture asset.
    ca=ob.data.color_attributes.new('Shark_Dorsal_to_Belly','BYTE_COLOR','CORNER')
    for loop in ob.data.loops:
        y=ob.data.vertices[loop.vertex_index].co.z; t=max(0,min(1,(y+.056)/.129))
        ca.data[loop.index].color=(.24*t+.42*(1-t),.23*t+.38*(1-t),.18*t+.31*(1-t),1)
    # Exported GLB uses this attribute directly; no bitmap texture is needed.
    nodes,links=grey.node_tree.nodes,grey.node_tree.links
    attribute=nodes.new('ShaderNodeVertexColor'); attribute.layer_name='Shark_Dorsal_to_Belly'
    links.new(attribute.outputs['Color'],nodes['Principled BSDF'].inputs['Base Color'])
    return ob

def solid_fin(name, points, material, thick=.006):
    """Closed, bevel-like thick membrane; outline may have more than three points."""
    vs=[]
    for p in points: vs.extend([(p[0],p[1],p[2]-thick),(p[0],p[1],p[2]+thick)])
    n=len(points); fs=[tuple(2*i for i in range(n)),tuple(2*i+1 for i in reversed(range(n)))]
    fs += [(2*i,2*i+1,2*((i+1)%n)+1,2*((i+1)%n)) for i in range(n)]
    return obj_mesh(name,vs,fs,material)

def make_fins(fin, black):
    # dorsal pair, separate black caps preserve silhouette rather than painted texture
    solid_fin('FIRST_DORSAL',[(.145,.048,0),(.115,.115,0),(.064,.222,0),(.025,.184,0),(-.085,.043,0)],fin)
    solid_fin('FIRST_DORSAL_BLACKTIP',[(.080,.180,.008),(.064,.222,.008),(.043,.201,.008),(.025,.184,.008)],black,.004)
    solid_fin('SECOND_DORSAL',[(-.195,.029,0),(-.230,.068,0),(-.255,.098,0),(-.272,.062,0),(-.298,.026,0)],fin)
    solid_fin('SECOND_DORSAL_BLACKTIP',[(-.245,.084,.008),(-.255,.098,.008),(-.262,.081,.008)],black)
    # pectorals sweep rearward and slightly down, broad but restrained
    pectorals=[]
    for side,label in ((1,'R'),(-1,'L')):
        z=side
        pectorals.append(solid_fin('PECTORAL_'+label,[(.205,-.004,.050*z),(.090,-.030,.108*z),(-.040,-.064,.175*z),(-.075,-.070,.135*z),(.015,-.052,.070*z)],fin,.008))
        solid_fin('PELVIC_'+label,[(-.205,-.038,.042*z),(-.265,-.062,.090*z),(-.330,-.080,.120*z),(-.300,-.073,.072*z)],fin,.006)
    # heterocercal caudal: upper lobe longer, finely black tipped
    solid_fin('CAUDAL_HETERO_MEMBRANE',[(-.350,.010,0),(-.386,.070,0),(-.450,.135,0),(-.426,.028,0),(-.450,-.060,0),(-.395,-.047,0),(-.350,-.012,0)],fin,.008)
    solid_fin('CAUDAL_UPPER_BLACKTIP',[(-.405,.092,.010),(-.450,.135,.010),(-.438,.080,.010),(-.426,.028,.010)],black,.004)
    solid_fin('CAUDAL_LOWER_BLACKTIP',[(-.432,-.042,.010),(-.450,-.060,.010),(-.438,-.052,.010)],black,.004)
    return pectorals

def add_details(dark, gill):
    def slit(name, points, material, radius=.0018):
        curve=bpy.data.curves.new(name+'_CURVE','CURVE'); curve.dimensions='3D'; curve.bevel_depth=radius; curve.bevel_resolution=2; curve.resolution_u=2
        poly=curve.splines.new('BEZIER'); poly.bezier_points.add(len(points)-1)
        for bp,p in zip(poly.bezier_points,points):
            bp.co=(p[0],-p[2],p[1]); bp.handle_left_type='AUTO'; bp.handle_right_type='AUTO'
        ob=bpy.data.objects.new(name,curve); bpy.context.collection.objects.link(ob); ob.data.materials.append(material)
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active=ob; ob.select_set(True); bpy.ops.object.convert(target='MESH'); ob.select_set(False)
        return ob
    # eyes set flush at head sides, no tooth geometry; ventral mouth is a narrow closed curve
    for side in (-1,1):
        lateral,dorsal,_,_=profile((.45-.348)/.84)
        eye_z=lateral*math.sqrt(1-(.018/dorsal)**2)-.002
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=.008, location=(.348,-eye_z*side,.018))
        e=bpy.context.object; e.name='EYE_'+('L' if side<0 else 'R'); e.data.materials.append(dark); e.scale=(1,.72,.72)
        for k in range(5):
            x=.285-k*.021
            points=[]
            for dx,y in ((.006,.023),(0,0),(-.004,-.022)):
                lateral,dorsal,ventral,_=profile((.45-x-dx)/.84)
                z=side*(lateral*math.sqrt(max(0,1-(y/(dorsal if y>=0 else ventral))**2))+.001)
                points.append((x+dx,y,z))
            slit(f'GILL_{"L" if side<0 else "R"}_{k+1}',points,gill,.001)

    # A shallow ventral arc: an unbroken mouth line, never a loop or tooth-like spike.
    mouth=[]
    for x,z in ((.397,-.027),(.407,-.013),(.410,0),(.407,.013),(.397,.027)):
        lateral,_,ventral,_=profile((.45-x)/.84)
        mouth.append((x,-ventral*math.sqrt(max(0,1-(z/lateral)**2))-.001,z))
    slit('CLOSED_VENTRAL_MOUTH',mouth,gill,.001)


def make_rig(body, pectorals):
    bpy.ops.object.armature_add(enter_editmode=True, location=(0,0,0)); rig=bpy.context.object; rig.name='BLACKTIP_SHARK_RIG'; rig.data.name='BLACKTIP_SHARK_RIG_DATA'
    arm=rig.data; arm.edit_bones.remove(arm.edit_bones[0])
    root=arm.edit_bones.new('Root'); root.head=(0,0,0); root.tail=(.06,0,0)
    for i,s in enumerate(S):
        b=arm.edit_bones.new(f'Spine_{i:02d}'); x=.45-.9*s; b.head=(x,0,0); b.tail=(x-.035,0,0); b.parent=root; b.use_connect=False
    # Web code may choose these as independent, low-amplitude pectoral controls.
    for side,label in ((1,'R'),(-1,'L')):
        b=arm.edit_bones.new('Pectoral_'+label); b.head=(.13,-side*.10,-.020); b.tail=(.08,-side*.16,-.030); b.parent=root; b.use_connect=False
    bpy.ops.object.mode_set(mode='OBJECT')
    # independent blend weights based on longitudinal nearest bone, all mesh vertices sum to one
    mod=body.modifiers.new('Armature_Deform','ARMATURE'); mod.object=rig
    body.parent=rig
    def spine_weights(ob):
        local_groups=[ob.vertex_groups.new(name=f'Spine_{i:02d}') for i in range(16)]
        for v in ob.data.vertices:
            s=max(0,min(1,(.45-(ob.matrix_world @ v.co).x)/.9))
            hi=next((i for i,x in enumerate(S) if x>=s),15); lo=max(0,hi-1)
            if lo==hi: local_groups[lo].add([v.index],1,'REPLACE')
            else:
                t=(s-S[lo])/(S[hi]-S[lo]); local_groups[lo].add([v.index],1-t,'REPLACE'); local_groups[hi].add([v.index],t,'REPLACE')
    spine_weights(body)
    for ob in [x for x in bpy.context.scene.objects if x.type=='MESH' and x != body]:
        ob.parent=rig; mod=ob.modifiers.new('Armature_Deform','ARMATURE'); mod.object=rig
        spine_weights(ob)
    for fin,label in zip(pectorals,('R','L')):
        # The full fin follows its nearby body section, with an explicit control
        # group available to the adapter for a small independent stroke.
        fin.vertex_groups.new(name='Pectoral_'+label).add(list(range(len(fin.data.vertices))),.18,'ADD')
    return rig

def main():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    grey=mat('SHARK_DORSAL_GREY_BROWN',(.23,.22,.17),.42); pale=mat('SHARK_PALE_UNDERSIDE',(.57,.54,.45),.49)
    fin=mat('SHARK_FIN_GREY_BROWN',(.36,.35,.29),.43); black=mat('SHARK_RESTRAINED_BLACK_TIP',(.045,.045,.038),.34)
    eye=mat('SHARK_EYE',(.005,.006,.005),.18); gill=mat('SHARK_GILL_AND_MOUTH',(.14,.115,.085),.52)
    body=make_body(grey,pale); pectorals=make_fins(fin,black); add_details(eye,gill); rig=make_rig(body,pectorals)
    bpy.context.scene['asset']='selfmade juvenile blacktip reef shark'; bpy.context.scene['coordinate_contract']='nose +X; tail -X; dorsal +Y; lateral Z; metres'
    bpy.context.scene['spine_s']=list(S); bpy.context.scene.unit_settings.system='METRIC'; bpy.context.scene.unit_settings.length_unit='METERS'
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.object.select_all(action='SELECT'); bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_yup=True,export_apply=False,export_animations=True,export_skins=True,export_normals=True,export_materials='EXPORT')
    REVIEW.mkdir(parents=True,exist_ok=True)
    (REVIEW/'model-contract.json').write_text(json.dumps({'asset':'blacktip-shark.glb','units':'metres','length':.9,'axes':{'nose':'+X','tail':'-X','dorsal':'+Y','lateral':'Z'},'nose_x':.45,'tailtip_x':-.45,'spine_s':S,'rest_local_axes':{'+Y':'world -X tailward','+Z':'world +Y dorsal','+X':'world +Z lateral'},'parent':'Root','spine_chained':False,'optional_pectoral_controls':['Pectoral_R','Pectoral_L']},indent=2))
    (REVIEW/'model-readback.json').write_text(json.dumps({'objects':len(bpy.data.objects),'bones':len(rig.data.bones),'spine_bones':[b.name for b in rig.data.bones if b.name.startswith('Spine_')],'embedded_textures':0,'notes':'Vertex colors and PBR materials only; no external textures.'},indent=2))
if __name__=='__main__': main()
