# iPhone pilot 資產

`scripts/mobile-assets.mjs` 由 `assets/config/mobile-assets.json` 產生 `.mobile-public/`，供 iPhone pilot 的 Vite `publicDir` 使用：

```sh
node scripts/mobile-assets.mjs
```

輸出只包含 Seaward 的 `models/stingray.glb` 與共用八首 `.m4a`。每次會重新產生 `.mobile-public/mobile-assets.manifest.json` 與 `.mobile-public/room-manifests.json`；前者的每個 bundled 檔案都有 bytes 與 SHA-256，後者是八景的版本化下載契約。每個 room manifest 都是 `schemaVersion: 1`、`appSchemaVersion: 1`，並有 `roomId`、房間檔和共用檔完整 descriptors 導出的 `assetVersion`、完整下載 `totalBytes`、房間檔案的 path／bytes／SHA-256、共用音訊引用與既有程式 provenance。音訊內容改變也會改變引用它的每個房間版本。`licenseStatus` 目前是 `unverified; see docs/production/IPHONE_ASSETS.md`，不能當成已核實的授權。`totalBytes` 包含引用的共用音訊，所以可表示一個獨立可離線房間所需的總量。

同一次執行也會在 repo 內產生 `.mobile-downloads/`：它含八景所有 allowlisted public runtime 檔案、`mobile-assets.manifest.json` 和同一份 `room-manifests.json`，供本機 Simulator 的下載／hash／離線流程驗證。這不是 app bundle，也不會發布或連網。準備過程只在本機複製、讀檔與雜湊。任何 allowlisted GLB 若宣告 buffer 或 image 的外部 URI，腳本都會失敗，避免下載 payload 漏掉外部依賴。

清單同時保留目前八景的 **active public runtime** 依賴與程式 provenance，供 app 擴展時檢查。Snowhall 目前由 `AntarcticLife` 的程序模型建立銀魚，因此 active public 檔案清單為空；場景筆記中留存的魟魚／GLB 歷史不是 runtime dependency。它是 inventory 與本機下載 payload，**不是**其餘七景已進入 app bundle 或完成實機驗收的聲明：本輪只有 Seaward 可被 native host 選作 pilot。

`public/favicon.svg`、HTML entry 與 Vite 的 `publicDir` 由 app host 負責；本資產準備器不複製它們，也不複製整個 `public/`（大小會隨場景變動）。
