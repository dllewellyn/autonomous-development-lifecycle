import { StateManager } from '@gcp-adl/state';
import { JulesClient } from '@gcp-adl/jules';
import { PubSub } from '@google-cloud/pubsub';
import express from 'express';

/**
 * Heartbeat Service
 * Orchestrates the autonomous development lifecycle by:
 * 1. Checking Ralph state
 * 2. Checking Jules task status
 * 3. Triggering appropriate services via Pub/Sub
 */

const PORT = process.env.PORT || 8080;
const STATE_BUCKET = process.env.STATE_BUCKET!;
const JULES_API_KEY = process.env.JULES_API_KEY!;
const PUBSUB_PROJECT_ID = process.env.PUBSUB_PROJECT_ID!;

// Pub/Sub topics
const PLANNER_TOPIC = 'adl-planner-trigger';
const TROUBLESHOOTER_TOPIC = 'adl-troubleshooter-trigger';

// Validate environment variables
if (!STATE_BUCKET) throw new Error('STATE_BUCKET is required');
if (!JULES_API_KEY) throw new Error('JULES_API_KEY is required');
if (!PUBSUB_PROJECT_ID) throw new Error('PUBSUB_PROJECT_ID is required');

const stateManager = new StateManager(STATE_BUCKET);
const julesClient = new JulesClient(JULES_API_KEY);
const pubsub = new PubSub({ projectId: PUBSUB_PROJECT_ID });

/**
 * Main heartbeat logic
 */
async function runHeartbeat() {
  console.log('Starting heartbeat check...');

  try {
    // 1. Read Ralph state
    const state = await stateManager.readState();
    console.log('Current state:', state);

    // If stopped, do nothing
    if (state.status === 'stopped') {
      console.log('System is stopped. Terminating.');
      return { status: 'stopped', action: 'none' };
    }

    // 2. Check Jules status
    const julesStatus = await julesClient.getStatus();
    console.log('Jules status:', julesStatus.status);

    // 3. Decide on action
    switch (julesStatus.status) {
      case 'none_active':
        console.log('No active tasks. Triggering Planner...');
        await publishMessage(PLANNER_TOPIC, {
          trigger: 'heartbeat',
          timestamp: new Date().toISOString(),
        });
        return { status: 'started', action: 'trigger_planner' };

      case 'waiting_for_input':
        console.log('Task waiting for input. Triggering Troubleshooter...');
        await publishMessage(TROUBLESHOOTER_TOPIC, {
          trigger: 'heartbeat',
          timestamp: new Date().toISOString(),
        });
        return { status: 'started', action: 'trigger_troubleshooter' };

      case 'blocked':
        console.log(`Task blocked (${julesStatus.blockedCount} blocked sessions). Stopping loop...`);
        await stateManager.stopLoop();
        
        // TODO: Notify human via GitHub issue or other mechanism
        console.log('Human notification needed - task is blocked');
        
        return { status: 'stopped', action: 'stopped_blocked', blockedCount: julesStatus.blockedCount };

      case 'in_progress':
        console.log('Task in progress. No action needed.');
        return { status: 'started', action: 'none' };

      default:
        console.warn('Unknown Jules status:', julesStatus.status);
        return { status: 'started', action: 'none' };
    }
  } catch (error) {
    console.error('Error in heartbeat:', error);
    throw error;
  }
}

/**
 * Publish a message to a Pub/Sub topic
 */
async function publishMessage(topicName: string, data: any): Promise<void> {
  try {
    const topic = pubsub.topic(topicName);
    const messageBuffer = Buffer.from(JSON.stringify(data));
    await topic.publishMessage({ data: messageBuffer });
    console.log(`Published message to ${topicName}`);
  } catch (error) {
    console.error(`Error publishing to ${topicName}:`, error);
    throw error;
  }
}

/**
 * Express app for Cloud Run
 */
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'healthy', service: 'heartbeat' });
});

// Main heartbeat endpoint (triggered by Cloud Scheduler)
app.post('/run', async (req, res) => {
  try {
    const result = await runHeartbeat();
    res.json({ success: true, result });
  } catch (error) {
    console.error('Heartbeat failed:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Heartbeat service listening on port ${PORT}`);
});
