import * as functions from "firebase-functions";
import {onRequest} from "firebase-functions/v2/https";
import {StateManager} from "../shared/state-manager";
import {JulesClient} from "../shared/jules-client";
import {GeminiClient} from "../shared/gemini-client";
import {GitHubClient} from "../shared/github-client";

const GEMINI_API_KEY = functions.config().gemini?.apikey || process.env.GEMINI_API_KEY;
const JULES_API_KEY = functions.config().jules?.apikey || process.env.JULES_API_KEY;
const GITHUB_TOKEN = functions.config().github?.token || process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = functions.config().github?.repository || process.env.GITHUB_REPOSITORY || "";
const GITHUB_BRANCH = functions.config().github?.branch || process.env.GITHUB_BRANCH || "main";

/**
 * Heartbeat - Orchestrator function (scheduled every 5 minutes)
 */
export const heartbeat = functions.pubsub.schedule("every 5 minutes").onRun(async () => {
  console.log("Heartbeat triggered");

  if (!JULES_API_KEY) {
    throw new Error("JULES_API_KEY not configured");
  }

  const stateManager = new StateManager();
  const julesClient = new JulesClient(JULES_API_KEY);

  try {
    // 1. Read state
    const state = await stateManager.readState();
    console.log("Current state:", state);

    if (state.status === "stopped") {
      console.log("System is stopped. Terminating.");
      return null;
    }

    // 2. Check Jules status
    const julesStatus = await julesClient.getStatus();
    console.log("Jules status:", julesStatus.status);

    // 3. Decide on action
    switch (julesStatus.status) {
      case "none_active":
        console.log("No active tasks. Triggering Planner...");
        // Trigger planner function directly
        await plannerHandler();
        break;

      case "waiting_for_input":
        console.log("Task waiting for input. Triggering Troubleshooter...");
        await troubleshooterHandler();
        break;

      case "blocked":
        console.log(`Task blocked (${julesStatus.blockedCount} sessions). Stopping loop...`);
        await stateManager.stopLoop();
        // TODO: Notify human
        console.log("Human notification needed - task is blocked");
        break;

      case "in_progress":
        console.log("Task in progress. No action needed.");
        break;
    }

    return null;
  } catch (error) {
    console.error("Error in heartbeat:", error);
    throw error;
  }
});

/**
 * Planner - Creates Jules tasks
 */
async function plannerHandler(): Promise<void> {
  console.log("Planner triggered");

  if (!GEMINI_API_KEY || !JULES_API_KEY || !GITHUB_TOKEN || !GITHUB_REPOSITORY) {
    throw new Error("Missing required configuration");
  }

  const stateManager = new StateManager();
  const julesClient = new JulesClient(JULES_API_KEY);
  const geminiClient = new GeminiClient(GEMINI_API_KEY);
  const githubClient = new GitHubClient(GITHUB_TOKEN, GITHUB_REPOSITORY);

  try {
    // Check for active session
    const currentState = await stateManager.readState();
    if (currentState.current_task_id) {
      const session = await julesClient.getSession(currentState.current_task_id);
      if (["QUEUED", "PLANNING", "IN_PROGRESS"].includes(session.state)) {
        console.log("Active session already exists:", currentState.current_task_id);
        return;
      }
    }

    // Fetch repository files
    console.log("Fetching repository files...");
    const [goalsContent, tasksContent, contextMapContent, agentsContent] = await Promise.all([
      githubClient.getFileContent("GOALS.md", GITHUB_BRANCH),
      githubClient.getFileContent("TASKS.md", GITHUB_BRANCH),
      githubClient.getFileContent("CONTEXT_MAP.md", GITHUB_BRANCH),
      githubClient.getFileContent("AGENTS.md", GITHUB_BRANCH),
    ]);

    // Generate plan
    console.log("Generating plan with Gemini...");
    const plan = await geminiClient.generatePlan(goalsContent, tasksContent, contextMapContent, agentsContent);

    // Create Jules session
    console.log("Creating Jules session...");
    const [owner, repo] = GITHUB_REPOSITORY.split("/");
    const sessionId = await julesClient.createSession(owner, repo, GITHUB_BRANCH, plan);

    // Update state
    await stateManager.updateSessionId(sessionId);
    await stateManager.incrementIteration();

    console.log("Planner completed successfully");
  } catch (error) {
    console.error("Error in planner:", error);
    throw error;
  }
}

/**
 * Planner - Callable function for manual triggering
 */
export const planner = functions.https.onCall(async () => {
  await plannerHandler();
  return {success: true};
});

/**
 * Troubleshooter - Provides answers to Jules
 */
async function troubleshooterHandler(): Promise<void> {
  console.log("Troubleshooter triggered");
  // Simplified implementation - would need Jules API enhancement
  console.log("Troubleshooter: Feature requires Jules API enhancement");
}

/**
 * Troubleshooter - Callable function
 */
export const troubleshooter = functions.https.onCall(async () => {
  await troubleshooterHandler();
  return {success: true};
});

/**
 * Enforcer - Reviews PRs (HTTP webhook)
 */
export const enforcer = onRequest(async (request, response) => {
  console.log("Enforcer triggered");

  if (!GEMINI_API_KEY || !JULES_API_KEY || !GITHUB_TOKEN || !GITHUB_REPOSITORY) {
    response.status(500).json({error: "Missing configuration"});
    return;
  }

  try {
    const event = request.headers["x-github-event"];
    const payload = request.body;

    if (event !== "pull_request") {
      response.json({success: true, message: "Event ignored"});
      return;
    }

    const action = payload.action;
    const prNumber = payload.pull_request?.number;

    if (!["opened", "synchronize", "reopened"].includes(action) || !prNumber) {
      response.json({success: true, message: "Action ignored"});
      return;
    }

    console.log(`Processing PR #${prNumber}`);

    const stateManager = new StateManager();
    const geminiClient = new GeminiClient(GEMINI_API_KEY);
    const githubClient = new GitHubClient(GITHUB_TOKEN, GITHUB_REPOSITORY);
    const julesClient = new JulesClient(JULES_API_KEY);

    // Get PR diff
    const prDiff = await githubClient.getPRDiff(prNumber);

    // Fetch CONSTITUTION and TASKS
    const [constitutionContent, tasksContent] = await Promise.all([
      githubClient.getFileContent("CONSTITUTION.md", GITHUB_BRANCH),
      githubClient.getFileContent("TASKS.md", GITHUB_BRANCH),
    ]);

    // Audit with Gemini
    console.log("Auditing PR...");
    const auditResult = await geminiClient.auditPR(constitutionContent, tasksContent, prDiff);

    if (!auditResult.compliant) {
      // Post violations
      const violationsList = auditResult.violations.map((v, i) => `${i + 1}. ${v}`).join("\n");
      const comment = `## 🚨 Constitution Violation Detected

@jules The following violations were found:

${violationsList}

Please address these issues before merging.`;

      await githubClient.commentOnPR(prNumber, comment);
      await githubClient.requestChanges(prNumber, "Constitution violations detected.");

      // Send feedback to Jules
      const state = await stateManager.readState();
      if (state.current_task_id) {
        await julesClient.sendMessage(state.current_task_id, `Constitution Violation:\n\n${violationsList}`);
      }

      response.json({success: true, compliant: false});
    } else {
      // Approve and merge
      await githubClient.approvePR(prNumber, "✅ Constitution compliant. LGTM!");
      await githubClient.mergePR(prNumber);
      response.json({success: true, compliant: true, merged: true});
    }
  } catch (error) {
    console.error("Enforcer error:", error);
    response.status(500).json({error: String(error)});
  }
});

/**
 * Strategist - Learns from merges (HTTP webhook)
 */
export const strategist = onRequest(async (request, response) => {
  console.log("Strategist triggered");

  if (!GEMINI_API_KEY || !GITHUB_TOKEN || !GITHUB_REPOSITORY) {
    response.status(500).json({error: "Missing configuration"});
    return;
  }

  try {
    const event = request.headers["x-github-event"];
    const payload = request.body;

    if (event !== "push") {
      response.json({success: true, message: "Event ignored"});
      return;
    }

    const ref = payload.ref;
    const expectedRef = `refs/heads/${GITHUB_BRANCH}`;

    if (ref !== expectedRef) {
      response.json({success: true, message: `Ignoring push to ${ref}`});
      return;
    }

    console.log(`Push to ${GITHUB_BRANCH}, running strategist...`);

    const stateManager = new StateManager();
    const geminiClient = new GeminiClient(GEMINI_API_KEY);
    const githubClient = new GitHubClient(GITHUB_TOKEN, GITHUB_REPOSITORY);

    // Get latest commit diff
    const mergeDiff = await githubClient.getLatestCommitDiff(GITHUB_BRANCH);

    if (!mergeDiff) {
      response.json({success: true, message: "No diff to process"});
      return;
    }

    // Fetch current files
    const [agentsContent, tasksContent] = await Promise.all([
      githubClient.getFileContent("AGENTS.md", GITHUB_BRANCH),
      githubClient.getFileContent("TASKS.md", GITHUB_BRANCH),
    ]);

    // Extract lessons and update tasks
    console.log("Extracting lessons...");
    const updatedAgents = await geminiClient.extractLessons(agentsContent, mergeDiff);
    const updatedTasks = await geminiClient.updateTasks(tasksContent, mergeDiff);

    // Update files
    await githubClient.updateFile("AGENTS.md", updatedAgents, "chore: update agent memory", GITHUB_BRANCH);
    await githubClient.updateFile("TASKS.md", updatedTasks, "chore: update tasks", GITHUB_BRANCH);

    // Restart loop
    await stateManager.startLoop();

    // Trigger planner
    console.log("Triggering Planner...");
    await plannerHandler();

    response.json({success: true, message: "Strategist completed"});
  } catch (error) {
    console.error("Strategist error:", error);
    response.status(500).json({error: String(error)});
  }
});
