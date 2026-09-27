# Southern stingray（`Hypanus americanus`）製作頁

> 狀態：2026-09-07 的本地製作與程式整合紀錄。骨架版已接入正式海光場景路徑；已完成實際 GLB、測試與本機 browser 整合檢查；實機效能仍未驗收。它不是 81 項任務書的完成宣告，也不是流體、軟體或生物力學模擬的驗收。

## 範圍與來源

- 場景：海光之室；場景脈絡與光路見[海光筆記](../scenes/oceanlight.md)。網站接入路徑為 `src/places/oceanlight/Stingrays.ts` 與 `src/places/oceanlight/StingrayMotion.ts`；不以舊 `studies/` 目錄狀態判定正式接入。
- 生物形態參考：[Florida Museum 的 Southern Stingray species profile](https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/southern-stingray/)。本頁採用其可辨識特徵作為造型方向：菱形胸鰭盤、背側眼與噴水孔、腹側口與鰓裂、細長尾。
- 游姿方向參考：[Rosenberger & Westneat 1999 原始論文摘要](https://journals.biologists.com/jeb/article/202/24/3523/8283/Functional-morphology-of-undulatory-pectoral-fin)，研究物種為藍斑魟 `Taeniura lymma`，描述由前向後傳遞的胸鰭波。僅作運動方式參考，不能當作 Southern stingray 的速度／頻率量測。形態頁與論文摘要於2026-09-07核對；未將外部圖片複製到repo。
- 製作需求參考見[任務書來源紀錄](references/README.md)。它是使用者提供的參考需求，不等於每個條款已實作或驗收。
- 資產來源：`assets/blender/scripts/stingray.py` 程序生成原創幾何與頂點色；`assets/blender/stingray.blend` 為可編輯母檔；`public/models/stingray.glb` 為網站模型。已知未使用下載模型或照片貼圖。外部生物參考的圖片、文字及其再利用授權未逐項盤點，故其再利用授權為未知；本專案不應重發布那些參考內容。

## 生物事實與美術近似的邊界

可支撐的生物方向是連續胸鰭盤、中心較厚而邊緣較薄、背側感官構造、腹側口／成對鰓裂，以及向後傳遞的胸鰭波。模型的精確比例、面數、材質顏色、輪廓簡化、眼與皮褶的幾何表現，仍是原創美術重建，未聲稱為解剖精確模型。

兩隻個體的橫向 8 字路徑、短暫加速、抬升／滑降、個體錯相與近地陰影是場景編舞與 AO 視覺提示。室內仍採乾燥空間／窗外海水的設定；這不建立室內水體、浮力、碰撞避障、覓食或自主生態行為。胸鰭與尾部均為運動學近似，不是 CFD、流體、soft-body 或定量生物力學結果。

## 資產、座標與材質

- 產生方式：Blender 背景模式可執行 `assets/blender/scripts/stingray.py`；腳本以 `W=1.34`、`L=1.117`、`TL=1.65`（m）與 `U=7`、`V=4` 建立可調的截面盤面、尾部與骨架網格。這些是專案預設與美術起點，不是成體族群的測量結論。
- Blender 原生座標為 `+Y` 鼻端／前方、`+Z` 背側／上方。`SRAY_ROOT__Three_Z_Forward` 以 Z 軸 180°修正並以 `export_yup=True` 輸出，供網站使用局部 `+Z` 前方、`+Y` 上方；路徑載體處理世界位置與朝向，避免再疊加 clip root motion。
- `SRAY_SectionQuadDisc` 是四邊形為主的胸鰭盤；中心厚、外緣薄。`SRAY_Mottle` 是唯一預期輸出為 `COLOR_0` 的頂點色，僅用於 disc；尾、褶、眼窩與眼瞼使用獨立實色上側材質。腹面、口、噴水孔、眼與 10 條鰓裂為可見辨識細節，非醫學或解剖驗證。
- 腳本會輸出 `.blend`、選取資產而排除 review studio 的 `.glb`，並產出頂視與側視 review 圖。整合時讀得 GLB SHA-256 為 `e5909d095f4c09971b35e917e7c8b16e3a3468405b798373da8837d24bc89061`；實際 GLB 讀回：1,859,344 bytes、23 meshes、11,126 triangles、1 skin／72 joints、8 clips；只有 `SRAY_SectionQuadDisc` 帶 `COLOR_0`。完整清單見[資產讀回](../../exports/shared-scene-review/stingray-asset-readback.json)。

## 骨架、Actions 與網站行為

- `SRAY_RIG` 有 56 個分散胸鰭控制骨：`L_FIN_U00_V01` 至 `R_FIN_U06_V04`；每骨帶有 `side`、`u`、`v`、`role=fin` custom properties。核心骨保持較剛性，胸鰭權重按縱向／徑向格插值。
- `tail_01` 至 `tail_10` 是有序尾骨。直游 clip 保持尾部中性；網站以路徑朝向與高度的短歷史延遲，覆寫成衰減的尾部反應。這是可調的被動拖曳表現，沒有宣稱量測尾剛性或水阻。
- 產生器在 30 fps 建立 8 個 Actions：`SRAY_ACT_IDLE_HOVER`（4 s）、`SRAY_ACT_SLOW_CRUISE`（2 s）、`SRAY_ACT_CRUISE`（1.4 s）、`SRAY_ACT_TURN_LEFT`／`RIGHT`（各 2 s）、`SRAY_ACT_RISE`／`SETTLE`（各 3 s）、`SRAY_ACT_RISE_AND_SETTLE`（6 s）。所有 Actions 以 muted NLA tracks 保留；slow cruise 是檢視中的 active action。slow cruise 與雙轉彎是一個完整 2 秒循環；rise／settle 是非循環 body offset，root translation/yaw 維持中性。
- `StingrayMotion.ts` 以可重現的弧長 8 字路徑供兩隻個體取樣，並提供位置、朝向、速度、bank、turn 與距離連續的 fin phase。`Stingrays.ts` 載入 `SRAY_ACT_SLOW_CRUISE`、`SRAY_ACT_TURN_LEFT`、`SRAY_ACT_TURN_RIGHT`，混合強度隨轉向與鰭振幅改變；每幀用絕對 elapsed 重設 action time，使暫停／重播不依賴累積 dt。這些是程式行為設計，不應外推為真實習性。

## 已知驗收、待補驗收與限制

2026-09-07 在 `codex/shared-scene-elements` 完成整合：

- 實際 GLB 測試通過：本體已輸出、蒙皮權重總和為1、三個網站動作各2秒、鰭骨軌道非靜止且循環首尾匹配。根節點的軸轉換亦已從GLB讀回；沒有重新執行整套Blender建模流程。
- `npm test` 17/17通過，含獨立骨架、同elapsed暫停、資源釋放與 borrowed floor／volume不被魟魚釋放；`npm run build`通過，保留既有主bundle大於500kB提示。
- 本機Codex瀏覽器1280×720確認兩隻魟魚載入、半窗至全淹潮汐、暫停／恢復與切換場景返回；error／warn為空。完整記錄見[整合驗收](../VALIDATION.md)，圖片見[海光全淹](../../exports/shared-scene-review/oceanlight-stingrays-submerged.jpg)。
- 使用者表示海光製作完成；本輪保留其完成版的造型、游姿、受光與速度，沒有再次改動美術參數。頂／側圖來自同次來源快照；studio／underside為較早版本，不作目前完整造型證據。
- 未驗證：本輪沒有重做中性光完整動作影片、所有姿態精確碰撞、實體裝置FPS／GPU記憶體／耗電，亦未逐項驗收任務書的81項條款。生物學精確比例、游速與頻率校準仍需物種條件資料。
- 已由 [PR #2](https://github.com/ianlkl11234s/quiet-places/pull/2) 合併至 `main`（`27e597f`）；正式部署未驗證。

## 後續變更紀錄規則

改動樹種、材質、光線或本生物的模型／行為時，保留本頁的已確認基準，新增日期段落並記錄：修改原因、受影響資產與程式、參考來源、座標或單位換算、物理與美術近似的分界、驗收命令／視覺條件、以及 commit（如有）。共同光路原則才更新[材質與光照製作筆記](../MATERIALS_AND_LIGHTING.md)。

來源完成版已保存為 `6a2533f`（`feat(oceanlight): add rigged stingrays and smooth tidal transitions`）；本整理已由 PR #2 合併至 `main`（`27e597f`）。


## 2026-09-09：向海的隧道 adapter

[向海的隧道](../scenes/seaward.md) 以 `src/places/seaward/Stingray.ts` 沿用同一 GLB 與 SLOW_CRUISE clip，單隻 .9 尺度、原生材質與絕對 elapsed；資產、骨架與海光之室 adapter 未修改。路徑與近地 AO 屬此房間的美術近似。新增 factory 資源／缺 clip／暫停測試通過；真 GLB 已在本機 browser 顯示，未宣稱重新驗證生物形態。

## 隧道動作偏好與防穿透（2026-09-09）

來源：使用者明確否定「撐竿跳」，要求先飛上去、轉圈、變回平面再降落。這是隧道的美術行為，不是水中魟魚生物學運動規則，也不改海光之室動作。

權威為 `src/places/seaward/Stingray.ts` 的 `sampleTunnelFlight`：10–15秒抬升、16–24秒翻圈、24–27秒回平保持、27–33秒下降；週期約44.88秒，平飛root .545 m、高點1.1 m。yaw與roll分開，保留GLB的柔鰭clip。不要恢復已撤掉的逐幀鰭尖最低點驅動root升降。

`tests/seaward-stingray.test.ts`用實際GLB變形頂點覆蓋完整46秒、每.125秒取樣，檢查至少約8cm離地，另檢查動作順序、暫停與釋放。是取樣保證，不是任意連續姿態碰撞解算；换模型、尺度或clip需重驗。採用／拒絕版本見[場景目前摘要](../scenes/seaward.md#目前狀態)。

## 雪光長廊 adapter（2026-09-12）

[雪光長廊](../scenes/snowhall.md) 再次沿用同一 GLB 與 `SRAY_ACT_SLOW_CRUISE` clip，但不沿用向海隧道的翻圈編舞。`src/places/snowhall/Stingray.ts` 以 `.43` 尺度和 88 秒低幅橢圓路徑讓單隻魟魚停留在暗面近地區域；root 約 .35–.42 m，clip 以 `.58` 倍時間取樣。這是乾燥走廊中的美術近似，沒有室內水體、浮力或生物速度量測；目前待本機與使用者視覺確認。

## 2026-09-27：Q2 A5／A7 adapter 候選（待使用者確認）

GLB 與 clip 未改（Q3 會重做模型）。海光：巡航時鰭骨相對 rest 的偏移按 radial 縮放（盤緣 .65、內側 .40，surge 時回 1），見[海光](../scenes/oceanlight.md)。隧道：翻滾改轉彎側傾（≤25°）、上升抬頭（≤20°）、路徑避開視軸、runtime 背深腹淺，見[隧道](../scenes/seaward.md)。皆為美術近似，非生物力學量測；各有常數開關可退回。

> 2026-09-27 主 agent 修正：整圈翻滾是使用者 2026-09-09 明確要求的動作，所以預設保留（`A7_KEEP_ROLL=1`）。轉彎側傾（`A7_TURN_BANK`）和翻滾互相獨立、可以並存。要不要移除翻滾，等使用者決定。

## 2026-09-27 Q3 B2 南方魟模型重做（候選待使用者確認）

狀態：**候選待使用者確認**。只做了 Blender 背景算圖與 Node 測試，尚未做瀏覽器／場景四時段驗收（V 期）。

### 形態依據（A＝來源明載，B＝依來源的形態近似，C＝美術值／查無）

| 特徵 | 等級 | 來源 | 模型做法 |
|---|---|---|---|
| 盤菱形、寬約 1.2 倍長 | A | [Florida Museum](https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/southern-stingray/)（"diamond-shaped"、"approximately 1.2 times as broad as it is long"）；[STRI Shorefishes](https://biogeodb.stri.si.edu/caribbean/en/thefishes/species/2740) 則寫 "about as wide as long" | W=1.34、L=1.117（1.2，未改尺度） |
| 吻角約 135°、吻端不突出；前緣微凸；外角窄圓或近尖 | A | STRI（"snout angular but not protruding… angle ~135 degrees"、"outer edge abruptly angular"）；[sharksandrays.com](https://www.sharksandrays.com/southern-stingray/)（"anterior margins mildly convex"，該頁無引用，信度較低）；[NCFishes](https://ncfishes.com/marine-fishes-of-north-carolina/hypanus-americanus/)（"narrowly rounded or subangular"）；[FishBase](https://www.fishbase.se/summary/Hypanus-americanus.html)（"sharp outer corners"） | `outline()`：前緣 `1.6s-.6s²`（吻端半角 67.5°）、外角在盤長 40%，smooth-min 半徑 3 cm；後緣微凸 |
| 眼與噴水孔在背面 | A | Florida Museum、[Wikipedia](https://en.wikipedia.org/wiki/Southern_stingray) | 眼窩隆起寫進盤面高度函式，眼球沉入、只露約 3.5 mm；眼緣薄皮覆蓋交界；噴水孔在眼後淺凹內 |
| 眼「relatively large and protruding」 | B | sharksandrays.com（無引用） | 以「連續的眼窩隆起」調和，不做獨立突起 |
| 吻長 < 眼間距 | A | STRI | 眼 x=±.095、y=.38，吻長 .18 < 眼間距 .19 |
| 背中線一列結節（頸到尾基）、中央小齒帶 | A | STRI、NCFishes、FishBase | 中線 2.5 mm 低脊＋貼圖點列與粗糙度帶 |
| 盤緣薄、中央厚 | B（方向）／C（數值） | 查無本種厚度數值 | 盤緣總厚約 4 mm；中央背高約 .07 m、腹深約 .03 m |
| 腹鰭小、端部緊圓 | B（該頁無引用）| sharksandrays.com。「突出盤後緣約 1/3」在該頁**查無**，不採用 | 盤後緣下方一對小葉，尖端略超出後緣 |
| 尾細長、末端尖，尾基寬扁 | A | STRI（"tail long and slender… base broad, depressed"） | 截面半寬 `.05(1-t)^2.2+.0012` m：由 10×6 cm 收到約 2 mm |
| 尾長 | A（長度）／B（受骨架限制為 1.5 倍） | Florida Museum：尾可達體長 2 倍；sharksandrays.com：完整時約 2.5×盤寬；[mexican-fish.com](https://mexican-fish.com/southern-stingray/)：可達盤長 2 倍 | 主 agent 修正任務書，改以來源為準：`TAIL_MESH=TL`=1.65 m（約 1.5 倍盤長），蓋滿既有尾骨，是不改骨架時最接近約 2 倍的長度 |
| 腹側尾褶長而高（約等於尾高），自尾刺下方到近尾端；背褶退化為低脊 | A | Florida Museum、STRI、NCFishes、FishBase | 腹褶 t=.14–.94、深度≈2×截面半高；尾刺後方低背脊 |
| 尾刺：鋸齒、長度約等於兩眼外緣距離 | A | Florida Museum | 21 cm 扁刺、兩側鋸齒；位置固定在尾根後 .11 m（Wikipedia 寫 base、mexican-fish 寫 mid-length，取近端為 B） |
| 背灰褐／橄欖、腹白帶灰褐邊 | A | FishBase、STRI、Florida Museum | 貼圖：背 sRGB (.37,.355,.285)；腹 (.90,.89,.85)，v>.8 漸變到 (.55,.50,.43) |
| 吻中線眼前淡斑；眼間與眼下較暗 | A | STRI（pale spot）；sharksandrays.com（dusky areas） | 貼圖 |
| 細微斑駁 | C | 來源多寫 "uniform"／"no markings" | value noise ±7%，刻意壓低 |
| 盤緣略透光 | C | 查無 | **不是真透射**：背面最外 10% 略亮略暖、粗糙度 −.08。未用 transmission／specular 擴充，否則 three 會改用 MeshPhysicalMaterial，也會繞過兩個場景的 onBeforeCompile 光路 |

### 契約（未改）

- 骨架、72 joints、8 clips、node 名稱／順序／階層／rest TRS、inverse bind、`SRAY_ROOT__Three_Z_Forward` 前向軸與尺度，全部沿用 B2 前的版本。`rig_width()`（舊輪廓）凍結，只給骨架與 clip 用；mesh 用新的 `outline()`，權重以新輪廓正規化的 (u,v) 對回同一格骨。
- 尾骨仍以 1.65 m 排 10 節；尾巴 mesh 蓋滿全段，tail_01–tail_10 都有權重，所以 oceanlight 的延遲彎曲可以作用到尾端。
- 97 個 node 全部保留（含 `SRAY_Eye.001`、`SRAY_Gill.009` 等）；眼、眼緣、噴水孔、口、鰓都改成貼著盤面的薄片，並用盤面同一套權重蒙皮，不再是整塊綁在 `body_mid` 的球。
- `tests/stingray-contract.test.ts` 對照 `tests/fixtures/stingray-contract.json`（從原 GLB sha256 `e5909d09…` 抽出），比對 node、skin、每個 channel 的 key 數與數值摘要、`extensionsUsed`，以及 `SRAY_Disc` 至少兩個 primitive 與盤尺度 ±2%。不改 mesh 直接重生時，契約項目逐項一致，但檔案位元組不完全相同（Blender 5.1.2）。拿其他 GLB（鯊魚）測試會失敗，確認測試確實有檢出能力。

### 數值與重建

- 重建：`/opt/homebrew/bin/blender -b --factory-startup --python assets/blender/scripts/stingray.py`。`STINGRAY_GLB_OUT`／`STINGRAY_BLEND_OUT` 可先輸出候選；`STINGRAY_REVIEW_DIR` 設定時才產生舊的 review PNG。測試用 `STINGRAY_GLB=<path>` 指向候選。
- 三角面 11,126 → 13,562；GLB 1,859,344 → 1,941,492 bytes；sha256 `e5909d09…` → `1b8c8338…`。其中凍結的 clip 資料約 1.12 MB、JSON 約 .34 MB，所以盤面網格限制在 64×39，才能維持 ≤2 MB。
- 貼圖：一張 1024² 的 baseColor atlas（上半背面、下半腹面，平面 XY 投影），JPEG q85，27 KB；另一張 256² 的 metallicRoughness，只用 G 通道，4 KB。粗糙度：背面 .70±、小齒帶 +.07、結節 +.08、盤緣 −.08；腹面 .56。尾巴、尾褶是單色（sRGB .345,.33,.265，粗糙度 .72）；眼、口、鰓、刺用 `SRAY_Detail`（粗糙度 .48）。不再使用 `COLOR_0`。
- metadata 放在 GLB 的 `scenes[0].extras.q3_b2`。

### 驗收（本機）

- `stingray-contract` 2/2、`stingrays` 2/2、`seaward-stingray` 9/9、`stingray-motion` PASS；`npx tsc --noEmit` 通過；`npm test` 206/207，唯一失敗是原本就有的 manta。
- 變形檢查：SLOW_CRUISE 第 15、45 幀與 TURN_LEFT 第 15 幀的背景算圖（只放在 scratch）中，眼、口、鰓等薄片沒有掀起或陷進盤面，腹鰭也沒有穿過後緣。
- 隧道 90 秒最低點：原 .128 m → .144 m。整個蒙皮模型到相機視軸的最近距離：原 .324 m → .328 m（離線取樣檢查，不是測試斷言）。
- 尾巴彎曲：`after/anim-turn-left-f15-top.jpg` 是 TURN_LEFT 第 15 幀，clip 裡尾巴保持中性，所以是直的。`after/anim-turn-left-f15-tail-bend-top.jpg` 在同一幀上，對 tail_02–10 各加 .08 rad，模擬執行時的彎曲，可以看到尾端跟著彎。
- 算圖放在 `exports/quality-b-20260927/B2/{before,after}/`（俯視、仰視、側面、45°、尾刺特寫、眼部特寫、clay 俯／側／45°），用 `assets/blender/scripts/stingray_review.py` 在中性光 EEVEE 下以 rest pose 算圖，不是場景光。原檔備份在 repo 外的 `.local-backups/quality-b-20260927/B2-original/`。
- 尚未做：場景內四時段、真 WebGL 下貼圖在 oceanlight／seaward 光路中的外觀、實機效能。
