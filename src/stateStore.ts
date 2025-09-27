import { promises as fs } from 'fs';
import * as path from 'path';
import { ExtensionState, FeatureArchiveEntry, FeatureAttachments, FeatureSnapshot, FeatureStatus, TerminalStatus } from './types';

const DEFAULT_STATE: ExtensionState = { features: [], archives: [] };
const INTEGRATION_BRANCH_SUFFIX = '__inte__';
const REQUIRED_GITIGNORE_LINES = ['.pat-pat/', '.pat-pat/.archived/'];
const sanitizeSegment = (segment: string): string => segment.replace(/[^a-zA-Z0-9-_]/g, '-');

export class StateStore {
    readonly patPatDir: string;
    readonly stateFile: string;
    readonly gitignoreFile: string;

    constructor(private readonly workspaceRoot: string) {
        this.patPatDir = path.join(workspaceRoot, '.pat-pat');
        this.stateFile = path.join(this.patPatDir, 'state.json');
        this.gitignoreFile = path.join(workspaceRoot, '.gitignore');
    }

    async ensureScaffolding(): Promise<void> {
        await fs.mkdir(this.patPatDir, { recursive: true });
        await this.ensureGitignoreEntries();
        await this.ensureStateExists();
    }

    async load(): Promise<ExtensionState> {
        try {
            const raw = await fs.readFile(this.stateFile, 'utf8');
            const parsed = JSON.parse(raw) as ExtensionState;
            let mutated = false;
            parsed.features = (parsed.features ?? []).map((feature) => {
                const derivedId = feature.id || (feature.parent ? `${feature.parent}/${feature.feature}` : feature.feature);
                const worktreePath = feature.worktreePath && path.isAbsolute(feature.worktreePath)
                    ? path.relative(this.workspaceRoot, feature.worktreePath) || '.'
                    : feature.worktreePath ?? '.';
                let branch = feature.branch;
                if (!feature.parent) {
                    const safeRoot = sanitizeSegment(derivedId);
                    const expectedBranch = `pat-pat/${safeRoot}/${INTEGRATION_BRANCH_SUFFIX}`;
                    if (branch !== expectedBranch) {
                        branch = expectedBranch;
                        mutated = true;
                    }
                }
                if (feature.id !== derivedId || feature.worktreePath !== worktreePath || feature.branch !== branch) {
                    mutated = true;
                }
                return { ...feature, id: derivedId, worktreePath, branch } as FeatureSnapshot;
            });
            if (!parsed.archives) {
                parsed.archives = [];
                mutated = true;
            }
            if (parsed.activeFeature) {
                const active = parsed.features.find(
                    (feature) => feature.id === parsed.activeFeature || feature.feature === parsed.activeFeature
                );
                if (active?.id && parsed.activeFeature !== active.id) {
                    parsed.activeFeature = active.id;
                    mutated = true;
                }
            }
            if (mutated) {
                await this.save(parsed);
            }
            return parsed;
        } catch {
            return { ...DEFAULT_STATE };
        }
    }

    async save(state: ExtensionState): Promise<void> {
        await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2), 'utf8');
    }

    async upsertFeature(feature: FeatureSnapshot): Promise<ExtensionState> {
        const state = await this.load();
        const existingIndex = state.features.findIndex((f) => f.id === feature.id);
        if (existingIndex >= 0) {
            state.features[existingIndex] = feature;
        } else {
            state.features.push(feature);
        }
        await this.save(state);
        return state;
    }

    async updateFeatureStatus(
        featureId: string,
        status: FeatureStatus,
        terminals?: { name: string; status: TerminalStatus; startupCommand?: string }[]
    ): Promise<ExtensionState> {
        const state = await this.load();
        const feature = state.features.find((f) => f.id === featureId);
        if (!feature) {
            return state;
        }
        feature.status = status;
        if (terminals) {
            feature.terminals = terminals.map((t) => ({ name: t.name, status: t.status, startupCommand: t.startupCommand }));
        } else if (status === 'running') {
            feature.terminals = feature.terminals.map((t) => ({ ...t, status: 'running' }));
        } else if (status === 'idle') {
            feature.terminals = feature.terminals.map((t) => ({ ...t, status: 'idle' }));
        }
        if (status === 'running') {
            feature.lastStartedAt = new Date().toISOString();
            state.activeFeature = featureId;
        }
        if (status === 'idle' && state.activeFeature === featureId) {
            state.activeFeature = undefined;
        }
        await this.save(state);
        return state;
    }

    async updateFeatureAttachments(featureId: string, attachments: FeatureAttachments): Promise<ExtensionState> {
        const state = await this.load();
        const feature = state.features.find((f) => f.id === featureId);
        if (!feature) {
            return state;
        }
        feature.attachments = attachments;
        if (!attachments.branch || !attachments.worktree || !attachments.directory) {
            feature.status = feature.status === 'running' ? 'running' : 'missing';
        } else if (feature.status === 'missing') {
            feature.status = 'idle';
        }
        await this.save(state);
        return state;
    }

    async archiveFeature(featureId: string, entry: FeatureArchiveEntry): Promise<ExtensionState> {
        const state = await this.load();
        state.features = state.features.filter((f) => f.id !== featureId);
        state.archives = state.archives ?? [];
        state.archives.push(entry);
        if (state.activeFeature === featureId) {
            state.activeFeature = undefined;
        }
        await this.save(state);
        return state;
    }

    async removeFeature(featureId: string): Promise<ExtensionState> {
        const state = await this.load();
        state.features = state.features.filter((f) => f.id !== featureId);
        if (state.activeFeature === featureId) {
            state.activeFeature = undefined;
        }
        await this.save(state);
        return state;
    }

    private async ensureStateExists(): Promise<void> {
        try {
            await fs.access(this.stateFile);
        } catch {
            await this.save({ ...DEFAULT_STATE });
        }
    }

    private async ensureGitignoreEntries(): Promise<void> {
        try {
            const raw = await fs.readFile(this.gitignoreFile, 'utf8');
            const missing = REQUIRED_GITIGNORE_LINES.filter((line) => !raw.includes(line));
            if (missing.length > 0) {
                const prefix = raw.endsWith('\n') || raw.length === 0 ? '' : '\n';
                await fs.appendFile(this.gitignoreFile, prefix + missing.map((line) => `${line}\n`).join(''), 'utf8');
            }
        } catch (error: any) {
            if (error && error.code === 'ENOENT') {
                const content = REQUIRED_GITIGNORE_LINES.map((line) => `${line}\n`).join('');
                await fs.writeFile(this.gitignoreFile, content, 'utf8');
            }
        }
    }
}
