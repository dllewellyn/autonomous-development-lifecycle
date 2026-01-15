import { StateManager } from '@gcp-adl/state';
import { JulesClient } from '@gcp-adl/jules';
import { PlannerResult } from './planner';
import { TroubleshooterResult } from './troubleshooter';

export interface HeartbeatContext {
  stateManager: StateManager;
  julesClient: JulesClient;
  runPlanner: () => Promise<PlannerResult>;
  runTroubleshooter: (sessionId: string, question: string) => Promise<TroubleshooterResult>;
}

export interface HeartbeatResult {
  status: string;
  action: string;
  blockedCount?: number;
}

/**
 * Heartbeat Service - Orchestrates the autonomous development lifecycle
 * Checks Ralph state and Jules status, then triggers appropriate actions
 */
export async function runHeartbeat(context: HeartbeatContext): Promise<HeartbeatResult> {
  console.log('[Heartbeat] Starting check...');

  try {
    // 1. Read Ralph state
    const state = await context.stateManager.readState();
    console.log('[Heartbeat] Current state:', state);

    // If stopped, do nothing
    if (state.status === 'stopped') {
      console.log('[Heartbeat] System is stopped. Terminating.');
      return { status: 'stopped', action: 'none' };
    }

    // 2. Check Jules status
    const julesStatus = await context.julesClient.getStatus();
    console.log('[Heartbeat] Jules status:', julesStatus.status);

    // 3. Decide on action
    switch (julesStatus.status) {
      case 'none_active':
        console.log('[Heartbeat] No active tasks. Triggering Planner...');
        await context.runPlanner();
        return { status: 'started', action: 'trigger_planner' };

      case 'waiting_for_input':
        console.log('[Heartbeat] Task waiting for input. Triggering Troubleshooter...');
        
        // Note: In a real implementation, you would fetch the actual question from Jules
        // For now, we use a placeholder
        const sessionId = state.current_task_id || 'unknown';
        const question = 'Please provide more information about the task.';
        
        await context.runTroubleshooter(sessionId, question);
        return { status: 'started', action: 'trigger_troubleshooter' };

      case 'blocked':
        console.log(`[Heartbeat] Task blocked (${julesStatus.blockedCount} blocked sessions). Stopping loop...`);
        await context.stateManager.stopLoop();
        
        // TODO: Notify human via GitHub issue or other mechanism
        console.log('[Heartbeat] Human notification needed - task is blocked');
        
        return {
          status: 'stopped',
          action: 'stopped_blocked',
          blockedCount: julesStatus.blockedCount,
        };

      case 'in_progress':
        console.log('[Heartbeat] Task in progress. No action needed.');
        return { status: 'started', action: 'none' };

      default:
        console.warn('[Heartbeat] Unknown Jules status:', julesStatus.status);
        return { status: 'started', action: 'none' };
    }
  } catch (error) {
    console.error('[Heartbeat] Error:', error);
    throw error;
  }
}
