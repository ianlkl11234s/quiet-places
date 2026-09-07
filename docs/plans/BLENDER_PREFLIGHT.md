# Blender 規劃前探測

2026-09-07；只讀和獨立背景測試，無正式建模／渲染／保存。

後續更新：使用者已另外授權官方 MCP 安裝，server 與 Blender 讀回成功。下文保留安裝前探測歷史；目前狀態見 [BLENDER_MCP_SETUP.md](BLENDER_MCP_SETUP.md)。

| 檢查 | 結果 | 可以與不可以推論的事項 |
|---|---|---|
| Git | 開始時 main 工作樹乾淨；從 3416f7c 切至 plan/blender-scene-pipeline | 既有版本可回退，規劃另分支 |
| Blender 安裝 | `/Applications/Blender.app/Contents/MacOS/Blender`，5.1.2、build ec6e62d40fa9 | 可執行，不代表 GPU／渲染已驗證 |
| Blender 執行中 | pgrep 顯示 PID 16179；CUA 視窗為 `Untitled - Blender 5.1.2` | 可能有未保存工作，不清空、不覆蓋 |
| 可呼叫工具 | 本任務工具清單搜尋 Blender 為零，沒有可用工具搜尋器能載入 Blender | 本任務目前無 Blender MCP 工具；不是斷言使用者從未安装 |
| 設定檢查 | Codex config、Cursor MCP、Claude global MCP 的 server 名稱沒有 Blender；標準 5.1 scripts/extensions 目錄不存在 | 只檢查已知位置，其他 profile、非標準路徑或其他客戶端仍可能有安裝 |
| 常見 MCP 連接埠 | `lsof -nP -iTCP:9876 -sTCP:LISTEN` 無 listener | 只代表該埠無 listener，不證明所有可能端點都不存在 |
| UI 探測 | CUA 可取得 Blender 視窗標題；該次讀取約 310 秒 | UI 方法可見，但延遲高；未讀到 MCP add-on 面板或已連線狀態 |
| 隔離 Python 測試 | 沙箱內 background 啟動 exit 139；相同非渲染探測在獲准沙箱外 exit 0 | 發生一次環境相關啟動失敗，不能歸咎場景；不碰原 GUI 程序 |
| glTF | `bpy.ops.export_scene.gltf.get_rna_type().identifier == EXPORT_SCENE_OT_gltf` | 匯出入口存在；尚未匯出／重開／網頁載入 GLB |
| Cycles | 預設 add-on 名稱有 cycles；`hasattr(bpy.context.scene, "cycles") == True` | 設定存在；未切換 engine 渲染，未驗證 GPU。初次查 bpy.types.CyclesRenderSettings 為 false，不用該查詢判斷不可用 |
| 保存／渲染 | `bpy.data.filepath` 空；無 render 呼叫、無 save 呼叫 | 不產生 .blend 或渲染圖，不影響開啟中的場景 |

執行背景探測的參數：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python-expr '<只讀 bpy 能力查詢>'
```

`--factory-startup` 只作用於獨立背景程序，未保存偏好或檔案；測試程序自行退出。

## 下一輪的 MCP 連線驗證

確認使用者實際安裝的 MCP 名稱／來源／客戶端與 Blender add-on。確認服務 endpoint 及工具載入後，先用 read-only scene info 讀回版本、當前場景名稱、物件數及是否已保存；不以能看到 Blender 視窗替代 MCP 呼叫成功。若設定需改動，明確記錄差異及來源；不猜插件、不覆寫既有配置。

若 MCP 暫不可用，獨立 Blender Python 可作製作替代，但要標示「CLI 路徑」，不能稱為 MCP 測通。GUI 未保存工作保持原狀。
