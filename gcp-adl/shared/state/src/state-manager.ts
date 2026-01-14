import { Storage } from '@google-cloud/storage';
import { RalphState, DEFAULT_STATE } from './types';

/**
 * State Manager for Ralph State
 * Manages state persistence in Google Cloud Storage
 */
export class StateManager {
  private storage: Storage;
  private bucketName: string;
  private fileName: string;

  constructor(bucketName: string, fileName: string = '.ralph-state.json') {
    this.storage = new Storage();
    this.bucketName = bucketName;
    this.fileName = fileName;
  }

  /**
   * Read the current state from Cloud Storage
   */
  async readState(): Promise<RalphState> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(this.fileName);
      
      const [exists] = await file.exists();
      
      if (!exists) {
        console.log('State file does not exist, creating default state');
        await this.writeState(DEFAULT_STATE);
        return DEFAULT_STATE;
      }

      const [contents] = await file.download();
      const state = JSON.parse(contents.toString()) as RalphState;
      
      return state;
    } catch (error) {
      console.error('Error reading state:', error);
      throw new Error(`Failed to read state: ${error}`);
    }
  }

  /**
   * Write state to Cloud Storage
   */
  async writeState(state: RalphState): Promise<void> {
    try {
      state.last_updated = new Date().toISOString();
      
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(this.fileName);
      
      await file.save(JSON.stringify(state, null, 2), {
        contentType: 'application/json',
        metadata: {
          cacheControl: 'no-cache',
        },
      });
      
      console.log('State written successfully');
    } catch (error) {
      console.error('Error writing state:', error);
      throw new Error(`Failed to write state: ${error}`);
    }
  }

  /**
   * Update specific fields in the state
   */
  async updateState(updates: Partial<RalphState>): Promise<RalphState> {
    const currentState = await this.readState();
    const newState = { ...currentState, ...updates };
    await this.writeState(newState);
    return newState;
  }

  /**
   * Stop the loop
   */
  async stopLoop(): Promise<void> {
    await this.updateState({ status: 'stopped' });
  }

  /**
   * Start/Restart the loop
   */
  async startLoop(): Promise<void> {
    await this.updateState({ 
      status: 'started',
      iteration_count: 0,
    });
  }

  /**
   * Update session ID
   */
  async updateSessionId(sessionId: string): Promise<void> {
    await this.updateState({ current_task_id: sessionId });
  }

  /**
   * Increment iteration count
   */
  async incrementIteration(): Promise<number> {
    const state = await this.readState();
    const newCount = state.iteration_count + 1;
    await this.updateState({ iteration_count: newCount });
    return newCount;
  }
}
