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
    'x': [.85, 1.70],
    'z': [-1.175, -.325],
    'roofY': 3.0,
    'blenderY': [.325, 1.175],
}
ROOM_X = [-1.90, 1.80]
ROOM_WIDTH_VERSION = '3.7-metre-v3'
GRATE_Y = 3.04
GRATE_DEPTH = .045
FRAME = .04
SLAT_X = [.89 + (index + 1) * (.77 / 10) for index in range(9)]
SLAT_Z = [-1.135, -.365]
BRACE_Z = [-1.135 + (index + 1) * (.77 / 3) for index in range(2)]
SECONDARY_APERTURE = {
    'x': [-1.80, -.95],
    'z': [-1.175, -.325],
    'roofY': 3.0,
    'blenderY': [.325, 1.175],
}
SECONDARY_FRAME = FRAME
SECONDARY_SLAT_X = sorted(-.10 - x for x in SLAT_X)
SECONDARY_SLAT_Z = SLAT_Z
SECONDARY_BRACE_Z = BRACE_Z


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


def components(mesh):
    adjacent = {vertex.index: set() for vertex in mesh.vertices}
    for polygon in mesh.polygons:
        indices = polygon.vertices[:]
        for index, vertex in enumerate(indices):
            adjacent[vertex].add(indices[(index + 1) % len(indices)])
            adjacent[vertex].add(indices[index - 1])
    pending = set(adjacent)
    result = []
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
        result.append(component)
    return result


def move_world_x(obj, indices, transform):
    inverse = obj.matrix_world.inverted()
    for index in indices:
        world = obj.matrix_world @ obj.data.vertices[index].co
        world.x = transform(world.x)
        obj.data.vertices[index].co = inverse @ world
    obj.data.update()


def previous_left_edge(scene, key):
    version = scene.get(key)
    if version == ROOM_WIDTH_VERSION:
        return ROOM_X[0]
    if version == 'four-metre-v2':
        return -2.2
    if version == 'left-widened-v1':
        return -2.7
    if version is None:
        return -1.8
    raise RuntimeError(f'Unknown corridor width version: {version}')


def widen_web_room(scene, room):
    """Keep web UVs/materials: change positions only, once per source blend."""
    if scene.get('afterlight_web_room_width_version') == ROOM_WIDTH_VERSION:
        return {'leftWallVertices': 0, 'floorVertices': 0}
    old_left = previous_left_edge(scene, 'afterlight_web_room_width_version')
    left_wall, floor = set(), set()
    for component in components(room.data):
        positions = [room.matrix_world @ room.data.vertices[index].co for index in component]
        xs = [point.x for point in positions]
        zs = [point.z for point in positions]
        # The joined left wall is a discrete vertical component; preserve its
        # thickness by translating it rather than scaling its x coordinates.
        if max(xs) <= -1.70 and max(zs) > .20:
            left_wall.update(component)
        # Floor components are the only horizontal pieces at ground level.
        elif max(zs) <= .20:
            floor.update(component)
    move_world_x(room, left_wall, lambda x: x + ROOM_X[0] - old_left)
    move_world_x(room, floor, lambda x: x * ROOM_X[0] / old_left if x < 0 else x)
    scene['afterlight_web_room_width_version'] = ROOM_WIDTH_VERSION
    return {'leftWallVertices': len(left_wall), 'floorVertices': len(floor)}


def stretch_negative_x_floor(obj, old_left):
    move_world_x(obj, range(len(obj.data.vertices)), lambda x: x * ROOM_X[0] / old_left if x < 0 else x)


def widen_far_mesh(obj, old_left):
    # Preserve the fixed x=1.8 edge while resizing the far corridor.
    move_world_x(obj, range(len(obj.data.vertices)), lambda x: 1.8 + (1.8 - ROOM_X[0]) / (1.8 - old_left) * (x - 1.8))


def widen_source_and_far(scene, source):
    """Widen authored room/FarCorridor without changing the fixed right edge."""
    if scene.get('afterlight_mesh_width_version') == ROOM_WIDTH_VERSION:
        return {'leftWalls': 0, 'stretchedMeshes': 0}
    old_left = previous_left_edge(scene, 'afterlight_mesh_width_version')
    walls = stretched = 0
    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue
        if obj.name in ('RoomSurface_LeftWall', 'FarCorridor_LeftWall'):
            obj.location.x += ROOM_X[0] - old_left
            walls += 1
        elif obj.name.startswith('FarCorridor_') and obj.name != 'FarCorridor_RightWall':
            widen_far_mesh(obj, old_left)
            stretched += 1
        elif obj.name.startswith('RoomSurface_') and 'Floor' in obj.name:
            stretch_negative_x_floor(obj, old_left)
            stretched += 1
    scene['afterlight_mesh_width_version'] = ROOM_WIDTH_VERSION
    return {'leftWalls': walls, 'stretchedMeshes': stretched}


def build_roof(scene, collection):
    concrete = material('DrainRoof_DarkConcrete', (.115, .125, .115), .88)
    # Five non-beveled prisms are joined into one mesh: fore, back, and the
    # left/centre/right strips between the mirrored apertures.  Their shared
    # coordinates have no bevel gap through which daylight can leak.
    left, right = ROOM_X
    secondary_left, secondary_right = SECONDARY_APERTURE['x']
    primary_left, primary_right = APERTURE['x']
    near, far = APERTURE['z']
    pieces = ((left, right, -2.0, near), (left, right, far, 4.0),
              (left, secondary_left, near, far), (secondary_right, primary_left, near, far),
              (primary_right, right, near, far))
    vertices, faces = [], []
    for x0, x1, z0, z1 in pieces:
        y0, y1 = -z1, -z0
        base = len(vertices)
        vertices.extend(((x0, y0, 2.88), (x1, y0, 2.88), (x1, y1, 2.88), (x0, y1, 2.88),
                         (x0, y0, 3.12), (x1, y0, 3.12), (x1, y1, 3.12), (x0, y1, 3.12)))
        faces.extend(((base, base + 3, base + 2, base + 1), (base + 4, base + 5, base + 6, base + 7),
                      (base, base + 1, base + 5, base + 4), (base + 1, base + 2, base + 6, base + 5),
                      (base + 2, base + 3, base + 7, base + 6), (base + 3, base, base + 4, base + 7)))
    mesh = bpy.data.meshes.new('DrainRoof_Near')
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(concrete)
    mesh.update()
    roof = bpy.data.objects.new('DrainRoof_Near', mesh)
    collection.objects.link(roof)
    return [roof]


def build_grate(collection):
    steel = material('DrainGrate_RoughSteel', (.075, .082, .078), .72, metallic=.88)
    items = []
    # Perimeter: x rails follow the long z direction; z rails close the ends.
    items.append(cube(collection, 'DrainGrate_Frame_West', (.57, .75, GRATE_Y), (FRAME, .85, GRATE_DEPTH), steel, .004))
    items.append(cube(collection, 'DrainGrate_Frame_East', (1.38, .75, GRATE_Y), (FRAME, .85, GRATE_DEPTH), steel, .004))
    items.append(cube(collection, 'DrainGrate_Frame_North', (.975, .345, GRATE_Y), (.85, FRAME, GRATE_DEPTH), steel, .004))
    items.append(cube(collection, 'DrainGrate_Frame_South', (.975, 1.155, GRATE_Y), (.85, FRAME, GRATE_DEPTH), steel, .004))
    for index, x in enumerate(SLAT_X):
        items.append(cube(collection, f'DrainGrate_Slat_{index + 1:02d}', (x, .75, GRATE_Y), (.022, .77, GRATE_DEPTH), steel, .002))
    for index, z in enumerate(BRACE_Z):
        items.append(cube(collection, f'DrainGrate_Brace_{index + 1:02d}', (.975, -z, GRATE_Y), (.77, .018, GRATE_DEPTH), steel, .002))
    return items


def build_secondary_grate(collection):
    steel = material('DrainGrate_RoughSteel', (.075, .082, .078), .72, metallic=.88)
    items = []
    items.append(cube(collection, 'DrainGrate_Secondary_Frame_West', (-2.28, .75, GRATE_Y), (SECONDARY_FRAME, .85, GRATE_DEPTH), steel, .004))
    items.append(cube(collection, 'DrainGrate_Secondary_Frame_East', (-1.47, .75, GRATE_Y), (SECONDARY_FRAME, .85, GRATE_DEPTH), steel, .004))
    items.append(cube(collection, 'DrainGrate_Secondary_Frame_North', (-1.875, .345, GRATE_Y), (.85, SECONDARY_FRAME, GRATE_DEPTH), steel, .004))
    items.append(cube(collection, 'DrainGrate_Secondary_Frame_South', (-1.875, 1.155, GRATE_Y), (.85, SECONDARY_FRAME, GRATE_DEPTH), steel, .004))
    for index, x in enumerate(SECONDARY_SLAT_X):
        items.append(cube(collection, f'DrainGrate_Secondary_Slat_{index + 1:02d}', (x, .75, GRATE_Y), (.022, .77, GRATE_DEPTH), steel, .002))
    for index, z in enumerate(SECONDARY_BRACE_Z):
        items.append(cube(collection, f'DrainGrate_Secondary_Brace_{index + 1:02d}', (-1.875, -z, GRATE_Y), (.77, .018, GRATE_DEPTH), steel, .002))
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
    data['secondaryAperture'] = SECONDARY_APERTURE
    data['secondaryDrainGrate'] = {
        'coordinateSystem': 'Three x/z; Blender=(x,-z,y)',
        'centerY': GRATE_Y,
        'verticalExtent': [round(GRATE_Y - GRATE_DEPTH / 2, 4), round(GRATE_Y + GRATE_DEPTH / 2, 4)],
        'frameWidth': SECONDARY_FRAME,
        'slatCount': 9,
        'slatWidthX': .022,
        'slatZ': SECONDARY_SLAT_Z,
        'slatX': SECONDARY_SLAT_X,
        'braceCount': 2,
        'braceWidthZ': .018,
        'braceZ': SECONDARY_BRACE_Z,
        'material': 'DrainGrate_RoughSteel; nonemissive, rough metal',
    }
    data['corridorBounds'] = {
        'x': ROOM_X,
        'centerX': -.05,
        'widthMetres': 3.7,
        'widthVersion': ROOM_WIDTH_VERSION,
        'rightEdgeFixed': True,
        'uvPreserved': True,
        'geometryApproximation': 'Joined RoomSurface keeps UV/material data; its left wall moves to x=-1.9m and negative-x floor vertices resize with the wall. Far corridor widens about its fixed right x=1.8 edge.',
    }
    metadata_path.write_text(json.dumps(data, indent=2) + '\n')


def run(export=False):
    scene = bpy.context.scene
    remove_named_assets()
    if scene.get('afterlight_web_baked_room') or bpy.data.filepath.endswith('afterlight-web.blend'):
        room = bpy.data.objects.get('RoomSurface')
        if not room:
            raise RuntimeError('afterlight-web.blend is missing its joined RoomSurface')
        width_stats = widen_web_room(scene, room)
        width_stats['far'] = widen_source_and_far(scene, source=False)
        removed = remove_web_roof_components(room)
        kind = 'web-joined-room'
    else:
        remove_source_roofs()
        width_stats = widen_source_and_far(scene, source=True)
        removed = 0
        kind = 'editable-source'
    assets = container(scene)
    roof = build_roof(scene, assets)
    grate = build_grate(assets)
    secondary_grate = build_secondary_grate(assets)
    scene['aperture_three'] = APERTURE
    scene['drain_grate_three'] = {
        'y': GRATE_Y, 'depth': GRATE_DEPTH, 'slatX': SLAT_X,
        'slatZ': SLAT_Z, 'braceZ': BRACE_Z,
    }
    scene['secondary_aperture_three'] = SECONDARY_APERTURE
    scene['secondary_drain_grate_three'] = {
        'y': GRATE_Y, 'depth': GRATE_DEPTH, 'slatX': SECONDARY_SLAT_X,
        'slatZ': SECONDARY_SLAT_Z, 'braceZ': SECONDARY_BRACE_Z,
    }
    scene['width_version'] = ROOM_WIDTH_VERSION
    scene['drain_update'] = {'kind': kind, 'removedWebRoofVertices': removed, 'roofPieces': len(roof), 'gratePieces': len(grate), 'secondaryGratePieces': len(secondary_grate), 'width': width_stats}
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
    if export:
        export_web(scene)
    return {'kind': kind, 'removedWebRoofVertices': removed, 'roofPieces': len(roof), 'gratePieces': len(grate), 'secondaryGratePieces': len(secondary_grate), 'width': width_stats}


if __name__ == '__main__':
    if '--all' in sys.argv:
        bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets/blender/afterlight-courtyard.blend'))
        source_result = run(export=False)
        bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets/blender/afterlight-web.blend'))
        web_result = run(export=True)
        print(json.dumps({'source': source_result, 'web': web_result}))
    else:
        print(json.dumps(run(export='--export' in sys.argv)))
