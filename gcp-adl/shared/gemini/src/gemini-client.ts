import { spawn } from 'child_process';

/**
 * Gemini Client
 * Wrapper around Gemini CLI for ADL use cases
 */
export interface GeminiClientOptions {
  model?: string;
  fallbackModel?: string;
  cwd?: string;
}

export class GeminiClient {
  private apiKey: string;
  private cliPath: string;
  private defaultOptions: GeminiClientOptions;

  constructor(apiKey: string, options: GeminiClientOptions = {}) {
    this.apiKey = apiKey;
    try {
        // Resolve the local gemini-cli binary path
        this.cliPath = require.resolve('@google/gemini-cli');
    } catch (e) {
        console.warn('Could not resolve @google/gemini-cli, falling back to global "gemini" command');
        this.cliPath = 'gemini'; 
    }
    this.defaultOptions = {
        fallbackModel: 'gemini-2.5-flash', // Default fallback
        ...options
    };
  }

  /**
   * Execute the Gemini CLI with a prompt
   */
  private async runCli(prompt: string, options: GeminiClientOptions = {}, isRetry: boolean = false): Promise<string> {
    return new Promise((resolve, reject) => {
      // Calling `gemini` with prompt via stdin, requesting JSON output
      // --yolo enables tools in non-interactive mode
      const args: string[] = ['--output-format', 'json', '--yolo']; 
      
      const model = options.model || this.defaultOptions.model;
      if (model) {
        args.push('--model', model);
      } 
      
      const repoPath = options.cwd || this.defaultOptions.cwd;
      const env: Record<string, string> = {
        ...process.env,
        GEMINI_API_KEY: this.apiKey,
      };
      
      // Pass repository path via environment variable if provided
      if (repoPath) {
        env.REPO_PATH = repoPath;
      }

      // Run Gemini CLI in the cloned repo directory if provided
      const child = this.spawnChild(this.cliPath, args, { 
        env,
        cwd: repoPath || undefined,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (error: Error) => {
        reject(new Error(`Failed to spawn gemini CLI: ${error.message}`));
      });

      child.on('close', async (code: number) => {
        if (code !== 0) {
          console.log(`[GeminiClient] CLI exited with code ${code}`);
          console.log(`[GeminiClient] stdout: ${stdout.substring(0, 500)}...`);
          console.log(`[GeminiClient] stderr: ${stderr.substring(0, 500)}...`);

          // Helper to check for quota error in text
          const isQuotaError = (text: string) => {
              const lower = text.toLowerCase();
              return lower.includes('quota') || 
                     lower.includes('capacity') || 
                     lower.includes('429');
          };

          // If exit code is non-zero, try to see if we got an error JSON or just stderr
          try {
            const parsed = JSON.parse(stdout.trim());
            if (parsed.error) {
               // Check for quota error
               const errorMessage = parsed.error.message || '';
               const quotaMatch = isQuotaError(errorMessage) || parsed.error.code === 429;

               if (quotaMatch && !isRetry) {
                   const fallbackModel = options.fallbackModel || this.defaultOptions.fallbackModel;
                   if (fallbackModel && fallbackModel !== model) {
                       console.warn(`[GeminiClient] Quota exceeded for ${model || 'default model'}. Falling back to ${fallbackModel}.`);
                       try {
                            const result = await this.runCli(prompt, { ...options, model: fallbackModel }, true);
                            resolve(result);
                            return;
                       } catch (retryError) {
                            reject(retryError);
                            return;
                       }
                   }
               }

              reject(new Error(`Gemini CLI error: ${parsed.error.message} (${parsed.error.type})`));
              return;
            }
          } catch (e) {
            // Ignore JSON parse error on failure path
          }
          
          // If we are here, we didn't find a JSON error. Check stderr for quota error.
          if (isQuotaError(stderr) && !isRetry) {
               const fallbackModel = options.fallbackModel || this.defaultOptions.fallbackModel;
               if (fallbackModel && fallbackModel !== model) {
                   console.warn(`[GeminiClient] Quota exceeded (detected in stderr) for ${model || 'default model'}. Falling back to ${fallbackModel}.`);
                   try {
                        const result = await this.runCli(prompt, { ...options, model: fallbackModel }, true);
                        resolve(result);
                        return;
                   } catch (retryError) {
                        reject(retryError);
                        return;
                   }
               }
          }

          reject(new Error(`Gemini CLI exited with code ${code}. Stderr: ${stderr}`));
        } else {
          try {
            const parsed = JSON.parse(stdout.trim());
            
            if (parsed.error) {
                // Check for quota error (in case it returns 0 exit code but has error body?)
               const errorMessage = parsed.error.message || '';
               const isQuotaError = errorMessage.toLowerCase().includes('quota') || 
                                    errorMessage.toLowerCase().includes('capacity') ||
                                    parsed.error.code === 429;

               if (isQuotaError && !isRetry) {
                   const fallbackModel = options.fallbackModel || this.defaultOptions.fallbackModel;
                   if (fallbackModel && fallbackModel !== model) {
                       console.warn(`Quota exceeded for ${model || 'default model'}. Falling back to ${fallbackModel}.`);
                       try {
                            const result = await this.runCli(prompt, { ...options, model: fallbackModel }, true);
                            resolve(result);
                            return;
                       } catch (retryError) {
                            reject(retryError);
                            return;
                       }
                   }
               }
               
               reject(new Error(`Gemini CLI error: ${parsed.error.message} (${parsed.error.type})`));
               return;
            }

            if (typeof parsed.response !== 'string') {
               reject(new Error('Gemini CLI response missing valid "response" field'));
               return;
            }
            
            resolve(parsed.response);
          } catch (e) {
            console.error('Failed to parse JSON output:', stdout);
            reject(new Error(`Failed to parse Gemini CLI JSON output: ${e}`));
          }
        }
      });

      // Write prompt to stdin
      child.stdin.write(prompt);
      child.stdin.end();
    });
  }



  /**
   * Generate content from a prompt
   */
  async generateContent(prompt: string, options?: GeminiClientOptions): Promise<string> {
    try {
      return await this.runCli(prompt, options);
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
    files: Array<{ path: string; content: string }>,
    options?: GeminiClientOptions
  ): Promise<string> {
    const fileContext = files
      .map(f => `
### File: ${f.path}
\`\`\`
${f.content}
\`\`\`
`)
      .join('\n');

    const fullPrompt = `${systemPrompt}\n\n## Repository Files:\n${fileContext}`;

    return this.generateContent(fullPrompt, options);
  }

  /**
   * Analyze and generate a plan
   * Used by the Planner service
   */
  async generatePlan(
    goalsContent: string,
    tasksContent: string,
    contextMapContent: string,
    agentsContent: string,
    options?: GeminiClientOptions
  ): Promise<string> {
    const prompt = `You are the Planner for an autonomous development system.

Analyze the following files:

### GOALS.md
\`\`\`
${goalsContent}
\`\`\`

### TASKS.md
\`\`\`
${tasksContent}
\`\`\`

### CONTEXT_MAP.md
\`\`\`
${contextMapContent}
\`\`\`

### AGENTS.md
\`\`\`
${agentsContent}
\`\`\`

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
    prDiff: string,
    options?: GeminiClientOptions
  ): Promise<{ compliant: boolean; violations: string[] }> {
    const prompt = `You are the Enforcer for an autonomous development system.


Your task is to review the code changes in this pull request against the repository's CONSTITUTION.md and ensure the intended task has been completed correctly as per TASKS.md.

### CONSTITUTION.md
\`\`\`
${constitutionContent}
\`\`\`

### TASKS.md
\`\`\`
${tasksContent}
\`\`\`

### PR Diff
\`\`\`
${prDiff}
\`\`\`

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

    const response = await this.generateContent(prompt, options);
    
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        // Try parsing the matched content
        // If there's multiple blocks, we want to find the one that validates
        // For now, let's just try matching the largest block
        return JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.warn('Found JSON-like match but failed to parse:', parseError);
        console.warn('Matched text:', jsonMatch[0]);
      }
    }

    // Fallback: Attempt loose parsing if regex/JSON.parse failed
    console.warn('Attempting loose parse of Gemini response...');
    const lower = response.toLowerCase();
    
    const compliant = lower.includes('"compliant": true') || 
                      lower.includes('compliant: true') ||
                      (lower.includes('is compliant') && !lower.includes('not compliant'));

    const violations: string[] = [];
    
    // Look for violations in a list format
    const lines = response.split('\n');
    let inViolations = false;
    for (const line of lines) {
      if (line.toLowerCase().includes('violations')) {
        inViolations = true;
        continue;
      }
      if (inViolations && (line.trim().startsWith('-') || line.trim().startsWith('*') || /^\d+\./.test(line.trim()))) {
        violations.push(line.replace(/^[-*\d.]+\s*/, '').trim());
      }
    }

    // Only return if we found some indicator of compliance
    if (lower.includes('compliant') || violations.length > 0) {
      return {
        compliant,
        violations: violations.length > 0 ? violations : (compliant ? [] : ['PR found non-compliant by loose parsing but no specific violations listed.'])
      };
    }

    console.error('Failed to parse or loosely infer audit result.');
    console.error('Raw Gemini Response:', response);
    throw new Error('Failed to parse audit response as JSON');
  }

  /**
   * Extract lessons learned from a merge
   * Used by the Strategist service
   */
  async extractLessons(
    currentAgentsContent: string,
    mergeDiff: string,
    options?: GeminiClientOptions
  ): Promise<string> {
    const prompt = `You are the Strategist for an autonomous development system.

A PR has just been merged to main. Analyze the changes and extract lessons learned.

### Current AGENTS.md
\`\`\`
${currentAgentsContent}
\`\`\`

### Merged Changes
\`\`\`
${mergeDiff}
\`\`\`

Review the merged changes for patterns, challenges, or insights.
Update AGENTS.md with new lessons learned.
Format as a new entry with today's date.

IMPORTANT:
- If no new lessons are found, output the original content of AGENTS.md exactly as is.
- Output ONLY the raw content of the updated file.
- Do NOT use markdown code blocks.
- Do NOT include any conversational text.
- The output must start directly with the file content.`;

    return this.generateContent(prompt, options);
  }

  /**
   * Update TASKS.md after a merge
   * Used by the Strategist service
   */
  async updateTasks(
    currentTasksContent: string,
    mergeDiff: string,
    options?: GeminiClientOptions
  ): Promise<string> {
    const prompt = `You are the Strategist for an autonomous development system.

A task has been completed and merged. Update TASKS.md by:
1. Reading the current TASKS.md.
2. Reading the merge diff to identify the completed task.
3. Marking the completed task as complete (move to COMPLETED WORK section).
4. Working out if any new tasks need to be added based on the completed work.
5. Re-ordering the tasks list based on priority.

### Current TASKS.md
\`\`\`
${currentTasksContent}
\`\`\`

### Merged Changes
\`\`\`
${mergeDiff}
\`\`\`

IMPORTANT:
- Output ONLY the raw content of the updated file.
- Do NOT use markdown code blocks.
- Do NOT include any conversational text.
- The output must start directly with the file content.`;

    return this.generateContent(prompt, options);
  }
  
  /**
   * Protected method to spawn child process, enabling mocking in tests
   */
  protected spawnChild(command: string, args: string[], options: any): any {
    if (command.endsWith('.js')) {
        return spawn(process.execPath, [command, ...args], options);
    }
    return spawn(command, args, options);
  }
}