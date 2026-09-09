# Quiet Places 專案工作規則

沿用上層工作區規則。使用者要求：後續增加場景、替換樹種，或調整材質、光影、動態／物理近似時，持續建立可延續的製作筆記。

- 開始相關工作先讀 `docs/MATERIALS_AND_LIGHTING.md` 與該場景 `docs/scenes/<scene-id>.md`，按需讀來源，不載入全部歷史。
- 記錄材質／模型來源、光路、關鍵參數及單位、Blender 到網站的轉換、物理與美術近似的界線、修改原因、驗收與 commit。
- 結束時同步更新場景筆記；共同原則改變才修改共通文件。新樹種須記錄其差異，未核實的植物或物理資料不可寫成事實。
- 保留使用者確認的基準，僅對本次授權範圍做分段 commit；不把本機驗收稱為發布或完整物理解算。
- 接手紀錄與細節入口：`.claude/memory/blender-production.md`。歷史狀態不可覆蓋場景頁的最新狀態。

## 工作區隔離

- 跨階段重構在獨立 worktree 執行，開始時明示絕對 cwd 與分支；快照不等於 checkout 隔離。所有 worker 使用同一指定 worktree，原主工作區與既有 dirty work 不寫入。

## 長期製作 harness

- 製作入口：`docs/production/README.md`；新增或修改房間先讀 `docs/prompts/quiet-places-master.txt`、`docs/production/PREFERENCES.md`，再按任務讀場景／生物頁與能力索引，不載入全歷史。
- 專案製作 skill：`skills/quiet-places-production/SKILL.md`。本 repo 明確以此路徑使用；尚未安裝為全域 skill，不假設工具自動載入。
- MASTER 是美術語言；本次明確指示與已確認場景基準優先。不得因整理架構順便重新調光、換模型或抹去歷史。
- 實驗依 `docs/production/templates/experiment.md` 留問題、固定條件、變因、證據、採用／拒絕理由；小改動可直接寫場景頁，不強制新檔。
- 數值權威在程式／設定；文件連到入口並解釋單位和原因。生物共用本體與場景 adapter 分開；藝術公式不得宣稱經生物學驗證。
- 主 agent 負責整合與驗收；獨立盤點可交 Luna、有界實作／review 可交 Terra，指定 ownership；小修改直接完成，不為流程建立 agent。
- 收尾跑 `npm run check:project`；runtime 另跑 test／build 與受影響 browser 檢查。交付區分本機、使用者確認、實機與發布。不得將工具／skill 文件存在宣稱為 hook 已啟用。
