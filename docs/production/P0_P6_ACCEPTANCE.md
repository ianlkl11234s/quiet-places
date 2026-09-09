# P0–P6 本地實作交付

2026-09-09。工作區 `/private/tmp/quiet-places-production-p0-p6`，分支 `codex/production-p0-p6`；起點 `f01ea56514a5bd8268b2228ad4bb30afa27cb014`；程式提交 `df74768`，文件／證據隨後另批提交。本頁取代前一輪「只完成文件」的狀態。P7 新房間、P8 app、合併、推送與發布均未執行。

## 交付後範圍確認

2026-09-09 使用者確認目前只需固定、可累積的流程，不追求全自動閉環。下列 GI／資產提升的人工交接是已接受的現階段流程；自動化留待未來，不再列為本輪阻塞。這不代表美術候選、合併或發布已獲確認。

## 交付內容

| 階段 | 實際成果 | 證據與界線 |
| --- | --- | --- |
| P0 | 原修改快照、獨立 worktree、四景固定比較頁 | [像素比較](../../exports/refactor-p0-p6/seeded-comparison.json)：24/24 exact；日間12、暮色17.5、夜間23 × 桌面1280×720／直式390×844。固定建構 seed1701、elapsed12、dry、standard；不是所有天氣的前後像素矩陣 |
| P1 | `afterlight-geometry.json` 是 Blender、runtime 雨／光遮罩、製作室線框的共同來源 | 真 GLB 回讀主／副洞框條 bounds、屋頂三角形與開口；受控尺寸候選通過。正式 GLB／GI 未替換 |
| P2 | 兩條隔離 recipe、preflight、manifest、工具／輸入／輸出 hash | Afterlight 格柵及 Medaka 母體實際重建；失敗停止、輸出不寫 public。GI bake／正式資產提升仍為明確人工步驟 |
| P3 | 共用 Medaka 模型／rig／motion 本體與幾何 helper | Afterlight 原26尾 adapter、製作室三尾路徑是真消費者；幾何由正式 runtime 和線框使用。原群游 cache 與外观維持 |
| P4 | metadata 能力、SceneClock、PlaceHost | 主頁／工具共用時間；Studio 使用 Host，主頁保留既有首幀淡入切換。四景切換 browser、失敗恢復及 dispose unit test 通過 |
| P5 | 光、開口線框、青鱂路徑、聲音試片；JSON／A/B／實驗；CLI stage、apply、rollback | 四類實驗已保存。非幾何採用／回退已用真資產的隔離 fixture 驗證。P5b 完整幾何＋GI 採用尚未自動化，不能稱為一鍵製作閉環 |
| P6 | repo skill／AGENTS 入口、契約檢查器、独立接手候選 | 獨立 agent 僅依 repo 找到入口、產生候選與 stage；其 browser 不可用，由主 agent 接續匯入曝光1.15並保存試片。這是分工接手證據，不是獨立 agent 完成全部 browser 驗收 |

所有美術候選保持待評或技術拒絕；沒有把 agent 的試片當成使用者偏好。長期流程在新房間上的完整驗證屬 P7，尚不能宣稱最終目標已全部達成。

## 已執行的驗證

- `npm test`：71/71 通過；包含真 Medaka GLB／motion cache、異常清理、路徑、Host 切換失败、幾何及候選採用／回退。
- `npm run build`：TypeScript 與網站／製作室多入口 build 通過；仍有大於500kB bundle 提示。
- `npm run check:project`：正式四景文件、recipe inputs、幾何契約、preset 與完整五項資產版本通過。兩份 pilot manifest 的實際 output SHA-256 核對通過。
- [前後比較](../../exports/refactor-p0-p6/seeded-comparison.json)：24張同條件 exact，最大 channel 差0。Waterlight 初次比較因浮塵建構亂數不固定而不同；後在驗收頁固定 constructor seed，未更動正式場景亂數。
- 串行30frame P95（ms，前→後）：waterlight 17→17、leaflight 17→17.5、oceanlight 16.2→17.3、afterlight 15.8→17.3；未超過事前20%退步門檻。短樣本只算 smoke，非長時間或手機效能保證。第二次 seeded 比較同時開頁，不取其數字作效能結論。
- 四景 dispose 後 geometry0、scene children0；textures 分別0／1／3／3，與基準一致。沒有宣稱 renderer cache 全部歸零。
- Browser 已驗證四景切換、Afterlight 暫停與大雨、直式主頁、390px 製作室曝光操作、Studio 候選曝光1.15匯入、A/B／reset、錯誤schema拒絕、路徑試片與音樂短暫解碼播放。偏好重新載入後大雨仍為 selected；Escape 關閉設定並將焦點還給「調整此景」，DOM 證據已保存。暫停不跨重新載入保存，維持既有行為。
- 開口 replay 直接重開第一次產生的 work blend 再執行；`geometryEquivalent=true`，`binaryHashEqual=false`。這證明本次幾何不累積拉伸，不證明二進位 deterministic。
- [採用／回退實測](../../exports/refactor-p0-p6/adoption-smoke/result.json)：真 public 資產 hash、隔離正式設定副本、曝光1.15套用後 byte-exact 回復。實際正式 preset 保持不變。

## 證據目錄

完整證據在 `exports/refactor-p0-p6/`；大型生成 blend／GLB 留本地，不擅自搬入正式資產。需複查時按 STUDIO.md 的 recipe 重建。保留 manifest 只代表有來源收據，不等於全新 checkout 已附带所有 review 二進位。

- `baseline.json`、`baseline.patch`、`initial-status.txt`、`worktree-migration.json`：原工作區保護與搬遷。
- `before-seeded.json`、`after-seeded.json`、`before-seeded/`、`after-seeded/`：24組固定比較；`before.json`／`after.json` 保存串行效能與資源數。
- `pipeline/afterlight-drain-idempotence-geometry-final/manifest.json`、`pipeline/afterlight-drain-idempotence-geometry-replay/manifest.json`：建築真幾何與 replay。
- `pipeline/afterlight-drain-candidate2/manifest.json`：受控尺寸候選；`pipeline/medaka-master-provenance-final/manifest.json`：Medaka 重建。
- `studio/*-experiment.json`：光／開口／路徑／音訊決策；`studio/cold-handoff-experiment.json` 與 `cold-handoff-ui.png`：主 agent 重現独立候選。
- `studio/main-mobile-heavy-rain.png`：390×844主頁；`studio/studio-mobile.png` 與 `.txt`：390px 製作室操作；`studio/studio-portrait-canvas-desktop.png`：桌面 UI 內的直式 canvas，不能當成手機 Studio UI 驗收。
- `tests-final.log`、`build.log`：最後程式驗證。

## 使用者可如何檢視

1. 開啟 `http://127.0.0.1:5197/?place=afterlight`，切換四個房間，確認原有氛圍與操作是否保留。
2. 開啟 `http://127.0.0.1:5197/tools/studio/`，將曝光從1.25改1.15，按「更新候選試片」，用「查看基準 A」比較並「恢復基準」。
3. 試用青鱂路徑與聲音；按「保存比較畫面」，填寫觀察，再匯出實驗。候選 JSON 與包含 candidate 的實驗 JSON 均可重新匯入。
4. 開口改動只看線框位置；原模型與 GI 的陰影不跟著重算。若選定開口，再走隔離幾何、烘焙與配對採用。

現在要使用者判斷的是觀感與工作流程是否合適，沒有要求核可發布或開始 P7。無須自行執行採用命令；先留下具體偏好即可。

## 可回退性與剩餘界線

程式維持獨立分支，原主工作區 tracked diff 已與起始快照逐位元核對一致；沒有使用 reset/clean 清理既有工作。最初曾誤在主目錄寫入，已搬移並恢復，歷史如實記在 migration 收據。

- P5b GI 自動重烘及資產提升尚未完成；不隱藏在「全部完成」裡。
- 尚無路徑碰撞／群游決策、物理光傳輸保證、手機實機性能、音樂公開授權結論。
- P7 新房間、P8 平台選擇、主分支合併與部署待另外確認。
