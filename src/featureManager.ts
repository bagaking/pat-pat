import * as path from 'path';
import { promises as fs } from 'fs';
import { window, workspace, Terminal, TerminalOptions, WorkspaceFolder } from 'vscode';
import { GitService } from './gitService';
import { StateStore } from './stateStore';
import { ExtensionState, FeatureSnapshot, FeatureStatus } from './types';
import { randomChoice } from './utils';

const ICONS = ['terminal', 'rocket', 'git-branch', 'pulse', 'zap', 'flame', 'beaker'];
const COLORS = ['terminal.ansiGreen', 'terminal.ansiCyan', 'terminal.ansiBlue', 'terminal.ansiMagenta'];
const INTEGRATION_NAME = 'integration';
const INTEGRATION_TERMINALS = ['inte'];
const FEATURE_TERMINALS = ['feat'];

type FeatureRuntime = {
    feature: FeatureSnapshot;
    terminals: Terminal[];
};

type FeatureCreationContext = {
    featureName: string;
    parent?: FeatureSnapshot;
    workspaceFolder?: WorkspaceFolder;
};

export class FeatureManager {
    private state: ExtensionState | undefined;
    private readonly runtime = new Map<string, FeatureRuntime>();

    constructor(
        private readonly workspaceRoot: string,
        private readonly git: GitService,
        private readonly store: StateStore,
        private readonly onStateChange: (state: ExtensionState) => void
    ) {}

    async initialize(): Promise<void> {
        await this.store.ensureScaffolding();
        this.state = await this.store.load();
        this.emitState();
    }

    async bootstrapIntegration(workspaceFolder?: WorkspaceFolder): Promise<void> {
        await this.ensureState();
        await this.git.checkoutPatPatBranch(INTEGRATION_NAME);
        await this.createOrUpdateFeatureSnapshot({ featureName: INTEGRATION_NAME, workspaceFolder });
    }

    async createFeatPat(workspaceFolder?: WorkspaceFolder): Promise<void> {
        await this.ensureState();
        let integration = this.getIntegrationFeature();
        if (!integration) {
            void window.showWarningMessage('请先运行 Bootstrap inte-pat。');
            return;
        }

        integration = await this.ensureIntegrationUpgraded(integration, workspaceFolder);

        const featureName = await this.promptForFeatPatName(integration);
        if (!featureName) {
            return;
        }

        await this.git.checkoutPatPatBranch(featureName, integration.id);
        await this.createOrUpdateFeatureSnapshot({ featureName, parent: integration, workspaceFolder });
    }

    async startFeature(featureId: string): Promise<void> {
        await this.ensureState();
        const feature = this.state?.features.find((f) => f.id === featureId);
        if (!feature) {
            void window.showWarningMessage(`Feature ${featureId} not found. Bootstrap inte-pat/feat-pat first.`);
            return;
        }
        const label = this.describeFeature(feature);

        const existing = this.runtime.get(featureId);
        if (existing) {
            existing.terminals.forEach((terminal) => terminal.show());
            void window.showInformationMessage(`Reusing terminals for ${label}.`);
            return;
        }

        const terminalNames = this.getDefaultTerminalNames(feature);
        const terminals = terminalNames.map((name) => this.createTerminal(feature, name));
        terminals.forEach((terminal, index) => {
            const script = index === 0 ? 'pwd' : 'git status --short';
            terminal.sendText(script, true);
        });
        this.runtime.set(featureId, {
            feature,
            terminals
        });

        await this.updateFeatureStatus(featureId, 'running');
    }

    async customizeFeature(featureId: string): Promise<void> {
        await this.ensureState();
        const feature = this.state?.features.find((f) => f.id === featureId);
        if (!feature) {
            void window.showWarningMessage(`Feature ${featureId} not found. Bootstrap inte-pat/feat-pat first.`);
            return;
        }

        const iconPick = await window.showQuickPick(
            ICONS.map((icon) => ({
                label: `$(${icon}) ${icon}`,
                description: icon === feature.icon ? '当前' : undefined,
                icon
            })),
            {
                title: `选择 ${this.describeFeature(feature)} 的图标`,
                placeHolder: '保留当前设置请按 Esc',
                canPickMany: false
            }
        );
        if (iconPick === undefined) {
            return;
        }

        const colorOptions = [
            ...COLORS.map((color) => ({
                label: color,
                description: color === feature.color ? '当前' : undefined,
                value: color
            })),
            { label: '默认颜色', description: !feature.color ? '当前' : undefined, value: undefined }
        ];
        const colorPick = await window.showQuickPick(colorOptions, {
            title: `选择 ${this.describeFeature(feature)} 的配色`,
            placeHolder: '保留当前设置请按 Esc',
            canPickMany: false
        });

        const icon = iconPick?.icon ?? feature.icon;
        const color = colorPick ? colorPick.value : feature.color;
        const updated: FeatureSnapshot = {
            ...feature,
            icon,
            color
        };

        this.state = await this.store.upsertFeature(updated);
        this.updateRuntimeFeature(updated);
        this.emitState();
        void window.showInformationMessage(`已更新 ${this.describeFeature(updated)} 的外观。`);
    }

    async killAll(): Promise<void> {
        window.terminals.forEach((terminal) => terminal.dispose());
        this.runtime.clear();
        await this.markAllIdle();
    }

    async clearAll(): Promise<void> {
        for (const terminal of window.terminals) {
            terminal.show();
            terminal.sendText('\u0003', false);
            terminal.sendText('clear', true);
        }
    }

    async abortAll(): Promise<void> {
        window.terminals.forEach((terminal) => terminal.sendText('\u0003', false));
    }

    handleTerminalClosed(terminal: Terminal): void {
        for (const [featureId, runtime] of this.runtime.entries()) {
            const index = runtime.terminals.findIndex((t) => t === terminal);
            if (index >= 0) {
                runtime.terminals.splice(index, 1);
                if (runtime.terminals.length === 0) {
                    this.runtime.delete(featureId);
                    void this.updateFeatureStatus(featureId, 'idle');
                }
                break;
            }
        }
    }

    private async ensureState(): Promise<void> {
        if (!this.state) {
            await this.initialize();
        }
    }

    private getIntegrationFeature(): FeatureSnapshot | undefined {
        return this.state?.features.find((feature) => !feature.parent && feature.feature === INTEGRATION_NAME);
    }

    private async ensureIntegrationUpgraded(
        integration: FeatureSnapshot,
        workspaceFolder?: WorkspaceFolder
    ): Promise<FeatureSnapshot> {
        const expectedBranch = this.git.toBranchNameFromId(integration.id);
        const hasExpectedBranch = integration.branch === expectedBranch;
        const hasExpectedTerminals = integration.terminals.length === INTEGRATION_TERMINALS.length &&
            integration.terminals.every((terminal, index) => terminal.name === INTEGRATION_TERMINALS[index]);

        if (hasExpectedBranch && hasExpectedTerminals) {
            return integration;
        }

        await this.git.checkoutPatPatBranch(INTEGRATION_NAME);
        await this.createOrUpdateFeatureSnapshot({ featureName: INTEGRATION_NAME, workspaceFolder });
        await this.ensureState();
        const upgraded = this.getIntegrationFeature();
        if (!upgraded) {
            throw new Error('Failed to upgrade inte-pat metadata.');
        }
        return upgraded;
    }

    private async promptForFeatPatName(integration: FeatureSnapshot): Promise<string | undefined> {
        const existing = new Set(
            (this.state?.features ?? [])
                .filter((feature) => feature.parent === integration.id)
                .map((feature) => feature.feature)
        );

        return window.showInputBox({
            title: `为 ${integration.feature} 创建新的 feat-pat`,
            placeHolder: '例如: checkout-flow',
            validateInput: (value) => {
                if (!value || !value.trim()) {
                    return '名称不能为空';
                }
                if (value.includes(' ')) {
                    return '请使用中划线或下划线，不要包含空格';
                }
                if (existing.has(value.trim())) {
                    return '该名称已存在';
                }
                return undefined;
            }
        }).then((value) => value?.trim());
    }

    private async createOrUpdateFeatureSnapshot({
        featureName,
        parent,
        workspaceFolder
    }: FeatureCreationContext): Promise<void> {
        const folder = workspaceFolder ?? this.getFirstWorkspaceFolder();
        if (!folder) {
            void window.showWarningMessage('Open a workspace folder to manage feat-pat.');
            return;
        }

        await this.store.ensureScaffolding();

        const parentId = parent?.id;
        const baseDir = path.join(folder.uri.fsPath, '.pat-pat');
        const parentSegments = parentId ? parentId.split('/') : [];
        const defaultDir = path.join(baseDir, ...parentSegments, featureName);

        const targetBranch = this.git.toBranchName(featureName, parentId);
        const currentBranch = await this.git.getCurrentBranch();
        const usingWorkspaceRoot = !parentId && currentBranch === targetBranch;
        const featureDir = usingWorkspaceRoot ? folder.uri.fsPath : defaultDir;

        if (usingWorkspaceRoot) {
            await fs.mkdir(defaultDir, { recursive: true });
        } else {
            await fs.mkdir(path.dirname(featureDir), { recursive: true });
        }

        if (!usingWorkspaceRoot && currentBranch === targetBranch) {
            void window.showWarningMessage(
                `The workspace is already on ${targetBranch}. Switch to your base branch (e.g. main) before bootstrapping.`
            );
            return;
        }

        if (!usingWorkspaceRoot) {
            const worktreeExists = await this.git.hasWorktree(featureDir);
            if (!worktreeExists) {
                try {
                    await this.git.addWorktree(featureName, featureDir, parentId);
                } catch (error) {
                    void window.showErrorMessage(`Failed to create worktree for ${featureName}: ${error}`);
                    return;
                }
            }
        }

        const relativeWorktreePath = usingWorkspaceRoot ? '.' : path.relative(this.workspaceRoot, featureDir) || '.';
        const featureId = parentId ? `${parentId}/${featureName}` : featureName;
        const existing = this.state?.features.find((f) => f.id === featureId);
        const icon = existing?.icon ?? randomChoice(ICONS);
        const color = existing?.color ?? (parentId ? randomChoice(COLORS) : undefined);
        const terminals = (existing?.terminals ?? this.getDefaultTerminalNamesByParentId(parentId).map((name) => ({
            name,
            status: 'idle'
        })));
        const status = existing?.status ?? 'idle';

        const snapshot: FeatureSnapshot = {
            id: featureId,
            feature: featureName,
            parent: parentId,
            branch: targetBranch,
            worktreePath: relativeWorktreePath,
            icon,
            color,
            status,
            terminals
        };

        this.state = await this.store.upsertFeature(snapshot);
        this.updateRuntimeFeature(snapshot);
        this.emitState();
        const absolutePath = this.resolveWorktreePath(snapshot);
        const label = parentId ? 'feat-pat' : 'inte-pat';
        void window.showInformationMessage(`${label} ${this.describeFeature(snapshot)} ready at ${absolutePath}`);
    }

    private getDefaultTerminalNames(feature: FeatureSnapshot): string[] {
        return this.getDefaultTerminalNamesByParentId(feature.parent);
    }

    private getDefaultTerminalNamesByParentId(parentId?: string): string[] {
        return parentId ? FEATURE_TERMINALS : INTEGRATION_TERMINALS;
    }

    private async markAllIdle(): Promise<void> {
        if (!this.state) {
            return;
        }
        for (const feature of this.state.features) {
            await this.updateFeatureStatus(feature.id, 'idle');
        }
    }

    private async updateFeatureStatus(featureId: string, status: FeatureStatus): Promise<void> {
        this.state = await this.store.updateFeatureStatus(featureId, status);
        this.emitState();
    }

    private createTerminal(feature: FeatureSnapshot, name: string): Terminal {
        const options: TerminalOptions = {
            name: `${this.describeFeature(feature)}:${name}`,
            cwd: this.resolveWorktreePath(feature)
        };
        const terminal = window.createTerminal(options);
        terminal.show(false);
        return terminal;
    }

    private updateRuntimeFeature(snapshot: FeatureSnapshot): void {
        const runtime = this.runtime.get(snapshot.id);
        if (runtime) {
            runtime.feature = snapshot;
        }
    }

    private describeFeature(feature: FeatureSnapshot): string {
        return feature.parent ? `${feature.parent}/${feature.feature}` : feature.feature;
    }

    private resolveWorktreePath(feature: Pick<FeatureSnapshot, 'worktreePath'>): string {
        return path.isAbsolute(feature.worktreePath)
            ? feature.worktreePath
            : path.join(this.workspaceRoot, feature.worktreePath);
    }

    private emitState(): void {
        if (this.state) {
            this.onStateChange(this.state);
        }
    }

    private getFirstWorkspaceFolder(): WorkspaceFolder | undefined {
        return workspace.workspaceFolders?.[0];
    }
}
