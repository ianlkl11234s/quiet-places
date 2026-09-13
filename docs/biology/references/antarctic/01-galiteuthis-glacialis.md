---
title: "Quiet Places 生物規格 — Galiteuthis glacialis"
version: "v1.0"
species: "Galiteuthis glacialis"
common_name_zh: "南極玻璃魷魚"
common_name_en: "Antarctic glass squid / glacial glass squid"
role: "Primary ambient creature"
target_stack:
  - Blender
  - Three.js
  - custom procedural animation
scene_context: "極暗雪景走廊 / 遠端窗面冷光 / 非水族館化"
evidence_policy: "species morphology is research-grounded; locomotion is conservative cranchiid/deep-sea squid proxy where species-specific kinematics are unavailable"
---

# 0. 文件用途

這份文件只處理 **Galiteuthis glacialis** 的：

- 形體
- 材質
- rig
- 游姿
- fin motion
- jet motion
- arms / tentacles secondary motion
- 個體差異
- 驗收標準

**不要在這份文件中實作魚群 schooling。**
魚群、種間互動與場景事件請讀：

- `02-pleuragramma-antarcticum.md`
- `03-antarctic-behavior-system.md`

---

# 1. 研究可信度標記

本文件使用三種標記：

## [A] 直接物種層級證據
可以直接用於 `Galiteuthis glacialis` 的形態、生境或生活史。

## [B] 同科 / 深海魷魚代理
物種本身缺乏足夠 in-situ 運動學資料，因此用 Cranchiidae 或深海魷魚 locomotion 文獻做保守近似。

## [C] 工程參數
為了 Blender / Three.js 穩定實作而定義，不宣稱為生物學實測值。

> Codex 不得把 [C] 參數寫成「科學文獻證明」。

---

# 2. 生物學摘要

## 2.1 分類與生境 [A]

`Galiteuthis glacialis` 屬於：

- Mollusca
- Cephalopoda
- Decapodiformes
- Cranchiidae
- Galiteuthis

為南大洋 / 南極水域重要的玻璃魷類。

研究資料顯示其：
- 出現在南極周邊水域
- 早期生活史可在上層與中層水體中出現
- 大型成體可進入較深的 bathypelagic 環境
- 身體透明度高
- 形體細長
- 眼部具有特化構造與 photophore-like structures

## 2.2 運動學資料限制 [A/B]

目前可取得的 `G. glacialis` 資料：

- systematics / morphology：相對完整
- distribution / early life stages：相對完整
- species-specific in-situ swimming kinematics：非常有限

因此本專案不可假裝知道它的：
- 精準 fin beat frequency
- 精準 jet cadence
- 精準 turn radius
- 精準 body acceleration curve

本文件採：
- **外形：species-specific**
- **游姿：cranchiid / deep-sea squid conservative proxy**
- **參數：可調、低速、弱噴射、fin-dominant**

---

# 3. 作品中的角色定位

這隻生物不是「主角表演者」。

它應該像：

- 一個在黑暗裡慢慢漂移的透明生命
- 靠近光線時才被看見
- 離開光線後迅速失去輪廓
- 動作很少，但每個小動作都要有生命感

推薦數量：

```yaml
count: 2-3
```

推薦個體角色：

```yaml
squid_A:
  role: "中央深處慢巡航"
  visibility: "最高"
  jet_usage: "最低"

squid_B:
  role: "牆邊陰影 / 深度調整"
  visibility: "中"
  jet_usage: "低"

squid_C:
  role: "偶發短暫穿越"
  visibility: "最低"
  jet_usage: "中低"
```

---

# 4. 形體建模

# 4.1 基本輪廓

必須呈現：

- 細長 mantle
- 小而緊湊的 head
- 大眼
- posterior fins
- 柔軟 arms
- 更長的 tentacles
- 高透明感
- 不厚重
- 不像 cuttlefish
- 不像 reef squid
- 不像 colossal squid

禁止：
- 厚重橢圓身體
- 大面積肌肉感
- 短粗觸手
- 明顯攻擊姿勢
- exaggerated fantasy fins

---

# 4.2 比例系統 [C]

以 mantle length 為：

```math
ML = 1
```

建議：

```yaml
mantle_length: 1.00
mantle_max_width: 0.18-0.26
head_length: 0.16-0.22
eye_diameter: 0.10-0.16
fin_length_root_to_tip: 0.18-0.28
arm_length: 0.45-0.75
tentacle_rest_length: 0.65-1.20
```

這些是 **建模約束**，不是 museum measurement table。

若模型看起來：
- 太胖 → 先縮 `mantle_max_width`
- 太像花枝 → 再縮 body depth，並將 fins 往 posterior 收
- 太卡通 → 降低 eye exaggeration 與 arm thickness

---

# 4.3 Mantle 曲面

可將 mantle 中軸參數設為：

```math
s \in [0,1]
```

其中：
- `s=0`：head / anterior mantle
- `s=1`：posterior mantle tip

橫向半徑可用：

```math
r(s) = r_{max}
       \cdot
       \sin(\pi s)^{p}
       \cdot
       (1 - q s)
```

建議：

```yaml
p: 0.65-0.95
q: 0.10-0.22
```

目的：
- anterior 不要突然鼓起
- posterior 要逐漸收尖
- 避免 perfect ellipsoid

可加入很弱的不對稱：

```math
r'(s,\theta) =
r(s)
\left[
1+\epsilon_r \sin(2\theta+\phi)
\right]
```

```yaml
epsilon_r: 0.005-0.015
```

---

# 5. 材質

# 5.1 透明度

不要做成：
- 玻璃雕塑
- 水晶
- 果凍玩具

建議：

```yaml
mantle_opacity: 0.08-0.18
arms_opacity: 0.10-0.22
fins_opacity: 0.10-0.20
```

透明度不是均勻的。

推薦：

```math
\alpha(x) =
\alpha_{base}
+
\alpha_{edge}F_{fresnel}
+
\alpha_{organ}M_{organ}
```

其中：
- `F_fresnel`：視角邊緣略可見
- `M_organ`：內部器官遮罩

---

# 5.2 Fresnel

```math
F =
(1-\max(0,n\cdot v))^p
```

建議：

```yaml
fresnel_power: 3.0-5.5
fresnel_strength: 0.08-0.18
```

目的：
- 讓輪廓在黑暗背景中微微浮出
- 不要產生亮白 rim light

---

# 5.3 內部器官

透明生物如果「完全透明」會很假。

至少保留：

- 眼球
- digestive / visceral core
- gladius-like central internal line
- mantle wall thickness
- arm root tissues

器官 visibility 建議：

```yaml
internal_organ_opacity: 0.18-0.40
organ_saturation: "very low"
organ_hue: "cold grey / faint neutral beige"
```

---

# 5.4 Photophore

若有使用 photophore：

**不要將它做成主要發光來源。**

預設：

```yaml
photophore_emission_enabled: false
```

若開啟：

```yaml
photophore_emission:
  intensity_relative_to_window: 0.02-0.06
  hue: "cold white / faint ice blue"
  radius: "very small"
  bloom: "almost none"
```

亮度 envelope：

```math
L(t)=
L_{max}
\cdot
\frac{1+\sin(2\pi f_l t+\phi)}{2}
```

但不要一直週期呼吸。

再乘一個稀疏 gate：

```math
G(t)\in\{0,1\}
```

```math
L'(t)=G(t)L(t)
```

其中：
- `G=1` 只在少數時段
- 各個體不同步

---

# 6. Rig 結構

推薦：

```text
root
└── mantle_root
    ├── mantle_mid
    ├── mantle_posterior
    ├── head
    │   ├── eye_L
    │   ├── eye_R
    │   ├── arm_01_chain
    │   ├── arm_02_chain
    │   ├── ...
    │   ├── tentacle_L_chain
    │   └── tentacle_R_chain
    ├── fin_L_root
    │   ├── fin_L_mid
    │   └── fin_L_tip
    └── fin_R_root
        ├── fin_R_mid
        └── fin_R_tip
```

推薦：
- fins：3–5 controls / side
- arms：4–7 bones / arm
- tentacles：7–12 bones / tentacle

---

# 7. 游動狀態機

```text
IDLE_HOVER
  ↓
SLOW_CRUISE
  ↓
GENTLE_TURN
  ↓
SLOW_CRUISE

IDLE_HOVER
  ↘ DEPTH_ADJUST

SLOW_CRUISE
  ↘ MICRO_JET_REPOSITION
```

不要加入：
- perpetual patrol loop
- attack mode
- chase mode
- random frantic mode

---

# 8. 平移模型

位置：

```math
p(t)=[x(t),y(t),z(t)]
```

朝向：

```math
d(t)=
[
\cos\theta\cos\psi,
\sin\theta,
\cos\theta\sin\psi
]
```

位置更新：

```math
\dot p = v d
```

速度：

```math
m\dot v =
F_{fin}
+
F_{jet}
-
D(v)
```

阻力：

```math
D(v)=c_1v+c_2|v|v
```

建議 [C]：

```yaml
c1: 0.4-0.9
c2: 0.8-1.6
```

核心感覺：
- 加速慢
- 減速有阻尼
- 不會像太空船滑行
- 不會突然停住

---

# 9. Fin undulation

以 fin root → tip 的 normalized arc length：

```math
s\in[0,1]
```

波形：

```math
\alpha(s,t)=
A(s)
\sin(
2\pi f t
+
ks
+
\phi
)
```

振幅：

```math
A(s)=A_0(0.35+0.65s)
```

建議：

```yaml
A0_deg: 8-18
frequency_hz: 0.25-0.80
wave_number: 1.2pi-2.0pi
```

左右 fin：

```math
\phi_R =
\phi_L + \pi + \epsilon
```

```yaml
epsilon_rad: -0.18 to 0.18
```

**重要：**
不要完全鏡像。

---

# 10. Fin thrust proxy

不做 CFD。

使用可控 proxy：

```math
T_{fin} =
K_f
A_0
f
C_{state}
```

其中：

```yaml
C_state:
  IDLE_HOVER: 0.20-0.35
  SLOW_CRUISE: 0.55-0.85
  GENTLE_TURN: 0.40-0.70
  DEPTH_ADJUST: 0.25-0.45
```

速度必須由 damping 限制。

---

# 11. Jet pulse

jet 只是一種：
- reposition
- short acceleration
- orientation correction

不是主巡航。

脈衝：

```math
F_{jet}(t)=
\sum_j
A_j
\exp
\left[
-\frac{(t-t_j)^2}{2\sigma_j^2}
\right]
d_j
```

建議：

```yaml
pulse_amplitude_relative: 0.4-1.2
sigma_seconds: 0.05-0.18
minimum_interval_seconds: 4
typical_interval_seconds: 8-20
```

同一隻 squid：
- 不應固定每 N 秒 jet
- event time 使用 stochastic scheduler

例如：

```math
P(jet|\Delta t)
=
1-e^{-\lambda \Delta t}
```

低頻：

```yaml
lambda_per_second: 0.03-0.08
```

---

# 12. Turn dynamics

yaw：

```math
\dot\psi =
clamp
\left(
\frac{\psi_{target}-\psi}{\tau_\psi},
-\omega_{max},
\omega_{max}
\right)
```

pitch：

```math
\dot\theta =
clamp
\left(
\frac{\theta_{target}-\theta}{\tau_\theta},
-\nu_{max},
\nu_{max}
\right)
```

建議：

```yaml
tau_yaw_s: 1.2-3.5
yaw_max_deg_s: 12-28

tau_pitch_s: 1.5-4.0
pitch_max_deg_s: 8-18
```

turn 時：
- 外側 fin amplitude 稍增
- 內側 fin amplitude 稍減
- mantle 只做很小 roll
- 不要像飛機 bank turn

---

# 13. Roll

自然 roll 很弱：

```math
\phi_{roll,target}
=
K_r\dot\psi
```

限制：

```yaml
roll_max_deg: 3-8
```

使用低通：

```math
\tau_r\dot\phi+\phi=\phi_{target}
```

```yaml
tau_roll_s: 0.8-1.8
```

---

# 14. Arms / tentacles secondary motion

每節 joint：

```math
\ddot q_i
+
2\zeta\omega_n\dot q_i
+
\omega_n^2 q_i
=
\omega_n^2q_i^{target}
```

建議：

```yaml
zeta: 0.70-1.10
omega_n: 1.2-2.8
```

target：

```math
q_i^{target}
=
q_{follow}
+
q_{flow}
+
q_{noise}
```

noise：

```math
q_{noise}
=
A_n
Noise(\beta t+\phi_i)
```

```yaml
noise_amplitude_rad: 0.01-0.04
noise_frequency_scalar: 0.08-0.25
```

越靠末端：
- damping 略少
- phase lag 略多
- amplitude 稍增

---

# 15. Breathing / mantle micro-deformation

不要把 mantle 做完全 rigid。

微弱 scale pulse：

```math
S_m(t)=
1+A_m\sin(2\pi f_m t+\phi_m)
```

```yaml
mantle_micro_amp: 0.002-0.008
mantle_micro_freq_hz: 0.15-0.35
```

這不是明顯呼吸動畫。
只用來破除 CG rigidity。

---

# 16. 建議速度

全部使用 body length / second。

```yaml
IDLE_HOVER: 0.02-0.06
SLOW_CRUISE: 0.08-0.22
DEPTH_ADJUST_vertical: 0.01-0.05
MICRO_JET_peak: 0.25-0.55
```

不要讓正常巡航超過：

```yaml
0.35 BL/s
```

除非未來加入真正 startle response。

---

# 17. Path generation

不要使用單純 spline loop。

推薦：

```math
p_{target}(t)
=
p_{base}
+
p_{wander}
+
p_{light_bias}
+
p_{wall_bias}
```

wander：

```math
p_{wander}
=
[
A_xN_x(t),
A_yN_y(t),
A_zN_z(t)
]
```

三個 noise：
- seed 不同
- frequency 不同

```yaml
noise_frequency:
  x: 0.01-0.04
  y: 0.008-0.03
  z: 0.01-0.05
```

---

# 18. 光區行為

squid 不需要「追光」。

定義 window light field：

```math
L(p)\in[0,1]
```

行為 bias：

```math
B_L =
\gamma_L
(0.35-L)
\nabla L
```

目的：
- 偶爾接近
- 但不一直停在最亮點
- 可穿過光緣
- 會重新進入暗處

建議：

```yaml
gamma_L: 0.05-0.18
```

---

# 19. 個體差異

每隻生成：

```yaml
body_scale: 0.90-1.15
fin_frequency_multiplier: 0.82-1.16
fin_amplitude_multiplier: 0.88-1.12
turn_speed_multiplier: 0.80-1.15
jet_probability_multiplier: 0.50-1.40
transparency_multiplier: 0.90-1.10
wander_seed: unique
```

---

# 20. 驗收標準

## Morphology
- [ ] 第一眼是細長透明 squid，不像 cuttlefish
- [ ] posterior fins 比例克制
- [ ] 眼睛明顯但不卡通
- [ ] arms / tentacles 不是硬直棒狀
- [ ] mantle 有內部組織，不是空玻璃殼

## Locomotion
- [ ] 低速時主要靠 fins
- [ ] jet 稀少
- [ ] turn 是連續曲線，不瞬間改 heading
- [ ] arms 有 inertia
- [ ] 不會像 drone
- [ ] 不會像 underwater spaceship

## Scene fit
- [ ] 大部分時間輪廓很弱
- [ ] 靠近窗光才容易看見
- [ ] 不會長時間霸佔畫面中央
- [ ] 2–3 隻彼此不同步
- [ ] 無 aquarium performance 感

---

# 21. 研究參考

優先查：

1. McSweeny, E.S. (1978)  
   *Systematics and Morphology of the Antarctic Cranchiid Squid Galiteuthis glacialis (Chun)*  
   Antarctic Research Series 27.

2. Jackson, G.D. et al. (2002)  
   *Planktonic cephalopods collected off East Antarctica during the BROKE survey*  
   Deep-Sea Research Part I.

3. Sajikumar, K.K. et al. (2020)  
   *Distribution, abundance and growth of early stages of the glass squid Galiteuthis glacialis ... Prydz Bay, Antarctica*  
   Deep-Sea Research Part II.

4. Seibel, B.A. (2000)  
   deep-sea cephalopod metabolism and locomotion work.

5. Anderson, E.J. & DeMont, M.E. (2000)  
   *The mechanics of locomotion in the squid Loligo pealei*  
   用於 jet mechanics proxy，不可當作 species-specific Galiteuthis evidence.

6. Schmidt Ocean Institute (2025)  
   confirmed footage / observation material for `Galiteuthis glacialis` in Antarctic deep water.

---

# 22. Codex 最後提醒

如果遇到「文獻沒有精確值」：

**不要補造文獻數據。**

請：
1. 保留本文件的 approximation 標記
2. 讓所有 [C] 參數變成 config
3. 以視覺觀察與自然感做 calibration
4. 優先減少動作，不要增加動作
