可以，而且這個場景我會跟前面的長鰭錦鯉做成**完全不同的一套行為系統**。

這張圖需要的不是「優雅地一直游」，而是那種很小的魚群：

> 原本散在植物附近，幾乎停著
> 幾隻突然改變方向
> 接著整群跟上
> 很快穿過一道光
> 又鑽進陰影
> 過一陣子重新聚回植物旁邊

這種動態我會優先選 **青鱂／日本米魚（Medaka, *Oryzias latipes*）**，比孔雀魚更符合這張畫面的低調、野生、小型、日常感。

而且有個很重要的生物學細節：青鱂並不是典型「burst-and-coast、衝一下停一下」的魚，研究觀察到牠們持續使用身體與尾部波動游泳，但可以明顯區分成**加速、減速、長時間等速**等運動狀態；群體也會形成同步游動，而且社會反應會隨運動狀態改變。這其實非常適合做成我們要的 state machine：不是魚瞬間 teleport，而是「整群突然進入 acceleration state」。([PubMed][1])

下面我直接幫你寫成 Codex 可以接手的完整工程任務書。

---

# Codex 任務書

## Medaka Small Shoal System for Rainy Quiet Space

### 0. 任務角色

You are acting as a senior Blender technical artist, creature animator, procedural behavior engineer, and Blender Python developer.

Your task is to build a complete reusable **Japanese Medaka / Japanese Rice Fish (`Oryzias latipes`) shoaling system** for Blender.

The target scene is a quiet, dark, rain-soaked architectural corner containing:

* deep shadow
* a narrow shaft of light
* one small plant growing beside a wall
* wet / dark surrounding surfaces
* large areas outside the light
* a small group of fish moving freely through both light and darkness

The fish must behave like **small social fish inhabiting the space**, not like decorative particles.

The primary visual behavior should alternate between:

* loose gathering near vegetation
* slow local cruising
* short pauses
* coordinated changes of direction
* sudden collective acceleration
* fast crossings from one side of the scene to another
* temporary dispersal
* reforming into a loose shoal

The scene should feel alive even after watching it for several minutes.

---

# 1. Species target

Primary biological reference:

## **Japanese Medaka / Japanese Rice Fish**

### `Oryzias latipes`

Use medaka as the behavioral and morphological base.

Why:

* very small body
* simple, restrained silhouette
* suitable for groups
* strong social / shoaling behavior
* capable of synchronized group movement
* visually compatible with vegetation
* does not dominate a minimalist scene

Medaka are known to show strong shoaling attraction to conspecific biological motion, and collective swimming formations can emerge from individual responses rather than a permanent fixed leader. ([PubMed Central (PMC)][2])

---

# 2. Important behavioral interpretation

Do **NOT** implement the fish as:

```text
stationary
→ instant burst
→ coast completely motionless
→ instant burst
```

Instead use:

```text
constant slow swimming
        ↓
social / environmental trigger
        ↓
acceleration state
        ↓
high-speed coordinated crossing
        ↓
deceleration
        ↓
slow swimming / regrouping
```

This is closer to observed medaka swimming kinematics, where continuous swimming can be segmented into acceleration, deceleration, and prolonged constant-speed states. ([PubMed][1])

The important artistic result is still:

> 「突然整群快速游走」

but technically it should be generated through rapid acceleration rather than teleportation or abrupt animation switching.

---

# 3. Artistic target

The fish should feel:

```text
small
quiet
alert
social
curious
slightly unpredictable
natural
fragile
fast when necessary
```

Not:

```text
ornamental
majestic
slow and ceremonial
brightly tropical
cartoonish
mechanically synchronized
```

Unlike the previous Butterfly Koi system:

```text
Butterfly Koi:
slow / graceful / flowing / individual

Medaka:
small / reactive / collective / quick
```

---

# 4. Group size

Recommended:

```text
18–28 fish
```

Default:

```python
FISH_COUNT = 22
```

Why not seven like the koi:

Because medaka should visually read as a **small shoal**, not seven individual hero animals.

Recommended visual subdivision:

```text
main shoal:       12–16
secondary cluster: 4–6
occasional strays: 1–3
```

But these are not permanent groups.

They should merge and separate dynamically.

---

# 5. Fish scale

Use real-world-like small proportions.

Recommended:

```python
BODY_LENGTH_MIN = 0.030
BODY_LENGTH_MAX = 0.045
BODY_LENGTH_MEAN = 0.038
```

approximately 3–4.5 cm.

Individual variation:

```text
0.88–1.12 × master size
```

Do not enlarge the fish merely to make them visible.

Use lighting and group movement to make them readable.

---

# 6. Morphology

The Master Medaka should have:

* slender elongated body
* small rounded head
* terminal / slightly superior mouth
* relatively large eyes for body size
* narrow caudal peduncle
* small dorsal fin positioned posteriorly
* anal fin positioned posteriorly
* small pectoral fins
* modest fan-shaped caudal fin

The silhouette should remain simple.

Avoid:

* fancy goldfish body
* huge guppy tail
* koi proportions
* exaggerated belly
* long ornamental fins

---

# 7. Color palette

For this particular scene:

## Recommended

```text
70% silver-gray / pale olive
15% pale cream
10% muted dark gray
5% slightly warm pale gold
```

Optional subtle variations:

* translucent fins
* faint olive dorsal region
* silver belly
* very subtle pearl-like reflection

Do not use strong neon guppy colors.

The fish should sometimes almost disappear in shadow.

That is desirable.

When they cross the light shaft they should briefly become visible.

---

# 8. Scene-specific behavior philosophy

This system must **not confine fish to the beam of light**.

This is extremely important.

For the koi scene:

```text
light = home
```

For this medaka scene:

```text
whole environment = home

plant = point of interest

light = temporary spatial event
```

The fish should freely travel:

```text
shadow
→ plant
→ light
→ shadow
→ plant
```

The light should reveal them rather than imprison them.

---

# 9. Spatial zones

Create explicit behavioral zones.

## Zone A — Plant Affinity Zone

Centered around the plant.

Example:

```python
PLANT_CENTER = Vector(...)
PLANT_RADIUS = 0.35
```

Fish may:

* gather here
* hover
* inspect leaves
* orbit slowly
* pass between plant and wall
* reform their shoal here

Plant attraction should be probabilistic, not permanent.

---

# 10. Zone B — Light Shaft

Define as a soft volume.

Example:

```python
LIGHT_CENTER
LIGHT_WIDTH
LIGHT_DEPTH
LIGHT_HEIGHT
```

Do **not** pull fish permanently toward it.

Instead light can slightly affect behavior probability.

For example:

```text
inside light:
slightly higher visibility
slightly reduced lingering probability
normal swimming speed

outside light:
normal movement
possible plant regrouping
```

The beam is primarily visual.

---

# 11. Zone C — Shadow Roaming Area

Shadow areas must be valid destinations.

Fish should periodically disappear into darkness.

This is desirable because it creates:

```text
absence
→ expectation
→ sudden reappearance
```

which fits the quiet scene.

---

# 12. Zone D — Transition Corridors

Automatically derive several natural paths:

```text
plant ↔ left shadow
plant ↔ upper shadow
plant ↔ light shaft
light ↔ deep shadow
```

Do not literally constrain fish to spline tracks.

Use these only as soft behavioral preferences during fast group transitions.

---

# 13. Core group behavior

Do not use standard high-alignment Boids.

Use:

# **State-dependent loose shoaling**

Base forces:

$$
F =
w_cF_c
+
w_sF_s
+
w_aF_a
+
w_wF_w
+
w_pF_p
+
w_oF_o
$$

Where:

* \(F_c\) = cohesion
* \(F_s\) = separation
* \(F_a\) = alignment
* \(F_w\) = wander
* \(F_p\) = plant / zone attraction
* \(F_o\) = obstacle avoidance

---

# 14. Base slow-state weights

Recommended:

```python
COHESION_SLOW   = 0.42
SEPARATION_SLOW = 0.72
ALIGNMENT_SLOW  = 0.28
WANDER_SLOW     = 0.45
```

This produces:

```text
same general group
but not military formation
```

---

# 15. Fast collective-state weights

During collective acceleration:

```python
COHESION_FAST   = 0.62
SEPARATION_FAST = 0.65
ALIGNMENT_FAST  = 0.82
WANDER_FAST     = 0.08
```

This is important.

When the school suddenly crosses the scene:

**alignment becomes temporarily strong.**

Therefore:

```text
slow behavior:
loose

fast behavior:
coordinated
```

This difference is what will make the animals feel intelligent.

---

# 16. Required behavioral states

Create at least:

```python
LOCAL_CRUISE
PLANT_HOVER
LOOSE_SHOAL
GROUP_ACCELERATE
FAST_TRANSIT
GROUP_DECELERATE
REGROUP
SCATTER_MINOR
SHADOW_ROAM
```

---

# 17. LOCAL_CRUISE

Default individual state.

Behavior:

* low to moderate speed
* loose neighbor response
* small direction changes
* continuous body undulation
* may pass through light or shadow

Duration:

```text
3–12 sec
```

---

# 18. PLANT_HOVER

Triggered when some fish enter the plant region.

Behavior:

* lower speed
* smaller circular routes
* slightly stronger separation
* weak attraction to leaf / stem vicinity
* frequent small heading corrections

Do not make them stop completely.

Typical duration:

```text
3–10 sec
```

---

# 19. LOOSE_SHOAL

Several fish gradually align.

Behavior:

```text
cohesion ↑
alignment ↑ slightly
wander ↓
```

This often prepares the group for a larger transition.

It should look like:

> 「魚群好像突然有了一個共識」

without a visible leader command.

---

# 20. GROUP_ACCELERATE

This is the key behavior.

The group receives a shared movement target.

Example target:

```text
plant → left darkness
darkness → light
light → plant
```

Speed should ramp smoothly.

Use:

$$
v(t)=v_0+(v_1-v_0)S(t)
$$

where:

$$
S(t)=3t^2-2t^3
$$

for normalized \(t\in[0,1]\).

Better still use acceleration constraints rather than directly setting velocity.

---

# 21. FAST_TRANSIT

This is the dramatic small-fish motion.

Typical duration:

```text
0.6–2.0 sec
```

During this period:

* alignment high
* cohesion moderate-high
* wander almost zero
* heading changes limited
* body beat frequency significantly increased
* group stretches slightly along direction of travel

Visually:

```text
       • •
    • • • •
 • • • • • •  >>>>>>>>
      • •
```

rather than a perfect ball.

---

# 22. GROUP_DECELERATE

After crossing:

* speed gradually drops
* alignment weakens
* separation increases
* fish begin occupying local space again

Duration:

```text
0.5–1.5 sec
```

Do not instantly return to idle.

---

# 23. REGROUP

After fast transit:

```text
alignment ↓
cohesion remains moderate
wander slowly returns
```

Some fish reach the destination first.

Others arrive after a slight delay.

Within:

```text
1–4 sec
```

the shoal becomes loose again.

---

# 24. SCATTER_MINOR

Occasional local disturbance.

Not all fish participate.

Example:

```text
2–5 nearby fish
briefly separate
then return
```

This adds life without turning the scene chaotic.

---

# 25. SHADOW_ROAM

Important ambient behavior.

A subgroup:

```text
3–8 fish
```

may leave the visible light and disappear into dark space.

Later:

* return
* merge into main group
* pass through the light

Do not force the entire school to remain on camera.

---

# 26. Collective event propagation

A group burst should not begin on the exact same frame for every fish.

Instead create a **reaction wave**.

Suppose fish `j` initiates the event.

For fish `i`:

$$
t_i=t_0+\tau_i
$$

Where:

$$
\tau_i=
\tau_{base}
+
k_dd_{ij}
+
\epsilon_i
$$

Suggested:

```text
base delay    0.00–0.04 sec
distance term 0–0.10 sec
random jitter ±0.03 sec
```

Typical whole-group spread:

```text
0.05–0.25 sec
```

Therefore visually:

```text
fish 1 accelerates
30 ms
fish 2
20 ms
fish 3
70 ms
rest of school
```

At 30 fps this difference can be subtle.

At 60 fps it is more readable.

---

# 27. No permanent leader

Do not select:

```python
LEADER_FISH = 0
```

for the whole simulation.

Instead event initiator should vary.

Possible trigger initiators:

* nearest plant fish
* edge-of-group fish
* randomly selected socially connected fish
* environmental target change

This reflects the idea that shoaling can emerge from distributed individual decisions rather than fixed leader control. ([PubMed Central (PMC)][3])

---

# 28. Speed model

Use body lengths per second for tuning.

Given:

```text
body length ≈ 0.038 m
```

Recommended artistic values:

### Local slow

```text
1–2 BL/s
≈ 0.04–0.08 m/s
```

### Normal group transit

```text
2–4 BL/s
≈ 0.08–0.16 m/s
```

### Fast short transition

```text
4–7 BL/s
≈ 0.15–0.27 m/s
```

These are animation targets, not claims of measured species maximum speeds.

Expose all as configurable parameters.

---

# 29. Acceleration

Avoid instant speed changes.

Recommended:

```python
ACCEL_NORMAL = 0.10
ACCEL_FAST   = 0.35
DECEL_FAST   = 0.28
```

in scene-scale meters per second squared, then tune visually.

Use:

$$
v_{t+\Delta t}
=
v_t+
clamp(v_{target}-v_t,-a_d\Delta t,a_a\Delta t)
$$

---

# 30. Steering dynamics

Each fish has:

```python
position
velocity
heading
target_heading
angular_velocity
state
```

Use a maximum turn rate.

Slow:

```text
90–160° / sec
```

Fast transit:

```text
60–120° / sec
```

Counterintuitively, during fast transit restrict sharp turning somewhat.

This makes movement look committed rather than jittery.

---

# 31. Single-fish swimming rig

Because the fish are tiny, keep the rig efficient.

Use:

```text
root
body_master

spine_01
spine_02
spine_03
spine_04
tail_base
tail_tip

pectoral_L
pectoral_R

dorsal
anal
```

Approximately:

```text
8–10 deformation bones
```

is enough.

Do not create a 40-bone hero rig for 22 tiny fish.

---

# 32. Body swimming formula

Use continuous lateral undulation.

Define:

* \(s=0\) head
* \(s=1\) tail
* \(t\) seconds

$$
x(s,t)
=
A(s)
\sin
\left[
2\pi(f t-k s)+\phi
\right]
$$

Amplitude envelope:

$$
A(s)=A_{max}s^p
$$

Recommended:

```python
POWER = 2.2
```

This keeps the head relatively stable and emphasizes the posterior body.

---

# 33. Speed-dependent swimming

Frequency must respond strongly to speed.

Define normalized speed:

$$
q =
clamp
\left(
\frac{v-v_{min}}
{v_{max}-v_{min}},
0,1
\right)
$$

Then:

$$
f(v)
=
f_{min}
+
(f_{max}-f_{min})q^{0.75}
$$

Suggested:

```text
f_min = 2.0 Hz
f_max = 7.0 Hz
```

Because small fish beat their tails much faster than koi.

---

# 34. Speed-dependent amplitude

Amplitude increases too, but less aggressively.

$$
A(v)=A_0(0.65+0.55q)
$$

For example:

```python
BODY_WAVE_BASE_AMP = BODY_LENGTH * 0.035
```

At fast transit:

```text
~4–5% body length
```

Do not make the fish snake violently.

Fast swimming should mostly appear as:

```text
frequency ↑↑
amplitude ↑ slightly
```

---

# 35. Acceleration-state body motion

During strong acceleration apply a brief additional tail gain:

$$
A'=A(1+g_a a_n)
$$

where `a_n` is normalized acceleration.

Suggested:

```text
gain ≤ 20%
```

This gives a readable sense of effort.

---

# 36. Pectoral fins

Pectoral fins provide fine maneuvering.

During slow states:

```text
activity = medium
```

During fast transit:

```text
activity = reduced / held closer
```

During deceleration:

```text
activity increases briefly
```

Conceptually:

```text
slow:
pectoral fins steering

fast:
tail/body dominate

braking:
pectoral fins reopen
```

---

# 37. Individual phase offsets

Every fish must have:

```python
motion_phase
```

Random deterministic range:

$$
\phi_i\in[0,2\pi)
$$

Therefore even when the school travels together, tails do not beat perfectly in phase.

Very important:

### synchronized direction ≠ synchronized body animation

The school may turn together while every fish still moves independently.

---

# 38. Individual personality parameters

Each fish should receive:

```python
preferred_speed
personal_space
social_weight
plant_affinity
wander_strength
reaction_delay
boldness
shadow_preference
turn_bias
motion_phase
motion_seed
```

Recommended narrow variation.

Do not create dramatically different personalities.

---

# 39. Plant affinity

This is important for your scene.

Define:

$$
F_{plant}
=
w_pG(d)(P-X)
$$

where `G(d)` is a distance envelope.

Do not attract fish to one exact point.

Instead create an annulus / volume around the plant:

```text
preferred radius:
0.12–0.35 m
```

Fish should:

```text
stay near
not collide
not orbit perfectly
```

---

# 40. Plant obstacle avoidance

Approximate plant stems and leaves using:

* simple capsules
* bounding spheres
* low-cost BVH
* or a few hidden avoidance volumes

Do not collision-check every leaf polygon for every fish every frame if unnecessary.

Use steering prediction.

For velocity \(V\):

$$
P_{future}=P+Vt_p
$$

with:

```text
prediction horizon = 0.2–0.5 sec
```

If predicted path intersects vegetation:

apply lateral avoidance.

---

# 41. Wall avoidance

Use scene boundaries.

Fish should never visibly enter walls.

Use a soft repulsion region beginning before the wall.

Example:

```text
warning distance = 3–5 body lengths
critical distance = 1–2 body lengths
```

Repulsion should increase smoothly.

Do not wait for collision and bounce.

---

# 42. Floor and ceiling

Although the scene is surreal and may not literally contain water:

Treat the navigable region as a 3D volume.

Fish can move vertically, but should remain mostly around:

```text
plant height ± moderate range
```

Vertical movement should be lower than horizontal movement.

Recommended:

```text
horizontal speed dominance:
~80%

vertical:
~20%
```

---

# 43. Light behavior

Do NOT implement:

```python
fish_attracted_to_light = True
```

as a strong rule.

Instead:

```text
light has almost no behavioral boundary
```

Optionally add a tiny probability effect:

```python
LIGHT_CROSSING_PREFERENCE = 0.10
```

so group trajectories sometimes naturally pass through it.

The important visual effect is:

> they can disappear into the black area and later suddenly cross the illuminated region.

---

# 44. Group burst triggers

Triggers should be sparse.

Recommended possible causes:

### Internal social transition

Most common.

### Group density threshold

Too tightly packed → move.

### Plant dwell timeout

Stayed around plant long enough → leave.

### Random low-frequency exploratory transition

Move toward another area.

### Boundary recovery

Group slowly drifted too far into one area.

---

# 45. Event frequency

Do not constantly make them burst.

For a 2–3 minute ambient loop:

Recommended:

```text
large coordinated transition:
every 12–35 sec

minor subgroup event:
every 6–20 sec
```

Use broad randomized intervals.

There should be long quiet periods.

---

# 46. Example 60-second choreography

Do not hardcode this forever, but use it as QA.

```text
00–08
main group loose around plant

08–14
small subgroup drifts into shadow

14–19
rest of group slowly follows

19–21
collective acceleration

21–22.5
fast crossing through light

22.5–27
decelerate near opposite wall

27–36
loose local roaming

36–42
several fish return toward plant

42–48
main shoal reforms

48–54
slow plant hover

54–56
minor 4-fish dart

56–60
quiet loose group
```

This is much closer to the desired atmosphere than repetitive Boids.

---

# 47. State probability example

Slow mode:

```python
STATE_PROBABILITIES = {
    "LOCAL_CRUISE": 0.35,
    "PLANT_HOVER": 0.25,
    "LOOSE_SHOAL": 0.18,
    "SHADOW_ROAM": 0.12,
    "MINOR_SCATTER": 0.06,
    "GROUP_TRANSIT": 0.04,
}
```

Do not evaluate this every frame.

Evaluate transition opportunities only after a minimum state duration.

---

# 48. Minimum state duration

Recommended:

```python
MIN_LOCAL_CRUISE = 2.0
MIN_PLANT_HOVER = 3.0
MIN_SHOAL = 2.0
MIN_SHADOW_ROAM = 4.0
```

This prevents nervous flickering between states.

---

# 49. Shoal centroid

For group center:

$$
C=
\frac{1}{N}
\sum_{i=1}^{N}P_i
$$

Cohesion:

$$
F_{cohesion}
=
normalize(C-P_i)
$$

but do not use all fish indiscriminately.

Prefer local neighbors within perception radius.

---

# 50. Neighbor perception

Define:

```text
social_radius = 5–12 body lengths
```

Use:

```python
SOCIAL_RADIUS = BODY_LENGTH * 8
```

Optionally use field of view:

```text
~280–320°
```

Fish directly behind can have reduced weight.

This produces more plausible local interactions.

---

# 51. Separation equation

For each neighbor \(j\):

$$
F_s
=
\sum_j
\frac{P_i-P_j}
{||P_i-P_j||^2+\epsilon}
$$

only inside separation radius.

Use smooth clamping.

---

# 52. Alignment equation

$$
F_a=
\bar V_{neighbors}-V_i
$$

Normalize / limit before weighting.

During FAST_TRANSIT:

increase \(w_a\).

During PLANT_HOVER:

decrease \(w_a\).

This state-dependent social response is particularly appropriate for medaka, because recent work finds their social responsiveness differs between kinematic states rather than being one constant interaction rule. ([PubMed][1])

---

# 53. Wander

Do NOT use random heading each frame.

Use slowly varying correlated noise.

For example Ornstein–Uhlenbeck-like:

$$
dw=
-\theta wdt+\sigma dW
$$

or use low-frequency sinusoids / smooth noise.

Simple deterministic alternative:

```python
wander_yaw = (
    0.6 * sin(0.71*t + phase1)
    + 0.3 * sin(1.13*t + phase2)
)

wander_pitch = (
    0.25 * sin(0.47*t + phase3)
)
```

Then low-pass filter.

---

# 54. Recommended performance strategy

22 fish × full mesh × full rig can still be manageable, but optimize carefully.

Use:

### Master assets

```text
1 master mesh
1 master material architecture
1 master rig structure
```

Then create lightweight duplicates / linked geometry where possible.

Allow material and transform variation.

---

# 55. LOD system

Create optional:

```text
LOD0
LOD1
LOD2
```

### LOD0

Close camera.

Full fins and deformation.

### LOD1

Mid-distance.

Simplified mesh / fewer deformation controls.

### LOD2

Far away / dark shadow.

Very lightweight fish mesh.

Because the fish are tiny in the final image, excessive geometry is wasted.

---

# 56. Recommended mesh complexity

Master base:

```text
800–2,500 verts
```

after render subdivision:

```text
2k–8k equivalent
```

is enough.

Do not build 50k-poly medaka.

Silhouette and motion matter more.

---

# 57. Materials

Use one shared material architecture with per-fish parameters.

Custom properties:

```text
body_brightness
body_olive_tint
silver_strength
dark_dorsal_strength
fin_alpha
pattern_seed
```

Fins should be slightly translucent.

Fish entering the light should show:

* silver specular
* pale belly
* transparent fin edges

In shadow they should become subdued.

---

# 58. Lighting interaction

Do not add emissive fish.

They should only become visible because of actual scene lighting.

Important:

```text
shadow → almost disappear

cross light → briefly reveal body and fins

shadow again → fade naturally
```

This is a major part of the scene aesthetic.

---

# 59. Python project structure

Recommended:

```text
medaka_shoal/
│
├── build_all.py
├── config.py
├── medaka_geometry.py
├── medaka_rig.py
├── medaka_materials.py
├── swimming.py
├── agent.py
├── shoal.py
├── behavior_states.py
├── environment.py
├── plant_avoidance.py
├── animation_bake.py
├── validation.py
└── README.md
```

---

# 60. Suggested class structure

```python
class MedakaAgent:
    position
    velocity
    heading

    state
    state_time

    preferred_speed
    reaction_delay
    plant_affinity
    social_weight
    wander_strength

    motion_phase
    motion_seed

    rig
    object
```

Group:

```python
class MedakaShoal:
    agents
    environment

    current_group_event
    group_target

    update()
    trigger_group_transit()
    update_social_forces()
    update_behavior_states()
```

---

# 61. Core update loop

```python
def update_shoal(shoal, dt, time):

    shoal.evaluate_group_events(time)

    for fish in shoal.agents:

        neighbors = shoal.get_neighbors(fish)

        social_force = compute_social_force(
            fish,
            neighbors
        )

        environment_force = compute_environment_force(
            fish,
            shoal.environment
        )

        behavior_force = compute_behavior_force(
            fish,
            shoal
        )

        steering = (
            social_force
            + environment_force
            + behavior_force
        )

        update_velocity(
            fish,
            steering,
            dt
        )

        update_orientation(
            fish,
            dt
        )

        update_position(
            fish,
            dt
        )

        update_swim_pose(
            fish,
            time
        )
```

---

# 62. Group transit trigger

```python
def trigger_group_transit(
    shoal,
    target_position,
    initiator=None,
):

    if initiator is None:
        initiator = choose_event_initiator(shoal)

    for fish in shoal.agents:

        distance = (
            fish.position
            - initiator.position
        ).length

        delay = (
            random_range(0.0, 0.05)
            + distance * REACTION_DISTANCE_GAIN
        )

        fish.schedule_state(
            "GROUP_ACCELERATE",
            delay=delay
        )

    shoal.group_target = target_position
```

---

# 63. Fast transit steering

During fast transit:

$$
F_{target}
=
normalize(P_{target}-P_i)
$$

Then combine:

$$
F=
w_tF_t
+
w_aF_a
+
w_cF_c
+
w_sF_s
+
w_oF_o
$$

Suggested:

```python
TARGET_WEIGHT = 1.00
ALIGNMENT_WEIGHT = 0.82
COHESION_WEIGHT = 0.55
SEPARATION_WEIGHT = 0.68
WANDER_WEIGHT = 0.04
```

---

# 64. Formation during fast transit

Do not make a straight horizontal line.

Aim for:

```text
elongated loose oval
```

Aspect ratio:

```text
travel axis : lateral axis
≈ 1.6–2.6 : 1
```

The school naturally stretches during acceleration.

During deceleration it becomes rounder / more scattered again.

---

# 65. Orientation from velocity

Use:

$$
forward=
normalize(V)
$$

Build target quaternion from forward direction and world-up reference.

Smooth using quaternion interpolation.

```python
rotation = rotation.slerp(
    target_rotation,
    1.0 - exp(-turn_response * dt)
)
```

Do not directly snap rotation to velocity.

---

# 66. Banking

During turn:

$$
roll
=
-k_r\dot{\psi}
$$

Clamp:

```text
±4°–8°
```

Small fish can bank visibly but keep it subtle.

---

# 67. Pitch

Pitch derives partly from vertical velocity:

$$
pitch=
atan2(v_z,\sqrt{v_x^2+v_y^2})
$$

Smooth and clamp.

Recommended:

```text
±8° normal
±12° during strong transition
```

---

# 68. Animation baking strategy

Two supported modes:

## Mode A — Live procedural preview

Useful while designing.

## Mode B — Bake

Required final deliverable.

Bake:

* root location
* root rotation
* spine pose
* fin animation

to keyframes.

The final `.blend` should play without requiring live Python execution.

---

# 69. Recommended ambient loop duration

Unlike previous hero clips, this should be a **long environmental loop**.

Recommended:

```text
90–180 sec
```

Default:

```python
LOOP_DURATION = 120
FPS = 30
```

or:

```text
3600 frames
```

For higher-quality motion:

```text
60 fps
```

is useful because reaction delays and small fast fish movements are easier to resolve.

If final rendering allows it:

### Prefer 60 fps simulation

then render / deliver at the project's desired frame rate.

---

# 70. Long-loop continuity

Do not simply copy frame 1 to frame 3600.

For a seamless long loop:

Use one of:

### Method A

Blend final 5–10 seconds toward an equivalent initial macro-state.

### Method B

Generate motion on a toroidal time domain.

### Method C

Render a sufficiently long non-looping sequence and choose a compatible loop window.

Prefer Method A initially.

---

# 71. Debug visualization

Provide debug toggles for:

```text
neighbor radius
separation radius
current state
current group target
plant affinity volume
obstacle volumes
velocity vector
school centroid
light volume
```

Use distinct debug collections.

Hide for final render.

---

# 72. Validation — morphology

PASS if:

```text
fish are clearly tiny slender rice-fish-like animals
body proportions consistent
tail modest
no fancy guppy tail
no koi-like heavy body
```

---

# 73. Validation — single fish motion

PASS if:

* head relatively stable
* posterior body carries most oscillation
* body keeps continuously swimming
* tail frequency responds to speed
* no eel-like excessive wave count
* no abrupt pose snapping

---

# 74. Validation — slow shoaling

PASS if:

* animals remain socially related
* spacing varies naturally
* alignment exists but is imperfect
* some individuals occasionally drift
* plant area can become a gathering point

---

# 75. Validation — fast transition

This is the most important QA.

A successful event should visually read:

```text
quiet group
        ↓
several fish react
        ↓
whole group aligns
        ↓
rapid crossing
        ↓
group stretches
        ↓
deceleration
        ↓
loose regrouping
```

NOT:

```text
all fish suddenly change velocity
on exactly one frame
```

---

# 76. Validation — light crossing

At least some events should:

```text
shadow
→ visible light
→ shadow
```

Fish should become visible naturally because of lighting.

They must not stop at the beam boundary.

---

# 77. Validation — plant interaction

Over a long preview:

* fish should repeatedly return near vegetation
* but not permanently circle it
* no fish should clip leaves visibly
* shoal should sometimes leave completely
* later return naturally

---

# 78. Common failure A

## 「像 Boids 範例」

Symptoms:

```text
constant speed
constant flocking
everyone turns together
never pauses
```

Fix:

Increase state dependence.

Reduce slow-state alignment.

Add acceleration/deceleration events.

Add plant dwell and shadow roam.

---

# 79. Common failure B

## 「像粒子系統」

Symptoms:

```text
fish have no body propulsion
objects merely translate through space
```

Fix:

Tie tail frequency and amplitude directly to velocity and acceleration.

---

# 80. Common failure C

## 「太吵」

Symptoms:

```text
constant darting
constant turning
too many group events
```

Fix:

Increase quiet intervals.

Main principle:

> the fast movement is powerful because most of the time they are not doing it.

---

# 81. Common failure D

## 「全部躲在植物旁」

Fix:

Plant affinity must be a temporary preference, not home confinement.

Add:

```text
dwell timeout
shadow targets
exploration targets
```

---

# 82. Common failure E

## 「全部只待在光裡」

Reject.

The light is not an aquarium boundary.

Remove or greatly reduce light attraction.

---

# 83. Common failure F

## 「孔雀魚感太強」

If fish begin looking decorative:

* reduce tail dimensions
* reduce saturated colors
* narrow body
* simplify fin silhouette

Target remains medaka.

---

# 84. Scene composition target

For the uploaded scene, the ideal animation should allow frames such as:

### Moment A

Plant beside the light.

Only 4–6 fish visible.

Others are in darkness.

### Moment B

More fish slowly gather around plant.

### Moment C

Almost complete stillness.

### Moment D

One side of the group reacts.

### Moment E

15–20 fish rapidly cross the illuminated shaft.

### Moment F

The space becomes almost empty again.

This alternating **presence / absence** is central to the artwork.

---

# 85. Final exposed parameters

Create one high-level controller:

```text
MEDAKA_SHOAL_CTRL
```

Expose:

```text
Fish Count

Slow Speed
Fast Speed
Acceleration

Cohesion Slow
Alignment Slow
Separation Slow

Cohesion Fast
Alignment Fast
Separation Fast

Plant Affinity

Shadow Roam Probability
Group Transit Probability
Minor Scatter Probability

Fast Event Interval Min
Fast Event Interval Max

Reaction Delay
Reaction Spread

Obstacle Avoidance

Body Wave Frequency Scale
Body Wave Amplitude Scale

Motion Seed
Behavior Seed
```

This should allow the scene artist to change the overall temperament without rewriting Python.

---

# 86. Suggested default preset

Call it:

```python
PRESET_QUIET_RAIN_MEDAKA
```

Suggested values:

```python
FISH_COUNT = 22

SLOW_SPEED_MIN = 0.035
SLOW_SPEED_MAX = 0.075

FAST_SPEED_MIN = 0.14
FAST_SPEED_MAX = 0.24

COHESION_SLOW = 0.42
ALIGNMENT_SLOW = 0.28
SEPARATION_SLOW = 0.72

COHESION_FAST = 0.62
ALIGNMENT_FAST = 0.82
SEPARATION_FAST = 0.65

PLANT_AFFINITY = 0.55

SHADOW_ROAM_PROBABILITY = 0.30
GROUP_TRANSIT_PROBABILITY = 0.10
MINOR_SCATTER_PROBABILITY = 0.12

MAJOR_EVENT_INTERVAL_MIN = 12.0
MAJOR_EVENT_INTERVAL_MAX = 32.0

REACTION_DELAY_MIN = 0.00
REACTION_DELAY_MAX = 0.20

BODY_WAVE_POWER = 2.2
BODY_WAVE_MIN_FREQ = 2.0
BODY_WAVE_MAX_FREQ = 7.0

BEHAVIOR_SEED = 37
MOTION_SEED = 73
```

These are **artistic simulation defaults**, not biological measurement claims.

Tune by visual QA.

---

# 87. Deliverables

Final deliverables:

```text
medaka_quiet_rain_shoal.blend

build_all.py
config.py
medaka_geometry.py
medaka_rig.py
medaka_materials.py
swimming.py
agent.py
shoal.py
behavior_states.py
environment.py
plant_avoidance.py
animation_bake.py
validation.py
README.md
```

---

# 88. Completion checklist

```text
[ ] Master Medaka mesh created
[ ] efficient medaka rig created
[ ] 18–28 fish generated
[ ] size variation exists
[ ] color variation exists
[ ] continuous swim animation works
[ ] tail frequency scales with speed
[ ] local cruise state works
[ ] plant hover state works
[ ] loose shoaling works
[ ] collective acceleration works
[ ] fast group transit works
[ ] reaction delays exist
[ ] group deceleration works
[ ] regroup behavior works
[ ] shadow roaming works
[ ] fish can enter and leave light freely
[ ] plant avoidance works
[ ] wall avoidance works
[ ] no obvious fish intersections
[ ] long ambient sequence works
[ ] motion is deterministic by seed
[ ] debug mode works
[ ] animation can be baked
[ ] final .blend saved
```

---

# 89. Priority order

If implementation requires tradeoffs:

```text
1. Group acceleration / regroup behavior
2. Believable individual swimming
3. Natural loose shoaling
4. Plant-area behavior
5. Shadow ↔ light movement
6. Collision avoidance
7. Morphological detail
8. Material variation
```

Do not spend excessive effort making beautiful individual fish before the group behavior works.

These fish are small.

**Their collective movement is the character.**

---

# 90. Final artistic test

Play the scene for two uninterrupted minutes.

Do not scrub.

Do not select fish.

Watch it like an artwork.

The result passes only if there are moments when:

> almost nothing happens

followed naturally by moments when:

> the whole group suddenly seems to make a decision

and then:

> they rapidly cross the scene together, disappear into darkness, and gradually reform near the plant.

There must be no visible algorithmic repetition.

The viewer should never feel that the fish are following a looping path.

The environment should remain quiet.

The fish should introduce **brief pulses of life into that quietness**.

---

## 我會特別提醒 Codex 的一句話

最後可以再附上這段，避免它做歪：

> **Do not implement this as a conventional constant-speed Boids demo. The defining behavior is state-dependent social motion: long quiet periods of loose shoaling, followed by occasional coordinated acceleration events, rapid group transits, deceleration, and loose regrouping. Fish must be allowed to enter darkness, leave the light beam, gather temporarily around vegetation, and later return.**

---

而且這次其實可以比前面長鰭錦鯉更進一步：**不要只做 Animation Clips，而是做真正的 Behavioral Simulation → 最後再 Bake 成動畫。**

因為長鰭錦鯉適合：

> Action A → Action B → Action C

但你這種青鱂群真正好看的地方是：

> 每一隻魚根據鄰居、植物、空間和群體事件即時計算下一步

再加上我上面設計的 **state-dependent weights**，例如平常 `Alignment = 0.28`，突然群體移動時切到 `0.82`，你要的那個「原本散散的 → 突然整群一起衝過去」就會非常明顯，同時又不會變成一直同步游的 screensaver。

而這也剛好跟 2026 年對青鱂群體行為的研究很吻合：牠們的社會反應不是一套固定規則，而會跟當下的運動狀態一起改變。([PubMed][1])

[1]: https://pubmed.ncbi.nlm.nih.gov/40766704/?utm_source=chatgpt.com "Collective Behavior in Medaka Fish Depends on Discrete Kinematic States of Swimming Behavior - PubMed"
[2]: https://pmc.ncbi.nlm.nih.gov/articles/PMC3984424/?utm_source=chatgpt.com "Biological motion stimuli are attractive to medaka fish - PMC"
[3]: https://pmc.ncbi.nlm.nih.gov/articles/PMC5388324/?utm_source=chatgpt.com "Three-dimensional computer graphic animations for studying social approach behaviour in medaka fish: Effects of systematic manipulation of morphological and motion cues - PMC"
