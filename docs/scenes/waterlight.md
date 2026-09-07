# 水光之間／Waterlight：場景規格

> 現行程式入口：`src/places/waterlight/index.ts`；場景細節：`src/places/waterlight/Environment.ts`。跨場景共用元素見 [架構文件](../ARCHITECTURE.md)。下方歷史紀錄的舊路徑對應本次整理前版本。

> 集合架構見 [ARCHITECTURE.md](../ARCHITECTURE.md)，集合規格見 [PROJECT_SPEC.md](../../PROJECT_SPEC.md)。本檔由原單場景規格搬移，保留驗收紀錄；舊勾選不代表所有裝置均已驗證。

## 產品定義

水光之間（Waterlight）是 Quiet Places／靜隅裡的一個即時 WebGL 場景：空無一物的暗色房間，天花板中央有一片水面，單一清晰光源穿過水面，將緩慢波光投到地面與牆面；少量魚在光影間游動。目標是 Perceptual Realism（視覺感知逼真），不是物理正確的水、光線追蹤或流體模擬。

## Visual Contract

- 第一眼應為白天；使用者可選擇使用即時本地時鐘，或固定白天初始狀態。
- 暗色、高挑、空曠房間；依使用者新增需求，鏡頭沿天窗垂直軸左右各 45° 環繞，鎖定距離與俯仰，不開放自由平移。
- 天花板水面是唯一明確光源；大部分空間保持陰影，光只揭示空間而不展示裝潢。
- 不加入家具、人、文字裝飾、額外燈具或奇幻／水族館／科技展示元素。
- 水面、caustics、可調強度體積光柱與少量浮塵共同表現「水改變了光」。

## 技術邊界

- Vite + TypeScript + Three.js；不使用 React。
- UI 使用 HTML/CSS overlay；音訊使用 Web Audio API，且必須由使用者操作後才啟動。
- 使用 shader、程序式 caustics、簡化 volume mesh 與 steering/boids 取得感知效果；不得宣稱為物理模擬。
- 桌面與手機皆可用；依 viewport、pixel ratio 與 GPU 能力調整品質。
- 預設支援 WebGL；WebGL 不可用時顯示可理解的 fallback 狀態與重新嘗試／降級提示。

## 里程碑

### M1 — 空間骨架

建立 Floor、三至四面牆、Ceiling 與中央方形 ceiling opening。材質保持深色、霧面、低紋理；受限環繞鏡頭，支援 resize 與 desktop/mobile aspect ratio。

### M2 — 水、光與空氣

加入天花板水面（慢速大波、細波與 noise 的程序式 shader）、單一清晰日光方向、低 opacity volume beam、只出現在光照區的 animated caustics mask，以及集中於光柱中的少量慢速 dust particles。Caustics 應投射到地面、後牆、少量側牆；魚體焦散留待下一版，不應無差別照亮全室。

### M3 — 魚群生命感

預設 9 尾程序式魚（可在品質層級下降數量），以 separation、alignment、cohesion、wander、boundary 與輕微 light attraction steering 游動。每尾魚有獨立位置、速度與方向；尾部以 shader 或等效程序式形變，不使用可辨識的固定 loop。魚需保留大量空間，不形成水族館密度。

### M4 — 日間控制與安靜體驗

提供最小控制：白天／時間選擇、即時本地時鐘切換、暫停與 reduced-motion。時間改變應緩慢影響光角度、色溫、強度與水面氣氛；可選的 quiet audio 預設關閉，無自動播放。頁面 hidden 時暫停或顯著降低 animation、simulation、audio 與粒子更新。

## 品質與狀態

- 首版依視窗大小限制 pixel ratio；高／中／低品質選擇、粒子與魚數分級留待裝置效能量測後決定。
- reduced-motion 必須尊重 `prefers-reduced-motion`，並提供可見的手動切換；暫停後可恢復且不跳幀。
- 任何資源、WebGL 或 audio 失敗都要保留可理解的錯誤狀態，不把失敗默認成正常黑畫面。

## 驗收（本次證據見 ../VALIDATION.md）

- [x] M1 桌面與手機 viewport 均呈現受限環繞空房間鏡頭，無家具、人或額外裝飾。
- [x] 首次進入為白天感；使用者可選固定狀態或 live local clock。
- [ ] M2 水面波動慢且不呈規律遊戲波；光源仍只有天花板水面方向。
- [x] Caustics 只在 sunlight mask 區域可見，且主要落在地面／牆面。
- [x] 保留使用者已接受的明顯耶穌光與 0–250% 控制，背景仍維持暗室；不以「越淡越好」取代已接受方向。
- [ ] M3 正常品質可觀察到 9 尾魚，各自 steering，無同步循環。
- [ ] M4 控制、pause、reduced-motion、hidden-page pause 與可選 audio 均可操作。
- [ ] desktop/mobile 與 WebGL fallback 均可讀且不崩潰。
- [ ] 本機瀏覽器檢查通過主要視覺與互動 acceptance。

## 風險與參考

視覺參考的 fidelity 是 aspirational；水、caustics、體積光與魚群均為感知近似，效果會受 GPU、瀏覽器、螢幕與手機效能影響。最大風險是 caustics 過亮、魚過密、粒子過多、光柱過實，以及即時時鐘造成突變；優先維持空白、慢速與單一光源的視覺契約。

## 2026-09-07：淺海天窗製作分支

- 分支：`codex/waterlight-shallow-sea`；worktree：`/private/tmp/quiet-places-shallow-sea`。從 `bcddfe4` 建立，再複製 `codex/ocean-window-studies` 當時尚未提交的工作內容，才能沿用最新 Ocean 模組。繼承的變更不等於本次新增工作；原工作區保持原狀。
- 使用者目標：開口上方是一片高透明度淺海，日光穿過水面進入室內，讓波光與照明更自然。保留原房間、魚、受限環繞鏡頭、晴雨與光束強度操作。
- 介質設定：室內仍為空氣，天窗為理想密封透明底面，淺海在上方延伸；不模擬結構承重、玻璃厚度與室內進水。魚仍是既有美術設定，不據此宣稱室內充水。
- 模組来源：沿用本地 `OceanOptics.ts` 的解析海浪與清水吸收設定；上游設計參考及授權沿用 [Oceanlight 筆記](oceanlight.md)。無新增下載資產、套件或 Blender 轉換。
- 預覽：`http://127.0.0.1:5175/?place=waterlight`。實作參數、驗收與限制於本節後續補記。尚未提交、發布或取得使用者視覺確認。

### 參數與近似邊界

- `ShallowSeaOptics.ts` 定義密封底面 Y=7m、平均水深 0.8m；共用 Ocean 五組波浪的最大振幅總和 0.161m，晴日基礎波場不會露出底面。這是場景尺度設定，非實测海域資料。
- 水中 RGB 吸收沿用 `(0.065, 0.035, 0.027)` m⁻¹，視線依水中路程做指數衰減；高透明度透過低吸收與折射後天空形成，非把整片材質 alpha 調低。
- 天窗從室內先穿平底界面（air→water），再穿海浪自由面（water→air）；全反射保留反射色。密封底面省略玻璃層，沒有完整多次反射或水體體積散射求解。
- 保留原場景偏左、朝後牆的日光構圖，`shallowSeaSunDirection` 將該方向集中管理；不是天文太陽位置。焦散改由共用海浪折射位移的局部 Jacobian 估算光聚散，仍有限幅／柔化，未移植 Oceanlight 垂直窗專用光子追蹤器。
- 光柱、魚與房間間接光仍含原本美術近似，不能將本稿描述成完整物理正確照明或 Blender Cycles 對照結果。

### 本機驗收與交付狀態

- 最終只繪製天窗密封底面；在 shader 內求上方連續海面的交點與雙界面折射，已刪除被底面永久遮住的舊水面／天空 mesh 與孤立 shader。不是新增可自由航行的外部海景。
- GPU 雨滴／點擊擾動同時進入上表面的高度與法線，高度倍率3與梯度倍率一致，world Z 導數採用反向 UV V。天空加入經折射取樣的低對比薄雲，晴雨水色仍為美術設定。
- 整合修正：水面出口 Fresnel 法線正負號、焦散位移的重複距離倍率、全反射不生成焦散 fallback。局部 Jacobian 仍以平均光路回推取樣，不是逐接收面精確光子反解；牆面聚散和空氣光柱維持近似。
- 焦散增益由初稿0.48降為0.16；光柱積分係數0.22→0.18，內部條帶權重降至0.8，保留100%預設與原0–250%控制範圍。這些為美術相對值，不是 SI 校準量。
- `npm run build` 通過，僅有既有 bundle size warning；`git diff --check` 通過。沿用模組的 `node --experimental-strip-types --test tests/ocean-optics.test.ts tests/ocean-photons.test.ts tests/window-places.test.ts` 共8項通過；這些是共用 Ocean 基準測試，不等於新天窗 shader 的數值正確證明。
- Browser：1280×720 正午／暮色、暫停及恢復、晴雨切換／重設水面；390×844 雨日可見水面漣漪與地面聚散，房間及天窗無破面。最後恢復正午晴日、標準品質、100%光束與正常動畫。
- 開發中 HMR 曾顯示已移除變數 `waterUniforms` 的 ReferenceError；最終清理並 reload 後沒有新增 runtime／shader error。畫面證據在本次 Codex browser 工具輸出中，未另存成圖片檔。
- 尚未做實機 GPU／FPS、Blender 對照、正式發布或使用者視覺確認。初次驗收為本地草稿；使用者後續已授權以此版本開 PR 並合併。

## 2026-09-07：場景目錄與共用元素整理

- 在 `codex/shared-scene-elements` 將場景程式集中到 `src/places/waterlight/`；保留本場景材質、光路、鏡頭與動態的既有參數。
- 共用狀態由 `player/contracts.ts` 定義，水體數學／亂數／模型資源按實際需求引用 `shared/`；不把場景曝光、天空或光學近似共用化。
- 目錄整理已隨 [PR #2](https://github.com/ianlkl11234s/quiet-places/pull/2) 合併至 `main`（`27e597f`）；視覺驗收範圍見 [驗收記錄](../VALIDATION.md)。

## 2026-09-07：長鰭錦鯉重做（本機完成）

- 基準 `cf456fe` → 分支 `codex/waterlight-long-fin-koi`，工作區 `/private/tmp/quiet-places-long-fin-koi`，預覽 `http://127.0.0.1:5182/?place=waterlight`。原工作區未提交的 UI 改動保留在原處。
- 使用者指定依完整 Long-fin Koi School 手冊重做，七尾低飽和長鰭錦鯉取代本頁歷史 M3 的九尾簡化程序魚；新驗收以本節與[生物製作頁](../biology/long-fin-koi.md)為準。
- 保留既有房間、天窗、水面、焦散與光柱。手冊要求的 Blender 暗室是可重用資產展示／檢視場景，不替換網站已確認的環境。
- 魚模型、骨架、動作、群游、尺寸與 Blender → glTF 轉換記於生物頁；場景專屬光柱位置、高度與本機構圖驗收在本節補記。
- 本輪已完成七尾長鰭錦鯉的 Blender MCP 母檔、八類循環動作、NLA群游與網站GLB接入。每尾實際全長 .28/.31/.34/.37/.39/.42/.45m，24骨獨立蒙皮，低飽和配色與不同節奏。
- 網站活動範圍依既有斜光柱投影，主要高度約2.2–4.8m，水平橢圓半徑 .94/.76m。實測20分鐘速度不超過 .11854m/s，中心間距不小於 .31553m；無hard position clamp，並非完整鰭面碰撞求解。
- 新魚材質使用既有場景燈光；不增加魚身emissive。網站薄鰭的alpha/depthWrite/transmission與subpixel鰭條處理見生物頁；Blender環境和網站環境分開，沒有替換水面或焦散。
- Node 26/26與build通過；browser桌面1280×800、手機尺寸390×844、暫停像素一致／恢復、切換到樹影再返回通過。真資產、圖像和log见[生物製作頁](../biology/long-fin-koi.md)。手機尺寸模擬不等於實體手機效能驗收。
- 未提交、發布或取得使用者視覺確認；保留獨立worktree供後續看圖調整。

## 2026-09-07：網站魚群增加為 16 隻

依使用者追加要求，網站改為16隻，重用Blender製作的七種造型；Blender母檔與GLB仍是七種資產庫。每隻使用SkeletonUtils.clone建立獨立骨架與mixer，共用幾何和材質，釋放時包含所有clone skeleton。全長0.28–0.45m，初始高度2.45–4.31m加±0.05m擾動，以黃金角錯開位置，獨立動畫相位。

密度增加後，光柱回游係數從0.28調至0.36，朝向跟隨係數28→44 s⁻¹，低處回游從Y=2.30m開始。這些仍是美術運動學參數。20分鐘測試：最大速度0.118124m/s、最小中心間距0.243899m、最大標準化光柱半徑0.951743；中心間距不代表完整鰭面碰撞檢查。

Node測試26/26與build通過，涵蓋16實例、重用造型的骨架／動畫相位獨立、暫停及共享資源只釋放一次。瀏覽器實際載入16隻、七種造型，桌面構圖可見增加後的魚群。[16隻桌面圖](../../exports/long-fin-koi-integration/waterlight-16-desktop.png)；測試與build記錄為exports/long-fin-koi-integration/tests-16.log與build-16.log。仍在獨立worktree，未提交或發布。

## 2026-09-07：16 隻魚群分散調整

使用者希望更分散：活動橢圓半徑由0.94／0.76m加寬為1.60／1.25m；初始水平散布同步拉開，仍採黃金角錯位。鄰魚分離半徑0.70→0.95m，聚攏係數0.035→0.012；回游從標準化半徑0.65開始、係數0.28，允許魚在光柱周圍散游。維持16隻、原有大小與緩慢游速。

20分鐘數值驗收：最小中心間距0.563102m、最大速度0.122185m/s、最大標準化活動半徑0.943092。沿用26項測試與build通過，另將長跑最小中心間距門檻提高至0.45m並通過；不是完整鰭面碰撞證明。記錄：exports/long-fin-koi-integration/tests-spread.log、motion-spread.log與build-spread.log。CUA實際檢視目前5182預覽，魚群分布較寬且保留天窗／光柱構圖；畫面證據見本次工具截圖。未提交或發布。

## 2026-09-07：偶發短暫加速預覽

依使用者要求，先將16隻分散慢游基準提交為`25bc75f`，再製作尚未提交的活力預覽。網站重用原Blender骨架與動作；每尾首次加速時間錯開，後續每次起點相隔30–65秒，同時最多兩尾進入3.5–5.5秒的sin²加速／收速包絡。其他魚繼續原有慢游、停留及轉向。

額外水平推進最高0.23m/s，鄰魚中心距離0.65–1.10m間平滑收速；分離係數0.52、加速時提高邊界回游力，低處回游起點Y=2.40m。速度硬上限0.34m/s，朝向跟隨70s⁻¹。加速時混入SLOW_CRUISE，尾鰭動畫時鐘沿用實際速度驅動，暫停不推進，加速在reduced-motion下禁用。仍是運動學美術近似。

20分鐘測試：最大速度0.248507m/s、最小中心間距0.572541m、最大標準化活動半徑0.965845；檢查快魚與慢魚同時存在、最多兩尾加速、最小間距仍超過0.45m。26項測試與build通過，記錄在exports/long-fin-koi-integration/tests-lively.log及build-lively.log。CUA在5182實際檢視載入與不同時刻姿態，保留光柱周圍的分散構圖；本次沒有重新匯出Blender或發布。

## 2026-09-07：光束柔化與水波連動預覽

使用者指出側向光束像硬直條紋。本輪只修改Environment.ts的體積光shader：去除roof.x正弦光柵，改為兩層寬尺度noise光帶（1.65／3.1m⁻¹，權重0.78／0.22），平滑密度範圍0.18–0.86；開口邊緣柔化寬度隨離天窗距離由0.20增至0.52m。仍以48／24步積分，保留既有強度控制。

體積光改用與天窗、焦散共用的oceanWaveGLSL和surfaceSlope，包括GPU雨滴／點擊擾動；由air→water→air兩次折射估算局部偏移，以深度×0.45縮放、限制0.48m，帶動光帶密度和邊緣一起偏移。這是單次有界反投影美術近似，不是完整光子追蹤；不宣稱與焦散精確重合。時間與水波texture沿用共用更新路徑。

build通過（exports/long-fin-koi-integration/build-soft-light.log）；CUA實際檢視14:00與17:00的GPU畫面及不同時刻姿態，未讀到console error，寬光帶與柔邊可見。原5182服務已停止，重新啟動並reload後才驗收新shader；最後恢復14:00。未做實機FPS或完整物理驗證，改動尚未提交；基準commit仍為25bc75f，活力魚群修改保留。

## 2026-09-07：少數魚游入暗區預覽

依使用者示意擴大活動範圍：16隻中4隻（index 1／5／9／13）使用錯開相位的外游目標，最大偏移2.8m，100／113／126／139秒一輪往返。方向以房間右側與前側為主，其他12隻保留光柱附近的鬆散群游。初始位置納入各自外游相位，預覽開始便有少數魚靠近暗區。

光柱回游力改為追隨各魚的活動中心，中心與房間邊界保留1.1m餘量；靠牆0.8m內另加柔性回游力，只改速度、不直接clamp魚位置。保留短暫加速、柔化光束與原場景燈光；魚進暗處自然降低受光，不新增自發光。

20分鐘數值測試：4隻均曾越過投影開口半徑2.35m並返回1.5m內，最大速度0.307999m/s，最小中心間距0.626520m，保持牆面餘量與同時最多兩隻加速。此明暗指標是開口投影近似，非逐魚照度量測。26項測試與build通過（exports/long-fin-koi-integration/tests-excursions.log與build-excursions.log）。CUA reload目前5182預覽後，實際可見光柱右側的深色魚輪廓。未提交或發布，基準仍為25bc75f。

2026-09-07：使用者確認目前預覽並授權提交；上述活力魚群、柔化水波光束與暗區往返一併納入本次commit。未推送或發布。

## 2026-09-07：更深青藍海水試稿

使用者希望天窗海水更深、接近沖繩海的清透感，減少塑膠片感。本輪從fd8d753另作未提交試稿：SHALLOW_SEA_DEPTH由0.8增至3.0m；密封底面仍Y=7m、室內仍乾燥。天窗視線與焦散投影共用新深度。

天窗專用RGB吸收係數改為(0.22,0.065,0.035)m⁻¹，沿視線水中路程衰減，搭配青藍水中色與較弱的暖色混合。這是美術校色，非沖繩實測海水；未修改共用Ocean吸收常數，室內燈光仍保留原美術照明，並非整場能量守恆解算。

雲亮紋混合0.55→0.24，smoothstep範圍0.62–0.94→0.38–1.30，減少大片白色硬邊扭曲。Waterlight的surfaceSlope／disturbanceHeight新增兩組一致的局部細波：振幅0.0015／0.0008m、波向量(6.2,2.7)／(-4.1,7.3)rad/m、頻率1.4／1.85rad/s；天窗、焦散與柔光共用坡度及時間。初稿細波幅度過大使地面產生斑點，已降低至上述值。

本機build與26項測試通過，記錄exports/long-fin-koi-integration/build-deeper-sea.log及tests-deeper-sea.log。CUA實際reload14:00預覽，檢視天窗青藍色、柔化亮紋與室內焦散；console error讀回為空。未做真實海域比對、全時段／實機FPS驗收，尚未commit或發布。

## 2026-09-07：PR前全頁閃白與效能检查

使用者澄清是整個網頁短暫閃白，並非魚或水面局部閃爍。HTML原本只有theme-color，實際暗底在JavaScript import的CSS中；本輪將最低限度暗底／文字色／color-scheme直接放進head，減少CSS尚未到達或開發重載時露出瀏覽器白底。此為可確認的載入缺口修正，尚不能證明使用者每次閃白都源自此處。

骨架實例檢查發現SkeletonUtils按mesh複製骨架，現在同魚且骨頭／inverse binds完全一致的部件共用一個palette，魚與魚仍獨立；測試assert16個skeleton。幀率節流保留排程相位，避免晚一點的RAF把每幀時程持續向後拖；動畫dt仍使用實際呈現時間。

新增tests/waterlight-performance.html，載入真實main與composer，5秒暖機＋15秒量測；CPU值是composer提交時間，不是GPU計時。初次766×912 DPR1標準模式約27.00fps、幀時間p95=50ms／max95.8ms、texture135；修改後765×912 DPR0.9約29.47fps、p95=35.3ms／max146.9ms、texture39。視窗與DPR不同，並非嚴格同條件benchmark，最大延遲仍表示偶發卡頓，不能宣稱無效能問題或代表實機手機表現。測試26項、build通過；完整PR驗收將在整合main後補記。

PR整合驗收：已合併origin/main的房間導覽與字體更新，保留其介面。整合後26項測試與build通過；5183為正式build的本機預覽（無Vite HMR），實際載入畫面正常、console error為空，尚未重現使用者描述的全頁閃白。量測摘要存於exports/long-fin-koi-integration/performance-pr.json；偶發長幀及實機GPU限制仍保留，不將本機預覽稱為正式部署。
