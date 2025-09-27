# Pat Pat 分支 / Worktree / Session 设计

## 顶层结构
Pat Pat 以“大需求”拆解为单一 inte-pat 主干和若干 feat-pat 子线。根工作区停留在仓库基线（如 `main`），负责调度命令；实际开发发生在 `.pat-pat/<inte>/<feat>` worktree 中，既复用 Git 对象又隔离构建环境。

```
.pat-pat/
  state.json              # 扩展维护的运行状态（相对路径 + 终端配置）
  integration/            # inte-pat 主干对应 worktree
    __inte__/             # inte-pat 主干 session（默认直接使用根目录时仍记录在此）
    checkout/             # 某个 feat-pat session，同步到分支 pat-pat/integration/checkout
```

## inte-pat 主干
- 主干分支命名为 `pat-pat/<inte>/__inte__`（默认 `<inte>` 为 `integration`）。首次执行「Bootstrap inte-pat」时会自动迁移旧的 `pat-pat/<inte>` 分支并写入 `.pat-pat/<inte>/__inte__` 目录。
- inte-pat 承担需求集成，所有 feat-pat 回归此分支后再合入基线。

## feat-pat 子线 & Session
- 使用「New feat-pat」从 inte-pat fork 出 `pat-pat/<inte>/<feat>` 分支，并生成 `.pat-pat/<inte>/<feat>` worktree。每个 feat-pat 默认带有一个名为 `feat` 的 session，inte-pat 则有 `inte` session。
- 树视图（Sessions）层级：inte-pat → feat-pat → session。只在 session 节点上提供操作：
  - 「Run session」(`patPat.runSession`) 会聚焦该 session 并在终端面板中复用/创建对应终端。
  - 「Edit start command」(`patPat.editSessionCommand`) 支持为 session 保存启动命令；命令保存在 `state.json`，运行时会自动执行，留空表示手动输入。
- 侧边栏、状态栏和终端面板的图标/配色均可通过「Configure feat-pat」修改，更新后立即刷新正在运行的 session。

## 合流与清理
1. feat-pat 完成后在对应 session 合并回 inte-pat（`.pat-pat/<inte>/__inte__`）。
2. 在 inte-pat session 完成集成验证，通过后再把 `pat-pat/<inte>/__inte__` 合回基线。
3. 清理时先关闭扩展创建的终端，再运行 `git worktree remove`、`git branch -d pat-pat/<inte>/<feat>` 等命令。

## 状态文件
- `FeatureSnapshot` 记录分支、worktree 相对路径、图标配色、每个 session 的运行状态及启动命令。
- `state.json` 随着 bootstrap / run / stop / 配置更新；若迁移旧版本，扩展会自动补写新字段，并将旧分支重命名为 `pat-pat/<inte>/__inte__`。
