---
title: "Quiet Places 生物規格 — Pleuragramma antarcticum"
version: "v1.0"
species: "Pleuragramma antarcticum"
common_name_zh: "南極銀魚"
common_name_en: "Antarctic silverfish"
role: "Secondary schooling layer / transient event"
target_stack:
  - Blender
  - Three.js
  - instanced skinned mesh
  - GPU flocking optional
scene_context: "極暗雪景走廊 / 遠端窗面冷光"
evidence_policy: "species ecology and pelagic schooling are research-grounded; body-wave parameters are conservative teleost engineering approximations"
---

# 0. 文件用途

這份文件只處理 **Pleuragramma antarcticum** 的：

- 形體
- 材質
- swimming wave
- schooling
- group shape
-個體差異
- 速度分層
- 驗收標準

種間互動、稀有事件與整個場景 scheduler 請讀：

- `01-galiteuthis-glacialis.md`
- `03-antarctic-behavior-system.md`

---

# 1. 研究可信度標記

## [A] 物種層級證據
- pelagic
- schooling
- Antarctic shelf / sea-ice association
- swim-bladderless notothenioid
- lipid-based buoyancy adaptations
- swimming muscle specialisation

## [B] 一般魚類運動學 proxy
- traveling body wave
- tail beat kinematics
- turning model

## [C] 工程參數
- body-wave amplitude
- schooling radius
- school size in this artwork
- exact speed
- exact event cadence

---

# 2. 生物學摘要 [A]

`Pleuragramma antarcticum`：

- 是 Antarctic notothenioid fish
- 是高南極食物網的關鍵 pelagic fish
- 所有發育階段都生活於水柱中
- 可分布於開放水域與 pack-ice environments
- 記錄深度可由表層延伸到數百公尺
- 成魚與幼魚皆和 sea-ice ecosystem 有緊密關係
- 為 schooling / shoaling fish
- 沒有典型 swim bladder
- 透過 lipid storage / low-density tissues 等方式增加浮力
- 具有適應 sustained pelagic swimming 的肌肉與體型特化

---

# 3. 作品角色

Silverfish 在本場景中不是常駐主角。

它們應該：

- 大部分時間不在畫面
- 偶爾從黑暗出現
- 形成鬆散 school
- 穿過窗前冷光
- 銀色身體短暫反射
- 再消失

推薦：

```yaml
school_count_active: 0-1
school_size_normal: 12-30
school_size_rare_large_event: 32-50
```

不建議常駐 50+ 隻。

---

# 4. 形體

# 4.1 造型原則

應該看起來：

- 細長
- 銀白
- 輕盈
- 冷水魚
- 軀幹相對柔順
- 尾柄較細
- 不像沙丁魚罐頭圖示
- 不像 tropical tetra
- 不像發光魚

---

# 4.2 比例 [C]

以：

```math
BL=1
```

建議：

```yaml
body_length: 1.00
max_body_depth: 0.16-0.22
head_length: 0.20-0.26
eye_diameter: 0.06-0.10
caudal_peduncle_depth: 0.07-0.11
pectoral_fin_length: 0.08-0.14
```

---

# 4.3 身體曲線

body lateral profile 可用：

```math
h(x)
=
h_{max}
\sin(\pi x)^p
(1-qx)
```

其中：

```math
x \in [0,1]
```

建議：

```yaml
p: 0.55-0.85
q: 0.12-0.25
```

尾柄附近需額外 taper：

```math
T(x)=
1-r
\cdot
smoothstep(x_0,1,x)
```

```yaml
x0: 0.72-0.82
r: 0.45-0.65
```

---

# 5. 材質

不使用 emission。

```yaml
emission: 0
```

魚的「亮」應來自反射。

推薦：

```yaml
base_color: "cold silver-grey"
dorsal_value: 0.35-0.50
lateral_value: 0.55-0.72
ventral_value: 0.62-0.78
roughness: 0.38-0.60
specular: 0.35-0.55
metalness: 0.0-0.08
```

不要真正 metallic = 1。

---

# 6. 鱗片反射

不要每片鱗都建 geometry。

使用：
- normal breakup
- micro-roughness
- anisotropic-like highlight approximation
- subtle lateral stripe modulation

可將視角反射寫為：

```math
R_i =
K_s
(\max(0,r_i\cdot v))^n
```

再乘：
- light field
- side mask
- fish orientation

```math
R'_i=
R_i
L(p_i)
M_{side}(\theta_i)
```

重點：
魚群掠過窗前時，一整群「閃一下」，
不是每條魚像 LED。

---

# 7. Rig

每條魚：

```text
root
└── head
    └── body_01
        └── body_02
            └── body_03
                └── body_04
                    └── caudal_peduncle
                        └── tail
```

推薦：
- 6–9 body segments
- pectoral fins 可用 1–2 bones
- dorsal / anal fins 可不獨立骨架
- instancing 需支援 phase offset

---

# 8. 游泳波形

使用 traveling wave：

```math
y(x,t)=
A(x)
\sin
\left(
2\pi ft
-
\frac{2\pi}{\lambda}x
+
\phi
\right)
```

其中：
- `x=0` head
- `x=1` tail

振幅：

```math
A(x)
=
BL
\left[
a_0+
(a_1-a_0)x^p
\right]
```

建議 [C]：

```yaml
a0: 0.005-0.015
a1: 0.045-0.080
p: 1.4-1.8
```

頭部 motion 必須非常小。

---

# 9. Tail beat

狀態：

```text
DRIFT
CRUISE
TRANSIT
BURST
TURN
```

推薦：

```yaml
DRIFT:
  speed_bl_s: 0.20-0.45
  tail_freq_hz: 0.8-1.5

CRUISE:
  speed_bl_s: 0.45-0.90
  tail_freq_hz: 1.4-2.6

TRANSIT:
  speed_bl_s: 0.80-1.40
  tail_freq_hz: 2.2-3.6

BURST:
  speed_bl_s: 1.50-2.80
  tail_freq_hz: 3.5-5.5
  duration_s: 0.3-1.2
```

BURST 不可成為常態。

---

# 10. 速度與頻率關係

用簡化 proxy：

```math
u
=
\eta f\lambda
```

其中：

```yaml
eta: 0.55-0.80
lambda_bl: 0.70-1.05
```

注意：
這是 animation calibration relation，
不是要做 hydrodynamic truth claim。

---

# 11. Turn deformation

轉彎時中軸加入 curvature：

```math
y_{turn}(x)
=
\kappa
x^m
```

建議：

```yaml
m: 1.4-2.2
```

與 wave 疊加：

```math
y'(x,t)=
y_{swim}(x,t)+y_{turn}(x)
```

`κ` 與目標 yaw error 成正比：

```math
\kappa=
K_\kappa
clamp(\Delta\psi,-\psi_m,\psi_m)
```

尾巴不可以硬折。

---

# 12. Schooling 模型

每條魚：

```math
a_i=
w_sS_i+
w_aA_i+
w_cC_i+
w_fF_i+
w_wW_i+
w_lL_i+
w_nN_i+
w_oO_i
```

含義：

- `S_i`: separation
- `A_i`: alignment
- `C_i`: cohesion
- `F_i`: global flow bias
- `W_i`: wall avoidance
- `L_i`: light-zone shaping
- `N_i`: noise
- `O_i`: squid / obstacle avoidance

---

# 13. Separation

鄰居集合：

```math
\mathcal N_s=
\{j:\|p_j-p_i\|<r_s\}
```

力：

```math
S_i=
\sum_{j\in\mathcal N_s}
\frac{p_i-p_j}
{(\|p_i-p_j\|+\epsilon)^2}
```

建議：

```yaml
r_sep_bl: 0.25-0.45
```

---

# 14. Alignment

```math
A_i=
\bar v_{\mathcal N_a}-v_i
```

```yaml
r_align_bl: 0.9-1.8
```

不要讓 alignment 權重過高，
否則會像機械編隊。

---

# 15. Cohesion

```math
C_i=
\bar p_{\mathcal N_c}-p_i
```

```yaml
r_cohesion_bl: 1.8-3.5
```

cohesion 應弱於 separation。

---

# 16. 推薦權重

```yaml
w_sep: 1.8
w_align: 1.2
w_cohesion: 0.7
w_flow: 1.1
w_wall: 1.4
w_light: 0.5
w_noise: 0.15
w_avoid: 1.3
```

全部 config 化。

---

# 17. 鄰居權重

不要 binary neighbor。

使用：

```math
w(d)=
\exp
\left[
-\left(\frac{d}{r}\right)^2
\right]
```

可降低 abrupt response。

---

# 18. School shape

不要球狀群聚。

推薦 covariance：

```math
\Sigma=
diag
(
\sigma_{long}^2,
\sigma_{vert}^2,
\sigma_{lat}^2
)
```

```yaml
sigma_long_bl: 1.8-3.2
sigma_vertical_bl: 0.35-0.80
sigma_lateral_bl: 0.8-1.6
```

得到：
- 長
- 扁
- 輕微有層次

---

# 19. 群體中心路徑

群體中心：

```math
P_s(t)
```

魚群個體：

```math
p_i(t)=
P_s(t)+R_s(t)\xi_i(t)
```

其中：
- `R_s(t)`：school orientation matrix
- `ξ_i`：local school-space coordinate

這樣可把：
- 大方向
- 個體 boid

分開控制。

---

# 20. Light-zone compression

定義 light intensity：

```math
L(P_s)\in[0,1]
```

school scale：

```math
s_{school}(L)
=
1-c_L L
```

推薦：

```yaml
compression_strength_cL: 0.10-0.20
```

也就是：
進入亮區時稍微靠攏，
不是劇烈縮成一團。

---

# 21. Fish phase desynchronization

每條魚：

```math
\phi_i\sim U(0,2\pi)
```

但 alignment 高時，
可有很弱 phase attraction：

```math
\dot\phi_i
=
\omega_i+
K_\phi
\sum_j
\sin(\phi_j-\phi_i)
```

推薦：

```yaml
K_phi: 0.0-0.08
```

甚至可先設 0。

不要做 synchronized tail wave。

---

# 22. 個體差異

```yaml
body_length_multiplier: 0.92-1.08
tail_frequency_multiplier: 0.88-1.12
speed_multiplier: 0.90-1.10
specular_multiplier: 0.90-1.10
turn_responsiveness_multiplier: 0.85-1.15
noise_multiplier: 0.80-1.25
phase: random
```

---

# 23. Startle / burst

非必要事件。

若需要：

觸發：

```math
d_{threat}<r_{startle}
```

反應延遲：

```yaml
latency_s: 0.08-0.25
```

burst：

```yaml
duration_s: 0.3-1.2
speed_bl_s: 1.5-2.8
```

群體不要全部同一 frame 啟動。

可使用：

```math
t_i=
t_0+
\delta_i
```

```yaml
delta_i_s: 0.00-0.35
```

---

# 24. 牆面避讓

使用 signed distance field：

```math
d_w(p)
```

當：

```math
d_w<d_{safe}
```

產生：

```math
W_i=
K_w
\left(
\frac{1}{d_w+\epsilon}
-
\frac{1}{d_{safe}}
\right)
\nabla d_w
```

避免：
- 魚穿牆
- 靠牆瞬間 180° turn

---

# 25. 出現 / 消失

不要 teleport。

school entry：
- 從視野外 2–5 BL 起始
- 黑暗中先看見少數 specular
- 再逐漸進入光帶

exit：
- 進入陰影後 opacity 不需真的 fade
- 應由 lighting 自然讓牠失去可見度

---

# 26. 銀魚群事件節奏

建議：

```yaml
event_interval_s: 45-140
event_visible_duration_s: 6-12
```

不是固定值。

使用：

```math
\Delta t
\sim
LogNormal(\mu,\sigma)
```

比 uniform 更自然。

例如：

```yaml
median_interval_s: 78
sigma_log: 0.35
```

---

# 27. 驗收標準

## Individual
- [ ] 頭部不亂擺
- [ ] tail amplitude 往後增加
- [ ] body wave 是 traveling wave
- [ ] turn 不折腰
- [ ] reflection 不是 emission

## School
- [ ] 群體鬆散
- [ ] 不同步
- [ ] 不穿模
- [ ] 不球狀
- [ ] 不像粒子特效
- [ ] 進入亮區稍微壓縮
- [ ] 離開亮區重新鬆開

## Scene
- [ ] 平常看不到大片魚群
- [ ] 魚群出現是事件
- [ ] 一次穿過後會留下空白
- [ ] 光比魚本身重要
- [ ] 沒有 aquarium spectacle 感

---

# 28. 研究參考

優先查：

1. La Mesa, M. & Eastman, J.T.  
   *Antarctic silverfish: life strategies of a key species in the high-Antarctic ecosystem*  
   Fish and Fisheries, 2012.

2. Johnston, I.A., Camm, J.-P. & White, M.  
   *Specialisations of swimming muscles in the pelagic Antarctic fish Pleuragramma antarcticum*  
   Marine Biology, 1988.

3. Wöhrmann et al.  
   work on adaptation of `Pleuragramma antarcticum` to pelagic life in high-Antarctic waters.

4. DeVries, A.L. & Eastman, J.T.  
   work on lipid sacs / buoyancy adaptations.

5. Eastman, J.T. & DeVries, A.L.  
   work on lipid sac ultrastructure.

6. Maes, J. et al.  
   *State-dependent energy allocation in the pelagic Antarctic silverfish ... trade-off between winter reserves and buoyancy*.

7. O'Driscoll et al.  
   work on Antarctic silverfish distribution, abundance and acoustic properties in the Ross Sea.

---

# 29. Codex 最後提醒

Silverfish 的自然感主要來自：

1. 不同步
2. 不密集
3. 不做完美 boids
4. 光線造成群體視覺事件
5. 偶爾一兩條短暫脫隊再回歸
6. 大部分時間場景仍然是空的

如果覺得「不夠精彩」，
優先：
- 調整光影
- 調整進場 timing
- 調整群形

不要先加更多魚。
