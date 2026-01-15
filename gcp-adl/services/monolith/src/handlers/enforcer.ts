import { Probot, Context } from 'probot';
import { StateManager } from '@gcp-adl/state';
import { JulesClient } from '@gcp-adl/jules';
import { GeminiClient } from '@gcp-adl/gemini';
import { RepoCloner } from '../utils/repo-cloner';

/**
 * Enforcer Handler - Reviews PRs against CONSTITUTION.md
 */
export function setupEnforcerHandler(app: Probot) {
  app.on(
    ['pull_request.opened', 'pull_request.synchronize', 'pull_request.reopened'],
    async (context: Context<'pull_request.opened' | 'pull_request.synchronize' | 'pull_request.reopened'>) => {
      const { pull_request, repository } = context.payload;
      const owner = repository.owner.login;
      const repo = repository.name;
      const prNumber = pull_request.number;
      const targetBranch = pull_request.base.ref;

      console.log(`[Enforcer] Processing PR #${prNumber} in ${owner}/${repo} (target: ${targetBranch})`);

      let repoPath: string | undefined;
      const repoCloner = new RepoCloner();

      try {
        // Initialize clients
        const geminiClient = new GeminiClient(process.env.GEMINI_API_KEY!);
        const stateManager = new StateManager(process.env.STATE_BUCKET!);
        const julesClient = new JulesClient(process.env.JULES_API_KEY!);

        // 0. Clone repository (target branch)
        repoPath = await repoCloner.clone(
          owner,
          repo,
          targetBranch,
          process.env.GITHUB_TOKEN || process.env.GH_TOKEN!
        );
        console.log('[Enforcer] Repository cloned to:', repoPath);

        // 1. Fetch CONSTITUTION.md and TASKS.md
        console.log('[Enforcer] Fetching repository files...');
        const [constitutionRes, tasksRes] = await Promise.all([
          context.octokit.repos.getContent({
            owner,
            repo,
            path: 'CONSTITUTION.md',
            ref: targetBranch,
          }),
          context.octokit.repos.getContent({
            owner,
            repo,
            path: 'TASKS.md',
            ref: targetBranch,
          }),
        ]);

        const constitutionContent = Buffer.from(
          (constitutionRes.data as any).content,
          'base64'
        ).toString('utf-8');
        const tasksContent = Buffer.from(
          (tasksRes.data as any).content,
          'base64'
        ).toString('utf-8');

        // 2. Get PR diff
        console.log('[Enforcer] Fetching PR diff...');
        const diffResponse = await context.octokit.pulls.get({
          owner,
          repo,
          pull_number: prNumber,
          mediaType: {
            format: 'diff',
          },
        });

        const prDiff = diffResponse.data as unknown as string;

        // 3. Audit with Gemini
        console.log('[Enforcer] Auditing PR with Gemini...');
        const auditResult = await geminiClient.auditPR(
          constitutionContent,
          tasksContent,
          prDiff,
          { cwd: repoPath }
        );

        console.log('[Enforcer] Audit result:', auditResult);

        // 4. Take action based on audit result
        if (!auditResult.compliant) {
          console.log('[Enforcer] Violations found. Posting violations...');

          const violationsList = auditResult.violations
            .map((v: string, i: number) => `${i + 1}. ${v}`)
            .join('\n');

          const comment = `## 🚨 Constitution Violation Detected

@jules The following violations were found:

${violationsList}

Please address these issues before merging.`;

          await context.octokit.pulls.createReview({
            owner,
            repo,
            pull_number: prNumber,
            event: 'REQUEST_CHANGES',
            body: comment,
          });

          // Send feedback to Jules
          const state = await stateManager.readState();
          if (state.current_task_id) {
            const julesMessage = `Constitution Violation Detected:\n\n${violationsList}\n\nPlease fix these issues immediately.`;
            await julesClient.sendMessage(state.current_task_id, julesMessage);
            console.log('[Enforcer] Sent violation feedback to Jules');
          }

          console.log('[Enforcer] PR rejected due to violations');
        } else {
          console.log('[Enforcer] PR is compliant. Approving and merging...');

          await context.octokit.pulls.createReview({
            owner,
            repo,
            pull_number: prNumber,
            event: 'APPROVE',
            body: '✅ Constitution compliant. LGTM!',
          });

          await context.octokit.pulls.merge({
            owner,
            repo,
            pull_number: prNumber,
            merge_method: 'squash',
          });

          console.log('[Enforcer] PR approved and merged');
        }
      } catch (error) {
        console.error('[Enforcer] Error processing PR:', error);
        
        // Post error comment on PR
        await context.octokit.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: `❌ Error during PR review: ${error instanceof Error ? error.message : String(error)}`,
        });
      } finally {
        if (repoPath) {
          await repoCloner.cleanup(repoPath);
        }
      }
    }
  );
}
