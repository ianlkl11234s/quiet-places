"""Shared Blender/runtime in-place medaka pose contract."""
import math
from mathutils import Quaternion,Vector
from medaka_rig import BONES

LENGTH=.038
TAIL_BONES=('Spine_02','Spine_03','Spine_04','Spine_05','Peduncle','Tail_Base','Tail_Tip')

def pose(rig,integratedphase,speed=.035,accel=0.):
    """Runtime supplies integrated phase; q/amp contract is identical in Three."""
    q=max(0.,min(1.,(speed-.035)/(.24-.035))); amp=LENGTH*.035*(.65+.55*q)*(1+.2*accel)
    prior=0.
    for index,name in enumerate(BONES[:9]):
        s=max(0,(index-1)/7); arg=integratedphase-math.tau*.9*s
        # tangent = derivative of lateral displacement relative to forward length.
        tangent=math.atan((amp*(2.2*s**1.2*math.sin(arg)-math.tau*.9*s**2.2*math.cos(arg)))/LENGTH)
        rig.pose.bones[name].rotation_quaternion=Quaternion(Vector((0,0,1)),tangent-prior);prior=tangent
    flap=.20*(1-.55*q)*math.sin(integratedphase)
    rig.pose.bones['Pectoral_L'].rotation_quaternion=Quaternion(Vector((0,0,1)),flap)
    rig.pose.bones['Pectoral_R'].rotation_quaternion=Quaternion(Vector((0,0,1)),-flap)
    return {'q':'clamp((v-.035)/(.24-.035),0,1)','tailDisplacement':'L*.035*(.65+.55*q)*(1+.2*accel)','localAxis':'Z','formula':'integratedPhase input; atan(displacement derivative / L), adjacent difference','pectoral':'0.20*(1-.55*q)*sin(integratedPhase), local Z opposite signs'}
