"""Build a coherent, editable koi asset in an isolated Blender process.

Native +Y forward / +Z dorsal, metres. All organic geometry is authored here;
no downloaded meshes or photographic textures. Animation lives in koi_motion.py.
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from koi_motion import SPINE, DEFAULTS, build_actions, validate_actions

ROOT = Path(__file__).resolve().parents[3]
BLEND = ROOT / 'assets/blender/koi.blend'
GLB = ROOT / 'public/models/koi.glb'
META = ROOT / 'public/models/koi.metadata.json'
REVIEW = ROOT / 'exports/koi-review'
L, BODY, W, D, FPS = .55, .45, .105, .145, 30
NOSE = L / 2 - .006
TAIL_BASE = NOSE - BODY
TAU = math.tau
PROFILE = (
    (0., .013, .017, -.012), (.06, .025, .031, -.008),
    (.15, .041, .049, -.003), (.32, W / 2, D / 2, 0.),
    (.44, .051, .071, .001), (.62, .039, .057, .002),
    (.80, .025, .036, .001), (.93, .014, .021, 0.),
    (1., .0105, .015, 0.),
)


def smooth(t):
    return t * t * (3 - 2 * t)


def profile(s):
    """Cubic Hermite profile with shared tangents (no ridged ring transitions)."""
    s = max(0., min(1., s))
    for i in range(len(PROFILE) - 1):
        a, b = PROFILE[i], PROFILE[i + 1]
        if s <= b[0]:
            previous = PROFILE[max(0, i - 1)]
            following = PROFILE[min(len(PROFILE) - 1, i + 2)]
            width = b[0] - a[0]
            t = (s - a[0]) / width
            values = []
            for j in (1, 2, 3):
                ma = (b[j] - previous[j]) / (b[0] - previous[0])
                mb = (following[j] - a[j]) / (following[0] - a[0])
                values.append((2*t**3-3*t*t+1)*a[j] + (t**3-2*t*t+t)*width*ma
                              + (-2*t**3+3*t*t)*b[j] + (t**3-t*t)*width*mb)
            return tuple(values)
    return PROFILE[-1][1:]


def new_collection(name, parent=None):
    collection = bpy.data.collections.new(name)
    (parent.children if parent else bpy.context.scene.collection.children).link(collection)
    return collection


def move_to(obj, collection):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)


def material(name, color, roughness=.35, alpha=1.):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*color, alpha)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Specular IOR Level'].default_value = .32
    shader.inputs['Alpha'].default_value = alpha
    if alpha < 1:
        mat.surface_render_method = 'DITHERED'
        shader.inputs['Transmission Weight'].default_value = .06
    mat.use_fake_user = True
    return mat


def mesh_object(name, vertices, faces, mat, collection, uv=None):
    mesh = bpy.data.meshes.new(name + '_MESH')
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    if uv:
        layer = mesh.uv_layers.new(name='KOI_UV')
        for loop in mesh.loops:
            layer.data[loop.index].uv = uv[loop.vertex_index]
    return obj


def grid_faces(rows, columns):
    return [(i*columns+j, (i+1)*columns+j, (i+1)*columns+j+1, i*columns+j+1)
            for i in range(rows-1) for j in range(columns-1)]


def normal_texture():
    """Small, repeatable scale-edge relief; packed into GLB as a real normal map."""
    width, height = 512, 256
    v, u = np.mgrid[0:height, 0:width]
    u = u / (width - 1)
    v = v / height
    row = np.floor(v * 16)
    x = (u * 35 + .5 * (row % 2)) % 1 - .5
    y = (v * 16) % 1 - .5
    radius = np.sqrt((x / .64)**2 + (y / .56)**2)
    relief = np.exp(-((radius - .82) / .065)**2)
    relief *= np.clip((u - .16) / .10, 0, 1)
    dy, dx = np.gradient(relief)
    # Deliberately shallow; scales should appear only in moving highlights.
    normal = np.stack((-dx * .18, -dy * .18, np.ones_like(dx)), axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    pixels = np.ones((height, width, 4), dtype=np.float32)
    pixels[:, :, :3] = normal * .5 + .5
    image = bpy.data.images.new('KOI_Subtle_Scale_Normal', width=width, height=height, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(pixels.ravel())
    image.pack()
    return image


def coat_texture(style):
    """Smooth coat boundaries independent of mesh resolution, stored as sRGB."""
    width, height = 1024, 512
    v, s = np.mgrid[0:height, 0:width]
    s = s / (width - 1)
    angle = v / height * TAU
    strength = np.zeros_like(s)
    for center, span, side in ((.15,.105,1.4),(.39,.14,1.7),(.67,.105,1.0),(.85,.06,2.0)):
        angular = np.arctan2(np.sin(angle-side), np.cos(angle-side))
        radius = ((s-center)/span)**2 + (angular/1.35)**2
        radius += .11*np.sin(38*s+3*angle) + .065*np.sin(23*s-7*angle)
        strength = np.maximum(strength, np.clip((1-radius)/.045, 0, 1))
    strength *= np.clip((np.sin(angle)+.7)/.4, 0, 1)
    white = np.array((.92,.91,.865))
    red = np.array((.82,.17,.065))
    black = np.array((.12,.14,.135))
    pixels = np.ones((height,width,4),dtype=np.float32)
    pixels[:,:,:3] = white*(1-strength[:,:,None]) + red*strength[:,:,None]
    if style in ('SANKE','SHOWA'):
        dark = np.clip((1-((s-.52)/.11)**2-(np.cos(angle+.3)/.5)**2)/.08,0,1)
        if style=='SHOWA':
            dark=np.maximum(dark,np.clip(.65+.65*np.sin(15*s+2*angle),0,1))
        pixels[:,:,:3]=pixels[:,:,:3]*(1-dark[:,:,None])+black*dark[:,:,None]
    elif style=='GOLD':
        pixels[:,:,:3]=(.91,.63,.25)
    elif style=='WHITE':
        pixels[:,:,:3]=white
    image=bpy.data.images.new('KOI_Coat_'+style,width=width,height=height,alpha=False)
    image.colorspace_settings.name='sRGB'
    image.pixels.foreach_set(pixels.ravel()); image.pack()
    return image


def make_materials():
    mats = {}
    for name, color in (
        ('KOHAKU', (.88, .87, .79)), ('SANKE', (.88, .86, .79)),
        ('SHOWA', (.06, .055, .05)), ('GOLD', (.82, .42, .065)),
        ('WHITE', (.89, .88, .82)),
    ):
        mats[name] = material('KOI_MAT_' + name, color, .31)
    image = normal_texture()
    for name, mat in mats.items():
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        coat = nodes.new('ShaderNodeTexImage'); coat.image = coat_texture(name)
        links.new(coat.outputs['Color'], nodes['Principled BSDF'].inputs['Base Color'])
        texture = nodes.new('ShaderNodeTexImage'); texture.image = image
        normal = nodes.new('ShaderNodeNormalMap'); normal.inputs['Strength'].default_value = .32
        links.new(texture.outputs['Color'], normal.inputs['Color'])
        links.new(normal.outputs['Normal'], nodes['Principled BSDF'].inputs['Normal'])
    mats['FIN'] = material('KOI_MAT_FIN', (.83, .78, .64), .43, .82)
    mats['RAY'] = material('KOI_MAT_FIN_RAY', (.65, .57, .41), .46)
    mats['EYE'] = material('KOI_MAT_EYE', (.007, .009, .008), .15)
    mats['IRIS'] = material('KOI_MAT_IRIS', (.22, .18, .085), .29)
    mats['LIP'] = material('KOI_MAT_LIP', (.79, .67, .52), .38)
    mats['MOUTH'] = material('KOI_MAT_MOUTH', (.11, .045, .032), .55)
    mats['GILL'] = material('KOI_MAT_OPERCULUM_EDGE', (.48, .43, .32), .44)
    return mats


def create_body(collection, mats):
    rings, sides = 81, 49  # duplicate seam vertex supports clean texture UVs
    vertices, uv = [], []
    for i in range(rings):
        s = i/(rings-1); rx, rz, center = profile(s)
        for j in range(sides):
            angle = TAU*j/(sides-1)
            vertices.append((rx*math.cos(angle), NOSE-s*BODY, center+rz*math.sin(angle)))
            uv.append((s, j/(sides-1)))
    faces = [tuple(reversed(face)) for face in grid_faces(rings, sides)]
    faces.extend((tuple(range(sides-1,-1,-1)), tuple((rings-1)*sides+j for j in range(sides))))
    body = mesh_object('KOI_BODY', vertices, faces, mats['KOHAKU'], collection, uv)
    return body


def tube(name, points, radius, mat, collection, taper=False):
    vertices, faces = [], []
    for i, point in enumerate(points):
        tangent = Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        tangent.normalize()
        reference = Vector((0,0,1)) if abs(tangent.z)<.9 else Vector((1,0,0))
        x = tangent.cross(reference).normalized(); y = tangent.cross(x).normalized()
        r = radius * (1-.78*i/(len(points)-1) if taper else 1)
        for j in range(6):
            vertices.append(Vector(point)+r*(x*math.cos(TAU*j/6)+y*math.sin(TAU*j/6)))
    for i in range(len(points)-1):
        for j in range(6):
            faces.append((i*6+j,i*6+(j+1)%6,(i+1)*6+(j+1)%6,(i+1)*6+j))
    return mesh_object(name, vertices, faces, mat, collection)


def create_fins(collection, mats):
    result = []
    # Each entry owns a continuous surface and its fin rays. Binding callbacks
    # use the same geometry coordinates for membrane and rays.
    def surface(name, sample, rows, columns, ray_columns, kind):
        vertices = [sample(i/(rows-1),j/(columns-1)) for i in range(rows) for j in range(columns)]
        fin = mesh_object(name,vertices,grid_faces(rows,columns),mats['FIN'],collection)
        result.append((fin,kind))
        for k in range(ray_columns):
            u = (k+.5)/ray_columns
            points = [sample(u,t/9) for t in range(10)]
            result.append((tube(name+'_RAY_%02d'%k,points,.00022,mats['RAY'],collection,True),kind))
    def dorsal(u,v):
        s=.24+.53*u; rx,rz,z=profile(s)
        height=.033*math.sin(math.pi*u)**.7
        return (.0008*math.sin(TAU*u)*v,NOSE-s*BODY-.012*v*math.sin(math.pi*u),z+rz-.001+height*v)
    surface('KOI_DORSAL',dorsal,33,9,18,'dorsal')
    def anal(u,v):
        s=.69+.18*u; rx,rz,z=profile(s)
        return (0,NOSE-s*BODY-.012*v,z-rz+.001-.022*math.sin(math.pi*u)*v)
    surface('KOI_ANAL',anal,19,7,9,'anal')
    for side, label in ((-1,'L'),(1,'R')):
        for pelvic in (False,True):
            s=.61 if pelvic else .21
            rx,rz,z=profile(s)
            origin=Vector((side*rx*.91,NOSE-s*BODY,z-rz*(.73 if pelvic else .28)))
            length=.027 if pelvic else .050
            def fan(u,v,side=side,origin=origin,length=length):
                angle=-.28+1.70*u
                reach=length*(.80+.20*math.sin(math.pi*u))
                return origin+Vector((side*reach*math.cos(angle)*v,
                    -.004*(2*u-1)-reach*math.sin(angle)*v,
                    -.010*v+.006*math.sin(math.pi*u)*v*v))
            kind=('pelvic_' if pelvic else 'pectoral_')+label
            surface('KOI_'+kind.upper(),fan,23,10,10 if pelvic else 14,kind)
    def caudal(u,v):
        # u runs through dorsal/ventral span, v runs toward the trailing edge.
        span=2*u-1
        reach=(TAIL_BASE+L/2)*(.64+.36*abs(span)**.75)
        return (.0015*math.sin(math.pi*v)*math.sin(3*math.pi*u),
                TAIL_BASE-reach*v,span*(.014+.045*smooth(v)))
    surface('KOI_CAUDAL',caudal,35,21,22,'caudal')
    return result


def sphere(name, location, scale, mat, collection):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=location)
    obj=bpy.context.object; obj.name=name; obj.scale=scale
    obj.data.materials.append(mat); move_to(obj,collection)
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    for polygon in obj.data.polygons: polygon.use_smooth=True
    return obj


def create_face(collection,mats):
    result=[]
    for side,label in ((-1,'L'),(1,'R')):
        s=.105; rx,rz,z=profile(s); angle=.34
        normal=Vector((side*math.cos(angle),0,math.sin(angle))).normalized()
        center=Vector((side*rx*math.cos(angle),NOSE-s*BODY,z+rz*math.sin(angle)))
        result.append(sphere('KOI_IRIS_'+label,center+normal*.0008,(.0037,.0045,.0042),mats['IRIS'],collection))
        result.append(sphere('KOI_EYE_'+label,center+normal*.0020,(.0028,.0030,.0028),mats['EYE'],collection))
        # Fine curved gill-cover seam follows the actual ellipsoidal surface.
        points=[]
        for i in range(21):
            a=-1.05+2.13*i/20; s=.20+.035*math.cos(a)
            rx,rz,z=profile(s)
            points.append((side*rx*math.cos(a)*1.003,NOSE-s*BODY,z+rz*math.sin(a)*1.003))
        result.append(tube('KOI_OPERCULUM_'+label,points,.00040,mats['GILL'],collection))
        for pair in (0,1):
            a=Vector((side*.010,NOSE-.003-pair*.008,-.021))
            b=a+Vector((side*(.010+pair*.006),-.005,-.007))
            c=a+Vector((side*(.015+pair*.010),-.012-pair*.008,-.010-pair*.005))
            points=[(1-t)**2*a+2*(1-t)*t*b+t*t*c for t in (i/10 for i in range(11))]
            result.append(tube('KOI_BARBEL_'+label+'_'+str(pair+1),points,.00065,mats['LIP'],collection,True))
    # A small lip ring intersects the blunt snout instead of floating ahead.
    points=[(.0095*math.cos(TAU*i/40),NOSE+.0025,-.014+.0058*math.sin(TAU*i/40)) for i in range(41)]
    result.append(tube('KOI_LIPS',points,.0013,mats['LIP'],collection))
    result.append(sphere('KOI_MOUTH',(0,NOSE+.0028,-.014),(.0078,.0008,.0042),mats['MOUTH'],collection))
    return result


def create_rig(collection):
    bpy.ops.object.armature_add(enter_editmode=True)
    rig=bpy.context.object; rig.name='KOI_RIG'; move_to(rig,collection)
    bones=rig.data.edit_bones; bones.remove(bones[0])
    def bone(name,head,tail,parent=None):
        result=bones.new(name); result.head=head; result.tail=tail
        result.parent=parent; return result
    root=bone('root',(0,0,0),(0,.08,0))
    master=bone('body_master',(0,0,0),(0,.10,0),root)
    previous=master
    for name,s in SPINE:
        y=NOSE-s*BODY
        previous=bone(name,(0,y,0),(0,y-.045,0),previous)
    for name,s,x,z,parent in (
        ('pectoral_L',.21,-.04,-.02,'head'),('pectoral_R',.21,.04,-.02,'head'),
        ('pelvic_L',.61,-.035,-.038,'spine_03'),('pelvic_R',.61,.035,-.038,'spine_03'),
        ('dorsal',.36,0,.065,'spine_02'),('anal',.74,0,-.038,'spine_04'),
        ('caudal_L',1.08,0,.024,'tail_base'),('caudal_R',1.08,0,-.024,'tail_base'),
    ):
        bone(name,(x,NOSE-s*BODY,z),(x,NOSE-s*BODY-.035,z),bones[parent])
    bpy.ops.object.mode_set(mode='OBJECT')
    for name,value in DEFAULTS.items(): rig[name]=value
    rig.show_in_front=True
    return rig


def axial_weights(s):
    s=max(0.,min(1.22,s))
    for (left,a),(right,b) in zip(SPINE,SPINE[1:]):
        if s<=b:
            amount=(s-a)/(b-a)
            return {left:1-amount,right:amount}
    return {'tail_tip':1.}


def bind(obj,rig,kind='body'):
    obj.parent=rig
    modifier=obj.modifiers.new('KOI_ARMATURE','ARMATURE'); modifier.object=rig
    groups={bone.name:obj.vertex_groups.new(name=bone.name) for bone in rig.pose.bones}
    for vertex in obj.data.vertices:
        co=vertex.co; s=(NOSE-co.y)/BODY
        weights=axial_weights(s)
        if kind=='face': weights={'head':1.}
        elif kind.startswith(('pectoral_','pelvic_')):
            anchor=.21 if kind.startswith('pectoral') else .61
            rx,rz,z=profile(anchor)
            influence=smooth(max(0.,min(1.,(abs(co.x)-rx*.83)/(.04 if anchor<.3 else .023))))
            weights={name:value*(1-influence) for name,value in axial_weights(anchor).items()}
            weights[kind]=weights.get(kind,0)+influence
        elif kind in ('dorsal','anal'):
            rx,rz,z=profile(s)
            distance=max(0.,co.z-z-rz) if kind=='dorsal' else max(0.,z-rz-co.z)
            influence=.45*smooth(min(1.,distance/(.033 if kind=='dorsal' else .022)))
            weights={name:value*(1-influence) for name,value in weights.items()}
            weights[kind]=influence
        elif kind=='caudal':
            progression=max(0.,min(1.,(TAIL_BASE-co.y)/(TAIL_BASE+L/2)))
            influence=.12*smooth(progression)*min(1.,abs(co.z)/.059)
            weights={name:value*(1-influence) for name,value in weights.items()}
            # Named auxiliary controls cup the upper/lower lobe; the continuous
            # axial tail chain still carries most membrane and ray deformation.
            weights['caudal_L' if co.z>=0 else 'caudal_R']=influence
        for name,value in weights.items():
            if value>1e-8: groups[name].add([vertex.index],value,'REPLACE')


def camera(name,location,collection,ortho=.72):
    bpy.ops.object.camera_add(location=location)
    obj=bpy.context.object; obj.name=name; move_to(obj,collection)
    obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
    obj.data.type='ORTHO'; obj.data.ortho_scale=ortho
    return obj


def validate_scene(rig,body,parts):
    action_report=validate_actions(rig)
    sums=[]
    for obj in (body,*parts):
        for vertex in obj.data.vertices:
            sums.append(sum(group.weight for group in vertex.groups))
    error=max(abs(value-1) for value in sums)
    if error>1e-5: raise ValueError('Unnormalized skin weights')
    return {'PASS':True,'bones':len(rig.pose.bones),'weightedVertices':len(sums),
            'maxWeightSumError':error,'actions':action_report,
            'scaleRelief':'Packed 512x256 normal texture, subtle artistic scale pattern',
            'biology':'Morphology approximation, not measured anatomical reconstruction'}


def run():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene; scene.name='KOI_Procedural_Rig'
    scene.unit_settings.system='METRIC'; scene.unit_settings.scale_length=1.
    scene.render.engine='BLENDER_EEVEE'; scene.render.fps=FPS
    scene.render.resolution_x=1100; scene.render.resolution_y=760
    scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new('KOI_NEUTRAL_WORLD'); scene.world.color=(.055,.055,.055)
    top=new_collection('KOI'); model=new_collection('KOI_MODEL',top)
    rigging=new_collection('KOI_RIGGING',top); env=new_collection('KOI_ENV')
    debug=new_collection('KOI_DEBUG'); debug.hide_render=True; debug.hide_viewport=True
    mats=make_materials(); body=create_body(model,mats)
    fins=create_fins(model,mats); face=create_face(model,mats); rig=create_rig(rigging)
    bind(body,rig)
    for obj,kind in fins: bind(obj,rig,kind)
    for obj in face: bind(obj,rig,'face')
    # Ray meshes stay editable but join by fin to reduce draw calls on the web.
    joined=[]
    for kind in dict.fromkeys(kind for _,kind in fins):
        objects=[obj for obj,k in fins if k==kind]
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join(); joined.append(bpy.context.object)
    root=bpy.data.objects.new('KOI_ROOT__Native_Y_Forward',None); rigging.objects.link(root); rig.parent=root
    durations=build_actions(rig,BODY,L,FPS)
    for name,location,power,size in (
        ('KOI_KEY',(-.5,.6,1.1),85,1.4),('KOI_FILL',(.8,-.3,.5),40,1.3),
    ):
        bpy.ops.object.light_add(type='AREA',location=location)
        light=bpy.context.object; light.name=name; light.data.energy=power; light.data.shape='DISK'; light.data.size=size
        light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler(); move_to(light,env)
    main=camera('KOI_CAM_MAIN',(.7,.85,.6),env)
    side=camera('KOI_CAM_SIDE',(1,0,.04),env)
    top_cam=camera('KOI_CAM_TOP',(0,.001,1),env)
    scene.camera=main
    REVIEW.mkdir(parents=True,exist_ok=True)
    scene.frame_set(0); report=validate_scene(rig,body,[*joined,*face])
    scene.frame_set(0)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in (root,rig,body,*joined,*face): obj.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,
        export_yup=True,export_apply=True,export_materials='EXPORT',export_extras=True,
        export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True)
    data=GLB.read_bytes()
    meta={'name':'Self-authored procedural koi carp','units':'metres','sourceLengthMeters':L,
        'nativeCoordinates':{'Blender':'head +Y, dorsal +Z','glTF':'head -Z, dorsal +Y'},
        'rig':'KOI_RIG','materials':list(mats)[:5],
        'actions':{name:{'durationSeconds':duration,'loop':bool(bpy.data.actions[name]['loop']),
                        'rootMotion':not bpy.data.actions[name]['in_place']} for name,duration in durations.items()},
        'slowCruise':{'action':'KOI_ACT_SLOW_CRUISE','inPlace':True,'durationSeconds':12,
                      'tailBeats':9,'frequencyHz':.75,'requestedFrequencyHz':.78},
        'validation':report,'glbSha256':hashlib.sha256(data).hexdigest(),
        'source':['assets/blender/scripts/koi.py','assets/blender/scripts/koi_motion.py'],
        'limitations':'Kinematic swimming and art-directed proportions; no fluid, muscle or autonomous behavior. Alternative coats selectable in Blender; website uses Kohaku.'}
    META.write_text(json.dumps(meta,indent=2)+'\n')
    for cam,name,frame in ((main,'koi-three-quarter',0),(side,'koi-side',0),(top_cam,'koi-top',0),(main,'koi-slow-cruise-frame90',90)):
        scene.camera=cam; scene.frame_set(frame); scene.render.filepath=str(REVIEW/(name+'.png'))
        bpy.ops.render.render(write_still=True)
    print('KOI_REPORT='+json.dumps(meta,indent=2))


if __name__=='__main__':
    run()
