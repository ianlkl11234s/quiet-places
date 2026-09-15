# 2026-09-15／潮風商店街／葉色與複製生長感

- 狀態：本地採用候選，待使用者評估。
- 偏好來源：使用者指出「葉子的顏色遠看有點螢光」，以及生長排列像複製。
- 基準：`codex/last-arcade`／`da4283f`，未提交場景候選；[baseline](../../../exports/last-arcade-foliage/baseline/)保存先前母檔、GLB、植物腳本、runtime及manifest。
- 固定：相機、建築、全景光照、曝光1.08、seed91526、1280×720、14:00、elapsed12 s、pixelRatio1.25。
- 變因：[植物生成器](../../../assets/blender/scripts/last_arcade_plants.py)的palette／枝路／群聚／葉尺寸；[天空可見度](../../../assets/blender/scripts/last_arcade_occlusion.py)及runtime葉片indirect diffuse。參數是美術值，不是物種或反射率測量。
- 重現：生成器 `--views hero,wide,detail`，網站 `/tests/last-arcade-study.html?hour=14`，驗收用 `/tests/last-arcade-gpu.html`。

| 候選 | 證據 | 判斷 |
| --- | --- | --- |
| baseline | [前](../../../exports/last-arcade-foliage/baseline/browser.png) | 葉色鮮亮、左右同高葉團規律；使用者要求修改 |
| 442葉 | [稀疏候選](../../../exports/last-arcade-foliage/sparse-rejected.png) | 退回：葉色已沉穩，但植物份量太少、枝路仍直 |
| 664葉／8株 | [後](../../../exports/last-arcade-foliage/browser-after.png) | 選用：曲折附著枝路、局部密集側枝、深綠葉群與留白；待使用者評估 |

## 結論與驗證界線

47組建築position streams不變。147單元測試、build、project harness及13類真WebGL檢查通過，詳見 [證據目錄](../../../exports/last-arcade-foliage/)。低頻天空可見度不含動葉遮擋或完整多次反射；風色彩與深度／距離pass一致，沒有增加独立時鐘。

本輪源碼與數值已回寫植物、遮蔽生成器及runtime；場景頁與生物頁已同步。回退需使用baseline GLB、母檔、植物腳本與runtime成套還原；不只調回全景曝光。未更改跨場景偏好，未提交或發布。
