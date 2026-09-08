# 長鰭錦鯉接手點

2026-09-07：使用者暫停移動後已要求繼續；本機製作與技術驗收已完成，待使用者看圖。不要把先前暫停當作目前狀態。

- Worktree `/private/tmp/quiet-places-long-fin-koi`，分支 `codex/waterlight-long-fin-koi`，基準 `cf456fe`。未 commit、merge、push、部署。
- 預覽 `http://127.0.0.1:5182/?place=waterlight`；Vite session 59913。三視角 `/tests/long-fin-koi-gpu.html`。
- 來源／實作／驗收的完整入口：[生物頁](biology/long-fin-koi.md)、[場景頁](scenes/waterlight.md)、[重建說明](../assets/blender/long_fin_koi_school/README.md)。
- 透過 Blender MCP 5.1.2 實際建立及匯出；五個既有 Leaflight scenes 保留，第六個 `LONG_FIN_KOI_SCHOOL`。目前已恢復 CAM_MAIN 並保存 standalone compressed blend。
- `assets/blender/long_fin_koi_school.blend`：master、7 variants、24骨/魚、8可重用動作、120秒路徑／錯開NLA姿態編排、暗室／程序雲／微粒、三場景鏡頭與三近照鏡頭。
- `public/models/long-fin-koi-school.glb`：56 meshes、7 skins、8 clips、8 embedded images。最新hash/bytes見 `exports/long-fin-koi-integration/asset-readback.json`。
- 網站七尾全長 .28–.45m；真GLB/mixer、fixed-step鬆散群游、8states與約1.5s平滑blend，沿原斜光柱活動；場景環境與原三尾leaflight koi未變。
- 最終 `npm test` 26/26、build、diff check通過；20min steering、真蒙皮head/tail、權重／loops／每rig tracks／scale／pause／dispose有測試。Browser桌面與mobile viewport、八clips、pause pixels、場景來回切換已核對；圖像與readback存於exports。
- 網站薄鰭alpha、depthWrite=false、transmission=0，隱藏subpixel鰭條；Blender保留鰭條。這是renderer差異，非物理等價。
- 初始未儲存Blender session備份 `/private/tmp/quiet-places-pre-koi-mcp-session-backup.blend`。早期worker在原repo留下的未合格scaffold已移至 `/private/tmp/quiet-places-long-fin-koi-discarded-scaffold`，不可覆蓋正式來源。
- 原repo另有使用者並行UI／導航工作（含docs/ARCHITECTURE.md等），保留原狀。沒有把這些改動合入本worktree。

後續只需依使用者看圖意見調整，或等待明確提交／發布指示。未驗證實體手機熱/FPS、所有動態鰭面的連續碰撞與生物學精度；不要把本機viewport當實機證據。

最新追加：網站已增至16隻獨立骨架實例，七種Blender母型共用；以場景頁2026-09-07「網站魚群增加為16隻」段落與tests-16.log／build-16.log為準。

最新分散調整：16隻活動半徑1.60／1.25m、分離半徑0.95m，聚攏係數0.012。驗收以場景頁「16隻魚群分散調整」及spread logs為準。

最新：慢游分散基準已commit 25bc75f；活力預覽為此commit後未提交修改，同時最多兩尾短暫加速。參見場景頁「偶發短暫加速預覽」及lively logs。

最新光影：Environment.ts體積光改為寬柔光帶，使用共用水波斜率帶動偏移；參見場景頁「光束柔化與水波連動預覽」。5182服務本輪重新啟動，活力魚群與柔光改動都尚未提交。

最新：4隻魚增加錯開的暗區往返活動，保留12隻在光柱附近。細節與驗收見場景頁「少數魚游入暗區預覽」與excursions logs；尚未提交。

2026-09-07 使用者確認此預覽並授權commit：本次提交包含活力魚群、柔化水波光束、4隻暗區往返及對應驗收記錄。未推送或發布。

最新試稿：fd8d753後將天窗水深調至3m，天窗專用青藍吸收校色、降低雲亮紋對比、加入微幅共用細波。見場景頁「更深青藍海水試稿」，尚未提交。

PR交付：更深海水與載入暗底／骨架共用／幀率排程修正已提交，並合併origin/main最新介面。26 tests與build通過；正式build預覽5183，量測與全頁閃白限制見場景頁及performance-pr.json。準備推送codex/waterlight-long-fin-koi並開PR，不直接合併或部署。
