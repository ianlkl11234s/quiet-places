"""Reproducible Stairlight study; standalone background process, metres, no fish.
Run: Blender --background --factory-startup --python assets/blender/scripts/stairlight.py -- --render
"""
from pathlib import Path
import argparse, math, json, random, sys
import bpy
from mathutils import Vector, Quaternion
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'exports/stairlight-review'


def material(name, color, roughness, micro=0, variation=.12):
    m=bpy.data.materials.new(name); m.use_nodes=True
    m.diffuse_color=(*color,1)
    n=m.node_tree.nodes; l=m.node_tree.links; p=n.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=roughness
    tc=n.new('ShaderNodeTexCoord')
    noise=n.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=3.5; noise.inputs['Detail'].default_value=3
    l.new(tc.outputs['Object'],noise.inputs['Vector'])
    ramp=n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color=(*(v*(1-variation) for v in color),1)
    ramp.color_ramp.elements[1].color=(*(v*(1+variation) for v in color),1)
    l.new(noise.outputs['Fac'],ramp.inputs[0]); l.new(ramp.outputs[0],p.inputs['Base Color'])
    if micro:
        grain=n.new('ShaderNodeTexNoise'); grain.inputs['Scale'].default_value=micro; grain.inputs['Detail'].default_value=2
        l.new(tc.outputs['Object'],grain.inputs['Vector'])
        bump=n.new('ShaderNodeBump'); bump.inputs['Distance'].default_value=.0008; bump.inputs['Strength'].default_value=.35
        l.new(grain.outputs['Fac'],bump.inputs['Height']); l.new(bump.outputs['Normal'],p.inputs['Normal'])
    return m


def box(name, center, size, mat, bevel=.003):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    o=bpy.context.object; o.name=name; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        b=o.modifiers.new('Small worn edge','BEVEL'); b.width=bevel; b.segments=3
        o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return o


def tube(name, points, radius, mat):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=12
    s=c.splines.new('POLY'); s.points.add(len(points)-1)
    for p,co in zip(s.points,points):p.co=(*co,1)
    c.bevel_depth=radius; c.bevel_resolution=2
    o=bpy.data.objects.new(name,c); bpy.context.scene.collection.objects.link(o); o.data.materials.append(mat)
    return o


def sweep(name,points,width,thick,mat):
    # Rounded flattened section transported along a continuous path; Z stays the local up reference.
    verts=[]; faces=[]; ring=12
    for i,co in enumerate(points):
        p=Vector(co); tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])
        tangent.normalize(); side=tangent.cross(Vector((0,0,1))).normalized(); up=side.cross(tangent).normalized()
        for j in range(ring):
            a=2*math.pi*j/ring
            # superellipse gives a broad top, softly rounded shoulders, not a circular tube
            ca=math.cos(a); sa=math.sin(a)
            v=p+side*(math.copysign(abs(ca)**.55,ca)*width/2)+up*(math.copysign(abs(sa)**.55,sa)*thick/2)
            verts.append(v)
    for i in range(len(points)-1):
        for j in range(ring):faces.append((i*ring+j,i*ring+(j+1)%ring,(i+1)*ring+(j+1)%ring,(i+1)*ring+j))
    faces.extend([tuple(reversed(range(ring))),tuple((len(points)-1)*ring+j for j in range(ring))])
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],[tuple(reversed(face)) for face in faces]); mesh.update()
    o=bpy.data.objects.new(name,mesh); bpy.context.scene.collection.objects.link(o); o.data.materials.append(mat)
    for f in mesh.polygons:f.use_smooth=True
    return o


def build(rear_window=False):
    if not bpy.app.background or bpy.data.filepath:
        raise RuntimeError('Use a separate --background --factory-startup process; do not run in an open project')
    scene=bpy.context.scene; scene.name='Stairlight_Study'
    # Factory-startup is required: never run deletion against a user's open Blender session.
    for o in list(scene.objects):bpy.data.objects.remove(o,do_unlink=True)
    scene.unit_settings.system='METRIC'
    wall=material('Warm aged lime plaster',(.52,.465,.365),.88,160,.16)
    stone=material('Fine warm grey terrazzo',(.18,.16,.132),.76,340,.18)
    red=material('Worn oxblood coated handrail',(.30,.064,.042),.4,170,.23)
    black=material('Painted dark iron',(.018,.022,.021),.63,110,.3)
    door=material('Grey painted access hatch',(.235,.245,.225),.75,150,.14)
    seam=material('Recess dirt',(.038,.033,.026),.96)
    patch=material('Old repair plaster',(.35,.335,.287),.95,120,.2)
    # small contrasting aggregate, in real object-space scale
    n=stone.node_tree.nodes; l=stone.node_tree.links; p=n.get('Principled BSDF')
    v=n.new('ShaderNodeTexVoronoi'); v.inputs['Scale'].default_value=420
    tc=next(x for x in n if x.type=='TEX_COORD'); l.new(tc.outputs['Object'],v.inputs['Vector'])
    r=n.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].position=.18; r.color_ramp.elements[0].color=(.055,.049,.040,1)
    r.color_ramp.elements[1].position=.28; r.color_ramp.elements[1].color=(.22,.20,.168,1)
    l.new(v.outputs['Distance'],r.inputs[0]); l.new(r.outputs[0],p.inputs['Base Color'])
    # Compact flights: upper 1.20 m, lower 1.389 m; back y=1.10, right x=1.25.
    box('Wall_Back',(-.875,1.19,2.4),(4.43,.18,5.2),wall,0)
    box('Wall_Right',(1.34,-1.5,1.3),(.18,5.2,7.4),wall,0)
    box('Landing',(-.875,.55,-.12),(4.25,1.10,.24),stone)
    box('Skirting_Back',(-.875,1.088,.063),(4.25,.027,.126),stone,.002)
    box('Skirting_Right',(1.238,.55,.063),(.027,1.10,.126),stone,.002)
    # Alternate preview: window on the wall behind the camera, spanning both flights.
    if rear_window:
        box('Wall_Upper_Left',(-1.769,-1.5,1.3),(.18,5.2,7.4),wall,0)
        # Rear opening is 2.50 x 2.00 m, x[-1.519,.981], z[2,4].  The four
        # wall pieces make the void a true aperture rather than a dark panel.
        box('Wall_Front_Below',(-.214,-4.19,-.2),(3.29,.18,4.4),wall,0)
        box('Wall_Front_Head',(-.214,-4.19,4.55),(3.29,.18,1.10),wall,0)
        box('Wall_Front_Left',(-1.689,-4.19,3.0),(.340,.18,2.0),wall,0)
        box('Wall_Front_Right',(1.206,-4.19,3.0),(.450,.18,2.0),wall,0)
        for x in [-1.519,.981]:
            box('Window_Jamb',(x,-4.185,3.0),(.045,.205,2.045),door,.003)
        for z in [2.0,4.0]:
            box('Window_Frame_H',(-.269,-4.185,z),(2.545,.205,.045),door,.003)
        box('Window_Mullion',(-.269,-4.185,3.0),(.045,.07,2.0),door,.003)
        box('Window_Sill',(-.269,-4.155,1.985),(2.60,.29,.055),stone,.004)
    else:
        # The upper flight is enclosed on its outer side, not open to an extra floor strip.
        # Actual staircase window: y[-3.90,-1.10], z[2.00,4.80], in the .18 m left wall.
        box('Wall_Upper_Left',(-1.769,-1.5,.50),(.18,5.2,3.0),wall,0)
        box('Window_Wall_Head',(-1.769,-1.5,4.90),(.18,5.2,.20),wall,0)
        box('Window_Wall_Front',(-1.769,-4.0,3.40),(.18,.20,2.80),wall,0)
        box('Window_Wall_Back',(-1.769,0,3.40),(.18,2.20,2.80),wall,0)
        for y in [-3.90,-1.10]:
            box('Window_Jamb',(-1.765,y,3.40),(.205,.045,2.85),door,.003)
        for z in [2.00,4.80]:
            box('Window_Frame_H',(-1.765,-2.50,z),(.205,2.845,.045),door,.003)
        box('Window_Mullion',(-1.765,-2.50,3.40),(.07,.045,2.80),door,.003)
        box('Window_Sill',(-1.735,-2.50,1.985),(.29,2.90,.055),stone,.004)
        # Clear open aperture: no glass/volume film, no camera-invisible light-shaping proxy.
        box('Wall_Front',(-.214,-4.19,1.3),(3.29,.18,7.4),wall,0)
    box('Ceiling',(-.214,-1.5,5.10),(3.29,5.2,.20),wall,0)
    scene['window_layout']='rear' if rear_window else 'side'
    # Short return closes the wall end against the landing without extending the flight.
    # Left flight rises towards camera; right flight descends away from landing.
    for i in range(10):
        y=-.14-i*.28; up=(i+1)*.175; down=-i*.175
        box(f'Upper_Tread_{i:02}',(-1.079,y,up-.085),(1.20,.284,.17),stone,.007)
        box(f'Lower_Tread_{i:02}',(.5555,y,down-.085),(1.389,.284,.17),stone,.007)
        for j in range(3):
            box(f'Upper_Antislip_{i:02}_{j}',(-1.079,y+.091-j*.013,up+.0007),(1.11,.006,.0017),black,.0005)
            box(f'Lower_Antislip_{i:02}_{j}',(.5555,y+.091-j*.013,down+.0007),(1.299,.006,.0017),black,.0005)
        box(f'Lower_Skirting_{i:02}',(1.235,y,down+.054),(.03,.283,.108),stone,.002)
        box(f'Upper_Skirting_{i:02}',(-1.664,y,up+.054),(.03,.283,.108),stone,.002)
    if rear_window:
        # Remote end platforms close each flight at its actual terminal tread.
        # Keep x[-.479,-.139] open: there is deliberately no bridge between levels.
        for name, x, width, top in [('Upper_Remote_Platform',-1.079,1.20,1.75),
                                    ('Lower_Remote_Platform',.5555,1.389,-1.75)]:
            box(name+'_Slab',(x,-3.45,top-.10),(width,1.30,.20),stone,.006)
            # Both exposed ends get solid .20 m risers, preventing a paper-thin
            # underside reveal when viewed through the larger rear aperture.
            box(name+'_Riser_Stair_End',(x,-2.79,top-.10),(width,.10,.20),stone,.004)
            box(name+'_Riser_Rear_End',(x,-4.10,top-.10),(width,.10,.20),stone,.004)
    box('Deep_Stairwell_Floor',(-1.0,-2.0,-2.1),(5.8,6.8,.2),stone)
    # Thin solid stair soffits joining the steps beneath the tread edges.
    for name,x,z,slope,w in [('Upper',-1.079,.78,-.625,1.20),('Lower',.5555,-.94,.625,1.389)]:
        o=box(name+'_StructuralSlab',(x,-1.39,z),(w,3.23,.13),stone,.003); o.rotation_euler.x=math.atan(slope)
    # U return at landing end, .34 m centre spacing; compact .10 m lead-in.
    left=-.479; right=-.139; rad=(right-left)/2; cy=.10; h=.88
    pts=[]
    for i in range(65):
        y=-2.80+2.90*i/64; pts.append((left,y,h+max(0,-y)*.625))
    for i in range(1,49):
        a=math.pi-math.pi*i/48
        pts.append(((left+right)/2+rad*math.cos(a),cy+rad*math.sin(a),h))
    for i in range(1,65):
        y=cy-2.90*i/64; pts.append((right,y,h-max(0,-y)*.625))
    sweep('Handrail_Continuous_Red_Return',pts,.066,.038,red)
    for side,x,sign in [('Upper',left,1),('Lower',right,-1)]:
        for k in range(6):
            y=-.15-k*.5; floor=sign*max(0,-y)*.625; top=h+floor
            box(f'{side}_Iron_Post_{k}',(x,y,(floor+top)/2),(.025,.025,top-floor),black,.0014)
            box(f'{side}_Post_Foot_{k}',(x,y,floor+.008),(.055,.055,.018),black,.002)
        # narrow red folded flat bar between each pair of posts
        for k in range(5):
            ya=-.15-k*.5; points=[]
            for j in range(25):
                t=j/24; y=ya-.5*t; z=sign*max(0,-y)*.625+.36+.11*math.cos(2*math.pi*t)
                points.append((x,y,z))
            sweep(f'{side}_Red_Flat_Fold_{k}',points,.025,.009,red)
    # Visible back-wall hatch, individual frame rails and dark recessed gap.
    hx=-.49; hz=.86; size=.43
    box('Hatch_Repair_Surround',(hx,1.082,hz),(.50,.015,.50),patch,.003)
    box('Hatch_Shadow_Recess',(hx,1.068,hz),(.43,.012,.43),seam,.001)
    for dx in [-1,1]:box(f'Hatch_Frame_V_{dx}',(hx+dx*.224,1.051,hz),(.024,.035,.47),door,.003)
    for dz in [-1,1]:box(f'Hatch_Frame_H_{dz}',(hx,1.051,hz+dz*.224),(.47,.035,.024),door,.003)
    box('Hatch_Leaf',(hx+.004,1.045,hz-.006),(.397,.02,.402),door,.003)
    box('Hatch_Latch_Dark',(hx-.108,1.026,hz-.035),(.038,.014,.012),black,.002)
    tube('Hatch_Latch_Handle',[(hx-.105,1.017,hz-.035),(hx-.124,1.00,hz-.041),(hx-.143,1.00,hz-.041)],.004,door)
    for z in [hz-.13,hz+.13]:box('Hatch_Hinge',(hx+.205,1.025,z),(.018,.021,.05),black,.003)
    # Sparse authored cracks: predominantly on platform, never uniform noise coverage.
    rng=random.Random(28)
    for k,start in enumerate([(-1.18,.04),(-.8,.35),(.7,.48)]):
        points=[]; x,y=start
        for i in range(14):
            points.append((x,y,.001)); x+=rng.uniform(-.055,.06); y+=.04
        tube(f'Landing_Hairline_{k}',points,.00065,seam)
    if rear_window:
        # Repeat only circulation geometry one full storey down, never the ceiling,
        # hatch or window. Each two-flight module has a 3.50 m rise.
        prefixes=('Upper_', 'Lower_', 'Handrail_', 'Landing', 'Skirting_')
        for source in list(scene.objects):
            if source.type not in {'MESH','CURVE'} or not source.name.startswith(prefixes):continue
            duplicate=source.copy();duplicate.data=source.data.copy()
            duplicate.name='Below_'+source.name;scene.collection.objects.link(duplicate)
            duplicate.location.z-=3.5
        # Join the existing lower landing to the repeated upper flight at -1.75 m.
        # Only bridge at the far landing; leave the central stairwell void open.
        box('Lower_Storey_Turn_Bridge',(-.309,-3.45,-1.85),(.36,1.30,.20),stone,.004)
        for name in ('Wall_Back','Wall_Right','Wall_Upper_Left','Wall_Front_Below'):
            ob=scene.objects[name];top=ob.location.z+ob.dimensions.z/2
            ob.dimensions.z=top+5.7;ob.location.z=(top-5.7)/2
        deep=scene.objects['Deep_Stairwell_Floor'];deep.location.z=-5.6
        scene['lower_storey_offset_m']=-3.5
        scene['lower_storey_scope']='two repeated flights, landing, handrails, soffits; solid enclosing walls to -5.7 m'
    sun_data=bpy.data.lights.new('Afternoon_Sun','SUN'); sun_data.energy=3.5; sun_data.color=(1,.82,.60); sun_data.angle=math.radians(.8)
    sun=bpy.data.objects.new('Afternoon_Sun',sun_data); scene.collection.objects.link(sun)
    direction=Vector((.12,3.0,-2.2) if rear_window else (1,2.5,-2.4)); sun.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    world=bpy.data.worlds.new('Quiet exterior sky'); world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.55,.64,.8,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=1.5; scene.world=world
    cam_data=bpy.data.cameras.new('Camera_Hero'); cam=bpy.data.objects.new('Camera_Hero',cam_data); scene.collection.objects.link(cam)
    cam.location=(-1.6,-.9,3.1); target=Vector((.48,.24,.62))
    cam.rotation_euler=((target-cam.location).to_track_quat('-Z','Y') @ Quaternion((0,0,1),-.10)).to_euler()
    cam_data.lens=25; cam_data.sensor_fit='VERTICAL'; cam_data.sensor_height=36; cam_data.clip_start=.03; scene.camera=cam
    scene['camera_target']=list(target); scene['sun_direction']=list(direction); scene['stage']='Website source: sealed wall joints, sky-only indirect, no fish'; scene['window_bounds']=([-4.10,-1.519,.981,2.00,4.00] if rear_window else [-1.679,-3.90,-1.10,2.00,4.80])
    scene.render.engine='CYCLES'; scene.cycles.samples=64; scene.cycles.use_denoising=True
    scene.cycles.max_bounces=8; scene.cycles.diffuse_bounces=5
    scene.render.resolution_x=896; scene.render.resolution_y=1216; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'; scene.view_settings.view_transform='AgX'; scene.view_settings.exposure=1.2
    scene.render.threads_mode='FIXED'; scene.render.threads=2
    return scene


def run():
    global OUT
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    parser=argparse.ArgumentParser(); parser.add_argument('--render',action='store_true'); parser.add_argument('--grey',action='store_true'); parser.add_argument('--rear-window',action='store_true'); opts=parser.parse_args(args)
    if opts.rear_window: OUT=OUT/'rear-window'
    OUT.mkdir(parents=True,exist_ok=True); scene=build(opts.rear_window)
    if opts.grey:
        grey=material('Grey clay',(.48,.48,.48),.85)
        scene.view_layers[0].material_override=grey
    prefs=bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type='METAL'; prefs.get_devices()
    gpu=[d for d in prefs.devices if d.type=='METAL']
    if not gpu:raise RuntimeError('Metal GPU unavailable; no CPU fallback')
    for d in prefs.devices:d.use=d.type=='METAL'
    scene.cycles.device='GPU'
    scene.render.filepath=str(OUT/('stairlight-grey.png' if opts.grey else 'stairlight-afternoon.png'))
    path=ROOT/'assets/blender'/('stairlight-rear-study.blend' if opts.rear_window else 'stairlight-study.blend')
    if not opts.grey:bpy.ops.wm.save_as_mainfile(filepath=str(path))
    metadata={'stage':scene['stage'],'camera':list(scene.camera.location),'target':list(scene['camera_target']),'lens_mm':scene.camera.data.lens,'pitch_degrees':math.degrees(math.atan2(scene.camera.location.z-scene['camera_target'][2],math.hypot(scene.camera.location.x-scene['camera_target'][0],scene.camera.location.y-scene['camera_target'][1]))),'flight_widths_m':{'upper':1.20,'lower':1.389},'resolution':[scene.render.resolution_x,scene.render.resolution_y],'sun_direction':list(scene['sun_direction']),'sun_energy':3.5,'exposure':scene.view_settings.exposure,'objects':len(scene.objects),'device':[d.name for d in gpu]}
    (OUT/('grey-settings.json' if opts.grey else 'study-settings.json')).write_text(json.dumps(metadata,indent=2)+'\n')
    if opts.render:bpy.ops.render.render(write_still=True)

if __name__=='__main__':run()
