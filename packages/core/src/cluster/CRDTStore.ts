/**
 * CRDTStore & Vector Clocks
 * Conflict-free Replicated Data Type (LWW-Element-Set) and Vector Clock
 * for lock-free peer-to-peer state synchronization across distributed agent nodes.
 */

export class VectorClock {
  private clock: Map<string, number> = new Map();

  constructor(nodeId?: string) {
    if (nodeId) {
      this.clock.set(nodeId, 0);
    }
  }

  public increment(nodeId: string): void {
    const current = this.clock.get(nodeId) || 0;
    this.clock.set(nodeId, current + 1);
  }

  public merge(other: VectorClock): void {
    for (const [node, time] of other.clock.entries()) {
      const current = this.clock.get(node) || 0;
      this.clock.set(node, Math.max(current, time));
    }
  }

  public getTime(nodeId: string): number {
    return this.clock.get(nodeId) || 0;
  }

  public toJSON(): Record<string, number> {
    return Object.fromEntries(this.clock.entries());
  }
}

export interface CRDTElement<T> {
  value: T;
  timestamp: number;
  nodeId: string;
}

export class CRDTStore<T> {
  private addSet: Map<string, CRDTElement<T>> = new Map();
  private removeSet: Map<string, CRDTElement<T>> = new Map();

  /**
   * Add element with Last-Write-Wins timestamp
   */
  public add(key: string, value: T, nodeId: string): void {
    this.addSet.set(key, {
      value,
      timestamp: Date.now(),
      nodeId,
    });
  }

  /**
   * Remove element (Tombstone in removeSet)
   */
  public remove(key: string, value: T, nodeId: string): void {
    this.removeSet.set(key, {
      value,
      timestamp: Date.now(),
      nodeId,
    });
  }

  /**
   * Query element membership (Present if added after removal)
   */
  public has(key: string): boolean {
    const added = this.addSet.get(key);
    if (!added) return false;

    const removed = this.removeSet.get(key);
    if (!removed) return true;

    return added.timestamp >= removed.timestamp;
  }

  public get(key: string): T | undefined {
    return this.has(key) ? this.addSet.get(key)?.value : undefined;
  }

  /**
   * Merge external CRDT replica state without conflicts
   */
  public merge(otherAddSet: Map<string, CRDTElement<T>>, otherRemoveSet: Map<string, CRDTElement<T>>): void {
    for (const [key, elem] of otherAddSet.entries()) {
      const existing = this.addSet.get(key);
      if (!existing || elem.timestamp > existing.timestamp) {
        this.addSet.set(key, elem);
      }
    }

    for (const [key, elem] of otherRemoveSet.entries()) {
      const existing = this.removeSet.get(key);
      if (!existing || elem.timestamp > existing.timestamp) {
        this.removeSet.set(key, elem);
      }
    }
  }

  public values(): T[] {
    const result: T[] = [];
    for (const key of this.addSet.keys()) {
      if (this.has(key)) {
        result.push(this.addSet.get(key)!.value);
      }
    }
    return result;
  }
}
