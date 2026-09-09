# 本地音樂素材

播放器使用瀏覽器原生 `HTMLAudioElement`，只在使用者按下「播放」後載入與播放，沒有 autoplay，也不會解碼整首檔案到 Web Audio 記憶體。

| UI 曲名 | 原始 byte 副本（ownership：僅保留） | 原始 SHA-256 | Web 發佈路徑（ownership：播放器使用） | Web SHA-256 |
| --- | --- | --- | --- | --- |
| 沉光漫游 | `assets/audio-originals/submerged-sunlight-original.m4a` | `ed4857f03bf5252b07962de8c033d9fb7cd05d1abfbf19317ce54c82047bcaa0` | `public/audio/submerged-sunlight.m4a` | `4be5a84b7ce489fa31150d7f6a7d313ce816bbaaa54e7d5a0ed30681f0d6e7ea` |
| 水線低語 | `assets/audio-originals/waterline-hush-original.m4a` | `1004b8a4c64fe4b93e791654e61e8e07e544c359a04aebc5c9a9d3becf573938` | `public/audio/waterline-hush.m4a` | `91eb994cf5a1257045fd103f51d5c94ebc7b43badf3307ffaed1d5f373ac9153` |
| 晴光入水 | `assets/audio-originals/sun-through-water-original.m4a` | `87a8bdd0e4c8db636947d3bc2ffc2a48746c6449c0220dbd7767803c516dc890` | `public/audio/sun-through-water.m4a` | `0fc309190ebdc5625389e7ada7b06c11320fecdfdd04f3717cd1aee547589def` |
| 波影流年 | `assets/audio-originals/sun-through-water-2-original.m4a` | `807d8bf38b36ad1c556fe781d3e9b316eafb82b28b75dca53ac6649330e09565` | `public/audio/sun-through-water-2.m4a` | `543ea4e478f492d52ab7f844ee61cf6e81359625f6835fb6f829604dbbde0380` |

`assets/audio-originals/` 保存未轉碼、與 Downloads 原檔雜湊相同的 byte 副本，供追溯與重轉碼；`public/audio/` 是唯一供網站載入的 AAC-LC 版本。原始檔為 ISO MP4/M4A 容器中的 Opus；Web 版為 ISO MP4/M4A 容器、AAC-LC、48 kHz、stereo、目標 192 kb/s，長度分別為 219.69、188.21、240.61、218.29 秒。來源檔仍保留在 `/Users/migu/Downloads/`，未被刪除或改名。

## 授權狀態

目前沒有隨檔提供的公開散布授權、作者、來源網址或使用範圍證明。將此專案公開部署、分享或發行前，必須補齊每首曲目的權利人授權與可公開散布證明；在確認前僅應視為本機素材。

## 2026-09-07 新增四首與暫定時段

本輪無可直接聆聽音色／旋律的工具；名稱與時段是根據原始標題與可量測特徵的暫定編排，並非聽辨結果。頻譜或響度不能直接決定情緒、樂器或最佳播放時間。原Downloads檔案保留原名，網站使用下表的新名稱與檔名；播放器保留原四首，共八首，不自動依時間切歌。

| 原名 | 新名稱 | 時段建議（暫定） | 長度 | Web檔名 |
| --- | --- | --- | --- | --- |
| Cyclical Light | 晨光迴環 | 晨曦至上午 | 3:04 | dawn-cycles.m4a |
| nocturnal room tone | 夜色低迴 | 夜間 | 3:33 | nightfall-undertone.m4a |
| nocturnal room tone (1) | 暮色餘韻 | 傍晚 | 3:17 | dusk-resonance.m4a |
| 暗室の静寂 | 靜室微光 | 深夜 | 3:23 | quiet-room-glow.m4a |

四首原檔均為48kHz立體聲Opus，Web副本轉為48kHz立體聲AAC-LC、192kbps目標位元率、faststart。原始byte副本保存在assets/audio-originals；沒有更動來源內容或做音量正規化。原始/Web SHA-256與數值特徵見[audio-additions-2026-09-07.json](audio-additions-2026-09-07.json)。

分析方式：ffmpeg解碼為16kHz mono float PCM；2048點Hann窗、1024 hop計算功率頻譜重心；排除RMS低於最大值4%的frame；動態差為活躍frame RMS的P90/P10 dB比。晨光迴環的頻譜重心較高（173Hz）；夜色低迴較低（94.6Hz）；暮色餘韻動態差較大（14.24dB）；靜室微光較平穩（8.51dB）。這些數值只作暫定編排參考，不是主觀聽感描述。

驗收：Web副本ffprobe確認AAC與長度差<0.1秒，build通過；tests/music-playback.html提供按下按鈕後的四首靜音播放解碼檢查。此測試不是聆聽驗收。

瀏覽器驗收完成：四首AAC均在使用者按鈕啟動的靜音解碼測試中readyState=4，currentTime超過0.3秒；正式build播放器可見原四首加新四首及時段標記。這證明載入與短段播放，不代表已完整聽完或主觀時段判斷獲確認。本輪在codex/ambient-music本機分支，尚未commit／推送。

## 2026-09-07 統一曲名與循環歌單

使用者要求將新增素材提交、其餘曲名一併整理並支援不同曲目循環。原四首UI名稱依序改為「沉光漫游」「水線低語」「晴光入水」「波影流年」，既有音檔路徑與byte不變；本次命名是編輯整理，不宣稱重新聆聽或辨識內容。

播放器標題改為「空間選曲」。預設勾選「循環歌單」，仍需手動按播放；當首ended後依序接下一首，第八首結束返回第一首，同步更新選單和進度。取消勾選時播完當首停止。維持原本背景暫停、回前景不自動恢復，以及載入失敗顯示錯誤的行為。沒有無縫銜接或crossfade。

驗收：27項Node測試與build通過；新增music-player.test.ts以假音訊事件驗證八首依序切換、末首返回、停用循環、背景暫停與dispose後不復播。先前四首AAC實際瀏覽器解碼驗收仍適用；本輪未以實際音訊等待八首完整播放。使用者已授權commit，本輪只本機提交，未push或開PR。

## 2026-09-09：製作室試聽

製作室沿用 `MusicPlayer.ts`，增加可保存的 track／loop／fadeSeconds 設定；淡入在使用者按播放後才執行，預設 0 秒維持既有行為。進入背景／dispose 會停止音訊與淡入 timer。音量仍可由觀賞者偏好調整；preset 的音量是試聽條件，不強制覆蓋已存偏好。來源與授權沒有因此改變。
