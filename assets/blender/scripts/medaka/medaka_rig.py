"""Nine-bone medaka rig and deterministic manual weights."""
import bpy

BONES=('MedakaRoot','Spine_01','Spine_02','Spine_03','Spine_04','Spine_05','Peduncle','Tail_Base','Tail_Tip','Pectoral_L','Pectoral_R')
YS=(.018,.013,.008,.003,-.002,-.007,-.011,-.015,-.019)

def build_rig(collection, mesh):
    arm=bpy.data.armatures.new('Medaka_Rig_Data');rig=bpy.data.objects.new('Medaka_Rig',arm);collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    previous=None
    for i,(name,y) in enumerate(zip(BONES[:9],YS)):
        b=arm.edit_bones.new(name);b.head=(0,y,0);b.tail=(0,YS[i+1] if i+1<len(YS) else y-.003,0)
        if previous:b.parent=previous; b.use_connect=True
        previous=b
    for name,x in (('Pectoral_L',-.0018),('Pectoral_R',.0018)):
        b=arm.edit_bones.new(name);b.head=(x,.006,0);b.tail=(x,.003,-.001);b.parent=arm.edit_bones['Spine_04'];b.use_connect=False
    bpy.ops.object.mode_set(mode='POSE')
    for b in rig.pose.bones:b.rotation_mode='QUATERNION';b['localLateralAxis']='Z';b['swimFormula']='tangent displacement derivative / body length, then adjacent local-Z difference'
    bpy.ops.object.mode_set(mode='OBJECT');mesh.parent=rig;mod=mesh.modifiers.new('Medaka_Armature','ARMATURE');mod.object=rig
    for name in BONES:
        if not mesh.vertex_groups.get(name): mesh.vertex_groups.new(name=name)
    # Geometry declares eyes/head and both pectorals explicitly.  Keep those
    # declarations authoritative; every remaining vertex receives a continuous
    # two-bone envelope from the head (+Y) to the tail (-Y).
    regions={name: mesh.vertex_groups.get('Region_'+name) for name in ('head','pectoral_L','pectoral_R')}
    region_indices={name: group.index for name,group in regions.items() if group}
    for vertex in mesh.data.vertices:
        y=vertex.co.y
        memberships={entry.group for entry in vertex.groups}
        if region_indices.get('head') in memberships:
            mesh.vertex_groups['MedakaRoot'].add([vertex.index],1.,'REPLACE');continue
        if region_indices.get('pectoral_L') in memberships:
            mesh.vertex_groups['Pectoral_L'].add([vertex.index],1.,'REPLACE');continue
        if region_indices.get('pectoral_R') in memberships:
            mesh.vertex_groups['Pectoral_R'].add([vertex.index],1.,'REPLACE');continue
        if y>=YS[0]:mesh.vertex_groups[BONES[0]].add([vertex.index],1.,'REPLACE');continue
        if y<=YS[-1]:mesh.vertex_groups[BONES[8]].add([vertex.index],1.,'REPLACE');continue
        for i in range(len(YS)-1):
            hi,lo=YS[i],YS[i+1]
            if lo<=y<=hi:
                t=(hi-y)/(hi-lo);mesh.vertex_groups[BONES[i]].add([vertex.index],1-t,'REPLACE');mesh.vertex_groups[BONES[i+1]].add([vertex.index],t,'REPLACE');break
    rig['boneContract']=list(BONES);rig['localLateralRotationAxis']='Z (bones rest head +Y to tail -Y)';rig['masterLengthMetres']=.038
    return rig

def skin_weight_report(mesh):
    """Verify that every exported vertex has one unit of armature influence."""
    bone_group_indices={mesh.vertex_groups[name].index for name in BONES}
    totals=[]
    for vertex in mesh.data.vertices:
        totals.append(sum(entry.weight for entry in vertex.groups if entry.group in bone_group_indices))
    return {'vertices':len(totals),'minimum':min(totals),'maximum':max(totals),'unweighted':sum(abs(total-1.)>1e-5 for total in totals)}

def skinned_excursion_report(rig, mesh, pose_fn):
    """Measure evaluated skin displacement: stable head must move far less than tail."""
    head_group=mesh.vertex_groups.get('Region_head')
    head_index=head_group.index if head_group else -1
    head=[v.index for v in mesh.data.vertices if any(g.group==head_index for g in v.groups)]
    tail=[v.index for v in mesh.data.vertices if v.co.y<-.014]
    def sample(phase):
        pose_fn(rig,phase,speed=.035,accel=0.);bpy.context.view_layer.update()
        evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());data=evaluated.to_mesh()
        xs=[v.co.x for v in data.vertices];evaluated.to_mesh_clear();return xs
    a=sample(0.);b=sample(1.5707963267948966)
    displacement=lambda indices:max((abs(b[i]-a[i]) for i in indices),default=0.)
    head_move=displacement(head);tail_move=displacement(tail)
    return {'headLateralMetres':head_move,'tailLateralMetres':tail_move,'headToTailRatio':head_move/tail_move if tail_move else 0.,'passesHeadUnderQuarter':head_move<tail_move*.25}
