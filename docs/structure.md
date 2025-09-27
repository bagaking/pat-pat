---
layout: default
title: Inte-pat / Feat-pat / Session
nav_order: 2
---

# Inte-pat / Feat-pat / Session

Pat Pat 的协作模型拆分为三层：

1. **Inte-pat 主干**  
   - 分支命名：`pat-pat/<inte>/__inte__`（默认 `<inte>` 为 `integration`）。  
   - 「Bootstrap inte-pat」会检测旧式 `pat-pat/<inte>` 分支并自动 `git branch -m` 迁移，生成 `.pat-pat/<inte>/__inte__` worktree。  
   - inte session 主要用于集成与回归验证，运行命令可通过 `Run session`。

2. **Feat-pat 子线**  
   - `New feat-pat` 从 inte 主干 fork 新分支 `pat-pat/<inte>/<feat>`，绑定 `.pat-pat/<inte>/<feat>` worktree。  
   - 默认生成一个 `feat` session，可按需增删/重命名（直接编辑 `state.json` 或未来扩展）。

3. **Session**  
   - 是终端任务的最小粒度。`Run session` 会复用/新建终端并执行启动命令，`Edit start command` 用于配置命令。  
   - `Configure feat-pat` 可一次性调整图标、配色、启动命令；运行中的 session 会即时更新。  
   - `Remove feat-pat` 会安全地：关闭终端、`git worktree remove`、`git branch -d/-D`、清理 `.pat-pat` 状态。

## 状态文件结构

`state.json` 记录以下关键字段：

- `id`：层级唯一标识（如 `integration/checkout`）。
- `branch`：对应 Git 分支，会自动升级为 `pat-pat/<inte>/__inte__` 系列。
- `worktreePath`：相对路径，便于多机器共享。
- `terminals`：session 数组，包含 `name`、`status`、`startupCommand`。

## 维护与诊断

- `Diagnose sessions` 会在 Output Channel 中输出每个 session 的自检结果（缺少分支、worktree、目录、未提交更改、状态不一致等）。
- `Remove feat-pat` 应在确认 worktree 清洁后执行；若检测到未提交更改会要求使用 Force 选项。
- 手工删除 `.pat-pat` 时，只需重新执行 `Bootstrap inte-pat` + `Diagnose sessions` 即可恢复干净状态。

## 合流流程建议

1. feat session 完成开发后合回 inte session。  
2. inte session 验证无误后合入主基线。  
3. 使用 `Remove feat-pat` 清理多余 worktree / 分支 / state。
