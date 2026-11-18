# 桌機效能基準（main 5d55318，2026-11-18）

只量測、不優化。原始資料：`baseline.json`（每個場景含既有量測頁輸出、3 次載入各 3 輪的完整數字、彙總）。

## 方法
- 環境：Apple Silicon（8 核 24GB）、Chrome（agent-browser，有視窗）、視窗 2400×1350、DPR 1、品質 standard、本機時間 16 點（live 模式）。使用者同時有其他工作在跑，數字有波動。
- 開發伺服器 `vite --config tests/update-cost.vite.config.ts`（port 5311）。此設定檔只在量測時用：
  把 `catalog.ts` 的 `preparePlace` 包一層，量 `place.update()` 的毫秒數；並在 seabridge／last-arcade／snowhall／snowwindow 的生物更新呼叫外包計時。`src/` 檔案本身沒有被改。
- 既有頁 `tests/waterlight-performance.html?place=<id>`：5 秒暖機＋15 秒取樣，每場景跑 1 次。
- 新頁 `tests/update-cost.html?place=<id>`：同樣 5 秒暖機＋15 秒真實 app 取樣（被動），然後同步迴圈 3 輪：
  1. 繪製：`composer.render()` ×20（場景狀態凍結）＋ `gl.readPixels` 1 像素強迫完成，除以 20。
  2. update：`place.update()` ×60 單獨計時（含生物子計時）。
  3. 合計：`update + composer.render()` ×20 ＋ readPixels，除以 20。
  每場景載入 3 次，表中為 3 次共 9 輪的中位數。
- 沒有使用 timer query；沒有把 requestAnimationFrame 頻率當流暢度（app 本身上限 30fps）。

## 結果（ms）
| 場景 | 繪製 | update 平均／p95（同步迴圈） | update 平均／p95（真實 app 15 秒） | 合計（update+繪製） | <33 ms | draw calls | 三角面 |
|---|---|---|---|---|---|---|---|
| waterlight | 72.2 | 0.35 / 0.50 | 1.18 / 2.00 | 72.1 | 否 | 157 | 309,266 |
| leaflight | 18.3 | 0.02 / 0.10 | 0.11 / 0.20 | 18.1 | 是 | 196 | 302,154 |
| oceanlight | 13.7 | 4.06 / 9.50 | 4.32 / 10.10 | 14.1 | 是 | 80 | 142,490 |
| afterlight | 46.6 | 0.62 / 0.90 | 1.05 / 1.40 | 46.2 | 否 | 747 | 115,720 |
| seaward | 9.5 | 0.44 / 1.00 | 0.66 / 1.40 | 10.4 | 是 | 206 | 17,212 |
| stairlight | 43.4 | 0.05 / 0.10 | 0.17 / 0.30 | 43.3 | 否 | 72 | 516,638 |
| snowwindow | 18.2 | 9.43 / 11.60 | 9.73 / 10.70 | 18.9 | 是 | 191 | 228,556 |
| snowhall | 14.3 | 0.91 / 1.50 | 1.90 / 3.30 | 14.4 | 是 | 146 | 8,786 |
| last-arcade | 13.0 | 6.31 / 8.10 | 7.74 / 14.30 | 16.6 | 是 | 242 | 563,726 |
| seabridge | 27.7 | 0.86 / 2.40 | 1.43 / 4.80 | 27.7 | 是（餘裕小） | 577 | 571,160 |

「合計」欄是同步迴圈直接量到的 update+繪製；它不等於繪製加 update 的算術和（GPU 與 CPU 有重疊，且各自有誤差），兩者差 1 ms 內屬誤差。

## 生物更新佔 update 的比例（有子計時的四個場景）
| 場景 | update 平均 | 生物子計時 平均／p95 | 備註 |
|---|---|---|---|
| seabridge | 0.86 | sardines 1.05 / 2.8（子計時來自 9 輪中位數，略大於整體平均，屬計時誤差） | 400 尾沙丁魚幾乎是 update 的全部；絕對值只有約 1 ms |
| last-arcade | 6.31 | `biology.update` 6.24 / 7.7，其中 `schools.update` 只有 0.35 / 1.0 | 剩下約 5.9 ms 在 biology 內的其他部分（動物模型 `model.update`、`ambient.update`），未再細分 |
| snowhall | 0.91 | `life.update` 0.89 / 1.4 | 銀魚形變等於幾乎整個 update |
| snowwindow | 9.43 | `creatures.update` 6.32 / 7.7 | 其餘約 3.1 ms 來自 exterior／falling／curtains／marineSnow 等，未再細分 |

## 既有量測頁（waterlight-performance）輸出
見 `baseline.json` 的 `existingPage`。app 上限為 30fps，所以 fps≈30 只代表跟得上；waterlight 14 fps、afterlight 22、stairlight 23 才是跟不上。`composerCpuMs.p50`（送指令 CPU）都在 0.4–3.2 ms。

## 限制
- 繪製 ms 為凍結狀態下的 `composer.render()+readPixels`，沿用上次調查的方法；update 為 CPU 時間（`performance.now()` 解析度約 0.1 ms，單次小於 0.1 ms 的 update 精度有限）。
- 同步迴圈與真實 app 的 update 數字有差（真實 app 較高，p95 差更多）：真實 app 的 update 與 GPU 工作交錯，快取與 GC 影響較大。兩組都列出。
- oceanlight 的 update 4 ms 未做子計時，來源未隔離。
- 本機時間 16 點；日夜與天氣會改變部分場景成本，未涵蓋。

## 新增檔案
`tests/update-cost.html`、`tests/update-cost.ts`、`tests/update-cost.vite.config.ts`、本資料夾（`baseline.json`、`README.md`）。
