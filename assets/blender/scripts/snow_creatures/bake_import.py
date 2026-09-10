"""Import runtime-derived Snow Window creature geometry into an editable QA .blend.

Run through Blender, never through a live scene:
  Blender --background --python bake_import.py -- --input scene.json --output snow-creatures.blend
"""
import argparse
import json
import math
import os
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion


SCHEMA = "snow-creatures-bake/v1"
# Three.js source coordinates (right, up, forward) to Blender (right, forward, up).
BASIS = Matrix(((1.0, 0.0, 0.0), (0.0, 0.0, -1.0), (0.0, 1.0, 0.0)))
BASIS_Q = BASIS.to_quaternion()


def cli_args():
    marker = sys.argv.index("--") + 1 if "--" in sys.argv else len(sys.argv)
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--export-gltf", type=Path,
                        help="Optional two-second morph-plus-root GLB QA preview.")
    return parser.parse_args(sys.argv[marker:])


def finite_numbers(values, label):
    if not all(math.isfinite(v) for v in values):
        raise ValueError(f"{label} contains non-finite values")


def resolve(source, value):
    path = Path(value)
    return path if path.is_absolute() else source.parent / path


def read_f32(path, expected, label):
    raw = path.read_bytes()
    if len(raw) != expected * 4:
        raise ValueError(f"{label}: expected {expected * 4} bytes, got {len(raw)} ({path})")
    values = struct.unpack("<" + "f" * expected, raw)
    finite_numbers(values, label)
    return values


def three_to_blender_point(point):
    return (point[0], -point[2], point[1])


def three_to_blender_quat(quat_xyzw):
    qx, qy, qz, qw = quat_xyzw
    magnitude = math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw)
    if magnitude < 1e-8:
        raise ValueError("root pose quaternion has zero magnitude")
    q = Quaternion((qw, qx, qy, qz))
    if magnitude < 0.999 or magnitude > 1.001:
        q.normalize()
    converted = BASIS_Q @ q @ BASIS_Q.inverted()
    return (converted.w, converted.x, converted.y, converted.z)


def signed_volume(vertices, triangles):
    """Signed enclosed volume; positive faces point outward for this coordinate basis."""
    total = 0.0
    for a, b, c in triangles:
        pa, pb, pc = vertices[a], vertices[b], vertices[c]
        total += (pa[0] * (pb[1] * pc[2] - pb[2] * pc[1])
                  + pa[1] * (pb[2] * pc[0] - pb[0] * pc[2])
                  + pa[2] * (pb[0] * pc[1] - pb[1] * pc[0])) / 6.0
    return total


def collection(name):
    existing = bpy.data.collections.get(name)
    if existing:
        return existing
    created = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(created)
    return created


def link_only(obj, target):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    target.objects.link(obj)


def make_material(spec, name):
    material = bpy.data.materials.new(name + "_MAT")
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    color = spec.get("color", [0.8, 0.85, 0.9])
    if len(color) != 3:
        raise ValueError(f"{name}: material color must have three components")
    raw_values = {"color": [float(value) for value in color],
                  "opacity": float(spec.get("opacity", 1.0)),
                  "roughness": float(spec.get("roughness", 0.55)),
                  "transmission": float(spec.get("transmission", 0.0))}
    finite_numbers(raw_values["color"] + [raw_values["opacity"], raw_values["roughness"],
                                           raw_values["transmission"]], name + " material")
    clamped = {}
    for label, values in (("color", raw_values["color"]),):
        corrected = [min(1.0, max(0.0, value)) for value in values]
        if corrected != values:
            clamped[label] = {"input": values, "output": corrected}
        raw_values[label] = corrected
    for label in ("opacity", "roughness", "transmission"):
        value = raw_values[label]
        corrected = min(1.0, max(0.0, value))
        if corrected != value:
            clamped[label] = {"input": value, "output": corrected}
        raw_values[label] = corrected
    bsdf.inputs["Base Color"].default_value = (*raw_values["color"], 1.0)
    bsdf.inputs["Roughness"].default_value = raw_values["roughness"]
    if "Transmission Weight" in bsdf.inputs:
        bsdf.inputs["Transmission Weight"].default_value = raw_values["transmission"]
    elif "Transmission" in bsdf.inputs:
        bsdf.inputs["Transmission"].default_value = raw_values["transmission"]
    bsdf.inputs["Alpha"].default_value = raw_values["opacity"]
    # Deliberately do not set emission: this is a natural-light inspection asset.
    material.surface_render_method = 'DITHERED'
    material["runtimeMaterialClamped"] = json.dumps(clamped)
    return material, clamped


def write_pc2(path, positions, frames, vertices, fps):
    """Write converted frame-major float32 positions as PC2, one sample per frame."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as stream:
        stream.write(struct.pack("<12siiffi", b"POINTCACHE2\x00", 1, vertices, 0.0, float(fps), frames))
        for frame in range(frames):
            start = frame * vertices * 3
            for vertex in range(vertices):
                base = start + vertex * 3
                stream.write(struct.pack("<3f", *three_to_blender_point(positions[base:base + 3])))


def keyframe_root(root, root_values, frames, playback_stride, frame_offset=0):
    root.rotation_mode = "QUATERNION"
    for frame in range(frames):
        start = frame * 7
        root.location = three_to_blender_point(root_values[start:start + 3])
        root.rotation_quaternion = three_to_blender_quat(root_values[start + 3:start + 7])
        timeline_frame = frame * playback_stride + frame_offset
        root.keyframe_insert("location", frame=timeline_frame)
        root.keyframe_insert("rotation_quaternion", frame=timeline_frame)
    # Blender 5 stores keyframes in layered action slots rather than exposing
    # Action.fcurves. The samples remain ordinary saved F-curves; no Python is
    # needed at playback. The runtime already supplies dense 15 fps poses.


def validate_record(record, source):
    required = ("name", "creature", "type", "positions", "indices", "material", "rootPoses")
    missing = [field for field in required if field not in record]
    if missing:
        raise ValueError(f"mesh record missing {', '.join(missing)}")
    positions = record["positions"]
    roots = record["rootPoses"]
    for key in ("path", "frameCount", "vertexCount", "components"):
        if key not in positions:
            raise ValueError(f"{record['name']}: positions missing {key}")
    if positions["components"] != 3:
        raise ValueError(f"{record['name']}: positions.components must be 3")
    if positions["frameCount"] < 2 or positions["vertexCount"] < 3:
        raise ValueError(f"{record['name']}: insufficient frames or vertices")
    if roots.get("layout") != "px,py,pz,qx,qy,qz,qw":
        raise ValueError(f"{record['name']}: rootPoses layout must be px,py,pz,qx,qy,qz,qw")
    if roots.get("space") != "world" or positions.get("space") != "local":
        raise ValueError(f"{record['name']}: positions must be local and rootPoses world")
    indices = record["indices"]
    if len(indices) < 3 or len(indices) % 3:
        raise ValueError(f"{record['name']}: indices must contain triangles")
    vertices = int(positions["vertexCount"])
    if any(not isinstance(i, int) or i < 0 or i >= vertices for i in indices):
        raise ValueError(f"{record['name']}: index out of range")
    return (read_f32(resolve(source, positions["path"]), int(positions["frameCount"]) * vertices * 3,
                     record["name"] + " positions"),
            read_f32(resolve(source, roots["path"]), int(positions["frameCount"]) * 7,
                     record["name"] + " root poses"))


def import_record(record, source, cache_dir, fps, playback_stride):
    positions, roots = validate_record(record, source)
    pos = record["positions"]
    frames, vertices = int(pos["frameCount"]), int(pos["vertexCount"])
    base = [three_to_blender_point(positions[i:i + 3]) for i in range(0, vertices * 3, 3)]
    faces = [record["indices"][i:i + 3] for i in range(0, len(record["indices"]), 3)]
    winding_repaired = False
    # Runtime vertex order must stay intact for PC2. This only reverses the
    # face winding if the closed Clione body reports inward orientation.
    if record["type"] == "clione" and record["name"].endswith("_material_0"):
        if signed_volume(base, faces) < 0.0:
            faces = [[face[0], face[2], face[1]] for face in faces]
            winding_repaired = True
    mesh = bpy.data.meshes.new(record["name"] + "_MESH")
    mesh.from_pydata(base, [], faces)
    material, material_clamped = make_material(record["material"], record["name"])
    mesh.materials.append(material)
    mesh.update()
    creature_collection = collection("JELLIES" if record["type"] == "aurelia" else "CLIONE")
    obj = bpy.data.objects.new(record["name"], mesh)
    creature_collection.objects.link(obj)
    root = bpy.data.objects.new(record["name"] + "_ROOT", None)
    collection("RIGS").objects.link(root)
    obj.parent = root
    cache_path = cache_dir / (record["name"] + ".pc2")
    write_pc2(cache_path, positions, frames, vertices, fps)
    modifier = obj.modifiers.new("Runtime_Vertex_Cache", "MESH_CACHE")
    modifier.cache_format = "PC2"
    modifier.filepath = "//" + os.path.relpath(cache_path, cache_dir.parent).replace(os.sep, "/")
    modifier.frame_start = 0
    modifier.frame_scale = 1.0
    modifier.forward_axis = 'POS_Y'
    modifier.up_axis = 'POS_Z'
    keyframe_root(root, roots, frames, playback_stride)
    obj["runtimeMesh"] = record["name"]
    obj["runtimeVertexCount"] = vertices
    obj["runtimeFrameCount"] = frames
    obj["runtimeSourcePositions"] = str(resolve(source, pos["path"]))
    root["runtimeRootPoseSource"] = str(resolve(source, record["rootPoses"]["path"]))
    return {"name": record["name"], "creature": record["creature"], "type": record["type"],
            "vertices": vertices, "frames": frames, "cache": str(cache_path),
            "positionsDtype": "float32le", "rootPosesDtype": "float32le",
            "materialClamped": material_clamped, "rootScale": [1.0, 1.0, 1.0],
            "windingRepair": winding_repaired}


def make_studio():
    debug = collection("DEBUG")
    collision = collection("COLLISION")
    collision.hide_render = True
    collision.hide_viewport = True
    bpy.ops.object.camera_add(location=(0.0, -8.0, 2.5), rotation=(math.radians(78), 0.0, 0.0))
    camera = bpy.context.object
    camera.name = "QA_Silhouette_Camera"
    camera.data.clip_start = 0.001
    link_only(camera, debug)
    bpy.context.scene.camera = camera
    # Point the camera at the approximate asset origin.
    target = bpy.data.objects.new("QA_Camera_Target", None)
    debug.objects.link(target)
    constraint = camera.constraints.new("TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    for location, energy, size in (((4, -4, 7), 650, 5), ((-4, -2, 4), 350, 4)):
        data = bpy.data.lights.new("QA_Natural_Area", "AREA")
        data.energy, data.shape, data.size = energy, "DISK", size
        lamp = bpy.data.objects.new("QA_Natural_Area", data)
        lamp.location = location
        debug.objects.link(lamp)
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.color = (0.035, 0.04, 0.05)
    bpy.context.scene.render.engine = "BLENDER_EEVEE"
    bpy.context.scene.render.resolution_x = 1024
    bpy.context.scene.render.resolution_y = 576
    bpy.context.scene.render.resolution_percentage = 100
    # Keep the standard view layer material-faithful and provide a separate
    # flat-gray view layer for the morphology/silhouette test.
    silhouette = bpy.context.scene.view_layers.get("QA_SILHOUETTE")
    if not silhouette:
        silhouette = bpy.context.scene.view_layers.new("QA_SILHOUETTE")
    gray = bpy.data.materials.new("QA_Silhouette_Gray")
    gray.diffuse_color = (0.42, 0.42, 0.42, 1.0)
    silhouette.material_override = gray


def export_preview_morph_clip(output, source, meshes, fps, playback_stride):
    """Export two seconds of actual local deformation as glTF shape-key animation."""
    preview = collection("DEBUG_GLTF_PREVIEW_2S")
    preview.hide_render = True
    # glTF omits hidden viewport objects, so leave this export-only collection
    # visible until export. It is created after the .blend save and is absent
    # from the saved biological QA master.
    preview.hide_viewport = False
    sample_count = min(31, int(fps * 2) + 1)
    bpy.ops.object.select_all(action="DESELECT")
    for record in meshes:
        positions, roots = validate_record(record, source)
        vertices = int(record["positions"]["vertexCount"])
        original = bpy.data.objects[record["name"]]
        mesh = original.data.copy()
        clip = bpy.data.objects.new(record["name"] + "_MORPH_2S", mesh)
        preview.objects.link(clip)
        clip.data.materials.clear()
        for material in original.data.materials:
            clip.data.materials.append(material)
        root = bpy.data.objects.new(record["name"] + "_MORPH_ROOT_2S", None)
        preview.objects.link(root)
        clip.parent = root
        keyframe_root(root, roots, sample_count, playback_stride)
        for sample in range(1, sample_count):
            key = clip.shape_key_add(name=f"RuntimeFrame_{sample:03d}", from_mix=False)
            start = sample * vertices * 3
            for vertex in range(vertices):
                base = start + vertex * 3
                key.data[vertex].co = three_to_blender_point(positions[base:base + 3])
            for index, block in enumerate(clip.data.shape_keys.key_blocks[1:], start=1):
                block.value = 1.0 if index == sample else 0.0
                block.keyframe_insert("value", frame=sample * playback_stride)
        root.select_set(True)
        clip.select_set(True)
        bpy.context.view_layer.objects.active = clip
    bpy.context.scene["gltfQaScope"] = "two-second sampled local deformation morph clip plus root transforms; generated from runtime input"
    bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", export_animations=True,
                              export_frame_range=True, export_apply=False, export_materials="EXPORT",
                              use_selection=True)


def pc2_midframe_validation(scene, records, playback_stride):
    """Evaluate the actual Blender Mesh Cache modifier at the 30 fps midpoint."""
    midpoint = int(scene.frame_end // 2)
    scene.frame_set(midpoint)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    measured = {}
    for species in ("aurelia", "clione"):
        record = next(item for item in records if item["type"] == species)
        obj = bpy.data.objects[record["name"]]
        evaluated = obj.evaluated_get(depsgraph)
        base = obj.data.vertices[0].co
        cached = evaluated.data.vertices[0].co
        delta = (cached - base).length
        if not math.isfinite(delta) or delta <= 1e-8:
            raise RuntimeError(f"{record['name']}: Mesh Cache had no measurable midpoint deformation")
        measured[species] = {"record": record["name"], "timelineFrame": midpoint,
                             "sourceFrame": midpoint / playback_stride, "vertex0DeltaMetres": delta}
    return measured


def render_silhouette_closeup(scene, records, species, filename):
    """Render a camera-only closeup without object-scale changes."""
    target_record = next(item for item in records if item["type"] == species)
    creature = target_record["creature"]
    objects = [bpy.data.objects[item["name"]] for item in records if item["creature"] == creature]
    midpoint = int(scene.frame_end // 2)
    scene.frame_set(midpoint)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        points.extend(evaluated.matrix_world @ vertex.co for vertex in evaluated.data.vertices)
    minimum = [min(point[i] for point in points) for i in range(3)]
    maximum = [max(point[i] for point in points) for i in range(3)]
    center = [(minimum[i] + maximum[i]) * 0.5 for i in range(3)]
    radius = max(maximum[i] - minimum[i] for i in range(3)) * 0.5
    camera = bpy.data.objects["QA_Silhouette_Camera"]
    target = bpy.data.objects["QA_Camera_Target"]
    target.location = center
    # Species are deliberately centimetre-scale. Keep a small lower bound for
    # clipping, not a one-metre staging distance that makes Clione unreadable.
    camera.location = (center[0], center[1] - max(0.08, radius * 3.2), center[2] + radius * 0.25)
    camera.scale = (1.0, 1.0, 1.0)
    prior_hidden = {obj.name: obj.hide_render for obj in scene.objects if obj.type == "MESH"}
    for obj in scene.objects:
        if obj.type == "MESH":
            obj.hide_render = obj not in objects
    primary = scene.view_layers["ViewLayer"]
    prior_material = primary.material_override
    primary.material_override = bpy.data.materials["QA_Silhouette_Gray"]
    scene.render.filepath = str(filename)
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    primary.material_override = prior_material
    for name, hidden in prior_hidden.items():
        bpy.data.objects[name].hide_render = hidden
    return {"creature": creature, "timelineFrame": midpoint, "cameraScale": list(camera.scale),
            "output": str(filename)}


def main():
    args = cli_args()
    source = args.input.resolve()
    payload = json.loads(source.read_text())
    if payload.get("schema") != SCHEMA:
        raise ValueError(f"Expected schema {SCHEMA}, got {payload.get('schema')!r}")
    if payload.get("units") != "m" or payload.get("coordinateSystem", {}).get("positionMap") != "[x,y,z]→[x,-z,y]":
        raise ValueError("Input must declare metres and source-to-Blender coordinate conversion")
    fps = int(payload.get("fps", 0))
    duration = float(payload.get("durationSeconds", 0))
    if fps not in (12, 15) or duration != 60:
        raise ValueError("This baker requires a 60-second source at 12 or 15 fps")
    expected_frames = int(fps * duration)
    meshes = payload.get("meshes", [])
    aurelia_creatures = {item.get("creature") for item in meshes if item.get("type") == "aurelia"}
    clione_creatures = {item.get("creature") for item in meshes if item.get("type") == "clione"}
    if len(aurelia_creatures) != 3 or len(clione_creatures) != 5:
        raise ValueError("Expected mesh records belonging to exactly 3 Aurelia and 5 Clione")
    if len({item.get("name") for item in meshes}) != len(meshes):
        raise ValueError("Mesh names must be unique")
    for item in meshes:
        if int(item.get("positions", {}).get("frameCount", -1)) != expected_frames:
            raise ValueError(f"{item.get('name')}: frameCount must equal fps × 60")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    make_studio()
    output = args.output.resolve()
    cache_dir = output.parent / (output.stem + "_pc2")
    playback_stride = 30 // fps
    report = [import_record(item, source, cache_dir, fps, playback_stride) for item in meshes]
    scene = bpy.context.scene
    # PC2 retains the actual 12/15 fps sample rate in its header. Blender's
    # 30 fps timeline evaluates those samples between source frames.
    scene.render.fps = 30
    scene.frame_start, scene.frame_end = 0, expected_frames * playback_stride - 1
    scene["snowCreaturesBakeSchema"] = SCHEMA
    scene["snowCreaturesCacheDirectory"] = "//" + cache_dir.name
    scene["snowCreaturesMotion"] = "12/15 fps PC2 local vertex cache interpolated at 30 fps plus sampled root transforms"
    output.parent.mkdir(parents=True, exist_ok=True)
    # Establish the .blend base path before Blender evaluates // PC2 references.
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    pc2_validation = pc2_midframe_validation(scene, meshes, playback_stride)
    preview_dir = Path.cwd() / "exports" / "snowwindow-biology-20260910" / "blender-qa"
    preview_dir.mkdir(parents=True, exist_ok=True)
    closeups = [render_silhouette_closeup(scene, meshes, "aurelia", preview_dir / "aurelia-silhouette-mid.png"),
                render_silhouette_closeup(scene, meshes, "clione", preview_dir / "clione-silhouette-mid.png")]
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    validation = {"schema": SCHEMA, "status": "PASS", "fps": fps, "durationSeconds": duration,
                  "counts": {"aurelia": len(aurelia_creatures), "clione": len(clione_creatures)}, "records": report,
                  "coordinateConversion": "[x,y,z]→[x,-z,y]", "finiteGeometry": True,
                  "stableTopology": True, "pc2Midframe": pc2_validation, "silhouetteCloseups": closeups,
                  "note": "PC2 local mesh deformation and root poses originate in runtime input."}
    validation_path = output.parent / "snow-creatures-validation.json"
    validation_path.write_text(json.dumps(validation, indent=2) + "\n")
    if args.export_gltf:
        export_preview_morph_clip(args.export_gltf.resolve(), source, meshes, fps, playback_stride)
    print(json.dumps(validation))


if __name__ == "__main__":
    main()
