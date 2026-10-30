import { BenchmarkTask } from '../../types.js';
import {
  checkDijkstraPath,
  solveDijkstraReference,
  DijkstraInput,
} from '../checkers/dijkstra-checker.js';

const dijkstraExample = {
  input: {
    nodes: ['A', 'B'],
    edges: [{ from: 'A', to: 'B', weight: 5, direction: 'E' }],
    start: 'A',
    end: 'B',
    turnPenalties: { straight: 0, right: 3, left: 7, uTurn: 15 },
  },
  output: {
    path: ['A', 'B'],
    totalCost: 5,
  },
};

export const task_3a_dijkstra_city: BenchmarkTask = {
  id: 'task_3a_dijkstra_city',
  familyId: 'family3_dijkstra_turns',
  variant: 'a',
  title: 'Dijkstra with Turn Penalties: City Grid',
  domain: 'Graph Routing with Turn Friction',
  prompt: `Find the shortest path from start node 'A' to end node 'J' in the directed street graph.
Turn penalties apply at intersections based on the change from incoming edge direction to outgoing edge direction:
- straight: 0
- right turn: 3
- left turn: 7
- uTurn: 15
Total path cost is the sum of edge weights plus all intermediate turn penalties.
Return JSON: { "path": ["A", ...], "totalCost": number }`,
  example: dijkstraExample,
  input: {
    nodes: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
    edges: [
      { from: 'A', to: 'B', weight: 4, direction: 'E' },
      { from: 'A', to: 'C', weight: 6, direction: 'S' },
      { from: 'B', to: 'D', weight: 5, direction: 'E' },
      { from: 'B', to: 'E', weight: 3, direction: 'S' },
      { from: 'C', to: 'E', weight: 4, direction: 'E' },
      { from: 'C', to: 'F', weight: 7, direction: 'S' },
      { from: 'D', to: 'G', weight: 6, direction: 'S' },
      { from: 'E', to: 'D', weight: 2, direction: 'N' },
      { from: 'E', to: 'H', weight: 5, direction: 'E' },
      { from: 'E', to: 'I', weight: 4, direction: 'S' },
      { from: 'F', to: 'I', weight: 3, direction: 'E' },
      { from: 'G', to: 'J', weight: 5, direction: 'S' },
      { from: 'H', to: 'G', weight: 4, direction: 'N' },
      { from: 'H', to: 'J', weight: 3, direction: 'E' },
      { from: 'I', to: 'J', weight: 8, direction: 'E' },
    ],
    start: 'A',
    end: 'J',
    turnPenalties: { straight: 0, right: 3, left: 7, uTurn: 15 },
  } as DijkstraInput,
  referenceSolution: (inp) => solveDijkstraReference(inp as DijkstraInput),
  negativeCases: [
    {
      name: 'Wrong structure',
      output: ['A', 'B', 'E', 'H', 'J'],
      expectedFailureReason: 'Expected object { path, totalCost }',
    },
    {
      name: 'Feasibility violation (non-existent edge)',
      output: {
        path: ['A', 'J'],
        totalCost: 10,
      },
      expectedFailureReason: 'No directed edge exists',
    },
    {
      name: 'Sub-optimal path',
      output: {
        path: ['A', 'C', 'F', 'I', 'J'],
        totalCost: 24, // true cost with turns is 24, but optimal is 15 via A-B-E-H-J
      },
      expectedFailureReason: 'Sub-optimal path',
    },
  ],
  checker: checkDijkstraPath,
};

export const task_3b_dijkstra_circuit: BenchmarkTask = {
  id: 'task_3b_dijkstra_circuit',
  familyId: 'family3_dijkstra_turns',
  variant: 'b',
  title: 'Dijkstra with Turn Penalties: Circuit Trace Routing',
  domain: 'Graph Routing with Turn Friction',
  prompt: `Find the optimal circuit trace path from pad 'P1' to pad 'P8'.
Penalties apply to direction changes due to trace impedance and vias:
- straight: 0, right: 4, left: 4, uTurn: 20
Return JSON: { "path": ["P1", ...], "totalCost": number }`,
  example: dijkstraExample,
  input: {
    nodes: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
    edges: [
      { from: 'P1', to: 'P2', weight: 2, direction: 'E' },
      { from: 'P1', to: 'P3', weight: 5, direction: 'N' },
      { from: 'P2', to: 'P4', weight: 3, direction: 'E' },
      { from: 'P2', to: 'P5', weight: 6, direction: 'N' },
      { from: 'P3', to: 'P5', weight: 2, direction: 'E' },
      { from: 'P3', to: 'P6', weight: 8, direction: 'N' },
      { from: 'P4', to: 'P7', weight: 4, direction: 'N' },
      { from: 'P5', to: 'P7', weight: 3, direction: 'E' },
      { from: 'P5', to: 'P8', weight: 7, direction: 'N' },
      { from: 'P6', to: 'P8', weight: 2, direction: 'E' },
      { from: 'P7', to: 'P8', weight: 3, direction: 'N' },
    ],
    start: 'P1',
    end: 'P8',
    turnPenalties: { straight: 0, right: 4, left: 4, uTurn: 20 },
  } as DijkstraInput,
  referenceSolution: (inp) => solveDijkstraReference(inp as DijkstraInput),
  negativeCases: [
    {
      name: 'Wrong structure',
      output: 15,
      expectedFailureReason: 'Expected object { path, totalCost }',
    },
    {
      name: 'Wrong endpoint',
      output: {
        path: ['P1', 'P2', 'P4'],
        totalCost: 5,
      },
      expectedFailureReason: 'Path must end at P8',
    },
    {
      name: 'Sub-optimal path',
      output: {
        path: ['P1', 'P3', 'P6', 'P8'],
        totalCost: 19,
      },
      expectedFailureReason: 'Sub-optimal path',
    },
  ],
  checker: checkDijkstraPath,
};

export const task_3c_dijkstra_warehouse: BenchmarkTask = {
  id: 'task_3c_dijkstra_warehouse',
  familyId: 'family3_dijkstra_turns',
  variant: 'c',
  title: 'Dijkstra with Turn Penalties: AGV Warehouse Aisle',
  domain: 'Graph Routing with Turn Friction',
  prompt: `Find the minimum cost trajectory for an autonomous guided vehicle (AGV) from 'Bay1' to 'Dock9'.
Turn penalties model robotic wheel deceleration and turning friction:
- straight: 0, right: 5, left: 8, uTurn: 25
Return JSON: { "path": ["Bay1", ...], "totalCost": number }`,
  example: dijkstraExample,
  input: {
    nodes: ['Bay1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Dock9'],
    edges: [
      { from: 'Bay1', to: 'A1', weight: 10, direction: 'N' },
      { from: 'Bay1', to: 'B1', weight: 12, direction: 'E' },
      { from: 'A1', to: 'A2', weight: 8, direction: 'N' },
      { from: 'A1', to: 'B1', weight: 6, direction: 'E' },
      { from: 'A2', to: 'B2', weight: 5, direction: 'E' },
      { from: 'A2', to: 'Dock9', weight: 22, direction: 'N' },
      { from: 'B1', to: 'B2', weight: 7, direction: 'N' },
      { from: 'B1', to: 'C1', weight: 9, direction: 'E' },
      { from: 'B2', to: 'C2', weight: 6, direction: 'E' },
      { from: 'B2', to: 'Dock9', weight: 11, direction: 'N' },
      { from: 'C1', to: 'C2', weight: 8, direction: 'N' },
      { from: 'C2', to: 'Dock9', weight: 10, direction: 'W' },
    ],
    start: 'Bay1',
    end: 'Dock9',
    turnPenalties: { straight: 0, right: 5, left: 8, uTurn: 25 },
  } as DijkstraInput,
  referenceSolution: (inp) => solveDijkstraReference(inp as DijkstraInput),
  negativeCases: [
    {
      name: 'Wrong start node',
      output: {
        path: ['A1', 'A2', 'B2', 'Dock9'],
        totalCost: 20,
      },
      expectedFailureReason: 'Path must start at Bay1',
    },
    {
      name: 'Cost calculation arithmetic error',
      output: {
        path: ['Bay1', 'A1', 'A2', 'B2', 'Dock9'],
        totalCost: 1, // wildly wrong cost
      },
      expectedFailureReason: 'does not match true traversed cost',
    },
    {
      name: 'Sub-optimal route',
      output: {
        path: ['Bay1', 'A1', 'A2', 'Dock9'],
        totalCost: 40,
      },
      expectedFailureReason: 'Sub-optimal path',
    },
  ],
  checker: checkDijkstraPath,
};
