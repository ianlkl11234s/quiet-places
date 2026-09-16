"""Small, deterministic architectural visibility bake for Last Arcade.

This intentionally measures only static architecture visibility.  It is not a
Cycles/GI bake: moving leaf shadows and direct sun stay dynamic in the runtime.
"""

from __future__ import annotations

import math
from collections import defaultdict

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


AO_RANGE_M = 0.48
SKY_RANGE_M = 7.5
RAY_OFFSET_M = 0.012
POSITION_QUANTUM_M = 0.04
NORMAL_QUANTUM = 0.08

# A compact deterministic set keeps a 230k triangle scene practical.  The
# cosine-weighted AO samples are enough for a broad ambient term, not shadows.
AO_SAMPLES = 6
SKY_SAMPLES = 4


def _architecture_meshes(scene):
    return [
        obj for obj in scene.objects
        if obj.type == "MESH" and obj.get("arcade_role") == "architecture"
    ]


def _open_element(obj):
    """Sea is a deliberately sparse, infinitely-open backdrop surface."""
    name = obj.name.lower()
    return "sea" in name or any(
        material and "sea" in material.name.lower() for material in obj.data.materials
    )


def _build_bvh(objects):
    vertices, triangles = [], []
    for obj in objects:
        mesh = obj.data
        base = len(vertices)
        world = obj.matrix_world
        vertices.extend(world @ vertex.co for vertex in mesh.vertices)
        for polygon in mesh.polygons:
            indices = polygon.vertices
            # Mesh polygons are normally triangles after generator export, but
            # fan triangulation here makes the helper safe for editable source.
            for index in range(1, len(indices) - 1):
                triangles.append((base + indices[0], base + indices[index], base + indices[index + 1]))
    return BVHTree.FromPolygons(vertices, triangles, all_triangles=True), len(triangles)


def _basis(normal):
    tangent = normal.cross(Vector((0.0, 0.0, 1.0)))
    if tangent.length_squared < 1e-8:
        tangent = normal.cross(Vector((0.0, 1.0, 0.0)))
    tangent.normalize()
    return tangent, normal.cross(tangent).normalized()


def _cosine_directions(normal):
    tangent, bitangent = _basis(normal)
    # Hammersley-style disk samples: r=sqrt(u) makes the hemisphere cosine weighted.
    directions = []
    for index in range(AO_SAMPLES):
        u = (index + 0.5) / AO_SAMPLES
        angle = 2.0 * math.pi * ((index * 0.6180339887498949) % 1.0)
        radius = math.sqrt(u)
        directions.append((
            tangent * (math.cos(angle) * radius)
            + bitangent * (math.sin(angle) * radius)
            + normal * math.sqrt(max(0.0, 1.0 - u))
        ).normalized())
    return directions


def _sky_directions(normal):
    """Sample only directions above the world horizon, biased toward zenith."""
    tangent, bitangent = _basis(normal)
    directions = []
    # Fixed high-elevation directions describe sky openings, rather than side AO.
    for index in range(SKY_SAMPLES):
        angle = 2.0 * math.pi * ((index * 0.3819660112501051 + 0.125) % 1.0)
        horizontal = Vector((math.cos(angle), math.sin(angle), 0.0))
        # Reject downward normal-facing components to prevent shooting into walls.
        direction = (Vector((0.0, 0.0, 0.78)) + horizontal * 0.625).normalized()
        if direction.dot(normal) < 0.045:
            direction = (direction - normal * direction.dot(normal) + normal * 0.045).normalized()
        directions.append(direction)
    return directions


def _visibility(point, normal, bvh):
    origin = point + normal * RAY_OFFSET_M
    occlusion = 0.0
    for direction in _cosine_directions(normal):
        hit = bvh.ray_cast(origin, direction, AO_RANGE_M)
        if hit[0] is not None:
            distance = hit[3]
            # Contact is dark; the result smoothly returns to ambient at range.
            occlusion += max(0.0, 1.0 - distance / AO_RANGE_M) ** 1.35
    ao = 1.0 - occlusion / AO_SAMPLES

    open_sky = 0
    for direction in _sky_directions(normal):
        hit = bvh.ray_cast(origin, direction, SKY_RANGE_M)
        if hit[0] is None:
            open_sky += 1
    sky = open_sky / SKY_SAMPLES
    return max(0.0, min(1.0, ao)), max(0.0, min(1.0, sky))


def _cache_key(point, normal):
    return (
        *(round(value / POSITION_QUANTUM_M) for value in point),
        *(round(value / NORMAL_QUANTUM) for value in normal),
    )


def _scalar_attribute(mesh, name):
    existing = mesh.attributes.get(name)
    if existing is not None and (existing.data_type != "FLOAT" or existing.domain != "POINT"):
        mesh.attributes.remove(existing)
        existing = None
    return existing or mesh.attributes.new(name, "FLOAT", "POINT")


def bake_occlusion(scene):
    """Write 0..1 POINT attributes `_arcade_ao` and `_arcade_sky`.

    Returns compact serializable bake statistics for the calling build script.
    """
    objects = _architecture_meshes(scene)
    occluders = [obj for obj in objects if not _open_element(obj)]
    bvh, triangles = _build_bvh(occluders)
    cache = {}
    values = defaultdict(list)
    vertex_count = 0
    for obj in objects:
        mesh = obj.data
        ao_attribute = _scalar_attribute(mesh, "_arcade_ao")
        sky_attribute = _scalar_attribute(mesh, "_arcade_sky")
        if _open_element(obj):
            for item in ao_attribute.data:
                item.value = 1.0
            for item in sky_attribute.data:
                item.value = 1.0
            values["ao"].extend([1.0] * len(mesh.vertices))
            values["sky"].extend([1.0] * len(mesh.vertices))
            vertex_count += len(mesh.vertices)
            continue

        normal_matrix = obj.matrix_world.to_3x3().inverted().transposed()
        for index, vertex in enumerate(mesh.vertices):
            point = obj.matrix_world @ vertex.co
            normal = (normal_matrix @ vertex.normal).normalized()
            key = _cache_key(point, normal)
            sample = cache.get(key)
            if sample is None:
                sample = _visibility(point, normal, bvh)
                cache[key] = sample
            ao, sky = sample
            ao_attribute.data[index].value = ao
            sky_attribute.data[index].value = sky
            values["ao"].append(ao)
            values["sky"].append(sky)
        vertex_count += len(mesh.vertices)

    # Foliage receives static sky access from the building, but never occludes
    # the bake: its tiny wind motion and leaf-to-leaf shadows remain live.
    foliage_sky = []
    sky_directions = _sky_directions(Vector((0.0, 0.0, 1.0)))
    foliage_cache = {}
    for obj in scene.objects:
        if obj.type != "MESH" or obj.get("arcade_role") != "foliage":
            continue
        attribute = _scalar_attribute(obj.data, "_arcade_sky")
        for index, vertex in enumerate(obj.data.vertices):
            point = obj.matrix_world @ vertex.co
            key = tuple(round(value / POSITION_QUANTUM_M) for value in point)
            sky = foliage_cache.get(key)
            if sky is None:
                origin = point + Vector((0.0, 0.0, .006))
                sky = sum(bvh.ray_cast(origin, direction, SKY_RANGE_M)[0] is None
                          for direction in sky_directions) / SKY_SAMPLES
                foliage_cache[key] = sky
            attribute.data[index].value = sky
            foliage_sky.append(sky)

    def summary(name):
        samples = values[name]
        return {"min": min(samples), "max": max(samples), "mean": sum(samples) / len(samples)}

    return {
        "objects": len(objects), "occluderObjects": len(occluders),
        "triangles": triangles, "vertices": vertex_count, "cacheEntries": len(cache),
        "ao": summary("ao"), "sky": summary("sky"),
        "foliageSky": {"vertices": len(foliage_sky), "mean": sum(foliage_sky) / max(1, len(foliage_sky)), "cacheEntries": len(foliage_cache)},
        "settings": {"aoRangeM": AO_RANGE_M, "skyRangeM": SKY_RANGE_M,
                     "rayOffsetM": RAY_OFFSET_M, "aoSamples": AO_SAMPLES,
                     "skySamples": SKY_SAMPLES},
    }
