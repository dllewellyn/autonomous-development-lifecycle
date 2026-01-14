import { JulesClient } from '@gcp-adl/jules';
import { GeminiClient } from '@gcp-adl/gemini';
import { GitHubClient } from '@gcp-adl/github';
import express from 'express';

/**
 * Troubleshooter Service
 * Provides answers to Jules when waiting for input by:
 * 1. Getting the blocker question from Jules (future enhancement)
 * 2. Using Gemini to analyze codebase and generate answer
 * 3. Posting answer back to Jules
 * 
 * Note: This is a simplified implementation. The Jules API may need
 * additional endpoints to fetch blocker questions.
 */

const PORT = process.env.PORT || 8080;
const JULES_API_KEY = process.env.JULES_API_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY!;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

// Validate environment variables
if (!JULES_API_KEY) throw new Error('JULES_API_KEY is required');
if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required');
if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is required');
if (!GITHUB_REPOSITORY) throw new Error('GITHUB_REPOSITORY is required');

const julesClient = new JulesClient(JULES_API_KEY);
const geminiClient = new GeminiClient(GEMINI_API_KEY);
const githubClient = new GitHubClient(GITHUB_TOKEN, GITHUB_REPOSITORY);

/**
 * Main troubleshooter logic
 */
async function runTroubleshooter(sessionId: string, question: string) {
  console.log(`Troubleshooting session ${sessionId}...`);

  try {
    // 1. Fetch context files
    console.log('Fetching repository files...');
    const [contextMapContent, constitutionContent] = await Promise.all([
      githubClient.getFileContent('CONTEXT_MAP.md', GITHUB_BRANCH),
      githubClient.getFileContent('CONSTITUTION.md', GITHUB_BRANCH),
    ]);

    // 2. Generate answer with Gemini
    console.log('Generating answer with Gemini...');
    const prompt = `You are the Troubleshooter for an autonomous development system.

Jules has encountered a blocker and needs technical input.

Analyze the codebase and provide a definitive technical answer to the following question:

${question}

### CONTEXT_MAP.md
\`\`\`
${contextMapContent}
\`\`\`

### CONSTITUTION.md
\`\`\`
${constitutionContent}
\`\`\`

Provide a clear, actionable answer that Jules can use to proceed.`;

    const answer = await geminiClient.generateContent(prompt);

    console.log('Generated answer:', answer.substring(0, 200) + '...');

    // 3. Post answer to Jules
    console.log('Posting answer to Jules...');
    await julesClient.sendMessage(sessionId, answer);

    console.log('Troubleshooter completed successfully');

    return { success: true, answer: answer.substring(0, 500) };
  } catch (error) {
    console.error('Error in troubleshooter:', error);
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
  res.json({ status: 'healthy', service: 'troubleshooter' });
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

    // Note: In a real implementation, you would fetch the session ID and question
    // from the Jules API or from the trigger data
    const sessionId = data.sessionId || 'unknown';
    const question = data.question || 'Please provide more information about the task.';

    const result = await runTroubleshooter(sessionId, question);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Troubleshooter failed:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Manual trigger endpoint (for testing)
app.post('/run', async (req, res) => {
  try {
    const { sessionId, question } = req.body;
    
    if (!sessionId || !question) {
      res.status(400).json({ error: 'sessionId and question are required' });
      return;
    }

    const result = await runTroubleshooter(sessionId, question);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Troubleshooter failed:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Troubleshooter service listening on port ${PORT}`);
});
