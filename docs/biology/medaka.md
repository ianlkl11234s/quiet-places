# 青鱂／日本米魚（Oryzias latipes）

## 狀態與範圍

2026-09-07 起製作，沿 `codex/afterlight-courtyard`／`/private/tmp/quiet-places-afterlight` 完成雨後天井的生物接入。使用者授權參考[原始任務書](references/medaka-task.md)，次日自行美術驗收。下面是實作契約，最終證據另列，不能把契約當驗收通過。

- 保留使用者調整好的單株、矩形小天窗、雨絲、地面材質及月夜補光。
- 22隻，長度3–4.5 cm；不為可見度放大。活動是超現實空間中的3D游動，沒有新增水體，也不宣稱青鱂能在空氣或僅潮濕地面生存。
- 重點是鬆散群游→錯開反應的加速→短距離穿光→減速→重新聚集。光只負責顯現魚身，不是活動邊界。
- 使用固定seed的鄰居／環境行為模擬後烘焙。網站播放同一份位置／方向／推進相位資料，非22條手寫固定樣條，也不宣稱網站逐幀進行新的自主決策。

## 來源與授權

附件原始全文與SHA-256存於[參考目錄](references/README.md)。附件裡的文獻與物理說法另核對；模型、材質、動畫皆自製，沒有搬用外部模型或照片貼圖。

- [Collective Behavior in Medaka Fish Depends on Discrete Kinematic States of Swimming Behavior](https://pubmed.ncbi.nlm.nih.gov/40766704/)：2026-09-07核對摘要。支持連續身尾波動、可區分加速／減速／等速，以及社會反應隨運動狀態改變。摘要指出等速期的社會反應最強；本任務「快速轉場暫時提高alignment」是美術設計，不能說是該論文量測的權重。
- [Biological motion stimuli are attractive to medaka fish](https://pubmed.ncbi.nlm.nih.gov/24141876/)：支持同種生物運動資訊可引發群聚反應，運動的平滑性與自然速度有影響；不從此推出任意程序boids就是生物機制。
- [NIBB研究介紹](https://www.nibb.ac.jp/press/2013/12/09.html)與[NBRP實驗手冊入口](https://shigen.nig.ac.jp/medaka/strain/laboManual.jsp)作物種資料入口，不重發布其圖像。
- 3–4.5 cm、速度／加速、群體事件頻率、顏色比例、避障體積均是任務書與場景的美術預設，沒有聲稱量測野生族群或特定品系。模型是青鱂形態近似，未做分類學或性別鑑定。

## 製作與轉換契約

- 母魚Blender +Y朝頭／+Z朝背，glTF轉為Three -Z朝頭／+Y朝背，單位公尺。窄身、小尾、後置背鰭／臀鰭、胸鰭、較大的小型魚眼；避免錦鯉厚身和觀賞長尾。
- `assets/blender/scripts/medaka/`保留可重建來源；`medaka_quiet_rain_shoal.blend`應含22隻的120秒根部／骨架keyframes，打開播放不需live Python。
- `public/models/medaka.glb`為共享母魚，網站clone獨立骨架，幾何／材質資源明確管理。`medaka-motion.bin`與JSON metadata保留相同行為軌跡。
- binary為Float32LE、frame-major、30fps、22魚、stride12：position xyz、quaternion xyzw、speed、integrated tail phase、normalized speed q、state index、normalized acceleration。網站以elapsed取樣，暫停與seek不累積狀態。
- 2–7 Hz尾擺、後半身振幅包絡、個別phase與加減速胸鰭變化屬運動學近似，非流體、肌肉或真實魚鰭力學求解。
- 避障採植物莖葉的簡化體積、牆／地邊界和鄰居分離，不對每片動態葉三角形求碰撞。不能把簡化距離檢查寫成精確動態碰撞證明。

## 驗收項目

1. 實際GLB尺寸、骨架、權重、連續游動和前後段變形比例；近距離三視角。
2. 120秒行為狀態、快慢速度、錯開反應、領先者輪換、分離／牆地／植被避障、光暗跨越及循環接點。
3. Blender重新開檔／keyframe播放、網站相同elapsed同姿態、往返seek、切換離場資源釋放。
4. 主場景實際尺度的魚群可讀性、白天／月夜、雨後／太陽雨、橫直式預覽、兩分鐘連續播放。
5. 本機測試與browser證據不等於使用者美術確認、實體手機效能或發布。


## 2026-09-08 本機實作與驗收

- 原創母魚實測全長0.03808 m、562 vertices、1034 triangles、11 bones，包含實際 `COLOR_0`、`JOINTS_0`、`WEIGHTS_0`。權重總和誤差約3e-8，無未加權頂點；頭端側向位移0、尾端約0.448 mm。母魚2 Hz／1秒循環與runtime在0、0.125秒逐骨比對通過。
- 22隻實際長度3.233–4.400 cm；15銀橄欖／3淡奶色／3深色／1淡金。使用共享幾何、獨立骨架，眼與薄鰭均為原創mesh，沒有emissive。
- 120秒／30 fps／3601幀的同一份motion供網站與Blender使用。九狀態皆出現；群體事件在16、43、70、96秒，分別18、11、13、10隻参与，initiator各異，個體反應延遲約0.055–0.107秒。並非每次都是全群衝刺。
- 最終路徑峰速0.221 m/s、峰加速度0.350 m/s²。近停留最低約0.00055 m/s，仍持續擺尾；尾頻實測1.996–6.637 Hz（為循環相位閉合有不足0.005 Hz的調整）。速度與加速度由最終位置差分計算，未用截斷欄位掩蓋軌跡尖峰。
- 鄰居steering之後，使用固定4.5 cm高低泳層及整條路徑的橫向平移，把魚限制於植物外側安全區；這是避免碰撞的美術編排，犧牲部分自由垂直群游，不宣稱完全自主的即時boids。植物聚集數0–16，有8次跨越聚集門檻的進出。
- 最近中心距4.26 cm；簡化有向body-capsule淨距最小3.193 cm，植物簡化體積內樣本0。此證據不能代表逐葉精確碰撞。9隻進入解析日光區，43與96秒事件有陰影→光→陰影的完整通過。
- 低速路徑切線可能快速反轉，魚身使用提前0.133秒的平滑heading、約360°/s yaw上限；網站直接slerp已烘焙的quaternion，與Blender一致。低速時容許短暫側滑，避免原地瞬間翻頭；此處仍是運動學近似。
- `npm test` 27/27、TypeScript/Vite build通過。三輪實際場景載入各30 geometries／74 textures，離場各歸零且scene children=0；雨後、太陽雨穩定暫停幀逐像素一致。切換雨態首幀有63 channels的settling，後續同elapsed無變化，未把首次配置差異隱藏成完全無差異。

證據入口：`exports/medaka-review/behavior-evidence.json`、`asset-*.png`、`test-log.txt`、`build-log.txt`。腳本入口見 `assets/blender/scripts/medaka/README.md`。使用者次日美術驗收、實體手機、分類學精準度與發布均未完成。


魚體共用場景PMREM環境探針，反射強度0.08×daylight，無獨立發光貼圖或額外魚群聚光燈。探針由場景統一釋放。此強度服務暗處的低調可讀性，陰影中不保證每條魚都看得清楚。


最終室內探針版本在1280×720、14:00、rain=.65連續120.002秒／12993幀：平均108.27 FPS、幀間隔P50 8.3 ms／P95 16.7 ms、130 draw calls／40760 triangles；console error 0。數值僅代表此桌機本次運行，不是實機手機預算保證。完整readback見 `exports/medaka-review/browser-evidence.json`。


Blender正式檔 `assets/blender/medaka_quiet_rain_shoal.blend` 已完成烘焙並重新開檔驗證：22 rigs／22 bodies／22 actions，每action 54 FCurves、每曲線3601 keys，範圍0–3600。保存於frame0；頭尾根位置相同，實測長度縮放最大誤差2.20e-9 m。母魚集合隱藏但保留、overview camera／controller／debug存在，無外部圖片缺失。詳見 `exports/medaka-review/asset-bake-evidence.json`。本機修改保留於 `codex/afterlight-courtyard`，沒有提交或發布。


## 2026-09-08 晨間可見度修訂

使用者同意保留小魚尺度、拉近鏡頭並增加植物前光區停留。最終路徑以低／高泳層的整段位置調整增加入光機會；光區樣本3304→7504（2.27倍，13魚），43與96秒仍有暗→光→暗的通過。植物簡化體積穿透0、body-capsule最小淨距0.03193 m、峰速0.221 m/s、峰加速度0.35 m/s²。未強行把魚一直固定在亮區。魚體PMREM強度0.08→0.45乘daylight，保留原始尺寸、骨架與零emissive；相機前推25%的轉換見場景頁。本次資料取代上方舊路徑光區統計，來源及母魚形態不變。


晨間可見度最後另補植物前方魚體的局部diffuse間接光（非emissive），距離與法線依賴；參數及網站／Blender的差異詳見場景頁。此補光讓轉身時的銀灰側腹在實際尺度下可讀，不改魚身長度。


## 2026-09-08 使用者指定三角群游與1.20倍魚身

本輪取代原來「不放大」與部分自由群游的美術限制：個體長度一次乘1.20，實際3.880–5.280 cm；12尾圓角三角區域往返、3尾常駐植物旁光區巡游、7尾沿用鬆散行為。閉合Catmull-Rom路線與30/40/60秒週期是明確編舞，不能再把全部22尾描述為純粹鄰居決策結果。三區座標、光區最低數、camera控制與完整驗收見場景頁最新節。新尺寸用於網站、Blender與body-capsule驗證；28 tests/build通過。


## 2026-09-08 保留基準後的少量增補

使用者確認喜歡的基準已先保存於 `f3f2d5a`。本輪22→26尾，前22尾逐幀binary與個體metadata均與該commit完全相同；原場景GLB、母魚GLB、相機與光影設定不變。新增4尾在植物前方x≈1.30、z≈.03、y=.40/.55/.70/1.20 m以24/30/40/30秒小橢圓巡游，長4.56 cm，固定低速尾頻2.2–2.65 Hz；是美術編舞，非新增生態行為模擬。重建須保有上述Git基準commit。26尾Blender骨架已同步，每action54 curves、3601 keys，首尾root與bin誤差0。

驗收：26尾全程capsule最小淨距.02219 m、簡化植物體積穿透0，動畫與runtime測試通過。
