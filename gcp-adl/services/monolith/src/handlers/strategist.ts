import { Probot, Context } from 'probot';
import { StateManager } from '@gcp-adl/state';
import { GeminiClient } from '@gcp-adl/gemini';
import { PlannerContext } from '../services/planner';
import { RepoCloner } from '../utils/repo-cloner';

/**
 * Strategist Handler - Learns from merges and restarts the cycle
 */
export function setupStrategistHandler(
  app: Probot,
  runPlanner: (context: PlannerContext) => Promise<any>
) {
  app.on('push', async (context: Context<'push'>) => {
    const { repository, ref, commits } = context.payload;
    const owner = repository.owner.login || repository.owner.name || '';
    const repo = repository.name;
    const branch = process.env.GITHUB_BRANCH || 'main';
    
    console.log(`[Strategist] Processing push to ${branch} in ${owner}/${repo}`);
    
    if (!owner) {
      console.error('[Strategist] Unable to determine repository owner');
      return;
    }

    // Only process pushes to main branch
    if (ref !== `refs/heads/${branch}`) {
      console.log(`[Strategist] Ignoring push to ${ref}`);
      return;
    }

    // Skip pushes made by the strategist itself to avoid infinite loops
    const latestCommit = commits[commits.length - 1];
    const commitMessage = latestCommit.message;
    if (
      commitMessage.includes('chore: update agent memory after merge') ||
      commitMessage.includes('chore: update tasks after merge')
    ) {
      console.log(`[Strategist] Ignoring push from strategist itself: ${commitMessage}`);
      return;
    }

    console.log(`[Strategist] Processing push to ${branch} in ${owner}/${repo}`);

    let repoPath: string | undefined;
    const repoCloner = new RepoCloner();

    try {
      // Initialize clients
      const geminiClient = new GeminiClient(process.env.GEMINI_API_KEY!);
      const stateManager = new StateManager(process.env.STATE_BUCKET!);

      // 0. Clone repository
      repoPath = await repoCloner.clone(
        owner,
        repo,
        branch,
        process.env.GITHUB_TOKEN || process.env.GH_TOKEN!
      );
      console.log('[Strategist] Repository cloned to:', repoPath);

      // 1. Get the latest commit diff
      console.log(`[Strategist] Fetching diff for commit ${latestCommit.id}...`);

      const commitData = await context.octokit.repos.getCommit({
        owner,
        repo,
        ref: latestCommit.id,
      });

      const mergeDiff = commitData.data.files
        ?.map(
          (file) =>
            `--- a/${file.filename}\n+++ b/${file.filename}\n${file.patch || ''}`
        )
        .join('\n\n');

      if (!mergeDiff) {
        console.log('[Strategist] No diff found, skipping');
        return;
      }

      // 2. Fetch AGENTS.md and TASKS.md
      console.log('[Strategist] Fetching repository files...');
      const [agentsRes, tasksRes] = await Promise.all([
        context.octokit.repos.getContent({
          owner,
          repo,
          path: 'AGENTS.md',
          ref: branch,
        }),
        context.octokit.repos.getContent({
          owner,
          repo,
          path: 'TASKS.md',
          ref: branch,
        }),
      ]);

      const agentsContent = Buffer.from(
        (agentsRes.data as any).content,
        'base64'
      ).toString('utf-8');
      const tasksContent = Buffer.from(
        (tasksRes.data as any).content,
        'base64'
      ).toString('utf-8');

      // 3. Extract lessons learned
      console.log('[Strategist] Extracting lessons with Gemini...');
      const updatedAgents = await geminiClient.extractLessons(
        agentsContent,
        mergeDiff,
        { cwd: repoPath }
      );

      // 4. Update TASKS.md
      console.log('[Strategist] Updating TASKS.md with Gemini...');
      const updatedTasks = await geminiClient.updateTasks(
        tasksContent,
        mergeDiff,
        { cwd: repoPath }
      );

      // 5. Update files in the repository
      console.log('[Strategist] Updating AGENTS.md...');
      await context.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: 'AGENTS.md',
        message: 'chore: update agent memory after merge',
        content: Buffer.from(updatedAgents).toString('base64'),
        sha: (agentsRes.data as any).sha,
        branch,
      });

      console.log('[Strategist] Updating TASKS.md...');
      await context.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: 'TASKS.md',
        message: 'chore: update tasks after merge',
        content: Buffer.from(updatedTasks).toString('base64'),
        sha: (tasksRes.data as any).sha,
        branch,
      });

      // 6. Restart the loop
      console.log('[Strategist] Restarting loop...');
      await stateManager.startLoop();

      // 7. Trigger planner (internal call)
      console.log('[Strategist] Triggering planner...');
      await runPlanner({
        stateManager,
        julesClient: new (require('@gcp-adl/jules').JulesClient)(
          process.env.JULES_API_KEY!
        ),
        geminiClient,
        octokit: context.octokit as any,
        repoCloner,
        owner,
        repo,
        branch,
      });

      console.log('[Strategist] Completed successfully');
    } catch (error) {
      console.error('[Strategist] Error processing push:', error);
      
      // Create an issue to notify about the error
      await context.octokit.issues.create({
        owner,
        repo,
        title: '❌ Strategist Error',
        body: `An error occurred while processing the merge:\n\n\`\`\`\n${
          error instanceof Error ? error.message : String(error)
        }\n\`\`\``,
        labels: ['adl-error'],
      });
    } finally {
      if (repoPath) {
        await repoCloner.cleanup(repoPath);
      }
    }
  });
}
