# iPhone pilot 資產

`scripts/mobile-assets.mjs` 由 `assets/config/mobile-assets.json` 產生 `.mobile-public/`，供 iPhone pilot 的 Vite `publicDir` 使用：

```sh
node scripts/mobile-assets.mjs
```

輸出只包含 Seaward 的 `models/stingray.glb` 與共用八首 `.m4a`。每次會重新產生 `.mobile-public/mobile-assets.manifest.json`，其中每個檔案都有 bytes 與 SHA-256；準備過程在本機複製、讀檔與雜湊，不發出網路請求。GLB 若宣告 buffer 或 image 的外部 URI，腳本會失敗，避免離線 preview 遺漏檔案。

清單同時保留目前八景的 **active public runtime** 依賴與程式 provenance，供 app 擴展時檢查。Snowhall 目前由 `AntarcticLife` 的程序模型建立銀魚，因此 active public 檔案清單為空；場景筆記中留存的魟魚／GLB 歷史不是 runtime dependency。它是 inventory，**不是**其餘七景已進入 app 的聲明：本輪只有 Seaward 可被 native host 選作 pilot。

`public/favicon.svg`、HTML entry 與 Vite 的 `publicDir` 由 app host 負責；本資產準備器不複製它們，也不複製整個 `public/`（大小會隨場景變動）。
