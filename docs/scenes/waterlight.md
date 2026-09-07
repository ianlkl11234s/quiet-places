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
- 整理分支尚未提交或發布；視覺驗收範圍見 [驗收記錄](../VALIDATION.md)。
