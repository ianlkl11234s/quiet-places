"""Shared, metre-based constants for the Afterlight medaka motion bake."""
from __future__ import annotations

DURATION = 120.0
SIM_FPS = 60
FPS = 30
FISH_COUNT = 22
STRIDE = 12
SEED = 73

# Species-scale source lengths are 3–4.5 cm; this scene intentionally renders
# the medaka at 1.20× for readability, exactly once at generation time.
SOURCE_BODY_LENGTH_MIN = .030
SOURCE_BODY_LENGTH_MAX = .045
MODEL_SCALE = 1.20
BODY_LENGTH_MIN = SOURCE_BODY_LENGTH_MIN * MODEL_SCALE
BODY_LENGTH_MAX = SOURCE_BODY_LENGTH_MAX * MODEL_SCALE
SLOW_SPEED_MIN = .035
SLOW_SPEED_MAX = .075
FAST_SPEED_MIN = .14
FAST_SPEED_MAX = .24

# Three.js / runtime coordinates.  The plant model itself reaches the right wall;
# this is deliberately an avoidance volume, rather than a claim about a plant's
# biological root or branch geometry.
PLANT = (1.698, 0.0, -.38)
PLANT_HEIGHT = 1.35
BOUNDS = ((-.8, 1.60), (.18, 1.60), (-1.7, .9))
LIGHT = ((.62, 1.28), (3.0, 3.0), (-1.25, -.35))
SUN_DIRECTION = (.28, -1.0, .25)

STATE_NAMES = (
    'LOCAL_CRUISE', 'PLANT_HOVER', 'LOOSE_SHOAL', 'GROUP_ACCELERATE',
    'FAST_TRANSIT', 'GROUP_DECELERATE', 'REGROUP', 'SCATTER_MINOR',
    'SHADOW_ROAM',
)
