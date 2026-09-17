# iPhone 單景 pilot：操作與驗收

2026-09-14 更新。P8.0–P8.5 的本機實作與 Simulator 開發驗收已完成目前範圍；**iPhone 16 的 P8.1 與 P8.5 實機 gate 尚未通過**。此輪從 `79381c7` 起、HEAD 未變，未提交、未合併、未推送、未發布。

## 工作區與範圍

- cwd：`/private/tmp/quiet-places-iphone-pilot-20260913`；branch：`codex/iphone-pilot`；基準：main `da4283f`。
- 原工作區不寫入；原本 `.local-backups/` 與交接草稿維持未追蹤。
- 八景都在 metadata 與 [active 資產清單](IPHONE_ASSETS.md)。新加入 Snow Window／Snowhall 保留目前生物、相機及光影基準；本轮不修改場景原始碼或模型。
- App 先選房再建立 WebGL；Seaward 與八首音樂內建，另外七景必須下載並完整校驗後才可進入。Simulator 已下載七景，停止本機 `127.0.0.1:8769` 來源後強制結束、冷重啟仍可選八景；production source 尚未設定。
- 沿用網站渲染與觀賞控制；mobile build 不產生 Studio 網頁，隱藏製作／輸出及全螢幕入口。44px 主要按鈕、直橫式與 safe-area CSS 是本機實作，瀏海與觸控仍須實機確認。
- 離開／鎖屏：native App 事件與 document visibility 合併處理，暫停 scene clock、取消 RAF、停止兩種音訊；返回保持暫停，需手動繼續／播放。補上環境聲啟動途中被停止的取消機制。
- Seaward 模型＋八首音樂直接內建，9 檔共 42,572,899 bytes。這是 asset bytes，不是 IPA／安裝／GPU 大小。七景下載 payload、版本／hash 校驗、更新／刪除、睡眠定時及八景選房已是本機實作；TestFlight 與任何外部發布未開始。來源／音樂授權仍未核實。

## 重現建置

本次 Node v23.10.0、Xcode 26.6（17F113），Capacitor core／ios／cli 8.5.2、App plugin 8.1.1；使用 SPM。專案產生的 iOS deployment target 15.0 不是本輪已驗證的最低系統。

```sh
cd /private/tmp/quiet-places-iphone-pilot-20260913
npm ci
npm test
npm run check:project
npm run build
npm run mobile:sync
npm run mobile:open
```

`mobile:sync` 依序複製 curated assets、編譯手機入口、同步 iOS；不需把開發伺服器寫進 Capacitor config。請勿同時跑資產測試與 mobile build，兩者會重建 `.mobile-public/`。在別的 checkout 接手時先 `npm ci`，再 `mobile:sync`，SPM 的 plugin 路徑才存在。

只驗證原生編譯、不簽署：

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /private/tmp/quiet-places-ios-build \
  CODE_SIGNING_ALLOWED=NO build
```

## 目前證據與缺口

最新證據見 [P8.2–P8.5 驗收](../../exports/p8/2026-09-14-p82-p85/README.md)；[首輪 pilot](../../exports/p8/2026-09-13-pilot) 與下方 P8.1 Simulator 紀錄保留為歷史。

| 項目 | 狀態 |
| --- | --- |
| 程式測試 | 152／152 通過，包含資產準備／版本 hash、重複生命週期、timer 與 pending audio stop；native store harness 另行通過 |
| 製作 harness、網站 build、手機 build／sync | 通過；Vite 保留 >500kB chunk 提示 |
| Xcode generic iOS Simulator build | 未簽署編譯通過 |
| iPhone 16 Simulator／iOS 26.5 | 已安裝、原生啟動並操作，見下方 2026-09-14 紀錄；不是實體 iPhone 驗收 |
| 桌面瀏覽器手機尺寸 | 393×852、852×393 渲染／控制列／暫停／選房；無 console error |
| 本機下載與原生資產 | 7 個下載房間加 Seaward 內建；全數 SHA-256／bytes 回讀，停 loopback 後冷重啟仍可進入八景 |
| iPhone16 安裝、飛航冷啟動、鎖屏音訊、安全區、效能／發熱 | 未驗收；目前未連接裝置、無有效 codesigning identity |
| Apple 分發／會員／上傳 | 未執行 |

原生 icon／launch screen 目前沿用 Capacitor 試作預設，正式分發前再換成確認過的品牌素材。

`npm audit` 報告 3 個 moderate，位於 CLI → xcode → uuid 開發工具鏈（uuid buffer bounds advisory）。未盲目 `audit fix --force` 降版；此為已知工具依賴限制，與 runtime/實機驗收分開記錄。正式分發前須重新查核。

## 下一個需要使用者的步驟

先完成本機專案後，使用者才需要：

1. USB 連接並解鎖 iPhone 16，依提示信任 Mac／啟用 Developer Mode。
2. Xcode → Settings → Accounts 登入自己的 Apple Account；不提供密碼給 agent。
3. 開啟 `ios/App/App.xcodeproj`，App target → Signing & Capabilities 選 Personal Team；bundle ID 暫用 `com.migu.quietplaces.pilot`，若不可用再換本人可簽的 ID，同步改 capacitor config。
4. 選實體 iPhone 作目的地，Run；首次依手機提示允許個人開發者 App。

實機 gate：選八景（含下載房）→ 直橫式／拖曳／能力控制 → 音樂與環境聲分別播放後切背景／鎖屏，確認立即停止、返回未自動重播 → 真飛航模式強制結束重開仍可進房 → 完整 15 分鐘 timer 到期。記錄 iOS／build／資產 manifest；暖機30秒後10分鐘量測 median FPS≥28、frame interval P95≤50ms，5次冷進入中4次≤5秒，保存實測而非估計。

P8.2–P8.5 的本機工作不再等待這一步，但不能因 Simulator 或本機測試通過而把 P8.1／P8.5 標完成。固定操作與證據即可，無需另建 iOS skill／agent 系統。

## 2026-09-14 P8.2–P8.5 本機／Simulator 證據

證據入口：[2026-09-14-p82-p85](../../exports/p8/2026-09-14-p82-p85/README.md)。專用 iPhone 16 Simulator（iOS 26.5）完成七景下載與 Seaward 內建的八景矩陣：直橫式、metadata 能力控制、背景／前景與兩種音訊停止均已操作；下載檔案全數以 SHA-256／bytes 回讀。停止 `127.0.0.1:8769` 本機來源後強制結束、冷重啟，八景仍可選取，這只證明 Simulator 的本機儲存與 locator 流程。

原生 store harness 驗證 hash／容量／取消／rollback／shared delete／毀損修復；完整測試為 152 通過。Simulator 已完成真實15分鐘到期，確認場景及兩種音訊停止、手動繼續；30／60分鐘設定與取消也已操作，截圖見最新紀錄。這些本機結果不替代真機飛航、聲音訊號、30 分鐘穩定性、20 次換景記憶體、FPS、發熱或耗電量測。

## 2026-09-14 Simulator 操作驗收

證據：[2026-09-14-simulator](../../exports/p8/2026-09-14-simulator/README.md)。專用裝置 `Quiet Places Pilot iPhone 16`，iOS 26.5，UDID `0BF3ADFD-EDDE-4A18-BA58-C1CF9D43E11E`；未登入 Apple Account，不使用付費簽署。這是實際安裝 App 後的 Simulator 操作，與前一輪 browser viewport／編譯驗證不同。

- 通過：原生啟動 → 選 Seaward → 房間／魟魚／水面渲染；直式及橫式；音樂切入播放狀態；回前景後場景及音樂保持暫停；環境聲切入開啟狀態、鎖屏後返回仍關閉；手動繼續、切月夜至23:00；返回選房；終止程序後重啟仍先選房。
- 修正：橫式設定原本落在高度不足的捲動區，工具無法順利觸控捲到下方；改為使用寬度的兩欄面板，重設視角與環境聲直接可見。橫式選房展開七景清單時原本下緣擁擠，縮小該方向的泡泡與段落間距。只改 mobile CSS，不改場景或網站樣式。
- 最終 mobile:sync、check:project、Xcode simulator build、diff whitespace 檢查通過。本輪只有 CSS 修改，不重跑上一輪已通過的146個邏輯測試，亦不以它們代替操作驗收。
- 邊界：Simulator 共享 Mac 資源；本輪沒有量測真機 FPS／發熱／耗電、沒有做實際斷網或音訊訊號擷取。聲音驗證以 UI 播放狀態與生命周期後狀態回讀為證。拖曳手感與完整手勢捲動仍需後續驗收；不能宣稱本輪已驗證全部觸控手勢。
- 本輪運行使用已安裝 bundle，不依赖 Vite server；不等於真機飛航模式測試。P8.1 的 iPhone16 gate 保留，其他不依賴實機的開發可繼續。
