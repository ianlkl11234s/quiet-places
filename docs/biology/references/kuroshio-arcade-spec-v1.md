# Quiet Places｜海邊商店街 × 黑潮生物
## Codex / Agent 生物建模、動畫與群游行為任務書 v1.0

> 目標場景：廢棄、無人的海邊日本商店街。  
> 生物配置：**3 隻大鬼蝠魟（Mobula birostris）＋ 1 隻鯨鯊（Rhincodon typus）＋ 下層藍綠光鰓雀鯛（Chromis viridis）與烏尾鮗群（以 Pterocaesio digramma 為主）**。  
> 核心原則：**場景仍然是乾燥的空氣世界；海洋生物只是像在水中一樣游過空間。動作遵守水下生物力學，但不要把整條街渲染成水族箱或水下世界。**

---

# 0. 任務目標

請實作一套可長時間循環、低重複感、自然且有生物學依據的海洋生物系統。

畫面中：

- 3 隻大鬼蝠魟主要活動於商店街棚架上方與道路上方。
- 其中 2 隻會不定期形成短暫的同步盤旋／追隨關係，但**不要表演式同步**。
- 鬼蝠魟偶爾下降至接近人類視線高度，再緩慢回升。
- 1 隻鯨鯊活動高度高於鬼蝠魟，進行大半徑、低頻率的長距離洄游。
- 商店街下層與道路低空由小型魚群穿梭：
  - 藍綠光鰓雀鯛：較靠近遮蔽物、店面、欄杆與植物。
  - 烏尾鮗：較偏向開放道路與商店街中央，以較整齊、快速的群游穿越場景。

這不是「生物展示動畫」。
生物不需要一直做事，也不需要一直在鏡頭中央。

最重要的是：

> **觀者待在這裡 10–30 分鐘時，仍會覺得這些生物只是生活在這個空間裡。**

---

# 1. 生物選擇與研究基準

## 1.1 大鬼蝠魟

- 中文：大鬼蝠魟
- 學名：`Mobula birostris`
- 英文：Giant manta ray / Oceanic manta ray
- 沖繩美麗海水族館「黑潮之海」展示物種。
- 美麗海資料記載體寬可達約 6 m。
- 本專案建議個體盤寬：
  - Manta A：5.8 m
  - Manta B：5.4 m
  - Manta C：5.1 m

注意：全球文獻存在更大的體寬紀錄，但本場景以美麗海展示尺度與畫面可讀性為主，不追求最大值。

---

## 1.2 鯨鯊

- 中文：鯨鯊
- 學名：`Rhincodon typus`
- 英文：Whale shark
- 黑潮之海代表性大型生物。
- 美麗海資料：成體可達約 10–12 m。
- 本專案建議長度：`8.0–9.0 m`

這個尺寸足以讓細節可見，同時不至於讓商店街完全失去尺度感。

---

## 1.3 藍綠光鰓雀鯛

- 中文：藍綠光鰓雀鯛
- 學名：`Chromis viridis`
- 英文：Blue-green chromis / Blue green damselfish
- 成人標準體長文獻約 `27–59 mm`
- 常於枝狀珊瑚附近形成數十至數百隻群體。
- 白天離開遮蔽處攝食浮游生物，遇威脅迅速縮回珊瑚枝間。

本場景建議：
- 體長：`0.035–0.055 m`
- 畫面同時可見：`35–80` 隻
- 總 pool：`80–140` 隻

---

## 1.4 烏尾鮗群

主體物種建議：

- 中文：雙帶烏尾鮗 / 雙帶梅鯛
- 學名：`Pterocaesio digramma`
- 英文：Double-lined fusilier
- 美麗海「黑潮之海」展示物種。
- 約可達 30 cm。
- 細長紡錘形、深叉尾。
- 喜歡在沿岸潮流良好的珊瑚礁與岩礁中層形成大型魚群。
- 游泳快速而持久。

本場景建議：
- 體長：`0.18–0.28 m`
- 畫面同時可見：`18–45` 隻
- 總 pool：`40–70` 隻

---

# 2. 世界物理假設

## 2.1 非水下世界

**禁止：**

- 整體藍色水下霧
- 漂浮氣泡
- 水下懸浮顆粒覆蓋整個場景
- 強烈水波 caustics 投影到所有建築
- 把道路變成海床
- 所有物件都像泡在水裡

場景仍是：

- 正午或午後自然光
- 乾燥空氣
- 真實建築材質
- 海風
- 日照
- 遠方海面

只有生物的運動遵循「虛擬流體」規則。

---

## 2.2 虛擬流體

建立一個低頻率流場：

\[
\mathbf{u}(\mathbf{x},t)
=
\mathbf{u}_0
+
\alpha \mathbf{u}_{curl}(\mathbf{x},t)
\]

其中：

- `u0`：很弱的主流向，建議朝海岸線／街道方向。
- `u_curl`：curl noise 或 divergence-free noise。
- `alpha`：
  - 大型生物：`0.05–0.12`
  - 小型魚：`0.15–0.35`

流場只影響軌跡與姿態，不應造成生物像紙片被風吹走。

大型動物的慣性必須非常明顯。

---

# 3. 共通座標與路徑系統

建議：

```text
+X = 道路左右方向
+Y = 垂直向上
+Z = 商店街縱深／朝向海
```

所有大型生物都使用 **arc-length parameterized spline**。

若原始 spline：

\[
\mathbf{p}(u), \quad u \in [0,1]
\]

先建立弧長：

\[
s(u)=\int_0^u ||\mathbf{p}'(\xi)|| d\xi
\]

運動時以速度積分：

\[
s(t+\Delta t)=s(t)+v(t)\Delta t
\]

再反查：

\[
u=s^{-1}(s(t))
\]

禁止直接用 `u += constant`，否則不同曲率區域速度會改變。

切線：

\[
\mathbf{T}=
\frac{d\mathbf{p}/ds}
{||d\mathbf{p}/ds||}
\]

曲率：

\[
\kappa =
\left|\frac{d\mathbf{T}}{ds}\right|
\]

轉彎半徑：

\[
R=\frac{1}{\kappa}
\]

姿態不要直接 `lookAt()` 每 frame。

使用 exponential smoothing：

\[
\lambda = 1-e^{-\Delta t/\tau}
\]

\[
q_{t+\Delta t}
=
slerp(q_t,q_{target},\lambda)
\]

建議：

- 鬼蝠魟 `τ = 0.7–1.5 s`
- 鯨鯊 `τ = 1.8–3.5 s`
- 小魚 `τ = 0.08–0.25 s`

---

# 4. 大鬼蝠魟：外型

## 4.1 整體輪廓

大鬼蝠魟不是「菱形紙片」。

必須具有：

- 扁平但有厚度的軀幹中央
- 寬大的三角／翼狀胸鰭
- 胸鰭根部厚、末端薄
- 翼尖柔軟
- 頭部寬
- 兩側具有頭鰭（cephalic lobes）
- 5 對腹側鰓裂
- 細長尾部
- 軀幹前後方向比左右翼展短非常多

巡航狀態：
- mouth closed 或僅自然微開
- cephalic lobes 應主要保持捲起／半捲起
- 不要長時間呈現進食時完全展開狀態

---

## 4.2 程式化輪廓

令：

- 全翼展：`W`
- 前後盤長：`L_d`
- `s ∈ [0,1]`：從吻端到尾根
- 最大半寬位置：`s_m ≈ 0.43`

半翼寬可使用 beta-like envelope：

\[
w(s)
=
\frac{W}{2}
\frac{
s^{a}(1-s)^{b}
}{
s_m^{a}(1-s_m)^b
}
\]

其中可取：

```text
a = 0.72
b = 0.96
s_m = a / (a+b) ≈ 0.43
```

這只作為 procedural base mesh。

之後必須以 silhouette corrective curve 修正：

- 吻端不能尖成三角形
- 翼前緣由頭部平順延伸
- 翼後緣有明顯後掠
- 翼尖略向後
- 中央軀幹不能像一張布

厚度：

\[
h(s,r)
=
h_0
(1-r^{1.8})
[0.45+0.55\sin(\pi s)^{0.7}]
\]

其中：

\[
r = \frac{|x|}{w(s)}
\]

`r=0` 為中央軀幹，`r=1` 為翼尖。

翼尖厚度至少降到中央厚度的 `8–15%`。

---

# 5. 大鬼蝠魟：顏色與材質

## 5.1 背側

基底不要純黑。

建議 PBR base color：

```text
dark charcoal / blue-black
RGB approx:
#222A2E
#293237
#30383B
```

需有非常細微的藍灰變化。

背部典型可見：

- 深色基底
- 肩部較淡的白灰色斑塊
- 個體間花紋不同

肩斑不要左右完全鏡像。

---

## 5.2 腹側

```text
warm off-white / pale gray
#D5D7D2
#C9CCC8
```

腹部具有：

- 不規則深色斑點
- 鰓裂
- 嘴部與頭部結構
- 翼後緣較灰暗

斑點必須是個體識別的一部分。

為三隻鬼蝠魟生成不同 `patternSeed`。

---

## 5.3 材質

不要：

- 塑膠亮面
- 金屬質感
- 強烈鏡面反射

建議：

```text
metalness = 0
roughness = 0.42–0.58
specularIntensity = moderate-low
normal detail = very subtle
```

表皮微結構不要做成明顯魚鱗。

---

# 6. 大鬼蝠魟：胸鰭運動

大鬼蝠魟使用典型 **mobuliform oscillatory propulsion**。

研究顯示，其推進主要由胸鰭上下振動完成，身體中央相對僵硬。

Fish et al. (2018) 實測：

- 胸鰭拍動頻率：
  \[
  f = 0.32 \pm 0.11\;Hz
  \]
- 慢速游動：
  \[
  v = 1.42 \pm 0.50\;m/s
  \]
- 觀測範圍約：
  \[
  0.46–2.51\;m/s
  \]

本場景不是追逐或進食，因此使用低至中段：

```text
normal f = 0.23–0.36 Hz
rare acceleration = 0.38–0.45 Hz
glide = 0 Hz for short intervals
```

不要固定 0.32 Hz。

使用 Ornstein–Uhlenbeck process 緩慢改變頻率：

\[
df
=
\theta(\mu_f-f)dt
+
\sigma dW_t
\]

建議：

```text
μf = 0.30 Hz
θ = 0.15
σ = 0.015
clamp = [0.22, 0.42]
```

---

## 6.1 翼面 traveling wave

對左右翼各自建立局部座標：

- `r ∈ [0,1]`：翼根至翼尖
- `c ∈ [0,1]`：翼前緣至後緣

垂直位移：

\[
z(r,c,t)
=
A(r,c)
\sin(
2\pi f t
-
k_c c
+
\phi
)
\]

振幅：

\[
A(r,c)
=
A_{tip}
r^{1.55}
(0.72+0.28c)
\]

建議：

\[
A_{tip}=0.10W\sim0.16W
\]

不要讓整片翼同時上下轉動。

必須存在：

- 翼根小振幅
- 中段中等
- 翼尖最大
- 後緣稍微落後前緣

相位延遲可設：

\[
k_c = 0.35\pi\sim0.65\pi
\]

形成長波長而非短波蛇行。

---

## 6.2 Upstroke / glide

Fish et al. 觀察到鬼蝠魟會在上拍結束後插入 glide。

因此：

每一個完整拍翼循環不一定直接接下一次。

狀態：

```text
POWER_STROKE
UPSTROKE
OPTIONAL_GLIDE
NEXT_STROKE
```

glide duration：

```text
0.4–1.6 s
```

glide 機率：

```text
P(glide per cycle) = 0.18–0.35
```

glide 中胸鰭保持小幅正 dihedral：

```text
tip angle = +5° to +14°
```

不要完全水平鎖死。

---

# 7. 鬼蝠魟：轉彎與 banking

Fish et al. (2018) 實測轉彎：

- bank angle：
  `3°–80°`
- 外側翼垂直行程約為內側翼：
  \[
  1.7\pm0.6
  \]
  倍

轉彎率與半徑的實測 regression：

\[
\omega_{mean}
=
51.58R^{-0.74}
\]

\[
\omega_{median}
=
17.1R^{-0.62}
\]

其中：

- `ω`：deg/s
- `R`：m

不要機械照搬至所有尺寸；用它作為「曲率越大，角速度上升但非線性」的 calibration。

---

## 7.1 Bank controller

定義：

\[
C =
clamp(
v^2\kappa/C_0,
0,1
)
\]

bank target：

\[
\phi_{bank}
=
sign(\kappa)
[
5^\circ
+
45^\circ smoothstep(C)
]
\]

正常盤旋限制：

```text
5°–50°
```

偶發 tighter turn：

```text
50°–65°
```

`>70°` 只允許非常少數特殊 manoeuvre。

---

## 7.2 左右翼不對稱

假設向左轉：

```text
left  = inboard
right = outboard
```

外翼振幅：

\[
A_{out}
=
A_0(1+\delta)
\]

內翼：

\[
A_{in}
=
A_0(1-\delta)
\]

使：

\[
\frac{A_{out}}{A_{in}}
\approx1.3–2.1
\]

平均目標約：

\[
1.7
\]

`δ` 不可瞬間變化。

使用：

\[
\delta(t+\Delta t)
=
lerp(
\delta(t),
\delta_{target},
1-e^{-\Delta t/0.8}
)
\]

---

# 8. 三隻鬼蝠魟的路徑行為

## 8.1 空間區域

定義：

```text
MANTA_MAIN_ZONE:
  above arcade
  above adjacent road

height:
  normal = 5–11 m
  low pass = 1.6–2.8 m
  distant = 10–16 m
```

80% 以上時間留在商店街與道路上方。

---

## 8.2 基本盤旋

不要使用完美圓。

使用 slowly deforming ellipse：

\[
x(t)=
c_x
+
a(t)\cos\theta
\]

\[
z(t)=
c_z
+
b(t)\sin\theta
\]

\[
y(t)=
h_0
+
h_1\sin(\theta+\psi)
+
h_2\sin(0.37\theta+\psi_2)
\]

其中：

```text
a = 9–18 m
b = 6–13 m
h1 = 0.7–1.8 m
h2 = 0.2–0.7 m
```

軌道中心本身也慢慢漂移：

\[
\mathbf{c}(t)
=
\mathbf{c}_0+
\epsilon\mathbf{n}_{lowfreq}(t)
\]

漂移時間尺度：

```text
30–120 s
```

因此不會看起來像繞著隱形柱子轉圈。

---

# 9. 兩隻鬼蝠魟的互動

不要把行為命名成 biological “play” 實作。

目前研究可支持：

- manta 可形成短期社交關聯
- 可出現成對／多個體活動
- 求偶時可同步追隨
- 群體可進行環繞、跟隨等行為

但「玩耍」的功能性判定不足。

因此程式上使用：

```text
PAIR_AFFILIATION
SYNCHRONIZED_CRUISE
LOOSE_FOLLOW
CROSS_AND_SEPARATE
```

而不是 `PLAYING`.

---

## 9.1 Pair spring

令 A 與 B：

\[
\mathbf{d}=
\mathbf{x}_B-\mathbf{x}_A
\]

期望距離：

\[
d_0=0.9W–1.8W
\]

soft interaction force：

\[
\mathbf{F}_{pair}
=
k_p(d-d_0)\hat{\mathbf{d}}
+
k_v(\mathbf{v}_B-\mathbf{v}_A)
\]

只能是弱力：

```text
pair influence < 25% of route steering
```

兩隻不能像被彈簧綁在一起。

---

## 9.2 Phase locking

若進入同步階段：

\[
\Delta\theta
=
\theta_B-\theta_A
\]

目標：

```text
30°–110°
```

而非 180° 完美對稱。

使用 Kuramoto-like weak coupling：

\[
\dot{\theta_i}
=
\omega_i
+
K\sin(\theta_j-\theta_i-\Delta\theta_0)
\]

```text
K = very weak
```

持續：

```text
12–35 s
```

之後自然解耦。

---

# 10. 鬼蝠魟低空事件

需求：

> 偶爾下降到道路、人類視線附近，再回到天空。

使用 Poisson event：

\[
P(event\;in\;\Delta t)
=
1-e^{-\lambda\Delta t}
\]

建議：

```text
λ = 1 / 130 s
hard cooldown = 70 s
```

也就是大約每 1.5–3 分鐘可能有一次，但不是固定。

下降不能直直掉下來。

使用 cubic Hermite / Bézier：

```text
P0 = current high route
P1 = forward + gentle descent
P2 = eye-level flyby
P3 = ascending exit
```

最低高度：

```text
center of body Y = 2.0–3.0 m
```

依翼展與道路寬度避免穿模。

低空通過：

```text
duration = 8–18 s
speed = 0.8–1.3 m/s
```

靠近鏡頭時：
- 不要突然轉頭「看玩家」
- 不要為玩家表演
- 只是一個路徑恰好經過觀者附近

---

# 11. 鯨鯊：外型

必須避免「一般鯊魚放大＋白點」。

核心結構：

1. 頭部非常寬、扁平。
2. 吻很短。
3. 口近 terminal，非常寬。
4. 眼睛相對極小。
5. 5 個大型鰓裂。
6. 身體粗壯。
7. 上側有 3 條明顯 longitudinal ridges。
8. 第一背鰭大於第二背鰭。
9. 胸鰭大型。
10. 成年尾鰭接近 semi-lunate。
11. 背部與側面具有獨特 spots + transverse bars 的 checkerboard pattern。
12. 腹面明顯較白。

---

# 12. 鯨鯊：程序化身體

令：

\[
s\in[0,1]
\]

代表吻端至尾端。

半徑 envelope：

\[
r(s)
=
r_{max}
\cdot
B(s;\alpha,\beta)
\]

其中 normalized beta profile：

\[
B(s)
=
\frac{
s^{\alpha-1}(1-s)^{\beta-1}
}{
\max_s[
s^{\alpha-1}(1-s)^{\beta-1}
]
}
\]

初始：

```text
α = 1.7
β = 3.4
```

但頭部不能使用同一個圓截面。

前 20%：

```text
cross section = broad flattened superellipse
```

superellipse：

\[
\left|
\frac{x}{a}
\right|^n+
\left|
\frac{y}{b}
\right|^n=1
\]

```text
n = 2.5–3.5
a > b
```

中後段逐漸轉為橢圓截面。

建議透過 8–12 個 anatomical cross-section control stations 再做 spline loft，而不是完全依賴單一公式。

---

# 13. 鯨鯊顏色

背側：

```text
blue gray / slate gray
#344A53
#3F555D
#465B61
```

腹側：

```text
#C5CBC6
#D2D5CF
```

不要：
- 純黑
- 高飽和寶藍
- 白底黑點

---

## 13.1 Spot / stripe pattern

鯨鯊花紋不是隨機 polka dots。

建立近似 checkerboard structure：

先建立 longitudinal / transverse guide lattice。

網格：

\[
u_i=i\Delta u+\epsilon_i
\]

\[
v_j=j\Delta v+\epsilon_j
\]

其中：

\[
\epsilon\sim \mathcal{N}(0,\sigma^2)
\]

在部分交點產生 spot：

\[
M_{spot}(u,v)
=
\sum_k
\exp
\left[
-\frac{(u-u_k)^2}{2\sigma_{u,k}^2}
-\frac{(v-v_k)^2}{2\sigma_{v,k}^2}
\right]
\]

再加入低頻條帶：

\[
M_{stripe}
=
smoothstep[
\cos(2\pi f_u u+\eta(v))
]
\]

最終：

\[
M
=
clamp(
0.75M_{spot}+0.25M_{stripe},
0,1
)
\]

重要：
- spot 大小有變異
- spot spacing 有變異
- 不可等距
- 左右不能完全鏡像
- 頭部也要有斑點
- 胸鰭、第一背鰭需延續斑點
- 腹面大幅減少

---

# 14. 鯨鯊正常游動

Meekan et al. (2015) biologging：

主動游動速度平均：

\[
0.58–0.81\;m/s
\]

stroke frequency median：

\[
0.35–0.65\;Hz
\]

鯨鯊是節能型大型游泳者。

本場景使用：

```text
speed:
  normal = 0.55–0.80 m/s
  slow = 0.40–0.55
  route transition = 0.75–0.95

tail beat:
  normal = 0.32–0.48 Hz
  temporary = 0.48–0.60 Hz
```

8–9 m 個體不要長時間使用 0.6 Hz 以上。

---

# 15. 鯨鯊身體波

鯨鯊屬 body-caudal propulsion。

前半身不要像蛇一樣扭。

令：

\[
s=x/L
\]

從頭到尾。

身體 lateral displacement：

\[
y(s,t)
=
A(s)
\sin(
2\pi ft
-
ks
+
\phi
)
\]

振幅 envelope：

\[
A(s)=
\begin{cases}
A_h s^{2.5}, & s<s_0\\
A_h+
(A_t-A_h)
\left(
\frac{s-s_0}{1-s_0}
\right)^{1.8},
& s\ge s_0
\end{cases}
\]

其中：

```text
s0 = 0.42–0.50
Ah = 0.005–0.015 L
At = 0.08–0.14 L
```

如果使用 peak-to-peak tail amplitude：

\[
A_{pp}\approx0.16–0.28L
\]

---

## 15.1 Strouhal calibration

巡航效率可用：

\[
St=
\frac{fA}{U}
\]

其中：

- `f` = tail beat frequency
- `A` = peak-to-peak tail amplitude
- `U` = swimming velocity

文獻中高效率魚類巡航常落在：

\[
0.2<St<0.4
\]

因此 animation system 每次改速度時，不要獨立亂改 frequency。

可反推：

\[
f=
\frac{St\cdot U}{A}
\]

用：

```text
St target = 0.24–0.34
```

若生物學實測頻率範圍與 St 推導衝突：
**優先採 species-specific 實測範圍。**

---

# 16. 鯨鯊 glide

Meekan et al. 觀測：

- 個別 glide 中位時間約 `5–20 s`
- 在水面下活動時間中約有 `10.6–17.6%` 為 glide
- 下潛時 glide 比例更高

場景雖無真正浮力，但可保留這種 locomotor rhythm。

建議：

```text
glide fraction of total time = 8–15%
glide duration = 4–14 s
```

glide 時：

```text
tail amplitude -> 15–30% normal
tail frequency -> 0–0.15 Hz
speed decay -> extremely slow
```

不能瞬間把尾巴凍結。

使用：

\[
A(t)=A_0e^{-t/\tau}
\]

```text
τ = 0.8–1.5 s
```

恢復時同樣 smooth ramp。

---

# 17. 鯨鯊路徑

鯨鯊不跟鬼蝠魟搶同一層空間。

```text
normal height = 9–16 m
lowest = 7 m
far pass = 14–22 m
```

主路徑是巨大 elongated loop：

```text
major radius = 25–55 m
minor radius = 12–25 m
period = 100–220 s
```

不要每圈完全相同。

每隔：

```text
90–240 s
```

有可能換另一條 route spline。

route 轉換要：
- 先拉大轉彎半徑
- 改變 heading
- 進入新 loop

禁止原地掉頭。

建議最低轉彎半徑：

\[
R_{min}\approx2.5L
\]

普通：

\[
R=3L–7L
\]

此範圍為本專案的保守動畫限制，不是宣稱為物種實測極值。

---

# 18. 鯨鯊轉彎姿態

因缺乏與 manta 同等完整的 whale shark open-water turn-radius dataset，
不要捏造精確生物學 turn equation。

使用曲率控制：

\[
\omega =
\frac{v}{R}
\]

body roll：

\[
\phi=
clamp(
K_\phi v^2\kappa,
-18^\circ,
18^\circ
)
\]

一般：

```text
roll = 2°–10°
```

大轉向：

```text
10°–18°
```

鯨鯊轉彎應該看起來：

> 很早就開始改方向，而且很久之後才完成。

---

# 19. 藍綠光鰓雀鯛外型

成年體長：

```text
27–59 mm standard length
```

本場景：

```text
35–55 mm
```

外型：

- 小型、稍側扁
- 典型雀鯛輪廓
- 尾鰭分叉
- 身體淺藍綠
- 不是螢光棒
- 顏色會隨觀看角與光線有藍／綠變化

base：

```text
#79CDC4
#6BC4C1
#83D3C7
```

背側略深。

腹側：

```text
#B7DDD2
```

鰭：
- 幾乎透明
- 青綠 tint
- opacity / transmission 視 renderer 而定

可用 Fresnel-like color shift：

\[
c=
(1-F)c_{green}
+
Fc_{cyan}
\]

\[
F=(1-\mathbf{n}\cdot\mathbf{v})^5
\]

效果必須非常弱。

---

# 20. 烏尾鮗外型

使用 `Pterocaesio digramma`。

形態：

- 約 30 cm 以內
- 細長紡錘形
- 側扁
- 深叉尾
- 身體長度 / 體高約：
  \[
  3.3–3.9
  \]

顏色：

- 背部藍色
- 腹側帶淡粉／銀色
- 體側兩條細金黃色帶
- 尾鰭上下葉末端黑色
- 在水中整體視覺常偏藍

場景不要讓金色過於鮮豔。

base：

```text
dorsal blue = #4F8796
lateral blue = #6FA6AD
ventral silver-pink = #B9BFC0 / #C7B9B6
gold stripe = #C4A85A (low saturation)
tail tip = #252A2C
```

---

# 21. 小型魚群：三區域模型

採用 Couzin-style：

每隻魚 `i` 有三個社交區：

```text
Zone of Repulsion   ZOR
Zone of Alignment   ZOO
Zone of Attraction  ZOA
```

距離：

\[
d_{ij}=||x_j-x_i||
\]

---

## 21.1 Repulsion

若：

\[
d_{ij}<r_r
\]

則：

\[
\mathbf{d}_{rep}
=
-\sum_j
\frac{
\mathbf{x_j}-\mathbf{x_i}
}{
d_{ij}^2+\epsilon
}
\]

repulsion 永遠最高優先。

---

## 21.2 Alignment

\[
\mathbf{d}_{align}
=
\frac{
\sum_j \mathbf{v_j}/||\mathbf{v_j}||
}{
N
}
\]

---

## 21.3 Attraction

\[
\mathbf{c_i}
=
\frac{1}{N}\sum_j\mathbf{x_j}
\]

\[
\mathbf{d}_{attr}
=
normalize(
\mathbf{c_i}-\mathbf{x_i}
)
\]

---

## 21.4 合成方向

\[
\mathbf{d_i}
=
normalize(
w_r\mathbf{d}_{rep}
+
w_o\mathbf{d}_{align}
+
w_a\mathbf{d}_{attr}
+
w_f\mathbf{d}_{flow}
+
w_s\mathbf{d}_{shelter}
+
w_g\mathbf{d}_{groupGoal}
+
w_{obs}\mathbf{d}_{avoid}
)
\]

不要用純 Reynolds Boids 預設參數。

---

# 22. 藍綠光鰓雀鯛群游參數

C. viridis 在自然環境中會以固定枝狀珊瑚作為 home shelter。

場景中可把：

- 店面下緣
- 欄杆下方
- 柱腳植物
- 遮蔽角落

視為抽象 `reef proxy / shelter volume`。

但不要真的生成珊瑚。

---

## 22.1 社交距離

以體長 `L` 為單位：

```text
r_repulsion = 0.7–1.2 L
r_alignment = 2.0–4.0 L
r_attraction = 4.0–8.0 L
```

---

## 22.2 行為權重

```text
w_repulsion = 2.2
w_alignment = 0.9
w_attraction = 0.7
w_shelter = 1.1
w_groupGoal = 0.5
w_flow = 0.25
```

因此魚群：

- 有群聚
- 但不像軍隊
- 可形成較鬆散的雲狀聚集

---

## 22.3 正常速度

缺乏本物種完整的 cruising-speed / tail-frequency dataset。

因此不要把動畫參數標成「實測值」。

使用保守 implementation prior：

```text
normal = 1.0–2.5 BL/s
excited = 2.5–4.0 BL/s
burst = 4–7 BL/s for <1.5 s
```

與同屬／近緣珊瑚礁魚之 Ucrit 文獻相比，保持明顯低於極限性能。

---

# 23. C. viridis 威脅／收縮反應

自然行為：
受到危險刺激時快速縮入枝狀珊瑚。

本場景不需要 predator。

但可用極低頻環境事件模擬：

```text
P(startle) ≈ once per 3–8 min per school
```

可能觸發來源：

- 巨大鬼蝠魟低空通過
- 鯨鯊巨大陰影
- 強風 event

不是每次都觸發。

反應：

1. 群體瞬間提高 alignment。
2. 朝 shelter volume 收縮。
3. 1–3 秒後逐漸散開。
4. 5–15 秒內恢復正常。

不要做成煙火式爆炸。

---

# 24. 烏尾鮗群游參數

烏尾鮗是快速、持久的 body–caudal fin swimmer。

Caesio teres 實驗資料：

\[
U_{crit}
=
83.96\pm3.20\;cm/s
\]

\[
U_{crit}
=
10.13\pm0.30\;BL/s
\]

Pterocaesio marri：

\[
U_{crit}
=
82.05\pm5.10\;cm/s
\]

\[
U_{crit}
=
10.10\pm1.04\;BL/s
\]

雖非 P. digramma 本身，但可作同科／近緣 fusilier 的 locomotor envelope 參考。

正常動畫應遠低於 Ucrit：

```text
cruise = 1.5–3.5 BL/s
fast pass = 3.5–5.0 BL/s
brief burst = 5–7 BL/s
```

不要長時間跑到 10 BL/s。

---

# 25. 烏尾鮗群體結構

fusilier 比 Chromis 更高度 polarized。

參數：

```text
r_repulsion = 0.8–1.3 L
r_alignment = 2.5–5 L
r_attraction = 5–10 L

w_repulsion = 2.0
w_alignment = 1.6
w_attraction = 1.0
w_groupGoal = 0.9
w_flow = 0.35
```

school shape：

```text
length : width : height
≈ 3.5 : 1.6 : 1
```

不是球狀。

---

# 26. 群體 global direction

避免每隻魚只靠 local boids 導致無目的抖動。

為每一 school 設 global heading：

\[
d\mathbf{g}
=
\theta(
\boldsymbol{\mu}-\mathbf{g}
)dt
+
\sigma dW_t
\]

即 OU-process。

`μ` 由 route spline tangent 提供。

個體只在其周圍微調。

因此會形成：

- 一群魚從街道深處游近
- 擦過欄杆
- 分流柱子
- 再合流
- 最後離開視野

---

# 27. 小魚轉彎與尾拍

對 body-caudal fish：

\[
St=
\frac{fA}{U}
\]

取：

```text
St = 0.22–0.36
A/L = 0.14–0.24
```

則：

\[
f=
\frac{StU}{A}
\]

這樣 tail frequency 會隨速度自然改變。

例如：

```text
L = 0.24 m
U = 0.55 m/s
A = 0.045 m
St = 0.30
```

得到：

\[
f
=
3.67Hz
\]

這比任意指定一個 tail beat frequency 更合理。

---

# 28. 小魚 body wave

令：

\[
s=x/L
\]

\[
y(s,t)
=
A_{max}
s^p
\sin(
2\pi ft
-
ks
+
\phi_i
)
\]

fusilier：

```text
p = 1.8–2.4
Amax = 0.08–0.13 L one-sided
```

Chromis：

低速時應減少全身尾擺，
使用更多 median/paired-fin swimming 視覺。

可令：

\[
w_{BCF}
=
smoothstep(
U/U_{transition}
)
\]

\[
A_{tail}
=
w_{BCF}
A_{BCF}
\]

低速：
- 胸鰭拍動為主
- 尾巴只是低幅 correction

高速：
- body–caudal contribution 增加

---

# 29. 障礙物迴避

商店街柱子與欄杆非常重要。

不要讓魚穿過建築。

建立 Signed Distance Field：

\[
D(\mathbf{x})
\]

surface normal：

\[
\mathbf{n}
=
\frac{\nabla D}
{||\nabla D||}
\]

若：

\[
D<d_{safe}
\]

avoidance：

\[
\mathbf{F}_{obs}
=
k
\left(
1-\frac{D}{d_{safe}}
\right)^2
\mathbf{n}
\]

並加入 tangent sliding：

\[
\mathbf{F}_{slide}
=
\mathbf{v}
-
(\mathbf{v}\cdot\mathbf{n})\mathbf{n}
\]

魚群遇柱子時：

- 前排分開
- 中段沿柱體兩側流過
- 後排重新 merge

不要整群瞬間轉 90°。

---

# 30. 大型生物障礙物

對 manta / whale shark：

不要使用小魚式短距離 avoidance。

使用 **look-ahead capsule**：

\[
P_{future}
=
x
+
vT
\]

```text
T:
manta = 4–8 s
whale shark = 8–16 s
```

若未來 trajectory capsule 與建築相交：
提前調整 spline waypoint。

大型動物應該「早就知道自己過不去」。

不是快撞牆才轉。

---

# 31. 個體差異

## Manta A

```text
span = 5.8 m
behavior = broad slow orbit
average height = 7.5 m
fin frequency bias = -4%
```

## Manta B

```text
span = 5.4 m
behavior = most social
frequently pairs with A
height = 6.5–9 m
low-pass event probability = highest
```

## Manta C

```text
span = 5.1 m
behavior = wider excursions
height = 7–12 m
pair probability = lower
```

## Whale Shark

```text
length = 8.5 m
behavior = slow persistent cruiser
height = 10–17 m
turn radius = very large
```

不要複製同一動畫 offset 3 個 phase。

---

# 32. Rare Event Scheduler

所有事件都必須「稀有」。

使用 hazard model：

\[
P=
1-e^{-\lambda\Delta t}
\]

事件：

### Manta pair circle

```text
mean interval = 80–180 s
duration = 15–40 s
```

### Manta eye-level pass

```text
mean interval = 120–240 s
duration = 8–18 s
```

### Whale shark route switch

```text
mean interval = 120–300 s
```

### Chromis shelter contraction

```text
mean interval = 180–480 s
```

### Fusilier fast crossing

```text
mean interval = 90–220 s
```

同時只能有 `1–2` 個 noticeable rare events。

Quiet Places 的世界不是 theme park。

---

# 33. 動畫狀態機

## Manta

```text
CRUISE
GLIDE
BANK_TURN
PAIR_APPROACH
PAIR_SYNC
PAIR_RELEASE
LOW_DESCENT
LOW_PASS
ASCEND
DISTANT_EXCURSION
RETURN
```

## Whale Shark

```text
CRUISE
GLIDE
WIDE_TURN
ASCEND
DESCEND
ROUTE_SWITCH
DISTANT_PASS
```

## Chromis School

```text
LOOSE_FORAGE
COHERE
SHELTER_APPROACH
SHELTER_HOLD
EMERGE
```

## Fusilier School

```text
CRUISE_SCHOOL
FAST_TRANSIT
SPLIT_OBSTACLE
MERGE
DISTANT_LOOP
```

state transition 必須 stochastic + cooldown。

不要固定 timeline loop。

---

# 34. 動態速度

不要：

```js
speed = constant
```

使用 OU process：

\[
dv
=
\theta(v_0-v)dt
+
\sigma dW_t
\]

再加 state modifier。

例如 manta：

```text
v0 = 1.05
theta = 0.25
sigma = 0.05
range = 0.65–1.55 m/s
```

whale shark：

```text
v0 = 0.68
theta = 0.18
sigma = 0.025
range = 0.45–0.90 m/s
```

---

# 35. 不要使用 Perlin noise 直接控制姿態

錯誤：

```js
rotation.x = noise(t)
rotation.y = noise(t)
rotation.z = noise(t)
```

這會讓大型生物像漂浮玩具。

noise 只允許控制：

- route center
- speed target
- fin frequency target
- minor altitude drift

真正姿態必須由：

- spline tangent
- curvature
- acceleration
- fin stroke phase

推導。

---

# 36. 光線與陰影

大型生物最重要的存在感之一是「影子」。

鬼蝠魟掠過棚架與道路時：
- 必須有大型柔和移動陰影
- 影子形狀應讀得到翼狀輪廓
- 但不需要銳利黑影

鯨鯊高度較高：
- 陰影更弱、更 diffuse
- 偶爾只有亮度下降，不一定讀得出完整輪廓

小魚：
- 不必每隻都投 shadow
- 可用少數 near-camera individuals 投影

---

# 37. 相機附近 LOD

為了「可以看到細節」：

大型動物需根據鏡頭距離切 LOD。

```text
Manta:
LOD0 < 18 m
LOD1 18–40 m
LOD2 > 40 m

Whale shark:
LOD0 < 28 m
LOD1 28–60 m
LOD2 > 60 m
```

LOD0：

- ventral spots
- gill slits
- cephalic lobes
- pectoral fin deformation
- skin roughness

Whale shark：

- checkerboard spots
- gill slits
- longitudinal ridges
- eye
- mouth
- pectoral / dorsal fin shapes

不要只把低模放大。

---

# 38. Rig 建議

## Manta

不要只做 3 bones。

每側胸鰭：

```text
root
mid-proximal
mid
distal
tip
```

並至少建立 `4–7` 條 spanwise deformation bands。

更好的方式：
- shader vertex deformation 控制主要 traveling wave
- bones 控制 bank / corrective pose

cephalic lobes：
- independent 2–3 bone chains

tail：
- 4–6 bones
- very small amplitude

---

## Whale Shark

```text
spine bones = 12–18
```

前半：

- high stiffness

後半：

- progressively flexible

tail peduncle：
- dedicated bones

caudal fin：
- 不要軟布化
- 保持大體 rigid
- root 隨 peduncle 擺動

---

# 39. Small Fish GPU Strategy

Chromis / fusilier 數量高。

優先：

- GPU instancing
- vertex animation texture
- per-instance:
  - phase
  - speed
  - body length
  - hueOffset
  - route/school id
  - local transform

不要為 150 隻魚各跑完整 skeletal mixer。

---

# 40. 群體品質指標

用 polarization：

\[
\Phi
=
\frac{1}{N}
\left|
\sum_i
\frac{\mathbf{v_i}}{|\mathbf{v_i}|}
\right|
\]

### Chromis

```text
normal Φ = 0.45–0.75
escape/cohere Φ = 0.7–0.9
```

### Fusilier

```text
normal Φ = 0.72–0.93
```

若一直：

```text
Φ > 0.97
```

看起來像機械編隊。

如果：

```text
Φ < 0.3
```

fusilier 會像亂飛的粒子。

---

# 41. 群體密度

nearest-neighbor distance：

Chromis：

```text
median = 1.2–3.0 BL
```

Fusilier：

```text
median = 1.0–2.2 BL
```

不要完全平均排列。

使用 log-normal jitter：

\[
d\sim LogNormal(\mu,\sigma)
\]

而不是固定 grid。

---

# 42. 建議更新頻率

大型動物：

```text
behavior controller = 10–20 Hz
animation deform = render frame rate
```

小魚：

```text
school logic = 10–15 Hz
local interpolation = render frame rate
```

遠距 LOD：

```text
5 Hz
```

不要因為降低 AI update rate 造成 visible stepping。

使用 interpolation。

---

# 43. 驗收：大鬼蝠魟

至少錄製連續 5 分鐘測試。

必須符合：

- [ ] 三隻個體大小與花紋不同。
- [ ] 不會固定等距繞圈。
- [ ] 胸鰭不是剛性整片上下翻。
- [ ] 正常拍翼多數約 0.22–0.42 Hz。
- [ ] 有短暫 glide。
- [ ] 轉彎時存在 banking。
- [ ] 外翼 excursion 大於內翼。
- [ ] 一般 turn bank 不超過約 50°。
- [ ] 兩隻可短時間同步，但會解耦。
- [ ] 偶爾有一隻低空通過。
- [ ] 不撞棚架、電線杆、建築。
- [ ] 不會主動追著 camera。

---

# 44. 驗收：鯨鯊

- [ ] 頭寬扁，而非一般 shark snout。
- [ ] 口位於前端。
- [ ] 可看到 5 大鰓裂。
- [ ] 有三條 longitudinal ridges。
- [ ] 第一背鰭明顯大於第二背鰭。
- [ ] 成年尾鰭為大型 semi-lunate。
- [ ] spots + stripes 為不規則 checkerboard。
- [ ] 不像 leopard spots。
- [ ] 前半身非常穩定。
- [ ] lateral wave 主要從後半開始。
- [ ] 常態速度約 0.55–0.8 m/s。
- [ ] tail frequency 主要在約 0.32–0.48 Hz。
- [ ] 有低頻 glide。
- [ ] 轉彎半徑大。
- [ ] 不會突然 U-turn。

---

# 45. 驗收：Chromis

- [ ] 小型、淺藍綠。
- [ ] 不像 neon LED。
- [ ] 群體偏鬆散。
- [ ] 常靠近 shelter proxy。
- [ ] 受擾後可快速收縮。
- [ ] 恢復後不是瞬間回原位置。
- [ ] 低速時尾擺不應過強。
- [ ] 胸鰭在低速巡航有作用。

---

# 46. 驗收：Fusilier

- [ ] 細長紡錘形。
- [ ] 深叉尾。
- [ ] 藍色為主要視覺。
- [ ] 金色帶細而不刺眼。
- [ ] 尾葉末端黑色。
- [ ] 群體方向一致性高於 Chromis。
- [ ] 可快速穿越場景。
- [ ] 會自然繞過柱子再合流。
- [ ] 不會形成 perfect lattice。

---

# 47. 場景驗收

最重要：

- [ ] 看起來仍然是「海邊商店街」。
- [ ] 不是「整條商店街泡在海裡」。
- [ ] 生物大型但畫面不擁擠。
- [ ] 任一時刻不需要全部生物都清楚出現。
- [ ] 近距離時能看到大型生物細節。
- [ ] 遠距離時仍保留壯闊尺度。
- [ ] 有長時間什麼都沒有發生的區段。
- [ ] 稀有事件不會密集連續出現。
- [ ] 10 分鐘內沒有明顯可猜出的 loop。

---

# 48. 研究證據與「實作推定」分離

程式與 README 中，每個重要參數請標註：

```text
SOURCE_MEASURED
SOURCE_RELATED_SPECIES
DERIVED_FROM_FORMULA
ART_DIRECTION
IMPLEMENTATION_PRIOR
```

例：

```text
manta.finFrequency = 0.32 Hz
// SOURCE_MEASURED: Fish et al. 2018

fusilier.maxCruise = 5 BL/s
// IMPLEMENTATION_PRIOR
// constrained below related-species Ucrit from Rummer et al. 2016

whaleShark.minTurnRadius = 2.5L
// ART_DIRECTION / conservative biomechanical constraint
// NOT a measured species-specific minimum
```

**禁止把為動畫方便設定的數值寫成自然史事實。**

---

# 49. 建議程式資料結構

```ts
type EvidenceLevel =
  | "SOURCE_MEASURED"
  | "SOURCE_RELATED_SPECIES"
  | "DERIVED_FROM_FORMULA"
  | "ART_DIRECTION"
  | "IMPLEMENTATION_PRIOR";

interface BiologicalParam {
  value: number;
  unit: string;
  evidence: EvidenceLevel;
  source?: string;
}

interface AnimalKinematics {
  speed: BiologicalParam;
  strokeFrequency: BiologicalParam;
  maxBank: BiologicalParam;
  glideProbability?: BiologicalParam;
}

interface IndividualProfile {
  id: string;
  species: string;
  scale: number;
  patternSeed: number;
  phaseSeed: number;
  behaviorSeed: number;
}
```

所有 stochastic 系統必須使用 seeded RNG，
確保同一 seed 可 debug。

---

# 50. 最終動畫哲學

這個場景的重點不是：

> 「看！有鯨鯊！」

也不是：

> 「看！三隻鬼蝠魟正在表演！」

而應該像：

> 你在一條已經沒有人經過的海邊商店街待了一陣子。  
> 某個瞬間，一大片影子緩慢從棚架上滑過。  
> 抬頭才發現兩隻鬼蝠魟正在更高處交錯盤旋。  
> 很遠的天空，一隻鯨鯊一直都在，只是剛剛沒有注意到。  
> 店門下方的一群小魚忽然改變方向，又散回陰影裡。

所有演算法最後都要服務這個感覺。

---

# 51. 主要研究來源

## Okinawa Churaumi Aquarium

1. Okinawa Churaumi Aquarium — Giant Manta Ray, *Mobula birostris*  
   https://churaumi.okinawa/sp/tc/fishbook/1543394214/

2. Okinawa Churaumi Aquarium — Whale Shark, *Rhincodon typus*  
   https://churaumi.okinawa/tc/fishbook/00000510/

3. Okinawa Churaumi Aquarium — The Kuroshio Sea  
   https://churaumi.okinawa/tc/area/the-kuroshio/kuroshio/

4. Okinawa Churaumi Aquarium — Blue-green Chromis, *Chromis viridis*  
   https://churaumi.okinawa/tc/fishbook/00000080/

5. Okinawa Churaumi Aquarium — Double-lined fusilier, *Pterocaesio digramma*  
   https://churaumi.okinawa/tc/fishbook/00000523/

---

## Manta biomechanics / morphology

6. Fish, F. E. et al. (2018).  
   **Kinematics of swimming of the manta ray: three-dimensional analysis of open-water maneuverability.**  
   Journal of Experimental Biology 221: jeb166041.  
   DOI: https://doi.org/10.1242/jeb.166041

   Key data used:
   - pectoral stroke frequency
   - swimming velocity
   - banking
   - asymmetric pectoral-fin excursion
   - turning radius / turning-rate relationships
   - glide after upstroke

7. Marshall, A. D., Compagno, L. J. V. & Bennett, M. B. (2009).  
   **Redescription of the genus Manta with resurrection of Manta alfredi.**  
   Zootaxa 2301:1–28.  
   DOI: https://doi.org/10.11646/zootaxa.2301.1.1

   Used for:
   - *M. birostris* diagnostic morphology
   - dorsal / ventral pigmentation concepts
   - shoulder patches
   - ventral spotting
   - species differentiation

8. Perryman / manta social-ecology literature and related studies should be treated conservatively.  
   Do not label pair interaction as "play" unless future direct evidence supports it.

9. Germanov, E. S. et al. (2019).  
   **Contrasting Habitat Use and Population Dynamics of Reef Manta Rays Within the Nusa Penida Marine Protected Area, Indonesia.**  
   Frontiers in Marine Science 6:215.  
   DOI: https://doi.org/10.3389/fmars.2019.00215

10. Reef manta social dynamics literature supports persistent and short-lived social affiliations, but these observations primarily concern *Mobula alfredi*.  
    Therefore use it only to justify loose pair association, not species-specific "play".

---

## Whale shark biomechanics

11. Meekan, M. G. et al. (2015).  
    **Swimming strategy and body plan of the world's largest fish: implications for foraging efficiency and thermoregulation.**  
    Frontiers in Marine Science 2:64.  
    DOI: https://doi.org/10.3389/fmars.2015.00064

    Key data used:
    - active swimming speed
    - stroke frequency
    - gliding proportion/duration
    - energy-efficient slow swimming

12. Cade, D. E. et al. (2020).  
    **Whale sharks increase swimming effort while filter feeding, but appear to maintain high foraging efficiencies.**  
    Journal of Experimental Biology 223: jeb224402.  
    DOI: https://doi.org/10.1242/jeb.224402

    Used for:
    - tail-beat kinematics
    - feeding vs non-feeding effort
    - IMU-derived motion methodology

13. FAO / CITES whale-shark identification material.  
    Used for:
    - broad flattened head
    - checkerboard spots / stripes
    - longitudinal ridges
    - caudal morphology

---

## Small reef fish

14. Coughlin / coral-reef research summarized in:
    Holzman et al. and related *Chromis viridis* research.  
    *C. viridis* adults are commonly ~27–59 mm SL and form schools around branching coral, leaving shelter by day to feed on zooplankton.

15. Rummer, J. L., Binning, S. A., Roche, D. G. & Johansen, J. L. (2016).  
    **Methods matter: considering locomotory mode and respirometry technique when estimating metabolic rates of fishes.**  
    Conservation Physiology 4(1): cow008.  
    DOI: https://doi.org/10.1093/conphys/cow008

    Key related-species data:
    - *Caesio teres* Ucrit
    - *Pterocaesio marri* Ucrit
    - distinction between BCF and MPF locomotor strategies

---

## Collective motion

16. Couzin, I. D., Krause, J., James, R., Ruxton, G. D. & Franks, N. R. (2002).  
    **Collective memory and spatial sorting in animal groups.**  
    Journal of Theoretical Biology 218:1–11.  
    DOI: https://doi.org/10.1006/jtbi.2002.3065

    Used for:
    - repulsion
    - alignment
    - attraction
    - self-organized 3D group motion

17. Saadat, M. et al. (2017).  
    **On the rules for aquatic locomotion.**  
    Physical Review Fluids 2, 083102.  
    DOI: https://doi.org/10.1103/PhysRevFluids.2.083102

    Used for:
    \[
    St=fA/U
    \]
    and efficient cruising envelope:
    \[
    St\approx0.2–0.4,\quad A/L\approx0.1–0.3
    \]

18. Triantafyllou, G. S., Triantafyllou, M. S. & Grosenbaugh, M. A. (1993).  
    **Optimal thrust development in oscillating foils with application to fish propulsion.**  
    Journal of Fluids and Structures 7:205–224.  
    DOI: https://doi.org/10.1006/jfls.1993.1012

---

# 52. Codex 執行順序

請不要一次全部重寫。

## Phase 1 — anatomy

1. 建立 Manta LOD0
2. 建立 Whale Shark LOD0
3. silhouette screenshot review
4. color / pattern review

完成後才能進下一階段。

## Phase 2 — single-animal biomechanics

5. Manta straight cruise
6. Manta turn + bank
7. Manta glide
8. Whale shark cruise
9. Whale shark glide
10. Whale shark wide turn

輸出 debug overlay：

```text
speed
stroke frequency
curvature
turn radius
bank
state
```

## Phase 3 — routes

11. 三隻 manta 個體化
12. pair behavior
13. low flyby
14. whale shark route switching

## Phase 4 — small schools

15. Chromis school
16. Fusilier school
17. obstacle SDF
18. split / merge
19. rare shelter event

## Phase 5 — integration

20. shadows
21. LOD
22. seeded randomness
23. 10-minute non-repeating test
24. performance profiling
25. final biological QA

---

# 53. 最終輸出要求

Codex 完成後請提交：

```text
/docs/kuroshio-arcade-biology.md
/docs/kuroshio-arcade-parameter-evidence.md

/src/creatures/manta/*
/src/creatures/whale-shark/*
/src/creatures/chromis/*
/src/creatures/fusilier/*
/src/systems/schooling/*
/src/systems/virtual-flow/*
```

並提供：

1. 參數表。
2. 每一參數 evidence level。
3. 5 分鐘 debug video / capture。
4. 10 分鐘 normal playback 驗收。
5. 各生物 close-up screenshot。
6. 轉彎與拍翼 frequency debug chart。
7. performance profile。
8. 已知仍屬 art-direction 而非研究實測的項目清單。

---

**版本：v1.0**  
**用途：Quiet Places / 海邊商店街黑潮生物場景**  
**研究與實作原則：species-specific evidence > related-species evidence > physics-derived constraint > conservative implementation prior > art direction。**
