# Pat Pat 分支与 Worktree 设计

## 整体模型
Pat Pat 面向“大需求”时，约定存在一个需求主干（inte-pat）与若干特性分支（feat-pat）。根工作区保持在基线分支（通常为 `main`），负责执行命令和记录状态；工程实践发生在 `.pat-pat/integration/<feature>` 等 worktree 子目录中，各子目录共享主仓库对象但互不干扰构建产物。

目录结构示例：
```
.pat-pat/
  state.json              # 扩展维护的运行时状态
  integration/            # inte-pat 主干 worktree
    checkout/             # 某个 feat-pat 的工作目录
    build-ui/
```

## inte-pat（主干分支）
- 默认分支名为 `pat-pat/integration/__inte__`（即 inte 名 + `__inte__` 后缀）；首次 bootstrap 会尝试创建 `.pat-pat/integration` worktree；若当前工作区已在该分支，则直接把根目录登记为 inte-pat，同时在 `.pat-pat/integration` 下预建子目录供 feat-pat 使用。
- inte-pat 负责汇总所有模块分支，确认无冲突后再合回仓库基线。
- 未来如需自定义主干，可在状态模型中扩展 parent 字段；当前 MVP 假定主干即 integration。

## feat-pat（模块分支）
- 通过「Bootstrap inte-pat」初始化主干后，再使用「New feat-pat」命令创建子分支。系统会优先检测 inte-pat，如存在则执行 `git branch pat-pat/<inte>/<feat>`（例如 `pat-pat/integration/checkout`），并建立 `.pat-pat/integration/<feat>` worktree（`state.json` 会记录相对路径，便于分享）。
- 若主干尚未准备，为保持兼容，会退回当前分支作为 fork 基线，同时仍落在 `.pat-pat/<feature>` 目录下。
- 启动「Start feat-pat」后，Pat Pat 会在该 worktree 中启用默认终端组（inte 或 feat），便于执行特定模块的构建与调试。

## 合流与清理流程
1. feat-pat 完成开发后，在对应 worktree 合并回 inte-pat（`.pat-pat/integration`）。
2. 在 inte-pat worktree 完成集成验证，通过后再将 `pat-pat/integration` 合回 `main`。
3. 收尾时先关闭扩展打开的终端，再执行 `git worktree remove` 和 `git branch -d pat-pat/<feature>` 清理目录与分支。

## 扩展状态与界面
- `FeatureSnapshot` 结构新增 `id`（如 `integration/checkout`）与 `parent` 字段，以支撑父子层级展示。
- VS Code 侧边栏树按主干 → 子分支形式折叠，状态栏也会显示 `integration/<feature>` 标识。
- `state.json` 会随着 bootstrap/start/stop 更新，确保每个 worktree 的生命周期清晰可见；通过树视图的「Customize feat-pat appearance」可以调整图标和配色，状态栏、树节点会实时反映运行状态。
