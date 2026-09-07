# Southern Stingray Blender Procedural Rig & Animation System

## 0. Role

You are acting as a senior Blender technical artist, procedural-modeling engineer, rigging TD, animation engineer, and Blender Python developer.

Your task is to build a complete, reusable, editable Southern Stingray animation system in Blender.

The species is:

**Southern Stingray — Hypanus americanus**

This is not merely a static model.

The final result must contain:

- biologically recognizable Southern Stingray morphology
- clean reusable mesh
- rig suitable for rajiform / stingray-style pectoral-fin undulation
- procedural animation generator
- multiple animation Actions
- NLA-ready clips
- turning, hovering, cruising, rising and settling behavior
- passive secondary tail dynamics
- exposed custom parameters
- deterministic animation generation
- validation utilities
- clean Blender scene organization
- saved `.blend`
- reusable Python source code

The highest-priority requirement is the locomotion.

The animal must **NOT** move like:
- a bird
- a manta ray performing large whole-wing flaps
- a flying carpet
- a shark driven by its tail
- a rigid object with sinusoidal rotation

The pectoral disc must show a **travelling deformation wave moving from anterior toward posterior**, while deformation amplitude increases from the rigid body core toward the flexible outer fin margins.

---

# 1. Operating principles

Work directly toward a functioning Blender result.

Do not stop after writing code.

Execute the scripts in Blender when the available environment permits it, inspect the resulting scene, fix failures, rerun validation, and save the completed Blender file.

Do not leave major components as TODOs.

Do not substitute a text explanation for a required asset.

If an existing Blender scene or ray mesh is present:

1. inspect it first;
2. preserve useful existing assets;
3. reuse the mesh if it is suitable;
4. rebuild only components that need replacement.

If no suitable mesh exists, procedurally construct the ray from scratch.

Avoid dependencies on third-party Blender add-ons.

Prefer standard Blender functionality:

- `bpy`
- `math`
- `mathutils`
- Blender Armatures
- Shape Keys if useful
- Constraints
- Drivers
- Actions
- NLA
- modifiers
- standard material nodes

Geometry Nodes may be used as an optional helper, but the final animation system must not depend exclusively on a fragile Geometry Nodes setup.

The primary reusable animation representation should be:

**Armature + Actions + Python procedural animation generator.**

---

# 2. Coordinate system

Use one consistent local coordinate convention throughout the project.

Use:

```text
+Y = forward / anterior / head direction
-Y = backward / posterior / tail direction

+X = animal's right
-X = animal's left

+Z = dorsal / upward
-Z = ventral / downward
```

The unanimated ray should face `+Y`.

The body center should be approximately at world origin.

The default ground plane should be below the ray along `-Z`.

Never change this convention halfway through the implementation.

---

# 3. Real-world scale

Use metric units.

Recommended default adult-sized model:

```text
disc_width          = 1.40 m
disc_length         = 1.17 m
disc_width/length   ≈ 1.20

central_thickness   ≈ 0.10 m
outer_edge_thickness ≈ 0.008–0.015 m

tail_length         ≈ 1.6–2.0 m
```

These values are defaults rather than rigid biological limits.

All important dimensions should ultimately derive from a small number of parameters so that the animal can be rescaled without destroying the rig.

Use:

```python
DISC_WIDTH = 1.40
DISC_LENGTH = DISC_WIDTH / 1.20
TAIL_LENGTH = DISC_LENGTH * 1.65
```

as a practical default.

---

# 4. Species morphology

The model must visually read as a **Southern Stingray**, not merely a generic ray.

Important characteristics:

## 4.1 Pectoral disc

The pectoral fins merge continuously with the head and torso to form a broad rhomboidal / diamond-like disc.

Requirements:

- disc approximately 1.2 times as broad as long
- angular lateral corners
- moderately angular anterior margin
- snout does not protrude dramatically
- posterior disc narrows smoothly toward the pelvic/tail region
- no separate "wing attachment" seam
- no manta-like cephalic lobes
- no sharply separated torso and wings

From above, the overall silhouette should be approximately:

```text
                 FRONT

                  /\
             ____/  \____
         ___/            \___
       _/                    \_
      /                        \
     /                          \
    |                            |
     \                          /
      \                        /
       \___                ___/
           \_____    _____/
                 \__/
                  ||
                  ||
                  ||
                 tail
```

Do not make the disc circular.

Do not make it an exaggerated boomerang.

---

# 5. Body-volume requirements

A stingray is flat, but it is not a sheet.

The center of the body needs real anatomical volume.

The following regions should be subtly elevated:

- cranial region
- eye / spiracle area
- central shoulder region
- axial body core
- tail base

Thickness must gradually decrease toward the outer pectoral margins.

Conceptually:

```text
CENTER CORE                 FIN EDGE

████████
██████████
████████████
██████████
████████
████
██
█
```

The outer 20–30% of the pectoral disc should become much thinner and more flexible.

Do not produce:

```text
------------------------
```

a uniformly thin sheet.

---

# 6. Head anatomy

The dorsal side should include:

- two subtly elevated eyes
- spiracles immediately posterior to the eyes

The ventral side should include simplified but recognizable:

- mouth
- nostril region
- five pairs of gill slits

The head should be integrated into the disc.

Avoid creating a separate fish-like head.

The spiracles should remain visible from an elevated camera angle.

---

# 7. Tail morphology

The tail is important to Southern Stingray identity.

Create:

- broad but flattened tail base
- long narrowing whip-like tail
- defensive spine / barb near the proximal portion of the tail
- strongly developed ventral tail fold posterior to the spine
- very small/reduced dorsal fold
- no conventional fish caudal fin

Do not make the tail look like:

- shark tail
- eel tail
- manta tail
- ribbonfish tail

The tail should taper gradually.

The ventral fold should visually continue rearward from the vicinity of the spine.

The tail can be long enough to materially contribute to the silhouette.

---

# 8. Mesh architecture

Prefer a structured quad-dominant topology.

The mesh must have sufficient subdivision to support smooth fin waves.

Requirements:

```text
central body:
moderate topology density

inner fin:
moderate-high topology density

outer 35% of pectoral fins:
high deformation density

fin perimeter:
clean continuous loops

tail:
multiple longitudinal segments
```

Avoid long skinny triangles across major deformation zones.

Avoid radial topology that causes obvious pinching at the disc center.

Subdivision Surface may be used non-destructively.

Recommended stack:

```text
Base Mesh
→ Armature
→ Corrective Shape Keys if required
→ Subdivision Surface
```

or another order if testing demonstrates a better result.

---

# 9. Optional procedural disc-outline construction

If building the mesh procedurally, construct several anterior-to-posterior sections.

Define normalized coordinate:

\[
u\in[0,1]
\]

where:

```text
u = 0 → anterior edge
u = 1 → posterior disc edge
```

Use a smooth width profile `w(u)` instead of an ellipse.

A practical control-point profile is:

```text
u       half-width fraction
0.00    0.00
0.10    0.30
0.22    0.63
0.42    0.94
0.52    1.00
0.68    0.78
0.84    0.43
1.00    0.12
```

Interpolate these using cubic Hermite, monotonic cubic interpolation, or another smooth interpolation.

Then:

\[
x(u,v)=s \cdot v\cdot w(u)
\]

where:

```text
v ∈ [0,1]
s = -1 left
s = +1 right
```

and:

\[
y(u)=\frac{L}{2}-uL
\]

This gives a structured front-to-back / center-to-edge coordinate system suitable for animation.

Do not blindly mirror a perfect mathematical shape.

After creating the base form, introduce very subtle deterministic anatomical asymmetry.

---

# 10. Rest-pose vertical form

Define static dorsal height as a combination of body-core volume and subtle fin curvature.

A useful conceptual model is:

\[
z_{rest}(u,v)
=
H_{core}
\cdot C(u)
\cdot (1-v)^q
+
H_{fin}(u,v)
\]

where:

- `C(u)` describes central-body thickness
- `v=0` is body center
- `v=1` is fin margin
- `q ≈ 1.5–2.5`

For example:

\[
C(u)=
\exp\left(
-\frac{(u-\mu)^2}{2\sigma^2}
\right)
\]

Suggested:

```text
μ ≈ 0.42
σ ≈ 0.26
```

Do not literally use the formula if sculpted geometry produces a better result.

The principle matters:

**center thick → margin thin.**

---

# 11. Rig architecture

Create:

```text
SRAY_RIG
```

Use a clean bone hierarchy.

Minimum high-level bones:

```text
root
body_master
body_front
body_mid
body_back

head_ctrl

tail_01
tail_02
...
tail_10 or tail_12
```

---

# 12. Fin deformation rig

The pectoral fins require distributed controls.

Do NOT create only:

```text
left_wing
right_wing
```

That would create manta/bird-like flapping.

Instead use a deformation grid.

Recommended per side:

```text
5–7 anterior/posterior stations
×
4–6 radial stations
```

Example:

```text
FRONT

L_FIN_U00_V01
L_FIN_U00_V02
L_FIN_U00_V03
L_FIN_U00_V04

L_FIN_U01_V01
L_FIN_U01_V02
...

...

L_FIN_U05_V04

BACK
```

Equivalent on right:

```text
R_FIN_...
```

Normalized control coordinates should be stored in Python:

```python
control.u
control.v
control.side
```

where:

```text
u = anterior → posterior
v = body core → outer margin
```

These values should drive procedural animation.

---

# 13. Weight painting

The body must not deform equally everywhere.

Define qualitative deformation stiffness:

```text
body center     0.05
inner disc      0.15–0.30
middle disc     0.40–0.65
outer disc      0.75–0.90
fin perimeter   1.00
```

These are conceptual deformation factors rather than literal Blender vertex weights.

The transition must be smooth.

No hard hinge line should be visible.

The outer fin should deform continuously.

---

# 14. Primary locomotion model

This is the central feature of the project.

Southern Stingray propulsion should be represented as a **travelling pectoral-fin wave**.

For each fin-control position define:

```text
u = front → back, normalized [0,1]
v = center → edge, normalized [0,1]
t = animation time in seconds
```

Base vertical deformation:

\[
z(u,v,t)
=
A(v)
\sin
\left(
2\pi(ft-ku)+\phi
\right)
\]

where:

- `A(v)` = radial amplitude envelope
- `f` = temporal wave frequency
- `k` = visible spatial wave count
- `φ` = phase offset

---

# 15. Radial amplitude envelope

The central body should remain much more stable than the outer pectoral margin.

Use:

\[
A(v)
=
A_{max}
\left[
smoothstep(v_0,1,v)
\right]^p
\]

with:

```text
v0 = 0.20–0.35
p  = 1.3–2.0
```

Recommended default:

```python
v0 = 0.27
p = 1.55
```

Implement:

```python
def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x-a)/(b-a)))
    return t*t*(3.0-2.0*t)

def radial_amp(v, a_max, v0=0.27, exponent=1.55):
    return a_max * smoothstep(v0, 1.0, v) ** exponent
```

---

# 16. Posterior-edge enhancement

The outer posterior area may receive slightly larger displacement.

Use:

\[
E(u,v)
=
1+\alpha uv
\]

with:

```text
α ≈ 0.10–0.25
```

Recommended:

```python
alpha = 0.18
```

Final displacement:

\[
z(u,v,t)
=
A(v)E(u,v)
\sin
\left[
2\pi(ft-ku)+\phi
\right]
\]

---

# 17. Travelling-wave direction

The visual wave must propagate:

```text
ANTERIOR
    ↓
MID DISC
    ↓
POSTERIOR
```

while the animal travels forward.

Verify the sign of the formula experimentally.

If the wave visually travels from posterior to anterior, reverse the sign of the spatial phase term.

The final visible behavior matters more than blindly preserving a sign convention.

---

# 18. Wave-count interpretation

`k` controls how many wave cycles are visible over the front-to-back fin length.

For relaxed Southern Stingray locomotion:

```text
k ≈ 0.9–1.6
```

Recommended default:

```python
wave_count = 1.25
```

Too low:

```text
k < 0.5
```

will resemble whole-wing oscillation.

Too high:

```text
k > 2.5
```

will make the fin look excessively rippled or nervous.

---

# 19. Frequency

For an aesthetically calm animation, expose:

```python
wave_frequency
```

Recommended artistic range:

```text
0.45–1.10 Hz
```

Default slow cruising:

```text
0.72 Hz
```

Do not treat these values as strict biological measurements.

They are animation-control values tuned for believable relaxed motion.

---

# 20. Wave amplitude

Use scale-relative amplitude.

Recommended:

\[
A_{max}
≈
0.025–0.055
\times
discWidth
\]

Default:

```python
A_max = DISC_WIDTH * 0.035
```

The centerline should move much less than this.

The outer edge should visibly ripple without looking like a flag in strong wind.

---

# 21. Convert displacement into rig deformation

Do not merely translate all fin bones vertically.

Use a combination of:

- local bone rotation
- small local vertical displacement
- neighboring bone interpolation

The preferred appearance is a curved membrane, not parallel control points moving vertically.

Estimate local longitudinal slope:

\[
\frac{\partial z}{\partial u}
\]

and radial slope:

\[
\frac{\partial z}{\partial v}
\]

Then approximate local orientation:

\[
\theta_u
=
\arctan
\left(
\frac{\partial z}{\partial u}
\right)
\]

\[
\theta_v
=
\arctan
\left(
\frac{\partial z}{\partial v}
\right)
\]

These slopes can drive subtle fin-bone rotations.

Exact analytical derivatives are optional.

Finite differences are acceptable:

```python
eps = 0.001

du = (
    fin_wave(u + eps, v, t)
    - fin_wave(u - eps, v, t)
) / (2 * eps)

dv = (
    fin_wave(u, v + eps, t)
    - fin_wave(u, v - eps, t)
) / (2 * eps)
```

Use rotations conservatively.

Avoid excessive twisting.

---

# 22. Left/right synchronization

During straight swimming, the left and right fins should be mostly coordinated.

However, they must not be mathematically perfect mirrors for long periods.

Base phase:

```python
phi_left = 0.0
phi_right = 0.0
```

Add only tiny slow deterministic asymmetry.

For example:

\[
\delta(t)=
a_1\sin(2\pi f_1t+\phi_1)
+
a_2\sin(2\pi f_2t+\phi_2)
\]

Suggested:

```text
a1 = 0.015 rad
a2 = 0.008 rad

f1 = 0.07 Hz
f2 = 0.113 Hz
```

Then:

```python
phi_left  +=  delta(t)
phi_right -=  delta(t) * 0.7
```

Do NOT use frame-by-frame random noise.

Random noise creates jitter.

Use smooth deterministic variation.

---

# 23. Natural frequency variation

Avoid robotic periodicity.

Use:

\[
f(t)=f_0[1+\epsilon_f(t)]
\]

where:

\[
\epsilon_f(t)=
0.025\sin(2\pi0.041t)
+
0.012\sin(2\pi0.073t+1.7)
\]

This creates extremely small slow variation.

Maximum frequency variation should normally remain below approximately 5%.

---

# 24. Natural amplitude variation

Similarly:

\[
A(t)=A_0[1+\epsilon_A(t)]
\]

with:

\[
\epsilon_A(t)=
0.04\sin(2\pi0.053t+0.8)
+
0.02\sin(2\pi0.097t)
\]

Avoid obvious pulsation.

The viewer should feel organic irregularity without consciously noticing it.

---

# 25. Body heave

The central body must not be perfectly frozen.

Use subtle vertical heave:

\[
z_b(t)
=
B
\sin
(2\pi f_bt+\psi)
\]

Recommended:

```text
B = 0.003–0.010 × disc_width
f_b = 0.15–0.35 Hz
```

Default:

```python
body_bob_amp = DISC_WIDTH * 0.005
body_bob_freq = 0.21
```

Body movement should be far smaller than fin-margin movement.

---

# 26. Body pitch

Add extremely subtle pitch.

For example:

\[
pitch(t)
=
P
\sin(2\pi f_pt+\psi_p)
\]

Suggested:

```text
P = 0.3°–1.2°
```

Do not create dolphin-like vertical swimming.

---

# 27. Tail physics model

The tail is primarily passive secondary motion.

It must not be the main source of propulsion.

The tail should respond to:

- body yaw
- body roll
- turning
- inertial lag
- hydrodynamic-looking damping

Create approximately:

```text
10–12 tail bones
```

---

# 28. Tail spring-damper equation

For each tail segment:

\[
I\ddot{\theta}
+
c\dot{\theta}
+
k(\theta-\theta_{target})
=
0
\]

Equivalent update form:

\[
\ddot{\theta}
=
-k_s(\theta-\theta_{target})
-c_d\dot{\theta}
\]

Implement numerically:

```python
angular_acceleration = (
    - stiffness * (angle - target_angle)
    - damping * angular_velocity
)

angular_velocity += angular_acceleration * dt
angle += angular_velocity * dt
```

Use progressively more delay toward the distal tail.

---

# 29. Simplified tail model fallback

If full spring simulation creates unstable or difficult-to-bake behavior, use deterministic delayed following.

For segment `i`:

\[
\theta_i(t)
=
s_i
\theta_{i-1}(t-\tau_i)
\]

Suggested:

```python
scale_i = 0.82–0.95
lag_i   = 0.015–0.040 sec per segment
```

Distal segments may have slightly larger lag.

Tail motion should be smooth.

No whipping unless specifically generating a startle behavior.

---

# 30. Turning system

Expose a single custom property:

```python
turn
```

Range:

```text
-1.0 = full left-turn command
 0.0 = straight
+1.0 = full right-turn command
```

Or use the opposite sign if documented consistently.

Turning should be generated by **differential fin behavior**, not only root yaw.

Use:

\[
A_L
=
A_{base}(1-\beta T)
\]

\[
A_R
=
A_{base}(1+\beta T)
\]

for one turn direction.

Invert for the other direction.

Suggested:

```text
β = 0.18–0.32
```

Default:

```python
turn_amp_gain = 0.25
```

---

# 31. Turning phase asymmetry

Additionally:

\[
\phi_L=-\gamma T
\]

\[
\phi_R=+\gamma T
\]

Suggested:

```text
γ = 0.08π–0.20π
```

Default:

```python
turn_phase_gain = 0.12 * math.pi
```

This should produce a more organic directional change.

---

# 32. Root yaw during turns

Differential fin motion alone may not translate the whole Blender object automatically.

Therefore create a physically plausible root trajectory.

Define forward speed:

\[
V
\]

and curvature:

\[
\kappa=C_TT
\]

Then yaw rate:

\[
\dot{\psi}
=
V\kappa
\]

Integrate:

\[
\psi_{t+\Delta t}
=
\psi_t+
V\kappa\Delta t
\]

Then integrate planar position:

\[
x_{t+\Delta t}
=
x_t+
V\sin(\psi)\Delta t
\]

\[
y_{t+\Delta t}
=
y_t+
V\cos(\psi)\Delta t
\]

Given the project convention:

```text
+Y = forward
```

adjust signs if necessary.

This generates an actual curved swimming path rather than rotating the ray in place.

---

# 33. Roll during turns

Add subtle banking:

\[
roll_{target}
=
R_{max}
\tanh(cT)
\]

Suggested:

```text
R_max = 3°–7°
```

Default:

```python
MAX_TURN_ROLL_DEG = 4.5
```

Smooth the roll.

Do not snap instantly.

---

# 34. Hover-height system

Southern Stingray behavior should feel benthic.

Default cruising height above ground:

```text
3–15 cm
```

depending on animal scale and scene.

Expose:

```python
hover_height
```

Recommended default:

```python
hover_height = 0.08
```

meters for the default model.

---

# 35. Vertical height controller

Use a smooth critically or near-critically damped height controller.

Let:

\[
e=z-z_{target}
\]

Then:

\[
\ddot z
=
-2\zeta\omega\dot z
-\omega^2e
\]

Recommended:

```text
ζ ≈ 0.85–1.0
```

This prevents unnatural bouncing.

Pseudo-code:

```python
accel_z = (
    -2.0 * damping_ratio * omega * velocity_z
    - omega * omega * (z - target_z)
)

velocity_z += accel_z * dt
z += velocity_z * dt
```

Use this for:

- hover
- rise
- descend
- settle

---

# 36. Ground avoidance

If a ground plane or substrate exists, determine ground distance using:

- ray casting
- known plane elevation
- evaluated scene geometry

Do not allow the disc to pass visibly through the substrate during normal cruise.

Account for the lowest point of fin deformation.

Target:

```text
minimum clearance >= 1–2 cm
```

during cruising.

During deliberate settling, the body may approach extremely close to the ground.

Avoid obvious intersection.

---

# 37. Required animation Actions

Create at least these Actions:

```text
SRAY_ACT_IDLE_HOVER
SRAY_ACT_SLOW_CRUISE
SRAY_ACT_CRUISE
SRAY_ACT_TURN_LEFT
SRAY_ACT_TURN_RIGHT
SRAY_ACT_RISE
SRAY_ACT_SETTLE
SRAY_ACT_RISE_AND_SETTLE
```

Optional:

```text
SRAY_ACT_STARTLE_SHORT
SRAY_ACT_SEARCH_BOTTOM
SRAY_ACT_LONG_GLIDE
```

---

# 38. Action 01 — IDLE_HOVER

Goal:

The animal is almost stationary but clearly alive.

Duration:

```text
8–14 seconds
```

Recommended:

```text
10 seconds
```

At 30 fps:

```text
300 frames
```

Behavior:

```text
wave frequency     ≈ 0.40–0.55 Hz
wave amplitude     ≈ 50–65% cruise amplitude
forward speed      ≈ almost zero
body bob           tiny
tail motion        tiny
yaw drift          extremely small
height drift       ±1–2 cm
```

The ray should not look frozen.

---

# 39. Action 02 — SLOW_CRUISE

This is the main hero animation.

Duration:

```text
10–16 seconds
```

Recommended:

```text
12 seconds
```

Behavior:

```text
wave frequency ≈ 0.65–0.80 Hz
wave count     ≈ 1.2–1.4
Amax           ≈ 3–4% disc width
```

Forward speed:

approximately:

```text
0.15–0.35 disc lengths / second
```

for the meditative version.

Movement should read as:

```text
wave
→ glide
→ wave
→ glide
```

but without stopping the wave entirely.

---

# 40. Action 03 — NORMAL_CRUISE

Slightly more energetic.

Suggested:

```text
frequency ≈ 0.85–1.0 Hz
amplitude ≈ 3.5–4.5% disc width
speed     ≈ 0.30–0.55 disc lengths/sec
```

Increasing speed should rely more on increased frequency than dramatically larger fin amplitude.

---

# 41. Action 04/05 — TURN_LEFT / TURN_RIGHT

Duration:

```text
6–10 seconds
```

Recommended:

```text
8 sec
```

Turn radius should be broad and graceful.

Requirements:

- differential left/right fin amplitude
- small left/right phase difference
- gradual root yaw
- actual curved trajectory
- small body roll
- no pivot-in-place
- no abrupt direction change

---

# 42. Action 06 — RISE

Duration:

```text
5–8 sec
```

Behavior:

- increase hover target gradually
- slightly increase pectoral activity
- pitch only slightly
- tail follows with delay

Vertical movement must remain calm.

---

# 43. Action 07 — SETTLE

Duration:

```text
6–10 sec
```

Behavior:

- reduce forward velocity
- reduce fin amplitude
- descend toward substrate
- flatten pitch
- reduce tail motion
- remain subtly alive

At completion, fin edges may continue small local motion.

---

# 44. Action 08 — RISE_AND_SETTLE

Duration:

```text
10–16 seconds
```

Ideal for ambient loops.

Pattern:

```text
near bottom
→ subtle rise
→ brief hover
→ slow descent
→ near bottom
```

Avoid obvious sinusoidal elevator motion.

Use eased transitions.

---

# 45. Optional SEARCH_BOTTOM behavior

Southern Stingray is a benthic feeder.

Create an optional subtle exploratory behavior.

Do not make it theatrical.

Possible motion:

- reduce height
- slow forward movement
- slight local fin agitation
- slightly adjust pitch toward substrate
- short shallow lateral sweep

If actual sand simulation exists, optionally create subtle substrate disturbance.

Do not add expensive particle simulation unless requested or already available.

---

# 46. Optional STARTLE_SHORT behavior

This is secondary, not the default aesthetic.

Duration:

```text
2–4 sec
```

Behavior:

- rapidly increase frequency
- moderately increase amplitude
- brief forward acceleration
- increase tail lag
- then return to calm cruise

Do not make it jump like a bird.

Do not use extreme tail propulsion.

---

# 47. State-machine design

Create a reusable behavior abstraction.

Recommended states:

```python
IDLE
CRUISE_SLOW
CRUISE
TURN_LEFT
TURN_RIGHT
RISE
SETTLE
```

Potential transitions:

```text
IDLE
→ CRUISE_SLOW
→ TURN
→ CRUISE_SLOW
→ RISE
→ SETTLE
→ IDLE
```

Avoid repeating the same action continuously.

The animation system should support future random sequencing, although deterministic Actions are the immediate deliverable.

---

# 48. Animation blending

All clips should be:

- loopable when appropriate
- NLA-compatible
- blendable
- based on consistent rest pose
- free of large discontinuities

For cyclic Actions, ensure:

\[
pose(t_0)\approx pose(t_1)
\]

and preferably:

\[
\dot{pose}(t_0)\approx\dot{pose}(t_1)
\]

Avoid merely copying the first keyframe onto the last if doing so causes a velocity discontinuity.

Use Cycles modifiers where appropriate.

---

# 49. Blender custom properties

Create animator-facing properties on `body_master` or an appropriate control.

Minimum:

```text
wave_frequency
wave_amplitude
wave_count

fin_edge_gain
fin_posterior_gain

turn
turn_amp_gain
turn_phase_gain

body_bob_amplitude
body_bob_frequency

hover_height

tail_stiffness
tail_damping
tail_follow_gain

motion_seed
```

Expose sensible min/max ranges.

---

# 50. Recommended defaults

Use approximately:

```python
wave_frequency = 0.72
wave_amplitude = DISC_WIDTH * 0.035
wave_count = 1.25

fin_edge_gain = 1.0
fin_posterior_gain = 0.18

turn = 0.0
turn_amp_gain = 0.25
turn_phase_gain = 0.12 * math.pi

body_bob_amplitude = DISC_WIDTH * 0.005
body_bob_frequency = 0.21

hover_height = 0.08

tail_stiffness = 12.0
tail_damping = 5.0
tail_follow_gain = 0.86

motion_seed = 37
```

Adjust if empirical Blender preview demonstrates better values.

---

# 51. Procedural implementation structure

Organize Python code rather than writing one enormous unmaintainable script.

Recommended structure:

```text
southern_stingray/
│
├── build_all.py
│
├── config.py
│
├── geometry.py
│
├── materials.py
│
├── rig.py
│
├── locomotion.py
│
├── tail_dynamics.py
│
├── actions.py
│
├── validation.py
│
└── save_scene.py
```

If the environment requires one script, preserve equivalent classes/functions internally.

---

# 52. Suggested Python API structure

Create clear functions such as:

```python
create_stingray_mesh()
create_tail_geometry()

create_materials()

create_armature()
create_fin_controls()
create_tail_chain()

bind_mesh_to_rig()
generate_weights()

evaluate_fin_wave()
evaluate_turning()
evaluate_body_motion()
simulate_tail()

bake_action()
build_all_actions()

validate_mesh()
validate_rig()
validate_actions()
validate_scene()

save_blend()
```

Do not scatter scene mutations everywhere.

---

# 53. Naming convention

Collections:

```text
SRAY
SRAY_MODEL
SRAY_RIGGING
SRAY_ENV
SRAY_DEBUG
```

Objects:

```text
SRAY_BODY
SRAY_RIG
SRAY_EYE_L
SRAY_EYE_R
SRAY_GROUND
```

Materials:

```text
SRAY_MAT_DORSAL
SRAY_MAT_VENTRAL
SRAY_MAT_EYE
```

Actions:

```text
SRAY_ACT_*
```

Custom shape objects:

```text
SRAY_CTRL_SHAPE_*
```

Avoid generic names such as:

```text
Cube
Cube.001
Armature
Material
Plane
```

in the finished scene.

---

# 54. Materials

The dorsal surface should use muted natural colors.

Target:

- olive brown
- gray brown
- muted sandy brown
- subtle irregular tonal variation

The ventral surface:

- pale warm gray
- off-white
- slightly darker around outer disc margin if visually useful

Skin appearance:

- smooth
- slightly wet
- soft specular reflection
- not glossy plastic
- extremely subtle micro-bump

Use procedural noise for very mild color breakup.

Do not make the surface look scaly.

---

# 55. Eye material

Eyes should be:

- dark
- slightly glossy
- subtle highlight
- not cartoonishly large

Optional small transparent/corneal outer surface is acceptable but not necessary.

---

# 56. Lighting test scene

Create a simple neutral test environment if none exists.

Minimum:

- ground plane
- one large soft Area Light
- optional subtle fill
- neutral world illumination

Create at least:

```text
SRAY_CAM_TOP_3Q
SRAY_CAM_SIDE
```

The main inspection camera should make fin-wave direction easy to see.

Do not spend excessive time building a complex environment.

The ray asset is the priority.

---

# 57. Debug visualization

Provide an optional debug mode.

When enabled, visualize:

- fin-control bones
- `u` positions
- `v` positions
- left/right side
- wave phase
- outer-edge weighting

Potentially use empties or colored debug objects.

Debug objects should live in:

```text
SRAY_DEBUG
```

and be hidden in final render.

---

# 58. Animation-generation pseudo-code

Core function:

```python
import math


def clamp01(x):
    return max(0.0, min(1.0, x))


def smoothstep(a, b, x):
    t = clamp01((x - a) / (b - a))
    return t * t * (3.0 - 2.0 * t)


def radial_amplitude(v, a_max, v0=0.27, exponent=1.55):
    return (
        a_max
        * smoothstep(v0, 1.0, v) ** exponent
    )


def posterior_gain(u, v, alpha=0.18):
    return 1.0 + alpha * u * v


def organic_frequency_offset(t):
    return (
        0.025 * math.sin(2.0 * math.pi * 0.041 * t)
        + 0.012 * math.sin(
            2.0 * math.pi * 0.073 * t + 1.7
        )
    )


def organic_amplitude_offset(t):
    return (
        0.04 * math.sin(
            2.0 * math.pi * 0.053 * t + 0.8
        )
        + 0.02 * math.sin(
            2.0 * math.pi * 0.097 * t
        )
    )


def fin_wave(
    u,
    v,
    t,
    base_amplitude,
    base_frequency,
    wave_count,
    phase=0.0,
):
    freq = base_frequency * (
        1.0 + organic_frequency_offset(t)
    )

    amp = radial_amplitude(
        v,
        base_amplitude
    )

    amp *= (
        1.0
        + organic_amplitude_offset(t)
    )

    amp *= posterior_gain(u, v)

    theta = (
        2.0
        * math.pi
        * (
            freq * t
            - wave_count * u
        )
        + phase
    )

    return amp * math.sin(theta)
```

---

# 59. Turning pseudo-code

Use signed turn:

```python
def fin_turn_parameters(
    side,
    turn,
    base_amp,
    amp_gain=0.25,
    phase_gain=0.12 * math.pi,
):
    # choose and document sign convention

    if side == "LEFT":
        side_sign = -1.0
    else:
        side_sign = 1.0

    amplitude_multiplier = (
        1.0
        + side_sign
        * amp_gain
        * turn
    )

    phase = (
        side_sign
        * phase_gain
        * turn
    )

    return (
        base_amp * amplitude_multiplier,
        phase,
    )
```

Test the actual visual turn direction.

If the physical result is inverted, correct the sign convention globally.

---

# 60. Body motion pseudo-code

```python
def body_heave(
    t,
    amplitude,
    frequency,
    phase=0.0,
):
    return amplitude * math.sin(
        2.0
        * math.pi
        * frequency
        * t
        + phase
    )
```

Use another lower-amplitude channel for pitch if needed.

---

# 61. Tail simulation pseudo-code

```python
class TailSegmentState:
    def __init__(self):
        self.angle = 0.0
        self.velocity = 0.0


def update_spring(
    state,
    target,
    stiffness,
    damping,
    dt,
):
    acceleration = (
        -stiffness
        * (state.angle - target)
        - damping
        * state.velocity
    )

    state.velocity += acceleration * dt
    state.angle += state.velocity * dt

    return state.angle
```

For each segment:

```python
target = previous_segment_angle * follow_gain
```

Use progressively reduced stiffness or increased delay toward tail tip if helpful.

The simulation must remain stable at the project's frame rate.

---

# 62. Bake animations

Procedural behavior should ultimately be bakeable.

For each Action:

1. define state parameters;
2. evaluate rig pose frame by frame;
3. insert keyframes;
4. clean redundant keys where safe;
5. assign descriptive Action name;
6. verify loop;
7. optionally add Cycles modifier.

Do not require the user to run the generator every time merely to see the animation.

The saved `.blend` must already contain usable Actions.

---

# 63. Frame rate

Use:

```text
30 fps
```

unless an existing scene clearly uses another rate.

All time calculations should use:

```python
t = frame / fps
```

or:

```python
t = (frame - start_frame) / fps
```

Do not hardcode animation physics in frame units.

---

# 64. Determinism

The same:

```text
motion_seed
parameters
Action settings
```

must reproduce the same animation.

Do not rely on non-seeded random calls.

Prefer smooth deterministic oscillators instead of noise where possible.

---

# 65. Performance

Do not create an unnecessarily huge mesh.

Target a working interactive rig.

Suggested ranges before final subdivision:

```text
body mesh:
roughly 5k–20k vertices

final evaluated:
reasonable for interactive Blender playback
```

The exact count is flexible.

Animation quality matters more than arbitrary polygon targets.

---

# 66. Critical visual QA

The final asset fails if any of the following are true.

## Failure A — Bird motion

Both sides behave as rigid wings moving:

```text
UP
DOWN
UP
DOWN
```

Reject and redesign fin deformation.

---

## Failure B — Manta motion

The entire fin performs one large sweeping flap with little anterior/posterior phase difference.

Reject.

Increase spatial phase variation.

---

## Failure C — Flying carpet

The ray is extremely thin everywhere and looks like cloth.

Reject.

Increase central body volume and local stiffness.

---

## Failure D — Shark motion

Tail oscillation appears to create propulsion.

Reject.

Reduce active tail oscillation and increase passive following.

---

## Failure E — Mechanical wave

Every cycle is perfectly identical.

Reject.

Add low-frequency deterministic microvariation.

---

## Failure F — Excessive fin ripples

The pectoral disc looks like fabric under wind.

Reject.

Reduce:

```text
wave_count
amplitude
high-frequency components
```

---

## Failure G — Floating pelagic behavior

The animal spends most of its time far from the substrate.

Reject for default Actions.

Move the behavioral envelope closer to the bottom.

---

# 67. Quantitative QA

Add programmatic checks where possible.

### Center rigidity

Maximum central body vertical deformation should be much smaller than outer-edge deformation.

Target:

\[
\frac{
A_{center}
}{
A_{edge}
}
<
0.25
\]

Prefer:

```text
< 0.15
```

---

### Wave progression

Sample at:

```text
u = 0.20
u = 0.50
u = 0.80
```

with equal `v`.

Their phase must not be identical.

Confirm visible front-to-back phase progression.

---

### Fin symmetry

Straight cruising should have near-equal average left/right amplitude:

\[
\left|
\bar A_L-\bar A_R
\right|
\]

should remain small.

Turning Actions should intentionally violate this equality.

---

### Tail movement

Tail-root motion should remain primarily inherited.

Tail-tip motion should show increased lag.

No high-amplitude periodic tail sweep should dominate the silhouette.

---

### Ground clearance

During `SLOW_CRUISE`:

```text
no substantial mesh-ground penetration
```

During `SETTLE`:

minor numerical near-contact is acceptable, but visible clipping is not.

---

# 68. Loop QA

For loopable Actions, compare initial and final poses.

For each important control bone:

```python
position_error
rotation_error
scale_error
```

Set reasonable thresholds.

For example:

```text
position error < 0.002 m
rotation error < 0.5°
```

where applicable.

Also visually inspect transition over several repeated loops.

---

# 69. Scene validation function

Create:

```python
validate_scene()
```

It should report at least:

```text
mesh exists
rig exists
armature bound
fin controls exist
tail chain exists
required custom properties exist
required Actions exist
materials assigned
camera exists
no missing object references
no obvious invalid modifiers
output file saved
```

Print:

```text
PASS
WARN
FAIL
```

per item.

---

# 70. Biological-shape QA

Before finalizing, inspect the ray from above.

Verify:

- broad angular/rhomboid disc
- width approximately 1.2 × disc length
- modest head elevation
- eyes and spiracles dorsal
- long whip-like tail
- pronounced ventral tail fold
- no manta cephalic horns
- no fish-like tail fin

---

# 71. Animation visual QA

Preview from:

### Camera A
three-quarter top view

Checks:

- silhouette
- fin-wave propagation
- left-right coordination
- tail follow

### Camera B
low side view

Checks:

- central body stability
- ground clearance
- vertical displacement
- rise/settle motion

### Camera C
rear three-quarter optional

Checks:

- posterior fin wave
- tail lag
- body roll

---

# 72. Artistic target

The primary target mood is:

```text
quiet
graceful
benthic
calm
meditative
organic
subtle
slightly dreamlike
anatomically believable
```

Movement should appear effortless.

A viewer should feel:

> the ray is gliding through the medium by continuously reshaping its pectoral disc

rather than:

> the ray is flapping its wings.

---

# 73. Preferred final movement signature

The hero `SLOW_CRUISE` clip should approximately look like:

```text
front fin receives small deformation
        ↓
wave travels backward
        ↓
outer margin responds more strongly
        ↓
rear edge finishes wave
        ↓
ray continues to glide
        ↓
next wave arrives
```

There should always be more than one fin region in different phases.

---

# 74. Interaction between speed and frequency

If generating multiple cruise speeds, do not scale every parameter proportionally.

Prefer:

\[
f=f_0+k_fV
\]

while amplitude increases more slowly:

\[
A=A_0+k_AV
\]

with:

\[
k_A < k_f
\]

in normalized influence.

In plain terms:

**faster swimming should primarily increase wave frequency, not turn into enormous wing flaps.**

---

# 75. Suggested animation presets

Create reusable parameter dictionaries.

```python
PRESET_IDLE = {
    "frequency": 0.46,
    "amplitude_scale": 0.55,
    "wave_count": 1.05,
    "speed": 0.01,
}

PRESET_SLOW_CRUISE = {
    "frequency": 0.72,
    "amplitude_scale": 1.00,
    "wave_count": 1.25,
    "speed": 0.24,
}

PRESET_CRUISE = {
    "frequency": 0.92,
    "amplitude_scale": 1.12,
    "wave_count": 1.32,
    "speed": 0.42,
}

PRESET_TURN = {
    "frequency": 0.78,
    "amplitude_scale": 1.02,
    "wave_count": 1.25,
    "speed": 0.20,
    "turn": 0.42,
}
```

Speed units should be documented.

Prefer normalized disc lengths per second or explicit meters per second.

---

# 76. Exposed animator controls

Create an intuitive control hierarchy.

The animator should be able to modify:

```text
MASTER

Movement
 ├─ Speed
 ├─ Wave Frequency
 ├─ Wave Amplitude
 ├─ Wave Count
 └─ Turn

Body
 ├─ Hover Height
 ├─ Bob Amount
 ├─ Pitch Amount
 └─ Roll Gain

Tail
 ├─ Follow Gain
 ├─ Stiffness
 └─ Damping

Organic
 ├─ Variation Amount
 └─ Motion Seed
```

Do not require manual editing of twenty individual fin bones for normal use.

Individual controls may still exist for artistic correction.

---

# 77. Corrective shapes

If extreme fin deformation causes:

- volume collapse
- mesh folding
- unnatural creasing

create corrective Shape Keys.

Possible:

```text
SRAY_CORRECT_FIN_UP
SRAY_CORRECT_FIN_DOWN
SRAY_CORRECT_TURN_L
SRAY_CORRECT_TURN_R
```

Use only where necessary.

Do not overcomplicate if weighting solves the issue.

---

# 78. NLA configuration

Create a clean NLA demonstration setup.

Recommended:

```text
Track: SRAY_BASE
Track: SRAY_BEHAVIOR
Track: SRAY_SECONDARY
```

However, do not create redundant layers merely for appearance.

At minimum, Actions must be easily available in Action Editor and ready for NLA use.

---

# 79. Output files

Final deliverables:

```text
southern_stingray.blend
```

and reusable scripts:

```text
build_all.py
geometry.py
rig.py
locomotion.py
actions.py
validation.py
```

or equivalent.

Also write:

```text
README.md
```

with:

- how to rebuild
- how to generate Actions
- main custom parameters
- object naming
- coordinate conventions
- known limitations

---

# 80. Save behavior

Always save the Blender file after successful generation.

Before saving final:

1. run validation;
2. resolve all FAIL conditions;
3. review warnings;
4. set scene to hero Action;
5. set useful preview frame;
6. save.

Do not save only temporary `.blend1` output.

---

# 81. Completion criteria

The task is complete only when all of the following are true:

```text
[ ] Southern Stingray mesh exists

[ ] species silhouette is recognizable

[ ] central body has volume

[ ] pectoral margins are thin and flexible

[ ] tail anatomy is appropriate

[ ] complete armature exists

[ ] distributed fin controls exist

[ ] tail chain exists

[ ] rig is properly weighted

[ ] travelling-wave animation works

[ ] wave moves anterior → posterior

[ ] amplitude increases center → edge

[ ] tail acts primarily passively

[ ] slow cruise Action exists

[ ] hover Action exists

[ ] left turn Action exists

[ ] right turn Action exists

[ ] rise Action exists

[ ] settle Action exists

[ ] Actions are NLA compatible

[ ] custom properties exist

[ ] materials exist

[ ] debug/validation functions exist

[ ] scene passes validation

[ ] final .blend has been saved

[ ] scripts remain reusable
```

---

# 82. Priority order if trade-offs are required

If implementation time or tooling forces trade-offs, prioritize:

```text
1. Correct fin locomotion
2. Correct Southern Stingray silhouette
3. Good deformation / weighting
4. Tail secondary motion
5. Multiple Actions
6. Animator controls
7. Material quality
8. Fine anatomical details
9. Environment / presentation
```

Never sacrifice locomotion quality merely to make a prettier shader.

---

# 83. Non-negotiable final visual test

Play `SRAY_ACT_SLOW_CRUISE` for at least three repeated loops.

Observe only the silhouette.

Ask:

> If the texture and eyes were removed, would the motion still unmistakably look like a benthic stingray using a travelling pectoral-fin wave?

If the answer is no, the task is not finished.

Fix the locomotion before final delivery.

---

# 84. Final instruction

Do not optimize for dramatic animation.

Optimize for:

**subtle biological plausibility + beautiful continuous motion.**

The preferred result is a Southern Stingray that can eventually be placed inside a quiet surreal architectural scene, swimming only slightly above an otherwise dry floor.

It should feel as though the animal genuinely inhabits that space.

The movement itself needs to carry the illusion.

Build the system so that future scenes can control the ray with only a small set of high-level properties, without rebuilding the rig or manually animating every fin control.