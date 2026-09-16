# Quiet Places｜巨大鬼蝠魟（Mobula birostris）建模幾何規格 v1.0

> 用途：Codex / Blender / Three.js 建模修正  
> 目標：先把「靜止模型的 silhouette」做對，再進入拍翼、游動與材質。  
> 核心原則：巨大鬼蝠魟不是「菱形薄片＋兩根角」。牠是**非常寬、中央軀幹厚實、胸鰭根部厚而翼端極薄、頭部寬且嘴在最前端、兩個頭鰭可捲曲**的 mobulid ray。

---

# 1. 先修正最常見的「不像鬼蝠魟」問題

如果目前模型看起來不像，優先檢查以下 8 件事：

1. **盤寬不夠寬**
   - 巨大鬼蝠魟的 disc width 遠大於 disc length。
   - 建議建模比例：
     `disc_length / disc_width = 0.43–0.47`
   - target：
     `D = 0.45 W`
   - 也就是約：
     `W / D ≈ 2.2`

2. **頭太尖**
   - 鬼蝠魟不是一般魟魚的尖鼻。
   - 頭部要寬、前緣較平，terminal mouth 位於整個頭部最前方。

3. **胸鰭做成三角形**
   - 前緣接近長而平順的 sweep。
   - 後緣要有明顯的 inward concavity。
   - 翼尖尖，但不是戰鬥機式細長三角翼。

4. **中央軀幹太薄**
   - 中央頭胸部有明顯厚度。
   - 翼尖薄，不代表整隻都是紙片。

5. **頭鰭（cephalic lobes）像兩根角**
   - 頭鰭其實是柔軟、扁平、可以捲起的葉狀結構。
   - 巡航時常呈半捲曲／捲起狀態。

6. **嘴放在腹面**
   - `Mobula birostris` 的嘴是 terminal mouth。
   - 從正前方應該直接看得到嘴的位置。

7. **翼根與身體斷開**
   - 胸鰭不是貼在身體旁的兩片翅膀。
   - 頭、鰓區、胸鰭根部必須形成連續曲面。

8. **尾巴像鯊魚或魟魚尾鰭**
   - 鬼蝠魟尾巴是細長 whip-like tail。
   - 沒有大型 caudal fin。
   - `M. birostris` 尾基部可有包埋退化刺的隆起，但不要做成明顯長刺。

---

# 2. 研究可支持的比例

以下以 `W = disc width` 為全身基準。

Marshall et al. 2008 的數個 `Manta birostris` 標本：

- disc width：2230–2370 mm
- disc length：約 1000–1010 mm
- disc thickness：約 200–250 mm
- cephalic fin length：約 230–270 mm
- cephalic fin width：約 120–125 mm
- cranial width：約 520–540 mm
- eye diameter：約 20–30 mm

換成 `W` 比例後，可作為建模 anchor：

```text
disc length D         ≈ 0.43–0.46 W
central max thickness ≈ 0.085–0.11 W
head / cranial width  ≈ 0.22–0.24 W
cephalic lobe length  ≈ 0.10–0.12 W
cephalic lobe width   ≈ 0.045–0.055 W
eye diameter          ≈ 0.009–0.013 W
```

其他成年標本有較長 disc length，因此這些不是 species-wide fixed constants。
建模 target 建議採：

```text
D = 0.45 W
Tmax = 0.095 W
headWidth = 0.23 W
cephalicLength = 0.11 W
cephalicWidth = 0.05 W
eyeDiameter = 0.011 W
```

嘴寬的成體量測可落在約：

```text
mouthWidth ≈ 0.14–0.16 W
```

---

# 3. 座標系

建議：

```text
X = 左右，+X = 右側翼尖
Y = 上下，+Y = dorsal / 上方
Z = 前後，+Z = 頭部／游動方向
```

模型中心約放在肩部／胸鰭根部附近。

設定：

```text
W = 1.0 normalized unit
left tip  = X -0.50 W
right tip = X +0.50 W
```

---

# 4. Top View：不要用單一菱形，拆成「中央軀幹＋左右胸鰭」

## 4.1 中央頭部前緣

令：

```text
xh = 0.11 W
```

中央頭部前緣：

\[
Z_{head-front}(x)
=
0.21W
-
0.09W
\left(
\frac{|x|}{0.11W}
\right)^3
\]

適用：

\[
|x| \le 0.11W
\]

因此：

```text
x = 0       -> z = +0.21W
x = ±0.11W -> z = +0.12W
```

`power = 3` 的目的：
讓吻端中央保持「寬而平」，不要變尖鼻。

如果頭仍然太尖，可改：

```text
power = 3.5–4.0
```

---

# 5. 中央軀幹後緣

中央 body / pelvic 區後緣可用：

\[
Z_{body-rear}(x)
=
-0.22W
+
0.05W
\left(
\frac{|x|}{0.11W}
\right)^2
\]

因此：

```text
x = 0       -> -0.22W
x = ±0.11W -> -0.17W
```

這會讓中央身體自然連到胸鰭後緣。

整體中央 disc length：

\[
0.21W - (-0.22W) = 0.43W
\]

再加上局部翼後緣／pelvic silhouette，可使視覺 disc length 約 0.44–0.46W。

---

# 6. 胸鰭前緣：接近直線，但不能像三角翼

左右對稱。

令：

\[
r=
\frac{|x|-0.11W}{0.39W}
\]

其中：

\[
r\in[0,1]
\]

- `r=0`：翼根
- `r=1`：翼尖

leading edge：

\[
Z_{LE}(r)
=
0.12W(1-r)
-
0.02Wr
+
0.010W\sin(\pi r)
\]

結果：

```text
wing root = +0.12W
wing tip  = -0.02W
```

特徵：

- 前緣大致平順。
- 中段只帶很弱的 convexity。
- 翼尖略向後 sweep。

**如果目前模型像蝙蝠／戰鬥機，通常是 leading edge sweep 太大。**

---

# 7. 胸鰭後緣：這裡是「像不像 manta」的重要關鍵

trailing edge：

\[
Z_{TE}(r)
=
-0.17W(1-r)
-
0.02Wr
+
0.040W\sin(\pi r)
\]

特徵：

- 翼根後方深。
- 中段往前收，形成 concave trailing edge。
- 最後收斂至翼尖。

如果畫出 top-view silhouette：

```text
LE：長、平順、略 sweep
TE：明顯向內凹
```

而不是：

```text
LE：直線
TE：直線
=> 巨大三角形
```

---

# 8. 局部 chord

\[
C(r)
=
Z_{LE}(r)-Z_{TE}(r)
\]

這個 chord 應：

- 翼根最大。
- 往外側快速縮小。
- 翼尖趨近 0。

驗收：

```text
C(0) ≈ 0.29W
C(0.5) ≈ 0.11–0.13W
C(0.8) ≈ 0.04W
C(1) ≈ 0
```

這個變化非常重要。

---

# 9. 中央身體絕對不能做成紙片

Marshall et al. 的標本顯示 disc thickness 約為 disc length 的約 20–25%。

由於：

\[
D \approx 0.43–0.46W
\]

因此中央最大厚度約：

\[
T_{max}
\approx
0.085–0.11W
\]

建議：

\[
T_{max}=0.095W
\]

例如：

```text
W = 5.5 m
Tmax ≈ 0.52 m
```

這比很多 CG 模型想像的厚。

---

# 10. 中央身體使用 cross-section loft，不要一個 sphere 壓扁

建議建立以下 station：

| Z / W | half width / W | total thickness / W |
|---:|---:|---:|
| +0.20 | 0.095 | 0.050 |
| +0.15 | 0.115 | 0.080 |
| +0.08 | 0.120 | 0.095 |
|  0.00 | 0.110 | 0.090 |
| -0.10 | 0.085 | 0.070 |
| -0.18 | 0.055 | 0.045 |
| -0.22 | 0.035 | 0.025 |

station 之間使用 cubic spline。

每個截面使用 superellipse：

\[
\left|
\frac{x}{a(z)}
\right|^n
+
\left|
\frac{y-y_c(z)}{b(z)}
\right|^n
=
1
\]

建議：

```text
n = 2.2–2.8
```

不要用完美 ellipse。

原因：
鬼蝠魟中央身體偏扁，但頭胸部仍有寬厚、略 boxy 的立體感。

---

# 11. 胸鰭厚度

胸鰭是柔性 hydrofoil，不是零厚度 cloth。

令：

- `r` = spanwise position
- `c ∈ [0,1]` = leading edge → trailing edge

full thickness：

\[
T_{wing}(r,c)
=
W
\left[
0.003
+
0.038(1-r)^{1.4}
\right]
\left[
4c(1-c)
\right]^{0.55}
\]

解讀：

- 翼根厚。
- 翼尖非常薄。
- leading / trailing edge 變薄。
- 中央 chord 區較厚。

限制：

```text
wing root max thickness ≈ 0.04W
distal wing ≈ 0.005–0.012W
tip ≈ 0.003W scale
```

**翼根必須自然 blend 進中央 body。**

---

# 12. 翼面的 neutral camber

不要在 base mesh 就烤進強烈拍翼。

neutral pose 建議：

\[
Y_{mid}(r,c)
=
0.006W
r^{1.5}
\sin(\pi c)
\]

只建立非常輕微的 dome / camber。

真正：

- downward stroke
- upward stroke
- bowed glide
- banking

都交給 rig / deformation。

---

# 13. 翼尖

翼尖是 manta silhouette 的另一核心。

需要：

```text
尖
但有肉
不能像 polygon spike
不能像紙折角
```

tip region：

```text
r > 0.88
```

厚度 taper：

\[
T \propto (1-r)^{0.7}
\]

而不是線性瞬間收零。

tip tangent 必須讓：

- leading edge
- trailing edge

以相近方向合流。

如果 tip 出現銳角折線，遠景會非常像 low-poly aircraft。

---

# 14. 頭部寬度

建議：

\[
headWidth \approx 0.23W
\]

half width：

\[
x_h \approx 0.115W
\]

這點非常重要。

若：

```text
headWidth < 0.18W
```

通常開始看起來像一般 stingray。

若：

```text
headWidth > 0.28W
```

則容易變成奇怪的 rectangular head。

---

# 15. 嘴：一定是 terminal

mouth width：

\[
W_m=0.14–0.16W
\]

建議：

\[
W_m=0.15W
\]

巡航時 mouth opening 很窄。

正面 aperture 可用 superellipse：

\[
\left|
\frac{x}{0.075W}
\right|^4
+
\left|
\frac{y}{0.009W}
\right|^2
=
1
\]

因此：

```text
width  ≈ 0.15W
height ≈ 0.018W
```

巡航不要張成 filter-feeding 的大洞。

`M. birostris` 的口腔與 cephalic-lobe 內側通常較暗，可利用這點增加 species read。

---

# 16. Cephalic lobes：不要做成「兩根角」

量測 anchor：

```text
length ≈ 0.10–0.12W
width  ≈ 0.045–0.055W
```

建議：

```text
Lc = 0.11W
Wc = 0.05W
```

每側 lobe 使用柔性 ribbon。

中心線：

\[
x_c(s)
=
\sigma
[
0.085W
+
0.012W s
]
\]

\[
z_c(s)
=
0.17W
+
0.11Ws
\]

\[
y_c(s)
=
0.005W\sin(\pi s)
\]

其中：

```text
s ∈ [0,1]
σ = -1 left
σ = +1 right
```

---

# 17. Cephalic lobe taper

寬度：

\[
w_c(s)
=
0.05W
(1-0.30s)
\]

厚度：

\[
t_c(s)
=
0.012W
(1-0.35s)
\]

頭鰭末端仍然是扁平 fleshy flap。

不要 taper 成尖角。

---

# 18. 巡航時的「捲起」

巡航時 lobe 不應完全打開成 feeding funnel。

定義捲曲角：

\[
\theta(s)
=
\sigma
[
35^\circ
+
120^\circ s^{1.25}
]
\]

將每個 ribbon cross-section 繞局部 tangent rotation。

結果：

- base 較平。
- 越往末端越向內捲。
- 左右方向相反。
- 最後形成 manta 特有的 horn-like scroll。

注意：

> 外觀雖然像「角」，但幾何本質應該是捲起來的扁平葉片，而不是圓柱 horn。

---

# 19. Feeding 模式才展開頭鰭

若未來有 feeding state：

\[
\theta_{feed}(s)
\rightarrow
10^\circ–35^\circ
\]

讓 lobe 展開朝前，形成導流 funnel。

但商店街正常巡航：

```text
70–90% 時間保持 rolled / semi-rolled
```

---

# 20. 眼睛位置

eye diameter：

\[
D_e \approx 0.01W
\]

眼睛在頭部**側面**，不要放得像卡通角色一樣靠前、靠中央。

建議中心位置：

```text
X ≈ ±0.105W
Z ≈ +0.12–0.15W
Y ≈ +0.015–0.025W
```

眼睛本身很小。

如果觀者第一眼先注意到眼睛，通常做太大。

---

# 21. Spiracle

`M. birostris` 的 spiracle 位於較 dorsal 的位置、眼後方。

視覺上應：

- 小
- 在眼睛後側
- 不要做成第二個大孔洞

---

# 22. 五對鰓裂

腹側有五對 gill slits。

不要做成五條完全平行、等長、等距的刻痕。

可以定義五個 longitudinal station：

```text
z/W:
+0.055
+0.025
-0.005
-0.038
-0.073
```

gill slit half-length：

```text
0.057W
0.060W
0.058W
0.052W
0.043W
```

曲線：

\[
x(s)
=
x_0
+
L_g s
\]

\[
z(s)
=
z_g
+
0.006W
\sin(\pi s)
\]

使 slit 帶一點自然弧度。

第五對稍短。

---

# 23. Pelvic fins

尾基左右各有小 pelvic fin。

不要：
- 做成第二對大翅膀。
- 比 dorsal fin 更搶眼。

建議長度：

```text
0.04–0.06W
```

與中央 body posterior surface 平順連接。

---

# 24. Dorsal fin

背側、靠近尾根。

形狀：

- 小型
- 三角
- 後掠
- 根部有厚度

建議：

```text
base length ≈ 0.035–0.05W
height      ≈ 0.025–0.04W
```

不要做成 shark-sized dorsal fin。

---

# 25. 尾巴

tail 從 posterior midline 延伸。

建議本場景：

\[
L_{tail}=0.40–0.50W
\]

注意自然個體尾巴可能斷裂，因此不是絕對比例。

tail radius：

\[
R(s)
=
0.012W(1-s)^{1.45}
+
0.0012W
\]

其中：

\[
s\in[0,1]
\]

特徵：

- root 有肉。
- 很快變細。
- 尾端 whip-like。
- 無大型尾鰭。

---

# 26. `M. birostris` 尾基辨識

在 dorsal fin 後方、tail base 可加入：

- 小型 knob / calcified bulge
- 暗示 vestigial embedded spine

但：

```text
不要做成長刺
不要做成 stingray barb
```

這是一個 species-specific 細節，不該成為視覺主角。

---

# 27. 背面顏色也會影響「像不像」

Oceanic / Giant manta 的典型 dorsal read：

```text
base:
charcoal black
blue-black
dark slate
```

例如：

```text
#20272A
#293135
#32393B
```

不是純 `#000000`。

---

# 28. 肩部白斑

`Mobula birostris` 很重要的 species cue：

- 兩側白色 shoulder patches 偏三角形。
- 前緣大致與頭部／嘴方向平行。
- 形成中央黑色的 `T` 型視覺。

不要做成：

- reef manta 那種更彎曲的 shoulder mark
- 完全對稱的 SVG 圖案

使用左右近似但不完全鏡像的 mask。

---

# 29. 腹面

base：

```text
warm white / pale gray
#D7D8D2
#CBCDC8
```

`M. birostris`：

- gill 區前半部通常不要塞大量黑點。
- dark spots 主要可集中在較後方 abdominal region。
- pectoral trailing underside 可較深色。
- 第五鰓裂後方可有較明顯 dark marking。

這些是區分 oceanic manta 與 reef manta 的重要視覺線索之一。

---

# 30. 一個可直接給 Codex 的 mesh generator 結構

```ts
interface MantaGeometryParams {
  discWidth: number;

  discLengthRatio: 0.45;
  maxThicknessRatio: 0.095;

  headWidthRatio: 0.23;
  mouthWidthRatio: 0.15;

  cephalicLengthRatio: 0.11;
  cephalicWidthRatio: 0.05;

  tailLengthRatio: 0.45;
}
```

mesh pipeline：

```text
1. central body station loft
2. left pectoral planform
3. right pectoral planform
4. procedural wing thickness
5. merge / remesh wing roots
6. sculpt terminal mouth
7. add cephalic lobes as ribbon surfaces
8. add pelvic fins
9. add dorsal fin
10. add tail
11. sculpt eyes / spiracles / gill slits
12. retopology
13. UV
14. species-specific pattern masks
```

不要先做一整片 manta silhouette 再 extrude 5 cm。

---

# 31. Top-view 驗收測試

把模型完全塗成灰色、關掉材質，正上方 orthographic camera。

如果 silhouette 做對，應該：

```text
✓ 寬度約為長度 2.2 倍
✓ 中央頭部寬而平
✓ 頭部約占全寬 23%
✓ 前緣長而平順
✓ 翼尖略向後
✓ 後緣明顯凹入
✓ 中央 posterior body 有存在感
✓ tail 很細
```

若關掉 texture 後不像 manta：
**不要繼續調材質。先重做 mesh。**

---

# 32. Front-view 驗收

正前方 orthographic：

```text
✓ 中央頭胸部有明顯厚度
✓ 身體不是整片同厚
✓ 翼根厚
✓ 翼端極薄
✓ mouth 位於最前方
✓ cephalic lobes 位於 mouth 左右
✓ cephalic lobes 是捲曲葉片
```

最常見錯誤：

```text
整隻像薄紙
```

修正方式：

```text
Tmax -> 0.09–0.10W
wingRootThickness -> 0.035–0.045W
distalWingThickness -> < 0.012W
```

---

# 33. Side-view 驗收

```text
✓ 頭部鈍而厚
✓ mouth terminal
✓ dorsal surface 微隆起
✓ ventral body 非完全平板
✓ dorsal fin 很小
✓ tail base 有厚度，然後快速變細
✓ 沒有大型 caudal fin
```

---

# 34. 目前模型「不像」時的優先修改順序

不要所有地方一起改。

依序：

## 第一順位：silhouette

```text
disc width : length
head width
leading edge
trailing edge
wingtip
```

## 第二順位：volume

```text
central body thickness
wing-root thickness
wing-tip taper
```

## 第三順位：head

```text
terminal mouth
cephalic lobes
eye position
```

## 第四順位：species cues

```text
shoulder patches
ventral spots
dark mouth
tail-base bulge
```

## 第五順位才是

```text
micro skin texture
denticles
normal map
roughness
```

---

# 35. 不要做的形狀

```text
NO perfect diamond
NO flat kite
NO triangular aircraft wing
NO pointed stingray snout
NO cylindrical devil horns
NO huge eyes
NO shark tail
NO huge dorsal fin
NO perfectly straight trailing edge
NO uniform wing thickness
NO left-right perfectly mirrored pigmentation
```

---

# 36. 推薦 LOD0 polygon 分配

如果是 close-up 會從道路低空經過：

```text
central body: 20–30%
pectoral fins: 40–50%
head + cephalic lobes: 15–20%
tail + pelvic + dorsal: 5–10%
```

胸鰭 deformation 區域需要較均勻 topology。

不要：
- 中央身體超密
- 翼面只有幾條大 polygon

胸鰭 spanwise 建議至少：

```text
24–40 edge loops per side
```

chordwise：

```text
10–18 loops
```

LOD0 若需近距離變形，可再增加。

---

# 37. 對你的 Quiet Places 場景的建議尺寸

三隻巨大鬼蝠魟不要完全相同。

```text
Manta A:
W = 5.8 m

Manta B:
W = 5.4 m

Manta C:
W = 5.1 m
```

但三者使用同一 anatomical generator，只改：

```text
discWidth
patternSeed
headWidth ± 2%
wingSweep ± 2%
trailingConcavity ± 4%
bodyThickness ± 3%
cephalicCurl
```

差異必須很小。

否則會看成三個不同 species。

---

# 38. Evidence labeling

請 Codex 在程式中標記：

```text
SOURCE_MEASURED
DERIVED_FROM_MEASURED_RATIO
ANATOMICAL_PROXY
ART_DIRECTION
```

例如：

```ts
discLengthRatio = 0.45
// DERIVED_FROM_MEASURED_RATIO
// Marshall et al. 2008 specimens roughly 0.42–0.45 W;
// other individuals may differ.

headWidthRatio = 0.23
// DERIVED_FROM_MEASURED_RATIO

trailingEdgeConcavity = 0.040
// ANATOMICAL_PROXY
// tuned to reproduce Mobula birostris planform;
// not a published universal morphometric constant.
```

不要把 procedural curve control points 假裝成論文實測值。

---

# 39. 主要研究來源

1. Marshall, A.D., Pierce, S.J. & Bennett, M.B. (2008).  
   **Morphological measurements of manta rays (Manta birostris) with a description of a foetus from the east coast of Southern Africa.**  
   Zootaxa 1717: 24–30.  
   DOI: 10.11646/zootaxa.1717.1.2

2. Marshall, A.D., Compagno, L.J.V. & Bennett, M.B. (2009).  
   **Redescription of the genus Manta with resurrection of Manta alfredi.**  
   Zootaxa 2301: 1–28.  
   DOI: 10.11646/zootaxa.2301.1.1

3. White et al. / later mobulid systematics: current accepted genus `Mobula`; therefore current name is `Mobula birostris`.

4. Manta Trust species guide — Oceanic Manta Ray (`Mobula birostris`):  
   diagnostic dorsal shoulder pattern, ventral pattern, dark mouth / cephalic-lobe interiors, tail-base spine bulge.

5. Froman et al. (2023), Journal of Fish Biology:  
   additional `Mobula birostris` disc-width / disc-length measurements.

---

# 40. 最重要的一句

如果只能先修一件事：

> **先用無材質 orthographic top view，把 `2.2 : 1` 的超寬比例、寬鈍頭部、近直線前緣、明顯內凹後緣，以及厚實中央軀幹做對。**

這五件事完成後，即使完全沒有花紋，觀看者也應該第一眼就認出它是 manta。
