# Quiet Places／靜隅

<img src="public/favicon.svg" width="64" height="64" alt="Quiet Places 標誌">

收集日常裡可以安靜停留的角落。

Quiet Places／靜隅是一組持續增加的即時 WebGL 場景。目前可以走進六個角落：水面把日光拆成波紋、枝葉將午後投進房間，也能停在天井、階間與向海的隧道。

![水光之間](docs/images/waterlight.jpg)

## 場景

| 場景 | 描述 |
| --- | --- |
| 水光之間 | 天窗上方的淺海、室內水光與少量魚群；可切換晴日與雨日。 |
| 樹影午後 | 窗外枝葉、斜向日照、烘焙間接光與近地面錦鯉。 |
| 海光之室 | 從室內觀看程序式海面；可比較窗下、半窗與全淹三種水位。 |
| 雨後天井 | 潮濕走廊、天井日光、植物與青鱂群游。 |
| 階光之間 | 樓梯窗光、紅繩與緩慢巡游的鯊魚。 |
| 向海的隧道 | 海風、洞口日光與穿過明暗交界的魟魚。 |

![樹影午後](docs/images/leaflight.jpg)

![海光之室](docs/images/oceanlight.jpg)

截圖來自本分支的本機預覽，1280×720、正午、標準畫質；海光使用半窗水位。

## 持續製作

新增房間、調光、換生物或保留實驗，先從[製作入口](docs/production/README.md)開始。這裡連到 MASTER prompt、偏好、可沿用能力、模板與未來工具邊界。

## 本地啟動

需要 Node.js 22.12+ 與 npm。

```sh
npm ci
npm run dev
```

開啟終端顯示的本機網址。正式建置與預覽：

```sh
npm test
npm run build
npm run preview
```

## 操作

- 由底部房間入口召回會緩慢漂移的記憶泡泡；晨曦、正午、暮色、月夜、光線與音樂可直接在薄型控制列調整。
- 在畫面拖曳觀看；鍵盤 `←`、`→` 旋轉，`Home` 回到初始視角。
- 可暫停流動、重設視角與使用全螢幕；音訊預設不播放，須手動開始。

## 專案結構

- `src/places/`：六個場景各自的入口、光照與動態。
- `src/player/contracts.ts`：共用場景介面。
- `src/shared/`：波場／折射、模型資源與可重現亂數。
- `src/systems/`：時間、偏好、音訊與 GPU 波動。
- `assets/blender/` 存放製作來源，`public/` 存放網頁資產，`exports/` 存放驗收輸出。

完整維護入口與新增場景方式見[現行架構](docs/ARCHITECTURE.md)。生物資產的來源、近似邊界與驗收狀態見[生物資料索引](docs/biology/README.md)。

## 技術與文件

Vite、TypeScript 與 Three.js。場景以 lazy loading 切換，同一時間只保留一個活躍的 3D 場景。

- [技術架構](docs/ARCHITECTURE.md)與[場景目錄](docs/SCENES.md)
- [水光之間](docs/scenes/waterlight.md)、[樹影午後](docs/scenes/leaflight.md)、[海光之室](docs/scenes/oceanlight.md)
- [材質與光照製作筆記](docs/MATERIALS_AND_LIGHTING.md)
- [本地音樂素材與授權狀態](docs/AUDIO.md)

樹影場景的模型、Blender 母檔與匯出來源記錄於[場景筆記](docs/scenes/leaflight.md)；海光的波浪／光學設計參考及 MIT 授權連結記錄於[海光筆記](docs/scenes/oceanlight.md)。水、光、海浪與焦散均為即時美術或單次光路近似，不是完整流體或全域光照模擬。

## 線上入口與狀態

[開啟 Quiet Places／靜隅](https://quiet-places.zeabur.app/)。主分支合併後由既有部署流程更新；README 截圖對應此 repo 的本機驗證版本，線上版本以部署結果為準。
