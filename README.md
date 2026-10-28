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
  <a href="#-overview">Overview</a> •
  <a href="#-quickstart">Quickstart</a> •
  <a href="#-security--sandbox-architecture">Security & Sandbox</a> •
  <a href="#-test-suite--mutation-verification">Verification & Tests</a> •
  <a href="#-performance--cold-start-latency">Performance</a> •
  <a href="#-frozen-v01-scope--experimental-status">v0.1 Scope & Experimental</a> •
  <a href="SECURITY.md">Security Threat Model</a>
</p>

---

</div>

## 🌌 Overview

**AetherFlow** is an open-source TypeScript runtime focused on a singular, hardened mission: **a verified sandbox + tool-synthesis loop for LLM-generated code**.

When language models synthesize executable code at runtime to solve computational or analytical tasks, executing that code natively presents severe security risks (arbitrary remote code execution, prototype poisoning, network exfiltration, fork bombs, and host resource starvation). AetherFlow solves this with a **fail-closed, defense-in-depth architecture** that inspects, compiles, verifies, and executes LLM-generated tools within strictly hardened Docker containers or sandboxed subprocesses.

### Core Capabilities

* 🛠️ **Dynamic Tool Synthesis (`ToolForge`)**: Autonomous JIT tool synthesis loop: model code generation $\rightarrow$ AST verification $\rightarrow$ sandboxed execution verification $\rightarrow$ live `ToolRegistry` registration.
* 🐳 **Fail-Closed Docker Sandboxing (`Sandbox`)**: Default execution mode enforces container-level isolation with zero host network access, read-only root filesystem, dropped Linux capabilities, non-root user, cgroups memory & pids limits, and asynchronous timeout cleanup.
* 🛡️ **Static AST Pre-Verification (`ASTVerifier`)**: TypeScript Compiler API AST analysis rejecting forbidden identifiers (`process`, `eval`, `Function`), prototype tampering (`__proto__`, `.constructor`), and static infinite loops before code ever reaches an execution environment.
* 🔒 **Isolated Realm & Context Lockdown**: Sandboxed execution runs in an isolated VM context without host prototype contamination. Context globals omit host standard prototypes (`Object`, `Array`, `JSON`), preventing host prototype poisoning attacks.
* 🧬 **Real Mutation Defense Testing**: Automated mutation verification runner (`scripts/verify_mutations.js`) systematically disables each defensive layer and proves that the test suite catches the vulnerability with real test failures.

---

## 🚀 Quickstart

### 1. Prerequisites
- **Node.js**: $\ge$ 20.0.0
- **Docker**: Docker Engine / Docker Desktop (required for default production sandbox mode)

### 2. Installation & Build

```bash
git clone https://github.com/iRuSu67/aether-flow.git
cd aether-flow
npm install
npm run build
```

### 3. Run the Verified Test Suite (57 Tests)

```bash
npm test
```

### 4. Run the Mutation Defense Verification Suite

```bash
# Verify all 7 Docker containment layers
node scripts/verify_mutations.js --mode=docker

# Verify all 6 Subprocess containment layers
node scripts/verify_mutations.js --mode=subprocess
```

### 5. Run the End-to-End Quickstart Demo

```bash
npm run demo
```

---

## 🛡️ Security & Sandbox Architecture

AetherFlow operates on a **fail-closed** security contract:
- The **default and production sandbox mode is `docker`**.
- Subprocess execution without Docker is considered strictly insecure development mode and requires explicit opt-in (`unsafeDevMode: true`); attempting to run subprocess mode without this flag throws an immediate fatal error and logs a loud security warning.

```
                  ┌──────────────────────────────────────────────┐
                  │          LLM-Synthesized Code Payload        │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ Layer 1: Static AST Analysis (ASTVerifier)                                  │
 │   • Rejects eval, Function, import, require, process, __proto__             │
 │   • Rejects computed string concat/template literal constructor access      │
 └───────────────────────────────────────┬─────────────────────────────────────┘
                                         │
                                         ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ Layer 2: Isolated VM Realm & Memory Budget                                  │
 │   • Context globals omit host prototypes (Object, Array, JSON, etc.)        │
 │   • V8 flag: --disallow-code-generation-from-strings                       │
 │   • Strict serialized input/output byte caps (maxOutputBytes)              │
 └───────────────────────────────────────┬─────────────────────────────────────┘
                                         │
                                         ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ Layer 3: OS Container Boundary (Docker Mode - Default)                      │
 │   • --network none                 (Complete zero-trust network airgap)    │
 │   • --read-only                    (Read-only root container filesystem)   │
 │   • --user 1000:1000               (Non-root user: uid 1000, gid 1000)      │
 │   • --cap-drop=ALL                 (Drop all Linux capabilities)           │
 │   • --security-opt no-new-privileges (Prevent setuid escalation)            │
 │   • --pids-limit=64                (Fork-bomb process containment)         │
 │   • --memory=64m --memory-swap=64m (cgroups hard OOM kill enforcement)     │
 │   • Image pinned by SHA256 digest  (node:lts-alpine@sha256:06d7adf3e...)   │
 └───────────────────────────────────────┬─────────────────────────────────────┘
                                         │
                                         ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ Layer 4: Authoritative Asynchronous Lifecycle Management                    │
 │   • Hard host timer terminates runaway executions                          │
 │   • Async container cleanup: docker rm -f <container> without event block  │
 │   • Host-side streaming stdout/stderr caps terminate output flood attacks  │
 └─────────────────────────────────────────────────────────────────────────────┘
```

See [SECURITY.md](SECURITY.md) for the exhaustive threat model, attack vectors, and proof benchmarks.

---

## ⏱️ Performance & Cold-Start Latency

> [!NOTE]
> **Docker Mode Cold-Start Overhead**:
> In default `docker` mode, spinning up an ephemeral container on Windows (WSL2) or Linux imposes a baseline cold-start latency of approximately **~1,000ms – 1,500ms** per execution.
> This overhead stems from container creation, namespace isolation, and Node runtime initialization within the container.
>
> **Future Work**: Implementation of a pre-warmed container pool to reduce execution latency to <50ms while preserving complete single-execution tenant isolation.

Benchmark measurements (`npm run benchmark`):

| Operation | Environment | Measured Latency / Throughput |
| :--- | :--- | :--- |
| **Vector Memory Insert** | In-Memory Cosine Store | ~31,000+ vectors/sec |
| **Vector Memory Query (Top-5)** | In-Memory Cosine Store | ~2.9 ms |
| **GraphRAG Pathfinding (50 Hops)** | In-Memory BFS Multigraph | ~1.2 ms |
| **Firewall Injection Audit** | Heuristic Lexer | ~65,000+ audits/sec |
| **Tool AST Verification** | TypeScript AST Compiler API | ~25 ms |
| **Sandboxed Tool Execution** | Docker Container (`--network none`) | ~1,340 ms (cold-start) |

---

## 🧪 Test Suite & Mutation Verification

The test suite consists of **57 verified automated tests**:
* **10 Microkernel Tests** (`kernel.test.ts`):
  - End-to-end plan generation and JIT tool synthesis via `ToolForge`.
  - Tool execution via `ToolRegistry`.
  - Vector memory embedding and nearest-neighbor search.
  - Relational graph BFS pathfinding.
  - Security firewall PII redaction and injection blocking.
  - Symbolic SAT satisfiability and numerical boundary verification.
  - FlowScript DSL lexer and AST parser.
  - Checkpoint state snapshotting and divergence forking.
* **47 Sandbox Escape & Containment Tests** (`sandbox-escape.test.ts`):
  - 7 static AST syntax checks.
  - 2 known AST bypasses proving runtime containment.
  - 1 fail-closed configuration contract test.
  - 26 parameterized adversarial attack tests evaluated across both `subprocess` and `docker` modes:
    - Prototype constructor chain breakouts (`Function('return process')()`).
    - Arguments constructor breakout (`args.constructor.constructor`).
    - Dynamic code evaluation (`eval()`).
    - Environment leakage (`process.env`).
    - Host secret exfiltration attempts.
    - Filesystem access (`require('fs')`).
    - Outbound network requests (`fetch()`, `net.connect()`).
    - Node internals access (`process.binding()`).
    - Console output flooding attacks.
    - Serialized payload memory explosion.
    - Synchronous CPU infinite loops (`while(true)`).
    - Asynchronous microtask infinite loops.
    - Heap exhaustion memory bombs.
  - 1 VM realm prototype isolation verification.
  - 2 Docker network isolation tests (active TCP listener probe + control probe).
  - 5 Docker container probes (non-root uid, read-only rootfs, 0 capabilities, pids limit, cgroups memory limit).
  - 1 Docker host-side stderr flooding test.
  - 1 Post-timeout container cleanup test (`docker ps -a` check).
  - 1 ArrayBuffer memory bomb analysis (verifying cgroups OOM kill vs. execution timeout).

### Real Mutation Defense Verification

AetherFlow includes a dedicated mutation verification runner (`scripts/verify_mutations.js`) that directly modifies source files, recompiles, and runs the adversarial test suite to prove each layer catches attacks:

* **Docker Mode (7 Layers)**:
  1. Network isolation (`--network none` removed) $\rightarrow$ Caught by `Docker network isolation Test 1`.
  2. Non-root user (`--user` removed) $\rightarrow$ Caught by `Docker probe: container runs as non-root user node`.
  3. Read-only filesystem (`--read-only` removed) $\rightarrow$ Caught by `Docker probe: container filesystem is strictly read-only`.
  4. Capability dropping (`--cap-drop=ALL` removed) $\rightarrow$ Caught by `Docker probe: container Linux capabilities are dropped`.
  5. Process limit (`--pids-limit=64` removed) $\rightarrow$ Caught by `Docker probe: container pids limit is enforced`.
  6. Memory limit (`--memory` & `--memory-swap` removed) $\rightarrow$ Caught by `Docker probe: container memory limit is enforced` and `ArrayBuffer memory bomb analysis`.
  7. Host-side stderr flood cap removed $\rightarrow$ Caught by `[docker] Sandbox output caps...` and `Docker mode host-side stderr flooding...`.

* **Subprocess Mode (6 Layers)**:
  1. AST Verifier bypass $\rightarrow$ Caught by 7 AST verification tests.
  2. VM Context globals leakage (`require`/`fetch` exposed) $\rightarrow$ Caught by filesystem and network tests.
  3. V8 string compilation disallowance removed $\rightarrow$ Caught by 4 prototype breakout and AST bypass tests.
  4. Environment stripping disabled (`env: process.env`) $\rightarrow$ Caught by `Sandbox strips host environment variables`.
  5. Authoritative timeout kill disabled $\rightarrow$ Caught by `Sandbox hard timeout terminates asynchronous microtask loop`.
  6. Output byte caps disabled $\rightarrow$ Caught by output flooding and max result size tests.

---

## 📦 Frozen v0.1 Scope & Experimental Status

In v0.1, the core architecture is **strictly frozen** to the verified sandbox and tool-synthesis loop. Non-core exploratory prototypes have been moved to `packages/core/src/experimental/` and decoupled from `AetherKernel`:

| Subsystem | Status in v0.1 | Location |
| :--- | :---: | :--- |
| **Sandbox Execution (`Sandbox`)** | 🟢 **Core v0.1** | `packages/core/src/tools/Sandbox.ts` |
| **JIT Tool Synthesis (`ToolForge`)** | 🟢 **Core v0.1** | `packages/core/src/tools/ToolForge.ts` |
| **AST Verification (`ASTVerifier`)** | 🟢 **Core v0.1** | `packages/core/src/tools/ASTVerifier.ts` |
| **Aether Microkernel (`AetherKernel`)** | 🟢 **Core v0.1** | `packages/core/src/kernel/AetherKernel.ts` |
| **Model Providers (`Mock`, `Gemini`, `OpenAI`)** | 🟢 **Core v0.1** | `packages/core/src/providers/` |
| **Vector Memory & Knowledge Graph** | 🟢 **Core v0.1** | `packages/core/src/memory/` |
| **Security Firewall & SAT Solver** | 🟢 **Core v0.1** | `packages/core/src/guardrails/`, `formal/` |
| **Browser Agent (`BrowserAgent`)** | 🟡 **Quarantined** | `packages/core/src/experimental/BrowserAgent.ts` |
| **Vision Perception (`VisionPerception`)** | 🟡 **Quarantined** | `packages/core/src/experimental/VisionPerception.ts` |
| **Audio Perception (`AudioPerception`)** | 🟡 **Quarantined** | `packages/core/src/experimental/AudioPerception.ts` |
| **Voice Kernel (`VoiceKernel`)** | 🟡 **Quarantined** | `packages/core/src/experimental/VoiceKernel.ts` |
| **Cluster Node (`ClusterNode`)** | 🟡 **Quarantined** | `packages/core/src/experimental/ClusterNode.ts` |
| **CRDT Store (`CRDTStore`)** | 🟡 **Quarantined** | `packages/core/src/experimental/CRDTStore.ts` |
| **Genetic Optimizer (`GeneticOptimizer`)** | 🟡 **Quarantined** | `packages/core/src/experimental/GeneticOptimizer.ts` |
| **Arena Judge (`ArenaJudge`)** | 🟡 **Quarantined** | `packages/core/src/experimental/ArenaJudge.ts` |
| **MCTS Reasoning (`MCTSEngine`)** | 🟡 **Quarantined** | `packages/core/src/experimental/MCTSEngine.ts` |
| **Speculative Swarm (`SpeculativeEngine`)** | 🟡 **Quarantined** | `packages/core/src/experimental/SpeculativeEngine.ts` |
| **Hegelian Consensus (`HegelianEngine`)** | 🟡 **Quarantined** | `packages/core/src/experimental/HegelianEngine.ts` |

---

## 📄 License

Distributed under the **Apache-2.0 License**. See [LICENSE](LICENSE) for details.
