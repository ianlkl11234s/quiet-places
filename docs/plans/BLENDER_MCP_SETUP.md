# 官方 Blender MCP：Codex 安裝與驗證

2026-09-07。使用者在規劃後追加授權安裝 [Blender Lab 官方 MCP](https://www.blender.org/lab/mcp-server/)，並明確同意啟用 Blender 的 Allow Online Access。這是環境設定，不代表開始場景建模。

## 已安裝

- Blender 5.1.2，既有互動程序 PID 16179。
- 官方 add-on 1.0.0，安裝至 `bl_ext.user_default.mcp`（User Default extensions repository）。
- add-on SHA-256：`838c3449f01015c861290658ae67f122f0846f7882f60a5dfda0ef7e6a9b8403`。
- 官方原始碼：`https://projects.blender.org/lab/blender_mcp.git`，安裝快照 commit `4309a39646e644261624bfcd2bca669b343b7621`，package 1.0.0。不是同名 PyPI 社群實作，也不是未固定版本的 uvx 啟動。
- 獨立環境：`/Users/migu/.local/share/blender-lab-mcp/venv`；原始碼保留在同層 `source/`，官方 ZIP 同層保存。
- 初次安裝解析到 MCP SDK 2.1.1，官方 server 使用的 FastMCP v1 API 因此無法啟動。已限制 `mcp[cli]>=1.2.0,<2`，實際安裝 1.29.1；完整版本見同層 `requirements.lock.txt`。

Codex 使用 `codex mcp add blender` 新增，全域設定為：

```toml
[mcp_servers.blender]
command = "/Users/migu/.local/share/blender-lab-mcp/venv/bin/blender-mcp"

[mcp_servers.blender.env]
BLENDER_MCP_HOST = "127.0.0.1"
BLENDER_MCP_PORT = "9876"
```

設定檔為 `~/.codex/config.toml`；修改前備份是 `config.toml.before-blender-20260907-102455`。既有 MCP 設定語意保留；CLI 序列化時省略原本 `node_repl.args = []` 空陣列，等價於預設無參數，未移除其他 server。

Blender Preferences 已保存：Allow Online Access 開啟，官方 MCP host 為 `127.0.0.1`、port `9876`、Auto Start 開啟。官方 add-on 即使使用 loopback 也要求 Online Access；已先說明此為 Blender 整體網路權限，再取得使用者確認。沒有建立對外 HTTP 服務或排程。

## 驗證結果

1. `codex mcp get blender` 顯示 enabled、stdio、正確執行檔。
2. 官方 Python MCP SDK 使用相同執行檔與 env，完成 initialize、list_tools：26 個工具。
3. `get_objects_summary({})` 回傳 `status=ok`、`isError=false`：Scene、Layout、active Cube、Camera 與 Light；與目前 GUI 的預設場景一致。
4. `lsof` 確認 Blender PID 16179 僅監聽 `127.0.0.1:9876`。
5. 未執行建模、刪除、渲染或保存 `.blend`。安裝過程切換過右側 Console，已恢復 Properties。Preferences 保存不等於保存場景。

可重跑的唯讀檢查：

```sh
/Users/migu/.local/share/blender-lab-mcp/venv/bin/python \
  /Users/migu/.local/share/blender-lab-mcp/check_connection.py
```

此檢查有 35 秒 timeout，讀場景摘要後 MCP client 退出，不讓測試常駐。

## Codex 載入狀態與後續

**設定、server 啟動與 Blender 端到端讀回已通過；當前既有任務的可呼叫工具清單仍沒有 Blender。** 這兩件事不可混為一談。請重新載入 Codex／建立載入新設定的任務，再確認工具清單有 `blender` 並呼叫唯讀摘要。不自動關閉 Codex，以免打斷使用者其他工作。

下一次只讀工具清單／摘要即可驗收客戶端載入，不必重裝或重建模型。未來升級先保留快照，再做同一連線 smoke；避免再次解析到不相容的 MCP SDK 主版本。

## 停用與回復

- Codex 停用：`codex mcp remove blender`，再重載客戶端。不還原整份全域設定以免覆蓋其他新改動。
- Blender 停用：Preferences → Add-ons → MCP → Stop MCP Bridge Server；取消 Auto Start 或停用該 add-on。
- 若要恢復原本離線設定，關閉 Allow Online Access；它會影響所有 Blender 擴充，不是只影響 MCP。
- 不自動刪除獨立安裝目錄，也不停止使用者的 Blender。

來源：[Blender 官方安裝頁](https://www.blender.org/lab/mcp-server/)、已下載官方 source 的 `mcp/README.md`、`mcp/blmcp/tools_helpers/connection.py`、`addon/blender_mcp_addon/__init__.py`，以及 [Codex MCP 文件](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。
