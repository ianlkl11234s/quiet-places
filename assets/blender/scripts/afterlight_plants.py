"""Source-informed Solanum americanum and Pilea microphylla morphology studies. Blender metres/Z-up.

Separate editable blades, attached petioles, tapered stems and irregular lateral branches.
All geometry/materials are original. This helper is used by afterlight.py.
"""
import bpy
import math
import random
from mathutils import Vector, Quaternion


def material(name, color, roughness):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=roughness
    m.diffuse_color=(*color,1)
    m.use_backface_culling=False
    return m


def tube(collection,name,points,radii,mat,root_z,height,wind_scale=1):
    vertices=[];faces=[];sides=7
    points=[Vector(p) for p in points]
    for i,p in enumerate(points):
        tangent=(points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized()
        right=tangent.cross(Vector((0,0,1)))
        if right.length<.01:right=Vector((1,0,0))
        right.normalize();up=tangent.cross(right).normalized()
        for j in range(sides):
            angle=j*math.tau/sides
            vertices.append(p+radii[i]*(right*math.cos(angle)+up*math.sin(angle)))
        if i:
            for j in range(sides):
                a=(i-1)*sides+j;b=(i-1)*sides+(j+1)%sides
                faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(reversed(range(sides))),tuple(range((len(points)-1)*sides,len(points)*sides))])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.materials.append(mat)
    for p in mesh.polygons:p.use_smooth=True
    obj=bpy.data.objects.new(name,mesh);collection.objects.link(obj)
    obj['windRootY']=root_z;obj['windHeight']=height;obj['windScale']=wind_scale
    return obj


def blade(collection,name,base,direction,length,width,mat,rng,root_z,height,wind_scale=1):
    base=Vector(base);axis=Vector(direction).normalized()
    side=axis.cross(Vector((0,0,1))).normalized()
    if side.length<.01:side=Vector((1,0,0))
    if length>.015:
        side=Quaternion(axis,math.radians(rng.uniform(25,65))*(1 if rng.random()>.5 else -1)) @ side
    normal=side.cross(axis).normalized()
    if normal.z<0:normal=-normal
    vertices=[];faces=[];colors=[];rows=6 if length<.015 else 16;cols=4 if length<.015 else 8
    shade=rng.uniform(.85,1.13)
    for row in range(rows+1):
        t=row/rows
        silhouette=max(.002,math.sin(math.pi*t)**.83)*(1-.26*t)
        # Modest lobes/serration; a morphology study, not a named species claim.
        silhouette*=1+(.005 if length<.015 else .025)*math.sin(t*math.pi*6)
        droop=-.09*length*t*t+.05*length*math.sin(t*math.pi)
        for col in range(cols+1):
            u=col/cols*2-1
            ridge=.045*length*(1-u*u)*math.sin(t*math.pi)
            curl=.025*length*u*u*math.sin(t*math.pi*1.4)
            vertices.append(base+axis*(length*t)+side*(width*.5*silhouette*u)+normal*(droop+ridge+curl))
            vein=math.exp(-abs(u)*35)*.25
            mottling=.96+.035*math.sin(t*71+u*29)
            colors.append((min(1,shade*mottling*(.115+vein*.18)),min(1,shade*mottling*(.31+vein*.22)),min(1,shade*mottling*(.047+vein*.055)),1))
            if row and col:
                i=row*(cols+1)+col;faces.append((i-cols-2,i-cols-1,i,i-1))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.materials.append(mat)
    for p in mesh.polygons:p.use_smooth=True
    attr=mesh.color_attributes.new(name='LeafColor',type='FLOAT_COLOR',domain='POINT')
    for d,c in zip(attr.data,colors):d.color=c
    uv=mesh.uv_layers.new(name='UV0')
    for loop in mesh.loops:
        v=loop.vertex_index;uv.data[loop.index].uv=(v%(cols+1)/cols,v//(cols+1)/rows)
    obj=bpy.data.objects.new(name,mesh);collection.objects.link(obj)
    obj['windRootY']=root_z;obj['windHeight']=height;obj['windScale']=wind_scale
    return obj


def build_plants(collection):
    rng=random.Random(38074)
    leaf=material('Afterlight_Leaf_Blade',(.13,.34,.055),.39)
    nodes=leaf.node_tree.nodes;links=leaf.node_tree.links;p=nodes.get('Principled BSDF')
    color=nodes.new('ShaderNodeVertexColor');color.layer_name='LeafColor';links.new(color.outputs['Color'],p.inputs['Base Color'])
    # Directional thin-leaf approximation is rebuilt in Three.js, not exported as glass.
    p.inputs['Subsurface Weight'].default_value=.055
    stem=material('Afterlight_Living_Stem',(.15,.20,.052),.62)
    # MOA plant guide: Solanum americanum, alternate ovate 4–8 cm leaves.
    # Young non-flowering shoots; plant sizes and placement are art-directed.
    shoots=[((1.698,.38,-.030),1.35,-.19)]
    for g,(root,height,lean) in enumerate(shoots):
        root=Vector(root)
        def spine(t):return root+Vector((lean*t*t,-.065*math.sin(t*2.3),height*t))
        points=[spine(i/12) for i in range(13)]
        tube(collection,f'Foliage_Solanum_Shoot_{g}',points,[.0045*(1-i/15) for i in range(13)],stem,root.z,height,.7)
        for j in range(12):
            t=.16+j*.068+rng.uniform(-.015,.015);origin=spine(t);angle=j*2.39996+g*1.4
            direction=Vector((-abs(math.cos(angle))*.7-.3,math.sin(angle),.28)).normalized()
            length=rng.uniform(.09775,.15525)*(1-.20*t);petiole=rng.uniform(.010,.015)
            base=origin+direction*petiole
            tube(collection,f'Stem_Solanum_Petiole_{g}_{j}',[origin,base],[.0012,.0007],stem,root.z,height,.7)
            blade(collection,f'Leaf_Solanum_{g}_{j}',base,direction,length,length*.62,leaf,rng,root.z,height,.7)
        # Two tapered lateral stems retain the branching habit instead of a planted pole.
        for k,t in enumerate([.24,.41,.63,.77]):
            origin=spine(t);sign=1 if k%2==0 else -1
            tip=origin+Vector((rng.uniform(-.288,-.168),sign*rng.uniform(.144,.288),rng.uniform(.14,.24)))
            tube(collection,f'Stem_Solanum_Branch_{g}_{k}',[origin,origin.lerp(tip,.5),tip],[.002,.0012,.0005],stem,root.z,height,.7)
            for j in range(6):
                q=origin.lerp(tip,.18+j*.145);d=Vector((-.6,sign*(1 if j%2 else -.7),.25)).normalized();end=q+d*.012
                tube(collection,f'Stem_Solanum_LateralPetiole_{g}_{k}_{j}',[q,end],[.0008,.0005],stem,root.z,height,.7)
                length=rng.uniform(.08625,.1495)*(1-.055*j)
                blade(collection,f'Leaf_Solanum_Lateral_{g}_{k}_{j}',end,d,length,length*rng.uniform(.48,.62),leaf,rng,root.z,height,.7)
    # Low Pilea microphylla clumps: slender translucent-looking stems and unequal
    # opposite small leaves. Typical blade scale is millimetres, not the hero leaf scale.
    for g,y in enumerate([-.48,1.12]):
        root=Vector((1.698,y,-.030));height=.10
        for k in range(3):
            d=Vector((-.3-rng.random()*.6,rng.uniform(-1,1),1.2)).normalized()
            tip=root+d*rng.uniform(.09,.14)
            tube(collection,f'Stem_Pilea_{g}_{k}',[root,root.lerp(tip,.5),tip],[.0012,.0007,.0003],stem,-.03,height,.3)
            for j in range(6):
                q=root.lerp(tip,.28+j*.12)
                for side in [-1,1]:
                    axis=Vector((-.5,side*.7,.2)).normalized();length=rng.uniform(.004,.007)*(1 if side>0 else .65)
                    blade(collection,f'Leaf_Pilea_{g}_{k}_{j}_{side}',q,axis,length,length*.62,leaf,rng,-.03,height,.3)
    return {'morphology':'Solanum americanum / Pilea microphylla source-informed approximation, not botanical validation','seed':38074,'heroShoots':1,'heroHeightsMetres':[1.35],'overhang':False}
