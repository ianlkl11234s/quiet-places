# 2026-09-15／潮風商店街／街道尺度及遠海共用

- 狀態：本地候選，待使用者評估。
- 使用者回饋：馬路、右側房屋不自然；詢問海的製作是否與其他海景相同。
- 基準：`codex/last-arcade`／`da4283f`上的未提交場景；[baseline](../../../exports/last-arcade-street/baseline/)保存生成器、遮蔽、runtime、母檔與GLB。
- 固定：原相機、左側商店、植物來源、風幅、1280×720、14:00、elapsed12 s、曝光1.08。
- 變因：道路橫坡／對側人行道／海岸T接；右側房屋入口、窗孔和不同基地；遠海共享波斜率、Physical水反射。數值權威為last_arcade.py的street_context與Sea.ts；全部場景尺寸為美術假設。
- 重現：Blender生成器 `--views hero,wide,structure`；網站 `/tests/last-arcade-study.html?hour=14`。

| 候選 | 證據 | 判斷 |
| --- | --- | --- |
| baseline | [前](../../../exports/last-arcade-street/baseline/browser-after.png) | 道路平、沒有對側步道；同一盒狀房屋重複；海只有兩個sin法線 |
| street / shared sea | [後](../../../exports/last-arcade-street/browser-after.png) | 道路及入口尺度更易辨識，海岸銜接成立；使用共用波的遠景法線與水IOR，仍無幾何浪高 |

## 結論

本地採用新版空間與海材質。原海面並非完全沒有反射：MeshStandardMaterial已用環境PBR；本輪增加的是共用波浪、適合水的IOR與非金屬表面校準。不同場景的室內焦散／雪景天空不可一起複製。

實際GLB道路／窗洞射線、獨立海面視角的動態像素與資源回收通過，詳見 [驗收](../../../exports/last-arcade-street/gpu-result.json)。測試及build僅為本地證據，使用者接受、實機和發布尚未完成。場景筆記同步；共同光照原則未改。
