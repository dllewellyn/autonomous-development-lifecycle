import { Probot } from 'probot';
import { StateManager } from '@gcp-adl/state';
import { JulesClient } from '@gcp-adl/jules';
import { GeminiClient } from '@gcp-adl/gemini';
import { setupEnforcerHandler } from './handlers/enforcer';
import { setupStrategistHandler } from './handlers/strategist';
import { runHeartbeat } from './services/heartbeat';
import { runPlanner } from './services/planner';
import { runTroubleshooter } from './services/troubleshooter';
import { Request, Response } from 'express';

/**
 * Setup server with Probot handlers and custom routes
 */
export function setupServer(app: Probot) {
  const router = (app as any).route ? (app as any).route() : undefined;
  
  if (!router) {
    console.warn('[Server] app.route() not available, skipping custom routes');
  }

  // Setup Probot webhook handlers
  console.log('[Server] Setting up Probot handlers...');
  setupEnforcerHandler(app);
  setupStrategistHandler(app, runPlanner);

  if (!router) return;

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

      // Run heartbeat with bound functions
      const result = await runHeartbeat({
        stateManager,
        julesClient,
        runPlanner: async () => {
          return runPlanner({
            stateManager,
            julesClient,
            geminiClient,
            octokit: app.auth() as any,
            owner,
            repo,
            branch: githubBranch,
          });
        },
        runTroubleshooter: async (sessionId: string, question: string) => {
          return runTroubleshooter({
            julesClient,
            geminiClient,
            octokit: app.auth() as any,
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

      const result = await runPlanner({
        stateManager: new StateManager(process.env.STATE_BUCKET!),
        julesClient: new JulesClient(process.env.JULES_API_KEY!),
        geminiClient: new GeminiClient(process.env.GEMINI_API_KEY!),
        octokit: app.auth() as any,
        owner,
        repo,
        branch: githubBranch,
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

  console.log('[Server] Routes configured successfully');
}
