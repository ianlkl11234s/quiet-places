# 潮風商店街／last-arcade（暫名）

## 2026-09-27：Q2-A2 月夜路燈、夜空、鐵捲門 1K、對側樓房（候選待使用者確認）

分支 `claude/visual-quality-split`。三小項可各自退回；晨曦／正午／暮色畫面的天空、牆與地面亮度前後差 ≤1.3（8-bit 亮度，含魚群動態）。

1. **月夜光源與夜空**（`src/places/last-arcade/index.ts` 的 `installStreetLamp()`、`night` 因子；`Ambient.ts` 的 `updateArcadeEnvironment(texture,dusk,night)`）
   - `night = 1 − smoothstep(daylight,.12,.38)`：23:00 為 1；06:30／12:00／17:30 為 0，這三個時段不受影響。
   - 兩盞一般住宅街的 LED 防犯燈，掛在既有電線桿（glTF x=9.52）z=−8 與 z=−21、高 4.7 m。SpotLight 16 cd（約 700 lm 等級的美術估值，不是實測）、decay 2、distance 22 m、半角 1.0 rad、penumbra .9，色 #f1d9b8（暖白、低彩度）。兩盞都有陰影：近燈 1024²、遠燈 512²，低畫質各 512²。白天燈的 intensity 為 0，陰影停止更新；燈始終留在場景中，所以時刻切換時 shader 的燈數不變。燈罩的 emissive 只在夜間為 1.6，代表燈具本身，不是讓物件發光。z=−21 的燈頭在預設視角可見；z=−8 的燈頭被棚架柱遮住，但照亮近處道路並投下欄杆的影子。
   - 夜空：天頂 #151d29、地平線 #2f3843、地面 #2a2824（低彩度藍灰）；夜間 backgroundIntensity 收斂到 1，environmentIntensity 收斂到 .9，避免被第二次縮放。月光方向沿用原設定，顏色轉為 (.66,.74,.86)，強度 ×(1−.45·night)；道路反光 RectAreaLight ×(1−.85·night)。
   - 發現的既有問題：Three 會快取背景 equirect→cube 的轉換，而且不看 texture version，所以既有暮色背景更新其實從未顯示在天空上（先前截圖的暮色天空仍是正午色）。本輪只在 night 階數改變時 dispose 背景，讓月夜天空能生效；暮色維持使用者已看過的樣子。要不要修正暮色背景，交由使用者另外決定。
   - 退回方式：刪掉 `installStreetLamp`／`streetLamps`；把 `night` 設為 0，或還原 Ambient.ts 的 night 參數。
2. **鐵捲門 1K**（`assets/blender/scripts/last_arcade_steel_1k.py`）
   - 評估：完整的 Blender 重建會連帶重寫幾何、植物、遮蔽權重與 packed .blend（.blend 不在本輪授權範圍），風險過高。改為只重新生成 `shutter`、`shutter-faded` 兩組 steel 貼圖（color／normal／metallic-roughness），並以純 Python 替換 GLB 內對應的 6 張影像；其餘 bufferView 逐位元組照搬。
   - 圖樣延續：沿用 `last_arcade.py` 的 numpy RNG 序列（包含 steel 用不到、但會推進序列的 512² grain）。`--check512` 重現現有 512² PNG 時，最大差 1/255（量化誤差）。1K 另外用獨立 RNG 加上鏽邊破碎（150–360 格）、鏽內深淺斑駁與點蝕；normal 梯度乘上 n/512，讓每公尺的起伏不變。鏽斑位置不變，只有邊緣和內部有了細節。
   - 資產：GLB 22,356,160 → 23,149,824 bytes（+3.6%）；6 張貼圖 512²→1024²，GPU 記憶體估計增加約 24 MB（RGBA8 含 mip）。原檔備份在 `exports/quality-q2-20260927/A2-A6-A9/backup-original/`（GLB SHA-256 `ff175319…`，新檔 `73ec9708…`）。
   - 退回方式：把備份的 GLB 與 8 張 PNG 複製回原位。
   - 限制：若日後用 `last_arcade.py` 做完整重建，會回到 512²。要沿用 1K，須讓 `material()` 對 shutter 改呼叫本腳本的 `steel_maps(..., 1024, detail=True)`；本輪沒有改主 builder，也沒有重跑 Blender。
3. **對側樓房**（`index.ts` 的 `installFacadeDetail()`，只作用在 `arcade-opposite-wall-0..2` 與 `arcade-distant-window`）
   - 世界座標程序 shader：每棟一種低彩度塗色（米、灰綠、象牙、灰），2.85 m 樓層帶與女兒牆帶，樓層帶和屋簷下方的滴流痕，以及 0–0.55 m 的濺水帶。albedo 乘數約 .78–1.06。
   - 窗玻璃依格子隨機呈現暗室、淺色窗簾（有細褶）或百葉三種。沒有 emissive，所以夜間不亮燈。棟別範圍抄自 `street_context()`，若日後改了 Blender 的 parcel，要同步修改。
   - 退回方式：刪除 `installFacadeDetail(root)` 那一行。

驗收：`npx tsc --noEmit` 通過；last-arcade 7 tests 通過（新增 1 項：白天燈 0、夜間有陰影與 decay 2、夜空輻射 <15% 日間）。全套測試 190 項中 189 項通過，唯一失敗是 main 上既有的 manta encounter 測試。`check:project` 通過。四時段截圖在 `exports/quality-q2-20260927/A2-A6-A9/before|after/last-arcade-*.jpg`，局部放大在 `after/crop-A2-*.jpg`（左為 before）。月夜 8-bit 亮度 before→after：天空 87.9→42.8（RGB (78,90,98)→(33,44,57)）、走廊地面 44.1→28.4、近處鐵捲門 23.2→16.1、對側牆 31.3→18.0、燈下道路 20.6→28.4、全畫面 1st percentile 5.0→4.1（黑位沒有抬高）。本機 browser 驗收，尚未經使用者確認，也沒有實機驗收。

## 本輪確認（2026-09-17）

使用者確認目前畫面 OK，授權提交：三隻連續拍翼鬼蝠魟、後方柱子周圍的 Fusilier、三處 Chromis、環境遮蔽與暮色反射同步、ミグ商店招牌與破布。鯨鯊僅保留共用模組，正式場景不啟用。最近魚群 600 s 避碰與 5 tests、build、check:project 通過；此為本機畫面確認與本地 commit，非發布。下方「未 commit」文字為各次調整當時狀態。

## 2026-09-17：較大魚群後移

Fusilier 群聚中心由 z=-5 m 移至後方柱子 z=-9.6 m，縱向繞游半徑由 3 m 收至 2.2 m；偶爾向遠處游出的偏移由 5 m 收至 3 m。初始魚群同步後移，避免先出現在鏡頭旁才游回目標。保留左右穿梭、自然高度變化、鬼蝠魟接近後躲入走廊及柱體避碰。近處三群 Chromis 不變。數值入口 `src/systems/schooling/index.ts`，網站 Y-up，單位 m。

## 2026-09-17：暫時移除場景鯨鯊

使用者希望降低畫面元素密度。正式商店街 adapter 只建立三隻鬼蝠魟與既有魚群；`ArcadeAnimalMotion(false)` 同時將鯨鯊排除在更新、避讓和碰撞計算之外，時間倒轉重建也沿用此設定。共用 `src/creatures/whale-shark/` 模組與模型檢視工具保留；Motion 預設完整模式仍可用於模型驗證。未 commit。

## 2026-09-17：鬼蝠魟拍翼短暫停頓修正

- 原因：`biology/Motion.ts` 每次拍翼跨週期時有 24% 機率插入 0.4–1.6 s 滑翔，頻率最多降低 97%，模型同時以 glide 壓低振幅，造成拍一下後近乎停住的節奏。這是程式的藝術行為設定，不是確認的瀏覽器掉幀。
- 取消鬼蝠魟短週期隨機滑翔，保留原頻率變化、相位連續積分、個體差異、路徑避讓與防穿模；鯨鯊滑翔不變。未宣稱生物學驗證。
- 新增 90 s / 60 Hz 取樣測試，檢查前三隻鬼蝠魟相位持續前進、沒有 GLIDE 事件、暫停可重現。連續拍翼測試與 900 s 動態回歸共 4 tests 通過；build、check:project 通過，預覽無 console error。未 commit。

## 2026-09-17：生物環境光、三處聚落與破布

- `biology/CreatureAmbient.ts` 為場景 adapter：以 24 個上半球方向、35 m 射線範圍對既有建築 proxy 計算天空可見度，另以附近表面距離估計 contact 遮蔽。每隻小魚取自身位置，大型生物取中心；6 Hz 取樣、0.45 s 平滑，保留直射 shadow map。這是動態環境可見度近似，不是完整 GI 或逐頂點光線追蹤。
- 生物環境反射強度改為與建築一致的 .38，間接 diffuse/specular 使用位置遮蔽；反射環境貼圖也跟隨既有暮色分段更新，清除舊 PMREM 快取，避免天空變橘但生物仍反射正午天空。
- `src/systems/schooling/index.ts` 的三處 Chromis shelter 中心（網站 Y-up，m）：招牌下 `(0.95,2.16,-4.05)`、近處門腳 `(0.68,0.42,-2.5)`、遠處柱腳 `(2.35,0.58,-17.6)`；保留個別 home 偏移、群游與鬼蝠魟接近後避入走廊的行為。
- `TornCloth.ts`：自行程序建模的兩片細分舊布，z=-6.4…-7.4 m，上緣固定 y=2.5 m，灰米色高粗糙材質，幾何破口與不規則下擺。CPU 更新頂點與 normals，投影使用同一變形，布料也套用棚下環境遮蔽。風是固定上緣的美術波形近似，不是布料求解器；最大外擺約 2.4 cm，與牆面保持淨距。
- 本機驗收：環境光、魚群、互動與陰影共 11 tests 通過；布料與環境光 4 tests 通過；build 與 check:project 通過。瀏覽器 GPU 17 項通過，dispose 回到 10 geometry / 4 texture 的既有快取基準；正午、暮色畫面另行檢視。未 commit、發布或實機驗收。

## 復原中的最新狀態（2026-09-16 晚間）

舊 `/private/tmp/quiet-places-last-arcade` 消失後，依本任務的原始程式紀錄與使用者規格復原。固定worktree為專案 `.worktrees/last-arcade-recovery`，分支 `codex/last-arcade-recovery`，基準 `50cfcf8`。恢復三隻鬼蝠魟、一隻鯨鯊、100隻Chromis、50隻Fusilier；沿用最後一輪鬼蝠魟形態及魚群降速版本，不改建築、相機或暮色。

下方原日期的驗收數字是历史紀錄；本輪重新驗收與備份位置以 `exports/last-arcade-recovery/README.md` 為準。

## 2026-09-17：店招文字

- 使用者指定把既有 `SHIO STORE` 改為「ミグ商店」。網站 runtime 在 `src/places/last-arcade/index.ts` 隱藏 GLB 的獨立 `arcade-sign-lettering` mesh（原材質 `arcade-sign-ink`），並於同一塊招牌中央加入透明 CanvasTexture 文字；不重建 `last-arcade.glb`。
- Canvas 優先使用 macOS `Hiragino Kaku Gothic ProN`，其次 `Yu Gothic`／sans-serif；文字層為 0.78 × 0.30 m，位在原 0.94 × 0.66 m 招牌範圍內。因此原本板材的鏽蝕邊緣、固定件與受光仍由 GLB 保留。Canvas 文字只是網站端字樣覆蓋，並非重新烘焙或材質掃描。
- 程式的 world 座標是網站 Three Y-up；此文字平面位於 `(0.75, 2.63, -4.553)` m，略在原字 mesh 的朝鏡頭一側。dispose 時會移除並釋放 CanvasTexture／平面／材質，且還原原字 mesh 可見性。


## 最新接入：2026-09-16 黑潮生物候選

暮色已提交 `50cfcf8`。目前生物入口與驗收以 [黑潮製作頁](../kuroshio-arcade-biology.md)／[參數證據](../kuroshio-arcade-parameter-evidence.md) 為準；下方保留先前建築製作歷史。已接入3隻鬼蝠魟、1隻鯨鯊與兩群小魚，沿用使用者鏡頭與乾燥空氣。原建築GLB不重建。


## 建築製作摘要（歷史，生物復原狀態見上）

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

## 2026-09-16：黑潮生物整合

- 本輪隔離cwd `/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/stillwater/.worktrees/last-arcade-recovery`，branch `codex/last-arcade`。先提交暮色，再依使用者v1任務書做形態、運動、路徑、群游與整合。
- 大型生物以真實mesh變形投射動態陰影；日光方向保持原基準，但光源沿同方向移至42m、shadow far100m，使9–17m高的生物位於shadow camera前方。陰影仍為PCF近似。
- 獨立檢查入口 `/tools/kuroshio-biology/`，相機與光照不因此更改。檢查模式可看背面／腹面／灰模、動作與參數，錄影是實際WebGL畫面。
- 所有數值單位、來源分級、需求衝突、驗收證據與未完成項目集中至黑潮製作頁，不把程序近似寫成生物學實測。


## 2026-09-16：鬼蝠魟形態重建

- 使用者提供[幾何規格](../biology/references/giant-manta-geometry-spec-v1.md)及解剖參考圖，重點是盤體輪廓、中央厚度、頭部位置與肉質頭鰭。尺寸數值以文字規格為準；圖片嘴寬與厚度標示未採用。
- 本輪模型權威仍是 `src/creatures/manta/MantaModel.ts`，沿用原三尾翼展、場景路線與相機；不是新Blender匯出資產。細節與來源界線見[模型頁](../biology/kuroshio-manta-model.md)、[參數證據](../kuroshio-arcade-parameter-evidence.md)。
- 獨立檢查工具增加正面、頭部近景、中性姿態與正交投影，讓輪廓驗收不受透視或拍翼遮掩。原始source快照保留於 `exports/last-arcade-manta-geometry/baseline/`。

- 最新本機驗收：16項相關tests、build、check:project及WebGL 17類檢查通過；600秒新版頂點抽樣0建築代理接觸，暫停像素差0、dispose回到暖機基準。三視图與近照保留於 `exports/last-arcade-manta-geometry/`。未提交／發布，使用者美術確認與實機另計。


### 復原驗收完成

2026-09-16：159 tests、build、check:project 與 17 項 browser GPU 檢查通過。大型生物及魚群各 600 秒抽樣無建築穿入。固定 `.worktrees/last-arcade-recovery` 提供 5186 預覽；詳見 `exports/last-arcade-recovery/README.md`。未 commit／發布。


## 2026-09-16 魚群靠近走廊（待使用者確認）

使用者反映原魚群過遠。沿用模型尺寸、數量、低速與平順姿態；只調整 `src/systems/schooling/index.ts` 的分布及路徑吸引力。

- Chromis 三個停留點移至 (0.95,1.55,-2.2)、(1.45,1.75,-4.6)、(2.1,1.55,-7.8) m，出現在近處店面與柱間。
- Fusilier 目標環線中心 (2.75,1.7,-5)m，水平半徑 X=1.3、Z=3m，角速度 0.045 rad/s；在走廊與路側之間往返。這是群游引導路線，個體會偏移，非剛性軌道。
- 初始魚群位於走廊內，縮小初始散布；降低切線引導、增加回到環線的吸引，避免長期漂至遠處道路。保留逐步避障、欄杆／柱子／店面 proxy。
- 本輪 600 秒 seed91626：Fusilier 1068 次穿越柱列 X=2.82 平面（不是穿入柱體）；約82%抽樣時間至少一隻在相機5m內；兩群建築穿入計數0。這是抽樣 proxy 驗證，非連續 mesh 碰撞證明。
- 五項 schooling tests 通過（含另seed600秒、插值、暫停、轉速／俯仰限制）；瀏覽器暮色實際看到近處店面小魚及柱間大魚，未捕獲console error。證據 `exports/last-arcade-recovery/corridor-audit.json`、`corridor-dusk.png`；改前程式 `schooling-before-corridor.ts`。
- 同一固定 recovery worktree 與 5186 網址；未 commit／發布。


## 2026-09-17 生物間距、可見性與群聚位置（本機候選）

- 需求：鬼蝠魟不能互穿、鯨鯊能被看見；小魚分成招牌旁與遠處門腳兩群；大魚群保留近游並偶爾遠行。招牌使用「ミグ商店」，細節見本頁招牌紀錄。
- `Motion.ts`：Manta 起始路徑比例改為 .12/.43/.76，先錯開通行時序；接近時提早降速，並以半徑4.5/4.2/4.0m（Manta）、5.2m（Whale）的球體檢查每步相對掃掠線段。安全範圍包含24組相位／滑行／左右翼差異的模型全部LOD頂點。球體仍為保守近似，不是生物形狀的精確碰撞網格。
- 900秒固定20Hz驗收涵蓋低空通過及回返；安全球外緣最小餘裕約0.35m；僅1個個體步進速度低於0.01m/s，沒有持續卡住。15分鐘路徑／速度測試通過，不把前後自然遮擋當作身體相交。
- Whale 改在海側寬環線：中心(5.8,3,-65)m，半徑25m，近端約Z=-40m；初始比例.98讓開場即可通過遠端開口。高度波幅.25m、緩慢高度目標±.15m；模型維持8.5m。此處是可見性與建築避障的美術路線，不是野外行為實測。
- `schooling/index.ts`：100 Chromis 分成兩組，各有個別home偏移与低頻、不同相位的小幅游移。中心約(1.43,2.22,-4.12)m（招牌右下）及(.78,.55,-10.8)m（遠處鐵門腳）；收縮事件向各自home收束，避免兩組突然奔向同一中心。
- Fusilier 沿用近處巡游，增加約286秒的平滑遠行包絡，最大額外X+1.1m、Z-5m；速度與轉向上限保留。這是目標路線，個體位置會因群游與避障偏移。
- Browser 實際確認「ミグ商店」、招牌小魚、遠處門腳小魚與鯨鯊出現在雨棚下方的街尾開口。證據 `exports/last-arcade-recovery/placement-whale-visible.png`。
- 驗收與限制：schooling 5項（含600秒）及motion 3項（含900秒與形變包絡）通過；900秒建築頂點抽樣、build、check:project與browser GPU另存同目錄。本機候選，未commit／發布／實機驗收。

低空回程在街尾Z=-25m後爬升，X由6.15收至約5.95m以避開電線橫臂；A/C巡航個體則在28m內開始平滑升高讓出B的回程走廊（最多6m、8秒平滑）。安全優先，未保留原本可能導致相遇卡住的回程高度。


## 2026-09-17 街道生物互動與小魚陰影（本機候選）

- 需求：鬼蝠魟低空進入街道時，魚群往走廊躲避；陰影下的魚要和周圍受光一致。
- 互動入口：`src/places/last-arcade/biology/index.ts` 提供同一 `ArcadeAnimalMotion` 公式的獨立固定步進取樣器，給 `schooling/index.ts` 每12Hz取樣。避免以當前render frame的位置驅動所有過去步進，也保持時間重置可重現。
- 警戒為美術行為近似：高度6m內的Manta，沿未來8秒速度方向預測靠近；相對體半徑之外1–6m形成平滑警戒。每隻魚1.2秒逐漸反應、12秒釋放；小魚靠各自原停留點退縮，Fusilier往柱間缺口後方的走廊內退避。每隻避難點不同，保留避柱、轉向及速度平滑；退避時最高基準速度倍率1.5，無瞬移。沒有把藝術反應描述為物種實測。
- 兩魚模型原本 `receiveShadow=false`，造成棚下仍吃到太陽直射；現已開啟body/fins/eyes/stripes的陰影接收。沿用既有Standard PBR材質、原色及場景日光／天空／反射光，未用emissive補亮。尾部變形在Three project_vertex/shadowmap_vertex前，因此接收陰影座標隨形變一致。
- 小魚仍不投射自己的陰影；天空與地面反射仍為原場景環境光近似，未新增完整GI／物理流體。
- 驗收：synthetic通過事件有41/50隻在40秒進柱內（無威脅對照7/50）；警戒解除後回到巡游。兩項互動測試與兩項材質／shader陰影測試通過；另5項既有schooling測試通過。固定步進重播比較允許1e-9內插值餘數，魚的模擬狀態完全一致。
- 實際adapter900秒抽樣建築穿入0；828秒browser畫面47/50隻在柱內，836秒略向道路轉頭可同時看到低空Manta與走廊魚群。`exports/last-arcade-recovery/encounter-review.html?time=836&road=1` 可直接播放該時刻後30秒；它使用正式場景與正式controller，不是合成動畫。
- Browser陰影、變形與pause檢查／build／check:project通過；未做實機驗收、未commit／發布。證據在 `exports/last-arcade-recovery/encounter-*`。

## 2026-09-27 中秋滿月（本機候選，待使用者確認）

使用者要求在月夜右上角加一個可調整的滿月。分支 `claude/arcade-full-moon`。月亮本體在第三輪搬到共用的 `src/shared/sky/FullMoon.ts`（向海的隧道也用它），本場景只保留開關常數與預設位置。

- **開關**：`index.ts` 的 `ARCADE_FULL_MOON`，設 0 就回到原本沒有月亮的夜空。
- **做法**：程序化畫的圓盤，包含輕微臨邊昏暗、低頻月海暗斑和很窄的光暈，不用貼圖。圓盤跟預設畫面平行，所以在 62° 廣角的邊緣也是正圓。月亮用 depth test，屋簷和電線會擋在它前面。
- **淡入淡出**：跟著場景自己的 `night` 係數（`smoothstep(.2,1)`）。晨曦、正午、暮色不顯示；從暮色切到月夜時，月亮會跟著整組光一起淡入。
- **可調**：設定面板加了四個滑桿（只在潮風商店街顯示）：大小 1–6°、亮度 40–160%、水平位置、高度，另有「月亮回預設」按鈕。預設值 `{size:2.4°, brightness:100%, x:.70, y:.76}`，寫在 `index.ts` 的 `installFullMoon` 呼叫裡。調整不會保存；切換房間時，滑桿會載入該房間自己的預設值。
- **美術取捨**：真實月亮的視直徑約 0.5°，在畫面上只有幾個像素。預設的 2.4° 是這個場景唯一允許的「安靜不可能」。100% 亮度時，盤面在畫面上約 (194,193,190)，沒進 bloom；右上天空像素和原本相同 (34,47,61)，黑位沒有被抬高。
- **光向（第二輪，使用者要求改）**：`ARCADE_MOONLIGHT_FOLLOWS_MOON = 1` 時，月光改從月亮的實際方向照來，會跟著升起和滑桿移動；設 0 就回到 Q2-A2 原本來自右後方的月光。現在影子往觀者左前方斜落，面向街道背面的鐵捲門不再受直射光。月亮還低在屋頂後時，月光較弱（最低 45%）。
- **升起（第二輪）**：切到月夜時，月亮從右側對面屋頂後方慢慢升到設定的位置，花 12 秒（共用的 `MOON_RISE_SECONDS`，設 0 就直接出現）。貼近屋頂時較暗、偏暖，升上去後轉白。直接在夜裡開啟房間、暫停流動或開了減少動態時，月亮直接顯示在定位，不播升起。
- **月面（第二輪）**：使用者覺得月亮「窄窄的」。實測四種視窗比例下外框都是正圓，原因在貼著右緣的暗斑和邊緣變暗，讀起來像凸月。已改成邊緣一圈均勻亮，暗斑只留在中央並減淡。
- **已知限制**：位置以 16:9 畫面定義。視窗接近正方形或直式時，月亮會落在畫面外（900×900 實測看不到）。
- **驗收**：`tsc`／build 通過，`tests/last-arcade*.test.ts` 7/7 通過。`kuroshio-encounters` 在 main 上本來就失敗，與這次改動無關。截圖在 `exports/quality-review-2026-09-27-arcade-moon/`，分別是改動前、預設、調整後、正午。
