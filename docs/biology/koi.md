# 錦鯉造型近似製作頁

> 狀態：樹影午後的可重建原創資產與網站接入紀錄。此頁只描述目前模型與動畫；它不是品種鑑定、解剖重建、游姿量測或流體模擬。

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
