import { StateManager } from '@gcp-adl/state';
import { JulesClient } from '@gcp-adl/jules';
import { GeminiClient } from '@gcp-adl/gemini';
import { GitHubClient } from '@gcp-adl/github';
import express from 'express';

/**
 * Enforcer Service
 * Reviews PRs by:
 * 1. Getting PR diff
 * 2. Auditing against CONSTITUTION.md using Gemini
 * 3. Posting violations or approving and merging
 */

const PORT = process.env.PORT || 8080;
const STATE_BUCKET = process.env.STATE_BUCKET!;
const JULES_API_KEY = process.env.JULES_API_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY!;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET; // Optional: for webhook verification

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
 * Main enforcer logic
 */
async function enforcePR(prNumber: number) {
  console.log(`Enforcing PR #${prNumber}...`);

  try {
    // 1. Get PR diff
    console.log('Fetching PR diff...');
    const prDiff = await githubClient.getPRDiff(prNumber);

    // 2. Fetch CONSTITUTION and TASKS
    console.log('Fetching repository files...');
    const [constitutionContent, tasksContent] = await Promise.all([
      githubClient.getFileContent('CONSTITUTION.md', GITHUB_BRANCH),
      githubClient.getFileContent('TASKS.md', GITHUB_BRANCH),
    ]);

    // 3. Audit with Gemini
    console.log('Auditing PR with Gemini...');
    const auditResult = await geminiClient.auditPR(
      constitutionContent,
      tasksContent,
      prDiff
    );

    console.log('Audit result:', auditResult);

    // 4. Take action based on audit result
    if (!auditResult.compliant) {
      console.log('Violations found. Posting violations...');
      
      const violationsList = auditResult.violations
        .map((v, i) => `${i + 1}. ${v}`)
        .join('\n');

      const comment = `## 🚨 Constitution Violation Detected

@jules The following violations were found:

${violationsList}

Please address these issues before merging.`;

      await githubClient.commentOnPR(prNumber, comment);
      await githubClient.requestChanges(prNumber, 'Constitution violations detected. See comments for details.');

      // Send feedback to Jules
      const state = await stateManager.readState();
      if (state.current_task_id) {
        const julesMessage = `Constitution Violation Detected:\n\n${violationsList}\n\nPlease fix these issues immediately.`;
        await julesClient.sendMessage(state.current_task_id, julesMessage);
        console.log('Sent violation feedback to Jules');
      }

      return { success: true, compliant: false, violations: auditResult.violations };
    } else {
      console.log('PR is compliant. Approving and merging...');
      
      await githubClient.approvePR(prNumber, '✅ Constitution compliant. LGTM!');
      await githubClient.mergePR(prNumber);

      console.log('PR approved and merged');

      return { success: true, compliant: true, merged: true };
    }
  } catch (error) {
    console.error('Error in enforcer:', error);
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
  res.json({ status: 'healthy', service: 'enforcer' });
});

// GitHub webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    // TODO: Verify webhook signature if WEBHOOK_SECRET is set

    const event = req.headers['x-github-event'];
    const payload = req.body;

    console.log('Received GitHub webhook:', event);

    // Handle pull_request events
    if (event === 'pull_request') {
      const action = payload.action;
      const prNumber = payload.pull_request?.number;

      // Only process opened, synchronize (new commits), and reopened events
      if (['opened', 'synchronize', 'reopened'].includes(action) && prNumber) {
        console.log(`Processing PR #${prNumber} (action: ${action})`);
        
        const result = await enforcePR(prNumber);
        res.json({ success: true, result });
      } else {
        console.log(`Ignoring PR action: ${action}`);
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
    const { prNumber } = req.body;
    
    if (!prNumber) {
      res.status(400).json({ error: 'prNumber is required' });
      return;
    }

    const result = await enforcePR(prNumber);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Enforcer failed:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Enforcer service listening on port ${PORT}`);
});
