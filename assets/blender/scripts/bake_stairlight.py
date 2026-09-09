"""Bake Stairlight into an export-ready surface without modifying its study file.

Run with ``stairlight-study.blend`` loaded in a background Blender process.  The
script evaluates every visible, web-exportable mesh or curve into one world-space
mesh, bakes PBR and indirect-light textures, saves ``stairlight-web.blend``, then
exports only that mesh and ``Camera_Hero`` as the website GLB.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import time

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[3]
SOURCE_SCENE = "Stairlight_Study"
SURFACE_NAME = "StairlightSurface"
BAKED_COLLECTION = "__STW_Stairlight_Baked__"
CAMERA_NAME = "Camera_Hero"
LAYOUT = bpy.data.scenes[SOURCE_SCENE].get("window_layout", "side")
ASSET = "stairlight-rear" if LAYOUT == "rear" else "stairlight"
TEXTURE_DIR = ROOT / "public" / "textures" / ASSET
WEB_BLEND = ROOT / "assets" / "blender" / f"{ASSET}-web.blend"
GLB_OUTPUT = ROOT / "public" / "models" / f"{ASSET}.glb"
METADATA_OUTPUT = ROOT / "public" / "models" / f"{ASSET}.metadata.json"
PBR_ATLAS_SIZE = 4096
INDIRECT_ATLAS_SIZE = 2048
PBR_SAMPLES = 64
INDIRECT_SAMPLES = 64


def load_leaflight_helpers():
    """Load shared bake helpers without running Leaflight's bake entry point."""
    path = Path(__file__).with_name("bake_leaflight.py")
    spec = importlib.util.spec_from_file_location("_stairlight_leaflight_helpers", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load shared bake helpers: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    # The helpers own their output paths through module globals.  Override these
    # before every helper that creates an image or writes a file.
    module.ROOT = ROOT
    module.TEXTURE_DIR = TEXTURE_DIR
    module.WEB_BLEND = WEB_BLEND
    return module


def exportable_sources(scene: bpy.types.Scene) -> list[bpy.types.Object]:
    sources = [
        obj for obj in scene.objects
        if obj.type in {"MESH", "CURVE"}
        and not obj.hide_render
        and not obj.hide_get()
        and bool(obj.get("export_web", True))
    ]
    if not sources:
        raise RuntimeError("Stairlight has no visible, exportable MESH/CURVE objects")
    return sources


def clear_previous(scene: bpy.types.Scene) -> None:
    for obj in list(bpy.data.objects):
        if obj.name == SURFACE_NAME:
            bpy.data.objects.remove(obj, do_unlink=True)
    for collection in list(bpy.data.collections):
        if collection.name == BAKED_COLLECTION:
            bpy.data.collections.remove(collection)


def copied_material(
    source: bpy.types.Material | None,
    cache: dict[bpy.types.Material, bpy.types.Material],
) -> bpy.types.Material | None:
    """Make script-owned material copies, so bake-target nodes never touch source."""
    if source is None:
        return None
    if source not in cache:
        result = source.copy()
        result.name = f"__STW_Bake_{source.name}"
        result["stairlight_bake_copy"] = True
        cache[source] = result
    return cache[source]


def build_surface(scene: bpy.types.Scene, sources: list[bpy.types.Object]) -> tuple[bpy.types.Object, int, int]:
    """Evaluate source geometry into a single identity-transform, world-space mesh."""
    clear_previous(scene)
    collection = bpy.data.collections.new(BAKED_COLLECTION)
    scene.collection.children.link(collection)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    material_cache: dict[bpy.types.Material, bpy.types.Material] = {}
    copies: list[bpy.types.Object] = []
    source_triangles = 0

    for source in sources:
        evaluated = source.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
        # Bake the evaluated transform into vertex coordinates.  This preserves
        # geometry normals and produces one mesh in Blender world coordinates.
        mesh.transform(source.matrix_world)
        mesh.update()
        source_triangles += sum(len(poly.vertices) - 2 for poly in mesh.polygons)
        mesh.materials.clear()
        for slot in source.material_slots:
            material = copied_material(slot.material, material_cache)
            if material is not None:
                mesh.materials.append(material)
        copy = bpy.data.objects.new(f"__stairlight_bake_{source.name}", mesh)
        collection.objects.link(copy)
        copies.append(copy)

    bpy.ops.object.select_all(action="DESELECT")
    for copy in copies:
        copy.select_set(True)
    bpy.context.view_layer.objects.active = copies[0]
    bpy.ops.object.join()
    surface = bpy.context.object
    surface.name = SURFACE_NAME
    surface.data.name = SURFACE_NAME
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    # Sweep sections must face outward before Cycles bakes irradiance.
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.uv.smart_project(island_margin=0.002)
    bpy.ops.object.mode_set(mode="OBJECT")
    uv = surface.data.uv_layers.active
    if uv is None:
        raise RuntimeError("Smart UV projection did not create Stairlight UV0")
    uv.name = "UV0"
    # Make UV0 unambiguous to both Cycles and the glTF exporter.  Small handrail
    # and hatch-frame islands need the compact packing above to receive texels.
    surface.data.uv_layers.active_index = 0
    for layer in surface.data.uv_layers:
        layer.active_render = layer == surface.data.uv_layers[0]
    for source in sources:
        source.hide_render = True
        source.hide_set(True)
    surface["lightmap_uv"] = "UV0"
    surface["lightmap_contains_direct"] = False
    surface["source_geometry"] = "evaluated visible exportable MESH/CURVE in world coordinates"
    return surface, source_triangles, len(material_cache)


def export_material(
    surface: bpy.types.Object,
    albedo: bpy.types.Image,
    normal: bpy.types.Image,
    roughness: bpy.types.Image,
    indirect: bpy.types.Image,
) -> bpy.types.Material:
    material = bpy.data.materials.get("StairlightSurface_Baked") or bpy.data.materials.new("StairlightSurface_Baked")
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    albedo_node = nodes.new("ShaderNodeTexImage")
    albedo_node.name, albedo_node.label, albedo_node.image = "Stairlight_Albedo", "PBR albedo", albedo
    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.name, normal_node.label, normal_node.image = "Stairlight_Normal", "PBR tangent normal", normal
    normal_map = nodes.new("ShaderNodeNormalMap")
    roughness_node = nodes.new("ShaderNodeTexImage")
    roughness_node.name, roughness_node.label, roughness_node.image = "Stairlight_Roughness", "PBR roughness", roughness
    # Kept unconnected because glTF has no standard external EXR lightmap slot;
    # the URI below is consumed by the website runtime, while PBR maps embed in GLB.
    indirect_node = nodes.new("ShaderNodeTexImage")
    indirect_node.name, indirect_node.label, indirect_node.image = "Stairlight_Indirect", "external diffuse indirect EXR", indirect
    links.new(albedo_node.outputs["Color"], principled.inputs["Base Color"])
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])
    links.new(roughness_node.outputs["Color"], principled.inputs["Roughness"])
    links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    material["lightmap_uri"] = f"/textures/{ASSET}/room-indirect.exr"
    material["lightmap_uv"] = "UV0"
    material["lightmap_contains_direct"] = False
    material["lightmap_intensity"] = 1.0
    for polygon in surface.data.polygons:
        polygon.material_index = 0
    surface.data.materials.clear()
    surface.data.materials.append(material)
    return material


def make_external(image: bpy.types.Image, absolute_path: Path) -> None:
    """Keep the EXR beside the GLB rather than packing it into the web blend."""
    image.filepath = "//" + os.path.relpath(absolute_path, WEB_BLEND.parent)
    if image.packed_file:
        image.unpack(method="USE_ORIGINAL")


def bake_with_margin(
    helpers,
    surface: bpy.types.Object,
    target: bpy.types.Image,
    bake_type: str,
    pass_filter: set[str] | None = None,
    *,
    samples: int,
) -> None:
    """Use shared target setup while giving Stairlight's 4K atlas a 16px gutter."""
    helpers.activate_target(surface, target)
    bpy.ops.object.select_all(action="DESELECT")
    surface.select_set(True)
    bpy.context.view_layer.objects.active = surface
    settings = bpy.context.scene.render.bake
    bpy.context.scene.cycles.samples = samples
    settings.margin = 16
    settings.use_clear = True
    if bake_type == "NORMAL":
        settings.normal_space = "TANGENT"
    kwargs = {"type": bake_type}
    if pass_filter is not None:
        kwargs["pass_filter"] = pass_filter
    bpy.ops.object.bake(**kwargs)


def export_glb(surface: bpy.types.Object, camera: bpy.types.Object) -> tuple[int, str]:
    GLB_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    surface.select_set(True)
    camera.select_set(True)
    bpy.context.view_layer.objects.active = surface
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_OUTPUT),
        export_format="GLB",
        use_selection=True,
        export_cameras=True,
        export_extras=True,
        export_apply=False,
    )
    triangles = sum(len(poly.vertices) - 2 for poly in surface.data.polygons)
    return triangles, hashlib.sha256(GLB_OUTPUT.read_bytes()).hexdigest()


def run() -> dict:
    started = time.monotonic()
    scene = bpy.data.scenes.get(SOURCE_SCENE)
    if scene is None:
        raise RuntimeError(f"Missing source scene: {SOURCE_SCENE}")
    camera = scene.objects.get(CAMERA_NAME)
    if camera is None or camera.type != "CAMERA":
        raise RuntimeError(f"Missing hero camera: {CAMERA_NAME}")
    if bpy.context.window:
        bpy.context.window.scene = scene

    helpers = load_leaflight_helpers()
    helpers.configure_metal(scene)
    sources = exportable_sources(scene)
    surface, source_triangles, source_materials = build_surface(scene, sources)

    helpers.ATLAS_SIZE = PBR_ATLAS_SIZE
    albedo = helpers.image("StairlightSurface_Albedo", colorspace="sRGB", extension="png")
    normal = helpers.image("StairlightSurface_Normal", colorspace="Non-Color", extension="png")
    roughness = helpers.image("StairlightSurface_Roughness", colorspace="Non-Color", extension="png")
    bake_with_margin(helpers, surface, albedo, "DIFFUSE", {"COLOR"}, samples=PBR_SAMPLES)
    bake_with_margin(helpers, surface, normal, "NORMAL", samples=PBR_SAMPLES)
    bake_with_margin(helpers, surface, roughness, "ROUGHNESS", samples=PBR_SAMPLES)

    helpers.ATLAS_SIZE = INDIRECT_ATLAS_SIZE
    indirect = helpers.image("StairlightSurface_Indirect", colorspace="Linear Rec.709", extension="exr")
    # Time-varying sunlight is handled in the website; bake only sky bounce.
    lights = [(obj, obj.hide_render) for obj in scene.objects if obj.type == "LIGHT"]
    for obj, _hidden in lights: obj.hide_render = True
    try:
        bake_with_margin(helpers, surface, indirect, "DIFFUSE", {"DIRECT", "INDIRECT"}, samples=INDIRECT_SAMPLES)
    finally:
        for obj, hidden in lights: obj.hide_render = hidden
    raw_indirect = helpers.save_image(indirect, f"{ASSET}-room-indirect-raw.exr", format="EXR")
    indirect_path = helpers.denoise_indirect_with_compositor(indirect)
    make_external(indirect, indirect_path)

    outputs = {
        "albedo": str(helpers.save_image(albedo, "room-albedo.png", format="PNG")),
        "normal": str(helpers.save_image(normal, "room-normal.png", format="PNG")),
        "roughness": str(helpers.save_image(roughness, "room-roughness.png", format="PNG")),
        "indirect": str(indirect_path),
        "indirectRaw": str(raw_indirect),
    }
    for texture in (albedo, normal, roughness):
        absolute = Path(bpy.path.abspath(texture.filepath))
        texture.filepath = "//" + os.path.relpath(absolute, WEB_BLEND.parent)
        texture.pack()
    export_material(surface, albedo, normal, roughness, indirect)
    bake_flags = {
        "pbrAtlas": PBR_ATLAS_SIZE, "indirectAtlas": INDIRECT_ATLAS_SIZE,
        "pbrSamples": PBR_SAMPLES, "indirectSamples": INDIRECT_SAMPLES,
        "device": "METAL", "threads": 2, "bakeMarginPx": 16, "indirectContainsDirectSun": False, "indirectSource": "direct and bounced sky; no sunlight or solar bounce", "containsDirectSky": True,
    }
    scene["stairlight_bake"] = bake_flags
    bpy.ops.wm.save_as_mainfile(filepath=str(WEB_BLEND))
    triangles, sha256 = export_glb(surface, camera)
    target = Vector(scene.get("camera_target", ()))
    up = camera.matrix_world.to_3x3() @ Vector((0.0, 1.0, 0.0))
    metadata = {
        "windowLayout": LAYOUT,
        "artifactPhase": "p2-baked-pbr-and-diffuse-indirect",
        "sourceScene": SOURCE_SCENE,
        "glb": GLB_OUTPUT.name,
        "sha256": sha256,
        "triangles": triangles,
        "sourceTriangles": source_triangles,
        "sourceObjects": len(sources),
        "sourceMaterials": source_materials,
        "surface": {"name": SURFACE_NAME, "worldCoordinates": True, "uv": "UV0"},
        "camera": {
            "name": CAMERA_NAME,
            "matrixWorldBlender": [list(row) for row in camera.matrix_world],
            "upBlender": list(up),
            "targetBlender": list(target),
            "lensMm": camera.data.lens,
            "sensorWidthMm": camera.data.sensor_width,
            "sensorHeightMm": camera.data.sensor_height,
            "sensorFit": camera.data.sensor_fit,
        },
        "textures": {
            "albedo": f"/textures/{ASSET}/room-albedo.png",
            "normal": f"/textures/{ASSET}/room-normal.png",
            "roughness": f"/textures/{ASSET}/room-roughness.png",
            "diffuseIndirect": f"/textures/{ASSET}/room-indirect.exr",
            "pbrAtlasSize": PBR_ATLAS_SIZE,
            "indirectAtlasSize": INDIRECT_ATLAS_SIZE,
            "uv": "UV0",
            "indirectContainsDirectSun": False, "indirectSource": "direct and bounced sky; no sunlight or solar bounce", "containsDirectSky": True,
        },
        # Blender returns an IDPropertyGroup for scene custom properties, which
        # json.dumps cannot serialize. Keep the ordinary dict for metadata.
        "bake": bake_flags,
        "outputs": outputs,
        "seconds": round(time.monotonic() - started, 2),
    }
    METADATA_OUTPUT.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    return metadata


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
