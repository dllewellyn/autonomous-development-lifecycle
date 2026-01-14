import {GoogleGenerativeAI} from "@google/generative-ai";

/**
 * Gemini Client for AI operations
 */
export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model: string = "gemini-2.0-flash-exp") {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async generateContent(prompt: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({model: this.model});
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("Error generating content with Gemini:", error);
      throw new Error(`Failed to generate content: ${error}`);
    }
  }

  async generatePlan(
      goalsContent: string,
      tasksContent: string,
      contextMapContent: string,
      agentsContent: string
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

  async auditPR(
      constitutionContent: string,
      tasksContent: string,
      prDiff: string
  ): Promise<{compliant: boolean; violations: string[]}> {
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

    const response = await this.generateContent(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse audit response as JSON");
    }
    return JSON.parse(jsonMatch[0]);
  }

  async extractLessons(currentAgentsContent: string, mergeDiff: string): Promise<string> {
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
- Do NOT use markdown code blocks (\`\`\`).
- Do NOT include any conversational text.
- The output must start directly with the file content.`;

    return this.generateContent(prompt);
  }

  async updateTasks(currentTasksContent: string, mergeDiff: string): Promise<string> {
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
- Do NOT use markdown code blocks (\`\`\`).
- Do NOT include any conversational text.
- The output must start directly with the file content.`;

    return this.generateContent(prompt);
  }
}
