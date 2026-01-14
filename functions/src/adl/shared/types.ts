/**
 * Ralph State Schema for ADL
 */
export interface RalphState {
  status: 'started' | 'stopped';
  current_task_id: string | null;
  last_updated: string;
  iteration_count: number;
  max_iterations: number;
}

export const DEFAULT_STATE: RalphState = {
  status: 'started',
  current_task_id: null,
  last_updated: new Date().toISOString(),
  iteration_count: 0,
  max_iterations: 10,
};
