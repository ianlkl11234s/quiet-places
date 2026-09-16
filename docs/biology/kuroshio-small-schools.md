# 藍綠光鰓雀鯛與雙帶烏尾鮗群游

## 狀態與範圍

- 本體入口：`src/creatures/chromis/`、`src/creatures/fusilier/`；群游控制器：`src/systems/schooling/`。
- 已接入 `last-arcade` runtime；2026-09-17 最新分布為招牌旁與遠處門腳兩群小魚，較大魚群沿柱內外巡游並偶爾遠行。下方早期路域數字保留為歷史，最新参数以 schooling/index.ts 與末尾更新為準。

## 生物事實與美術近似

- `Chromis viridis` 為 0.035–0.055 m 小型、側扁、淺藍綠雀鯛；以兩個植物／店面邊角 shelter proxy 形成鬆散群。低速以較小的尾擺表示胸鰭巡航近似。
- `Pterocaesio digramma` 為 0.18–0.28 m 細長紡錘形魚；主色為藍，細低飽和金帶與深色尾端。road volume 是 X 4.5–7.5、Y 1–2.6、Z -2 至 -28 m 的美術導航範圍。
- 尺度、速度和 Strouhal 耦合依任務書第 19–29 節。這是程序動畫校準，非物理流體或物種游速實測重建。

## 製作與轉換

- Three.js Y-up，模型前向為 local `-Z`。100 Chromis 與 50 Fusilier 以 `InstancedMesh` 畫出；小魚不投影、不接收陰影。
- 每隻有 seed 相位、長度與 shader 尾擺 attribute。fixed simulation 為 12 Hz；render 使用前後狀態插值，尾相位由固定步進積分，暫停時同一 elapsed 不前進。
- AABB 以 SDF 距離、表面法線推力及切向滑移近似避障。這避免以瞬間傳送跨越柱子；實際建物 proxy 須由場景 adapter 提供。

## 驗收與缺口

- `tests/kuroshio-schools.test.ts` 涵蓋 600 秒 seeded replay、同 elapsed 暫停、pool size 與 debug 指標，並直接使用 `arcadeObstacles()` fixture 驗證 60 個十秒窗內沒有中心點 body penetration。debug 保留每隻 position、heading、體長、相位與速度供後續稽核。
- 該 fixture、seed `917` 的分窗 median nearest-neighbor：Chromis `1.46–1.66 BL`、Fusilier `1.23–1.44 BL`，落於指定密度帶。Chromis polarization 仍有 `0.22–0.81` 的寬幅，Fusilier 為 `0.32–0.91`；這是固定 route 轉向與稀有事件的分窗結果，尚未完成視覺品質驗收。
- 尚未做實際 GLB／WebGL／視覺品質驗收，也未核實物種形態來源的授權；stub geometry 是原創程序近似。


## 2026-09-16 魚群靠近走廊（待使用者確認）

使用者反映原魚群過遠。沿用模型尺寸、數量、低速與平順姿態；只調整 `src/systems/schooling/index.ts` 的分布及路徑吸引力。

- Chromis 三個停留點移至 (0.95,1.55,-2.2)、(1.45,1.75,-4.6)、(2.1,1.55,-7.8) m，出現在近處店面與柱間。
- Fusilier 目標環線中心 (2.75,1.7,-5)m，水平半徑 X=1.3、Z=3m，角速度 0.045 rad/s；在走廊與路側之間往返。這是群游引導路線，個體會偏移，非剛性軌道。
- 初始魚群位於走廊內，縮小初始散布；降低切線引導、增加回到環線的吸引，避免長期漂至遠處道路。保留逐步避障、欄杆／柱子／店面 proxy。
- 本輪 600 秒 seed91626：Fusilier 1068 次穿越柱列 X=2.82 平面（不是穿入柱體）；約82%抽樣時間至少一隻在相機5m內；兩群建築穿入計數0。這是抽樣 proxy 驗證，非連續 mesh 碰撞證明。
- 五項 schooling tests 通過（含另seed600秒、插值、暫停、轉速／俯仰限制）；瀏覽器暮色實際看到近處店面小魚及柱間大魚，未捕獲console error。證據 `exports/last-arcade-recovery/corridor-audit.json`、`corridor-dusk.png`；改前程式 `schooling-before-corridor.ts`。
- 同一固定 recovery worktree 與 5186 網址；未 commit／發布。


## 2026-09-17 生物間距、可見性與群聚位置（本機候選）

- 需求：鬼蝠魟不能互穿、鯨鯊能被看見；小魚分成招牌旁與遠處門腳兩群；大魚群保留近游並偶爾遠行。招牌使用「ミグ商店」，細節見本頁招牌紀錄。
- `Motion.ts`：Manta 起始路徑比例改為 .12/.43/.76，先錯開通行時序；接近時提早降速，並以半徑4.5/4.2/4.0m（Manta）、5.2m（Whale）的球體檢查每步相對掃掠線段。安全範圍包含24組相位／滑行／左右翼差異的模型全部LOD頂點。球體仍為保守近似，不是生物形狀的精確碰撞網格。
- 900秒固定20Hz驗收涵蓋低空通過及回返；安全球外緣最小餘裕約0.35m；僅1個個體步進速度低於0.01m/s，沒有持續卡住。15分鐘路徑／速度測試通過，不把前後自然遮擋當作身體相交。
- Whale 改在海側寬環線：中心(5.8,3,-65)m，半徑25m，近端約Z=-40m；初始比例.98讓開場即可通過遠端開口。高度波幅.25m、緩慢高度目標±.15m；模型維持8.5m。此處是可見性與建築避障的美術路線，不是野外行為實測。
- `schooling/index.ts`：100 Chromis 分成兩組，各有個別home偏移与低頻、不同相位的小幅游移。中心約(1.43,2.22,-4.12)m（招牌右下）及(.78,.55,-10.8)m（遠處鐵門腳）；收縮事件向各自home收束，避免兩組突然奔向同一中心。
- Fusilier 沿用近處巡游，增加約286秒的平滑遠行包絡，最大額外X+1.1m、Z-5m；速度與轉向上限保留。這是目標路線，個體位置會因群游與避障偏移。
- Browser 實際確認「ミグ商店」、招牌小魚、遠處門腳小魚與鯨鯊出現在雨棚下方的街尾開口。證據 `exports/last-arcade-recovery/placement-whale-visible.png`。
- 驗收與限制：schooling 5項（含600秒）及motion 3項（含900秒與形變包絡）通過；900秒建築頂點抽樣、build、check:project與browser GPU另存同目錄。本機候選，未commit／發布／實機驗收。

低空回程在街尾Z=-25m後爬升，X由6.15收至約5.95m以避開電線橫臂；A/C巡航個體則在28m內開始平滑升高讓出B的回程走廊（最多6m、8秒平滑）。安全優先，未保留原本可能導致相遇卡住的回程高度。


## 2026-09-17 街道生物互動與小魚陰影（本機候選）

- 需求：鬼蝠魟低空進入街道時，魚群往走廊躲避；陰影下的魚要和周圍受光一致。
- 互動入口：`src/places/last-arcade/biology/index.ts` 提供同一 `ArcadeAnimalMotion` 公式的獨立固定步進取樣器，給 `schooling/index.ts` 每12Hz取樣。避免以當前render frame的位置驅動所有過去步進，也保持時間重置可重現。
- 警戒為美術行為近似：高度6m內的Manta，沿未來8秒速度方向預測靠近；相對體半徑之外1–6m形成平滑警戒。每隻魚1.2秒逐漸反應、12秒釋放；小魚靠各自原停留點退縮，Fusilier往柱間缺口後方的走廊內退避。每隻避難點不同，保留避柱、轉向及速度平滑；退避時最高基準速度倍率1.5，無瞬移。沒有把藝術反應描述為物種實測。
- 兩魚模型原本 `receiveShadow=false`，造成棚下仍吃到太陽直射；現已開啟body/fins/eyes/stripes的陰影接收。沿用既有Standard PBR材質、原色及場景日光／天空／反射光，未用emissive補亮。尾部變形在Three project_vertex/shadowmap_vertex前，因此接收陰影座標隨形變一致。
- 小魚仍不投射自己的陰影；天空與地面反射仍為原場景環境光近似，未新增完整GI／物理流體。
- 驗收：synthetic通過事件有41/50隻在40秒進柱內（無威脅對照7/50）；警戒解除後回到巡游。兩項互動測試與兩項材質／shader陰影測試通過；另5項既有schooling測試通過。固定步進重播比較允許1e-9內插值餘數，魚的模擬狀態完全一致。
- 實際adapter900秒抽樣建築穿入0；828秒browser畫面47/50隻在柱內，836秒略向道路轉頭可同時看到低空Manta與走廊魚群。`exports/last-arcade-recovery/encounter-review.html?time=836&road=1` 可直接播放該時刻後30秒；它使用正式場景與正式controller，不是合成動畫。
- Browser陰影、變形與pause檢查／build／check:project通過；未做實機驗收、未commit／發布。證據在 `exports/last-arcade-recovery/encounter-*`。
