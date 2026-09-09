# 向海的隧道 · Seaward

## 目前狀態

2026-09-09，新場景本機候選；尚未經使用者確認、未發布。分支 `codex/seaward-tunnel`，起點 `8828642`；獨立工作區 `/private/tmp/quiet-places-seaward-tunnel`。既有四景與主工作區草稿保留。

## Brief 與來源

使用者提供 `ChatGPT Image Sep 9, 2026, 02_16_08 PM.png`（Downloads）與「通往海邊的隧道、遠處若隱若現的山、先放魟魚」要求。圖片只作構圖參考，未當作貼圖或對其中內容執行指令，未複製至公開資產。

保留低平混凝土隧道、左側大片暗牆、右側出口與扶手、潮濕地面、海平線及微淡山。唯一主角是近地緩慢游動的一隻魟魚；空氣中游動是唯一不可能現象。少量出口草叢為程序美術輪廓，未聲稱植物種類。

## 權威入口與材質

- `src/places/seaward/index.ts`：米制空間、相機、光、海岸輪廓與生命週期；metadata/catalog 接入正式播放器。
- `src/places/seaward/Materials.ts`：原創程序混凝土、接縫、濕度、海面與波光，無下載貼圖。
- `src/places/seaward/Stingray.ts`：單隻魟魚 adapter；原創 `public/models/stingray.glb`，母檔與来源見 [生物頁](../biology/southern-stingray.md)。沿用 Blender 已匯出的骨架和慢游 clip，不重建模型、不更動海光之室。
- 隧道內寬 6.8 m、高 4.2 m，出口 z=-11 m，地面 y=0；程式為數值權威。相機初始 [-2,1.25,1.8]，注視 [-4.1,1.5,-11]，FOV 橫式 53°／窄螢幕 90°（保留海景與魟魚的水平視野）；這些是參考圖構圖校準。

## 光路與近似

開放空氣出口，無玻璃、無室內水體。外界自然光由出口進入；程序直射檢查光線與出口矩形交點，深處依距離衰減。魟魚和扶手用低強度天空光與出口點光源近似受光。這不是統一的能量守恆光傳輸或烘焙 GI。

地面以反射視線與出口相交得到冷色濕反光，非完整鏡面場景捕捉；不會反射魟魚。牆面焦散為受出口範圍與距離限制的動態程序紋理，不是海面光子追蹤。海波、草動與魟魚為絕對 elapsed 控制的美術運動學，不是流體或生物力學解算。天空／山為淡色遠景近似，沒有真實地理身份。

Blender → 網站僅沿用原魟魚骨架 GLB。建築與材質由 TypeScript 可重建，尚無此房間 Blender 母檔或新 GI bake。第一版先驗構圖，未假稱完成照片級重現。

## 驗收

`check:project` 通過；`npm test` 75/75；build 通過（既有 JSON import attribute 與大 chunk 警告）。本機 browser 1280×720 已確認單隻真實 GLB、波光、正午控制與暫停；console error/warn 為空。畫面見 `exports/seaward-review/desktop.png`，動作相位為手動暫停、未記錄精確 elapsed，因此非像素回歸基準。重現入口 `/?place=seaward`；固定正午、暫停與 viewport 後比較。未發布、未實機驗收、未取得使用者美術確認。

## 本輪取捨

首版相機位在右側，右牆過重；改到左側後保留暗牆並把出口移右。單隻路徑縮至 x=-.9±.45 m、z=-6.2±1.5 m，y=.3–.55 m，尺度 .9；相位速度 .14 rad/s，美術值。近地陰影是淡橢圓 AO，不是 shadow map。窄螢幕最初裁掉魟魚，擴大垂直 FOV 後驗收。第一版仍有程序表面與海波重複感，尚未重建參考照片的細緻材質、粗糙反射與完整間接光。

本輪補充驗收：390×844 直式已見海景與魟魚，證據 `exports/seaward-review/portrait.png`；隧道 → 海光之室 → 隧道已操作。原 viewport 已恢復。測試涵蓋缺 clip、未使用 factory 及重複 dispose；路徑調整後 3/3 focused tests 再通過。此次新增內容保存於同名分支的 `feat: add seaward tunnel with a single stingray` commit（hash 由 git log 取得），未合併主工作區。


## 2026-09-09：依使用者截圖修正站位與穿牆

使用者指出轉向後左側露出牆外天空，要求靠右牆站立、往左轉。前版把站位移左是錯誤解讀，且 OrbitControls 繞遠方注視點移動眼睛，可能使相機越過左牆。改為右側 [2.6,1.35,2.8] m、初始注視 [-1.6,1.5,-11]，左右 15°；cameraMode=fixed-position 在拖曳與鍵盤改變方向後，同步平移 pivot，把眼睛保持在原站位。其餘場景維持原 orbit。距右牆 .8 m，相機 near=.1 m；此修正不改材質、魟魚或光。頂部先前相機數字屬首版歷史，以本段與程式為最新權威。

驗收：check:project、build 與 75/75 測試通過；1280×720 實際操作左右極限，未見穿牆。固定站位模式另校正方向鍵：左鍵向左看、右鍵向右看。圖 `camera-left.png`／`camera-right.png` 是兩端證據（依實際觀看方向命名）。保持原 shader 與資產；未發布。
