import { StateManager } from '@gcp-adl/state';
import { GeminiClient } from '@gcp-adl/gemini';
import { GitHubClient } from '@gcp-adl/github';
import { PubSub } from '@google-cloud/pubsub';
import express from 'express';

/**
 * Strategist Service
 * Learns from merges by:
 * 1. Getting the latest commit diff
 * 2. Extracting lessons learned using Gemini
 * 3. Updating AGENTS.md
 * 4. Updating TASKS.md (marking completed, adding new)
 * 5. Restarting the loop
 * 6. Triggering the Planner
 */

const PORT = process.env.PORT || 8080;
const STATE_BUCKET = process.env.STATE_BUCKET!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY!;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const PUBSUB_PROJECT_ID = process.env.PUBSUB_PROJECT_ID!;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET; // Optional

// Pub/Sub topic
const PLANNER_TOPIC = 'adl-planner-trigger';

// Validate environment variables
if (!STATE_BUCKET) throw new Error('STATE_BUCKET is required');
if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required');
if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is required');
if (!GITHUB_REPOSITORY) throw new Error('GITHUB_REPOSITORY is required');
if (!PUBSUB_PROJECT_ID) throw new Error('PUBSUB_PROJECT_ID is required');

const stateManager = new StateManager(STATE_BUCKET);
const geminiClient = new GeminiClient(GEMINI_API_KEY);
const githubClient = new GitHubClient(GITHUB_TOKEN, GITHUB_REPOSITORY);
const pubsub = new PubSub({ projectId: PUBSUB_PROJECT_ID });

/**
 * Main strategist logic
 */
async function runStrategist() {
  console.log('Starting strategist...');

  try {
    // 1. Get the latest commit diff
    console.log('Fetching latest commit diff...');
    const mergeDiff = await githubClient.getLatestCommitDiff(GITHUB_BRANCH);

    if (!mergeDiff) {
      console.log('No diff found, skipping');
      return { success: true, message: 'No diff to process' };
    }

    // 2. Fetch current AGENTS.md and TASKS.md
    console.log('Fetching repository files...');
    const [agentsContent, tasksContent] = await Promise.all([
      githubClient.getFileContent('AGENTS.md', GITHUB_BRANCH),
      githubClient.getFileContent('TASKS.md', GITHUB_BRANCH),
    ]);

    // 3. Extract lessons learned
    console.log('Extracting lessons with Gemini...');
    const updatedAgents = await geminiClient.extractLessons(agentsContent, mergeDiff);

    // 4. Update TASKS.md
    console.log('Updating TASKS.md with Gemini...');
    const updatedTasks = await geminiClient.updateTasks(tasksContent, mergeDiff);

    // 5. Update files in the repository
    console.log('Updating AGENTS.md...');
    await githubClient.updateFile(
      'AGENTS.md',
      updatedAgents,
      'chore: update agent memory after merge',
      GITHUB_BRANCH
    );

    console.log('Updating TASKS.md...');
    await githubClient.updateFile(
      'TASKS.md',
      updatedTasks,
      'chore: update tasks after merge',
      GITHUB_BRANCH
    );

    // 6. Restart the loop
    console.log('Restarting loop...');
    await stateManager.startLoop();

    // 7. Trigger Planner
    console.log('Triggering Planner...');
    const topic = pubsub.topic(PLANNER_TOPIC);
    const messageBuffer = Buffer.from(JSON.stringify({
      trigger: 'strategist',
      timestamp: new Date().toISOString(),
    }));
    await topic.publishMessage({ data: messageBuffer });

    console.log('Strategist completed successfully');

    return { success: true, message: 'Lessons learned and tasks updated' };
  } catch (error) {
    console.error('Error in strategist:', error);
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
  res.json({ status: 'healthy', service: 'strategist' });
});

// GitHub webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    // TODO: Verify webhook signature if WEBHOOK_SECRET is set

    const event = req.headers['x-github-event'];
    const payload = req.body;

    console.log('Received GitHub webhook:', event);

    // Handle push events to main branch
    if (event === 'push') {
      const ref = payload.ref;
      const expectedRef = `refs/heads/${GITHUB_BRANCH}`;

      if (ref === expectedRef) {
        console.log(`Push to ${GITHUB_BRANCH}, running strategist...`);
        
        const result = await runStrategist();
        res.json({ success: true, result });
      } else {
        console.log(`Ignoring push to ${ref}`);
        res.json({ success: true, message: 'Event ignored' });
      }
    } else {
      console.log(`Ignoring event: ${event}`);
      res.json({ success: true, message: 'Event ignored' });
    }
  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Manual trigger endpoint (for testing)
app.post('/run', async (req, res) => {
  try {
    const result = await runStrategist();
    res.json({ success: true, result });
  } catch (error) {
    console.error('Strategist failed:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Strategist service listening on port ${PORT}`);
});
