# Codex 任務書｜Long-fin Koi School for Quiet Skylight Scene

## 0. 角色定位

You are acting as a senior Blender technical artist, creature modeler, rigging TD, procedural animation engineer, and scene behavior designer.

Your task is to build a complete, reusable **Long-fin Koi school system** in Blender for a specific surreal architectural scene.

This is not just a fish model.

The final deliverable must include:

- a reusable master **Long-fin Koi** rig
- multiple visual variants derived from the master fish
- a **small school / loose shoal** system
- biologically believable koi swimming behavior
- elegant long-fin trailing motion
- ambient, meditative motion suited for a quiet dark room
- group placement inside a vertical shaft of light
- loopable animation clips
- NLA-ready actions
- scene organization
- exposed custom parameters
- validation utilities
- saved `.blend`
- reusable Python code

The final artistic feeling must be:

- quiet
- contemplative
- soft
- floating
- sparse
- dreamlike
- graceful
- not busy
- not cartoonish
- not aquarium-showy
- not hyperactive

This scene should feel like:

> a small group of long-finned koi quietly suspended in a column of light inside a dark, almost sacred interior space.

---

# 1. 專案目標

建立一個適合以下場景的魚群系統：

## 場景特徵
- 黑暗、極簡、近乎空無一物的室內空間
- 上方有一個方形天窗
- 藍天與雲朵從天窗可見
- 一束明顯的垂直光柱灑落至地板
- 魚群漂浮在光柱中段
- 魚相對空間很小
- 畫面重點是空間、光、留白、漂浮感
- 魚是安靜地「住在光裡」

## 最終視覺目標
魚群不能看起來像：
- 一般魚缸裡的活潑群游
- 熱帶魚同步 school
- 太多、太滿、太雜
- 太鮮豔的觀賞魚展示
- 太可愛的 Q 版生物

而應該看起來像：
- 光中的小生命
- 在空氣／水感介質裡緩慢漂浮
- 一種介於現實與不現實之間的存在

---

# 2. 魚種選擇與設計原則

本專案使用：

# **Long-fin Koi / Butterfly Koi / 長鰭錦鯉**

## 為什麼選長鰭錦鯉
相比普通錦鯉，長鰭錦鯉有：

- 更柔長的胸鰭
- 更飄逸的尾鰭
- 更具絲帶感的 trailing motion
- 更適合被光勾邊
- 更夢幻、更空靈

這比金魚更不會破壞空間的靜謐感，也比普通魚更有詩意。

---

# 3. 群體配置建議

建議魚數量：

```text
6–9 fish
```

推薦預設：

```text
7 fish
```

這是最適合該場景的數量。

太少（1–3）會太孤單。  
太多（12+）會太擁擠，破壞留白。

---

## 3.1 建議配色組成

使用**低飽和、安靜的觀賞色系**。

建議個體分布：

```text
2 × ivory / silver-white koi
2 × pale champagne-gold koi
1 × white koi with soft black markings
1 × charcoal / black-silver koi
1 × pale cream-white koi
```

### 配色原則
- 白色魚：負責接住光
- 淡金色魚：提供溫度
- 灰黑色魚：提供深淺層次
- 黑白斑魚：增加辨識點
- 避免高飽和大紅大橘過多
- 避免整群都是傳統鮮紅白花錦鯉

這個場景不適合太強烈的「日式庭園觀賞魚」感。  
它更適合接近：

- ivory
- silver
- pale gold
- muted charcoal
- soft cream

---

## 3.2 個體大小變異

每隻魚不應完全一樣大。

建議尺寸縮放：

```text
0.82
0.88
0.93
1.00
1.05
1.12
1.18
```

主群個體長度（含尾）建議：

```text
0.28 m – 0.45 m
```

平均約：

```text
0.35 m – 0.40 m
```

---

# 4. 最終輸出物

至少輸出以下內容：

## Blender 資產
- `long_fin_koi_school.blend`

## Python / script
- `build_all.py`
- `config.py`
- `koi_master_geometry.py`
- `koi_master_rig.py`
- `koi_materials.py`
- `koi_animation.py`
- `koi_variants.py`
- `school_controller.py`
- `scene_layout.py`
- `validation.py`
- `README.md`

## Blender 場景內應存在
- Master Koi mesh
- Master Koi rig
- 6–9 個 instance / variant koi
- group controller
- light-beam scene
- Actions / NLA
- cameras
- organized collections

---

# 5. 座標系統

Use one consistent convention.

```text
+Y = forward / fish head direction
-Y = backward / tail direction

+X = fish right
-X = fish left

+Z = upward / dorsal
-Z = downward / ventral
```

All koi should face `+Y` in rest pose.

The light beam is a vertical volume aligned mostly along world `Z`.

The scene center should be near world origin.

---

# 6. 場景座標與空間定義

建立一個簡化的場景座標框架：

## 天窗
```text
position ≈ (0, 0, 4.5)
size ≈ 2.2 m × 2.2 m
rotation = slightly tilted if desired
```

## 地面亮區
```text
position ≈ (0, 0, 0)
```

## 光柱有效區域
定義一個主體 volume：

```text
beam_center = (0, 0, 2.2)
beam_height = 3.2 m
beam_radius_x = 0.75 m
beam_radius_y = 0.55 m
```

實際魚群主要活動區應集中於：

```text
z = 1.2 m – 3.0 m
```

也就是光柱的中下至中上段。

不要讓魚一直貼近地面，也不要全部靠近天窗。

---

# 7. Master Fish 幾何規格

建立一條高品質、可重用的 **Master Long-fin Koi**。

## 7.1 尺寸
推薦 master 尺寸：

```python
TOTAL_LENGTH = 0.38
BODY_LENGTH = 0.29
TAIL_LENGTH = 0.09
MAX_BODY_DEPTH = 0.075
MAX_BODY_WIDTH = 0.062
```

## 7.2 形體特徵
- 身體修長但不要像野生鯉魚那麼瘦
- 頭部圓潤
- 軀幹有柔和的厚度
- 尾柄明確收窄
- 尾鰭細長飄逸
- 胸鰭較普通錦鯉更長、更柔軟
- 背鰭穩定但不過大
- 骨盆鰭與臀鰭小而輕柔
- 整體比一般 koi 更「絲帶化」

## 7.3 避免
- 不要做得像金魚
- 不要太肥短
- 不要太瘦像草魚
- 不要尾巴太短
- 不要 fins 太硬
- 不要頭太尖
- 不要過度鯊魚流線型

---

# 8. 個體變異系統

只做一條魚再複製會太假。  
請建立一個 **variant generator**。

每條魚應可在以下維度有小變異：

```text
body_length_scale
body_depth_scale
tail_length_scale
pectoral_length_scale
dorsal_fin_scale
tail_fin_spread
pattern_seed
base_color_variant
dark_marking_strength
```

推薦變異範圍：

```text
body_length_scale      0.95 – 1.08
body_depth_scale       0.92 – 1.10
tail_length_scale      0.95 – 1.20
pectoral_length_scale  1.00 – 1.25
tail_fin_spread        0.90 – 1.15
```

重點是：

- silhouette 要有一點差
- 但仍然明顯是同一個族群

---

# 9. 材質與紋樣系統

## 9.1 材質目標
- 平滑、濕潤、柔和反光
- 不是塑膠
- 不是過度寫實鱗片怪物
- 有很輕微的鱗片暗示即可
- fins 需有半透明感或薄膜感

## 9.2 材質分層
建立材質節點包含：
- base body color
- patch mask
- subtle iridescent/specular breakup
- ventral lighter tone
- fin translucency
- soft roughness variation

## 9.3 紋樣風格
適合本場景的 pattern 類型：
- mostly white / ivory
- pale gold wash
- soft black islands
- silver-gray gradient
- black dorsal accent
- minimal asymmetrical patterning

避免：
- 誇張大塊鮮紅
- 極高對比 Show koi exhibition look
- 太滿的花紋

---

# 10. Rig 架構

建立一條可作為母體的 Koi Rig。

## 10.1 骨架命名建議
```text
KOI_MASTER_RIG

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

dorsal_fin
anal_fin
pelvic_L
pelvic_R
pectoral_L_base
pectoral_L_mid
pectoral_L_tip
pectoral_R_base
pectoral_R_mid
pectoral_R_tip

caudal_upper
caudal_mid
caudal_lower
```

如果想做更好的長鰭表現，尾鰭可以拆更多控制點。

---

## 10.2 Rig 核心原則
這條魚的游動主要來自：

- 身體後半部 lateral wave
- 尾柄與尾鰭推進
- 長胸鰭與長尾鰭的 secondary motion

所以：

### 應該強調
- 頭穩
- 中段有柔和傳遞
- 尾部主導
- 長鰭延遲跟隨

### 不應該
- 全身等幅扭動
- 胸鰭像鳥拍動
- 尾巴像旗子亂甩
- 每條魚都完全同步

---

# 11. 單魚游動數學模型

使用 koi 式身體波動，而不是魟魚的 pectoral wave。

定義：

- `s ∈ [0,1]`：沿身體由頭到尾柄
- `t`：時間（秒）

身體橫向偏移：

\[
x(s,t)=A(s)\sin(2\pi(ft-ks)+\phi)
\]

其中：

- `A(s)`：隨尾端增大的振幅包絡
- `f`：游動頻率
- `k`：波數
- `φ`：相位偏移

---

## 11.1 振幅包絡
對錦鯉，頭部應穩，尾部應活。

建議：

\[
A(s)=A_{max}\cdot s^p
\]

推薦：

```text
p = 2.1 – 2.8
```

預設：

```python
def axial_amp(s, a_max, power=2.35):
    return a_max * (s ** power)
```

這表示：

- 頭幾乎不動
- 中段微動
- 尾端最明顯

---

## 11.2 波數
Long-fin koi 的視覺不應太蛇形。

建議：

```text
wave_count = 0.75 – 0.95
```

預設：

```python
wave_count = 0.84
```

意思是整個身體不到一個完整大波，  
這會讓游法更優雅。

---

## 11.3 頻率
不同狀態使用不同頻率：

### Hover / near-idle
```text
0.35 – 0.55 Hz
```

### Slow cruise
```text
0.60 – 0.90 Hz
```

### Slightly active cruise
```text
0.90 – 1.15 Hz
```

這個專案的主區間建議使用：

```python
base_frequency = 0.72
```

---

## 11.4 最大振幅
建議：

\[
A_{max} \approx 0.04 – 0.08 \times bodyLength
\]

預設：

```python
A_max = BODY_LENGTH * 0.058
```

請注意：

- 長鰭錦鯉的「飄逸感」很多不是來自身體大擺動
- 而是來自 fins 的 trailing motion

所以不要把 body amplitude 做得太大。

---

# 12. 長鰭的 Secondary Motion

這是本專案最重要的美感來源之一。

## 12.1 尾鰭
尾鰭不是 rigid triangle。  
它應該：

- 跟隨尾柄
- 稍微延遲
- 向尾梢逐步增加柔性
- 產生細膩飄動

可使用：

\[
\theta_i(t)=g_i \cdot \theta_{parent}(t-\tau_i)
\]

其中：

- `g_i`：跟隨強度
- `τ_i`：延遲時間

建議：

```text
g_i = 0.88 – 1.02
τ_i = 0.01 – 0.05 sec
```

---

## 12.2 胸鰭
長鰭胸鰭在這個場景非常重要。

其角色是：
- 緩慢穩定姿態
- 低速時產生小幅划動
- 增加魚的生命感
- 在光下形成柔軟輪廓

胸鰭角度可用：

\[
\theta_p(t)=P\sin(2\pi f_p t+\phi_p)
\]

推薦：
```text
P = 5° – 14°
f_p = 0.35 – 0.70 Hz
```

在 slow cruise 中應該比 hover 更弱。

---

## 12.3 其他 fins
背鰭、臀鰭、腹鰭：
- 主要為穩定用途
- 可有極小 secondary response
- 不要太搶戲

---

# 13. Organic Variation

不能每條魚都像數學複製品。

每條魚都應加入極小的低頻變化。

## 13.1 頻率變動
\[
f(t)=f_0 [1+\epsilon_f(t)]
\]

其中：

\[
\epsilon_f(t)=
0.025\sin(2\pi0.041t+\alpha)
+
0.012\sin(2\pi0.067t+\beta)
\]

---

## 13.2 振幅變動
\[
A(t)=A_0 [1+\epsilon_A(t)]
\]

其中：

\[
\epsilon_A(t)=
0.04\sin(2\pi0.053t+\gamma)
+
0.015\sin(2\pi0.089t+\delta)
\]

每條魚使用不同 phase seed：

```python
motion_seed
```

這樣它們不會同步。

---

# 14. 單魚行為狀態

每條魚至少具備以下行為狀態：

```text
IDLE_HOVER
SLOW_CRUISE
GLIDE
GENTLE_TURN_LEFT
GENTLE_TURN_RIGHT
SLIGHT_RISE
SLIGHT_DESCEND
PAUSE_IN_BEAM
```

### 說明

## IDLE_HOVER
- 幾乎不前進
- 胸鰭比較活
- 尾巴小修正
- 像停在光中

## SLOW_CRUISE
- 緩慢向前漂
- 主體動作來源
- 這是最常見狀態

## GLIDE
- 頻率稍降
- 看起來像被環境承托著滑行

## GENTLE_TURN
- 很大弧線
- 不急
- 不是躲避式快速轉彎

## SLIGHT_RISE / DESCEND
- 在光柱中上下移動少量高度
- 給畫面層次感

## PAUSE_IN_BEAM
- 停留在某個區域
- 幾乎不前進
- 像在光中呼吸

---

# 15. 群體行為模型

這個專案不是「同步魚群」，而是：

# **Loose Shoaling / 鬆散群聚**

不要做傳統 school。

---

## 15.1 群體控制理念

希望整群感覺像：

- 有彼此感知
- 大致待在同一區域
- 但各自保有節奏
- 會慢慢聚攏、又慢慢散開
- 整體是安靜的

不是：
- 同步轉向
- 同步擺尾
- 同速前進
- 大型 boids flocking spectacle

---

## 15.2 每條魚的個體參數

每個 individual fish 應具備：

```text
preferred_speed
preferred_depth
turn_bias
body_wave_frequency
body_wave_amplitude
pectoral_frequency
pectoral_amplitude
personal_space_radius
neighbor_attraction
neighbor_alignment
wander_strength
beam_affinity
light_preference_height
pause_tendency
size_scale
motion_seed
```

---

## 15.3 群體總參數

群體系統應具備：

```text
group_center
group_radius
cohesion_strength
separation_strength
alignment_strength
wander_strength
beam_confinement_strength
vertical_soft_bias
floor_avoidance_strength
ceiling_avoidance_strength
```

---

## 15.4 建議群體係數

這個場景推薦：

```text
cohesion_strength    = medium
separation_strength  = medium-high
alignment_strength   = low
wander_strength      = medium
beam_confinement     = medium-high
vertical_bias        = gentle
```

用數值示意可為：

```python
COHESION = 0.45
SEPARATION = 0.70
ALIGNMENT = 0.18
WANDER = 0.52
BEAM_CONFINEMENT = 0.65
VERTICAL_SOFT_BIAS = 0.35
```

---

## 15.5 群體更新概念

每個 timestep，對每條魚計算：

\[
F_{total}=F_c+F_s+F_a+F_w+F_b+F_v+F_o
\]

其中：

- \(F_c\)：cohesion，靠近群體中心
- \(F_s\)：separation，避免太靠近其他魚
- \(F_a\)：alignment，略微跟隨鄰居方向
- \(F_w\)：wander，個體緩慢飄動意圖
- \(F_b\)：beam confinement，留在光柱中
- \(F_v\)：vertical preference，高度偏好
- \(F_o\)：obstacle / floor / ceiling avoidance

再對 heading / speed 做平滑更新。

---

# 16. 光柱限制模型

魚群要在光柱中活動，但不是像困在玻璃管裡。

定義一個橢圓柱狀 soft volume：

\[
B(x,y,z)=\left(\frac{x}{r_x}\right)^2+\left(\frac{y}{r_y}\right)^2
\]

若 `B > 1`，表示超出光柱核心範圍。

對魚施加回拉力：

\[
F_b = -\lambda_b \nabla B
\]

但這個力要柔和。

不要讓魚到邊界就生硬反彈。

---

# 17. 高度偏好模型

不同魚可有不同偏好高度：

```text
top-biased fish
mid-biased fish
lower-mid fish
```

例如：

- 2 隻偏上層
- 3 隻偏中層
- 2 隻偏下層

每條魚有：

```python
preferred_z
preferred_z_range
```

高度控制力：

\[
F_v = -k_v(z-z_{pref})
\]

但需加入 damping，避免彈簧感太重。

---

# 18. 避碰與個體距離

魚與魚之間不應互相穿模，也不應黏在一起。

定義個體空間半徑：

```text
0.10 m – 0.22 m
```

若兩條魚距離小於阈值，加入 separation force。

\[
F_s \propto \frac{1}{d^2}
\]

但請平滑限制上限，避免突然噴開。

---

# 19. 動畫片段設計（Action Clips）

每條魚的動畫系統建議由 base actions 組成。

至少建立以下 Action：

```text
KOI_ACT_IDLE_HOVER
KOI_ACT_SLOW_CRUISE
KOI_ACT_GLIDE
KOI_ACT_TURN_LEFT
KOI_ACT_TURN_RIGHT
KOI_ACT_SLIGHT_RISE
KOI_ACT_SLIGHT_DESCEND
KOI_ACT_PAUSE
```

---

## 19.1 建議長度

### IDLE_HOVER
```text
8–12 sec
```

### SLOW_CRUISE
```text
10–16 sec
```

### GLIDE
```text
6–10 sec
```

### TURN LEFT / RIGHT
```text
6–8 sec
```

### RISE / DESCEND
```text
5–8 sec
```

### PAUSE
```text
4–8 sec
```

所有 loopable actions 必須可無縫循環。

---

# 20. 群體狀態機

每條魚不是固定一段 loop，  
而應在若干狀態間慢慢切換。

## 20.1 狀態轉移示意
```text
IDLE_HOVER
   ↓
SLOW_CRUISE
   ↓
GLIDE
   ↓
TURN
   ↓
SLOW_CRUISE
   ↓
SLIGHT_RISE
   ↓
PAUSE
   ↓
SLOW_CRUISE
```

---

## 20.2 轉移原則
- 不要頻繁切換
- 每次停留至少數秒
- 轉換需要 easing
- 魚之間的切換時間錯開
- 同一時間不應全部進入同狀態

---

# 21. 場景構圖專用分布策略

這不是普通 aquarium camera scene。  
是構圖非常重要的靜態場景。

因此要加入 **composition-aware placement**。

---

## 21.1 魚群分布區域
魚群應主要出現在：

- 光柱中間 40–70% 高度
- 略偏中央
- 不要全部聚成一團
- 要有上下層次

### 建議初始布局
例如 7 條魚：

```text
1 fish near upper-mid
2 fish around center
2 fish slightly lower-mid
1 fish offset left
1 fish offset right-lower
```

形成一個鬆散的縱向 cluster。

---

## 21.2 個體朝向
不要全部朝同方向。

應有：
- 一隻微微上游
- 一隻轉身
- 一隻偏水平
- 一隻略往下
- 幾隻呈曲線漂浮

但整體要避免太戲劇化。

---

# 22. 單魚速度範圍

建議使用低速。

```text
min speed = 0.00 – 0.015 m/s
typical slow = 0.03 – 0.08 m/s
upper bound = 0.10 – 0.14 m/s
```

這個場景不需要快游。

大部分應落在：

```text
0.04 – 0.07 m/s
```

---

# 23. 旋轉與姿態

每條魚除了 heading 外，還需有微小：

- yaw
- pitch
- roll

但必須節制。

建議：

### roll
\[
r(t)=B_r\sin(2\pi f_r t+\phi_r)
\]

```text
0.5° – 2.5°
```

### pitch
```text
0.5° – 3°
```

### yaw drift
慢慢變化，不要抖動。

長鰭魚如果完全沒有這些微小姿態變化，會太像 assets。

---

# 24. 泳姿品質要求

每條 fish 應通過以下視覺原則：

## 應該看到
- 頭相對穩
- 身體後半有柔和 lateral wave
- 尾部推進最明顯
- 胸鰭是柔和輔助
- 長尾與長胸鰭有延遲拖曳
- 有滑行感
- 不是一直用力擺

## 不應該看到
- 每條魚都像熱帶魚抖很快
- 魚像蛇一樣全身波浪
- 胸鰭拍得很大
- 尾巴像旗子被風吹
- 完全同步的複製 motion

---

# 25. Blender 場景結構

Collections 建議：

```text
KOI_SCENE
KOI_MASTER
KOI_VARIANTS
KOI_SCHOOL
KOI_LIGHTING
KOI_ENV
KOI_CAMERAS
KOI_DEBUG
```

Objects：

```text
KOI_MASTER_BODY
KOI_MASTER_RIG
KOI_SCHOOL_CTRL
LIGHT_BEAM_VOLUME
SKYLIGHT_PLANE
GROUND_PLANE
CAM_MAIN
CAM_SIDE
```

Fish instances:

```text
KOI_01
KOI_02
KOI_03
KOI_04
KOI_05
KOI_06
KOI_07
```

---

# 26. 自訂控制參數

建立一個 `KOI_SCHOOL_CTRL` 空物件或 controller rig，暴露高階參數。

## 群體級
```text
school_radius
cohesion_strength
separation_strength
alignment_strength
wander_strength
beam_confinement
global_speed_scale
global_motion_seed
vertical_spread
group_center_offset
```

## 個體級
```text
preferred_speed
preferred_depth
body_wave_frequency
body_wave_amplitude
pectoral_activity
turn_bias
pause_tendency
beam_affinity
variation_seed
```

---

# 27. Python 專案結構建議

```text
long_fin_koi_school/
│
├── build_all.py
├── config.py
├── koi_master_geometry.py
├── koi_master_rig.py
├── koi_materials.py
├── koi_animation.py
├── koi_variants.py
├── school_controller.py
├── scene_layout.py
├── validation.py
└── README.md
```

---

# 28. 檔案職責

## config.py
放：
- 尺寸參數
- 群體參數
- scene volume
- 預設 palette
- action 長度
- seed

## koi_master_geometry.py
建立：
- master fish mesh
- fins
- UV
- optional shape variation hooks

## koi_master_rig.py
建立：
- armature
- bones
- constraints
- custom properties
- mesh binding

## koi_materials.py
建立：
- body shader
- fin shader
- eye shader
- color variants

## koi_animation.py
實作：
- body wave
- tail follow
- pectoral flap
- action bake

## koi_variants.py
根據 master 生成：
- 7 條魚
- 尺寸變異
- 顏色變異
- fins 變異

## school_controller.py
實作：
- loose shoaling logic
- per-fish target transforms
- scene placement in beam
- state switching

## scene_layout.py
建立：
- dark box environment
- skylight
- light beam volume
- ground light patch
- cameras

## validation.py
檢查：
- fish count
- actions existence
- rig correctness
- material assignment
- collisions / spacing
- beam placement

---

# 29. Pseudo-code：單魚波動

```python
import math

def axial_amp(s, a_max, power=2.35):
    return a_max * (s ** power)

def organic_frequency_offset(t, a=0.025, b=0.012):
    return (
        a * math.sin(2.0 * math.pi * 0.041 * t)
        + b * math.sin(2.0 * math.pi * 0.067 * t + 1.7)
    )

def organic_amplitude_offset(t, a=0.04, b=0.015):
    return (
        a * math.sin(2.0 * math.pi * 0.053 * t + 0.8)
        + b * math.sin(2.0 * math.pi * 0.089 * t)
    )

def body_wave(s, t, base_amp, base_freq, wave_count, phase=0.0):
    freq = base_freq * (1.0 + organic_frequency_offset(t))
    amp = axial_amp(s, base_amp) * (1.0 + organic_amplitude_offset(t))
    theta = 2.0 * math.pi * (freq * t - wave_count * s) + phase
    return amp * math.sin(theta)
```

---

# 30. Pseudo-code：胸鰭

```python
def pectoral_flap(t, amp_rad, freq, phase=0.0):
    return amp_rad * math.sin(2.0 * math.pi * freq * t + phase)
```

在不同狀態中：

```python
PECTORAL_IDLE = {"amp": math.radians(12), "freq": 0.55}
PECTORAL_CRUISE = {"amp": math.radians(7), "freq": 0.42}
PECTORAL_GLIDE = {"amp": math.radians(4), "freq": 0.30}
```

---

# 31. Pseudo-code：長尾拖曳

```python
def tail_follow(parent_angle_history, lag_seconds, gain=0.94):
    delayed = sample_history(parent_angle_history, lag_seconds)
    return delayed * gain
```

更進階可用 spring-damper：

```python
def update_spring(angle, velocity, target, stiffness, damping, dt):
    acc = -stiffness * (angle - target) - damping * velocity
    velocity += acc * dt
    angle += velocity * dt
    return angle, velocity
```

---

# 32. Pseudo-code：鬆散群游

```python
def update_fish_agent(agent, neighbors, dt):
    F_cohesion = compute_cohesion(agent, neighbors)
    F_separation = compute_separation(agent, neighbors)
    F_alignment = compute_alignment(agent, neighbors)
    F_wander = compute_wander(agent)
    F_beam = compute_beam_confinement(agent)
    F_vertical = compute_vertical_preference(agent)
    F_avoid = compute_avoidance(agent)

    F_total = (
        F_cohesion
        + F_separation
        + F_alignment
        + F_wander
        + F_beam
        + F_vertical
        + F_avoid
    )

    agent.velocity += F_total * dt
    agent.velocity = limit_speed(agent.velocity, agent.min_speed, agent.max_speed)

    desired_heading = vector_to_heading(agent.velocity)
    agent.heading = smooth_rotate(agent.heading, desired_heading, dt, turn_rate=0.8)

    agent.position += heading_to_vector(agent.heading) * agent.speed * dt
```

---

# 33. 狀態切換 pseudo-code

```python
def choose_next_state(agent, t):
    if agent.state_time < agent.min_state_duration:
        return agent.state

    candidates = []

    if agent.state == "IDLE_HOVER":
        candidates = ["SLOW_CRUISE", "PAUSE"]
    elif agent.state == "SLOW_CRUISE":
        candidates = ["GLIDE", "TURN_LEFT", "TURN_RIGHT", "SLIGHT_RISE", "SLIGHT_DESCEND"]
    elif agent.state == "GLIDE":
        candidates = ["SLOW_CRUISE", "PAUSE"]
    elif agent.state in ["TURN_LEFT", "TURN_RIGHT"]:
        candidates = ["SLOW_CRUISE", "GLIDE"]
    elif agent.state in ["SLIGHT_RISE", "SLIGHT_DESCEND"]:
        candidates = ["SLOW_CRUISE", "PAUSE"]
    elif agent.state == "PAUSE":
        candidates = ["IDLE_HOVER", "SLOW_CRUISE"]

    return weighted_choice(candidates, agent.behavior_seed)
```

---

# 34. 場景燈光要求

此專案不是做寫實水下缸，而是做**介於空氣與水之間**的質感。

## 必須具備
- 上方天窗的高亮冷色天光
- 光柱有 volumetric visible beams
- 光中有微粒子 / dust / mist
- 黑色空間保持深暗
- 地面有柔和亮區
- 光不要太硬，也不要舞台聚光燈化
- 魚的邊緣可被 light rim softly picked up

## 不要
- 把整個空間照亮
- 太藍太像游泳池
- 明顯水下氣泡過多
- 太濃霧看不見魚

---

# 35. 鏡頭與構圖要求

建立至少三個 camera：

```text
CAM_MAIN
CAM_SIDE
CAM_TOP_3Q
```

## CAM_MAIN
- 垂直構圖
- 看見天窗、光柱、地面亮區、魚群
- 這是 hero shot

## CAM_SIDE
- 檢查魚層次與高度分布

## CAM_TOP_3Q
- 檢查群體位置與 spacing

---

# 36. 驗收標準：單魚層級

每條魚都需通過：

## Geometry
- 形體是長鰭錦鯉，不是金魚或普通 carp
- 尾鰭與胸鰭足夠長
- silhouette 有優雅感

## Rig
- 可正常綁定與變形
- 頭部穩定
- 尾部主導推進
- fins 不穿模

## Animation
- 游動自然
- 不過快
- 不僵硬
- 不像 snake
- 不像 tropical fish

## Material
- 柔和、低飽和
- 適合暗空間

---

# 37. 驗收標準：群體層級

## 通過時應看到
- 魚群分布鬆散
- 彼此不完全同步
- 仍有一種同處一域的感覺
- 不會互撞
- 不會全部擠在中心
- 不會全部靠邊
- 在光柱中有高低層次
- 視線上有留白

## 失敗時常見症狀
### Failure A：像 screensaver
全部魚以類似模式飄來飄去。

### Failure B：像 Boids demo
太強 flocking，全部一起轉。

### Failure C：像 aquarium shop poster
顏色太花、魚太多、太表演感。

### Failure D：像複製貼上
所有魚同尺寸、同配色、同擺尾節奏。

### Failure E：太空曳浮物
完全沒有真實魚類的動力來源。

---

# 38. 驗收標準：構圖層級

從 `CAM_MAIN` 看：

- 魚群應落在光柱視覺重心內
- 天窗仍然是構圖起點
- 地面亮區仍然可見
- 魚群不能把光柱塞滿
- 至少要保留明顯負空間
- 視覺上像「一小群魚住在光中」
- 不是「大量魚搶畫面」

---

# 39. 完成條件清單

```text
[ ] 建立 Master Long-fin Koi mesh
[ ] 建立 Master Rig
[ ] 完成單魚基礎游動系統
[ ] 完成尾鰭 / 胸鰭 secondary motion
[ ] 建立至少 7 條 variant koi
[ ] 每條魚具備材質變異
[ ] 每條魚具備 motion seed
[ ] 建立 loose shoal controller
[ ] 實作 beam confinement
[ ] 實作 preferred depth
[ ] 實作 spacing / separation
[ ] 建立所有必要 animation clips
[ ] 設定 state machine
[ ] 建立場景天窗、光柱、地面亮區
[ ] 放置魚群於構圖適當位置
[ ] 建立 3 個檢視 cameras
[ ] 完成 validation
[ ] 儲存最終 .blend
[ ] 保留 reusable Python scripts
```

---

# 40. 優先級

若需要取捨，優先順序如下：

```text
1. 單魚游動品質
2. 長鰭的 trailing 美感
3. 群體不是同步複製
4. 與光柱構圖的整體和諧
5. 材質與顏色品質
6. 更細的次要行為
7. 環境細節
```

不要為了複雜群體 AI，犧牲單魚泳姿。  
不要為了華麗材質，破壞安靜感。

---

# 41. 最終藝術指令

The final result should feel like a small constellation of living koi suspended in a beam of light.

The viewer should feel:
- stillness
- wonder
- softness
- reverence
- meditative calm

The fish should not dominate the room.

They should gently animate the silence of the room.

Build the system so that future scenes can reuse:
- the master koi
- the motion system
- the group behavior system
- the lighting-aware spatial placement logic

The project is complete only when the school feels like it truly belongs inside the light.