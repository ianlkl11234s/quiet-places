"""Build and export a self-authored, animated koi carp asset.

Run with Blender in a separate factory-startup process; this file deliberately
does not inspect or modify an artist's open scene.
"""
from __future__ import annotations

import json
import math
import struct
import hashlib
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[3]
OUT_BLEND = ROOT / "assets/blender/koi.blend"
OUT_GLB = ROOT / "public/models/koi.glb"
OUT_META = ROOT / "public/models/koi.metadata.json"
FPS, END = 24, 61


def material(name, color, roughness=0.42):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = roughness
    p.inputs["Metallic"].default_value = 0.0
    return mat


def koi_material():
    """White PBR material multiplied by the COLOR_0 vertex colour layer."""
    mat = material("Koi_Scales_Vertex_Painted", (0.96, 0.94, 0.84), 0.4)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    p = nodes.get("Principled BSDF")
    attr = nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Koi_Color"
    # Direct connection keeps COLOR_0 recognised by Blender's glTF exporter.
    # White vertices make the body ivory; vermilion vertices form the patches.
    links.new(attr.outputs["Color"], p.inputs["Base Color"])
    return mat


def patch_colour(x, theta):
    """Irregular vermilion islands across an ivory koi body."""
    spots = ((0.27, 0.20, 0.63), (0.07, 3.3, 0.72), (-0.17, 5.75, 0.53), (-0.34, 2.35, 0.46))
    for cx, ct, scale in spots:
        angular = abs(math.atan2(math.sin(theta-ct), math.cos(theta-ct)))
        edge = scale * (1.0 + 0.20 * math.sin(5 * theta + 9 * x))
        if abs(x-cx) / 0.18 + angular / edge < 1:
            return (0.88, 0.055, 0.018, 1.0)
    return (1.0, 1.0, 1.0, 1.0)


def create_body():
    rings, sides = 31, 18
    verts, faces = [], []
    # head at +X, tail peduncle at -X
    for i in range(rings):
        t = i / (rings - 1)
        x = 0.43 - 0.78 * t
        width = 0.028 + 0.125 * math.sin(math.pi * min(1, t * 1.10)) ** 0.70
        height = width * (0.78 + 0.08 * math.cos(t * math.pi))
        for j in range(sides):
            a = 2 * math.pi * j / sides
            verts.append((x, width * math.sin(a), height * math.cos(a)))
    for i in range(rings - 1):
        for j in range(sides):
            a, b = i*sides+j, i*sides+(j+1) % sides
            faces.append((a, b, b+sides, a+sides))
    faces += [tuple(range(sides-1, -1, -1)), tuple((rings-1)*sides+j for j in range(sides))]
    # Two thin lobes make a recognisable fork; keeping them in this mesh lets
    # the same morph targets carry the tail through the travelling wave.
    tail_start = len(verts)
    verts += [(-0.35, 0, 0), (-0.50, 0, 0.07), (-0.67, 0, 0.17),
              (-0.55, 0, 0), (-0.67, 0, -0.17), (-0.50, 0, -0.07)]
    faces += [(tail_start, tail_start+1, tail_start+2, tail_start+3),
              (tail_start, tail_start+3, tail_start+4, tail_start+5)]
    mesh = bpy.data.meshes.new("Koi_Body_Mesh")
    mesh.from_pydata(verts, [], faces); mesh.materials.append(koi_material())
    obj = bpy.data.objects.new("Koi_Body", mesh); bpy.context.collection.objects.link(obj)
    color = mesh.color_attributes.new("Koi_Color", 'FLOAT_COLOR', 'POINT')
    for i in range(rings):
        x = verts[i*sides][0]
        for j in range(sides): color.data[i*sides+j].color = patch_colour(x, 2*math.pi*j/sides)
    for idx in range(tail_start, len(verts)):
        color.data[idx].color = (1.0, 0.92, 0.78, 1.0)
    return obj


def add_swim_keys(obj):
    """Four morph targets form a continuous lateral wave over body and fins."""
    mesh = obj.data
    basis = obj.shape_key_add(name="Basis")
    for n, phase in enumerate((0, math.pi/2, math.pi, 3*math.pi/2)):
        key = obj.shape_key_add(name=f"SwimWave_{n}")
        for k, point in enumerate(basis.data):
            co = point.co
            # The whole trailing form, including paired and dorsal fins, follows
            # one shared wave field. The tail is intentionally a little stronger.
            t = max(0.0, min(1.40, (0.43 - co.x) / 0.78))
            sway = (0.055 + (0.020 if co.x < -0.55 else 0.0)) * (t ** 2.7) * math.sin(8.0*t + phase)
            key.data[k].co=(co.x, co.y+sway, co.z)
    keys = obj.data.shape_keys.key_blocks
    for frame, active in ((1,0),(16,1),(31,2),(46,3),(61,0)):
        for n in range(4):
            keys[f"SwimWave_{n}"].value = 1.0 if n == active else 0.0
            keys[f"SwimWave_{n}"].keyframe_insert("value", frame=frame)


def fin_mesh(name, points, mat):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(points, [], [tuple(range(len(points)))])
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(obj)
    bevel = obj.modifiers.new("Soft fin edge", 'SOLIDIFY'); bevel.thickness = 0.003
    return obj


def sphere(name, loc, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, location=loc)
    obj=bpy.context.object; obj.name=name; obj.scale=scale; obj.data.materials.append(mat)
    for poly in obj.data.polygons: poly.use_smooth=True
    return obj


def cylinder_between(name, a, b, radius, mat):
    v=Vector(b)-Vector(a); mid=(Vector(a)+Vector(b))/2
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=radius, depth=v.length, location=mid)
    obj=bpy.context.object; obj.name=name; obj.data.materials.append(mat); obj.rotation_mode='QUATERNION'; obj.rotation_quaternion=Vector((0,0,1)).rotation_difference(v.normalized()); return obj


def create_fins():
    fin = material("Koi_Fin_Translucent", (0.96, 0.78, 0.56), 0.47)
    black = material("Koi_Eye_Black", (0.006, 0.004, 0.003), 0.35)
    # Dorsal, paired pectorals, and a broad forked tail. All are authored in native X-forward Z-up.
    dorsal=fin_mesh("Dorsal_Fin", [(-0.02,0,0.115),(-0.28,0,0.095),(-0.17,0,0.245),(0.08,0,0.115)], fin)
    left=fin_mesh("Pectoral_L", [(0.22,0.105,-0.025),(0.08,0.35,-0.12),(-0.02,0.12,-0.04)], fin)
    right=fin_mesh("Pectoral_R", [(0.22,-0.105,-0.025),(0.08,-0.35,-0.12),(-0.02,-0.12,-0.04)], fin)
    return [dorsal, left, right]


def create_face_details():
    fin = material("Koi_Fin_Translucent", (0.96, 0.78, 0.56), 0.47)
    black = material("Koi_Eye_Black", (0.006, 0.004, 0.003), 0.35)
    for y in (-0.095,0.095):
        sphere("Eye", (0.345,y,0.075), (0.025,0.018,0.025), black)
    # A subtle oval mouth and two short barbels make the face legible at close range.
    sphere("Mouth", (0.445,0,-0.018), (0.018,0.055,0.012), fin)
    for y in (-0.05,0.05): cylinder_between("Barbel", (0.42,y,-0.025),(0.48,y*1.25,-0.055),0.004,fin)


def run():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene; scene.name="Koi_Asset"; scene.render.fps=FPS; scene.frame_start=1; scene.frame_end=END
    scene.world = bpy.data.worlds.new("Koi_Asset_World")
    scene.world.color=(0.025,0.04,0.05)
    body=create_body()
    fins=create_fins()
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    for fin in fins: fin.select_set(True)
    bpy.context.view_layer.objects.active=body
    bpy.ops.object.join()
    body.name="Koi_Body_and_Fins"
    for poly in body.data.polygons: poly.use_smooth=True
    add_swim_keys(body)
    create_face_details()
    # Make the generated shape-key action explicit and exportable as the sole clip.
    action=body.data.shape_keys.animation_data.action; action.name="Swim"
    bpy.ops.object.select_all(action='SELECT'); bpy.context.view_layer.objects.active=body
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH': obj.select_set(True)
    OUT_BLEND.parent.mkdir(parents=True, exist_ok=True); OUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    bpy.ops.export_scene.gltf(filepath=str(OUT_GLB), export_format='GLB', use_selection=False,
        export_animations=True, export_morph=True, export_morph_animation=True, export_force_sampling=True,
        export_frame_range=True, export_apply=True, export_materials='EXPORT', export_extras=True)
    triangles=sum(len(p.vertices)-2 for o in scene.objects if o.type=='MESH' for p in o.data.polygons)
    all_points=[o.matrix_world @ v.co for o in scene.objects if o.type=='MESH' for v in o.data.vertices]
    lo=[min(v[i] for v in all_points) for i in range(3)]; hi=[max(v[i] for v in all_points) for i in range(3)]
    metadata={"name":"Self-authored Koi Carp","dimensionsMeters":{"length":round(hi[0]-lo[0],3),"width":round(hi[1]-lo[1],3),"height":round(hi[2]-lo[2],3)},
      "nativeCoordinates":{"head":"+X","up":"+Z","glTF":"head +X, up +Y"},"trianglesApprox":triangles,
      "materials":{"vertexColor":"Koi_Color (white / irregular vermilion patches)","roughness":0.4,"emissive":False},
      "animation":{"clip":"Swim","durationSeconds":2.5,"loop":"seamless morph-target travelling wave; no root translation"},
      "source":"assets/blender/scripts/koi.py","shadowNote":"Place roughly 0.10 m above the floor so renderer lighting gives a natural soft shadow."}
    data = OUT_GLB.read_bytes()
    gltf = json.loads(data[20:20+struct.unpack_from('<I', data, 12)[0]])
    accessor = gltf['accessors'][gltf['animations'][0]['samplers'][0]['input']]
    metadata['animation']['durationSeconds'] = accessor['max'][0] - accessor['min'][0]
    metadata['glbSha256'] = hashlib.sha256(data).hexdigest()
    metadata['shadowNote'] = 'Runtime body origin sits 0.25–0.31m above floor; directional shadow map handles projection.'
    OUT_META.write_text(json.dumps(metadata,indent=2)+"\n",encoding='utf-8')
    print(json.dumps({"glb":str(OUT_GLB),"triangles":triangles,"animation":action.name},indent=2))


if __name__=='__main__': run()
