"""A narrow weathered wall/floor junction. Blender metres, Z-up; wall inner x=1.71."""
import bpy
import math

WALL_INNER_X=1.71
ROOTS=[(1.698,.38)]

def build_floor(collection,floor,soil):
    verts=[];faces=[]
    def quad(points):
        start=len(verts);verts.extend(points);faces.append(tuple(range(start,start+4)))
    ys=[-4,-1.4]+[-1.35+i*.025 for i in range(125)]+[2]
    ys=sorted(set(ys))
    def edge(y):
        if y< -1.35 or y>1.75:return WALL_INNER_X
        fade=min(1,max(0,(y+1.35)/.15),max(0,(1.75-y)/.15))
        return WALL_INNER_X-fade*(.018+.004*math.sin(y*47)**2+.003*math.sin(y*113)**2)
    # One concave top ngon has a single continuous UV island.  The finely
    # sampled right boundary carries the irregular wall-foot gap; it is not a
    # stack of independently unwrapped strips.
    top=[(-1.8,-4,0)]+[(edge(y),y,0) for y in ys]+[(-1.8,2,0)]
    verts.extend(top);faces.append(tuple(range(len(top))))
    for a,b in zip(ys,ys[1:]):
        xa,xb=edge(a),edge(b)
        quad([(xa,a,0),(xa,a,-.07),(xb,b,-.07),(xb,b,0)])
    mesh=bpy.data.meshes.new('RoomSurface_WallFootFloor');mesh.from_pydata(verts,[],faces);mesh.materials.append(floor)
    if mesh.polygons[0].normal.z < .99:
        raise RuntimeError('Wall-foot floor top normal must face +Z')
    uv=mesh.uv_layers.new(name='UV0')
    for loop in mesh.loops:
        x,y,_=mesh.vertices[loop.vertex_index].co
        uv.data[loop.index].uv=((x+1.8)/3.51,(y+4)/6)
    obj=bpy.data.objects.new(mesh.name,mesh);collection.objects.link(obj)
    soil_mesh=bpy.data.meshes.new('RoomSurface_WallFootSoil')
    soil_mesh.from_pydata([(1.66,-4.1,-.024),(1.80,-4.1,-.024),(1.80,2.1,-.024),(1.66,2.1,-.024)],[],[(0,1,2,3)])
    soil_mesh.materials.append(soil);earth=bpy.data.objects.new(soil_mesh.name,soil_mesh);collection.objects.link(earth)
    return {'placement':'wall-floor junction','wallInnerX':WALL_INNER_X,'gapMetres':[.018,.025],'soilTopMetres':-.024,'roots':ROOTS}
