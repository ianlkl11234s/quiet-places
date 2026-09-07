# 錦鯉：模型、骨架與游動系統

> 狀態：樹影午後錦鯉的來源、重做與網站接入紀錄；最新狀態見上方 2026-09-07 重做章節，舊模型列為歷史。未宣稱生物力學或流體模擬。

## 2026-09-07：重做骨架版（本機已驗證）

- 使用者要求參考魟魚製作流程更新樹影午後錦鯉，並明確表示可重做、希望更真實。原始完整文件及 SHA-256 見[參考存檔](references/README.md)。文件是需求參考，不是完成證明。
- 改動集中於魚的模型、材質、骨架、Actions、路徑與驗證。房間、樹、曝光、日照、地面間接光與設定面板沿用原基準。下方舊 `Swim` morph 模型紀錄保留為歷史。
- 新來源分成 `assets/blender/scripts/koi.py`（造型、材質、骨架、蒙皮、匯出）及 `koi_motion.py`（控制參數、姿態計算、Actions、NLA 與動作驗證）。在独立 Blender factory-startup 背景程序建置，不修改開啟中的美術場景。

### 形態依據與近似

- 2026-09-07 核對 [FAO / Peteri 2009 的鯉魚資料](https://www.fao.org/fishery/docs/DOCUMENT/aquaculture/CulturedSpecies/file/en/en_commoncarp.htm)：細長且側扁的體形、厚唇、兩對口鬚與長背鰭基部，作為修正方向。這不是各錦鯉品系比例或花紋的鑑定資料。
- 另核對 [JEB 2013 的鯉科尾鰭與游泳研究](https://journals.biologists.com/jeb/article/216/16/3164/11570/The-effects-of-caudal-fin-loss-and-regeneration-on)，只確認研究涵蓋鯉魚與尾擺／尾鰭功能，不將幼魚實驗或其他魚種數值套作本資產游速。
- 模型、程序花紋貼圖與鰭面為本專案原創。没有下載模型、照片貼圖或重發布外部圖片。0.55 m 原生全長與身體比例是使用者任務書的美術預設；未聲稱量測真實個體。魚身依然是室內近地的超現實編舞，不新增水體、浮力、避障或群游求解。

### 動作與控制

- Blender 使用 `+Y` 朝頭、`+Z` 朝背，glTF Y-up 匯出後為 `-Z` 前方、`+Y` 上方。網站依實際 Z 軸長度縮放，三尾可見全長維持約 0.92／0.86／1 m；此場景放大與 0.55 m 母檔尺度分開記錄。
- `KOI_RIG` 包含頭、五節脊柱、尾柄、三節尾鰭與成對／中線鰭骨。頭部保持相對穩定，後半身以 `s^2.35` 振幅包絡及中心線切線角驅動；角度導數除以身長，並轉成父骨相對旋轉。尾中／尾端使用時間延遲跟隨，並非軟體或水阻求解。
- 30 fps 烘焙九個 Actions：IDLE_HOVER 10 s、SLOW_CRUISE 12 s、CRUISE 8 s、TURN_LEFT／RIGHT 各 8 s、RISE／DESCEND 各 6 s、CIRCLE_SLOW 16 s、GLIDE 8 s。`KOI_ACT_` 為完整名稱前綴，NLA tracks 預設 muted，慢游為 active action。
- 慢游與停留為原地循環；轉彎／巡游／升降／滑行保留 root travel，不能直接與網站路徑疊加。圓游為閉合路徑。旋轉以與方向一致的符號配合積分路徑，升降為阻尼步階響應近似。
- 真正循環的 phase、振幅變化、胸鰭、heave 與 roll 都在 clip 長度內保持週期；不是把最後一幀硬設回第一幀。慢游預設 0.78 Hz 為了循環取整為 12 s／9 次＝0.75 Hz；所有速度、頻率與細部動作仍是美術校準。
- 自訂屬性是**重新烘焙控制**，不是 live drivers。修改 `KOI_RIG` 的 wave、forward_speed、turn、pectoral、heave、roll、depth、tail_follow、organic_variation 與 motion_seed 後呼叫 `build_actions(rig)`。相同參數和 seed 可重現；共用到其他 rig 的 Actions 會先拒絕覆寫。

### 網站轉換

- `src/places/leaflight/KoiMotion.ts` 保留約 78 s／圈的活動範圍，加入各魚不同的平滑速度变化和小幅升降；鼻端依完整速度向量朝向，並有小幅轉彎傾斜。
- 只有原地 `KOI_ACT_SLOW_CRUISE` 用於網站。積分路徑距離除以每次尾擺約 17% 顯示身長，得到連續的動畫 clock；這是視覺步距比例，非游泳效率測量。網站取用約 0.35–1.15 Hz 的驗證界限。
- `Koi.ts` 在烘焙姿態上加小幅後半身轉彎偏移；每次先還原上一份烘焙姿態，避免相同 elapsed 累積偏轉。蒙皮、受光座標與 shadow pass 共用實際骨架。三個 clone 擁有獨立骨架和材質，幾何／貼圖由單一 factory 統一釋放。
- 中性近距離三視角與 36 s 三圈檢查入口：`tests/koi-gpu.html`。正式樹影入口依然是 `/?place=leaflight`；測試頁不加入產品選單。

### 材質與最後造型修正

- 第一版草稿雖有骨架，但鰭根浮離、尾鰭像紙片、嘴唇與眼睛過大；未接受該版視覺驗收。最後重做為共享截面切線的身體、貼合身體的曲面魚鰭、細鰭條、較小側眼、相連的小唇圈、曲線口鬚與鰓蓋線。
- 五種 Blender 可選材質有獨立程序花紋；預設 Kohaku 使用 packed 1024×512 sRGB 花紋，避免低密度頂點色造成鋸齒狀斑塊邊界。512×256 非色彩 normal map 只提供淺的鱗片邊緣起伏；已實際輸出到 GLB。它不是照片或測量所得皮膚細節。
- 網站保留既有窗洞方向補光與地面反射近似；以同一骨架處理身體和鰭条的投影。鰭 alpha／transmission 為視覺近似；部分薄邊在低解析度仍可能有取樣鋸齒。

### 本輪驗收

- Blender 5.1.2 背景建置成功；實際骨架、全 mesh 權重總和、九個 Actions、慢游／停留首尾與速度、圓游姿態矩陣及速度檢查通過。可編輯 `.blend`、GLB、metadata 與預覽圖均已儲存。
- 最終 GLB：1,789,020 bytes、20 meshes、26,002 triangles、1 skin／20 joints、9 Actions、2 張 embedded PNG（花紋及 normal map）。SHA-256 與清單見 [實際資產讀回](../../exports/koi-integration/asset-readback.json)。
- Node 實際蒙皮取樣：前方 15% 身體橫向 excursion 0.00223 m、後方 20% 0.04615 m，比值 0.0483；不是單純包絡公式。三個實例兩圈、每 2 s 取樣全部變形頂點：最低 0.0873 m、最高 0.4913 m，皆在房間內。15 分鐘路徑測試亦檢查間距、鼻端與速度、尾擺 cadence 及跨圈連續性。
- `npm test` **21/21** 與 `npm run build` 通過；既有 bundle >500 kB 提示保留。測試同 elapsed 多次不累積轉向，seek 還原，資源僅釋放一次。日誌在 [tests.log](../../exports/koi-integration/tests.log)、[build.log](../../exports/koi-integration/build.log)。
- Browser 實際解碼 GLB／兩張貼圖，上視、側視、斜視的慢游 36 s（三圈）完成，另核對不同尾擺相位。[三視角](../../exports/koi-integration/three-views.png)。樹影正式場景入口 1280×720、14:00 可見新魚身與投影；[場景圖](../../exports/koi-integration/leaflight.png)。暫停後兩次 screenshot 完全一致；切換場景返回另見 browser readback。
- 使用者已於 2026-09-07 確認「這樣可以」並授權提交此版本。本輪是本機驗收，尚未發布或完成實體手機效能驗收。仍屬程序造型與運動學近似；不宣稱照片級、完整任務書每項驗收、流體／肌肉求解或網站九狀態自主行為。來源、網站接入、測試與本機證據隨此次錦鯉重做提交保存。


## 舊版 morph 基準（保留歷史，已由上方重做工作取代）

## 範圍與來源

- 場景與光路見[樹影午後](../scenes/leaflight.md)；網站入口為 `src/places/leaflight/Koi.ts`，由 `src/places/leaflight/index.ts` 在場景建立時載入。
- `assets/blender/scripts/koi.py` 以空白 Blender scene 產生原創幾何、材質與 `Swim` 動畫；可編輯母檔為 `assets/blender/koi.blend`，網站資產為 `public/models/koi.glb` 與 `public/models/koi.metadata.json`。已知未使用下載模型或照片貼圖。
- 本次未新增或核對外部生物研究。名稱、白底朱紅斑塊、鬚、鰭與尾叉只用來建立可辨識的錦鯉視覺印象，不構成生物精確主張。

## 模型、材質與軸向

- 腳本以 31 個環、每環 18 邊建立身體，另接叉尾、背鰭與一對胸鰭；眼、口與兩根鬚是可見細節。metadata 讀回尺寸為長 1.152 m、寬 0.700 m、高 0.415 m，約 1,680 triangles；這些是專案場景尺度與美術模型資料，不是實體魚測量。
- Blender 原生座標為頭部 `+X`、上方 `+Z`；GLTF 匯出後維持頭部 `+X`、上方 `+Y`。網站以 `+X` 作前方，依路徑切線旋轉。
- 身體使用非金屬 Principled/PBR 材質，`Koi_Color` 頂點色提供象牙白與不規則朱紅斑塊，roughness 為 0.4，無 emissive 與鱗片細節貼圖；鰭為帶厚度的半透明視覺近似。網站另複製材質，以窗洞方向與地板 shadow map 補一點方向性間接光，避免魚腹均勻發亮；這不是全局照明或次表面散射求解。

## 動作與網站行為

- `Swim` 是 24 fps、1–61 frame 的 2.5 秒無 root translation morph-target loop。四個 `SwimWave` shape keys 讓身體與尾部做側向行波，尾端幅度稍強；不是骨架、肌肉或水動力模型。
- `Koi.ts` 載入一次 GLB，建立三尾共享幾何的 clone。三者在同一橢圓路徑上錯開三分之一圈，週期約 78 秒、中心高度 0.25–0.31 m、scale 0.86–1；細小上下擺動與絕對 elapsed clock 使暫停與重播可重現。
- factory 為單次使用，dispose 時釋放 mixer、clone skeleton、複製材質與模板 GLB 資源。這是資源所有權設計，非生物行為。

## 既有驗收與缺口

- 既有場景紀錄指出：主 app browser 已看圖且無 shader errors，build 已通過；另對 88 秒離散採樣檢查貼地範圍、房間界限與資源釋放。`docs/VALIDATION.md` 的 2026-09-07 集合整合紀錄亦列出 `npm test` 17/17、build 與樹影 browser 切換通過。這些是先前本機證據，並非本次重新執行。
- 未驗證：生物學比例、品種特徵、游速與尾擺頻率校準；所有相機／時段的對照圖；實體裝置 FPS、記憶體、耗電；以及正式部署。三尾編舞也不表示群游或自主行為。
