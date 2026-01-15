/**
 * Jules Session State
 */
export type JulesSessionState =
  | 'STATE_UNSPECIFIED'
  | 'QUEUED'
  | 'PLANNING'
  | 'AWAITING_PLAN_APPROVAL'
  | 'IN_PROGRESS'
  | 'AWAITING_USER_FEEDBACK'
  | 'PAUSED'
  | 'FAILED'
  | 'COMPLETED';

/**
 * Jules Session
 */
export interface JulesSession {
  name: string;
  state: JulesSessionState;
  createTime?: string;
  updateTime?: string;
}

/**
 * Jules Sessions List Response
 */
export interface JulesSessionsResponse {
  sessions: JulesSession[];
  nextPageToken?: string;
}

/**
 * Jules Session Create Request
 */
export interface CreateSessionRequest {
  prompt: string;
  sourceContext: {
    source: string;
    githubRepoContext: {
      startingBranch: string;
    };
  };
  automationMode: 'AUTO_CREATE_PR' | 'MANUAL';
}

/**
 * Jules Message (Legacy - unused now but keeping for reference if needed)
 */
export interface JulesMessage {
  message: {
    content: string;
  };
}

/**
 * Send Message Request
 */
export interface SendMessageRequest {
  prompt: string;
}

/**
 * Aggregated Jules Status
 */
export type JulesStatus = 
  | 'none_active'
  | 'in_progress'
  | 'waiting_for_input'
  | 'blocked';

/**
 * Jules Status Summary
 */
export interface JulesStatusSummary {
  status: JulesStatus;
  blockedCount: number;
  sessions: JulesSession[];
}
