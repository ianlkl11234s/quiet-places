"""Established koi surface topology transformed into a smaller long-fin morphology."""
from pathlib import Path
import sys
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'assets/blender/scripts'))
import koi as base


def transform(co, params):
 x,y,z=co
 bl=params.get('body_length_scale',1.); depth=params.get('body_depth_scale',1.)
 if y>=base.TAIL_BASE: new_y=.145-(base.NOSE-y)*(.29/base.BODY)*bl
 else: new_y=.145-.29*bl-(base.TAIL_BASE-y)*(.09/(base.TAIL_BASE+base.L/2))*params.get('tail_length_scale',1.)
 return Vector((x*(.062/base.W),new_y,z*(.075/base.D)*depth))

def create_geometry(collection, mats, params, prefix):
 body=base.create_body(collection,mats); fins=base.create_fins(collection,mats); face=base.create_face(collection,mats)
 parts=[(body,'body'),*fins,*[(ob,'face') for ob in face]]
 for ob,kind in parts:
  ob.name=prefix+'_'+ob.name
  for vertex in ob.data.vertices:
   co=vertex.co.copy()
   if kind.startswith('pectoral'):
    side=-1 if kind.endswith('L') else 1
    rx,rz,z=base.profile(.21)
    origin=Vector((side*rx*.91,base.NOSE-.21*base.BODY,z-rz*.28))
    offset=co-origin
    # Preserve the attachment line; extend outward and gently backward.
    reach=max(0.,min(1.,(abs(co.x)-abs(origin.x))/.046))
    gain=params.get('pectoral_length_scale',1.15)
    co.x=origin.x+offset.x*1.55*gain
    co.y-=.052*reach*gain
   vertex.co=transform(co,params)
 return body,parts
