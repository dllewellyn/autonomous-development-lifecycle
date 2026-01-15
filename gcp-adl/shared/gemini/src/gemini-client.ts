import { spawn } from 'child_process';

/**
 * Gemini Client
 * Wrapper around Gemini CLI for ADL use cases
 */
export class GeminiClient {
  private apiKey: string;
  private model: string;
  private cliPath: string;

  constructor(apiKey: string, model: string = 'gemini-2.0-flash-exp') {
    this.apiKey = apiKey;
    this.model = model;
    // In Docker/Node environment, binary from dependencies is usually in path
    // or we can use npx. We'll try direct invocation assuming global install or path setup
    this.cliPath = 'gemini'; 
  }

  /**
   * Execute the Gemini CLI with a prompt
   */
  private async runCli(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Calling `gemini prompt` and piping content to stdin
      // This assumes the CLI accepts stdin for the prompt
      const args = ['prompt']; 
      
      const child = spawn(this.cliPath, args, {
        env: {
          ...process.env,
          GEMINI_API_KEY: this.apiKey,
        },
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        // Fallback to npx if direct binary fails
        if ((error as any).code === 'ENOENT') {
             console.log('gemini binary not found, trying npx...');
             this.runCliNpx(prompt).then(resolve).catch(reject);
             return;
        }
        reject(new Error(`Failed to spawn gemini CLI: ${error.message}`));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Gemini CLI exited with code ${code}: ${stderr}`));
        } else {
          resolve(stdout.trim());
        }
      });

      // Write prompt to stdin
      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  private async runCliNpx(prompt: string): Promise<string> {
      return new Promise((resolve, reject) => {
        const args = ['@google/gemini-cli', 'prompt'];
        
        const child = spawn('npx', args, {
            env: {
            ...process.env,
            GEMINI_API_KEY: this.apiKey,
            },
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('error', (error) => {
            reject(new Error(`Failed to spawn npx gemini: ${error.message}`));
        });

        child.on('close', (code) => {
            if (code !== 0) {
            reject(new Error(`Gemini CLI (npx) exited with code ${code}: ${stderr}`));
            } else {
            resolve(stdout.trim());
            }
        });

        child.stdin.write(prompt);
        child.stdin.end();
      });
  }

  /**
   * Generate content from a prompt
   */
  async generateContent(prompt: string): Promise<string> {
    try {
      return await this.runCli(prompt);
    } catch (error) {
      console.error('Error generating content with Gemini CLI:', error);
      throw new Error(`Failed to generate content: ${error}`);
    }
  }

  /**
   * Generate content with file context
   * Useful for analyzing repository files
   */
  async generateWithContext(
    systemPrompt: string,
    files: Array<{ path: string; content: string }>
  ): Promise<string> {
    const fileContext = files
      .map(f => `
### File: ${f.path}\n\
```\
${f.content}\n```
`)
      .join('\n');

    const fullPrompt = `${systemPrompt}\n\n## Repository Files:\n${fileContext}`;

    return this.generateContent(fullPrompt);
  }

  /**
   * Analyze and generate a plan
   * Used by the Planner service
   */
  async generatePlan(
    goalsContent: string,
    tasksContent: string,
    contextMapContent: string,
    agentsContent: string
  ): Promise<string> {
    const prompt = `You are the Planner for an autonomous development system.

Analyze the following files:

### GOALS.md
\
```\
${goalsContent}\n```

### TASKS.md
\
```\
${tasksContent}\n```

### CONTEXT_MAP.md
\
```\
${contextMapContent}\n```

### AGENTS.md
\
```\
${agentsContent}\n```

Generate a detailed technical plan for the next task to work on.
The plan should:
1. Select the highest priority task from TASKS.md
2. Break it down into concrete implementation steps
3. Reference relevant parts of CONTEXT_MAP.md
4. Consider lessons learned from AGENTS.md
5. Be specific enough for Jules to execute

Output the plan in markdown format.`;

    return this.generateContent(prompt);
  }

  /**
   * Audit a PR against the constitution
   * Used by the Enforcer service
   */
  async auditPR(
    constitutionContent: string,
    tasksContent: string,
    prDiff: string
  ): Promise<{ compliant: boolean; violations: string[] }> {
    const prompt = `You are the Enforcer for an autonomous development system.

Your task is to review the code changes in this pull request against the repository's CONSTITUTION.md and ensure the intended task has been completed correctly as per TASKS.md.

### CONSTITUTION.md
\
```\
${constitutionContent}\n```

### TASKS.md
\
```\
${tasksContent}\n```

### PR Diff
\
```\
${prDiff}\n```

Please:
1. Verify that the changes comply with ALL rules in CONSTITUTION.md.
2. Identify the task(s) from TASKS.md this PR is intended to complete.
3. Verify that the task(s) have been implemented correctly and completely.
4. If there are code violations or the task implementation is incorrect/incomplete, list them as violations.
5. If everything is compliant and the task is fully satisfied, respond with compliant: true.

Respond in JSON format:
{
  "compliant": true/false,
  "violations": ["reason/violation 1", "reason/violation 2", ...]
}`;

    const response = await this.generateContent(prompt);
    
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Fallback: If no JSON found, assume non-compliant if text suggests it
      console.warn('No JSON found in response, attempting loose parse or fail');
      throw new Error('Failed to parse audit response as JSON');
    }

    return JSON.parse(jsonMatch[0]);
  }

  /**
   * Extract lessons learned from a merge
   * Used by the Strategist service
   */
  async extractLessons(
    currentAgentsContent: string,
    mergeDiff: string
  ): Promise<string> {
    const prompt = `You are the Strategist for an autonomous development system.

A PR has just been merged to main. Analyze the changes and extract lessons learned.

### Current AGENTS.md
\
```\
${currentAgentsContent}\n```

### Merged Changes
\
```\
${mergeDiff}\n```

Review the merged changes for patterns, challenges, or insights.
Update AGENTS.md with new lessons learned.
Format as a new entry with today's date.

IMPORTANT:
- If no new lessons are found, output the original content of AGENTS.md exactly as is.
- Output ONLY the raw content of the updated file.
- Do NOT use markdown code blocks (\
```\
).
- Do NOT include any conversational text.
- The output must start directly with the file content.`;

    return this.generateContent(prompt);
  }

  /**
   * Update TASKS.md after a merge
   * Used by the Strategist service
   */
  async updateTasks(
    currentTasksContent: string,
    mergeDiff: string
  ): Promise<string> {
    const prompt = `You are the Strategist for an autonomous development system.

A task has been completed and merged. Update TASKS.md by:
1. Reading the current TASKS.md.
2. Reading the merge diff to identify the completed task.
3. Marking the completed task as complete (move to COMPLETED WORK section).
4. Working out if any new tasks need to be added based on the completed work.
5. Re-ordering the tasks list based on priority.

### Current TASKS.md
\
```\
${currentTasksContent}\n```

### Merged Changes
\
```\
${mergeDiff}\n```

IMPORTANT:
- Output ONLY the raw content of the updated file.
- Do NOT use markdown code blocks (\
```\
).
- Do NOT include any conversational text.
- The output must start directly with the file content.`;

    return this.generateContent(prompt);
  }
}