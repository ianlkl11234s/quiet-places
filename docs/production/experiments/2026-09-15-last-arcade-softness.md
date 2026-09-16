# 2026-09-15／潮風商店街／減少生硬的光線與材質

- 狀態：已執行待使用者評估；本地採用候選。
- 使用者回饋：場景尚可，但材質與光照 CG 感偏重。
- 工作區：`/private/tmp/quiet-places-last-arcade`，`codex/last-arcade`，基準 `da4283f`；場景未提交。原主工作區未寫入。
- 基準及退回來源：[baseline](../../../exports/last-arcade-softness/baseline/)，保存原 GLB、Blender、builder、runtime、config 及試片。退回須把資產與 runtime 配套還原，不只改曝光。
- 固定：建築／植物幾何、相機、seed91526、1280×720、14:00、elapsed12 s、pixelRatio1.25；曝光是變因，從基準值調至1.08。
- 變因：環境輻射與道路反射、頂點天空／接觸遮蔽、分材質 roughness／metallic、微法線強度及 UV 尺度。數值權威為場景 runtime、Ambient.ts、建築／遮蔽生成器；非實測物理材質。
- 重現：生成器 `--views hero,wide,detail`；網站 `/tests/last-arcade-study.html?hour=14`，固定既有播放器時間 state 與 shader；不是獨立美術 shader。

| 候選 | 證據 | 判斷 | 使用者回饋 |
| --- | --- | --- | --- |
| baseline | [網站](../../../exports/last-arcade-softness/baseline/browser.png) | 棚下冷黑，均勻斑點，反光偏生硬 | CG 感略重 |
| 高環境／大鏽斑中間候選 | 未保留獨立截圖，不作可重現版本 | 拒絕：灰白、層次變平，鏽斑尺度過大 | 未展示 |
| 收斂候選 | [網站](../../../exports/last-arcade-softness/browser-after.png)、[manifest](../../../exports/last-arcade-softness/manifest.json) | 棚下暖反射、降低漆面反光；保留空間深度。植物及模組仍規律 | 待評估 |

## 結論與驗證界線

本輪選用收斂候選，不改已接受的空間配置。接觸／天空遮蔽只有少量幾何 rays，不含直接光、動葉或完整多次反彈；道路面光沒有遮擋，不宣稱光線追蹤 GI。

build、project harness、單元及真 WebGL 像素／資源檢查分開保留於 `exports/last-arcade-softness/`。GPU測試暖機後再驗證重複掛載，Three 的 renderer 共用 PMREM／LTC cache 不應當作模型洩漏；不放寬重複場景的資源相等檢查。CPU submission 不是實機 fps。

場景頁已同步。新版尚無使用者美術接受、實機效能或發布證據；不更新跨場景偏好。
