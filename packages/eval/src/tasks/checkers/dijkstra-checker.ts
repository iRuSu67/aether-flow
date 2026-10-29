import { CheckerResult } from '../../types.js';

export type CompassDir = 'N' | 'S' | 'E' | 'W';

export interface DirectedEdge {
  from: string;
  to: string;
  weight: number;
  direction: CompassDir;
}

export interface TurnPenalties {
  straight: number;
  right: number;
  left: number;
  uTurn: number;
}

export interface DijkstraInput {
  nodes: string[];
  edges: DirectedEdge[];
  start: string;
  end: string;
  turnPenalties: TurnPenalties;
}

export interface DijkstraOutput {
  path: string[];
  totalCost: number;
}

function getTurnType(d1: CompassDir, d2: CompassDir): 'straight' | 'right' | 'left' | 'uTurn' {
  if (d1 === d2) return 'straight';
  const dirs: CompassDir[] = ['N', 'E', 'S', 'W'];
  const i1 = dirs.indexOf(d1);
  const i2 = dirs.indexOf(d2);
  const diff = (i2 - i1 + 4) % 4;
  if (diff === 1) return 'right';
  if (diff === 2) return 'uTurn';
  return 'left';
}

export function solveDijkstraReference(input: DijkstraInput): DijkstraOutput {
  const { edges, start, end, turnPenalties } = input;

  // Build adjacency
  const adj = new Map<string, DirectedEdge[]>();
  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from)!.push(edge);
  }

  // State: `${node}|${inDir || 'NONE'}` -> { cost, path }
  type StateKey = string;
  const dist = new Map<StateKey, number>();
  const parent = new Map<StateKey, { prevKey: StateKey | null; node: string }>();

  // Priority Queue: array-based min-heap or sorted array
  interface PQItem {
    node: string;
    inDir: CompassDir | null;
    cost: number;
    key: StateKey;
  }
  const pq: PQItem[] = [];

  const startKey = `${start}|NONE`;
  dist.set(startKey, 0);
  parent.set(startKey, { prevKey: null, node: start });
  pq.push({ node: start, inDir: null, cost: 0, key: startKey });

  let bestEndCost = Infinity;
  let bestEndKey: StateKey | null = null;

  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const curr = pq.shift()!;

    if (curr.cost > (dist.get(curr.key) ?? Infinity)) continue;

    if (curr.node === end) {
      if (curr.cost < bestEndCost) {
        bestEndCost = curr.cost;
        bestEndKey = curr.key;
      }
      continue;
    }

    const nextEdges = adj.get(curr.node) || [];
    for (const edge of nextEdges) {
      let turnPenalty = 0;
      if (curr.inDir !== null) {
        const turn = getTurnType(curr.inDir, edge.direction);
        turnPenalty = turnPenalties[turn];
      }

      const nextCost = curr.cost + edge.weight + turnPenalty;
      const nextKey = `${edge.to}|${edge.direction}`;

      if (nextCost < (dist.get(nextKey) ?? Infinity)) {
        dist.set(nextKey, nextCost);
        parent.set(nextKey, { prevKey: curr.key, node: edge.to });
        pq.push({ node: edge.to, inDir: edge.direction, cost: nextCost, key: nextKey });
      }
    }
  }

  if (bestEndKey === null) {
    return { path: [], totalCost: -1 };
  }

  // Reconstruct path
  const path: string[] = [];
  let curK: StateKey | null = bestEndKey;
  while (curK !== null) {
    const p = parent.get(curK);
    if (!p) break;
    path.push(p.node);
    curK = p.prevKey;
  }
  path.reverse();

  return { path, totalCost: bestEndCost };
}

export function checkDijkstraPath(candidateOutput: unknown, input: unknown): CheckerResult {
  const dInput = input as DijkstraInput;
  const refSolution = solveDijkstraReference(dInput);

  if (!candidateOutput || typeof candidateOutput !== 'object') {
    return { pass: false, reason: 'Expected object { path, totalCost }' };
  }

  const cand = candidateOutput as DijkstraOutput;
  if (!Array.isArray(cand.path)) {
    return { pass: false, reason: 'Candidate missing path array' };
  }

  if (typeof cand.totalCost !== 'number') {
    return { pass: false, reason: 'Candidate missing numeric totalCost' };
  }

  // Check endpoints
  if (cand.path.length === 0 || cand.path[0] !== dInput.start) {
    return { pass: false, reason: `Path must start at ${dInput.start}` };
  }
  if (cand.path[cand.path.length - 1] !== dInput.end) {
    return { pass: false, reason: `Path must end at ${dInput.end}` };
  }

  // Verify path edges & compute exact cost
  let calculatedCost = 0;
  let prevDir: CompassDir | null = null;

  for (let i = 0; i < cand.path.length - 1; i++) {
    const u = cand.path[i];
    const v = cand.path[i + 1];

    const matchingEdge = dInput.edges.find((e) => e.from === u && e.to === v);
    if (!matchingEdge) {
      return { pass: false, reason: `No directed edge exists from '${u}' to '${v}'` };
    }

    let turnPenalty = 0;
    if (prevDir !== null) {
      const turn = getTurnType(prevDir, matchingEdge.direction);
      turnPenalty = dInput.turnPenalties[turn];
    }

    calculatedCost += matchingEdge.weight + turnPenalty;
    prevDir = matchingEdge.direction;
  }

  if (calculatedCost !== cand.totalCost) {
    return {
      pass: false,
      reason: `Reported cost (${cand.totalCost}) does not match true traversed cost (${calculatedCost})`,
    };
  }

  if (calculatedCost !== refSolution.totalCost) {
    return {
      pass: false,
      reason: `Sub-optimal path: candidate cost is ${calculatedCost}, optimal minimum is ${refSolution.totalCost}`,
    };
  }

  return { pass: true };
}
