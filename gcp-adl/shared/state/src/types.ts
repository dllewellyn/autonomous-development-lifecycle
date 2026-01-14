/**
 * Ralph State Schema
 * Represents the current state of the autonomous development lifecycle
 */
export interface RalphState {
  /** Current status of the system */
  status: 'started' | 'stopped';
  
  /** Current active Jules task/session ID */
  current_task_id: string | null;
  
  /** Last time the state was updated */
  last_updated: string;
  
  /** Number of iterations in the current cycle */
  iteration_count: number;
  
  /** Maximum iterations before stopping */
  max_iterations: number;
}

/**
 * Default initial state
 */
export const DEFAULT_STATE: RalphState = {
  status: 'started',
  current_task_id: null,
  last_updated: new Date().toISOString(),
  iteration_count: 0,
  max_iterations: 10,
};
