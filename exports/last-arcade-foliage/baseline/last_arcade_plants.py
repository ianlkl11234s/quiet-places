"""Art-directed arcade vegetation for the Last Arcade Blender scene.

This is an original, botanical-shape approximation: a few climbing broadleaf
plants, two low grass silhouettes, and wind-blown leaf litter.  It deliberately
does not identify a species.  Blender metres, Z-up; the calling scene owns the
architecture, collection placement, camera, lights, and export.
"""
import math
import random

import bpy
from mathutils import Quaternion, Vector


def _material(name, colour, roughness, vertex_colour=False):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    principled = nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*colour, 1.0)
    principled.inputs["Roughness"].default_value = roughness
    material.diffuse_color = (*colour, 1.0)
    material.use_backface_culling = False
    if vertex_colour and not any(n.bl_idname == "ShaderNodeVertexColor" and n.layer_name == "Color" for n in nodes):
        colour_node = nodes.new("ShaderNodeVertexColor")
        colour_node.layer_name = "Color"
        material.node_tree.links.new(colour_node.outputs["Color"], principled.inputs["Base Color"])
    return material


class _MeshBuild:
    def __init__(self):
        self.verts, self.faces, self.colours = [], [], []

    def point(self, value, colour=None):
        self.verts.append(tuple(value))
        self.colours.append(colour or (0.2, 0.42, 0.09, 1.0))
        return len(self.verts) - 1

    def tube(self, points, radii, sides=5):
        points = [Vector(p) for p in points]
        first = len(self.verts)
        for index, point in enumerate(points):
            tangent = (points[min(index + 1, len(points) - 1)] - points[max(0, index - 1)]).normalized()
            side = tangent.cross(Vector((0, 0, 1)))
            if side.length < 0.001:
                side = Vector((1, 0, 0))
            side.normalize()
            up = tangent.cross(side).normalized()
            for n in range(sides):
                angle = math.tau * n / sides
                self.point(point + radii[index] * (side * math.cos(angle) + up * math.sin(angle)))
        for row in range(len(points) - 1):
            for n in range(sides):
                a = first + row * sides + n
                self.faces.append((a, first + row * sides + (n + 1) % sides, first + (row + 1) * sides + (n + 1) % sides, first + (row + 1) * sides + n))

    def leaf(self, base, direction, length, width, colour, rng, rows=5, cols=4, pitch=0.0):
        """A connected petiole terminates at base; alpha encodes root-to-tip wind weight."""
        base, axis = Vector(base), Vector(direction).normalized()
        side = axis.cross(Vector((0, 0, 1)))
        if side.length < 0.001:
            side = Vector((1, 0, 0))
        side.normalize()
        normal = side.cross(axis).normalized()
        if normal.z < 0:
            normal *= -1
        normal = Quaternion(axis, pitch) @ normal
        start = len(self.verts)
        curl = rng.uniform(-0.12, 0.12)
        for row in range(rows + 1):
            t = row / rows
            outline = math.sin(math.pi * t) ** 0.72 * (1.0 - 0.16 * t)
            arch = length * (0.035 * math.sin(math.pi * t) + curl * t * t)
            for col in range(cols + 1):
                u = col / cols * 2.0 - 1.0
                ridge = length * .035 * (1.0 - u * u) * math.sin(math.pi * t)
                jitter = 1.0 + .035 * math.sin(t * 17 + u * 9)
                shade = 0.90 + .12 * math.sin(t * 5.7 + u * 4.1)
                rgb = tuple(min(1.0, component * shade * jitter) for component in colour[:3])
                self.point(base + axis * (length * t) + side * (width * .5 * outline * u) + normal * (arch + ridge), (*rgb, t))
        for row in range(rows):
            for col in range(cols):
                a = start + row * (cols + 1) + col
                self.faces.append((a, a + 1, a + cols + 2, a + cols + 1))

    def blade(self, base, direction, height, width, colour, bend):
        base, direction = Vector(base), Vector(direction).normalized()
        colour = tuple(colour[:3])
        side = Vector((-direction.y, direction.x, 0)).normalized() * width
        bend_direction = side.normalized() * bend + Vector((direction.x, direction.y, 0)) * .18
        low = base + direction * (height * .38) + bend_direction * (height * .10)
        mid = base + direction * (height * .70) + bend_direction * (height * .44)
        tip = base + direction * height + bend_direction * (height * .84)
        a = self.point(base - side * .23, (*colour, 0.0))
        b = self.point(base + side * .23, (*colour, 0.0))
        c = self.point(low + side * .76, (*colour, .35))
        d = self.point(low - side * .76, (*colour, .35))
        e = self.point(mid + side * .42, (*colour, .72))
        f = self.point(mid - side * .42, (*colour, .72))
        g = self.point(tip, (*colour, 1.0))
        self.faces.extend(((a, b, c), (a, c, d), (d, c, e), (d, e, f), (f, e, g)))

    def object(self, collection, name, material, role, smooth=False, vertex_colour=False):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.verts, [], self.faces)
        mesh.materials.append(material)
        if vertex_colour:
            attribute = mesh.color_attributes.new("Color", "FLOAT_COLOR", "POINT")
            for entry, value in zip(attribute.data, self.colours):
                entry.color = value
        for polygon in mesh.polygons:
            polygon.use_smooth = smooth
        object_ = bpy.data.objects.new(name, mesh)
        collection.objects.link(object_)
        object_["arcade_role"] = role
        return object_


def _support_vine(stems, leaves, root, support_points, rng, leaf_colour, leaf_samples, stem_count):
    """Build several curved, attached stems with irregular leaf clusters and short branches."""
    root = Vector(root)
    leaf_count = 0
    outward_x = -1.0 if root.x > 2.5 else 1.0
    for stem_number in range(stem_count):
        # Sibling stems share a root, then slowly separate along the same support.
        y_offset = (stem_number - (stem_count - 1) / 2) * .027
        path = [root]
        for index, point in enumerate(support_points):
            point = Vector(point)
            progress = (index + 1) / len(support_points)
            path.append(Vector((point.x + outward_x * rng.uniform(.001, .012), point.y + y_offset * progress + rng.uniform(-.014, .014), point.z)))
        stems.tube(path, [.010 - .0068 * index / max(1, len(path) - 1) for index in range(len(path))], sides=5)
        nodes = []
        for index in range(1, len(path)):
            lower, upper = path[index - 1], path[index]
            for j in range(leaf_samples):
                # A deterministic gap remains near the upper supports; nodes are not evenly spaced.
                t = (j + rng.uniform(.18, .82)) / leaf_samples
                if .71 < t < .79 and (index + stem_number) % 2 == 0:
                    continue
                nodes.append(lower.lerp(upper, t))
        for node_index, joint in enumerate(nodes):
            leaf_total = rng.randint(2, 4)
            for leaf_index in range(leaf_total):
                azimuth = rng.uniform(-1.28, 1.28)
                tilt = rng.uniform(-1.25, -.35) if rng.random() < .78 else rng.uniform(-.20, .28)
                direction = Vector((outward_x * rng.uniform(.24, .58), math.sin(azimuth) * rng.uniform(.20, .70), tilt)).normalized()
                petiole_tip = joint + direction * rng.uniform(.025, .065)
                stems.tube((joint, petiole_tip), (.0028, .0012), sides=4)
                length = rng.uniform(.075, .16)
                leaves.leaf(petiole_tip, direction + Vector((0, 0, rng.uniform(-.18, .05))), length, length * rng.uniform(.50, .68), leaf_colour, rng, pitch=rng.uniform(-.60, .60))
                leaf_count += 1
            if node_index % 2 == 1:
                branch_direction = Vector((outward_x * rng.uniform(.50, 1.0), rng.uniform(-.75, .75), rng.uniform(-.18, .28))).normalized()
                branch_tip = joint + branch_direction * rng.uniform(.025, .065)
                stems.tube((joint, branch_tip), (.0031, .0013), sides=4)
                for leaf_index in range(2):
                    leaf_direction = (branch_direction * .4 + Vector((outward_x * .13, rng.uniform(-.45, .45), rng.uniform(-1.0, -.35)))).normalized()
                    end = branch_tip + leaf_direction * rng.uniform(.025, .075)
                    stems.tube((branch_tip, end), (.0017, .0008), sides=4)
                    length = rng.uniform(.075, .14)
                    leaves.leaf(end, leaf_direction, length, length * rng.uniform(.50, .65), leaf_colour, rng, pitch=rng.uniform(-.65, .65))
                    leaf_count += 1
    return leaf_count


def build_plants(seed=91526):
    """Append merged vegetation meshes to the current scene and return deterministic counts."""
    rng = random.Random(seed)
    scene = bpy.context.scene
    collection = bpy.data.collections.get("LastArcade_Plants")
    if collection is None:
        collection = bpy.data.collections.new("LastArcade_Plants")
        scene.collection.children.link(collection)

    leaf_material = _material("arcade-leaf-broad", (.16, .39, .075), .58, vertex_colour=True)
    grass_material = _material("arcade-leaf-grass", (.20, .34, .085), .73, vertex_colour=True)
    stem_material = _material("arcade-stem", (.15, .105, .042), .82)
    litter_material = _material("arcade-litter", (.27, .17, .065), .91)
    stems, leaves, grass, litter = _MeshBuild(), _MeshBuild(), _MeshBuild(), _MeshBuild()

    # Root coordinates sit just proud of the actual shopfront surface (.1425) and
    # right-column inner edge (2.744); stems therefore remain visibly attached.
    # The closest four bays are dense and climb to the eave; the far continuation
    # is deliberately light so the arcade does not turn into a continuous hedge.
    near_y = (-3.2, 0.0, 3.2, 6.4)
    vines = []
    for y in near_y:
        vines.append(((.17, y, .003), ((.17, y, .56), (.17, y, 1.30), (.17, y, 2.12), (.18, y + .16, 3.05)), 4, 3))
        vines.append(((2.744, y, .003), ((2.744, y, .62), (2.744, y, 1.42), (2.744, y, 2.28), (2.744, y - .13, 3.05)), 4, 3))
    for y, side in ((12.8, "left"), (19.2, "right"), (25.6, "left"), (25.6, "right")):
        x = .17 if side == "left" else 2.744
        vines.append(((x, y, .003), ((x, y, .58), (x, y, 1.20), (x, y + .12, 1.82)), 2, 2))
    vine_leaves = sum(_support_vine(stems, leaves, root, path, rng, (.16, .42, .075, 1.0), samples, stem_count) for root, path, samples, stem_count in vines)

    # Grass belongs only to cracks and accumulated soil at both edges; the centre remains clear.
    grass_tufts = []
    # Dense soil traps around the foreground vines, then long empty edge runs.
    for centre, count in ((-2.75, 15), (-.10, 12), (3.12, 14), (9.55, 7), (19.10, 8), (25.15, 10)):
        for index in range(count):
            x = .17 + rng.uniform(-.055, .038) if index % 2 == 0 else 2.68 + rng.uniform(-.035, .055)
            grass_tufts.append((x, centre + rng.uniform(-.32, .32)))
    grass_blades = 0
    for x, y in grass_tufts:
        for blade in range(rng.randint(7, 12)):
            angle = rng.uniform(-.9, .9) if x < 1 else rng.uniform(2.25, 4.05)
            base = Vector((x + rng.uniform(-.035, .035), y + rng.uniform(-.055, .055), rng.uniform(.001, .005)))
            direction = Vector((math.cos(angle) * .48, math.sin(angle) * .42, 1.0)).normalized()
            grass.blade(base, direction, rng.uniform(.085, .31), rng.uniform(.009, .022), (.18, .36, .075, 1.0), rng.uniform(-.72, .72))
            grass_blades += 1

    # Small curled leaves lie in edge traps and drain-side corners, never evenly through the walkway.
    litter_count = 0
    for x, y, count in ((.19, -2.95, 78), (2.66, -.15, 66), (.19, 3.12, 62), (2.67, 9.45, 52), (.20, 19.0, 42), (2.67, 25.1, 28)):
        for _ in range(count):
            base = Vector((x + rng.uniform(-.13, .13), y + rng.uniform(-.22, .22), rng.uniform(.001, .005)))
            direction = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(.02, .14))).normalized()
            litter.leaf(base, direction, rng.uniform(.045, .082), rng.uniform(.025, .048), (.31, .20, .075, 1.0), rng, rows=3, cols=3)
            litter_count += 1

    objects = [
        stems.object(collection, "arcade-plants-stems", stem_material, "stem", smooth=True),
        leaves.object(collection, "arcade-plants-foliage", leaf_material, "foliage", smooth=True, vertex_colour=True),
        grass.object(collection, "arcade-plants-grass", grass_material, "foliage", vertex_colour=True),
        litter.object(collection, "arcade-plants-litter", litter_material, "litter", smooth=True),
    ]
    triangles = sum(sum(max(0, len(face.vertices) - 2) for face in obj.data.polygons) for obj in objects)
    return {"seed": seed, "objects": len(objects), "vines": len(vines), "vineLeaves": vine_leaves, "grassTufts": len(grass_tufts), "grassBlades": grass_blades, "litterLeaves": litter_count, "triangles": triangles, "drawcallsEstimate": 4}
