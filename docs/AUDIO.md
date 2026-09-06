# 本地音樂素材

播放器使用瀏覽器原生 `HTMLAudioElement`，只在使用者按下「播放」後載入與播放，沒有 autoplay，也不會解碼整首檔案到 Web Audio 記憶體。

| UI 曲名 | 原始 byte 副本（ownership：僅保留） | 原始 SHA-256 | Web 發佈路徑（ownership：播放器使用） | Web SHA-256 |
| --- | --- | --- | --- | --- |
| 沉入日光 | `assets/audio-originals/submerged-sunlight-original.m4a` | `ed4857f03bf5252b07962de8c033d9fb7cd05d1abfbf19317ce54c82047bcaa0` | `public/audio/submerged-sunlight.m4a` | `4be5a84b7ce489fa31150d7f6a7d313ce816bbaaa54e7d5a0ed30681f0d6e7ea` |
| 水線低語 | `assets/audio-originals/waterline-hush-original.m4a` | `1004b8a4c64fe4b93e791654e61e8e07e544c359a04aebc5c9a9d3becf573938` | `public/audio/waterline-hush.m4a` | `91eb994cf5a1257045fd103f51d5c94ebc7b43badf3307ffaed1d5f373ac9153` |
| 穿過水面的陽光 | `assets/audio-originals/sun-through-water-original.m4a` | `87a8bdd0e4c8db636947d3bc2ffc2a48746c6449c0220dbd7767803c516dc890` | `public/audio/sun-through-water.m4a` | `0fc309190ebdc5625389e7ada7b06c11320fecdfdd04f3717cd1aee547589def` |
| 穿過水面的陽光（二） | `assets/audio-originals/sun-through-water-2-original.m4a` | `807d8bf38b36ad1c556fe781d3e9b316eafb82b28b75dca53ac6649330e09565` | `public/audio/sun-through-water-2.m4a` | `543ea4e478f492d52ab7f844ee61cf6e81359625f6835fb6f829604dbbde0380` |

`assets/audio-originals/` 是四份未轉碼、與 Downloads 原檔雜湊相同的 byte 副本，供追溯與重轉碼；`public/audio/` 是唯一供網站載入的 AAC-LC 版本。原始檔為 ISO MP4/M4A 容器中的 Opus；Web 版為 ISO MP4/M4A 容器、AAC-LC、48 kHz、stereo、目標 192 kb/s，長度分別為 219.69、188.21、240.61、218.29 秒。來源檔仍保留在 `/Users/migu/Downloads/`，未被刪除或改名。

## 授權狀態

目前沒有隨檔提供的公開散布授權、作者、來源網址或使用範圍證明。將此專案公開部署、分享或發行前，必須補齊每首曲目的權利人授權與可公開散布證明；在確認前僅應視為本機素材。
