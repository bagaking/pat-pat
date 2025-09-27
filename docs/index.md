---
layout: default
title: Pat Pat Docs
nav_order: 1
---

# Pat Pat Docs

Pat Pat 是一个围绕 Git worktree 的 VS Code 扩展，用来编排 inte-pat / feat-pat / session 的协作流程。本手册采用 `just-the-docs` 主题，整体风格参考 Hugging Face 的技术站点。

## 快速上手

1. **Bootstrap inte-pat**：初始化或迁移主干分支（重命名为 `pat-pat/<inte>/__inte__`），并写入 `.pat-pat/<inte>/__inte__` worktree。  
2. **New feat-pat**：从 inte-pat fork 出子分支 `pat-pat/<inte>/<feat>`，生成 `.pat-pat/<inte>/<feat>` worktree 与默认 `feat` session。  
3. **Run session**：在 Sessions 视图或状态栏运行某个 session，终端会自动套用图标/配色并执行启动命令。  
4. **Edit start command**：为 session 配置启动脚本（可为空）。结合 `Configure feat-pat` 可批量调整图标、配色、启动命令。  
5. **Diagnose sessions**：随时运行诊断检查，确保分支、worktree、状态文件保持一致。

进一步的细节与命令说明，请见下方章节。
