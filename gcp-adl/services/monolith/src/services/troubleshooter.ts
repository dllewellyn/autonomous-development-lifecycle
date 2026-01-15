import { JulesClient } from '@gcp-adl/jules';
import { GeminiClient } from '@gcp-adl/gemini';
import { Octokit } from '@octokit/rest';

export interface TroubleshooterContext {
  julesClient: JulesClient;
  geminiClient: GeminiClient;
  octokit: Octokit;
  sessionId: string;
  question: string;
  owner: string;
  repo: string;
  branch: string;
}

export interface TroubleshooterResult {
  success: boolean;
  answer?: string;
}

/**
 * Troubleshooter Service - Answers Jules questions
 * This is an internal function, not an exposed endpoint
 */
export async function runTroubleshooter(context: TroubleshooterContext): Promise<TroubleshooterResult> {
  console.log(`[Troubleshooter] Processing question for session ${context.sessionId}...`);

  try {
    // 1. Fetch context files
    console.log('[Troubleshooter] Fetching repository files...');
    const [contextMapRes, constitutionRes] = await Promise.all([
      context.octokit.repos.getContent({
        owner: context.owner,
        repo: context.repo,
        path: 'CONTEXT_MAP.md',
        ref: context.branch,
      }),
      context.octokit.repos.getContent({
        owner: context.owner,
        repo: context.repo,
        path: 'CONSTITUTION.md',
        ref: context.branch,
      }),
    ]);

    // Decode base64 content
    const contextMapContent = Buffer.from((contextMapRes.data as any).content, 'base64').toString('utf-8');
    const constitutionContent = Buffer.from((constitutionRes.data as any).content, 'base64').toString('utf-8');

    // 2. Generate answer with Gemini
    console.log('[Troubleshooter] Generating answer with Gemini...');
    const prompt = `You are the Troubleshooter for an autonomous development system.

Jules has encountered a blocker and needs technical input.

Analyze the codebase and provide a definitive technical answer to the following question:

${context.question}

### CONTEXT_MAP.md
\`\`\`
${contextMapContent}
\`\`\`

### CONSTITUTION.md
\`\`\`
${constitutionContent}
\`\`\`

Provide a clear, actionable answer that Jules can use to proceed.`;

    const answer = await context.geminiClient.generateContent(prompt);

    console.log('[Troubleshooter] Generated answer (preview):', answer.substring(0, 200) + '...');

    // 3. Post answer to Jules
    console.log('[Troubleshooter] Posting answer to Jules...');
    await context.julesClient.sendMessage(context.sessionId, answer);

    console.log('[Troubleshooter] Completed successfully');

    return {
      success: true,
      answer: answer.substring(0, 500),
    };
  } catch (error) {
    console.error('[Troubleshooter] Error:', error);
    throw error;
  }
}
