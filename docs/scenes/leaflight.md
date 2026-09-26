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

## 2026-09-07：錦鯉重做與骨架動作

- 使用者授權參考魟魚流程與完整錦鯉文件更新，可包含重做並要求更真實。最新魚資產與驗收見[錦鯉製作頁](../biology/koi.md)；原先 Swim morph／白紅頂點色的段落保留為歷史。
- 身體、圓柔鰭膜／鰭條、側眼、唇與兩對口鬚重新建模；0.55 m 原生骨架資產具有 20 bones／9 Actions，使用程序花紋與實際 embedded normal map。網站三尾可見身長維持 0.92／0.86／1 m。
- Blender +Y 朝頭 → glTF -Z 朝頭。`KoiMotion.ts` 保留約 78 s 路徑範圍，加獨立平滑速度變化、細小升降與轉向；距離驅動慢游 clock，轉彎時後半身有輕微偏移。這是運動學編舞，不新增水體或自主魚群。
- 房間、樹、相機、曝光、天空、日照、間接光與設定面板保持原參數。補光使用蒙皮後世界座標，投影使用相同骨架。
- 本機驗收：21/21 tests、build；實際模型兩圈變形頂點最低離地 0.0873 m、最高 0.4913 m，維持房間界限。Browser 中性三視角／36 s 三圈及樹影 1280×720、14:00 檢查；暫停 screenshot 一致。[場景圖](../../exports/koi-integration/leaflight.png)。使用者已於 2026-09-07 確認「這樣可以」並授權提交，作為新錦鯉美術基準；不是發布或實體裝置效能驗收。

## 2026-09-26：Q0-3 月夜窗景與晨暮天空（候選待使用者確認）

- 分支 `claude/visual-quality`；狀態：**候選待使用者確認**，可單獨退回（只動 `Lighting.ts` sky shader 與 `FoliageMotion.ts` 樹材質注入）。
- 根因：`uDaylight` 其實有接上（月夜 `intensity .09 → day .1`），但 sky 以 `mix(night, daySky, uDaylight)` **線性**混合，月夜仍帶 10% 正午藍；夜色 `nightHigh (.018,.036,.068)` 本身偏藍偏亮，再經 exposure `2**.8`＋AgX（OutputPass）抬暗部，實測月夜天空 sRGB 約 (61,82,98)。樹葉則仍受 `sun.intensity = 20×.1 = 2` 的白藍光與線性 10% 天光填充照亮，讀起來像「白天壓暗」。晨曦 warmth .66 只得到 `smoothstep(.6,1)≈.02` 暖化；暮色 palette 為中性灰。
- 改法（皆為美術值）：
  - `dayMix = smoothstep(.10,.55,uDaylight)` 取代線性 `uDaylight` 作為日／夜混合、雲、霧與日暈權重；月夜 → 0，daylight ≥ .55 → 1。
  - 夜色 `nightLow (.0030,.0042,.0062)`、`nightHigh (.0042,.0060,.0105)`：深藍低彩度。日暈改 `.004 + .053×dayMix`（日間總量與原本相同 .057），夜間留一點月暈指向窗外月光來源；地板月光斑（`sun` 2）保留，是月夜可指認的光源。
  - 暖色兩段：`golden = smoothstep(.50,.70,warmth) × (1 - smoothstep(0,.3,angle))`（晨曦桃／玫瑰，只在早晨負 angle 生效；sky shader 新增 `uAngle`）、`dusk = smoothstep(.75,.95,warmth)`（暮色琥珀低空＋暗玫瑰天頂），另加寬前向散射 `pow(dot(d,toSun),4) × (golden×.16 + dusk×.30) × dayMix`。
  - 樹葉：同一條 `leafDay` gate；`directDiffuse/Specular × mix(.22,1,leafDay)`，天光填充 `× leafDay`，夜間加 `vec3(.20,.26,.36) × rim³ × .010` 的冷色邊緣（量級刻意極小，避免 glow）。
- 界線：warmth ≤ .5 且 daylight ≥ .55 時所有新項為恆等；因晨曦段另以 angle 限定在早晨，依 `sampleTime` 算 14:00–16:00 golden 與 dusk 皆為 0（16:00 dusk .016），使用者確認的午後基準（14:00：warmth .48、day 1）數學上不變，17:00 起才進入暮色 palette。本次未另拍 14:00 截圖。晨曦只改天空色溫，光角度仍是 Blender 基準的 ±.2 yaw，沒有做低角度長影。不是天文夜空、沒有星空，月光仍是既有 directional light 的 10%。
- 驗收（本機 Vite 6181、1600×900、四時段；證據 `exports/quality-q0q1-20260926/lighting-A/{before,after}/leaflight-*`，窗景放大 `leaflight-window-crops.jpg`）：月夜天空 luminance 78.5 → 16.5（sRGB 約 (11,17,26)）；同窗樹冠 49.2 → 10.7，樹冠低於天空 → 剪影成立。室內暗部（room box）四時段變化 ≤ 0.2。晨曦天空轉灰玫瑰、暮色轉桃琥珀，正午不變（137.5 → 137.6）。量測腳本 `measure.py`、數字 `luminance-before-after.txt`。

## 2026-09-27：Q2-A4 bloom threshold（候選待使用者確認）

分支 `claude/visual-quality-split`；狀態：**候選待使用者確認**。`index.ts` 回傳 `bloom:{threshold:LEAFLIGHT_BLOOM_THRESHOLD}`，值 2.4（共用預設 1.05；strength／radius 不變）。設為 `undefined` 或刪欄位即退回。
- 量測（reduced-motion 凍結 elapsed、正午，三張同幀）：≥235 像素 1.05: 336、1.6: 334、2.4: 327（這些主要是日斑中白錦鯉的鱗面本身，不是光暈）；錦鯉周圍光暈單點最多減 50 階；天空窗景均值 120.33→120.32（不變）；地面日斑 171.2→169.6（−0.9%）。1.6 仍可見紅白光暈，2.4 消除。
- 證據：`exports/quality-q2-20260927/A4-A5-A7-A8/{before,after}/leaflight-*`、`leaf-bloom-1.05-1.6-2.4-zoom.jpg`。
