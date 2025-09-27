import { commands, ExtensionContext, window, workspace } from 'vscode';
import { GitService } from './gitService';
import { StateStore } from './stateStore';
import { FeatureManager } from './featureManager';
import { PatPatTreeProvider } from './tree';
import { StatusIndicator } from './statusBar';
import { ExtensionState } from './types';

export async function activate(context: ExtensionContext) {
    const folder = workspace.workspaceFolders?.[0];
    if (!folder) {
        void window.showInformationMessage('Pat Pat requires an open folder.');
        return;
    }

    const workspaceRoot = folder.uri.fsPath;
    const git = new GitService(workspaceRoot);
    const store = new StateStore(workspaceRoot);
    const treeProvider = new PatPatTreeProvider();
    const statusIndicator = new StatusIndicator();

    const syncState = (state: ExtensionState) => {
        treeProvider.setState(state);
        const activeFeatureId = state.activeFeature ?? state.features.find((f) => f.status === 'running')?.id;
        const activeFeature = activeFeatureId
            ? state.features.find((f) => f.id === activeFeatureId)
            : undefined;
        statusIndicator.update(activeFeature);
    };

    const featureManager = new FeatureManager(workspaceRoot, git, store, syncState);

    await featureManager.initialize();

    context.subscriptions.push(window.registerTreeDataProvider('patPatActivityView', treeProvider));

    context.subscriptions.push(window.onDidCloseTerminal((terminal) => featureManager.handleTerminalClosed(terminal)));

    context.subscriptions.push(
        commands.registerCommand('patPat.bootstrapIntegration', async () => {
            await featureManager.bootstrapIntegration(folder);
        })
    );

    context.subscriptions.push(
        commands.registerCommand('patPat.newFeatPat', async () => {
            await featureManager.createFeatPat(folder);
        })
    );

    context.subscriptions.push(
        commands.registerCommand('patPat.startFeature', async (featureArg?: unknown) => {
            const featureId = await resolveFeatureId(featureArg, store);
            if (!featureId) {
                return;
            }
            await featureManager.startFeature(featureId);
        })
    );

    context.subscriptions.push(
        commands.registerCommand('patPat.customizeFeature', async (featureArg?: unknown) => {
            const featureId = await resolveFeatureId(featureArg, store);
            if (!featureId) {
                return;
            }
            await featureManager.customizeFeature(featureId);
        })
    );

    context.subscriptions.push(commands.registerCommand('patPat.killAll', async () => featureManager.killAll()));
    context.subscriptions.push(commands.registerCommand('patPat.clearAll', async () => featureManager.clearAll()));
    context.subscriptions.push(commands.registerCommand('patPat.abortAll', async () => featureManager.abortAll()));
}

async function resolveFeatureId(featureArg: unknown, store: StateStore): Promise<string | undefined> {
    if (typeof featureArg === 'string') {
        return featureArg;
    }
    if (featureArg && typeof featureArg === 'object') {
        const candidate = featureArg as { id?: unknown; feature?: unknown; parent?: unknown };
        if (typeof candidate.id === 'string') {
            return candidate.id;
        }
        if (candidate.feature && typeof candidate.feature === 'object') {
            const snapshot = candidate.feature as { id?: unknown; feature?: unknown; parent?: unknown };
            if (typeof snapshot.id === 'string') {
                return snapshot.id;
            }
            if (typeof snapshot.feature === 'string') {
                const parent = typeof snapshot.parent === 'string' ? snapshot.parent : undefined;
                return parent ? `${parent}/${snapshot.feature}` : snapshot.feature;
            }
        }
        if (typeof candidate.feature === 'string') {
            const parent = typeof candidate.parent === 'string' ? candidate.parent : undefined;
            return parent ? `${parent}/${candidate.feature}` : candidate.feature;
        }
    }

    const state = await store.load();
    if (state.features.length === 0) {
        void window.showWarningMessage('尚未找到 feat-pat，先运行 Bootstrap inte-pat。');
        return undefined;
    }

    if (state.features.length === 1) {
        return state.features[0].id;
    }

    const items = state.features.map((feature) => ({
        label: feature.parent ? `${feature.parent}/${feature.feature}` : feature.feature,
        description: feature.status,
        detail: feature.branch,
        featureId: feature.id
    }));
    const pick = await window.showQuickPick(items, {
        title: 'Select feat-pat',
        canPickMany: false
    });
    return pick?.featureId;
}

export function deactivate() {
    // noop
}
