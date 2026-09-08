"""Dark skylight study plus close neutral inspection cameras; metres, art-directed light."""
import bpy
from mathutils import Vector

def move(ob,name):
 for c in list(ob.users_collection):c.objects.unlink(ob)
 bpy.data.collections[name].objects.link(ob)
 return ob

def material(name,color):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.75;return m

def box(name,location,scale,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=location);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat);return move(o,'KOI_ENV')

def camera(name,loc,target,ortho=None):
 bpy.ops.object.camera_add(location=loc);o=bpy.context.object;o.name=name;o.data.lens=42
 o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
 if ortho:o.data.type='ORTHO';o.data.ortho_scale=ortho
 return move(o,'KOI_CAMERAS')

def setup():
 sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=24;sc.cycles.use_denoising=True
 sc.render.resolution_x=720;sc.render.resolution_y=960;sc.render.resolution_percentage=100
 sc.world.use_nodes=True;sc.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.11,.15,.2,1);sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.12
 sc.view_settings.view_transform='AgX'
 mat=material('LFK_DARK_STONE',(.019,.024,.03))
 box('GROUND_PLANE',(0,0,-.08),(8,8,.16),mat)
 box('BACK_WALL',(0,3.8,2.25),(8,.16,4.5),mat)
 for x in (-4,4):box('SIDE_WALL',(x,0,2.25),(.16,8,4.5),mat)
 for x,y,sx,sy in ((-2.55,0,2.9,8),(2.55,0,2.9,8),(0,-2.55,2.2,2.9),(0,2.55,2.2,2.9)):
  box('CEILING',(x,y,4.55),(sx,sy,.1),mat)
 sky=material('LFK_SKY',(.45,.64,.82));p=sky.node_tree.nodes['Principled BSDF'];p.inputs['Emission Color'].default_value=(.45,.64,.82,1);p.inputs['Emission Strength'].default_value=1.2
 box('SKYLIGHT_PLANE',(0,0,4.75),(2.2,2.2,.015),sky)
 bpy.ops.object.light_add(type='AREA',location=(0,0,4.48));key=bpy.context.object;key.name='SKYLIGHT_KEY';key.data.energy=220;key.data.shape='SQUARE';key.data.size=2.15;move(key,'KOI_LIGHTING')
 # Finite soft scattering volume: no glass tube or physical water claim.
 volume=box('LIGHT_BEAM_VOLUME',(0,0,2.24),(2.15,2.15,4.46),mat)
 vm=bpy.data.materials.new('LFK_BEAM_SCATTER');vm.use_nodes=True;nodes=vm.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');scatter=nodes.new('ShaderNodeVolumeScatter');scatter.inputs['Density'].default_value=.025;scatter.inputs['Anisotropy'].default_value=.15;vm.node_tree.links.new(scatter.outputs[0],out.inputs['Volume']);volume.data.materials.clear();volume.data.materials.append(vm)
 for name,loc in (('CAM_MAIN',(3,-7.8,3.)),('CAM_SIDE',(5,-2,2.6)),('CAM_TOP_3Q',(3,-4,6.))):camera(name,loc,(0,0,2.25))
 sc.camera=bpy.data.objects['CAM_MAIN']
 atmosphere_details()
 return {'camera':sc.camera.name}

def studio():
 sc=bpy.context.scene
 for c in ('KOI_ENV','KOI_LIGHTING'):bpy.data.collections[c].hide_render=True
 for rig_name in sc['rig_names']:
  rig=bpy.data.objects[rig_name]
  if rig.parent:rig['studio_parent']=rig.parent.name;rig.parent=None
  for ob in [rig,*rig.children_recursive]:ob.hide_render=rig_name!='KOI_04'
 rig=bpy.data.objects['KOI_04'];rig.location=(0,0,0);rig.rotation_euler=(0,0,0)
 sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
 studio_col=bpy.data.collections.get('KOI_STUDIO')
 if not studio_col:
  studio_col=bpy.data.collections.new('KOI_STUDIO');sc.collection.children.link(studio_col)
  for loc,power,size in (((.6,.2,.9),30,.8),((-.6,-.2,.3),12,.6)):
   bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
   for c in list(o.users_collection):c.objects.unlink(o)
   studio_col.objects.link(o)
 studio_col.hide_render=False
 if not bpy.data.objects.get('CAM_STUDIO_SIDE'):camera('CAM_STUDIO_SIDE',(.8,0,.06),(0,-.04,0),.48)
 if not bpy.data.objects.get('CAM_STUDIO_TOP'):camera('CAM_STUDIO_TOP',(0,0,.8),(0,-.04,0),.68)
 if not bpy.data.objects.get('CAM_STUDIO_3Q'):camera('CAM_STUDIO_3Q',(.65,.62,.5),(0,-.04,0),.48)
 sc.render.resolution_x=960;sc.render.resolution_y=640;sc.cycles.samples=24;sc.frame_set(35)
 return {'ready':True}


def restore_hero():
 sc=bpy.context.scene
 for name in sc['rig_names']:
  rig=bpy.data.objects[name]
  if 'studio_parent' in rig:rig.parent=bpy.data.objects[rig['studio_parent']];del rig['studio_parent']
  rig.location=(0,0,0);rig.rotation_euler=(0,0,0)
  for ob in [rig,*rig.children_recursive]:ob.hide_render=False
 for name in ('KOI_ENV','KOI_LIGHTING'):bpy.data.collections[name].hide_render=False
 if bpy.data.collections.get('KOI_STUDIO'):bpy.data.collections['KOI_STUDIO'].hide_render=True
 sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.12
 sc.camera=bpy.data.objects['CAM_MAIN'];sc.render.resolution_x=720;sc.render.resolution_y=960;sc.frame_set(0)

def atmosphere_details():
 import random,math
 sky=bpy.data.materials['LFK_SKY'];nodes=sky.node_tree.nodes;links=sky.node_tree.links
 noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=3.4;noise.inputs['Detail'].default_value=2
 ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.44;ramp.color_ramp.elements[0].color=(.23,.43,.64,1)
 ramp.color_ramp.elements[1].position=.67;ramp.color_ramp.elements[1].color=(.85,.91,.94,1)
 links.new(noise.outputs['Fac'],ramp.inputs[0]);shader=nodes['Principled BSDF']
 links.new(ramp.outputs[0],shader.inputs['Base Color']);links.new(ramp.outputs[0],shader.inputs['Emission Color'])
 rng=random.Random(93);vertices=[];faces=[]
 octa=[(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]
 for _ in range(65):
  center=Vector((rng.uniform(-.85,.85),rng.uniform(-.85,.85),rng.uniform(.7,4.2)));radius=rng.uniform(.0012,.0028);offset=len(vertices)
  vertices.extend(center+Vector(p)*radius for p in octa)
  faces.extend(tuple(offset+i for i in f) for f in ((0,2,4),(2,1,4),(1,3,4),(3,0,4),(2,0,5),(1,2,5),(3,1,5),(0,3,5)))
 mesh=bpy.data.meshes.new('LFK_DUST_MESH');mesh.from_pydata(vertices,[],faces)
 dust=bpy.data.objects.new('LIGHT_DUST',mesh);bpy.data.collections['KOI_ENV'].objects.link(dust);mesh.materials.append(material('LFK_DUST',(.52,.56,.60)))
 for frame in range(0,2881,24):
  dust.location=(.016*math.sin(frame/2880*math.tau),.012*math.cos(frame/2880*math.tau),.025*math.sin(frame/2880*math.tau))
  dust.keyframe_insert('location',frame=frame)
 return {'dustParticles':65,'clouds':'procedural noise, not meteorological data'}
