---
title: "Quiet Places 行為系統規格 — Antarctic Glass Squid × Silverfish"
version: "v1.0"
scope: "scene-level ecosystem orchestration"
species:
  - Galiteuthis glacialis
  - Pleuragramma antarcticum
target_stack:
  - Three.js
  - Blender
  - deterministic seeded simulation
scene_context: "極暗雪景走廊 / 窗外降雪 / 冷光"
design_principle: "creatures are ambient events, not performers"
---

# 0. 文件用途

這份文件只處理：

- species orchestration
- 種間距離
- light field
- event scheduler
- rare events
- scene timing
- avoidance
- reproducibility
- performance
- debug observability
- 驗收標準

個體造型與游姿：

- `01-galiteuthis-glacialis.md`
- `02-pleuragramma-antarcticum.md`

---

# 1. 核心設計原則

這不是 aquarium simulation。

這是一個：

> 幾乎一直很安靜的空間  
> 生物偶爾從黑暗中進入可見範圍  
> 又重新被黑暗吞沒

系統不能追求：
- constantly visible creatures
- engagement maximizing movement
- spectacle
- density

反而要刻意保留：

```yaml
empty_time_ratio: 0.55-0.80
```

即：
有 55–80% 的時間，畫面中不該發生明顯事件。

---

# 2. 世界座標

統一採：

```text
X = left / right
Y = up / down
Z = forward / back
```

camera 朝向 corridor far end。

定義：

```yaml
corridor:
  width: W
  height: H
  length: D
```

不要直接 hardcode 真實公尺。
行為系統以 normalized scene units 為主。

---

# 3. Navigation volume

所有生物必須限制在：

```math
\Omega_{nav}
\subset
\mathbb R^3
```

並留安全邊界：

```yaml
wall_margin:
  squid: 0.20-0.35 body_lengths
  silverfish: 0.15-0.30 body_lengths
```

建立：
- SDF
或
- convex corridor bounds
或
- sampled distance field

優先 SDF。

---

# 4. Light field

遠端窗戶是唯一主要光源。

把光定義為一個 scalar field：

```math
L(p)\in[0,1]
```

可以用：

```math
L(p)=
L_{window}
\cdot
G_{distance}(p)
\cdot
G_{angle}(p)
\cdot
V(p)
```

其中：
- `G_distance`：距離衰減
- `G_angle`：方向性
- `V(p)`：遮蔽

---

# 5. Window light approximation

距離：

```math
d=\|p-p_w\|
```

```math
G_{distance}
=
\frac{1}{1+k_d d^2}
```

方向：

```math
G_{angle}
=
smoothstep(
c_{min},
c_{max},
n_w\cdot\hat d
)
```

不要讓整條走廊都亮。

---

# 6. Visibility field

除了物理 light，再定義 artwork visibility：

```math
V_{art}(p)=
L(p)^\gamma
```

推薦：

```yaml
gamma: 1.3-2.2
```

越高：
- 陰影中的生物越快消失
- 越符合此場景調性

---

# 7. 生物層級

```text
Layer 0: Empty architecture
Layer 1: Snow / subtle atmospheric particles
Layer 2: Galiteuthis ambient presence
Layer 3: Silverfish transient school
Layer 4: Rare interaction event
```

Layer 4 不可長時間開啟。

---

# 8. 全局 Scheduler

不要使用：

```js
setInterval(fixedSeconds)
```

應用 stochastic event scheduler。

每個 event type 皆有 hazard rate。

事件 i：

```math
P(event_i\ in\ \Delta t)
=
1-e^{-\lambda_i\Delta t}
```

或用 log-normal interval。

---

# 9. 事件類型

```yaml
events:
  SQUID_APPROACH_LIGHT:
    rarity: common-subtle

  SQUID_CROSS_CORRIDOR:
    rarity: occasional

  SILVERFISH_SMALL_TRANSIT:
    rarity: occasional

  SILVERFISH_MAIN_TRANSIT:
    rarity: uncommon

  SQUID_SILVERFISH_NEAR_PASS:
    rarity: rare

  SILVERFISH_SPLIT_AROUND_SQUID:
    rarity: very_rare

  LONG_EMPTY_PHASE:
    rarity: common
```

---

# 10. 推薦事件間隔

全部 random。

```yaml
SQUID_APPROACH_LIGHT:
  interval_s: 20-90
  duration_s: 8-25

SQUID_CROSS_CORRIDOR:
  interval_s: 60-180
  duration_s: 10-28

SILVERFISH_SMALL_TRANSIT:
  interval_s: 45-140
  duration_s: 5-10

SILVERFISH_MAIN_TRANSIT:
  interval_s: 100-300
  duration_s: 7-14

SQUID_SILVERFISH_NEAR_PASS:
  interval_s: 180-600
  duration_s: 4-12

LONG_EMPTY_PHASE:
  duration_s: 20-90
```

---

# 11. Conflict rules

事件不能全部同時發生。

定義 event mutex：

```yaml
mutex_groups:
  major_motion:
    - SILVERFISH_MAIN_TRANSIT
    - SQUID_CROSS_CORRIDOR
    - SQUID_SILVERFISH_NEAR_PASS

  fish_motion:
    - SILVERFISH_SMALL_TRANSIT
    - SILVERFISH_MAIN_TRANSIT
```

當 major_motion active：
- 禁止觸發另一個 major_motion
- 至少留 cooldown

```yaml
major_event_cooldown_s: 15-45
```

---

# 12. Squid spatial zones

把 squid 活動空間分為：

```text
A: deep dark zone
B: transition zone
C: window-light edge
D: brightest zone
```

權重：

```yaml
squid_zone_preference:
  A: 0.40
  B: 0.35
  C: 0.20
  D: 0.05
```

目的：
- squid 常駐黑暗
- 偶爾進入光邊
- 很少停在正中央最亮處

---

# 13. Silverfish route zones

fish event route：

```text
ENTRY_DARK
→ PRE_LIGHT
→ LIGHT_CROSSING
→ POST_LIGHT
→ EXIT_DARK
```

禁止：
- 進場後在窗前停留
- 光區中繞圈
- 反覆來回穿越

---

# 14. Species avoidance

Silverfish 對 squid 的 mild avoidance：

距離：

```math
d_{sf-sq}
\]

觸發：

```math
d<r_{avoid}
```

建議：

```yaml
r_avoid_fish_bl: 1.5-3.0
```

avoid vector：

```math
O_i=
K_o
\frac{p_i-p_{sq}}
{(d+\epsilon)^2}
```

---

# 15. Avoidance smooth gate

避免硬切換：

```math
g(d)=
1-smoothstep(
r_{inner},
r_{outer},
d
)
```

```math
O'_i=g(d)O_i
```

推薦：

```yaml
r_inner: 1.0 fish BL
r_outer: 3.0 fish BL
```

---

# 16. Squid 對 fish 的反應

不追逐。

只允許：
- orientation glance
- slight posture response
- fin amplitude 微升

可定義 fish centroid：

```math
P_f=
\frac{1}{N}\sum_i p_i
```

squid target gaze：

```math
d_g=
normalize(P_f-p_{sq})
```

orientation blend：

```math
d'=
slerp(
d_{current},
d_g,
\beta_g
)
```

```yaml
beta_g: 0.02-0.08
```

很弱。

---

# 17. 種間近距離事件

## `SQUID_SILVERFISH_NEAR_PASS`

流程：

1. silverfish school 正常 transit
2. 其中一隻 squid 剛好位於 route 旁
3. fish 在 `r_outer` 開始輕微分流
4. 經過 squid 時 school shape 變寬
5. 通過後重新 cohesion
6. squid 只微微轉向

**不要：**
- squid 追魚
- fish 爆炸式逃跑
- predator-prey 戲劇化

---

# 18. Fish split deformation

當 squid 接近群中心：

school lateral variance：

```math
\sigma_{lat}'=
\sigma_{lat}
\left[
1+
k_sg(d)
\right]
```

其中：

```math
k_sg(d)=
k_{max}g(d)
```

推薦：

```yaml
k_max: 0.15-0.40
```

形成：
- 稍微分流
- 不是整群裂成兩半的特效

---

# 19. Fish regrouping

通過後：

```math
\frac{d\sigma}{dt}
=
-\frac{
\sigma-\sigma_0
}{
\tau_{regroup}
}
```

```yaml
tau_regroup_s: 1.5-4.0
```

---

# 20. Light interaction

## Squid
可見度受：
- Fresnel
- light field
- transparency
- orientation

## Fish
亮度主要受：
- specular
- side orientation
- light intensity

---

# 21. Silverflash

魚群反光 event 可自然出現。

每條魚：

```math
B_i=
L(p_i)
\cdot
S_i
\cdot
M_i
```

其中：
- `S_i`：specular geometry response
- `M_i`：micro variation

群體亮度：

```math
B_{school}
=
\sum_i B_i
```

不要直接對整群加 emission pulse。

---

# 22. Window crossing choreography

主要銀魚群事件：

### Phase 1 — emergence
```yaml
duration_s: 1.5-3.5
```

- 暗部先出現少數高光
- school 尚未完整可見

### Phase 2 — approach
```yaml
duration_s: 1.0-2.5
```

- cohesion 稍增
- speed 稍升

### Phase 3 — light crossing
```yaml
duration_s: 2.0-5.0
```

- specular 最明顯
- school scale 壓縮 10–20%

### Phase 4 — exit
```yaml
duration_s: 1.5-3.0
```

- cohesion 放鬆
- 光線下降
- 群體融入黑暗

---

# 23. Empty phases

空白不是 bug。

scheduler 必須可主動產生：

```yaml
LONG_EMPTY_PHASE
```

期間：
- squid 可能仍在暗部
- 但不觸發 major event
- fish school 不出現

---

# 24. Rare-event budget

一個 10 分鐘 session：

```yaml
expected_major_events: 2-5
expected_silverfish_events: 2-6
expected_squid_visible_approaches: 4-10
expected_close_species_interactions: 0-2
```

不是 KPI。
只是避免事件密度失控。

---

# 25. Seeded randomness

一定要支援：

```ts
sceneSeed: number
```

所有：

- event timing
- squid wander
- fish phase
- route choice
- rare event
- school size

由 seed 派生。

目的：
- debug 可重現
- 可生成不同 session
- QA 可比較

---

# 26. Random stream 分離

不要全部共用同一 RNG。

```text
rng_event
rng_squid_1
rng_squid_2
rng_squid_3
rng_school
rng_material
```

避免：
改了某隻 squid 的行為，
整個 scene scheduler timing 也跟著變。

---

# 27. 時間尺度

推薦：

```yaml
simulation_fixed_dt: 1/60 or 1/90
render_dt: variable
```

行為：
- fixed timestep
- interpolation render

避免不同 FPS 導致：
- boids 密度不同
- jet timing 不同
- school instability

---

# 28. LOD

## Squid
2–3 隻，不需要大量 LOD。
但可有：
- full rig
- simplified distant material

## Silverfish
建議：

```yaml
near:
  skinned_mesh: true

mid:
  reduced_bones: true

far:
  vertex_shader_body_wave: true
```

魚群 30 隻不應需要 30 套高成本 full rig。

---

# 29. Three.js data model

```ts
type SceneBioSystem = {
  seed: number
  time: number
  lightField: LightField
  squids: SquidAgent[]
  schools: SilverfishSchool[]
  scheduler: EventScheduler
  activeEvents: BioEvent[]
}
```

---

# 30. Scheduler structure

```ts
type BioEventType =
  | "SQUID_APPROACH_LIGHT"
  | "SQUID_CROSS_CORRIDOR"
  | "SILVERFISH_SMALL_TRANSIT"
  | "SILVERFISH_MAIN_TRANSIT"
  | "SQUID_SILVERFISH_NEAR_PASS"
  | "LONG_EMPTY_PHASE"
```

每個 event：

```ts
type BioEvent = {
  type: BioEventType
  startTime: number
  duration: number
  state: "QUEUED" | "ACTIVE" | "ENDING" | "DONE"
  seed: number
}
```

---

# 31. State transitions

不要瞬間切狀態。

所有 state transition：

```math
w(t)
=
smoothstep(0,1,\tau)
```

或者：

```math
w(t)=
3\tau^2-2\tau^3
```

`\tau` normalized 0–1。

---

# 32. Debug overlay

Codex 必須提供可開關 debug view：

```yaml
debug:
  show_nav_volume: true/false
  show_light_field: true/false
  show_school_centroid: true/false
  show_neighbor_radius: true/false
  show_squid_targets: true/false
  show_event_state: true/false
  show_avoidance_vectors: true/false
```

production 預設全 false。

---

# 33. Logging

每個 major event 記錄：

```json
{
  "event": "SILVERFISH_MAIN_TRANSIT",
  "start": 123.4,
  "duration": 9.2,
  "schoolSize": 22,
  "routeSeed": 7712,
  "lightPeak": 0.71
}
```

Squid jet：

```json
{
  "agent": "squid_B",
  "event": "MICRO_JET_REPOSITION",
  "time": 238.8,
  "magnitude": 0.63
}
```

---

# 34. Performance budget

目標 desktop：

```yaml
fps_target: 60
silverfish_normal_max: 30
silverfish_rare_max: 50
squid_max: 3
```

若 shader / transparency 成本過高：
優先降低：
1. 遠距 fish bone count
2. transparency layers
3. shadow casting
4. caustic-like effects

不要降低：
- temporal smoothness
- event timing quality
- spatial avoidance

---

# 35. Shadow policy

## Squid
- 可不 cast hard shadow
- 可有 extremely soft contribution
- 透明材質避免複雜 shadow map artifact

## Silverfish
- 不需要每條魚獨立明顯 shadow
- 如必要只做非常弱接觸陰影

---

# 36. Camera interaction

生物不可一直靠 camera。

camera exclusion：

```math
d_{camera}>r_{cam}
```

```yaml
squid_camera_radius: 1.5-2.5 body_lengths
fish_camera_radius: 0.8-1.5 body_lengths
```

除非未來設計 special rare event。

---

# 37. 不可出現的效果

- 魚群繞圈 loop
- squid 三隻排隊
- squid 固定停窗前
- fish 反覆同一路徑
- 所有生物同時進場
- species interaction 像 chase scene
- synchronized turns
- synchronized flashing
- neon emission
- constant motion

---

# 38. QA Session

每次至少跑：

```yaml
qa_duration_minutes: 10
seeds_to_test: 10
```

檢查：
- 是否有 long empty phases
- 是否 major events 過多
- fish 是否穿牆
- squid 是否進 brightest zone 太久
- 是否有重複 pattern
- 是否出現過度同步

---

# 39. 量化 QA 指標

可記：

```yaml
visible_major_event_ratio_target: 0.10-0.30
empty_ratio_target: 0.55-0.80
squid_bright_zone_occupancy_target: <0.12
silverfish_mean_school_size_target: 14-28
species_close_interaction_per_10min_target: 0-2
```

這些是作品節奏指標，不是生物學指標。

---

# 40. 視覺驗收問題

每次看 10 分鐘後問：

1. 我是否感覺「生物在這裡生活」，而不是「系統在播放動畫」？
2. 空間本身是否仍然比生物更重要？
3. 生物消失後，畫面是否仍然成立？
4. 銀魚群出現時是否像一陣短暫的銀色流動？
5. squid 是否像透明深海生命，而不是 fantasy creature？
6. 有沒有任何明顯重複 loop？
7. 有沒有「在對觀眾表演」的感覺？

任何一題答案不理想：
**先減少事件或動作。**

---

# 41. 建議實作順序

## Milestone 1
- corridor nav volume
- light field
- one squid
- slow cruise

## Milestone 2
- 3 squid
- squid state machine
- arms secondary motion

## Milestone 3
- 12 silverfish
- body wave
- basic boids

## Milestone 4
- school transit event
- light crossing response

## Milestone 5
- squid-fish avoidance
- rare near-pass event

## Milestone 6
- stochastic scheduler
- seeded randomness
- QA metrics

---

# 42. Definition of Done

系統完成需同時達成：

- [ ] 2–3 隻 Galiteuthis 可長時間自然存在
- [ ] silverfish school 可 10 分鐘不出現明顯重複
- [ ] 事件由 stochastic scheduler 驅動
- [ ] 生物不穿牆
- [ ] 沒有固定巡邏 spline 感
- [ ] 沒有 aquarium-show 感
- [ ] 支援 seed
- [ ] 支援 debug overlay
- [ ] 支援 config tuning
- [ ] 不需重新改 code 就能調整事件密度
- [ ] 光線主導生物可見度
- [ ] 生物只是作品中的生命層，不是 UI feature

---

# 43. 專案總結

這個場景的優先級是：

```text
Space
> Light
> Silence
> Creature presence
> Creature motion
> Rare interaction
```

永遠不要反過來。

當你不知道要不要加一個動作時：

> 預設不要加

當你覺得畫面太空時：

> 先檢查光、雪、材質與空間層次  
> 再考慮增加生物事件
