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
        # Rotate the complete transverse basis; rotating only the normal skewed
        # the leaf grid and made its width direction cease to be perpendicular.
        rotation = Quaternion(axis, pitch)
        side = rotation @ side
        normal = rotation @ normal
        start = len(self.verts)
        curl = rng.uniform(-0.12, 0.12)
        for row in range(rows + 1):
            t = row / rows
            outline = math.sin(math.pi * t) ** 0.72 * (1.0 - 0.16 * t)
            arch = length * (0.035 * math.sin(math.pi * t) + curl * t * t)
            for col in range(cols + 1):
                u = col / cols * 2.0 - 1.0
                ridge = length * .035 * (1.0 - u * u) * math.sin(math.pi * t)
                asymmetry = 1.0 + .07 * math.sin(t * 5.2) * u
                jitter = 1.0 + .028 * math.sin(t * 17 + u * 9)
                shade = 0.90 + .12 * math.sin(t * 5.7 + u * 4.1)
                rgb = tuple(min(1.0, component * shade * jitter) for component in colour[:3])
                self.point(base + axis * (length * t) + side * (width * .5 * outline * asymmetry * u) + normal * (arch + ridge), (*rgb, t))
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


def _attached_route(plant, route, route_index):
    """Curve between support anchors, retaining every branch junction exactly."""
    raw = [Vector(point) for point in route["points"]]
    branch_roots = [Vector(branch["points"][0]) for branch in plant["routes"]]
    anchors = [raw[0]]
    for lower, upper in zip(raw, raw[1:]):
        segment = upper - lower
        splits = [(1.0, upper)]
        for root in branch_roots:
            t = (root - lower).dot(segment) / segment.length_squared
            if .0001 < t < .9999 and (lower.lerp(upper, t) - root).length < .0005:
                splits.append((t, root))
        anchors.extend(point for _, point in sorted(splits, key=lambda pair: pair[0]))
    right = plant["root"][0] > 2.5
    support_y = round(plant["root"][1] / 3.2) * 3.2
    def on_post(point):
        radial = Vector((point.x - 2.82, point.y - support_y, 0))
        if radial.length < .074:
            radial = radial.normalized() * .074
        return Vector((2.82 + radial.x, support_y + radial.y, point.z))
    result = [on_post(anchors[0]) if right else anchors[0]]
    for lower, upper in zip(anchors, anchors[1:]):
        steps = max(1, math.ceil((upper - lower).length / .10))
        for index in range(1, steps + 1):
            t = index / steps
            point = lower.lerp(upper, t)
            bend = math.sin(math.pi * t) * math.sin(t * 3.8 + route_index * 1.7 + lower.z)
            if right:
                point = on_post(point)
                radial = point - Vector((2.82, support_y, point.z))
                angle = math.atan2(radial.y, radial.x) + .14 * bend
                point.x = 2.82 + radial.length * math.cos(angle)
                point.y = support_y + radial.length * math.sin(angle)
            elif max(lower.x, upper.x) < .16:
                point.y += .036 * bend  # inside the 0.265 m divider face
            elif min(lower.z, upper.z) > 2.78 and max(lower.x, upper.x) < .23:
                point.z += .026 * bend  # facade-supported runner
            result.append(point)
    return result


def _support_vine(stems, leaves, plant, rng):
    """Grow an irregular two-level network along explicit supported routes."""
    outward_x = plant["outwardX"]
    leaf_count = 0
    for route_index, route in enumerate(plant["routes"]):
        path = _attached_route(plant, route, route_index)
        stems.tube(path, [.010 - .0068 * index / max(1, len(path) - 1) for index in range(len(path))], sides=5)
        walked = 0.0
        next_node = rng.uniform(.04, .12)
        # Leaf-bearing portions arrive in continuous bands with bare-stem gaps,
        # not independent coin flips at a repeating architectural interval.
        band_spacing = rng.uniform(.52, .84)
        band_phase = rng.uniform(0, band_spacing)
        for lower, upper in zip(path, path[1:]):
            segment = upper - lower
            segment_length = segment.length
            while next_node < walked + segment_length:
                local = next_node - walked
                distance = next_node
                next_node += rng.uniform(.09, .20)
                band = .5 + .5 * math.sin((distance + band_phase) * math.tau / band_spacing)
                if band < .10:
                    continue
                joint = lower.lerp(upper, local / segment_length)
                # A branch retains its plant's base colour, with rare coherent
                # younger or dry leaves rather than an unrelated colour per leaf.
                leaf_colour = route.get("colour", plant["colour"])
                leaf_total = 2 if band > .65 and rng.random() < .55 else 1
                for leaf_index in range(leaf_total):
                    direction = Vector((
                        outward_x * rng.uniform(.42, .82),
                        rng.uniform(-.72, .72),
                        rng.uniform(-.82, -.12),
                    )).normalized()
                    petiole_tip = joint + direction * rng.uniform(.020, .043)
                    stems.tube((joint, petiole_tip), (.0025, .0010), sides=4)
                    length = rng.uniform(.045, .115)
                    leaves.leaf(petiole_tip, direction, length, length * rng.uniform(.46, .61), leaf_colour, rng, rows=4, cols=3, pitch=rng.uniform(-.48, .48))
                    leaf_count += 1
                # Selected dense portions carry short cantilevered twigs. Their
                # leaves share maturity and attach to two real twig nodes.
                if band > .73 and rng.random() < .55:
                    lateral = -1 if rng.random() < .5 else 1
                    twig_axis = Vector((outward_x * .38, lateral * .82, rng.uniform(-.35, .42))).normalized()
                    twig_length = rng.uniform(.09, .21)
                    middle = joint + twig_axis * (twig_length * .48)
                    end = joint + twig_axis * twig_length + Vector((0, 0, -.022))
                    stems.tube((joint, middle, end), (.0024, .0014, .0007), sides=4)
                    for twig_node in (middle, end):
                        direction = Vector((outward_x * .6, lateral * rng.uniform(-.35,.65), rng.uniform(-.7,-.12))).normalized()
                        petiole_tip = twig_node + direction * rng.uniform(.018,.036)
                        stems.tube((twig_node,petiole_tip),(.0014,.0006),sides=4)
                        size = rng.uniform(.06,.11)
                        leaves.leaf(petiole_tip,direction,size,size*rng.uniform(.50,.65),leaf_colour,rng,rows=4,cols=3,pitch=rng.uniform(-.55,.55))
                        leaf_count += 1
            walked += segment_length
        # A secondary route may end in one final leaf-bearing twig. It creates
        # visible hierarchy without making every node fork identically.
        if route.get("tipTwig"):
            joint = path[-1]
            direction = Vector((outward_x * .62, rng.uniform(-.35, .35), rng.uniform(-.55, -.22))).normalized()
            tip = joint + direction * rng.uniform(.035, .072)
            stems.tube((joint, tip), (.0026, .0008), sides=4)
            for _ in range(rng.randint(1, 2)):
                direction = Vector((
                    outward_x * rng.uniform(.42, .82),
                    rng.uniform(-.72, .72),
                    rng.uniform(-.82, -.12),
                )).normalized()
                petiole_tip = tip + direction * rng.uniform(.015, .035)
                stems.tube((tip, petiole_tip), (.0018, .0007), sides=4)
                length = rng.uniform(.045, .115)
                leaves.leaf(petiole_tip, direction, length, length * rng.uniform(.46, .61), route.get("colour", plant["colour"]), rng, rows=4, cols=3, pitch=rng.uniform(-.48, .48))
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

    leaf_material = _material("arcade-leaf-broad", (.072, .135, .050), .82, vertex_colour=True)
    grass_material = _material("arcade-leaf-grass", (.105, .155, .052), .82, vertex_colour=True)
    stem_material = _material("arcade-stem", (.15, .105, .042), .82)
    litter_material = _material("arcade-litter", (.27, .17, .065), .91)
    stems, leaves, grass, litter = _MeshBuild(), _MeshBuild(), _MeshBuild(), _MeshBuild()

    # Each root is on a real divider front or the walkway-facing edge of a real
    # post. Long runners transfer to the upper facade (x=.21, z=2.8..3.4), never
    # float across a shutter face. Empty bays are intentional composition space.
    palettes = [
        (.045, .105, .035, 1.0), (.072, .135, .050, 1.0), (.10, .15, .055, 1.0),
        (.12, .19, .065, 1.0), (.16, .115, .045, 1.0),
    ]
    vines = [
        {"root": (.153, -3.20, .003), "outwardX": .75, "colour": palettes[1], "routes": [
            {"points": ((.153, -3.20, .003), (.153, -3.20, .82), (.153, -3.20, 1.76), (.153, -3.20, 2.74), (.21, -3.12, 2.84), (.21, -1.62, 3.04), (.21, -.30, 3.17), (.29, -.18, 2.70)), "colour": palettes[1], "tipTwig": True},
            {"points": ((.153, -3.20, .58), (.153, -3.20, 1.32), (.153, -3.20, 2.76), (.21, -3.54, 2.88), (.21, -4.72, 3.06)), "colour": palettes[0], "tipTwig": True},
            {"points": ((.153, -3.20, 1.47), (.153, -3.20, 2.74), (.21, -2.54, 2.90), (.21, -1.08, 2.98)), "colour": palettes[3]},
        ]},
        {"root": (.153, .00, .003), "outwardX": .75, "colour": palettes[2], "routes": [
            {"points": ((.153, .00, .003), (.153, .00, .62), (.153, .00, 1.46), (.153, .00, 2.74), (.21, .08, 2.86), (.21, 1.34, 3.00), (.21, 2.48, 3.12)), "colour": palettes[2], "tipTwig": True},
            {"points": ((.153, .00, .74), (.153, .00, 1.66), (.153, .00, 2.76), (.21, -.72, 2.88), (.21, -1.84, 2.94)), "colour": palettes[1]},
            {"points": ((.153, .00, 1.16), (.153, .00, 2.75), (.21, .52, 2.83), (.21, 1.04, 2.72), (.28, 1.16, 2.48)), "colour": palettes[3], "tipTwig": True},
        ]},
        {"root": (.153, 3.20, .003), "outwardX": .75, "colour": palettes[2], "routes": [
            {"points": ((.153, 3.20, .003), (.153, 3.20, .74), (.153, 3.20, 1.64), (.153, 3.20, 2.75), (.21, 3.30, 2.87), (.21, 4.54, 3.06), (.21, 5.92, 3.18), (.31, 6.08, 2.74)), "colour": palettes[2], "tipTwig": True},
            {"points": ((.153, 3.20, .48), (.153, 3.20, 1.26), (.153, 3.20, 2.76), (.21, 2.28, 2.89), (.21, 1.10, 2.98)), "colour": palettes[1]},
            {"points": ((.153, 3.20, 1.73), (.153, 3.20, 2.75), (.21, 4.04, 2.84), (.21, 5.00, 2.76), (.28, 5.06, 2.53)), "colour": palettes[3], "tipTwig": True},
            {"points": ((.21, 4.54, 3.06), (.21, 4.90, 3.22), (.21, 5.52, 3.28)), "colour": palettes[2]},
        ]},
        {"root": (.153, 9.60, .003), "outwardX": .72, "colour": palettes[0], "routes": [
            {"points": ((.153, 9.60, .003), (.153, 9.60, .66), (.153, 9.60, 1.52), (.153, 9.60, 2.75), (.21, 10.20, 2.88), (.21, 11.44, 2.98)), "colour": palettes[0], "tipTwig": True},
            {"points": ((.153, 9.60, 1.04), (.153, 9.60, 2.76), (.21, 8.86, 2.84), (.21, 8.26, 2.73), (.27, 8.20, 2.54)), "colour": palettes[1]},
        ]},
        {"root": (.153, 19.20, .003), "outwardX": .70, "colour": palettes[4], "routes": [
            {"points": ((.153, 19.20, .003), (.153, 19.20, .72), (.153, 19.20, 1.56), (.153, 19.20, 2.76), (.21, 19.72, 2.87), (.21, 20.76, 2.98)), "colour": palettes[4], "tipTwig": True},
            {"points": ((.153, 19.20, 1.36), (.153, 19.20, 2.75), (.21, 18.62, 2.83), (.21, 18.08, 2.72), (.27, 18.06, 2.49)), "colour": palettes[0]},
        ]},
        {"root": (2.745, -.02, .003), "outwardX": -.82, "colour": palettes[0], "routes": [
            {"points": ((2.745, -.02, .003), (2.746, -.04, .72), (2.752, -.06, 1.54), (2.760, -.05, 2.34), (2.770, -.03, 2.78)), "colour": palettes[0], "tipTwig": True},
            {"points": ((2.745667, -.033333, .48), (2.748, .01, 1.20), (2.755, .04, 1.86), (2.765, .05, 2.38)), "colour": palettes[1]},
        ]},
        {"root": (2.745, 6.38, .003), "outwardX": -.82, "colour": palettes[1], "routes": [
            {"points": ((2.745, 6.38, .003), (2.746, 6.36, .70), (2.752, 6.34, 1.62), (2.760, 6.34, 2.50), (2.770, 6.36, 3.02)), "colour": palettes[1], "tipTwig": True},
            {"points": ((2.747043, 6.356522, .86), (2.748, 6.42, 1.50), (2.755, 6.45, 2.16), (2.765, 6.46, 2.68)), "colour": palettes[3]},
        ]},
        {"root": (2.745, 16.00, .003), "outwardX": -.80, "colour": palettes[2], "routes": [
            {"points": ((2.745, 16.00, .003), (2.747, 15.98, .64), (2.753, 15.96, 1.36), (2.760, 15.95, 2.04)), "colour": palettes[2], "tipTwig": True},
            {"points": ((2.74675, 15.9825, .56), (2.748, 16.03, 1.08), (2.755, 16.05, 1.62)), "colour": palettes[4]},
        ]},
    ]
    vine_leaves = 0
    plant_stats = []
    for plant in vines:
        count = _support_vine(stems, leaves, plant, rng)
        vine_leaves += count
        plant_stats.append({"root": tuple(plant["root"]), "height": round(max(point[2] for route in plant["routes"] for point in route["points"]), 3), "branches": len(plant["routes"]), "leaves": count})

    # Grass belongs only to cracks and accumulated soil at both edges; the centre remains clear.
    grass_tufts = []
    # Dense soil traps around the foreground vines, then long empty edge runs.
    for centre, count in ((-2.75, 10), (-.10, 7), (3.12, 11), (9.55, 4), (19.10, 5), (25.15, 7)):
        for index in range(count):
            x = .17 + rng.uniform(-.055, .038) if index % 2 == 0 else 2.68 + rng.uniform(-.035, .055)
            grass_tufts.append((x, centre + rng.uniform(-.32, .32)))
    grass_blades = 0
    for x, y in grass_tufts:
        for blade in range(rng.randint(5, 9)):
            angle = rng.uniform(-.9, .9) if x < 1 else rng.uniform(2.25, 4.05)
            base = Vector((x + rng.uniform(-.035, .035), y + rng.uniform(-.055, .055), rng.uniform(.001, .005)))
            direction = Vector((math.cos(angle) * .48, math.sin(angle) * .42, 1.0)).normalized()
            grass_colour = palettes[rng.choices((0, 1, 2, 4), (30, 44, 18, 8))[0]]
            grass.blade(base, direction, rng.uniform(.075, .25), rng.uniform(.008, .019), grass_colour, rng.uniform(-.72, .72))
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
    palette_rgb = [colour[:3] for colour in palettes]
    return {"seed": seed, "objects": len(objects), "vines": len(vines), "vineLeaves": vine_leaves, "mainPlants": plant_stats, "leafColourMin": tuple(min(colour[index] for colour in palette_rgb) for index in range(3)), "leafColourMax": tuple(max(colour[index] for colour in palette_rgb) for index in range(3)), "grassTufts": len(grass_tufts), "grassBlades": grass_blades, "litterLeaves": litter_count, "triangles": triangles, "drawcallsEstimate": 4}
