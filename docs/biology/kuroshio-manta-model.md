# 大鬼蝠魟（`Mobula birostris`）程序本體

## 狀態與範圍

- 狀態：已由潮風商店街 biology adapter 建立並受既有 motion／路徑流程驅動；2026-09-16 新版已完成本機三視圖、WebGL與600秒幾何抽樣；使用者美術確認與手機實機仍待驗收。
- 程式入口：`src/creatures/manta/MantaModel.ts`；輸出 `createMantaModel(span, seed)`。本體 local `+Z` 前、`+Y` 背側、`+X` 為定義中的右側翼。
- 尺度：`span` 為翼展公尺；模型限制輸入在 1.2–12 m。整合端沿用三個個體 5.8、5.4、5.1 m。

## 來源與授權

- 形態、顏色、翼面運動與 LOD 需求來自使用者提供的兩份任務書；本次幾何以 `quiet_places_giant_manta_geometry_spec_v1.md` 為主。
- 比例 anchor 參照 Marshall, Pierce & Bennett (2008) 的 `DW 2230–2370 mm`、`DL 1000–1010 mm`、厚度 `200–250 mm` 等標本表格；該三尾是 immature 個體，故此處只將比例當作**規格導出的 anatomical proxy**，不宣稱為成體固定比例或完整物種量測。
- 未使用外部模型、照片、貼圖或掃描資料；所有 geometry 與辨識花紋皆在 runtime 原創生成。因此外部視覺資產授權不適用；物種解剖精確度仍未驗證。

## 生物事實與美術近似

- 實作可辨識的大鬼蝠魟方向：寬鈍的 `.23W` 頭部、中央 station loft、近平順前緣與內凹後緣、翼根厚而翼端薄、terminal mouth、捲曲 ribbon 頭鰭、小型側眼、腹側五對曲線鰓裂、小骨盆／背鰭與 whip tail。
- 背側 charcoal 與肩白斑、腹側暖灰與後腹斑點均是 skin vertex colors，隨翼面變形而不會浮在表面外。白斑 T 型、後腹斑點與暗色口／頭鰭內側是 Manta Trust 診斷方向的程序化美術近似，seed 左右不完全鏡像；並非特定野外個體的花紋復刻。
- `update` 的翼面為 CPU 頂點位移：中央 body 保持穩定、行程向外翼漸增、翼根以內固定，沿前後弦有 `.42π` 延遲；最外14%的相位與行程收斂到同一翼尖，避免重合頂點被拉成破口。`amplitude: 0, glide: 0` 回到真正 neutral mesh；`glide` 才加入 tip dihedral。`asymmetry` 只控制左右翼行程，翼展保持不變以維持路徑碰撞包絡。它不是 CFD、軟體動力學或完整骨架系統。

## 製作與轉換

- 盤體由背／腹 planform surfaces 與完整邊界橋接構成封閉網格；不是雙面 plane。中央輪廓為 `.43W`，用 `+0.20…−0.22W` 的 station loft；視覺盤長受 posterior／翼面輪廓影響約為 `.43W`。最大 central thickness anchor 是 `.095W`，wing thickness 依 spanwise/chordwise taper。tail 長 `.45W`，Tube 中心線首點與尾根完全重合。
- `THREE.LOD`：LOD0 `<18 m` 是 `48×81`；LOD1 `18–40 m` 是 `28×41`；LOD2 `>40 m` 是 `16×25`。三層皆保留 mouth、ribbon lobes、eyes、dorsal／pelvic fins 和尾，只有 LOD0 加入五對鰓裂，斑點隨各層網格密度取樣。
- 5.8 m LOD0 body 是 7,776 vertices、15,548 triangles；`root.userData.geometry` 另提供 disc length、max thickness、mouth width、tail length（m）給 smoke／整合檢查。
- `dispose()` 擁有並釋放本模型的 geometry 與 material，然後自父節點移除 root。

## 本輪拒絕與修正

- 第一輪灰模暴露翼根厚度突然歸零、頭鰭僅旋轉薄帶、浮動嘴部与尾根等問題，未採用；拒絕圖保留於 `exports/last-arcade-manta-geometry/rejected-*.png`。
- 頭鰭改成雙層封邊的 C 形捲曲截面，修正 layer 頂點儲存與 index 不一致造成的鋸齒。內側深色、外側由灰腹轉深色背皮，左右幾何鏡像。
- 身體與翼根以平滑厚度過渡相接；前緣鈍頭採五次曲線。背／腹法線朝外；翼尖厚度、camber及拍翼相位同時收斂。
- 嘴唇依實際吻端曲線建Tube，口部由密集曲面條帶形成暗色窄縫，避免平面橢圓穿進曲面。它是淺口部近似，未建咽部、濾食結構或完整口腔體積。
- 背鰭改為薄的後掠曲面，骨盆鰭為小型有厚度鰭片，尾根隆起嵌入尾基。腹部38個seed橢圓色場取代條紋與浮動圓片；肩斑保留黑色中線，精細皮膚紋理尚未製作。

## 前次驗收紀錄與缺口（復原前的歷史）

- 16項相關tests通過：包含實際mesh比例、外向法線、內凹後緣、翼尖在四相位保持收合、中性姿態還原、LOD、seed、資源釋放，以及既有場景／運動／群游回歸。
- `npm run build`、`npm run check:project`通過；build有既有chunk大小提醒。
- Browser完成中性正交top/front/side、頭部與腹面、播放檢查。固定建置預覽無error/warn；截圖與數據見 `exports/last-arcade-manta-geometry/`。
- 600秒、0.5秒步進的新版變形頂點對39個建築代理為0接觸；只屬抽樣代理檢查，不是連續三角形碰撞證明。
- WebGL 17類檢查通過；暫停像素差0、離開場景回到暖機基準10 geometries/4 textures。畫面312,878 triangles／91 calls取自384×512測試，不能當手機fps。
- 既有10分鐘行為驗收是前版歷史證據；本輪未重做完整10分鐘browser或手機實測。未commit／push／發布，待使用者美術確認。


### 2026-09-17 場景避讓

場景控制器新增提早降速與生物間保守球體掃掠保護；模型本體未改。24組變形姿態全部LOD頂點均位於指定安全球內，900秒路徑測試未相交。實作權威 `src/places/last-arcade/biology/Motion.ts`；完整更新見 last-arcade 場景頁。
