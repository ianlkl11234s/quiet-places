"""Parameter-driven koi Actions; metres, seconds and radians, native +Y forward.

Controls are baked, not live drivers. Edit KOI_RIG custom properties and call
build_actions(rig) to regenerate. Loop frequencies are quantized to whole cycles;
frequency modulation is integrated phase with a periodic envelope. Traveling
Actions retain root motion; the web adapter uses the in-place SLOW_CRUISE Action.
"""
from __future__ import annotations

import math
import bpy
from mathutils import Quaternion, Vector

TAU = math.tau
SPINE = (
    ('head', 0.), ('spine_01', .15), ('spine_02', .30),
    ('spine_03', .48), ('spine_04', .65), ('spine_05', .80),
    ('peduncle', .92), ('tail_base', 1.), ('tail_mid', 1.11),
    ('tail_tip', 1.22),
)
DEFAULTS = {
    'wave_frequency': .78, 'wave_amplitude': .45 * .065,
    'wave_count': .85, 'forward_speed': .16, 'turn': 0.,
    'pectoral_frequency': .55, 'pectoral_amplitude': math.radians(10),
    'body_heave_amplitude': .004, 'body_heave_frequency': .22,
    'body_roll_amplitude': math.radians(1.2),
    'swim_depth_offset': 0., 'tail_follow_gain': .96,
    'tail_follow_lag': .025, 'organic_variation_amount': 1., 'motion_seed': 37,
}
RANGES = {
    'wave_frequency': (.2, 1.6), 'wave_amplitude': (0., .045),
    'wave_count': (.5, 1.2), 'forward_speed': (0., .5), 'turn': (-1., 1.),
    'pectoral_frequency': (.2, 1.2), 'pectoral_amplitude': (0., .35),
    'body_heave_amplitude': (0., .012), 'body_heave_frequency': (.08, .5),
    'body_roll_amplitude': (0., .07), 'swim_depth_offset': (-.5, .5),
    'tail_follow_gain': (.85, 1.1), 'tail_follow_lag': (0., .06),
    'organic_variation_amount': (0., 2.), 'motion_seed': (0, 100000),
}
# duration, tail-frequency ratio, amplitude ratio, speed ratio, turn, root travel
PRESETS = {
    'IDLE_HOVER': (10, .50 / .78, .34, 0., 0., False),
    'SLOW_CRUISE': (12, 1., 1., 1., 0., False),
    'CRUISE': (8, 1.05 / .78, 1.15, 1.625, 0., True),
    'TURN_LEFT': (8, 1., 1., .88, -1., True),
    'TURN_RIGHT': (8, 1., 1., .88, 1., True),
    'RISE': (6, 1., .9, .8, 0., True),
    'DESCEND': (6, 1., .85, .7, 0., True),
    'CIRCLE_SLOW': (16, 1., .95, 1., 1., True),
    'GLIDE': (8, .5, .42, .9, 0., True),
}


def controls(rig, body_length):
    """Read, constrain and document real animator-facing controls."""
    result = {}
    for name, default in DEFAULTS.items():
        if name == 'wave_amplitude':
            default = body_length * .065
        value = rig.get(name, default)
        if not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError(f'Non-finite koi control: {name}')
        lower, upper = RANGES[name]
        value = max(lower, min(upper, value))
        value = int(value) if name == 'motion_seed' else float(value)
        rig[name] = value
        rig.id_properties_ui(name).update(min=lower, max=upper,
            description='Baked control: edit then call koi_motion.build_actions(KOI_RIG).')
        result[name] = value
    return result


def periodic_phase(time, duration, frequency, variation, seed):
    """Integral phase; modulation has zero net phase drift at the loop seam."""
    beats = max(1, round(frequency * duration))
    cycle = TAU * time / duration
    seed_phase = (seed * .61803398875 % 1) * TAU
    phase = TAU * beats * time / duration + seed_phase
    phase += variation * (.08 * math.sin(cycle)
        + .03 * (math.sin(2 * cycle + seed_phase) - math.sin(seed_phase)))
    return phase


def tangent(s, time, duration, amplitude, frequency, config, body_length):
    """Yaw of the centreline tangent; dx/ds is divided by body length in m."""
    if s <= 0:
        return 0.
    cycle = TAU * time / duration
    phase_seed = (config['motion_seed'] * .61803398875 % 1) * TAU
    amplitude *= 1 + config['organic_variation_amount'] * (
        .04 * math.sin(cycle + phase_seed) + .02 * math.sin(2 * cycle))
    phase = periodic_phase(time, duration, frequency,
                           config['organic_variation_amount'], config['motion_seed'])
    argument = phase - TAU * config['wave_count'] * s
    power = 2.35
    derivative = amplitude * (power * s ** (power - 1) * math.sin(argument)
        - TAU * config['wave_count'] * s ** power * math.cos(argument))
    return math.atan(derivative / body_length)


def vertical_step(time, target, omega=1.05, damping=.9):
    """Analytic damped step response: zero initial position and velocity."""
    wd = omega * math.sqrt(1 - damping * damping)
    decay = math.exp(-damping * omega * time)
    position = target * (1 - decay * (math.cos(wd * time)
        + damping * omega / wd * math.sin(wd * time)))
    velocity = target * decay * omega * omega / wd * math.sin(wd * time)
    return position, velocity


def root_path(kind, time, duration, speed, turn, total_length):
    """Exact path integration, yaw clockwise from +Y; actual pose uses -yaw."""
    if kind == 'CIRCLE_SLOW':
        omega = TAU / duration * (-1 if turn < 0 else 1)
        radius = max(total_length * .65, speed / abs(omega))
        speed = radius * abs(omega)
    else:
        omega = turn * speed / max(total_length * 2.4, .001)
    if kind == 'GLIDE':
        # Smooth coasting velocity reduction, positive through the whole clip.
        travelled = speed * (time - .22 * time * time / duration)
        return Vector((0, travelled, 0)), 0., speed * (1 - .44 * time / duration)
    if abs(omega) < 1e-8:
        return Vector((0, speed * time, 0)), 0., speed
    yaw = omega * time
    position = Vector((speed / omega * (1 - math.cos(yaw)),
                       speed / omega * math.sin(yaw), 0))
    return position, yaw, speed


def evaluate(rig, time, kind, config, body_length, total_length, bases):
    duration, frequency_ratio, amplitude_ratio, speed_ratio, preset_turn, travel = PRESETS[kind]
    p = rig.pose.bones
    for bone in p:
        bone.location = (0, 0, 0)
        bone.rotation_quaternion = (1, 0, 0, 0)
        bone.scale = (1, 1, 1)
    turn = max(-1., min(1., preset_turn + config['turn']))
    # Hero loop is neutral by default. A custom turn setting deliberately adds
    # a pose bias without world travel; website owns the world-space route.
    amplitude = config['wave_amplitude'] * amplitude_ratio
    frequency = config['wave_frequency'] * frequency_ratio
    if kind == 'GLIDE':
        amplitude *= 1 - .40 * time / duration

    def rotation(name, axis, angle):
        local_axis = bases[name] @ Vector(axis)
        p[name].rotation_quaternion = Quaternion(local_axis, angle)

    prior_angle = 0.
    for name, s in SPINE:
        if s <= 1:
            angle = tangent(s, time, duration, amplitude, frequency, config, body_length)
        else:
            delay = config['tail_follow_lag'] * (1 if name == 'tail_mid' else 2)
            angle = tangent(1., time - delay, duration, amplitude, frequency, config, body_length)
            angle *= config['tail_follow_gain']
        # Clockwise head steering leaves the trailing body curved into the turn.
        angle += turn * .075 * min(1., s) ** 1.7
        rotation(name, (0, 0, 1), angle - prior_angle)
        prior_angle = angle

    cycle = TAU * time / duration
    pectoral_gain = 1.2 if kind == 'IDLE_HOVER' else .4 if kind == 'CRUISE' else .8
    pectoral_frequency = config['pectoral_frequency'] * (.75 if kind == 'CRUISE' else .9)
    fin_phase = periodic_phase(time, duration, pectoral_frequency, .3 * config['organic_variation_amount'], config['motion_seed'] + 11)
    for name, side in (('pectoral_L', -1), ('pectoral_R', 1)):
        sweep = side * config['pectoral_amplitude'] * pectoral_gain * (1 + side * turn * .22)
        sweep *= math.sin(fin_phase + side * .22)
        rotation(name, (0, 0, 1), sweep + turn * .045)
        # Mostly planar paddling with small cupping, not a wing-like vertical flap.
        p[name].rotation_quaternion @= Quaternion(bases[name] @ Vector((0, 1, 0)),
                                                  side * .025 * math.sin(fin_phase - .5))
    for name, side in (('pelvic_L', -1), ('pelvic_R', 1), ('anal', 1), ('dorsal', 1)):
        rotation(name, (0, 0, 1), side * .018 * math.sin(fin_phase - .4))
    for name, side in (('caudal_L', -1), ('caudal_R', 1)):
        rotation(name, (0, 1, 0), side * .018 * math.sin(fin_phase - .7))

    heave_cycles = max(1, round(config['body_heave_frequency'] * duration))
    heave = config['body_heave_amplitude'] * math.sin(cycle * heave_cycles)
    p['body_master'].location = bases['body_master'] @ Vector((0, 0, heave))
    rotation('body_master', (0, 1, 0), config['body_roll_amplitude'] * math.sin(cycle * max(1, round(.18 * duration))))
    position, yaw, speed = (Vector((0, 0, 0)), 0., 0.)
    if travel:
        position, yaw, speed = root_path(kind, time, duration,
            config['forward_speed'] * speed_ratio, turn, total_length)
    pitch = 0.
    if kind in ('RISE', 'DESCEND'):
        position.z, vertical_speed = vertical_step(time, .12 * (1 if kind == 'RISE' else -1))
        pitch = math.atan2(vertical_speed, max(.05, speed)) * .65
    position.z += config['swim_depth_offset']
    p['root'].location = bases['root'] @ position
    rotation('root', (0, 0, 1), -yaw)
    p['root'].rotation_quaternion @= Quaternion(bases['root'] @ Vector((1, 0, 0)), pitch)


def action_curves(action):
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                yield from bag.fcurves


def build_actions(rig, body_length=.45, total_length=.55, fps=30):
    config = controls(rig, body_length)
    rig.animation_data_create()
    # Regeneration replaces only this rig's named koi clips/tracks.
    owned = {strip.action for track in rig.animation_data.nla_tracks
             for strip in track.strips if strip.action and strip.action.name.startswith('KOI_ACT_')}
    if rig.animation_data.action and rig.animation_data.action.name.startswith('KOI_ACT_'):
        owned.add(rig.animation_data.action)
    for action in bpy.data.actions:
        if action.name.startswith('KOI_ACT_') and action not in owned:
            raise ValueError('KOI_ACT names already belong to another asset; build in a separate scene/file.')
    for other in bpy.data.objects:
        if other == rig or not other.animation_data:
            continue
        linked = {strip.action for track in other.animation_data.nla_tracks for strip in track.strips}
        linked.add(other.animation_data.action)
        if linked & owned:
            raise ValueError('Koi Actions are shared with another rig; make them single-user before rebaking.')
    rig.animation_data.action = None
    for track in list(rig.animation_data.nla_tracks):
        if track.name.startswith('KOI_ACT_'):
            rig.animation_data.nla_tracks.remove(track)
    for action in owned:
        bpy.data.actions.remove(action)
    bases = {}
    for bone in rig.pose.bones:
        bone.rotation_mode = 'QUATERNION'
        bases[bone.name] = bone.bone.matrix_local.to_3x3().inverted()
    durations = {}
    for kind, preset in PRESETS.items():
        name = 'KOI_ACT_' + kind
        duration = preset[0]
        durations[name] = duration
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        slot = action.slots.new('OBJECT', rig.name)
        rig.animation_data.action = action
        rig.animation_data.action_slot = slot
        # Circle returns to origin and has continuous quaternion-equivalent pose;
        # turns/cruise/rise/descend/glide intentionally retain net root travel.
        loop = kind in ('IDLE_HOVER', 'SLOW_CRUISE', 'CIRCLE_SLOW')
        for frame in range(round(duration * fps) + 1):
            time = frame / fps
            evaluate(rig, time, kind, config, body_length, total_length, bases)
            for bone in rig.pose.bones:
                bone.keyframe_insert('location', frame=frame, group=bone.name)
                bone.keyframe_insert('rotation_quaternion', frame=frame, group=bone.name)
        for curve in action_curves(action):
            for key in curve.keyframe_points:
                key.interpolation = 'LINEAR'
        action['duration_seconds'] = duration
        action['tail_beats'] = max(1, round(config['wave_frequency'] * preset[1] * duration))
        action['frequency_hz'] = action['tail_beats'] / duration
        action['in_place'] = not preset[5]
        action['loop'] = loop
        action['motion_seed'] = config['motion_seed']
        track = rig.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, 0, action)
        strip.action_slot = slot
        track.mute = True
    rig.animation_data.action = bpy.data.actions['KOI_ACT_SLOW_CRUISE']
    rig.animation_data.action_slot = rig.animation_data.action.slots[0]
    bpy.context.scene.render.fps = fps
    bpy.context.scene.frame_start = 0
    bpy.context.scene.frame_end = round(durations['KOI_ACT_SLOW_CRUISE'] * fps)
    bpy.context.scene.frame_set(0)
    return durations


def validate_actions(rig):
    """Check stored curves, actual poses and seam velocities; raise on failure."""
    report = {}
    active = rig.animation_data.action
    saved_frame = bpy.context.scene.frame_current
    for kind in PRESETS:
        action = bpy.data.actions.get('KOI_ACT_' + kind)
        if not action:
            raise ValueError(f'Missing Action {kind}')
        curves = list(action_curves(action))
        animated = sum(max(k.co.y for k in curve.keyframe_points)
            - min(k.co.y for k in curve.keyframe_points) > 1e-4 for curve in curves)
        if animated < 12:
            raise ValueError(f'Static Action {kind}')
        if kind in ('SLOW_CRUISE', 'IDLE_HOVER'):
            for curve in curves:
                keys = curve.keyframe_points
                if abs(keys[0].co.y - keys[-1].co.y) > 1e-5:
                    raise ValueError(f'Loop seam: {kind} {curve.data_path}')
                # Linear baked segment velocities converge at the seam to the
                # same smooth underlying derivative; tolerance is per frame.
                if abs((keys[1].co.y - keys[0].co.y) - (keys[-1].co.y - keys[-2].co.y)) > .012:
                    raise ValueError(f'Loop velocity jump: {kind} {curve.data_path}')
        report[kind] = {'status': 'PASS', 'animatedChannels': animated,
                        'loop': bool(action['loop']), 'rootMotion': not action['in_place']}
        if kind == 'CIRCLE_SLOW':
            rig.animation_data.action = action
            rig.animation_data.action_slot = action.slots[0]
            end = round(action['duration_seconds'] * bpy.context.scene.render.fps)
            samples = []
            for frame in (0, 1, end - 1, end):
                bpy.context.scene.frame_set(frame)
                bpy.context.view_layer.update()
                samples.append({bone.name: bone.matrix.copy() for bone in rig.pose.bones})
            def angle(a, b):
                return 2 * math.acos(min(1., abs(a.normalized().dot(b.normalized()))))
            for name in samples[0]:
                first, following, prior, last = (sample[name] for sample in samples)
                if (first.translation - last.translation).length > 1e-5 or angle(first.to_quaternion(), last.to_quaternion()) > 1e-4:
                    raise ValueError(f'Circle pose seam: {name}')
                if ((following.translation - first.translation) - (last.translation - prior.translation)).length > .003:
                    raise ValueError(f'Circle velocity seam: {name}')
                qa = first.to_quaternion().inverted() @ following.to_quaternion()
                qb = prior.to_quaternion().inverted() @ last.to_quaternion()
                if angle(qa, qb) > .02:
                    raise ValueError(f'Circle angular velocity seam: {name}')
    rig.animation_data.action = active
    rig.animation_data.action_slot = active.slots[0]
    bpy.context.scene.frame_set(saved_frame)
    report['PASS'] = True
    return report
