# 製作室：重現、比較、保存與採用

先確認 `pwd` 在獨立 worktree；本輪實作位於 `/private/tmp/quiet-places-production-p0-p6`。不要在原主工作區修改。

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

候選 JSON 或包含 candidate 的實驗 JSON 都可重新貼入 preset 欄位再載入。程式 HEAD 另記 sourceRevision，正式 baselineRevision 在一般提交後保持穩定，避免既有候選無故失效。未知版本、錯場景、資產版本不同、非法參數會拒絕。原始 MASTER 与偏好不由工具自行修改。

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
