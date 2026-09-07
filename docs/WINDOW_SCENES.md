# Window Scenes／窗景場景實作紀錄

> 版本提醒：本文光源與七尾 FloorKoi 描述是早期程序窗景紀錄，仍可參考 Oceanlight；目前 Blender Leaflight 以 [場景材質筆記](scenes/leaflight.md) 為準。

Leaflight（樹影午後）與 Oceanlight（海光之室）是目前可在場景選單切換的兩個窗景。它們以 `src/places/metadata.ts` 的四個固定輸出時刻為準：正午 12:00、黃昏 17:30、暮光 19:00、月光 23:00。

## 共享 runtime 與生命週期

場景 catalog 以 dynamic import 準備 factory；載入模組本身不配置 GPU 資源，只有目前 factory 建立的單一場景實例 active。切換時先取得新 factory，再 dispose 舊 place；窗景的 geometry、material、texture 與魚群資源皆隨 dispose 釋放，避免上一個場景持續掛在 scene 或更新。

每個窗景的主要光源是窗口 RectAreaLight，並以 HemisphereLight 近似窗外天空的間接填光；沒有室內 lamp fixture。牆地投影、葉影、空氣光、海面焦散與陰影是為構圖服務的程序式藝術近似，並非完整物理光照、真實遮蔽或 reference scene 的逐項重建。Oceanlight 的海面不是 GPU fluid solver。

FloorKoi 有七尾，路徑反射在 x `[-3.8, 3.8]`、z `[-3, 3]`，高度在 y `[0.16, 0.45]`。暫停／reduced-motion 將 update dt 傳為零，魚的位置不會前進；光和相機仍可重畫。runtime 將 dt 上限限制為 0.05 秒，標準品質以 30 fps、節能品質以 24 fps 更新；pixel ratio 也有品質與螢幕寬度上限。這些是既有 CPU／render 工作量限制，未構成裝置效能承諾。

## 八張輸出

「輸出樹影與海光」在 runtime 即時切換兩個窗景，對各四個時刻以固定 elapsed 生成 PNG。每張為 1024 × 1536，合計八張；瀏覽器使用 fflate 建立 `quiet-places-eight-moments.zip`，並在 gallery 內提供預覽、單張下載和 ZIP 下載。這不是預先包入的圖片資產。輸出期間會停用切換與 controls，完成後還原原本場景、時刻與相機。

## 已做的自動檢查與人工驗收

本機在 Node 23.10.0 執行：

```sh
node --experimental-strip-types --test tests/window-places.test.ts
```

結果為 3 passed、0 failed（約 223 ms）：Leaf 與 Ocean window place 均確認 dispose 後沒有 scene children，且各 distinct geometry／material 各釋放一次；FloorKoi 經 6,000 次 capped dt 更新仍在上述近地面邊界，dt=0 不移動，重複 dispose 安全。

主 agent 已在實際瀏覽器檢查切換／輸出並逐張查看八個 PNG；葉影、海面、焦散、窗口光與構圖是否達到使用者的美術目標，仍待醒來後確認。這份紀錄不宣稱參考圖的完美一致性、實體手機表現或正式部署驗證。
