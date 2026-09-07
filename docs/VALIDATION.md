# 驗收紀錄

目前整合基準為 `27e597f`，三景整理、完成版海光與生物文件已由 [PR #2](https://github.com/ianlkl11234s/quiet-places/pull/2) 合併。17項測試、Build與本機三景切換驗收通過；正式部署與實機效能未驗證。以下保留各階段的當時狀態。

## 第一版驗收 — 2026-09-06

## 已完成

- 主 agent 決定視覺與介面、整合與調光；兩位 Terra 分別完成 Environment、FishSchool；Luna 整理 PROJECT_SPEC。
- 本機 `npm run build` 通過：TypeScript + Vite 7.3.6。JS 約 517 kB / gzip 131 kB，有 Vite 500 kB 單 bundle 提示，不影響建置。
- 時間系統 1,440 個分鐘樣本皆為有限且有界數值，午夜首尾連續、日夜亮度差與格式檢查通過。
- 最終整合 Node smoke：9 尾魚、3,000 幀、27,000 次有限值／活動邊界檢查；dt=0 暫停不改位置；dispose 後 scene children=0。
- Codex 內建瀏覽器實看 1280×720 與 390×844：水面、光束、限定區域的牆地焦散、魚群與浮塵可見；手機設定面板未溢出。
- 瀏覽器操作確認：月夜切换後 23:00、暫停與繼續、回到日光 12:00；音訊按鈕開／關狀態；本地時間同步顯示 22:34。最終預覽恢復為 14:00，音訊關閉。
- 最終瀏覽器 error/warn log 為空。

## 本次修正

- 修正過大的浮塵、幾乎消失的 box 光束、只產生亮點的焦散場、過暗空間、過亮圓形 spotlight 地面。
- 以共用矩形投射遮罩繪製空間受光與焦散；地面與左牆形成連續光區。
- 修正魚群逐尾原地改寫共用 lightTarget，改以 scratch vector 運算；降低聚合力以增加留白。

## 尚未達成／未驗證

- 與參考圖的寫實度仍有明顯距離：焦散網路較規則、光束為半透明平面、魚體較簡化，材質沒有真實掃描細節。
- 魚體沒有投影焦散。水、光束、魚的受光為分開的感知近似，沒有完整光線追蹤。
- 手機只做瀏覽器尺寸驗收，未以實體 iPhone／Android 量測 FPS、發熱或耗電；沒有自動 GPU 品質分級。
- reduced-motion、背景節流與 WebGL context loss 路徑已實作並讀碼核對，未故障注入／系統設定切換測試。
- 音訊測試僅確認可啟動且無錯誤，沒有進行聽感驗收；全螢幕未跨瀏覽器驗收。
- 未部署；build 成功與本機瀏覽器證據不代表正式站驗收。

## 下一輪

優先把 M2 光影推近參考圖：不規則焦散、水面高光、牆面長光痕與光束柔度。待藝術方向獲得使用者回饋，再決定是否製作 GLTF 魚模型與更進階體積光；維持空間留白，不增加裝飾。

## 水面第二輪 — 使用者要求半透明與天空雙層

- 移除水面 Voronoi 分格，改用連續 domain-warped 波場梯度計算高光與 Fresnel；固定水面邊界以消除開口接縫。
- 在水面上方 1.3 m 新增獨立程序式天空／薄雲平面，水面使用透明混合；天空只允許從天窗開口看見，避免房間外側露出天空。
- 牆地焦散改為連續曲線聚焦，減少多邊形框線。
- 桌面及 390×844 手機尺寸實看；最終瀏覽器 error log 為空，build 通過。
- 透明天空與水面高光已分層；目前折射仍為程序式視覺近似，尚未對真實背景做 screen-space refraction。

## 水波第三輪 — 自然度

- 依使用者回饋，把等量交叉波與較強 domain warp 改為 12 個頻帶的定向波譜；長波主導，小波幅度遞減、傳播速度不同。
- 降低表面法線誇張度、透明度隨高光變動的幅度，並加入螢幕導數平滑高光，減少白色塊狀反光。
- 保留天空雙層與半透明；手機尺寸前後畫面已實看。視覺自然度仍待使用者主觀確認。

## 90° 環繞與體積光 — 2026-09-06

- 依使用者要求加入天窗垂直軸左右各 45° 的 OrbitControls，鎖定俯仰、距離、平移；滑鼠與單指拖曳，另有重設按鈕、左右鍵與 Home。
- Node 檢查角度 clamp、固定 radius/polar 與 reset 通過；桌面左右端點、手機尺寸拖曳實看。
- 使用者指出轉向後光影不自然：Terra 將平面光簾改為房間 bounds 內 raymarch；主 agent 整合成 48 次取樣、空間擾動消除條紋，並依回饋加強耶穌光。
- 焦散以受光面座標取樣細節，保留天窗 world-space aperture mask，修正牆面拉長與地面平行線。
- 限制：尚未加入完整深度貼圖，魚與霧前後遮擋仍是近似；實體手機效能未量測。房間為原先開放剖面幾何，寬畫面端點仍可看到外緣。
- 基準 tag `v0.1-water-sky` 保留；本輪改動經使用者確認效果後提交保存。

## 光束強度控制

依使用者要求新增 0–250%「光束強度」滑桿，100% 為目前預設；只乘算體積光，不更動天空、時間與牆地焦散。瀏覽器確認 0% 無光束、250% 明顯加強，數值即時更新。Build 通過。

## Quiet Places 集合設計 — 2026-09-06

本次為文件交付：PROJECT_SPEC 改為集合產品規格，原水光規格搬至 docs/scenes/waterlight.md；新增 ARCHITECTURE 與 SCENES，README 成為統一入口。檢查五份文件的本機連結與 code fences、git diff whitespace 通過；src／index.html／package 與 lockfile 無變更，因此沒有重跑 shader 或宣稱集合 runtime 已驗證。

集合首頁、路由、場景 adapter、切換生命週期與雨窗／樹影均尚未實作。水光的已接受版本仍為 `b0e28cd`，早期 tag 保留；本次文件尚未提交或公開發布。

## GPU 水面第一階段

新增 HalfFloat ping-pong 線性波動 solver，GPU 7,201 次更新／脈衝／暫停／reset／固定步長／renderer state 檢查通過，詳細數值與非完整流體的邊界見 [WATER_PHYSICS.md](WATER_PHYSICS.md)。既有耶穌光與環繞保留；集合設計文件的未提交改動保留。此實驗未提交。

## 水膜感修正

擾動改為局部下凹與補償波環；降低背景波幅，加入弱四階色散及鏡射 ghost 邊界。新版 GPU 7,201 更新、reset／暫停／固定步長／renderer state 檢查通過。更細微的波動已整合，主觀自然度與可辨識度待使用者回饋；詳见 WATER_PHYSICS.md。


## 2026-09-07 過夜整合驗收

- Terra 調魚材質低強度填光與分離；主線保留9尾魚，瀏覽器兩侧環繞實看。
- 視角後方擴成封閉觀看區，保留原後壁與受光左壁；手機比例兩端與寬畫面初始視角未見原房間外緣。幾何為擴張的觀看區，不是改相機90°上限。
- 晴／雨同一場景可切換，雨勢控制可用；標準／節能品質可切換。雨日為同房間天候變體，非獨立玻璃雨窗。
- 重載驗證還原雨日、節能、光束150%、音量0%；沒有自動播放。驗收結束還原晴日、標準、100%、音量35%。
- 四曲以音量0解碼：播放進度分別達0:09/3:39、1:37/3:08、0:26/4:00、0:09/3:38，切曲成功。此為解碼與進度證據，不是聽感品管。
- 偏好單元測試：損壞JSON、未知版本、storage throw、非有限/超界、2.5光束roundtrip通過。沒有持久化播放狀態。
- Build與git diff --check通過；瀏覽器無error。已知bundle >500kB warning保留。
- GPU原7,201次及新增1,800次连续雨滴檢查通過；數值見 WATER_PHYSICS.md。
- 主頁暫停可操作鏡頭、恢復；背景取消RAF。標準30fps/PR1.5（手機1.25），節能24fps/PR1/24次體積光；未宣稱實際手機耗電/FPS達標。
- CPU抽樣dev server PID13912約0.5%；無法把共用Codex renderer全部CPU歸因本場景。此不是整機CPU上限證明。
- 本次預覽與GPU測試分頁全部關閉；沒有留下壓測。08:00前由heartbeat低頻抽樣。

## 2026-09-07：直牆房間與鏡頭碰牆停止

- 水景房間改為 8 × 16、高 7 的長方形，移除為 90° 軌道向兩側加寬的觀看區；保留天窗、受光牆與起始鏡頭。
- `WaterRoom.ts` 共用牆界，計算包含起點的連續安全軌道；OrbitControls 的拖曳、阻尼與方向鍵共用邊界。標準畫幅相對世界方位約 −21.31°～21.31°；起點偏右，因此兩側剩餘轉角不對稱。
- 距牆至少 0.35；超寬畫幅依 near plane 尺寸增加距離，resize 會重新收緊邊界。仍禁止平移、縮放與俯仰。
- `npm run build`、既有 preferences 測試及新增 `tests/water-room.test.ts` 通過。後者檢查 16:9、390:844 與 8:1 畫幅，沿整段軌道取樣 near-plane 四角、兩側越界、大幅輸入與無效起點。
- 本機瀏覽器驗收：桌面兩側連續方向鍵、Home、390×844 預覽的雙向拖曳、停點與反向離牆，均未見穿牆。此為桌面瀏覽器模擬畫幅，未宣稱手機實機驗收。

## 2026-09-07 窗景擴充

- `npm run build` 通過；既有主 bundle 超過 500 kB 警告仍存在，新窗景與 ZIP 模組 lazy load。
- `node --experimental-strip-types --test tests/window-places.test.ts`：3 passed，0 failed。
- Preferences 經 NodeNext 編譯後執行通過，加入場景保存。
- 實際瀏覽器：海光→水光→樹影可切換；水光顯示 GPU 水面波動模擬；暫停後仍可操作；八圖生成成功並能返回原空間。
- `exports/window-series/manifest.json` 記錄八張 1024×1536 PNG 的 SHA-256；ZIP 內每張與磁碟一致、八圖雜湊不同，主 agent 逐張視覺檢查。
- 臨時 localhost 接收服務僅用於把 runtime Blob 保存到 repo，已停止並移除前端臨時呼叫；正式 UI 匯出再次驗證通過、不依賴接收服務。
- 目前美術比參考圖更程序化，樹葉形狀與焦散仍需使用者主觀驗收。沒有完整物理光照、實機手機或 production 驗證。
- 本任務預覽 tabs=[]，dev server 最後唯讀抽樣 0.6% CPU；這不是整機 CPU 或即時上限保證。


## 品牌統一、SVG 與 README — 2026-09-07

- 在 `codex/waterlight-shallow-sea` 更新品牌為 Quiet Places／靜隅；獨立 worktree 更名為 `/private/tmp/quiet-places-shallow-sea`。套件和 lockfile、網站文案／title、runtime 名稱與現行產品文件同步。
- SVG XML 解析通過，網站 favicon URL 與實際 SVG 顯示確認。README 三張 JPEG 為本機正午、1280×720、標準畫質的真實畫面，海光採半窗水位；位於 `docs/images/`。
- 樹影第一次載入遇到開發服務依賴快取問題；重啟 Vite 並重新建立快取後可正常呈現。沒有以錯誤畫面或合成圖取代截圖。
- 偏好設定測試涵蓋舊 key 遷移、新 key 優先、遷移寫入失敗仍可讀舊設定，暫存編譯後執行通過。`npm run build`、README 本地連結和 `git diff --check` 通過。
- 初次驗收為本地 worktree；使用者後續已授權開 PR 並合併。發布狀態依 GitHub 合併與部署結果確認。

### PR 前驗收

偏好遷移、水景相機邊界、Ocean 光學／光子與場景生命週期測試均通過；TypeScript／Vite 建置通過。`docs/DEPLOYMENT.md` 沿用本機接手用途，不納入公開提交。


## 三景目錄與共用元素整理 — 2026-09-07

- 工作分支 `codex/shared-scene-elements`，以已合併的 `2938a59` 為基底，另保留原工作區13檔的當時快照。原工作區仍持續製作；本分支不包含快照之後的改動。
- 三景集中到 `src/places/<scene-id>/`；場景契約、水體數學、LCG 亂數與模型資源所有權分別抽到 `player/`、`shared/`。水光 GPU 取樣含專屬天窗座標，保留在場景內。
- `npm test`：16 passed、0 failed；涵蓋水體數值與 shader 約定、亂數序列、模型資源去重／釋放、場景生命週期、偏好與相機邊界。魟魚測試使用 fixture，不能證明真實資產可接入。
- `npm run build` 與 `git diff --check` 通過；既有主 bundle 超過500 kB提示仍存在。本輪未執行獨立 browser GPU 壓測 `tests/water-gpu.ts`。
- 本機瀏覽器1280×720實看水光、樹影、海光（窗下與半窗）；同頁水光→樹影→海光切換成功，暫停按鈕變為「繼續流動」並可恢復。error／warn log為空。截圖保存於 `exports/shared-scene-review/`；動畫時刻不同，不作逐像素等同比較。
- 快照魟魚GLB缺少骨架動畫clips，整理前海光載入失敗；草稿與母檔保留，正式海光入口暫不接入。這是已知資產相容性限制，不是模型驗收通過。
- 本輪整理後已由 PR #2 合併至 main；部署未驗證；沒有新增實機手機效能或完整物理光照驗證。


## 完成版海光與生物資料整合 — 2026-09-07

- 依使用者指示在 `codex/shared-scene-elements` 整合海光完成版：兩隻骨架魟魚、方向性天空／地板反射、修正側緣頂點色的模型、7秒漲退潮。沿用已整理的場景介面與共用模型資源所有權；未改其美術與游姿數值。
- 13檔穩定來源快照見 `exports/shared-scene-review/ocean-completed-source-snapshot.json`。GLB SHA-256 `e5909d095f4c09971b35e917e7c8b16e3a3468405b798373da8837d24bc89061`，實際讀回8 clips／72 joints，模型詳細清單見同目錄 `stingray-asset-readback.json`。上輪「缺clips而停用」狀態已解決。
- `npm test` 17 passed、0 failed；實際GLB蒙皮／非靜止鰭動畫／loop endpoints通過，另驗證獨立骨架、暫停、釋放及借用floor/volume不被魟魚回收。潮汐測試包含初始preset、7秒過渡、同elapsed暫停、重選位置連續與海面／水色／魟魚受光同步。
- `npm run build` 通過，54 modules；既有主bundle大於500kB提示保留。文件連結與 `git diff --check` 通過。
- 本機Codex瀏覽器1280×720：半窗兩隻魟魚可見，切至全淹完成、暫停／恢復可操作，海光→水光→樹影→海光載入成功；error／warn為空。畫面見 `exports/shared-scene-review/oceanlight-stingrays-submerged.jpg`。
- 新增 `docs/biology/` 索引、魟魚製作頁與附件原文存檔；區分需求、原始研究、藝術近似、已實作及驗收。原文SHA與附件一致，未把81項條款列為全部完成。
- 本輪未重建Blender資產、未做新生物、實機效能或完整物理驗證；整合已由 PR #2 合併至 main；部署未驗證。


## Repo 收尾 — 2026-09-07

- 主要資料夾統一使用 `main`。三個已合併worktree已移除；海光原始製作提交以 `archive/oceanlight-approved-2026-09-07` tag保存，整合後程式仍以main為準。
- 更新現行文件的合併狀態；保留早期比較稿的歷史文字並標明其時序。錦鯉與程序魚群補上獨立生物製作頁。
- 本機 `docs/DEPLOYMENT.md` 原樣保留，透過 `.git/info/exclude` 本地忽略，不上傳。舊開發預覽服務已停止。
- 本輪僅文件與Git工作區整理，檢查本地文件連結、whitespace及版本一致性；未修改runtime，因此未重跑場景／GPU測試。
