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
        const activeFeatureName = state.activeFeature ?? state.features.find((f) => f.status === 'running')?.feature;
        const activeFeature = activeFeatureName
            ? state.features.find((f) => f.feature === activeFeatureName)
            : undefined;
        statusIndicator.update(activeFeature);
    };

    const featureManager = new FeatureManager(workspaceRoot, git, store, syncState);

    await featureManager.initialize();
    void featureManager.ensurePatPatBranch();

    context.subscriptions.push(window.registerTreeDataProvider('patPatActivityView', treeProvider));

    context.subscriptions.push(window.onDidCloseTerminal((terminal) => featureManager.handleTerminalClosed(terminal)));

    context.subscriptions.push(
        commands.registerCommand('patPat.bootstrapFeature', async () => {
            const feature = await featureManager.ensurePatPatBranch();
            if (feature) {
                await featureManager.bootstrapFeature(feature, folder);
            }
        })
    );

    context.subscriptions.push(
        commands.registerCommand('patPat.startFeature', async (featureArg?: string) => {
            const featureName = await resolveFeatureName(featureArg, store);
            if (!featureName) {
                return;
            }
            await featureManager.startFeature(featureName);
        })
    );

    context.subscriptions.push(commands.registerCommand('patPat.killAll', async () => featureManager.killAll()));
    context.subscriptions.push(commands.registerCommand('patPat.clearAll', async () => featureManager.clearAll()));
    context.subscriptions.push(commands.registerCommand('patPat.abortAll', async () => featureManager.abortAll()));
}

async function resolveFeatureName(featureArg: string | undefined, store: StateStore): Promise<string | undefined> {
    if (featureArg) {
        return featureArg;
    }

    const state = await store.load();
    if (state.features.length === 0) {
        void window.showWarningMessage('No Pat Pat features found. Bootstrap one first.');
        return undefined;
    }

    if (state.features.length === 1) {
        return state.features[0].feature;
    }

    const pick = await window.showQuickPick(
        state.features.map((feature) => ({ label: feature.feature, description: feature.status })),
        {
            title: 'Select Pat Pat feature to start',
            canPickMany: false
        }
    );
    return pick?.label;
}

export function deactivate() {
    // noop
}
