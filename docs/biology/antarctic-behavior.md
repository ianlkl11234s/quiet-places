# 南極玻璃魷魚 × 南極銀魚：雪光長廊行為

## 狀態、來源與權威

2026-09-13，本機 `snowhall` 現以銀魚為唯一重心，魷魚數量設定為 0；魷魚模型、行為能力、參考與筆記保留，並未刪除。使用者於 2026-09-13 確認現行銀魚版本；合併與部署證據另列。三份使用者需求原樣保存在 [references/antarctic](references/antarctic/03-antarctic-behavior-system.md)，其引述文獻未於本輪重新核實。原創程序模型無外部模型／貼圖素材；物種形態依提供的規格作近似，不宣稱博物館級重建。

- [AntarcticBehavior.ts](../../src/places/snowhall/AntarcticBehavior.ts)：純模擬、排程、空間與插值。
- [snowhall-biology.json](../../assets/config/snowhall-biology.json)：速度、事件間隔、魚群大小、避讓、光場等 [C] 參數；調整密度不必修改演算法。
- [AntarcticLife.ts](../../src/places/snowhall/AntarcticLife.ts)：實際本體、姿態、lazy fish 建立與釋放；[本體頁](antarctic-models.md)記模型與動態公式。

## 尺度、光與安全

`+Y` 向上、local `+Z` 前進；座標單位沿用既有走廊米制。navigation 從已選定寬／高推導，銀魚 `z=-11.3..6.9 m`（包含鏡頭後方原有走廊），停用的魷魚低處近景候選保留 `foregroundBounds` 設定。每個 agent 的中心還要內縮完整模型 `safeRadius × scale` 加 margin；魷魚半徑 1.70 mantle units、銀魚 .74 body units 以實際變形頂點對 root 原點的距離驗證。不是用包圍盒中心代替模型 root。初始位置、目標與每次更新皆限制在安全體積；相機有 soft repel／保守 exclusion，studio 修改相機／窗／寬度時重建本景生物，沿相同 seed/elapsed 重播。

窗光 `sampleLight()` 包含距離、朝向、窗幅和側牆暗區；它是藝術可見度近似，不是 GI、光度量測或完整遮蔽解算。正式 AreaLight、天空 fill、曝光、雪及建築材質沿用 `641c998` 基準。正式銀魚不再套用此場的額外 radiance 衰減，adapter 傳入 1，直接接受原場景 PBR 光照；不用 emission 或時間 opacity pulse。逆光時以暗輪廓為主，不能把背光魚硬提亮成自發光；魷魚則用低透明曲面、Fresnel alpha、眼部與內臟維持弱形體。

## 行為與時間

- 60 Hz fixed step、整數 tick；render 使用相鄰 position/quaternion 插值。absolute elapsed 可 seek／rewind，30/60/144 FPS 在同一時間重現同一姿態與排程。event、school、每隻 squid/fish、模型相位使用分開 seed streams。
- 魷魚正式數量為 0；保留的行為能力包含 `IDLE_HOVER / SLOW_CRUISE / GENTLE_TURN / DEPTH_ADJUST`；稀疏 Gaussian 微噴射暫時進入 `MICRO_JET_REPOSITION`。平移有速度響應阻尼，heading 以有上限的 yaw/pitch 逐步轉向，非反覆 spline loop。噴射是低階推進近似，未解算水動力。
- `SQUID_APPROACH_LIGHT` 是少量次要事件；`SQUID_CROSS_CORRIDOR` 與魚群 transit 互斥，major 後有 cooldown。`LONG_EMPTY_PHASE` 會阻止新事件並讓魷魚低速回暗區；已在暗處的生物不靠瞬間消失製造空白。
- 銀魚通常 14–28 隻，少見較大群 32–42 隻，上限 50 slots。依使用者 2026-09-13 回饋，取消「一側暗處穿越至另一側暗處再隱藏」。新路徑從鏡頭後方進入，在走廊深處緩彎轉回，再游到鏡頭後方；側牆與窗面不是入口或出口。
- 以 centripetal Catmull–Rom 的弧長參數提供穩定巡游速度，左右入口、進出高度與個體起步延遲各自變化。三種路徑依 seed 起始再輪替：`MEANDER` 深處巡游、`MID_HOVER` 中段低速微動 14–24 秒、`CIRCLE` 中段一圈並伴微量高度變化。每隻魚真的抵達後方終點，且完整安全球位於相機後方平面再多 .25 m（本步與前一步皆成立），才回收 model slot。退場完全不看光場或牆面距離；相機位置及注視方向由正式 layout 傳入。
- 路程延長後保留 1.4 BL/s 速度上限，整群完整活動約 100–123 秒；不再維持舊版 13–18 秒橫向穿越預算。首群排程於 1–3 秒從鏡頭後起游，真正進入畫面仍需游過實際距離。後續間隔縮至 8–18 秒，稀疏空白為 6–10 秒，銀魚成為持續觀賞重心。
- 魚群使用 soft separation、alignment、cohesion、微弱不同步擾動、窗光區略收攏、牆面與種間避讓。通過魷魚時側向輕微分流，route/群聚力使其自然回聚；真正進入距離 gate 才記 `NEAR_PASS`／`SPLIT`，不是每次 transit 都標成互動。魷魚只有微量轉向，不追魚。

以上頻率、速度、距離、光場與事件比例均為 [C] 美術／工程參數，不是物種實測、CFD、捕食模型或生物學驗證。

## 驗收與重現

- `/tests/snowhall-biology.html` 使用正式 factory，可切 seed、elapsed、日夜、1280×720／390×844 畫幅，另有實際本體近看。`跳至` 明確套用時間，PNG 按鈕從實際 WebGL canvas 匯出；不是另一套試片 shader。
- Debug 各項預設關閉：nav、light samples、centroid、neighbor radius、targets、event log、avoidance；正常播放器不建立 debug 幾何／UI。
- [qa.json](../../exports/snowhall-biology/qa.json) 由測試實際生成：10 seeds × 600 秒，模擬 60 Hz、每 30 Hz 輸出取樣檢查完整安全球、速度、四元數、major/empty mutex 與鏡頭後進出。另驗 30/60/144 FPS、fractional rewind、pause、移動相機。這是加速數值 QA，不是看完 100 分鐘 browser 或實機效能證據。
- [antarctic-life.test.ts](../../tests/antarctic-life.test.ts) 另取真正 mesh 變形頂點，檢查走廊牆／地／窗界限、同 elapsed 不漂移及反覆 dispose。模型測試亦檢查法線、非發光與每體半徑。
- 本輪路徑修正數值結果：安靜比例約 49.9–53.4%，每 seed 完成 4 次魚群活動；銀魚峰值不超過 1.4 BL/s，現場魷魚為 0，保留本體測試。比例是定義好的模擬 proxy，不能代替觀賞感受。
- 額外 regression 以 60 Hz 檢查首群全程連續位移、實際進入 `z < -4 m` 深處並返回鏡頭後，禁止牆邊回收與前景 teleport。
- browser、日夜與發布狀態以[場景最新紀錄](../scenes/snowhall.md)為準；未驗證實體手機 FPS、發熱或物種運動學。

## 實體空間與資料留存決策

使用者明確要求牆壁不可穿越、空間只留銀魚一個重心，建模資料留存。不得將側牆暗處視為出生／回收點；相機 collision 用 swept sphere 接觸後切向滑行，避免穿入再投影出去的跳位。所有模型資料仍在原路徑；`count=0` 只停用正式場景魷魚，試片仍可單獨近看。142 項全套測試通過，包含中段實際慢速樣本、實際繞行角度、左右與高度變化、完整幾何及 30/60/144 FPS 重現。
