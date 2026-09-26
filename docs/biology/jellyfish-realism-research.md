# 海月水母擬真度研究：像在水族館觀察到的活體（2026-09-27）

## 摘要

1. 問題主要出在外觀，不在運動參數。真實 Aurelia 的傘體無色；放射管、生殖腺與口腕只是淡淡的藕紫／粉色調，沒有白色硬線或不透明的圈。
2. 水族館裡水母看起來「活」，關鍵在打光。暗背景加側光的暗視野照明，讓組織靠散射在邊緣發亮，而不是靠材質本身變白。
3. 頻率 .34–.44 Hz 落在文獻觀察範圍內，可以保留。收縮段 30% 偏長，文獻約 20%。
4. 目前角速度上限 8°/s，加上姿態一律朝上，是「飛碟感」的主因。文獻顯示轉向是「不對稱收縮加上滑移」，每拍可轉數十度（模型值）。
5. 現有流速上限 0.93 cm/s，量級其實不離譜。問題在於畫面裡沒有任何示蹤物，觀者看不到水在動。
6. 流場可視化首選「只在光束內可見的 marine snow，沿同一流場平流，並接收水母尾流的擾動」。這個做法同時滿足三點：不發光、只在受光處可見、不增加第二個不可能現象。
7. 找不到 kreisel 水槽流速的公開標準值。以下凡是查不到的地方都會標明。

## 現況 vs 建議

| 項目 | 現況 | 建議 | 等級 | 難度 |
|---|---|---|---|---|
| 傘體 | `#dbe4e6`、opacity .42、transmission .72 | 近無色，主要靠 fresnel 邊緣和背側散射成形；中央更透明 | A 形態／C 參數 | 低 |
| 放射管 | 16+16 條白色 tube，半徑 .006R | 改為貼在下傘面的淡色帶，寬度隨半徑遞減，只在掠射光下可見；取消實體 tube | A 顏色／C 寬度 | 中 |
| 生殖腺 | `#cfb7c6` opacity .72，像實心圈 | 半透明藕紫色、邊緣柔化，內部加摺疊紋理 | A | 中 |
| 脈動時序 | 收縮 .30／舒張 .45／滑行 .25 | 收縮 ≈.20，舒張與停頓延長 | A | 低 |
| 姿態 | desired 以 +Y 為主，角速度上限 .1396 rad/s | 允許 0–35° 常態傾斜；轉向脈衝時上限放到 ~.4 rad/s，並加入被動 restoring | A 機制／B 數值 | 中 |
| 水流 | 3 個正弦模態，上限 .0093 m/s | 量級維持 0.5–2 cm/s，重點改成「讓它看得見」；水母尾流以單向耦合加入 | A 量級／B 模型 | 中 |
| 附肢 | PBD 跟隨相對流速 | 同一個取樣函式同時接收背景流和尾流，口腕延遲約 1/4 拍 | B | 中 |

## 1. 真實運動（A 為主）

- **頻率**：野外 Aurelia（直徑 9.8–11.3 cm）自發脈動 0.09–0.20 Hz 與 0.40–0.50 Hz；巡航速度 2.1 cm/s，約 **0.19 D/s**（[Xu et al. 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7709697/)）。12–14 cm 成體的自然頻率為 0.24±0.11 Hz，速度在 0.55 Hz 達到峰值（[Yoder & Dabiri 2026, arXiv](https://arxiv.org/html/2604.14491)）。個體越大，頻率越低（[McHenry & Jed 2003](https://journals.biologists.com/jeb/article-abstract/206/22/4125/14117/The-ontogenetic-scaling-of-hydrodynamics-and)）。依此推估，20–30 cm 的個體用 .34–.44 Hz 略偏快，但仍可接受；建議改在 .2–.4 Hz 之間。
- **收縮比例**：一個週期中只有約 20% 需要肌肉收縮。1.5–6 cm 的個體，每拍主動位移 12.7 mm，停頓期 PER 再多 10.1 mm，約占總位移的 32%（[Gemmell 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC3816424/)）。停頓期的 stopping vortex 環量可以大於 starting vortex（同一出處）。
- **轉向**：傘緣兩側不同步收縮，身體中心照原方向直線前進，同時繞中心旋轉，也就是「skid」。兩側不同步的程度大致可以預測轉角（[Costello et al. 2024 摘要](https://docs.rwu.edu/fcas_fp/1045/)）。在共振激發條件下，數值模型每拍平均轉 41.4°，內外側渦環的不對稱可達 34 倍（[Hoover et al. 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC7980403/)）。41.4° 是模型值，不是自然行為的平均值；但它說明現有 8°/s 的上限明顯過低。
- **姿態分布**：八個 rhopalia 內含平衡囊（statocyst），負責翻正反射（[Rhopalium](https://en.wikipedia.org/wiki/Rhopalium)，二手來源）。水族館中傾斜或翻轉的比例：**查無可靠統計**。kreisel 水槽的設計本身就讓水母在流中持續慢慢翻轉（[Gensou](https://gensou.sg/jellyfish-tank-setup-guide/)，商業來源，C 級）。
- **靜止下沉與碰到水流**：停拍後下沉速度 **查無可靠數值**。水母在 ±0.5–4.5 cm/s 的水流中，脈動頻率不變，只有游速改變（[Malul 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6937341/)；對象是根口水母，不是 Aurelia）。
- **口腕與觸手**：舒張時，傘下的 stopping vortex 會把水推過觸手與口腕，這是 Aurelia 攝食的機制（[Costello & Colin 1994](https://link.springer.com/article/10.1007/BF00346741)；[Villanueva 2014](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0098310)）。傘緣收縮與舒張走不同路徑；可撓區約占外傘輪廓的 17%。附肢延遲幾分之幾拍：**查無量測**，建議視為 B 級近似。

## 2. 水族館外觀

- MarLIN 記載：「umbrella is colourless」；放射管、口腕與生殖腺為「mauve, violet, reddish, pink or yellowish」（[MarLIN](https://www.marlin.ac.uk/species/detail/2089)）。所以目前的白色放射管和白色生殖腺，方向是錯的。
- 打光：研究用 kreisel 採「matte black back plate + side lighting」，達到 dark-field illumination；展示用則是背光的藍白半透壓克力，加上側面聚光（[Raskoff et al. 2003, Biol. Bull.](https://zenodo.org/records/16528481)，已讀全文 p.74）。本場景的準則禁止水族箱外觀，因此只能借用「暗背景加單側光」，這剛好和「受光與陰影交界」的構圖原則一致。
- 放射管的實際粗細：**查無可靠的量測數值**。從野外照片的觀察來說（C 級），它們在背光下幾乎看不見，只有在掠射光下才呈現細淡的線條。

## 3. 水族館水流

- kreisel 是圓形水槽，入水沿篩網以層流噴出，形成環流（gyre），讓生物不會碰到壁面與排水口（[Raskoff 2003](https://zenodo.org/records/16528481)；[Quality Marine](https://www.qualitymarine.com/news/keeping-up-with-the-kreisels/)）。
- 流速：**查無公開的標準值**。一種氣提式設計的轉速為每 20 秒到每 4 分鐘轉一圈，可由進氣量調整（[US 8393298](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8393298)）。以直徑約 40 cm 的水槽推算，約為 0.5–6 cm/s（B 級推算）。實驗用流場為 0.5–4.5 cm/s（[Malul 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6937341/)）。

## 4. 即時圖學做法

| 主題 | 做法 | 參考 |
|---|---|---|
| 傘體變形 | 維持現有的 CPU 扇區彈簧；頂點位移可搬進 vertex shader，由 uniform 傳入 8 扇區 response | 現有 `Aurelia.ts`；[holtsetio Aurelia (WebGPU)](https://holtsetio.com/lab/aurelia/) |
| 觸手 | Verlet／PBD 鏈，單向讀取流場：背景流加尾流 | [Jakobsen GDC 2001](https://www.cs.unc.edu/~lin/COMP259/PAPERS/verlet.doc)；[Müller PBD 2007](https://dl.acm.org/doi/10.1016/j.jvcir.2007.01.005)；[arodic/jellyfish](https://github.com/arodic/jellyfish) |
| 半透明組織 | 用 fresnel 做邊緣；用 wrap-light／背光項近似散射；厚度由 vertex 的 r 推得（中央厚、邊緣薄） | [Barré-Brisebois GDC 2011](https://colinbarrebrisebois.com/2011/03/07/gdc-2011-approximating-translucency-for-a-fast-cheap-and-convincing-subsurface-scattering-look/) |
| 排序 | 固定 renderOrder：外傘背面 → 生殖腺 → 下傘面 → 外傘正面；或改用 WBOIT | [McGuire & Bavoil 2013](https://therealmjp.github.io/posts/weighted-blended-oit/) |
| 背景流 | 保留解析無散度模態，再疊一層低頻 curl noise | [Bridson 2007](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf) |
| 尾流 | 每拍在傘下生成兩個 Lagrangian 渦環：收縮時產生 starting ring 往下；舒張時產生 stopping ring，留在傘下。渦環以 Biot–Savart 核心平滑誘導速度，並隨時間衰減 | 機制依 [Gemmell 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC3816424/)；數值屬 B 級 |
| 網格流體 | GPU stable fluids：2D 可行，3D 在手機上成本高 | [Stam 1999](https://dl.acm.org/doi/10.1145/311535.311548)；[GPU Gems 38](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu) |

建議做法是用「解析背景流，加上每隻水母 2–4 個渦環粒子」。只有 3 隻水母時，這樣比 3D grid 便宜很多，而且可以決定性重播。

## 5. 「透明虛擬水流」可視化比較

| 做法 | 準則 | 效能 | 能否看出水母回應 |
|---|---|---|---|
| **A. 光束內 marine snow 平流** | 符合：灰白、不發光，只在光錐內 alpha>0 | 1–3k 點，CPU 或 GPU 平流都便宜 | **最好**：舒張時顆粒被吸入，收縮時被往下推開 |
| B. 光照區細塵 | 符合，但比 A 更細、更不容易看到 | 最低 | 弱，只看得出整體漂移 |
| C. 螢幕空間折射扭曲 | 有風險：容易變成「熱浪」或魔法感，而且等於第二個不可能現象 | 需要多一個 render target，手機成本中等 | 可以看出尾流，但不像水 |
| D. 流線／streakline | **不符合**：屬於可視化圖示，破壞寫實感 | 低 | 資訊量高，只適合 debug 工具 |
| E. 局部體積散射 | 符合的前提是極淡，而且依附在既有光束 | ray-march 成本高 | 間接，只能靠亮度微變 |

**建議**：以 A 為主、B 為輔，兩者使用同一個 `sampleFlow(p,t)`，C 和 E 不採用。顆粒屬於「房間空氣中的微塵」，受光才可見；它們沿著看不見的水流移動，這件事本身就是那一個不可能現象，不需要另外新增。

## 實作分期與驗收

**P1 外觀**（低到中）
- 移除白色 tube；放射管改為下傘面的帶狀 alpha。
- 生殖腺改為藕紫半透明（opacity ≤.35），邊緣柔化。
- 傘體採用 fresnel 加背光散射，並固定 renderOrder。
- 驗收：
  - 正面、側面、逆光三個角度截圖，放射管只在掠射光下可見。
  - 傘體中心的像素亮度低於邊緣。
  - 灰階圖裡沒有純白線條。
  - 由使用者驗收。

**P2 姿態與運動**（中）
- 收縮比例改為 .20，頻率改為 .2–.4 Hz。
- 轉向採扇區不對稱加上 skid，角速度上限約 .4 rad/s。
- 加入 0–35° 的傾斜目標分布，以及被動 restoring。
- 驗收：
  - 用 60 秒 CSV 驗證頻率誤差 <5%。
  - 收縮占比落在 .18–.22。
  - PER 位移占比維持在 25–35%。
  - 傾角直方圖：中位數 8–20°，並有 ≥5% 的時間超過 25°。
  - 單拍轉角 ≤45°。

**P3 流場與耦合**（中）
- 背景流維持 0.5–2 cm/s，加入渦環尾流。
- 觸手與口腕讀取同一個流場。
- 驗收：
  - 散度數值 ≈0。
  - 渦環在 2–3 拍內衰減。
  - 口腕相位落後傘緣 0.15–0.35 拍（B 級目標）。
  - 可決定性重播。

**P4 流場可視化**（中）
- 光錐遮罩下的 marine snow，搭配細塵，兩者都做平流。
- 驗收：
  - 光錐外顆粒的 alpha 為 0。
  - 顆粒沒有色相，也沒有 emission。
  - 水母下方 1D 範圍內，顆粒速度在收縮後有可量測的向下峰值。
  - 手機 FPS 下降不超過 3。
  - 看不出水族箱的感覺（由使用者判斷）。
