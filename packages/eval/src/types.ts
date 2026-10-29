export type TaskFamilyId =
  | 'family1_markdown_table'
  | 'family2_levenshtein_alignment'
  | 'family3_dijkstra_turns'
  | 'family4_csv_pivot'
  | 'family5_knapsack_dual';

export interface NegativeCase {
  name: string;
  output: unknown;
  expectedFailureReason: string;
}

export interface CheckerResult {
  pass: boolean;
  reason?: string;
}

export type CheckerFunction = (candidateOutput: unknown, input: unknown) => CheckerResult;

export interface TaskExample {
  input: Record<string, unknown>;
  output: unknown;
}

/**
 * BenchmarkTask defines the full task specification including ground-truth oracle checkers.
 * Hidden checkers and negative test cases are NEVER exposed to the agent synthesis loop.
 */
export interface BenchmarkTask {
  id: string;
  familyId: TaskFamilyId;
  variant: 'a' | 'b' | 'c';
  title: string;
  domain: string;
  prompt: string;
  input: unknown;
  example: TaskExample;
  referenceSolution: (input: unknown) => unknown;
  negativeCases: NegativeCase[];
  checker: CheckerFunction;
}

/**
 * AgentVisibleTask contains only information visible to the agent:
 * prompt, inputs, and declared public examples. The hidden test oracle is excluded.
 */
export type AgentVisibleTask = Pick<
  BenchmarkTask,
  'id' | 'familyId' | 'variant' | 'title' | 'domain' | 'prompt' | 'input' | 'example'
>;

export type ConditionId = 'A' | 'B' | 'C0' | 'C' | 'D';

export type ErrorTaxonomy =
  | 'SYNTAX_ERROR'
  | 'POLICY_BLOCKED'
  | 'RUNTIME_ERROR'
  | 'TIMEOUT'
  | 'WRONG_OUTPUT'
  | 'PROVIDER_ERROR'
  | 'SUCCESS';

export interface TokenUsage {
  promptTokens: number;
  thinkingTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface TaskRunResult {
  taskId: string;
  familyId: TaskFamilyId;
  variant?: 'a' | 'b' | 'c';
  condition: ConditionId;
  runIndex: number;
  pass: boolean;
  retries: number;
  errorTaxonomy: ErrorTaxonomy;
  errorDetails?: string;
  latencyMs: number;
  tokens: TokenUsage;
  reused: boolean;
  reuseAccurate?: boolean;
  astBlocked: boolean;
  rawOutput?: unknown;
}

export type ThinkingLevel = 'low' | 'medium' | 'high';

export interface EvalOptions {
  provider: 'mock' | 'gemini' | 'ollama' | 'openai';
  model: string;
  rpm: number;
  tpm: number;
  rpd: number;
  dailyBudget: number;
  maxCalls: number;
  runs: number;
  thinkingLevel: ThinkingLevel;
  limitTasks?: number;
  taskIds?: string[];
  conditions?: ConditionId[];
  stage?: 1 | 2 | 3;
  resume?: boolean;
  checkpointFile?: string;
  cacheDir?: string;
  openaiBaseUrl?: string;
}

export interface CallEstimates {
  minCalls: number;
  typicalCalls: number;
  maxCalls: number;
  perCondition: Record<ConditionId, { min: number; typical: number; max: number }>;
}

export interface ConditionStatistics {
  total: number;
  passed: number;
  validRuns: number;
  providerErrors: number;
  passRate: number;
  wilsonCI: [number, number];
  avgLatencyMs: number;
  avgTotalTokens: number;
  avgPromptTokens: number;
  avgThinkingTokens: number;
  avgOutputTokens: number;
  errorCounts: Record<ErrorTaxonomy, number>;
  astFalseRejections: number;
}

export interface ConditionDReuseStatistics {
  eligibleVariants: number;
  attemptedReuses: number;
  accurateReuses: number;
  reuseHitRate: number;
  reusePrecision: number;
  familyBreakdown: Record<
    TaskFamilyId,
    {
      eligible: number;
      hits: number;
      hitRate: number;
      accurate: number;
      precision: number;
    }
  >;
}

export interface EvalSummary {
  methodology: {
    provider: string;
    model: string;
    thinkingLevel: ThinkingLevel;
    runsPerTask: number;
    totalTasks: number;
    evaluationDate: string;
    stage?: number;
  };
  status: 'COMPLETED' | 'INCOMPLETE';
  incompleteReason?: string;
  dailyBudget?: {
    callsToday: number;
    maxDailyBudget: number;
    remaining: number;
    date: string;
    timezone: string;
  };
  conditionStats: Record<ConditionId, ConditionStatistics>;
  conditionDReuse: ConditionDReuseStatistics;
  apiCallsMade: number;
  cacheHits: number;
}
