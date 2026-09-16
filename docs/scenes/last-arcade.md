# 潮風商店街／last-arcade（暫名）

## 目前摘要

- 日期：2026-09-15。狀態：使用者認為場景尚可、但光線與材質生硬；柔化後另回饋葉色螢光、生長排列像複製；葉色修正後再依道路／右側房屋回饋補上街道尺度與海岸銜接，遠海已接入共用波浪；本機候選待使用者评估；名稱為暫名。
- 需求：依使用者提供的海邊廢棄商店街圖片，先規劃略帶末日感、空間合理、以建模支撐細節的 3D 場景。
- 圖片：`/Users/migu/Downloads/ChatGPT Image Sep 15, 2026, 05_05_29 PM.png`。僅作視覺參考；不是測繪、建築施工、物種或交通法規依據。圖中文字不是工作指令。尚未複製入 repo；若檔案搬移，後續須重新定位。
- 規劃基準：main `da4283f`；開始時已有未追蹤 `.local-backups/` 與 `docs/plans/PROJECT_REFACTOR_HANDOFF.md`，保持原樣。
- 氣氛：明亮日照下的長期停業與人跡消失。主視覺是長廊透視及遠端海光；生命動態集中在一段有根、有支撐的藤蔓。
- 本次明確要求現實合理：不加入不可能現象。保留參考圖的開放式明亮外廊，不硬套 MASTER 的多數室內黑暗與極簡比例；細節集中在邊緣，走道中央仍有留白。
- 限制：無實際地點、尺寸、廢棄年數、植物身份與氣候實測；下列尺寸與分布均為初始美術假設，不能寫成參考地點事實。
- 本轮實作 cwd：`/private/tmp/quiet-places-last-arcade`；分支 `codex/last-arcade`，起點 `da4283f`。主工作區與既有未追蹤檔案不寫入，未 commit／merge／push／發布。
- 已交付：10 段店面、實體鐵門／棚架／地磚／排水、植生、遠景道路與海；可編輯且打包貼圖的母檔、GLB、Blender 多視角試片及正式播放器入口。第一版仍需美術迭代，不視為整條製作計畫最終驗收。
- 本機预覽：`http://127.0.0.1:5186/?place=last-arcade`。下一個美術重點：分散柱間植生的規則感、加強局部破損的非重複性，校準網站間接光與細小陰影；手機窄直幅右側棚架裁切較多。

## 1. 空間與鏡頭

以公尺建模，Blender 母檔 Z-up；匯出時統一轉換到網站座標，避免 GLB 及 runtime 重複旋轉。建議原點放鏡頭附近地面，+Y 沿長廊、+X 朝道路；先以一公尺測試物驗證往返尺寸及方向。

| 項目 | 灰模起點，非實測 | 檢查方式 |
| --- | --- | --- |
| 人眼高度 | 約 1.6 m | 與鐵門、扶手、柱腳比較，避免玩具比例 |
| 走道淨寬 | 約 2.5–3 m | 柱、植生、招牌不侵入主要通行帶 |
| 店面模組 | 面寬約 3–3.6 m，先排 6–8 間 | 先固定主消失點，視構圖延伸遠段 |
| 檐下高度 | 約 3–3.4 m | 天花、外棚高度及受力接點可連續追蹤 |
| 鏡頭 | 約全片幅等效 28–35 mm 的試驗範圍 | 固定 sensor fit，分別校對直幅與橫幅 FOV；不是判定原圖焦距 |

先保留左側鐵門與店招、上方深長棚架、右側立柱及街道、遠端海面。海面放在合理的街尾開口外，補出道路／岸邊過渡，不能直接貼在走道末端形成藍色牆面。地平線需與眼高及地形一致。

預設站定、有限度轉頭；不預設整座自由漫遊城鎮。仍須補鏡頭側面及後方可見範圍，並在允許的視角邊界測試。首批至少比較原圖直幅 1086×1448、桌面 16:9 及手機直幅；橫幅露出的道路與店面側向空間必須真的存在。

## 2. 建模細節分配

原則：影響輪廓、厚度、遮擋、接觸或近景投影的部分用 mesh；微小粗糙與色斑才用貼圖。白模在斜光下也必須有體積，不能依賴一張廢墟照片支撐整景。

| 元件 | Blender 建模責任 | 貼圖／遠景簡化責任 |
| --- | --- | --- |
| 鐵捲門 | 有截面的門片陣列、側導軌、底樑、門盒、把手；近處少量局部凹折 | 退色、細鏽與擦痕；遠段可把門片細節烘焙至 normal |
| 店面牆體 | 樑柱、門洞深度、磁磚收邊；近處少量缺角及剝落厚度 | 磁磚細縫、髒污與細裂紋，不逐片製造大量獨立物件 |
| 天花與雨棚 | 店面平頂與外側弧形棚分開；立柱、弧肋、縱向檁條、接板及近景螺栓；波板起伏、厚度、搭接及少量缺片 | 細腐蝕、漆面剝落；遠端螺栓以貼圖處理 |
| 排水 | 檐溝、落水管、支架、彎頭、地面排水去向 | 水痕必須對應接縫／溢流位置 |
| 地坪 | 前景鋪磚實體倒角與局部沉陷、路緣、樹根頂起的小區域；底下有連續基底 | 中遠景合併平面及 normal；不讓每塊磚獨立亂轉、形成碎石路 |
| 招牌／路牌 | 板厚、框邊、吊架、背面固定帶與螺栓 | 文字另做可校對圖稿；不直接重製參考圖可能失真的圖示或字形 |
| 欄杆／管線 | 連續彎管、接頭、固定腳、管夾；看得出如何施工 | 磨損和腐蝕分布依材質處理 |
| 藤蔓 | 根點、貼附的主莖、分枝、葉柄；近景葉片有彎曲與輪廓差異 | 中遠景葉群可用 alpha-cutout；避免大片交叉平面露餡 |
| 雜草／落葉 | 依磚縫和泥土堆積區生成草叢；近景落葉有捲曲、疊放與接地 | 遠景小碎屑烘焙或合併；不在中央平均撒滿 |

先做一個約 3 m 店面樣段，含鐵門、立柱、檐口、地磚、排水與一簇植物。樣段過關後以模組及實例延展；在門寬、閉合狀態、缺片位置和藤蔓路徑做少量結構變體，避免一條街複製同一塊鏽斑。

## 3. 合理性規則

### 建築

- 每根弧肋有支座，棚板有檁條支撐，立柱接地；不能把生鏽弧線懸在空中。
- 磚塊、塗層、薄板與混凝土的破損方式分開。首版保持主結構完整，以表面老化與少量非承重缺損表現荒廢，避免需要結構工程判讀的大面積倒塌。
- 排水坡向外側溝渠；積水僅出現在可解釋低點。天花污漬須能連到屋頂接縫或滲漏點。
- 路牌用途、朝向與道路一致；首版可減為一至兩面，若採用真實日本交通標誌須另查官方圖樣與設置依據。圖片中的重疊方式不直接當正確施工依據。

### 植生

- 為每簇植物指定土壤／磚縫根點、攀附面與可行路徑，再沿莖放葉；不得在天花或光滑牆面任意撒葉。
- 首版只做少數形態族群，例如一種攀緣葉形與兩種低矮草形；未核實時標「造型近似」，不宣稱真實物種生態。
- 藤蔓穿行屋頂只經實際破口或邊緣；懸垂莖保有連接，葉片避开牆面及彼此嚴重穿插。
- 以邊角、排水出口與積土帶形成斑塊；保持中央大部分可走，避免整面平均綠化。

### 老化與氣氛

- 先畫遮雨、漏水、日曬與接地區域，再決定污漬；不是所有材質套同一張 noise。
- 鋼件裸露區可有鏽，混凝土一般污漬不冒充金屬鏽；鏽水若落到混凝土上，須有上游金屬來源。
- 以接縫、螺栓、刮傷附近的局部變化起步，控制大小層次與垂直流痕方向；不從單張圖推斷精確廢棄年份。
- 安靜末日感由連續關閉的店面、停止維護、落葉與被植物接管的邊緣成立；首版不加入血跡、武器、火災、末日道具或大量瓦礫。

## 4. 光、材質及動態

- 主光先設右側斜入的自然日照，由柱、藤葉、棚架投影形成縱深；實際太陽角度以灰模陰影校準，不在未知地理方位下宣稱特定時刻的真實太陽位置。
- 暗部由開放道路側的天空與反射光維持體積，長廊內側合理較暗。保留亮地面、較暗門面及少量海天藍，不把外廊壓成黑色室內。
- 棚板缺口才形成天光條帶；缺口位置、太陽方向及地面光斑一致。預設清澈空氣，不用濃霧或可見光束補救深度。
- 粉刷、氧化層與裸金屬分別設定 PBR；鏽不直接當發亮金屬。base color 不畫死日照；normal 控細孔，真實倒角負責近景掠射光。
- 第一輪先固定一組日照，不同時擴展雨天／全日照 GI。網站後續時刻適配需另驗，不承諾固定烘焙能適用所有太陽位置。
- 風共用方向，但依遮蔽、枝條及葉柄分層延遲；根部與附著主莖保持穩定，末梢緩動，偶爾陣風。不讓整株像海草、所有葉片同頻搖擺。
- 葉片位置和陰影使用相同變形、時間、seed；pause 同時停住。動態屬程序近似，不宣稱植物力學求解。
- 海只佔遠端小部分；需要時沿用既有波場概念並針對尺度適配，不為遠海引入不必要的大型水體模擬。聲音留待後續確認來源與授權。

## 5. Blender → 網站

1. 保留可編輯 `.blend`、生成腳本與固定 seed；幾何尺寸收在單一設定入口，製作時才建立正式檔案與指令，不把預定路徑當現有資產。
2. Blender 使用模組、曲線及程序分布製作；匯出副本轉成可支援 mesh，保留母檔的非破壞編輯能力。先用樣段實際測試，不假設 Geometry Nodes、instances、動態或 shader 全部自動保留。
3. 標準 PBR 材質走 GLB；程序材質依需要烘焙成圖像。glTF 材質與 Blender 節點不是一對一通用互換，參考 [Blender glTF 官方手冊](https://docs.blender.org/manual/en/4.0/addons/import_export/scene_gltf2.html)。此為格式原則來源；正式製作時另記錄本機 Blender／exporter 版本並實測。
4. 前景保留真幾何，中景合併重複材質與物件，遠景降低截面／葉片數；依屏幕投影大小決定細節。LOD 在允許的最近觀看距離仍須保有輪廓；不把所有葉子都做獨立 draw call。
5. 風動若在網站重建，保留枝葉權重／識別資訊；先驗證 GLB 往返仍存在，再接入 shader 與 shadow pass。實例減少 draw call 的效果須在 runtime 量測，不能由 Blender 中使用 Array 就推定成立。
6. 直接光與動葉影留給 runtime；烘焙間接光須記錄內容、UV、色彩空間及適用時刻，避免和動態直射重複計入。Blender 與 Three.js 各做同鏡头試片，檢查曝光、法線、透光葉片及陰影差異。
7. 經現有 `src/places/metadata.ts`、`catalog.ts`、`src/player/contracts.ts` 接入，沿用播放器 elapsed／dispose。已核對 `src/shared/resources/ModelResources.ts`、`src/shared/math/seededRandom.ts` 存在；植被候選入口 `afterlight/PlantGeometry.ts`、`PlantPhysics.ts` 與 `assets/blender/scripts/afterlight_plants.py`、`afterlight_weeds.py` 尚未深入驗證適用性，不能宣稱可直接換皮復用。
8. 先量樣段再訂整景預算：記錄三角形數、draw calls、貼圖／GPU 記憶體估計、載入量和 frame time。暫以桌面 60 fps、手機 30 fps 作候選目標，測試時必須指定裝置、解析度與品質；無實機資料不保證達標。

## 6. 分階段交付及停止條件

| 階段 | 可檢視成果 | 往下做的條件 |
| --- | --- | --- |
| A 空間灰模 | 正式站位直幅／橫幅、俯視及側視圖，棚架受力及排水示意 | 人尺度、透視、海平線、鏡頭邊界成立；比例錯誤先修，不先加材質 |
| B 近景樣段 | 一個完整店面 `.blend`、白模掠射光、PBR 試片及 GLB browser 比較 | 鐵門有截面、柱腳接地、磚有層次、接點合理；匯出失真先處理 |
| C 整段建築 | 延展模組、路側及海邊過渡、局部老化遮罩 | 看不出整排同一破損圖樣，缺損可解釋，主走道清楚 |
| D 植生與風 | 根點／攀附檢視、靜態與短動態試片 | 無懸空莖葉、嚴重穿插、同步擺動；動態陰影一致 |
| E 光照與網站 | 同鏡頭 Blender／browser 圖、場景切換及暫停、桌面／手機效能紀錄 | 視覺差異可解釋，效能與可轉頭範圍達成約定；時段功能另驗 |

最先看的成果應是「灰模 + 有細節的一間店」，讓構圖與建模品質都可判斷。每階段保留固定基準後再改下一類變因；不先花大量時間鋪滿整街植被。

## 驗收與紀錄

- 重現條件：固定相機 position／target／FOV／sensor、viewport、曝光、太陽方向、品質、建構 seed、elapsed 及資產 hash。設定尚未實作，當前均為待填。
- 靜態：白模斜光、材質球、全景、店面／柱脚／葉柄近照，必要時線框；每個物件的懸掛、接地、受光能解釋。
- 空間：允許的左右轉頭／俯仰邊界及橫直幅，檢查背面、破洞、幾何終點與海天接合。
- 動態：風、葉影、pause／resume；未烘焙時刻不能拿舊 GI 當完整驗證。
- 程式接入後：`npm run check:project`、`npm test`、`npm run build` 及受影響 browser 檢查；桌面／Simulator／實機／使用者確認／發布分開記錄。
- 規劃階段的未驗證狀態已由下方本輪實作紀錄更新；使用者美術確認、實機效能與發布仍未驗證。

## 歷史與實驗

- 2026-09-15：建立規劃。優先保留真實建築與自然日光；指定以幾何做近景細節，先做單店樣段降低整街返工。無實際 A/B 實驗，尚無使用者採用結果。


## 2026-09-15：第一版實作及證據

### 可重建入口

- 幾何權威：[建築生成器](../../assets/blender/scripts/last_arcade.py)；公尺，Blender Z-up，匯出自動轉為 Three Y-up。
- 固定 seed、相機、太陽及 render 設定：[last-arcade.json](../../assets/config/last-arcade.json)。站位 `(1.12,-1,1.62)`，看向 `(-1.8,16,1.25)`，vertical FOV 62°；相機朝左使長廊消失點偏右。這是美術取景，不是圖片測繪。
- [植物生成器](../../assets/blender/scripts/last_arcade_plants.py)：原創未命名攀緣葉形與草形，不宣稱特定物種。
- [Blender 母檔](../../assets/blender/last-arcade.blend)已 pack 貼圖；原創程序貼圖同時保留於 `assets/blender/last-arcade-textures/`。沒有下載第三方模型／貼圖；招牌 SHIO STORE 為自擬字樣，非實際店名或交通標示。
- [網站 GLB](../../public/models/last-arcade.glb)、[runtime](../../src/places/last-arcade/index.ts)；metadata／catalog 已註冊。原有場景本體未修改。
- Blender 5.1.2，主 build 在獨立背景程序執行。此環境 sandbox 的 Metal 初始化會 crash；允許的 elevated background run 已成功，不動使用者互動中 Blender 場景。

```sh
cd /private/tmp/quiet-places-last-arcade
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/blender/scripts/last_arcade.py -- --views hero,gray,wide,detail,structure
npm run dev -- --port 5186
```

只重建資產可用 `--no-render`；`--no-plants` 僅供建築分項試驗，不能把該輸出冒充完整候選。執行完整生成後，[manifest](../../exports/last-arcade-review/manifest.json)記錄版本、seed、來源與 GLB／母檔 SHA-256。

### 模型與光路

- 門片為封閉折板截面，有導軌、底樑、把手；近處數片小凹折。磚面在連續底板上，前中景均保有幾何倒角與接縫。支架、波板搭接／缺片、落水管、柱腳、螺栓與欄杆皆為 mesh。
- 規劃的單店樣段驗收後已延展到10段，延展仍是第一版模組，局部破損與植物路徑的自然差異尚待精修。
- Blender 使用太陽、開放天空及 Cycles 間接反射。網站以動態 DirectionalLight + HemisphereLight 近似，不含烘焙 GI；網站與 Cycles 受光不完全一致，不能把 Blender 圖當網站截圖。
- 色圖由線性反射率轉 sRGB，normal maps 為 Non-Color。最初漏做色彩轉換導致過暗；已改。最初門片面向及棚板縫也已修正。
- shader 葉端位移約 0.6–1.6 cm，根點權重0。Blender opaque glTF 會捨棄頂點色 alpha，因此另輸出 `_ARCADE_WIND` FLOAT scalar；GLTFLoader 讀成 `_arcade_wind`，缺失會拒絕並釋放模型。RGB 與透明度分離，避免葉根消失。
- 風色彩／depth／distance shadow 共用位移公式與 elapsed，world 風向轉回 mesh local；葉片法線仍為小幅變形近似，非完整彈性求解。遠海只有細微法線擾動，非海水動力模擬。
- 時刻直接消費播放器的連續 state；沒有第二層 dt 緩動，固定 hour／elapsed 可重現，暫停中仍可切時刻。高品質4096陰影，低品質1024；細線陰影與漏光仍有即時 shadow-map 限制。

### 目前資產量與檢查

- 最終 Blender 51個 mesh（文字另計），229,284 triangles；植物1,764片藤葉、66草叢／662草葉、328落葉，96,806 triangles。網站含轉 mesh 的字形共52 draw calls、231,524 triangles；GLB 25,832,468 bytes。
- `npm run check:project` 通過；`npm run build` 通過，保留現有 Three.js >500 kB chunk 提示。
- `npm test` 146/146通過；之後補上缺風權重拒絕時的釋放案例，專屬 `tests/last-arcade.test.ts` 4/4通過。測試 log 在 `exports/last-arcade-review/`。
- [真 GPU 驗收頁](../../tests/last-arcade-gpu.html)及[結果](../../exports/last-arcade-review/gpu-result.json)：12類檢查通過，涵蓋真 GLB、地坪／店面射線、道路開放、風權重、動態陰影材質、暫停同像素、日夜差異、風差異、實體陰影、低品質與釋放。
- 同 hour／elapsed 重畫像素差異0；釋放後 geometry=0、texture=1回到測試 render target 基準，非所有應用程式記憶體均為0。
- GPU頁採384×512，frame submission數值不代表GPU完成時間或實機fps。桌面／手機60／30fps目標仍未有實機證據。

### 視覺證據與未完成項目

- Blender：[直幅](../../exports/last-arcade-review/hero.png)、[白模](../../exports/last-arcade-review/gray.png)、[橫幅](../../exports/last-arcade-review/wide.png)、[近景](../../exports/last-arcade-review/detail.png)、[結構俯視](../../exports/last-arcade-review/structure.png)。固定32 samples、AgX、exposure .25；直幅768×1024，橫幅1280×720。
- 網站：[1280×720](../../exports/last-arcade-review/browser-wide.png)、[390×844](../../exports/last-arcade-review/browser-mobile.png)。直幅是browser viewport，非iPhone實機。窄畫幅右側棚架及道路裁切較多，列為下一輪取景調整。
- `a0/` 保留過暗色圖／過大板縫初稿；`a1/`保留規則羽毛狀枝葉；`a2/`保留橫葉過多候選。最後改短葉柄與較多垂葉，仍保留同一柱面根點。這是主agent試片取捨，尚未由使用者接受。
- 尚未完成：相片級破損／材質細修、植生更不規則的橫向攀附與檐口垂掛、網站GI精修、完整資產壓縮／LOD、手機實機與使用者美術驗收。没有提交／合併／發布。


## 2026-09-15：光照與材質柔化

使用者回饋：整體光線與材質生硬、CG 感略重。本輪保持構圖、建築尺寸、植物幾何與風幅，調整表面與間接光。詳見 [固定鏡頭實驗](../production/experiments/2026-09-15-last-arcade-softness.md)。

- 光路權威：[Ambient.ts](../../src/places/last-arcade/Ambient.ts) 及 [runtime](../../src/places/last-arcade/index.ts)。加入原創天空／地面環境輻射圖，沒有日輪或烘焙太陽影；環境 diffuse 與微弱 specular 提供方向性。道路兩個向上 RectAreaLight 近似反射光，棚下漸層變暖。它們無遮擋解算，不是完整 GI。
- [遮蔽生成器](../../assets/blender/scripts/last_arcade_occlusion.py) 從實際建築 BVH 計算每頂點 `_ARCADE_AO`、`_ARCADE_SKY` FLOAT；AO 6 rays／0.48 m，天空 4 rays／7.5 m，offset 0.012 m。只衰減 ambient，direct sunlight 與動葉陰影仍即時更新。共享頂點、有限 rays 與低頻 interpolation 是近似，不適合作為精確照度。
- 鐵漆、腐蝕、石材分離 roughness maps；漆與鏽保持 dielectric，僅小面積裸金屬有 metallic map。微法線強度降至0.34；UV 密度按材質分開。全部原創程序圖，無新增外部素材。
- 曝光1.08；環境、半球與道路反射依既有時間淡入淡出。反射強度及 PCF radius2.5 是美術／即時近似值，不能換算為真實光源角度。shadow normalBias0.0015 m；高4096／低1024。
- [本輪資產 manifest](../../exports/last-arcade-softness/manifest.json)：GLB 21,899,904 bytes，模型幾何不變。WebGL 53 calls／231,536 triangles，包含新背景 cube 的1 call／12 triangles。
- 技術驗收：全套147/147通過；最後補強真 GLB 遮蔽欄位與有限範圍後專屬4/4通過。build、check:project 通過；保留現有 Three >500 kB chunk 提示。
- [WebGL 結果](../../exports/last-arcade-softness/gpu-result.json)：固定時間像素差0，日夜／風／陰影均有像素差；重複掛載後回到 renderer 暖機基準 geometry10／texture4。這些是 Three r180 的 PMREM、背景 cube、LTC lookup 與驗收 target，renderer.dispose 才終止 renderer 生命週期；不是把場景模型留在 scene。
- [調整前](../../exports/last-arcade-softness/baseline/browser.png)／[調整後](../../exports/last-arcade-softness/browser-after.png)：1280×720、14:00、elapsed12 s。Blender hero／wide／detail 同存本輪資料夾；它們不是網站截圖。
- 第一轮柔化改善棚下冷黑與漆面粗糙度；葉形、模組重複、局部鏽斑與光照仍有 CG 感，不宣稱相片級。使用者新版美術接受、手機實機和發布仍未完成。無 commit／merge／push。


## 2026-09-15：葉色與生長排列調整

使用者指出遠看葉子帶螢光感、生長像複製排列。保留上一輪全景光照、材質、相機與建築，針對植生修改；[生物製作頁](../biology/arcade-climbers.md)記錄本體与近似。

- 12組左右規律攀藤改為8株不對稱根、20條有連接關係的主／次枝。左側沿divider爬至上方立面再橫走，部分枝端垂掛；右柱保留長短不同的3株，其他柱留白。曲線在分叉點精確保留連接，右柱中心線投影至至少0.074 m半徑，避免鑽進柱體。
- 葉群沿弧長0.09–0.20 m取樣，以連續群聚段與裸莖段分布；選定密處才有小側枝。葉長0.045–0.115 m、局部成群；不再每節固定多葉團。這些是美術近似，非生長模擬。
- 成熟葉低飽和 palette 為主，次枝帶少量新葉與遠側枯葉；roughness0.82。真GLB寬葉線性頂點色G均值由0.379降至0.127；此數據不是渲染亮度或實測反射率。葉脊、曲面、葉柄皆保留建模。
- 葉片增加由建築BVH算出的 `_ARCADE_SKY`，4方向／7.5 m；runtime僅把 indirect diffuse乘以0.55–1的可見度係數。無 emission，未把太陽影烘入色圖。歷史GLB缺此欄位時以開放天空作比較fallback，正式資產測試要求欄位存在。
- 最終664藤葉、44草叢／314草葉、328落葉；植物37,496 triangles，全場Blender169,974，WebGL含字形／背景172,226 triangles、53 calls。GLB19,695,048 bytes；[manifest](../../exports/last-arcade-foliage/manifest.json)記錄hash、source及每株位置／高度／葉數。
- [真資產比較](../../exports/last-arcade-foliage/asset-check.json)確認47組建築position streams完全未變，葉色／天空可見度與風權重有限，葉根0／葉梢1保留。
- 同鏡頭 [調整前](../../exports/last-arcade-foliage/baseline/browser.png)／[調整後](../../exports/last-arcade-foliage/browser-after.png)：1280×720、14:00、elapsed12 s、曝光1.08。另有 [390×844 viewport](../../exports/last-arcade-foliage/browser-mobile.png)，不是手機實機；Blender hero/wide/detail同存本輪證據目錄。
- 初次442葉版本過稀，保留 [拒絕試片](../../exports/last-arcade-foliage/sparse-rejected.png)；改用664葉的局部側枝群聚版，不回到原先均勻滿柱的葉團。
- 全套147/147、build、check:project通過；[WebGL](../../exports/last-arcade-foliage/gpu-result.json)13類檢查含葉片天空可見度、風／日夜／陰影像素與重複釋放。固定elapsed像素差0，資源回到renderer cache基準10 geometry／4 texture。build保留現有chunk大小提示。
- 使用者新版美術接受、完整動態碰撞與實機效能未驗證；無commit／merge／push／發布。工作區仍為 `/private/tmp/quiet-places-last-arcade`。


## 2026-09-15：街道、對側房屋與遠海

使用者指出馬路和右邊房子不自然，並詢問遠海是否沿用其他場景。原本只是寬平面道路、重複盒狀房屋及兩個sin的海面法線；雖有PBR環境反射，沒有消費既有共用海浪。

### 空間與建模修正

- 數值權威：[street_context](../../assets/blender/scripts/last_arcade.py)。本輪尺寸為美術假設，非特定日本街道測繪或建築規範。
- 車行道X3.08–9.12，約6.04 m；路緣高程-0.145 m、路中心微拱高0.042 m。對側人行道寬約1.2 m、高程0 m；有獨立路緣、排水、薄修補面與嵌入式鐵蓋。淡邊線不代表已核实的交通標示。
- 街尾Y29.6–34.8接沿海道路，Y34.8–38.0為步道，海岸擋土及細欄杆位於Y38.02。海近端Y38.15、水位約-0.58 m；不再讓長75 m的路板延伸到海面上。
- 右側六塊建築基地有不同寬度、高度3.25–6.0 m及退縮。牆體按門窗孔洞拆成窗間牆／上下牆段，玻璃與門扇凹入約0.18 m；框、窗台、門檻、雨棚支架、屋簷、落水管均為mesh。窗玻璃仍是低成本不透明表面，沒有建立可進入的完整室內。
- 原商店街站位、左側商店、植生源碼與風幅保持；新對側量體會合理改變靜態天空可見度，已重算建築／植生遮蔽。

### 海面的實際共用與界線

- [Sea.ts](../../src/places/last-arcade/Sea.ts)現引用 [shared/water/Optics.ts](../../src/shared/water/Optics.ts) 的 `oceanWaveGLSL`／`oceanSlope`。這也是Oceanlight、Seaward使用的5個解析波基礎，沿用公尺／秒與播放器elapsed；不複製獨立時鐘。
- 法線由world XZ斜率轉view space混合0.42；MeshPhysicalMaterial採IOR1.333、metalness0、roughness0.22、環境反射0.9。線性底色(.033,.165,.193)在Blender來源定義，GLB輸出，網站直接讀取；不再額外疊色。
- 原GLB平面仍負責海面位置、地平線；網站這版是遠景法線波，沒有幾何浪高、破浪、泡沫、折射視線或完整流體求解。Blender有相同底色／粗糙度／IOR，但不執行Three的動態shader，不能把兩者試片當完全同一render。
- 不移植Oceanlight水／玻璃穿透後的室內焦散，也不搬入Snowwindow的雪天參數。沿用的是共用波浪與PBR方法，並非所有海景整套特效。

### 本輪驗收

- [前](../../exports/last-arcade-street/baseline/browser-after.png)／[後](../../exports/last-arcade-street/browser-after.png)：相機、1280×720、14:00、elapsed12 s、曝光1.08固定；[Blender結構圖](../../exports/last-arcade-street/structure.png)另驗空間銜接。
- [WebGL結果](../../exports/last-arcade-street/gpu-result.json)17類通過，新增實際路面／對側人行道高程、凹門與牆段射線、實際Physical水材質IOR、海面獨立視角的動態像素。海面12s／48s相差19,034像素；不能以此數字代替美術品質或實機fps。
- 暫停同時間像素差0；場景dispose後回到renderer cache基準geometry10／texture4。現61模型mesh，含背景62calls、187,870triangles；本輪母檔／GLB／sourcehash見 [manifest](../../exports/last-arcade-street/manifest.json)。
- 全套147項測試、build與check:project通過；build保留既有Afterlight JSON import attribute及chunk大小提示。未做手機實機、完整街道碰撞或使用者新版美術驗收，沒有commit／merge／push／發布。


## 2026-09-15：相機調整入口

- 使用者要求進入角度調整模式；沿用現有相機工具，入口 `/tools/snowwindow-camera/?place=last-arcade`，共享UI依query載入商店街、正確名稱、站位與注視點範圍。主播放器「更多設定 → 製作與輸出」也提供入口。
- 可調位置、注視點、FOV與時刻；本機草稿key和輸出JSON的placeId與雪景分離。預览直接使用prepareLastArcade；正式構圖須另行採用，此次未修改相機基準。
- 設定來源：`src/studio/SnowwindowCamera.ts` 的sceneId分流；沿用既有樣式與資源釋放。
- 本機build／check:project通過，browser已確認商店街載入、注視點滑桿更新及恢復基準；修正共享預覽canvas參與內在尺寸造成的resize回饋。


## 2026-09-15：使用者採用新預設視角

- 使用者指定網頁座標 position `(1.97,1.62,0.31)`、target `(-1.8,3.52,-16)`、vertical FOV62°，初始時刻12:00。參考viewport890×805僅記錄構圖，不鎖死網頁尺寸。
- [相機歷史](../../assets/config/last-arcade-camera-history.json)保留舊／新兩組網頁及Blender座標。上一版網頁 position `(1.12,1.62,1)`、target `(-1.8,1.25,-16)`、FOV62°。
- 正式權威last-arcade.json使用Blender Z-up；新position `(1.97,-0.31,1.62)`、target `(-1.8,16,3.52)`。Runtime與調整工具讀同一入口。回退時將history的 `original-2026-09-15.blenderCamera` 複製到config.camera，並同步母檔相機。
- 只採用鏡頭與新訪客預設時刻；已保存的個人時刻仍沿用原偏好。模型幾何與材質不變；GLB不匯出相機，無須重建模型。
- 驗收：Blender母檔相機與camera_target已同步；相機／偏好focused tests通過，build與check:project通過。Browser確認調整工具新座標、FOV62及12:00，已返回正式場景。未commit或發布。

## 2026-09-16：暮色橘黃夕照

- 基準commit `035553f`；沿用使用者相機、FOV62及曝光1.08。僅商店街14:30–19:00平滑進出暖色，17:30最強；正午等其餘時段維持基準。
- `src/places/last-arcade/index.ts` 將夕陽linear RGB漸變到(1,.57,.25)，日照方向垂直分量乘.62後正規化，讓夕照拉長；路面近似反光轉柔和金黃。這是美術時刻近似，不是實際經緯度太陽計算。
- `Ambient.ts` 背景近地平線轉#efbc83、天頂保留#8295b5冷色，以20階暖色權重更新。背景與固定環境反射分開，避免每幀重算PMREM；環境反射保留日間基底並沿用暮色亮度，並非完整日落天空光譜／GI。棚下冷色填光保留。
- Runtime改動，無需重烘焙Blender／GLB。瀏覽器17:30可見暖色鐵門受光與冷色地面陰影；待使用者美術確認。
- 驗收：4項場景測試、build、check:project通過；正式播放器17:30已目視確認。未commit／發布。
