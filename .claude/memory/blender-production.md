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
