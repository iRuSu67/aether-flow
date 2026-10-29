import { BenchmarkTask } from '../../types.js';
import {
  checkKnapsack,
  solveKnapsackReference,
  KnapsackInput,
} from '../checkers/knapsack-checker.js';

const knapsackExample = {
  input: {
    items: [
      { id: 1, value: 30, weight: 5, volume: 5 },
      { id: 2, value: 20, weight: 4, volume: 4 },
    ],
    maxWeight: 6,
    maxVolume: 6,
  },
  output: {
    selectedIds: [1],
    totalValue: 30,
  },
};

export const task_5a_knapsack_cargo: BenchmarkTask = {
  id: 'task_5a_knapsack_cargo',
  familyId: 'family5_knapsack_dual',
  variant: 'a',
  title: '0/1 Dual Knapsack: Freight Cargo Packing',
  domain: 'Combinatorial Optimization',
  prompt: `Solve the 0/1 Knapsack problem with dual capacity constraints (maxWeight and maxVolume).
Select a subset of items that maximizes total value without exceeding maxWeight or maxVolume.
Output JSON: { "selectedIds": number[], "totalValue": number }

Items:
- id: 1, value: 50, weight: 10, volume: 15
- id: 2, value: 40, weight: 8, volume: 12
- id: 3, value: 70, weight: 15, volume: 20
- id: 4, value: 90, weight: 20, volume: 25
- id: 5, value: 30, weight: 6, volume: 8
- id: 6, value: 45, weight: 11, volume: 14
- id: 7, value: 60, weight: 13, volume: 18
- id: 8, value: 35, weight: 7, volume: 10

Constraints:
maxWeight = 35
maxVolume = 45`,
  example: knapsackExample,
  input: {
    items: [
      { id: 1, value: 50, weight: 10, volume: 15 },
      { id: 2, value: 40, weight: 8, volume: 12 },
      { id: 3, value: 70, weight: 15, volume: 20 },
      { id: 4, value: 90, weight: 20, volume: 25 },
      { id: 5, value: 30, weight: 6, volume: 8 },
      { id: 6, value: 45, weight: 11, volume: 14 },
      { id: 7, value: 60, weight: 13, volume: 18 },
      { id: 8, value: 35, weight: 7, volume: 10 },
    ],
    maxWeight: 35,
    maxVolume: 45,
  } as KnapsackInput,
  referenceSolution: (inp) => solveKnapsackReference(inp as KnapsackInput),
  negativeCases: [
    {
      name: 'Wrong structure',
      output: [1, 2, 3],
      expectedFailureReason: 'Expected object { selectedIds, totalValue }',
    },
    {
      name: 'Weight constraint violation',
      output: {
        selectedIds: [3, 4], // weight 15 + 20 = 35, volume 20 + 25 = 45 (total val 160)
        totalValue: 999, // claim wrong totalValue
      },
      expectedFailureReason: 'does not match sum of selected items',
    },
    {
      name: 'Sub-optimal selection',
      output: {
        selectedIds: [5, 8], // weight 13, volume 18, value 65 (feasible but sub-optimal)
        totalValue: 65,
      },
      expectedFailureReason: 'Sub-optimal selection',
    },
  ],
  checker: checkKnapsack,
};

export const task_5b_knapsack_payload: BenchmarkTask = {
  id: 'task_5b_knapsack_payload',
  familyId: 'family5_knapsack_dual',
  variant: 'b',
  title: '0/1 Dual Knapsack: Satellite Payload Instruments',
  domain: 'Combinatorial Optimization',
  prompt: `Select satellite instruments to maximize scientific return value subject to maximum payload mass and power consumption limits.
Output JSON: { "selectedIds": number[], "totalValue": number }

Items:
- id: 101, value: 120, weight: 14, volume: 18
- id: 102, value: 85, weight: 9, volume: 11
- id: 103, value: 95, weight: 12, volume: 13
- id: 104, value: 150, weight: 18, volume: 22
- id: 105, value: 60, weight: 6, volume: 9
- id: 106, value: 110, weight: 13, volume: 16

Constraints:
maxWeight = 30
maxVolume = 40`,
  example: knapsackExample,
  input: {
    items: [
      { id: 101, value: 120, weight: 14, volume: 18 },
      { id: 102, value: 85, weight: 9, volume: 11 },
      { id: 103, value: 95, weight: 12, volume: 13 },
      { id: 104, value: 150, weight: 18, volume: 22 },
      { id: 105, value: 60, weight: 6, volume: 9 },
      { id: 106, value: 110, weight: 13, volume: 16 },
    ],
    maxWeight: 30,
    maxVolume: 40,
  } as KnapsackInput,
  referenceSolution: (inp) => solveKnapsackReference(inp as KnapsackInput),
  negativeCases: [
    {
      name: 'Wrong structure',
      output: 265,
      expectedFailureReason: 'Expected object { selectedIds, totalValue }',
    },
    {
      name: 'Capacity violation (volume exceeded)',
      output: {
        selectedIds: [101, 104, 105], // volume 18 + 22 + 9 = 49 > 40
        totalValue: 330,
      },
      expectedFailureReason: 'Volume limit exceeded',
    },
    {
      name: 'Sub-optimal selection',
      output: {
        selectedIds: [102, 105], // value 145 (sub-optimal)
        totalValue: 145,
      },
      expectedFailureReason: 'Sub-optimal selection',
    },
  ],
  checker: checkKnapsack,
};

export const task_5c_knapsack_cloud: BenchmarkTask = {
  id: 'task_5c_knapsack_cloud',
  familyId: 'family5_knapsack_dual',
  variant: 'c',
  title: '0/1 Dual Knapsack: Cloud VM Packing',
  domain: 'Combinatorial Optimization',
  prompt: `Pack virtual machine instances into a bare-metal hypervisor to maximize customer billing yield subject to vCPU and RAM caps.
Output JSON: { "selectedIds": number[], "totalValue": number }

Items:
- id: 201, value: 80, weight: 4, volume: 16
- id: 202, value: 150, weight: 8, volume: 32
- id: 203, value: 220, weight: 12, volume: 48
- id: 204, value: 70, weight: 4, volume: 12
- id: 205, value: 110, weight: 6, volume: 24
- id: 206, value: 190, weight: 10, volume: 36

Constraints:
maxWeight = 20
maxVolume = 72`,
  example: knapsackExample,
  input: {
    items: [
      { id: 201, value: 80, weight: 4, volume: 16 },
      { id: 202, value: 150, weight: 8, volume: 32 },
      { id: 203, value: 220, weight: 12, volume: 48 },
      { id: 204, value: 70, weight: 4, volume: 12 },
      { id: 205, value: 110, weight: 6, volume: 24 },
      { id: 206, value: 190, weight: 10, volume: 36 },
    ],
    maxWeight: 20,
    maxVolume: 72,
  } as KnapsackInput,
  referenceSolution: (inp) => solveKnapsackReference(inp as KnapsackInput),
  negativeCases: [
    {
      name: 'Duplicate items selected',
      output: {
        selectedIds: [201, 201],
        totalValue: 160,
      },
      expectedFailureReason: 'Duplicate item id',
    },
    {
      name: 'Weight limit exceeded',
      output: {
        selectedIds: [202, 203, 204], // weight 8 + 12 + 4 = 24 > 20
        totalValue: 440,
      },
      expectedFailureReason: 'Weight limit exceeded',
    },
    {
      name: 'Sub-optimal value',
      output: {
        selectedIds: [201, 204], // value 150 (sub-optimal)
        totalValue: 150,
      },
      expectedFailureReason: 'Sub-optimal selection',
    },
  ],
  checker: checkKnapsack,
};
