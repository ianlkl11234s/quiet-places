"""Build master medaka, editable rig, review export. No scene assets are touched."""
from pathlib import Path
import sys,json
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[4];sys.path.insert(0,str(Path(__file__).resolve().parent))
from medaka_materials import make_materials
from medaka_geometry import build_mesh,LENGTH
from medaka_rig import build_rig,BONES,skin_weight_report,skinned_excursion_report
from animation_bake import bake_master_loop,bake_shoal_from_motion
from swimming import pose

def make_debug_collection(scene):
    debug=bpy.data.collections.get('Medaka_Debug') or bpy.data.collections.new('Medaka_Debug')
    if debug.name not in scene.collection.children:scene.collection.children.link(debug)
    for obj in list(debug.objects):bpy.data.objects.remove(obj,do_unlink=True)
    debug.hide_render=True;debug.hide_viewport=True
    control=bpy.data.objects.new('MEDAKA_SHOAL_CTRL',None);debug.objects.link(control)
    control.empty_display_type='CIRCLE';control['motionPath']='public/models/medaka-motion.bin';control['fps']=30;control['durationSeconds']=120.;control['fishCount']=22;control['bakeEntry']='build_all.py -- --bake-motion';control['debugCoordinates']='Three (x,y,z) converted to Blender (x,-z,y)'
    # Exact validation volumes: plant trunk plus two branch ellipsoids.
    ellipsoids=(('Medaka_Debug_PlantTrunk',(1.57,.67,-.38),(.16,.80,.13)),('Medaka_Debug_PlantBranch_Near',(1.28,.92,-.13),(.18,.23,.17)),('Medaka_Debug_PlantBranch_Far',(1.28,.92,-.63),(.18,.23,.17)))
    for name,(x,y,z),(rx,ry,rz) in ellipsoids:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=(x,-z,y));obj=bpy.context.object;obj.name=name;obj.scale=(rx,rz,ry)
        for col in list(obj.users_collection):col.objects.unlink(obj)
        debug.objects.link(obj);obj.display_type='WIRE';obj.hide_render=True;obj['threeCenter']=(x,y,z);obj['threeRadii']=(rx,ry,rz)
    # Validation bounds Three x[-.8,1.6], y[.18,1.6], z[-1.7,.9].
    bpy.ops.mesh.primitive_cube_add(size=1,location=(.4,.4,.89));bounds=bpy.context.object;bounds.name='Medaka_Debug_Bounds';bounds.scale=(1.2,1.3,.71)
    for col in list(bounds.users_collection):col.objects.unlink(bounds)
    debug.objects.link(bounds);bounds.display_type='WIRE';bounds.hide_render=True;bounds['threeBounds']=((-0.8,1.6),(.18,1.6),(-1.7,.9))
    return debug,control

def actual_length(mesh):
    ys=[vertex.co.y for vertex in mesh.data.vertices]
    return max(ys)-min(ys),min(ys),max(ys)

def make_shoal_overview(scene):
    camera=bpy.data.objects.get('Camera_Shoal_Overview')
    if not camera:
        camera_data=bpy.data.cameras.new('Medaka_Shoal_Overview_Data');camera=bpy.data.objects.new('Camera_Shoal_Overview',camera_data);scene.collection.objects.link(camera)
    camera_data=camera.data
    camera.location=(1.65,-1.10,1.60);target=Vector((.80,.48,.80));camera.rotation_euler=(target-Vector(camera.location)).to_track_quat('-Z','Y').to_euler();camera_data.lens=45;camera_data.clip_start=.01;scene.camera=camera
    return camera

def configure_review_lighting(scene):
    scene.render.engine='BLENDER_EEVEE'
    world=bpy.data.worlds.get('Medaka_Review_World') or bpy.data.worlds.new('Medaka_Review_World');scene.world=world;world.use_nodes=True
    background=world.node_tree.nodes.get('Background');background.inputs['Color'].default_value=(.055,.065,.075,1);background.inputs['Strength'].default_value=.18
    for name,location,energy,size in (('Medaka_Review_Key',(2.1,-1.5,2.8),420,2.2),('Medaka_Review_Fill',(-1.1,.7,1.7),150,2.6)):
        obj=bpy.data.objects.get(name)
        if not obj:
            data=bpy.data.lights.new(name,'AREA');obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj)
        obj.location=location;obj.data.energy=energy;obj.data.shape='DISK';obj.data.size=size;obj.rotation_euler=(Vector((.80,.48,.80))-Vector(location)).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x=800;scene.render.resolution_y=640;scene.render.resolution_percentage=100

def finalize_baked_review(scene):
    make_debug_collection(scene);make_shoal_overview(scene);configure_review_lighting(scene);scene.frame_set(0)

def run(bake_motion=False):
    print(f'MEDAKA_BUILD bake_motion={bake_motion}',flush=True)
    bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.name='Medaka_Quiet_Rain_Shoal';scene.render.engine='CYCLES';scene.cycles.device='GPU';scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.fps=30;scene.frame_start=0;scene.frame_end=3600
    source=bpy.data.collections.new('Medaka_Source');scene.collection.children.link(source);mesh=build_mesh(source,make_materials());rig=build_rig(source,mesh);bake_master_loop(rig)
    debug,control=make_debug_collection(scene)
    rig['shoalFishCount']=22;rig['bakeContract']='motion bin: 30fps, 120s, frame-major 22x12; Three pos=(x,y,z)->Blender(x,-z,y), -Z forward'
    scene['artifactStatus']='master complete; invoke --bake-motion for 22-fish motion bake';scene.render.resolution_x=512;scene.render.resolution_y=512
    length,ymin,ymax=actual_length(mesh);mesh['actualSourceLengthMetres']=length;weights=skin_weight_report(mesh);excursion=skinned_excursion_report(rig,mesh,pose);scene.frame_set(0)
    blend=ROOT/'assets/blender/medaka_quiet_rain_shoal.blend';blend.parent.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    out=ROOT/'public/models/medaka.glb';out.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=mesh
    bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_cameras=False,export_extras=True,export_animations=True,export_apply=True,use_selection=True)
    meta={'species':'Oryzias latipes morphology-inspired original','masterLengthMetres':LENGTH,'actualSourceLengthMetres':length,'actualBlenderYBounds':[ymin,ymax],'nativeForwardBlender':'+Y','forwardThree':'-Z','skinnedMesh':mesh.name,'rootNode':rig.name,'bones':list(BONES),'localLateralRotationAxis':'Z','inplaceClip':'MEDAKA_ACT_INPLACE_SWIM_1S','clipFrequencyHz':2,'tailPose':pose(rig,0,speed=.035,accel=0),'skinWeights':weights,'skinnedExcursion':excursion,'motionBinContract':{'fps':30,'durationSeconds':120,'fishCount':22,'strideFloat32':12,'threeToBlenderPosition':'(x,-z,y)','integratedPhase':'already includes individual fish phase; never add motionPhase','pectoral':'0.20*(1-.55*q)*sin(integratedPhase), local Z signs L+/R-'}}
    (ROOT/'public/models/medaka.metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
    if bake_motion:
        print('MEDAKA_BAKE starting 22 fish x 3601 frames',flush=True)
        report=bake_shoal_from_motion(scene,mesh,rig,ROOT);source.hide_render=True;source.hide_viewport=True;finalize_baked_review(scene);scene['artifactStatus']='master and 22-fish 120-second bake complete';scene['motionBakeReport']=report;bpy.ops.wm.save_as_mainfile(filepath=str(blend))
        print(f'MEDAKA_BAKE saved {report}',flush=True)
    return meta
if __name__=='__main__':print(json.dumps(run('--bake-motion' in sys.argv)))
