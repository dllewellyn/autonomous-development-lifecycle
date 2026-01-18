import { Probot, Context } from 'probot';
import { StateManager } from '@gcp-adl/state';
import { JulesClient } from '@gcp-adl/jules';
import { GeminiClient } from '@gcp-adl/gemini';
import { RepoCloner } from '../utils/repo-cloner';
import { runStrategistCycle } from './strategist';
import { PlannerContext } from '../services/planner';

/**
 * Enforcer Handler - Reviews PRs against CONSTITUTION.md
 */
export function setupEnforcerHandler(
  app: Probot,
  runPlanner: (context: PlannerContext) => Promise<any>
) {
  // Handler for PR events
  app.on(
    ['pull_request.opened', 'pull_request.synchronize', 'pull_request.reopened'],
    async (context: Context<'pull_request.opened' | 'pull_request.synchronize' | 'pull_request.reopened'>) => {
      const { pull_request, repository } = context.payload;
      const owner = repository.owner.login;
      const repo = repository.name;
      const prNumber = pull_request.number;
      const targetBranch = pull_request.base.ref;
      const headSha = pull_request.head.sha;

      console.log(`[Enforcer] Processing PR #${prNumber} in ${owner}/${repo} (target: ${targetBranch}, sha: ${headSha})`);

      await handlePrEnforcement(context, owner, repo, prNumber, targetBranch, headSha, pull_request.node_id, pull_request.draft, runPlanner);
    }
  );

  // Handler for workflow run completion (to catch up when workflows finish)
  app.on('workflow_run.completed', async (context: Context<'workflow_run.completed'>) => {
    const { workflow_run, repository } = context.payload;
    const owner = repository.owner.login;
    const repo = repository.name;
    const headSha = workflow_run.head_sha;

    // We need to find the PR associated with this run/commit
    // The payload usually contains pull_requests info
    const prs = workflow_run.pull_requests;

    if (!prs || prs.length === 0) {
      // If no PRs in payload, try to search for PRs associated with this commit
       console.log(`[Enforcer] No PRs found in workflow_run payload for ${headSha}. Checking via API...`);
       const { data: associatedPrs } = await context.octokit.repos.listPullRequestsAssociatedWithCommit({
         owner,
         repo,
         commit_sha: headSha,
       });
       
       if (associatedPrs.length === 0) {
         console.log(`[Enforcer] No PRs associated with commit ${headSha}. Skipping.`);
         return;
       }
       
       for (const pr of associatedPrs) {
         console.log(`[Enforcer] Found PR #${pr.number} for workflow run ${workflow_run.id}`);
         // We re-fetch the PR to get full details (like node_id, draft status)
         const { data: fullPr } = await context.octokit.pulls.get({
            owner,
            repo,
            pull_number: pr.number
         });
         
         await handlePrEnforcement(
           context, 
           owner, 
           repo, 
           fullPr.number, 
           fullPr.base.ref, 
           headSha, 
           fullPr.node_id, 
           fullPr.draft,
           runPlanner
         );
       }
       return;
    }

    for (const pr of prs) {
       console.log(`[Enforcer] Processing Workflow Run Complation for PR #${pr.number}`);
       // We might need to fetch more details if payload is redundant
       const { data: fullPr } = await context.octokit.pulls.get({
          owner,
          repo,
          pull_number: pr.number
       });
       
       await handlePrEnforcement(
         context, 
         owner, 
         repo, 
         fullPr.number, 
         fullPr.base.ref, 
         headSha, 
         fullPr.node_id, 
         fullPr.draft,
         runPlanner
       );
    }
  });
}

// Reusable logic
async function handlePrEnforcement(
  context: Context,
  owner: string,
  repo: string,
  prNumber: number,
  targetBranch: string,
  headSha: string,
  prNodeId: string,
  isDraft: boolean | undefined,
  runPlanner: (context: PlannerContext) => Promise<any>
) {
    const stateManager = new StateManager(process.env.STATE_BUCKET!);
    const julesClient = new JulesClient(process.env.JULES_API_KEY!);
    const geminiClient = new GeminiClient(process.env.GEMINI_API_KEY!);
    const repoCloner = new RepoCloner();

    try {
        // Check workflows status first
        console.log(`[Enforcer] Checking workflow status for commit ${headSha}...`);
        const { data: { workflow_runs } } = await context.octokit.actions.listWorkflowRunsForRepo({
          owner,
          repo,
          head_sha: headSha,
        });

        // Current workflow check:
        // We want to verify if ANY workflow is failed -> Stop and Notify
        // If ANY key workflow is in_progress -> Stop (wait)
        // If ALL key workflows are success -> Proceed
        
        // Exclude the Enforcer itself if it runs as a workflow (unlikely if it's an App, but good safety)
        // Also exclude skipped/neutral?
        
        const relevantRuns = workflow_runs.filter(run => run.status !== 'skipped' && run.status !== 'neutral' && run.status !== 'cancelled');

        const failed = relevantRuns.filter(run => ['failure', 'timed_out'].includes(run.conclusion || ''));
        const inProgress = relevantRuns.filter(run => ['in_progress', 'queued', 'requested', 'waiting'].includes(run.status || ''));

        if (failed.length > 0) {
           const uniqueWorkflows = [...new Set(failed.map(r => r.name))];
           console.log('[Enforcer] Broken workflows detected:', uniqueWorkflows);

           // Fetch logs for failed workflows
           const logs = await Promise.all(
              failed.map(run => fetchWorkflowLogs(context, owner, repo, run.id, run.name || 'Unknown Workflow'))
           );

           const logsSection = logs.length > 0 ? `\n\n### Build Logs\n\n${logs.join('\n\n')}` : '';
           
           const message = `The following workflows have failed for commit ${headSha}:\n\n${uniqueWorkflows.map(w => `- ${w}`).join('\n')}\n\nPlease fix these issues before proceeding.${logsSection}`;
           
           await notifyJules(stateManager, julesClient, message);
           console.log('[Enforcer] Notified Jules about broken workflows. Aborting constitution check.');
           return;
        }

        if (inProgress.length > 0) {
            const runningWorkflows = [...new Set(inProgress.map(r => r.name))];
            console.log(`[Enforcer] Workflows still in progress: ${runningWorkflows.join(', ')}. Waiting for completion...`);
            // Do NOT notify Jules. Just return. We will be triggered again by workflow_run.completed
            return;
        }

        console.log('[Enforcer] All workflows passed. Proceeding with Constitution Audit...');

        // 0. Clone repository (target branch)
        let repoPath: string | undefined;
        try {
            // Get installation token
            const { token } = await context.octokit.auth({ type: 'installation' }) as any;
            
            repoPath = await repoCloner.clone(
              owner,
              repo,
              targetBranch,
              token
            );
            console.log('[Enforcer] Repository cloned to:', repoPath);

            // 1. Fetch CONSTITUTION.md and TASKS.md
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

            // 4. Take action
            if (!auditResult.compliant) {
               console.log('[Enforcer] Violations found. Posting violations...');

               const violationsList = auditResult.violations
                .map((v: string, i: number) => `${i + 1}. ${v}`)
                .join('\n');

               const comment = `## 🚨 Constitution Violation Detected\n\n@jules The following violations were found:\n\n${violationsList}\n\nPlease address these issues before merging.`;

               await context.octokit.pulls.createReview({
                owner,
                repo,
                pull_number: prNumber,
                event: 'REQUEST_CHANGES',
                body: comment,
               });

               const julesMessage = `Constitution Violation Detected:\n\n${violationsList}\n\nPlease fix these issues immediately.`;
               await notifyJules(stateManager, julesClient, julesMessage);

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
               if (isDraft) {
                  console.log('[Enforcer] PR is a draft. Marking as ready for review...');
                  try {
                    await context.octokit.graphql(`
                      mutation($id: ID!) {
                        markPullRequestReadyForReview(input: {pullRequestId: $id}) {
                          pullRequest { isDraft }
                        }
                      }
                    `, { id: prNodeId });
                    console.log('[Enforcer] Successfully marked PR as ready for review');
                  } catch (error) {
                    console.error('[Enforcer] Failed to mark PR as ready for review:', error);
                  }
               }
    
               const mergeResult = await context.octokit.pulls.merge({
                owner,
                repo,
                pull_number: prNumber,
                merge_method: 'squash',
               });
    
               console.log('[Enforcer] PR approved and merged');

                if (mergeResult.data.sha) {
                  console.log('[Enforcer] PR merged. Strategist cycle will be triggered by pull_request.closed event.');
                }
            }

        } finally {
            if (repoPath) {
              await repoCloner.cleanup(repoPath);
            }
        }
    } catch (error) {
        console.error('[Enforcer] Error processing PR:', error);
        await context.octokit.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: `❌ Error during PR review: ${error instanceof Error ? error.message : String(error)}`,
        });
    }
}

async function notifyJules(stateManager: StateManager, julesClient: JulesClient, message: string) {
  const state = await stateManager.readState();
  if (state.current_task_id) {
    try {
      await julesClient.sendMessage(state.current_task_id, message);
      console.log('[Enforcer] Sent feedback to Jules');
    } catch (error: any) {
      console.error(`[Enforcer] Failed to send feedback to session ${state.current_task_id}:`, error.message);
      
      if (error.message.includes('not found') || error.message.includes('404')) {
        console.warn('[Enforcer] Current session invalid. Attempting to recover...');
        
        const status = await julesClient.getStatus();
        const activeSession = status.sessions.find(s => 
          ['IN_PROGRESS', 'AWAITING_USER_FEEDBACK', 'PLANNING'].includes(s.state)
        );

        if (activeSession) {
           console.log(`[Enforcer] Found alternative active session: ${activeSession.name}. Retrying send...`);
           try {
             const altSessionId = activeSession.name.split('/').pop() || '';
             if (altSessionId) {
               await julesClient.sendMessage(altSessionId, message);
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
  } else {
  }
}

async function fetchWorkflowLogs(
  context: Context,
  owner: string,
  repo: string,
  runId: number,
  workflowName: string
): Promise<string> {
  try {
    console.log(`[Enforcer] Fetching logs for workflow ${workflowName} (run ${runId})...`);
    
    // 1. List jobs
    const { data: { jobs } } = await context.octokit.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });

    const failedJobs = jobs.filter(job => job.conclusion === 'failure');
    
    if (failedJobs.length === 0) {
      return `No failed jobs found for ${workflowName}.`;
    }

    const jobLogs = await Promise.all(failedJobs.map(async (job) => {
      try {
        // Helper for retry logic
        const fetchWithRetry = async (retries = 3, delay = 2000): Promise<string> => {
          try {
            const { data: logs } = await context.octokit.actions.downloadJobLogsForWorkflowRun({
              owner,
              repo,
              job_id: job.id,
            }) as any;
            return String(logs);
          } catch (e: any) {
            // Retry on 404 (Not Found) as logs might be lagging
            if (retries > 0 && (e.status === 404 || e.message?.includes('Not Found'))) {
              await new Promise(r => setTimeout(r, delay));
              return fetchWithRetry(retries - 1, delay * 2);
            }
            throw e;
          }
        };

        const logStr = await fetchWithRetry();
        const lines = logStr.split('\n');
        // Take last 100 lines
        const snippet = lines.slice(-100).join('\n');
        
        return `#### Job: ${job.name}\n\`\`\`\n${snippet}\n\`\`\``;
      } catch (err: any) {
        // Handle specific errors gracefully
        if (err.status === 404 || err.message?.includes('Not Found')) {
             return `#### Job: ${job.name}\n(Logs are not available. The job might have failed before starting or logs have expired.)`;
        }
        return `#### Job: ${job.name}\n(Failed to fetch logs: ${String(err)})`;
      }
    }));

    return `### Workflow: ${workflowName}\n${jobLogs.join('\n')}`;

  } catch (error) {
    console.error(`[Enforcer] Failed to fetch logs for run ${runId}:`, error);
    return `(Failed to fetch logs for ${workflowName})`;
  }
}
