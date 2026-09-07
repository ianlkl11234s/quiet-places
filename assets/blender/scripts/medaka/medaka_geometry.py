"""Original centimetre-scale medaka: +Y head, +Z dorsal; exportable vertex colours."""
import math
import bpy
import bmesh

LENGTH=.038

def build_mesh(collection, materials):
    rings=23;sides=16;verts=[];faces=[];mats=[];colors=[];regions=[]
    def vertex(p,color=(.46,.50,.42,1),region='body'):
        verts.append(p);colors.append(color);regions.append(region);return len(verts)-1
    def face(indices,mat=0):faces.append(tuple(indices));mats.append(mat)
    for i in range(rings):
        t=i/(rings-1);y=-.011+t*.030
        envelope=math.sin(math.pi*t)**.72
        width=.00055+.0020*envelope
        height=.00065+.00195*envelope
        for j in range(sides):
            a=math.tau*j/sides;dorsal=math.sin(a)
            target=(.17,.22,.155) if dorsal>0 else (.59,.62,.54)
            amount=abs(dorsal)**1.3
            c=tuple((.46,.50,.42)[k]*(1-amount)+target[k]*amount for k in range(3))+(1,)
            vertex((width*math.cos(a),y,height*dorsal),c)
    for i in range(rings-1):
        for j in range(sides):face((i*sides+j,(i+1)*sides+j,(i+1)*sides+(j+1)%sides,i*sides+(j+1)%sides))
    face(tuple(reversed(range(sides))));face(tuple((rings-1)*sides+j for j in range(sides)))
    def fin(points,region='fin'):
        face([vertex(p,(.55,.59,.50,1),region) for p in points],1)
    # All median fins have YZ silhouette area; membranes remain connected to body.
    fin([(0,-.0108,.00065),(0,-.0175,.0036),(0,-.019,.0033),(0,-.019,-.0033),(0,-.0175,-.0036),(0,-.0108,-.00065)])
    fin([(0,-.001,.0024),(0,-.0045,.0043),(0,-.008,.0040),(0,-.009,.0016)])
    fin([(0,.001,-.0025),(0,-.003,-.0040),(0,-.0095,-.0033),(0,-.010,-.001)])
    fin([(-.0023,.009,0),(-.0043,.004,-.0013),(-.0038,.0025,-.001),(-.0024,.004,0)],'pectoral_L')
    fin([(.0023,.009,0),(.0043,.004,-.0013),(.0038,.0025,-.001),(.0024,.004,0)],'pectoral_R')
    for sign in (-1,1):
        # Raised eyes share the stable head group, with enough geometry for side views.
        cx=sign*.00178;cy=.0158;cz=.00065;radius=.00057;steps=12;rows=6;start=len(verts)
        for row in range(rows+1):
            b=math.pi*row/rows
            for j in range(steps):
                a=math.tau*j/steps
                vertex((cx+radius*math.cos(a)*math.sin(b),cy+radius*math.sin(a)*math.sin(b),cz+radius*math.cos(b)),(.01,.013,.009,1),'head')
        for row in range(rows):
            for j in range(steps):face((start+row*steps+j,start+(row+1)*steps+j,start+(row+1)*steps+(j+1)%steps,start+row*steps+(j+1)%steps),2)
    face([vertex(p,(.01,.013,.009,1),'head') for p in [(-.00032,.01902,.0001),(0,.01908,.00018),(.00032,.01902,.0001),(0,.01908,-.00004)]],2)
    mesh=bpy.data.meshes.new('Medaka_Master_Mesh');mesh.from_pydata(verts,[],faces)
    for material in materials:mesh.materials.append(material)
    for p,idx in zip(mesh.polygons,mats):p.material_index=idx;p.use_smooth=idx!=1
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    attr=mesh.color_attributes.new(name='MedakaColor',type='FLOAT_COLOR',domain='POINT')
    for value,color in zip(attr.data,colors):value.color=color
    obj=bpy.data.objects.new('Medaka_Master',mesh);collection.objects.link(obj)
    obj['lengthMetres']=LENGTH;obj['axisContract']='Blender +Y forward/+Z up; Three -Z forward/+Y up'
    # Explicit membership avoids accidentally assigning flank body vertices to a fin bone.
    for region in ('pectoral_L','pectoral_R','head'):
        group=obj.vertex_groups.new(name='Region_'+region)
        indices=[i for i,r in enumerate(regions) if r==region]
        if indices:group.add(indices,1.,'REPLACE')
    return obj
