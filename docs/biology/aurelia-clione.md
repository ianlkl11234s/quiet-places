# 海月水母／裸海蝶 · 雪落海窗

> 最新數量（2026-09-10）：依使用者要求，正式雪景海天使／裸海蝶由 5 隻增為 **7 隻**，水母仍為 3 隻。使用既有 CLIONE_6／7 的獨立位置、相位與頻率，其他材質、鏡頭與動態不變。模型工廠／近看工具預設及先前 Blender 快取仍為 5 隻，以下 5 隻驗收紀錄屬前版。

## 狀態與來源

2026-09-10，本機雪景已接入 **3 隻 Aurelia-like 海月水母 + 5 隻 Clione-like 裸海蝶**。使用者提供 `snow_scene_aurelia_clione_codex_spec_v1.md`，副本保存在 `exports/snowwindow-biology-20260910/user-spec-v1.md`。文件中的工程要求用作製作 brief；角色宣告不改變工具權限，科學數值亦不直接視為已驗證事實。保留使用者已選定的雪景相機、窗、海、平台、材質與光路；「不可見水介質」用在生物所在的室內空間，不移除原已要求保留的窗外海洋。

模型與材質全為本次原創程序幾何，未下載外部模型、照片或生物貼圖。學名用來約束造型方向，不聲稱完成種級分類鑑定或掃描重建。Web 入口 `src/places/snowwindow/Creatures.ts`；可重用本體 `src/shared/biology/aurelia/`、`src/shared/biology/clione/`；位置、受力與編舞權威 `CreatureMotion.ts`。

核對的研究與資料來源（2026-09-10）：

- [MarLIN Aurelia](https://www.marlin.ac.uk/species/detail/2089)：扁碟形傘、邊緣變薄、四瓣馬蹄形 gonads、四口腕與放射／環管。
- [Villanueva et al. 2014](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0098310)：柔性邊緣、收縮／放鬆路徑差異與 rollout；83% 是研究樣本的外傘弧長位置，不是所有個體的半徑比例。
- [Gemmell et al. 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC3816424/)：特定研究中的 post-relaxation 位移占比約 32%，不可當所有體型海月的固定常數；搜尋讀回摘要，直接頁面曾有 bot challenge。
- [Szymik & Satterlie 2011](https://pubmed.ncbi.nlm.nih.gov/22071184/)：快泳伴隨翼速、運動範圍、AoA 與彎曲改變；搜尋讀回摘要，直接頁面曾有 bot challenge。
- [Clione locomotor review](https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2022.1072974/full)：慢／快運動控制背景。文獻不替本版 force coefficient 或實際照度背書。

## A／B／C 證據界線

A 層：扁傘、四瓣 gonads、四口腕、短觸手、殼缺失、透明體與兩側 parapodia 等形態；Clione 慢拍 1–2 Hz／快拍 2–5 Hz 作規格約束。不是每個材料、尺寸或運動係數都由文獻測得。

B 層：Aurelia 半徑 .80..1 的柔性區是將弧長觀察轉成可運算幾何的近似；120 Hz 彈簧阻尼、PBD、八扇區時序、added mass、二次阻力、PER 代理；Clione 每翼八個 blade elements、前後緣相位差、姿態積分。這些不是 CFD、神經肌肉或組織有限元素求解。

C 層：英雄尺寸、五隻裸海蝶頻率差、位置／間距、負浮力校準、顏色／透明度、稀疏事件、區域偏好、力係數與 quietness。虛擬介質 1025 kg/m³、1.05e-3 Pa·s、9.81 m/s² 是動畫介質設定，不是當前海況實測，更不是室內空氣密度。

## 幾何、座標與光照

- 本體以 local +Z 朝頭／傘頂；場景用 quaternion 將其映到 Three.js +Y，尺度是米；相機預設保持 `[2.38,2.92,-1.28] → [-.1,2.35,-4.82]`、FOV 56°。
- Aurelia 直徑 .30／.25／.20 m；實體內外傘面中央厚、邊緣薄，四獨立 gonads、16 主放射管 + 16 真分支、環管、4 條摺邊口腕、128 條 web 線觸手（32 PBD guides）、8 邊緣感官區。內外表面具有幾何厚度；中心與周邊不同形變，不縮放整隻模型。
- Clione .032..040 m；單調 Hermite 身體半徑、封閉頭尾、橘紅內臟、兩層翼足厚度。root/mid/tip/lead/trail 控制節點與連續頂點形變共同表現翼足，沒有羽毛、殼或大翅膀 fantasy 放大。
- 不使用 emission。生物借用現有玻璃的冷天空 cubemap 作反射代理，亮度跟隨日夜，不新增室內燈；alpha/transmission 多層透明為即時近似，不包含完整多重折射／遮蔽。近看檢查工作頁的照明只為辨識模型，並未改動正式雪景。

## 動態與可調範圍

- 共用播放器 elapsed，無生物自建 RAF；root 固定 120 Hz 積分，暫停不變、時間倒退可重建。海月相位使用頻率調制的解析積分，裸海蝶 phase 由 main 逐步累加，切 gait 不以 f(t)×t 重算。
- Aurelia .38／.44／.34 Hz；收縮 .30、恢復 .45、滑行 .25。八扇區微小 phase 差與阻尼邊緣，口腕與觸手有 PBD 延遲。完整 cycle 決定稀疏停留，active 狀態加脈動幅度；本版未做 active 的獨立 .55–.80 Hz 高頻 oscillator。
- Root 推力由收縮速度代理與平滑 refill／PER 項形成，二次阻力作用於相對共同水流速度；用 quaternion 與有界角速度轉向，velocity 不直接改成新朝向。場景輕微負浮力與軟區域回復是避免持續漂到天花板的美術校準。
- 裸海蝶五隻慢拍基準 1.14／1.27／1.39／1.51／1.63 Hz，緩慢 ±4.5% 變化；hover/swim/sink/turn，罕見 escape（預設第 108 秒後的短事件），hunt 工廠可用但預設不進入。0.35 秒混合翼幅、AoA、flex、lag、rise；phase 連續。低階力由兩半拍貢獻，上下並非鳥類式恢復拍。
- 共同流場為三個 b⊥k 正弦向量模態，解析 divergence-free、無逐幀 random，合成上界 .0093 m/s，再乘 currentGain／quietness。初始 seed 2718 派生每隻固定 seed。
- 不使用 Boids alignment；軟間距／牆窗邊界、弱區域偏好。僅第一隻裸海蝶具有每 47 秒的小幅靠近鏡頭區域偏好，不多人同步穿越。這是編舞，不是生物事實。
- 調整入口：`CreatureMotion.ts` 的 presets 與 `DEFAULT_CREATURE_CONTROLS`（motionGain/currentGain/quietness/freezeRoots/freezeWings），`createSnowCreatures({clioneCount})` 接受 4–7。個體模型工廠可設尺寸／頻率／相位／seed；彈簧與翼足係數在本體檔案有單一數值入口，尚未全部製成 GUI 控制器。

## Blender 與 Web 轉換

`node --experimental-strip-types scripts/export-snow-creatures.ts` 直接對同一 runtime 模型採樣 60 秒，900 幀、15 fps，寫固定拓撲 local float32 positions、root quaternion/translation 與逐隻 diagnostics CSV。線觸手只在匯出時轉成細三角 tube，尺度不放大。

`assets/blender/scripts/snow_creatures/bake_import.py` 匯入，Three `[x,y,z]` 映到 Blender `[x,-z,y]`，quaternion 作相同基底變換，生成相對路径 PC2 與 root keyframes。`.blend` 為可播放的生物 QA 資產組，不是重新製作整個雪景或完整可逆骨骼母檔；程序 TS 是可編輯幾何／動態權威。Blender 30 fps 播放 15 fps 快取插值，不需開著 Python。打包要同時保留 `.blend` 與 `snow-creatures_pc2/`。

glTF 是兩秒 morph + root 動画的 QA 匯出版本；網站仍直接執行同一程序本體，不下載巨大的 60 秒快取。glTF 不會自動保留 PBD、驅動器或 Blender Mesh Cache，因此不把 GLB 說成完整可互動控制系統。

## 驗收與尚未證明

- `tests/aurelia.test.ts`：形態計數／索引、實際 margin vertex loop 面積、外大內小形變、脈動時間與固定步長 appendage 重現。
- `tests/clione.test.ts`：尺寸、封閉幾何／多控制點、gait、翼足前後緣差、掃幅收翼、force/phase 共用、混合連續性。
- `tests/snowwindow-creatures.test.ts`：人口、重放／暫停／frame partition、無翼下沉、PER calibration、60 秒群體間距／窗台邊界／不同步與流場 divergence。
- 靜水 calibration（不含牆／current／區域力）PER 滑行位移約 26.4–26.6%，在 brief 的 25–35% 範圍；這是程式校準通過，不是測得真實動物效率。裸海蝶停翼後 30 秒 vy 約 -.008..-.009 m/s，碰近下邊界後不可再當無界 terminal speed。
- `tools/snowwindow-biology/` 提供近看、灰色輪廓、固定 root、停翼、0–60 秒與播放；正式雪景不顯示 debug。匯出來源、材質與工具驗收存 `exports/snowwindow-biology-20260910/`。
- 尚未證明：外觀經使用者接受、手機實機 FPS、多層 transmission 跨 GPU 品質、影片擬合、全流體／被動能量回收渦場、所有文件列出的完整 animator GUI，以及「任意兩秒僅一次顯著 contraction」的視覺硬上限。這些不以綠色單元測試冒充已達成。

## 本機交付驗收（2026-09-10）

- 最終 `npm test` 118/118 通過；build 通過（既有 500 kB chunk 提醒）；`npm run check:project` 通過。未發布、未提交。
- 瀏覽器完成正式雪景與兩種生物近看／灰階輪廓檢查；圖像在 `exports/snowwindow-biology-20260910/` 的 `scene-final.png`、`aurelia-material.png`、`clione-material.png`、`clione-gray.png`。透明外觀與鏡頭構圖仍需使用者驗收。
- Blender 來源快照 `exports/snowwindow-biology-20260910/bake-input-final/scene.json`；成品 `assets/blender/snow-creatures.blend` + 同目錄 `snow-creatures_pc2/` 43 個快取。讀回 PASS，30 fps、frame 0–1799；中間幀實際 mesh cache 位移非零，詳 `assets/blender/snow-creatures-validation.json`。
- `public/models/snow-creatures-preview.glb` 是約 155 MB 的 2 秒檢查資產，43 meshes、129 動畫 channels，包含 weights／translation／rotation；網站不載入此大檔。PC2 是 15 fps 採樣插值，並非 30 fps 獨立計算。
- 最終修正：水母附肢跟隨傘面收縮及相對流速；裸海蝶 body outward winding 改正，灰階實體不再反面穿透。Blender importer 只在 signed volume 負值時修正 Clione body faces，已修正版不重複反轉。

## 歸檔索引（2026-09-10）

以下檔案保留在專案內，接手不依賴 Downloads 或聊天附件。數值權威仍在程式；原始 brief、實作紀錄與驗收結果分別保存，不將規格要求視為已完成證據。

| 分類 | 歸檔入口 |
| --- | --- |
| 使用者原始規格 v1（原文副本） | [user-spec-v1.md](../../exports/snowwindow-biology-20260910/user-spec-v1.md) |
| 生物形態、來源、公式近似與限制 | 本頁上方各節 |
| 場景整合、相機與光線 | [snowwindow.md](../scenes/snowwindow.md) |
| 水母實作檢查紀錄 | [aurelia-runtime-qa.md](../../exports/snowwindow-biology-20260910/aurelia-runtime-qa.md) |
| 裸海蝶實作檢查資料 | [clione-qa.json](../../exports/snowwindow-biology-20260910/clione-qa.json) |
| 60 秒動態與摘要 | [CSV](../../exports/snowwindow-biology-20260910/motion-60s.csv)、[摘要](../../exports/snowwindow-biology-20260910/motion-summary.json) |
| Blender 重建操作與輸入契約 | [importer README](../../assets/blender/scripts/snow_creatures/README.md) |
| 最終烘焙來源快照 | [scene.json](../../exports/snowwindow-biology-20260910/bake-input-final/scene.json)（同目錄二進位資料須一併保留） |
| Blender 實際讀回驗證 | [validation.json](../../assets/blender/snow-creatures-validation.json) |
| 最終測試／建置／專案檢查 | [tests.log](../../exports/snowwindow-biology-20260910/tests.log)、[build.log](../../exports/snowwindow-biology-20260910/build.log)、[project.log](../../exports/snowwindow-biology-20260910/project.log) |
| 瀏覽器 60 秒播放讀回 | [browser-final.txt](../../exports/snowwindow-biology-20260910/browser-final.txt) |
| 場景與模型圖像 | [場景](../../exports/snowwindow-biology-20260910/scene-final.png)、[水母](../../exports/snowwindow-biology-20260910/aurelia-material.png)、[裸海蝶](../../exports/snowwindow-biology-20260910/clione-material.png)、[灰階](../../exports/snowwindow-biology-20260910/clione-gray.png) |

封存資產為 `assets/blender/snow-creatures.blend` 與整個 `snow-creatures_pc2/`；2 秒 GLB 在 `public/models/snow-creatures-preview.glb`。這些是本機工作樹歸檔，尚未 Git 提交、遠端備份或發布。

## 2026-09-10 微轉與靠近修訂

使用者要求小幅左右轉與拉近；雪景 yawRange 改為 π/24（左右各 7.5°），FOV 56° → 52°，眼睛位置與中心 target 不變，Home 回復中心。此次拉近是較窄視角，不新增滾輪變焦。

水母邊緣觸鬚透明度 .33 → .16，固定 seed 的長度係數 .45..95，PBD guide 按圓周鄰近分配，保留 128 條。A／B 以 113 秒週期、43 秒錯相的平滑事件朝 +z／+x（基準觀察者方向）轉向，前景區域偏好最多 +.45 m；實際位移仍經受力／阻力／邊界，並非固定前進 .45 m。這是美術編舞，不是追蹤目前鏡頭或生物行為實測。

118 個測試通過、build 通過。既有 60 秒 Blender／PC2／GLB 是前一版歸檔，未重烘焙此次觸鬚與路徑；當前網站 TS 為新版權威，不可將舊快取描述為與本版逐幀一致。
