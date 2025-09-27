---
layout: default
title: Commands & Shortcuts
nav_order: 3
---

# Commands & Shortcuts

| Command ID | 面板入口 | 作用 |
| --- | --- | --- |
| `patPat.bootstrapIntegration` | Sessions 树工具栏 / 命令面板 | 初始化或迁移 inte-pat 主干分支与 worktree |
| `patPat.newFeatPat` | Sessions 树工具栏 / 命令面板 | Fork 新的 feat-pat 分支，生成对应 worktree 与 session |
| `patPat.runSession` | Session 节点、状态栏、命令面板 | 启动 / 聚焦 session，应用图标配色并执行启动命令 |
| `patPat.editSessionCommand` | Session 节点上下文 / 命令面板 | 设置或清空 session 的启动命令 |
| `patPat.configFeature` | Feat-pat 节点上下文 / 命令面板 | 批量配置 feat-pat 的图标、配色与所有 session 的启动命令 |
| `patPat.removeFeatPat` | Feat-pat 节点上下文 / 命令面板 | 归档 feat-pat（保留数据，可选清理 Git 分支） |
| `patPat.archiveFeature` | Feat-pat 节点上下文 / 命令面板 | 将 feat-pat 移动到 `.pat-pat/.archived`，可选删除 Git 分支 |
| `patPat.diagnoseSessions` | Sessions 树工具栏 / 命令面板 | 输出诊断报告，检查分支 / worktree / session 状态是否一致 |
| `patPat.openFeature` | **兼容命令**：老版本工作流入口，内部会委托给 `patPat.runSession` |
| `patPat.killAll` / `clearAll` / `abortAll` | Sessions 树工具栏 | 批量关闭 / 清屏 / 发送 `CTRL+C` 给所有终端 |

## 快捷提示

- Session 节点 Tooltip 会展示 `startupCommand`，方便确认自动执行的脚本。  
- 状态栏按钮会聚焦当前运行的 session；若没有，则提示选择。  
- `Diagnose sessions` 使用专门的 Output Channel 输出详情，便于复制 / 留存诊断结果。  
- Pat Pat 会周期性检查分支 / worktree 是否仍然存在，异常时自动标记为 missing。

## 手工操作备忘

- 若手工删除 `.pat-pat`，请重新运行 `Bootstrap inte-pat` + `Diagnose sessions`。  
- 删除 feat 分支前，先执行 `Remove feat-pat` / `Archive feat-pat` 将工作树归档，再手工处理 Git 分支。  
- `.pat-pat/.archived` 用于存放归档副本，确认无用后可手动清理或做进一步迁移。
