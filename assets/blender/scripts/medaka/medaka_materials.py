"""Original muted materials; colour survives GLB through a vertex attribute."""
import bpy

def make_materials():
    materials=[]
    for name,rough,metal,alpha in [('Medaka_Body_SilverOlive',.34,.12,1),('Medaka_Fin_Translucent',.45,.02,.62),('Medaka_Eye_Dark',.2,0,1)]:
        m=bpy.data.materials.new(name);m.use_nodes=True;m.use_backface_culling=False
        p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;p.inputs['Alpha'].default_value=alpha
        c=m.node_tree.nodes.new('ShaderNodeVertexColor');c.layer_name='MedakaColor';m.node_tree.links.new(c.outputs['Color'],p.inputs['Base Color'])
        if alpha<1:m.surface_render_method='DITHERED'
        materials.append(m)
    return materials
