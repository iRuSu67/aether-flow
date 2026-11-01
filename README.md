# AetherFlow

[![CI](https://github.com/iRuSu67/aether-flow/actions/workflows/ci.yml/badge.svg)](https://github.com/iRuSu67/aether-flow/actions)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache_2.0-blue.svg)](LICENSE)

AetherFlow lets an LLM write a small JavaScript tool when it needs one, then runs that tool inside a locked-down Docker container. If the code fails, the error goes back to the model for another try. Tools that work get saved, so the next similar task can reuse them.

Output of a real run against gemini-3.5-flash-lite (also saved in docs/demo-output.txt).

```text
================================================================================
                    AETHERFLOW v0.1 DEMONSTRATION STORYBOARD                    
================================================================================
 EXECUTION MODE     : LIVE MODEL (gemini-3.5-flash-lite)
 SCENARIO           : Autonomous Financial Portfolio Metric Computation
 1. REGISTRY CHECK   : Agent checks ToolRegistry for "calculate_rolling_cagr" -> MISSING
 2. JIT SYNTHESIS    : Agent synthesizes dynamic tool code (Attempt 1)
 3. SANDBOX DETECT   : Sandbox catches unhandled zero-duration error in contract testing
 4. SELF-HEALING     : Sandbox exception diagnostics routed back to repair loop
 5. HEALED SYNTHESIS : Agent repairs code with numeric guards & boundary checks (Attempt 2)
 6. VERIFICATION     : Healed tool passes AST inspection and isolated Sandbox execution
 7. REGISTRATION     : Verified tool saved to ToolRegistry & persistent SkillRegistry
 8. INSTANT REUSE    : Follow-up query uses registered tool with 0 synthesis overhead
================================================================================

[STAGE 1: TASK ARRIVAL & TOOL LOOKUP]
Goal: "Calculate 3-year Rolling CAGR for Portfolio Alpha (startValue: 100,000, endValue: 172,800, years: 3)"
Checking ToolRegistry for "calculate_rolling_cagr"...
  Γå│ ToolRegistry.has("calculate_rolling_cagr"): false (MISSING - Tool Synthesis Required)

  21:56:00 [GoalRouter]     (goal:received       ): {"goal":"Calculate 3-year Rolling CAGR for Portfolio Alpha (startValue: 100,000, endValue: 172,800, years: 3)","targetTool":"calculate_rolling_cagr"}
[STAGE 2: INITIAL SYNTHESIS ATTEMPT 1]
  21:56:00 [Synthesizer]    (tool:requested      ): {"attempt":1,"tool":"calculate_rolling_cagr"}
  Querying live model gemini-3.5-flash-lite for initial candidate...
  Generated candidate code (Draft v1):
export default async function execute(args) {
    const { startValue, endValue, years } = args;
    const cagr = ((endValue / startValue) ** (1 / years) - 1) * 100;
    return {
        cagr: Math.round(cagr * 100) / 100
    };
}

[STAGE 3: VERIFIED SANDBOX EXECUTION ΓÇö CONTRACT TESTING]
  Executing static AST verification...
  Γå│ AST Clean: true
  Executing edge-case contract in Sandbox: { startValue: 100000, endValue: 120000, years: 0 }
  Γ¥î Sandbox Verification FAILED: Contract check failed: years=0 yielded non-finite CAGR (null)
  21:56:02 [Sandbox]        (sandbox:error       ): {"attempt":1,"error":"Contract check failed: years=0 yielded non-finite CAGR (null)"}

[STAGE 4: SELF-HEALING FEEDBACK LOOP TRIGGERED]
  Routing error diagnostic back to Synthesizer: "Contract check failed: years=0 yielded non-finite CAGR (null)"
  21:56:02 [Microkernel]    (self_heal:triggered ): {"attempt":1,"diagnostic":"Contract check failed: years=0 yielded non-finite CAGR (null)"}

[STAGE 5: ITERATIVE REPAIR & HARDENED SYNTHESIS (ATTEMPT 2)]
  21:56:02 [Synthesizer]    (tool:requested      ): {"attempt":2,"tool":"calculate_rolling_cagr","reason":"self_heal"}
  Querying live model gemini-3.5-flash-lite for self-healed repair...
  Generated repaired code (Draft v2 - Self-Healed):
export default async function execute(args) {
    const { startValue, endValue, years } = args;

    // Validate inputs
    if (typeof startValue !== 'number' || typeof endValue !== 'number' || typeof years !== 'number') {
        return { cagr: 0.0, note: "Invalid input types" };
    }

    if (startValue <= 0 || endValue <= 0) {
        return { cagr: 0.0, note: "Values must be greater than zero" };
    }

    // Handle zero or negative duration safely
    if (years <= 0) {
        return { cagr: 0.0, note: "Zero duration" };
    }

    // Compute CAGR
    const cagr = ((endValue / startValue) ** (1 / years) - 1) * 100;

    return {
        cagr: Math.round(cagr * 100) / 100
    };
}

[STAGE 6: SANDBOX VERIFICATION OF REPAIRED TOOL]
  Γå│ AST Clean: true
  Γå│ Edge-case test (years: 0): Result = {"cagr":0,"note":"Zero duration"}
  Γå│ Standard test (3-year 1.728x): Result = {"cagr":20}
  Γ£ö Sandbox Verification: PASSED (100% Contract Satisfaction)
  21:56:03 [Sandbox]        (tool:synthesized    ): {"toolName":"calculate_rolling_cagr","iterations":2}

[STAGE 7: REGISTRATION & PERSISTENCE]
  21:56:03 [Microkernel]    (tool:synthesized    ): {"toolName":"calculate_rolling_cagr","registeredTo":["ToolRegistry","SkillRegistry"]}
  Γ£ö Registered "calculate_rolling_cagr" into active ToolRegistry.
  Γ£ö Indexed into persistent SkillRegistry for fuzzy vector lookup.

[STAGE 8: FOLLOW-UP GOAL & INSTANT REUSE]
Goal 2: "Calculate 5-year Rolling CAGR for Portfolio Beta (startValue: 50,000, endValue: 125,000, years: 5)"
Checking ToolRegistry for "calculate_rolling_cagr"...
  Γå│ ToolRegistry.has("calculate_rolling_cagr"): true (CACHE HIT ΓÇö Zero-Cost Reuse)
  21:56:03 [GoalRouter]     (tool:executed       ): {"toolName":"calculate_rolling_cagr","goal":"Calculate 5-year Rolling CAGR for Portfolio Beta (startValue: 50,000, endValue: 125,000, years: 5)","synthesisCallsAvoided":1}
  Γå│ Execution in Sandbox: {"cagr":20.11} (Executed in 125ms)

================================================================================
                          DEMO EXECUTION SUMMARY                                
================================================================================
  Initial Tool Lookup   : MISS (Required JIT Synthesis)
  Attempt 1 Status      : FAILED in Sandbox (Edge-case zero duration caught)
  Self-Healing Recovery : SUCCESS (Iterative repair prompt generated robust code)
  Verification Mode     : AST Scanning + Subprocess/Docker Sandbox Isolation
  Second Tool Lookup    : HIT (Immediate reuse from ToolRegistry)
  Tokens Consumed Goal 2: 0 model tokens (100% amortized reuse)
  Status                : ALL SYSTEM CAPABILITIES DEMONSTRATED
================================================================================
```

## How it works

1. A task comes in and there's no tool for it.
2. The model writes a single-file JavaScript function.
3. A TypeScript AST check rejects obviously dangerous code: `eval`, `process`, `Function`, dynamic imports, loops with no exit. It takes about 20 ms.
4. The code runs in a Docker container with no network, a read-only filesystem, a non-root user, dropped capabilities, and memory and process limits.
5. If it crashes or times out, the error goes back to the model, which gets a few retries.
6. A tool that works is saved in a library keyed by the task description. A similar task later can reuse it without another model call.

The AST check is a lint pass, not a security boundary. There are known ways around it (the tests cover some), so the container is what's supposed to hold.

## Status

| Part | State |
| --- | --- |
| Docker sandbox (`packages/core`) | Works. Adversarial tests run against both Docker and dev mode. |
| AST checker | Works as a lint layer. Has known bypasses. |
| Tool synthesis loop | Works in the demo and in the benchmark below. |
| Benchmark harness (`packages/eval`) | Works. It produced the results below. |
| CLI, web dashboard, Python SDK | Prototypes. Not tested or benchmarked in v0.1. |
| `packages/core/src/experimental`, `experimental/examples` | Unfinished ideas (MCTS, multi-agent debate, CRDT cluster, browser/vision/voice). Not supported. |

## Setup

You need Node 22 or newer (CI runs 22 and 24) and Docker running. On Windows, Docker Desktop with WSL2 works.

```bash
git clone https://github.com/iRuSu67/aether-flow.git
cd aether-flow
npm ci
npm run build
npm test
```

`npm run demo` runs the whole loop: missing tool, synthesis, a failure, a fix, save, reuse. To use a real model, put `GEMINI_API_KEY=your_key` in a `.env` file in the repo root. A free key from Google AI Studio works but has low daily limits. Without a key the demo falls back to an offline mock. `.env` is gitignored, so keep it that way.

## Using the sandbox directly

```typescript
import { Sandbox, ASTVerifier } from '@aether-flow/core';

const sandbox = new Sandbox({
  mode: 'docker',          // the default
  timeoutMs: 5000,
  maxMemoryMb: 64,
  maxOutputBytes: 1024 * 64,
});

const toolCode = `
  export default async function execute(args) {
    return args.numbers.reduce((acc, n) => acc + n * 2, 0);
  }
`;

const report = new ASTVerifier().verify(toolCode);
if (!report.isSafe) {
  throw new Error(`Rejected: ${report.bannedPatternsDetected.join(', ')}`);
}

const result = await sandbox.execute(toolCode, { numbers: [1, 2, 3, 4, 5] });
// { success: true, result: 30, logs: [], executionTimeMs: ~1200 }
```

## Sandbox modes

| Mode | What isolates the code | Use it for |
| --- | --- | --- |
| `docker` (default) | Container with `--network none`, `--read-only`, non-root user, `--cap-drop=ALL`, `--pids-limit=64`, `--memory=64m` | Anything you don't trust |
| `subprocess` | A child Node process with an empty environment and a restricted VM context | Local development when Docker isn't available |

`subprocess` mode can't block network access at the OS level, so it isn't safe for untrusted code. It throws unless you pass `{ unsafeDevMode: true }`, and it logs a warning when you do.

`scripts/verify_mutations.js` removes each defense one at a time (9 Docker layers, 6 subprocess layers) and checks that a test fails. That shows the tests notice when a defense goes missing. It doesn't prove the sandbox can't be escaped. The threat model is in [SECURITY.md](SECURITY.md).

## Benchmark

I ran the loop on `gemini-3.5-flash-lite` (free tier): 15 tasks in 5 families, 3 runs per task, 225 runs total, 0 provider errors. Every task has a deterministic checker, no LLM judge. The conditions:

- **A**: ask the model for the answer directly.
- **B**: the model can call a fixed set of 5 simple tools (`math_calc`, `regex_match`, `json_path`, `string_slice`, `array_sort`).
- **C0**: the model writes code once and it runs in the sandbox, with no retries.
- **C**: like C0, but errors go back to the model for retries.
- **D**: like C, with the tool library turned on so later variants of a task can reuse earlier tools.

| Condition | Pass rate (95% CI) | Mean latency |
| --- | --- | --- |
| A | 80.0% (66.2 to 89.1) | 4,927 ms |
| B | 75.6% (61.3 to 85.8) | 8,146 ms |
| C0 | 86.7% (73.8 to 93.7) | 6,390 ms |
| C | 91.1% (79.3 to 96.5) | 6,645 ms |
| D | 91.1% (79.3 to 96.5) | not comparable, see below |

Passes out of 3 runs per task:

| Task | A | B | C0 | C | D |
| --- | :-: | :-: | :-: | :-: | :-: |
| 1a markdown employees | 3 | 3 | 2 | 3 | 3 |
| 1b markdown servers | 3 | 3 | 3 | 3 | 3 |
| 1c markdown transactions | 3 | 3 | 3 | 3 | 3 |
| 2a levenshtein dna | 0 | 0 | 0 | 0 | 0 |
| 2b levenshtein tokens | 0 | 0 | 3 | 3 | 3 |
| 2c levenshtein sentences | 0 | 0 | 3 | 2 | 2 |
| 3a dijkstra city | 3 | 3 | 3 | 3 | 3 |
| 3b dijkstra circuit | 3 | 2 | 1 | 3 | 3 |
| 3c dijkstra warehouse | 3 | 3 | 3 | 3 | 3 |
| 4a csv sales | 3 | 3 | 3 | 3 | 3 |
| 4b csv telemetry | 3 | 3 | 3 | 3 | 3 |
| 4c csv grades | 3 | 3 | 3 | 3 | 3 |
| 5a knapsack cargo | 3 | 2 | 3 | 3 | 3 |
| 5b knapsack payload | 3 | 3 | 3 | 3 | 3 |
| 5c knapsack cloud | 3 | 3 | 3 | 3 | 3 |

Raw data: [`eval/results/2026-10-30.json`](eval/results/2026-10-30.json), design in [`EVAL_DESIGN.md`](EVAL_DESIGN.md).

### What this does and doesn't show

- Condition A already passes 12 of the 15 tasks on every run. It fails only the three sequence-alignment tasks.
- C beats A by 5 runs out of 45, and all 5 come from tasks 2b and 2c. The confidence intervals overlap. The 45 runs are 15 tasks times 3 repeats, not 45 independent tasks, so the real uncertainty is wider than the intervals say. Treat this as a hint that running code helps on problems the model can't work through in its head, and not as a proven result.
- C vs C0 is 41 vs 39. Two extra passes is within noise, so this benchmark can't say whether the retry loop helps.
- Task 2a is broken. The prompt's example format and the checker disagree about what `char` means in a substitute step, so every condition fails it. It says more about the benchmark than the model. I plan to fix it and rerun that task in v0.1.1.
- Condition B is a weak baseline. Five simple tools can't do dynamic programming, so a fair comparison would need a better tool set.
- For D, 21 of the 30 eligible task variants reused a saved tool, and all 21 were correct. That depends on the variants sharing an input format, which I built into the task families. Its latency and token numbers aren't comparable because the evaluation ran with a response cache on: when D fell back to synthesis, it read the cached answer from C in about 2 ms. Rebuilding D's latency offline with C's original timings gives about 5,400 ms against C's 6,645 ms. Also, D's results on the first variant of each family are C's cached output, so they aren't an independent check.
- One failure is worth knowing about. In task 3b, the AST check rejected a valid heap implementation because it contained `while (true)` with a `break` inside. The check now allows loops with a reachable exit. Across the run, 4 of 119 generated snippets (3.4%) were rejected this way.

## Limitations

- One small model and 15 tasks, most of them easy for it. Harder tasks are the obvious next step.
- Every sandboxed call pays for starting a container, about 1 to 1.3 seconds. A pre-warmed pool would fix that but doesn't exist yet.
- Reuse only works when new tasks look like old ones, and the input shapes match.
- Inputs and outputs travel as JSON over pipes, and results over about 1 MB are cut off.
- Tested on Windows (Docker Desktop with WSL2) and on Ubuntu in CI. Other setups, including ARM and older cgroup v1 hosts, are untested.
- Single machine only.

## Repo layout

- `packages/core`: sandbox, AST verifier, tool synthesis loop, providers
- `packages/eval`: benchmark tasks, checkers and harness
- `packages/cli`, `packages/web`, `packages/python-sdk`: prototypes
- `eval/results`: benchmark output
- `scripts`: mutation checks, demo generation
- `docs`: notes, some of them about experimental ideas and marked as such

## How this was built

Most of the code was written with Gemini in Antigravity and reviewed with Claude. What the repo claims is backed by the tests, the mutation checks and the benchmark files above, so check those before trusting any sentence here.

## License

Apache-2.0, see [LICENSE](LICENSE). Contributions are welcome, see [CONTRIBUTING.md](CONTRIBUTING.md).
