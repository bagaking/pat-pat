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
                command: 'patPat.startFeature',
                title: 'Start feat-pat'
            };
            this.item.show();
            return;
        }

        const running = active.status === 'running';
        const label = this.formatLabel(active);
        this.item.text = `${running ? '$(sync~spin)' : '$(check)'} pat ${label}`;
        this.item.tooltip = `${active.branch} at ${this.formatPath(active.worktreePath)}`;
        this.item.command = {
            command: 'patPat.startFeature',
            title: 'Re-open feat-pat',
            arguments: [active.id]
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
