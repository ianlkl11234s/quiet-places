# 黑鰭礁鯊幼鯊造型／Carcharhinus melanopterus

## 範圍與來源

- 使用者新增需求取代 Stairlight 早期「無魚」限制：一尾幼年黑鰭礁鯊在乾燥樓梯間巡游；沿用既有小窗、攝影、建築及紅色汽水帶。鯊魚是唯一生物，紅繩維持環境細節。沒有新增水體、泡泡、光暈或魔法效果。
- [Florida Museum 物種頁](https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/blacktip-reef-shark/) 用於辨識外形，與 C. limbatus 區分；短而圓鈍的吻部、灰褐背／淡腹及鰭尖黑斑為造型方向。自製程序模型、vertex colors 與 PBR，未下載第三方模型或貼圖。
- 0.9 m 為採用使用者建議的美術尺度，未據此推定年齡；不是解剖學掃描或物種鑑定模型。
- [PNAS／Floryan 等的游泳效率研究](https://arxiv.org/abs/1904.05212) 僅支持 Strouhal 啟發式的背景；本場景數值由使用者範圍限制，未量測黑鰭礁鯊個體或空氣流體。

## 可重建來源與座標

- `assets/blender/scripts/blacktip_shark.py` → `assets/blender/blacktip-shark.blend` → `public/models/blacktip-shark.glb`。
- glTF／網站模型局部軸：+X 為吻端、−X 尾端、+Y 背、Z 左右；總長0.9 m。
- 16個 Spine_00…Spine_15 骨骼為 Root 直接子節點，位置 s=[0,.06,.13,.21,.30,.40,.51,.61,.70,.78,.84,.89,.93,.96,.985,1]，尾柄區加密。獨立骨骼以絕對側向偏移與切線旋轉設定，避免鏈式旋轉重複累積。
- `src/places/stairlight/Shark.ts` 為單一模型的 pose、window diffuse 近似與資源所有權；`SharkMotion.ts` 為共享 elapsed 時鐘驅動的路線與波動。

## 運動與光照近似

- 波動採 y(s,t)=A(s) sin(phase(t)−2πs/λratio)+B_turn；正規化 s 搭配無單位 λ/L，不混用公尺與比例。
- f=St×U/A 中 A 是尾端峰到峰擺幅；A(s) 則是單側峰值。phase 必須積分頻率，不能直接 f(t)×t。頭部微幅、後半部至尾端漸增，另有平滑轉彎曲率、側傾及小幅pitch。
- 階梯斜率高於允許的body pitch，因此路線升降與身體pitch解耦；這是空氣中游泳的動畫近似，不是無攻角、無滑移的流體解。
- 日／月直射和建築遮擋使用同一 shadow pass，蒙皮變形也投影。動態鯊魚以窗口方向、面朝向、面積／距離估計少量天空 diffuse；此為材質限定近似，非全房間補光或 emissive，也不代表逐面積光線追蹤。
- 所有動畫只用播放器 elapsed，暫停、倒轉seek與同時間重現不應累積骨架偏移。

## 驗收

2026-09-09 本機完成，尚未合併或發布。`tests/shark-rig.test.ts` 直接讀取已交付 GLB，驗證 body 真正使用至少12個 Spine 權重、權重正規化、尾部變形大於頭部、seek無累積及所有資源僅釋放一次。實際前段峰到峰約 .0165 m，後段 .1260 m；避免僅驗證骨骼存在而魚身仍固定 Root。

- 採用 A_head=.009L、A_tail=.09L（轉彎最多×1.05）、n=2.2、λ/L=.90–1.06。St=.27–.34；尾擺頻率由沿路巡航速度與尾端峰到峰幅度計算。轉彎 travel-time table 使實際位置減速6%，不是只更改顯示數字；20 ms 確定性積分 cache 按需延展，半小時／一小時後不凍結。
- B_turn 是額外、後部加權的有號曲率偏移，最大約3.1 cm；以明確 forward/dorsal/lateral basis 保持背部朝上，轉彎才側傾。胸鰭控制隨對應body段姿態移動，非飛鳥振翅。
- 最新路線為下平台 → 下梯 → 中央平台 → 上梯 → 上平台迴轉 → 同一上梯返回 → 中央平台 → 下梯 → 下平台迴轉。不再有從上層直接落下的垂直捷徑。兩次來回略錯開橫向位置，僅在中央平台跨梯段。
- 20分鐘取樣：巡航速度 .306–.415 m/s、頻率 .542–.777 Hz、最大側傾10.18°、往返56.3–58.2秒。升降pitch保留+3…8°／−2…6°的平滑過渡。
- `tests/shark-clearance.ts` 對600秒、每.2秒的全部蒙皮頂點採樣（約1,422萬點）：解析牆界最小4.97 cm、階面15.18 cm、扶手11.70 cm。這是靜態建築包絡和离散採樣，非連續碰撞／動力學證明；目前新平台實體與此驗收對應 **rear 預覽**。舊側窗資產保留作比較，不宣稱同步完成平台重建。
- 28/28全站tests、build通過。真實WebGL驗證鯊魚可見／投影、四時段、暫停姿態與資源釋放；桌面正午／月夜已看圖，console無warning/error。來源、參數與結果在 `exports/shark-review/`。
- 生物模型為程序造型近似，非掃描；空氣巡游、身體pitch与樓梯斜率的解耦仍是明確美術設定。未驗證實體手機效能或生物流體。


## 2026-09-09 頭部環狀突起與流線輪廓

- 使用者回報頭部環狀突起。舊截面每個區間獨立 smoothstep，控制點斜率全部歸零，造成一段段肩部；中性光、無陰影也可看出吻部階段性突起。改為半徑平方的 shape-preserving Hermite 插值，保留原控制站尺寸但使斜率連續。121×48截面網格、吻部加密取樣，眼睛重新貼合表面；身長仍0.9 m、16脊椎與原路巡游不變。
- 自體陰影對照另發現細密條紋。鯊魚使用獨立 MeshDepthMaterial，在 RGBADepthPacking 前加1.5倍局部像素深度斜率補償，shadowSide=DoubleSide；沿用建築已驗證的光柵近似，未改全域太陽、曝光或牆面。蒙皮投影保留，depth材質一併驗證只釋放一次。
- Blender母檔與網站GLB已重建，舊GLB／腳本存於 `exports/shark-review/before-streamline/`。模型頁可手動切換自體陰影與巡游變形、seek時間，僅操作時渲染。
- 驗收：28/28全站tests通過；增加depth釋放檢查後重跑rig test與build通過。GLB頭部峰到峰.0165 m、後段.1246 m。600秒、每.2秒共22,900,631個蒙皮頂點離散檢查，牆／階面／扶手最小間距仍4.97／15.18／11.70 cm；不是連續碰撞解算。
- 真實GPU四時段、蒙皮／投影、暫停、資源釋放通過；原牆角白線指標仍為0。已看中性光rest pose、20／40秒變形與晨曦場景，頭部環紋已消除。仍為本機worktree，未commit／合併／發布。

## 復用接入流程

1. 自製來源 `assets/blender/scripts/blacktip_shark.py` → `assets/blender/blacktip-shark.blend` → `public/models/blacktip-shark.glb`。於repo根執行 `Blender --background --factory-startup --python assets/blender/scripts/blacktip_shark.py`（Blender替換成本機執行檔）；保留旧GLB與腳本做對照。
2. GLB公尺、鼻+X／背+Y／側向Z、身長.9m。16個Spine是Root的獨立children，不是串接骨鏈；具體骨名與rest軸見 `exports/shark-review/model-contract.json`。不可換成任意魚骨架後直接套用。
3. `Shark.ts:createShark(model,rearWindow)` 擁有模型資源；將root加入scene，由播放器單一elapsed呼叫update，退出dispose。需要多尾時每尾獨立skeleton與材質所有權；不能僅clone共享骨架後分別dispose。
4. `SharkMotion.ts`包含樓梯間路徑、時間積分、tailbeat與spine姿態。換場景先換路徑及碰撞包絡，再保留尾重traveling wave；不要搬用樓梯間座標。必須保留最小前進速度與實際travel-time減速，不能只修改顯示speed。
5. A(s)是單側幅度；Strouhal公式分母是尾端峰到峰幅度。變頻必須積分phase；身體length與wavelength須使用一致正規化。具體已驗證區間見上方驗收段，不把美術幼鯊造型當物種量測。
6. 換光照時，Shark.ts內窗位置／面積天空近似也要跟著換。新增solar bounce與空氣散射由場景的WindowTransport.attach(shark.root)接入，相關規則見 [窗光復用手冊](../lighting/window-transport.md)。
7. 先跑rig／motion tests，再把clearance測試改成新建築包絡，最後用真實場景檢查rest／轉彎／返程／日夜／暫停。舊場景碰撞通過不代表新場景通過。

修頭部時不要恢復「每段smoothstep歸零斜率」；在無陰影及有陰影下分別看輪廓，辨別截面肩部與shadow acne。嘴、眼睛、鰓須重新貼合新的profile。形體、蒙皮、受光是三個獨立驗收項目。

## 2026-09-27 Q2 A1-5 胸鰭攻角連動（候選待使用者確認）

- `SharkMotion.ts` 新增 `pectoralAttack{left,right}`（弧度，繞身體側向軸，正值為前緣上抬）。共同分量 = `PECTORAL_CLIMB_RATIO(.6) × pitch`；差動分量 = `PECTORAL_TURN_DEG(4°) × tanh(curvature/1.2)`，外側鰭上抬、內側下壓，符號與既有 bank 一致。`PECTORAL_ATTACK_GAIN=0` 即回到原本只跟隨身體的胸鰭。數值是美術值（C 級），方向是「像飛行控制面」的類比，沒有查證黑鰭礁鯊的實測胸鰭角度，不能寫成生物事實。
- 模型限制：Blender 腳本只給胸鰭骨骼 .18 ADD 權重（GLB 正規化後約 .153），其餘跟隨脊椎。`Shark.ts` 讀取實際權重，用二分法解出線性混合後能得到目標攻角的骨骼角 `pectoralBoneAngle`，上限 75°。目前路線最大需求 6.1°，對應骨骼約 40°，鰭會因線性混合縮短約 3–4%。Q3 重做模型時建議把胸鰭權重綁到 1，就不需要這個補償。
- 測試：`tests/shark-motion.test.ts`：600 秒取樣，共同分量等於 .6×pitch；pitch>4° 時兩鰭 >2°、pitch<−3° 時 <−1.5°；|curvature|>.4 時差動與 curvature 同號、與 bank 反號；最大 6.11°；每 20 ms 變化 <1°（受既有 body pitch 過渡速率限制，最差約 1.17°/20 ms × .6）。`tests/shark-rig.test.ts`：在實際 GLB 蒙皮上量 Pectoral_L 弦線角對要求攻角的斜率為 0.999（120 秒）。既有 shark 測試全部通過。
- 連拍：`exports/quality-q2-20260927/A1-A3/after/shark-A1-5-*.jpg`（`tests/shark-model.html`，root 歸零，爬升／平飛／下潛／左右轉與爬升段 0.4 秒間隔）。角度小，視覺差異細微；鰭看起來離身體較遠的情況在攻角≈0 的平飛幀也有，是原本的造型與視角，不是這次改動造成的。

## 2026-09-27 Q3 B1 烏翅真鯊模型重做（候選待使用者確認）

物種名：**烏翅真鯊**（*Carcharhinus melanopterus*；舊稱黑鰭礁鯊，同一物種，依 [PREFERENCES](../production/PREFERENCES.md) 2026-09-27 指示）。檔名與識別字 `blacktip` 不改。狀態：**候選待使用者確認**；只做了 Blender 背景算圖與 Node 測試，尚未做瀏覽器／場景四時段驗收。

### 辨識特徵與來源（A＝來源明載的事實，B＝依來源做的形態近似，C＝美術值）

| 特徵 | 等級 | 來源 | 模型做法 |
|---|---|---|---|
| 第一背鰭與尾鰭下葉有明顯黑尖 | A | [Australian Museum](https://australian.museum/learn/animals/fishes/blacktip-reef-shark-carcharhinus-melanopterus-quoy-gaimard-1824/)（"The first dorsal fin and lower caudal fin lobes have distinct black tips"）；[Wikipedia](https://en.wikipedia.org/wiki/Blacktip_reef_shark)（"especially striking on the first dorsal fin and lower caudal fin lobe"） | 鰭 vertex color；第一背鰭黑冠下緣斜線、過渡約 7 mm；尾下葉 y<-.054 起轉黑 |
| 第一背鰭黑尖下方有淺色帶 | A | [FishBase](https://www.fishbase.se/summary/Carcharhinus-melanopterus.html)（"a prominent black tip of first dorsal fin set off abruptly by a light band below it"）；Australian Museum 寫「sometimes」；[Fishes of Australia](https://fishesofaustralia.net.au/home/species/1952)（黑色區塊有白邊） | 黑冠下方 12–26 mm 帶，混 52% 淺色（混合比例為 C） |
| 胸鰭、第二背鰭、臀鰭有較小黑尖 | A | Australian Museum（"All other fins usually have smaller black tips"）；FishBase（all fins black/dark brown tips，另有胸鰭與尾上葉後緣暗邊） | 第二背鰭、臀鰭、腹鰭、胸鰭小黑尖；胸鰭後緣與尾上葉後緣暗邊 |
| 吻部短而圓 | A | FishBase（"short, bluntly rounded snout"）；[Florida Museum](https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/blacktip-reef-shark/)；Wikipedia（"short, wide, rounded snout"） | 截面半徑平方 Hermite，吻端側寬先於高度增加（d=8 mm 時寬 17 mm／高 12 mm），俯視半圓鈍吻 |
| 體側淺色帶狀斑紋伸向腹部 | A（存在）／B（形狀） | Florida Museum（"light band extends along the flank from the anal fin to just above the pectoral fins"）；Wikipedia（"white band on the sides extending forward from above the anal fin"）。**注意**：FishBase 與 Australian Museum／Fishes of Australia 描述的是「第一背鰭下方到腹鰭上方的暗色條」，兩者是相鄰的兩個色塊，文字來源沒有給精確邊界 | 貼圖：淺帶從臀鰭上方由腹部升起、往前變窄，止於胸鰭上方；淺帶與腹白之間保留較暗的條（第一背鰭下→腹鰭上）。形狀與位置為 B |
| 背黃褐到灰褐、腹白 | A | FishBase（"Yellow-brown above, white below"）；Australian Museum（"yellow-brown to grey above, white below"）；Wikipedia（pale grayish-brown above） | sRGB 背 (.50,.45,.36)、腹 (.90,.885,.835)，界線頭部較低、往尾柄升高，過渡 ±.09 rad（色值為 C） |
| 第二背鰭大、後端短；第一背鰭起點在胸鰭後端上方 | A | Florida Museum；FishBase（2nd dorsal fin large） | 第二背鰭高約 4.4% TL；第一背鰭起點 x=.186，胸鰭後端約 x=.19 |
| 各鰭位置與比例（胸鰭前緣約 18% TL、尾上葉約 29% TL、尾下葉約 15% TL 等） | B | 依一般真鯊屬外形與上列文字，**未取得本種量測表**（FAO Compagno 1984 未查閱） | 見 `blacktip_shark.py` outline 座標 |
| 眼色、鰓裂長度與弧度、嘴與鼻孔位置 | C | 查無本種數值；FishBase 只寫 oval eyes | 眼為扁橢球埋入 3.4 mm、外露約一半，貼圖加暗色眼瞼環；5 道鰓裂為貼圖暗縫＋後唇微亮 |

iNaturalist 本種頁：[taxon 67964](https://www.inaturalist.org/taxa/67964)（只確認 taxon 存在，未逐張比對照片）。IUCN 頁面需 JS，本次**未能讀取**，不引用。0.9 m 仍是使用者指定的美術尺度（FishBase 出生體長 33–52 cm，0.9 m 屬幼鯊到亞成體範圍，不據此推定年齡）。

### 模型與材質

- 身體：150 環 × 48 邊 loft，吻端與尾端單一 pole，全面 smooth shading；身體終止於尾基 x=-.30，細芯延伸進尾鰭根部。
- 鰭：2D 輪廓 → Delaunay 三角化，兩道沿邊偏移環讓邊緣帶規則；厚度 = 根部厚度 × 往尖端遞減 × `sqrt(u(2-u))`（u＝到邊緣距離／圓角半徑），在所有游離緣收成刀口。根部厚：第一背鰭 13 mm、尾鰭 13 mm、胸鰭 11 mm、第二背鰭／臀鰭 8 mm、腹鰭 7 mm；尖端約為根部的 22–40%。
- 材質：身體 `SHARK_SKIN`：base color 1024×512 + metallicRoughness 512×256（只用 G），GLB 內 JPEG q85，分別 18,018 與 3,874 bytes。roughness 約 .44–.75：背 .50、腹 .57、頭部 −.06、鰓與嘴 +.12–.18、細噪 ±.0125。Specular IOR level .38。鰭 `SHARK_FIN` 用 COLOR_0（線性）× 白色，roughness .46；胸鰭與腹鰭下表面偏淺。眼 `SHARK_EYE` roughness .2。
- draw 物件從約 27 個減為 5 個：`BLACKTIP_BODY`、`FINS_MEDIAN_PELVIC`（背鰭、臀鰭、尾鰭、腹鰭）、`PECTORAL_R`、`PECTORAL_L`、`EYES`。

### Rig 契約與胸鰭權重

- 維持：公尺、+X 吻（x=.45）、尾尖 x=-.45、+Y 背、Z 側向；19 骨 `Root`、`Spine_00…15`（Root 的獨立 children、位置不變）、`Pectoral_R`（+Z）、`Pectoral_L`（−Z）；沒有動畫 clip（舊檔也沒有）。
- 改：胸鰭**整片 weight 1.0 綁在 `Pectoral_*`**（舊 .18 ADD，正規化後約 .153）。`Pectoral_*` pivot 移到胸鰭根部 1/4 弦 (.247,−.042,±.043)。`Shark.ts` 本來就從 skinWeight 讀取實際權重，`pectoralBoneAngle(a,1)` 等於 `a`，所以反解不用改算法，只更新註解。鰭仍跟隨該骨所在 s 的身體側移與切線。
- 胸鰭根部埋進身體 24 mm。120 秒離散檢查：原本埋在身體內的胸鰭頂點，最壞仍在身體表面內 0.3 mm（以最近身體頂點法線估計，非連續碰撞證明）。

### 重建與驗收（本機）

- 指令：`/opt/homebrew/bin/blender --background --factory-startup --python assets/blender/scripts/blacktip_shark.py`（`SHARK_GLB_OUT=<path>` 可先輸出候選，不覆蓋正式 GLB）。
- 前後：三角面 12,980 → 27,128；GLB 523,520 → 936,488 bytes（目標 ≤30k／≤1.5 MB）；sha256 `8f356a07…` → `819a6cfa…`。metadata：GLB `scenes[0].extras.q3_b1`，另存 `exports/quality-b-20260927/B1/model-metadata.json`、`model-contract.json`。同一腳本重跑，glTF JSON 完全相同，但眼睛的 index buffer 三角順序不同，所以 hash 不是逐位元組可重現。
- 測試：`tests/shark-rig.test.ts` 改為接受單一身體 primitive；身體 ≥10 根、身體＋尾鰭 ≥12 根 Spine；胸鰭權重必須為 1；加入 JPEG 貼圖的 Node stub。頭部峰到峰 .0165 m、後段 .1158 m；胸鰭弦線角對要求攻角的斜率 .993（舊 .999）。`tests/shark-clearance.ts` 共 41,497,828 點：牆／階面／扶手最小 6.84／17.01／16.63 cm（舊 4.97／15.18／11.70）。
- 算圖：`exports/quality-b-20260927/B1/{before,after}/`（側面、上方、45°、第一背鰭／尾鰭／頭部特寫、clay 側／上／45°），使用 `render_shark_review.py`，中性光 EEVEE，不是 stairlight 場景光。原檔備份：`exports/quality-b-20260927/B1/original/`。
- 未做：瀏覽器內場景四時段、真實 WebGL 下貼圖與 window diffuse 近似的外觀、實機效能。
