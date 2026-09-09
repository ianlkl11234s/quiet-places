# Quiet Places P6 獨立接手驗證

日期：2026-09-09。結論：本次指定的獨立接手試作通過（含本地 browser）；若依 ROADMAP P6 的「缺口修正並回寫 repo 文件」完整條件，仍為部分通過，待有寫入授權的主 task 處理下列缺口。本次只讀限制優先，沒有改 repo 文件。

## 工作區與獨立入口

- cwd：`/private/tmp/quiet-places-production-p0-p6`
- 分支：`codex/production-p0-p6`
- 實際 HEAD：`61524d8a2b1f3ccce4432034c605797403ee9e92`
- Node v23.10.0、npm 11.4.2。
- 從 AGENTS.md → docs/production/README.md → STUDIO.md、P0_P6_ACCEPTANCE.md、ROADMAP.md 及 skills/quiet-places-production/SKILL.md 找到接手與驗收流程；沒有讀其他 task 聊天。私人記憶關鍵字搜尋無結果，沒有據此取得專案知識。
- 風格／範圍：docs/prompts/quiet-places-master.txt、docs/production/PREFERENCES.md、docs/MATERIALS_AND_LIGHTING.md、docs/scenes/afterlight.md 目前摘要。
- 共用能力：docs/production/CAPABILITIES.md → src/shared/biology/medaka（正式群游 adapter／Studio 路徑共用本體）、src/shared/geometry/DrainGeometry.ts（runtime／線框）、SceneClock、PlaceHost。這是入口與消費關係確認，本輪不重做其他能力完整驗收。
- 正式光參數：assets/config/afterlight-study.json；契約 src/shared/production/StudyPreset.ts；幾何 assets/config/afterlight-geometry.json。
- 人工生成交接：STUDIO.md → assets/config/asset-recipes.json、scripts/asset-pipeline.py、assets/blender/scripts/refresh_afterlight_indirect.py。本輪純曝光不需重烘；人工 Blender/GI 是已接受流程，不列 P6 阻塞。

## 實驗

狀態：已執行待評，沒有採用。
問題：同一鏡頭下將曝光倍率從 1.25 降至 1.15，是否改善明暗觀感？這是美術倍率，非 EV 或重新解算 GI。
固定條件：seed 1701、elapsed 12 秒、hour 12、dry、standard、canvas 1280×720；相機與五項資產 SHA-256 全存 baseline.json / browser-experiment.json。
唯一主動變因：light.exposure。browser baseline 與 candidate 的遞迴差異精確只有此欄位，證據 single-variable-diff.json。

實際 browser 流程：初始畫面 → 曝光 1.15 → 更新候選 → 保存 B-1 → 查看基準 A → 保存 A-2 → 返回 B → 匯出實驗 → 恢復基準（曝光回讀 1.25）→ 貼回實驗 JSON → 載入候選（曝光回讀 1.15）。
A-2.png、B-1.png 是保存比較畫面產生的原尺寸 PNG，從頁面下載連結的 data URL 原樣保存；不是以 UI 截圖替代 canvas。另存 baseline-ui.png、candidate-ui.png。browser-experiment.json 從頁面可見 preset 欄位原樣保存，含兩張 captures 的參數。browser-console.json 本次捕捉 warn/error 為空。
觀察：畫面成功渲染走廊、植物、魚與地面光影；B 保留構圖並降低曝光。本輪不作美術優劣結論，不宣稱與既有歷史 PNG 逐像素一致，也不宣稱完整四景矩陣或手機實機通過。

## 實際命令與結果

以下均在指定 cwd 執行；OUT 為 `/Users/migu/Documents/Codex/2026-09-09/quiet-places-p6-repo-private-tmp/outputs/p6-independent`。

```sh
pwd
git branch --show-current
git status --short
git rev-parse HEAD
node --version
npm --version
npm run study -- validate --input "$OUT/experiment.json"
npm run study -- stage --input "$OUT/experiment.json" --output-dir "$OUT/staged"
npm run check:project
npm test
./node_modules/.bin/tsc --noEmit
npm run study -- validate --input "$OUT/browser-experiment.json"
npm run study -- stage --input "$OUT/browser-experiment.json" --output-dir "$OUT/browser-staged"
```

validate/stage 全通過；check:project 通過（包括 preset、recipe、幾何與資產版本）；npm test 71/71；tsc exit 0。stage receipt geometryChanged=false，decision=pending。實際 browser 匯出應以 browser-staged/afterlight-study-0392cd3acebe 為主；早先 CLI 候選 staged/afterlight-study-3b3c1f7387b1 是相同曝光試驗的原 JSON 表示，非第二個美術候選。

為遵守 repo 只讀，沒有執行會寫 tools/studio/assets.json 的 studio:prepare，也沒有執行會寫 repo dist 的 npm run build。實際啟動／build 命令如下（node --input-type=module 的 stdin）：

```js
import {createServer} from 'vite';
const server=await createServer({configFile:false,cacheDir:'/private/tmp/quiet-places-p6-independent-vite-cache',server:{host:'127.0.0.1',port:5198,strictPort:true}});
await server.listen();server.printUrls();
```

初次 sandbox 監聽回 EPERM；自動審批允許後同命令成功。沒有停止其他 task 程序。瀏覽器經工具發現、Browser skill 連接後成功，無最終受阻 browser 步驟。

```js
import {build} from 'vite';
await build({configFile:false,cacheDir:'/private/tmp/quiet-places-p6-independent-vite-cache',build:{outDir:'/private/tmp/quiet-places-p6-independent-build',rollupOptions:{input:{app:'index.html',studio:'tools/studio/index.html'}}}});
```

此 build 沿用已讀 vite.config.ts 的雙入口設定，輸出隔離；exit 0，1.78 秒，仍有 >500 kB chunk 提示。是 TypeScript + Vite build 驗證，不冒稱原 npm run build 原封不動執行。完整 log：check-project.log、tests.log、typecheck.log、build.log、validate-browser.log、stage-browser.log。

## 需要額外知識與具體缺口

1. STUDIO.md 的開啟步驟沒有只讀模式。必須讀 scripts/studio-prepare.mjs 才知道會覆寫 tools/studio/assets.json；嚴格只讀接手須另行核對 hash 並把 Vite cache／build 移出 repo。本次使用 Vite API 的知識不是製作文件提供。建議補明確只讀接手命令與副作用。
2. STUDIO.md 說 sourceRevision 另記 HEAD，但現存 tools/studio/assets.json 的 sourceRevision 是舊 f01ea565…，而 browser 實驗輸出（src/studio/main.ts:68）沒有 sourceRevision 欄位。這會讓只帶走實驗 JSON 的人無法辨識本次程式 HEAD。本報告明記實際 HEAD；建議將它納入匯出／收據並說明 prepare 的更新責任。
3. Studio 由幾何計算 opening.centerZ，得到 -0.37999999999999995；正式 JSON 是 -0.38。因此 CLI 與 browser 的等價曝光候選有不同 byte hash／stage 目錄。browser A/B 本身只有曝光差異，兩份 receipt 均 geometryChanged=false。建議說明語意等價不保證 byte hash 相同，避免誤認多改一個美術變因。
4. stage 自動 experiment.md 的「重現」實際是 apply 命令；pending 候選又未附 --reason，依 scripts/study.mjs:155-156 會被拒絕（靜態確認，未執行 apply）。建議重現段改放匯入／validate／stage，把正式採用另段列明條件。STUDIO.md 主文已有 --reason，缺口在生成的交接文件。

沒有需要聊天補充的美術參數；未重新驗證正式 apply/rollback、GI bake、四景矩陣、音訊、手機實機、發布。UI 恢復基準已實測。未因這些未執行項目否定本次曝光試作。

## 保護與交付

integrity.json：所有 tracked 檔案 SHA-256 前後一致，git status（含完整 untracked 清單）byte-exact 相同；initial.patch 為空。所有原有未追蹤檔保留。未寫原 stillwater 專案；沒有 commit、merge、push、deploy、正式 preset／public 更新或 P7。
所有交付在本目錄，候選仍待使用者评估。repo 文件缺口僅在此報告列出，依使用者只讀要求沒有修正。
