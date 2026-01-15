import { Probot } from 'probot';
import { StateManager } from '@gcp-adl/state';
import { JulesClient } from '@gcp-adl/jules';
import { GeminiClient } from '@gcp-adl/gemini';
import { setupEnforcerHandler } from './handlers/enforcer';
import { setupStrategistHandler } from './handlers/strategist';
import { runHeartbeat } from './services/heartbeat';
import { runPlanner } from './services/planner';
import { runTroubleshooter } from './services/troubleshooter';
import { RepoCloner } from './utils/repo-cloner';
import { Request, Response, Application } from 'express';
import * as path from 'path';
import * as express from 'express';
import { Octokit } from '@octokit/rest';

/**
 * Setup server with Probot handlers and custom routes
 */
export function setupServer(app: Probot, options: any) {
  // Setup Probot webhook handlers
  console.log('[Server] Setting up Probot handlers...');
  setupEnforcerHandler(app);
  setupStrategistHandler(app, runPlanner);

  // Get the Express router from Probot options
  const getRouter = options?.getRouter;
  
  if (!getRouter) {
    console.error('[Server] getRouter not available, skipping custom routes');
    return;
  }

  const router = getRouter();

  // Serve static files for debug UI
  const publicPath = path.join(__dirname, 'public');
  console.log('[Server] Serving static files from:', publicPath);
  router.use('/debug', express.static(publicPath));
  
  // Redirect /debug to /debug/debug.html
  router.get('/debug', (req: Request, res: Response) => {
    res.redirect('/debug/debug.html');
  });

  // Health check endpoint
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'adl-monolith',
      timestamp: new Date().toISOString(),
    });
  });

  // Heartbeat endpoint (triggered by Cloud Scheduler)
  router.post('/heartbeat', async (req: Request, res: Response) => {
    console.log('[Server] Heartbeat triggered');

    try {
      const stateBucket = process.env.STATE_BUCKET;
      const julesApiKey = process.env.JULES_API_KEY;
      const geminiApiKey = process.env.GEMINI_API_KEY;
      const githubRepository = process.env.GITHUB_REPOSITORY;
      const githubBranch = process.env.GITHUB_BRANCH || 'main';

      // Validate environment variables
      if (!stateBucket) {
        throw new Error('STATE_BUCKET environment variable is required');
      }
      if (!julesApiKey) {
        throw new Error('JULES_API_KEY environment variable is required');
      }
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required');
      }
      if (!githubRepository) {
        throw new Error('GITHUB_REPOSITORY environment variable is required');
      }

      const [owner, repo] = githubRepository.split('/');

      // Initialize clients
      const stateManager = new StateManager(stateBucket);
      const julesClient = new JulesClient(julesApiKey);
      const geminiClient = new GeminiClient(geminiApiKey);
      const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN || process.env.GH_TOKEN
      });
      const repoCloner = new RepoCloner();

      // Run heartbeat with bound functions
      const result = await runHeartbeat({
        stateManager,
        julesClient,
        runPlanner: async () => {
          return runPlanner({
            stateManager,
            julesClient,
            geminiClient,
            octokit: octokit as any,
            repoCloner,
            owner,
            repo,
            branch: githubBranch,
            githubToken: process.env.GITHUB_TOKEN || process.env.GH_TOKEN!,
          });
        },
        runTroubleshooter: async (sessionId: string, question: string) => {
          return runTroubleshooter({
            julesClient,
            geminiClient,
            octokit: octokit as any,
            repoCloner,
            sessionId,
            question,
            owner,
            repo,
            branch: githubBranch,
          });
        },
      });

      res.json({ success: true, result });
    } catch (error) {
      console.error('[Server] Heartbeat failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Manual planner trigger (for testing)
  router.post('/trigger/planner', async (req: Request, res: Response) => {
    console.log('[Server] Manual planner trigger');

    try {
      const githubRepository = process.env.GITHUB_REPOSITORY;
      const githubBranch = process.env.GITHUB_BRANCH || 'main';

      if (!githubRepository) {
        throw new Error('GITHUB_REPOSITORY environment variable is required');
      }

      const [owner, repo] = githubRepository.split('/');
      const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN || process.env.GH_TOKEN
      });

      const result = await runPlanner({
        stateManager: new StateManager(process.env.STATE_BUCKET!),
        julesClient: new JulesClient(process.env.JULES_API_KEY!),
        geminiClient: new GeminiClient(process.env.GEMINI_API_KEY!),
        octokit: octokit as any,
        repoCloner: new RepoCloner(),
        owner,
        repo,
        branch: githubBranch,
        githubToken: process.env.GITHUB_TOKEN || process.env.GH_TOKEN!,
      });

      res.json({ success: true, result });
    } catch (error) {
      console.error('[Server] Planner trigger failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Debug endpoint: Force re-trigger strategist (deletes state and starts fresh)
  router.post('/debug/trigger-strategist', async (req: Request, res: Response) => {
    console.log('[Server] Debug: Force re-trigger strategist');

    try {
      const stateBucket = process.env.STATE_BUCKET;
      const julesApiKey = process.env.JULES_API_KEY;
      const geminiApiKey = process.env.GEMINI_API_KEY;
      const githubRepository = process.env.GITHUB_REPOSITORY;
      const githubBranch = process.env.GITHUB_BRANCH || 'main';

      // Validate environment variables
      if (!stateBucket) {
        throw new Error('STATE_BUCKET environment variable is required');
      }
      if (!julesApiKey) {
        throw new Error('JULES_API_KEY environment variable is required');
      }
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required');
      }
      if (!githubRepository) {
        throw new Error('GITHUB_REPOSITORY environment variable is required');
      }

      const [owner, repo] = githubRepository.split('/');

      // Initialize clients
      const stateManager = new StateManager(stateBucket);
      const julesClient = new JulesClient(julesApiKey);
      const geminiClient = new GeminiClient(geminiApiKey);
      
      // Create Octokit instance with GitHub token
      const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN || process.env.GH_TOKEN
      });

      // Step 1: Reset state completely (deletes session, resets to default)
      console.log('[Debug] Resetting state to default...');
      await stateManager.resetState();

      // Step 2: Trigger planner
      console.log('[Debug] Triggering planner...');
      const result = await runPlanner({
        stateManager,
        julesClient,
        geminiClient,
        octokit: octokit as any,
        repoCloner: new RepoCloner(),
        owner,
        repo,
        branch: githubBranch,
        githubToken: process.env.GITHUB_TOKEN || process.env.GH_TOKEN!,
      });

      res.json({
        success: true,
        message: 'Strategist triggered successfully. State reset and planner executed.',
        result,
      });
    } catch (error) {
      console.error('[Server] Debug trigger failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  console.log('[Server] Routes configured successfully');
}
