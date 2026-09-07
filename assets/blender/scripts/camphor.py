"""A restrained, deterministic camphor tree for the Stillwater window study.

The asset intentionally stays as a few linked data blocks: three curve objects for
the woody structure and three merged leaf meshes.  It does not depend on an active
scene, view layer, or selection state.
"""

from __future__ import annotations

import math
import random

import bpy
from mathutils import Vector


OWNER = "stillwater.camphor"
_LEAF_PALETTES = (
    (0.075, 0.22, 0.055, 1.0),
    (0.12, 0.32, 0.075, 1.0),
    (0.19, 0.38, 0.10, 1.0),
)


def _mark(obj: bpy.types.Object) -> bpy.types.Object:
    obj["asset_owner"] = OWNER
    obj["asset_role"] = "camphor_tree"
    return obj


def _material(name: str, colour: tuple[float, float, float, float], leaf: bool = False):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.inputs["Base Color"].default_value = colour
    principled.inputs["Roughness"].default_value = 0.58 if leaf else 0.78
    if not leaf:
        material.node_tree.links.new(principled.outputs["BSDF"], output.inputs["Surface"])
        return material

    # A small translucent share keeps sun-facing leaves luminous without turning
    # every leaf into a flat, uniformly transparent card.
    translucent = nodes.new("ShaderNodeBsdfTranslucent")
    translucent.inputs["Color"].default_value = colour
    mix = nodes.new("ShaderNodeMixShader")
    mix.inputs[0].default_value = 0.22
    material.node_tree.links.new(principled.outputs["BSDF"], mix.inputs[1])
    material.node_tree.links.new(translucent.outputs["BSDF"], mix.inputs[2])
    material.node_tree.links.new(mix.outputs[0], output.inputs["Surface"])
    return material


def _curve_object(collection, name: str, splines: list[list[Vector]], radius: float, material):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 1
    data.bevel_depth = radius
    data.bevel_resolution = 1
    data.resolution_u = 2
    data.materials.append(material)
    for path in splines:
        # Poly splines pass through every branch junction exactly.  Paths use
        # several gently displaced stations, so their visible silhouette stays
        # organic without Bezier AUTO handles bending away from the junction.
        spline = data.splines.new("POLY")
        spline.points.add(len(path) - 1)
        denominator = max(1, len(path) - 1)
        for index, (point, coordinate) in enumerate(zip(spline.points, path)):
            point.co = (*coordinate, 1.0)
            point.radius = 1.0 - 0.62 * (index / denominator)
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    return _mark(obj)


def _safe_normal(direction: Vector) -> Vector:
    candidate = direction.cross(Vector((0.0, 0.0, 1.0)))
    if candidate.length < 0.001:
        candidate = direction.cross(Vector((0.0, 1.0, 0.0)))
    return candidate.normalized()


def _polyline_anchor(path: list[Vector], fraction: float) -> tuple[Vector, Vector]:
    """Return a point and tangent at *fraction* of the actual segmented path."""
    lengths = [(right - left).length for left, right in zip(path, path[1:])]
    total = sum(lengths)
    distance = max(0.0, min(1.0, fraction)) * total
    for index, (left, right, length) in enumerate(zip(path, path[1:], lengths)):
        if distance <= length or index == len(lengths) - 1:
            local = 0.0 if length == 0.0 else distance / length
            return left.lerp(right, local), (right - left).normalized()
        distance -= length
    return path[-1], (path[-1] - path[-2]).normalized()


def _in_small_sky_gap(point: Vector) -> bool:
    """Retain only small broken glimpses of sky rather than a clear central hole."""
    if not (4.55 < point.x < 6.0 and -0.8 < point.y < 3.3 and 5.0 < point.z < 8.45):
        return False
    noise = math.sin(point.y * 16.7 + point.z * 10.3) + math.sin(point.y * 29.1 - point.z * 7.9)
    return noise > 1.82


def _leaf_batch(name: str, collection, material, leaves: list[tuple[Vector, Vector, float, float, float]]):
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int]] = []
    for base, heading, length, width, curl in leaves:
        u = heading.normalized()
        v = _safe_normal(u)
        n = u.cross(v).normalized()
        # The raised centre vein and uneven side stations make each leaf a shallow
        # folded surface, not a coplanar billboard.
        points = (
            base,
            base + u * (length * 0.28) + v * (width * 0.90) + n * (curl * 0.35),
            base + u * (length * 0.50) + n * curl,
            base + u * (length * 0.73) + v * (width * 0.68) + n * (curl * 0.55),
            base + u * length,
            base + u * (length * 0.73) - v * (width * 0.68) + n * (curl * 0.22),
            base + u * (length * 0.28) - v * (width * 0.90) - n * (curl * 0.12),
        )
        offset = len(vertices)
        vertices.extend(tuple(point) for point in points)
        faces.extend(
            (
                (offset, offset + 1, offset + 2),
                (offset, offset + 2, offset + 6),
                (offset + 1, offset + 3, offset + 2),
                (offset + 2, offset + 3, offset + 4),
                (offset + 2, offset + 4, offset + 5),
                (offset + 2, offset + 5, offset + 6),
            )
        )
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    return _mark(obj)


def build_camphor(collection: bpy.types.Collection, seed: int = 42) -> dict:
    """Link a window-facing Camphor tree into *collection* and return its inventory.

    The crown is a broad window-side canopy, with foliage across x=4.5..6.0,
    y=-1.0..3.4 and z=4.8..8.5.  A few small irregular sky flecks remain.
    Calling with the same seed produces identical geometry.
    """
    if collection is None:
        raise ValueError("build_camphor requires a target bpy Collection")
    rng = random.Random(seed)
    bark = _material("STW_Camphor_Bark", (0.12, 0.070, 0.035, 1.0))
    leaf_materials = [
        _material("STW_Camphor_Leaf_%d" % index, colour, leaf=True)
        for index, colour in enumerate(_LEAF_PALETTES)
    ]

    # The trunk sits well outside the glass.  Its branch fan reaches back over
    # the window instead of reading as a small plant standing beside it.
    base = Vector((6.80, 2.70, 0.0))
    trunk = [
        base,
        Vector((6.74, 2.62, 1.65)),
        Vector((6.66, 2.55, 3.45)),
        Vector((6.58, 2.46, 5.35)),
        Vector((6.46, 2.57, 7.10)),
        Vector((6.38, 2.78, 8.30)),
    ]
    primary_specs = (
        (2, Vector((4.75, -0.70, 5.15))),
        (2, Vector((4.60, 1.00, 5.45))),
        (3, Vector((4.55, 2.90, 6.20))),
        (3, Vector((5.10, -0.90, 6.75))),
        (3, Vector((4.60, 1.40, 7.25))),
        (4, Vector((4.70, 3.20, 7.70))),
        (4, Vector((5.20, -0.50, 8.05))),
        (4, Vector((5.65, 2.65, 8.35))),
    )
    primary_paths = []
    for trunk_index, end in primary_specs:
        origin = trunk[trunk_index]
        axis = end - origin
        sideways = _safe_normal(axis)
        midpoint_a = origin.lerp(end, 0.31) + sideways * rng.uniform(-0.28, 0.28) + Vector((0.0, 0.0, rng.uniform(-0.18, 0.22)))
        midpoint_b = origin.lerp(end, 0.68) + sideways * rng.uniform(-0.22, 0.22) + Vector((0.0, 0.0, rng.uniform(-0.15, 0.25)))
        primary_paths.append([origin, midpoint_a, midpoint_b, end])

    secondary_paths: list[list[Vector]] = []
    twig_paths: list[list[Vector]] = []
    leaf_anchors: list[tuple[Vector, Vector]] = []
    for primary in primary_paths:
        start, end = primary[0], primary[-1]
        branch_axis = (end - start).normalized()
        lateral = _safe_normal(branch_axis)
        for fraction in (0.28, 0.46, 0.66, 0.86):
            origin, primary_tangent = _polyline_anchor(primary, fraction)
            sign = -1.0 if rng.random() < 0.48 else 1.0
            lift = rng.uniform(-0.26, 0.58)
            direction = (primary_tangent * rng.uniform(0.25, 0.56) + lateral * sign * rng.uniform(0.42, 0.86) + Vector((0, 0, lift))).normalized()
            secondary_end = origin + direction * rng.uniform(0.52, 1.05)
            secondary_end.x = min(6.08, max(4.48, secondary_end.x))
            secondary_end.y = min(3.42, max(-1.02, secondary_end.y))
            secondary_end.z = min(8.48, max(4.82, secondary_end.z))
            secondary_side = _safe_normal(secondary_end - origin)
            secondary_paths.append([
                origin,
                origin.lerp(secondary_end, 0.35) + secondary_side * rng.uniform(-0.10, 0.10) + Vector((0, 0, rng.uniform(-0.08, 0.12))),
                origin.lerp(secondary_end, 0.72) + secondary_side * rng.uniform(-0.08, 0.08),
                secondary_end,
            ])
            secondary_axis = (secondary_end - origin).normalized()
            secondary_path = secondary_paths[-1]
            for twig_fraction in (0.26, 0.48, 0.70, 0.90):
                twig_origin, secondary_tangent = _polyline_anchor(secondary_path, twig_fraction)
                twig_dir = (secondary_tangent * rng.uniform(0.25, 0.65) + lateral * rng.uniform(-0.90, 0.90) + Vector((0, 0, rng.uniform(-0.22, 0.58)))).normalized()
                twig_end = twig_origin + twig_dir * rng.uniform(0.34, 0.62)
                twig_side = _safe_normal(twig_dir)
                twig_paths.append([twig_origin, twig_origin.lerp(twig_end, 0.52) + twig_side * rng.uniform(-0.045, 0.045), twig_end])
                twig_path = twig_paths[-1]
                for leaf_fraction in (0.22, 0.47, 0.73, 1.0):
                    leaf_anchors.append(_polyline_anchor(twig_path, leaf_fraction))
            for leaf_fraction in (0.52, 1.0):
                leaf_anchors.append(_polyline_anchor(secondary_path, leaf_fraction))

    objects = [
        _curve_object(collection, "STW_Camphor_Trunk", [trunk], 0.095, bark),
        _curve_object(collection, "STW_Camphor_Primary", primary_paths, 0.052, bark),
        _curve_object(collection, "STW_Camphor_Secondary", secondary_paths, 0.037, bark),
        _curve_object(collection, "STW_Camphor_Twigs", twig_paths, 0.012, bark),
    ]

    leaf_batches = [[], [], []]
    petiole_paths: list[list[Vector]] = []
    for terminal, axis in leaf_anchors:
        leaf_count = rng.randint(5, 8)
        for _ in range(leaf_count):
            radial = _safe_normal(axis)
            direction = (axis * rng.uniform(-0.22, 0.45) + radial * rng.uniform(-1.0, 1.0) + Vector((0, 0, rng.uniform(-0.48, 0.68)))).normalized()
            base_point = terminal + direction * rng.uniform(0.020, 0.145)
            if _in_small_sky_gap(base_point + direction * 0.08):
                continue
            length = rng.uniform(0.100, 0.160)
            width = rng.uniform(0.040, 0.070)
            curl = rng.uniform(-0.026, 0.026)
            # The leaf root lands on a real, small petiole; no foliage point is
            # merely offset from a terminal without a physical connection.
            if (base_point - terminal).length > 0.0001:
                petiole_paths.append([terminal, base_point])
            leaf_batches[rng.choices((0, 1, 2), weights=(0.26, 0.52, 0.22))[0]].append(
                (base_point, direction, length, width, curl)
            )
    if petiole_paths:
        objects.append(_curve_object(collection, "STW_Camphor_Petioles", petiole_paths, 0.003, bark))
    for index, batch in enumerate(leaf_batches):
        objects.append(_leaf_batch("STW_Camphor_Leaves_%d" % index, collection, leaf_materials[index], batch))

    leaf_count = sum(len(batch) for batch in leaf_batches)
    # Leaves are six triangles each. Curves render at a resolution-dependent count,
    # so this is a conservative mesh-only estimate for production planning.
    return {
        "owner": OWNER,
        "seed": seed,
        "objects": [obj.name for obj in objects],
        "leaf_count": leaf_count,
        "estimated_triangles": leaf_count * 6 + 18000,
        "structure": {"trunk_paths": 1, "primary_paths": len(primary_paths), "secondary_paths": len(secondary_paths), "twig_paths": len(twig_paths), "leaf_anchors": len(leaf_anchors)},
    }
