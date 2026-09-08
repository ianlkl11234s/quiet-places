from pathlib import Path
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[4];out=ROOT/'exports/medaka-review';out.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=700;scene.render.resolution_y=500;scene.world=bpy.data.worlds.new('Medaka_Review_World');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.1,.1,.1,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.1;scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=0
light=bpy.data.lights.new('ReviewSun','SUN');light.energy=2;lo=bpy.data.objects.new('ReviewSun',light);scene.collection.objects.link(lo);lo.rotation_euler=(.55,-.35,.45)
# A distant fill keeps the silver flank, black eye, and vertical fin membranes
# readable without returning to the prior close high-energy area light.
fill=bpy.data.lights.new('ReviewFillSun','SUN');fill.energy=.55;fo=bpy.data.objects.new('ReviewFillSun',fill);scene.collection.objects.link(fo);fo.rotation_euler=(-.65,.55,-2.1)
camd=bpy.data.cameras.new('ReviewCamera');cam=bpy.data.objects.new('ReviewCamera',camd);scene.collection.objects.link(cam);camd.type='ORTHO';camd.ortho_scale=.055;camd.clip_start=.001;scene.camera=cam
for name,loc in [('side',(.07,0,.005)),('top',(0,.0,.07)),('three_quarter',(.055,.055,.04))]:
    cam.location=loc;cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/f'asset-{name}.png');bpy.ops.render.render(write_still=True)
