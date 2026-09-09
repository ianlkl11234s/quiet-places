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
