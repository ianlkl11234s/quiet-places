# 潮風商店街 × 黑潮生物

## 2026-09-16 晚間復原

本頁初版製作決策從原對話紀錄還原；目前程式已恢復最後一轮Manta形態與柔化魚群。最新驗收以 [復原記錄](../exports/last-arcade-recovery/README.md) 為準，舊版驗收不自動算作本輪通過。

## 初版狀態（歷史）

2026-09-16，本機候選。暮色基準已提交 `50cfcf8`；本輪生物新增尚未提交／發布。場景保留乾燥空氣、自然日照、原建築與使用者相機。規格來源：[使用者 v1](biology/references/kuroshio-arcade-spec-v1.md)。生物形態是原創程序造型，不宣稱是掃描或完整生物力學求解。

## 已接入

- 三隻 `Mobula birostris`：5.8、5.4、5.1m翼展，各有獨立種子、背腹花紋、速度與拍翼。真實厚度網格、翼根到翼尖行進波、腹側鰓裂、捲曲頭鰭與細尾；近／中／遠LOD。
- 一隻8.5m `Rhincodon typus`：寬扁頭、前口、五對鰓裂、三條隆脊、前後背鰭、胸鰭與半月尾。原創截面loft、斑點／條帶、後半身側向波；三層LOD。
- 100隻 `Chromis viridis` 與50隻 `Pterocaesio digramma`：instancing、個體相位、兩種群游傾向、遮蔽物代理、障礙預測與群體量測。

## 入口與責任

| 路徑 | 責任 |
|---|---|
| `src/creatures/manta/` | 本體幾何、材質、局部拍翼、LOD、釋放 |
| `src/creatures/whale-shark/` | 本體截面、花紋、局部身體波、LOD |
| `src/creatures/chromis/`、`fusilier/` | 小魚實例網格及頂點動作 |
| `src/systems/schooling/` | 12Hz群游、插值、seed、事件、SDF代理避障 |
| `src/systems/virtual-flow/` | 可重現低頻curl場 |
| `src/places/last-arcade/biology/Motion.ts` | 20Hz大型生物路徑、弧長、OU速度、glide、bank、pair與低空事件 |
| `src/places/last-arcade/biology/Obstacles.ts` | 從現有建築生成腳本轉寫的39個保守障礙代理 |
| `src/places/last-arcade/biology/index.ts` | 場景adapter；使用播放器elapsed，不建立額外RAF |
| `tools/kuroshio-biology/` | 原模型近照／背腹灰模、正式場景、debug、5分鐘錄影／10分鐘觀測 |
| `scripts/kuroshio-audit.mjs` | 600s幾何抽樣、參數範圍與事件證據 |

## 規劃階段與實作決策

1. **Anatomy**：先看獨立近照。曾拒絕過長的manta盤體、漂浮鰓裂／尾根、鯨鯊浮起的背脊；修正附著座標後才接正式場景。`exports/last-arcade-biology/` 保存近照。這是主agent的基本形態檢查，使用者美術確認仍待回饋。
2. **單體運動**：相位由頻率積分，不把可變f直接乘總時間。根部姿態由路徑切線、曲率與平滑quaternion決定。Manta glide保留上反角；whale glide振幅平滑衰減。
3. **路徑**：8192段弧長表、速度積分、不同個體offset。Pair須先鄰近，短暫弱耦合後釋放；低空前完整路徑以膨脹身體包絡抽樣，電線下方到兩端外才爬升。鯨鯊兩條寬廣spline共享接點切線，排程到接點再換圈。
4. **魚群**：鄰居使用同一幀快照，避免逐魚順序偏差；排斥、對齊、凝聚加上群體方向，近障礙使用SDF法向與切向滑行。各魚模型真實尺度，小魚遠看不保證每隻可辨識。
5. **整合**：大型生物使用同一變形網格投影，暫停後影子不自行前進。小魚不逐隻投影。LOD以相機距離自動切換。

## 光、建模來源與Blender邊界

建築仍由既有Blender母檔／GLB提供。本轮生物以Three BufferGeometry建模，TypeScript就是可重建來源，未冒稱新增Blender骨架母檔。CPU變形讓陰影pass讀同一形體；小魚採GPU實例變形。未使用外部照片、貼圖或商用模型資產。

光線直接沿用商店街PBR、天空與日光。沒有新增水下霧、氣泡、粒子或全街caustics。目前共用shadow map軟化，大型個體的陰影不是高度相依面光penumbra解算；鯨鯊專用更淡更散影子尚未獨立建立。

## 驗收方式

- `node --experimental-strip-types --test tests/kuroshio-motion.test.ts tests/kuroshio-schools.test.ts tests/last-arcade.test.ts`。
- `node --experimental-strip-types scripts/kuroshio-audit.mjs`：600s、每0.5s用實際變形後mesh頂點對39個建築代理。這不是連續三角形碰撞證明；細節超出代理時仍需目視。
- `/tools/kuroshio-biology/`：模型近照／灰模，播放debug；「開始10分鐘驗收」保留1Hz診斷、frame time、resource數量，前300s錄WebM。只把真正取得的檔案列為完成證據。
- Build、check:project及browser獨立記錄；未做手機實機／發熱／電量驗收。

## 尚屬美術／近似的部分

所有空中游動、事件機率、路徑與SDF代理、身體比例微調、花紋種子、皮膚材質、3D社交路線屬設計。Manta社交不是經物種實驗證實的玩耍。鯨鯊頻率／振幅／Strouhal衝突與低空路徑時間延長詳見[參數證據表](kuroshio-arcade-parameter-evidence.md)。

近距表皮、複雜鰭肌肉、流體浮力與尾渦沒有解算。群體指標在避障、转向、受擾時可離開正常游動目標區間；量測值需連同狀態解讀，不能拿挑選的一幀宣稱全部時間達標。


## 後續鬼蝠魟幾何修訂

使用者要求更接近實際外形；新版來源、尺寸與驗收集中至[鬼蝠魟模型頁](biology/kuroshio-manta-model.md)。`exports/last-arcade-biology/` 為初版記錄；此次證據位於 `exports/last-arcade-manta-geometry/`，不以舊截圖或舊10分鐘錄影代表新版。檢查工具新增正交、中性姿態與正面／頭部視角。


### 復原驗收完成

2026-09-16：159 tests、build、check:project 與 17 項 browser GPU 檢查通過。大型生物及魚群各 600 秒抽樣無建築穿入。固定 `.worktrees/last-arcade-recovery` 提供 5186 預覽；詳見 `exports/last-arcade-recovery/README.md`。未 commit／發布。
