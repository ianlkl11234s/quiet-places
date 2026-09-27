# 驗收腳本

這些是 2026-09 畫質改善輪實際使用過的腳本，新場景和畫質迭代都可以直接用。流程見 [畫質迭代工作流程](../../docs/production/QUALITY_WORKFLOW.md)。

| 腳本 | 用途 | 範例 |
|---|---|---|
| `capture.sh` | 在 headed、隔離的瀏覽器 session 拍四時段（晨曦、正午、暮色、月夜），1600×900，自動隱藏 UI，輸出各時段 png 與 `<scene>-grid.jpg` | `bash scripts/review/capture.sh 6180 cap exports/<id>/after snowwindow stairlight` |
| `perf.sh` | 開 `tests/waterlight-performance.html?place=<id>`（真實 app 與 composer，5 秒暖機加 15 秒取樣），每個場景輸出一行 jsonl | `bash scripts/review/perf.sh 6180 perf out.jsonl waterlight leaflight` |
| `perfcmp.py` | 比較兩份 perf jsonl：fps、p95、CPU、三角面、draw calls、貼圖數 | `python3 scripts/review/perfcmp.py main.jsonl branch.jsonl` |

前提：
- 先起 dev server：`npx vite --host 127.0.0.1 --port <port> --strictPort`。
- 需要已安裝 `agent-browser`，以及 python3 加 PIL。

注意：
- 一次只跑 1 個 session，腳本結束時會自動關閉瀏覽器。
- 同時最多 2 條工作線開瀏覽器，這是記憶體限制。
- 平行時每條線用不同的 session 名稱，而且一定要用 `--session`，**不要用** `--session-name`。後者會共用同一個分頁，拍到錯的場景。
- 時段按鈕的 id 是 `dawn`、`noon`、`sunset`、`moonlight`（月夜不是 `moon`）。
- 網站的 fps 上限是 30，比較時主要看 fps 有沒有掉、CPU p95，以及三角面和 draw calls。
- 在 main 上量效能時，另開一個指向 main checkout 的 dev server，其他條件（port 以外）都一樣。
