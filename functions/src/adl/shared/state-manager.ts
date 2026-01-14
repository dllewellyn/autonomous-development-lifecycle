import * as admin from "firebase-admin";
import {RalphState, DEFAULT_STATE} from "./types";

/**
 * State Manager using Firestore
 * Manages Ralph state persistence
 */
export class StateManager {
  private db: admin.firestore.Firestore;
  private stateDoc: admin.firestore.DocumentReference;

  constructor() {
    this.db = admin.firestore();
    this.stateDoc = this.db.collection("system").doc("ralph-state");
  }

  /**
   * Read current state
   */
  async readState(): Promise<RalphState> {
    try {
      const doc = await this.stateDoc.get();
      
      if (!doc.exists) {
        console.log("State document does not exist, creating default state");
        await this.writeState(DEFAULT_STATE);
        return DEFAULT_STATE;
      }

      return doc.data() as RalphState;
    } catch (error) {
      console.error("Error reading state:", error);
      throw new Error(`Failed to read state: ${error}`);
    }
  }

  /**
   * Write state
   */
  async writeState(state: RalphState): Promise<void> {
    try {
      state.last_updated = new Date().toISOString();
      await this.stateDoc.set(state);
      console.log("State written successfully");
    } catch (error) {
      console.error("Error writing state:", error);
      throw new Error(`Failed to write state: ${error}`);
    }
  }

  /**
   * Update specific fields
   */
  async updateState(updates: Partial<RalphState>): Promise<RalphState> {
    const currentState = await this.readState();
    const newState = {...currentState, ...updates};
    await this.writeState(newState);
    return newState;
  }

  /**
   * Stop the loop
   */
  async stopLoop(): Promise<void> {
    await this.updateState({status: "stopped"});
  }

  /**
   * Start/Restart the loop
   */
  async startLoop(): Promise<void> {
    await this.updateState({
      status: "started",
      iteration_count: 0,
    });
  }

  /**
   * Update session ID
   */
  async updateSessionId(sessionId: string): Promise<void> {
    await this.updateState({current_task_id: sessionId});
  }

  /**
   * Increment iteration count
   */
  async incrementIteration(): Promise<number> {
    const state = await this.readState();
    const newCount = state.iteration_count + 1;
    await this.updateState({iteration_count: newCount});
    return newCount;
  }
}
