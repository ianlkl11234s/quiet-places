# Long-fin Koi School

可編輯母檔：`assets/blender/long_fin_koi_school.blend`。網站資產：`public/models/long-fin-koi-school.glb`。這是原創程序造型與運動學近似，沒有下載模型或照片貼圖，也不是流體、肌肉或生物實測重建。

## Blender MCP 製作

本次使用 Blender 5.1.2 與 Blender MCP 實際建立、驗證、渲染和匯出。先核對目前場景並備份未儲存工作；generator 只新增自己的 scene，不執行 factory reset。同名 `LONG_FIN_KOI_SCHOOL` 已存在時會拒絕重建，避免套用到錯誤集合。

透過 MCP 執行，將 REPO 換成目前 checkout 的絕對路徑：

```python
import sys
from pathlib import Path
REPO = Path('/private/tmp/quiet-places-long-fin-koi')
sys.path.insert(0, str(REPO / 'assets/blender'))
from long_fin_koi_school import build_all
result = build_all.build_geometry()
```

接著分次呼叫 `build_all.bake_one(i)`，i=0..6；所有動畫都完成後：

```python
import bpy
from long_fin_koi_school.scene_layout import setup
from long_fin_koi_school.school_controller import place
setup()
build_all.create_master()
result = place([bpy.data.objects[n] for n in bpy.context.scene['rig_names']])
result = build_all.save_and_export()
```

`build_all.build()` 可一次執行上述步驟。背景 CLI 理論入口仍可用下列指令，但本機背景程序曾崩潰，本次驗收證據是 MCP，並非 CLI：

```sh
blender --background --factory-startup --python assets/blender/long_fin_koi_school/build_all.py
```

母檔以 `bpy.data.libraries.write(..., compress=True)` 只寫本場景與依賴，不覆寫目前開啟的 Leaflight 檔案或其場景。

## 模組與資料

- `config.py`：公尺、秒、24 fps、七尾 palette／size、八個 clip durations。
- `koi_master_geometry.py`：沿用 `../scripts/koi.py` 的閉合截面、UV、眼、口、兩對鬚、鰓蓋、曲面鰭與鰭條，做長鰭座標轉換。
- `koi_master_rig.py`：24 骨、連續加權、多段胸鰭、同材質 mesh 合併。
- `koi_materials.py`：packed 原創低飽和花紋、腹面明度、細鱗 normal、薄鰭。
- `koi_animation.py`：尾端增强的 tangent wave、延遲鰭動作、週期 phase、原地 Actions／NLA。
- `koi_variants.py`：實際 body/depth/tail/pectoral shape variants，不只改屬性名稱。
- `school_controller.py`：120 秒固定步長群游 bake、鬆散聚合、避近、光柱回拉、高度偏好、八狀態与 1.5 秒重疊的 NLA 編排。
- `scene_layout.py`：暗室、方形天窗、程序雲、體積散射、65 個微粒與主／側／俯視斜角相機，以及中性近照。
- `validation.py`：實際 vertex weights、有效控制骨、八 Actions、首尾接縫與有限值。

Blender `+Y` 朝頭、`+Z` 朝背；glTF Y-up 後 `-Z` 朝頭、`+Y` 朝背。名義 master body .29m + tail .09m；實際造型按變體略有差異。網站重新量 GLB 的 bounds，將七尾設定為 .28/.31/.34/.37/.39/.42/.45m。

## 調整與重烘焙

母檔 `KOI_MASTER` collection 預設隱藏，內有獨立可編輯 master rig/meshes；`KOI_VARIANTS` 為七個可見 rig。

單魚支持 `body_wave_frequency`、`body_wave_amplitude_ratio`、`wave_count`、`pectoral_frequency`、`tail_follow_lag`、`motion_seed`。變更後在 `koi_animation.make_actions(rig)` 重建該 rig 的八個可重用 tracks；若要更新已編排的 NLA，再呼叫 `school_controller.install_behavior_tracks(rig)`。幾何比例在 generator params 調整後重建，並非即時 mesh drivers。

群控 `KOI_SCHOOL_CTRL` 的 school_radius、cohesion、separation、alignment、wander、beam_confinement、vertical_spread、group_center_offset、global_speed_scale、global_motion_seed，以及個體 preferred_speed/depth、beam_affinity、pause_tendency 由 `place(rigs, controller=ctrl)` 重新烘焙。這些是烘焙控制，修改欄位不會自動重新求解。120 秒世界路徑為開放序列；八個單魚 Actions 本身皆無縫循環，沒有把開放路徑冒稱 loop。

匯出時暫移除本 generator 的 `KOI_PERFORMANCE_*` tracks、將 rig 放回原點，只匯出七尾與八個 `KOI_ACT_*` tracks；再還原世界路徑與 NLA，保存母檔。Three.js 以實際 subtree node names 篩選每尾的 tracks，不假設匯出器的重名骨 suffix。

## 渲染／網站驗收

`scene_layout.studio()` 準備中性單魚檢視，再選 `CAM_STUDIO_SIDE`／`CAM_STUDIO_TOP`／`CAM_STUDIO_3Q`。用 MCP `bpy.ops.render.render('INVOKE_DEFAULT', write_still=True)` 啟動，確認 render job 結束後再開始下一張；最後 `restore_hero()`、`build_all.save_scene()` 回到場景並保存。

網站薄鰭採 alpha、關閉 depthWrite／transmission，隱藏 subpixel 鰭條，避免光柵化點狀閃爍；Blender 保留細鰭條與少量 transmission。網站重建自己的即時 steering／state blending，沒有播放 Blender 的固定世界路徑。

驗收入口：`tests/long-fin-koi-gpu.html`；`window.longFinReview` 提供 setTime、advance、pause、inspect。完整製作與實測數值見 `docs/biology/long-fin-koi.md`，資產／browser／tests／build 證據見 `exports/long-fin-koi-integration/`。實體手機效能、完整動態鰭面碰撞和正式發布尚未驗證。
