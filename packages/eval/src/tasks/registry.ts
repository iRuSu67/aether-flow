import { BenchmarkTask, TaskFamilyId } from '../types.js';
import {
  task_1a_markdown_employees,
  task_1b_markdown_servers,
  task_1c_markdown_transactions,
} from './definitions/family1_markdown_table.js';
import {
  task_2a_levenshtein_dna,
  task_2b_levenshtein_tokens,
  task_2c_levenshtein_sentences,
} from './definitions/family2_levenshtein_alignment.js';
import {
  task_3a_dijkstra_city,
  task_3b_dijkstra_circuit,
  task_3c_dijkstra_warehouse,
} from './definitions/family3_dijkstra_turns.js';
import {
  task_4a_csv_sales,
  task_4b_csv_telemetry,
  task_4c_csv_grades,
} from './definitions/family4_csv_pivot.js';
import {
  task_5a_knapsack_cargo,
  task_5b_knapsack_payload,
  task_5c_knapsack_cloud,
} from './definitions/family5_knapsack_dual.js';

export const ALL_TASKS: BenchmarkTask[] = [
  // Family 1: Markdown Table Parser
  task_1a_markdown_employees,
  task_1b_markdown_servers,
  task_1c_markdown_transactions,

  // Family 2: Levenshtein Alignment
  task_2a_levenshtein_dna,
  task_2b_levenshtein_tokens,
  task_2c_levenshtein_sentences,

  // Family 3: Dijkstra Turn Penalties
  task_3a_dijkstra_city,
  task_3b_dijkstra_circuit,
  task_3c_dijkstra_warehouse,

  // Family 4: CSV 2D Pivot
  task_4a_csv_sales,
  task_4b_csv_telemetry,
  task_4c_csv_grades,

  // Family 5: Dual Knapsack
  task_5a_knapsack_cargo,
  task_5b_knapsack_payload,
  task_5c_knapsack_cloud,
];

export function getTaskById(id: string): BenchmarkTask | undefined {
  return ALL_TASKS.find((t) => t.id === id);
}

export function getTasksByFamily(familyId: TaskFamilyId): BenchmarkTask[] {
  return ALL_TASKS.filter((t) => t.familyId === familyId);
}
