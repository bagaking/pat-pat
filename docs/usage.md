---
layout: default
title: Commands & Shortcuts
nav_order: 3
---

# Commands & Shortcuts

| Command ID | 面板入口 | 作用 |
| --- | --- | --- |
| `patPat.bootstrapIntegration` | 顶部命令面板 / Sessions 树工具栏 | 初始化或迁移 inte-pat 主干分支与 worktree |
| `patPat.newFeatPat` | 顶部命令面板 / Sessions 树工具栏 | 基于 inte-pat fork 出 feat-pat 分支并创建 worktree |
| `patPat.runSession` | Session 节点、状态栏、命令面板 | 启动 / 聚焦指定 session，按配置执行启动命令 |
| `patPat.editSessionCommand` | Session 节点上下文 / 命令面板 | 设置 session 启动命令，留空则下次启动不执行命令 |
| `patPat.configFeature` | Feat-pat 节点上下文 / 命令面板 | 批量配置图标/配色/启动命令，运行中 session 会立即更新 |
| `patPat.openFeature` | 状态栏、命令面板 | **向后兼容**：在 `patPat.runSession` 引入之前的历史命令 |
| `patPat.killAll` / `clearAll` / `abortAll` | Sessions 树工具栏 | 清理所有终端（关闭/清屏/CTRL+C） |

## 快捷提示
- Session 节点显示 `startupCommand`，方便确认自动执行内容；运行中的 session 图标会转为 `sync~spin`。
- 状态栏按钮默认运行当前活动 session，若无运行中会提示选择。
- 当 `.pat-pat/state.json` 被删除时，Pat Pat 会自动重建并升级旧的分支命名。
