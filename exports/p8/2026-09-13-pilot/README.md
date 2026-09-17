# P8.0–P8.1 本機驗收證據

基準 main da4283f；worktree /private/tmp/quiet-places-iphone-pilot-20260913；branch codex/iphone-pilot。2026-09-13，未提交。

- tests.log：146 tests passed；含 pending audio stop 與 native/visibility 狀態合併。
- check-project.log、web-build.log、mobile-sync.log：本機檢查通過。
- xcode-build.log：generic iOS Simulator SDK build succeeded，CODE_SIGNING_ALLOWED=NO。沒有安裝／執行或實機宣稱。
- mobile-assets.manifest.json：9 個內建 runtime 資產，共42,572,899 bytes；dist-mobile及ios/App/App/public都以 bytes/SHA-256 回讀比對通過。
- portrait.png / landscape.png：桌面 Browser 393×852、852×393；不是實機照片，不含 Dynamic Island 的實際 safe-area 模擬。Seaward 可渲染、暫停、返回選房；選房清單列八景、只啟用 Seaward。
- dependency-audit.json：3 moderate 開發工具鏈依賴問題，未以 force 降版。

實機安裝、飛航冷啟動、鎖屏音訊停止、10分鐘效能與發熱、實際觸控／安全區：未驗證。無裝置連線或有效簽署身分。

網站回歸：雪光長廊在 web build 正常渲染、無 console error。主 checkout 最後回讀仍為 main da4283f，僅原有兩個未追蹤項，未寫入。
