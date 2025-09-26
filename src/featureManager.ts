import * as path from 'path';
import { window, workspace, Terminal, TerminalOptions, WorkspaceFolder } from 'vscode';
import { GitService } from './gitService';
import { StateStore } from './stateStore';
import { ExtensionState, FeatureSnapshot, FeatureStatus } from './types';
import { randomChoice } from './utils';

const ICONS = ['terminal', 'rocket', 'git-branch', 'pulse', 'zap', 'flame', 'beaker'];
const COLORS = ['terminal.ansiGreen', 'terminal.ansiCyan', 'terminal.ansiBlue', 'terminal.ansiMagenta'];
const DEFAULT_TERMINALS = ['main', 'dev'];

type FeatureRuntime = {
    feature: string;
    branch: string;
    worktreePath: string;
    terminals: Terminal[];
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

    async ensurePatPatBranch(): Promise<string | undefined> {
        const branch = await this.git.getCurrentBranch();
        if (branch && branch.startsWith('pat-pat/')) {
            return branch.replace('pat-pat/', '');
        }

        const defaultFeature = 'integration';
        const selected = await window.showQuickPick(
            [
                { label: `Create pat-pat/${defaultFeature} (recommended)`, target: defaultFeature },
                { label: 'Enter custom feature name…', target: undefined },
                { label: 'Skip for now', target: null }
            ],
            {
                title: 'Switch to a pat-pat feature branch',
                placeHolder: 'Pat Pat requires a pat-pat/<feature> branch to work'
            }
        );
        if (!selected) {
            return undefined;
        }
        if (selected.target === null) {
            return undefined;
        }
        let featureName = selected.target;
        if (!featureName) {
            const input = await window.showInputBox({
                title: 'Enter feature name',
                placeHolder: 'e.g. api-refactor'
            });
            if (!input) {
                return undefined;
            }
            featureName = input;
        }

        await this.git.checkoutPatPatBranch(featureName);
        return featureName;
    }

    async bootstrapFeature(featureName: string, workspaceFolder?: WorkspaceFolder): Promise<void> {
        const folder = workspaceFolder ?? this.getFirstWorkspaceFolder();
        if (!folder) {
            void window.showWarningMessage('Open a workspace folder to bootstrap Pat Pat.');
            return;
        }

        const featureDir = path.join(folder.uri.fsPath, '.pat-pat', featureName);
        await this.store.ensureScaffolding();

        const worktreeExists = await this.git.hasWorktree(featureDir);
        if (!worktreeExists) {
            try {
                await this.git.addWorktree(featureName, featureDir);
            } catch (error) {
                void window.showErrorMessage(`Failed to create worktree for ${featureName}: ${error}`);
                return;
            }
        }

        const icon = randomChoice(ICONS);
        const color = randomChoice(COLORS);

        const snapshot: FeatureSnapshot = {
            feature: featureName,
            branch: this.git.toBranchName(featureName),
            worktreePath: featureDir,
            icon,
            color,
            status: 'idle',
            terminals: DEFAULT_TERMINALS.map((name) => ({ name, status: 'idle' }))
        };

        this.state = await this.store.upsertFeature(snapshot);
        this.emitState();
        void window.showInformationMessage(`Pat Pat feature ready at ${snapshot.worktreePath}`);
    }

    async startFeature(featureName: string): Promise<void> {
        if (!this.state) {
            await this.initialize();
        }
        const feature = this.state?.features.find((f) => f.feature === featureName);
        if (!feature) {
            void window.showWarningMessage(`Feature ${featureName} not found. Bootstrap it first.`);
            return;
        }

        const existing = this.runtime.get(featureName);
        if (existing) {
            existing.terminals.forEach((terminal) => terminal.show());
            void window.showInformationMessage(`Reusing existing terminals for ${featureName}.`);
            return;
        }

        const terminals = DEFAULT_TERMINALS.map((name) => this.createTerminal(feature, name));
        terminals.forEach((terminal, index) => {
            const script = index === 0 ? 'pwd' : 'git status --short';
            terminal.sendText(script, true);
        });
        this.runtime.set(featureName, {
            feature: featureName,
            branch: feature.branch,
            worktreePath: feature.worktreePath,
            terminals
        });

        await this.updateFeatureStatus(featureName, 'running');
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
        for (const [featureName, runtime] of this.runtime.entries()) {
            const index = runtime.terminals.findIndex((t) => t === terminal);
            if (index >= 0) {
                runtime.terminals.splice(index, 1);
                if (runtime.terminals.length === 0) {
                    this.runtime.delete(featureName);
                    void this.updateFeatureStatus(featureName, 'idle');
                }
                break;
            }
        }
    }

    private async markAllIdle(): Promise<void> {
        if (!this.state) {
            return;
        }
        for (const feature of this.state.features) {
            await this.updateFeatureStatus(feature.feature, 'idle');
        }
    }

    private async updateFeatureStatus(featureName: string, status: FeatureStatus): Promise<void> {
        this.state = await this.store.updateFeatureStatus(featureName, status);
        this.emitState();
    }

    private createTerminal(feature: FeatureSnapshot, name: string): Terminal {
        const options: TerminalOptions = {
            name: `${feature.feature}:${name}`,
            cwd: feature.worktreePath
        };
        const terminal = window.createTerminal(options);
        terminal.show(false);
        return terminal;
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
