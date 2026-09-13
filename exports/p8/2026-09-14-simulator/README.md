# iPhone 16 Simulator 驗收 · 2026-09-14

工作區 `/private/tmp/quiet-places-iphone-pilot-20260913`，branch `codex/iphone-pilot`，基準 `da4283f`，未提交。裝置 `Quiet Places Pilot iPhone 16`，iOS 26.5，UDID `0BF3ADFD-EDDE-4A18-BA58-C1CF9D43E11E`。Xcode 原生安裝執行，非 browser viewport。

| 操作 | 結果／證據 |
| --- | --- |
| 安裝＋原生啟動＋選房 | 成功進入 Seaward，水面與魟魚可見；初次 Simulator 系統開機約2分14秒，不納入 App 啟動效能數據 |
| 直式音樂播放 | music-playing.png：曲名「沉光漫游」與暫停符號，播放狀態成立 |
| 切背景後回前景 | foreground-paused-landscape.png：場景為繼續按鈕、音樂為播放按鈕，未自動恢復 |
| 橫式安全區與設定 | landscape-settings-audio-on.png：兩欄設定、所有主要項目可見，環境聲顯示關閉按鈕 |
| 鎖屏返回 | lock-return-audio-off.png：環境聲回到開啟按鈕、場景維持暫停 |
| 手動繼續與時刻切換 | moonlight.png：月夜／23:00與夜景 |
| 返回選房／終止再開 | cold-launch-chooser.png；先選房入口仍存在 |
| 八景盤點 | landscape-eight-scene-inventory.png：其餘七景完整可讀且尚未開放 |

修正僅 `src/mobile/mobile.css`：橫式設定改用較寬兩欄面板；橫式選房壓縮垂直間距，避免展開清單超出畫面。不是對場景調光或生物行為的修改。

mobile-sync.log / check-project.log / xcode-build.log：最終建置通過。只改 mobile CSS，上一輪146項程式測試保留為既有證據，未冒稱本輪重跑。

限制：未使用真正斷網環境；App沒有使用Vite server，但不等於飛航驗收。聲音驗證是播放狀態與生命週期後 UI 回讀，未做音訊訊號擷取。拖曳／捲動工具未能可靠完成全部手勢，不能聲稱完整觸控驗收。未量測 FPS、發熱、耗電與真機聲音；Simulator 通過不代表 iPhone16 gate 通過。

最終冷啟動：不重新安裝，terminate→launch→選房成功；cold-reenter-moonlight.png 顯示月夜偏好保留。主工作區回讀仍為 da4283f、只有原有兩個未追蹤項。專用 Simulator 驗收後關機，裝置與安裝保留。
