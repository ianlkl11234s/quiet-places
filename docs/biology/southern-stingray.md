# Southern stingray（`Hypanus americanus`）製作頁

> 狀態：2026-09-07 的本地製作與程式整合紀錄。骨架版已接入正式海光場景路徑；已完成實際 GLB、測試與本機 browser 整合檢查；實機效能仍未驗收。它不是 81 項任務書的完成宣告，也不是流體、軟體或生物力學模擬的驗收。

## 範圍與來源

- 場景：海光之室；場景脈絡與光路見[海光筆記](../scenes/oceanlight.md)。網站接入路徑為 `src/places/oceanlight/Stingrays.ts` 與 `src/places/oceanlight/StingrayMotion.ts`；不以舊 `studies/` 目錄狀態判定正式接入。
- 生物形態參考：[Florida Museum 的 Southern Stingray species profile](https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/southern-stingray/)。本頁採用其可辨識特徵作為造型方向：菱形胸鰭盤、背側眼與噴水孔、腹側口與鰓裂、細長尾。
- 游姿方向參考：[Rosenberger & Westneat 1999 原始論文摘要](https://journals.biologists.com/jeb/article/202/24/3523/8283/Functional-morphology-of-undulatory-pectoral-fin)，研究物種為藍斑魟 `Taeniura lymma`，描述由前向後傳遞的胸鰭波。僅作運動方式參考，不能當作 Southern stingray 的速度／頻率量測。形態頁與論文摘要於2026-09-07核對；未將外部圖片複製到repo。
- 製作需求參考見[任務書來源紀錄](references/README.md)。它是使用者提供的參考需求，不等於每個條款已實作或驗收。
- 資產來源：`assets/blender/scripts/stingray.py` 程序生成原創幾何與頂點色；`assets/blender/stingray.blend` 為可編輯母檔；`public/models/stingray.glb` 為網站模型。已知未使用下載模型或照片貼圖。外部生物參考的圖片、文字及其再利用授權未逐項盤點，故其再利用授權為未知；本專案不應重發布那些參考內容。

## 生物事實與美術近似的邊界

可支撐的生物方向是連續胸鰭盤、中心較厚而邊緣較薄、背側感官構造、腹側口／成對鰓裂，以及向後傳遞的胸鰭波。模型的精確比例、面數、材質顏色、輪廓簡化、眼與皮褶的幾何表現，仍是原創美術重建，未聲稱為解剖精確模型。

兩隻個體的橫向 8 字路徑、短暫加速、抬升／滑降、個體錯相與近地陰影是場景編舞與 AO 視覺提示。室內仍採乾燥空間／窗外海水的設定；這不建立室內水體、浮力、碰撞避障、覓食或自主生態行為。胸鰭與尾部均為運動學近似，不是 CFD、流體、soft-body 或定量生物力學結果。

## 資產、座標與材質

- 產生方式：Blender 背景模式可執行 `assets/blender/scripts/stingray.py`；腳本以 `W=1.34`、`L=1.117`、`TL=1.65`（m）與 `U=7`、`V=4` 建立可調的截面盤面、尾部與骨架網格。這些是專案預設與美術起點，不是成體族群的測量結論。
- Blender 原生座標為 `+Y` 鼻端／前方、`+Z` 背側／上方。`SRAY_ROOT__Three_Z_Forward` 以 Z 軸 180°修正並以 `export_yup=True` 輸出，供網站使用局部 `+Z` 前方、`+Y` 上方；路徑載體處理世界位置與朝向，避免再疊加 clip root motion。
- `SRAY_SectionQuadDisc` 是四邊形為主的胸鰭盤；中心厚、外緣薄。`SRAY_Mottle` 是唯一預期輸出為 `COLOR_0` 的頂點色，僅用於 disc；尾、褶、眼窩與眼瞼使用獨立實色上側材質。腹面、口、噴水孔、眼與 10 條鰓裂為可見辨識細節，非醫學或解剖驗證。
- 腳本會輸出 `.blend`、選取資產而排除 review studio 的 `.glb`，並產出頂視與側視 review 圖。整合時讀得 GLB SHA-256 為 `e5909d095f4c09971b35e917e7c8b16e3a3468405b798373da8837d24bc89061`；實際 GLB 讀回：1,859,344 bytes、23 meshes、11,126 triangles、1 skin／72 joints、8 clips；只有 `SRAY_SectionQuadDisc` 帶 `COLOR_0`。完整清單見[資產讀回](../../exports/shared-scene-review/stingray-asset-readback.json)。

## 骨架、Actions 與網站行為

- `SRAY_RIG` 有 56 個分散胸鰭控制骨：`L_FIN_U00_V01` 至 `R_FIN_U06_V04`；每骨帶有 `side`、`u`、`v`、`role=fin` custom properties。核心骨保持較剛性，胸鰭權重按縱向／徑向格插值。
- `tail_01` 至 `tail_10` 是有序尾骨。直游 clip 保持尾部中性；網站以路徑朝向與高度的短歷史延遲，覆寫成衰減的尾部反應。這是可調的被動拖曳表現，沒有宣稱量測尾剛性或水阻。
- 產生器在 30 fps 建立 8 個 Actions：`SRAY_ACT_IDLE_HOVER`（4 s）、`SRAY_ACT_SLOW_CRUISE`（2 s）、`SRAY_ACT_CRUISE`（1.4 s）、`SRAY_ACT_TURN_LEFT`／`RIGHT`（各 2 s）、`SRAY_ACT_RISE`／`SETTLE`（各 3 s）、`SRAY_ACT_RISE_AND_SETTLE`（6 s）。所有 Actions 以 muted NLA tracks 保留；slow cruise 是檢視中的 active action。slow cruise 與雙轉彎是一個完整 2 秒循環；rise／settle 是非循環 body offset，root translation/yaw 維持中性。
- `StingrayMotion.ts` 以可重現的弧長 8 字路徑供兩隻個體取樣，並提供位置、朝向、速度、bank、turn 與距離連續的 fin phase。`Stingrays.ts` 載入 `SRAY_ACT_SLOW_CRUISE`、`SRAY_ACT_TURN_LEFT`、`SRAY_ACT_TURN_RIGHT`，混合強度隨轉向與鰭振幅改變；每幀用絕對 elapsed 重設 action time，使暫停／重播不依賴累積 dt。這些是程式行為設計，不應外推為真實習性。

## 已知驗收、待補驗收與限制

2026-09-07 在 `codex/shared-scene-elements` 完成整合：

- 實際 GLB 測試通過：本體已輸出、蒙皮權重總和為1、三個網站動作各2秒、鰭骨軌道非靜止且循環首尾匹配。根節點的軸轉換亦已從GLB讀回；沒有重新執行整套Blender建模流程。
- `npm test` 17/17通過，含獨立骨架、同elapsed暫停、資源釋放與 borrowed floor／volume不被魟魚釋放；`npm run build`通過，保留既有主bundle大於500kB提示。
- 本機Codex瀏覽器1280×720確認兩隻魟魚載入、半窗至全淹潮汐、暫停／恢復與切換場景返回；error／warn為空。完整記錄見[整合驗收](../VALIDATION.md)，圖片見[海光全淹](../../exports/shared-scene-review/oceanlight-stingrays-submerged.jpg)。
- 使用者表示海光製作完成；本輪保留其完成版的造型、游姿、受光與速度，沒有再次改動美術參數。頂／側圖來自同次來源快照；studio／underside為較早版本，不作目前完整造型證據。
- 未驗證：本輪沒有重做中性光完整動作影片、所有姿態精確碰撞、實體裝置FPS／GPU記憶體／耗電，亦未逐項驗收任務書的81項條款。生物學精確比例、游速與頻率校準仍需物種條件資料。
- 已由 [PR #2](https://github.com/ianlkl11234s/quiet-places/pull/2) 合併至 `main`（`27e597f`）；正式部署未驗證。

## 後續變更紀錄規則

改動樹種、材質、光線或本生物的模型／行為時，保留本頁的已確認基準，新增日期段落並記錄：修改原因、受影響資產與程式、參考來源、座標或單位換算、物理與美術近似的分界、驗收命令／視覺條件、以及 commit（如有）。共同光路原則才更新[材質與光照製作筆記](../MATERIALS_AND_LIGHTING.md)。

來源完成版已保存為 `6a2533f`（`feat(oceanlight): add rigged stingrays and smooth tidal transitions`）；本整理已由 PR #2 合併至 `main`（`27e597f`）。


## 2026-09-09：向海的隧道 adapter

[向海的隧道](../scenes/seaward.md) 以 `src/places/seaward/Stingray.ts` 沿用同一 GLB 與 SLOW_CRUISE clip，單隻 .9 尺度、原生材質與絕對 elapsed；資產、骨架與海光之室 adapter 未修改。路徑與近地 AO 屬此房間的美術近似。新增 factory 資源／缺 clip／暫停測試通過；真 GLB 已在本機 browser 顯示，未宣稱重新驗證生物形態。

## 2026-09-09：隧道寫實候選

僅 seaward adapter：平飛升高12cm，保留先升空／翻圈／回平／下降；增加低幅俯仰、bank及尾骨微彎。原GLB與海光adapter不改。真模型完整路徑離地測試持續驗證；仍屬藝術運動學，不宣稱生物學準確。可回退基準ef9bb96，詳見隧道場景最新候選紀錄。
