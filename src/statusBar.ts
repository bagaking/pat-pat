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
            this.item.text = '$(watch) Pat Pat idle';
            this.item.tooltip = 'No active Pat Pat feature';
            this.item.command = {
                command: 'patPat.startFeature',
                title: 'Start Pat Pat Feature'
            };
            this.item.show();
            return;
        }

        const running = active.status === 'running';
        this.item.text = `${running ? '$(sync~spin)' : '$(check)'} pat ${active.feature}`;
        this.item.tooltip = `${active.branch} at ${active.worktreePath}`;
        this.item.command = {
            command: 'patPat.startFeature',
            title: 'Re-open Pat Pat Feature',
            arguments: [active.feature]
        };
        this.item.show();
    }
}
