<div align="center">

```
   ___        __  __              _____ _                 
  / _ \____  / /_/ /_  ___  _____/ __/ (_)___ _    __     
 / ___/ __ \/ __/ __ \/ _ \/ ___/ /_ / / __ \ | /| / /     
/_/  /_/ /_/\__/_/ /_/\___/_/  /_/  /_/\___/ |/ |/        
```

# AetherFlow v0.1

### Verified Sandbox + Dynamic Tool Synthesis Loop for LLM-Generated Code
**Fail-Closed Container Isolation • Static AST Verification • JIT Tool Synthesis • Defense-in-Depth**

[![CI Status](https://github.com/iRuSu67/aether-flow/actions/workflows/ci.yml/badge.svg)](https://github.com/iRuSu67/aether-flow/actions)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=for-the-badge)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Isolated_Container-2496ED?style=for-the-badge&logo=docker)](SECURITY.md)
[![Security](https://img.shields.io/badge/Security-Fail--Closed_Hardened-success?style=for-the-badge)](SECURITY.md)

<p align="center">
  <a href="#-the-pitch">The Pitch</a> •
  <a href="#-feature-matrix">Feature Matrix</a> •
  <a href="#-5-minute-quickstart">5-Min Quickstart</a> •
  <a href="#-docker-vs-developer-mode">Docker vs Dev Mode</a> •
  <a href="#-empirical-evaluation-results">Empirical Evaluation</a> •
  <a href="#-security-architecture">Security Summary</a> •
  <a href="#-known-limitations">Limitations</a> •
  <a href="SECURITY.md">Security Threat Model</a>
</p>

---

<p align="center">
  <img src="docs/demo.svg" alt="AetherFlow Demo Replay" width="100%">
  <br>
  <em>Replay of a real run against gemini-3.5-flash-lite (recorded in docs/demo-output.txt)</em>
</p>

---

</div>

## 💡 The Pitch

When LLMs solve complex mathematical, analytical, or algorithmic problems, they face trade-offs across common execution paradigms:
1. **Direct Generation (Zero-Shot)**: Models frequently hallucinate intermediate states, struggle with combinatorial sequence alignment ($O(MN)$ Levenshtein dynamic programming), and consume large token budgets generating calculations in natural language.
2. **Fixed Static Palettes (ReAct / Function Calling)**: Frameworks force models into predefined tool sets (`math_calc`, `regex_match`). When an unpredicted algorithm is needed (e.g. Dijkstra turn penalties or 2D matrix pivoting), simple palettes cannot fulfill the task, leading to multi-turn failure loops.
3. **Remote Cloud MicroVMs**: Running untrusted code in external cloud sandboxes incurs network latency roundtrips, recurring subscription costs, and vendor dependency for private code and sensitive data.

**AetherFlow is a local, fail-closed TypeScript microkernel and sandboxed runtime that empowers LLMs to synthesize custom tools Just-In-Time (JIT) and execute them safely.**

AetherFlow bridges the gap with a closed feedback loop:
- **Synthesize on Demand**: The model writes a specialized, single-file JavaScript/TypeScript function tailored to the exact problem.
- **Static AST Linter**: High-speed TypeScript AST analysis rejects dangerous identifiers (`eval`, `process`, `Function`, `__proto__`, dynamic imports) in **~20ms** before code ever runs. Benign loops with reachable `break` or `return` statements are permitted.
- **Fail-Closed Docker Sandboxing**: The synthesized tool executes inside an isolated, airgapped ephemeral Docker container (`--network none`, `--read-only`, non-root user, dropped capabilities, strict cgroups RAM/PID limits).
- **Self-Healing Synthesis Loop**: If execution fails or times out in the sandbox, the diagnostic is fed back to the model to self-correct.
- **Semantic Library Reuse**: Verified tools are indexed by task description; similar subsequent tasks reuse existing tools at **0 model tokens** and **~2.4s latency**.

---

## 📊 Feature Matrix

Honest architectural comparison across execution paradigms:

| Capability / Dimension | Direct Generation | ReAct / Fixed Palette (Weak Baseline) | Cloud MicroVM Sandbox | AetherFlow v0.1 |
| :--- | :---: | :---: | :---: | :---: |
| **Arbitrary Algorithmic Execution** | ❌ (Prone to combinatorial loop hallucination) | ❌ (Restricted to predefined tool palette) | ✔ (Full VM runtime environment) | ✔ (JIT-synthesized ES modules) |
| **Execution Isolation Boundary** | None (Text generation only) | Host Process or App Sandbox | Cloud MicroVM (Tenant VM boundary) | Fail-Closed Local Docker Container |
| **Network Airgap Enforcement** | Dependent on host process | Dependent on host process | Network policy dependent | ✔ Strict `--network none` default |
| **Static AST Pre-Verification** | N/A | Rare / Simple regex | ❌ (Direct execution) | ✔ TypeScript AST Compiler API (~20ms) |
| **Self-Healing Compiler/Runtime Loop**| ❌ | ❌ | Application-level logic | ✔ Built-in iterative retry & feedback |
| **Dynamic Semantic Tool Reuse** | ❌ | ❌ (Manual configuration) | ❌ | ✔ Description-keyed `ToolLibrary` (0 tokens) |
| **Data Privacy & Airgap** | Host process dependent | Host process dependent | Cloud infrastructure dependent | ✔ Local container airgap (`--network none`) |
| **Execution Cost** | Model tokens only | High (Multi-turn tool chatter) | SaaS / Cloud compute fees + tokens | $0 Host compute + 0-token tool reuse |
| **Cold-Start Latency** | **~0 ms** | **~0 ms** | Provider network dependent | ~1,000–1,300 ms (Ephemeral Docker init) |

### Component Maturity in v0.1

| Component | Package / Path | Status in v0.1 | Verified Scope |
| :--- | :--- | :---: | :--- |
| **Core Microkernel & Docker Sandbox** | `@aether-flow/core` | 🟢 **Production Verified** | Fail-closed network airgap, cgroups, capability dropping verified by 9 mutation tests |
| **Static AST Security Linter** | `ASTVerifier` | 🟢 **Production Verified** | AST analysis blocking dangerous identifiers and loops without exits in ~20ms |
| **JIT Dynamic Tool Synthesis** | `ToolForge` / `examples/02` | 🟢 **Production Verified** | Self-healing tool generation loop verified offline (MockProvider) and live |
| **Evaluation Benchmark Harness** | `@aether-flow/eval` | 🟢 **Production Verified** | 15 algorithmic benchmark tasks across 5 domains with N=3 repetitions |
| **CLI Runner** | `@aether-flow/cli` | 🟢 **Production Verified** | Production CLI commands (`aether run`, `aether eval`) |
| **Visual Canvas Web UI** | `@aether-flow/web` | 🟡 **Experimental Prototype** | Local visual dashboard and WebSocket server; not covered by core guarantees |
| **Python SDK Client** | `packages/python-sdk` | 🟡 **Experimental Prototype** | Lightweight REST client wrapper for Python environments |
| **Cognitive Swarm Modules** | `packages/core/src/experimental` | 🟡 **Research Prototypes** | Speculative prototypes (Hegelian consensus, MCTS, CRDT, FlowScript DSL) |

---

## ⚡ 5-Minute Quickstart

### 1. Prerequisites
- **Node.js**: $\ge$ 20.0.0
- **Docker**: Docker Engine or Docker Desktop running locally

### 2. Installation & Verification
```bash
# Clone the repository
git clone https://github.com/iRuSu67/aether-flow.git
cd aether-flow

# Clean install dependencies and build monorepo packages
npm ci
npm run build

# Run the 58 automated unit and security tests
npm test
```

### 3. Run the Interactive Demo
Experience the complete lifecycle: missing tool detection $\rightarrow$ JIT synthesis $\rightarrow$ sandbox runtime failure $\rightarrow$ self-healing feedback $\rightarrow$ verification $\rightarrow$ library registration $\rightarrow$ instant 0-token reuse:
```bash
npm run demo
```

### 4. Programmatic API Usage
```typescript
import { Sandbox, ASTVerifier } from '@aether-flow/core';

// 1. Initialize fail-closed Docker sandbox
const sandbox = new Sandbox({
  mode: 'docker',         // Production default: isolated Docker container
  timeoutMs: 5000,        // Authoritative kill timer
  maxMemoryMb: 64,        // 64MB cgroups limit
  maxOutputBytes: 1024 * 64,
});

// 2. Synthesize or inspect dynamic tool code
const toolCode = `
  export default async function execute(args) {
    // Pure algorithmic calculation without host access
    return args.numbers.reduce((acc, n) => acc + n * 2, 0);
  }
`;

// 3. Static AST Pre-Check
const astVerifier = new ASTVerifier();
const astReport = astVerifier.verify(toolCode);
if (!astReport.isSafe) {
  throw new Error(`Security violation: ${astReport.bannedPatternsDetected.join(', ')}`);
}

// 4. Execute safely in Docker container
const result = await sandbox.execute(toolCode, { numbers: [1, 2, 3, 4, 5] });
console.log('Execution result:', result);
// Output: { success: true, result: 30, logs: [], executionTimeMs: 1240 }
```

---

## 🔒 Docker vs. Developer Mode

AetherFlow enforces a **fail-closed security contract**:

| Execution Mode | Isolation Mechanism | Use Case | Security Level |
| :--- | :--- | :--- | :---: |
| **`mode: 'docker'`** *(Default)* | Linux container with `--network none`, `--read-only`, `--user 1000:1000`, `--cap-drop=ALL`, `--pids-limit=64`, `--memory=64m` | Production / Untrusted Code | 🟢 **Hardened Boundary** |
| **`mode: 'subprocess'`** *(Dev Only)* | Spawned Node process with empty environment (`env: {}`), V8 `--disallow-code-generation-from-strings`, and isolated VM realm | Local Offline Dev (Docker unavailable) | 🟡 **Insecure Dev Mode** |

> [!CAUTION]
> **Subprocess Mode Requires Explicit Opt-In**:
> Node.js child processes cannot isolate host network sockets or prevent local loopback access without kernel namespaces.
> Attempting to instantiate `mode: 'subprocess'` without setting `{ unsafeDevMode: true }` will throw an **immediate fatal error**. In dev mode, a prominent security warning is logged to `stderr`.

---

## 🔬 Empirical Evaluation Results

AetherFlow was benchmarked using [Google Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) across **15 benchmark tasks** in **5 algorithmic domains** with $N=3$ repetitions per task (225 total runs).

- **Full Results File**: [`eval_results_gemini-3_5-flash-lite.json`](eval_results_gemini-3_5-flash-lite.json)
- **Dated Results File**: [`eval/results/2026-10-30.json`](eval/results/2026-10-30.json)
- **Design Specification**: [`EVAL_DESIGN.md`](EVAL_DESIGN.md)

### Per-Condition Performance ($N=45$ runs per condition across 15 tasks)

| Condition | Description | Pass Rate (95% Wilson CI) | Mean Latency | Mean Total Tokens | Thinking Tokens | Output Tokens |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Condition A** | Direct Zero-Shot Generation (JSON) | 80.0% [66.2%, 89.1%] | 4,927 ms | 2,467 | 1,797 | 206 |
| **Condition B** | Fixed Tool Palette (`math_calc`, `regex_match`, etc.) | 75.6% [61.3%, 85.8%] | 8,146 ms | 3,291 | 2,468 | 176 |
| **Condition C0** | One-Shot JIT Code Synthesis (No Feedback) | 86.7% [73.8%, 93.7%] | 6,390 ms | 1,659 | 504 | 646 |
| **Condition C** | JIT Code Synthesis + Self-Healing Feedback Loop | **91.1%** [79.3%, 96.5%] | 6,645 ms | 1,880 | 588 | 726 |
| **Condition D** | JIT Code Synthesis + Semantic `ToolLibrary` Reuse | **91.1%** [79.3%, 96.5%] | *Not Comparable*¹ | *Not Comparable*¹ | **301** | **406** |

> ¹ **Condition D Cache Accounting Caveat**: In the evaluation run, Condition D executed with the response cache active. On library misses (24 runs), D fell back to Condition C synthesis and retrieved cached code in ~2ms (zero API latency recorded). D's recorded latency (2,398 ms) and tokens (965) reflect this free cached synthesis and are not directly comparable to Conditions A–C. When reconstructed offline by substituting Condition C's original API latency for synthesis misses, D's estimated mean latency is 5,421 ms (vs C's 6,645 ms). Additionally, Condition D's accuracy on first variants (`variant a`) was served directly from Condition C's cached output and does not represent independent evidence versus Condition C.

### Per-Task Breakdown (Passes out of 3 runs)

| Task ID | Family Domain | Condition A | Condition B | Condition C0 | Condition C | Condition D | Notes |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `task_1a_markdown_employees` | Markdown Table Parsing | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | C0 failed 1x on timeout |
| `task_1b_markdown_servers` | Markdown Table Parsing | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | Baseline A passes easily |
| `task_1c_markdown_transactions` | Markdown Table Parsing | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | Baseline A passes easily |
| `task_2a_levenshtein_dna` | Sequence Alignment | 0/3 | 0/3 | 0/3 | 0/3 | 0/3 | Prompt/checker schema conflict |
| `task_2b_levenshtein_tokens` | Sequence Alignment | **0/3** | **0/3** | **3/3** | **3/3** | **3/3** | **Strong separator** |
| `task_2c_levenshtein_sentences` | Sequence Alignment | **0/3** | **0/3** | **3/3** | **2/3** | **2/3** | **Strong separator** |
| `task_3a_dijkstra_city` | Turn-Penalty Dijkstra | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | Baseline A passes easily |
| `task_3b_dijkstra_circuit` | Turn-Penalty Dijkstra | 3/3 | 2/3 | 1/3 | 3/3 | 3/3 | C0 failed 2x (timeout/policy) |
| `task_3c_dijkstra_warehouse` | Turn-Penalty Dijkstra | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | Baseline A passes easily |
| `task_4a_csv_sales` | CSV 2D Pivot Aggregation | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | Baseline A passes easily |
| `task_4b_csv_telemetry` | CSV 2D Pivot Aggregation | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | Baseline A passes easily |
| `task_4c_csv_grades` | CSV 2D Pivot Aggregation | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | Baseline A passes easily |
| `task_5a_knapsack_cargo` | 0/1 Dual Knapsack | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 | B failed 1x on tool exhaustion |
| `task_5b_knapsack_payload` | 0/1 Dual Knapsack | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | Baseline A passes easily |
| `task_5c_knapsack_cloud` | 0/1 Dual Knapsack | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | Baseline A passes easily |

### Where It Helps (and Where It Doesn't)

- **Baseline A Passes 11 of 15 Tasks (3/3)**: Direct zero-shot generation (Condition A) already passes **11 of 15 tasks 3/3** (and 2/3 on `task_3b`). For Markdown table parsing, Dijkstra pathfinding on small grids, 2D CSV pivot summaries, and 0/1 dual knapsack optimization, `gemini-3.5-flash-lite` solves the problems directly in-context without needing external code execution.
- **Concentration of Gain**: The observed accuracy gain from JIT code synthesis is concentrated almost entirely in the **sequence-alignment family** (`task_2b_levenshtein_tokens` and `task_2c_levenshtein_sentences`). Direct generation failed completely (0/3) due to combinatorial state tracking errors in natural language generation, while synthesized code execution (C0, C, D) succeeded (3/3 and 2/3) by executing dynamic programming loops in the sandbox.
- **DNA Alignment Failure Across All Conditions**: `task_2a_levenshtein_dna` failed in 0/3 runs across *all* conditions (A, B, C0, C, D). A post-run analysis identified an ambiguity and schema mismatch: the prompt example provided `{ op: 'substitute', char: 'C', replaceWith: 'B' }`, whereas the checker strictly inspected `step.char` as the replacement target character (`reconstructed += step.char`). Models following the prompt example format could not satisfy the checker's string reconstruction assertion.
- **C vs C0 Difference is Within Noise**: Condition C achieved 41/45 passes versus 39/45 for Condition C0. This absolute difference of **+2 passes out of 45 runs** is well within binomial noise and does not provide statistically distinguishing evidence of self-healing multi-turn feedback on this benchmark.
- **Failure 3 Attribution (AST False Rejection)**: In `task_3b_dijkstra_circuit`, Condition C0 scored 1/3 due to an AST false rejection: the model synthesized an optimal binary heap priority queue (`MinPriorityQueue`) containing a standard `while (true)` loop with an interior `else { break; }`. The AST verifier naively blocked it as `POLICY_BLOCKED`. Under Condition C, diagnostic feedback allowed the model to work around the linter. The AST verifier has since been updated with `hasReachableLoopExit` to permit loops with reachable `break` or `return` exits.

### Honest Analysis & Statistical Nuance

1. **Observed Pass Rate Differences (C vs A)**:
   - Condition C achieved **41/45 passes** (91.1%) vs Condition A's **36/45 passes** (80.0%).
   - This represents an absolute difference of **5 extra passes out of 45 runs**.
   - With 95% Wilson confidence intervals of **[79.3%, 96.5%] for C** and **[66.2%, 89.1%] for A**, these intervals overlap.
   - Furthermore, because the 45 runs per condition represent 15 tasks evaluated across 3 repetitions rather than 45 independent tasks, true statistical uncertainty is wider than standard binomial intervals indicate.
2. **Task Separability**:
   - 11 of the 15 tasks are solved 3/3 by direct generation alone. The benchmark only separates conditions on combinatorial string alignment where in-context mental simulation fails.
3. **Condition D Reuse Performance & Caveats**:
   - Across eligible variants (b & c), Condition D achieved a **70.0% Reuse Hit Rate** (21/30) with **100.0% Reuse Precision** (21/21 hits passed and executed successfully at 0 model tokens).
   - *Cache Accounting Caveat*: Latency and token figures for Condition D are not directly comparable because cached synthesis fallbacks were recorded with ~2ms cache lookup time rather than original API latency. Accuracy on first variants (a) was served from C's cached output and is not independent evidence versus C.
   - *Constraint*: Tool reuse depends on task variants within a family sharing input schemas and semantic objectives. In heterogeneous environments, reuse rates will naturally be lower.
4. **Baseline B is a Simple Palette**:
   - Condition B (75.6%) provided 5 basic utility tools (`math_calc`, `regex_match`, `json_path`, `string_slice`, `array_sort`). Because these tools cannot perform dynamic programming, Condition B functioned as a weak baseline for algorithmic tasks.
5. **Lightweight Model Scope**:
   - All results reflect a single lightweight model (`gemini-3.5-flash-lite`) over 15 tasks. They provide suggestive evidence for lightweight models rather than universal claims across 1T+ parameter frontier architectures.

---

## 🛡️ Security Architecture

AetherFlow operates a 4-layer defense-in-depth model verified by real mutation testing:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 1: Static AST Analysis (ASTVerifier)                                  │
│   • Rejects eval, Function, import, require, process, __proto__             │
│   • Rejects template literal & string concatenation property obfuscations   │
│   • Permits benign while(true) loops containing reachable break/return      │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 2: Isolated VM Realm & Engine Flags (sandbox-runner.ts)               │
│   • Context globals omit host standard prototypes (Object, Array, JSON)     │
│   • V8 flag: --disallow-code-generation-from-strings                        │
│   • Max output byte caps on stdout/stderr prevent pipe flooding             │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 3: OS Container Boundary (Docker Mode - Default)                      │
│   • --network none                 (Complete zero-trust network airgap)     │
│   • --read-only                    (Read-only root container filesystem)    │
│   • --user 1000:1000               (Non-root user node)                     │
│   • --cap-drop=ALL                 (Drop all Linux kernel capabilities)     │
│   • --security-opt no-new-privileges (Prevent privilege escalation)         │
│   • --pids-limit=64                (Fork-bomb process containment)          │
│   • --memory=64m --memory-swap=64m (Hard cgroups OOM kill enforcement)      │
│   • Pinned image digest            (node:lts-alpine@sha256:06d7adf3e...)    │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 4: Authoritative Asynchronous Lifecycle Management                    │
│   • Host timer terminates runaway microtask loops & CPU starvation          │
│   • Ephemeral container destruction (docker rm -f on abnormal exit)         │
│   • Host-side streaming output caps terminate stdout/stderr flood attacks   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Mutation Defense Verification Suite

Each defensive layer is verified by systematically disabling it and verifying that the test suite catches the vulnerability:

```bash
# Verify all 9 Docker containment layers
node scripts/verify_mutations.js --mode=docker

# Verify all 6 Subprocess containment layers
node scripts/verify_mutations.js --mode=subprocess
```

| Mutation Layer Tested | Mutation Injected | Real Tests That Caught It |
| :--- | :--- | :---: |
| **Docker Layer 1: Network** | Remove `--network none` | `Docker network isolation Test 1` |
| **Docker Layer 2: Non-Root** | Remove `--user node` | `Docker probe: container runs as non-root user node` |
| **Docker Layer 3: Read-Only** | Remove `--read-only` | `Docker probe: container filesystem is strictly read-only` |
| **Docker Layer 4: Capabilities** | Remove `--cap-drop=ALL` | `Docker probe: container Linux capabilities are dropped` |
| **Docker Layer 5: PIDs Limit** | Remove `--pids-limit=64` | `Docker probe: container pids limit is enforced` |
| **Docker Layer 6: Memory** | Remove `--memory=64m` | `Docker probe: container memory limit is enforced` |
| **Docker Layer 7: Stderr Cap** | Remove host stderr cap | `[docker] Sandbox output caps terminate execution...` |
| **Docker Layer 8: Context Lockdown** | Expose `require()` & `fetch()` | `[docker] Sandbox blocks filesystem read / network` |
| **Docker Layer 9: V8 Engine Flags** | Remove string compilation flag | `[docker] Sandbox blocks prototype constructor chain` |

See [SECURITY.md](SECURITY.md) for full attack vectors, threat analysis, and proof benchmarks.

---

## ⚠️ Known Limitations

1. **Benchmark Task Separability (11 of 15 Solved Direct)**:
   - 11 of 15 benchmark tasks are solved 3/3 by direct zero-shot generation without requiring external execution. The benchmark does not adequately separate conditions on straightforward algorithmic or structured text parsing tasks.
   - *Next Step (Harder Tasks)*: Future benchmark iterations must expand to tasks requiring dynamic graph state search, large-scale constraint optimization, and deeper multi-step reasoning where direct in-context generation consistently fails.
2. **C vs C0 Difference Within Noise**:
   - The absolute difference of +2 passes (41/45 for C vs 39/45 for C0) is within binomial noise. The benchmark does not provide statistically distinguishing evidence for multi-turn feedback on these tasks.
3. **DNA Alignment Contract Conflict**:
   - `task_2a_levenshtein_dna` failed in 0/3 runs across all conditions due to a schema mismatch between the prompt example format (`{ op: 'substitute', char: 'C', replaceWith: 'B' }`) and the checker's string reconstruction assertion.
4. **Condition D Amortization Depends on Shared Schemas**:
   - Reusing synthesized tools requires task variants within a family to share input structures and semantic objectives. In heterogeneous environments, reuse rates will naturally be lower.
5. **Docker Cold-Start Overhead (~1,000–1,300ms)**:
   - Starting an ephemeral container on Windows (WSL2) or Linux imposes a baseline cold-start latency of approximately ~1,000ms – 1,300ms per execution.
   - *Roadmap*: Pre-warmed container pooling to achieve <50ms execution latency while preserving complete per-execution tenant isolation.
6. **Single Lightweight Model Scope**:
   - Evaluation was conducted on a single lightweight model (`gemini-3.5-flash-lite`) across 15 tasks. Results are **suggestive, not universal** across 1T+ parameter frontier models on arbitrary production codebases.
7. **Single-Node Execution in v0.1**:
   - The frozen v0.1 scope targets single-node local environments. Multi-node cluster orchestration and distributed memory synchronization remain experimental prototypes in `packages/core/src/experimental/`.
8. **Synchronous Payload Serialization**:
   - Input arguments and execution return values are serialized as JSON over standard I/O pipes. Massive binary payloads or non-serializable objects (e.g. circular references, DOM handles) are not supported.

---

## 📄 License & Contributing

Distributed under the **Apache-2.0 License**. See [LICENSE](LICENSE) for details.
Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and PR guidelines.
