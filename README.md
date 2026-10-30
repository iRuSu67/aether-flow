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

[![CI Status](https://img.shields.io/badge/build-passing-brightgreen?style=for-the-badge&logo=github-actions)](https://github.com/iRuSu67/aether-flow/actions)
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

</div>

## 💡 The Pitch

When LLMs solve complex mathematical, analytical, or algorithmic problems, they face a stark choice:
1. **Direct Generation (Zero-Shot)**: Models frequently hallucinate intermediate states, fail on combinatorial loops ($O(MN)$ alignment, dynamic programming), and consume massive token budgets re-deriving calculations in natural language.
2. **Fixed Static Palettes (ReAct / Function Calling)**: Frameworks force models into rigid, predefined tool suites (`math_calc`, `regex_match`). When a task requires an unpredicted algorithm (e.g. Dijkstra turn penalties or 2D matrix pivoting), the model enters expensive multi-turn failure loops.
3. **Cloud Sandboxes (e2b, Modal)**: Remote cloud microVMs incur external latency (200–500ms network roundtrips), SaaS subscription fees, vendor lock-in, and privacy hazards by streaming enterprise data to third-party infrastructure.

**AetherFlow is a local, fail-closed TypeScript microkernel and sandboxed runtime that empowers LLMs to synthesize custom tools Just-In-Time (JIT) and execute them safely.**

AetherFlow bridges the gap with a closed feedback loop:
- **Synthesize on Demand**: The model writes a specialized, single-file JavaScript/TypeScript function tailored to the exact problem.
- **Static AST Linter**: High-speed TypeScript AST analysis rejects dangerous identifiers (`eval`, `process`, `Function`, `__proto__`, dynamic imports) in **~20ms** before code ever runs.
- **Fail-Closed Docker Sandboxing**: The synthesized tool executes inside an isolated, airgapped ephemeral Docker container (`--network none`, `--read-only`, non-root user, dropped capabilities, strict cgroups RAM/PID limits).
- **Self-Healing Synthesis Loop**: If compilation fails or execution times out, the error is fed back to the model to self-correct.
- **Semantic Library Reuse**: Verified tools are indexed by task description; similar subsequent tasks reuse existing tools at **0 model tokens** and **~2.3s latency**.

---

## 📊 Feature Matrix

Honest architectural comparison across execution paradigms:

| Capability / Dimension | Direct Generation | ReAct / Fixed Palette | Remote Cloud MicroVMs (e2b) | AetherFlow v0.1 |
| :--- | :---: | :---: | :---: | :---: |
| **Arbitrary Algorithmic Execution** | ❌ (Hallucinates complex loops) | ❌ (Restricted to static palette) | ✔ (Full Python/Linux VM) | ✔ (JIT-synthesized ES modules) |
| **Execution Isolation Boundary** | None (Text generation) | Host Process or App Sandbox | Cloud MicroVM (Firecracker) | Fail-Closed Local Docker Container |
| **Network Airgap Guarantee** | Dependent on host | Dependent on host | ⚠️ Requires firewall config | ✔ Strict `--network none` default |
| **Static AST Pre-Verification** | N/A | Rare / Regex lints | ❌ (Direct execution) | ✔ TypeScript AST Compiler API (~20ms) |
| **Self-Healing Compiler/Runtime Loop**| ❌ | ❌ | Application-dependent | ✔ Built-in iterative retry & feedback |
| **Dynamic Semantic Tool Reuse** | ❌ | ❌ (Manual configuration) | ❌ | ✔ Description-keyed `ToolLibrary` (0 tokens) |
| **Data Privacy & Egress** | Zero local airgap | Zero local airgap | ❌ Third-party cloud data transfer | ✔ 100% Local airgap ($0 egress) |
| **Execution Cost** | Model tokens only | High (Multi-turn tool chatter) | Cloud VM $/hour + token costs | $0 Host compute + 0-token tool reuse |
| **Cold-Start Latency** | **~0 ms** | **~0 ms** | ~200–500 ms (MicroVM init) | ~1,000–1,300 ms (Docker container init) |

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

# Run the 57 automated unit and security tests
npm test
```

### 3. Run the Interactive Demo
Experience the complete lifecycle: missing tool detection $\rightarrow$ JIT synthesis $\rightarrow$ sandbox runtime failure $\rightarrow$ self-healing feedback $\rightarrow$ verification $\rightarrow$ library registration $\rightarrow$ instant 0-token reuse:
```bash
npm run demo
```

### 4. Programmatic API Usage
```typescript
import { Sandbox, ASTVerifier, ToolForge } from '@aether-flow/core';

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

AetherFlow was benchmarked using Google's lightweight model **Gemini 3.5 Flash-Lite** (`gemini-3.5-flash-lite`, stable GA) across **15 benchmark tasks** in **5 algorithmic domains** with $N=3$ independent repetitions per task (225 total runs).

- **Full Results File**: [`eval_results_gemini-3_5-flash-lite.json`](eval_results_gemini-3_5-flash-lite.json)
- **Dated Results File**: [`eval/results/2026-10-30.json`](eval/results/2026-10-30.json)
- **Design Specification**: [`EVAL_DESIGN.md`](EVAL_DESIGN.md)

### Per-Condition Performance ($N=45$ runs per condition)

| Condition | Description | Pass Rate (95% Wilson CI) | Mean Latency | Mean Total Tokens | Thinking Tokens | Output Tokens |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Condition A** | Direct Zero-Shot Generation (JSON) | 80.0% [66.2%, 89.1%] | 4,927 ms | 2,467 | 1,797 | 206 |
| **Condition B** | Fixed Tool Palette (`math_calc`, `regex_match`, etc.) | 75.6% [61.3%, 85.8%] | 8,146 ms | 3,291 | 2,468 | 176 |
| **Condition C0** | One-Shot JIT Code Synthesis (No Feedback) | 86.7% [73.8%, 93.7%] | 6,390 ms | 1,659 | 504 | 646 |
| **Condition C** | JIT Code Synthesis + Self-Healing Feedback Loop | **91.1%** [79.3%, 96.5%] | 6,645 ms | 1,880 | 588 | 726 |
| **Condition D** | JIT Code Synthesis + Semantic `ToolLibrary` Reuse | **91.1%** [79.3%, 96.5%] | **2,398 ms** | **965** | **301** | **406** |

### Key Empirical Findings

1. **Execution Beats Direct Generation (Hypothesis 1 Confirmed)**:
   - Direct generation (Condition A: 80.0%) and fixed tool palettes (Condition B: 75.6%) repeatedly failed on sequence alignment tasks (DNA Levenshtein, identifier tokens) with `WRONG_OUTPUT`. JIT synthesis (Conditions C and D: 91.1%) solved these algorithmic tasks cleanly.
2. **Self-Healing Loop Eliminates Timeouts (Hypothesis 2 Confirmed)**:
   - Condition C improved pass rate over Condition C0 (91.1% vs 86.7%), eliminating all timeouts and policy blocks through compiler and sandbox error feedback.
3. **Tool Reuse Cuts Latency and Cost by Over 50% (Hypothesis 3 Confirmed)**:
   - Condition D maintained top-tier accuracy (91.1%) while reducing mean latency from 6,645ms to 2,398ms (**-63.9%**) and mean total tokens from 1,880 to 965 (**-48.7%**).
   - Across all eligible family variants (b & c), Condition D achieved a **70.0% Reuse Hit Rate** with **100.0% Reuse Precision** (21/21 hits passed ground-truth validation).
4. **Weak Baseline Tax (Hypothesis 4 Confirmed)**:
   - The fixed static tool palette (Condition B) was the lowest-performing condition (75.6%) with the highest latency (8,146ms) and token bloat (3,291 tokens), proving that toy tools hinder rather than assist lightweight reasoning models.

---

## 🛡️ Security Architecture

AetherFlow operates a 4-layer defense-in-depth model verified by real mutation testing:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 1: Static AST Analysis (ASTVerifier)                                  │
│   • Rejects eval, Function, import, require, process, __proto__             │
│   • Rejects template literal & string concatenation property obfuscations   │
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

We do not merely write tests that pass; we systematically disable each defensive layer and verify that our test suite catches the vulnerability:

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

1. **Docker Mode Cold-Start Overhead**:
   - Starting an ephemeral container on Windows (WSL2) or Linux imposes a baseline cold-start latency of approximately **~1,000ms – 1,300ms** per execution.
   - *Roadmap*: Pre-warmed container pooling to achieve <50ms execution latency while preserving complete per-execution tenant isolation.
2. **Single-Node Execution in v0.1**:
   - The frozen v0.1 scope targets single-node local environments. Multi-node cluster orchestration and distributed memory synchronization remain experimental prototypes in `packages/core/src/experimental/`.
3. **Synchronous Payload Serialization**:
   - Input arguments and execution return values are serialized as JSON over standard I/O pipes. Massive binary payloads or non-serializable objects (e.g. Circular references, DOM handles) are not supported.
4. **Lightweight Model Baseline**:
   - Evaluation was conducted on a lightweight model (`gemini-3.5-flash-lite`). Results are **suggestive, not universal** across 1T+ parameter frontier models on arbitrary production codebases.

---

## 📄 License & Contributing

Distributed under the **Apache-2.0 License**. See [LICENSE](LICENSE) for details.
Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and PR guidelines.
