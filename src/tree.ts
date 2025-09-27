import { Event, EventEmitter, ThemeColor, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { ExtensionState, FeatureSnapshot } from './types';

class FeatureTreeItem extends TreeItem {
    constructor(readonly feature: FeatureSnapshot, collapsibleState: TreeItemCollapsibleState) {
        super(feature.feature, collapsibleState);
        this.description = feature.status;
        this.contextValue = feature.parent ? 'patPat.feature' : 'patPat.integration';
        const iconName = feature.status === 'running' ? 'sync~spin' : feature.icon;
        const iconColor = feature.status === 'running' ? undefined : feature.color ? new ThemeColor(feature.color) : undefined;
        this.iconPath = new ThemeIcon(iconName, iconColor);
        const location = feature.worktreePath === '.' ? '.' : feature.worktreePath;
        this.tooltip = `${feature.branch}\n${location}`;
        if (feature.parent) {
            this.command = {
                title: 'Start feat-pat',
                command: 'patPat.startFeature',
                arguments: [feature.id]
            };
        }
    }
}

class TerminalTreeItem extends TreeItem {
    constructor(feature: FeatureSnapshot, terminalName: string, status: string) {
        super(terminalName, TreeItemCollapsibleState.None);
        this.description = status;
        this.tooltip = `${terminalName} • ${feature.worktreePath}`;
        this.iconPath = new ThemeIcon(status === 'running' ? 'debug-stop' : 'terminal');
        this.contextValue = 'patPat.terminal';
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
            const feature =
                this.state.features.find((candidate) => candidate.id === element.feature.id) || element.feature;
            const childFeatures = this.state.features
                .filter((candidate) => candidate.parent === feature.id)
                .map((child) => this.createFeatureItem(child));
            const terminals = feature.terminals.map(
                (terminal) => new TerminalTreeItem(feature, terminal.name, terminal.status)
            );
            return [...childFeatures, ...terminals];
        }
        return [];
    }

    private createFeatureItem(feature: FeatureSnapshot): FeatureTreeItem {
        const hasChildren =
            this.state.features.some((candidate) => candidate.parent === feature.id) || feature.terminals.length > 0;
        const collapsibleState = hasChildren ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None;
        return new FeatureTreeItem(feature, collapsibleState);
    }
}
