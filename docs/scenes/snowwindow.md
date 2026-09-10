# 雪落海窗 · Snow Window

## 使用者已接受（2026-09-10）

使用者確認目前網站符合標準並授權 commit。現行基準為 FOV 52°、左右各 7.5°，3 水母／7 海天使。歷史「待確認」保留為當時狀態；不代表舊快取同步獲確認。製作失敗原因與下次流程見 [迭代回顧](../production/experiments/2026-09-10-snowwindow-retrospective.md)。


> 最新數量（2026-09-10）：依使用者要求，正式雪景海天使／裸海蝶由 5 隻增為 **7 隻**，水母仍為 3 隻。使用既有 CLIONE_6／7 的獨立位置、相位與頻率，其他材質、鏡頭與動態不變。模型工廠／近看工具預設及先前 Blender 快取仍為 5 隻，以下 5 隻驗收紀錄屬前版。

## 寬畫幅邊界修正（2026-09-10）

依使用者 12:36 截圖，補足寬畫面左牆外側露海及窗頂黑條。`index.ts` 左牆向左延伸至 120 m，窗下牆向下延伸；窗台／玻璃寬度延伸至約 60 m，窗上緣提升到 y=20 m，側框同步延伸。可見左窗緣與下窗緣、相機、光源強度及生物不變。這是畫框外場景包覆的美術延伸，不是建築實測尺寸；玻璃 normal repeat 保留水滴密度，roughness 不重複以免出現多條霜帶。

本機 1280×720 瀏覽器確認左側不再露海、上方斜黑條離開畫面；118 測試與 build 通過，check:project 通過。證據 `exports/snowwindow-envelope-20260910/wide.png`。未宣稱所有任意 FOV／畫幅都經驗收，尚未發布。

## 目前生物版（2026-09-10）

依使用者生物規格，接入 3 隻海月水母與預設 5 隻裸海蝶，保留以下已採用相機、冬季海景與窗光。生物位於室內窗前的不可見水介質，不新增水族箱、氣泡或人工發光；模型／材料／姿態控制與動畫資料詳見 [生物製作頁](../biology/aurelia-clione.md)。入口 `Creatures.ts`／`CreatureMotion.ts`，尺寸米、root physics 120 Hz。這版生物待使用者看圖，未提交／發布。

本次本機自動／Blender／browser 結果以 `exports/snowwindow-biology-20260910/` 及生物頁為準。先前無生物截圖仍保留作基準。

## 已採用相機（2026-09-10 12:22 截圖）

依使用者截圖指定，正式工廠位置改為 `[2.38,2.92,-1.28]` m，注視點 `[-.1,2.35,-4.82]` m，FOV 56°；工具正午 12:00，恢復基準直接讀取工廠。上一組位置 `[1.4,2.35,-.95]` 留作歷史。沿用工具原本響應式 root 平移公式，避免改變截圖中選出的相對構圖；截圖預覽畫幅為 623×694，不同畫幅仍有不同裁切。此次僅採用鏡頭參數，不另調材質／照明／動態，未發布。

## 前一輪狀態（2026-09-10 窗簾／光路／鏡頭工具）

使用者表示外景與斜角構圖已接近要求，本輪繼續修正窗簾、縮短平台、加入偶發湧浪及調暗室內；尚待這版美術確認。工作區仍為 `/private/tmp/quiet-places-snow-window-20260909`、`codex/snow-window`，未提交／發布，主工作區未改。

- **窗簾**：`Curtains.ts/gatheredCurtainPoint()`，完整垂掛布面沿左牆收攏，x 約 -2.95..-1.20 m、y 約 .06..4.72 m；不規則縱褶保存布幅，頂端固定、下段僅有毫米級室內氣流位移。霧面不透明亞麻與程序織紋；非布料解算，沒有實際紡織量測或接觸碰撞。
- **外平台**：`Exterior.ts/WINTER_EXTERIOR_PLATFORM` 深度 1.8 → 1.4 m，z=-4.5..-5.9 m；封閉雪層、混凝土支撐和海面近緣同步縮回。雪厚約 2.8 cm，仍非積雪累積模擬。
- **海浪**：96 秒週期約第 25／68 秒各有一組緩慢較大波群，額外位移包絡最大 .19／.23 m，平時保留原細波。高度與法線皆使用波群公式，過渡平滑；週期／振幅為美術參數，非流體、海況或破浪解算。
- **光路修正**：移除全域 Ambient／Directional 與外景群組裡會照到整個場景的 Hemisphere 補光。主光由窗洞上半部 RectAreaLight 代表陰天天空，下半部代表雪面反射，皆朝室內 +z。曝光維持 1.02，沒有靠整體壓曝光讓外景一起變暗；材質 albedo 不再乘第二次日照係數。
- `index.ts` 為參數權威：正午 visibility=1 時，上部區域光 .715、下部 .164、殘餘 Hemisphere .112；區域尺寸 11.86×2.18／11.86×1.48 m。這些為校準的 renderer 強度，不可當成現地 lux 或測量亮度。
- **物理界線**：陰天光從大片天空經窗洞進來，朝窗表面應較亮，側牆與深褶較暗；雪面提供少量向上反射。方向關係合理，但 Three.js RectAreaLight 與 HemisphereLight 不投陰影，本版無 GI／窗洞遮蔽求解，褶皺明暗主要由法線與光方向形成。不能稱為完整物理驗證。現地照度還需要天候、窗向、玻璃透射率及材質反射率。
- 來源：[Three.js RectAreaLight](https://threejs.org/docs/pages/RectAreaLight.html)、[HemisphereLight](https://threejs.org/docs/pages/HemisphereLight.html)、[CIE General Sky 說明](https://www.cie.co.at/publications/spatial-distribution-daylight-cie-standard-general-sky-0)。CIE 頁面說明相對天空亮度模型，並未拿來宣稱本場景經測光校準。

### 相機小工具

入口 `/tools/snowwindow-camera/`（本機 port 5198），雪景選項內亦有連結。`src/studio/SnowwindowCamera.ts` 直接使用同一 `prepareSnowwindow()`，位置／注視點 XYZ（米）、FOV、時刻可調，支援暫停、基準還原、草稿及複製 JSON。JSON 保留 viewport 和 responsiveRootOffset，避免不同畫幅的構圖無法解釋。只有明確儲存才寫瀏覽器草稿，調整不自動改正式鏡頭。工具 tone mapping／曝光與場景一致，直接 renderer 預覽，不包含主播放器額外 postprocess。

### 本輪本機驗收

- `npm test` 98/98、TypeScript、build、`check:project` 通過；build 有既有 chunk 大小提示。
- Browser 1280×720：確認收攏窗簾、縮短平台和較暗室內；工具內實際調整位置 X=1.7、注視點 Y=2.2、FOV=62，滑桿／數值連動，複製顯示成功，草稿儲存→重設→還原可讀回。已恢復基準位置和正午。未宣稱剪貼簿內容逐位讀回或手機實機驗收。
- 證據 `exports/snowwindow-refinement-20260910/`：source-baseline、camera-tool.png、scene.png 與檢查 log。玻璃、雪、海保留上一輪 3D 工廠，未使用 Blender。

## 前一輪全 3D 外景（歷史）

2026-09-10（全 3D 外景候選）：使用者已明確要求把外景底圖替換為 3D 海面、天空、窗外薄積雪，玻璃水滴／霜獨立。正式 `prepareSnowwindow()` 已不載入任何 snowwindow PNG；保留上一轮斜看角落相機 `[1.4,2.35,-.95]` → `[-.1,2.35,-4.82]`、FOV 56°，尚待使用者美術確認，未提交／發布。

### 新版權威與近似

- `src/places/snowwindow/Exterior.ts`：海面是有深度的網格，z=-6.3..-366.3 m、y=-.25 m，三組低幅位移（3.5／2.4／0.7 cm）及多頻細波法線隨 elapsed 更新。Fresnel、天空反射色和遠霧為 shader 近似；非 FFT／流體求解、沒有海浪撞擊平台模擬。
- 天空是 440 m 半徑 dome 與多尺度陰天 shader，沒有背景照片；雲並非體積雲，海面反射為天空色近似，非完整場景反射。
- 外窗台 x=-1.16..10.84 m、z=-4.5..-6.3 m。混凝土支撐厚 0.12 m，雪層底面 y=.722 m、頂面約 .75 m（約 2.8 cm 且有起伏），封閉上下／側面，避免懸空紙片。雪面細粒法線與局部天空散射補償是美術近似，沒有時間累積、沉降、融雪或熱傳。
- `Materials.ts/createWinterGlassMaterial()`：2048×1024 可重現 DataTexture，seed 20260910；水滴半徑約 3–21 mm 為美術尺度，凸起法線、下緣／左緣高 roughness 薄霜。MeshPhysicalMaterial transmission=1、IOR=1.33、thickness=.028 m（有效折射厚度近似）。折射由 Three.js 即時 transmission buffer 取實際不透明海景；透明飄雪仍走其獨立排序，不宣稱穿滴精確折射。程序冷天空 cubemap 僅作玻璃反射光源，不含海景／室內圖片。
- 光仍為窗外自然光代理：Directional／Hemisphere／window RectArea；補上 RectAreaLightUniformsLib 初始化，玻璃反射強度跟隨自然光。沒有燈具與 emissive 材質。雪面局部 diffuse 補償代表未解算的天空／雪多次散射，不是室內人工光。
- 雪粒、海面及窗簾同用播放器 elapsed；保持暫停契約。Blender 未使用：幾何與材質由 TypeScript 可重建。完整雪景工藝與光学是近似，不等同照片寫實度已經使用者確認。

### 本輪基準與證據

- cwd `/private/tmp/quiet-places-snow-window-20260909`，分支 `codex/snow-window`；沿用原有 dirty 場景，只修改雪景與對應測試／筆記，主工作區不變。
- 修改前來源保存 `exports/snowwindow-3d-20260910/source-baseline/`。舊 PNG 保留作歷史比較但不再由場景載入。
- 自動測試涵蓋閉合雪層／正厚度／海雪向上 winding、海面 update 時間、dispose 冪等，以及玻璃獨立法線／薄霜。

### 驗收結果（本機）

- `npm test` 95/95、`npm run build`、`npm run check:project`、`git diff --check` 通過。最後玻璃高光與雪粒 shader 微調後 build 再次通過，保留既有 chunk 提示。
- 968×898 本機 browser 正午／23:00 月夜可見 3D 海、白色薄雪與窗邊遮擋；暫停後相隔兩次截圖 PNG byte 完全一致。恢復正午播放交付。
- 證據：`exports/snowwindow-3d-20260910/noon.png`、`night.png`；night 是最後降低玻璃尖銳高光前的光線驗收，非另一個美術基準。測試 log 同目錄保存。
- 不宣稱完成：使用者美術確認、手機實機／FPS、跨裝置 transmission 品質、完整積雪與凝結物理、部署。海／雪／雲的程序細節仍可依使用者看圖回饋校準。

## 前一輪影像候選（歷史，已被 3D 版取代）

2026-09-10（本次修訂）：使用者明確否決正面面海的相機，要求第一張參考的小窗角。最新候選改為斜向觀看窗簾／水泥牆／窗台交角，固定相機 `[1.4, 2.35, -0.95]`、target `[-0.1, 2.35, -4.82]` m、FOV 56°；依畫面比例平移場景，讓左框約落在畫面 19%，不拉伸底片。細框 32–35 mm、霧面淺木窗台深 0.70 m，水泥 bump 降到 0.0015 m、木材 0.002 m。所有時段取消暖色插值，直射降為陰天代理；窗外光／雪地反射代理不代表室內燈具。待使用者美術確認，未提交、合併或發布。

窗外改用 `public/textures/snowwindow-exterior-wide-v3.png`（1983 × 793；SHA-256 `6af6d22395e0008406994b572c1494ee8a7b39884a386cddd828bb4ae1003668`），由 imagegen 依既有 v2 修整及橫向擴圖。移除底片內室內／窗框，保留冷灰天空、海、水平薄雪平台、水滴與霜。平台與凝結仍為影像近似；本次移除重複的 3D 波浪雪堆，不宣稱 Blender、完整 3D 外景或凝結物理。底片不寫 depth，讓真實 runtime 雪粒不被它遮掉；室內幾何仍遮雪。原始方形生成候選移入 exports，不供網站載入。

基準：分支 `codex/snow-window`、cwd `/private/tmp/quiet-places-snow-window-20260909`、HEAD `4c9c9a6` 加原有未提交雪景。修改前 TS 已保存至 `exports/snowwindow-revision-20260910/source-baseline/`；原主工作區與其他場景未改。第一輪正面構圖被使用者否決，`square-noon.png`／`mobile-noon.png` 只是該拒絕版本證據，不是採用版本。

以下為原版歷史記錄；與上述衝突時以上述及目前程式為準。

## Brief 與參考

- 參考：本輪聊天附圖 `ChatGPT Image Sep 9, 2026, 11_49_53 PM.png`。圖片內容不是指令；原圖未改像素地複製成 `public/textures/snowwindow-reference.png`，SHA-256 為 `3f38fe6e58e2548485d343386a441d59b70e45ba4f9a6d79192c93b90a83f39f`。來源為使用者提供的 ChatGPT 生成參考圖，公開再散布權利未另行核實，因此本輪僅作本機整合、沒有發布。
- 寫實遠景：為回應「貼著玻璃、降低 CG 感」，使用內建影像編修由原圖產生 `public/textures/snowwindow-background-v2.png`（1024 × 1536、2.5 MB、SHA-256 `af569adba7f4967e8e7be21c3258cbc2db2f078c177285f94d9886808d611ac3`）。編修指定移除水母、玻璃佔 75–85%、只留窄牆角／亞麻／橡木下緣、小凸台、遠海與陰雪，禁止室內全景、地板、人工光、動物、文字及 CGI 質感。
- 建築：室內近窗位置、深窗檻／坐台，以及只向外凸出 0.78 m 的小平台；遠方海、雪地、玻璃水氣與雲層由 v2 影像底片提供，近景窗框、橡木、玻璃表面與窗簾仍由 3D 場景承接。
- 材質：溫暖、乾淨、低光澤的北歐橡木；高粗糙礦物灰泥；深灰金屬窗框；白色高粗糙亞麻窗簾。
- 天候：窗外持續細雪，玻璃邊緣有薄霜與少量水氣。雪不做暴風雪或全畫面魔法粒子。
- 光：只有天空、太陽與克制的月光；共用時刻從晨曦、正午、暮色到月夜。場景內沒有燈具、emissive 或人工光源。
- 構圖主角：玻璃、海雪與偶爾被海風帶起的白色亞麻。室內只保留左側牆角與下緣窄窗台。相機 yaw 鎖為 0，確保參考圖左側水母不會因拖曳露出。

## 權威入口與尺度

- `src/places/snowwindow/index.ts`：米制窗邊角落、小平台、參考圖背景、天然光代理、固定相機與生命週期。
- `src/places/snowwindow/Materials.ts`：程式生成橡木紋與礦物灰泥；遠海／天空不再使用程序 shader。
- `src/places/snowwindow/Curtains.ts`：左側白色亞麻布面與稀疏陣風。
- `src/places/snowwindow/Snow.ts`：可重現、較稀疏且小粒徑的動態雪；玻璃水氣改由寫實影像底片提供。
- `src/places/snowwindow/Daylight.ts`：依共用 `SceneState.hour` 計算美術日照與月光，非實際地點天文模型。

可見窗約 5.46 × 3.74 m；室外平台 4.05 × 0.78 m。相機初始 `[-0.08, 1.88, -0.95]` m，注視 `[-0.68, 2.40, -4.82]` m，固定站位且不允許 yaw；FOV 為桌面 56°、窄螢幕 64°。前一個過近版本為 `[-0.08, 2.05, -1.38]` m、注視 `[-0.68, 2.60, -4.82]` m、FOV 52°／62°。這些是依附圖做的構圖校準，不是現地測量。

## 材質、光路與近似邊界

橡木為 CanvasTexture 程式紋理：四片錯色木板、細長低對比導管線、同紋理 bump、roughness 0.76、metalness 0；色調是美術值，未宣稱對應特定橡木產地或實驗室量測。灰泥 roughness 0.96 並使用同紋理 bump；亞麻 roughness 0.96、opacity 0.94。亞麻經緯紋是 shader 明暗近似，不是布料掃描或透光解算。

太陽／月光用一盞 DirectionalLight 代理，天空散射用 HemisphereLight 代理；它們代表窗外自然光路，不是畫面中的人工燈具。室內陰影使用 PCF soft shadow；沒有 GI、能量守恆或真實雪地多次反射。月夜只提供克制冷色讀感，不含日期、月相或照度證據。

玻璃使用低 opacity／少量 transmission 的 3D 表面近似；可見水氣、霜與水滴主要是 v2 影像底片的一部分，沒有凝結、融雪或熱傳模擬。平台積雪另有高粗糙白色幾何層，沒有重力堆積或足跡。遠海、雲層、遠方雪地與玻璃水氣不是可改視差的 3D 海面或流體求解；因此鏡頭固定，避免不一致的視差暴露。

## 動態、暫停與效能

雪粒以固定 seed `20260909` 建立，依絕對 elapsed 落下、橫移並循環；為避免照片雪景上疊出粒子特效感，標準品質降為 620 點、節能品質約 58%，尺寸與 opacity 同步下修。窗簾 97 秒排程中多數時間接近靜止，約第 31／74 秒有不同強度的柔陣風。雪與窗簾消費播放器 SceneClock，暫停／reduced-motion 時共同停止，不另建 RAF；影像背景保持靜止。

## Blender → 網站與來源

本版建築、木紋、布面、動態雪與玻璃表面由 TypeScript／Three.js 可重建；海雪遠景使用 2.5 MB 衍生 PNG，原始參考另保留 2.3 MB PNG，沒有 Blender 母檔或烘焙 GI。若未來加入水母，必須另建 biology 來源／模型／行為紀錄與本場景 adapter；v2 遠景沒有水母。

## 驗收

- 自動檢查：`npm test` 93/93、`npm run build`、`npm run check:project`（7 個場景／25 個必要路徑）均通過；build 保留既有 JSON import attribute 與大 chunk 警告。
- browser：本機 `http://127.0.0.1:5198/?place=snowwindow` 最新拉遠構圖於 893 × 898 驗收，console 沒有 error；先前已驗收四個精確時刻與 `waterlight → snowwindow` 切換。`exports/snowwindow-review/close-baseline.png` 保留過近基準，`farther.png`／`desktop.png` 為本輪候選。
- 未驗證：使用者美術確認、實體手機 FPS／發熱、音訊聽感、正式部署與 production readback。

## 修改與回退

第一版直接新增獨立 `snowwindow` adapter，沒有複製既有房間或改動其他場景美術。若使用者不採用，可只移除 metadata／catalog 登記與 `src/places/snowwindow/`、本頁及對應測試；不要 reset 或清除其他工作。

## 2026-09-10 本次驗收補記

- `npm test` 93/93 通過（光色／材質第一輪後）；後續只調相機、窗台／遮擋幾何與窗簾位置，最後 `npm run build`、`npm run check:project`、`git diff --check` 通過。保留既有 chunk 大小提示。
- 最新斜向候選證據：`exports/snowwindow-revision-20260910/oblique-corner-noon.png`。本機頁 12:00，暫停控制為 off；雪使用既有固定 seed，elapsed 未固定，因此不是像素確定性 A/B。
- Browser 確認左側交角與斜向下框；viewport override 曾出現截圖殘影／黑邊及 debugger 同步逾時，已 reset override，改用 AX 讀回。最新手機構圖尚無可靠完成證據，不宣稱手機驗收通過。待使用者確認此斜向角度；未 commit、push、merge 或發布。

### 2026-09-10 生物本機驗收

3 隻海月水母與 5 隻裸海蝶接入現有 elapsed／光照／dispose 流程，保留已選相機。118 個測試、build、check:project 通過；兩種生物近看與正式雪景已在瀏覽器讀回。Blender 60 秒 PC2 烘焙及 2 秒 GLB morph 匯出已驗證；資產、製作界線與未完成項目見 [生物製作頁](../biology/aurelia-clione.md)。本機成果，尚未發布或經使用者視覺確認。

## 2026-09-10 微轉與靠近修訂

使用者要求小幅左右轉與拉近；雪景 yawRange 改為 π/24（左右各 7.5°），FOV 56° → 52°，眼睛位置與中心 target 不變，Home 回復中心。此次拉近是較窄視角，不新增滾輪變焦。

水母邊緣觸鬚透明度 .33 → .16，固定 seed 的長度係數 .45..95，PBD guide 按圓周鄰近分配，保留 128 條。A／B 以 113 秒週期、43 秒錯相的平滑事件朝 +z／+x（基準觀察者方向）轉向，前景區域偏好最多 +.45 m；實際位移仍經受力／阻力／邊界，並非固定前進 .45 m。這是美術編舞，不是追蹤目前鏡頭或生物行為實測。

118 個測試通過、build 通過。既有 60 秒 Blender／PC2／GLB 是前一版歸檔，未重烘焙此次觸鬚與路徑；當前網站 TS 為新版權威，不可將舊快取描述為與本版逐幀一致。
