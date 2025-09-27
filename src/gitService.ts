import { promisify } from 'util';
import { execFile } from 'child_process';
import * as path from 'path';

const execFileAsync = promisify(execFile);
const INTEGRATION_SUFFIX = '__inte__';

export class GitService {
    constructor(private readonly workspaceRoot: string) {}

    private async runGit(args: string[]): Promise<string> {
        const { stdout } = await execFileAsync('git', args, {
            cwd: this.workspaceRoot
        });
        return stdout.trim();
    }

    private async runGitInPath(args: string[], cwd: string): Promise<string> {
        const { stdout } = await execFileAsync('git', args, { cwd });
        return stdout.trim();
    }

    private sanitizeSegment(segment: string): string {
        return segment.replace(/[^a-zA-Z0-9-_]/g, '-');
    }

    private buildBranchSegments(feature: string, parent?: string): string[] {
        if (parent) {
            const parentSegments = parent
                .split('/')
                .filter(Boolean)
                .map((part) => this.sanitizeSegment(part));
            parentSegments.push(this.sanitizeSegment(feature));
            return parentSegments;
        }
        return [this.sanitizeSegment(feature), INTEGRATION_SUFFIX];
    }

    async branchExists(branch: string): Promise<boolean> {
        try {
            await this.runGit(['rev-parse', '--verify', branch]);
            return true;
        } catch {
            return false;
        }
    }

    private async renameBranch(oldName: string, newName: string): Promise<void> {
        await this.runGit(['branch', '-m', oldName, newName]);
    }

    async isGitRepository(): Promise<boolean> {
        try {
            await this.runGit(['rev-parse', '--is-inside-work-tree']);
            return true;
        } catch {
            return false;
        }
    }

    async getCurrentBranch(): Promise<string | undefined> {
        try {
            const branch = await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
            return branch;
        } catch {
            return undefined;
        }
    }

    async checkoutPatPatBranch(feature: string, parent?: string): Promise<void> {
        const branchName = this.toBranchName(feature, parent);
        const exists = await this.branchExists(branchName);
        if (exists) {
            return;
        }

        if (!parent) {
            const legacyBranch = `pat-pat/${this.sanitizeSegment(feature)}`;
            if (await this.branchExists(legacyBranch)) {
                await this.renameBranch(legacyBranch, branchName);
                return;
            }
        }

        if (parent) {
            const parentBranch = this.toBranchNameFromId(parent);
            const parentExists = await this.branchExists(parentBranch);
            if (parentExists) {
                await this.runGit(['branch', branchName, parentBranch]);
                return;
            }
        }

        const current = await this.getCurrentBranch();
        if (current) {
            await this.runGit(['branch', branchName, current]);
        } else {
            await this.runGit(['branch', branchName]);
        }
    }

    async addWorktree(feature: string, destination: string, parent?: string): Promise<void> {
        const branchName = this.toBranchName(feature, parent);
        await this.runGit(['worktree', 'add', destination, branchName]);
    }

    async removeWorktree(destination: string, force = false): Promise<void> {
        const args = ['worktree', 'remove'];
        if (force) {
            args.push('--force');
        }
        args.push(destination);
        await this.runGit(args);
    }

    async deleteBranchByName(branchName: string, force = false): Promise<void> {
        const args = ['branch', force ? '-D' : '-d', branchName];
        await this.runGit(args);
    }

    async isWorktreeDirty(destination: string): Promise<boolean> {
        try {
            const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: destination });
            return stdout.trim().length > 0;
        } catch {
            return false;
        }
    }

    async hasWorktree(destination: string): Promise<boolean> {
        try {
            await this.runGit(['worktree', 'list']);
        } catch {
            return false;
        }

        try {
            const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
                cwd: this.workspaceRoot
            });
            const entries = stdout
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);
            const absTarget = path.resolve(destination);
            return entries.some((line) => line.startsWith('worktree ') && line.endsWith(absTarget));
        } catch {
            return false;
        }
    }

    async getRepoSlug(): Promise<string> {
        try {
            const remote = await this.runGit(['config', '--get', 'remote.origin.url']);
            const basename = remote.split('/').pop() || 'repo';
            return basename.replace(/\.git$/, '');
        } catch {
            return path.basename(this.workspaceRoot);
        }
    }

    toBranchName(feature: string, parent?: string): string {
        const segments = this.buildBranchSegments(feature, parent);
        return `pat-pat/${segments.join('/')}`;
    }

    toBranchNameFromId(id: string): string {
        const pieces = id.split('/').filter(Boolean);
        if (pieces.length === 0) {
            return 'pat-pat';
        }
        if (pieces.length === 1) {
            return this.toBranchName(pieces[0]);
        }
        const feature = pieces.pop() as string;
        const parent = pieces.join('/');
        return this.toBranchName(feature, parent);
    }
}
