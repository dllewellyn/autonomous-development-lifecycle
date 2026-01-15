import simpleGit from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class RepoCloner {
  /**
   * Clone a repository to a temporary directory
   * @param owner Repository owner
   * @param repo Repository name
   * @param branch Branch to clone
   * @param token GitHub token
   * @returns Path to the cloned repository
   */
  async clone(owner: string, repo: string, branch: string, token: string): Promise<string> {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'adl-repo-'));
    const repoUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
    
    console.log(`[RepoCloner] Cloning ${owner}/${repo} (${branch}) to ${tempDir}...`);
    
    try {
      await simpleGit().clone(repoUrl, tempDir, ['--depth', '1', '--branch', branch]);
      console.log(`[RepoCloner] Cloned successfully to ${tempDir}`);
      return tempDir;
    } catch (error) {
      console.error(`[RepoCloner] Failed to clone ${owner}/${repo}:`, error);
      // Clean up on failure
      await this.cleanup(tempDir);
      throw error;
    }
  }

  /**
   * Clean up a temporary directory
   * @param dirPath Path to directory to remove
   */
  async cleanup(dirPath: string): Promise<void> {
    if (dirPath && fs.existsSync(dirPath)) {
      console.log(`[RepoCloner] Cleaning up ${dirPath}...`);
      await fs.promises.rm(dirPath, { recursive: true, force: true });
    }
  }
}
