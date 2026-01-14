import { Octokit } from '@octokit/rest';

/**
 * GitHub Client
 * Wrapper around Octokit for ADL-specific GitHub operations
 */
export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(token: string, repository: string) {
    this.octokit = new Octokit({ auth: token });
    
    // Parse repository string (format: owner/repo)
    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
      throw new Error(`Invalid repository format: ${repository}. Expected format: owner/repo`);
    }
    
    this.owner = owner;
    this.repo = repo;
  }

  /**
   * Get file content from the repository
   */
  async getFileContent(path: string, ref: string = 'main'): Promise<string> {
    try {
      const response = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref,
      });

      if ('content' in response.data && response.data.type === 'file') {
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
      }

      throw new Error(`Path ${path} is not a file`);
    } catch (error) {
      console.error(`Error getting file content for ${path}:`, error);
      throw new Error(`Failed to get file content: ${error}`);
    }
  }

  /**
   * Update file content in the repository
   */
  async updateFile(
    path: string,
    content: string,
    message: string,
    branch: string = 'main'
  ): Promise<void> {
    try {
      // Get current file to get SHA
      const currentFile = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: branch,
      });

      if (!('sha' in currentFile.data)) {
        throw new Error(`Cannot update ${path}: not a file`);
      }

      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        content: Buffer.from(content).toString('base64'),
        sha: currentFile.data.sha,
        branch,
      });

      console.log(`Updated file: ${path}`);
    } catch (error) {
      console.error(`Error updating file ${path}:`, error);
      throw new Error(`Failed to update file: ${error}`);
    }
  }

  /**
   * Get PR diff
   */
  async getPRDiff(prNumber: number): Promise<string> {
    try {
      const response = await this.octokit.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        mediaType: {
          format: 'diff',
        },
      });

      return response.data as unknown as string;
    } catch (error) {
      console.error(`Error getting PR diff for #${prNumber}:`, error);
      throw new Error(`Failed to get PR diff: ${error}`);
    }
  }

  /**
   * Comment on a PR
   */
  async commentOnPR(prNumber: number, body: string): Promise<void> {
    try {
      await this.octokit.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: prNumber,
        body,
      });

      console.log(`Commented on PR #${prNumber}`);
    } catch (error) {
      console.error(`Error commenting on PR #${prNumber}:`, error);
      throw new Error(`Failed to comment on PR: ${error}`);
    }
  }

  /**
   * Request changes on a PR
   */
  async requestChanges(prNumber: number, body: string): Promise<void> {
    try {
      await this.octokit.pulls.createReview({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        event: 'REQUEST_CHANGES',
        body,
      });

      console.log(`Requested changes on PR #${prNumber}`);
    } catch (error) {
      console.error(`Error requesting changes on PR #${prNumber}:`, error);
      throw new Error(`Failed to request changes: ${error}`);
    }
  }

  /**
   * Approve a PR
   */
  async approvePR(prNumber: number, body: string = 'LGTM'): Promise<void> {
    try {
      await this.octokit.pulls.createReview({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        event: 'APPROVE',
        body,
      });

      console.log(`Approved PR #${prNumber}`);
    } catch (error) {
      console.error(`Error approving PR #${prNumber}:`, error);
      throw new Error(`Failed to approve PR: ${error}`);
    }
  }

  /**
   * Merge a PR
   */
  async mergePR(prNumber: number, commitTitle?: string): Promise<void> {
    try {
      await this.octokit.pulls.merge({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        commit_title: commitTitle,
        merge_method: 'squash',
      });

      console.log(`Merged PR #${prNumber}`);
    } catch (error) {
      console.error(`Error merging PR #${prNumber}:`, error);
      throw new Error(`Failed to merge PR: ${error}`);
    }
  }

  /**
   * Get the diff of the latest commit to main
   */
  async getLatestCommitDiff(branch: string = 'main'): Promise<string> {
    try {
      const commits = await this.octokit.repos.listCommits({
        owner: this.owner,
        repo: this.repo,
        sha: branch,
        per_page: 2,
      });

      if (commits.data.length < 2) {
        return '';
      }

      const latestSha = commits.data[0].sha;
      const previousSha = commits.data[1].sha;

      const comparison = await this.octokit.repos.compareCommits({
        owner: this.owner,
        repo: this.repo,
        base: previousSha,
        head: latestSha,
      });

      return comparison.data.files
        ?.map(file => `
### ${file.filename}
Status: ${file.status}
Changes: +${file.additions} -${file.deletions}

\`\`\`diff
${file.patch || 'Binary file or no patch available'}
\`\`\`
`)
        .join('\n') || '';
    } catch (error) {
      console.error('Error getting latest commit diff:', error);
      throw new Error(`Failed to get commit diff: ${error}`);
    }
  }

  /**
   * Create an issue
   */
  async createIssue(title: string, body: string): Promise<number> {
    try {
      const response = await this.octokit.issues.create({
        owner: this.owner,
        repo: this.repo,
        title,
        body,
      });

      console.log(`Created issue #${response.data.number}`);
      return response.data.number;
    } catch (error) {
      console.error('Error creating issue:', error);
      throw new Error(`Failed to create issue: ${error}`);
    }
  }
}
