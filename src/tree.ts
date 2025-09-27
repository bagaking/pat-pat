import { Event, EventEmitter, ThemeColor, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { ExtensionState, FeatureSnapshot, TerminalSnapshot } from './types';

class FeatureTreeItem extends TreeItem {
    constructor(readonly feature: FeatureSnapshot, collapsibleState: TreeItemCollapsibleState) {
        super(feature.feature, collapsibleState);
        const runningSession = feature.terminals.find((terminal) => terminal.status === 'running');
        this.description = runningSession ? `running · ${runningSession.name}` : feature.status;
        this.contextValue = feature.parent ? 'patPat.feature' : 'patPat.integration';
        this.iconPath = new ThemeIcon(feature.icon, feature.color ? new ThemeColor(feature.color) : undefined);
        const location = feature.worktreePath === '.' ? '.' : feature.worktreePath;
        this.tooltip = `${feature.branch}\n${location}`;
    }
}

class SessionTreeItem extends TreeItem {
    constructor(readonly feature: FeatureSnapshot, readonly terminal: TerminalSnapshot) {
        super(terminal.name, TreeItemCollapsibleState.None);
        this.description = terminal.status;
        const location = feature.worktreePath === '.' ? '.' : feature.worktreePath;
        const commandHint = terminal.startupCommand ? `\n${terminal.startupCommand}` : '';
        this.tooltip = `${terminal.name} • ${location}${commandHint}`;
        const running = terminal.status === 'running';
        const iconColor = feature.color ? new ThemeColor(feature.color) : undefined;
        this.iconPath = new ThemeIcon(running ? 'sync~spin' : 'play-circle', iconColor);
        this.contextValue = 'patPat.session';
        this.command = {
            title: running ? 'Focus session' : 'Run session',
            command: 'patPat.runSession',
            arguments: [feature.id, terminal.name]
        };
    }
}

export class PatPatTreeProvider implements TreeDataProvider<TreeItem> {
    private emitter = new EventEmitter<TreeItem | undefined | void>();
    readonly onDidChangeTreeData: Event<TreeItem | undefined | void> = this.emitter.event;

    private state: ExtensionState = { features: [] };

    setState(state: ExtensionState) {
        this.state = state;
        this.refresh();
    }

    refresh(): void {
        this.emitter.fire();
    }

    getTreeItem(element: TreeItem): TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): TreeItem[] {
        if (!element) {
            return this.state.features
                .filter((feature) => !feature.parent)
                .map((feature) => this.createFeatureItem(feature));
        }
        if (element instanceof FeatureTreeItem) {
            const feature = this.state.features.find((candidate) => candidate.id === element.feature.id) || element.feature;
            const childFeatures = this.state.features
                .filter((candidate) => candidate.parent === feature.id)
                .map((child) => this.createFeatureItem(child));
            const sessions = feature.terminals.map((terminal) => new SessionTreeItem(feature, terminal));
            return [...childFeatures, ...sessions];
        }
        return [];
    }

    private createFeatureItem(feature: FeatureSnapshot): FeatureTreeItem {
        const hasChildFeatures = this.state.features.some((candidate) => candidate.parent === feature.id);
        const hasSessions = feature.terminals.length > 0;
        const collapsibleState = hasChildFeatures || hasSessions ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None;
        return new FeatureTreeItem(feature, collapsibleState);
    }
}
