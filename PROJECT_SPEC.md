# Stillwater／水光之間：Project Specification

## 產品定義

Stillwater 是一個即時生成的靜謐 WebGL 空間：空無一物的暗色房間，天花板中央有一片水面，單一清晰光源穿過水面，將緩慢波光投到地面與牆面；少量魚在光影間游動。目標是 Perceptual Realism（視覺感知逼真），不是物理正確的水、光線追蹤或流體模擬。

## Visual Contract

- 第一眼應為白天；使用者可選擇使用即時本地時鐘，或固定白天初始狀態。
- 固定第一人稱視角與構圖：暗色、高挑、空曠房間；鏡頭只允許極細微 parallax。
- 天花板水面是唯一明確光源；大部分空間保持陰影，光只揭示空間而不展示裝潢。
- 不加入家具、人、文字裝飾、額外燈具或奇幻／水族館／科技展示元素。
- 水面、caustics、低透明度體積光柱與少量浮塵共同表現「水改變了光」。

## 技術邊界

- Vite + TypeScript + Three.js；不使用 React。
- UI 使用 HTML/CSS overlay；音訊使用 Web Audio API，且必須由使用者操作後才啟動。
- 使用 shader、程序式 caustics、簡化 volume mesh 與 steering/boids 取得感知效果；不得宣稱為物理模擬。
- 桌面與手機皆可用；依 viewport、pixel ratio 與 GPU 能力調整品質。
- 預設支援 WebGL；WebGL 不可用時顯示可理解的 fallback 狀態與重新嘗試／降級提示。

## 里程碑

### M1 — 空間骨架

建立 Floor、三至四面牆、Ceiling 與中央方形 ceiling opening。材質保持深色、霧面、低紋理；固定鏡頭在空間內，支援 resize 與 desktop/mobile aspect ratio。

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

## 驗收（本次證據見 docs/VALIDATION.md）

- [x] M1 桌面與手機 viewport 均呈現固定空房間鏡頭，無家具、人或額外裝飾。
- [x] 首次進入為白天感；使用者可選固定狀態或 live local clock。
- [ ] M2 水面波動慢且不呈規律遊戲波；光源仍只有天花板水面方向。
- [x] Caustics 只在 sunlight mask 區域可見，且主要落在地面／牆面。
- [ ] 光柱與 dust subtle，不把暗室變成白色舞台。
- [ ] M3 正常品質可觀察到 9 尾魚，各自 steering，無同步循環。
- [ ] M4 控制、pause、reduced-motion、hidden-page pause 與可選 audio 均可操作。
- [ ] desktop/mobile 與 WebGL fallback 均可讀且不崩潰。
- [ ] 本機瀏覽器檢查通過主要視覺與互動 acceptance。

## 風險與參考

視覺參考的 fidelity 是 aspirational；水、caustics、體積光與魚群均為感知近似，效果會受 GPU、瀏覽器、螢幕與手機效能影響。最大風險是 caustics 過亮、魚過密、粒子過多、光柱過實，以及即時時鐘造成突變；優先維持空白、慢速與單一光源的視覺契約。
