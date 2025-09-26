import { promises as fs } from 'fs';
import * as path from 'path';
import { ExtensionState, FeatureSnapshot, FeatureStatus, TerminalStatus } from './types';

const DEFAULT_STATE: ExtensionState = { features: [] };

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
        await this.ensureGitignoreEntry();
        await this.ensureStateExists();
    }

    async load(): Promise<ExtensionState> {
        try {
            const raw = await fs.readFile(this.stateFile, 'utf8');
            return JSON.parse(raw) as ExtensionState;
        } catch {
            return { ...DEFAULT_STATE };
        }
    }

    async save(state: ExtensionState): Promise<void> {
        await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2), 'utf8');
    }

    async upsertFeature(feature: FeatureSnapshot): Promise<ExtensionState> {
        const state = await this.load();
        const existingIndex = state.features.findIndex((f) => f.feature === feature.feature);
        if (existingIndex >= 0) {
            state.features[existingIndex] = feature;
        } else {
            state.features.push(feature);
        }
        await this.save(state);
        return state;
    }

    async updateFeatureStatus(featureName: string, status: FeatureStatus, terminals?: { name: string; status: TerminalStatus }[]): Promise<ExtensionState> {
        const state = await this.load();
        const feature = state.features.find((f) => f.feature === featureName);
        if (!feature) {
            return state;
        }
        feature.status = status;
        if (terminals) {
            feature.terminals = terminals.map((t) => ({ name: t.name, status: t.status }));
        } else if (status === 'running') {
            feature.terminals = feature.terminals.map((t) => ({ ...t, status: 'running' }));
        } else if (status === 'idle') {
            feature.terminals = feature.terminals.map((t) => ({ ...t, status: 'idle' }));
        }
        if (status === 'running') {
            feature.lastStartedAt = new Date().toISOString();
            state.activeFeature = featureName;
        }
        if (status === 'idle' && state.activeFeature === featureName) {
            state.activeFeature = undefined;
        }
        await this.save(state);
        return state;
    }

    async removeFeature(featureName: string): Promise<ExtensionState> {
        const state = await this.load();
        state.features = state.features.filter((f) => f.feature !== featureName);
        if (state.activeFeature === featureName) {
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

    private async ensureGitignoreEntry(): Promise<void> {
        try {
            const raw = await fs.readFile(this.gitignoreFile, 'utf8');
            if (!raw.includes('.pat-pat/')) {
                await fs.appendFile(this.gitignoreFile, (raw.endsWith('\n') ? '' : '\n') + '.pat-pat/\n', 'utf8');
            }
        } catch (error: any) {
            if (error && error.code === 'ENOENT') {
                await fs.writeFile(this.gitignoreFile, '.pat-pat/\n', 'utf8');
            }
        }
    }
}
