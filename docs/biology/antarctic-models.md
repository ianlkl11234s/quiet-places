# 南極玻璃魷魚與銀魚程序模型

## 2026-09-13 草稿本體

- 狀態：銀魚已接入雪光長廊；魷魚依使用者最新要求從正式場景停用，模型、動態、近看試片與測試全部保留。銀魚版本於 2026-09-13 已獲使用者確認；PR／部署另列證據，未聲稱為 Blender 或實機驗收。
- 程式權威：[AntarcticModels.ts](../../src/shared/biology/antarctic/AntarcticModels.ts)。`createGlassSquid(seed)` 與 `createSilverfish(seed)` 都回傳 local-space `root`、`update(time, speedBL, turn, light)`、`dispose()`；兩者 `+Y` 向上、local `+Z` 是前進方向。場景 adapter 擁有位置、尺度、朝向與群體路徑。
- 來源與範圍：依 2026-09-13 提供的 `01-galiteuthis-glacialis.md`、`02-pleuragramma-antarcticum.md`。物種形態依其 [A] 摘要；比例與游動頻率為文件明示的 [C] 工程／美術近似，非運動學量測。

### Galiteuthis glacialis

- 尺度：mantle length = 1，細長 mantle 長度為 1 ML。模型含 posterior fins、頭部雙眼、visceral core 與 gladius-like central line；8 arms 各有不同 resting arc 與末端內彎，兩條約 .98／1.10 ML 的細長 tentacles 帶微小 distal club。anterior 留小頸口並由頭部包覆，posterior 維持尖收。
- 材質：`MeshPhysicalMaterial` 的低透明 mantle、fins 與觸手，以 transmission、厚度和角度產生弱輪廓可見度；沒有 emissive 或 photophore。`light` 只連續壓低可見度，不能自行閃爍。
- 動態：mantle 另有 .4% 的微量橫向形變。兩側 fins 以個體約 .37–.47 Hz 低頻、相位不完全鏡像的程序波形更新。觸手使用線性二階阻尼系統的解析穩態 harmonic response（gain/lag），先沿 local `+Z` 伸出頭前再以柔軟下垂與拖尾近似；同一 `time`、rewind 與不同 frame partition 都不積分累積漂移。這不是 CFD、PBD 繩索或物種特異的游動資料。

### Pleuragramma antarcticum

- 尺度：body length = 1。24 個縱向 ring 的連續程序 body，profile 在尾端收成細尾柄；含 caudal、dorsal、anal 與 pectoral fins，避免單一橢球。
- 動態：頂點以沿 head 到 tail 的 traveling wave 變形，振幅由頭端約 .006 BL 升至尾端約 .058 BL，個體固定約 2.07–2.63 Hz phase 以 elapsed 計算、`speedBL` 只連續調整振幅，故改速不跳相位；turn 以平滑後段 curvature 疊加。每次更新重新計算法線，使受光面與實際波形一致。
- 材質：nonemissive cold-silver `MeshStandardMaterial`，低 metalness（.045）與中等 roughness（.42）。本體保留 `light` 的 1.3 次方反射 radiance 衰減參數（onBeforeCompile），但正式雪光長廊依使用者回饋固定傳 1，取消額外暗區衰減；無時間 opacity pulse；銀色亮點需由場景的窗面 AreaLight／環境反射形成，不是 LED。

## 資源與驗證

- 每一 instance 自己擁有 geometry、material；同體的 fins／arms 共用其 attached material，`dispose()` traverse 後釋放並移除 root。行為 adapter 可用本體回傳的 conservative local `safeRadius`：squid 1.70 ML、fish .74 BL；這是跨不同 speed／turn／time 取全部 vertex 對 root 原點的上界，不是生物半徑。幾何為每體低面數 BufferGeometry，可供約 30 隻作為起始預算，是否 instancing 由日後群游 adapter 與 profiler 決定。
- 本次跑 `npx tsc --noEmit`、本體 Node tests 與 `git diff --check`，通過。已做正式 factory、真 geometry、browser 正午／月夜與暫停檢查，細節見場景頁；未驗證實體裝置效能、真實生物運動學或使用者美術確認。

解析觸腕使用標準線性二階系統的穩態幅頻響應：`r = 2πf / 2.2`、gain = `1 / hypot(1-r², 2ζr)`、lag = `atan2(2ζr,1-r²)`；2.2 rad/s 與 ζ 是工程校準，不是剛體碰撞或任意外力的完整積分。速度改幅度，不用 `f(speed) × elapsed` 造成相位跳動。

## 復用模組索引與責任

| 模組／入口 | 可直接復用的部分 | 場景依賴／責任 |
| --- | --- | --- |
| `src/shared/biology/antarctic/AntarcticModels.ts`：`createSilverfish(seed)`、`createGlassSquid(seed)` | 程序模型、非發光材質、尾波／鰭／觸腕變形、root 安全半徑、dispose | 本體 local +Z 前進、+Y 向上；呼叫方決定世界尺度、位置、朝向和光參數。每 instance 自己持有 geometry/material，使用後 dispose |
| `src/places/snowhall/AntarcticBehavior.ts`：`AntarcticBehavior` | 可參考 fixed 60 Hz、分流 seed、absolute elapsed 插值、弧長路徑、群游力、停留、鏡頭 swept-sphere 與整魚退場條件 | **目前為 snowhall 專用，尚非通用群游引擎**；窗光 proxy、走廊深度、路徑、事件與攝影機語義需依新景重做驗收，不能直接宣稱支援任意空間 |
| `src/places/snowhall/AntarcticLife.ts`：`createAntarcticLife(parent,layout,seed)` | simulation → mesh pose 的接入方式、fish lazy allocation、重複 dispose 防護 | adapter 持有全部本體；由 PlaceInstance 提供 elapsed，不另開 RAF。layout 變更須釋放舊 instance 再重建 |
| `assets/config/snowhall-biology.json` | seed 時間步、數量、群速、間隔、停留及碰撞校準入口 | 是藝術／工程參數，不是物種資料。`squid.countMin/countMax=0` 是使用者已確認場景決策 |
| `AntarcticDebug.ts`、`tests/snowhall-biology.html`／`.ts` | 導航／路徑／事件讀回、固定 seed/elapsed、形態近看、真 canvas PNG | 僅驗收工具；不進正式播放器。使用與正式入口相同的 factory／模型 |
| `tests/antarctic-models.test.ts`、`antarctic-life.test.ts`、`antarctic-behavior.test.ts` | 本體法線與安全半徑、實際變形頂點邊界、資源 ownership、時間重現、進退場與實際圈行／停留 | 新景應換成其真實碰撞幾何及相機條件，不能以通過 snowhall 測試替代新場景驗收 |
| `src/places/snowhall/Layout.ts`、`Daylight.ts`、`Materials.ts`、`Snow.ts` | 走廊參數試片、窗面自然光與程序材質／雪的參考實作 | 場景專用光路與尺度；不因重用模型改曝光或另加自發光 |
| `src/shared/math/seededRandom.ts`、`src/player/contracts.ts` | 已有 seed 亂數與 PlaceFactory／PlaceInstance 生命週期契約 | 沿用全站時鐘、暫停和 dispose，不另建立第二套播放系統 |

最短復用步驟：先選本體 factory → 由新景 adapter 設定 root 尺度／位置／四元數 → 每幀以同一 elapsed 呼叫 `update(time,speedBL,turn,light)` → 保留前向軸、完整 radius 與資源 ownership → 以新景碰撞體做 test/browser 驗收。玻璃魷魚可在驗收頁切「魷魚形態近看」重新檢視；不得因此改動正式數量。

原始需求在 `docs/biology/references/antarctic/`；可重建幾何權威是 TypeScript，無需下載外部模型或 Blender 才能重建本輪本體。
