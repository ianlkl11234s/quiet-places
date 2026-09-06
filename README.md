# Quiet Places／靜隅

> 可以進去待一會的靜謐空間集合。

集合架構已完成設計；目前可執行的是第一個場景 **水光之間／Waterlight**。集合首頁、場景切換與其他場景仍待實作，本機目錄與 package 名稱暫保留 `stillwater`。

水光之間是即時 WebGL 靜謐空間。Vite + TypeScript + Three.js；無 React、後端或外部素材下載。兩張參考圖僅保存在 docs，畫面由幾何與 shader 即時生成。

## 設計文件

- [集合產品規格與交付順序](PROJECT_SPEC.md)：使用流程、設定語意、P0–P5 與驗收。
- [技術架構與遷移設計](docs/ARCHITECTURE.md)：共用播放器、場景介面、切換與資源生命週期。
- [場景目錄](docs/SCENES.md)：水光、雨窗、樹影，以及後續候選。
- [水光之間原場景規格](docs/scenes/waterlight.md)：從舊 PROJECT_SPEC 搬移，保留藝術方向。

## 開啟目前場景

需要 Node.js 22.12+（本機驗證使用 23.10.0）。

```sh
npm ci
npm run dev -- --port 5188 --strictPort
```

瀏覽器開啟 http://127.0.0.1:5188/ 。正式建置 `npm run build`，建置預覽 `npm run preview`。

## GPU 水面實驗（尚未提交）

新增 GPU 高度場波動、天窗輕點擾動與水面重設，保留原本耶穌光與環繞。這是小幅水面波的物理模型，不是完整三維流體。詳見 [WATER_PHYSICS.md](docs/WATER_PHYSICS.md)，GPU 檢查入口為 `/tests/water-gpu.html`。

## 體驗

- 初始為 14:00 日間。右下角「調整空間」可選晨曦、日光、暮色、月夜或任意時刻。
- 「跟隨本地時間」使用裝置時鐘；不是依經緯度計算的天文太陽位置。
- 「光束強度」可在 0–250% 調整耶穌光，100% 為預設，不影響天空與時間。
- 可暫停流動、開啟低音量程序式環境聲、進入全螢幕；音訊預設關閉。
- 滑鼠或單指拖曳可繞天窗左右各 45°，不開放平移、縮放或俯仰；設定中的「重設視角」返回起點。聚焦畫面後也可用左右方向鍵與 Home 操作。介面閒置後淡出，移動、觸碰或鍵盤操作可喚回。
- 頁面進入背景停止動畫與音訊；尊重 reduced-motion 初始暫停。手機限制 pixel ratio。

## 結構

- `src/world/Environment.ts`：空間、水面、投射遮罩、焦散、光束與浮塵。
- `src/world/FishSchool.ts`：9 尾程序式魚、轉向、分離、聚合、光源吸引與擺尾。
- `src/systems/`：時間狀態與程序式環境聲。
- `src/main.ts`：renderer、輕量 bloom、受限環繞鏡頭、操作與生命週期。
- [PROJECT_SPEC.md](PROJECT_SPEC.md)：集合設計契約與交付階段。
- [docs/original-brief.txt](docs/original-brief.txt)：完整原始描述。
- [docs/VALIDATION.md](docs/VALIDATION.md)：驗收證據、限制與下一步。

目前是本機原型，未部署、未 push、未建立雲端服務。視覺追求感知近似；水面、焦散與體積光並非物理正確模擬。
