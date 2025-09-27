# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds the TypeScript sources: `extension.ts` wires activation, `featureManager.ts` coordinates Git-driven sessions, and helpers cover tree views, status bar, and persistence (`stateStore.ts`).
- `dist/` contains the transpiled extension output; regenerate via the build commands instead of editing it directly.
- `media/` stores branding assets, while `.vscode/` provides launch (`Run Pat Pat Extension`) and build task presets. Runtime state nests under `.pat-pat/<inte>/<feat>` worktrees（inte-pat 根分支位于 `pat-pat/<inte>/__inte__`，例如 `.pat-pat/integration/checkout`）。

## Build, Test, and Development Commands
- Install dependencies with `npm install` (npm is preferred because `package-lock.json` is committed).
- `npm run compile` runs the TypeScript compiler once; `npm run watch` keeps it hot-reloading during extension debugging.
- `npm run lint` executes ESLint across `src/`. Fix findings or document intentional exceptions.
- 在 Pat Pat 侧边栏先触发 "Bootstrap inte-pat" 初始化主干，再用 "New feat-pat" 创建子分支；在 Sessions 树视图中使用 "Run session" 启动某个 feat-pat session，"Edit start command" 编辑它的启动命令；"Configure feat-pat" 可以批量调整子线图标/配色，`.pat-pat/state.json` 记录相对路径与所有 session 的启动命令，便于共享。
- Launch an Extension Development Host from VS Code via the included "Run Pat Pat Extension" configuration after a successful compile.

## Coding Style & Naming Conventions
- TypeScript uses 4-space indentation, single quotes, and async/await for VS Code APIs. Exported classes/interfaces are PascalCase; functions, variables, and files are camelCase.
- Keep modules focused on one responsibility and surface narrow, typed interfaces in `types.ts`. Add concise comments only when control flow is non-obvious.
- Maintain parity between `src/` and generated `dist/` outputs by rebuilding rather than manual edits.

## Testing Guidelines
- The test script currently prints "No tests yet". When contributing features, include automated coverage (e.g., via `@vscode/test-electron` or a lightweight runner) and update `npm run test` accordingly.
- Organize future specs under `src/__tests__/` or colocated `*.test.ts` files and ensure they compile through `tsc`.
- Document any manual verification steps (extension commands exercised, Git scenarios) in your PR until automated suites mature.

## Commit & Pull Request Guidelines
- Existing history is minimal; follow the style of short, imperative commit subjects (e.g., "Add feature branch bootstrap guard").
- Keep PRs scoped to a feature or fix, link issues when available, and record screenshots/GIFs for UX-facing changes.
- Confirm linting and compilation before requesting review, and call out impacts on branch management or workspace state.
