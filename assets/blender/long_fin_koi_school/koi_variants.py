"""Seeded real shape and coat variations derived from one procedural master."""
from .config import PALETTE,SCALES
from .koi_master_geometry import base,create_geometry
from .koi_master_rig import make_rig
from .koi_materials import make_materials

def build_school(collection):
 normal=base.normal_texture();rigs=[]
 for i,((label,color),scale) in enumerate(zip(PALETTE,SCALES)):
  params={'body_length_scale':.97+(i%3)*.025,'body_depth_scale':.95+(i%4)*.035,
          'tail_length_scale':1+(i%3)*.065,'pectoral_length_scale':1+(i%3)*.09}
  name='KOI_%02d'%(i+1);mats=make_materials(label,color,37+i*53,normal)
  body,parts=create_geometry(collection,mats,params,name)
  rig=make_rig(collection,parts,params,name);rig.scale=(scale,)*3
  rig['variant']=label;rig['motion_seed']=37+i*53;rig['size_scale']=scale
  rig['preferred_speed']=.044+i*.003
  for key,value in params.items():rig[key]=value
  rigs.append(rig)
 return rigs
