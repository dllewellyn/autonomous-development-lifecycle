import { StateManager } from '@gcp-adl/state';
import { JulesClient } from '@gcp-adl/jules';
import { GeminiClient } from '@gcp-adl/gemini';
import { Octokit } from '@octokit/rest';
import { RepoCloner } from '../utils/repo-cloner';

export interface PlannerContext {
  stateManager: StateManager;
  julesClient: JulesClient;
  geminiClient: GeminiClient;
  octokit: Octokit;
  repoCloner: RepoCloner;
  owner: string;
  repo: string;
  branch: string;
  githubToken: string;
}

export interface PlannerResult {
  success: boolean;
  sessionId?: string;
  plan?: string;
  message?: string;
}

/**
 * Planner Service - Creates new Jules tasks
 * This is an internal function, not an exposed endpoint
 */
export async function runPlanner(context: PlannerContext): Promise<PlannerResult> {
  console.log('[Planner] Starting task creation...');
  let repoPath: string | undefined;

  try {
    // 0. Clone repository
    repoPath = await context.repoCloner.clone(
      context.owner,
      context.repo,
      context.branch,
      context.githubToken
    );
    console.log('[Planner] Repository cloned to:', repoPath);

    // 1. Check for active session
    const currentState = await context.stateManager.readState();
    if (currentState.current_task_id) {
      try {
        const session = await context.julesClient.getSession(currentState.current_task_id);
        if (['QUEUED', 'PLANNING', 'IN_PROGRESS'].includes(session.state)) {
          console.log('[Planner] Active session already exists:', currentState.current_task_id);
          return {
            success: true,
            message: 'Active session already exists',
            sessionId: currentState.current_task_id,
          };
        }
      } catch (error: any) {
        // If 404, session is gone. Logs warning and proceeds to create a new one.
        if (error.message.includes('not found') || error.message.includes('404') || (error.response && error.response.status === 404)) {
          console.warn(`[Planner] Stale session ID found in state: ${currentState.current_task_id}. Proceeding to create new session.`);
        } else {
          // Real error, rethrow
          throw error;
        }
      }
    }

    // 2. Fetch repository files
    console.log('[Planner] Fetching repository files...');
    const [goalsRes, tasksRes, contextMapRes, agentsRes] = await Promise.all([
      context.octokit.repos.getContent({
        owner: context.owner,
        repo: context.repo,
        path: 'GOALS.md',
        ref: context.branch,
      }),
      context.octokit.repos.getContent({
        owner: context.owner,
        repo: context.repo,
        path: 'TASKS.md',
        ref: context.branch,
      }),
      context.octokit.repos.getContent({
        owner: context.owner,
        repo: context.repo,
        path: 'CONTEXT_MAP.md',
        ref: context.branch,
      }),
      context.octokit.repos.getContent({
        owner: context.owner,
        repo: context.repo,
        path: 'AGENTS.md',
        ref: context.branch,
      }),
    ]);

    // Decode base64 content
    const goalsContent = Buffer.from((goalsRes.data as any).content, 'base64').toString('utf-8');
    const tasksContent = Buffer.from((tasksRes.data as any).content, 'base64').toString('utf-8');
    const contextMapContent = Buffer.from((contextMapRes.data as any).content, 'base64').toString('utf-8');
    const agentsContent = Buffer.from((agentsRes.data as any).content, 'base64').toString('utf-8');

    // 3. Generate plan using Gemini
    console.log('[Planner] Generating plan with Gemini...');
    const plan = await context.geminiClient.generatePlan(
      goalsContent,
      tasksContent,
      contextMapContent,
      agentsContent,
      { cwd: repoPath }
    );

    console.log('[Planner] Generated plan (preview):', plan.substring(0, 200) + '...');

    // 4. Create Jules session
    console.log('[Planner] Creating Jules session...');
    const sessionId = await context.julesClient.createRepoSession(
      context.owner,
      context.repo,
      context.branch,
      plan
    );

    console.log('[Planner] Jules session created:', sessionId);

    // 5. Update state
    await context.stateManager.updateSessionId(sessionId);
    await context.stateManager.incrementIteration();

    console.log('[Planner] Completed successfully');

    return {
      success: true,
      sessionId,
      plan: plan.substring(0, 500),
    };
  } catch (error) {
    console.error('[Planner] Error:', error);
    throw error;
  } finally {
    if (repoPath) {
      await context.repoCloner.cleanup(repoPath);
    }
  }
}
