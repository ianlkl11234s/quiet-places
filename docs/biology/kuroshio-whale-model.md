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
