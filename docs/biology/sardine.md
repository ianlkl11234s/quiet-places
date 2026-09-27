# 沙丁魚／*Sardinops sagax*（日本族群「melanostictus」，マイワシ）

## 狀態與範圍
- 場景：海邊小站（seabridge），是本場景唯一的主角，也是唯一的不可能現象：兩群沙丁魚在跨線橋周圍的空氣中游動、互相追逐。
- 程式入口：
  - 本體（可重用）：`src/creatures/sardine/index.ts`
  - 場景行為 adapter：`src/places/seabridge/Sardines.ts`
  - 測試：`tests/seabridge-sardines.test.ts`
- 狀態：2026-09-27 第一版，本機 browser 已看過，尚未經使用者確認。

## 來源與授權
- 形態來源：FishBase〈*Sardinops sagax*〉species summary（https://www.fishbase.se/summary/Sardinops-melanostictus.html 會導向 *S. sagax*；2026-09-27 讀取）。
- 模型、貼圖、動作全部是原創程序幾何，沒有外部資產。

## 生物事實與美術近似
| 項目 | 內容 | 等級 |
|---|---|---|
| 分類 | FishBase 以 *S. sagax* 為有效名，日本族群記為 *melanostictus*（依遺傳分析區分的地區族群之一） | A（FishBase） |
| 體型 | 延長、近圓筒形；腹部圓、有稜鱗 | A |
| 體色 | 背部藍綠；體側白色，中段有 1–3 列暗色斑點 | A |
| 尺寸 | 最大 39.5 cm SL，常見約 20 cm SL；模型每尾 16–21 cm | A／C（取常見值附近） |
| 行為 | 沿岸種，會形成大群 | A |
| 模型比例 | 體高約體長 0.19、體寬約 0.11；深叉尾鰭、背鰭在體中段、胸鰭位置低 | C（依上述描述造型，非實測） |
| 斑點 | 每側只做一列 7 顆斑點（「七つ星」的外觀），在正式視距下幾乎看不到，主要讓近看時可辨識 | C |
| 銀色體側 | metalness .55、roughness .32，由場景提供天空環境反射；沒有環境時自然變暗，不是自發光 | C |
| 游速 | 巡游約 2 BL/s，追逐 4.2 BL/s，逃竄最高 5 BL/s 後衰減 | C（美術校準，未查證文獻游速） |
| 擺尾 | 共用 locomotion 的 `tailBeatFrequency`（f0 .8 Hz、每拍 0.7 BL、上限 6 Hz），相位由速度積分 | B（共用模型）／C（參數） |
| 轉向 | 共用 `stepHeading`：偏航上限 120°/s、俯仰上限 25°、轉彎側傾 15°、C 形彎曲 | C |
| 群游 | boids：分離 1.3 BL、對齊 5 BL、聚合 10 BL（只對同群）；兩群之間只做分離 | C |
| 追逐 | 每次間隔 14 s 加上平均 16 s 的指數等待，持續 4.5–8 s：一群追另一群的預測位置，另一群往反方向逃竄 | C，不宣稱是真實沙丁魚的行為 |

## 場景 adapter（seabridge）
- 固定 12 Hz 步進加插值，只由播放器的 elapsed 驅動；seed 固定，可重現，暫停不會前進。
- 活動範圍：x −9–10、y 0.9–6.8、z −12.8–7 m；漫遊目標集中在站位前方。
- 跨線橋、頂棚、入口頂棚以每 0.8 m 一段的 AABB 表示：先軟性排斥，再做單步掃描，會進入就只保留切線分量，保證不穿模（測試 10 分鐘穿模 0 次）。
- 所有站位（user／a／b）周圍 2.4 m 內會被推開，避免魚擋住鏡頭。
- 數量 260（兩群各 130）；不投射陰影（見效能）。

## 驗收
- `tests/seabridge-sardines.test.ts`：10 分鐘內數值有限、不出界、不進入跨線橋；追逐 ≥ 8 次；同 seed 同結果、暫停不前進。3/3 通過。
- browser：`exports/seabridge-s3-sardines/`（正午每 4 秒連拍、四時段、魚群近看）。
- 效能（本機 1600×900）：30 fps、p95 36.8 ms（加魚前 34.2 ms）、約 49 萬三角面、577 draw calls。
- 未驗證：使用者確認、手機效能、真實沙丁魚群的密度與游速。
