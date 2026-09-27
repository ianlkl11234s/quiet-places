## B3 裸海蝶外觀（2026-09-27，候選待確認）

> 給主 agent 合併進 `docs/biology/aurelia-clione.md` 的段落。數值權威在 `src/shared/biology/clione/index.ts` 與 `ClioneShading.ts`。

### 形態依據（A 層，可查）

| 特徵 | 來源 | 用法 |
|---|---|---|
| 物種與分類 | [WoRMS *Clione limacina* (Phipps, 1774), AphiaID 139178](https://www.marinespecies.org/aphia.php?p=taxdetails&id=139178) | 學名約束 |
| 身體透明、膠質 | [Maoka, Kuwahara & Narita 2014, *Mar. Drugs* 12:1460（PMC3967221）](https://pmc.ncbi.nlm.nih.gov/articles/PMC3967221/)：「body is gelatinous and transparent」 | 身體近乎無色，靠邊緣成形 |
| 生殖腺／內臟亮橘紅，來自 keto-carotenoid | 同上：「gonads and viscera are a bright orange-red color」；主要色素 pectenolone、7,8-didehydroastaxanthin、adonixanthin | 內臟保留橘紅；色素是吸收，不是發光 |
| 頭與內臟帶淡橘紅 | [SeaSlug.World *Clione limacina*](https://en.seaslug.world/species/clione_limacina)：「translucent body, often tinged with pale orange-red on the head and visceral mass」 | 頭錐尖端淡橘 |
| 三對口錐平時收在頭內，捕食時外翻 | SeaSlug.World（同上）；[Wikipedia *Clione limacina*](https://en.wikipedia.org/wiki/Clione_limacina)（引其 ref 12） | slowhover 不外翻口錐，因此只做頭部外形 |
| 頭觸手、頭與口位置 | [*J. Molluscan Stud.* 83(1):19（Okhotsk 海 *Clione* 新種記載，比較 *C. limacina*）](https://academic.oup.com/mollus/article/83/1/19/2528038)：「gap between the head tentacles where the mouth is situated」 | 僅作背景；本版未建頭觸手 |
| 一對翼狀 parapodia | SeaSlug.World、Wikipedia（同上） | 既有翼足 rig 不變 |

**查無**：翼足邊緣實際厚度、身體折射率或透射率的實測值、頭錐長寬比。這些都是 C 層。

### 「頭錐」的解讀

「頭錐」有兩種讀法：(a) 頭部外形呈錐狀、有頸部；(b) 口錐（buccal cones）。依來源，口錐只在捕食的瞬間外翻，場景只會用到 hover、swim、sink、turn、罕見 escape，**不會用到 hunt**，所以本版採 (a)。若使用者指的是 (b)，要另外做 hunt 時才外翻的六根口錐。

### 做法（B 層：即時近似）

- 移除 body、head、wing 的 `transmission`。場景 before 的量測顯示，transmission 版在正午亮天前是**比背景暗的點**（CLIONE_4 局部最暗 71，背景 122）。改用 fresnel 邊緣 alpha，加上前向（背光）散射（Barré-Brisebois & Bouchard, GDC 2011 的做法），所有加項都乘上場景光，沒有 emission。這一族做法與 Aurelia J1 相同，但放在獨立檔 `ClioneShading.ts`，不與 aurelia 耦合。
- 頭錐：`CLIONE_SMALL_HEAD` 從球改為 lathe 錐（仍是同一個 mesh、同一個名稱），最寬 .073L，尖端在 .565L 內，**不超過舊球的外緣**。身體前端改成頸部收縮（profile s=0 從 .58 改為 .46）。身體前端的圓頂位在透明頭內，因此在 shader 裡淡出，避免出現雙線。
- 翼足：厚度改為 `.014L·(1-.55u)·(.22+.78·sin πv)`，前緣、後緣與翼尖都比根部中弦薄；另有 margin alpha 讓外緣呈細線，翼面本身維持透明。
- 內臟：`CLIONE_VISCERAL_MASS` 的名稱與形狀不變。中心 alpha .40，外緣 .05；背光只染色，不增加 alpha（上限 .45），所以強光下也維持半透明。
- 渲染順序：內臟 1 → 身體、頭 2 → 翼 3。

### C 層（美術值）

body 中心／邊緣 alpha .035／.50，散射 2.4；head .05／.45，尖端淡橘 `#cf6a4c`×.55；wing .03／.26，margin .30，散射 .9，alpha 上限 .42；viscera 色 `#c2583c`，散射 3.4。

### 驗收（本機）

- 近看工具：`tools/snowwindow-biology/clione-light.html?view=front|side|back&gray=1&light=moon`，只用來檢查光，不是雪景光。截圖在 `exports/quality-b-20260927/B3/{before,after}/`。
- PIL 量測：
  - 近看正面：身體中心亮度 ÷ 邊緣帶亮度，before 1.32 → after 0.85。
  - 逆光：after 0.67，中心比邊緣暗。
  - 內臟飽和度 S：正面 .51、逆光 .43、月光級 .64；before 為 .67。
  - 場景正午（背景約 122／145）：before 是暗點，局部最暗 71／81；after 是淡色膠囊加橘芯，局部最亮 153／174，最暗 112／136。
  - 場景月夜：裸海蝶局部最亮 63／52，背景 40／17；同一幀 aurelia 區域最亮 120。
- 測試：`tests/clione.test.ts` 新增 B3 測試（無 transmission 與 emission、頭錐不超出舊外緣、翼緣較薄）。

### 尚未證明

- 使用者尚未確認外觀。
- 場景距離下，裸海蝶只有 7–13 px，翼足幾乎看不到。辨識只靠「淡色膠囊 + 橘芯」。
- 月夜時，背光邊緣約為背景亮度的 3 倍，但仍低於 aurelia。這算不算「發光感」需要人眼確認。
- 未確認 Blender bake／GLB：頭的頂點數已改變，需要重跑 `scripts/export-snow-creatures.ts`。
