# 鯨鯊／Rhincodon typus：黑潮商店街程序本體

## 狀態與範圍

- 狀態：已建立本體，尚未接入潮風商店街的路徑、光照、camera LOD 更新或 runtime。
- 程式入口：`src/creatures/whale-shark/index.ts:createWhaleSharkModel(length, seed)`。
- `root` 局部座標以身體中心為原點，`+Z` 朝寬闊的 terminal mouth、`+Y` 背側、`+X` 橫向；`length` 為公尺。函式把非有限長度回退為 8.5 m，並限制於 2–20 m，這是防呆，不是物種尺寸主張。

## 來源與美術近似

- 需求與形態、速度、波形、glide、LOD 驗收門檻來自使用者提供的 `quiet_places_kuroshio_arcade_biology_spec_v1.md` 第 11–16、37–38、44 節。未使用外部模型、貼圖或掃描資產。
- 程式使用 11 個解剖式截面 loft：前段是扁寬 superellipse，身體粗壯後收成明確尾柄。此為程序造型近似，並非量測或解剖掃描。
- LOD0 包含 terminal mouth、微小側眼、每側 5 條鰓裂、3 條背側 longitudinal ridges；三個 LOD 都保留第一／第二背鰭、胸鰭與 semi-lunate caudal fin 的輪廓。
- 背／側色為 slate gray，腹側較淡。斑紋由 seed 驅動且在網格 vertex color 上生成不等距 guide lattice、spots 和低頻 bars；並非物種個體識別資料。腹側顯著減少，頭部和鰭沿用同一材質色系。

## 動態與資源契約

- 呼叫端積分 `phase`（radians）後傳入 `update({phase, amplitude, glide})`。本體不持有 clock、路徑或 route；`amplitude` 是 0–2 倍的變形倍率，`glide` 限制在 0–1 並將振幅漸縮至 18%。
- CPU 每次更新三個 LOD body 的 position/normal：LOD0/1/2 分別為 72×48、40×24、20×16 截面網格。前 45% 幾乎僵硬，後段沿 lateral travelling wave 漸增。胸鰭、背鰭、尾鰭依其 attachment station 取得相同偏移及切線轉角；caudal 為尾柄附近的剛性 semi-lunate 近似。這不是 skinning、完整流體或 Strouhal controller。
- eyes、10 條 curved gill ribbons 與 3 條 triangular ridges 都以同一個 Catmull-interpolated superellipse surface sampler 建立；ribbon 全 180 個頂點以 `0.0015L` normal offset 貼於 body surface。ridges 的底／脊高分別為 `0.003L`／`0.006L`，是低矮皮褶近似。
- `THREE.LOD` 門檻為 LOD0 `<28 m`、LOD1 `28–60 m`、LOD2 `>60 m`；整體遠低於 15k vertices 的上限。呼叫端須每幀以 renderer camera 執行 `lod.update(camera)`；目前本體只更新幾何。
- `dispose()` 會釋放本體自行建立的 geometry/material 並從 parent 移除。每個 instance 擁有其資源；不要 clone 後讓多個 instance 各自 dispose 共用材質。

## 驗收與缺口

- 本輪會以 TypeScript build 與可直接 import 的 smoke script 確認有限幾何、LOD 距離、10 條命名 gill slit、3 ridge、動畫後 bounding sphere 與 idempotent dispose。
- 尚未驗證實際 WebGL 畫面、模式可讀性、鰭斑紋連續性、場景碰撞／大半徑 route、真實 GPU 或手機效能；本體完成不代表商店街整合、使用者接受或發布。

## v2 形態依據（2026-11-19，crossing 專用）

使用者看了 crossing 的鯨鯊後說「好像有點橢圓」，因此重做造型，做成 `createWhaleSharkModel(length, seed, {revision: 2})`（程式在 `src/creatures/whale-shark/revision2.ts`）。不傳選項時仍是上面的 revision 1，逐頂點不變（`tests/crossing-life.test.ts` 用量化 checksum 釘住），所以 last-arcade 與 studio 的畫面不受影響。只有 `src/places/crossing/Life.ts` 用 revision 2。沒有使用任何外部模型、貼圖或照片；使用者提供的 5 張參考圖只用來對照形態與花紋。

### 來源

等級：**A** 文獻實測或物種診斷描述；**B** 由 A 推得的模型近似；**C** 美術判斷。

1. Silas, E. G. & Rajagopalan, M. S. (1963) On a recent capture of a whale shark (*Rhincodon typus* Smith) at Tuticorin, with a note on information to be obtained on whale sharks from Indian waters. *Journal of the Marine Biological Association of India* 5(1): 153–157（書目照 CMFRI eprints 紀錄頁 https://eprints.cmfri.org.in/1659/ ；捕獲日期為 1961-07-28）。標本是 5.62 m 的未成熟雌魚，和 crossing 的兩隻（6.5 m／4 m）同一個體型級距。https://eprints.cmfri.org.in/1659/1/Silas_153-157.pdf
2. FishBase，*Rhincodon typus* 摘要頁的 Diagnosis。https://www.fishbase.se/summary/Rhincodon-typus.html
3. Florida Museum，Discover Fishes 的 *Rhincodon typus* 頁（引述 Compagno 2005）。https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/rhincodon-typus/
4. Naturalis「Sharks of the World」Linnaeus 頁（Compagno 的野外辨識特徵）。https://sharks.linnaeus.naturalis.nl/linnaeus_ng/app/views/species/taxon.php?id=62534
5. 臺灣魚類資料庫，*Rhincodon typus* 頁。https://fishdb.sinica.edu.tw/eng/species.php?id=383137
6. Wikipedia，Whale shark 條目的 Description 一節。https://en.wikipedia.org/wiki/Whale_shark

### 比例（TL = 全長；第 1 列數字為 Silas 表 mm ÷ 5620）

| 項目 | 數值 | 等級 | 模型採用 |
|---|---|---|---|
| 標準長（SL） | 4200 mm = 74.7% TL | A [1] | 身體 loft 到 s = 0.80 結束；尾柄最細處約 0.76–0.78 |
| 頭長 | 1450 mm = 25.8% TL | A [1] | 鰓區在 s 0.196–0.276 |
| 吻端到第 1 鰓孔 | 1100 mm = 19.6% TL | A [1] | 第 1 鰓裂在 s = 0.196，間距 0.02 |
| 鰓裂 | 5 對，非常大，第 5 對在胸鰭之後／後 3 對位在胸鰭基部上方 | A [2][5] | 每側 5 條，後 3 條位在胸鰭基部上方 |
| 眼間距（頭寬的代理） | 1100 mm = 19.6% TL | A [1] | 眼睛所在位置（s = 0.094）頭寬 0.19 TL；測試容許 0.176–0.216（B，±10%） |
| 口寬 | 720 mm = 12.8% TL；另一例 12.1 m 個體口寬 1.55 m = 12.8% | A [1][6] | 吻端截面寬約 0.13–0.15 TL；口是吻端橫貫的暗色帶（貼圖） |
| 吻到眼 | 530 mm = 9.4% TL；眼小，位在頭兩側前角 | A [1][6] | 眼睛在 s = 0.094 |
| 胸鰭基部處體圍 | 2800 mm = 49.8% TL | A [1] | s = 0.24 截面寬 0.196、高 0.121，周長約 0.50 TL（B） |
| 最大體高 | 查無實測 | — | 第一背鰭前方最高，s = 0.40 處 0.146 TL（C，對照參考圖）；量得寬／高在 s 0.094 為 0.193／0.092，s 0.24 為 0.202／0.121，s 0.6 為 0.109／0.097，s 0.77 為 0.052／0.027 |
| 尾柄最低高度 | 160 mm = 2.8% TL | A [1] | s = 0.76 處高約 0.032（含稜脊） |
| 吻到胸鰭起點 | 1400 mm = 24.9% TL | A [1] | 0.249 |
| 胸鰭前緣長／內緣長 | 1000 mm = 17.8%／820 mm = 14.6% TL；「非常大、較窄、鐮刀形」 | A [1][4] | 前緣約 0.18、內緣約 0.14，鐮刀形，向後掠、下垂 18°；俯視左右鰭尖距 0.42 TL |
| 吻到第一背鰭起點 | 2540 mm = 45.2% TL；第一背鰭基部後 1/3 位在腹鰭基部上方 | A [1][5] | 0.452 |
| 第一背鰭高／長 | 490 mm = 8.7%／620 mm = 11.0% TL | A [1] | 高 0.087、長 0.110 |
| 吻到第二背鰭起點 | 3640 mm = 64.8% TL；大小不到第一背鰭一半 | A [1][5] | 0.648，高 0.039 |
| 第二背鰭高／長 | 220 mm = 3.9%／350 mm = 6.2% TL | A [1] | 高 0.039、長 0.06 |
| 吻到腹鰭起點、腹鰭長 | 2900 mm = 51.6% TL；300 mm = 5.3% TL | A [1] | 0.516，長約 0.054 |
| 吻到臀鰭起點 | 3800 mm = 67.6% TL | A [1] | 0.676 |
| 尾鰭上緣長（從尾凹量） | 1420 mm = 25.3% TL | A [1] | 從尾凹（s 0.77）到上葉最遠點 0.275 TL（比實測長約 9%，原因見「全長的量法」） |
| 尾鰭形狀 | 成魚為半新月形；小型幼魚上葉明顯長於下葉；沒有明顯的次末端缺刻 | A [3][4][5] | 上葉抬高約 33° |
| 尾鰭下葉／上葉比 | 查無數值 | C | 0.54（下葉最遠點 0.149 TL），依參考圖（幼魚側視）估計 |
| 全長的量法 | SL 4200 + 尾鰭上緣 1420 = 5620，可見 TL 是把尾鰭拉平量的 | B [1] | 模型的吻端到上葉尖仍等於 `length`（照 crossing 路線與像素測試的假設），所以上葉抬起後，上緣會比實測略長一點 |
| 稜脊 | 體側各 3 條明顯稜脊，從頭部上後方開始；最下面一條延伸成尾柄的側稜（keel） | A [2][3][6][1] | 3 條稜脊做成截面上的 Gaussian 隆起，高約 0.0042–0.0048 TL；最下面一條往後加高到約 0.009 TL 成為尾柄側稜 |
| 頭形 | 頭非常寬而扁，吻端截平；口在眼前方，近端位、橫向 | A [2][4][5] | 截面頭部扁寬；吻端在 2.8% TL 內圓角收成截平的前面 |
| 花紋 | 背側灰、藍或褐色，有淡色圓斑，位在淡色的縱橫條紋之間，排成棋盤狀；腹面白；每個個體的斑紋獨一無二 | A [2][3][4][6] | 見下一節 |

### 造型實作

- 吻端：在 2.8% TL 內用 superellipse（p = 3.5）收成方圓的截平前面，不是子彈頭。
- 截面：上下分開的 superellipse，頭部的上方指數 2.7–2.8（頂面平）、下方 3.2–3.4（腹面平），往後逐漸變回 2.0。寬、背高、腹深是 14 個控制站的 Catmull 插值（上表）。
- 稜脊、鰭、鰓裂、眼睛都記錄各自頂點所在的體長位置 s，和身體套用同一個行進波（與 revision 1 相同的波形，前 45% 僵硬）。法線用 inverse transpose 直接算出，不必重算，所以稜脊與鰭不會脫離或穿進身體。
- 鰭是前緣和後緣兩條 Bezier 圍出的雙面曲面，根部埋進身體約 0.006–0.008 TL。胸鰭、腹鰭沿體側曲面生根；背鰭、臀鰭沿背腹中線生根；尾鰭分成上下兩葉。

### 花紋實作

- 載入時用 seed 程序生成 `DataTexture`：身體 1024×512 RGBA，鰭用 256×256 的循環斑點 tile。兩者都有 mipmap、sRGB，各向異性 8。node 測試沒有 DOM 也能直接用，不需要 canvas。
- u 方向依子午線上的表面距離排列，v 方向是截面周長（從腹中線起算）。斑點以表面距離（TL）佈置，所以不會在扁截面的角落被拉長。吻端前面是一個圓盤，那裡的斑點改在前視平面上佈置。
- 頭部：小而密的隨機斑點，往鰓區稍微變大。鰓之後：每 4.2% TL 一道淡色橫條（C，依參考圖），橫條之間一列圓斑，直徑約 1.0–1.6% TL；稜脊上有淡色縱線。往尾部斑點略小。腹面白，5 道深色鰓裂，吻端一條深色口裂。斑點大小沒有為了遠看而放大（C：依參考圖比例）。
- 在 crossing 的視距（22–50 m，身長約 100–120 px）下，遠處能讀到的是橫條和斑列形成的格紋；單一斑點只有近距離經過時才看得清楚。

### 資源與效能

- 三角面：LOD0 約 25.0k（身體 96×110，加鰭、鰓裂、眼睛），LOD1 8.8k，LOD2 4.8k。鰭的 geometry 由三個 LOD 共用。
- LOD 門檻預設 `[60, 130]` m（可用 `lodDistances` 指定），所以 crossing 的整條路線都用 LOD0 與完整貼圖。three 的 `LOD.autoUpdate` 預設為 true，WebGLRenderer 每次 render 都會呼叫 `lod.update(camera)`，呼叫端不必另外處理。
- CPU：在 node 上每次 `update()` 約 0.2 ms（revision 1 約 0.96 ms），因為不再每次呼叫 `computeVertexNormals`，bounding sphere 也固定為 0.62L。生成一隻在暖機後約 0.2 s，第一次（冷啟動）約 0.6 s，主要花在貼圖。crossing 有兩隻，所以載入場景時會多卡約 0.4–0.8 s。
- `dispose()` 釋放 geometry、material 與兩張貼圖，各一次。

### v2 第二輪修正（2026-11-24，crossing 專用）

- 路線拉近：鯨鯊離船體包圍盒的水平距離由 22–49 m 改為約 14–30 m（身體任何部分離船 ≥ 10 m；a 可見 71%、c 可見 52%，中位數 199／176 px），路線改成「跑道形」閉合巡游（兩段近似直線加兩個半圓端點，近側段與船平行），端點半徑夠大，轉彎仍不超過 6°／0.5 s 與 12° bank。大鯨鯊可見時的螢幕長度中位數從約 100–120 px 提高到約 175–200 px（1080p）。數值與門檻見 `tests/crossing-life.test.ts`。
- 吻端更方更扁：`NOSE_POWER = 7`（原本相當於 3.5）使前端截面到最前面才收圓，俯視前緣近乎直線、兩角圓滑，側視是扁的鈍楔，前面只剩一個很矮的近垂直面；前三個控制截面的寬略加大、截面指數略升。口裂改為邊緣羽化的帶（不再逐像素二值判斷，近看不再鋸齒）。子午線表改成往吻端加密（s ∝ w³），讓這個近平面的前端在貼圖與幾何上對得起來；吻端平面斑點的佈置範圍縮到 s < 0.007，避免斑點在頂面被拉成條。
- 鰓裂改為不等長、不等距、略帶弧形與後傾（`GILLS` 表：位置、傾斜、弧度、上下端角度），由前往後略變短，後 3 道仍在胸鰭基部上方。顏色由近黑改為比底色深一階的藍灰 `#36525f`，貼圖與幾何帶都用同一個站位函式 `gillStation`；幾何帶改為 3 頂點寬、頂點 alpha 往兩側與兩端淡出（不投影），看起來是有陰影的皮褶而不是切口。每側仍是 5 道，節點名稱不變。
- 已知：頭頂中線附近的斑點在高倍放大時偏方塊（超橢圓截面在背中線處 θ 取樣稀疏），本輪沒有處理。
