export type FeatureStatus = 'idle' | 'running' | 'missing';
export type TerminalStatus = 'idle' | 'running';

export interface FeatureAttachments {
    branch: boolean;
    worktree: boolean;
    directory: boolean;
}

export interface TerminalSnapshot {
    name: string;
    status: TerminalStatus;
    startupCommand?: string;
}

export interface FeatureSnapshot {
    id: string;
    feature: string;
    parent?: string;
    branch: string;
    worktreePath: string;
    icon: string;
    color?: string;
    status: FeatureStatus;
    lastStartedAt?: string;
    terminals: TerminalSnapshot[];
    attachments?: FeatureAttachments;
}

export interface FeatureArchiveEntry {
    originalId: string;
    archivedAt: string;
    archivePath?: string;
    reason?: string;
    attachments: FeatureAttachments;
    snapshot: FeatureSnapshot;
}

export interface ExtensionState {
    features: FeatureSnapshot[];
    archives?: FeatureArchiveEntry[];
    activeFeature?: string;
}
