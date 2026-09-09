---
name: quiet-places-production
description: 在 Quiet Places repo 新增或修改房間、光水材質、生物模型與動態，並保存可重用製作知識及實驗決策。一般網站修字或部署不需此製作流程。
---

# Quiet Places 製作

所有專案路徑相對 repo 根；先確認目前工作區是 Quiet Places。本 skill 由根 AGENTS.md 指向，不依賴全域安裝或 Claude hook。

1. 讀 `docs/production/README.md`、`docs/prompts/quiet-places-master.txt`、`docs/production/PREFERENCES.md` 和目標 `docs/scenes/<id>.md` 頂部。目前使用者指示優先；不要把 MASTER 當成重調已確認畫面的授權。
2. 查 `docs/production/CAPABILITIES.md` 與相關生物頁，找到真正消費者、設定及生成入口。新房間用 `docs/production/templates/scene.md`；不要先複製整個房間或建立第二套 registry。
3. 確認 Git dirty work、基準與此次範圍。本專案重構必須在獨立 worktree 執行；快照不是 worktree，原主工作區不寫入。固定相機、viewport、光／天氣、品質、seed／elapsed 和資產版本；無基準就明示。只有獨立有界工作才委派，主 agent 保有美術整合與驗收。
4. 光／水改動按 `docs/MATERIALS_AND_LIGHTING.md` 記錄介質、光路、數值權威與近似。生物按 `docs/biology/README.md` 記錄來源、rig、公式單位、路徑和測試；未核實資料寫未知。
5. 有比較／失敗經驗時用 `docs/production/templates/experiment.md`，記錄採用、拒絕或未決；保持原始基準。純 runtime 改動不預設重烘焙。使用已有 `docs/production/STUDIO.md` 的試片與 stage/apply/rollback 流程；新工具沿用正式場景的參數與時間，不複製 shader。
6. 更新場景目前摘要與適用的生物頁；明確回饋才更新偏好，跨場景確認後才提煉共通原則。跑 `npm run check:project`；按改動補 test/build、真資產或 browser 檢查。

交付說明已改內容、重現入口、比較結果、確認範圍、未驗證項目及下一步。檔案存在／測試通過不代表使用者認可、實機或發布；未使用的候選能力不寫成已共用。
