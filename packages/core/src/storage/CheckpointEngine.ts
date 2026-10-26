import { CognitiveEvent } from '../types.js';

export interface SwarmCheckpoint {
  id: string;
  stepIndex: number;
  label: string;
  timestamp: number;
  eventsSnapshot: CognitiveEvent[];
  memorySnapshot: Record<string, unknown>;
}

export class CheckpointEngine {
  private checkpoints: Map<string, SwarmCheckpoint> = new Map();
  private timeline: string[] = [];

  /**
   * Capture an immutable snapshot of swarm cognitive state
   */
  public createCheckpoint(
    stepIndex: number,
    label: string,
    events: CognitiveEvent[],
    memory: Record<string, unknown> = {}
  ): SwarmCheckpoint {
    const id = `chk_${Date.now()}_step${stepIndex}`;
    const checkpoint: SwarmCheckpoint = {
      id,
      stepIndex,
      label,
      timestamp: Date.now(),
      eventsSnapshot: JSON.parse(JSON.stringify(events)),
      memorySnapshot: JSON.parse(JSON.stringify(memory)),
    };

    this.checkpoints.set(id, checkpoint);
    this.timeline.push(id);
    return checkpoint;
  }

  /**
   * Rewind to a previous checkpoint in history
   */
  public restoreCheckpoint(checkpointId: string): SwarmCheckpoint {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }
    return checkpoint;
  }

  /**
   * Fork execution from an earlier checkpoint into a new divergent timeline
   */
  public forkTimeline(checkpointId: string, forkLabel: string): SwarmCheckpoint {
    const base = this.restoreCheckpoint(checkpointId);
    const forkedId = `fork_${Date.now()}_from_${base.id}`;

    const forked: SwarmCheckpoint = {
      ...base,
      id: forkedId,
      label: `Fork: ${forkLabel} (Derived from ${base.label})`,
      timestamp: Date.now(),
    };

    this.checkpoints.set(forkedId, forked);
    this.timeline.push(forkedId);
    return forked;
  }

  public getTimeline(): SwarmCheckpoint[] {
    return this.timeline.map((id) => this.checkpoints.get(id)!).filter(Boolean);
  }

  public clear(): void {
    this.checkpoints.clear();
    this.timeline = [];
  }
}
