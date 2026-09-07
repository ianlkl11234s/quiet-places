# Blender 製作接手點

## 目前確認的視覺基準（2026-09-07）

使用者在修正錦鯉暗部光照後回覆「目前蠻好的」，並要求保存前面調整的光影。本節為最新接手狀態；下方早期「未接入網站／沒有魚／待開始」敘述是製作歷史，不代表目前狀態。

- 分支：`feat/blender-leaflight`。
- **已確認的應用版本：`b6241fbbd96443625101bec10e11be80198427b0`**。
- 入口：`http://127.0.0.1:5188/?place=leaflight`（需本機 dev server）。這是本地視覺確認，未因本次紀錄而發布。
- 確認範圍：目前樹影房間與錦鯉的整體效果可作為後續基準；不等同所有時段／裝置或完整物理 GI 都已驗收。

### 應保留的光影與氛圍

| 部位 | 已確認方向 | 對應提交 |
|---|---|---|
| 房間 | 滿版暗室、大片留白、右上窗洞與斜向日照；枝葉與投影同步微動 | `fc4d130` |
| 天空／窗邊 | 淡藍至灰色漸層與克制薄雲；窗洞附近弱冷色補光，深處維持暗調 | `3c0167e` |
| 通透開口 | 無玻璃、反光或霧膜感；室內 volume 不疊在穿越開口的視線上，枝葉仍清楚 | `882c9d1` |
| 錦鯉 | 三尾白紅斑魚貼近地面緩游，穿越光斑與暗處，擺尾連動、真實接收與投射陰影 | `568958c` |
| 魚身暗部 | 不使用整條魚均勻藍灰的補光；朝窗方向與距離決定冷色受光，腹部參考附近地板日照反射 | `b6241fb` |

### 後續修改與復原

後續細化以這一版為比較基準，尤其避免重新出現霧白窗外、純黑紙片枝葉、過亮室內或均勻灰色魚身。仍可改進鱗片、魚鰭與 GI 精度，但不要把視覺近似描述成完整物理求解。

要重看基準，先保留當前未提交工作，再从上述完整 commit 建立獨立分支或 worktree；不要對現有工作區做 `reset --hard`。模型、烘焙資產、程式均已在該提交中，來源與重建方式見下方歷史紀錄。

本次僅整理文件，不變更畫面、參數或使用者的時刻設定。`docs/DEPLOYMENT.md` 為其他工作來源，維持未納入本次 commit。

---

## 製作歷史

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

## Blender 錦鯉接入樹影房間

新增 `assets/blender/koi.blend`、可重建 `scripts/koi.py` 與 `public/models/koi.glb`。白紅斑錦鯉、眼睛／鬚／魚鰭／雙叉尾；body/fins 同組 morph travelling wave，GLB Swim animation 實際長度與 hash 見 koi.metadata.json。原 room study 與 GUI 未修改。

`BlenderKoi.ts` 以三個 animation mixer 驅動同資產 clone，78 秒低速迴游，錯開三分之一圈以避免交疊；中心離地 .25–.31m。真正 castShadow/receiveShadow，弱非 emissive 漫反射填光隨 daylight 下降。葉影、房間遮蔽與日照共用 directional shadow map。LeaflightPlace 預載魚資產後才切換；釋放 mixer、clone material 與 single-owner shared assets。

驗收：主 app 無 browser error/warning；目視暗處與日照中的魚亮度不同，日照魚有地面投影。Node 實際載入 GLB／runtime，每 4 秒採樣至 88 秒：mesh 頂點皆在房間內、最低離地 .083m、最高 .502m、魚中心距離 >1.2m；相同 elapsed 還原相同位置，dispose 重複呼叫不重複釋放，7 geometries 釋放。build/diff check 通過。

限制：第一版低多邊形錦鯉，美術可再細化鱗片、透光魚鰭與游姿；未做水體流體／碰撞求解。原 room volume 仍為近似，沒有動態魚身 depth texture 截斷。不是完整物理離線渲染。未 push／發布。

### 錦鯉暗部立體光照

移除均勻藍灰補光，改為 world-space 法線對窗洞方向的 cosine、窗洞面積／距離平方衰減。腹部以附近地板的一點 shadow-map 日照取樣近似反射光，保留非常弱的基底。morph 後座標用於補光，主日光／投影不變。這是有限開口與單點地板反射近似，沒有宣稱完整 GI。browser 日照圖可見暗處魚身有明暗梯度、亮區投影保留；無 console errors。build/diff check 通過；測試前 23:00 已恢復，本次測試分頁已關閉。
