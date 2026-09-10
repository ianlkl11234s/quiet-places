# 雪景版「海月水母 + 裸海蝶」Codex 任務書 v1

> Target: Blender / Blender Python / Codex
> Scene concept: quiet snowy architectural space + 3 Moon Jellyfish + a few Sea Angels
> Primary species:
> - Moon jellyfish: *Aurelia aurita*
> - Sea angel / naked sea butterfly: *Clione limacina*
>
> Core goal: 先服從生物形態與運動機制，再把真實運動節奏放入超現實的雪景空間。
>
> This is an engineering specification, not merely a visual prompt.

---

# 0. Codex role

Act as a Blender technical artist, creature modeler, rigging TD, procedural animation engineer, biomechanics implementation engineer, and Blender Python developer.

Build a reusable biological animation system, not a single decorative loop.

Final scene:
- exactly 3 moon jellyfish
- default 5 sea angels, configurable 4–7
- existing snowy Quiet Places environment preserved
- biologically inspired locomotion
- procedural controls
- multiple behavior states
- deterministic motion
- physics-informed secondary animation
- collision and spacing safeguards
- baked animation for Blender and glTF/Three.js where practical

When Blender execution is available:
1. inspect current scene
2. preserve useful environment/assets
3. build creatures
4. rig
5. generate preview animation
6. inspect
7. validate
8. fix
9. save .blend

---

# 1. Evidence levels

Every parameter must be tagged conceptually as one of:

## Level A — literature constrained
Hard or near-hard biological rules.

### Aurelia
- shallow translucent bell, flat-to-domed
- commonly four horseshoe/ring-like gonads
- four oral arms
- numerous short marginal tentacles
- eight rhopalia-related marginal regions
- outer bell margin behaves as a highly flexible region
- one kinematic study estimated the flexion point at ~83% of exumbrellar arclength, leaving the outer ~17% as a highly flexible flap
- pulse propulsion consists of contraction, relaxation, and post-relaxation/interpulse dynamics
- passive energy recapture can continue to propel Aurelia after active bell motion
- straight swimming is close to axisymmetric
- turning arises from asymmetric/asynchronous bell-margin motion, not only rigid root rotation
- larger Aurelia generally pulse more slowly than smaller ones

### Clione
- shell absent
- body mainly transparent, barrel-like anterior/mid body, tapered posterior
- paired lateral parapodia
- visible reddish/orange internal structures
- normally head-up, approximately vertical in slow swim/hover
- slightly negatively buoyant
- slow/hover wingbeat ~1–2 Hz
- fast hunting/escape gait ~2–5 Hz
- wing sweep can approach ~180° total arc
- upstroke and downstroke are both propulsive
- posterior wing edge lags the anterior edge during both half-strokes
- reported hovering maximum angle of attack is about 42°
- wing tips can nearly touch/overlap around sagittal plane at stroke extremes

## Level B — literature-informed implementation
Simplified engineering models:
- spring-damper appendages
- low-order thrust model
- eight-sector Aurelia turning controller
- blade-element-inspired Clione wing forces
- added mass
- smooth virtual current field

## Level C — scene/simulation prior
Artistic but bounded values:
- exact hero sizes
- exact frequency per individual
- current strength
- separation distances
- spring coefficients
- material values
- event probabilities

Never present Level C as measured biological constants.

---

# 2. World rule: visible snow, invisible aquatic medium

Visually the scene is:
- cold architectural space
- snow
- no visible aquarium
- no visible water body

Biological locomotion is nevertheless computed as if in an invisible seawater-like medium.

Do not use real air density for organism locomotion.

Use:
```python
RHO_FLUID = 1025.0       # kg/m^3
MU_FLUID  = 1.05e-3      # Pa*s
G         = 9.81          # m/s^2
```

These are animation-medium constants only.

Do not render water solely because these values exist.

---

# 3. Scene population

```text
3 × Aurelia-like moon jellyfish
5 × Clione limacina by default
```

Sea angels:
```text
min 4
default 5
max 7
```

Visual hierarchy:
```text
Moon Jellyfish >>> Sea Angels >>> Snow particles
```

Sea angels are supporting life, not co-equal hero subjects.

---

# 4. Character roles

## Jellyfish A — HERO
```python
diameter = 0.30  # m
```
range 0.26–0.36 m

## Jellyfish B — MID
```python
diameter = 0.25
```
range 0.21–0.30 m

## Jellyfish C — FAR
```python
diameter = 0.20
```
range 0.17–0.25 m

## Sea angels
Actual-scale-inspired:
```text
0.030–0.045 m body length
```
prefer 0.032–0.040 m

Do not enlarge into 10–20 cm fantasy animals merely for readability.

Use camera placement, silhouette and lighting instead.

---

# 5. Coordinates

World:
```text
+Z = visual up
```

Aurelia local:
```text
+Z = propulsion direction toward bell apex
-Z = oral/tentacle trailing direction
X/Y = bell plane
```

Clione local:
```text
+Z = head direction
-Z = posterior/tail
+X/-X = right/left parapodia
+Y = dorsal
-Y = ventral
```

Default Clione body axis should remain within roughly 0–25° of world +Z except during turns.

---

# PART I — AURELIA AURITA

# 6. Required morphology

Must read immediately as a moon jelly:

- shallow oblate bell
- transparent/gelatinous body
- central region thicker than edge
- 4 horseshoe-like gonads
- 4 oral arms
- radial canals
- marginal ring canal
- many short marginal tentacles
- 8 rhopalia-related regions
- subtle broad marginal lobes

Reject:
- box jelly shape
- lion's mane morphology
- long sea-nettle tentacles
- generic glass dome
- uniform transparent disk

---

# 7. Bell parametric surface

Define:
```text
r ∈ [0,1]      center → edge
theta ∈ [0,2π)
R = relaxed radius
H = relaxed height
```

Starting scene prior:
```text
H/D = 0.12–0.22
default 0.16
```

Use:
\[
\rho_0=rR_\theta(r)
\]

\[
z_0=-Hr^q
\]

with:
```text
q = 1.3–2.1
default 1.55
```

Cartesian:
\[
x=\rho_0\cos\theta,\quad
y=\rho_0\sin\theta,\quad
z=z_0
\]

The apex is near local z=0 and the bell margin lies lower.

After generation, smooth into a soft organic surface.

---

# 8. Eight subtle marginal notches

Rhopalia positions:
\[
\theta_k=\frac{2\pi k}{8},\quad k=0,...,7
\]

Edge-localized notch:
\[
N(r,\theta)
=
r^m
\sum_{k=0}^{7}
\exp
\left(
-\frac{wrap(\theta-\theta_k)^2}{2\sigma_\theta^2}
\right)
\]

\[
R_\theta(r)
=
R[1-\epsilon_NN(r,\theta)]
\]

Prior:
```text
m = 8–14
epsilon_N = 0.004–0.012
sigma_theta = 0.035–0.070 rad
```

Do not create deep flower petals.

---

# 9. Bell thickness

\[
t(r)
=
t_{edge}
+
(t_{center}-t_{edge})(1-r)^\eta
\]

Prior:
```text
t_center = 0.035D–0.070D
t_edge   = 0.003D–0.009D
eta      = 1.4–2.4
```

Center should have real gelatinous volume.
Margin must be delicate and thin.

Avoid shader-only fake thickness for hero jellyfish.

---

# 10. Four gonads

Create four separate internal structures, not painted decals.

For quadrant:
\[
\phi_k=k\pi/2
\]

Approximate horseshoe centerline:
\[
\mathbf g_k(s)
=
Rot_z(\phi_k)
\begin{bmatrix}
r_g+a_g\cos s\\
b_g\sin s\\
z_g
\end{bmatrix}
\]

Use an incomplete arc:
```text
s ≈ [-0.75π, +0.75π]
```

Prior:
```text
r_g = 0.22R–0.34R
a_g = 0.10R–0.17R
b_g = 0.07R–0.13R
tube radius = 0.012R–0.030R
```

Material:
- pale white/pink/mauve/violet
- more opaque than bell
- no neon emission

---

# 11. Radial canals

Represent:
- 16 main radial directions
- mixture of straight and branched canals
- ring canal near margin

For a controlled branch:
\[
\theta_\pm(r)
=
\theta_0
\pm
a_bS(r_b,1,r)
\]

where S is smoothstep.

Prior:
```text
a_b = 0.025–0.090 rad
```

Canal pattern must remain radially organized, never tree-root-like.

---

# 12. Four oral arms

Exactly four.

Requirements:
- ribbon-like
- frilled/folded
- taper distally
- central feeding-groove impression
- hang below bell
- no giant dramatic trailing arms

Length prior:
```text
0.55R–0.95R
```

Rest centerline:
\[
\mathbf x_0(s)
=
\mathbf x_{root}
+sL\mathbf d_0
+A_{rest}\sin(\pi s)\mathbf e_{side}
\]

Width:
\[
w(s)
=
w_0(1-s)^{p_w}
+w_{tip}
\]

with:
```text
p_w = 0.7–1.5
```

---

# 13. Marginal tentacles

Aurelia can have hundreds to >1000 small marginal tentacles.

Do not fully rig every tentacle.

Cinematic:
```text
visible = 256–768
dynamic guides = 48–96
```

Web LOD:
```text
visible = 96–256
dynamic guides = 24–48
```

Root distribution:
\[
\theta_i
=
\frac{2\pi i}{N}
+\delta_i
\]

Length:
\[
L_i=L_0(1+\epsilon_i)
\]

bounded:
```text
epsilon_i ∈ [-0.25,+0.25]
```

They must remain short/fine.

---

# 14. Pulse oscillator

Instantaneous frequency:
\[
f(t)=f_0[1+\epsilon_f(t)]
\]

Smooth modulation:
\[
\epsilon_f(t)
=
a_1\sin(2\pi f_1t+\phi_1)
+
a_2\sin(2\pi f_2t+\phi_2)
\]

Prior:
```text
a1=0.025
a2=0.012
f1=0.013–0.037 Hz
f2=0.041–0.073 Hz
```

Integrate phase:
\[
\dot\varphi=2\pi f(t)
\]

\[
\varphi_{t+dt}=\varphi_t+2\pi f(t)dt
\]

Normalized cycle:
\[
\tau=(\varphi\bmod2\pi)/(2\pi)
\]

Do not recalculate with a discontinuous changing-frequency sine.

---

# 15. Default pulse frequencies

Large scene-jelly values are Level C priors constrained by literature showing frequency decreases with growth and measured/contextual rates varying substantially.

```python
JELLY_A_F = 0.38
JELLY_B_F = 0.44
JELLY_C_F = 0.34
```

Relaxed range:
```text
0.28–0.58 Hz
```

Occasional active:
```text
0.55–0.80 Hz
```

Do not run the hero animals at a constant high frequency.

Literature sanity:
- one 3–4 cm study measured about 0.78 Hz
- field data have reported beat frequencies around 0.36 and 0.57 s^-1 in different swimming contexts
- larger Aurelia tend to pulse more slowly

---

# 16. Pulse timing

\[
T=1/f
\]

Split:
```text
Tc = contraction
Tr = relaxation
Tg = interpulse/glide
```

\[
T_c+T_r+T_g=T
\]

Default:
```text
Tc/T=0.30
Tr/T=0.45
Tg/T=0.25
```

Allowed:
```text
Tc 0.24–0.34
Tr 0.40–0.54
Tg 0.12–0.30
```

Hard:
```text
Tc < Tr
```

---

# 17. Piecewise contraction function

Within one period use local time t.

Contraction:
\[
C(t)
=
\frac12
[1-\cos(\pi t/T_c)]
\]

for 0 <= t < Tc.

Relaxation:
\[
C(t)
=
\frac12
[1+\cos(\pi(t-T_c)/T_r)]
\]

for Tc <= t < Tc+Tr.

Interpulse:
\[
C(t)=0
\]

Result:
```text
open
→ faster contraction
→ slower elastic reopening
→ open glide
```

Never use one symmetric sine for the full cycle.

---

# 18. Radial deformation envelope

\[
W_a(r)
=
w_{min}
+
(1-w_{min})
S(r_a,1,r)^p
\]

Prior:
```text
w_min=0.10–0.20
r_a=0.25–0.40
p=1.1–1.8
```

Center moves less.
Margin moves more.

---

# 19. Outer ~17% flexible flap

Literature-based flexion region:

\[
W_f(r)=S(0.80,1.00,r)^{1.4}
\]

Treat roughly the outer 15–20% as a high-flexibility zone.

It must show:
- greatest displacement
- highest local speed
- passive lag
- different contraction/recovery path
- rollout during relaxation

No visible seam.

---

# 20. Broad bell deformation

For relaxed coordinates rho0,z0:

\[
\rho_a
=
\rho_0
[1-A_\rho W_a(r)C(t)]
\]

\[
z_a
=
z_0-A_zRW_a(r)C(t)
\]

Prior:
```text
A_rho=0.10–0.18
A_z=0.06–0.14
```

Contracted bell should become narrower and more cup-like.

No cartoon squash/stretch.

---

# 21. Passive margin response

Use a second-order response:
\[
\ddot q_f
+
2\zeta_f\omega_f\dot q_f
+
\omega_f^2(q_f-C)=0
\]

with:
\[
\omega_f=2\pi\gamma_ff
\]

Prior:
```text
gamma_f=2.5–4.0
zeta_f=0.60–0.88
```

Blend:
\[
C_{local}=(1-W_f)C+W_fq_f
\]

If visible ringing occurs after each pulse, increase damping.

---

# 22. Margin hysteresis QA

Track one margin point in radial-vs-vertical coordinates across one pulse.

Contraction and relaxation paths must not perfectly retrace.

The result should form a narrow loop.

If margin path collapses into a single reversible line:
FAIL.

---

# 23. Translation equation

No constant-speed object animation.

Use:
\[
m_{eff}\dot{\mathbf v}
=
\mathbf F_{pulse}
+
\mathbf F_{PER}
+
\mathbf F_{buoy}
+
\mathbf F_{drag}
+
\mathbf F_{current}
\]

\[
\dot{\mathbf x}=\mathbf v
\]

Physics step:
```text
preferred dt <= 1/120 s
```

Bake later to render fps.

---

# 24. Pulse thrust proxy

\[
\dot C_+=\max(\dot C,0)
\]

\[
F_{pulse}
=
K_pR^3\dot C_+^2
\]

\[
\mathbf F_{pulse}=F_{pulse}\mathbf n_{bell}
\]

Kp is calibration-only Level B.

---

# 25. Passive Energy Recapture

After relaxation, let `tr` = time since relaxation ended.

\[
F_{PER}(t_r)
=
K_{PER}e^{-t_r/\tau_{PER}}
\]

Optionally gate it in smoothly during late relaxation.

Calibration target:
\[
0.25
\le
D_{interpulse}/D_{cycle}
\le
0.35
\]

default:
```text
~0.30
```

This is intentionally based on literature reporting ~32% of distance per pulse in post-relaxation/interpulse motion.

The viewer should perceive continued glide, not an artificial second kick.

---

# 26. Drag

\[
\mathbf v_r=\mathbf v-\mathbf u_{fluid}
\]

\[
\mathbf F_d
=
-\frac12\rho C_DA_{proj}|\mathbf v_r|\mathbf v_r
\]

\[
A_{proj}\approx\pi R_{eff}^2
\]

Starting Cd:
```text
0.7–1.4
```

Calibrate; do not claim exact CFD.

---

# 27. Added mass

\[
m_{eff}=m_j+C_A\rho V_{disp}
\]

Prior:
```text
CA=0.4–1.0
```

Purpose: avoid instant acceleration.

---

# 28. Reynolds sanity check

\[
Re=\frac{\rho UD}{\mu}
\]

Log:
```text
diameter
mean speed
Re
```

Do not force a large jelly to match small-animal Re.

---

# 29. Aurelia turning controller

Use 8 sectors:
\[
\theta_k=2\pi k/8
\]

Desired turn direction in bell plane:
\[
\mathbf d_T=(d_x,d_y)
\]

\[
\theta_T=atan2(d_y,d_x)
\]

\[
g_k=\cos(\theta_k-\theta_T)
\]

Pulse onset:
\[
\Delta t_k
=
-\Delta t_{max}Tg_k
\]

Prior:
```text
Delta_t_max=0.01–0.08 of period
```

Inside-turn sectors should initiate slightly earlier.

Optional amplitude:
\[
A_k=A_0(1+a_Tg_k)
\]

with:
```text
aT=0.00–0.12
```

Prefer phase/onset asymmetry over huge amplitude asymmetry.

---

# 30. Turn dynamics

Asynchrony:
\[
S_T
=
\frac{
\max(\Delta t_k)-\min(\Delta t_k)
}{
T
}
\]

Angular acceleration:
\[
\dot{\boldsymbol\omega}
=
K_TS_T\mathbf a_T
-c_\omega\boldsymbol\omega
\]

\[
\mathbf a_T
=
normalize(
\mathbf n_{bell}\times\mathbf d_T
)
\]

Integrate quaternion orientation.

Do not implement every turn as direct Euler root rotation.

---

# 31. Skid-turn QA

During a turn pulse:
- orientation may rotate
- centroid path remains initially close to linear
- velocity does not instantly snap to new orientation
- later pulses progressively redirect travel

Reject perfect car-like circular steering.

---

# 32. Oral-arm dynamics

For node i:
\[
m_i\ddot{\mathbf x}_i
=
\mathbf F_{stretch}
+
\mathbf F_{bend}
+
\mathbf F_{drag}
+
\mathbf F_{root}
+
\mathbf F_{buoy}
\]

Stretch:
\[
\mathbf F_s
=
k_s(|\mathbf d|-L_0)\hat{\mathbf d}
\]

Approximate bend:
\[
\mathbf F_b
=
k_b(
\mathbf x_{i-1}
-2\mathbf x_i
+\mathbf x_{i+1}
)
\]

Drag:
\[
\mathbf F_d
=
-\frac12\rho C_dA
|\mathbf v-\mathbf u|
(\mathbf v-\mathbf u)
\]

Use high damping.

They should trail, fold and continue settling after bell motion.

---

# 33. Marginal tentacle PBD

Guide tentacle prediction:
\[
\mathbf x_i^*
=
\mathbf x_i
+
(1-\gamma)
(\mathbf x_i-\mathbf x_i^{prev})
+
\mathbf a_i\Delta t^2
\]

Then enforce:
\[
|\mathbf x_i-\mathbf x_{i-1}|=L_i
\]

Use 3–8 constraint iterations.

No white-noise flutter.

---

# 34. Aurelia behavior states

```text
J_DRIFT_IDLE
J_PULSE_CRUISE
J_ACTIVE_CRUISE
J_GLIDE
J_SOFT_TURN
J_ASCEND
J_DESCEND
J_PAUSE_OPEN
```

Quiet-scene priors:
```text
DRIFT_IDLE   20–30%
PULSE_CRUISE 35–45%
GLIDE        15–25%
SOFT_TURN     5–12%
ASC/DESC      5–12%
ACTIVE        rare
```

Crossfade state parameter changes over ~1–3 pulses.

---

# 35. Three-jelly de-synchronization

Initial phase prior:
```text
A 0.13
B 0.61
C 0.37
```

Use Kuramoto-style synchrony metric for QA:
\[
R
=
\left|
\frac13
\sum_{j=1}^3e^{i\varphi_j}
\right|
\]

Warn if:
```text
R > 0.90
```
for an extended interval.

Momentary synchrony is fine.
Persistent metronomic synchronization is not.

---

# PART II — CLIONE LIMACINA

# 36. Required morphology

Must have:
- no shell
- transparent soft body
- barrel-like anterior/mid body
- tapered pointed posterior
- orange/red internal mass
- two lateral parapodia
- small head region

Reject:
- butterfly
- fairy
- fish
- tiny manta
- squid
- feathered wings

---

# 37. Body radius profile

Use s:
```text
s=0 head
s=1 tail tip
```

Control profile:
```text
s     normalized radius
0.00  0.58
0.12  0.82
0.30  1.00
0.50  0.92
0.70  0.70
0.86  0.42
0.96  0.18
1.00  0.05
```

Interpolate with monotone cubic/Hermite.

Do not allow spline overshoot lumps.

Default:
```python
body_length = 0.036
```

Range:
```text
0.030–0.045 m
```

Visceral mass occupies mainly the anterior ~40–55%.

---

# 38. Parapodium planform

Root-to-tip:
```text
u ∈ [0,1]
```

Span prior:
```text
0.25L–0.38L
```

Max chord:
```text
0.18L–0.28L
```

Max chord should be closer to the body than midspan.

Use beta-like chord:
\[
c_n(u)
=
(u/a)^a
((1-u)/(1-a))^{1-a}
\]

with:
```text
a=0.33
```

Normalize maximum to 1.

\[
c(u)=c_{tip}+(c_{max}-c_{tip})c_n(u)
\]

---

# 39. Wing thickness

Flexible muscular wing:
- thicker at root
- leading region fuller
- posterior/trailing edge thinner

Span thickness:
\[
t(u)=t_{root}(1-0.35u)
\]

Add chordwise taper.

No symmetric aircraft airfoil.
No mechanical hinge.

---

# 40. Clione rig

Minimum:
```text
CLIONE_ROOT
CLIONE_BODY
CLIONE_HEAD
CLIONE_TAIL

L_WING_ROOT
L_WING_MID
L_WING_TIP
L_WING_LEAD
L_WING_TRAIL

R_WING_ROOT
R_WING_MID
R_WING_TIP
R_WING_LEAD
R_WING_TRAIL
```

Need controls for:
- stroke angle
- span bending
- chordwise twist
- trailing-edge lag
- wing stiffness

One bone per wing is unacceptable.

---

# 41. Distinct gaits

Create:
```text
C_HOVER_SLOW
C_SWIM_SLOW
C_GLIDE_SINK
C_SOFT_TURN
C_FAST_ESCAPE
C_FAST_HUNT
```

Measured frequency constraints:
```text
slow/hover 1–2 Hz
fast 2–5 Hz
```

Quiet-scene default:
```text
1.1–1.6 Hz
```

Fast events rare.

---

# 42. Stroke oscillator

Phase:
\[
\dot\psi=2\pi f(t)
\]

Stroke:
\[
\beta(t)=A_\beta\sin\psi
\]

Relaxed:
```text
A_beta=65°–85°
```

Total sweep:
```text
130°–170°
```

Active hover may approach:
```text
A_beta ≈ 90°
```
for ~180° total arc.

Do not use tiny wing flaps.

---

# 43. Stroke timing symmetry

Default hover:
\[
T_{up}\approx T_{down}
\]

Both half-strokes are propulsive.

Do not create a tiny recovery stroke as in some birds/insects.

---

# 44. Wing pronation/supination

Use:
\[
\alpha(t)
=
\alpha_{max}
\tanh[
k_\alpha\cos\psi(t)
]
\]

Slow/hover:
```text
alpha_max=35°–42°
k_alpha=2–5
```

Use pitch-rate limiting to avoid snap at reversal.

---

# 45. Trailing-edge lag

Hard rule:
posterior edge lags anterior edge in both half-strokes.

Let:
```text
v=0 leading edge
v=1 trailing edge
```

\[
\psi_{local}=\psi-\phi_cv
\]

Prior:
```text
slow phi_c=0.10–0.30 rad
fast phi_c=0.18–0.40 rad
```

If wing moves as a rigid plane:
FAIL.

---

# 46. Span flexibility

\[
A(u)
=
A_{root}
+
(A_{tip}-A_{root})
S(0,1,u)^p
\]

Prior:
```text
A_root=0.60–0.80 A_tip
p=1.0–1.8
```

Fast gait must visibly increase bending/flex.

---

# 47. Negative buoyancy

Clione must sink slowly if wings stop.

\[
\mathbf F_{bg}=(\rho V-m)\mathbf g
\]

Calibrate unpowered terminal sinking speed approximately:
```text
0.005–0.012 m/s
```

At slow wingbeat:
- roughly hover
- or gentle ascent

At zero frequency:
- sink

If it stays motionless:
FAIL.

---

# 48. Blade-element-inspired wing force

Split each wing into 6–12 spanwise elements.

Relative velocity:
\[
\mathbf U_j
=
\mathbf v_{body}
+
\boldsymbol\omega_{wing}\times\mathbf r_j
-
\mathbf u_{fluid}
\]

Dynamic pressure:
\[
q_j=\frac12\rho|\mathbf U_j|^2
\]

Element:
\[
dS_j=c_jdr_j
\]

Coefficient priors:
\[
C_L(\alpha)=C_{L,max}\sin(2\alpha)
\]

\[
C_D(\alpha)=C_{D0}+C_{Da}\sin^2\alpha
\]

Starting:
```text
CLmax=0.8–1.4
CD0=0.15–0.35
CDa=0.8–1.8
```

\[
dL=q_jC_LdS_j
\]
\[
dD=q_jC_DdS_j
\]

Sum both wings.

These coefficients are calibration values, not measured Clione constants.

---

# 49. Force calibration

In still virtual water:

At:
```text
f=1.2–1.5 Hz
```
target:
- hover or gentle ascent

At:
```text
f=0
```
target:
- gentle sink

At:
```text
f=3–4 Hz
```
target:
- clear increase in acceleration/speed

If velocities are nearly the same:
FAIL.

---

# 50. Body coupling

Small pitch:
\[
\theta_b
=
A_p\sin(2\psi+\phi_p)
\]

Prior:
```text
A_p=1°–4°
```

Prefer deriving body response from actual integrated wing force when stable.

Do not add arbitrary wobble.

---

# 51. Clione steering

Signed turn:
```text
T ∈ [-1,1]
```

Small amplitude difference:
\[
A_L=A_0(1-k_AT)
\]
\[
A_R=A_0(1+k_AT)
\]

Prior:
```text
kA=0.03–0.10
```

Tiny phase difference:
\[
\phi_L=-k_\phi T
\]
\[
\phi_R=+k_\phi T
\]

Prior:
```text
kphi=0.01–0.05 rad
```

Do not decouple the wings dramatically.

---

# 52. Clione torque

\[
\boldsymbol\tau
=
\sum_j\mathbf r_j\times\mathbf F_j
\]

Rigid-body:
\[
\mathbf I\dot{\boldsymbol\omega}
+
\boldsymbol\omega\times(\mathbf I\boldsymbol\omega)
=
\boldsymbol\tau
-c_\omega\boldsymbol\omega
\]

Integrate orientation as quaternion.

---

# 53. Fast gait is a separate gait

Do not just double frequency.

Literature indicates fast swimming includes:
- higher wing velocity
- higher effective angle of attack
- larger range of motion
- more wing bending

Example:
```python
SLOW = {
    "frequency": 1.35,
    "stroke_amp_deg": 75,
    "aoa_deg": 38,
    "flex_gain": 1.0,
}

FAST = {
    "frequency": 3.2,
    "stroke_amp_deg": 88,
    "aoa_deg": 48,   # tunable simulation prior
    "flex_gain": 1.35,
}
```

Do not call 48° a universal measured fast-gait constant.

---

# 54. Clione behavior weighting

Quiet snow scene:
```text
HOVER_SLOW 35–45%
SWIM_SLOW 30–40%
GLIDE_SINK 8–15%
SOFT_TURN 8–15%
FAST_ESCAPE 0–3%
FAST_HUNT disabled
```

No predation sequence by default.

---

# PART III — SHARED VIRTUAL CURRENT

# 55. No per-frame random movement

Never use fresh random position/heading noise each frame.

Use correlated low-frequency flow.

---

# 56. Divergence-free current field

\[
\mathbf u(\mathbf x,t)
=
\sum_{i=1}^{N}
A_i\mathbf b_i
\sin(
\mathbf k_i\cdot\mathbf x
+\omega_it
+\phi_i
)
\]

Require:
\[
\mathbf b_i\cdot\mathbf k_i=0
\]

Generate:
\[
\mathbf b_i
=
normalize(\mathbf k_i\times\mathbf a_i)
\]

Use:
```text
N=3–6
current magnitude 0.002–0.012 m/s
rare peak <=0.02 m/s
periods 12–60 s
```

All organisms share the same field.

This gives visual coherence.

---

# 57. Organism response to current

Aurelia:
- centroid drift
- appendage trailing
- subtle orientation drift
- still retains pulsed self-propulsion

Clione:
- more visibly affected due to size
- maintains active wingbeat
- corrects with slight body tilt and wing asymmetry
- does not tumble by default

---

# PART IV — GROUP CHOREOGRAPHY

# 58. Jellyfish spacing

Minimum center distance:
\[
d_{min,ij}=k_s(R_i+R_j)
\]

Prior:
```text
ks=1.2–1.8
```

For d<d0:
\[
\mathbf F_{sep}
=
k_{sep}
(1-d/d_0)^2
\hat{\mathbf n}
\]

No hard bouncing.

---

# 59. Wall avoidance

For distance dw:
\[
\mathbf F_w
=
k_w
S(0,d_{safe},d_{safe}-d_w)^2
\mathbf n_w
\]

Begin correction early.

Do not make last-second robot-vacuum turns.

---

# 60. Sea angels are not a school

No dominant Boids alignment.

Allowed:
- shared current
- weak separation
- independent wandering
- individual wing phases
- weak region preferences

Forbidden:
- leader
- V formation
- synchronized turns
- tight swarm

---

# 61. Sea-angel separation

Personal radius:
```text
0.06–0.14 m
```

For d<dc:
\[
\mathbf a_{sep}
=
k_c(1-d/d_c)^2\hat{\mathbf n}
\]

Keep weak.

---

# 62. Foreground event

To preserve actual small scale, occasionally let one Clione pass closer to camera.

Event spacing prior:
```text
20–55 s
```

At most one obvious foreground crossing at a time.

This is cinematic choreography, not a biological claim.

---

# 63. Smooth wander direction

\[
\mathbf d(t)
=
normalize[
\mathbf d_0
+
\sum_i
a_i\sin(\omega_it+\phi_i)\mathbf e_i
]
\]

Periods:
```text
8–40 s
```

Scene angular-speed caps:
```text
Clione normally <25°/s
Aurelia normally <8°/s
```

Turn pulses may temporarily exceed Aurelia's background cap.

---

# PART V — SNOW SCENE

# 64. Snow interaction

Snow is primarily visual.

Do not make every flake push organisms.

Optional:
snow inherits only 5–20% of projected ambient current.

Do not accumulate snow on jellyfish.

Do not create bubbles/coral/aquarium props.

---

# 65. Aurelia materials

Separate:
```text
bell
gonads
canals
oral arms
tentacles
```

Bell starting visual values:
```text
Transmission 0.65–0.90
Roughness 0.18–0.40
IOR 1.33–1.38
```

Use cool, pale, low-saturation tissue.

No bright emissive outline.

---

# 66. Clione materials

Outer body:
- transparent
- soft cool-white/bluish rim
- no shell

Internal mass:
- real-looking orange/red/brown
- limited area
- non-neon

Parapodia:
- thin
- translucent
- slightly clearer toward edge

---

# PART VI — BLENDER ARCHITECTURE

# 67. Collections

```text
SNOW_CREATURES
├── JELLIES
│   ├── JELLY_A
│   ├── JELLY_B
│   └── JELLY_C
├── CLIONE
├── CREATURE_RIGS
├── CREATURE_DEBUG
└── CREATURE_COLLISION
```

---

# 68. Aurelia rig

Recommended hybrid:
```text
Armature + Shape Keys + procedural controller
```

Broad shape keys:
```text
J_RELAXED
J_CONTRACTED
J_MARGIN_ROLLOUT
```

Use sector controls for:
- 8-way turn asymmetry
- local margin phase
- non-axisymmetric corrections

A single object scale channel is prohibited.

---

# 69. Oral-arm rig

Each:
```text
6–10 segments
```

Use:
- B-Bones
- curve deform
- or physics guides + bake

Root follows bell.
Tip lags acceleration.

---

# 70. Tentacle strategy

Use:
```text
dynamic guide curves
→ instanced/interpolated visible tentacles
```

For web, build a lower-count rigged LOD.

---

# 71. Clione rig

Each wing requires:
- root
- mid
- tip
- leading correction
- trailing correction

Need:
- stroke
- twist
- lag
- flex

One-bone wings fail QA.

---

# 72. Code organization

```text
creatures/
├── config.py
├── math_utils.py
├── fluid_field.py
├── aurelia/
│   ├── geometry.py
│   ├── materials.py
│   ├── rig.py
│   ├── pulse.py
│   ├── appendages.py
│   └── behavior.py
├── clione/
│   ├── geometry.py
│   ├── materials.py
│   ├── rig.py
│   ├── wing_kinematics.py
│   └── behavior.py
├── choreography.py
├── bake.py
├── validation.py
└── build_all.py
```

Avoid a monolithic script when possible.

---

# 73. Determinism

```python
GLOBAL_SEED = 2718
```

Derive stable per-creature seeds.

No unseeded frame randomness.

---

# 74. Simulation rate and baking

Render:
```text
30 fps
```

Simulation:
```text
120 Hz preferred
60 Hz minimum
```

Bake:
- bell pulse
- margin lag
- root motion
- turns
- oral-arm guides
- web tentacle LOD
- Clione wing motion
- Clione root paths

Saved .blend must play without a live Python process.

---

# 75. glTF / Three.js

Drivers, Geometry Nodes and Python do not automatically export.

Provide:
1. Blender master
2. baked web LOD

Bake into:
- bones
- morph target keyframes
- object transforms

Validate exported glTF.

---

# PART VII — DEFAULT PRESETS

# 76. Jelly presets

```python
JELLY_PRESETS = {
    "hero": {
        "diameter": 0.30,
        "frequency": 0.38,
        "pulse_amp": 1.00,
        "phase": 0.13,
        "drift_gain": 0.65,
    },
    "mid": {
        "diameter": 0.25,
        "frequency": 0.44,
        "pulse_amp": 0.93,
        "phase": 0.61,
        "drift_gain": 0.82,
    },
    "far": {
        "diameter": 0.20,
        "frequency": 0.34,
        "pulse_amp": 0.88,
        "phase": 0.37,
        "drift_gain": 1.00,
    },
}
```

---

# 77. Clione slow frequencies

Default five:
```text
1.14
1.27
1.39
1.51
1.63 Hz
```

Smooth modulation ±5–8%.

```python
CLIONE_SLOW = {
    "frequency": 1.35,
    "stroke_amp_deg": 76,
    "aoa_deg": 38,
    "trail_phase_rad": 0.20,
    "flex_gain": 1.0,
}

CLIONE_HOVER = {
    "frequency": 1.22,
    "stroke_amp_deg": 82,
    "aoa_deg": 40,
    "trail_phase_rad": 0.21,
    "flex_gain": 1.0,
}

CLIONE_FAST = {
    "frequency": 3.2,
    "stroke_amp_deg": 88,
    "aoa_deg": 48,
    "trail_phase_rad": 0.29,
    "flex_gain": 1.35,
}
```

Fast AoA is a tunable prior.

---

# PART VIII — AUTOMATED QA

# 78. Aurelia morphology QA

Fail if:
```text
gonad count !=4
oral arm count !=4
bell uniform thickness
bell box-like
long sea-nettle tentacles
no margin anatomy
```

---

# 79. Aurelia flexible-margin QA

Measure deformation at:
```text
r=0.30,0.60,0.90,1.00
```

Require:
\[
A(1.0)>A(0.6)>A(0.3)
\]

Outer ~17–20% must have measurable lag.

Identical phase/amplitude at all radii:
FAIL.

---

# 80. Pulse timing QA

Require:
```text
Tc < Tr
peak contraction speed > peak relaxation speed
```

Symmetric sine pulse:
FAIL.

---

# 81. PER QA

In straight calibration:
```text
D_active
D_interpulse
D_total
```

Target:
\[
0.25<=D_{interpulse}/D_{total}<=0.35
\]

No glide contribution:
FAIL.

---

# 82. Aurelia turning QA

Require:
- measurable opposite-margin timing difference
- smooth rotation
- no instant velocity-direction snap
- no rigid-only object turn

---

# 83. Clione morphology QA

Fail if:
```text
shell present
body opaque
posterior not tapered
internal orange/red mass absent
feathered wings
rigid wings
```

---

# 84. Clione slow-gait QA

Require:
```text
1.0 <= f <= 2.0 Hz
```

Prefer total wing arc:
```text
>=130°
hero hover often ~150–180°
```

Both half strokes contribute.

---

# 85. Clione trailing-edge QA

At multiple wing phases:
posterior edge must lag anterior edge.

Rigid flat paddle:
FAIL.

---

# 86. Clione no-wing QA

Set frequency=0.

Must sink gently.

Perfect hover:
FAIL.

---

# 87. Clione fast-gait QA

Verify fast gait increases more than frequency:
- wing speed
- stroke range
- AoA
- flex
- acceleration

Only frequency changes:
FAIL.

---

# 88. Group QA

Fail if:
- 3 jellyfish stay synchronized
- Clione form a fish school
- multiple foreground Clione constantly cross together
- organisms destroy negative space
- motion looks like screensaver loops
- all creatures follow perfect circles

---

# PART IX — DEBUG

# 89. Debug overlays

Aurelia:
```text
radial coordinate
83% flexion region
8 sectors
C(t)
margin qf(t)
velocity
current
PER active
```

Clione:
```text
stroke angle
AoA
leading/trailing phase
blade force vectors
buoyancy
velocity
current
```

Hide for render.

---

# 90. Diagnostic data

Jelly CSV:
```text
time
phase
C
C_dot
margin_response
speed
pulse_force
PER_force
drag
distance
```

Clione CSV:
```text
time
gait
wing_phase
stroke_angle
wing_pitch
frequency
left_force
right_force
vertical_speed
sink_force
```

---

# PART X — BUILD ORDER

# 91. Implementation sequence

1. one static Aurelia
2. morphology QA
3. one pulse
4. margin-lag QA
5. propulsion + PER
6. appendages
7. turning
8. clone to A/B/C with varied parameters
9. one static Clione
10. Clione slow gait
11. negative-buoyancy QA
12. fast gait
13. Clione turning
14. create five individuals
15. shared current
16. choreography
17. bake
18. web LOD/export
19. final validation

Never duplicate an unvalidated base creature.

---

# PART XI — FAILURE MODES

# 92. Reject Aurelia if it looks like

```text
breathing sphere
uniformly scaled umbrella
ghost with long hair
generic glowing jelly
balloon
```

Fix:
- radial deformation
- outer passive flap
- asymmetric timing
- PER glide
- sector turn control

---

# 93. Reject Clione if it looks like

```text
butterfly
bird
fairy
tiny manta
fish with two fins
```

Fix:
- increase stroke arc
- add flexible span/chord deformation
- add trailing-edge lag
- preserve 1–2 Hz slow gait
- add negative buoyancy
- make fast gait structurally distinct

---

# PART XII — FINAL ART DIRECTION

# 94. Intended final rhythm

Viewer first notices:
```text
snow
space
natural light
silence
```

Then one jelly slowly pulses and glides.

The second follows a different rhythm.

The third remains distant.

Only later does one small Clione become visible crossing the foreground.

Other Clione hover or drift in less prominent regions.

Sea angels reward long viewing; they do not demand attention every second.

---

# 95. Motion density rule

Any random 2-second window may contain:
- only 1 obvious jelly contraction
- others relaxing/gliding
- only 1–2 visually obvious Clione
- other sea angels nearly invisible

Do not maximize every animation channel simultaneously.

---

# 96. Quietness is not global slow motion

Do not slow all biology to 25%.

Quietness comes from:
- sparse events
- low translation speed
- long glide
- gentle current
- few turns
- negative space
- restrained lighting

Preserve Clione's characteristic 1–2 Hz slow gait.

The contrast is desirable:
```text
large moon jelly = slow pulse
tiny Clione = faster but small wing rhythm
```

---

# 97. Animator-facing controls

Global:
```text
creature_motion_gain
virtual_current_gain
scene_quietness
global_seed
```

Aurelia:
```text
diameter
pulse_frequency
pulse_amplitude
contraction_ratio
relaxation_ratio
glide_ratio
margin_flex_gain
margin_damping
PER_gain
turn_gain
drift_gain
oral_arm_damping
tentacle_damping
```

Clione:
```text
body_length
gait
wing_frequency
stroke_amplitude
angle_of_attack
trailing_edge_lag
wing_flex_gain
buoyancy_deficit
turn_gain
current_response
```

---

# 98. scene_quietness

Q ∈ [0,1].

Higher Q should:
- lower translation speed
- lower event frequency
- reduce turns
- reduce active-cruise probability
- slightly lengthen jelly glide
- reduce current strength
- reduce foreground crossings

Do not push Clione below plausible slow gait.

Example:
\[
f_{clione}
=
clamp[f_{base}(1-0.10Q),1.0,2.0]
\]

---

# 99. Completion checklist

```text
[ ] exactly 3 moon jellyfish
[ ] 4–7 Clione, default 5

[ ] recognizable Aurelia bell
[ ] 4 gonads
[ ] 4 oral arms
[ ] canal system
[ ] ring canal
[ ] numerous short marginal tentacles
[ ] 8 marginal sensory regions

[ ] pulse not uniform scale
[ ] contraction faster than relaxation
[ ] outer margin passive lag
[ ] nonconstant swimming velocity
[ ] PER/interpulse glide
[ ] asynchronous turn
[ ] oral-arm secondary dynamics
[ ] tentacle trailing

[ ] Clione transparent shell-less body
[ ] internal orange/red anatomy
[ ] paired flexible parapodia
[ ] slow gait 1–2 Hz
[ ] broad wing sweep
[ ] roughly symmetric half strokes
[ ] posterior edge lag
[ ] pronation/supination
[ ] no-wing sinking
[ ] structurally distinct fast gait

[ ] shared smooth current
[ ] no per-frame random jitter
[ ] jellyfish not synchronized
[ ] Clione do not school
[ ] negative space preserved

[ ] reusable controls
[ ] animation baked
[ ] .blend saved
[ ] glTF/web LOD checked when required
[ ] validation has no critical FAIL
```

---

# 100. Final non-negotiable tests

## Test A — flat-gray silhouette
Aurelia must still read as moon jelly.
Clione must still read as a shell-less pteropod.

## Test B — disable root translation
Bell motion alone must look plausible.
Clione wings alone must look biologically plausible.

## Test C — freeze Clione wings
Clione must sink.

## Test D — 60-second three-jelly preview
Check:
- synchronization
- repetition
- wall collisions
- excessive activity
- identical paths

## Test E — 60-second Clione preview
Check:
- butterfly-like flight
- jitter
- fake hover
- rigid wing planes
- synchronized group movement

Fix before delivery.

---

# 101. Priority order

```text
1. biological silhouette
2. primary locomotion
3. correct timing
4. flexible secondary motion
5. behavioral path plausibility
6. asynchronous choreography
7. web performance
8. shader complexity
```

Never sacrifice locomotion just to add glow.

---

# 102. Final instruction to Codex

Do NOT interpret this as:

"Make pretty jellyfish and cute sea angels float around."

Interpret it as:

"Build two distinct locomotor systems whose visible animation is constrained by known biological mechanics, then place them inside a surreal snowy architectural scene."

For Aurelia:
```text
fast contraction
→ propulsion
→ slower elastic refill
→ stopping-vortex/PER-informed continued glide
→ intermittent asymmetric margin correction
```

For Clione:
```text
continuous broad parapodial stroke
→ pronation/supination
→ posterior-edge lag
→ propulsion in both half-strokes
→ hover against slight negative buoyancy
```

The formulas should disappear into the final visual result.

The viewer should not see mathematics.

The viewer should simply believe that these animals are alive.

---

# 103. Scientific references

## Aurelia morphology
- WoRMS, Aurelia aurita:
  https://www.marinespecies.org/aphia.php?id=135306&p=taxdetails
- MarLIN, Moon jellyfish:
  https://www.marlin.ac.uk/species/detail/2089
- Aurelia genus morphology/systematics review:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC8435205/

## Aurelia swimming
- McHenry MJ, Jed J. 2003. The ontogenetic scaling of hydrodynamics and swimming performance in jellyfish.
  DOI: 10.1242/jeb.00649
  https://journals.biologists.com/jeb/article/206/22/4125/14117/
- Gemmell BJ et al. 2013. Passive energy recapture in jellyfish contributes to propulsive advantage over other metazoans.
  https://pmc.ncbi.nlm.nih.gov/articles/PMC3816424/
- Villanueva A et al. 2014. Flexible Margin Kinematics and Vortex Formation of Aurelia aurita and Robojelly.
  DOI: 10.1371/journal.pone.0098310
  https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0098310
- Gemmell BJ et al. 2015. Control of vortex rings for manoeuvrability.
  https://pmc.ncbi.nlm.nih.gov/articles/PMC4528605/
- Costello JH et al. 2024. Turning kinematics of the scyphomedusa Aurelia aurita.
  DOI: 10.1088/1748-3190/ad1db8
  https://pubmed.ncbi.nlm.nih.gov/38211351/

## Clione
- Satterlie RA, LaBarbera M, Spencer AN. 1985. Swimming in the Pteropod Mollusc, Clione limacina: I. Behaviour and Morphology.
  DOI: 10.1242/jeb.116.1.189
- Satterlie RA, Spencer AN. 1985. Swimming in the Pteropod Mollusc, Clione limacina: II. Physiology.
  DOI: 10.1242/jeb.116.1.205
- Szymik BG, Satterlie RA. 2011. Changes in wingstroke kinematics associated with a change in swimming speed in Clione limacina.
  DOI: 10.1242/jeb.058461
  https://pubmed.ncbi.nlm.nih.gov/22071184/
- Review of Clione locomotor acceleration:
  https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2022.1072974/full
- Naturalis pelagic mollusc resources:
  https://pelagic-molluscs.linnaeus.naturalis.nl/

---

# 104. Version note

This is v1.

Potential v2:
- reference-video fitting
- optical-flow comparison against real Aurelia pulses
- silhouette regression tests
- measured Clione wing-tip trajectory fitting
- more detailed immersed-boundary/CFD propulsion
- obstacle-aware route planner
- runtime Three.js procedural controller equivalent to Blender master

Do not implement v2 before v1 passes all core QA.
