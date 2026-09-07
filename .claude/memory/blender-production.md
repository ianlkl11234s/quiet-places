# Blender 製作接手點

2026-09-07。使用者已確認樟樹／午後窗光方向並授權開始。實作分支 `feat/blender-leaflight`，起點 `a2b69b6`；不必開新 session。以下是製作中的 checkpoint，並非美術驗收完成。

## 已有產物與證據

- `assets/blender/leaflight-study.blend`：房間、厚窗洞、主鏡頭、可連接的樟樹枝葉、窗外太陽與天空、程序石材、低密度散射。3717 葉；沒有魚／動畫／四時段。
- `assets/blender/scripts/leaflight.py`、`camphor.py`：固定 seed 的可重建來源。建立独立 scene，保留使用者原始 Scene。原未保存場景先存 `/tmp/stillwater-before-leaflight.blend` 快照，並仍在原 GUI 中。
- `render_study.py`：Metal-only，CPU device 禁用，CPU threads=2；512×768、24 samples，單張後退出。最初 Metal kernel 冷啟動約159秒，後續約6–13秒（含啟動，不當作效能 benchmark）。最後預覽 `exports/blender-review/leaflight-afternoon.png`。
- 重新開啟保存後母檔：active scene `Leaflight_Study`、有效 Camera、20 objects、missing images=[]。這是實際 CLI reopen，不只確認檔案存在。
- `export_study.py`：只複製本 study 的 evaluated meshes／camera 到臨時 export scene，原材質不改；排除 AirVolume 與 lights，最後清理自己建立的資料。
- `public/models/leaflight-study.glb`：18 nodes／17 meshes、72,450 triangles、3,886,836 bytes。原 camphor estimate 未包含完整 curve tessellation，實際預算以 GLB count 為準。
- `blender-review.html`／`src/blender-review.ts`：獨立 dev 對照頁，匯出鏡頭、即時窗框／葉影、±15° controls、on-demand render；未接入原場景選單。主要 app 未更改。
- Browser 實際載入成功，目視構圖／陰影；天空填光 checkbox 可操作。發現陰影停用需使材質 program 更新，已修正，關閉後實際葉影／窗框遮蔽消失，重新開啟可恢復。拖曳與 Home 已操作。
- `npm run build`、Python syntax、`git diff --check` 通過。build 保留原 bundle-size warning；review page 僅 dev entry，尚未加入 production 多頁入口。
- 資產 SHA-256 見 `exports/blender-review/manifest.json`。模型與程序材質自製，參考圖沒有嵌入模型／public。

## 下一段仍必須做

目前只有 P1 結構與早期 P2 技術試片，**P2 美術與網站一致性未通過**，不要直接開始魚或海景量產。

1. Blender 畫面仍與參考有差距：亮斑偏狹長、地面光分布不夠完整；石材微細節、暗部與光束需再調。樹型是程序近似，尚非精緻植物資產。
2. 網頁匯出目前明確為 geometry-only；缺少程序石材烘焙、间接光貼圖、葉片透光、空氣散射與軟陰影一致性。不能宣稱 Blender 材質已自動移植。先在一面牆／地板完成烘焙與即時直射光分離，再擴充。
3. 參考／Blender／網站同鏡頭對照，主 agent 修好明顯落差後再交使用者美術確認。
4. 維持分段 commits。大型資產當前不到1MB母檔／4MB GLB，可普通 Git 保存；未啟用 LFS、未 push／部署。

## 重跑

在 Blender MCP 執行 `runpy.run_path` 指向 `assets/blender/scripts/leaflight.py`，使用 `run_name='__main__'`。其輸出先為 scene library；以獨立 Blender 程序執行 `render_study.py` 會保存為正常可重開的 .blend 並算單張。`export_study.py` 的 `run()` 從目前 `Leaflight_Study` 匯出 GLB。

GUI 原場景有多個保留的 study iteration；不要刪除未確認的使用者場景。新的 `.blend` 只包含當前 study 的依賴與正常啟動所需資料。

對照頁：`npm run dev -- --port 5189 --strictPort` → `/blender-review.html`。原5188程序本輪中已不在監聽；沒有重啟或殺掉其他服務。本輪專用5189與測試分頁驗證後關閉。沒有排程／整夜渲染。

## 2026-09-07 動態滿版接入

使用者接受目前建模方向，授權先處理動態光影與網站，並指定像水景一樣滿版。此節取代上方「尚未接入」狀態；美術仍待使用者確認。

- 主應用 `/?place=leaflight` 已使用 Blender GLB，可在原場景選單往返水光之間。保留原浮動設定、音樂、時刻、光束、暫停與畫質控制。對照頁僅技術用途。
- RoomSurface 烘焙 albedo／normal／roughness，以及 512²、128 samples 的 diffuse indirect，經獨立 compositor 降噪；Metal-only、threads=2。`leaflight-web.blend` 與原 study 分開保存。raw EXR 放忽略的 cache，不發到網站。
- GPU 枝葉位移與 depth/distance shadow pass 同步；即時太陽陰影、室內窗洞限定光束、程序天空。瀏覽器使用 EXR 的垂直 UV 修正，間接光強度校準為 PI（資產 metadata 的 .65 是初始建議，runtime 為準）。
- 實際 browser 驗證主 app 樹影→水景→樹影、光束設定、午後時刻、暫停控制。Canvas 實測 765×912 與 viewport 相同，位於 (0,0)，沒有技術側欄。
- 限制：四時段共用午後間接光基底；葉片透光／軟陰影與參考圖仍有差距。尚未加入魚或新海景模型。不能宣稱已達參考圖寫實品質。
- `npm run build` 通過，保留既有 bundle-size warning。烘焙程序完成退出；主 app 限制 30/24 fps，暫停與背景停止持續動畫。非長時間效能 benchmark。
- 本地預覽使用 5188；本次未 push／部署。`docs/DEPLOYMENT.md` 屬另一工作來源，未纳入本次提交。

## 自然天空與開口散射調整

依使用者提供的美術描述：藍灰至灰白的漸層、低對比三層程序薄雲、地平線霧感；天空亮度不再綁定室內光束滑桿。樹的材質增加局部天空填光與依距離的空氣透視，保留不透明幾何與原投影；RoomSurface 只在距離窗洞近處加入弱藍灰補光。這是即時近似，並非重新計算完整天空全局照明或景深模糊。

主應用 browser 已目視確認枝葉不再純黑、房間維持暗調，無 console error/warning；build 與 diff check 通過（既有 bundle-size warning 保留）。原模型、構圖、水景與其他 session 的 DEPLOYMENT 文件未改。測試分頁驗證後關閉。

### 通透開口微調

降低天空霧白與薄雲混合強度，樹的空氣透視上限降為 2.5%。室內近似 volume 對穿越窗洞的視線不再疊加，避免天空／枝葉像覆蓋半透明膜；室內光束與窗邊局部補光保留。此處是視覺近似，不是玻璃材質（沒有新增玻璃）。主 app 日光 browser 目視開口更清楚、console 無錯誤；build/diff check 通過。
