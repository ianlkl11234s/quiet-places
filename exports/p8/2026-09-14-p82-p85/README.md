# P8.2–P8.5 本地實作與 Simulator 驗收

2026-09-14。工作區 `/private/tmp/quiet-places-iphone-pilot-20260913`，分支 `codex/iphone-pilot`，起點／HEAD `79381c79af2333e2878b7f77c1a1c4ef872360c4`；本輪修改尚未提交。未合併、推送、發布。專用 Quiet Places Pilot iPhone 16 Simulator、iOS 26.5。P8.1／P8.5 真機 gate 仍未通過。

## 分階段結果

| 階段 | 本地實作 | 驗收與證據 |
| --- | --- | --- |
| P8.2 觀賞流程 | 先選房後建立 renderer、依 metadata 顯示能力控制；離房釋放 PlaceInstance；前背景停止場景及兩種音訊；失敗／context loss 恢復入口 | 八景直橫式、時間順向切換、水位／雨量操作；`foreground-audio-off.png` 顯示背景返回後場景、音樂及環境聲皆停止；網站 Afterlight 渲染／暫停、console error=0（`web-afterlight.png`） |
| P8.3 下載與離線 | 完整 dependency manifest、SHA-256／bytes、共享 content store、原子 active pointer、刪除、更新／回退、毀損修復；Application Support 排除備份 | UI 真下載七房；停本機來源後強制結束重啟，七房仍 ready 並逐景開啟。`simulator-installed-readback.json` 再驗全部檔案 hash，下載 unique objects 184,195,547 bytes；`offline-source-stopped.log` 證明來源不可連線 |
| P8.4 睡眠定時 | 絕對 deadline，15／30／60 分鐘、重設／取消、跨房與背景；到期兩種音訊停止，場景暫停，手動繼續 | 約18:25–18:41 JST 完成真正15分鐘倒數，途中換七景。`sleep-before-expiry-audio-on.png` → `sleep-expired.png`／`sleep-expired-audio-off.png` → `sleep-manual-resume.png`；30／60設定及取消見 `sleep-30-reset.png`、`sleep-60-reset.png`、`sleep-cancelled.png` |
| P8.5 八景整合 | 沿用 catalog 延遲載入；下載 URL 導向原生已驗檔；保留八景美術／生物／相機基準 | 下表兩方向畫面；本地回退 App 與 manifest 見下方。真機效能／穩定性 gate 保留 |

## 八景 Simulator 畫面矩陣

| 房間 | 直向 | 橫向 |
| --- | --- | --- |
| Waterlight | `waterlight-portrait.png` | `waterlight-landscape.png` |
| Leaflight | `leaflight-portrait.png` | `leaflight-landscape.png` |
| Oceanlight | `oceanlight-portrait.png` | `oceanlight-landscape.png` |
| Afterlight | `afterlight-portrait.png` | `afterlight-landscape-offline.png` |
| Seaward | `seaward-portrait.png` | `seaward-landscape.png` |
| Stairlight | `stairlight-portrait.png` | `stairlight-landscape.png` |
| Snow Window | `snowwindow-portrait.png` | `snowwindow-landscape.png` |
| Snowhall | `snowhall-portrait.png` | `snowhall-landscape.png` |

Oceanlight below／half／full 水位實際切換，Waterlight 切雨天並改雨量，Seaward 月夜23時向前切到正午；其他房間依能力不顯示雨量／水位。部分截圖是在較早一輪同日 bundle；最後整合安裝另做 chooser 旋轉後進房回歸：`final-offline-launch.png`、`final-landscape-chooser.png`、`final-afterlight-landscape.png`、`final-reentry-after-chooser-rotation.png`，通過先橫向 Afterlight、離房後直向 Waterlight；未宣稱每張均為最終 bundle。畫面基準未重烘焙。

## 測試層級與限制

- `tests.log`：完整152／152通過，涵蓋 asset manifest／URL locator／timer／音訊與既有測試；timer單元測試包含背景後超時、持久 deadline 重建。
- `native-assets-harness.log`：抽取實際 Swift store，用 macOS localhost fixture 驗證 hash失敗保留舊版、容量不足、取消、路徑／duplicate／oversized拒絕、共享重用、刪除、rollback、同版本毀損修復、licenseStatus receipt 留存。這是 store 測試，不冒充 Simulator UI 的更新／回退操作。
- `mobile-sync.log`、`xcode-build.log`、`web-build.log`、`check-project.log` 保存建置結果。Vite >500kB chunk 提示仍在。
- 本機測試下載來源為 `http://127.0.0.1:8769/`，只有 Simulator 允許 loopback HTTP；實機要求 HTTPS。`QUIET_PLACES_ASSET_BASE_URL` 正式來源未設定、未上傳；預設沒有來源時不開放未下載房間。測試 bundle 保留 localhost 設定，但已下載房間不需來源在線。
- 內建 Seaward＋八首音樂為9檔42,572,899 bytes；不是 IPA／安裝／GPU 大小。manifest 保留來源路徑、revision、版本、共享引用及未核實 licence 狀態，未授權外部發布。
- Simulator 停來源後離線開啟不等於真機飛航模式。聲音以 UI 播放／停止狀態驗證，未擷取音訊訊號。全部觸控手勢、實機安全區、真機八景30分鐘、20次換景記憶體、FPS／P95、發熱與耗電仍待驗收。
- context loss 重載及下載錯誤恢復已有實作；未聲稱全部故障都已透過 Simulator UI 強制注入。沒有因缺手機停止其他開發，也未以 Simulator 取代正式實機 gate。

## 本地回退與重現

最終 App 存於 `/private/tmp/quiet-places-p82-p85-last-known-good/App.app`，僅此 Mac 的 Simulator 可安裝；非簽署 IPA、不可發給朋友。資產版本存本目錄 `room-manifests.json`，bundle hash／來源差異與回退路徑存 `final-build-receipt.json`。重建方法見 [IPHONE_PILOT.md](../../../docs/production/IPHONE_PILOT.md)。

本輪 Simulator 發現並修正：Capacitor 本地插件改以 instance 註冊；橫式八景清單避免下緣裁切；離房再進與 chooser 旋轉重新對齊 camera／renderer；native 音樂來源比較避免繼續時重載；睡眠到期提示在手動繼續／重設後清除。
