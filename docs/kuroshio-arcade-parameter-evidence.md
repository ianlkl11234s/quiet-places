# 黑潮生物：參數與證據

2026-09-16。需求原文：[v1 任務書](biology/references/kuroshio-arcade-spec-v1.md)。本表區分自然史來源、動畫選擇與已驗證程式，不能將任務書的全部數值視為研究實測。

## 核實來源

- **M1** [Fish et al. 2018](https://journals.biologists.com/jeb/article/221/6/jeb166041/20833/Kinematics-of-swimming-of-the-manta-ray-three)：原文公開頁可取得。研究使用開放水域 stereo video；所報胸鰭頻率0.32±0.11Hz。這是觀測樣本，不代表每隻鬼蝠魟都用相同頻率。
- **W1** [Meekan et al. 2015](https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2015.00064/full)：核對 Results：主動游動平均0.58–0.81m/s、頻率中位0.35–0.65Hz、滑行中位時間5–20s。水下滑行比例10.6–17.6%有其深度與個體條件；不能直接當空中生物的浮力解算。
- **A1** 沖繩美麗海官方圖鑑：[大鬼蝠魟](https://churaumi.okinawa/sp/tc/fishbook/1543394214/)、[鯨鯊](https://churaumi.okinawa/tc/fishbook/00000510/)、[Chromis](https://churaumi.okinawa/tc/fishbook/00000080/)、[雙帶烏尾鮗](https://churaumi.okinawa/tc/fishbook/00000523/)。用於物種名稱與形態參考，未下載或重用照片／貼圖。
- 任務書的 Chromis 成年SL、相關物種 Ucrit、社交行為原始論文未全部重新核對，這些數值不能標成此次已驗證 `SOURCE_MEASURED`。成對關聯採保守藝術行為，不稱為玩耍／求偶。

- **M2** [Marshall et al. 2008](https://www.mapress.com/zt/article/view/zootaxa.1717.1.2)：南非3尾未成熟個體DW2230–2370mm；由Table1推得盤長/翼展約.422–.453、厚度/翼展.084–.112、嘴寬/翼展.139–.156。5.1–5.8m模型採比例外推，並非成體掃描或成長模型。
- **M3** [Manta Trust物種指南](https://www.mantatrust.org/mobula-birostris)：用於肩部白三角與黑T、腹後斑點、暗色嘴與頭鰭內側、尾根隆起等辨識特徵。尺寸依[幾何任務書](biology/references/giant-manta-geometry-spec-v1.md)；附圖的嘴寬25–30%與厚度W/5–7未採用，避免與文字規格衝突。

## 標記

`SOURCE_MEASURED` 原文物種量測；`SOURCE_RELATED_SPECIES` 相關物種推論；`DERIVED_FROM_FORMULA` 數學推導；`ART_DIRECTION` 畫面設計；`IMPLEMENTATION_PRIOR` 演算法／穩定性設定。資料不足明記，不補造實測。

## 目前實作參數

數值權威：`src/places/last-arcade/biology/Motion.ts`、各 `src/creatures/*`、`src/systems/schooling/index.ts`。時間秒、空間公尺、相位弧度，debug bank輸出度。

| 參數 | 目前設定 | evidence | 依據／限制 |
|---|---|---|---|
| Manta A/B/C 翼展 | 5.8 / 5.4 / 5.1 m | ART_DIRECTION | 任務書個體設定，不是實測模型 |
| 盤長／中央厚度 | 約 .43W／.095W | DERIVED_FROM_MEASURED_RATIO / ANATOMICAL_PROXY | 依幾何v1規格，M2幼體量測比例外推；不是成體固定比例 |
| Manta 巡航均值 | 1.02 / 1.09 / .97 m/s | ART_DIRECTION | 任務書慢速情境；OU變化，限制.8–1.3 |
| Manta 拍翼基準 | .288 / .309 / .294 Hz | ART_DIRECTION | 受M1範圍約束；OU限制.23–.36，滑行時降低 |
| Manta OU | θ=.15、σ=.015；速度θ=.25、σ=.05 | IMPLEMENTATION_PRIOR | fixed20Hz seeded Gaussian increments |
| 胸鰭波 | .115W × 外翼比例^1.55；chord lag .42π | ART_DIRECTION | 中央固定，外翼最末14%相位收斂至同一尖端；非流固耦合 |
| Manta glide | 每完成循環24%機率；.4–1.6s | ART_DIRECTION | M1提供節律方向，機率是設計 |
| Bank | curvature × speed²，最多50° | DERIVED_FROM_FORMULA / ART_DIRECTION | controller映射，不宣稱物種精確轉彎回歸 |
| 外／內翼 | asymmetry最多±.26，即約1.70比 | ART_DIRECTION | 只改垂直行程，不擴張翼展 |
| Pair | 15–35s，平均hazard125s，加75s冷卻／鄰近條件 | IMPLEMENTATION_PRIOR | 弱相位／間距影響，不保證固定發生間隔 |
| Low pass | B最低約2.9m；道路中線X6.15m | ART_DIRECTION | 棚架／電線淨空優先，低空前後需要長轉場 |
| 鯨鯊長度 | 8.5m（含尾） | ART_DIRECTION | 任務書尺度；原創程序loft |
| 鯨鯊速度 | OU均值.68，限制.55–.8m/s | ART_DIRECTION | 由W1提供速度範圍參考 |
| 鯨鯊頻率 | .38Hz，OU限制.32–.48 | ART_DIRECTION | species-specific cadence優先 |
| 鯨鯊尾幅 | 約.11L單側，glide降至18% | ART_DIRECTION | 與St=.24–.34不能全部同時滿足，見下 |
| 鯨鯊 glide | 4–14s，hazard45s＋30s冷卻；ramp1.1s | ART_DIRECTION | 實際比例以audit計算，不聲稱固定8–15% |
| 鯨鯊基本迴游 | 水平半徑32×28m，高度14.5m±變化 | ART_DIRECTION | 600s測試最小平面曲率半徑約23.7m |
| 鯨鯊 route switch | 兩條共享接點／切線的寬廣spline，加高度換層 | IMPLEMENTATION_PRIOR | 事件先排程，到共享接點才切换，保留弧長速度 |
| Chromis | 100隻，.035–.055m | ART_DIRECTION | 依任務書；SL/全長不混稱量測 |
| Fusilier | 50隻，.18–.28m | ART_DIRECTION | 依任務書 |
| 小魚群 | 12Hz行為、render插值、InstancedMesh | IMPLEMENTATION_PRIOR | 局部repulsion/alignment/attraction、實際AABB代理避障 |
| 小魚尾拍 | St×速度／peak-to-peak幅度 | DERIVED_FROM_FORMULA | St值來自任務書先驗，非兩物種新量測 |
| 全部RNG | seeded，個體／群體獨立種子 | IMPLEMENTATION_PRIOR | 不讀系統時鐘決定行為 |
| 虛擬流場 | analytic divergence-free field | DERIVED_FROM_FORMULA / ART_DIRECTION | 只影響生物路徑，不改空氣渲染 |
| PBR | 非金屬，roughness約.5 | ART_DIRECTION | 不是皮膚BRDF量測 |

## 任務書內的衝突如何處理

1. **鯨鯊的速度／尺度／一圈時間**：32×28m的軌道周長約189m，以.68m/s需約278s。若硬塞進100–220s會超出設定速度，因此保留速度、大轉彎，讓一圈更長。
2. **尾幅／頻率／Strouhal**：8.5m、.11L單側、.38Hz與.68m/s推得St約1.04，不在.24–.34。本版依任務書優先保留物種cadence與可讀尾幅，明列衝突，不能宣稱同時達成高效率St。
3. **低空8–18s**：只能作為眼前低空段目標，不能涵蓋從9m降下、穿街、繞開電線再回升的全部時間。當次完整繞行約3分鐘，部份時間在遠處；不得加速／瞬移以縮短。
4. **座標**：現有街景朝海是Three -Z，沿用既有契約；沒有為了任務書建議的+Z把建築／鏡頭翻轉。生物自身前向+Z，群魚本體以各模組前向為準。
