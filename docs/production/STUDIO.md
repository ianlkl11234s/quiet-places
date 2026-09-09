# 製作室：重現、比較、保存與採用

先確認 `pwd` 是目前要操作的 Quiet Places repo 根。P0–P6 原實作 worktree 為 `/private/tmp/quiet-places-production-p0-p6`；合併後可從主專案預覽。開始新製作改動時另建獨立 worktree，避免影響主工作區。

## 開啟

```sh
npm run studio:prepare
npm run dev -- --port 5197
```

開啟 `http://127.0.0.1:5197/tools/studio/`。工作台與正式網站共用 Afterlight 工廠、光照、青鱂模型／rig、幾何與音樂播放器；不另建正式房間。

- 改一組參數後按「更新候選試片」。A 是載入时的正式設定，B 是候選；「查看基準 A」不覆寫 B。
- 暫停與 elapsed 使用共用 SceneClock。保存畫面時連同參數記錄；橫式 1280×720、直式 390×844 代表 canvas 尺寸，不等於實機測試。
- 開口草稿為線框；原 GLB／indirect bake 未更新時，陰影仍是原版本，介面明确顯示。不得把這張圖當作改洞後的正式受光。
- 路徑試片使用三隻真實青鱂、獨立骨架及錯開相位；暫時隱藏原群游。曲線是運動學美術試片，未做植物碰撞或群游決策。關閉即恢復原 cache。
- 聲音預設不播放；選曲、音量、loop 與淡入可保存。公開散布授權仍以 AUDIO.md 為準。

## 候選與決策

候選 JSON 或包含 candidate 的實驗 JSON 都可重新貼入 preset 欄位再載入。正式 baselineRevision 在一般提交後保持穩定，避免既有候選無故失效。完整「實驗紀錄」另外攜帶啟動伺服器／build 當時的 sourceRevision 與 sourceDirty（tracked diff）；stage receipt 保留此來源。提交後應重啟伺服器，未提交版本須連同 patch 保存；HEAD 不能單獨重建 dirty 工作。tools/studio/assets.json 的 sourceRevision 只代表最後一次 prepare，不當成當前程式版本。若绕過 Vite 設定，實驗來源為 null，不能補猜。未知版本、錯場景、資產版本不同、非法參數會拒絕。原始 MASTER 与偏好不由工具自行修改。

點「保存比較畫面」後下載圖，填觀察／原因，再「匯出實驗紀錄」。結論可待評、拒絕或採用；agent 技術試片應記待使用者評估，不冒充使用者已選。

```sh
npm run study -- validate --input /absolute/path/afterlight-study.json
npm run study -- stage --input /absolute/path/afterlight-study.json --output-dir exports/studies
```

stage 輸出 `afterlight-study-<hash>/preset.json`、`geometry.override.json`、`receipt.json`、`experiment.md`。同一候選目錄不覆寫。把下載畫面放在相關 review 目錄，實驗頁連回；候選不是只存在 LocalStorage。

已獲選擇的非幾何候選可套用：

```sh
npm run study -- apply --input exports/studies/afterlight-study-<hash> --reason '實際選擇理由'
npm run study -- rollback --input exports/studies/afterlight-study-<hash>
```

apply 核對資產與設定版本，保存原設定後原子寫入 `assets/config/afterlight-study.json`；rollback 只退本次 installed hash，若他人已修改則拒絕。此命令不發布。

正式 scene 消費光方向／主光倍率／曝光／散射和選用路徑；聲音選曲在從 Afterlight 網址啟動時初始化，換房間保持既有音樂連續。audio.volume、camera、hour、weather、viewport、elapsed 是重現條件，不覆寫觀賞者自己的偏好。腳本 receipt 明列 active 與 preview-only 欄位。

## 改開口後的生成

```sh
python3 scripts/asset-pipeline.py preflight --recipe afterlight-drain --geometry-config exports/studies/afterlight-study-<hash>/geometry.override.json
python3 scripts/asset-pipeline.py build --recipe afterlight-drain --geometry-config exports/studies/afterlight-study-<hash>/geometry.override.json --output-dir exports/studies/<new-build-id>
npm run check:project -- --manifest exports/studies/<new-build-id>/manifest.json
```

output 目錄必須全新。runner 複製母檔與候選設定到隔離目錄，不改 `public/`。幾何採用仍須配對新 GLB、UV／間接光烘焙及 browser 驗收；study apply 會拒絕未完成這些步驟的幾何變更。這是明确的未自動化交接，不能將 GLB 成功稱為 GI 已更新。

重烘焙入口是 `assets/blender/scripts/refresh_afterlight_indirect.py`；執行前讀場景 recipe，使用副本，保留來源與前版。純 runtime 光試片不假稱重新解算 GI。

## 檢查與接手

```sh
npm run check:project
npm test
npm run build
```

`tests/production-review.html` 執行四景矩陣，輸出 DOM 結果含畫面、相機、時間與資源；它不在 npm test 内自動執行。實機、主觀美術及發布另記。

接手時先讀本頁、目標場景摘要与相關生物資料；依 experiments 模板保存一個比較。遇到問題記錄實際入口與失敗原因，不從聊天補造參數。

## 只讀接手模式

`studio:prepare` 會寫入 repo 的 `tools/studio/assets.json`；一般 build 會寫 dist，Vite 預設也會寫 cache。只讀驗證不執行 prepare，先用 check:project 核對已存在的五項資產 fingerprint；若失敗，回報版本缺口，不自行更新正式設定。

在 repo 根使用以下命令；cache 與 build 均寫到新暫存目錄。`--configLoader runner` 避免在 repo 生成臨時設定 bundle，同時保留正式 Vite 設定及程式版本注入。

```sh
P6_REVIEW_DIR=$(mktemp -d /private/tmp/quiet-places-p6.XXXXXX)
npm run check:project
PYTHONDONTWRITEBYTECODE=1 npm test
QUIET_PLACES_VITE_CACHE="$P6_REVIEW_DIR/cache" npm run build -- --configLoader runner --outDir "$P6_REVIEW_DIR/dist"
QUIET_PLACES_VITE_CACHE="$P6_REVIEW_DIR/cache" npm run dev -- --port 5198 --strictPort --configLoader runner
```

5198 被占用時選另一個埠，不停止他人的伺服器。候選、截圖及 stage 的 output-dir 也放 `$P6_REVIEW_DIR`，結束前保存到自己的交付目錄。

JSON byte hash 識別精確內容，不代表美術參數是否等價。例如 `-0.38` 與計算得到的 `-0.37999999999999995` 會有不同 hash；幾何比較用既有 1e-9 容差。保留原始 receipt，不為讓 hash 一致回改證據；單變因實驗應比較同一個 browser baseline／candidate 的參數差異。
