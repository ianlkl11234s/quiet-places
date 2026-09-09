# 長期製作入口

Quiet Places 的累積單位是「房間、可重用能力、實驗與偏好」。先讀本頁，再讀目標場景目前摘要；歷史只在需要解釋決策時查閱。

後續實作以 [P0–P8 總計畫](ROADMAP.md) 為準：包含依賴、交付、完成條件與回退。文件存在不代表該階段完成。

本輪成果與驗收見 [P0–P6 交付紀錄](P0_P6_ACCEPTANCE.md)；實際試片與候選採用指令見 [製作室操作](STUDIO.md)。

## 工作順序

1. **定義房間**：讀 [MASTER 原文](../prompts/quiet-places-master.txt)，使用 [場景 brief](templates/scene.md) 記下唯一主角、主要自然光、最多一件不可能的事、參考與使用者本次偏好。既有場景保留已確認基準；風格原則不自動授權重調。
2. **查可沿用的能力**：查 [能力索引](CAPABILITIES.md)、[架構](../ARCHITECTURE.md)、相關生物頁。列出直接沿用、需要 adapter、必須實驗的部分；不從零重做已有模型。
3. **固定比較條件**：記錄 commit 與未提交差異、鏡頭、viewport、時刻、曝光、天氣、品質、seed／elapsed、資產版本。未知的既有基準標為待確認。
4. **小步實驗**：每次針對一個問題，使用 [實驗模板](templates/experiment.md)。程式或設定保存數值，筆記保存為何、比較及選擇；不要只留最後一張圖。
5. **接入**：沿用 metadata／catalog／PlaceInstance；來源放 assets，網站產物放 public。生物本體知識放 biology，房間只記路徑、尺度、照明與整合差異。
6. **驗收與沉澱**：跑與改動相稱的檢查，更新場景頂部摘要、生物頁、實驗結論。使用者接受後才標「使用者已確認」；新的跨房間經驗才提升到共同原則。

## 資料歸屬

| 內容 | 唯一維護入口 | 何時更新 |
| --- | --- | --- |
| 風格原文 | [MASTER](../prompts/quiet-places-master.txt) | 使用者明確修改風格時；保留原文版本差異 |
| 個人美術選擇 | [偏好](PREFERENCES.md) | 明確回饋；記錄適用房間、日期與來源 |
| 目前場景狀態 | `docs/scenes/<id>.md` 頂部 | 每次場景交付 |
| 光、材質、介質原則 | [製作筆記](../MATERIALS_AND_LIGHTING.md)、[水](../WATER_PHYSICS.md) | 可重用經驗成立時 |
| 生物模型與公式 | [biology](../biology/README.md) | 模型、rig、行為或來源改變時 |
| 可重用程式與製作入口 | [能力索引](CAPABILITIES.md) | 入口、消費者或責任改變時 |
| 實驗與拒絕方案 | `docs/production/experiments/<日期>-<主題>.md` | 有可重用比較／決策時 |
| 圖片與測量 | `exports/<review-id>/` | 每次可回看的驗收；筆記連入 |
| 工具與 app 方向 | [分階段實作總計畫](ROADMAP.md) | 有實際需求與消費者時 |

實驗目錄在第一份真實實驗時建立。既有場景歷史保留原址，不機械搬運或把舊紀錄冒充今日結果。母檔、備份、生成結果與失敗實驗各有價值；清理前確認來源、可重建性與引用。

## 收尾契約

交付至少包含：變更、權威參數入口、實驗取捨、測試證據、使用者確認範圍、尚未驗證項目、下一步。跑 `npm run check:project` 檢查製作入口；runtime 變更另跑 `npm test`、`npm run build`，並依 [驗收](../VALIDATION.md) 做 browser／GPU 比較。檢查工具驗證入口、設定與資產 hash 契約；不能代替美術、實機或來源授權驗證。

不要求每次修改都產生新文件；小修改直接更新既有場景紀錄。有實質比較才開實驗頁。專案知識全部可由 repo 取得，不依賴私人記憶或特定聊天工具。

## 2026-09-09 第一輪純文件整理（歷史，非目前狀態）

- 起點：main `f01ea56`。原有未追蹤 `.local-backups/`、`docs/plans/PROJECT_REFACTOR_HANDOFF.md`、`docs/scenes/stairlight.md` 保持原樣；未提交或發布。
- 已完成：本頁及能力／偏好／演進文件、兩份製作模板、MASTER 原文保留、根 AGENTS 與 `skills/quiet-places-production/SKILL.md`、`check:project`；修正文檔房間數、舊魚群說明與 Afterlight 目前摘要。
- 驗證：`npm run check:project` 通過；暫存隔離案例缺少場景頁時正確失敗；production 文件相對連結通過；skill quick_validate 通過；`npm test` 50／50；`npm run build` 通過（仍有大於 500 kB chunk 提示）；`git diff --check` 通過。
- 本次未改 `src/`、模型、貼圖或烘焙，未重做 browser、美術、實機或發布驗收。原交接的幾何契約、GPU 共用框架、資產 runner 與 UI 重構仍為候選，未宣稱完成。

## 新 session 接手試作

使用者已授權將 P0–P6 合併回本地主分支。合併後從 `/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/stillwater` 的 main 接手，不再要求使用舊 `/private/tmp/quiet-places-production-p0-p6`。實際合併版本以 `git log` 為準；未自動推送或發布。

先讀根 AGENTS、本頁、`P0_P6_ACCEPTANCE.md`、`STUDIO.md` 與 `skills/quiet-places-production/SKILL.md`，再按需讀場景頁。開始 P7 新製作時從目前 main 建立自己的獨立 worktree，保留原工作區未追蹤草稿與歷史證據。

第一個試作可在既有 Afterlight 改一個光照候選，保存固定條件 A/B 與實驗紀錄，保留正式基準。人工烘焙流程已接受；不要為追求全自動化另行擴充。新場景仍依使用者提供的參考與描述執行，不自行發布。
