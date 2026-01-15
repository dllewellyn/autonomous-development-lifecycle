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

        // Get installation token
        const { token } = await context.octokit.auth({ type: 'installation' }) as any;

        // 0. Clone repository (target branch)
        repoPath = await repoCloner.clone(
          owner,
          repo,
          targetBranch,
          token
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
          // Send feedback to Jules
          const state = await stateManager.readState();
          if (state.current_task_id) {
            const julesMessage = `Constitution Violation Detected:\n\n${violationsList}\n\nPlease fix these issues immediately.`;
            
            try {
              // Try to send to the stored session ID
              await julesClient.sendMessage(state.current_task_id, julesMessage);
              console.log('[Enforcer] Sent violation feedback to Jules');
            } catch (error: any) {
              console.error(`[Enforcer] Failed to send feedback to session ${state.current_task_id}:`, error.message);
              
              if (error.message.includes('not found') || error.message.includes('404')) {
                console.warn('[Enforcer] Current session invalid. Attempting to recover...');
                
                // Fallback: Try to find an active session (simplified logic for now)
                // In a real scenario, we might query by repo/branch if Jules supports it
                const status = await julesClient.getStatus();
                const activeSession = status.sessions.find(s => 
                  ['IN_PROGRESS', 'AWAITING_USER_FEEDBACK', 'PLANNING'].includes(s.state)
                );

                if (activeSession) {
                   console.log(`[Enforcer] Found alternative active session: ${activeSession.name}. Retrying send...`);
                   try {
                     // Extract ID from name
                     const altSessionId = activeSession.name.split('/').pop() || '';
                     if (altSessionId) {
                       await julesClient.sendMessage(altSessionId, julesMessage);
                       // Update state to reflect recovery
                       await stateManager.updateSessionId(altSessionId);
                       console.log(`[Enforcer] Recovered and updated state with session ${altSessionId}`);
                     }
                   } catch (retryError) {
                     console.error('[Enforcer] Recovery attempt failed:', retryError);
                   }
                } else {
                  console.error('[Enforcer] No active session found to report violations to.');
                }
              }
            }
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

          // Check if PR is a draft and mark as ready if needed
          if (pull_request.draft) {
             console.log('[Enforcer] PR is a draft. Marking as ready for review...');
             try {
               await context.octokit.graphql(`
                 mutation($id: ID!) {
                   markPullRequestReadyForReview(input: {pullRequestId: $id}) {
                     pullRequest { isDraft }
                   }
                 }
               `, { id: pull_request.node_id });
               console.log('[Enforcer] Successfully marked PR as ready for review');
             } catch (error) {
               console.error('[Enforcer] Failed to mark PR as ready for review:', error);
               // We try to proceed anyway, but it will likely fail at merge if still draft
             }
          }

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
