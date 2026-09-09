# 可沿用能力與製作入口

2026-09-09：依目前 repo 入口盤點；本頁是導覽，不複製參數或宣稱重新驗收資產。正式房間由 `src/places/metadata.ts` 與 `catalog.ts` 決定，目前五個（含向海的隧道本機候選）；stairlight 為工作區既有草稿，未註冊。

| 能力 | 權威入口 | 消費／沿用方式與限制 |
| --- | --- | --- |
| 房間生命週期 | `src/player/contracts.ts`、`src/places/catalog.ts` | 五房間共用 update／dispose；播放器供時間，不另開 RAF |
| 波場、折射 | `src/shared/water/Optics.ts` | waterlight／oceanlight；各自水體校準，不當通用海水常數 |
| 模型資源釋放 | `src/shared/resources/ModelResources.ts` | shared 所有权契約；借用貼圖不自行釋放 |
| 可重現亂數 | `src/shared/math/seededRandom.ts` | 使用者各持 seed／序列；抽取不得改變生成順序 |
| 時間、偏好、音訊 | `src/systems/` | 保留既有系統；音訊來源與授權見 [AUDIO](../AUDIO.md) |
| 光與材質 | [共同原則](../MATERIALS_AND_LIGHTING.md) | 知識可沿用；烘焙 GI、光子投影、散射分場景校準 |
| 生物本體 | [biology 索引](../biology/README.md) | 查模型、rig／clips、動態策略及來源；場景尺度、路徑及受光仍須 adapter |
| 空間、植物與雨 | `src/places/afterlight/`、`src/places/leaflight/` | 目前場景專用；第二個實際需求成立後才抽 helper |

## 生成入口（先讀 recipe 再執行）

以下是入口定位，不是可直接串起執行的全自動流程。部分腳本依賴目前 Blender 檔案、物件名稱與 Metal；命令及輸出以對應製作頁／腳本為準。

| 內容 | `assets/blender/scripts/` 下入口 | 製作紀錄 |
| --- | --- | --- |
| 樹影空間／樹 | `leaflight.py`、`camphor.py`、`bake_leaflight.py`、`export_study.py` | [leaflight](../scenes/leaflight.md) |
| 雨後空間／植被 | `afterlight.py`、`afterlight_floor.py`、`afterlight_plants.py`、`afterlight_weeds.py`、`bake_afterlight.py`、`export_afterlight.py` | [afterlight](../scenes/afterlight.md) |
| 格柵／間接光更新 | `update_afterlight_drain.py`、`refresh_afterlight_indirect.py`、`sync_afterlight_vegetation.py` | [製作室與 recipe](STUDIO.md)；同讀幾何設定，GI 另行烘焙 |
| 錦鯉 | `koi.py`、`koi_motion.py` | [koi](../biology/koi.md) |
| 魟魚 | `stingray.py` | [southern-stingray](../biology/southern-stingray.md) |
| 青鱂／motion cache | `medaka/build_all.py`、`medaka/generate_motion.py`、`medaka/validation.py` | [medaka](../biology/medaka.md)；build_all 支援 bake-motion |
| 長鰭錦鯉 | 由製作頁查 Blender MCP 母檔與匯出步驟 | [long-fin-koi](../biology/long-fin-koi.md)；不假造統一 CLI |

可編輯來源在 `assets/blender/`，網站載入資產在 `public/`，證據在 `exports/`。Afterlight／Medaka pilot 使用 manifest runner；其餘舊 metadata 逐項核對，不等同完整來源／授權證明。

## 驗收入口

- `npm test`：數值、motion、資源、偏好與場景測試。
- `npm run build`：TypeScript 與 Vite。
- `tests/*-gpu.html`／對應 TypeScript、`tests/waterlight-performance.html`：browser／GPU 手動入口，**不由 npm test 執行**。
- `npm run check:project`：製作文件、skill、正式場景頁與 factory 入口存在性。

尚未抽取：所有 GPU 測試的通用 adapter；Blender runner 與幾何 schema 僅涵蓋下列 pilot。理由與驗收條件見 [演進邊界](ROADMAP.md)，避免新增未被消費的框架。

## P0–P6 實作入口（2026-09-09）

- 幾何權威：`assets/config/afterlight-geometry.json`；`src/shared/geometry/DrainGeometry.ts` 供正式開口、雨採樣及 studio 使用，Blender 由 `geometry_config.py` 同讀。
- 資產 recipes：`assets/config/asset-recipes.json`、`scripts/asset-pipeline.py`；Afterlight 與 Medaka master 在隔離目錄實際重建，manifest 记录輸入／產物 hash。重烘焙不假裝已自動涵蓋。
- 生物本體：`src/shared/biology/medaka/`；Afterlight cache adapter 與製作室 route trial 都消費同一載入、rig、clone、尾／鰭變形。正式群游與場景 bounce 保留在 afterlight adapter。
- 場景能力：metadata 宣告 weather／ocean-level／water-interaction／camera-distance；main 使用同一份能力與 SceneClock。PlaceHost 供製作室候選生命週期，失敗保留現場；主頁仍保留自己的淡換第一幀交易。
- 製作工具：`tools/studio/index.html`、`src/studio/main.ts`。候選契約在 `src/shared/production/StudyPreset.ts`，正式選擇在 `assets/config/afterlight-study.json`；指令及回退見 [STUDIO](STUDIO.md)。

上述是本輪實作新增，當前驗收以 [P0–P6 報告](P0_P6_ACCEPTANCE.md) 為準。

- 向海的隧道：`src/places/seaward/` 沿用魟魚 GLB，新增單隻 adapter；程序建築、濕反射與波光屬場景專用近似，見 [場景筆記](../scenes/seaward.md)。
