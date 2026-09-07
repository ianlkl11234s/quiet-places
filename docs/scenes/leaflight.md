# 樹影午後：材質與光照基準

> 現行程式入口：`src/places/leaflight/index.ts`；場景細節：`src/places/leaflight/index.ts`。跨場景共用元素見 [架構文件](../ARCHITECTURE.md)。下方歷史紀錄的舊路徑對應本次整理前版本。

2026-09-07。使用者確認「目前蠻好的」的應用基準：`b6241fbbd96443625101bec10e11be80198427b0`，分支 `feat/blender-leaflight`。這是目前本地整體效果的確認，不是全部裝置／時段或完整 GI 的驗收。

共同製作規則見 [材質與光照筆記](../MATERIALS_AND_LIGHTING.md)；詳細歷史見 [Blender 接手紀錄](../../.claude/memory/blender-production.md)。

## 場景和資產

滿版暗室、右上開放窗洞、窗外程序樟樹造型、斜向日照與近地面三尾錦鯉。沒有窗玻璃或室內燈具。樟樹目前是造型近似，未做植物學精度驗收。

- 房間母檔：`assets/blender/leaflight-study.blend`；烘焙版本：`leaflight-web.blend`。
- 房間／樹來源：`assets/blender/scripts/leaflight.py`、`camphor.py`；烘焙／匯出：`bake_leaflight.py`、`export_study.py`。
- 魚母檔／來源：`assets/blender/koi.blend`、`assets/blender/scripts/koi.py`。
- 網頁模型：`public/models/leaflight-study.glb`、`koi.glb`；貼圖：`public/textures/leaflight/`。
- 幾何與材質為本專案建立；參考圖未嵌入 public 模型。魚 GLB hash 與動畫長度見 `public/models/koi.metadata.json`。

## 光照如何構成

| 部位 | 目前實作 | 應保留／限制 |
|---|---|---|
| 日照與葉影 | `LeaflightLighting.ts` DirectionalLight＋2048 shadow map | 不是貼在牆上的假葉影；模型變形與影子同步 |
| 房間間接光 | 512²、128 samples 的 Blender diffuse indirect EXR，降噪後使用 | 不含 direct；四時段共用午後基底，並非四組 GI |
| 天空 | 程序藍灰漸層、薄雲、少量遠景散射 | 光束滑桿不改天空亮度；避免霧白面板感 |
| 窗邊 | 限定開口附近的弱冷色補光 | 局部近似，不整間加亮 |
| 室內光束 | room-bounded raymarch＋日照 shadow map | 看穿窗洞時不疊霧膜；未使用魚身 depth texture 截斷 |
| 枝葉 | 原 PBR＋弱天空填光／有限空氣透視 | 空氣透視上限 2.5%；並非葉片完整透射模型 |
| 魚身暗部 | world normal 對窗方向、面積／距離衰減；腹部取附近地板 shadow-map 估計反射 | 方向性近似 GI，不使用整條魚均勻灰藍的補光 |

## 參數與轉換注意

以對應 commit 的程式為準，下列均為本場景校準值，不是跨場景標準物理常數。

- Blender 使用 Z-up，網站 Y-up；日光方向 Three 為 `(-1,-.85,-.45)` 正規化。
- 太陽基礎 intensity `20`，乘時段強度；AgX、exposure `2**.8`。時段是美術 keyframe，不是天文日照。
- RoomSurface lightMap 為 linear EXR；UV0、`flipY=false`，搭配 `repeat.y=-1`／`offset.y=1` 修正 scanline 方向。runtime intensity 為 `PI × 時段比例`；舊 metadata 的 `.65` 不代表現行校準。
- 魚材質為白紅頂點色與非金屬 PBR；沒有鱗片細節貼圖。魚中心高 `.25–.31m`，路徑約 `78s` 一圈，三尾錯開位置；Swim morph 動畫由共同 elapsed 控制。
- 網站 30／24 fps、單一 RAF、背景／暫停停止動畫。GLB clone 分享 geometry，但釋放由單次 factory 所有者統一處理。

## 已確認改動與退回點

| Commit | 目的 |
|---|---|
| `fc4d130` | Blender 房間、烘焙、動態風影接入滿版網站 |
| `3c0167e` | 天空層次與局部天光 |
| `882c9d1` | 清除窗外霧膜感，保持開放空洞 |
| `568958c` | 錦鯉模型、擺尾、近地面路徑與投影 |
| `b6241fb` | 修正魚身暗部的均勻灰色剪影，使用者接受目前效果 |

既有證據：主 app browser 看圖與無 shader errors、build 通過；錦鯉 88 秒離散採樣的貼地／房間界限與資源釋放檢查。尚未建立所有固定時段／相機／裝置的完整對照圖組；後續重要美術修改補上比較條件，不能將此次接受擴張成未測項目已通過。

## 後續樹種變體

依共同筆記格式新增變體段落，記錄葉形、葉背、透光、冠層與風的差異，以及是否需要重烘焙。先維持此基準的相機與光照做對照，再決定該樹種需要哪些獨立校準。

## 2026-09-07 主分支整合與設定面板

- 將上述已確認的 Blender 樹影基準整合至 `codex/leaflight-glass-main`，保留主分支 `f34e144` 水景矩形房間／靠牆停止；相機牆界只作用於 waterlight，樹影維持自己的視角限制。
- 共用設定面板改為 272px 寬、26px 圓角的半透明玻璃介面；場景、時間、暫停與重設視角直接可見，其餘收進「光線與更多設定」。玻璃模糊為 CSS 視覺效果，不影響場景材質或光照。
- 本地 browser：1280×720 樹影渲染、272×357px 收合面板；390×844 水景／樹影切換、雨日、更多設定展開捲動無橫向溢出，console 無 error。這是 viewport 驗證，不是實體手機效能驗收。
- TypeScript + Vite build 通過；正式發布狀態另見部署接手文件。

## 2026-09-07 中性灰介面與四時段

- 共用玻璃選單改為中性深灰、灰白文字與滑桿；backdrop 去飽和避免樹葉／天空染色，保留既有圓角和模糊。
- 快捷與圖片匯出時段統一為晨曦 06:30、正午 12:00、暮色 17:30、月夜 23:00；取代原先正午／黃昏／暮光／月光組合。沿用 TimeOfDay 美術 keyframe，不重烘焙或變更光照參數；晨曦仍共用午後間接光基底。
- 本地 build 通過，browser 四按鈕時間讀回正確、深灰面板視覺確認、console 無 error。

## 2026-09-07：場景目錄與共用元素整理

- 在 `codex/shared-scene-elements` 將場景程式集中到 `src/places/leaflight/`；保留本場景材質、光路、鏡頭與動態的既有參數。
- 共用狀態由 `player/contracts.ts` 定義，水體數學／亂數／模型資源按實際需求引用 `shared/`；不把場景曝光、天空或光學近似共用化。
- 目錄整理已隨 [PR #2](https://github.com/ianlkl11234s/quiet-places/pull/2) 合併至 `main`（`27e597f`）；視覺驗收範圍見 [驗收記錄](../VALIDATION.md)。
