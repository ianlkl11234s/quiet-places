# Koi Blender Procedural Rig & Animation System

## 0. Role

You are acting as a senior Blender technical artist, creature rigger, procedural animation engineer, and Blender Python developer.

Your task is to build a complete, reusable, editable **Koi fish** animation system in Blender.

This is not only a static fish model.

The final result must contain:

- biologically recognizable koi morphology
- clean reusable mesh
- animation-ready rig
- procedural swimming system
- multiple animation Actions
- NLA-ready clips
- turning, cruising, hovering, gliding, rising and slow circling behavior
- exposed custom parameters
- deterministic animation generation
- validation utilities
- organized Blender scene
- saved `.blend`
- reusable Python source code

The highest-priority requirement is:

**The koi must swim like a koi.**

It must NOT move like:
- a stiff object bending in one place
- a fast tropical fish vibrating rapidly
- an eel with full-body high-amplitude undulation
- a shark with aggressive propulsion
- a cartoon fish with exaggerated tail flapping

The koi should feel:
- calm
- elegant
- ornamental
- smooth
- slightly heavy in water
- graceful and meditative

---

# 1. Operating principles

Work toward a functioning Blender result.

Do not stop after writing code.

Execute scripts in Blender when possible, inspect the scene, fix problems, rerun validation, and save the completed Blender file.

Do not leave major systems as TODOs.

If an existing fish model is present:
1. inspect it;
2. reuse useful geometry if appropriate;
3. rebuild only what is necessary.

If no suitable koi mesh exists, procedurally create one.

Avoid third-party Blender add-ons.

Prefer standard Blender functionality:
- `bpy`
- `math`
- `mathutils`
- Armatures
- Constraints
- Drivers
- Shape Keys if useful
- Actions
- NLA
- standard material nodes

The primary animation system should be:

**Armature + procedural motion generation + baked Actions**

---

# 2. Coordinate system

Use one consistent local coordinate convention.

Use:

```text
+Y = forward / head direction
-Y = backward / tail direction

+X = fish right
-X = fish left

+Z = dorsal / upward
-Z = ventral / downward
```

The fish should face `+Y` in rest pose.

The body center should be near world origin.

Do not change conventions midway.

---

# 3. Real-world scale

Use metric units.

Recommended default koi size:

```text
total_length = 0.55 m
body_length  = 0.45 m
tail_fin_length = 0.10 m
max_body_depth = 0.13–0.16 m
max_body_width = 0.09–0.12 m
```

This corresponds to a medium-to-large ornamental koi.

Use these practical defaults:

```python
TOTAL_LENGTH = 0.55
BODY_LENGTH = 0.45
TAIL_FIN_LENGTH = 0.10
MAX_BODY_DEPTH = 0.145
MAX_BODY_WIDTH = 0.105
```

All dimensions should derive from a small number of top-level scale parameters.

---

# 4. Species and visual identity

Model a recognizable ornamental **koi carp**.

It should visually read as:
- a domesticated ornamental carp
- slightly deep-bodied
- smooth and full
- graceful
- not too thin
- not predator-like
- not torpedo-stiff like tuna

Important morphological cues:
- rounded head
- slightly blunt snout
- gently tapering body
- broad peduncle but narrower than trunk
- flowing tail fin
- paired pectoral fins near head
- dorsal fin along the dorsal midline
- pelvic fins on ventral mid-body
- anal fin near posterior ventral side
- barbels at mouth corners
- ornamental coloration

The fish should feel like a calm pond fish, not a river sprinter.

---

# 5. Body proportions

Use a koi-like silhouette.

Approximate longitudinal segmentation:

```text
head region           0.00–0.20 body length
trunk / deepest body  0.20–0.55
posterior trunk       0.55–0.78
caudal peduncle       0.78–1.00
tail fin              posterior to body
```

Maximum body depth should occur around:

```text
0.30–0.42 body length from snout
```

Maximum width is usually near the same region.

The koi should be visibly fuller and deeper-bodied than a generic streamlined fish.

---

# 6. Top-view silhouette

Top view should approximately read like:

```text
          head
           /\
         /    \
       /        \
      /          \
     /            \
    |              |
    |              |
     \            /
      \          /
       \        /
        \      /
         \    /
          \  /
           ||
           ||
          /  \
         /    \
        /      \
```

The body widens smoothly through the midsection, then narrows toward the tail peduncle.

Avoid:
- needle-like bodies
- tuna-like stiffness
- excessively thin tails
- spherical cartoon fish bodies

---

# 7. Side-view silhouette

Side view should approximately read like:

```text
          dorsal line
        __----__
     __/        \___
   _/               \__
 _/                    \___
/                          \___
\                              /
 \__                        __/
    \____              ____/
         \____    ____/
              \__/
```

Important:
- back line is gently arched
- belly is full and smooth
- tail peduncle narrows
- caudal fin expands behind it

Avoid an emaciated profile.

---

# 8. Head and mouth details

Create:
- rounded snout
- terminal to slightly subterminal mouth
- small barbels at both mouth corners
- visible eye placement on lateral head region
- operculum / gill-cover indication
- subtle lip structure

Do not exaggerate mouth opening unless building a feeding animation.

Eyes should be:
- modest in size
- laterally placed
- not cartoonishly large

---

# 9. Fins

Create these fins clearly:

- dorsal fin
- caudal fin
- anal fin
- left pectoral fin
- right pectoral fin
- left pelvic fin
- right pelvic fin

Fin character:
- pectoral fins should be rounded and soft
- caudal fin should be elegant and flexible
- dorsal fin should stabilize but not dominate
- pelvic and anal fins help balance and minor steering

Do not underbuild the pectoral fins.
They are important for hovering and subtle maneuvering.

---

# 10. Tail design

The tail is the primary propulsion structure.

Requirements:
- strong caudal peduncle transition
- flexible tail base
- bifurcated or fan-like ornamental tail fin
- soft trailing edges
- enough mesh density for smooth flexing

The tail should not be too tiny.

It should feel substantial enough to generate thrust, but still graceful.

---

# 11. Mesh architecture

Prefer quad-dominant topology.

Requirements:

```text
head:                moderate density
body trunk:          moderate density
caudal peduncle:     high deformation density
tail fin:            high deformation density
pectoral fins:       moderate-high density
dorsal/anal fins:    moderate density
```

Avoid:
- long triangles across deformation zones
- insufficient geometry at the tail base
- rigid fin topology
- heavy pinching around fin roots

Recommended modifier logic:

```text
Base Mesh
→ Armature
→ corrective shape keys if required
→ Subdivision Surface
```

---

# 12. Rig architecture

Create:

```text
KOI_RIG
```

Minimum high-level bones:

```text
root
body_master
head
spine_01
spine_02
spine_03
spine_04
spine_05
peduncle
tail_base
tail_mid
tail_tip
```

Fins:

```text
pectoral_L
pectoral_R
pelvic_L
pelvic_R
anal
dorsal
caudal_L
caudal_R
```

Optional extra bones for finer control:
- fin membrane support bones
- secondary fin tip bones
- jaw bone if needed
- barbels bones if desired

The trunk must support smooth lateral undulation.

---

# 13. Spine distribution

The backbone should allow progressive side-to-side wave motion.

Recommended normalized body positions:

```text
head        y = 0.00
spine_01    y = 0.15
spine_02    y = 0.30
spine_03    y = 0.48
spine_04    y = 0.65
spine_05    y = 0.80
peduncle    y = 0.92
tail_base   y = 1.00
tail_mid    posterior fin base
tail_tip    tail end
```

The head should move only slightly.
The largest oscillation should occur near the tail base and caudal fin.

---

# 14. Weight painting

The koi body should show increasing lateral flexibility from head to tail.

Conceptual lateral motion influence:

```text
head region          0.05–0.12
front trunk          0.18–0.28
mid trunk            0.30–0.45
posterior trunk      0.45–0.65
caudal peduncle      0.70–0.90
tail fin             1.00
```

The head must not wag strongly.

The tail must clearly be the most active.

Use smooth falloff.
Avoid visible kinks between bones.

---

# 15. Primary swimming model

The koi swims primarily by **carangiform/subcarangiform-like undulation**:
- head relatively stable
- wave amplitude increases toward tail
- tail fin produces most propulsion
- pectoral fins help with hovering and slow maneuvering

Do NOT animate the whole body with equal-amplitude sinusoidal bending.

The forward body should feel comparatively stable.
The posterior half should carry most of the wave.

---

# 16. Body centerline equation

Define:
- `s ∈ [0,1]` = normalized body coordinate from snout to tail base
- `t` = time

Body lateral displacement:

\[
x(s,t)=A(s)\sin\big(2\pi(ft-ks)+\phi\big)
\]

Where:
- `A(s)` increases strongly toward the tail
- `f` is tail-beat frequency
- `k` is spatial wave count
- `φ` is phase offset

This controls the fish centerline sway.

---

# 17. Amplitude envelope

Use a nonlinear amplitude envelope so that the head remains stable.

Recommended:

\[
A(s)=A_{max}\cdot s^p
\]

with:

```text
p = 1.8–3.0
```

Default:

```python
def axial_amp(s, a_max, power=2.35):
    return a_max * (s ** power)
```

This ensures:
- tiny movement at the head
- moderate movement at the body
- large movement at the tail

Alternative smoother envelope:

\[
A(s)=A_{max}\cdot smoothstep(s_0,1,s)^p
\]

with `s0 ≈ 0.10–0.20`.

---

# 18. Wave count and body wave shape

For koi, use a low visible wave count along the body.

Recommended:

```text
wave_count ≈ 0.7–1.1
```

This means:
- less than or around one full wave from head to tail base
- smooth body curvature
- not eel-like repeated waves

Default:

```python
wave_count = 0.85
```

Too high a wave count will make the koi look nervous or snake-like.

---

# 19. Frequency

Koi should swim calmly.

Recommended artistic ranges:

```text
idle hover / very slow swim    0.35–0.60 Hz
calm cruise                    0.60–1.00 Hz
faster cruise                  1.00–1.40 Hz
```

Default hero cruise:

```python
tail_frequency = 0.78
```

The fish should not look hyperactive.

---

# 20. Tail amplitude

The largest lateral amplitude should occur near the tail fin.

Recommended:

\[
A_{max}
\approx
0.04–0.10
\times
bodyLength
\]

Default:

```python
A_max = BODY_LENGTH * 0.065
```

The head displacement should remain a small fraction of this.

---

# 21. Converting centerline into bone rotations

Do not only translate bones laterally.

Use centerline tangent angle.

If:

\[
x(s,t)=A(s)\sin\big(2\pi(ft-ks)+\phi\big)
\]

then the local tangent angle can be approximated by:

\[
\theta(s,t)\approx \arctan\left(\frac{\partial x}{\partial s}\right)
\]

Numerically:

```python
eps = 0.001

dxds = (
    body_wave(s + eps, t)
    - body_wave(s - eps, t)
) / (2 * eps)

theta = math.atan(dxds)
```

Use `theta` to drive yaw rotation of spine bones.

The rotation amplitude should increase from head to tail.

Avoid abrupt angle jumps.

---

# 22. Body roll and heave

Koi often show subtle secondary body roll and vertical heave.

Use very small values.

Vertical heave:

\[
z(t)=B_z\sin(2\pi f_z t+\psi_z)
\]

Roll:

\[
r(t)=B_r\sin(2\pi f_r t+\psi_r)
\]

Recommended defaults:

```python
body_heave_amp = 0.004
body_heave_freq = 0.22

body_roll_deg = 1.2
body_roll_freq = 0.18
```

These are subtle secondary motions only.

Do not overdo them.

---

# 23. Tail fin deformation

The tail fin should not move as a rigid triangle.

Its base follows the peduncle, but the outer fin membrane should lag slightly.

Possible model:

\[
\theta_{tailfin}(t)=g\cdot \theta_{tailbase}(t-\tau)
\]

Where:
- `g` = follow gain
- `τ` = slight delay

Suggested:
```text
g = 0.90–1.08
τ = 0.01–0.04 sec
```

The tail membrane may also flex slightly more at its tips.

---

# 24. Pectoral fin behavior

Pectoral fins are especially important in slow koi swimming.

They should:
- paddle gently
- stabilize body attitude
- assist turning
- assist hovering
- open and close subtly

They should NOT flap like bird wings.

A useful model:

\[
\theta_p(t)=P\sin(2\pi f_p t+\phi_p)
\]

Recommended:
- lower amplitude than tail motion
- slower, softer motion
- often alternating or slightly phase-shifted

Default hover use:
```python
pectoral_amp_deg = 10.0
pectoral_freq = 0.55
```

During faster cruising, pectoral motion may reduce.

---

# 25. Dorsal, anal, and pelvic fin behavior

These fins mostly stabilize and subtly react.

They may:
- sway slightly with body motion
- exhibit minor trailing motion
- remain relatively quiet compared with the tail

Use driven secondary motion or mild delayed follow.

Do not animate them aggressively.

---

# 26. Organic motion variation

Avoid perfectly periodic motion.

Use smooth deterministic variation.

Frequency modulation:

\[
f(t)=f_0[1+\epsilon_f(t)]
\]

with:

\[
\epsilon_f(t)=
0.03\sin(2\pi0.051t)+0.015\sin(2\pi0.083t+1.3)
\]

Amplitude modulation:

\[
A(t)=A_0[1+\epsilon_A(t)]
\]

with:

\[
\epsilon_A(t)=
0.05\sin(2\pi0.042t+0.7)+0.02\sin(2\pi0.091t)
\]

These should remain subtle.

The viewer should feel life, not noise.

---

# 27. Forward speed relation

Forward speed should correlate with frequency and tail amplitude.

A simplified relation:

\[
V = c_0 + c_f f + c_A A_{max}
\]

Or artistically:

\[
V \propto f \cdot A_{max}
\]

But if you need visual plausibility:
- speed increases mainly with tail-beat frequency
- amplitude increases more gently

Do not turn fast swimming into exaggerated giant body bends.

---

# 28. Turning model

Expose custom property:

```python
turn
```

Range:

```text
-1.0 = left
 0.0 = straight
+1.0 = right
```

Turning should be created by:
- asymmetry in body wave
- asymmetry in pectoral fins
- slight root yaw path curvature

Use amplitude asymmetry:

\[
A_{outer}=A_{base}(1+\beta |T|)
\]
\[
A_{inner}=A_{base}(1-\beta |T|)
\]

Suggested:
```text
β = 0.10–0.25
```

Also use a phase shift or pectoral-fin differential.

---

# 29. Root path integration

If generating actual movement trajectory, use:

\[
\dot{\psi}=C_T \cdot T \cdot V
\]

Then:

\[
\psi_{t+\Delta t}=\psi_t+\dot{\psi}\Delta t
\]

Position update:

\[
x_{t+\Delta t}=x_t+V\sin(\psi)\Delta t
\]
\[
y_{t+\Delta t}=y_t+V\cos(\psi)\Delta t
\]

Since `+Y` is forward, this gives a curved path.

The fish should not merely bend in place if the clip is meant to travel.

---

# 30. Vertical movement model

Expose:
```python
swim_depth_offset
```

And for rising / descending:

\[
z_{target}(t)
\]

Use a damped controller:

\[
\ddot z = -2\zeta\omega \dot z - \omega^2(z-z_{target})
\]

Recommended:
```text
ζ = 0.9
```

This creates smooth non-bouncy vertical motion.

Use for:
- slight ascents
- settling lower
- tranquil looping movement

---

# 31. Required Actions

Create at least these Actions:

```text
KOI_ACT_IDLE_HOVER
KOI_ACT_SLOW_CRUISE
KOI_ACT_CRUISE
KOI_ACT_TURN_LEFT
KOI_ACT_TURN_RIGHT
KOI_ACT_RISE
KOI_ACT_DESCEND
KOI_ACT_CIRCLE_SLOW
KOI_ACT_GLIDE
```

Optional:
```text
KOI_ACT_FEED_LOOK
KOI_ACT_SURFACE_APPROACH
KOI_ACT_STARTLE_SHORT
```

---

# 32. Action 01 — IDLE_HOVER

Goal:
- almost stationary
- subtle tail corrections
- active pectoral fins
- body alive but calm

Duration:
```text
8–14 sec
```

Recommended:
```text
10 sec
```

Behavior:
- very low forward speed
- tail frequency low
- pectoral fins gently paddling
- slight body heave
- slight yaw drift
- slight vertical drift

The koi should feel like it is calmly holding position in water.

---

# 33. Action 02 — SLOW_CRUISE

This is the main hero animation.

Duration:
```text
10–16 sec
```

Recommended:
```text
12 sec
```

Behavior:
- elegant forward motion
- gentle full-body posterior wave
- tail doing most of the work
- pectoral fins mildly active
- no sudden changes

Suggested defaults:
```python
frequency = 0.78
A_max = BODY_LENGTH * 0.065
wave_count = 0.85
speed = 0.16
```

Speed units should be documented.

---

# 34. Action 03 — CRUISE

Slightly faster than slow cruise.

Behavior:
- higher tail frequency
- somewhat stronger tail amplitude
- pectoral fins less prominent
- forward movement more obvious

Suggested:
```python
frequency = 1.05
A_max = BODY_LENGTH * 0.075
wave_count = 0.90
speed = 0.26
```

Still keep the motion graceful.

---

# 35. Action 04 — TURN_LEFT

Behavior:
- leftward curved trajectory
- inside body bend stronger in the correct phase
- pectoral fins asymmetric
- slight roll into turn
- forward speed slightly reduced or maintained

Do not snap or pivot in place.

Duration:
```text
6–10 sec
```

Recommended:
```text
8 sec
```

---

# 36. Action 05 — TURN_RIGHT

Same as left turn but mirrored.

---

# 37. Action 06 — RISE

Behavior:
- slowly ascend
- keep forward motion gentle
- slightly increased pectoral control
- tail continues steady propulsion
- no sudden upward darting

Duration:
```text
5–8 sec
```

---

# 38. Action 07 — DESCEND

Behavior:
- gently descend
- calm speed
- slight downward pitch acceptable
- pectoral fin stabilization

Duration:
```text
5–8 sec
```

---

# 39. Action 08 — CIRCLE_SLOW

Behavior:
- koi swims in a broad relaxed circular path
- ideal for ornamental pond-like looping behavior
- turn amount remains low but persistent
- smooth consistent rhythm
- elegant and meditative

Duration:
```text
12–20 sec
```

Recommended:
```text
16 sec
```

This is one of the most useful ambience loops.

---

# 40. Action 09 — GLIDE

Behavior:
- reduce tail frequency temporarily
- allow fish to appear to coast forward
- body remains gently alive
- pectoral fins may subtly stabilize

This should not look frozen.
It should feel like momentum is carrying the fish.

---

# 41. Optional feeding behavior

If implemented, keep it subtle.

Possible sequence:
- slow approach
- slight downward pitch
- small mouth motion
- reduced speed
- pectoral stabilization
- resume swimming

Do not create exaggerated snapping unless specifically requested.

---

# 42. State-machine design

Support behavior states:

```python
IDLE
SLOW_CRUISE
CRUISE
TURN_LEFT
TURN_RIGHT
RISE
DESCEND
CIRCLE
GLIDE
```

Recommended transition patterns:

```text
IDLE
→ SLOW_CRUISE
→ TURN
→ SLOW_CRUISE
→ RISE
→ GLIDE
→ DESCEND
→ IDLE
```

This supports future ambient looping systems.

---

# 43. Blender custom properties

Create animator-facing controls:

```text
wave_frequency
wave_amplitude
wave_count

forward_speed
turn

pectoral_frequency
pectoral_amplitude

body_heave_amplitude
body_heave_frequency
body_roll_amplitude

swim_depth_offset

tail_follow_gain
tail_follow_lag

organic_variation_amount
motion_seed
```

Use sensible ranges.

---

# 44. Recommended defaults

Use approximately:

```python
wave_frequency = 0.78
wave_amplitude = BODY_LENGTH * 0.065
wave_count = 0.85

forward_speed = 0.16
turn = 0.0

pectoral_frequency = 0.55
pectoral_amplitude = math.radians(10.0)

body_heave_amplitude = 0.004
body_heave_frequency = 0.22
body_roll_amplitude = math.radians(1.2)

swim_depth_offset = 0.0

tail_follow_gain = 0.96
tail_follow_lag = 0.025

organic_variation_amount = 1.0
motion_seed = 37
```

Tune if Blender preview shows better values.

---

# 45. Materials and coloration

Create koi-like material options.

At minimum support:
- Kohaku style: white base with red/orange patches
- Sanke style: white base with red and black
- Showa style: black base with red and white
- simple gold / orange koi
- simple white koi

Material system should allow pattern variation.

Requirements:
- smooth fish skin
- gentle wet specular highlights
- subtle scale suggestion, not exaggerated reptile scales
- slightly translucent fin feel if useful
- clean ornamental patch boundaries, but not unnaturally hard-edged everywhere

Optional:
expose a simple pattern seed parameter.

---

# 46. UV and texture logic

If procedural texture is used:
- dorsal base color
- patch mask generation
- secondary accent patches
- subtle scale/bump
- paler ventral side

If image textures are used, keep UVs clean and reusable.

Do not block completion on elaborate texture painting.
Animation quality is higher priority.

---

# 47. Scene organization

Collections:

```text
KOI
KOI_MODEL
KOI_RIGGING
KOI_ENV
KOI_DEBUG
```

Objects:

```text
KOI_BODY
KOI_RIG
KOI_GROUND or KOI_WATER_GUIDE
KOI_CAM_MAIN
KOI_CAM_SIDE
```

Materials:

```text
KOI_MAT_BODY
KOI_MAT_FIN
KOI_MAT_EYE
```

Actions:

```text
KOI_ACT_*
```

Avoid generic object names in final scene.

---

# 48. Debug visualization

Provide optional debug mode.

Possible debug elements:
- spine positions
- wave amplitude graph samples
- tail phase
- pectoral fin state
- root trajectory path

Store under:

```text
KOI_DEBUG
```

Keep hidden in final render.

---

# 49. Suggested code organization

Recommended module structure:

```text
koi/
│
├── build_all.py
├── config.py
├── geometry.py
├── materials.py
├── rig.py
├── locomotion.py
├── fins.py
├── actions.py
├── validation.py
└── save_scene.py
```

If one-file implementation is required, preserve equivalent logical separation.

---

# 50. Suggested function structure

Create clear functions such as:

```python
create_koi_mesh()
create_fins()
create_materials()

create_armature()
create_spine_rig()
create_fin_controls()

bind_mesh_to_rig()
generate_weights()

evaluate_body_wave()
evaluate_tail_motion()
evaluate_pectoral_motion()
evaluate_turning()
evaluate_vertical_motion()

bake_action()
build_all_actions()

validate_mesh()
validate_rig()
validate_actions()
validate_scene()

save_blend()
```

Do not write one giant unstructured script.

---

# 51. Core pseudo-code

```python
import math

def clamp01(x):
    return max(0.0, min(1.0, x))

def smoothstep(a, b, x):
    t = clamp01((x - a) / (b - a))
    return t * t * (3.0 - 2.0 * t)

def axial_amp(s, a_max, power=2.35):
    return a_max * (s ** power)

def organic_frequency_offset(t):
    return (
        0.03 * math.sin(2.0 * math.pi * 0.051 * t)
        + 0.015 * math.sin(2.0 * math.pi * 0.083 * t + 1.3)
    )

def organic_amplitude_offset(t):
    return (
        0.05 * math.sin(2.0 * math.pi * 0.042 * t + 0.7)
        + 0.02 * math.sin(2.0 * math.pi * 0.091 * t)
    )

def body_wave(s, t, base_amp, base_freq, wave_count, phase=0.0):
    freq = base_freq * (1.0 + organic_frequency_offset(t))
    amp = axial_amp(s, base_amp) * (1.0 + organic_amplitude_offset(t))
    theta = 2.0 * math.pi * (freq * t - wave_count * s) + phase
    return amp * math.sin(theta)

def pectoral_flap(t, amp_rad, freq, phase=0.0):
    return amp_rad * math.sin(2.0 * math.pi * freq * t + phase)
```

---

# 52. Turning pseudo-code

```python
def turning_adjustment(side, turn, base_amp, gain=0.18):
    if side == "LEFT":
        side_sign = -1.0
    else:
        side_sign = 1.0

    return base_amp * (1.0 + side_sign * gain * turn)
```

Use with:
- body wave amplitude bias
- pectoral fin amplitude bias
- root yaw integration

Test actual visual turn direction and invert sign if needed.

---

# 53. Pectoral behavior pseudo-code

```python
def pectoral_params(mode):
    if mode == "IDLE":
        return {
            "amp": math.radians(12.0),
            "freq": 0.52,
        }
    elif mode == "SLOW_CRUISE":
        return {
            "amp": math.radians(8.0),
            "freq": 0.48,
        }
    elif mode == "CRUISE":
        return {
            "amp": math.radians(4.0),
            "freq": 0.40,
        }
```

During turns, one pectoral fin may open slightly more than the other.

---

# 54. Tail follow pseudo-code

```python
def tail_follow(parent_angle_history, lag_seconds, gain=0.96):
    delayed = sample_history(parent_angle_history, lag_seconds)
    return delayed * gain
```

If needed, create extra delay for tail tips.

The tail fin should feel flexible, not rigid.

---

# 55. Baking Actions

For each Action:

1. define behavior parameters
2. evaluate frame by frame
3. pose the rig
4. insert keyframes
5. clean redundant keys where safe
6. ensure loop continuity if loopable
7. assign descriptive Action name

The saved `.blend` must already contain usable baked Actions.

Do not require regeneration each time just to preview motion.

---

# 56. Frame rate

Use:

```text
30 fps
```

unless the scene already uses another standard frame rate.

All motion calculations should use time in seconds:

```python
t = frame / fps
```

Do not hardcode physics in frame-only units.

---

# 57. Determinism

The same:
- motion seed
- parameter settings
- selected Action preset

must generate the same result.

Avoid unseeded randomness.

Prefer deterministic smooth oscillation instead of per-frame noise.

---

# 58. Performance

Keep the rig interactive.

Suggested mesh range before final subdivision:

```text
body mesh: ~5k–18k vertices
```

Exact count is flexible.

Favor clean deformation and smooth playback over arbitrary poly targets.

---

# 59. Critical visual QA

The result fails if any of the following occur.

## Failure A — head wagging too much
The whole fish swings equally from nose to tail.

Reject.

The head must stay comparatively stable.

## Failure B — eel-like motion
Too many waves along the body.

Reject.

Reduce wave count.

## Failure C — mechanical motion
Every cycle is identical and robotic.

Reject.

Add subtle organic modulation.

## Failure D — tail too weak
The fish looks underpowered and drifts without visible propulsion.

Reject.

Increase tail contribution.

## Failure E — pectoral fins flapping like wings
Too much up-down paddling.

Reject.

Make pectoral motion subtler and more water-like.

## Failure F — koi looks like generic goldfish
Body proportions or fins are too cartoonish or too short.

Reject.

Correct morphology.

## Failure G — koi looks aggressive
Motion is too fast, sharp, or predator-like.

Reject.

Return to calm ornamental behavior.

---

# 60. Quantitative QA

Programmatically check where possible.

### Head stability
Maximum lateral displacement at front 15% of body should remain much smaller than tail displacement:

\[
\frac{A_{head}}{A_{tail}} < 0.25
\]

Prefer:
```text
< 0.15
```

### Tail dominance
The posterior 20% of body plus tail should clearly show the largest lateral motion.

### Wave continuity
Sample several spine points:
- `s = 0.2`
- `s = 0.5`
- `s = 0.8`
- tail

They should not all be in identical phase.

### Loop continuity
For looped Actions:
- initial/final pose similarity
- no visible pop

### Turn validity
Turning actions must create actual curved motion, not just stationary bending.

---

# 61. Validation function

Create:

```python
validate_scene()
```

Report at least:

```text
mesh exists
rig exists
required bones exist
fins exist
required custom properties exist
Actions exist
materials assigned
cameras exist
scene organized
output saved
```

Return / print:
```text
PASS
WARN
FAIL
```

per check.

---

# 62. Lighting test scene

If no scene exists, create a simple neutral preview setup:
- simple ground or water guide
- one large area light
- soft fill
- inspection camera
- side camera

The environment is secondary.
The fish asset is the priority.

---

# 63. NLA compatibility

All clips should be:
- loopable when appropriate
- NLA-ready
- based on consistent rest pose
- blendable

Avoid large discontinuities.

Prefer smooth loop endpoints in both pose and motion velocity.

---

# 64. Output files

Final deliverables:

```text
koi.blend
```

and reusable scripts:

```text
build_all.py
geometry.py
rig.py
locomotion.py
fins.py
actions.py
validation.py
README.md
```

README should document:
- build process
- coordinate conventions
- exposed parameters
- action list
- known limitations

---

# 65. Completion checklist

The task is complete only when all of the following are true:

```text
[ ] koi mesh exists
[ ] koi silhouette is recognizable
[ ] body proportions are koi-like
[ ] fins are complete
[ ] tail fin is properly built
[ ] armature exists
[ ] spine rig exists
[ ] fin controls exist
[ ] weights are functional
[ ] body wave works
[ ] head is stable relative to tail
[ ] tail provides primary propulsion
[ ] pectoral fins support hover / maneuvering
[ ] idle hover Action exists
[ ] slow cruise Action exists
[ ] cruise Action exists
[ ] left turn Action exists
[ ] right turn Action exists
[ ] rise Action exists
[ ] descend Action exists
[ ] slow circle Action exists
[ ] glide Action exists
[ ] custom properties exist
[ ] materials exist
[ ] validation works
[ ] final .blend is saved
[ ] scripts are reusable
```

---

# 66. Priority order

If trade-offs are needed, prioritize:

```text
1. correct koi swimming motion
2. recognizable koi morphology
3. good spine and tail deformation
4. usable Actions
5. pectoral fin behavior
6. animator controls
7. coloration / materials
8. extra secondary details
9. environment
```

Never sacrifice swimming quality for fancy shading.

---

# 67. Final visual test

Play `KOI_ACT_SLOW_CRUISE` for at least three repeated loops.

Ignore texture for a moment.

Ask:

> If colors were removed, would the silhouette and motion still clearly read as a calm ornamental koi fish?

If the answer is no, the task is not complete.

Fix the motion first.

---

# 68. Final instruction

Do not optimize for dramatic action.

Optimize for:

**graceful biological plausibility + ornamental calmness + reusable controllable animation**

The koi should feel suitable for:
- a meditative pond scene
- a surreal indoor water-light installation
- a quiet architectural atmosphere
- an ambient looping visual piece

Build the system so future scenes can control the koi with a small set of high-level properties instead of manually animating every bone.