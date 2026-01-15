import axios, { AxiosInstance } from 'axios';
import {
  JulesSession,
  JulesSessionsResponse,
  CreateSessionRequest,
  JulesMessage,
  SendMessageRequest,
  JulesStatusSummary,
  JulesStatus,
} from './types';

/**
 * Jules API Client
 * Interacts with Jules AI API for task management
 */
export class JulesClient {
  private client: AxiosInstance;
  private baseUrl: string = 'https://jules.googleapis.com/v1alpha';

  constructor(apiKey: string) {
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * List all Jules sessions
   */
  async listSessions(pageSize: number = 100): Promise<JulesSession[]> {
    try {
      const response = await this.client.get<JulesSessionsResponse>('/sessions', {
        params: { pageSize },
      });

      return response.data.sessions || [];
    } catch (error) {
      console.error('Error listing Jules sessions:', error);
      throw new Error(`Failed to list sessions: ${error}`);
    }
  }

  /**
   * Get aggregated status from all sessions
   */
  async getStatus(): Promise<JulesStatusSummary> {
    const sessions = await this.listSessions();

    const states = sessions.map(s => s.state);
    const blockedStates = ['FAILED', 'PAUSED', 'AWAITING_PLAN_APPROVAL', 'STATE_UNSPECIFIED'];
    const blockedCount = sessions.filter(s => blockedStates.includes(s.state)).length;

    let status: JulesStatus;

    if (states.some(s => blockedStates.includes(s))) {
      status = 'blocked';
    } else if (states.includes('AWAITING_USER_FEEDBACK')) {
      status = 'waiting_for_input';
    } else if (states.some(s => ['QUEUED', 'PLANNING', 'IN_PROGRESS'].includes(s))) {
      status = 'in_progress';
    } else {
      status = 'none_active';
    }

    return {
      status,
      blockedCount,
      sessions,
    };
  }

  /**
   * Create a new Jules session
   */
  async createSession(request: CreateSessionRequest): Promise<string> {
    try {
      const response = await this.client.post<JulesSession>('/sessions', request);

      // Extract session ID from the name field
      // Format: "sessions/{UUID}" or "projects/.../sessions/{UUID}"
      const sessionId = response.data.name.split('/').pop() || '';

      console.log(`Created Jules session: ${sessionId}`);
      return sessionId;
    } catch (error: any) {
      console.error('Error creating Jules session:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      throw new Error(`Failed to create session: ${error}`);
    }
  }

  /**
   * Send a message to a Jules session
   */
  /**
   * Send a message to a Jules session
   */
  async sendMessage(sessionId: string, content: string): Promise<void> {
    try {
      const message: SendMessageRequest = {
        prompt: content,
      };

      await this.client.post(`/sessions/${sessionId}:sendMessage`, message);

      console.log(`Sent message to Jules session: ${sessionId}`);
    } catch (error: any) {
      console.error('Error sending message to Jules:', error.message);
      
      if (error.response && error.response.status === 404) {
        throw new Error(`Session ${sessionId} not found (404). It may have been deleted.`);
      }
      
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Check if a session exists and is valid
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    try {
      await this.client.get(`/sessions/${sessionId}`);
      return true;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return false;
      }
      // For other errors (network, auth), assume it might be valid but unreachable
      // or rethrow if we want strict checking. 
      // For now, logging and returning false for safety if we can't verify.
      console.warn(`Could not verify session ${sessionId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get a specific session
   */
  async getSession(sessionId: string): Promise<JulesSession> {
    try {
      const response = await this.client.get<JulesSession>(`/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting Jules session:', error);
      throw new Error(`Failed to get session: ${error}`);
    }
  }

  /**
   * Helper to create a session for a GitHub repository
   */
  async createRepoSession(
    owner: string,
    repo: string,
    branch: string,
    prompt: string
  ): Promise<string> {
    const request: CreateSessionRequest = {
      prompt,
      sourceContext: {
        source: `sources/github/${owner}/${repo}`,
        githubRepoContext: {
          startingBranch: branch,
        },
      },
      automationMode: 'AUTO_CREATE_PR',
    };

    return this.createSession(request);
  }
}
