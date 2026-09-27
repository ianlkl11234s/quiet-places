# 畫面精緻度與生物擬真改善計劃

更新：2026-09-26。狀態：**Q0／Q1 已實作為候選，待使用者確認**（見下方實作狀態）；Q2／Q3 尚未開始。本頁是候選清單與執行順序，不代表任何項目已採用；每一項改動都以可回退實驗處理，並由使用者看圖確認。新場景的長期準則另見[場景品質準則](SCENE_QUALITY_GUIDE.md)。

## 實作狀態（2026-09-26，分支 `claude/visual-quality`）

Q0 與 Q1 已全部實作為**候選**，每個 commit 只對應一個 Q 項目（2026-09-26 重排），都待使用者看圖確認；尚未推送或合併。證據在 `exports/quality-q0q1-20260926/`：`00-after-msaa/`、`01-dawn-warmth-compare.jpg`，以及 `lighting-A/`、`lighting-B/`、`biology/` 各自的 before／after。測試 185/186，唯一失敗的是 main 上原本就有的 kuroshio manta 遭遇測試。

| 項目 | commit | 備註 |
|---|---|---|
| Q0-1、Q0-2 MSAA 與 pixelRatio | `9abc92c` | composer 原本維持 1.75，現在與 canvas 同為 1.5 |
| 共用晨曦 warmth .35→.66 | `a30b927` | 屬於 Q1-1 的共同根因；afterlight、last-arcade 有自己的日照循環，幾乎不受影響，留到 Q2 |
| Q0-3 leaflight 月夜窗景 | `192cb1b` | |
| Q0-4／Q1-1／Q1-2 seaward | `7b0d16d`／`26b50ec`／`49f1f34` | 每項一個 commit，各自通過 tsc 與 seaward 測試 |
| Q0-5 seaward 魟魚鰭相位 | `be17279` | 慢段可能看起來像停住，需要看動態 |
| Q0-6 waterlight 長鰭錦鯉 | `214caec` | 轉彎動畫比例 17%→31%；最小間距 .465 m |
| Q1-1 oceanlight 窗景 | `ea37787` | |
| Q1-1 snowwindow／snowhall | `316c03b`／`946faf6` | 細微；正午與月夜不變 |
| Q1-2 oceanlight PMREM／waterlight 反彈光 | `bf928e3`／`0a2e26b` | AO 烘焙延後：房間是程式生成，沒有 Blender 母檔 |
| Q1-3 locomotion（模組／各魚種接入） | `857af4f`／`23b13a0` | 懸停只有青鱂一個消費者；leaflight 側傾改為朝轉彎內側 |
| Q1-4 魚類材質層（模組／各魚種接入） | `077d08c`／`0d35909` | 三份各自重寫的補光尚未收斂；鰭沒有 UV，只做依視角的 alpha；強日光下白鰭仍可能碰到 bloom 門檻 |

## 依據與限制

- 基準：main `d91afa7`，本機 Vite dev server，headed Chrome，1600×900，預設品質。
- 證據：`exports/quality-review-20260926/`
  - `default-*.jpg`：9 景各一張預設時刻
  - `moments-grid-*.jpg`：四時段四宮格，依序為晨曦、正午（上排）與暮色、月夜（下排）；waterlight 缺四宮格，只有單張
  - `moments-crops.jpg`、`creature-*.jpg`：局部放大
  - `motion-*.jpg`：生物連拍拼圖（約 1 秒間隔），`motion-jelly`／`motion-clione` 取自 snowwindow 生物近看工具
- 動態觀察是每景約 6 張、間隔約 1 秒的連拍，再搭配讀程式。**不是錄影分析**，也沒有逐幀量測。
- 首輪平行截圖時，兩個瀏覽器 session 曾經互相干擾。時段四宮格的受影響圖已經作廢並重拍；生物連拍是在同樣的條件下拍的，而且沒有重拍（stairlight 曾被切到別的場景）。所以下表中只靠連拍的判斷標為「待重拍確認」；有程式行號佐證的項目不受影響。之後平行截圖要用 `agent-browser --session <name>` 做隔離（`--session-name` 只保存 cookie）。
- 以下各項尚未驗證：實機、手機、效能、部署。「看起來」屬於美術判斷，不是量測結果。

## 先守住的邊界

- MASTER 要求「房間大部分是真正的暗」「不抬黑位」「避免過度 bloom」。所以本計劃**不是**要把場景調亮。要處理的是：
  - 暗部沒有形體
  - 光沒有說得出來的來源
  - 時段之間沒有差異
  - 材質和生物讀起來像 CG
- 目前的使用者確認基準，改之前先看場景頁：
  - [leaflight](../scenes/leaflight.md)（`b6241fb`）
  - [oceanlight](../scenes/oceanlight.md)（`33ae0cc`）
  - [waterlight](../scenes/waterlight.md)
  - [stairlight](../scenes/stairlight.md) 結構 v3
  - [snowwindow 雪景](PREFERENCES.md#2026-09-10雪景確認與可重用製作原則)
  - [snowhall 銀魚版](PREFERENCES.md#2026-09-13雪光長廊銀魚版本已確認)
  - seaward 已合併
- 觸及上述任一基準的項目，一律「A/B 候選 → 使用者確認 → 才採用」。
- snowhall 的長時間空白、極暗走廊，以及只有銀魚一個主角，都已由使用者確認。本計劃對它只列選配項。

## 發現摘要（依層）

### 1. 畫質管線（全站，成本最低）

| 發現 | 位置 | 影響 |
|---|---|---|
| 實際上沒有抗鋸齒 | `src/main.ts:47` 雖設 `antialias:true`，但畫面先渲染進 EffectComposer 的 render target；`src/main.ts:122-125` 只給 oceanlight 開 MSAA samples，其他 8 景為 0，也沒有 SMAA／FXAA pass | 遠處小魚邊緣呈鋸齒、細欄杆與倒影邊緣粗糙；這是畫面「像遊戲」的主因之一 |
| pixelRatio 上限前後不一 | `src/main.ts:48` 初始上限 1.75；`src/main.ts:382` 在 resize 後改成 1.5 | 視窗調整一次後畫質就下降，行為前後不一致 |
| bloom 全站共用同一組參數 | `src/main.ts:127` UnrealBloom(.19,.65,1.05) | 錦鯉鰭邊出現白色光暈；需要各景個別校準，或提高 threshold |

### 2. 光與時段

- **晨曦和正午分不出來**。waterlight、leaflight、afterlight、snowwindow、snowhall、last-arcade 都有這個狀況：晨曦缺少低角度的暖色光。
- **窗景天空沒有跟著時段變**：
  - leaflight 月夜的窗外仍是藍天和亮綠樹葉。`src/places/leaflight/Lighting.ts:47-55` 其實有夜空分支，但畫面上沒有生效，需要查 `uDaylight` 與樹葉材質的驅動。
  - snowwindow、snowhall 的晨曦、正午、暮色三張幾乎相同。雪天陰光本來就會降低差異，但目前完全沒有暖冷差。
  - seaward 暮色的天空是中性灰。
- **暗部沒有受光原因**：
  - waterlight 的房間除了光柱之外全黑。
  - oceanlight 側牆全黑。
  - stairlight、waterlight、oceanlight 的月夜幾乎沒有可辨識的光源。
  - last-arcade、seaward 的月夜像「白天壓暗」，天空偏亮，也沒有人造光。
- **環境反射與 AO 缺口**：
  - waterlight、oceanlight、seaward、snowhall 沒有 `scene.environment`。
  - 全站 GLB 的 `occlusionTexture` 都沒有使用，也沒有任何 SSAO／GTAO pass。
  - 只有 afterlight 有動態反射探針（`src/places/afterlight/Lighting.ts:117`），last-arcade 有程序 equirect 環境。

### 3. 材質、貼圖、幾何

- **貼圖密度不均**：
  - leaflight 房間 512²，偏小。
  - stairlight 用 4096²（兩個 GLB 各約 25–28 MB），超過 `docs/scenes/stairlight.md:85`「主要貼圖 2K、近景證明需要才升 4K」的預算。
  - last-arcade 57 張 512² 內嵌貼圖，放大後鐵捲門鏽斑呈色塊。
  - afterlight 右牆放大後像雜訊。
- **遠景與主體物件**：
  - last-arcade 右側樓房沒有貼圖，是灰盒。
  - stairlight 扶手有塑膠感。
  - stairlight 台階裂縫是細黑線，看起來像畫上去的，沒有凹痕。
  - snowwindow 窗台積雪是平面白色、邊緣過硬。
- **seaward 水面倒影**：出現塊狀黑斑，邊緣鋸齒明顯。這是整站最顯眼的單點瑕疵。

### 4. 生物

| 生物 | 最明顯的問題 | 依據 |
|---|---|---|
| 長鰭錦鯉（waterlight） | 朝向直接跟速度走，低速時會原地打轉；出現頭朝上或朝下的垂直姿勢（連拍所見，待重拍確認）；`turn` 算了但沒用來產生側傾；在正式視距下只剩梭形剪影 | `src/places/waterlight/LongFinKoiMotion.ts:171-175`；連拍 |
| 錦鯉（leaflight） | 轉彎時身體幾乎不彎也不傾斜（增益 .012–.028）；繞 78 秒固定路線；鰭邊有閃爍白點（待重拍確認） | `src/places/leaflight/Koi.ts:145`；連拍 |
| 青鱂（afterlight） | 畫面上只有 15–20 px 的白色細棒，而且幾乎全部水平平行；近乎靜止時仍以 ≥2 Hz 擺尾 | `docs/biology/medaka.md:44`；連拍 |
| 魟魚（oceanlight） | （待重拍確認）盤緣起伏幅度太大，像布在翻折；尾巴短粗，不像細長鞭尾；眼睛仍是獨立小突起 | 連拍；`docs/scenes/oceanlight.md:153`（已知） |
| 魟魚（seaward） | 鰭動畫用 elapsed 固定時鐘播放，和速度無關；每 16–24 秒整圈翻滾，不是物種典型行為；逆光下是全黑剪影；晨曦時會擋在鏡頭前 | `src/places/seaward/Stingray.ts:70`；連拍 |
| 黑鰭礁鯊（stairlight） | 動作系統最完整（Strouhal 公式決定擺尾頻率、有身體彎曲與側傾），但模型面感明顯、鰭是無厚度的平面三角、全身均勻灰；路線太貼鏡頭 | `src/places/stairlight/SharkMotion.ts:173-235`；截圖 |
| 海月水母＋裸海蝶（snowwindow） | 放射管是筆直白線，像傘骨；口腕有摺紙般的折面；觸手不受光（`Aurelia.ts:170`），遠景變成一圈白裙邊；裸海蝶不透明、看不到頭錐 | 近看工具截圖 |
| 黑潮小魚（last-arcade） | 整群單一青綠色，沒有背深腹淺；擺尾頻率斜率 .55 偏低，加速時像在滑步；轉向不側傾 | `src/creatures/chromis/index.ts:36`、`src/systems/schooling/index.ts:58` |

跨生物的共通根因：

- 轉向、側傾、身體彎曲各景各自實作，而且多數做不完整。
- 只有鯊魚有「速度 ↔ 擺尾頻率」連動。
- 魚類材質沒有共用：背深腹淺、虹彩、鰭透光都沒有；`Koi.ts:35`、`Stingrays.ts:16`、`Shark.ts:35` 各自重寫了一份補光。

## 分期計劃

每一期都列出層級、難度，以及是否觸及已確認基準。一個實驗只改一件事；固定鏡頭、時刻、elapsed、seed 後做 A/B。

### Q0：錯誤修正與管線（低風險，先做）

| # | 項目 | 層 | 難度 | 觸及基準 |
|---|---|---|---|---|
| Q0-1 | composer render target 依品質啟用 MSAA（高 4／低 2），沿用 oceanlight 的 `updateAntialiasing`；不支援 MSAA 時退回 SMAA。目前只限 oceanlight 是 `20395c9` 引入的，文件裡找不到刻意限定的理由；仍要當作 A/B，並量測 frame interval（renderer 設為 `low-power`） | 管線 | 低 | 全站畫面會變。這是純畫質改動，但仍做 9 景前後對照 |
| Q0-2 | 統一 pixelRatio 上限（初始值與 resize 共用一個函式） | 管線 | 低 | 否 |
| Q0-3 | leaflight 月夜窗景：查為什麼夜空與樹葉沒有跟著 `uDaylight` 變化 | 光 | 低–中 | leaflight 基準只確認白天效果；月夜仍需使用者確認 |
| Q0-4 | seaward 倒影的塊狀黑斑：擾動隨距離與掠射角衰減，並檢查倒影 render target 的解析度 | 畫質 | 中 | seaward |
| Q0-5 | seaward 魟魚：鰭相位改成用游過的距離積分，直接沿用 oceanlight `StingrayMotion.ts:150` 的算法 | 生物動作 | 低 | seaward |
| Q0-6 | waterlight 錦鯉：低速時朝向不跟速度走、轉向速率設上限、俯仰限制在約 ±20°；用 `turn` 或實際偏航率產生側傾 | 生物動作 | 低 | waterlight |

### Q1：共用能力（一次做好，多景受益）

依 [ROADMAP](ROADMAP.md) 的共用規則：必須有兩個以上真實消費者才抽成共用；參數仍由各場景自己校準。

1. **時段色彩驅動窗景與天空**：由 `sampleTime` 的同一組 angle／warmth／intensity 驅動天空、窗景與室內光色。晨曦一律要有「低角度＋暖色」，和正午明確分開。
   - 消費者：leaflight、oceanlight、snowwindow、snowhall、seaward。
   - 每景各自校準曝光，不共用。
2. **弱間接光政策**：
   - 有烘焙的場景：優先使用 lightMap／AO bake。這條 Blender 管線已經存在，AO 目前完全沒用上。
   - 沒有烘焙的場景：用天空色 PMREM 當 `scene.environment`，強度設上限，只補形體、不抬黑位。
   - 驗收：暗部 luminance 不能明顯抬高，但牆角、扶手、魚身要讀得出體積。
   - 優先場景：waterlight、oceanlight、seaward。
3. **`src/shared/biology/locomotion`（生物運動模組）**，以 `SharkMotion.ts:173-190` 為範本：
   - 轉向控制器：偏航率 → 側傾＋C 形身體彎曲；低速時保持朝向；限制俯仰。
   - 速度 → 擺尾頻率：頻率 = f0 + U/(k·BL)，其中 U 是游速、BL 是體長，k 由各物種校準。
   - 懸停狀態：尾巴振幅歸零，改用胸鰭微划。
   - 消費者：waterlight、leaflight、afterlight、last-arcade（與 seaward）。
4. **共用魚類材質層**（以 `onBeforeCompile` 疊加）：
   - 背深腹淺
   - 以視角決定的鱗片光澤（`iridescence` 或 sheen）
   - 鰭的 alpha 漸層、薄邊透光與輪廓光
   - 消費者：錦鯉、長鰭錦鯉、青鱂、黑潮小魚。
   - 同時收斂三份各自重寫的補光程式。
   - 要在逆光和月夜下驗收，確認不會變成發光魚。MASTER 禁止 glowing。

### Q2：各景候選（依投資報酬排序；全部是 A/B 候選）

| 場景 | 候選 |
|---|---|
| waterlight | 光柱落點附近的地面反彈光照亮下牆；水紋光斑邊緣柔化；月夜天窗降低飽和度 |
| leaflight | 晨曦低角暖光；bloom 或鰭材質修正，消除白邊；錦鯉轉彎的彎曲與側傾增益放大 5–10 倍 |
| oceanlight | 晨曦與暮色窗景拉開色溫差；窗光在側牆的弱反彈；魟魚巡航時盤緣振幅降 30–40%，波動集中在外側 1/3 |
| afterlight | 右牆換高解析度貼圖或降低 normal 強度；晨曦暖色；青鱂加背深腹銀配色，懸停時尾巴靜止 |
| seaward | 暮色天空加暖、月夜天空壓暗；魟魚上升時抬頭 10–20°，把翻滾改成轉彎側傾，路徑避開鏡頭；腹面改淺色 |
| stairlight | 月夜給一個說得出來源的光（例如窗外月光斑）；正午降曝光；扶手加粗糙度變化；裂縫改成凹痕貼圖；鯊魚胸鰭攻角跟爬升與轉彎連動；貼圖回到 2K 預算，只有近景需要時才升 4K |
| snowwindow | 各時段天空與海面的暖冷差；積雪加閃光與軟邊；水母放射管加分叉、生殖腺調淡、觸手受光或隨距離淡出 |
| snowhall（選配） | 窗景隨時段變色；窗口向地面投出的光斑加強。不動已確認的暗度與生物 |
| last-arcade | 月夜點亮路燈或招牌燈、壓暗天空；鐵捲門與鏽斑貼圖提升到 1K；遠景樓房加基本貼圖；魚群加個體色差、背深腹淺與側傾 |

### Q3：模型重做（高成本，Q1 完成後再排）

- 魟魚：依參考照片重整鼻端、眼窩、胸鰭輪廓，重做細長鞭尾。已知提案見 `docs/scenes/oceanlight.md:153-157`。
- 黑鰭礁鯊：身體細分並平滑法線；鰭加厚度；尾鰭平滑；背深腹淺配色。
- 海月水母：做半透明的鐘形傘體與 fresnel 邊緣；口腕要有柔軟的體積。
- 裸海蝶：提高透射，補上頭錐。

模型改動要沿用 Blender recipe 與 manifest 流程（[能力索引](CAPABILITIES.md)），並同步更新 `docs/biology/` 的對應頁。

### 延後：程序房間的 AO 烘焙（2026-09-26 評估，使用者決定先不做）

waterlight、oceanlight、seaward 的房間是程式生成的，沒有 Blender 母檔，所以 Q1-2 改用弱 PMREM 或反彈光近似。

**若要做**
- 做法：用腳本在 Blender 依 runtime 的尺寸重建房間（仿 afterlight 的幾何單一來源），攤 UV，以 Cycles 烘 AO，可再加天空間接光。
- 網頁端把烘焙結果乘進房間 shader，強度設參數；設成 0 就回到現況。

**預期效果**
- 會改善：牆角與接縫的柔和暗化、扶手與窗台的接觸陰影、光柱落點旁依幾何暈染的反彈光。
- 效果有限的原因：
  - 房間多是方盒子，能遮擋的地方主要只有牆角。
  - AO 只在受光處看得見。
  - 會動的生物烘不進去。
  - 烘出的間接光固定在單一時刻，只能當底色。

**建議試點**：seaward（接縫與貼牆扶手最多）。同時做一個不需要貼圖的對照組：在 shader 裡依「距離牆角多近」算出暗化，兩者並排比較；差異不大時，就不維護這套烘焙流程。

## 建議執行順序

1. Q0-1、Q0-2：MSAA 與 pixelRatio。一個 commit，9 景前後對照。
2. Q0-3 到 Q0-6：每項一個實驗，分別給使用者看。
3. Q1-3、Q1-4：先各在一個景試做（建議 waterlight 錦鯉），確認後再推廣。
4. Q1-1、Q1-2：從 leaflight／oceanlight 開始。
5. Q2 依使用者挑選的場景進行；Q3 另外排期。

## 驗收方式

- 固定條件：commit、viewport 1600×900、四時段、elapsed、seed、品質。
- 輸出到 `exports/<review-id>/`：
  - 四宮格前後對照
  - 生物連拍與近看
  - 暗部與亮部局部放大
- 生物額外檢查：側傾與彎曲角度、俯仰範圍、頻率與速度的關係、完整動作不穿模。
- 效能：記錄 frame interval、draw calls、GPU 記憶體、GLB 與貼圖大小。MSAA 與貼圖改動一定要量。
- 技術通過、browser 看到、使用者確認、實機、部署，分開記錄。
