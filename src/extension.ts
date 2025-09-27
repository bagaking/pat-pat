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

    context.subscriptions.push({ dispose: () => featureManager.dispose() });

    context.subscriptions.push(window.registerTreeDataProvider('patPatActivityView', treeProvider));

    context.subscriptions.push(
        commands.registerCommand('patPat.inline.runSession', async (...args: unknown[]) => {
            await commands.executeCommand('patPat.runSession', ...args);
        })
    );
    context.subscriptions.push(
        commands.registerCommand('patPat.inline.editSessionCommand', async (...args: unknown[]) => {
            await commands.executeCommand('patPat.editSessionCommand', ...args);
        })
    );
    context.subscriptions.push(
        commands.registerCommand('patPat.inline.configFeature', async (featureArg?: unknown) => {
            await commands.executeCommand('patPat.configFeature', featureArg);
        })
    );
    context.subscriptions.push(
        commands.registerCommand('patPat.inline.archiveFeature', async (featureArg?: unknown) => {
            await commands.executeCommand('patPat.archiveFeature', featureArg);
        })
    );
    context.subscriptions.push(
        commands.registerCommand('patPat.inline.removeFeatPat', async (featureArg?: unknown) => {
            await commands.executeCommand('patPat.removeFeatPat', featureArg);
        })
    );

    context.subscriptions.push(
        commands.registerCommand('patPat.toolbar.bootstrapIntegration', async () => {
            await featureManager.bootstrapIntegration(folder);
        })
    );
    context.subscriptions.push(
        commands.registerCommand('patPat.toolbar.newFeatPat', async () => {
            await featureManager.createFeatPat(folder);
        })
    );
    context.subscriptions.push(
        commands.registerCommand('patPat.toolbar.diagnoseSessions', async () => {
            await featureManager.diagnoseSessions();
        })
    );
    context.subscriptions.push(
        commands.registerCommand('patPat.toolbar.killAll', async () => {
            await featureManager.killAll();
        })
    );

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
        commands.registerCommand('patPat.openFeature', async (...args: unknown[]) => {
            const featureArg = args[0];
            const terminalArg = typeof args[1] === 'string' ? args[1] : undefined;
            let reference = await resolveFeatureReference(featureArg);
            if (!reference) {
                reference = await pickFeatureReference(store);
            }
            if (!reference) {
                return;
            }
            const targetTerminal = terminalArg ?? reference.terminalName;
            await featureManager.openFeature(reference.id, targetTerminal);
        })
    );

    context.subscriptions.push(
        commands.registerCommand('patPat.archiveFeature', async (featureArg?: unknown) => {
            let reference = await resolveFeatureReference(featureArg);
            if (!reference) {
                reference = await pickFeatureReference(store);
            }
            if (!reference) {
                return;
            }
            await featureManager.archiveFeature(reference.id);
        })
    );

    context.subscriptions.push(
        commands.registerCommand('patPat.configFeature', async (featureArg?: unknown) => {
            let reference = await resolveFeatureReference(featureArg);
            if (!reference) {
                reference = await pickFeatureReference(store);
            }
            if (!reference) {
                return;
            }
            await featureManager.configFeature(reference.id);
        })
    );

    context.subscriptions.push(
        commands.registerCommand('patPat.runSession', async (...args: unknown[]) => {
            const featureArg = args[0];
            const explicitTerminal = typeof args[1] === 'string' ? args[1] : undefined;
            let reference = await resolveFeatureReference(featureArg);
            if (!reference) {
                reference = await pickFeatureReference(store);
            }
            if (!reference) {
                return;
            }
            let sessionName = explicitTerminal ?? reference.terminalName;
            if (!sessionName) {
                sessionName = await pickSessionName(reference.id, store);
            }
            if (!sessionName) {
                return;
            }
            await featureManager.openFeature(reference.id, sessionName);
        })
    );

    context.subscriptions.push(
        commands.registerCommand('patPat.editSessionCommand', async (...args: unknown[]) => {
            const featureArg = args[0];
            const explicitTerminal = typeof args[1] === 'string' ? args[1] : undefined;
            let reference = await resolveFeatureReference(featureArg);
            if (!reference) {
                reference = await pickFeatureReference(store);
            }
            if (!reference) {
                return;
            }
            let sessionName = explicitTerminal ?? reference.terminalName;
            if (!sessionName) {
                sessionName = await pickSessionName(reference.id, store);
            }
            if (!sessionName) {
                return;
            }
            await featureManager.editSessionCommand(reference.id, sessionName);
        })
    );

    context.subscriptions.push(
        commands.registerCommand('patPat.removeFeatPat', async (featureArg?: unknown) => {
            let reference = await resolveFeatureReference(featureArg);
            if (!reference) {
                reference = await pickFeatureReference(store);
            }
            if (!reference) {
                return;
            }
            await featureManager.removeFeatPat(reference.id);
        })
    );

    context.subscriptions.push(
        commands.registerCommand('patPat.diagnoseSessions', async () => {
            await featureManager.diagnoseSessions();
        })
    );

    context.subscriptions.push(commands.registerCommand('patPat.killAll', async () => featureManager.killAll()));
    context.subscriptions.push(commands.registerCommand('patPat.clearAll', async () => featureManager.clearAll()));
    context.subscriptions.push(commands.registerCommand('patPat.abortAll', async () => featureManager.abortAll()));
}

async function resolveFeatureReference(featureArg: unknown): Promise<{ id: string; terminalName?: string } | undefined> {
    if (typeof featureArg === 'string') {
        return { id: featureArg };
    }
    if (Array.isArray(featureArg)) {
        const [candidateId, candidateTerminal] = featureArg;
        if (typeof candidateId === 'string') {
            return {
                id: candidateId,
                terminalName: typeof candidateTerminal === 'string' ? candidateTerminal : undefined
            };
        }
    }
    if (featureArg && typeof featureArg === 'object') {
        const candidate = featureArg as { id?: unknown; featureId?: unknown; terminalName?: unknown; terminal?: unknown; feature?: unknown; parent?: unknown };
        const terminalCandidate = candidate.terminal as { name?: unknown } | undefined;
        const terminalName = typeof candidate.terminalName === 'string'
            ? candidate.terminalName
            : typeof terminalCandidate?.name === 'string'
                ? terminalCandidate.name
                : undefined;
        const idCandidate = typeof candidate.id === 'string' ? candidate.id : typeof candidate.featureId === 'string' ? candidate.featureId : undefined;
        if (idCandidate) {
            return { id: idCandidate, terminalName };
        }
        if (candidate.feature && typeof candidate.feature === 'object') {
            const snapshot = candidate.feature as { id?: unknown; feature?: unknown; parent?: unknown };
            if (typeof snapshot.id === 'string') {
                return { id: snapshot.id, terminalName };
            }
            if (typeof snapshot.feature === 'string') {
                const parent = typeof snapshot.parent === 'string' ? snapshot.parent : undefined;
                const composed = parent ? `${parent}/${snapshot.feature}` : snapshot.feature;
                return { id: composed, terminalName };
            }
        }
        if (typeof candidate.feature === 'string') {
            const parent = typeof candidate.parent === 'string' ? candidate.parent : undefined;
            const composed = parent ? `${parent}/${candidate.feature}` : candidate.feature;
            return { id: composed, terminalName };
        }
    }
    return undefined;
}

async function pickFeatureReference(store: StateStore): Promise<{ id: string } | undefined> {
    const state = await store.load();
    if (state.features.length === 0) {
        void window.showWarningMessage('尚未找到 feat-pat，先运行 Bootstrap inte-pat。');
        return undefined;
    }

    if (state.features.length === 1) {
        return { id: state.features[0].id };
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
    return pick ? { id: pick.featureId } : undefined;
}

async function pickSessionName(featureId: string, store: StateStore): Promise<string | undefined> {
    const state = await store.load();
    const feature = state.features.find((candidate) => candidate.id === featureId);
    if (!feature) {
        void window.showWarningMessage(`未找到 feat-pat ${featureId}。`);
        return undefined;
    }
    if (feature.terminals.length === 0) {
        void window.showWarningMessage(`${featureId} 未配置任何 session。`);
        return undefined;
    }
    if (feature.terminals.length === 1) {
        return feature.terminals[0].name;
    }
    const items = feature.terminals.map((terminal) => ({
        label: terminal.name,
        description: terminal.status,
        detail: terminal.startupCommand ?? undefined
    }));
    const pick = await window.showQuickPick(items, {
        title: `Select session for ${featureId}`,
        canPickMany: false
    });
    return pick?.label;
}

export function deactivate() {
    // noop
}
