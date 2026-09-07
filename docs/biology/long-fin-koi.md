# 長鰭錦鯉：水光之間的鬆散魚群

## 狀態與範圍

2026-09-07，在 `codex/waterlight-long-fin-koi` 獨立 worktree 完成 Blender MCP 製作與網站接入。本機數值、真資產、GPU 與場景切換已驗證；尚未使用者視覺確認、提交或發布。

- worktree：`/private/tmp/quiet-places-long-fin-koi`；基準 `cf456fe`。
- 使用者指定依[完整任務書](references/long-fin-koi-school-task.md)重做水光之間的魚，並確認與前兩間一樣使用 Blender MCP。原始文件是需求來源，不是驗收證明或额外發布授權。
- 七尾新魚取代[九尾簡化程序魚](procedural-fish.md)。房間、淺海天窗、焦散、光柱、鏡頭與 UI 保留；樹影午後的 koi.blend／koi.glb 和原工作區未提交的 UI 改動未改。

## 來源與美術近似

模型、packed 花紋、normal map 與鰭條都是專案原創程序內容，沿用成熟 `assets/blender/scripts/koi.py` 的截面、眼／口／兩對鬚／鰓蓋、曲面鰭與連續加權方法，再針對長鰭重做比例與骨架。沒有新增下載模型、照片貼圖或外部素材。

「Long-fin／Butterfly Koi」用作造型方向，不構成品系鑑定。尺寸、泳速、振幅、頻率、拖曳與群游係數皆是手冊／製作上的美術假設，未驗證為生物量測。介質仍是乾燥暗室裡魚漂浮的超現實設定；沒有肌肉、浮力、流體或完整碰撞求解。

## Blender 製作與檔案

透過 Blender MCP 連到 Blender 5.1.2 實際建置、讀回、渲染及匯出。初始背景 CLI 曾崩潰，因此本輪不引用背景 CLI 成功作為證據。MCP 初始開啟的五個 Leaflight scenes 全部保留；先以 `save_as_mainfile(copy=True)` 備份到 `/private/tmp/quiet-places-pre-koi-mcp-session-backup.blend`，再建立第六個 `LONG_FIN_KOI_SCHOOL`。

- [可編輯母檔](../../assets/blender/long_fin_koi_school.blend)：僅新場景及其依賴，壓縮保存，不覆寫原 session。
- [可重建腳本與操作說明](../../assets/blender/long_fin_koi_school/README.md)：手冊要求的 config、geometry、rig、materials、animation、variants、school、layout、validation 模組。
- [網站 GLB](../../public/models/long-fin-koi-school.glb)及[metadata](../../public/models/long-fin-koi-school.metadata.json)。
- `KOI_MASTER` 預設隱藏，包含獨立 master rig／mesh；七個可見 rig 名稱為 `KOI_01`–`KOI_07`。
- Blender 暗室提供方形天窗、程序雲、體積散射、65 個微粒、地面亮區與 `CAM_MAIN`／`CAM_SIDE`／`CAM_TOP_3Q`；中性近照相機另列，環境不匯入網站。

## 幾何、材質與控制

Blender 使用公尺、+Y 朝頭、+Z 朝背；標準 glTF Y-up 後為 -Z 朝頭、+Y 朝背。名義 master 是 .29m body + .09m tail；body length/depth、tail、pectoral 等變異實際改變幾何，不只是自訂屬性。七尾網站全長依實際 GLB bounds 設成 .28/.31/.34/.37/.39/.42/.45m，避免把母體 scale 重複套用。

七種 coat 為 ivory、ivory-silver、champagne、pale-gold、白底柔黑斑、charcoal、cream。七張 256×128 sRGB 原創 coat 加上一張共用 512×256 Non-Color 鱗片 normal 都 embedded；normal strength .25、body roughness .34、coat weight .12、coat roughness .28 是美術值。魚腹以紋樣明度略提亮，沒有 emissive 自發光補魚身。

每尾 24 骨，胸鰭增加 mid／tip 並以連續權重分配；尾鰭由尾柄和三節尾鏈變形。頭部穩定、後半身振幅按 s^2.35 增大，wave_count .84；tangent 的導數除以身長，再轉為父骨相對旋轉。尾中／尾端分別延遲約 .03/.06秒，胸鰭中／尖端約 .035/.07秒，是運動學跟隨而非柔體求解。

同材質的細分部件合併後每尾 8 meshes；Blender 保留曲面鰭條。網站使用 alpha 薄膜、關閉鰭 depthWrite／transmission，隱藏 subpixel 鰭條以消除光柵點狀閃爍。這些轉換只在新魚 adapter 和檢視頁套用。

自訂參數是重烘焙控制，不是 live drivers。單魚 wave frequency/amplitude ratio/count、pectoral frequency、tail lag、seed 對應 `make_actions(rig)`；群體及個體速度／高度／光柱偏好／停留機率對應 `place(rigs, controller=ctrl)`。幾何比例由 generator 重建。精確操作見腳本 README。

## 動畫與群游

八類原地循環 Actions：IDLE_HOVER 10s、SLOW_CRUISE 12s、GLIDE 8s、TURN_LEFT／RIGHT 各8s、SLIGHT_RISE／DESCEND 各6s、PAUSE 6s，均帶 `KOI_ACT_` 前綴。phase、幅度細變化及胸鰭使用整數週期，使首尾姿態自然閉合。慢游 .72Hz 目標量化為 12s/9次=.75Hz；其他 clip 約 .333–.833Hz。

Blender 每尾保留八條 muted 的可重用 NLA tracks，另以13–15段錯開的 `KOI_PERFORMANCE_*` tracks 編排120秒群游，過渡重疊1.5秒。群游 carrier 與局部骨架分離，避免路徑與 root travel 疊加。120秒世界路徑是開放序列，不冒稱無縫；單魚八個 Actions 才是 loop。

網站以1/60秒固定步長重建鬆散群游：每步所有鄰近力讀同一快照，低 alignment、separation、wander、soft beam confinement、偏好高度及8狀態；每次狀態停留約4.5–13秒。每尾獨立 seed／action clock，約1.5秒平滑混合姿態；dt=0不推進 steering、clock 或骨架。

網站7m房間沿 `shallowSeaSunDirection` 將群心投影到斜光柱；水平橢圓半徑 .94/.76m，主要高度約2.2–4.8m。沒有貼邊硬反彈或直接 clamp 位置。這與 Blender 簡化4.5m暗室的1.2–3m活動區分開，不覆寫既有網站環境。

## 本機驗收

- Blender：7尾，每尾24骨／13,966原生頂點；有效權重包含胸鰭mid/tip及尾鏈。最大權重和誤差4.47e-8，Actions首尾最大誤差約4.90e-19。master、NLA、三場景相機與材質存在。[Blender驗證](../../exports/long-fin-koi-blender/validation.json)。
- 實際GLB：56 meshes、182,014 triangles、7 skins×24 joints、8 embedded images；8 clips各504 channels，Three.js依每尾實際subtree取得72 tracks。[最新hash與讀回](../../exports/long-fin-koi-integration/asset-readback.json)。
- 真蒙皮：慢游一圈的頭部橫向excursion .001204m、尾部 .021772m，ratio .055318；不是僅測公式。所有匯出clip首尾均閉合。
- 20分鐘數值測試：max speed .118536m/s、min center spacing .315533m、max normalized beam radius .971895。真實位置差分也檢查速度上限；同seed／不同幀分組可重現，pause/reduced-motion與資源僅釋放一次通過。
- Blender 120秒路徑：最小中心距離 .364182m、最大速度 .089421m/s。額外網站身體capsule離散抽樣顯示正間距，但未作所有動態鰭面的連續碰撞證明。
- Node `npm test` 26/26、`npm run build` 通過；保留既有 bundle >500kB 提示。[測試](../../exports/long-fin-koi-integration/tests.log)／[build](../../exports/long-fin-koi-integration/build.log)。
- Browser 真GLB解碼與三視角，慢游播放約143.69秒，8 clips在2.4秒逐一取樣，並讀回不同時刻的尾骨 quaternion；console無新增錯誤。[三視角](../../exports/long-fin-koi-integration/three-views.png)／[七種配色](../../exports/long-fin-koi-integration/seven-variants.png)。
- 正式場景1280×800、14:00、晴日可見七尾與原光柱；暫停兩次截圖逐位元相同，恢復正常。切到樹影午後再返回完成；390×844可見天窗、魚群及地面亮區。[桌面](../../exports/long-fin-koi-integration/waterlight-desktop.png)／[手機尺寸](../../exports/long-fin-koi-integration/waterlight-mobile.png)／[browser讀回](../../exports/long-fin-koi-integration/browser-readback.json)。

實機GPU／FPS／熱與耗電、所有時段與相機角度、完整鰭面碰撞、生物學精確度及正式部署仍未驗證。上述是本機製作與技術驗收；使用者尚未看圖確認。

## 2026-09-07：網站魚群增加為 16 隻

依使用者追加要求，網站改為16隻，重用Blender製作的七種造型；Blender母檔與GLB仍是七種資產庫。每隻使用SkeletonUtils.clone建立獨立骨架與mixer，共用幾何和材質，釋放時包含所有clone skeleton。全長0.28–0.45m，初始高度2.45–4.31m加±0.05m擾動，以黃金角錯開位置，獨立動畫相位。

密度增加後，光柱回游係數從0.28調至0.36，朝向跟隨係數28→44 s⁻¹，低處回游從Y=2.30m開始。這些仍是美術運動學參數。20分鐘測試：最大速度0.118124m/s、最小中心間距0.243899m、最大標準化光柱半徑0.951743；中心間距不代表完整鰭面碰撞檢查。

Node測試26/26與build通過，涵蓋16實例、重用造型的骨架／動畫相位獨立、暫停及共享資源只釋放一次。瀏覽器實際載入16隻、七種造型，桌面構圖可見增加後的魚群。[16隻桌面圖](../../exports/long-fin-koi-integration/waterlight-16-desktop.png)；測試與build記錄為exports/long-fin-koi-integration/tests-16.log與build-16.log。仍在獨立worktree，未提交或發布。

## 2026-09-07：16 隻魚群分散調整

使用者希望更分散：活動橢圓半徑由0.94／0.76m加寬為1.60／1.25m；初始水平散布同步拉開，仍採黃金角錯位。鄰魚分離半徑0.70→0.95m，聚攏係數0.035→0.012；回游從標準化半徑0.65開始、係數0.28，允許魚在光柱周圍散游。維持16隻、原有大小與緩慢游速。

20分鐘數值驗收：最小中心間距0.563102m、最大速度0.122185m/s、最大標準化活動半徑0.943092。沿用26項測試與build通過，另將長跑最小中心間距門檻提高至0.45m並通過；不是完整鰭面碰撞證明。記錄：exports/long-fin-koi-integration/tests-spread.log、motion-spread.log與build-spread.log。CUA實際檢視目前5182預覽，魚群分布較寬且保留天窗／光柱構圖；畫面證據見本次工具截圖。未提交或發布。
