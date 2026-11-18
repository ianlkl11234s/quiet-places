# 窗景牆與生物仿生計劃（2026-11）

建立：2026-11-18。流程依 [畫質迭代工作流程](QUALITY_WORKFLOW.md)。分支 `claude/wall-and-biology`，worktree `.worktrees/wall-and-biology`。

## 來源與使用者決定

2026-11-18 檢視後，使用者決定：

- 換房間介面採「B 窗景牆」（全螢幕格狀、真實場景畫面）。原話：「B 好了」。
- 生物仿生五項「都做」。
- 效能：主要用電腦；「看有沒有提升空間，沒有就可以先往後延」。

## 本計劃的解讀

- 介面：泡泡與其流場動畫移除，改成窗景牆；進場的兩步（留在這裡／想去其他房間）併成一步，目前房間以「此刻」標示。
- 生物：五項都做成**帶單一開關的候選**，開關為 0 時回到原畫面。使用者已確認的基準（魟魚翻滾、魚群密度、各場景構圖與光）不動。
- 模型重做（鬼蝠魟皮膚、沙丁魚鰭、長鰭錦鯉貼圖解析度）不在本輪，列為下一輪候選。
- 效能：只量測並回報有沒有「畫面不變」的提升空間。MSAA 2、SMAA、自動降解析度已於 2026-09-27 結案，不重做。

## 項目

| 編號 | 項目 | 層級 | 主要檔案 | 開關 | 碰到已確認基準 |
|---|---|---|---|---|---|
| U1 | 窗景牆取代泡泡；進場一步；牆開啟時凍結場景繪製 | 介面 | `index.html`、`src/style.css`、`src/ui/`、`src/main.ts`、`src/places/metadata.ts` | `WALL_FREEZES_SCENE` | 是（2026-09-11 確認的泡泡主視覺，由本次決定取代） |
| C0 | 場景契約加 `pointerRay`，由播放器傳入指標射線 | 共用 | `src/player/contracts.ts`、`src/main.ts` | 各場景自己的開關 | 否 |
| B1a | 長鰭錦鯉對指標與漣漪的反應 | 生物行為 | `src/places/waterlight/` | `KOI_POINTER_RESPONSE` | 否 |
| B1b | 沙丁魚群對指標的反應 | 生物行為 | `src/places/seabridge/` | `SARDINE_POINTER_RESPONSE` | 否 |
| B2 | 長鰭錦鯉轉彎彎曲、擺尾頻率依體長 | 生物動作 | `src/places/waterlight/` | `KOI_TURN_BEND`、`KOI_BODY_LENGTH_FREQUENCY` | 是（游動觀感） |
| B3 | 南極銀魚擺尾相位隨速度積分、轉彎側傾 | 生物動作 | `src/shared/biology/antarctic/`、`src/places/snowhall/` | `SILVERFISH_SPEED_PHASE`、`SILVERFISH_BANK` | 是 |
| B4 | 魚群個體節奏（擺幾下再滑行）、最近鄰居、逃竄閃光 | 生物行為 | `src/systems/schooling/`、`src/places/seabridge/Sardines.ts` | `SCHOOL_BURST_COAST`、`SCHOOL_TOPOLOGICAL_NEIGHBOURS`、`SCHOOL_FLASH_BANK` | 是（已驗收的密度與穿模測試） |
| B5 | 鬼蝠魟拍翼頻率隨速度、尾巴延遲跟隨 | 生物動作 | `src/places/last-arcade/biology/`、`src/creatures/manta/` | `MANTA_SPEED_COUPLED_FLAP`、`MANTA_TAIL_FOLLOW` | 是 |
| P0 | 效能基準：十景繪製耗時、每幀生物運算耗時 | 量測 | `exports/quality-review-20261118/perf/` | — | 否 |

### 審閱方式

網址加 `?place=<id>&bio=off` 為全部生物候選關閉（等同本分支之前的 main 行為）；不加 `bio` 參數為開啟。讀取在 `src/shared/review/candidates.ts`，由各場景組裝層把關閉值經 factory 選項傳入。相關場景 id：`waterlight`（B1a、B2）、`seabridge`（B1b、B4）、`last-arcade`（B4、B5）、`snowhall`（B3）。

`pointerRay` 契約（C0，由主 agent 接線）：

```ts
/** Optional creature awareness. World-space ray under the pointer; undefined when the pointer leaves. tap=true on a click without drag. */
pointerRay?(ray:THREE.Ray|undefined,tap:boolean):void;
```

播放器每幀最多呼叫一次（移動），點擊時另呼叫一次 `tap=true`。場景自行決定反應；反應要克制，符合「安靜」的風格。

## 分工

- 主 agent：計劃、契約、`src/main.ts` 與 `src/player/*` 接線、驗收、commit、文件整合。
- worker：各自的檔案範圍內實作與單元測試；不 add、不 commit、不 stash；不開 dev server（另有指示者除外）。

## 進度紀錄

| 日期 | 項目 | 狀態 | commit |
|---|---|---|---|
| 2026-11-18 | 計劃、worktree、場景縮圖初版 | 完成 | — |
| 2026-11-18 | U1 窗景牆 | 完成，瀏覽器看過 1440／900／390 與鍵盤、換房；凍結背景未獨立驗證 | dee0b8b |
| 2026-11-18 | C0 pointerRay 契約 | 完成 | 6f12329 |
| 2026-11-18 | B3 銀魚 | 候選待使用者確認 | 40f2611 |
| 2026-11-18 | P0 效能基準 | 完成 | 39a8e2e |
| 2026-11-18 | B2＋B1a 長鰭錦鯉（共用檔，合併 commit） | 候選待使用者確認 | 3c839ce |
| 2026-11-18 | B5 鬼蝠魟 | 候選待使用者確認 | d7573a5 |
| 2026-11-18 | B4＋B1b 魚群（共用檔，合併 commit）；凝聚維持半徑規則，只有對齊改最近 7 尾 | 候選待使用者確認 | 55de04b |
| 2026-11-18 | `?bio=off` 審閱參數 | 完成 | 0f265a8 |
| 2026-11-18 | 效能 W1 水光之間 69.7→19.1 ms、S1 階光之間 41.9→30.4 ms、A1＋A2 雨後天井 44.5→約 38 ms（2400×1350，M3＋Chrome） | 完成，畫面差 ≤1/255（A2 壓縮後截圖最大 7/255） | 4d2a7ca、f32c54b、9eaa597、61499f0 |

## 驗證範圍（2026-11-18）

- 技術檢查：`tsc`、`npm test` 250 項過 249（失敗項 `kuroshio-encounters` 在 main 上原本就失敗）、`build`、`check:project`。
- 瀏覽器（本機，建置版）：窗景牆與六個受影響場景可載入、無 console 錯誤、沙丁魚點擊後散開再聚回。生物動作的觀感未判定。
- 未做：分支上十景的完整效能重量、四時段矩陣、比較頁、實機與手機、部署。
- 下一輪候選：模型重做（鬼蝠魟皮膚、沙丁魚鰭、長鰭錦鯉貼圖）、雨後天井剩餘約 5 ms、階光之間散射迴圈拆 pass、雪落海窗水母與潮風商店街動物模型的 CPU 更新。
