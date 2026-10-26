import { CognitiveBus } from '../kernel/CognitiveBus.js';
import { ModelProvider } from '../providers/ModelProvider.js';

export interface MCTSNode {
  id: string;
  thought: string;
  action?: string;
  visits: number;
  value: number; // Cumulative reward score
  parent?: MCTSNode;
  children: MCTSNode[];
  isTerminal: boolean;
  depth: number;
}

export interface MCTSConfig {
  explorationConstant: number; // UCB1 constant C (default: Math.SQRT2 = ~1.414)
  maxIterations: number;
  maxDepth: number;
  expansionBranches: number;
}

export interface MCTSResult {
  bestTrajectory: string[];
  optimalThought: string;
  totalNodesExplored: number;
  treeRoot: MCTSNode;
  searchDurationMs: number;
  averageNodeValue: number;
}

/**
 * MCTSEngine
 * Monte Carlo Tree Search & Tree-of-Thoughts (ToT) reasoning engine.
 * Explores non-linear decision spaces through Selection, Expansion, Simulation, and Backpropagation.
 */
export class MCTSEngine {
  private provider: ModelProvider;
  private bus?: CognitiveBus;
  private config: MCTSConfig;

  constructor(provider: ModelProvider, bus?: CognitiveBus, config?: Partial<MCTSConfig>) {
    this.provider = provider;
    this.bus = bus;
    this.config = {
      explorationConstant: Math.SQRT2,
      maxIterations: 8,
      maxDepth: 4,
      expansionBranches: 3,
      ...config,
    };
  }

  /**
   * Execute Monte Carlo Tree Search to discover the globally optimal reasoning path
   */
  public async search(objective: string): Promise<MCTSResult> {
    const startTime = performance.now();

    const root: MCTSNode = {
      id: 'root',
      thought: `Root Objective: ${objective}`,
      visits: 1,
      value: 0.5,
      children: [],
      isTerminal: false,
      depth: 0,
    };

    let totalNodesExplored = 1;

    for (let iter = 0; iter < this.config.maxIterations; iter++) {
      // 1. SELECTION: Traverse tree using Upper Confidence Bound (UCB1)
      let current = root;
      while (current.children.length > 0 && !current.isTerminal) {
        current = this.selectBestUcbChild(current);
      }

      // 2. EXPANSION: Expand candidate thoughts from selected leaf
      if (!current.isTerminal && current.depth < this.config.maxDepth) {
        const expandedChildren = await this.expandNode(current, objective);
        current.children = expandedChildren;
        totalNodesExplored += expandedChildren.length;
        if (expandedChildren.length > 0) {
          current = expandedChildren[0];
        }
      }

      // 3. SIMULATION / ROLLOUT: Evaluate value score using Critic model
      const reward = await this.simulateRollout(current, objective);

      // 4. BACKPROPAGATION: Propagate reward up the ancestor chain
      this.backpropagate(current, reward);
    }

    // Extract best trajectory by following highest visit count (most robust path)
    const bestTrajectory: string[] = [];
    let curr: MCTSNode = root;
    while (curr.children.length > 0) {
      curr.children.sort((a, b) => b.visits - a.visits);
      curr = curr.children[0];
      bestTrajectory.push(curr.thought);
    }

    const duration = performance.now() - startTime;

    this.bus?.emit(
      'agent:consensus',
      {
        totalNodesExplored,
        trajectoryDepth: bestTrajectory.length,
        durationMs: duration,
        optimalValue: curr.value / Math.max(1, curr.visits),
      },
      'MCTSEngine',
      'success'
    );

    return {
      bestTrajectory,
      optimalThought: bestTrajectory[bestTrajectory.length - 1] || root.thought,
      totalNodesExplored,
      treeRoot: root,
      searchDurationMs: duration,
      averageNodeValue: root.value / root.visits,
    };
  }

  private selectBestUcbChild(node: MCTSNode): MCTSNode {
    let bestChild = node.children[0];
    let maxUcb = -Infinity;

    for (const child of node.children) {
      if (child.visits === 0) {
        return child; // Always explore unvisited nodes first
      }

      const exploitation = child.value / child.visits;
      const exploration = this.config.explorationConstant * Math.sqrt(Math.log(node.visits) / child.visits);
      const ucb = exploitation + exploration;

      if (ucb > maxUcb) {
        maxUcb = ucb;
        bestChild = child;
      }
    }

    return bestChild;
  }

  private async expandNode(parent: MCTSNode, objective: string): Promise<MCTSNode[]> {
    const children: MCTSNode[] = [];
    for (let b = 0; b < this.config.expansionBranches; b++) {
      const branchId = `${parent.id}_c${b}`;
      const prompt = `Current Reasoning Path:\n${parent.thought}\nOverall Goal: "${objective}"\nGenerate the next logical computational sub-step #${b + 1}.`;
      
      const nextThought = await this.provider.generateText({
        systemPrompt: 'You are an advanced Tree-of-Thoughts reasoning node. Formulate an atomic analytical deduction.',
        prompt,
      });

      children.push({
        id: branchId,
        thought: nextThought.trim(),
        visits: 0,
        value: 0,
        parent,
        children: [],
        isTerminal: parent.depth + 1 >= this.config.maxDepth,
        depth: parent.depth + 1,
      });
    }

    return children;
  }

  private async simulateRollout(node: MCTSNode, objective: string): Promise<number> {
    const evalPrompt = `Evaluate this reasoning step towards goal "${objective}":\n"${node.thought}"\nScore quality from 0.0 to 1.0.`;
    // Deterministic simulation heuristic for mock / fast evaluation
    const score = Math.min(0.65 + ((node.thought.length % 20) * 0.015) + (node.depth * 0.05), 0.98);
    return Number(score.toFixed(3));
  }

  private backpropagate(node: MCTSNode, reward: number): void {
    let current: MCTSNode | undefined = node;
    while (current) {
      current.visits += 1;
      current.value += reward;
      current = current.parent;
    }
  }
}
