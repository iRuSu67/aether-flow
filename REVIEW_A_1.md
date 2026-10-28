# Checkpoint A Verification Report: Part 1

This review report documents the completion of **Checkpoint A** for AetherFlow v0.1: Sandbox Hardening, Defense-in-Depth Verification, Monorepo Scope Cut, and CI Pipeline.

- **Part 1 (This File)**: Sections 1 (Summary), 2 (Raw Test Output), 3 (Mutation Results), 4 (Docker Proof), 6 (Git Diff & File List), and 7 (Still Unverified).
- **Part 2 (`REVIEW_A_2.md`)**: Full Source of `Sandbox.ts`, `ASTVerifier.ts`, `subprocess-runner.ts`, `docker-runner.cjs`, and `.github/workflows/ci.yml`.
- **Part 3 (`REVIEW_A_3.md`)**: Full Source of `sandbox-escape.test.ts` and `scripts/verify_mutations.js`.

---

## 1. SUMMARY

1. **Docker Layer 6 Fixed**: Mutation runner removes both `--memory=` and `--memory-swap=`; Docker daemon no longer rejects the flag list, isolating failures strictly to memory tests.
2. **Adversarial Suite Parameterized**: All 13 escape attacks run in both `[subprocess]` and `[docker]` modes (26 parameterized tests, 57 tests total).
3. **Flaky & Coupled Tests Resolved**: Test timeouts decoupled from WSL2 cold boot jitter (8000ms window); ArrayBuffer memory bomb asserts explicit cgroups OOM kill (`code 137`), eliminating wall-clock coupling.
4. **Asynchronous Container Cleanup**: `killContainerAsync` invokes non-blocking `spawn('docker', ['rm', '-f'])` with a 5000ms safety timeout; timeout/flood kills do not block the host Node event loop.
5. **Scope Cut Executed**: 11 non-core modules (`BrowserAgent`, `VisionPerception`, `AudioPerception`, `VoiceKernel`, `ClusterNode`, `CRDTStore`, `GeneticOptimizer`, `ArenaJudge`, `MCTSEngine`, `SpeculativeEngine`, `HegelianEngine`) moved to `packages/core/src/experimental/`.
6. **Kernel & Microkernel Decoupled**: `AetherKernel` stripped to core synthesis loop (`CognitiveBus`, `Sandbox`, `ASTVerifier`, `ToolForge`, `ToolRegistry`, `ModelProvider`, core agents); FlowScript interpreter and CLI updated.
7. **CI Pipeline Configured**: `.github/workflows/ci.yml` added running typecheck, lint, audit, build, docker image pre-pull, tests, and mutation verification with `--unhandled-rejections=strict`.
8. **Real Mutation Verification**: Automated mutation runner verifies that all 7 Docker containment layers and all 6 Subprocess containment layers catch attacks with real test failures.
9. **Zero Container Leaks**: `docker ps -a` confirms zero leftover containers after timeouts and memory bombs.
10. **Still Unverified**: Real LLM synthesis accuracy across diverse multi-turn coding benchmarks (only MockProvider tested in CI); warm container pooling under high concurrency.

---

## 2. RAW TEST OUTPUT

Full unedited output from `npm test` executed with default Docker mode:

```text
> aether-flow-monorepo@1.0.0 test
> npm run test --workspaces --if-present


> @aether-flow/core@1.0.0 test
> node --test --test-concurrency=1 dist/**/*.test.js

✔ Sandbox executes JS code securely in Docker mode and captures logs (1421.3949ms)
✔ ToolRegistry executes pre-registered tools [sample-value check on text_analyzer] (1.7596ms)
✔ VectorMemory embeds, inserts, and retrieves nearest neighbors (7.0412ms)
✔ KnowledgeGraph connects entities and computes BFS shortest paths (2.9435ms)
✔ SecurityFirewall blocks malicious injections and masks PII (3.5836ms)
✔ SymbolicSolver proves SAT satisfiability and validates numeric bounds (2.0041ms)
✔ FlowScript Compiler tokenizes and parses .flow DSL script into AST (2.9201ms)
✔ CheckpointEngine snapshots state and creates divergent time-travel forks (0.9824ms)
✔ AetherKernel synthesizes and verifies a dynamic tool in Sandbox [MockProvider] (2574.2543ms)
✔ AetherKernel end-to-end goal execution with plan synthesis and verified execution [MockProvider] (3325.3434ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ ASTVerifier blocks prototype constructor chain breakout (26.698ms)
✔ ASTVerifier blocks computed string concatenation constructor evasion (3.3858ms)
✔ ASTVerifier blocks template literal constructor evasion (2.4689ms)
✔ ASTVerifier blocks prototype pollution via __proto__ (2.2779ms)
✔ ASTVerifier blocks dynamic import expressions (6.0406ms)
✔ ASTVerifier blocks eval and new Function identifiers (1.7856ms)
✔ ASTVerifier blocks static while(true) infinite loops (1.6818ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Known AST bypass: computed key via Array.join is missed by AST but contained by Sandbox (1916.0506ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Known AST bypass: Reflect.get with String.fromCharCode is missed by AST but contained by Sandbox (1693.6816ms)
✔ Sandbox fails closed: subprocess mode without unsafeDevMode throws immediately (3.8857ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox blocks prototype constructor chain breakout (192.7659ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox blocks args.constructor.constructor breakout (135.3187ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox blocks eval() via engine-level string compilation disallowance (134.1489ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox environment is clean: host process.env is inaccessible in VM (146.6631ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox strips host environment variables (no host secrets accessible) (142.7125ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox blocks filesystem read outside sandbox (fs / require) (138.0154ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox blocks outbound network connection attempts (fetch / net) (145.1884ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox blocks access to process.binding and process.mainModule (135.9498ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox output caps terminate execution on unbounded output flooding (145.4556ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox fails safely when return value exceeds maximum result size (173.6406ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox hard timeout terminates synchronous CPU infinite loop (828.5968ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox hard timeout terminates asynchronous microtask loop (826.3681ms)
✔ [subprocess] Sandbox caps heap memory and fails safely on memory exhaustion attempt (310.4955ms)
✔ [docker] Sandbox blocks prototype constructor chain breakout (2416.2924ms)
✔ [docker] Sandbox blocks args.constructor.constructor breakout (2018.3794ms)
✔ [docker] Sandbox blocks eval() via engine-level string compilation disallowance (2151.8823ms)
✔ [docker] Sandbox environment is clean: host process.env is inaccessible in VM (1343.8209ms)
✔ [docker] Sandbox strips host environment variables (no host secrets accessible) (1368.5291ms)
✔ [docker] Sandbox blocks filesystem read outside sandbox (fs / require) (1380.9233ms)
✔ [docker] Sandbox blocks outbound network connection attempts (fetch / net) (2512.9104ms)
✔ [docker] Sandbox blocks access to process.binding and process.mainModule (2159.1759ms)
✔ [docker] Sandbox output caps terminate execution on unbounded output flooding (1634.4143ms)
✔ [docker] Sandbox fails safely when return value exceeds maximum result size (1192.6573ms)
✔ [docker] Sandbox hard timeout terminates synchronous CPU infinite loop (1993.1628ms)
✔ [docker] Sandbox hard timeout terminates asynchronous microtask loop (2087.1279ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [docker] Sandbox caps heap memory and fails safely on memory exhaustion attempt (1479.7768ms)
✔ VM Context Realm Isolation: sandboxed code cannot mutate runner JSON.stringify, Array.prototype, or Object.prototype (189.7109ms)
✔ Docker network isolation Test 1: Real flag list cannot connect to host TCP listener (0 connections) (6615.0625ms)
✔ Docker network isolation Test 2 (control): Omitting --network none MUST connect to host listener (1323.2272ms)
✔ Docker probe: container runs as non-root user node (uid 1000) (1607.3639ms)
✔ Docker probe: container filesystem is strictly read-only (touch /x fails) (949.8176ms)
✔ Docker probe: container Linux capabilities are dropped (CapBnd is 0) (1040.2391ms)
✔ Docker probe: container pids limit is enforced (pids.max is 64) (808.7279ms)
✔ Docker probe: container memory limit is enforced (memory.max matches 64MB) (1033.8897ms)
✔ Docker mode host-side stderr flooding is terminated by output limit cap (1242.4574ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Docker container is killed and removed after timeout (verified via docker ps -a) (1701.9217ms)
✔ ArrayBuffer memory bomb analysis: timeout vs memory cap in each mode (5121.422ms)
ℹ tests 57
ℹ suites 0
ℹ pass 57
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 62024.5159
```

### Sandbox Execution Mode Breakdown (57 Tests)
- **10 Core Tests (`kernel.test.ts`)**:
  - 3 run in `docker` mode (`Sandbox executes JS code...`, `AetherKernel synthesizes...`, `AetherKernel end-to-end...`).
  - 7 test in-memory data structures / parsers / SAT solvers without sandbox.
- **47 Security Tests (`sandbox-escape.test.ts`)**:
  - 7 Static AST analysis tests (`ASTVerifier blocks...`).
  - 2 Known AST bypass containment tests (run in both `subprocess` and `docker` modes).
  - 1 Fail-closed contract verification test (verifies error throw without `unsafeDevMode`).
  - 13 Adversarial attack tests in `subprocess` mode (`[subprocess] ...`).
  - 13 Adversarial attack tests in `docker` mode (`[docker] ...`).
  - 1 VM realm prototype isolation test (`subprocess` runner context verification).
  - 2 Docker network isolation tests (`docker` mode with TCP listener probe + control).
  - 5 Docker probe tests (`docker` mode direct flag probes: user, read-only, caps, pids, memory).
  - 1 Docker host-side stderr flooding test (`docker` mode).
  - 1 Docker container timeout cleanup test (`docker` mode with `docker ps -a` probe).
  - 1 ArrayBuffer memory bomb analysis test (parameterized comparison across both modes).

---

## 3. MUTATION RESULTS

### Docker Mode Mutation Verification (`node scripts/verify_mutations.js --mode=docker`)

```text
================================================================
       REAL DEFENSE-IN-DEPTH MUTATION VERIFICATION RUNNER       
  Mode: DOCKER | Total Layers: 7
  Each mutation is applied to source, rebuilt, tested, and parsed
================================================================

▶ [Layer 1/7] Docker Layer 1: Network Isolation (--network none)
  Description: Remove --network none from buildDockerArgs
  ✔ Real tests that failed under this mutation (1):
    ✖ Docker network isolation Test 1: Real flag list cannot connect to host TCP listener (0 connections)

▶ [Layer 2/7] Docker Layer 2: Non-Root Execution (--user node)
  Description: Remove --user node from buildDockerArgs (runs container as root uid 0)
  ✔ Real tests that failed under this mutation (1):
    ✖ Docker probe: container runs as non-root user node (uid 1000)

▶ [Layer 3/7] Docker Layer 3: Read-Only Filesystem (--read-only)
  Description: Remove --read-only from buildDockerArgs (allows filesystem modifications)
  ✔ Real tests that failed under this mutation (1):
    ✖ Docker probe: container filesystem is strictly read-only (touch /x fails)

▶ [Layer 4/7] Docker Layer 4: Capability Dropping (--cap-drop=ALL)
  Description: Remove --cap-drop=ALL from buildDockerArgs (retains default Linux capabilities)
  ✔ Real tests that failed under this mutation (1):
    ✖ Docker probe: container Linux capabilities are dropped (CapBnd is 0)

▶ [Layer 5/7] Docker Layer 5: Process Limit (--pids-limit=64)
  Description: Remove --pids-limit=64 from buildDockerArgs (unconstrained fork bombing)
  ✔ Real tests that failed under this mutation (1):
    ✖ Docker probe: container pids limit is enforced (pids.max is 64)

▶ [Layer 6/7] Docker Layer 6: Memory Limit (--memory & --memory-swap)
  Description: Remove both --memory= and --memory-swap= from buildDockerArgs
  ✔ Real tests that failed under this mutation (2):
    ✖ Docker probe: container memory limit is enforced (memory.max matches 64MB)
    ✖ ArrayBuffer memory bomb analysis: timeout vs memory cap in each mode

▶ [Layer 7/7] Docker Layer 7: Host-Side Stderr Streaming Flood Cap
  Description: Disable host-side stderrBytes > maxOutputBytes kill check in executeDocker
  ✔ Real tests that failed under this mutation (2):
    ✖ [docker] Sandbox output caps terminate execution on unbounded output flooding
    ✖ Docker mode host-side stderr flooding is terminated by output limit cap

================================================================
                      MUTATION RUN SUMMARY                      
================================================================
✔ [DOCKER] Docker Layer 1: Network Isolation (--network none): 1 real test(s) failed
✔ [DOCKER] Docker Layer 2: Non-Root Execution (--user node): 1 real test(s) failed
✔ [DOCKER] Docker Layer 3: Read-Only Filesystem (--read-only): 1 real test(s) failed
✔ [DOCKER] Docker Layer 4: Capability Dropping (--cap-drop=ALL): 1 real test(s) failed
✔ [DOCKER] Docker Layer 5: Process Limit (--pids-limit=64): 1 real test(s) failed
✔ [DOCKER] Docker Layer 6: Memory Limit (--memory & --memory-swap): 2 real test(s) failed
✔ [DOCKER] Docker Layer 7: Host-Side Stderr Streaming Flood Cap: 2 real test(s) failed
================================================================
```

### Subprocess Mode Mutation Verification (`node scripts/verify_mutations.js --mode=subprocess`)

```text
================================================================
       REAL DEFENSE-IN-DEPTH MUTATION VERIFICATION RUNNER       
  Mode: SUBPROCESS | Total Layers: 6
  Each mutation is applied to source, rebuilt, tested, and parsed
================================================================

▶ [Layer 1/6] Subprocess Layer 1: Static AST Verifier (Static Lint Layer)
  Description: Bypass AST verification (force isSafe = true and clear banned patterns)
  ✔ Real tests that failed under this mutation (7):
    ✖ ASTVerifier blocks prototype constructor chain breakout
    ✖ ASTVerifier blocks computed string concatenation constructor evasion
    ✖ ASTVerifier blocks template literal constructor evasion
    ✖ ASTVerifier blocks prototype pollution via __proto__
    ✖ ASTVerifier blocks dynamic import expressions
    ✖ ASTVerifier blocks eval and new Function identifiers
    ✖ ASTVerifier blocks static while(true) infinite loops

▶ [Layer 2/6] Subprocess Layer 2: VM Context Lockdown & Isolated Realm
  Description: Expose dangerous require() and fetch() globals directly in contextGlobals
  ✔ Real tests that failed under this mutation (2):
    ✖ [subprocess] Sandbox blocks filesystem read outside sandbox (fs / require)
    ✖ [subprocess] Sandbox blocks outbound network connection attempts (fetch / net)

▶ [Layer 3/6] Subprocess Layer 3: V8 Engine Flags (--disallow-code-generation-from-strings)
  Description: Remove V8 string compilation disallowance from child process flags and VM context
  ✔ Real tests that failed under this mutation (4):
    ✖ Known AST bypass: computed key via Array.join is missed by AST but contained by Sandbox
    ✖ Known AST bypass: Reflect.get with String.fromCharCode is missed by AST but contained by Sandbox
    ✖ [subprocess] Sandbox blocks prototype constructor chain breakout
    ✖ [subprocess] Sandbox blocks eval() via engine-level string compilation disallowance

▶ [Layer 4/6] Subprocess Layer 4: Environment Stripping (env: {})
  Description: Leak host process.env into spawned child process (change env: {} to env: process.env)
  ✔ Real tests that failed under this mutation (1):
    ✖ [subprocess] Sandbox strips host environment variables (no host secrets accessible)

▶ [Layer 5/6] Subprocess Layer 5: Authoritative Timeout Kill
  Description: Disable child process kill timer on execution timeout
  ✔ Real tests that failed under this mutation (1):
    ✖ [subprocess] Sandbox hard timeout terminates asynchronous microtask loop

▶ [Layer 6/6] Subprocess Layer 6: Output Limits Cap
  Description: Disable stdout flooding byte cap and serialized result size cap
  ✔ Real tests that failed under this mutation (2):
    ✖ [subprocess] Sandbox output caps terminate execution on unbounded output flooding
    ✖ [subprocess] Sandbox fails safely when return value exceeds maximum result size

================================================================
                      MUTATION RUN SUMMARY                      
================================================================
✔ [SUBPROCESS] Subprocess Layer 1: Static AST Verifier (Static Lint Layer): 7 real test(s) failed
✔ [SUBPROCESS] Subprocess Layer 2: VM Context Lockdown & Isolated Realm: 2 real test(s) failed
✔ [SUBPROCESS] Subprocess Layer 3: V8 Engine Flags (--disallow-code-generation-from-strings): 4 real test(s) failed
✔ [SUBPROCESS] Subprocess Layer 4: Environment Stripping (env: {}): 1 real test(s) failed
✔ [SUBPROCESS] Subprocess Layer 5: Authoritative Timeout Kill: 1 real test(s) failed
✔ [SUBPROCESS] Subprocess Layer 6: Output Limits Cap: 2 real test(s) failed
================================================================
```

---

## 4. DOCKER PROOF

### Docker Version
```text
Docker version 29.9.2, build a82e528
```

### Exact `docker run` Command Line Built by `Sandbox.buildDockerArgs()`
```bash
docker run \
  --name aether-sandbox-<timestamp>-<random> \
  --rm \
  -i \
  --network none \
  --read-only \
  --user node \
  --security-opt no-new-privileges \
  --memory=64m \
  --memory-swap=64m \
  --cpus=1.0 \
  --pids-limit=64 \
  --cap-drop=ALL \
  -v C:/aether-flow/packages/core/dist/tools/docker-runner.cjs:/sandbox/runner.cjs:ro \
  node:lts-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 \
  node --disallow-code-generation-from-strings /sandbox/runner.cjs
```

### Verification of Container Clean-up (`docker ps -a`)
Run immediately following execution of timeouts, infinite loops, and ArrayBuffer memory bomb tests:

```text
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```
*(Exit code 0, 0 leftover containers).*

---

## 6. GIT DIFF & FILE LIST

### `git diff --stat`

```text
 .github/workflows/ci.yml                           |  35 +-
 README.md                                          | 377 ++++++-------
 benchmarks/run_benchmarks.js                       |  48 +-
 docs/MATHEMATICAL_FOUNDATIONS.md                   |  89 +--
 package.json                                       |   3 +-
 packages/cli/package.json                          |   2 +
 packages/cli/src/repl.ts                           |  37 +-
 packages/core/package.json                         |   7 +-
 packages/core/src/experimental/ArenaJudge.ts       |   5 +
 packages/core/src/experimental/AudioPerception.ts  |   1 +
 packages/core/src/experimental/BrowserAgent.ts     |   1 +
 packages/core/src/experimental/ClusterNode.ts      |   1 +
 packages/core/src/experimental/GeneticOptimizer.ts |   1 +
 packages/core/src/experimental/VisionPerception.ts |   1 +
 packages/core/src/experimental/VoiceKernel.ts      |   5 +
 packages/core/src/formal/SymbolicSolver.ts         |  12 +-
 packages/core/src/index.ts                         |  19 +-
 packages/core/src/kernel/AetherKernel.ts           | 148 ++---
 packages/core/src/tests/kernel.test.ts             |  76 +--
 packages/core/src/tools/ASTVerifier.ts             | 202 +++++--
 packages/core/src/tools/Sandbox.ts                 | 628 ++++++++++++++++++---
 packages/core/src/types.ts                         |   2 +
 packages/web/server.js                             |  15 +-
 23 files changed, 1132 insertions(+), 583 deletions(-)
```

### Changed Files Outside Security Core
1. `package.json`: Added `typecheck: tsc --noEmit`.
2. `packages/cli/package.json`: Added `typecheck` and `lint` scripts.
3. `packages/cli/src/repl.ts`: Replaced experimental `/mcts` and `/eval` commands with `/synth`, printing honest notices.
4. `packages/core/package.json`: Added `typecheck` and `lint` scripts.
5. `packages/core/src/index.ts`: Decoupled experimental modules; exposed them under `export * as experimental from './experimental/index.js'`.
6. `packages/core/src/types.ts`: Added `sandboxMode` and `unsafeDevMode` to `KernelConfig`.
7. `packages/core/src/tests/kernel.test.ts`: Removed CRDTStore test; added dynamic tool synthesis & verified sandbox execution tests.
8. `packages/core/src/kernel/AetherKernel.ts`: Stripped experimental imports and fields; core focuses strictly on tool synthesis loop.
9. `packages/web/server.js`: Decoupled experimental imports to use `experimental.*` namespace.
10. `benchmarks/run_benchmarks.js`: Decoupled experimental modules; updated to benchmark honest Docker execution latency.
11. `README.md`: Honest v0.1 scope documentation, cold-start latency disclosure, and 57 verified tests report.
12. `docs/MATHEMATICAL_FOUNDATIONS.md`: Formal verification notes.

---

## 7. STILL UNVERIFIED LIST

1. **Warm Container Pooling**: Under production concurrency, spinning up ephemeral containers per request incurs ~1,000ms–1,500ms latency. Container reuse with isolated worker recycling is not yet implemented.
2. **Real Multi-Turn LLM Synthesis with Live Gemini/OpenAI Keys**: All CI and local test suites run against `MockProvider`. While the sandbox and AST layers are thoroughly verified against real adversarial payloads, model prompt adherence on complex tool generation is unverified on live APIs.
3. **Multi-File Package Synthesis**: `ToolForge` currently synthesizes single-file JavaScript modules exporting an `execute(args)` default function. Synthesis of multi-file packages or tools with npm dependencies in sandbox is out of v0.1 scope.
4. **Linux cgroups v1 vs v2 Uniformity**: Docker cgroups limits were verified on modern Docker Desktop (cgroups v2). Older Linux kernels running cgroups v1 may exhibit slight differences in memory swap constraint reporting.
