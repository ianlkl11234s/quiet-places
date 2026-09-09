# 階光／Stairlight：台北老公寓樓梯間製作規劃

2026-09-08。狀態：提案，名稱與尺寸暫定。使用者要求依提供圖片盡可能還原樓梯間，包含 Blender 建模規劃，先不加魚。原規劃階段僅建立計畫。2026-09-08 已在獨立 worktree 開始 P0/P1，最新實作狀態見文末；仍未烘焙、接入網站或發布。

## 參考與還原範圍

- 使用者圖片：`/var/folders/xx/31tnjmms1710cszccj_tn28c0000gn/T/codex-clipboard-62805320-1505-4f2c-9f91-a10f58acdb9d.png`，1122×1402，約 4:5。暫存路徑可能失效；正式製作時保存私人 reference 副本，不放 public。
- 附圖只作視覺參考；魚不列入模型、陰影或動態。它不是可測量的建築圖，不能由單張圖片證實拍攝地點、年份、材質成分、窗外結構或真實尺寸。
- 優先保留：站在上段樓梯往下看的鏡頭；米黃牆交角；左側低位灰色金屬小門；灰褐色平台及踏階；紅褐回彎扶手、黑色立柱、紅色折線欄杆；左上日光與平台上的長投影。
- 保持乾燥、安靜、有人使用過的空間。首版沒有魚、水、植物、人物或額外裝飾；沒有足夠依據辨識小門用途，僅稱金屬檢修小門。
- 目標是固定主鏡頭的視覺重建，加上小幅視角調整；畫外結構只補足遮擋、光路與有限視差，不延伸成整棟可探索公寓。

## 製作方法與構圖

採 Blender 可編輯建模＋Cycles 對照圖＋PBR/間接光烘焙＋現有 Three.js 播放器。先用完整 3D 灰模驗證空間，不以原圖投影冒充材質；投影會把日光、魚與透視一併黏在表面。

1. 圖片作相機背景，先標記牆角、牆腳線、平台邊、踏階方向、扶手回彎頂點、小門四角和亮斑邊界。用樓梯平行邊與牆面垂直線校正透視；單圖解可能不唯一。
2. 首輪鎖定 1122×1402 主鏡頭。先調相機位置、俯角、焦距和必要的 camera shift，再修局部模型；不藉扭曲牆體掩蓋相機錯誤。
3. 相機站在上方踏階，向下看平台及右側下行梯段。起始垂直 FOV 45–60°、俯角 30–50°，眼高以相機所在踏階上方 1.4–1.7 m 試配；均為搜尋範圍，不是照片測量。
4. 至少補齊前景踏階、轉折平台、右側下降梯段、兩面牆、畫外採光開口和必要樓板。開口的位置／形狀從影子反推，標為假設；不憑空把可見亮斑認定為特定鐵窗花。
5. 主鏡頭成立後，試左右各約 5°。目前播放器採 orbit 行為，須檢查近景扶手視差與穿牆；若不成立縮小範圍，首版不增加自由步行。
6. 同時做 390×844、1280×720 構圖。橫幅透過鏡頭與補齊畫外幾何保留牆角、扶手回彎及平台光斑，不拉伸畫面。必要時增加場景專屬的 aspect framing。

## Blender 模型拆分

以下均為灰模起始美術尺寸，後續依構圖校準，不作建築規範或實測資料。

| 部件 | 建模方式 | 起始尺寸／細節 |
| --- | --- | --- |
| 牆與樓板 | 有厚度的 mesh；分離牆、平台與梯段，避免光漏 | 牆厚 0.12–0.18 m；平台約 1.8–2.4 × 1.2–1.8 m，實際依扶手及梯段位置解算 |
| 樓梯 | 重複踏階先用 Array，轉角個別處理；保留鼻口與立面 | 梯寬 0.9–1.1 m、踏深 0.25–0.29 m、階高 0.16–0.19 m；需確保梯段高差連續 |
| 紅褐扶手 | Bezier 路徑＋自訂圓角扁截面 sweep；回彎獨立調切線與扭轉 | 寬 0.05–0.07 m、厚 0.025–0.04 m；高度約 0.85–0.95 m。依圖校準，不直接做圓管 |
| 黑色立柱／紅色飾條 | 方／扁鐵 mesh，紅色折線以曲線或折彎帶狀 mesh 建立 | 立柱寬約 0.018–0.025 m；接點與嵌入地面位置連續，不浮空或穿插失真 |
| 牆腳踢腳 | 沿牆單獨薄條，處理轉角及沿樓梯下降部分 | 高約 0.10–0.14 m；有接縫、頂緣與小倒角 |
| 金屬小門 | 分開外框、凹槽、門片、可見把手／鉸接細節 | 約 0.30–0.40 m 見方；門縫、稍不整齊的框及周圍補土是主細節 |
| 防滑條 | 近景做嵌入踏面窄槽／條帶，遠景用 normal | 依參考逐階定位，避免一條黑線貼在空中 |

扶手是 hero asset：最先做準回彎半徑、截面、前景斜線與上下段遮擋。原圖不足以判定扶手是木材或包覆材料，先按可見紅褐塗層表現，不擅加木紋。只有影響輪廓、接觸陰影及近景高光的缺口用幾何；其他磨損交給貼圖。

## 材質與使用痕跡

| 表面 | 材質分層與起始設定 | 還原重點 |
| --- | --- | --- |
| 米黃牆 | 中性偏暖灰白 base color＋大尺度補漆差＋細抹灰 normal；roughness 0.80–0.95、metalness 0 | 暖色同時來自陽光與反射，不把整面底色染橘。斜光能看見抹痕，正面不滿佈強烈凹凸 |
| 平台／階梯 | 依圖製作磨石子視覺近似：灰褐基底、小骨料、少量孔洞與裂縫；roughness 0.65–0.85 | 骨料約 1–5 mm 起試，裂縫逐條按圖配置；不是巨大彩石、水泥噪聲或濕亮鏡面 |
| 扶手 | 暗紅塗層、接觸處磨亮、局部褪色、露底；roughness 約 0.30–0.55 | 上表面和回彎日照有高光；磨損沿手摸的位置分布，不能整條平均撒白點 |
| 鐵件 | 深灰塗漆為主，剝落處局部露金屬／鏽色 | 漆層 metalness 0；露出金屬另用遮罩，不能整根黑漆欄杆都設 metallic 1 |
| 小門 | 灰漆、框邊磨損、局部鏽蝕與補土遮罩 | 保留暗門縫和牆面的材質差，不做戲劇化廢墟鏽蝕 |

roughness 為 0–1 美術起始值；材質身份未實證。使用痕跡按「人手接觸、鞋子擦碰、接縫積塵、舊修補」分布，避免所有面共用同一 noise。來源優先自製程序材質與局部手繪 mask；後續若選外部貼圖，記錄資產頁、作者、授權、尺度和 hash。圖片作視覺目標，不直接截取含光影的區塊當 albedo。

## 光影：先做準落點，再做質感

1. 一個主要太陽方向光，穿過畫外開口及必要遮擋，照亮左牆、平台和扶手回彎；牆與地的亮帶、欄杆影子必須來自同一幾何光路。
2. 灰模階段先用純白漫反射材質調日照方向、開口位置與大小。根據圖中長影和明暗邊界調整太陽角尺寸；先求投影輪廓，不先堆曝光或 bloom。
3. 天空補光與牆地反射保留右牆、平台角落和下行梯段的層次；Cycles 中觀察紅扶手附近的微弱色彩反射，避免把暗部整片加亮。
4. 圖片顯著的是表面日照，沒有足夠證據需要可見體積光。首版不加霧／光柱；白色亮帶不應被誤解為空氣光束。
5. 關閉強 bloom、景深和鏡頭耀光。用扶手亮部、左牆亮帶和右牆暗部一起校準曝光及色彩管理；Blender 和網站各自記錄 tone mapping，不能只複製 exposure 數字。
6. 第一版固定參考午後時刻，不以圖像推定實際日期／太陽方位。四時段屬後續範圍；午後 GI 不直接冒充全天照明。

## Blender → 網站

- 可編輯來源預定 `assets/blender/stairlight-study.blend`，可重建腳本 `assets/blender/scripts/stairlight.py`。建模、烘焙、匯出分步，沿用既有流程結構，不覆寫 leaflight 母檔或 GUI 場景。
- 網站資產預定 `public/models/stairlight.glb`、`public/textures/stairlight/`。PBR base color、normal、roughness 等由程序材質烘焙；曲線與 modifiers 在匯出副本轉成穩定 mesh。
- 先以一塊牆、一段扶手與平台做網站試片，確認 normal 方向、材質尺度、線性／sRGB、GLB 座標／相機轉換，才擴大烘焙。
- 材質 UV 與不重疊的 lightmap UV 明確分工；indirect 烘焙排除 direct 與 albedo，Three.js 重建直接光和投影，避免雙重照明。EXR channel、flipY、光強換算用試片核對，不直接照抄 leaflight 常數。
- 烘焙間接光對應固定日光。若後續要移動太陽，須另驗 GI 基底或重烘焙；不能只旋轉 direct light 宣稱全光路一致。
- 場景預定 `src/places/stairlight/index.ts`，遵守 `PlaceFactory` 的預載、update、dispose，引用既有 resource helpers；不匯入魚或水體模組。
- 接入需核對 `metadata.ts`、`catalog.ts`、`main.ts` 的 UI 提示／場景分支及偏好測試。現有 `main.ts` 尚有非 leaflight 就當海景的提示與固定 gallery 場景清單，不能只加 catalog 即稱完成。
- 固定午後試片先在獨立對照頁完成；正式選單接入時讓時段控制如實反映支援狀態，不留下看似可用但不起作用的選項。首版保持靜態，可選微塵／遠處環境音待構圖確認後另議。

## 階段與驗收

| 階段 | 交付物 | 通過條件 |
| --- | --- | --- |
| P0 相機／灰模 | 4:5 灰模、參考疊圖、畫外開口假設 | 牆角、小門、扶手回彎、踏階方向與主要亮斑對位；無魚，無材質仍能認出原構圖 |
| P1 扶手與光路 | 完整扶手、基本梯段、單光源 Cycles 試片 | 回彎輪廓、上下段關係、平台長影成立；投影不依賴貼圖造假 |
| P2 材質試片／轉換 | 牆＋扶手＋平台的 Blender／網站同鏡頭對照 | 沒有塑膠牆、過大骨料、反轉 normal、UV 接縫及雙重日光；高光保有層次 |
| P3 完整資產 | .blend、重建腳本、GLB、貼圖及 manifest | 裂縫、小門、踢腳、磨損完成；重新開檔無缺圖，小幅視角無漏面 |
| P4 播放器接入 | 新場景、載入錯誤處理、視角重設與畫質對照 | 場景往返正常，資源有釋放；不影響既有場景；固定時刻限制清楚 |
| P5 視覺驗收 | 原比例／手機／橫幅截图、實測紀錄 | 與參考並排看構圖、灰階明暗和局部質感；browser、實體手機、發布分別記錄 |

驗收圖預定 `exports/stairlight-review/`；每組保存相機矩陣、viewport、曝光、光源參數、資產 hash 與版本。可見錨點先以畫面寬／高約 2–3% 誤差作內部檢查目標，關鍵扶手輪廓另做疊圖檢查；這是製作門檻，不是已達到的相似率。不能直接用含魚原圖的全圖像素分數評判無魚版。

初始效能預算（待測）：可見模型 5–12 萬 triangles；主要貼圖 2K，只有近景證明需要才升 4K；單主投影光，2048 shadow map，低畫質先試 1024。記錄實際 frame time、DPR、draw calls、資產大小與 GPU 資源計數，沿用現有 30／24 fps 節奏，不預先承諾手機達標。文件規劃本身不跑 build；實作時跑相關測試、build 與實際 browser 驗證。

## 製作優先序與限制

還原優先序：相機／空間比例 → 扶手造型與遮擋 → 日光／長影 → 大面積材質尺度 → 局部老化細節。最常見返工來源是相機未鎖定就做細節、扶手做成圓管、全場過橘、磨損均勻鋪滿及烘焙／即時日照重複。

建議下一步先交 P0＋P1 的無魚、無粒子對照圖，確認後進入完整材質。單張照片可以高度接近畫面，但不能保證還原原建築的真實尺寸及畫外空間。本輪只完成規劃；所有上述資產路徑均為預定交付位置。

## 2026-09-08 實作接手：P0／P1 首版

- 使用者已授權開始實作，並明確要求 worktree。實作位置 `/private/tmp/quiet-places-stairlight`，分支 `codex/stairlight`，起點 `7f16357`。原工作區的 `afterlight.md` 與規劃頁不動；本 worktree 尚未 commit／push／發布。
- **狀態：已產出可重建灰模與午後試片，還原驗收尚未通過。** 不是完整場景完工；未開始 PBR 貼圖／GI 烘焙及播放器接入。使用者尚未確認這版畫面。
- 首版來源：`assets/blender/scripts/stairlight.py` → `assets/blender/stairlight-study.blend`。獨立 background＋factory-startup 才能執行，拒絕對已開啟母檔或 GUI 場景做清除。`--grey` 只渲染 material override，不覆蓋彩色母檔。
- 自製內容：雙梯段、平台、牆與踢腳、連續扁截面扶手、黑色立柱、紅色折彎帶、檢修小門、防滑條、少量裂縫與程序材質。沒有魚、其他生物、水體或粒子；沒有下載第三方資產。
- 參考已另存本 worktree 的 `assets/references/stairlight/reference.png`，由 `.gitignore` 排除，不進 public，也不打包進 .blend／GLB。
- 畫面：`exports/stairlight-review/stairlight-afternoon.png`、`stairlight-grey.png`，896×1120；相機／光照設定見同目錄 `study-settings.json`、`grey-settings.json`。
- 參數：公尺；相機 `(-2.2,-1.8,2.75)`、target `(0.2,0.65,0.8)`、vertical sensor 36 mm、lens 25 mm、local roll −0.12 rad。太陽方向 `(1,2.5,-2.4)`、energy 3.5（Blender renderer 設定）、色 `(1,.82,.60)`、角尺寸 0.8°；world strength .65、AgX exposure +1.2。Cycles 64 samples、Metal GPU、最多 8 bounces／5 diffuse bounces、denoise。均為美術參數，不是台北指定日期的日照計算。
- **光路近似：** 可見牆地接收 Cycles 直接與反射光；畫外開口是光形代理，沿太陽射線平移到鏡外，避免早期擋板在可見平台產生黑帶。代理 `visible_camera=false`、`export_web=false`；這不是已解出的公寓窗戶位置。網站須另外建立遮擋，不能直接用本階段 GLB 重現日照。
- **幾何近似：** 首版為單鏡頭 camera study，左側牆、平台及梯段有大幅鏡外延伸以補齊取景；不代表合理公寓梯寬。扶手端部截面、上下梯段接合與相機俯角仍需按參考細修。未驗收 5° orbit／橫式／手機，不能宣称已可探索。
- 已修正：初始前景踏階占比過大、扶手回彎偏右、採光代理範圍不足造成右牆漏光、代理穿入可見平台形成黑帶。逐張渲染後調整，最新 PNG 為當前狀態。
- 仍有可見差距：扶手回彎與前景斜率、檢修小門比例、牆腳線角度、平台長影位置；材質仍偏乾淨，牆抹痕／局部補漆、扶手白色磨損與細骨料未達原圖層次。不得把這些當成已通過的 P0/P1 還原。
- 幾何匯出：`assets/blender/scripts/export_stairlight.py` → `public/models/stairlight.glb`＋metadata；35,864 triangles／149 nodes，basic Principled fallback，程序貼圖尚未烘焙、無 lightmap。exporter 於 temporary scene 複製 evaluated MESH／CURVE，清空原 material slots 後套 fallback，最後清理；原 .blend 不重存。
- 已完成檢查：實際 Blender 5.1.2／Metal 渲染完成並退出，彩色母檔實際重新開啟並成功匯出 GLB；Python syntax 檢查。GLB／母檔 hash 與獨立 readback 見 `exports/stairlight-review/validation.json`。本輪沒有 app code 變更，未以 build 或 browser 測試冒充渲染／發布驗收。

### 重建方式

在本 worktree，先執行：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python assets/blender/scripts/stairlight.py -- --render
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python assets/blender/scripts/stairlight.py -- --render --grey
/Applications/Blender.app/Contents/MacOS/Blender --background assets/blender/stairlight-study.blend --python assets/blender/scripts/export_stairlight.py
```

每次只跑一個 Blender 渲染程序，不在使用者的 GUI 執行建模腳本。下階段先把相機／扶手／投影差距收斂，再進 P2 的牆＋扶手＋平台烘焙試片；不要先把 fallback GLB 加到正式場景選單。

## 2026-09-08 第二版：縮窄梯段、提高俯角

- 使用者回饋第一版「樓梯要窄一點，然後要更俯角一點，目前有點不像」，並提供新的直式無魚參考。修正仍在 `/private/tmp/quiet-places-stairlight`／`codex/stairlight`，沒有改原工作區。
- 前版來源、母檔、PNG、settings 保存到 `exports/stairlight-review/v1/`；這是可回看的舊草稿，不是使用者確認基準。新參考私人副本為 `assets/references/stairlight/reference-narrower.png`，仍被 Git 排除。
- 實際縮窄幾何：上行梯段由前版取景用的 7.45 m 延伸改為 1.20 m，下行由 1.71 m 改為 1.389 m（約縮窄 18.8%）；同步更新階梯底板、防滑條、右牆與踢腳。左側僅補平台側方地面，不再用加寬梯段消除露空；側方地面仍是有限取景的延伸，不宣稱是實測建築平面。
- 俯角由約 29.6° 改為 **47.6°**。相機 `(-1.6,-0.9,3.1)`、target `(0.2,0.65,0.5)`、lens 25 mm、vertical sensor 36 mm、roll −0.10 rad。相機高程為場景座標，不等於相對站立踏階的眼高。
- 平台縱深由 2.10 m 縮為 1.10 m；梯段起點移到 y=0，回彎前段縮至 0.10 m，中心間距 0.34 m。欄杆立柱與紅色飾條隨梯段起點移動。小門移到新背牆，保持貼牆。
- 參考構圖比例改為約 0.737（896×1216）。沒有修改材質、太陽、天空或曝光數值，這輪主要用來比較寬度、俯角、平台和扶手輪廓；陰影會自然隨幾何改變。
- 實際檢視修正版渲染，補掉縮窄後左侧平台露空；彩色與灰模 PNG、.blend、GLB 和 validation 同步更新。檢查 Python syntax、母檔重開、相機、幾何寬度、無缺圖、GLB triangle/hash 與來源檔一致性。
- 狀態：**第二版待使用者看圖**，未稱為還原驗收通過。牆面／扶手老化及磨石子材質仍是早期程序近似，尚未做網站烘焙／接入、手機或發布驗收；沒有魚。

## 2026-09-08 第三版：補齊上行梯段外側牆

- 使用者指出左下方樓梯間應有牆。移除 `Landing_Side_Continuation` 的補畫面地板，改建 `Wall_Upper_Left`，並新增 10 段 `Upper_Skirting_*` 跟隨踏階高程。
- 左牆內側 x=−1.679 m，貼齊 1.20 m 上行梯段外緣，厚 0.18 m，y=−2.90 至 0，z=−1 至 4.2。是可見、可投影且會匯出 GLB 的實體牆，不是只為相機遮住缺口的平面。
- 沿用第二版相機、俯角、梯寬與材質；加入牆後日光必須接受真實遮擋，不把穿牆光保留下來。第二版腳本及彩色預覽保存在 `exports/stairlight-review/v2/`。
- 此輪仍是場景結構修正，非完整材質／網站接入或發布驗收。
- 本輪驗證完成：彩色／灰模重新渲染、母檔重開、左牆可見及 10 段踢腳存在、GLB 包含左牆節點且不含原補地板；37,744 triangles／159 nodes／1,602,248 bytes，hash 核對一致。最新證據為 `exports/stairlight-review/validation.json`，美術仍待使用者確認。

## 2026-09-08 網站場景：階光之間（最新）

使用者確認第三版結構後授權接入網站，指定由樓梯間窗戶供光。確認基準保存在 `exports/stairlight-review/approved-v3/`；沿用窄梯、47.6° 俯角與側牆，無魚。以下取代上方早期未接入／代理光源狀態。

- 新增 `stairlight` 場景選項、房間卡片、gallery 與直接網址 `?place=stairlight`。沿用既有播放器，固定 15:00；此版本不提供與烘焙光照矛盾的時間／日夜調整。其他場景切回後恢復控制。
- 光路改為實體窗洞：左牆內面 x=−1.679 m，洞口 Blender y=−3.90…−1.10、z=2.00…4.80 m，牆厚 .18 m。新增窗框、中柱、窗台與房間封閉牆／天花，日光經開口進入。尺寸為照片外空間的美術假設，未放玻璃折射或體積光。
- 太陽入射 `(1,2.5,-2.4)`（Blender Z-up），能量3.5、RGB `(1,.82,.60)`、角尺寸 .8°；天空 strength1.5、曝光+1.2。網站 Three 座標 `(x,z,-y)`，DirectionalLight 搭配2048 shadow map，低畫質1024；bias −.00001、normalBias .002 m，BackSide 投影以減少扶手自我遮蔽紋。即時 PCF 柔影並非 Cycles 的太陽角尺寸精確解算。
- `bake_stairlight.py` 複製 evaluated 幾何，修正外向面，合併成一個 UV0 surface，PBR 4096、間接光2048，64 samples／Metal／2 threads；smart-project margin .002，bake gutter16px。2K PBR 曾使細框 UV 缺 texel，因此提高解析度。另修正 sweep 扶手原本的反向 winding，避免間接光把扶手烘成黑色。
- 間接光僅 DIFFUSE INDIRECT，不含直接日光及 albedo；EXR 線性光由網站 lightMap 讀入，glTF UV 對應以 repeat.y=−1、offset.y=1 校正，intensity π。PBR albedo／normal／roughness 內嵌 GLB。網站直接日照由真實窗、牆、欄杆的 shadow pass 計算；間接光為固定烘焙，不是即時全域光照。
- 母檔 `assets/blender/stairlight-study.blend`；網站烘焙母檔 `stairlight-web.blend`；網站資產 `public/models/stairlight.glb`、`public/textures/stairlight/room-indirect.exr`。網站版本必須執行 `bake_stairlight.py`，不可用舊 `export_stairlight.py` 覆蓋成 fallback 材質。
- 本地預覽 `http://127.0.0.1:5194/?place=stairlight`；worktree `/private/tmp/quiet-places-stairlight`，branch `codex/stairlight`。未 commit／merge／發布；資產及瀏覽器驗證結果見 `exports/stairlight-review/validation.json`。

重建網站資產：先以 factory-startup 跑 `stairlight.py`，再以該 study.blend 背景執行 `bake_stairlight.py`；兩個 Blender 程序依序執行。`tests/stairlight-gpu.html` 是開發伺服器的真實 WebGL 驗證頁，檢查窗洞通光／牆體遮擋、陰影像素差、材質完整、固定午後、低畫質 shadow map、重複 dispose 和未使用 factory 釋放。

本地驗收：21/21 tests、build 通過；真實 WebGL 八項檢查通過，陰影開關造成76,236 pixels 差異，釋放後 geometry/texture 均回到0。桌面1280×720及390×844 iframe 播放器已看圖，瀏覽器無錯誤；未測實體手機。GLB 30,114,148 bytes，4K 材質仍有載入成本；右牆可見細光縫，尚非逐像素照片還原。未發布。

## 2026-09-08 水平環繞、時段與汽水帶（最新）

使用者要求移除不自然光線、往樓梯中央偏右取景、與其他場景相同的轉動及時段控制，並在扶手彎角綁紅色汽水帶。後續明確修正：汽水帶沿左側弧移45°，以扶手圓心為水平旋轉中心。上一版腳本、GLB、EXR和驗證保存在 `exports/stairlight-review/website-v1/`。

- **光縫根因與修復：** 窗下牆與窗旁牆交界 z=2.0 m 各自有倒角，形成狹縫，日光投到對面牆成為不自然斜線。結構牆／窗洞拼接塊／天花改用無倒角接合；窗框本身仍有細倒角。重新烘焙與實際瀏覽器確認細線消失，GPU 射線驗證原接縫高度現在擋光。
- **攝影與轉軸：** 網站在 GLB Camera_Hero 上向右 .45 m、Three z +.10 m，位置約 `(-1.15,3.1,1.0)`；轉軸精確為扶手 U 彎圓心 `(-.309,.88,-.10)`。使用 world-up `(0,1,0)`，移除攝影母檔 roll；OrbitControls 固定 polar、無縮放／平移，水平左右各15°。這是網站鏡頭重新構圖，不直接沿用母檔取景 target／roll。原窄梯、平台和侧牆保留。
- **時間：** 移除固定15:00限制，沿用 `sampleTime` 晨曦／正午／暮色／月夜和本地時間控制。直射方向、能量與顏色隨 state angle/intensity/warmth 變化；夜間冷色弱光。此為美術時段，不是台北某日的天文日照。2048／節能1024 shadow map，每次紅繩或日照改變同步更新；shadow camera 包住建築 bounds sphere，避免轉換時裁切投影。
- **烘焙語義更新：** 關閉所有 Blender LIGHT，再烘焙天空的 DIFFUSE DIRECT+INDIRECT（不含 COLOR）。EXR 含直接天空照明及天空反射，不含日／月直射及其反射。先前只烘 INDIRECT 會漏掉直接窗外天空照明，使夜景過暗；已補齊。沿用 `room-indirect.exr` 路徑，但以此處與 metadata 的新語義為準。網站依時段縮放並乘冷暖 tint；這是靜態天空可見性與時段近似，不是多時刻 GI 完整解算。
- **汽水帶來源：** [台灣威比的塑膠繩／汽水帶](https://www.wellbe.com.tw/product-detail-2690047.html) 商品說明提到紅色與皺褶表面；只用作造型參考，沒有複製商品照片／下載模型或貼圖。全部幾何由 `src/places/stairlight/RedTwine.ts` 程序製作，非 Blender 烘死的一部分。
- **汽水帶造型與位置：** 扶手扁截面 .066×.038 m，繞包採 .55 superellipse 加3 mm間隙，固定結與四層扁皺褶帶；兩尾長 .38／.52 m、寬 .014／.022 m。左移45°後錨點約 `(-.4292,.88,-.2202)`，切向旋轉 Y=π/4，位於半徑 .17 m 的回彎。PBR 紅色、roughness .31、無 emissive。
- **動態：** CPU 直接更新尾帶頂點，錨點以 t² 衰減固定，位移约2–5 cm；跟隨播放器 elapsed/activity，無独立 RAF。可重現時間、暫停不累積、rest positions 獨立複製，shadow pass 使用相同幾何。這是程序風擺，不是繩／布物理解算。動態帶材另有材質專用局部 diffuse 天空補光近似，不往全房間追加均勻補光。
- **介面：** 時刻、光強、拖曳及方向鍵控制恢復；Home 回到圓心構圖。圖片輸出現在包含三個場景各四時刻，共十二張。
- **狀態：** 持續在 `codex/stairlight` worktree，本地預覽5194；未合併或發布。GPU／browser／測試最新結果記錄在 validation.json。幾何與轉軸數值以來源程式為準。

本輪最終驗收：22/22 tests、build、git diff --check 通過；真實 WebGL 四時段渲染不同、月夜暗於正午、原牆縫高度封光、圓心／world-up／水平軌道牆內餘裕、汽水帶45°錨定及資源釋放通過。瀏覽器已檢視四時段、左右轉動極限、Home重設、390×844播放器，無console error/warning。光縫已消失；實體手機及發布仍未驗證。

## 2026-09-08 窗位示意與汽水帶外側可見性

- 使用者詢問月夜過黑的原因及窗戶位置，要求汽水帶再左移並看清擺動。月夜解釋依現行數值：state intensity .09 時，定向光 .10（正午3.5）、天空倍率下限 .18，另乘冷色 tint，曝光固定+1.2且無室內灯；未模擬暗適應。這是美術設定偏暗，不是窗戶遺失。本次未修改夜間亮度。
- 汽水帶由 Blender 平面弧角135°移至165°（再向左30°），位於 Three 約 `(-.4732,.88,-.1440)`；rotation Y=255°，反向切線讓結與尾帶落到 U 形外側。圓心、半徑與相機轉軸不變。
- 尾带展面增加約60°漸進扭轉，兩尾略微分開，避免側面朝向鏡頭只剩細線；保留固定錨點與現有 deterministic 風擺，不加大風速。瀏覽器已看見完整紅色尾帶露在扶手外，22項測試與build通過。
- 示意圖 `exports/stairlight-review/window-layout.svg` 已在瀏覽器檢視：俯視位置與左牆立面。窗約2.8×2.8 m，下緣為平台高程2.0 m，上緣4.8 m，是照片外空間的製作假設；圖非等比例。

## 2026-09-08 後牆窗戶比較稿（不取代側窗）

- 使用者指向俯視示意圖下方的橫牆，要求看看窗移到那裡的效果。按「相機後方、橫跨兩梯段的牆」製作獨立 rear 比較稿；原側窗模型、天空貼圖與預設網址保留。
- 來源 `stairlight.py --rear-window` → `assets/blender/stairlight-rear-study.blend`；以該母檔執行 `bake_stairlight.py`，由 scene.window_layout 自動輸出 `stairlight-rear-web.blend`、`public/models/stairlight-rear.glb`、`public/textures/stairlight-rear/`，不覆蓋側窗資產。
- 原左側高窗封成實牆。新窗在 Blender y=−4.10 內牆面，x=−1.57…1.032 m，z=2.0…4.8 m，約2.60 m寬×2.80 m高；下緣仍相對平台2 m。窗框／中柱／窗台隨開口移動，拼牆無倒角以免漏縫。窗口是開放空氣。
- 網站用 `?place=stairlight&window=rear` 選此比較稿。攝影、紅繩、材質設定與曝光不變；窗光改從鏡頭後方往平台方向，方向 Three `(0.12+angle*.65, -(2.6-abs(angle)*1.1), -3)` 正規化。這是為新窗配置的美術照明，非保持相同地理日照方向的科學對照。
- 仍以獨立天空可見性烘焙、即時直射與投影呈現；夜間強度與原版相同，此輪不把月夜亮度改动混入窗位比較。測試頁 `tests/stairlight-gpu.html?window=rear` 可驗證新窗開口與窗旁牆體遮擋。

後牆比較稿驗證：Blender 烘焙115秒完成，GLB hash回讀一致；22項tests及build通過。真實GPU新窗通光／窗旁牆遮光、四時段、水平轉軸、紅繩錨定與資源釋放檢查通過。桌面正午畫面已看圖，瀏覽器無warning/error；側窗GLB與EXR的hash保持不變。證據：`exports/stairlight-review/rear-window/validation.json`。

## 2026-09-08 後牆窗縮為 1.8×1.2 m

使用者要求試看寬1.8、高1.2 m。保留後牆窗水平中心 x=−.269 m 與窗台高程2.0 m，洞口改為 x=−1.169…+.631、z=2.0…3.2 m；後牆 y=−4.10內面不變。同步縮窗框／中柱／窗台、補齊洞口周圍實牆並重新烘焙；攝影、光源方向與強度、汽水帶維持原設定，以比較窗尺寸本身的效果。

大窗母檔、GLB、EXR、來源脚本與驗證已保存 `exports/stairlight-review/rear-window/large-window/`。小窗沿用 `?place=stairlight&window=rear` 比較網址；預設側窗不變。尺寸為結構洞口標稱值，窗框會再占用少量淨開口。未發布。

小窗驗收：Blender重烘完成（142秒），GLB hash核對一致；真實GPU驗證洞口通光、上／下／側牆擋光、四時段及資源釋放通過。瀏覽器正午已看圖，console無錯誤。亮斑主要移到近處階梯，平台變暗；沒有為了補亮而改曝光或太陽方向。此輪只改模型與fixture，未重跑全站build。


## 2026-09-09 2.5×2 m後窗、完整平台與幼鯊往返（最新）

使用者在幼鯊接入後要求：窗寬2.5 m、高2 m，修正汽水帶過亮，上樓後循原階梯返回下層平台，補足畫面下方建築。持續在 `/private/tmp/quiet-places-stairlight`、`codex/stairlight`；此輪未commit／合併／發布。

- **窗洞**：後牆Blender y=−4.10，x=−1.519…+.981，z=2…4 m；中心x=−.269與下緣2 m保留。窗框／中柱／窗台同步放大，後牆下段維持延伸至−2.4 m，不可只封至平台0 m而讓下層後方露空。原1.8×1.2版本封存於 `exports/stairlight-review/rear-window/small-window/`。
- **平台與梯底**：上平台x[−1.679,−.479]、Blender y[−4.10,−2.80]、top z=1.75 m；下平台x[−.139,1.25]、相同y範圍、top z=−1.75 m。皆是.20 m厚實體板，樓梯接頭及後端也有實體立面。保留既有.13 m斜梯板與中間井空，不把不同樓層鋪成同高地板。平台中間不設阻擋迴轉的護欄。此新增幾何目前只在rear版，側窗比較母檔／輸出未覆蓋。
- **光照**：重烘4K PBR／2K sky atlas，Metal、2 threads、64 samples，耗時163.55秒。EXR仍只含直接天空與天空反射，不含太陽直射／太陽反射。主鏡頭、曝光、日照方向規則不改。
- **紅繩**：原本材質額外加一個與面向無關的天空irradiance，使暗部平板般紅亮。改以窗面積／距離平方、帶面朝窗餘弦與少量室內反射近似；後窗area=5 m²、Three center(−.269,3,4.10)。保留DoubleSide PBR、實際shadow pass、固定錨點和原擺動，不用emissive。
- **鯊魚**：一尾0.9 m幼年黑鰭礁鯊造型，Blender自製模型，16個尾部加密脊椎控制與獨立胸鰭控制。變形為尾重的traveling wave，加轉彎曲率、按速度計算頻率、小幅pitch和bank。改以同兩段樓梯上下往返、只在實體平台轉向；一圈56–58秒。完整來源、數值、近似與測試見 [生物製作頁](../biology/blacktip-reef-shark.md)。
- **驗收**：28/28 tests、build及diff check通過；十分鐘全蒙皮頂點離散檢查通過。真實GPU：新窗通光、窗上／下／旁牆遮光、四時段、蒙皮可見與投影、暫停、節能陰影及重複dispose通過。桌面正午與月夜已看圖，繩子暗面不再平亮；未實測手機或發布。
- **瀏覽器收尾**：依使用者要求關閉本輪模型、巡游、GPU測試與重複預覽分頁，只保留原場景預覽；背景烘焙已退出，不關閉使用者自己的Blender視窗。


## 2026-09-09 晨曦牆角白線修正

使用者回報牆角與踢腳板交界出現細白線。在06:30、相同材質／曝光下重現，關閉太陽只保留天空烘焙後白線消失；關閉normal map或把bias歸零仍有白線。主因是原BackSide-only shadow caster在室內接合邊緣漏遮，非EXR白邊；既有牆和踢腳板幾何保持不變。

- 建築材質shadowSide改DoubleSide，封住低角度光的接合邊緣。單純雙面會在掠射光下自遮蔽，因此建築新增自有MeshDepthMaterial：RGBADepthPacking之前加 `1.5 * max(abs(dFdx(z)),abs(dFdy(z)))` 的局部陰影像素斜率補償。一般polygonOffset只改depth test，不改打包的高精度z，不能取代此補償。
- 原directional bias=−.00001、normalBias=.002 m保留；未用全域大bias、增加shadow map解析度或改曝光掩蓋瑕疵。customDepthMaterial與建築一起釋放，載入失敗／未使用factory亦釋放。此為PCF光柵陰影近似，不是光線追蹤。
- `tests/stairlight-gpu.ts` 新增同鏡頭／晨曦下舊BackSide與新設定的白線回歸檢查。牆角相對sky-only的亮線指標從1299降至0（測試ROI RGB差值總和，非物理光度）。四時段、窗洞／牆遮擋、鯊魚投影、節能與資源釋放通過，console無error/warning。build通過，原有大bundle提示保留；本輪沒有重跑與陰影無關的全部單元測試。
- 已在使用者原晨曦視角看圖，牆角白線與掠射牆面條紋消失。诊斷頁 `tests/stairlight-seam.html` 只在控制改變時渲染；本輪測試分頁全數關閉。仍為worktree本機修改，未發布。


## 2026-09-09 幼鯊頭部流線修正

重建鯊魚截面：以斜率連續的半徑平方Hermite插值取代逐段smoothstep，修掉吻部肩狀環凸、加密前段並重新貼合眼睛。另將建築的局部斜率depth補償套用於鯊魚自有蒙皮陰影，去除額外自遮蔽細環紋；不修改全域光照。0.9 m身長、巡游與窗戶設定保留。28/28 tests、後續rig釋放檢查、build、600秒全頂點間距及四時段GPU通過；詳見生物頁最新節與 `exports/shark-review/streamline-validation.json`。原GLB／腳本已封存，未commit／發布。

本輪模型／GPU／巡游測試頁已全部關閉，只保留原有兩個場景預覽，rear預覽已重新載入新模型。


## 2026-09-09 窗光反射、空氣散射與復用文件

已接入WindowTransport：窗洞3條實際幾何射線決定一次反射位置，3個256² shadow SpotLight近似表面回光；材質沿視線以12步／節能6步積分淡空氣散射，使用太陽shadow map遮光。保留原天空EXR、曝光、窗戶與鯊魚路線。非完整多次GI，反射採代表色、有限射線與面光源近似；空氣參數為美術設定。具體數值、接線、換場景必改項目、成本及限制見 [復用手冊](../lighting/window-transport.md)，鯊魚頁已增加完整接入流程。

29/29 tests、build通過（既有bundle大小提示）；真實GPU四時段、第一遮擋與窗口、蒙皮投影、暫停、資源釋放通過，反射開關RGB差值總和51175、牆角白線指標0。已看晨曦中央平台，補光保持克制。僅本機worktree，未合併／發布、未測手機效能。驗收記錄見exports/stairlight-review/transport-validation.json。

測試分頁已全部關閉，保留原有兩個場景預覽。


## 2026-09-09 往下補一個完整樓梯模組

使用者回報中央井空仍露出不完整下方。rear Blender來源把Upper／Lower踏階、止滑、梯底、欄杆、紅扶手、Landing及踢腳板複製一份，Z下降3.5m；不複製窗、檢修門與天花板。原下平台−1.75m與複製的上梯終端同高，在遠端平台加.36×1.30×.20m橋接板；只在平台銜接，梯段中央井空保留。新增中間平台−3.5m、下平台−5.25m，四側牆延至−5.7m，舊封底由−2.1m移至−5.6m。此為有限一層延伸，非無限樓層；鯊魚維持原路線。

材質與天空GI重新烘焙，103.98秒，避免重複上層光照貼圖；原GLB／metadata／貼圖／來源脚本封存exports/stairlight-review/before-lower-storey。空氣散射內框下緣同步到−5.49m。側窗舊比較版未修改。

Build與GPU通過；新增實際GLB射線檢查下層兩梯、−3.5m平台、−1.75m連接板及低處三側圍牆。四時段／窗遮擋／蒙皮／資源釋放通過，牆角白線指標0。下望fixture為tests/shark-review.html?window=rear&view=lower。仍為本機worktree，未commit／發布。

已在下望鏡頭看圖確認較深的樓梯／欄杆可見，完成後關閉測試分頁。


## PR 整合（2026-09-09）

以最新main f01ea56建立codex/stairlight-pr，僅移入樓梯間資產、模組、測試、來源與文件。正式CSS完全不改，index.html只新增無圖片場景文字及select option；保留afterlight、深灰dock與既有輸出流程。移除舊worktree中未再使用的fixedHour播放器修改。預設window=rear；window=side才載入舊比較資產。可再生web.blend、大型舊版備份及私人参考圖只留本地，不納入PR。
