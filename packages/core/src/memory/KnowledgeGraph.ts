/**
 * KnowledgeGraph
 * In-memory semantic graph store (GraphRAG) for multi-agent reasoning,
 * entity extraction, and relational pathfinding.
 */

export interface GraphNode {
  id: string;
  type: string;
  properties: Record<string, unknown>;
  createdAt: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  weight: number;
  metadata?: Record<string, unknown>;
}

export class KnowledgeGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private adjacency: Map<string, Set<string>> = new Map();

  /**
   * Add or update an entity node
   */
  public addNode(id: string, type: string, properties: Record<string, unknown> = {}): GraphNode {
    const node: GraphNode = {
      id,
      type,
      properties,
      createdAt: Date.now(),
    };
    this.nodes.set(id, node);
    if (!this.adjacency.has(id)) {
      this.adjacency.set(id, new Set());
    }
    return node;
  }

  /**
   * Connect two nodes with a typed relationship
   */
  public addEdge(
    source: string,
    target: string,
    relation: string,
    weight = 1.0,
    metadata?: Record<string, unknown>
  ): GraphEdge {
    if (!this.nodes.has(source)) this.addNode(source, 'concept');
    if (!this.nodes.has(target)) this.addNode(target, 'concept');
    if (!this.adjacency.has(source)) this.adjacency.set(source, new Set());

    const id = `${source}->[${relation}]->${target}`;
    const edge: GraphEdge = {
      id,
      source,
      target,
      relation,
      weight,
      metadata,
    };

    this.edges.set(id, edge);
    this.adjacency.get(source)!.add(target);
    return edge;
  }

  /**
   * Query incoming and outgoing edges for an entity
   */
  public getNeighbors(nodeId: string): { outgoing: GraphEdge[]; incoming: GraphEdge[] } {
    const outgoing: GraphEdge[] = [];
    const incoming: GraphEdge[] = [];

    for (const edge of this.edges.values()) {
      if (edge.source === nodeId) outgoing.push(edge);
      if (edge.target === nodeId) incoming.push(edge);
    }

    return { outgoing, incoming };
  }

  /**
   * Find relational paths between two concepts (Breadth-First Search)
   */
  public findPath(startId: string, endId: string, maxDepth = 4): string[] | null {
    if (!this.nodes.has(startId) || !this.nodes.has(endId)) return null;
    if (startId === endId) return [startId];

    const queue: Array<{ current: string; path: string[] }> = [{ current: startId, path: [startId] }];
    const visited = new Set<string>([startId]);

    while (queue.length > 0) {
      const { current, path } = queue.shift()!;
      if (path.length > maxDepth) continue;

      const neighbors = this.adjacency.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (neighbor === endId) {
          return [...path, neighbor];
        }
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ current: neighbor, path: [...path, neighbor] });
        }
      }
    }

    return null;
  }

  /**
   * Export the entire graph for visual canvas rendering
   */
  public toJSON() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
    };
  }

  public clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.adjacency.clear();
  }
}
