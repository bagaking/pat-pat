import { StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { FeatureSnapshot } from './types';

export class StatusIndicator {
    private item: StatusBarItem | undefined;

    update(active: FeatureSnapshot | undefined): void {
        if (!this.item) {
            this.item = window.createStatusBarItem('pat-pat.status', StatusBarAlignment.Right, 1000);
            this.item.name = 'Pat Pat';
        }

        if (!active) {
            this.item.text = '$(watch) feat-pat idle';
            this.item.tooltip = 'No active feat-pat';
            this.item.command = {
                command: 'patPat.runSession',
                title: 'Run session'
            };
            this.item.show();
            return;
        }

        const running = active.status === 'running';
        const label = this.formatLabel(active);
        this.item.text = `${running ? '$(sync~spin)' : '$(check)'} ${label}`;
        this.item.tooltip = `${active.branch} at ${this.formatPath(active.worktreePath)}`;
        const activeSession = active.terminals.find((terminal) => terminal.status === 'running')?.name;
        this.item.command = {
            command: 'patPat.runSession',
            title: 'Run session',
            arguments: [active.id, activeSession]
        };
        this.item.show();
    }

    private formatLabel(feature: FeatureSnapshot): string {
        return feature.parent ? `${feature.parent}/${feature.feature}` : feature.feature;
    }

    private formatPath(worktreePath: string): string {
        return worktreePath === '.' ? '.' : worktreePath;
    }
}
