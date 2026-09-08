"""Enlarge Afterlight's skylight and add an editable steel drain grate.

Run once for each authored blend.  The web blend receives a component-level
roof removal because its room is already a baked joined mesh; its existing
wall/floor UVs and material slots are left intact.  The source blend keeps
its editable foliage untouched.  Export only from the web blend:

  blender --background assets/blender/afterlight-courtyard.blend --python \
    assets/blender/scripts/update_afterlight_drain.py
  blender --background assets/blender/afterlight-web.blend --python \
    assets/blender/scripts/update_afterlight_drain.py -- --export
"""
from pathlib import Path
import json
import sys

import bmesh
import bpy


ROOT = Path(__file__).resolve().parents[3]
APERTURE = {
    'x': [.40, 1.55],
    'z': [-1.40, -.10],
    'roofY': 3.0,
    'blenderY': [.10, 1.40],
}
GRATE_Y = 3.04
GRATE_DEPTH = .045
FRAME = .04
SLAT_X = [.44 + (index + 1) * (1.07 / 10) for index in range(9)]
SLAT_Z = [-1.36, -.14]
BRACE_Z = [-1.36 + (index + 1) * (1.22 / 3) for index in range(2)]


def material(name, color, roughness, metallic=0.0):
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    node = result.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*color, 1.0)
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Metallic'].default_value = metallic
    # Explicitly retain a non-emissive everyday drain finish.
    node.inputs['Emission Color'].default_value = (0.0, 0.0, 0.0, 1.0)
    node.inputs['Emission Strength'].default_value = 0.0
    return result


def container(scene):
    collection = bpy.data.collections.get('DrainAssets')
    if not collection:
        collection = bpy.data.collections.new('DrainAssets')
        scene.collection.children.link(collection)
    return collection


def remove_named_assets():
    for obj in list(bpy.data.objects):
        if obj.name.startswith(('DrainRoof_', 'DrainGrate_')):
            bpy.data.objects.remove(obj, do_unlink=True)


def cube(collection, name, location, dimensions, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new('Edge softness', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 1
    obj.data.materials.append(mat)
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def remove_web_roof_components(room):
    """Delete only disconnected RoomSurface components fully above z=2.85."""
    mesh = room.data
    adjacent = {vertex.index: set() for vertex in mesh.vertices}
    for polygon in mesh.polygons:
        indices = polygon.vertices[:]
        for index, vertex in enumerate(indices):
            adjacent[vertex].add(indices[(index + 1) % len(indices)])
            adjacent[vertex].add(indices[index - 1])
    pending = set(adjacent)
    remove = set()
    while pending:
        seed = pending.pop()
        component = {seed}
        frontier = [seed]
        while frontier:
            vertex = frontier.pop()
            neighbors = adjacent[vertex] & pending
            pending.difference_update(neighbors)
            component.update(neighbors)
            frontier.extend(neighbors)
        if all((room.matrix_world @ mesh.vertices[index].co).z >= 2.85 for index in component):
            remove.update(component)
    if remove:
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bm.verts.ensure_lookup_table()
        doomed = [bm.verts[index] for index in sorted(remove)]
        bmesh.ops.delete(bm, geom=doomed, context='VERTS')
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
    return len(remove)


def remove_source_roofs():
    for obj in list(bpy.data.objects):
        if obj.name.startswith('RoomSurface_Roof_'):
            bpy.data.objects.remove(obj, do_unlink=True)


def build_roof(scene, collection):
    concrete = material('DrainRoof_DarkConcrete', (.115, .125, .115), .88)
    # Blender Y is negative Three Z.  Four pieces cover the old roof footprint
    # while leaving exactly the requested x/z skylight bounds.
    pieces = (
        ('DrainRoof_Fore', (0.0, -1.95, 3.0), (3.6, 4.10, .24)),
        ('DrainRoof_Back', (0.0, 1.70, 3.0), (3.6, .60, .24)),
        ('DrainRoof_Left', (-.70, .75, 3.0), (2.20, 1.30, .24)),
        ('DrainRoof_Right', (1.675, .75, 3.0), (.25, 1.30, .24)),
    )
    return [cube(collection, *piece, concrete, bevel=.015) for piece in pieces]


def build_grate(collection):
    steel = material('DrainGrate_RoughSteel', (.075, .082, .078), .72, metallic=.88)
    items = []
    # Perimeter: x rails follow the long z direction; z rails close the ends.
    items.append(cube(collection, 'DrainGrate_Frame_West', (.42, .75, GRATE_Y), (FRAME, 1.30, GRATE_DEPTH), steel, .004))
    items.append(cube(collection, 'DrainGrate_Frame_East', (1.53, .75, GRATE_Y), (FRAME, 1.30, GRATE_DEPTH), steel, .004))
    items.append(cube(collection, 'DrainGrate_Frame_North', (.975, .12, GRATE_Y), (1.15, FRAME, GRATE_DEPTH), steel, .004))
    items.append(cube(collection, 'DrainGrate_Frame_South', (.975, 1.38, GRATE_Y), (1.15, FRAME, GRATE_DEPTH), steel, .004))
    for index, x in enumerate(SLAT_X):
        items.append(cube(collection, f'DrainGrate_Slat_{index + 1:02d}', (x, .75, GRATE_Y), (.022, 1.22, GRATE_DEPTH), steel, .002))
    for index, z in enumerate(BRACE_Z):
        items.append(cube(collection, f'DrainGrate_Brace_{index + 1:02d}', (.975, -z, GRATE_Y), (1.07, .018, GRATE_DEPTH), steel, .002))
    return items


def export_web(scene):
    room = bpy.data.objects.get('RoomSurface')
    camera = bpy.data.objects.get('Camera_Hero')
    if not room or not camera:
        raise RuntimeError('RoomSurface or Camera_Hero is missing')
    bpy.ops.object.select_all(action='DESELECT')
    room.select_set(True)
    camera.select_set(True)
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and (obj.name.startswith('FarCorridor_') or obj.name.startswith(('DrainRoof_', 'DrainGrate_'))):
            obj.select_set(True)
    output = ROOT / 'public/models/afterlight-courtyard.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(output), export_format='GLB', use_selection=True,
        export_cameras=True, export_extras=True, export_attributes=True,
        export_apply=True,
    )
    metadata_path = ROOT / 'public/models/afterlight-courtyard.metadata.json'
    data = json.loads(metadata_path.read_text())
    data['aperture'] = APERTURE
    data['drainGrate'] = {
        'coordinateSystem': 'Three x/z; Blender=(x,-z,y)',
        'centerY': GRATE_Y,
        'verticalExtent': [round(GRATE_Y - GRATE_DEPTH / 2, 4), round(GRATE_Y + GRATE_DEPTH / 2, 4)],
        'frameWidth': FRAME,
        'slatCount': 9,
        'slatWidthX': .022,
        'slatZ': SLAT_Z,
        'slatX': SLAT_X,
        'braceCount': 2,
        'braceWidthZ': .018,
        'braceZ': BRACE_Z,
        'material': 'DrainGrate_RoughSteel; nonemissive, rough metal',
    }
    metadata_path.write_text(json.dumps(data, indent=2) + '\n')


def run(export=False):
    scene = bpy.context.scene
    remove_named_assets()
    if scene.get('afterlight_web_baked_room') or bpy.data.filepath.endswith('afterlight-web.blend'):
        room = bpy.data.objects.get('RoomSurface')
        if not room:
            raise RuntimeError('afterlight-web.blend is missing its joined RoomSurface')
        removed = remove_web_roof_components(room)
        kind = 'web-joined-room'
    else:
        remove_source_roofs()
        removed = 0
        kind = 'editable-source'
    assets = container(scene)
    roof = build_roof(scene, assets)
    grate = build_grate(assets)
    scene['aperture_three'] = APERTURE
    scene['drain_grate_three'] = {
        'y': GRATE_Y, 'depth': GRATE_DEPTH, 'slatX': SLAT_X,
        'slatZ': SLAT_Z, 'braceZ': BRACE_Z,
    }
    scene['drain_update'] = {'kind': kind, 'removedWebRoofVertices': removed, 'roofPieces': len(roof), 'gratePieces': len(grate)}
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
    if export:
        export_web(scene)
    return {'kind': kind, 'removedWebRoofVertices': removed, 'roofPieces': len(roof), 'gratePieces': len(grate)}


if __name__ == '__main__':
    if '--all' in sys.argv:
        bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets/blender/afterlight-courtyard.blend'))
        source_result = run(export=False)
        bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets/blender/afterlight-web.blend'))
        web_result = run(export=True)
        print(json.dumps({'source': source_result, 'web': web_result}))
    else:
        print(json.dumps(run(export='--export' in sys.argv)))
