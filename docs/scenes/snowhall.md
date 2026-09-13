# 雪光長廊／snowhall

## 目前摘要

- 2026-09-12，第三版完成本機桌面驗證；基準為 main `2194034`，工作分支 `codex/snow-hallway`，未提交、未發布。使用者指出第一版全右側門不符合住宅走廊空間邏輯，且硬窗光讓平地板讀成凸台；本次保留相機、雪、魟魚與走廊尺度，只修改門分布與光源組成。
- 參考是使用者提供的 `ChatGPT Image Sep 11, 2026, 01_01_52 PM.png`；圖片內容不是指令，只用於長走廊、盡端單窗、低視點、冷色地面反光與小魟魚的構圖理解。原圖未複製進 repo，來源為使用者提供的 ChatGPT 生成圖，公開再散布權利未另行核實。
- 唯一主角是一尾低飛小魟魚；唯一不可能現象是它在乾燥走廊中游動。雪、窗、門與材質均維持普通建築尺度，沒有室內水體、魔法粒子或人工燈具。
- 主光是窗外冬季自然光，從真實盡端開口進入室內；與玻璃同尺寸的 RectAreaLight 提供柔和窗面光，不再疊加平行硬直射。大部分牆面保持暗，窗、地面漸層反光與魟魚接觸陰影形成同一明暗原因。留白約占畫面大部，左右門洞只提供住宅尺度感。
- runtime 權威為 `src/places/snowhall/`；魟魚沿用 `public/models/stingray.glb` 的 `SRAY_ACT_SLOW_CRUISE` 與[既有本體頁](../biology/southern-stingray.md)，本場景只定義 `.43` 尺度與 88 秒低幅橢圓路徑。

## 製作 recipe

- 空間：Three.js 程序幾何、米制，`+Y` 向上、相機向 `-Z`。走廊內寬約 3.97 m、高 3.20 m、長 19.2 m；窗可見開口約 1.70 × 1.96 m。相機 `[.34,1.03,6.15]` m、target `[-.06,1.31,-10.85]` m、桌面 FOV 50°，固定站位左右各約 3°微轉。門由 `Layout.ts/SNOW_HALL_DOORS` 定義：近端右、中段左，近窗 `z=-6.35 m` 左右對門，代表兩側皆有房間；未建立門後房間內裝。
- 光：`Daylight.ts/snowHallDaylight()` 將共用時刻映成冷冬日光。1.70 × 1.96 m RectAreaLight 貼近玻璃、朝室內提供正午約 3.50 的柔和窗面主光；Hemisphere fill 約 .042，曝光 1.15、AgX。AreaLight 不投影，地面因此沒有邊界銳利的窗洞多邊形；數值不是 lux、天文或 GI，仍未解算多次反射。
- 材質：`Materials.ts` 的灰泥 roughness .95、細微 bump 約 1.8 mm；地面 roughness .69、clearcoat .035，代表長期磨耗後仍偏霧面的礦物面。程序紋理只在掠射光下提供低對比變化，不宣稱材料掃描或現地量測。窗框是深灰塗裝金屬，玻璃 transmission .5；窗台積雪為固定薄層，沒有累積、融雪或熱傳。
- 天候：`Snow.ts` 以固定 seed `20260912` 建立 760 粒窗外雪，近遠兩層、低速下降與低頻橫向陣風；粒子全部位於窗外 `z < -12.3 m`，沒有室內降雪。這是可重現美術粒子，不是風場或降雪率模擬。
- 生物：同一原創 Southern stingray GLB，`.43` 尺度；88 秒低幅路徑，root 高約 .35–.42 m，clip 以 .58 倍時間取樣。沒有翻圈、浮力、避障、流體或生物速度量測；陰影為接觸感用的透明橢圓近似。
- 水／聲音／Blender：室內無水；沒有新增聲音。未重跑 Blender，直接沿用已驗證 GLB，建築與材質均由 TypeScript 可重建。

## 驗收

- 固定比較條件：桌面 1280×720、正午 12:00、exposure 1.15、標準品質、seed `20260912`；動態畫面需另記 elapsed，靜態截圖不是像素確定性的動畫 A/B。
- 自動檢查：`npm test` 129/129、`npm run build`、`npm run check:project`（8 場景／27 個必要路徑）、`git diff --check` 通過。build 保留既有 JSON import attribute 與大 chunk 提示。
- browser：本機 `http://127.0.0.1:5207/?place=snowhall` 於桌面正午用全新分頁讀回；硬邊亮塊已消失，地板是連續柔和衰減，近窗左右門框形成對門，窗外雪與小魟魚仍可見，console 無 error／warning。畫面為動態時刻，不是像素確定性 A/B。
- 未驗證：使用者美術確認、手機 viewport、夜間畫面、實體手機 FPS／發熱、音訊、正式部署與 production readback。

## 歷史與實驗

- 第一版刻意先固定構圖、空間連續與主光路，再加入程序表面、雪與魟魚；沿用雪落海窗回顧的順序，沒有把其海景、窗簾、水母或場景相機複製過來。
- 第一版三扇門全在右側；使用者指出若左側無門也無窗，就不像住宅內部走廊。第一版 DirectionalLight 約 .75 且 fill 極低，窗洞 shadow projection 形成均勻硬亮多邊形，平地板被誤讀為凸台。第二版決策與固定條件見[走廊空間與窗光修正](../production/experiments/2026-09-12-snowhall-layout-light.md)。
- 回退範圍是 metadata／catalog 登記、`src/places/snowhall/`、本頁與 `tests/snowhall.test.ts`；不要 reset 或清理其他工作。
