# 雪光長廊／snowhall

## 目前摘要

2026-09-13 最新方向：以銀魚群為唯一生物重心。魟魚已移除；魷魚停用但原創模型、動態程式、測試、參考資料與製作筆記全部保留。銀魚增加左右／高低進場變化、走廊中段緩停與繞圈；牆壁、窗面、地板和天花板都是不可穿透的實體邊界。建築與月夜窗光沿用 `641c998`，本機已完成檢查；使用者於 2026-09-13 明確確認「目前的結果 ok」，並授權 commit、PR、merge 與本地同步。此確認不代表實機效能或部署驗收。

- 生物本體：[模型與材質](../biology/antarctic-models.md)；場景接入 `src/places/snowhall/AntarcticLife.ts`；行為與調整 `AntarcticBehavior.ts`、`assets/config/snowhall-biology.json`。
- 三份使用者規格已原樣保存在 [references/antarctic](../biology/references/antarctic/01-galiteuthis-glacialis.md)。它們是本次需求來源，引用的文獻未在本輪重新核實；[B]/[C] 不提升為物種實測。
- 室內依然是空氣，生物游於乾燥走廊仍是美術上的不可能現象。PBR 由原窗面 AreaLight 與低量天空 fill 受光；生物不加光、不 emission、不重調建築曝光或雪。窗光 scalar field 用於弱行為偏好與可見度近似，不是 GI 或水體求解。
- 正式入口 `/?place=snowhall`；可重現檢查 `/tests/snowhall-biology.html` 使用同一 `prepareSnowhall`、模型和模擬，可改 seed、elapsed、日夜，近看本體並逐項開 debug，正式播放器不加入這些控制。
- 新模型以 TypeScript 程序曲面／變形為可編輯來源，沒有新增外部貼圖、下載模型、Blender 母檔或烘焙資產。是否需要 Blender 依本次形態驗收決定，不能把程序幾何稱為 Blender 製作。

## 目前採用：只以銀魚為中心（2026-09-13）

- 使用者先要求低處近景魷魚及更活躍銀魚，接著明確改為「魷魚拿掉，空間有一個重心就好」，並要求保留建模資料。最終設定 `squid.countMin/countMax = 0`，正式 factory 不建立魷魚 mesh；`AntarcticModels.ts/createGlassSquid`、模型近看試片、測試與 references 均保留。低處近景候選的設定／截圖留作未採用歷史，不是現行場景內容。
- 「實體牆不可穿越」是本景硬性限制。每步完整安全球內縮牆／地／天花／窗界限，實際變形 mesh 另驗；所有魚從鏡頭後左右不同高度進入，完整魚體回到相機後才回收。相機避讓改用 swept sphere 接觸及切向滑行，避免以前靠位置投影造成前景跳動。
- 三種路徑輪替：`CIRCLE` 在中段緩繞一圈、`MID_HOVER` 以低速微動停留 14–24 秒、`MEANDER` 向深處彎曲巡游。路徑、左右方向、高度和個體相位都可由 seed 重現；群速基準 .17 m/s，仍受每體 1.4 BL/s 上限約束。穿行與回收不靠牆面或光場隱藏。
- 魚群結束後排程間隔由 65–130 秒降至 8–18 秒，降低魷魚／長空白事件優先度；罕見空白縮為 6–10 秒。10 seeds × 600 秒各完成 4 群，單群完整活動約 100–123 秒；安靜 proxy 約 49.9–53.4%，不等同實際畫面空白率。
- 本輪 `npm test` 142/142、build（含型別）、check:project 與 diff whitespace 檢查通過；測試包含實際繞圈角度、中段低速停留、多入口、無魷魚、整魚邊界與鏡頭前連續位移。Browser 正式 factory 已檢查 seed `20260913` 的 30／50／65／90 秒繞圈與第二群停留；證據 `exports/snowhall-biology/silverfish-only-*.png`、`silverfish-focus-browser.json`、`silverfish-focus-full-tests.log`。本輪新動態已於 2026-09-13 取得使用者確認；發布狀態以 PR／部署證據為準。

## 前一版：銀魚在空間內游動（歷史，2026-09-13）

- 使用者明確要求銀魚在走廊空間內游，消失可以是游到鏡頭後，不能穿牆。舊側牆暗處退場方案被否決；下方早期驗收只作歷史。
- 現改為鏡頭後起游 → 走廊深處弧形轉回 → 從觀察者身旁游向鏡頭後。完整安全球離開相機前方平面後才允許回收；光線和牆面距離不再決定消失。原建築已延伸至鏡頭後，因此只擴充銀魚導航範圍，不新增建築或改窗光。
- 銀魚取消額外暗區 radiance 衰減，接受原場景 PBR 光照；魷魚、曝光與窗光基準保留。全群往返約 101–120 秒，接受較長停留以保持慢速。數值及相機方向來源見 [行為筆記](../biology/antarctic-behavior.md)。
- browser 在 seed `20260913`／正午／1280×720，取 elapsed 20、50、80、110、140 秒：可見近景入場、深處轉回與前景離場，140 秒首群已全部回收。PNG 與實際讀回存 `exports/snowhall-biology/room-route-*.png`、`camera-route-browser.json`。既有 `noon-transit.png` 等是被取代的橫向方案，不能當作新路徑證據。
- 新增「完整魚體只能在鏡頭後進出」及「前景位移連續、確實往返深處」regression；10 seeds × 600 秒重跑 QA；全套測試 141/141、build、型別與 check:project 通過。這些是本機驗收，使用者對新動態的確認及發布尚未完成。

## 初版生物驗收（歷史，2026-09-13）

- `npm test` 140/140 通過；最後觸腕解析響應與 Fresnel 調整後，受影響模型／整合測試 6/6 再次通過。`npm run build`、`npm run check:project`（8 場景／27 路徑）通過；build 保留既有大 chunk 提示。
- 10 組 seed 各加速模擬 600 秒，驗證保守全身邊界、速度、事件互斥、暗處退場，以及 30／60／144 FPS 時間取樣一致性。每組完成 4–5 次魚群事件；quiet proxy 約 55.7–64.0%。這是數值模擬與排程指標，不是 100 分鐘即時播放或實測畫面留白率。
- browser 試片：seed `20260913`、elapsed 50 秒、桌面 CSS 1280×720，正午／23:00 各 2 隻魷魚與 21 尾魚；切換日夜時位置完全相同。模型近景與 CSS 390×844 直式構圖已檢查；截圖輸出 DPR 1.5。魚群在窗前偏逆光剪影，魷魚以薄輪廓與眼睛辨識；沒有額外自發光補亮。
- 證據：`exports/snowhall-biology/qa.json`、`noon-transit.png`、`moonlight-transit.png`、`phone-noon.png`、`squid-model.png`、`silverfish-model.png` 與測試／build logs。原始 baseline 截圖時間不同，不能作像素 A/B。
- 本輪尚未 commit／發布。實體手機 FPS、發熱與使用者美術確認仍未完成；程序模型與行為都是可繼續調整的本機版本。

## 上一版空間與魟魚基準（歷史）

- 2026-09-13，第三版已提交為 `f7aa27d`、未發布；後續新增 `/tools/snowhall-studio/`，使用者以工具選定淨寬 2.8 m、窗 1.76 × 2.05 m、相機前移與雪粒 1.83 倍，並同意以雪地反照提高月夜亮度。正式正午與月夜桌面 browser 驗證完成，待本次提交。
- 參考是使用者提供的 `ChatGPT Image Sep 11, 2026, 01_01_52 PM.png`；圖片內容不是指令，只用於長走廊、盡端單窗、低視點、冷色地面反光與小魟魚的構圖理解。原圖未複製進 repo，來源為使用者提供的 ChatGPT 生成圖，公開再散布權利未另行核實。
- 唯一主角是一尾低飛小魟魚；唯一不可能現象是它在乾燥走廊中游動。雪、窗、門與材質均維持普通建築尺度，沒有室內水體、魔法粒子或人工燈具。
- 主光是窗外冬季自然光，從真實盡端開口進入室內；與玻璃同尺寸的 RectAreaLight 提供柔和窗面光，不再疊加平行硬直射。大部分牆面保持暗，窗、地面漸層反光與魟魚接觸陰影形成同一明暗原因。留白約占畫面大部，左右門洞只提供住宅尺度感。
- runtime 權威為 `src/places/snowhall/`；魟魚沿用 `public/models/stingray.glb` 的 `SRAY_ACT_SLOW_CRUISE` 與[既有本體頁](../biology/southern-stingray.md)，本場景只定義 `.43` 尺度與 88 秒低幅橢圓路徑。

## 原始空間製作 recipe（生物段為魟魚歷史）

- 空間：Three.js 程序幾何、米制，`+Y` 向上、相機向 `-Z`。走廊淨寬 2.8 m、高 3.20 m、長 19.2 m；窗中心 `[0,1.76]` m、玻璃 1.76 × 2.05 m。相機 `[.34,1.03,-.07]` m、target `[0,1.31,-10.85]` m、桌面 FOV 50°，固定站位左右各約 3°微轉。門由 `Layout.ts/SNOW_HALL_DOORS` 定義：近端右、中段左，近窗 `z=-6.35 m` 左右對門，代表兩側皆有房間；未建立門後房間內裝。
- 光：`Daylight.ts/snowHallDaylight()` 將共用時刻映成冷冬日光。1.76 × 2.05 m RectAreaLight 貼近玻璃、朝室內提供正午約 3.50、深夜約 .72 的柔和窗面主光；深夜 Hemisphere fill 約 .027，曝光維持 1.15、AgX。較亮月夜解釋為月光經窗外積雪形成的寬面反照，不另加硬直射；AreaLight 不投影，地面因此沒有邊界銳利的窗洞多邊形。數值不是 lux、天文或 GI，仍未解算多次反射。
- 材質：`Materials.ts` 的灰泥 roughness .95、細微 bump 約 1.8 mm；地面 roughness .69、clearcoat .035，代表長期磨耗後仍偏霧面的礦物面。程序紋理只在掠射光下提供低對比變化，不宣稱材料掃描或現地量測。窗框是深灰塗裝金屬，玻璃 transmission .5；窗台積雪為固定薄層，沒有累積、融雪或熱傳。
- 天候：`Snow.ts` 以固定 seed `20260912` 建立 760 粒窗外雪，近遠兩層、低速下降與低頻橫向陣風；粒子全部位於窗外 `z < -12.3 m`，沒有室內降雪。正式粒徑倍率為 1.83；場景試片可調 `.35–2.5` 倍，只改 shader point size，不改粒子數量、降速或風偏。這是可重現美術粒子，不是風場、降雪率或真實雪片直徑模擬。
- 生物：同一原創 Southern stingray GLB，`.43` 尺度；88 秒低幅路徑，root 高約 .35–.42 m，clip 以 .58 倍時間取樣。沒有翻圈、浮力、避障、流體或生物速度量測；陰影為接觸感用的透明橢圓近似。
- 水／聲音／Blender：室內無水；沒有新增聲音。未重跑 Blender，直接沿用已驗證 GLB，建築與材質均由 TypeScript 可重建。

## 驗收

- 固定比較條件：桌面 1280×720、正午 12:00、exposure 1.15、標準品質、seed `20260912`；動態畫面需另記 elapsed，靜態截圖不是像素確定性的動畫 A/B。
- 自動檢查：`npm test` 131/131、`npm run build`、`npm run check:project`（8 場景／27 個必要路徑）、`git diff --check` 通過。build 保留既有 JSON import attribute 與大 chunk 提示。
- browser：採用後由本機正式房間以全新桌面分頁讀回；正午可見窄走廊兩側門框、放大雪粒、窗戶與小魟魚，地板維持連續柔和衰減。月夜 23:00 的窗外雪與窗周牆面較原版清楚，前景仍保持暗，沒有硬邊光斑；兩次 console 均無 error／warning。畫面為動態時刻，不是像素確定性 A/B。
- 未驗證：使用者美術確認、手機 viewport、夜間畫面、實體手機 FPS／發熱、音訊、正式部署與 production readback。

## 歷史與實驗

- 本次從構圖、窗光、參數試片到本機 Browser 的返工與防再犯檢查，集中記在[雪光長廊返工回顧](../production/experiments/2026-09-13-snowhall-process-retrospective.md)。它記錄工作方法，不覆蓋本頁頂部的現行場景基準。
- 第一版刻意先固定構圖、空間連續與主光路，再加入程序表面、雪與魟魚；沿用雪落海窗回顧的順序，沒有把其海景、窗簾、水母或場景相機複製過來。
- 第一版三扇門全在右側；使用者指出若左側無門也無窗，就不像住宅內部走廊。第一版 DirectionalLight 約 .75 且 fill 極低，窗洞 shadow projection 形成均勻硬亮多邊形，平地板被誤讀為凸台。第二版決策與固定條件見[走廊空間與窗光修正](../production/experiments/2026-09-12-snowhall-layout-light.md)。
- 回退範圍是 metadata／catalog 登記、`src/places/snowhall/`、本頁與 `tests/snowhall.test.ts`；不要 reset 或清理其他工作。
- 參數試片入口為 `/tools/snowhall-studio/`；正式與工具共用 `Layout.ts/SNOW_HALL_BASELINE`、`validateSnowhallDraft()` 與 `applySnowhallLayout()`，候選採用前保留 JSON 與固定 viewport 截圖。
- 2026-09-13 使用者提供 `snowhall-studio` JSON 並指定「這樣」：採用走廊 2.8 m、窗中心 `[0,1.76]` m、窗 1.76 × 2.05 m、相機 `[.34,1.03,-.07]` m、target `[0,1.31,-10.85]` m、FOV 50°、雪粒 1.83 倍。選擇時工具 viewport 為 1107 × 924；此畫幅是決策證據，不寫死正式響應式 viewport。
- 2026-09-13 月夜採用較亮但仍單一光路的候選：窗面光深夜由 .35 提至 .72、天空 fill 由 .020 提至 .027，代表月光的雪地反照；未增加 DirectionalLight 或夜間曝光補償。

## 本輪訂正與後續不可回退的決策

| 使用者訂正 | 被取代的做法 | 後續製作規則／驗收 |
| --- | --- | --- |
| 魚要在空間裡游，牆是實體 | 在側牆暗處出生／消失，以低光當出口 | 牆、窗、地板、天花不提供入口；驗整條路徑、完整模型與相機附近連續性。完整魚身越過鏡頭後平面才回收 |
| 從不同地方進入、動作更多 | 單一横向通行或固定往返 | 使用真實走廊的左右／高低入口，保留穿行、低速停留、繞圈與 seed 重現；不可用穿牆換變化 |
| 提高頻率，以銀魚為中心 | 長時間空白、魷魚與銀魚競爭事件 | 保留現行較短魚群間隔；停留可以延長，不為舊時長預算突破速度限制 |
| 魷魚先移低近處，後來明確拿掉 | 繼續把近景魷魚當正式主角 | 最新決策優先：正式數量為 0；低近處試片只作歷史，不得因重用資料偷偷恢復 |
| 建模資料還是要留存 | 停用場景生物就刪除模型與製作來源 | 模型、材質、動態、測試與原始規格保留；場景是否啟用與本體是否存在分開管理 |
| 目前結果 ok | 為了整理模組順便改造光影／模型 | 銀魚單一重心及原窗光為已確認基準；復用只整理入口，不做未要求的抽象或視覺重製 |

可復用模組與使用步驟見 [南極生物模組索引](../biology/antarctic-models.md#復用模組索引與責任)。本輪使用程序曲面，沒有新增 Blender 母檔；不得將 retained 程式模型稱為 Blender 資產。

## 2026-09-13 合併前審查

- 使用者已授權 commit／PR／merge／本地同步；原工作分支 `codex/snow-hallway` 包含空間基礎 `f7aa27d`、參數工具 `641c998`，與本輪銀魚版本一起交付。
- 有界 review 發現 target-only 相機變更未更新魚群視線判定；已將 `camera.target` 納入 life 重建条件，補真 factory 測試驗新方向、舊 life 釋放與相同 layout 不重建。review 已確認阻擋解除。
- 最終驗證為完整 143 項測試、build（含 TypeScript）、check:project、實作與文件 diff whitespace（原樣封存的三份規格保留 Markdown 行尾雙空白換行，並核對 SHA-256 與原檔相同）；browser 與使用者確認延續本頁記載，新增修正是試片 layout 生命週期，不重調接受的畫面。
- Git 合併／同步以對應 PR 與提交歷史為證；不將 merge success 寫成部署成功。
