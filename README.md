# Quiet Places／靜隅

<img src="public/favicon.svg" width="64" height="64" alt="Quiet Places 標誌">

收集日常裡可以安靜停留的角落。

Quiet Places／靜隅是一組持續增加的即時 WebGL 場景。目前可以走進三個角落：水面把日光拆成波紋、枝葉將午後投進房間，或從窗前望向緩慢起伏的海。

![水光之間](docs/images/waterlight.jpg)

## 場景

| 場景 | 描述 |
| --- | --- |
| 水光之間 | 天窗上方的淺海、室內水光與少量魚群；可切換晴日與雨日。 |
| 樹影午後 | 窗外枝葉、斜向日照、烘焙間接光與近地面錦鯉。 |
| 海光之室 | 從室內觀看程序式海面；可比較窗下、半窗與全淹三種水位。 |

![樹影午後](docs/images/leaflight.jpg)

![海光之室](docs/images/oceanlight.jpg)

截圖來自本分支的本機預覽，1280×720、正午、標準畫質；海光使用半窗水位。

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

- 由「調整空間」切換場景、時段與各場景專屬設定。
- 在畫面拖曳觀看；鍵盤 `←`、`→` 旋轉，`Home` 回到初始視角。
- 可暫停流動、重設視角與使用全螢幕；音訊預設不播放，須手動開始。

## 專案結構

- `src/places/`：三個場景各自的入口、光照與動態。
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

### GA4

評估 ID 為 `G-Z8F8X5C7WC`，由 `src/systems/Analytics.ts` 載入 Google tag。僅正式建置且 hostname 為 `quiet-places.itsmigu.com` 時啟用；localhost、開發模式與其他網域不載入。ID 為公開識別碼，無須設定 secret。

- `page_view`：由 Google tag 初始化自動送出，場景切換不另外送 pageview。
- `scene_view`：初始場景及成功切換；參數 `scene_id`、`entry`（`initial`／`switch`）。圖片批次輸出的切換不記錄。
- `ambient_audio_toggle`：環境聲成功切換；參數 `scene_id`、`state`（`on`／`off`）。
- `music_play`：音樂成功開始／恢復播放；參數 `scene_id`、`track`（內建音檔路徑）。不代表獨立聽眾數或完整聽完。

停用 Google signals 與廣告個人化訊號。需要在 GA 報表按場景細分時，於 GA 後台建立事件範圍自訂維度 `scene_id`；其他參數按報表需求新增。改正式網域時也須更新程式的 hostname 限制。

2026-09-07 獨立 worktree 驗收：TypeScript／Vite build 與 17 項既有測試通過；模擬 DOM 驗證正式網域限制、開發排除、重複初始化與事件佇列通過。Chromium 開啟本機正式建置，確認 localhost 不載入 GA、無 Google 請求。另用瀏覽器 DNS 映射將正式 hostname 指向本機，並以測試伺服器 CSP 阻擋 Google 腳本與收件，驗證初始場景、切換至樹影、環境聲開／關及音樂成功播放的事件名稱與參數。這是本機事件驗收，不是場景材質完整視覺驗收或 Google 收件證據。尚未部署此變更；部署後需在正式網站操作，再以 GA 即時報表確認事件收到。

[開啟 Quiet Places／靜隅](https://quiet-places.zeabur.app/)。主分支合併後由既有部署流程更新；README 截圖對應此 repo 的本機驗證版本，線上版本以部署結果為準。
