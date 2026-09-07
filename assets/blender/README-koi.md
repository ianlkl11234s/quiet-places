# 錦鯉模型與程序骨架

在 repo 根目錄以獨立 Blender 程序重新建立模型、九個 Actions、GLB 與預覽圖：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python assets/blender/scripts/koi.py
```

`koi.py` 負責形體、貼圖、骨架、連續蒙皮、驗證及匯出；`koi_motion.py` 負責參數、程序姿態與 Actions。可編輯母檔是 `assets/blender/koi.blend`；網站載入 `public/models/koi.glb`，其 hash／動作契約在 `koi.metadata.json`。啟動全套 generator 會從空白 scene 重建，不能用來保留手動修改。

## 座標與形體

原生全長預設約 0.55 m；Blender `+Y` 朝頭、`+Z` 朝背，標準 Y-up glTF 匯出後為 `-Z` 朝頭、`+Y` 朝背。根物件 `KOI_ROOT__Native_Y_Forward` 不加額外轉向。

身體是平滑截面與四邊面網格；背、臀、胸、腹、尾鰭為有連續根部的曲面，帶細鰭條。尾鰭是垂直叉尾，使用三節尾骨連續權重；胸／腹鰭在體幹與鰭控制骨間平滑混合，避免根部浮離。眼、唇、兩對口鬚與鰓蓋線按魚身表面定位。形態來源與生物精度限制见 `docs/biology/koi.md`。

## 調整與重新烘焙

`KOI_RIG` 包含 root、body_master、head、五節 spine、peduncle、tail_base／mid／tip，以及 pectoral、pelvic、anal、dorsal、caudal 控制骨，共 20 骨。`caudal_L/R` 分別控制上／下尾葉的少量曲面變形（既有命名是輔助控制名稱）；尾膜主要由 tail_base／mid／tip 連續蒙皮驅動。

參數是**烘焙控制，不是即時 drivers**。在已開啟的母檔修改 rig 的 wave_frequency／amplitude／count、forward_speed、turn、pectoral_frequency／amplitude、body_heave_amplitude／frequency、body_roll_amplitude、swim_depth_offset、tail_follow_gain／lag、organic_variation_amount 與 motion_seed 後，在 Blender Python console 執行：

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(bpy.data.filepath).parent / 'scripts'))
from koi_motion import build_actions, validate_actions
rig = bpy.data.objects['KOI_RIG']
rig['wave_amplitude'] = .45 * .065
build_actions(rig)
validate_actions(rig)
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
```

這保留現有幾何。重新匯出時只選模型與骨架（不含 KOI_ENV），使用 glTF Actions／force sampling／Y-up，並同步更新 metadata；網站控制器的慢游 clock 目前以預設 12 s／9 次擺尾為契約，改變 cycle 數也須調整網站。共用到其他 rig 的同名 Actions 會拒絕重建，避免破壞別的資產。

九個 Actions 使用 `KOI_ACT_` 前綴：IDLE_HOVER、SLOW_CRUISE、CRUISE、TURN_LEFT、TURN_RIGHT、RISE、DESCEND、CIRCLE_SLOW、GLIDE。都有 muted NLA track，慢游為 active action。只有停留、慢游、完整圓游標為 loop；其他移動動作保留起迄差異。網站只使用原地慢游，路徑負責世界位置／朝向，避免 root travel 重疊。

## 材質與驗收

五種 Blender 材質為 `KOI_MAT_KOHAKU`、`SANKE`、`SHOWA`、`GOLD`、`WHITE`（名稱皆含 `KOI_MAT_` 前綴）。替換 KOI_BODY 的材質 slot 可選擇花紋。1024×512 程序花紋及 512×256 細微鱗片 normal map 均 packed 在母檔；網站 GLB 含預設 Kohaku 與 normal map。圖案為美術近似，沒有鱗片數量／品種鑑定宣稱，也沒有照片貼圖。鰭透明度為視覺近似。

`exports/koi-review/` 是 Blender 中性三視角與動作幀；`tests/koi-gpu.html` 是網站 GLB 的上視／側視／斜視三圈播放檢查；`exports/koi-integration/` 保存實際模型讀回、測試、build 及正式場景路徑的本機 browser 證據。Node 蒙皮測試只讀 embedded PNG header，不解碼像素；貼圖像素與 shader 由 browser GPU 檢查。

運動是可重現的運動學與室內編舞；未實作流體、肌肉、浮力、自主避障或生態行為。Blender 九個 Actions 不等於網站自動切換九種行為的 state machine。
