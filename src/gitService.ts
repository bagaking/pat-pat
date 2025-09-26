import { promisify } from 'util';
import { execFile } from 'child_process';
import * as path from 'path';

const execFileAsync = promisify(execFile);

export class GitService {
    constructor(private readonly workspaceRoot: string) {}

    private async runGit(args: string[]): Promise<string> {
        const { stdout } = await execFileAsync('git', args, {
            cwd: this.workspaceRoot
        });
        return stdout.trim();
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

    async checkoutPatPatBranch(feature: string): Promise<void> {
        const branchName = this.toBranchName(feature);
        try {
            await this.runGit(['rev-parse', '--verify', branchName]);
            await this.runGit(['checkout', branchName]);
        } catch {
            await this.runGit(['checkout', '-B', branchName]);
        }
    }

    async ensurePatPatBranch(currentBranch: string | undefined, defaultFeature: string): Promise<string | undefined> {
        if (currentBranch && currentBranch.startsWith('pat-pat/')) {
            return currentBranch.replace('pat-pat/', '');
        }

        await this.checkoutPatPatBranch(defaultFeature);
        return defaultFeature;
    }

    async addWorktree(feature: string, destination: string): Promise<void> {
        const branchName = this.toBranchName(feature);
        await this.runGit(['worktree', 'add', destination, branchName]);
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

    toBranchName(feature: string): string {
        const safe = feature.replace(/[^a-zA-Z0-9-_]/g, '-');
        return `pat-pat/${safe}`;
    }
}
