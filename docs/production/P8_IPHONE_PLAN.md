# P8：iPhone 觀賞 app 實作計畫

2026-09-14 更新。實作基準 main `da4283f`，獨立 worktree `/private/tmp/quiet-places-iphone-pilot-20260913`、分支 `codex/iphone-pilot`、起點 `79381c7`，HEAD 未變。P8.0–P8.5 的本機實作與 Simulator 開發驗收已推進至八景下載、離線重啟、宿主／能力控制、生命週期與睡眠定時；具體證據見 [iPhone pilot](IPHONE_PILOT.md) 與 `exports/p8/2026-09-14-p82-p85/README.md`。iPhone 16 實機簽署、安裝與效能驗收仍待執行，不能標為 P8.1 或 P8.5 完成，也沒有合併、推送或發布。原 2026-09-09 八景規劃已更新為八景，保留階段範圍。

## 1. 已確認的產品範圍

| 項目 | 第一版 |
| --- | --- |
| 用途 | 放空觀賞，順暢顯示優先 |
| 首台實機 | 使用者的 iPhone 16；其 iOS 版本待實作時記錄，不代表所有 iPhone 已支援 |
| 入口 | 先選房間，不自動進入上次房間 |
| 顯示 | 直式與橫式，兩者均驗收構圖與控制項 |
| 互動 | 延續網站的輕點、拖曳、時間／天候／音樂設定；不納入進階製作室 |
| 離線 | 已完整下載的房間與所需聲音可離線觀看；首次未下載需連網 |
| 背景 | 離開 app 或鎖屏即停止所有聲音，暫停場景；不提供背景音樂 |
| 睡眠定時 | 到期停止音訊及場景，保留安靜的暫停畫面 |
| 對象 | 自己先測，再少數朋友；沒有付費 Apple Developer 帳號 |
| 工作方式 | 固定、可追溯的流程即可；允許人工建置、簽署與資產發布 |

合理預設（可在試片回饋時调整）：睡眠定時提供關閉／15／30／60分鐘；返回 app 不自行恢復音樂，場景顯示暫停並提供繼續；換房間不重設定時。第一版不做帳號、同步、付費、推播、新增場景或編輯器。不預設朋友都用相同型號；朋友測試前收集裝置／OS。

## 2. 現有能力與技術決策

基準 metadata 註冊 waterlight、leaflight、oceanlight、afterlight、seaward、stairlight、snowwindow、snowhall 八景。新增的雪落海窗與雪光長廊都纳入 [資產清單](IPHONE_ASSETS.md) 及 P8.5 驗收；雪光長廊現行銀魚系統優先於已停用的魟魚／烏賊歷史。新增場景的美術基準不因 app 移植而改寫。

- 沿用 Three.js、`PlaceInstance`／catalog／metadata、`SceneClock`、既有偏好、MusicPlayer／AudioSystem。main 已有 visibilitychange／pagehide，應整合 native 事件，不建第二套互相競爭的時間與音訊管理。
- 現行本機實作採 Capacitor iOS＋WKWebView，重用現有 WebGL 場景；不要求 Ionic UI，也不重寫 Swift／Metal 渲染器。其實機可行性仍須通過 P8.1 gate 才能定案。
- 方案比較：PWA 可以作早期瀏覽器參考，但不能替代本次 native 安裝、離線與生命週期驗收；自訂 WKWebView/Swift 宿主保留為橋接不足時的有界備案。只有找到 Capacitor 可重現且無法合理修正的阻塞才切換方案。
- native app 使用打包的本地 HTML／JS，不將開發伺服器 URL 當正式入口；場景資產可下載，程式碼及 shader 隨 app 版本發布，不做任意遠端程式更新。
- app build 獨立 entry/output，例如 `src/mobile/`、`共用 index.html（mobile build 替換 entry）`、`dist-mobile/`、`ios/`；以 `vite.mobile.config.ts` 排除 Studio 與非必要 public 資產。保留網站原 build。檔名是預定責任邊界，實作時沿用現有風格。
- 只抽確實需要共用的 app host 接口；不為 app 再造 scene registry。新增資產 locator 可放 `src/shared/resources/`，在 fetch／GLTF／貼圖／motion／音訊入口統一解析，網站仍解析到原 public URL。

本機盤點（2026-09-13）：Xcode 26.6（17F113），Capacitor core／ios／cli 鎖定 8.5.2，App plugin 8.1.1。使用 Swift Package Manager。Seaward＋八首音樂本機資產為 42,572,899 bytes，另加程式與原生容器，不能當作安裝包大小。未連接 iPhone，無有效 codesigning identity；實機 OS 與效能仍未知。

## 3. 執行階段與完成條件

| 階段 | 主要成果 | 進入下一階段的条件 |
| --- | --- | --- |
| P8.0 基準與環境 | 最新可用 P7 commit、獨立 worktree、八景基準、裝置／工具清單、資產依賴清單 | repo test/build/check 通過；識別簽署／實機缺口 |
| P8.1 單景實機 | Seaward 為預設 pilot，app 本地載入、最小選房入口、觸控／旋轉／背景停止 | iPhone 16 安裝與離線冷啟動成功；10分鐘基本效能達標 |
| P8.2 觀賞宿主 | 正式選房、能力控制、直橫式構圖、生命週期與失敗恢復 | 本機／Simulator 已驗收；iPhone 16 實機 gate 未通過 |
| P8.3 房間下載 | 清單、版本化資產包、下載／校驗／刪除／更新／離線播放 | Simulator 已下載七景、停 loopback 來源後冷重啟；真機飛航模式仍待 |
| P8.4 睡眠定時 | 倒數、取消、到期停止、前後景時間語義 | 本機／Simulator 短流程已驗收；15 分鐘定時證據見最新紀錄，真機仍待 |
| P8.5 八景整合 | 全部已註冊房間與最終效能調整、回退包 | Simulator 八景直橫式與能力控制已驗收；實機矩陣、30 分鐘穩定性仍待 |
| P8.6 少數朋友測試 | 合適分發方式、測試說明、回報與版本紀錄 | 朋友可安裝並完成選房／下載／離線流程 |

依序 P8.0 → P8.1 → P8.2 → P8.3 → P8.4 → P8.5 → P8.6。手機／帳號依賴只阻擋需要它的驗收；文件、資產盤點與單元測試可繼續。不能用模擬器通過來跳過 P8.1 真機 gate。

### P8.0：保護與盤點

1. 核對／取得最新 main，確認包含 P7 成果、偏好與拒絕方案；在獨立 `codex/` worktree 開發，保留主目錄未追蹤草稿，不搬舊 worktree 的生成檔冒充來源。
2. 記錄 repo commit／dirty diff、Node、npm、Xcode、Capacitor／plugins 精確版本、iPhone iOS、螢幕方向。核對 Apple Account／Personal Team 是否可用，不讀或保存憑證與密碼。
3. 執行既有 test/build/check；固定八景視角、時刻及動畫時間，保留 P7 接受的微動、魟魚動作、顺向時段過渡。不得因手機優化任意重調美術。
4. 盤點每景的 GLB、貼圖、EXR、motion binary／JSON、音樂／環境聲、外部字體與網路請求，列檔案 bytes、授權狀態與共享依賴。檢查 GLB 內嵌／外部 URI，不只掃程式字串。
5. 查 app build 是否包含不必要 Studio、分析追蹤或遠端腳本；無產品需要的項目不帶入。

### P8.1–P8.2：先證明看得順

- Seaward 與八首音樂維持內建；其餘七景透過版本化 manifest 下載。冷啟動先有選房入口，點選才建立 renderer／scene；房間清單不預載八景 GPU 資源。只有內建或完整校驗的房間可進入。
- 同一個指標事件分辨 tap／drag，避免拖曳誤觸水面；滑鼠 wheel 的鏡頭調整先沿用既有滑桿，不強制新增 pinch。保留各景固定站位與轉頭限制。
- safe-area、瀏海、Home indicator、橫式短邊、控制面板滾動及至少44pt觸控區；rotation 更新 renderer/composer/camera 尺寸與 framing，不重建整個場景。直橫式逐景確認主角不被裁切。
- native 前後景事件與 document visibility 進入同一 suspend/resume 管理；同事件可重入、不重複掛 listener。停止兩種音訊、RAF及模擬，記住原本手動暫停狀態；返回不補算背景數小時 dt。
- 初次進入與返回不自動播放聲音。使用者再按播放／繼續才恢復；WebGL context loss 若不能恢復就重新載入當前房間並保留偏好，不能黑畫面掛住。
- 載入失败保留可用選房介面與重試；切換中使用 candidate／dispose 所有權，避免同時持有多景資源。從房間返回清單應釋放場景資源。

### P8.3：離線是完整依賴可用，不只是網頁快取

第一版使用可追溯的靜態 HTTPS 資產清單／下載來源，無須另建使用者後端。內建 pilot 與下載房間使用同一份 manifest 契約。目前 production source 尚未設定；`http://127.0.0.1:8769/` 僅供 Simulator 的本機下載驗證，停止來源後的冷重啟已在 Simulator 重現，不能當作外部 hosting、真機 HTTPS 或飛航模式證據。需要外部發布時再依當次授權操作。

- room manifest：schemaVersion、roomId、assetVersion、相容 app/asset schema、總 bytes、每檔相對路徑／size／SHA-256、共享資產引用、來源／授權。沿用現有 recipe 收據資料，補「runtime 可下載集合」，不把 build recipe 直接當房間完整依賴清單。
- 狀態：未下載 → 下載中 → 校驗中 → 可離線；另有失敗、可更新、刪除中。只有全依賴校驗完成才設可離線；斷網／殺 app 的半包不提升成功。
- 下載至獨立暫存目錄，完整校驗後切換 active-version pointer；保留舊版直到新版可用。重啟清理孤立半包或提示重試。第一版可重新下載，不強求斷點續傳。
- 採 app 持久資料目錄存使用者選擇下載的資產，排除雲端備份的可再下載大檔；不要僅依赖可被回收的 WebView cache。原生路徑到 WebView 的 URL／MIME／本地讀取在 pilot 實證，GLTF、EXR、二進位與音樂都要測。
- 避免把大檔整包轉 base64 穿越 JS bridge；先試官方檔案／傳輸能力，記憶體與 streaming 不符需求時才加最小 native adapter。
- 顯示下載大小、進度、所佔空間與刪除。容量不足不移除仍可用舊版本；下載期間離開 app 不承諾背景續傳，返回可重試。
- 刪除正在播放的房間前先離開並 dispose；共用資產只在沒有其他已安裝房間引用時刪除。不得刪到其他房間的魚模型或音訊。
- app 更新後校驗相容性；過舊資產標為需更新，不解析成壞場景；無網路時保留仍相容的已安裝版本。

驗收：真下載至少兩個共用資產房間 → 飛航模式 → 殺 app → 重開 → 選房與播放；另測首次離線、半包、hash不符、容量不足、更新失败保留舊版、刪除一景不破壞另一景。聲音必須實際離線播放，不只出現曲名。

### P8.4：睡眠定時

- 計時使用絕對 deadline，與場景 elapsed／暫停／時刻切換分開；scene paused 不暫停睡眠倒數。預設關閉，啟用前顯示時長，支持取消與重設。
- 到期停止 MusicPlayer＋AudioSystem、暫停 RAF／模擬，顯示「已結束」與明確繼續操作。不要關閉 app，也不承諾程式可以強制鎖屏。
- 背景本來就停止所有聲音；不依賴背景 JS timer 準時觸發。返回先比對 deadline，已過期保持停止；app 被終止後重開也不自動恢復播放。
- 與「保持螢幕開啟」分開：第一版先沿用系統自動鎖定，不默默增加常亮需求；若觀看時頻繁鎖定影響體驗，再讓使用者選定是否加常亮選項。
- 測試短測試時長、15/30/60顯示、途中換景／暫停、取消、重設、背景超時、反覆進出；實機至少一次完整15分鐘到期。Simulator 已完成一次完整15分鐘到期及30／60設定、取消操作；真機到期仍待驗收，證據見最新 P8 紀錄。

## 4. 效能與驗收標準

下列為首版工程目標，並非已測得數字。P8.1 記錄量測方式後採用；若不達標先量測瓶頸，不事後默默放寬。

- iPhone16、記錄OS版本、非低耗電、亮度固定、未充電起測。基準與最終都保存條件；高溫狀態另列。
- 標準模式沿用現有30fps方向：暖機30秒後，前景10分鐘 median FPS ≥28，呈現frame interval P95 ≤50ms；場景載入與旋轉另量，不混入steady-state。這不是追求60fps。
- 本機已下載房間，5次冷進入中4次從選房到可操作 ≤5秒；保存最慢值。網路下載耗時另列。
- 八景各兩方向基本驗收；最重的場景30分鐘無崩潰／持續黑畫面／WebView重啟；20次換景觀察記憶體是否持續累積。記錄峰值與釋放後趨勢，不虛構跨裝置通用MB上限。
- 背景不播放聲音；返回無時間跳躍或自動播放；觸控無卡住。低畫質若有採用，要能看出其設定且保留構圖，不偷偷移除使用者已確認的主角效果。
- 收集 Instruments／Xcode 記憶體與CPU/GPU觀察、frame記錄、實機短影片／截圖；一般桌面 browser 與 simulator 只算前置驗證。

P8.5 必測：八景×直橫式、支持的雨／水位、順向時段過渡、暫停、旋轉中操作、連續換景、錯誤重試、飛航冷啟動、全部音訊停止、睡眠到期、背景恢復。新增程式測試優先放在資產狀態機／生命週期／timer；不要用鏡像實作的測試取代手機操作。

## 5. 簽署與少數朋友測試

可先用免費 Apple Account／Xcode Personal Team 在本人裝置測試；免費 provisioning 有期限，並非長期分發方案。Apple 文件列明免費 provisioning profile 7日到期；TestFlight 是 Developer Program 能力。使用者目前無付費帳號，所以「本人實機通過」與「朋友安裝測試」分開 gate。[Apple 帳號說明](https://developer.apple.com/help/account/basics/about-your-developer-account)

- P8.1 需要使用者登入 Xcode、連接／信任 iPhone、依提示啟用開發者模式；agent 先準備可建置專案，到這個必要步驟才請使用者操作。不代買會員。
- P8.6 優先評估 TestFlight，正式執行前確認使用者願意註冊付費會員。朋友通常為 external testers，按 Apple 實際要求準備 beta 資訊／審查，不保證上傳後立即可裝。[TestFlight](https://developer.apple.com/testflight/)
- 若暫不加入會員，停在本人實機版；可以另提供網頁作意見回饋，但不能稱朋友已完成 native app 驗收。
- 發送前核對 app icon／bundle ID、下載資料與音樂授權、依賴要求的 privacy manifest，以及實際收集資料；不新增分析追蹤。確認app只含觀賞入口。

## 6. 交付、回退與接手

每階段保存 `exports/p8/<review-id>/`：程式 commit與dirty patch、環境／裝置、app build版本、asset manifest/hash、命令結果、操作矩陣、效能記錄、已知限制。場景主觀確認不被 app 技術驗收覆蓋。

- app shell／bundle 使用Git版本回退；下載內容透過active-version回退，舊資產在驗證前保留。保留 last-known-good 安裝包及資產收據；簽署到期可能需要重簽，不能只說舊檔永遠能裝。
- 每階段跑 test、web build、check:project；mobile變動另跑mobile build／Xcode build與相稱真機測試。不得廣泛stage憑證、手機識別資訊或大量暫存資產。
- 補 `docs/production/IPHONE_RUNBOOK.md`（實作首次真機成功時才建立），涵蓋安裝、同步網頁資產、資產包生成、更新、已知故障、睡眠及离線檢查；沿用現有製作 skill，不先增加一套 iOS agent harness。
- 第一個可交付里程碑是「iPhone16上可安裝、可選一景、直橫式順暢、離開停止音樂」，不是一次做完朋友分發。

下一個有界工作是 iPhone 16 實機：簽署／安裝、真飛航冷啟動、15 分鐘 timer 到期、30 分鐘最重場景、20 次換景、FPS／frame interval／發熱／耗電與實際音訊訊號。離線下載 production source、精確 OS 下限、朋友裝置與會員選擇仍在對應階段定案；這份計畫不等於已授權購買、上傳或發布。

## 7. 查核來源

查核日期2026-09-09。Capacitor官方目前提供WKWebView iOS宿主；版本8的iOS頁列Xcode26+，實作仍需核對鎖定版本與plugins。[iOS 文件](https://capacitorjs.com/docs/ios)

前後景事件可由App plugin整合到既有生命週期；檔案 API 只提供基礎能力，並不自動實現上面的完整離線契約。[App API](https://capacitorjs.com/docs/apis/app)、[Filesystem API](https://capacitorjs.com/docs/apis/filesystem)
