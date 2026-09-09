# 窗光、反射與空氣散射：復用手冊

2026-09-09，本機樓梯間 rear 版本已接入；非完整 GI／流體或量測校準。程式入口為 `src/places/stairlight/WindowTransport.ts`，接線在同目錄 `index.ts`。目前仍是場景專用模組；第二個場景使用時再抽共用，不能直接搬樓梯間邊界。

## 光路分工

| 光路 | 實作 | 不包含的項目 |
|---|---|---|
| 天空 → 靜態建築，以及天空經建築反射 | Blender Cycles DIFFUSE DIRECT+INDIRECT，關閉所有燈；2K線性 EXR | 太陽、太陽反射；時刻改變時的重新路徑追蹤 |
| 太陽／月光 → 建築、鯊魚、繩子 | DirectionalLight + PCFSoft shadow，2048／節能1024 | 物理日曆天文位置、玻璃折射 |
| 太陽／月光 → 第一個表面 → 周圍物件 | 窗洞3條分層射線，實際三角形第一命中，3個廣角 SpotLight 近似漫反射 | 精確面光源積分、完整多次太陽反射、逐像素反照率 |
| 天空 → 動態鯊魚／繩子 | 窗面積、距離與受光方向近似 | 動態物體的完整天空GI |
| 光 → 空氣 → 視線 | 在物體表面shader內，沿相機至表面的視線積分，使用同一太陽shadow map判斷照明 | 多重散射、真實氣膠分布、反射光造成的體積散射 |

所有項目在 tone mapping 前以線性值合成。不可將含太陽反射的烘焙再與目前反射模組疊加，否則重複能量。PBR不等於完整光線追蹤。

## 接入順序

1. 確認單位公尺、GLB世界座標、窗為開放洞口或玻璃。此場景是開放窗洞。
2. 烘焙靜態天空光，記錄DIRECT／INDIRECT／COLOR pass。此EXR不帶albedo，網站以lightMapIntensity乘π對接Three的diffuse換算；UV翻轉與線性色彩設定見index.ts。
3. 建立直射光及shadow camera，包住所有牆、樓板、活動物件；確認密合邊緣沒有漏遮。
4. `createWindowTransport(room, sun, rear)`，將回傳root加入scene。`room`只能包含靜態接收建築，不把鯊魚当作反射光源。
5. 在原本材質onBeforeCompile設定完成後，對建築、動態物件呼叫 `attach(object)`。它串接既有shader，不覆蓋天空lightmap或蒙皮。限MeshStandardMaterial與目前Three shader chunks。
6. 每次播放器update，先更新sun方向／強度／色彩，再呼叫 `update(incoming, lowQuality, elapsed)`。incoming是光前進的世界座標單位向量。
7. 統一由場景dispose呼叫transport.dispose；沒有額外RAF。關閉測試分頁。

## 參數與近似

- rear窗：中心(−.269,3,4.10)m，2.5×2m。3條射線x偏移−.72／0／+.72m、y=3m，起點z=4.11m。側窗另有入口，不能沿用rear幾何驗收。
- 反射權重：sun.intensity × 入射面餘弦 × 窗投影餘弦 × 窗面積/3/π × .55。色彩乘代表性線性反射率(.43,.37,.28)。.55是美術校準，非量測；粗取樣不能視為能量守恆解算。
- SpotLight：最大距離5m、半角.47π、penumbra=1、decay=2，離第一命中點沿法線偏移.035m。3张256²陰影，會遮擋樓板／牆壁並隨動態物件更新；動畫／光照改變時另增加3個shadow pass，暫停且時刻不變時重用陰影。低解析、近平面與有限取樣仍可能有偏差。
- 空氣：σ_s=.008 m⁻¹、σ_t=.012 m⁻¹、各向同性phase=1/(4π)，僅為清淡室內空氣的美術值，並非台北灰塵量測。高品質12步、節能6步，最多8m；取樣受限於樓梯間內框x[−1.67,1.24]、y[−5.49,4.99]、z[−1.09,4.09]m。
- 空氣判光為單次shadow texture取樣；可見不透明表面提供視線終点，避免隔牆疊光。背景、透明多層、跨多房間及超過8m視距不在此實作範圍。
- shadow depth補償是光柵近似：建築／鯊魚在RGBA深度打包前加1.5倍局部像素斜率。不是把baseColor加白，也不是emissive。

## 換場景必做

重新設定洞口尺寸／朝向、射線採樣、散射空間邊界、最大視距、接收材質代表色、陰影範圍。三條射線遇到細窗框可能使反射隨時間跳變；新場景若明顯應改更密集面積取樣或時段烘焙，不把加強均勻環境光當作修正。多窗、玻璃、強鏡面、水面需另外建立光路。

## 驗收與效能

- `npm test`：window-transport測試驗證射線第一命中、上方樓板攔截、零光源與資源釋放。
- `npm run build`：TypeScript及bundle；不代表GPU shader編譯成功。
- `tests/stairlight-gpu.html?window=rear`：真正GPU材質編譯、反射開關像素差、四時段、牆角回歸、投影與釋放。
- `tests/shark-review.html?window=rear`：固定秒數12、時刻6.5／12／18／23，反射光勾選對照，检查繩子暗面、鯊魚頭部、牆腳與樓板。預覽頁會持續渲染，完成必關。
- 新增3個低解析shadow pass及每片段6／12次深度取樣；不能宣稱零成本或手機已驗收。先在目標手機測幀時間，再決定是否降低步數／反射數量；不要以提高曝光取代降級。
