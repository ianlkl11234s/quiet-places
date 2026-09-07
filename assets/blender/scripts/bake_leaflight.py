"""Bake the Leaflight room into web-friendly PBR textures without editing its source .blend.

Run this in background Blender with ``leaflight-study.blend`` loaded.  It makes a
RoomSurface only in that process, writes ``leaflight-web.blend``, and leaves the
authored study file untouched.  The following export script may run in the same
Blender invocation.
"""

from __future__ import annotations

import json
import re
import os
import sys
import time
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[3]
SOURCE_SCENE = "Leaflight_Study"
ROOM_COLLECTION = "Room"
ROOM_SURFACE = "RoomSurface"
ATLAS_SIZE = 512
TEXTURE_DIR = ROOT / "public" / "textures" / "leaflight"
WEB_BLEND = ROOT / "assets" / "blender" / "leaflight-web.blend"


def configure_metal(scene: bpy.types.Scene) -> None:
    """Require Metal GPU; baking on CPU changes both timing and acceptance scope."""
    preferences = bpy.context.preferences.addons["cycles"].preferences
    preferences.compute_device_type = "METAL"
    preferences.get_devices()
    metal = [device for device in preferences.devices if device.type == "METAL"]
    if not metal:
        raise RuntimeError("Leaflight bake requires an enabled Metal GPU; none was found")
    for device in preferences.devices:
        device.use = device.type == "METAL"
    if not all(device.use for device in metal):
        raise RuntimeError("Could not enable every Metal GPU for the Leaflight bake")
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 2
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True


def room_sources(scene: bpy.types.Scene) -> list[bpy.types.Object]:
    collection = next((c for c in scene.collection.children
                       if re.sub(r'\.\d{3}$', '', c.name) == ROOM_COLLECTION), None)
    if collection is None:
        raise RuntimeError(f"Missing room collection: {ROOM_COLLECTION}")
    sources = [obj for obj in collection.objects if obj.type == "MESH"
               and re.sub(r'\.\d{3}$', '', obj.name) != "AirVolume"]
    if len(sources) != 9:
        raise RuntimeError(f"Expected exactly 9 solid room meshes, found {len(sources)}")
    return sources


def remove_previous(scene: bpy.types.Scene) -> None:
    previous = bpy.data.objects.get(ROOM_SURFACE)
    if previous:
        bpy.data.objects.remove(previous, do_unlink=True)
    for collection in list(bpy.data.collections):
        if collection.name == "__STW_Leaflight_Baked__":
            bpy.data.collections.remove(collection)


def build_room_surface(scene: bpy.types.Scene, sources: list[bpy.types.Object]) -> bpy.types.Object:
    """Join evaluated room meshes, retaining their procedural materials while baking."""
    remove_previous(scene)
    baked_collection = bpy.data.collections.new("__STW_Leaflight_Baked__")
    scene.collection.children.link(baked_collection)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    copies: list[bpy.types.Object] = []
    for source in sources:
        mesh = bpy.data.meshes.new_from_object(source.evaluated_get(depsgraph), depsgraph=depsgraph)
        copy = bpy.data.objects.new(f"__bake_{source.name}", mesh)
        copy.matrix_world = source.matrix_world.copy()
        baked_collection.objects.link(copy)
        # new_from_object keeps material indexes, but source slots are the authoritative order.
        mesh.materials.clear()
        for slot in source.material_slots:
            mesh.materials.append(slot.material)
        copies.append(copy)
    bpy.ops.object.select_all(action="DESELECT")
    for copy in copies:
        copy.select_set(True)
    bpy.context.view_layer.objects.active = copies[0]
    bpy.ops.object.join()
    room = bpy.context.object
    room.name = ROOM_SURFACE
    room.data.name = ROOM_SURFACE
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(island_margin=0.03)
    bpy.ops.object.mode_set(mode="OBJECT")
    uv = room.data.uv_layers.active
    if uv is None:
        raise RuntimeError("Smart UV projection did not create UV0")
    uv.name = "UV0"
    for source in sources:
        source.hide_render = True
        source.hide_set(True)
    air = next((o for o in scene.objects if re.sub(r'\.\d{3}$', '', o.name) == 'AirVolume'), None)
    if air:
        air.hide_render = True
        air.hide_set(True)
    room["leaflight_role"] = "baked-room-surface"
    room["lightmap_uv"] = "UV0"
    room["lightmap_no_direct"] = True
    return room


def image(name: str, *, colorspace: str, extension: str) -> bpy.types.Image:
    existing = bpy.data.images.get(name)
    if existing:
        bpy.data.images.remove(existing)
    result = bpy.data.images.new(name, width=ATLAS_SIZE, height=ATLAS_SIZE, alpha=False, float_buffer=extension == "exr")
    try:
        result.colorspace_settings.name = colorspace
    except TypeError:
        # Blender builds can expose the linear role under a shorter OCIO label.
        if colorspace != "Linear Rec.709":
            raise
        result.colorspace_settings.name = "Linear"
    return result


def activate_target(room: bpy.types.Object, target: bpy.types.Image) -> None:
    """Cycles writes to the active Image Texture node in every material slot."""
    for material in room.data.materials:
        if material is None:
            continue
        material.use_nodes = True
        nodes = material.node_tree.nodes
        node = nodes.get("__STW_BakeTarget") or nodes.new("ShaderNodeTexImage")
        node.name = "__STW_BakeTarget"
        node.label = "active bake target (script-owned)"
        node.image = target
        for candidate in nodes:
            candidate.select = False
        node.select = True
        nodes.active = node


def bake(
    room: bpy.types.Object,
    target: bpy.types.Image,
    bake_type: str,
    pass_filter: set[str] | None = None,
    *,
    samples: int = 16,
) -> None:
    activate_target(room, target)
    bpy.ops.object.select_all(action="DESELECT")
    room.select_set(True)
    bpy.context.view_layer.objects.active = room
    settings = bpy.context.scene.render.bake
    bpy.context.scene.cycles.samples = samples
    settings.margin = 8
    settings.use_clear = True
    if bake_type == "NORMAL":
        settings.normal_space = "TANGENT"
    kwargs = {"type": bake_type}
    if pass_filter is not None:
        kwargs["pass_filter"] = pass_filter
    bpy.ops.object.bake(**kwargs)


def denoise_indirect_with_compositor(indirect: bpy.types.Image) -> Path:
    """Write a raw-linear denoised EXR with an isolated compositor scene.

    The compositor only sees the baked Image input. Its throwaway 1px workbench
    render exists to evaluate that graph and never changes the study scene.
    """
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    output = TEXTURE_DIR / "room-indirect.exr"
    temporary_prefix = ".__st_room-indirect"
    for stale in TEXTURE_DIR.glob(f"{temporary_prefix}*.exr"):
        stale.unlink()
    scene = bpy.data.scenes.new("__STW_Leaflight_Denoise__")
    camera_data = bpy.data.cameras.new("__STW_Leaflight_Denoise_Camera__")
    camera = bpy.data.objects.new("__STW_Leaflight_Denoise_Camera__", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 2
    scene.render.resolution_x = scene.render.resolution_y = 1
    scene.render.resolution_percentage = 100
    compositor = bpy.data.node_groups.new('__STW_Leaflight_Denoise_Nodes__', 'CompositorNodeTree')
    scene.compositing_node_group = compositor
    nodes, links = compositor.nodes, compositor.links
    image_node = nodes.new("CompositorNodeImage")
    image_node.image = indirect
    denoise = nodes.new("CompositorNodeDenoise")
    output_node = nodes.new("CompositorNodeOutputFile")
    output_node.directory = str(TEXTURE_DIR)
    output_node.file_name = temporary_prefix
    output_node.format.media_type = 'IMAGE'
    output_node.format.file_format = 'OPEN_EXR'
    output_node.format.color_mode = 'RGB'
    output_node.format.color_depth = '16'
    file_item = output_node.file_output_items.new('RGBA', 'Image')
    file_item.override_node_format = False
    file_item.save_as_render = False
    links.new(image_node.outputs["Image"], denoise.inputs["Image"])
    links.new(denoise.outputs["Image"], output_node.inputs[0])
    previous_scene = bpy.context.window.scene if bpy.context.window else None
    try:
        if bpy.context.window:
            bpy.context.window.scene = scene
        bpy.ops.render.render(write_still=False)
        generated = sorted(TEXTURE_DIR.glob(f"{temporary_prefix}*.exr"))
        if len(generated) != 1:
            raise RuntimeError(f"Expected one compositor EXR, found {len(generated)}")
        generated[0].replace(output)
        indirect.filepath = bpy.path.relpath(str(output))
        indirect.reload()
        indirect.pack()
        return output
    finally:
        if previous_scene is not None and bpy.context.window:
            bpy.context.window.scene = previous_scene
        bpy.data.objects.remove(camera, do_unlink=True)
        bpy.data.cameras.remove(camera_data)
        bpy.data.scenes.remove(scene)
        bpy.data.node_groups.remove(compositor)


def save_image(target: bpy.types.Image, filename: str, *, format: str) -> Path:
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    output = (ROOT / "assets" / "blender" / "cache" if filename.endswith("-raw.exr") else TEXTURE_DIR) / filename
    output.parent.mkdir(parents=True, exist_ok=True)
    target.filepath_raw = str(output)
    target.file_format = "OPEN_EXR" if format == "EXR" else "PNG"
    target.save()
    return output


def run_denoise_only() -> dict:
    """Rebuild final indirect EXR from its raw checkpoint without a Cycles bake."""
    raw = ROOT / "assets" / "blender" / "cache" / "room-indirect-raw.exr"
    if not raw.is_file():
        raise RuntimeError(f"Missing indirect checkpoint: {raw}")
    indirect = bpy.data.images.load(str(raw), check_existing=False)
    try:
        indirect.colorspace_settings.name = "Linear Rec.709"
    except TypeError:
        indirect.colorspace_settings.name = "Linear"
    output = denoise_indirect_with_compositor(indirect)
    material = bpy.data.materials.get("RoomSurface_Baked")
    if material and material.use_nodes:
        node = material.node_tree.nodes.get("RoomSurface_Indirect")
        if node:
            node.image = indirect
    return {"denoiseOnly": True, "raw": str(raw), "indirect": str(output)}


def export_material(room: bpy.types.Object, albedo: bpy.types.Image, normal: bpy.types.Image, roughness: bpy.types.Image, indirect: bpy.types.Image) -> None:
    material = bpy.data.materials.get("RoomSurface_Baked") or bpy.data.materials.new("RoomSurface_Baked")
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.name = "RoomSurface Principled"
    albedo_node = nodes.new("ShaderNodeTexImage")
    albedo_node.name, albedo_node.label, albedo_node.image = "RoomSurface_Albedo", "albedo", albedo
    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.name, normal_node.label, normal_node.image = "RoomSurface_Normal", "normal tangent", normal
    normal_map = nodes.new("ShaderNodeNormalMap")
    roughness_node = nodes.new("ShaderNodeTexImage")
    roughness_node.name, roughness_node.label, roughness_node.image = "RoomSurface_Roughness", "roughness", roughness
    # Keep the EXR image and URI on the exported material. glTF has no standard
    # lightmap slot for EXR, so the runtime reads the URI/intensity from extras.
    indirect_node = nodes.new("ShaderNodeTexImage")
    indirect_node.name, indirect_node.label, indirect_node.image = "RoomSurface_Indirect", "indirect lightmap (external EXR)", indirect
    links.new(albedo_node.outputs["Color"], principled.inputs["Base Color"])
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])
    links.new(roughness_node.outputs["Color"], principled.inputs["Roughness"])
    links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    material["lightmap_uri"] = "/textures/leaflight/room-indirect.exr"
    material["lightmap_uv"] = "UV0"
    material["lightmap_intensity"] = 0.65
    material["lightmap_contains_direct"] = False
    for polygon in room.data.polygons:
        polygon.material_index = 0
    room.data.materials.clear()
    room.data.materials.append(material)


def run() -> dict:
    if "--denoise-only" in sys.argv:
        return run_denoise_only()
    started = time.monotonic()
    scene = bpy.data.scenes.get(SOURCE_SCENE)
    if scene is None:
        raise RuntimeError(f"Missing source scene: {SOURCE_SCENE}")
    if bpy.context.window:
        bpy.context.window.scene = scene
    configure_metal(scene)
    room = build_room_surface(scene, room_sources(scene))
    albedo = image("RoomSurface_Albedo", colorspace="sRGB", extension="png")
    normal = image("RoomSurface_Normal", colorspace="Non-Color", extension="png")
    roughness = image("RoomSurface_Roughness", colorspace="Non-Color", extension="png")
    indirect = image("RoomSurface_Indirect", colorspace="Linear Rec.709", extension="exr")
    bake(room, albedo, "DIFFUSE", {"COLOR"}, samples=16)
    bake(room, normal, "NORMAL", samples=16)
    bake(room, roughness, "ROUGHNESS", samples=16)
    bake(room, indirect, "DIFFUSE", {"INDIRECT"}, samples=128)
    raw_indirect = save_image(indirect, "room-indirect-raw.exr", format="EXR")
    outputs = {
        "albedo": str(save_image(albedo, "room-albedo.png", format="PNG")),
        "normal": str(save_image(normal, "room-normal.png", format="PNG")),
        "roughness": str(save_image(roughness, "room-roughness.png", format="PNG")),
        "indirect": str(denoise_indirect_with_compositor(indirect)),
        "indirectRaw": str(raw_indirect),
    }
    export_material(room, albedo, normal, roughness, indirect)
    metadata_path = TEXTURE_DIR / "room-indirect.json"
    metadata_path.write_text(json.dumps({
        "mesh": ROOM_SURFACE, "uv": "UV0", "texture": "/textures/leaflight/room-indirect.exr",
        "lightmapIntensity": 0.65, "containsDirect": False,
        "calibration": "Tune lightmapIntensity in the web renderer; this map contains diffuse indirect only.",
    }, indent=2) + "\n", encoding="utf-8")
    for texture in (albedo, normal, roughness, indirect):
        absolute = Path(bpy.path.abspath(texture.filepath))
        texture.filepath = '//' + os.path.relpath(absolute, WEB_BLEND.parent)
        texture.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(WEB_BLEND))
    return {"seconds": round(time.monotonic() - started, 2), "webBlend": str(WEB_BLEND), "textures": outputs, "metadata": str(metadata_path)}


if __name__ == "__main__":
    print(json.dumps(run(), separators=(",", ":")))
