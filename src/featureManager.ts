import * as path from 'path';
import { promises as fs } from 'fs';
import { window, workspace, Terminal, TerminalOptions, WorkspaceFolder, ThemeIcon, ThemeColor } from 'vscode';
import { GitService } from './gitService';
import { StateStore } from './stateStore';
import { ExtensionState, FeatureSnapshot, FeatureStatus, TerminalSnapshot, TerminalStatus } from './types';
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

    async openFeature(featureId: string, targetTerminalName?: string): Promise<void> {
        await this.ensureState();
        const feature = this.state?.features.find((f) => f.id === featureId);
        if (!feature) {
            void window.showWarningMessage(`Feature ${featureId} not found. Bootstrap inte-pat/feat-pat first.`);
            return;
        }

        const targetName = targetTerminalName ?? feature.terminals[0]?.name;
        const runtime = this.runtime.get(featureId);
        if (runtime) {
            runtime.feature = feature;
            runtime.terminals.forEach((terminal, index) => {
                const snapshot = feature.terminals[index];
                if (!snapshot) {
                    terminal.hide();
                    return;
                }
                const preserveFocus = targetName ? snapshot.name !== targetName : index !== 0;
                terminal.show(preserveFocus);
                const command = snapshot.startupCommand;
                if (command && snapshot.status !== 'running') {
                    terminal.sendText(command, true);
                }
            });
            const statusPayload = this.toTerminalStatus(feature, targetName);
            feature.terminals = statusPayload;
            await this.updateFeatureStatus(featureId, 'running', statusPayload);
            const refreshed = this.state?.features.find((f) => f.id === featureId);
            if (refreshed) {
                this.updateRuntimeFeature(refreshed);
            }
            return;
        }

        const terminals = feature.terminals.map((snapshot) => this.createTerminal(feature, snapshot));
        terminals.forEach((terminal, index) => {
            const snapshot = feature.terminals[index];
            if (!snapshot) {
                return;
            }
            const command = snapshot.startupCommand;
            if (command) {
                terminal.sendText(command, true);
            }
            const preserveFocus = targetName ? snapshot.name !== targetName : index !== 0;
            terminal.show(preserveFocus);
        });
        this.runtime.set(featureId, {
            feature,
            terminals
        });

        const statusPayload = this.toTerminalStatus(feature, targetName);
        feature.terminals = statusPayload;
        await this.updateFeatureStatus(featureId, 'running', statusPayload);
        const refreshed = this.state?.features.find((f) => f.id === featureId);
        if (refreshed) {
            this.updateRuntimeFeature(refreshed);
        }
    }

    async configFeature(featureId: string): Promise<void> {
        await this.ensureState();
        const feature = this.state?.features.find((f) => f.id === featureId);
        if (!feature) {
            void window.showWarningMessage(`Feature ${featureId} not found. Bootstrap inte-pat/feat-pat first.`);
            return;
        }
        const runningSession = feature.terminals.find((session) => session.status === 'running')?.name;

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

        const updatedTerminals: TerminalSnapshot[] = [];
        for (const terminal of feature.terminals) {
            const commandInput = await window.showInputBox({
                title: `${this.describeFeature(feature)} · ${terminal.name} 启动命令`,
                prompt: '留空表示启动时不自动执行命令',
                placeHolder: '例如: npm run dev',
                value: terminal.startupCommand ?? ''
            });
            if (commandInput === undefined) {
                return;
            }
            const trimmed = commandInput.trim();
            updatedTerminals.push({
                ...terminal,
                startupCommand: trimmed.length > 0 ? trimmed : undefined
            });
        }

        const updated: FeatureSnapshot = {
            ...feature,
            icon,
            color,
            terminals: updatedTerminals
        };

        this.state = await this.store.upsertFeature(updated);
        this.updateRuntimeFeature(updated);
        this.emitState();

        const runtime = this.runtime.get(featureId);
        if (runtime) {
            runtime.terminals.forEach((terminal) => terminal.dispose());
            this.runtime.delete(featureId);
            await this.openFeature(featureId, runningSession);
        }

        void window.showInformationMessage(`已更新 ${this.describeFeature(updated)} 的设定。`);
    }

    async editSessionCommand(featureId: string, sessionName: string): Promise<void> {
        await this.ensureState();
        const feature = this.state?.features.find((f) => f.id === featureId);
        if (!feature) {
            void window.showWarningMessage(`Feature ${featureId} not found. Bootstrap inte-pat/feat-pat first.`);
            return;
        }
        const terminal = feature.terminals.find((session) => session.name === sessionName);
        if (!terminal) {
            void window.showWarningMessage(`Session ${sessionName} not found under ${featureId}.`);
            return;
        }
        const input = await window.showInputBox({
            title: `${this.describeFeature(feature)} · ${sessionName} 启动命令`,
            prompt: '留空表示启动时不自动执行命令',
            placeHolder: '例如: npm run dev',
            value: terminal.startupCommand ?? ''
        });
        if (input === undefined) {
            return;
        }
        const trimmed = input.trim();
        const updatedTerminals = feature.terminals.map((session) =>
            session.name === sessionName
                ? { ...session, startupCommand: trimmed.length > 0 ? trimmed : undefined }
                : session
        );
        const updated: FeatureSnapshot = {
            ...feature,
            terminals: updatedTerminals
        };
        this.state = await this.store.upsertFeature(updated);
        this.updateRuntimeFeature(updated);
        this.emitState();
        void window.showInformationMessage(
            trimmed
                ? `${sessionName} 启动命令已更新。`
                : `${sessionName} 启动命令已清空。`
        );
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
                    const snapshot = this.state?.features.find((feature) => feature.id === featureId);
                    const terminals = snapshot ? this.toTerminalStatus(snapshot) : undefined;
                    void this.updateFeatureStatus(featureId, 'idle', terminals);
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
        const terminals = existing?.terminals ?? this.getDefaultTerminals(parentId);
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

    private getDefaultTerminals(parentId?: string): TerminalSnapshot[] {
        const names = parentId ? FEATURE_TERMINALS : INTEGRATION_TERMINALS;
        return names.map((name, index) => ({
            name,
            status: 'idle',
            startupCommand: index === 0 ? 'pwd' : undefined
        }));
    }

    private async markAllIdle(): Promise<void> {
        if (!this.state) {
            return;
        }
        for (const feature of this.state.features) {
            await this.updateFeatureStatus(feature.id, 'idle', this.toTerminalStatus(feature));
        }
    }

    private async updateFeatureStatus(
        featureId: string,
        status: FeatureStatus,
        terminals?: { name: string; status: TerminalStatus; startupCommand?: string }[]
    ): Promise<void> {
        this.state = await this.store.updateFeatureStatus(featureId, status, terminals);
        this.emitState();
    }

    private createTerminal(feature: FeatureSnapshot, terminalSnapshot: TerminalSnapshot): Terminal {
        const options: TerminalOptions = {
            name: `${this.describeFeature(feature)}:${terminalSnapshot.name}`,
            cwd: this.resolveWorktreePath(feature),
            iconPath: new ThemeIcon(feature.icon),
            color: feature.color ? new ThemeColor(feature.color) : undefined
        };
        const terminal = window.createTerminal(options);
        return terminal;
    }

    private toTerminalStatus(feature: FeatureSnapshot, activeName?: string, runningStatus: TerminalStatus = 'running') {
        return feature.terminals.map((terminal) => ({
            name: terminal.name,
            status: activeName && terminal.name === activeName ? runningStatus : 'idle',
            startupCommand: terminal.startupCommand
        }));
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
