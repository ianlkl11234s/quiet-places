#!/usr/bin/env python3
"""Small, fail-closed runner for authored Quiet Places asset recipes.

Recipes own scene details.  This runner owns preflight, isolated outputs, logs,
hashes, manifests and minimal GLB readback.  It never promotes files to public.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import platform
import shutil
import struct
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RECIPES = ROOT / 'assets/config/asset-recipes.json'
DEFAULT_BLENDER = Path('/Applications/Blender.app/Contents/MacOS/Blender')


def sha256(path: Path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''): digest.update(chunk)
    return digest.hexdigest()


def provenance(path: Path):
    try: display = str(path.resolve().relative_to(ROOT))
    except ValueError: display = str(path.resolve())
    return {'path': display, 'sha256': sha256(path)}


def load_registry(path: Path):
    data = json.loads(path.read_text())
    if data.get('schemaVersion') != 1 or not isinstance(data.get('recipes'), list):
        raise ValueError('recipe registry requires schemaVersion 1 and recipes')
    required = {'id', 'version', 'runner', 'source', 'inputs', 'outputs', 'contract'}
    for recipe in data['recipes']:
        missing = required - recipe.keys()
        if missing: raise ValueError(f"recipe {recipe.get('id', '<unknown>')} misses {sorted(missing)}")
        if recipe['runner'] not in ('afterlight-drain', 'medaka-master'): raise ValueError(f"unsupported recipe runner: {recipe['runner']}")
        if not isinstance(recipe['inputs'], list) or not isinstance(recipe['outputs'], list): raise ValueError(f"recipe {recipe['id']} paths must be lists")
    return data


def recipe_for(registry, identifier):
    matches = [recipe for recipe in registry['recipes'] if recipe['id'] == identifier]
    if len(matches) != 1: raise ValueError(f'unknown recipe: {identifier}')
    return matches[0]


def blender_version(blender: Path):
    if not blender.is_file(): raise FileNotFoundError(f'Blender executable not found: {blender}')
    return subprocess.check_output([str(blender), '--version'], text=True).splitlines()[0]


def validate_geometry_config(path: Path):
    data = json.loads(path.read_text())
    if data.get('schemaVersion') != 1 or data.get('units') != 'metres': raise ValueError('geometry config requires schemaVersion 1 in metres')
    for section in ('corridor', 'primaryOpening', 'grate'):
        if not isinstance(data.get(section), dict): raise ValueError(f'geometry config misses {section}')
    return data


def preflight(recipe, blender: Path, geometry_config: Path | None):
    missing = [path for path in recipe['inputs'] if not (ROOT / path).is_file()]
    if missing: raise FileNotFoundError('missing recipe inputs: ' + ', '.join(missing))
    if geometry_config is not None:
        if recipe['runner'] != 'afterlight-drain': raise ValueError('--geometry-config is only supported by afterlight-drain')
        validate_geometry_config(geometry_config)
    return {'python': sys.version.split()[0], 'platform': platform.platform(), 'blender': blender_version(blender)}


def glb_parts(path: Path):
    raw = path.read_bytes()
    if raw[:4] != b'glTF' or len(raw) < 20: raise ValueError(f'not a GLB: {path}')
    offset, chunks = 12, {}
    while offset + 8 <= len(raw):
        length, kind = struct.unpack_from('<I4s', raw, offset); offset += 8
        chunks[kind] = raw[offset:offset + length]; offset += length
    if b'JSON' not in chunks or b'BIN\x00' not in chunks: raise ValueError(f'GLB misses JSON or binary chunk: {path}')
    return json.loads(chunks[b'JSON'].decode()), chunks[b'BIN\x00']


def glb_json(path: Path): return glb_parts(path)[0]


COMPONENTS = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
TYPE_WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def accessor_values(scene, binary, accessor_index):
    accessor = scene['accessors'][accessor_index]
    if 'bufferView' not in accessor: raise ValueError(f'accessor {accessor_index} has no buffer view')
    view = scene['bufferViews'][accessor['bufferView']]
    if view.get('buffer', 0) != 0: raise ValueError('only GLB buffer 0 is supported')
    code, size = COMPONENTS.get(accessor.get('componentType'), (None, None))
    width = TYPE_WIDTH.get(accessor.get('type'))
    if code is None or width is None: raise ValueError(f'unsupported accessor {accessor_index}')
    stride = view.get('byteStride', size * width)
    start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    return [struct.unpack_from('<' + code * width, binary, start + index * stride) for index in range(accessor['count'])]


def transform_point(node, point):
    x, y, z = point
    translation = node.get('translation', (0, 0, 0)); scale = node.get('scale', (1, 1, 1)); qx, qy, qz, qw = node.get('rotation', (0, 0, 0, 1))
    x, y, z = x * scale[0], y * scale[1], z * scale[2]
    ix, iy, iz, iw = qw*x + qy*z - qz*y, qw*y + qz*x - qx*z, qw*z + qx*y - qy*x, -qx*x - qy*y - qz*z
    return ix*qw + iw*-qx + translation[0], iy*qw + iw*-qy + translation[1], iz*qw + iw*-qz + translation[2]


def transformed_positions(scene, binary, node):
    if 'mesh' not in node: raise ValueError(f"node {node.get('name')} has no mesh")
    if node.get('matrix'): raise ValueError(f"matrix transform is unsupported for validation node {node.get('name')}")
    positions = []
    for primitive in scene['meshes'][node['mesh']]['primitives']:
        position_accessor = primitive.get('attributes', {}).get('POSITION')
        if position_accessor is None: raise ValueError(f"mesh for {node.get('name')} has no POSITION accessor")
        positions.extend(transform_point(node, position) for position in accessor_values(scene, binary, position_accessor))
    return positions


def mesh_triangles(scene, binary, node):
    triangles = []
    for primitive in scene['meshes'][node['mesh']]['primitives']:
        position_accessor = primitive.get('attributes', {}).get('POSITION')
        if position_accessor is None: raise ValueError(f"mesh for {node.get('name')} has no POSITION accessor")
        positions = [transform_point(node, point) for point in accessor_values(scene, binary, position_accessor)]
        indices = [value[0] for value in accessor_values(scene, binary, primitive['indices'])] if 'indices' in primitive else list(range(len(positions)))
        if primitive.get('mode', 4) != 4 or len(indices) % 3: raise ValueError(f"mesh for {node.get('name')} is not triangle indexed")
        triangles.extend((positions[indices[index]], positions[indices[index + 1]], positions[indices[index + 2]]) for index in range(0, len(indices), 3))
    return triangles


def bounds(points):
    if not points: raise ValueError('mesh has no positions')
    return [[min(point[axis] for point in points), max(point[axis] for point in points)] for axis in range(3)]


def assert_close_pair(actual, expected, label, tolerance=2e-5):
    if any(abs(a - e) > tolerance for a, e in zip(actual, expected)): raise ValueError(f'{label} bounds {actual} differ from expected {expected}')


def verify_afterlight_geometry(scene, binary, config):
    nodes = {node.get('name'): node for node in scene.get('nodes', []) if node.get('name')}
    primary, corridor, grate = config['primaryOpening'], config['corridor'], config['grate']
    opening = {**primary, 'frame': grate['frame']}
    secondary = {**opening, 'minX': 2 * corridor['centerX'] - opening['maxX'], 'maxX': 2 * corridor['centerX'] - opening['minX']}
    checks = {}
    for prefix, aperture in (('DrainGrate_', opening), ('DrainGrate_Secondary_', secondary)):
        expected = {'Frame_West': ([aperture['minX'], aperture['minX'] + grate['frame']], [aperture['minZ'], aperture['maxZ']]), 'Frame_East': ([aperture['maxX'] - grate['frame'], aperture['maxX']], [aperture['minZ'], aperture['maxZ']]), 'Frame_North': ([aperture['minX'], aperture['maxX']], [aperture['maxZ'] - grate['frame'], aperture['maxZ']]), 'Frame_South': ([aperture['minX'], aperture['maxX']], [aperture['minZ'], aperture['minZ'] + grate['frame']])}
        for suffix, (wanted_x, wanted_z) in expected.items():
            name = prefix + suffix
            if name not in nodes: raise ValueError(f'Afterlight GLB misses frame node {name}')
            measured = bounds(transformed_positions(scene, binary, nodes[name]))
            assert_close_pair(measured[0], wanted_x, name + ' x')
            assert_close_pair(measured[2], wanted_z, name + ' z')
            checks[name] = {'x': measured[0], 'z': measured[2]}
    roof = nodes.get('DrainRoof_Near')
    if roof is None: raise ValueError('Afterlight GLB misses DrainRoof_Near')
    roof_bounds = bounds(transformed_positions(scene, binary, roof))
    if roof_bounds[0][0] > corridor['minX'] + 2e-5 or roof_bounds[0][1] < corridor['maxX'] - 2e-5: raise ValueError('Drain roof does not cover corridor width')
    if roof_bounds[2][0] > -2 + 2e-5 or roof_bounds[2][1] < 4 - 2e-5: raise ValueError('Drain roof does not cover expected corridor depth')
    holes = (primary, secondary)
    for triangle in mesh_triangles(scene, binary, roof):
        min_x, max_x = min(point[0] for point in triangle), max(point[0] for point in triangle)
        min_z, max_z = min(point[2] for point in triangle), max(point[2] for point in triangle)
        for aperture in holes:
            # Positive XZ overlap means roof topology intrudes into an opening; edge walls may touch its boundary.
            if max(min_x, aperture['minX']) < min(max_x, aperture['maxX']) - 2e-5 and max(min_z, aperture['minZ']) < min(max_z, aperture['maxZ']) - 2e-5:
                raise ValueError('Drain roof triangle intrudes into configured opening')
    return {'frameBounds': checks, 'roofBounds': roof_bounds, 'openingBoundary': {'primary': [primary['minX'], primary['maxX'], primary['minZ'], primary['maxZ']], 'secondary': [secondary['minX'], secondary['maxX'], secondary['minZ'], secondary['maxZ']]}}


def assert_afterlight_geometry_equivalent(before, after, tolerance=2e-5):
    for name, before_bounds in before['frameBounds'].items():
        after_bounds = after['frameBounds'].get(name)
        if after_bounds is None: raise ValueError(f'replay loses frame {name}')
        for axis in ('x', 'z'): assert_close_pair(after_bounds[axis], before_bounds[axis], f'replay {name} {axis}', tolerance)
    for axis, (before_bounds, after_bounds) in enumerate(zip(before['roofBounds'], after['roofBounds'])):
        assert_close_pair(after_bounds, before_bounds, f'replay roof axis {axis}', tolerance)


def readback(recipe, output: Path, geometry_path: Path | None = None):
    models = output / 'models'
    if recipe['runner'] == 'afterlight-drain':
        config = json.loads((geometry_path or ROOT / 'assets/config/afterlight-geometry.json').read_text())
        metadata = json.loads((models / 'afterlight-courtyard.metadata.json').read_text())
        scene, binary = glb_parts(models / 'afterlight-courtyard.glb')
        names = {node.get('name') for node in scene.get('nodes', [])}
        required = set(recipe['contract']['nodes'])
        if not required <= names: raise ValueError(f'Afterlight GLB misses nodes: {sorted(required - names)}')
        aperture = config['primaryOpening']
        if metadata.get('aperture', {}).get('x') != [aperture['minX'], aperture['maxX']]: raise ValueError('Afterlight metadata aperture x diverges from geometry config')
        if metadata.get('geometryContract', {}).get('schemaVersion') != config['schemaVersion']: raise ValueError('Afterlight metadata does not name geometry contract')
        geometry_readback = verify_afterlight_geometry(scene, binary, config)
        return {'glbNodes': len(names), 'requiredNodes': sorted(required), 'aperture': metadata['aperture'], 'geometry': geometry_readback}
    metadata = json.loads((models / 'medaka.metadata.json').read_text())
    scene = glb_json(models / 'medaka.glb')
    names = {node.get('name') for node in scene.get('nodes', [])}
    if metadata.get('rootNode') != recipe['contract']['rootNode'] or recipe['contract']['rootNode'] not in names:
        raise ValueError('Medaka root node contract failed')
    if not any(name and name.startswith(recipe['contract']['skinnedMesh']) for name in names): raise ValueError('Medaka skinned mesh contract failed')
    return {'glbNodes': len(names), 'rootNode': metadata['rootNode'], 'skinnedMesh': metadata['skinnedMesh']}


def run_recipe(recipe, destination: Path, blender: Path, tooling, geometry_config: Path | None, registry_path: Path, replay_work_blend: Path | None = None):
    if destination.exists() and any(destination.iterdir()): raise ValueError(f'output directory must be empty: {destination}')
    destination.mkdir(parents=True, exist_ok=True)
    work, models, logs = destination / 'work', destination / 'models', destination / 'logs'
    work.mkdir(); models.mkdir(); logs.mkdir(); environment = None; effective_geometry = None; replay = None
    if recipe['runner'] == 'afterlight-drain':
        if replay_work_blend is not None and not replay_work_blend.is_file(): raise FileNotFoundError(f'replay work blend does not exist: {replay_work_blend}')
        source_geometry = geometry_config or ((replay_work_blend.parent.parent / 'config' / 'afterlight-geometry.json') if replay_work_blend is not None else ROOT / 'assets/config/afterlight-geometry.json')
        if not source_geometry.is_file(): raise FileNotFoundError(f'replay geometry config does not exist: {source_geometry}')
        sandbox_geometry = destination / 'config' / 'afterlight-geometry.json'; sandbox_geometry.parent.mkdir(); shutil.copy2(source_geometry, sandbox_geometry)
        environment = {**__import__('os').environ, 'QUIET_PLACES_AFTERLIGHT_GEOMETRY': str(sandbox_geometry)}
        effective_geometry = {'sourcePath': str(source_geometry.resolve()), 'sandboxPath': str(sandbox_geometry.relative_to(destination)), 'sha256': sha256(sandbox_geometry)}
        if replay_work_blend is None:
            blend = work / 'afterlight-web.blend'; shutil.copy2(ROOT / 'assets/blender/afterlight-web.blend', blend)
        else:
            blend = replay_work_blend
            replay = {'workBlend': str(blend.resolve()), 'sha256Before': sha256(blend)}
        command = [str(blender), '--background', str(blend), '--python', str(ROOT / 'assets/blender/scripts/update_afterlight_drain.py'), '--', '--export', '--output-dir', str(models)]
    else:
        command = [str(blender), '--background', '--factory-startup', '--python', str(ROOT / 'assets/blender/scripts/medaka/build_all.py'), '--', '--output-dir', str(destination)]
    result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, env=environment)
    (logs / 'blender.log').write_text('$ ' + ' '.join(command) + '\n\nSTDOUT\n' + result.stdout + '\nSTDERR\n' + result.stderr)
    if result.returncode: raise RuntimeError(f"{recipe['id']} stopped at Blender step; see {logs / 'blender.log'}")
    expected = [destination / path for path in recipe['outputs']]
    missing = [str(path.relative_to(destination)) for path in expected if not path.is_file()]
    if missing: raise RuntimeError('recipe did not produce: ' + ', '.join(missing))
    validation = readback(recipe, destination, destination / 'config' / 'afterlight-geometry.json' if effective_geometry is not None else None)
    if replay is not None:
        source_validation = readback(recipe, replay_work_blend.parent.parent, source_geometry)
        assert_afterlight_geometry_equivalent(source_validation['geometry'], validation['geometry'])
        replay['geometryEquivalent'] = True
    manifest = {
        'schemaVersion': 1,
        'asset': {'id': recipe['id'], 'version': recipe['version'], 'source': recipe['source']},
        'tooling': tooling,
        'recipeRegistry': provenance(registry_path),
        'inputs': [{'path': path, 'sha256': sha256(ROOT / path)} for path in recipe['inputs'] if path != 'assets/config/afterlight-geometry.json'],
        'outputs': [{'path': str(path.relative_to(destination)), 'sha256': sha256(path)} for path in expected],
        'contract': recipe['contract'],
        'validation': {'status': 'passed', 'readback': validation, 'binaryHashPolicy': 'SHA-256 records the produced bytes; visual comparison is required for non-deterministic bakes.'},
        'createdAt': datetime.now(timezone.utc).isoformat()
    }
    if effective_geometry is not None: manifest['effectiveGeometryConfig'] = effective_geometry
    if replay is not None:
        replay['sha256After'] = sha256(replay_work_blend)
        replay['sourceOutputGlbSha256'] = sha256(replay_work_blend.parent.parent / 'models' / 'afterlight-courtyard.glb')
        replay['binaryHashEqual'] = replay['sourceOutputGlbSha256'] == sha256(destination / 'models' / 'afterlight-courtyard.glb')
        manifest['replay'] = replay
    (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=('preflight', 'build', 'readback'))
    parser.add_argument('--recipe', required=True)
    parser.add_argument('--output-dir', type=Path)
    parser.add_argument('--registry', type=Path, default=DEFAULT_RECIPES)
    parser.add_argument('--geometry-config', type=Path, help='candidate Afterlight geometry JSON copied into this isolated build only')
    parser.add_argument('--replay-work-blend', type=Path, help='re-run an existing isolated Afterlight work blend to prove idempotence')
    parser.add_argument('--write-manifest', action='store_true', help='after successful readback, refresh an existing manifest with the current readback timestamp')
    parser.add_argument('--blender', type=Path, default=DEFAULT_BLENDER)
    args = parser.parse_args()
    try:
        registry_path = args.registry.resolve()
        recipe = recipe_for(load_registry(registry_path), args.recipe)
        geometry_config = args.geometry_config.resolve() if args.geometry_config else None
        if args.command == 'readback':
            if args.output_dir is None: raise ValueError('readback requires --output-dir')
            output = args.output_dir.resolve()
            effective_geometry = geometry_config or (output / 'config' / 'afterlight-geometry.json')
            result = readback(recipe, output, effective_geometry if effective_geometry.is_file() else None)
            if args.write_manifest:
                manifest_path = output / 'manifest.json'
                if not manifest_path.is_file(): raise ValueError('readback --write-manifest requires an existing manifest')
                manifest = json.loads(manifest_path.read_text())
                manifest['recipeRegistry'] = provenance(registry_path)
                manifest['validation']['readback'] = result
                manifest['validation']['recheckedAt'] = datetime.now(timezone.utc).isoformat()
                manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
            print(json.dumps({'recipe': recipe['id'], 'status': 'passed', 'readback': result})); return
        tooling = preflight(recipe, args.blender, geometry_config)
        if args.command == 'preflight': print(json.dumps({'recipe': recipe['id'], 'status': 'passed', 'tooling': tooling})); return
        if args.output_dir is None: raise ValueError('build requires --output-dir')
        replay_work_blend = args.replay_work_blend.resolve() if args.replay_work_blend else None
        if replay_work_blend is not None and recipe['runner'] != 'afterlight-drain': raise ValueError('--replay-work-blend is only supported by afterlight-drain')
        manifest = run_recipe(recipe, args.output_dir.resolve(), args.blender, tooling, geometry_config, registry_path, replay_work_blend)
        print(json.dumps({'recipe': recipe['id'], 'status': 'passed', 'manifest': str((args.output_dir / 'manifest.json').resolve())}))
    except Exception as error:
        print(f'asset-pipeline: {error}', file=sys.stderr)
        raise SystemExit(1)


if __name__ == '__main__': main()
