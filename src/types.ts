export type FeatureStatus = 'idle' | 'running' | 'missing';
export type TerminalStatus = 'idle' | 'running';

export interface TerminalSnapshot {
    name: string;
    status: TerminalStatus;
}

export interface FeatureSnapshot {
    feature: string;
    branch: string;
    worktreePath: string;
    icon: string;
    color: string;
    status: FeatureStatus;
    lastStartedAt?: string;
    terminals: TerminalSnapshot[];
}

export interface ExtensionState {
    features: FeatureSnapshot[];
    activeFeature?: string;
}
