"""Original packed muted coats; subtle scales, lighter belly and thin fins."""
import math
import bpy
import numpy as np
from .koi_master_geometry import base

def make_materials(label,color,seed,normal):
 mat=base.material('LFK_BODY_'+label,color,.34)
 h,w=128,256
 a,s=np.mgrid[0:h,0:w];s=s/(w-1);a=a/h*math.tau
 belly=np.clip((-np.sin(a)-.1)/.9,0,1)[...,None]
 rgb=np.broadcast_to(np.array(color),(h,w,3)).copy()
 rgb=rgb*(1-belly*.16)+np.array((.82,.81,.74))*belly*.16
 if label=='black_white':
  mask=np.zeros((h,w))
  for center,angle,span in ((.28,1.0,.12),(.62,2.2,.16),(.83,.6,.07)):
   da=np.arctan2(np.sin(a-angle),np.cos(a-angle))
   island=((s-center)/span)**2+(da/1.25)**2+.09*np.sin(31*s+3*a+seed)
   mask=np.maximum(mask,np.clip((1-island)/.18,0,1))
  rgb=rgb*(1-mask[...,None]) + np.array((.12,.14,.145))*mask[...,None]
 pixels=np.ones((h,w,4),dtype=np.float32);pixels[:,:,:3]=rgb
 image=bpy.data.images.new('LFK_COAT_'+label,width=w,height=h,alpha=False)
 image.colorspace_settings.name='sRGB';image.pixels.foreach_set(pixels.ravel());image.pack()
 nodes,links=mat.node_tree.nodes,mat.node_tree.links;p=nodes['Principled BSDF']
 coat=nodes.new('ShaderNodeTexImage');coat.image=image;links.new(coat.outputs['Color'],p.inputs['Base Color'])
 n=nodes.new('ShaderNodeTexImage');n.image=normal;nmap=nodes.new('ShaderNodeNormalMap');nmap.inputs['Strength'].default_value=.25
 links.new(n.outputs['Color'],nmap.inputs['Color']);links.new(nmap.outputs['Normal'],p.inputs['Normal'])
 p.inputs['Coat Weight'].default_value=.12;p.inputs['Coat Roughness'].default_value=.28
 fin=base.material('LFK_FIN_'+label,tuple(.55+.35*v for v in color),.39,.65)
 return {'KOHAKU':mat,'FIN':fin,'RAY':base.material('LFK_RAY_'+label,tuple(.45+.35*v for v in color),.46),
         'EYE':base.material('LFK_EYE_'+label,(.015,.018,.019),.22),'LIP':base.material('LFK_LIP_'+label,(.52,.46,.4),.42),
         'IRIS':base.material('LFK_IRIS_'+label,(.15,.16,.14),.35),'MOUTH':base.material('LFK_MOUTH_'+label,(.06,.045,.038),.5),'GILL':base.material('LFK_GILL_'+label,(.22,.24,.23),.5)}
