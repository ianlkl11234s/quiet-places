# 潮風商店街攀緣植物／原創未定物種

## 狀態與範圍

- 消費場景：[潮風商店街](../scenes/last-arcade.md)。本輪依使用者回饋調低螢光感、改善複製排列；待新版視覺確認。
- 本體：[last_arcade_plants.py](../../assets/blender/scripts/last_arcade_plants.py)，Blender 公尺、Z-up；四個合併 mesh，分為寬葉、草、莖、落葉。
- 場景支撐／生成：[last_arcade.py](../../assets/blender/scripts/last_arcade.py)；葉色、葉型、枝路的數值權威在生成器。非全域通用植物系統。

## 來源與授權

只使用使用者提供的海邊商店街圖片作構圖參考；葉型、枝條、頂點色均原創建模，無下載第三方模型或貼圖。物種、年代、氣候與實際生長速度未知，未以植物學資料核實。

## 生物事實與美術近似

- 造型為未命名攀緣寬葉及草叢，不主張特定物種的葉序、攀附器官或生長習性。
- 成熟／新生／乾枯 palette 是美術色群，不是實測光譜反射率。RGB 為線性頂點色，不能把其數值直接當 sRGB 色碼。
- 根點、攀附柱面、橫向檐口枝路與垂掛以實際場景幾何安排；不做生長模擬。側枝連接主莖，葉柄連接葉根；枝群長度、疏密與成熟度由固定 seed91526 決定。
- 寬葉使用實體曲面、葉脊及捲曲，不靠 billboard 或葉片透明貼圖。side／normal 一起繞葉軸旋轉，維持正交 basis。

## 製作與轉換

- 色彩用 FLOAT POINT `Color`，RGB 供表面色，alpha 是葉根0到葉梢1的風權重。GLB opaque 匯出會省略 alpha，因此生成器另存 FLOAT `_ARCADE_WIND`；runtime 明確讀取，缺失即拒絕資產。
- [建築遮蔽](../../assets/blender/scripts/last_arcade_occlusion.py)另外輸出 `_ARCADE_SKY`：只用靜態建築遮擋、4方向、7.5 m範圍。僅減弱葉片的 indirect diffuse，動態直接陰影不烘焙。幾公分風幅沿用静態可見度，是低頻近似；未算葉群多次散射。
- 網站 [runtime](../../src/places/last-arcade/index.ts) 使用共同 elapsed，world XZ breeze 轉回 mesh local。振幅0.006–0.016 m，正弦參數是美術校準，非受力或生物學驗證；葉根固定、葉梢風權重平方。color／depth／distance pass 共用同一位移。
- 資源由 `prepareLastArcade` 工廠持有；克隆風材質與 depth／distance 材質在 place.dispose 釋放，模型資源則由 shared ModelResources 釋放。

## 驗收與缺口

固定鏡頭前後圖、真 GLB 頂點色／天空可見度／風權重、建築不變檢查與 WebGL 日夜／風／暫停／資源回收記錄在 [本輪證據](../../exports/last-arcade-foliage/)。場景頁記錄最終版本及檢查結果。

未驗證：生物學正確度、所有葉片動態碰撞、手機實機效能、使用者新版美術接受與發布。
