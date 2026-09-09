"""Validated geometry contracts shared by Blender asset recipes.

The JSON is authoritative; this module only validates and derives values.  It
does not own any scene-specific object names or materials.
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
GEOMETRY_PATH = Path(os.environ.get('QUIET_PLACES_AFTERLIGHT_GEOMETRY', ROOT / 'assets/config/afterlight-geometry.json'))


def _number(value, name):
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
        raise ValueError(f'{name} must be a finite number')
    return float(value)


def load_afterlight_geometry(path=GEOMETRY_PATH):
    data = json.loads(Path(path).read_text())
    if data.get('schemaVersion') != 1 or data.get('units') != 'metres':
        raise ValueError('afterlight geometry requires schemaVersion 1 in metres')
    corridor, opening, grate = data.get('corridor', {}), data.get('primaryOpening', {}), data.get('grate', {})
    for group, fields in ((corridor, ('minX', 'maxX', 'centerX')), (opening, ('minX', 'maxX', 'minZ', 'maxZ', 'roofY')), (grate, ('frame', 'slatWidth', 'braceWidth', 'centerY', 'depth', 'edgeInset', 'rainInset'))):
        for field in fields: group[field] = _number(group.get(field), field)
    if corridor['minX'] >= corridor['maxX'] or not corridor['minX'] < corridor['centerX'] < corridor['maxX']:
        raise ValueError('invalid corridor extent or mirror axis')
    if opening['minX'] >= opening['maxX'] or opening['minZ'] >= opening['maxZ'] or opening['roofY'] <= 0:
        raise ValueError('opening dimensions must be positive')
    if opening['minX'] < corridor['centerX'] or opening['maxX'] > corridor['maxX']:
        raise ValueError('primary opening falls outside corridor')
    if any(grate[key] <= 0 for key in ('frame', 'slatWidth', 'braceWidth', 'depth', 'edgeInset', 'rainInset')):
        raise ValueError('grate widths and depth must be positive')
    if grate['edgeInset'] < grate['frame']:
        raise ValueError('edge inset cannot overlap the frame')
    for key in ('slatCount', 'braceCount'):
        if not isinstance(grate.get(key), int) or grate[key] < 1: raise ValueError(f'{key} must be a positive integer')
    if 2 * grate['frame'] >= min(opening['maxX'] - opening['minX'], opening['maxZ'] - opening['minZ']):
        raise ValueError('frame consumes the opening')
    return data


def derive_afterlight_drain(data=None):
    data = load_afterlight_geometry() if data is None else data
    corridor, primary, grate = data['corridor'], data['primaryOpening'], data['grate']
    axis = corridor['centerX']
    secondary = {**primary, 'minX': 2 * axis - primary['maxX'], 'maxX': 2 * axis - primary['minX']}
    def spaces(low, high, count): return [low + (index + 1) * ((high - low) / (count + 1)) for index in range(count)]
    slats = spaces(primary['minX'] + grate['edgeInset'], primary['maxX'] - grate['edgeInset'], grate['slatCount'])
    braces = spaces(primary['minZ'] + grate['edgeInset'], primary['maxZ'] - grate['edgeInset'], grate['braceCount'])
    return {'primary': primary, 'secondary': secondary, 'slats': slats, 'secondarySlats': sorted(2 * axis - x for x in slats), 'braces': braces}
