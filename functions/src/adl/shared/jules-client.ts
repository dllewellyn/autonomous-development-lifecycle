import axios, {AxiosInstance} from "axios";

/**
 * Jules Session State
 */
export type JulesSessionState =
  | "STATE_UNSPECIFIED"
  | "QUEUED"
  | "PLANNING"
  | "AWAITING_PLAN_APPROVAL"
  | "IN_PROGRESS"
  | "AWAITING_USER_FEEDBACK"
  | "PAUSED"
  | "FAILED"
  | "COMPLETED";

export interface JulesSession {
  name: string;
  state: JulesSessionState;
  createTime?: string;
  updateTime?: string;
}

export type JulesStatus =
  | "none_active"
  | "in_progress"
  | "waiting_for_input"
  | "blocked";

export interface JulesStatusSummary {
  status: JulesStatus;
  blockedCount: number;
  sessions: JulesSession[];
}

/**
 * Jules API Client
 */
export class JulesClient {
  private client: AxiosInstance;
  private baseUrl: string = "https://jules.googleapis.com/v1alpha";

  constructor(apiKey: string) {
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "X-Goog-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
    });
  }

  async listSessions(pageSize: number = 100): Promise<JulesSession[]> {
    try {
      const response = await this.client.get("/sessions", {
        params: {pageSize},
      });
      return response.data.sessions || [];
    } catch (error) {
      console.error("Error listing Jules sessions:", error);
      throw new Error(`Failed to list sessions: ${error}`);
    }
  }

  async getStatus(): Promise<JulesStatusSummary> {
    const sessions = await this.listSessions();
    const states = sessions.map((s) => s.state);
    const blockedStates = ["FAILED", "PAUSED", "AWAITING_PLAN_APPROVAL", "STATE_UNSPECIFIED"];
    const blockedCount = sessions.filter((s) => blockedStates.includes(s.state)).length;

    let status: JulesStatus;
    if (states.some((s) => blockedStates.includes(s))) {
      status = "blocked";
    } else if (states.includes("AWAITING_USER_FEEDBACK")) {
      status = "waiting_for_input";
    } else if (states.some((s) => ["QUEUED", "PLANNING", "IN_PROGRESS"].includes(s))) {
      status = "in_progress";
    } else {
      status = "none_active";
    }

    return {status, blockedCount, sessions};
  }

  async createSession(owner: string, repo: string, branch: string, prompt: string): Promise<string> {
    try {
      const response = await this.client.post("/sessions", {
        prompt,
        sourceContext: {
          source: `sources/github/${owner}/${repo}`,
          githubRepoContext: {startingBranch: branch},
        },
        automationMode: "AUTO_CREATE_PR",
      });
      const sessionId = response.data.name.split("/").pop() || "";
      console.log(`Created Jules session: ${sessionId}`);
      return sessionId;
    } catch (error) {
      console.error("Error creating Jules session:", error);
      throw new Error(`Failed to create session: ${error}`);
    }
  }

  async sendMessage(sessionId: string, content: string): Promise<void> {
    try {
      await this.client.post(`/sessions/${sessionId}:sendMessage`, {
        message: {content},
      });
      console.log(`Sent message to Jules session: ${sessionId}`);
    } catch (error) {
      console.error("Error sending message to Jules:", error);
      throw new Error(`Failed to send message: ${error}`);
    }
  }

  async getSession(sessionId: string): Promise<JulesSession> {
    try {
      const response = await this.client.get(`/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error("Error getting Jules session:", error);
      throw new Error(`Failed to get session: ${error}`);
    }
  }
}
