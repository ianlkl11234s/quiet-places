# 雪光長廊：返工回顧與防再犯規則

這份紀錄只整理本次製作中造成誤判或返工的做法。現行視覺、空間與生物基準仍以[場景頁](../../scenes/snowhall.md)頂部摘要為準；歷史畫面和測試數字不能覆蓋最新狀態。

## 發生過的錯誤

| 現象 | 當時的錯誤 | 真正原因 | 下次固定做法 |
| --- | --- | --- | --- |
| 走廊不像住宅內部 | 第一版只按畫面節奏，把三扇門都放在右側 | 忽略門後應有房間、兩側牆面的建築語意 | 建模前先畫俯視關係；門、窗、牆厚與可能房間要能說明。住宅走廊至少檢查兩側是否合理，不只看正面構圖 |
| 平地板被看成凸台 | 先連續降低 DirectionalLight 強度，沒有先檢查光斑邊界 | 窗洞投影形成亮度過度均勻、輪廓銳利的多邊形，視覺把它讀成有厚度的幾何 | 遇到「凸起／凹陷」先檢查 mesh 輪廓、遮擋、陰影與亮度邊界。若是陰天或積雪反照，優先試與開口一致的面光及連續衰減，不在錯誤的光源模型上只調強度 |
| 使用者想調空間時才開始整理參數 | 走廊、窗、相機與雪粒徑最初分散為硬編碼 | 正式場景沒有可套用、可驗證的單一 layout contract | 對仍在構圖階段的程序房間，早期建立 typed baseline、validator 與 apply helper；正式房間和試片共用同一套幾何計算，不複製第二個場景或 shader |
| 放大雪粒容易被誤說成真實尺寸 | shader point size 原本只有固定值 | 畫面粒徑、粒子密度、速度和物理雪片直徑是不同語意 | 尺寸倍率獨立命名並限定範圍；文件明列它只改畫面 point size，不同步改數量、降速、風偏，也不宣稱物理直徑 |
| 舊驗收一度跟著新版本保留 | 光與 layout 改動後，舊 browser 敘述及測試總數未立即失效 | 把 build、browser、使用者確認與發布當成同一種完成狀態 | 每次 baseline 改變都逐項重設證據狀態；更新實際測試數，另列 browser viewport／時刻／elapsed。試片可用不等於正式房間已驗收，使用者確認也不等於部署 |

## 本機預覽操作失誤

- zsh 會把未引用 URL 裡的 `?` 當 glob；`curl 'http://127.0.0.1:PORT/?place=snowhall'` 必須引用完整 URL。
- 不假設上一輪 dev server 還活著。交付 URL 前先確認實際 server 輸出與 HTTP readback；既有 script 已帶 `--host` 時，只追加 `--port PORT --strictPort`。
- sandbox、外部 dev process 與 Browser 可能看到不同的 process／port 狀態；以當次啟動輸出及 Browser 實際開啟的 URL 分別記證據，不自行拼成同一狀態。
- Browser 停在 Chromium network error 或 `data:` 頁時，不在錯誤頁反覆 reload；建立乾淨分頁後重新導向 localhost。跨工具回合若 handle 已失效，重新取得 browser／page。
- HMR 過渡期間的 console error 不能直接當成現行錯誤，也不能略過；以乾淨分頁重新載入，再讀一次 console 和畫面。
- 持久文件使用 `/tools/snowhall-studio/` 等相對入口；日期化驗收紀錄才寫當次 port，避免把易變的 `5207`／`5208` 當正式契約。

## 收尾檢查

1. 讀場景頁頂部摘要，確認本輪沒有恢復已拒絕的候選。
2. 核對空間語意、光路與材質，而非只確認畫面沒有報錯。
3. 試片採用後回寫正式 baseline，再驗正式 `/?place=snowhall`；不可用工具預覽代替。
4. 固定 viewport、時刻、elapsed、品質與 seed；動到其中一項，就標示舊比較不可直接沿用。
5. 分開記錄 test／build／project check、Browser、使用者美術確認、實機與發布。
6. commit 前列出確切包含範圍；共享 dirty worktree 中不 broad stage，也不改寫其他 session 的未提交成果。
