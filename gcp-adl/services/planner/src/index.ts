import { StateManager } from '@gcp-adl/state';
import { JulesClient } from '@gcp-adl/jules';
import { GeminiClient } from '@gcp-adl/gemini';
import { GitHubClient } from '@gcp-adl/github';
import { PubSub } from '@google-cloud/pubsub';
import express from 'express';

/**
 * Planner Service
 * Creates new Jules tasks by:
 * 1. Analyzing GOALS.md, TASKS.md, CONTEXT_MAP.md, AGENTS.md using Gemini
 * 2. Generating a detailed plan
 * 3. Creating a Jules session with the plan
 * 4. Updating Ralph state
 */

const PORT = process.env.PORT || 8080;
const STATE_BUCKET = process.env.STATE_BUCKET!;
const JULES_API_KEY = process.env.JULES_API_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY!;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const PUBSUB_PROJECT_ID = process.env.PUBSUB_PROJECT_ID!;

// Validate environment variables
if (!STATE_BUCKET) throw new Error('STATE_BUCKET is required');
if (!JULES_API_KEY) throw new Error('JULES_API_KEY is required');
if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required');
if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is required');
if (!GITHUB_REPOSITORY) throw new Error('GITHUB_REPOSITORY is required');

const stateManager = new StateManager(STATE_BUCKET);
const julesClient = new JulesClient(JULES_API_KEY);
const geminiClient = new GeminiClient(GEMINI_API_KEY);
const githubClient = new GitHubClient(GITHUB_TOKEN, GITHUB_REPOSITORY);

/**
 * Main planner logic
 */
async function runPlanner() {
  console.log('Starting planner...');

  try {
    // 1. Check for active session
    const currentState = await stateManager.readState();
    if (currentState.current_task_id) {
      const session = await julesClient.getSession(currentState.current_task_id);
      if (['QUEUED', 'PLANNING', 'IN_PROGRESS'].includes(session.state)) {
        console.log('Active session already exists:', currentState.current_task_id);
        return { success: true, message: 'Active session already exists', sessionId: currentState.current_task_id };
      }
    }

    // 2. Fetch repository files
    console.log('Fetching repository files...');
    const [goalsContent, tasksContent, contextMapContent, agentsContent] = await Promise.all([
      githubClient.getFileContent('GOALS.md', GITHUB_BRANCH),
      githubClient.getFileContent('TASKS.md', GITHUB_BRANCH),
      githubClient.getFileContent('CONTEXT_MAP.md', GITHUB_BRANCH),
      githubClient.getFileContent('AGENTS.md', GITHUB_BRANCH),
    ]);

    // 3. Generate plan using Gemini
    console.log('Generating plan with Gemini...');
    const plan = await geminiClient.generatePlan(
      goalsContent,
      tasksContent,
      contextMapContent,
      agentsContent
    );

    console.log('Generated plan:', plan.substring(0, 200) + '...');

    // 4. Create Jules session
    console.log('Creating Jules session...');
    const [owner, repo] = GITHUB_REPOSITORY.split('/');
    const sessionId = await julesClient.createRepoSession(
      owner,
      repo,
      GITHUB_BRANCH,
      plan
    );

    console.log('Jules session created:', sessionId);

    // 5. Update state
    await stateManager.updateSessionId(sessionId);
    await stateManager.incrementIteration();

    console.log('Planner completed successfully');

    return { success: true, sessionId, plan: plan.substring(0, 500) };
  } catch (error) {
    console.error('Error in planner:', error);
    throw error;
  }
}

/**
 * Express app for Cloud Run
 */
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'healthy', service: 'planner' });
});

// Pub/Sub push endpoint
app.post('/trigger', async (req, res) => {
  try {
    // Decode Pub/Sub message
    const pubsubMessage = req.body.message;
    if (!pubsubMessage) {
      res.status(400).json({ error: 'No Pub/Sub message found' });
      return;
    }

    const data = pubsubMessage.data
      ? JSON.parse(Buffer.from(pubsubMessage.data, 'base64').toString())
      : {};

    console.log('Received trigger:', data);

    // Run planner
    const result = await runPlanner();
    res.json({ success: true, result });
  } catch (error) {
    console.error('Planner failed:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Manual trigger endpoint (for testing)
app.post('/run', async (req, res) => {
  try {
    const result = await runPlanner();
    res.json({ success: true, result });
  } catch (error) {
    console.error('Planner failed:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Planner service listening on port ${PORT}`);
});
