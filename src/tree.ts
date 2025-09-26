import { Event, EventEmitter, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { ExtensionState, FeatureSnapshot } from './types';

class FeatureTreeItem extends TreeItem {
    constructor(readonly feature: FeatureSnapshot) {
        super(feature.feature, TreeItemCollapsibleState.Collapsed);
        this.description = feature.status;
        this.iconPath = new ThemeIcon(feature.status === 'running' ? 'sync~spin' : 'circle-small-filled');
        this.contextValue = 'patPat.feature';
        this.tooltip = `${feature.branch}\n${feature.worktreePath}`;
        this.command = {
            title: 'Start Pat Pat Feature',
            command: 'patPat.startFeature',
            arguments: [feature.feature]
        };
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
            return this.state.features.map((feature) => new FeatureTreeItem(feature));
        }
        if (element instanceof FeatureTreeItem) {
            return element.feature.terminals.map(
                (terminal) => new TerminalTreeItem(element.feature, terminal.name, terminal.status)
            );
        }
        return [];
    }
}
