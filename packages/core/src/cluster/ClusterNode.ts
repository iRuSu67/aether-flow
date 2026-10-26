/**
 * ClusterNode
 * Distributed multi-agent cluster mesh with Raft-inspired leader coordination,
 * heartbeat monitoring, and distributed task delegation.
 */

export type NodeRole = 'leader' | 'worker' | 'observer';

export interface ClusterPeer {
  id: string;
  address: string;
  role: NodeRole;
  loadScore: number; // 0.0 to 1.0
  lastHeartbeat: number;
}

export interface ClusterTask {
  id: string;
  assignedNodeId?: string;
  payload: Record<string, unknown>;
  status: 'queued' | 'processing' | 'completed' | 'failed';
}

export class ClusterNode {
  public id: string;
  public address: string;
  public role: NodeRole;
  private peers: Map<string, ClusterPeer> = new Map();
  private taskQueue: ClusterTask[] = [];

  constructor(id: string, address = '127.0.0.1:4884', role: NodeRole = 'leader') {
    this.id = id;
    this.address = address;
    this.role = role;
  }

  /**
   * Register a new worker or peer in the cluster
   */
  public joinPeer(peer: Omit<ClusterPeer, 'lastHeartbeat'>): void {
    this.peers.set(peer.id, {
      ...peer,
      lastHeartbeat: Date.now(),
    });
  }

  /**
   * Submit task to cluster with automated least-load delegation
   */
  public delegateTask(payload: Record<string, unknown>): ClusterTask {
    const task: ClusterTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      payload,
      status: 'queued',
    };

    // Find least loaded peer
    let bestPeer: ClusterPeer | null = null;
    let minLoad = Infinity;

    for (const peer of this.peers.values()) {
      if (peer.role === 'worker' && peer.loadScore < minLoad) {
        minLoad = peer.loadScore;
        bestPeer = peer;
      }
    }

    if (bestPeer) {
      task.assignedNodeId = bestPeer.id;
      task.status = 'processing';
      bestPeer.loadScore += 0.2;
    } else {
      task.assignedNodeId = this.id;
      task.status = 'processing';
    }

    this.taskQueue.push(task);
    return task;
  }

  public getTopology(): { nodeId: string; role: NodeRole; peers: ClusterPeer[]; activeTasks: number } {
    return {
      nodeId: this.id,
      role: this.role,
      peers: Array.from(this.peers.values()),
      activeTasks: this.taskQueue.filter((t) => t.status === 'processing').length,
    };
  }
}
