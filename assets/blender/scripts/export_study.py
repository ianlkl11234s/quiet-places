"""Export Leaflight_Study as a geometry-and-shadow GLB review artifact.

This deliberately does not reproduce Blender's procedural stone or translucent
leaf shading.  It copies evaluated geometry and a small Principled material
subset only, so the web review can isolate composition, geometry and shadows.
"""

from __future__ import annotations

import json
import re
import struct
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[3]
SOURCE_SCENE = "Leaflight_Study"
EXPORT_SCENE = "__STW_Leaflight_GLTF_Export__"
EXCLUDED_NAMES = {"AirVolume", "originalScene"}


def canonical_name(name: str) -> str:
    """Strip Blender's numeric duplicate suffix for stable exported node names."""
    return re.sub(r"\.\d{3}$", "", name)


def three_vector(vector: tuple[float, float, float]) -> list[float]:
    """Convert Blender X/Y/Z (Z-up) to Three X/Y/Z (Y-up)."""
    x, y, z = vector
    return [x, z, -y]


def simple_material(source: bpy.types.Material | None, created: list[bpy.types.Material]) -> bpy.types.Material | None:
    """Make a new Principled-only material without mutating the authored source."""
    if source is None:
        return None
    material = bpy.data.materials.new(canonical_name(source.name))
    created.append(material)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    source_principled = next((node for node in source.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None) if source.use_nodes else None
    if source_principled:
        base_color = source_principled.inputs.get("Base Color")
        roughness = source_principled.inputs.get("Roughness")
        if base_color is not None:
            principled.inputs["Base Color"].default_value = base_color.default_value[:]
        if roughness is not None:
            principled.inputs["Roughness"].default_value = roughness.default_value
    material.node_tree.links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    if source.use_nodes and any(node.type == "BSDF_TRANSLUCENT" for node in source.node_tree.nodes):
        # The review material omits transmission, but keeps foliage visible from both sides.
        material.use_backface_culling = False
        material["review_double_sided"] = True
    material["export_note"] = "geometry-shadow review only; procedural stone and translucent shading are not converted"
    return material


def exportable(source: bpy.types.Object) -> bool:
    return canonical_name(source.name) not in EXCLUDED_NAMES and source.type in {"MESH", "CURVE"}


def copy_evaluated_object(
    source: bpy.types.Object,
    collection: bpy.types.Collection,
    depsgraph: bpy.types.Depsgraph,
    material_cache: dict[bpy.types.Material, bpy.types.Material],
    created_meshes: list[bpy.types.Mesh],
    created_materials: list[bpy.types.Material],
    created_objects: list[bpy.types.Object],
) -> None:
    evaluated = source.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
    mesh.name = canonical_name(source.name)
    created_meshes.append(mesh)
    object_copy = bpy.data.objects.new(canonical_name(source.name), mesh)
    object_copy.matrix_world = source.matrix_world.copy()
    collection.objects.link(object_copy)
    created_objects.append(object_copy)
    mesh.materials.clear()
    for slot in source.material_slots:
        if slot.material is None:
            continue
        if slot.material not in material_cache:
            material_cache[slot.material] = simple_material(slot.material, created_materials)
        material = material_cache[slot.material]
        if material is not None:
            mesh.materials.append(material)


def copy_camera(
    source: bpy.types.Object,
    collection: bpy.types.Collection,
    created_cameras: list[bpy.types.Camera],
    created_objects: list[bpy.types.Object],
) -> bpy.types.Object:
    data_copy = source.data.copy()
    data_copy.name = canonical_name(source.data.name)
    created_cameras.append(data_copy)
    camera_copy = bpy.data.objects.new(canonical_name(source.name), data_copy)
    camera_copy.matrix_world = source.matrix_world.copy()
    collection.objects.link(camera_copy)
    created_objects.append(camera_copy)
    return camera_copy


def cleanup(
    scene: bpy.types.Scene,
    collection: bpy.types.Collection,
    objects: list[bpy.types.Object],
    meshes: list[bpy.types.Mesh],
    cameras: list[bpy.types.Camera],
    materials: list[bpy.types.Material],
) -> None:
    for obj in objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in meshes:
        bpy.data.meshes.remove(mesh)
    for camera in cameras:
        bpy.data.cameras.remove(camera)
    for material in materials:
        bpy.data.materials.remove(material)
    bpy.data.scenes.remove(scene)
    bpy.data.collections.remove(collection)


def run() -> dict:
    source_scene = bpy.data.scenes.get(SOURCE_SCENE)
    if source_scene is None:
        raise RuntimeError(f"Missing source scene: {SOURCE_SCENE}")
    if bpy.data.scenes.get(EXPORT_SCENE):
        raise RuntimeError(f"Temporary export scene already exists: {EXPORT_SCENE}")

    previous_scene = bpy.context.window.scene if bpy.context.window else None
    export_scene = bpy.data.scenes.new(EXPORT_SCENE)
    collection = bpy.data.collections.new("Leaflight_Study_Export")
    export_scene.collection.children.link(collection)
    created_objects: list[bpy.types.Object] = []
    created_meshes: list[bpy.types.Mesh] = []
    created_cameras: list[bpy.types.Camera] = []
    created_materials: list[bpy.types.Material] = []
    material_cache: dict[bpy.types.Material, bpy.types.Material] = {}

    output = ROOT / "public/models/leaflight-study.glb"
    metadata_output = ROOT / "public/models/leaflight-study.metadata.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        if bpy.context.window:
            bpy.context.window.scene = source_scene
        depsgraph = bpy.context.evaluated_depsgraph_get()
        for source in source_scene.objects:
            if exportable(source):
                copy_evaluated_object(source, collection, depsgraph, material_cache, created_meshes, created_materials, created_objects)

        source_camera = source_scene.camera
        if source_camera is None:
            raise RuntimeError(f"{SOURCE_SCENE} has no active camera")
        export_scene.camera = copy_camera(source_camera, collection, created_cameras, created_objects)
        export_scene.render.resolution_x = source_scene.render.resolution_x
        export_scene.render.resolution_y = source_scene.render.resolution_y
        export_scene["artifact_phase"] = "geometry-only"
        export_scene["material_limitations"] = "Procedural stone and translucent shading are intentionally not converted."

        if bpy.context.window:
            bpy.context.window.scene = export_scene
        bpy.ops.export_scene.gltf(
            filepath=str(output),
            export_format="GLB",
            use_active_scene=True,
            export_cameras=True,
            export_extras=True,
            use_selection=False,
            export_apply=False,
        )
        # Blender enforces globally unique datablock names while source and copy
        # coexist. Canonicalise exported node names without renaming source data.
        data = output.read_bytes()
        json_size = struct.unpack_from('<I', data, 12)[0]
        manifest = json.loads(data[20:20+json_size])
        for node in manifest.get('nodes', []):
            if 'name' in node:
                node['name'] = canonical_name(node['name'])
        payload = json.dumps(manifest, separators=(',', ':')).encode()
        payload += b' ' * (-len(payload) % 4)
        binary = data[20+json_size:]
        output.write_bytes(struct.pack('<4sII', b'glTF', 2, 20+len(payload)+len(binary))
                           + struct.pack('<I4s', len(payload), b'JSON') + payload + binary)
        camera_target = tuple(source_scene.get("camera_target", (0.0, 0.0, 0.0)))
        metadata = {
            "artifactPhase": "geometry-only",
            "cameraTargetThree": three_vector(camera_target),
            "sun": {
                "directionBlender": [-1.0, 0.45, -0.85],
                "directionThree": three_vector((-1.0, 0.45, -0.85)),
                "intensity": 20.0,
                "colorLinear": [1.0, 0.75, 0.45],
            },
            "exposureEV": 0.8,
            "limitations": [
                "Procedural stone is not converted.",
                "Translucent leaf shading is not converted.",
                "This artifact is for geometry and shadow comparison, not complete PBR acceptance.",
            ],
        }
        metadata_output.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
        return {"glb": str(output), "metadata": str(metadata_output), "objects": len(created_objects)}
    finally:
        if previous_scene is not None:
            bpy.context.window.scene = previous_scene
        cleanup(export_scene, collection, created_objects, created_meshes, created_cameras, created_materials)


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
