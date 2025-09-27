---
layout: default
title: Inte-pat / Feat-pat / Session
nav_order: 2
---

# Inte-pat / Feat-pat / Session

Pat Pat 的协作模型拆分为三层：

1. **Inte-pat**：需求主干。分支命名为 `pat-pat/<inte>/__inte__`，默认 `<inte>` 为 `integration`。`Bootstrap inte-pat` 会自动将旧版 `pat-pat/<inte>` 重命名，并在 `.pat-pat/<inte>/__inte__` 目录下记录主干 session。
2. **Feat-pat**：子模块分支。通过 `New feat-pat` 从 inte-pat fork 出 `pat-pat/<inte>/<feat>`，对应 worktree 位于 `.pat-pat/<inte>/<feat>`。
3. **Session**：用于执行终端任务的最小单元。inte 默认生成 `inte` session，feat 则生成 `feat` session，用户可在 `state.json` 中持久化启动命令。

终端默认行为与配置：

- `Run session` (`patPat.runSession`)：启动或聚焦 session，自动将图标/配色应用到终端，并执行启动命令。
- `Edit start command` (`patPat.editSessionCommand`)：设置或清空某个 session 的启动命令。
- `Configure feat-pat` (`patPat.configFeature`)：打开图标、配色与会话批量配置对话框，适配运行中 session。

## 状态文件

`state.json` 保留以下关键字段：

- `id`：树结构唯一标识（如 `integration/checkout`）。
- `branch`：对应 Git 分支（自动升级为 `pat-pat/<inte>/__inte__` 格式）。
- `worktreePath`：相对路径，便于在不同机器共享。
- `terminals`：session 数组，包含 `name`、`status`、`startupCommand`。

## 操作流程

1. Bootstrap 主干 → 运行 `Run session` 验证 inte session 环境。
2. New feat-pat → 在子 session 配置启动命令 → 运行 session 开发。
3. 合流：feat session merge → inte session 验证 → 主干合回基线 → 清理 worktree / 分支。
