# Quiet Places／靜隅：現行程式結構

六個場景共用一個播放器，場景的構圖、材質與動態各自維護。本頁描述目前程式；hash router 與完整 SceneHost 的舊規劃保留在 [歷史設計](plans/SCENE_HOST_DESIGN.md)，不代表已實作。

## 從哪裡開始

| 想調整的內容 | 入口 |
| --- | --- |
| 網站控制、時段／暫停、鏡頭、匯出 | `src/main.ts` |
| 場景名稱、固定 ID、時刻、水位選項 | `src/places/metadata.ts` |
| 場景載入 | `src/places/catalog.ts` → 各場景 `index.ts` |
| 共用場景契約 | `src/player/contracts.ts` |
| 水光之間 | `src/places/waterlight/` |
| 樹影午後 | `src/places/leaflight/` |
| 海光之室 | `src/places/oceanlight/` |
| 雨後天井 | `src/places/afterlight/` |
| 階光之間 | `src/places/stairlight/` |
| 向海的隧道 | `src/places/seaward/` |
| 房間進場與泡泡布局 | `src/ui/RoomBrowser.ts` |
| 製作流程與能力索引 | [production](production/README.md) |
| 可跨場景使用的元素 | `src/shared/` |
| 音訊、偏好、時間曲線、GPU 波動系統 | `src/systems/` |
| 原創模型／腳本、網頁資產、人工驗收輸出 | `assets/blender/`、`public/`、`exports/` |

```mermaid
flowchart TD
  Player[main.ts：單一播放器] --> Catalog[places/catalog.ts：延遲載入]
  Catalog --> Water[waterlight/index.ts]
  Catalog --> Leaf[leaflight/index.ts]
  Catalog --> Ocean[oceanlight/index.ts]
  Catalog --> After[afterlight/index.ts]
  Catalog --> Stair[stairlight/index.ts]
  Catalog --> Seaward[seaward/index.ts]
  After --> Contract
  Player --> Contract[player/contracts.ts]
  Water --> Contract
  Leaf --> Contract
  Ocean --> Contract
  Water --> Optics[shared/water：波場與折射]
  Ocean --> Optics
  Leaf --> Resources[shared/resources：模型資源]
  Ocean --> Resources
  Water --> Random[shared/math：獨立亂數序列]
  Ocean --> Random
```

## 已抽出的共同元素

- **場景契約**：`LightingState`、`SceneState`、`PlaceInstance`、`PlaceFactory`。共用型別不再從水光的 `Environment.ts` 匯入。只有播放器提供時間；場景不建立自己的 RAF。鏡頭／曝光／色調映射仍由各場景回傳。
- **水的波場與折射**：`shared/water/Optics.ts` 同時提供 CPU 高度／解析梯度及 GLSL，含 Snell／Fresnel 與兩個水景目前採用的清水吸收設定。現有 `ocean*` 符號保留以維持 shader 相容；波幅和吸收是現有海水外觀的校準，不是所有水體的通用物理常數。
- **模型資源**：`shared/resources/ModelResources.ts` 收集去重的 geometry、material、直接材質貼圖與 skeleton，再由所有者釋放。重複釋放安全；不遞迴掃 shader uniforms，以免誤釋放借用的 photon texture／volume。模型 clone 的獨立 skeleton 仍由 clone 所有者處理。
- **可重現亂數**：`shared/math/seededRandom.ts` 保留既有 LCG 序列；每個場景自己持有 generator 和 seed。魚群、浮塵與雨滴不互相推進亂數狀態。

`TimeOfDay`、偏好與音訊本來就是共用系統，這次沿用。GPU 水波 solver 保留在 `systems/WaterSimulation.ts`；是否使用它由場景決定。

## 保留在各場景的部分

| 水光之間 | 樹影午後 | 海光之室 |
| --- | --- | --- |
| 天窗、淺海厚度、GPU 漣漪 UV 映射、局部焦散、房間光柱與魚群 | Blender 房間、烘焙 indirect EXR、葉影、風、錦鯉暗部补光 | 窗口、水位、石材照明、光子投影、海面與空氣微塵 |

太陽方向、曝光、天窗／窗體座標、天空配色、波光增益都屬於場景校準。樹影烘焙 GI、海光單次傳光與水光局部 Jacobian 的物理近似不同，不合成一個萬用光照 shader。

`waterlight/SurfaceSampling.ts` 合併該場景兩個 shader 的取樣重複；它含3.6m天窗座標與倍率，因此刻意放在場景內。`oceanlight/WindowRoom.ts` 尚保留歷史程序樹影的測試分支；正式樹影入口只使用 `leaflight/index.ts`。`legacy/FloorKoi.ts` 也只供舊稿／回歸測試，不是正式錦鯉。

## 生物與資產接入

魟魚完成版已接入 `oceanlight/index.ts`，模型與動畫在載入時檢查必要 clips。`Stingrays.ts` 管理骨架實例與場景受光，`StingrayMotion.ts` 管理路徑和相位；模型資源所有权沿用 shared。生物資料以[生物文件區](biology/README.md)為入口，詳見[魟魚製作頁](biology/southern-stingray.md)與[海光接入筆記](scenes/oceanlight.md)。歷史缺clips的草稿狀態留在驗收紀錄，已不代表正式入口。

新增場景時：建立 `places/<id>/index.ts`，回傳現有 `PlaceInstance`，在 metadata／catalog 登記；只引用已適合自己的 shared 元素。網頁只需的資產放 `public/`，可編輯來源放 `assets/blender/`。每次沿用材質、樹種或模型後，仍要更新場景筆記與驗收，不因共享程式就宣稱外觀或物理行為相同。

## 驗證入口

```sh
npm test
npm run build
npm run dev
```

`npm test` 使用 Node.js 的 TypeScript stripping，無需額外測試框架。數值與資源測試不取代 browser；場景切換、材質、光影與暫停仍須看實際畫面。

## 2026-09-07：房間導航與轉場

- 右下三個 44px 圓鈕分別開啟「換個房間」、「調整此景」、「關於靜隅」，一次只展開一個面板。時間標示保留左下；Escape／點擊外部可關閉，鍵盤焦點回到入口。房間卡的縮圖為 CSS 意象示意，並非場景截圖。
- 換房間先延遲載入並在獨立 Three.js Scene 建立候選；使用黑色 HTML 遮罩淡出 350 ms，切換並渲染第一幀後淡入 650 ms。reduced-motion 各 80 ms。這是介面美術轉場，未修改任何場景的模型、光照、材質或物理近似。
- 舊房間保留到候選第一幀完成才釋放；載入失敗保留原房間並顯示重新整理提示。切換期間鎖定房間選擇與場景控制，音樂維持連續。候選建立短暫增加資源使用，尚未量測實機記憶體峰值。批次圖片匯出略過淡換。
- Preferences version 1 向後相容增加 rooms，分別儲存時刻／跟隨時間／光束／天候／雨勢／海光水位；音量與畫質共用。原 top-level 偏好用作舊版目前房間的遷移來源。
- 本機驗收：build、單元測試；21 項單元測試通過；瀏覽器樹影 → 海光 → 水光 → 海光切換，恢復 17:30／半窗；390×844、320×568 右下面板、About 連結與 Escape 焦點返回。初次開發模組載入失敗時原房間仍可使用，重新整理後切換成功。本次為本機驗收，未驗證部署；提交紀錄見對應 PR。

## 2026-09-10：記憶泡泡入口與環境控制列

- 未指定 `?place=` 且沒有既有偏好時，首次載入從正式 catalog 隨機選一個房間；有既有偏好時回到上次房間。每個 tab 第一次進入會顯示全畫面記憶泡泡，指定房間連結不被隨機覆蓋。
- 泡泡與隱藏 fallback select 全部由 `places` 產生，不再在 HTML 維護部分房間。`src/ui/RoomBrowser.ts` 負責初始選擇與布局錨點；`src/ui/RoomBubbleMotion.ts` 在面板開啟期間，以 session seed 的連續 curl-like 流場、錨點彈簧、阻尼、軟邊界與泡泡間排斥更新位置，不載入或複製場景。
- 泡泡形狀依速度／接觸做小幅、面積近似守恆的伸縮；外緣用三波長薄膜干涉近似產生低彩度色變。這是 UI 美術近似，不是 Navier–Stokes、肥皂膜厚度場或光譜渲染。方向沿速度漸進收斂；桌面文字反向抵銷旋轉與布局縮放，維持一致視覺字級，手機使用獨立字級。桌面 pointer 產生有界的柔和排斥與少量方向動量，hover／focus 增加阻尼，reduced-motion 停止漂移。
- 時刻、光束、自然流動暫停與音樂播放移至低存在感底列。主要時刻改為可鍵盤操作的 `radiogroup`，直接顯示晨曦／正午／暮色／月夜；連續小時滑桿放在設定面板。選曲／音量、天候、畫質、環境聲、重設與輸出仍在各自次要面板；音樂在換房時連續，不自動播放。
- 主場景 chrome 採三個固定錨點：左上場景身份、左下時刻狀態、右下操作。`761–1039px` 的中型桌面將操作列限制在右側 536px 內並排為兩列，避開左下狀態；`1040px` 以上維持單列，`760px` 以下沿用全寬雙列。展示襯線、操作無襯線、象牙色選取狀態與低對比髮絲線共用同一組 CSS tokens；光束滑桿只在 hover／focus 時提高存在感。使用者已於 2026-09-11 確認這套主視覺；進入 resting 狀態時三個錨點全部淡出，輸入恢復後再顯示。
- 桌面泡泡使用可重現星群錨點與每次 session 不同的連續漂移；390×844 改成可橫向滑動且支援 scroll snap，漂移幅度降低。所有預覽目前是 CSS 氛圍意象，不是場景截圖；未啟動多個 WebGL canvas。
- 本機驗收：97 個單元測試、build、`check:project`、`git diff --check`；瀏覽器驗證首次隨機、泡泡選擇、階光 → 水光、音樂連續、四段時刻選擇、直接 `?place=leaflight`、桌面與 390×844，並確認 dialog focus trap、背景 inert、放大的房名、漂移／薄膜色持續變化及 console 無 warning/error。pointer 壓力另以固定模型測試位移與速度上限。未驗證部署、實體手機、長時間記憶體或使用者最終視覺確認。

## 製作室與資產契約（2026-09-09）

`src/studio/` 為獨立 authoring 入口，共用 Afterlight factory、Medaka 本體、DrainGeometry、SceneClock 和 MusicPlayer。`assets/config/` 保存幾何與已採用 study；`scripts/asset-pipeline.py` 在新目錄重建兩條 pilot；`scripts/study.mjs` 保存候選與可回退的非幾何採用。詳見 [製作入口](production/README.md) 與 [驗收](production/P0_P6_ACCEPTANCE.md)。一般觀賞 UI 不承擔模型製作與實驗紀錄。
