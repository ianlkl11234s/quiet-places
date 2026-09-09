"""Export the Stairlight study as a web-ready GLB without altering its source scene."""

from __future__ import annotations

import hashlib
import json
import re
import struct
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[3]
SOURCE_SCENE = "Stairlight_Study"
EXPORT_SCENE = "__STW_Stairlight_GLTF_Export__"
EXPORT_COLLECTION = "Stairlight_Study_Export"
CAMERA_NAME = "Camera_Hero"
OUTPUT = ROOT / "public/models/stairlight.glb"
METADATA_OUTPUT = ROOT / "public/models/stairlight.metadata.json"


def canonical_name(name: str) -> str:
    """Strip Blender's duplicate suffix from names created in the export scene."""
    return re.sub(r"\.\d{3}$", "", name)


def exportable(source: bpy.types.Object) -> bool:
    """Keep visible geometry only; lights and explicit web blockers never leave Blender."""
    return (
        source.type in {"MESH", "CURVE"}
        and not source.hide_render
        and not source.hide_get()
        and bool(source.get("export_web", True))
    )


def fallback_material(
    source: bpy.types.Material | None,
    created: list[bpy.types.Material],
) -> bpy.types.Material | None:
    """Copy simple Principled values while deliberately omitting procedural node graphs."""
    if source is None:
        return None

    material = bpy.data.materials.new(f"{canonical_name(source.name)}_WebFallback")
    created.append(material)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    material.node_tree.links.new(principled.outputs["BSDF"], output.inputs["Surface"])

    if source.use_nodes:
        source_principled = next(
            (node for node in source.node_tree.nodes if node.type == "BSDF_PRINCIPLED"),
            None,
        )
        if source_principled is not None:
            for name in ("Base Color", "Roughness", "Metallic", "Alpha"):
                source_input = source_principled.inputs.get(name)
                target_input = principled.inputs.get(name)
                if source_input is not None and target_input is not None:
                    value = source_input.default_value
                    target_input.default_value = value[:] if hasattr(value, "__len__") else value

    material["export_note"] = (
        "Basic Principled fallback only; source procedural materials are not baked in this export."
    )
    return material


def copy_evaluated_mesh(
    source: bpy.types.Object,
    collection: bpy.types.Collection,
    depsgraph: bpy.types.Depsgraph,
    material_cache: dict[bpy.types.Material, bpy.types.Material],
    created_objects: list[bpy.types.Object],
    created_meshes: list[bpy.types.Mesh],
    created_materials: list[bpy.types.Material],
) -> int:
    """Bake modifiers into a disposable mesh and retain its world transform."""
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
        material = slot.material
        if material is None:
            continue
        if material not in material_cache:
            fallback = fallback_material(material, created_materials)
            if fallback is not None:
                material_cache[material] = fallback
        mesh.materials.append(material_cache[material])

    return sum(len(polygon.vertices) - 2 for polygon in mesh.polygons)


def copy_camera(
    source: bpy.types.Object,
    collection: bpy.types.Collection,
    created_objects: list[bpy.types.Object],
    created_cameras: list[bpy.types.Camera],
) -> bpy.types.Object:
    data_copy = source.data.copy()
    data_copy.name = CAMERA_NAME
    created_cameras.append(data_copy)
    camera_copy = bpy.data.objects.new(CAMERA_NAME, data_copy)
    camera_copy.matrix_world = source.matrix_world.copy()
    collection.objects.link(camera_copy)
    created_objects.append(camera_copy)
    return camera_copy


def canonicalize_node_names(output: Path) -> int:
    """Remove temporary datablock suffixes without renaming authored source data."""
    data = output.read_bytes()
    json_size = struct.unpack_from("<I", data, 12)[0]
    manifest = json.loads(data[20 : 20 + json_size])
    for node in manifest.get("nodes", []):
        if "name" in node:
            node["name"] = canonical_name(node["name"])
    payload = json.dumps(manifest, separators=(",", ":")).encode()
    payload += b" " * (-len(payload) % 4)
    binary = data[20 + json_size :]
    output.write_bytes(
        struct.pack("<4sII", b"glTF", 2, 20 + len(payload) + len(binary))
        + struct.pack("<I4s", len(payload), b"JSON")
        + payload
        + binary
    )
    return len(manifest.get("nodes", []))


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
    source_camera = source_scene.objects.get(CAMERA_NAME)
    if source_camera is None or source_camera.type != "CAMERA":
        raise RuntimeError(f"Missing hero camera: {CAMERA_NAME}")

    previous_scene = bpy.context.window.scene if bpy.context.window else None
    export_scene = bpy.data.scenes.new(EXPORT_SCENE)
    collection = bpy.data.collections.new(EXPORT_COLLECTION)
    export_scene.collection.children.link(collection)
    created_objects: list[bpy.types.Object] = []
    created_meshes: list[bpy.types.Mesh] = []
    created_cameras: list[bpy.types.Camera] = []
    created_materials: list[bpy.types.Material] = []
    material_cache: dict[bpy.types.Material, bpy.types.Material] = {}
    triangles = 0

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    try:
        if bpy.context.window:
            bpy.context.window.scene = source_scene
        depsgraph = bpy.context.evaluated_depsgraph_get()
        for source in source_scene.objects:
            if exportable(source):
                triangles += copy_evaluated_mesh(
                    source,
                    collection,
                    depsgraph,
                    material_cache,
                    created_objects,
                    created_meshes,
                    created_materials,
                )

        export_scene.camera = copy_camera(
            source_camera, collection, created_objects, created_cameras
        )
        export_scene.render.resolution_x = source_scene.render.resolution_x
        export_scene.render.resolution_y = source_scene.render.resolution_y
        export_scene["artifact_phase"] = "p0-p1-basic-materials"
        export_scene["procedural_materials_baked"] = False

        if bpy.context.window:
            bpy.context.window.scene = export_scene
        bpy.ops.export_scene.gltf(
            filepath=str(OUTPUT),
            export_format="GLB",
            use_active_scene=True,
            export_cameras=True,
            export_extras=True,
            export_apply=False,
        )
        nodes = canonicalize_node_names(OUTPUT)
        bytes_written = OUTPUT.stat().st_size
        metadata = {
            "artifactPhase": "p0-p1-basic-materials",
            "sourceScene": SOURCE_SCENE,
            "glb": OUTPUT.name,
            "triangles": triangles,
            "nodes": nodes,
            "bytes": bytes_written,
            "sha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
            "camera": {
                "name": CAMERA_NAME,
                "matrixWorldBlender": [
                    list(row) for row in source_camera.matrix_world
                ],
                "lensMm": source_camera.data.lens,
                "sensorWidthMm": source_camera.data.sensor_width,
                "sensorHeightMm": source_camera.data.sensor_height,
                "sensorFit": source_camera.data.sensor_fit,
                "targetBlender": list(source_scene.get("camera_target", [])),
            },
            "materials": {
                "mode": "basic-principled-fallback",
                "proceduralMaterialsBaked": False,
                "note": "Source procedural material inputs are not baked; this GLB preserves only base Principled fallback values.",
            },
            "limitations": [
                "Camera-invisible light blockers marked export_web=false are excluded.",
                "Website lighting and shadowing have not been rebuilt for this P0/P1 geometry export.",
            ],
        }
        METADATA_OUTPUT.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
        return {"glb": str(OUTPUT), "metadata": str(METADATA_OUTPUT), **metadata}
    finally:
        if previous_scene is not None:
            bpy.context.window.scene = previous_scene
        cleanup(
            export_scene,
            collection,
            created_objects,
            created_meshes,
            created_cameras,
            created_materials,
        )


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
