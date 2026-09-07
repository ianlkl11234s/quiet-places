# 海光之室：三水位海面比較

> 現行程式入口：`src/places/oceanlight/index.ts`；場景細節：`src/places/oceanlight/WindowRoom.ts`。跨場景共用元素見 [架構文件](../ARCHITECTURE.md)。下方歷史紀錄的舊路徑對應本次整理前版本。

2026-09-07。基準為已發布 `bcddfe4`；目前在 `codex/ocean-window-studies` 製作本地比較稿，尚未提交或發布，也未取得使用者選版確認。

## 本次範圍與介質

- 第三房間移除 FloorKoi 的建立、更新與載入；水光之間／樹影午後的魚不變。
- 先修正窗外海面，保留原房間、窗框與相機構圖。比較按鈕位於設定面板「窗外水位」，只在 oceanlight 顯示；三版共用同一波場和時刻。
- 暫按海水只在窗外、室內乾燥實作；半窗／全淹把窗視為理想密封觀景界面。沒有模擬玻璃厚度、壓力、破窗或室內進水。

| 版本 | 平均水位（世界 Y，m） | 可見效果 |
|---|---:|---|
| 窗下 `below` | 0.30 | 水位低於窗台，窗外保留海面與天空；舊海面平均 0.78，此版下移避免波峰穿窗台 |
| 半窗 `half` | 1.75 | 窗口垂直中心為水線，水上與水下同時可見 |
| 全淹 `submerged` | 3.35 | 高於窗頂，整個窗口轉為水下視野 |

窗口 x `[-4.7,4.7]`、y `[0.7,2.8]`，牆 z `-5`；室內相機位置 `(3,1.8,8)`，target `(0,1.65,-1)`，左右各 15°。海面只在 z ≤ `-5.14`，水下觀景界面 z `-5.13`，沒有海面延伸進房間。

## 參考來源與接入方式

- 使用者指定 [OceanThreejs](https://github.com/achrefelouafi/OceanThreejs)，讀取版本 `da18e9254a83a6e990c0077b5d752026f3d5c480`。
- [LICENSE](https://github.com/achrefelouafi/OceanThreejs/blob/da18e9254a83a6e990c0077b5d752026f3d5c480/LICENSE)：MIT，Copyright (c) 2026 mohamedachrefelouafi。
- 參考 `src/Shaders/water.vert.js`、`water.frag.js`、`Ocean/Gerstner.js`、`Utils/Sky.js` 的多尺度波浪、Fresnel、GGX、天空反射／水色思路，本地為獨立簡化實作，沒有複製其整套 FFT、GUI、HDRI 或資產。
- 本地 `src/world/OceanSurface.ts` 建立海面與天空；`WindowPlaces.ts` 建立水下界面並整合房間。未新增套件、Blender 資產或外部貼圖。

## 材質、光路與近似

- 五組不同方向的解析高度波，振幅 0.070／0.042／0.025／0.015／0.009m，理論絕對位移和上限 0.161m。水平面與窗面水線共用 `oceanHeight`，主法線用同一波場的解析梯度。
- 額外微法線表現細波，隨距離衰減；不是細波幾何。未使用完整 Gerstner 水平位移、Tessendorf FFT、JONSWAP 或流體求解。
- 天空與海面反射共用同一 `skyColor`。Fresnel 配合簡化 GGX 高光；沒有房間的平面反射／螢幕空間折射，也不是完整能量守恆水體材質。
- 泡沫是坡度與連續程序訊號門檻的美術近似，沒有 Jacobian 或泡沫累積模擬。水下使用 RGB 指數消光、散射色和低對比光帶，不是體積路徑追蹤。
- 原地牆焦散為程序投影，窗下／浸水版本分別弱化到原強度的 0.025／0.22；室內空氣光為原強度 0.18，避免以室內強光掩蓋海面。
- 海面網格 160×360 cells、115,200 triangles，近窗及中心較密、遠處較疏；遠景平面 z=-450，避免舊過遠背景被相機 far plane 裁出黑塊。
- 既有 30／24 fps、暫停與 elapsed 時間流程繼續使用。每次 factory 只建立當前場景，切換時釋放海面、天空及水下界面資源。

## 操作與驗收

本地 `http://127.0.0.1:5174/?place=oceanlight&sea=below`；`sea` 可改 `half`／`submerged`。URL 是初次載入選項，面板按鈕不改寫網址；水位選擇在本次頁面內切換場景時保留。

- Browser：1280×720 三水位、390×844 面板與半窗、方向鍵／Home、月夜亮度檢查；console 無 error。
- Build 與資源釋放／水位同步測試見本次終端結果；不把 viewport 驗證稱為實機 FPS／GPU 驗收。
- 待使用者比較選版；海浪力度、窗外色調與水下視感仍可調。未重新製作整個房間，未發布至正式站。

## 2026-09-07：以單次光線傳輸取代地板程序焦散

使用者指出半淹地板不自然，要求依太陽位置與水面折射推算光落點。本段取代前述「程序焦散」的現行狀態；前段保留初稿脈絡。

- `OceanOptics.ts`：波浪參數成為 CPU 高度／梯度與 GPU GLSL 的共同來源；`refractRay` 計算 Snell 折射與未偏振 Fresnel 透射，全反射回傳無透射光。
- 太陽方向統一為 normalize(`0.12+0.16*angle`, `max(0.12,0.90-0.95*abs(angle))`, `-1`)。天空日輪、海面高光、空氣直射、光子來源共用此方向；這仍是時刻 keyframe 驅動的美術太陽路徑，不是經緯度／日期天文計算。
- `OceanPhotonMap.ts`：外海波面取樣 → 空氣(1.0)至水(1.333) → 窗外面 z=-5.11 → 玻璃(1.5) → 窗內面 z=-4.89 → 空氣(1.0) → 第一個室內地板或左右牆落點。0.22m 是此比較稿設定的平行玻璃光學厚度，並非已驗證的窗體結構規格。
- 每個界面計算 Fresnel；TIR 時不生成 fallback 光。路徑檢查兩個玻璃面及窗框前緣 z=-4.75 的有效開口 x[-4.645,4.645]、y[0.755,2.745]。後方／未支援接收面計為未接收能量。檢查近處波峰對直射光的遮蔽。
- 水內 RGB Beer–Lambert 衰減係數 `(0.20,0.072,0.042)` m⁻¹，為水色假設，未依實測海域校準。太陽相對照度 `8*state.intensity`；接收面按 diffuse albedo/PI 轉成漫反射亮度，不宣稱 SI 校準照度。
- `OceanLightMaterial.ts` 對接收面反向追蹤上半窗空氣直射，另取樣光子貼圖；直接日光與經水面折射光互斥，移除原不連動的網狀噪聲投影。
- 光子以投影面積給能量；source domain x[-14,14]、z[-22,-5.14]，近窗及中心加密。標準 128×96、節能 64×48；15Hz 更新並凍結同一時刻給海面、窗下水線、光子與直接光，暫停時不前進。
- Floor 192×256、左右牆各256×128 的 float RGBA 線性 irradiance 貼圖。7×7／sigma1.25 texel 的正規化 Gaussian 重建核降低離散光子顆粒；核會平滑真實焦散細節，不是完整光路無偏估計。
- 房間天空入射仍是較弱 RectAreaLight／HemisphereLight 近似，未計多次反彈 GI；舊室內程序體積光關閉。窗外水下散射與微法線仍為美術近似，沒有同時升級成完整體積路徑追蹤／海洋流體模擬。

### 物理行為與驗收

- 平面水下：正午較高日光在垂直玻璃→空氣出口發生全反射，主要看到上半窗直射光帶。低角度暮色能通過水下部分，折射光落在窗邊並隨波面變化；不為了好看強制產生網狀焦散。
- 數值測試：CPU 波面解析梯度與有限差分一致；Snell 正常／斜入射與臨界角±epsilon；正午 TIR／低日可透射；平水光路落點獨立解析 oracle；窗框遮蔽、第一接收面、貼圖積分能量守恆、4倍光子取樣總能量穩定；凍結時間及資源釋放。
- Browser：半淹正午直射條帶、暮色折射光／側牆落點檢查，無 shader error。這是本地單次日光傳輸驗證，未與 Blender Cycles 建立量化對照、未驗證實機效能，尚未發布。

## 2026-09-07：清澈水色調整

- 使用者希望減少不自然的濃藍，增加透光感。水下視野與日光傳輸共用 `OceanOptics.oceanAbsorption`，RGB 消光從 `(0.20,0.072,0.042)` 降至 `(0.065,0.035,0.027)` m⁻¹；仍為美術校準值，非實測海水數據。
- 水下深色／淺色改成低飽和灰青；光帶強度係數 .24→.07，水線亮邊權重 .65→.32，海面基底同步減少藍色。
- 沒有將水下界面直接改成 alpha 疊透明，避免透出錯誤的天空；目前沒有可透視的海底或水下物件，清澈感來自吸收與散射配色，而非新增完整折射景物。
- 本地半窗正午 browser 視覺確認、無 shader error；build 與光學／水位測試通過。尚未發布。

## 2026-09-07：窗邊漏白、抗鋸齒與光路微塵

- 水下背景原先僅與窗洞同寬，位於牆後時斜視會露出天空細縫。改為 12.4×7.4m、中心 `(0,3.5,-5.13)` 的背景，由實體牆與窗框遮擋；水線仍由同一波場裁切。
- Ocean 的 EffectComposer render targets 使用標準最高4×／節能最高2× MSAA（受 GPU maxSamples 限制），場景／品質切換同步設定；窗框 roughness .82、metalness .08，減少金屬亮邊。
- `OceanDust.ts` 使用固定種子900顆柔邊微塵，節能450顆，約2px，緩慢漂移±0.11m；既有光束強度控制其可見度，暫停同樣凍結。
- 水上直射沿用接收材質的窗框／玻璃／波峰遮蔽函式；折射部分沿有效光子窗內出口至第一接收面累積32×20×48的空氣路徑場（約0.3m步進、三線性分配），與光子貼圖同時更新及釋放。微塵僅在入射光路內顯現。
- 此為稀疏粒子單次散射的視覺近似，亮度使用美術門檻；不宣稱完整體積散射、粉塵動力學或多次反彈 GI，也未對地面光子扣除微量空氣散射能量。
- 本地全淹暮色／半窗正午檢查窗邊與光路，shader console 無 error；新增光子空氣段起點、volume 非負有限值與單次釋放檢查。未發布。

## 2026-09-07：使用者確認基準

使用者確認目前半淹暮色的水色、窗景與微塵效果，要求先 commit 保存，再嘗試加強室內光線。本次基準提交包含三水位、單次日光傳輸、清澈水色、窗邊修正及微塵；本地 build 與8項測試通過，未發布。

## 2026-09-07：室內光強比較稿（未提交）

- 可回到的使用者確認基準：`33ae0cc`（clear-water lighting and dust baseline）。
- 使用者希望保留構圖／水色，另試更明顯的室內光線。日光接收面的相對強度8→12（+50%），微塵入射亮度乘1.5；窗邊 RectAreaLight 的強度係數1.8→2.4，HemisphereLight 與曝光不變。
- 僅是室內美術亮度增益，保持原 Snell/Fresnel、吸收、遮蔽與落點；不表示日照的 SI 校準改變。海面、天空、水下配色不變。
- Browser：1280×720、半窗／暮色17:30、預設視角檢查，左牆與地板光帶較亮，暗部仍保留；console 無 error。Build 與8項光學／場景測試通過。此比較稿保留在工作區，尚未提交／發布，等待使用者比較。

## 2026-09-07：光斑融入石材與柔化邊緣（比較稿）

- 使用者指出左牆亮斑像平面色塊、邊界太硬。Ocean 移除獨立 additive 投影平面，改在原 floor／左右 wall 的 MeshStandardMaterial 中加入光子與直射 diffuse，沿用原 map、bump normal 與 diffuseColor，再與其他照明一起 tone mapping。其餘牆面／葉景不套用此光子材質。
- 只在 box 朝室內的幾何面取樣，避免光子貼到外側；材質 clone 共用原石材貼圖，由場景去重釋放。照明 shader 使用實際表面世界位置，原光子貼圖解析度／光線方向不變。
- 直射窗洞／水線使用距窗深度×0.008m/m 的 penumbra 半寬（最小0.004m），保留窗框與玻璃透射判定。此為有限角光源的平滑可見度近似，會在邊界混合部分可見率，並非逐點太陽圓盤積分；折射光仍用原光子重建核，未宣稱完整物理解算。
- 半窗暮色17:30、1280×720 browser 檢查：左牆亮斑可見石材細節、遠處地面邊界漸柔，海景構圖保持；shader console 無 error。Build及8項光學／生命週期測試通過。基準仍為 `33ae0cc`，此比較稿未提交／發布。

### 修正版確認

使用者確認上述室內光強、石材受光與柔邊修正版，授權獨立 commit。此次提交包含前述未提交的光強比較稿及光斑修正；原基準 `33ae0cc` 保留於歷史。本地 build、8項測試與 browser 驗收結果如上，尚未發布。

## 2026-09-07：兩隻近地魟魚（本地完成，待使用者比較）

- 使用者要求在既有空間近地板加入兩隻魟魚，先用 Blender 建模；舒緩橫向8字，偶有短暫加速、抬升與滑降，游姿盡量接近真實。
- 房間仍沿用乾燥內部／窗外海水的光照基準。魟魚在室內游動是使用者指定的夢境設定，不表示已建立室內水體、浮力或流體模擬。
- 形態參考 Florida Museum [Southern Stingray](https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/southern-stingray/)：菱形胸鰭盤、背面眼與噴水孔、腹面鰓裂、淺腹深背與細長尾。原創底棲魟魚造型，不宣稱某一物種的精確解剖重建；參考照片不嵌入資產。
- 游姿依據 [Rosenberger & Westneat 1999](https://pubmed.ncbi.nlm.nih.gov/10574730/) 的胸鰭波動與速度關聯，以及 [SICB 三維胸鰭游姿研究摘要](https://sicb.org/abstracts/stingray-swimming-in-3d-pectoral-fin-locomotion/) 的前至後推進波。8字路徑、短衝頻率、速度及高度是美術編排，並非實測習性或自主生態行為。

### Blender 資產與網站接入

- 可重建腳本 `assets/blender/scripts/stingray.py`，可編輯母檔 `assets/blender/stingray.blend`，網站模型 `public/models/stingray.glb`；以獨立背景 Blender 製作，不改使用者 GUI 場景。原創幾何與頂點色，未使用下載模型或照片貼圖。
- 最終 GLB 303,780 bytes／7,660 triangles；翼展1.568m、盤長1.25m、含尾總長2.545m。第一隻scale1、第二隻.9。灰褐背部 roughness .74、COLOR_0 微斑駁，浅色腹部、較小的背側眼與眼瞼、噴水孔、腹側口及10條鰓裂；形態仍是美術重建。
- Blender→glTF `export_yup=True`，根節點Y軸180°旋轉補正，最終局部+Z鼻向／+Y上方。Disc與Whip_Tail匯出同序 morph `WaveSin`／`WaveCos`；signed weights `sin(phase)*amplitude`／`cos(phase)*amplitude` 將 `-sin(kZ)`／`cos(kZ)` 組成往-Z尾端行進的波，中心頭部保持穩定。
- 魟魚沿用室內直射窗框可見度、光子volume的弱折射亮度提示，另依朝窗方向與距離近似天空反射。接近地面的淡橢圓陰影為高度衰減的AO美術提示，未建立魟魚對室內光子的完整遮擋與多次反彈GI。
- 模型預覽 `exports/blender-review/stingray-studio.png`；母檔背景重開與GLB morph/朝向檢查通過。GLB SHA-256 `eb03947f65e3398688e002d5a6d7e3b32f42892feb35b8bace2d4f6e61cf5812`。

### 動態與驗收

- 兩條错位橫向8字路線採弧長查表，中心z=0／2，x約±3.1m、z[-2.75,4.75]m；中心高度約.835..1.265m。速度0.32–0.80m/s、平滑短衝伴隨最高.28m抬升與回落，皆為療癒感美術參數。
- 轉向由路徑切線決定yaw，完整高度導數決定pitch，另加克制bank；未截斷時間／距離驅動鰭相位，跨圈不跳拍。兩隻節奏錯開，不靠每幀亂數或時間積分，暫停及同elapsed完全重現。
- 路線15分鐘取樣：中心最小距離約1.68m，位置／姿態／鰭波跨圈連續、腹部朝下；此為預編路線驗證，不是自主覓食、捕食或全身碰撞避障模擬。

- 胸鰭相位 `time*1.1+distance*4+個體相位`，頻率約.38–.68Hz、幅度乘數.6–1.2；是參考前後傳波機制的美術標定，非研究的物種實測值。

- 最後一輪模型驗收修正：鰭緣約2cm、中央較厚；口／鰓裂依實際腹面曲線貼合，噴水孔為暗色淺凹。只有disc使用頂點色材質，其餘皮膚使用獨立實色PBR，消除缺少COLOR_0造成的過白細節。腹面圖 `exports/blender-review/stingray-underside.png`。
- 本地半窗暮色browser實際載入兩隻魟魚、觀看不同游姿、操作暫停、切換樹影再返回海景成功，console無error；10項光學／場景／魟魚路徑及資源釋放測試通過，build通過。沒有實機FPS或生物力學定量驗證。
- 光影基準commit `3aade78` 保留，本次魟魚尚未commit／發布。

## 2026-09-07：魟魚造型／游姿研究，暫停實作

使用者回饋：想稍微縮小、造型偏卡通、尾巴不自然、泳姿與速度不匹配；要求先研究類似案例再確認優化。本輪不更動模型／runtime，只記錄研究與提案。

### 可參考案例（作者／原始來源）

- [MotionCow Stingray](https://www.turbosquid.com/3d-models/stingray-708429)：作者提供rig、wave-like swim loop與Blender/FBX等格式；適合評估胸鰭輪廓和循環動畫的完成度。商用授權資產，未購買／下載，不把作者的photorealistic描述當作已驗收。
- [PollyMax Stingray Animated](https://www.turbosquid.com/3d-models/3d-stingray-animated-model-2354956)：Maya/FBX，頁面列動畫／rig預覽；可作外觀與綁定參考，未驗FBX→Blender→glTF完整保真。
- [g.lerf Low Poly Stingray](https://glerf.itch.io/low-poly-stingray)：作者明示Blender製作、rigged、FBX+textures+swim，CC BY4.0。適合技術流程對照，但low-poly定位不直接解決寫實外觀。
- [FishSim](https://github.com/nerk987/FishSim)：target motion→effort/mass/drag→游動動作的工作流值得參考；現成rig主要Shark/Goldfish，不當成直接可套魟魚的解法。
- [Hey stingray!](https://blenderartists.org/t/the-hey-stingray-project-modelling-rigging-and-animating-underwater-world/543206) 有雕刻、重拓樸、Spline IK等製作紀錄，但留言指出影片失效，本輪未能確認可播放，不列為主要實作依據。
- 以上商用／免費動畫尚未下載或逐幀驗證；沒有將案例模型或貼圖加入本專案。

### 生物／模擬研究

- [Sumikawa et al. 2022, Scientific Reports](https://www.nature.com/articles/s41598-022-05317-5)：實際使用Blender建立研究模型，以左右胸鰭相位差進行CFD；頁面附海遊館魟魚觀察影片。可支持左右鰭相位與操控的研究方向，但其簡化薄體不是製作寫實模型的解剖標準。
- [Blevins & Lauder 2012, Rajiform locomotion](https://dash.harvard.edu/bitstreams/7312037d-ffa9-6bd4-e053-0100007fdf3b/download)：研究個體的平均U/c約0.7，頻率／波速隨游速變化；數據有物種、體型與實驗條件，不可將其Hz直接套到本模型。

### 目前程式的可定位問題與提案

- 造型由橢圓極座標盤＋隆起函式形成，頭、胸鰭前後緣的區分不足；眼周仍是獨立小幾何。建議先選同一底棲魟形態，以俯視／側視照片重整鼻端、眼窩、胸鰭輪廓和尾根，最後再補皮膚細節。
- 暫提兩隻等比縮小15%，翼展約1.33／1.20m；縮放後同步校準速度和世界尺度波長，不只縮物件。
- 当前角波數7 rad/m、角頻率ω=1.1+4U，第一隻在U=.32/.80m/s時波速c=ω/7約.34/.61m/s，U/c約.94/1.30。第二隻scale.9且同速，比例更高。這是目前wave模型的解析診斷，非完整水動力測量；解釋了加速時視覺上的滑移不匹配。
- 擬讓目標速度／簡化推進與阻力統一決定胸鰭波速、頻率及振幅；加速先增加鰭動作，身體速度平滑跟上，放鬆後保留滑行，不讓速度／高度和鰭振幅同時機械地套同一pulse。
- 尾巴目前8.2 rad/m正弦與胸鰭共用相位，長尾約1.8個波，且尾根仍有非零位移。擬將尾根固定、尾巴獨立成6–10節骨鏈／Spline IK，轉彎與加速驅動延遲、阻尼及逐段收斂；停止持續的蛇形驅動。此為被動拖曳的動畫近似，不宣稱已量測魟魚尾部剛性。
- 驗收順序：中性光下單隻靜態三視圖→直游／加速／轉彎／滑降短片→確認動作再回暗室放兩隻。先證明造型與游姿，避免以暗光或複雜路線掩蓋問題。

## 使用者提供的 Southern Stingray 任務書評讀

- 來源：`/Users/migu/Downloads/Codex 任務書｜Southern Stingray Blender Procedural Rig & Animation System.md`。使用者本輪要求參考，尚未要求立即執行文件全部81項完成條件；本輪維持研究／設計，不改資產。
- 採用方向：明確Southern Stingray形態；前後截面寬度取代橢圓極座標盤；Armature+Actions+可重建Python；分散胸鰭控制與中心剛性；被動尾骨鏈；中性光輪廓、跨圈與離地驗收。
- 實作前修正文件§23/58：變動頻率不能直接用f(t)*t作相位，應用2π∫f(t)dt，否則瞬時頻率變成f+t*f'並隨時間漂移。
- §21的u/v是無單位座標；不能直接將dz/du或dz/dv送入atan視為幾何角度，應利用實際三維參數曲面切線／局部米制距離得到斜率與旋轉。
- §48循環與§22–24非整數週期微變化需協調：先產生精確loop hero Action，再做跨clip相位連續的非循環organic層；尾巴需預熱並烘焙一致初始狀態。
- §32/62/78需補網頁規格：Blender+Y前/+Z上，匯出Three+Z前/+Y上；drivers/constraints/NLA結果烘焙成可匯出骨動畫。In-place與root-motion分開，網站8字路線不可再疊加clip平移。
- 預設尺寸、.72Hz、wave_count1.25等是美術起點；仍需依縮放後盤長校準U/(fL/k)，不能把所有預設直接稱為生物學正確。
- 後續建議先做縮小約10–15%的單隻造型＋SLOW_CRUISE＋TURN＋RISE/SETTLE，通過中性光短片後才擴展多Actions與網站雙魟魚。此為實作順序建議，不表示放棄文件的其他可延伸功能。

## 2026-09-07：場景目錄與共用元素整理

- 在 `codex/shared-scene-elements` 將場景程式集中到 `src/places/oceanlight/`；保留本場景材質、光路、鏡頭與動態的既有參數。
- 共用狀態由 `player/contracts.ts` 定義，水體數學／亂數／模型資源按實際需求引用 `shared/`；不把場景曝光、天空或光學近似共用化。
- 整理分支尚未提交或發布；視覺驗收範圍見 [驗收記錄](../VALIDATION.md)。

### 整理時的魟魚草稿狀態

- 取自原工作區當時的13檔快照；複製前後 hash 一致。該工作區仍在持續製作，本分支不代表它之後的最新版本。
- GLB SHA-256：`6575ac4c70f87280553abb224d0657a95459687cd80f577d6c7818f9a0dbc7ad`；動畫片段：`[]`。程式預期 `SRAY_ACT_SLOW_CRUISE`、`SRAY_ACT_TURN_LEFT`、`SRAY_ACT_TURN_RIGHT`，目前不匹配，整理前 browser 因而無法載入海光。
- 完整保留 `src/places/oceanlight/studies/`、GLB、Blender 母檔／腳本與既有預覽，正式 adapter 暫不接入。重新接入前需驗證真實GLB的clip名稱、骨架與游姿；合成fixture的單元測試通過不能取代此驗收。


## 2026-09-07 Southern Stingray 網站整合完成（本地待使用者驗收）

使用者已要求直接完成並在網站驗收；本節取代上節「僅研究」的執行狀態。保留 `3aade78` 房間光影基準，本輪尚未 commit／發布。

- 自製程序模型：`assets/blender/scripts/stingray.py`、`assets/blender/stingray.blend`、`public/models/stingray.glb`，沒有使用案例的商用資產。以任務書 Southern Stingray 輪廓為方向，非掃描或經生物學量測模型。
- 盤寬1.34m／盤長1.117m，尾長1.65m；第二隻scale .9。截面式菱形盤、上下表面厚度、眼／噴水孔／腹側鰓與尾側摺膜。中性光預覽為 `exports/blender-review/stingray-top.png` 與 `stingray-side.png`；studio／underside舊圖屬前版。
- 56胸鰭控制骨（每側7×4），中心剛性，雙線性蒙皮；10尾骨，鄰骨插值。原生+Y前/+Z上，以根物件Z旋轉π配合glTF軸轉換成網站+Z前/+Y上。
- 八個烘焙Actions，30fps。網站使用SLOW_CRUISE與左右TURN三個精確2秒單週期；以相位同步混合。其餘hover/cruise/rise/settle/rise-and-settle保留在Blender；RISE／SETTLE是非循環動作。參數由Python settings表調整，未提供完整任務書延伸的互動driver面板。
- 波由前往後，wave_count1.25，米制曲面斜率轉成局部骨旋轉；中心振幅趨零。網站以累積路程積分相位，依縮放後身長與U/c=.65美術校準，非直接f(t)*t。
- `StingrayMotion.ts`：弧長校準的橫8字路線，速度約.20–.48m/s，平滑短加速與低幅升降；整體靠近地板。15分鐘採樣最小中心距1.898m。尾巴以身體歷史方向／仰角逐節延遲，尾根固定，沒有持續主動蛇形正弦。
- `Stingrays.ts`：SkeletonUtils獨立複製骨架、AnimationMixer相位控制、凍結時不累積骨旋轉；表面沿用房間光路與體積光資料，地面軟影為美術接觸陰影近似。未做CFD／完整流固耦合，也不聲稱已證明所有姿態的精確碰撞。
- 驗收：production build；運動與資源釋放fixture；直接讀實際GLB驗證模型、蒙皮權重、非靜止鰭骨軌道與循環接縫；本地5174半窗瀏覽器確認兩隻完整顯示。網站驗收入口 `http://127.0.0.1:5174/?place=oceanlight&sea=half`。本地可見不等於正式發布。

### 2026-09-07 魟魚受光對齊樹影午後鯉魚

- 使用者確認游姿OK；本輪不改路線、骨動畫及速度。
- 對照 `BlenderKoi.ts/installDiffuseFill`：採相同朝窗天空漫射、朝下腹部地板反射、微量暗部反射方式。海光場景使用自身窗洞位置與日照強度；地板照度從現有 `photons.textures.floor` 加上有限窗洞日照計算取得，取代鯉魚的shadow-map查詢。不是複製樹林的窗戶座標。
- 移除魟魚額外均勻補光，以及缺少窗框／水位遮蔽的RectAreaLight鏡面與漫射回應；由已傳輸日光／水下光體積提供直接漫射，天空與地板提供方向性間接漫射。不加emissive；表面反射為漫射近似，未新增完整鏡面光路或魟魚形狀投影。
- 白邊另有資產原因：POINT頂點色讓白腹顏色插值到深色側緣。改CORNER逐面顏色，保留白腹，側緣維持背部色；重建blend與GLB及兩張預覽。新GLB SHA256 `e5909d095f4c09971b35e917e7c8b16e3a3468405b798373da8837d24bc89061`。
- 驗證：build通過；GLB蒙皮與骨动画loop／獨立實例／暫停／釋放檢查通過；5174半窗本地瀏覽器檢查。待使用者網站視覺驗收，未commit或發布。

### 2026-09-07 水位切換的漲退潮過渡

- 窗下 .30m、半窗1.75m、全淹3.35m保留；切換採7秒quintic smootherstep水位插值，起訖速度／加速度為零。中途重選從目前高度開始新過渡，位置不跳動（不保證反向重選的速度連續）。
- 首次從URL／場景初始化直接顯示指定水位。沿用elapsed動畫時鐘，暫停流動也暫停潮汐。此為美術時間壓縮的水位動畫，不是潮汐流體或天文模型。
- 海面、窗下水色、直射透光、灰塵、魟魚受光共用當前水位；窗戶補光依高度連續插值。昂貴光子計算維持15Hz，日照方向／品質設定改變可立即更新。
- 本地build通過；5174半窗→全淹瀏覽器起訖檢查。未commit／發布。


## 2026-09-07：完成版整合至共用目錄分支

- 依使用者「海光已做完」的指示，將完成版模型、骨架動畫、表面受光與7秒潮汐接回 `codex/shared-scene-elements`。前述缺clips、暫不載入的紀錄為整理當時狀態，已由本節取代。
- 現行程式位於 `src/places/oceanlight/{Stingrays,StingrayMotion,WindowRoom,index}.ts`；保留原作的數值／shader／路徑，接上共用模型資源釋放。GLB與母檔由同一次穩定快照取得；來源hash見 `exports/shared-scene-review/ocean-completed-source-snapshot.json`。
- 生物本體、骨架、動作及參考任務书集中在[生物文件區](../biology/README.md)，魟魚入口為[Southern Stingray](../biology/southern-stingray.md)。本場景頁保留海光受光、水位和接入紀錄；生物資料不再只能從場景歷史中找。
- 尚未commit／PR／發布；本次整合驗收記於[驗收記錄](../VALIDATION.md)。


### 來源工作區後續確認

整合期間，來源場景筆記追加使用者已確認造型／游姿、受光與潮汐效果「很好」，並授權來源工作區保存本地基準。本整合保留同一份模型與程式；來源工作區的提交和本整理分支的提交／發布狀態分開記錄。

來源完成版已保存為 `6a2533f`（`feat(oceanlight): add rigged stingrays and smooth tidal transitions`）；本整理分支仍是本地未提交整合。
