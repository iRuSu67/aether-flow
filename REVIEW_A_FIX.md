# REVIEW_A_FIX.md: Checkpoint A-Fix Verification Report

## 1. Summary of Changes & Fixes

1. **Linux Docker `host.docker.internal` DNS Resolution & Test Flag Injection:**
   - **Root Cause:** In Linux environments (such as standard GitHub Actions `ubuntu-latest` runners), `host.docker.internal` is not automatically registered by Docker Engine as it is on Docker Desktop (macOS/Windows).
   - **Resolution:** Added `--add-host=host.docker.internal:host-gateway` exclusively via test `customArgs` in `packages/core/src/tests/sandbox-escape.test.ts` (never in default production flags, preserving complete network isolation `--network none`).
   - **Assertions:** Network isolation Test 1 explicitly asserts that the failure is an authentic connection/network failure (`ENETUNREACH`, `EHOSTUNREACH`, `ECONNREFUSED`, or `ETIMEDOUT`) and strictly asserts `!stderr.includes('ENOTFOUND')` and `!stderr.includes('EAI_AGAIN')` (confirming DNS resolved successfully to the host gateway). Control Test 2 connects directly to the host listener (`CONNECTED_DEFAULT`, hostConnections $\ge 1$, status 0).
   - **Verification on Linux/CI:** Push to a branch; GitHub Actions `.github/workflows/ci.yml` will automatically execute `npm test` on `ubuntu-latest` against Docker Engine.

2. **Container Lifecycle Optimization (`killContainerAsync`):**
   - **Previous Inefficiency:** `executeDocker()` invoked `await this.killContainerAsync(containerName)` on every container close, spawning `docker rm -f <name>` even on normal exits. This introduced several hundred milliseconds of blocking process-spawn overhead to every sandbox execution.
   - **Optimization:** Normal exits with successful output bypass `killContainerAsync()` completely, allowing Docker's native `--rm` flag to remove the container asynchronously with zero blocking overhead. `killContainerAsync()` is now only triggered on execution timeout (`timedOut`), output flooding cap overflow (`outputExceeded`), or process spawn error, and is not awaited before returning normal results.
   - **Latency Improvement:**
     - `Sandbox executes JS code securely in Docker mode`: decreased from **3,683ms** to **845ms**.
     - `AetherKernel synthesizes and verifies a dynamic tool in Sandbox`: decreased from **6,213ms** to **1,866ms**.
     - Full test suite duration: decreased from **94,049ms** to **42,235ms** (over a **2.2x speedup**).

3. **Unified Execution Runner (`sandbox-runner.ts`):**
   - Merged `subprocess-runner.ts` and `docker-runner.cjs` into a single, unified TypeScript runner: `packages/core/src/tools/sandbox-runner.ts`.
   - Docker mounts the compiled file at `/sandbox/runner.mjs:ro` and invokes `node --disallow-code-generation-from-strings /sandbox/runner.mjs`.
   - Subprocess mode invokes the exact same compiled script with identical context isolation and payload parsing.
   - Parameterized `VM Context Realm Isolation` across both `subprocess` and `docker` modes.
   - Added Docker VM-layer mutations (Layer 8: Context Lockdown, Layer 9: V8 Engine Flags) into `scripts/verify_mutations.js`, verifying that VM security boundaries are actively tested in Docker mode as well.

4. **Per-Test Mode Logging & Explanation of Stray Security Warning:**
   - Every security test in `sandbox-escape.test.ts` now logs its explicit execution mode (`[MODE: static-ast]`, `[MODE: subprocess]`, `[MODE: docker]`, `[MODE: subprocess+docker]`, `[MODE: contract-check]`).
   - **Explanation of Stray Insecure-Mode Warning:** The warning `[SECURITY WARNING] Running Sandbox in insecure subprocess mode...` previously printed right before `[docker] Sandbox caps heap memory` because `packages/core/dist` had not been rebuilt after editing the test order, leaving an unparameterized `test('VM Context Realm Isolation')` with `mode: 'subprocess', unsafeDevMode: true` positioned immediately between the asynchronous timeout test and the heap test. Parameterizing all tests in the `for (const mode of MODES)` loop grouped all subprocess tests and docker tests cleanly, completely eliminating the stray warning before Docker tests.

5. **CI Node Matrix Modernization:**
   - Updated `.github/workflows/ci.yml` matrix from `[ 20.x, 22.x ]` to `[ 22.x, 24.x ]`. Node 20 reached official End-of-Life on April 30, 2026. Node 22 (Maintenance LTS) and Node 24 (Active LTS) are the current supported Node LTS releases.

---

## 2. Raw Test Output (`npm test`)

```
> aether-flow-monorepo@1.0.0 test
> npm run test --workspaces --if-present


> @aether-flow/core@1.0.0 test
> node --test --test-concurrency=1 dist/**/*.test.js

✔ Sandbox executes JS code securely in Docker mode and captures logs (845.1655ms)
✔ ToolRegistry executes pre-registered tools [sample-value check on text_analyzer] (1.2943ms)
✔ VectorMemory embeds, inserts, and retrieves nearest neighbors (1.4418ms)
✔ KnowledgeGraph connects entities and computes BFS shortest paths (1.871ms)
✔ SecurityFirewall blocks malicious injections and masks PII (2.1715ms)
✔ SymbolicSolver proves SAT satisfiability and validates numeric bounds (0.9518ms)
✔ FlowScript Compiler tokenizes and parses .flow DSL script into AST (1.8571ms)
✔ CheckpointEngine snapshots state and creates divergent time-travel forks (0.5521ms)
✔ AetherKernel synthesizes and verifies a dynamic tool in Sandbox [MockProvider] (1866.063ms)
✔ AetherKernel end-to-end goal execution with plan synthesis and verified execution [MockProvider] (1905.146ms)
  [MODE: static-ast] ASTVerifier blocks prototype constructor chain breakout
  [MODE: static-ast] ASTVerifier blocks computed string concatenation constructor evasion
  [MODE: static-ast] ASTVerifier blocks template literal constructor evasion
  [MODE: static-ast] ASTVerifier blocks prototype pollution via __proto__
  [MODE: static-ast] ASTVerifier blocks dynamic import expressions
  [MODE: static-ast] ASTVerifier blocks eval and new Function identifiers
  [MODE: static-ast] ASTVerifier blocks static while(true) infinite loops
  [MODE: subprocess+docker] Known AST bypass: computed key via Array.join
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ ASTVerifier blocks prototype constructor chain breakout (20.1978ms)
✔ ASTVerifier blocks computed string concatenation constructor evasion (3.4578ms)
✔ ASTVerifier blocks template literal constructor evasion (2.6293ms)
✔ ASTVerifier blocks prototype pollution via __proto__ (1.9773ms)
✔ ASTVerifier blocks dynamic import expressions (2.2085ms)
✔ ASTVerifier blocks eval and new Function identifiers (1.7986ms)
✔ ASTVerifier blocks static while(true) infinite loops (4.2744ms)
  [MODE: subprocess+docker] Known AST bypass: Reflect.get with String.fromCharCode
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Known AST bypass: computed key via Array.join is missed by AST but contained by Sandbox (1232.4128ms)
  [MODE: contract-check] Sandbox fails closed: subprocess mode without unsafeDevMode throws
  [MODE: subprocess] Sandbox blocks prototype constructor chain breakout
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Known AST bypass: Reflect.get with String.fromCharCode is missed by AST but contained by Sandbox (1146.5205ms)
✔ Sandbox fails closed: subprocess mode without unsafeDevMode throws immediately (2.8339ms)
  [MODE: subprocess] Sandbox blocks args.constructor.constructor breakout
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox blocks prototype constructor chain breakout (131.9664ms)
  [MODE: subprocess] Sandbox blocks eval() via engine-level string compilation disallowance
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox blocks args.constructor.constructor breakout (134.5316ms)
  [MODE: subprocess] Sandbox environment is clean: host process.env is inaccessible in VM
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox blocks eval() via engine-level string compilation disallowance (162.94ms)
  [MODE: subprocess] Sandbox strips host environment variables (no host secrets accessible)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox environment is clean: host process.env is inaccessible in VM (121.1488ms)
  [MODE: subprocess] Sandbox blocks filesystem read outside sandbox (fs / require)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox strips host environment variables (no host secrets accessible) (122.4256ms)
  [MODE: subprocess] Sandbox blocks outbound network connection attempts (fetch / net)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox blocks filesystem read outside sandbox (fs / require) (124.0923ms)
  [MODE: subprocess] Sandbox blocks access to process.binding and process.mainModule
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox blocks outbound network connection attempts (fetch / net) (114.3111ms)
  [MODE: subprocess] Sandbox output caps terminate execution on unbounded output flooding
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox blocks access to process.binding and process.mainModule (120.2594ms)
  [MODE: subprocess] Sandbox fails safely when return value exceeds maximum result size
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox output caps terminate execution on unbounded output flooding (124.6255ms)
  [MODE: subprocess] Sandbox hard timeout terminates synchronous CPU infinite loop
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox fails safely when return value exceeds maximum result size (138.4115ms)
  [MODE: subprocess] Sandbox hard timeout terminates asynchronous microtask loop
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox hard timeout terminates synchronous CPU infinite loop (776.284ms)
  [MODE: subprocess] Sandbox caps heap memory and fails safely on memory exhaustion attempt
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox hard timeout terminates asynchronous microtask loop (828.9094ms)
  [MODE: subprocess] VM Context Realm Isolation: sandboxed code cannot mutate runner prototypes
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ [subprocess] Sandbox caps heap memory and fails safely on memory exhaustion attempt (273.1061ms)
  [MODE: docker] Sandbox blocks prototype constructor chain breakout
✔ [subprocess] VM Context Realm Isolation: sandboxed code cannot mutate runner JSON.stringify, Array.prototype, or Object.prototype (137.8282ms)
  [MODE: docker] Sandbox blocks args.constructor.constructor breakout
✔ [docker] Sandbox blocks prototype constructor chain breakout (1531.1584ms)
  [MODE: docker] Sandbox blocks eval() via engine-level string compilation disallowance
✔ [docker] Sandbox blocks args.constructor.constructor breakout (876.8309ms)
  [MODE: docker] Sandbox environment is clean: host process.env is inaccessible in VM
✔ [docker] Sandbox blocks eval() via engine-level string compilation disallowance (994.7468ms)
  [MODE: docker] Sandbox strips host environment variables (no host secrets accessible)
✔ [docker] Sandbox environment is clean: host process.env is inaccessible in VM (1731.5949ms)
  [MODE: docker] Sandbox blocks filesystem read outside sandbox (fs / require)
✔ [docker] Sandbox strips host environment variables (no host secrets accessible) (851.9986ms)
  [MODE: docker] Sandbox blocks outbound network connection attempts (fetch / net)
✔ [docker] Sandbox blocks filesystem read outside sandbox (fs / require) (1059.1082ms)
  [MODE: docker] Sandbox blocks access to process.binding and process.mainModule
✔ [docker] Sandbox blocks outbound network connection attempts (fetch / net) (956.1607ms)
  [MODE: docker] Sandbox output caps terminate execution on unbounded output flooding
✔ [docker] Sandbox blocks access to process.binding and process.mainModule (822.7821ms)
  [MODE: docker] Sandbox fails safely when return value exceeds maximum result size
✔ [docker] Sandbox output caps terminate execution on unbounded output flooding (1013.5074ms)
  [MODE: docker] Sandbox hard timeout terminates synchronous CPU infinite loop
✔ [docker] Sandbox fails safely when return value exceeds maximum result size (883.6609ms)
  [MODE: docker] Sandbox hard timeout terminates asynchronous microtask loop
✔ [docker] Sandbox hard timeout terminates synchronous CPU infinite loop (1861.6989ms)
  [MODE: docker] Sandbox caps heap memory and fails safely on memory exhaustion attempt
✔ [docker] Sandbox hard timeout terminates asynchronous microtask loop (1879.1889ms)
  [MODE: docker] VM Context Realm Isolation: sandboxed code cannot mutate runner prototypes
✔ [docker] Sandbox caps heap memory and fails safely on memory exhaustion attempt (1100.547ms)
  [MODE: docker] Docker network isolation Test 1: Real flag list cannot connect to host TCP listener
  [MODE: docker] Docker network isolation Test 2 (control): Omitting --network none MUST connect to host listener
✔ [docker] VM Context Realm Isolation: sandboxed code cannot mutate runner JSON.stringify, Array.prototype, or Object.prototype (924.0443ms)
✔ Docker network isolation Test 1: Real flag list cannot connect to host TCP listener (0 connections) (750.4533ms)
  [MODE: docker] Docker probe: container runs as non-root user node (uid 1000)
  [MODE: docker] Docker probe: container filesystem is strictly read-only
  [MODE: docker] Docker probe: container Linux capabilities are dropped
  [MODE: docker] Docker probe: container pids limit is enforced
  [MODE: docker] Docker probe: container memory limit is enforced
  [MODE: docker] Docker mode host-side stderr flooding is terminated by output limit cap
✔ Docker network isolation Test 2 (control): Omitting --network none MUST connect to host listener (936.9275ms)
✔ Docker probe: container runs as non-root user node (uid 1000) (642.7756ms)
✔ Docker probe: container filesystem is strictly read-only (touch /x fails) (666.7878ms)
✔ Docker probe: container Linux capabilities are dropped (CapBnd is 0) (605.8971ms)
✔ Docker probe: container pids limit is enforced (pids.max is 64) (615.9397ms)
✔ Docker probe: container memory limit is enforced (memory.max matches 64MB) (633.858ms)
  [MODE: docker] Docker container is killed and removed after timeout
✔ Docker mode host-side stderr flooding is terminated by output limit cap (874.9449ms)
  [MODE: subprocess+docker] ArrayBuffer memory bomb analysis: timeout vs memory cap in each mode
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Docker container is killed and removed after timeout (verified via docker ps -a) (1722.7694ms)
✔ ArrayBuffer memory bomb analysis: timeout vs memory cap in each mode (5874.4341ms)
ℹ tests 58
ℹ suites 0
ℹ pass 58
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 42235.2166
```

---

## 3. Raw Docker Mutation Verification Output (`--mode=docker`)

```
================================================================
       REAL DEFENSE-IN-DEPTH MUTATION VERIFICATION RUNNER       
  Mode: DOCKER | Total Layers: 9
  Each mutation is applied to source, rebuilt, tested, and parsed
================================================================

▶ [Layer 1/9] Docker Layer 1: Network Isolation (--network none)
  Description: Remove --network none from buildDockerArgs flag list
  ✔ Real tests that failed under this mutation (1):
    ✖ Docker network isolation Test 1: Real flag list cannot connect to host TCP listener (0 connections)

▶ [Layer 2/9] Docker Layer 2: Non-Root User Isolation (--user node)
  Description: Remove --user node from buildDockerArgs flag list (defaults to root)
  ✔ Real tests that failed under this mutation (1):
    ✖ Docker probe: container runs as non-root user node (uid 1000)

▶ [Layer 3/9] Docker Layer 3: Read-Only Root Filesystem (--read-only)
  Description: Remove --read-only from buildDockerArgs flag list
  ✔ Real tests that failed under this mutation (1):
    ✖ Docker probe: container filesystem is strictly read-only (touch /x fails)

▶ [Layer 4/9] Docker Layer 4: Capability Dropping (--cap-drop=ALL)
  Description: Remove --cap-drop=ALL from buildDockerArgs flag list
  ✔ Real tests that failed under this mutation (1):
    ✖ Docker probe: container Linux capabilities are dropped (CapBnd is 0)

▶ [Layer 5/9] Docker Layer 5: Process Fork Bomb Containment (--pids-limit=64)
  Description: Remove --pids-limit=64 from buildDockerArgs flag list
  ✔ Real tests that failed under this mutation (1):
    ✖ Docker probe: container pids limit is enforced (pids.max is 64)

▶ [Layer 6/9] Docker Layer 6: Memory Cgroups Limit (--memory=64m)
  Description: Remove --memory=64m and --memory-swap=64m from buildDockerArgs flag list
  ✔ Real tests that failed under this mutation (3):
    ✖ [docker] VM Context Realm Isolation: sandboxed code cannot mutate runner JSON.stringify, Array.prototype, or Object.prototype
    ✖ Docker probe: container memory limit is enforced (memory.max matches 64MB)
    ✖ ArrayBuffer memory bomb analysis: timeout vs memory cap in each mode

▶ [Layer 7/9] Docker Layer 7: Host-Side Stderr Output Flooding Cap
  Description: Disable host-side stderr cap and container runner log cap in Docker mode
  ✔ Real tests that failed under this mutation (3):
    ✖ [subprocess] Sandbox output caps terminate execution on unbounded output flooding
    ✖ [docker] Sandbox output caps terminate execution on unbounded output flooding
    ✖ Docker mode host-side stderr flooding is terminated by output limit cap

▶ [Layer 8/9] Docker Layer 8: VM Context Lockdown & Isolated Realm (Docker Mode)
  Description: Expose dangerous require() and fetch() globals directly in contextGlobals in mounted runner
  ✔ Real tests that failed under this mutation (4):
    ✖ [subprocess] Sandbox blocks filesystem read outside sandbox (fs / require)
    ✖ [subprocess] Sandbox blocks outbound network connection attempts (fetch / net)
    ✖ [docker] Sandbox blocks filesystem read outside sandbox (fs / require)
    ✖ [docker] Sandbox blocks outbound network connection attempts (fetch / net)

▶ [Layer 9/9] Docker Layer 9: V8 Engine Flags in Docker Mode (--disallow-code-generation-from-strings)
  Description: Remove V8 string compilation disallowance from Docker command and VM context
  ✔ Real tests that failed under this mutation (5):
    ✖ Known AST bypass: computed key via Array.join is missed by AST but contained by Sandbox
    ✖ Known AST bypass: Reflect.get with String.fromCharCode is missed by AST but contained by Sandbox
    ✖ [subprocess] Sandbox blocks eval() via engine-level string compilation disallowance
    ✖ [docker] Sandbox blocks prototype constructor chain breakout
    ✖ [docker] Sandbox blocks eval() via engine-level string compilation disallowance

================================================================
                      MUTATION RUN SUMMARY                      
================================================================
✔ [DOCKER] Docker Layer 1: Network Isolation (--network none): 1 real test(s) failed
✔ [DOCKER] Docker Layer 2: Non-Root User Isolation (--user node): 1 real test(s) failed
✔ [DOCKER] Docker Layer 3: Read-Only Root Filesystem (--read-only): 1 real test(s) failed
✔ [DOCKER] Docker Layer 4: Capability Dropping (--cap-drop=ALL): 1 real test(s) failed
✔ [DOCKER] Docker Layer 5: Process Fork Bomb Containment (--pids-limit=64): 1 real test(s) failed
✔ [DOCKER] Docker Layer 6: Memory Cgroups Limit (--memory=64m): 3 real test(s) failed
✔ [DOCKER] Docker Layer 7: Host-Side Stderr Output Flooding Cap: 3 real test(s) failed
✔ [DOCKER] Docker Layer 8: VM Context Lockdown & Isolated Realm (Docker Mode): 4 real test(s) failed
✔ [DOCKER] Docker Layer 9: V8 Engine Flags in Docker Mode (--disallow-code-generation-from-strings): 5 real test(s) failed
================================================================
```

---

## 4. Raw Subprocess Mutation Verification Output (`--mode=subprocess`)

```
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
  ✔ Real tests that failed under this mutation (4):
    ✖ [subprocess] Sandbox blocks filesystem read outside sandbox (fs / require)
    ✖ [subprocess] Sandbox blocks outbound network connection attempts (fetch / net)
    ✖ [docker] Sandbox blocks filesystem read outside sandbox (fs / require)
    ✖ [docker] Sandbox blocks outbound network connection attempts (fetch / net)

▶ [Layer 3/6] Subprocess Layer 3: V8 Engine Flags (--disallow-code-generation-from-strings)
  Description: Remove V8 string compilation disallowance from child process flags and VM context
  ✔ Real tests that failed under this mutation (5):
    ✖ Known AST bypass: computed key via Array.join is missed by AST but contained by Sandbox
    ✖ Known AST bypass: Reflect.get with String.fromCharCode is missed by AST but contained by Sandbox
    ✖ [subprocess] Sandbox blocks prototype constructor chain breakout
    ✖ [subprocess] Sandbox blocks eval() via engine-level string compilation disallowance
    ✖ [docker] Sandbox blocks eval() via engine-level string compilation disallowance

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
  ✔ Real tests that failed under this mutation (5):
    ✖ [subprocess] Sandbox output caps terminate execution on unbounded output flooding
    ✖ [subprocess] Sandbox fails safely when return value exceeds maximum result size
    ✖ [docker] Sandbox output caps terminate execution on unbounded output flooding
    ✖ [docker] Sandbox fails safely when return value exceeds maximum result size
    ✖ Docker mode host-side stderr flooding is terminated by output limit cap

================================================================
                      MUTATION RUN SUMMARY                      
================================================================
✔ [SUBPROCESS] Subprocess Layer 1: Static AST Verifier (Static Lint Layer): 7 real test(s) failed
✔ [SUBPROCESS] Subprocess Layer 2: VM Context Lockdown & Isolated Realm: 4 real test(s) failed
✔ [SUBPROCESS] Subprocess Layer 3: V8 Engine Flags (--disallow-code-generation-from-strings): 5 real test(s) failed
✔ [SUBPROCESS] Subprocess Layer 4: Environment Stripping (env: {}): 1 real test(s) failed
✔ [SUBPROCESS] Subprocess Layer 5: Authoritative Timeout Kill: 1 real test(s) failed
✔ [SUBPROCESS] Subprocess Layer 6: Output Limits Cap: 5 real test(s) failed
================================================================
```

---

## 5. Docker Proof

### Docker Engine Version
```
Docker version 29.9.2, build a82e528
```

### Exact `docker run` Command Line Built by `buildDockerArgs()`
```javascript
[
  'run',
  '--name', 'aether-sandbox-<timestamp>-<hash>',
  '--rm',
  '-i',
  '--network', 'none',
  '--read-only',
  '--user', 'node',
  '--security-opt', 'no-new-privileges',
  '--memory=64m',
  '--memory-swap=64m',
  '--cpus=1.0',
  '--pids-limit=64',
  '--cap-drop=ALL',
  '-v', '<resolvedRunnerPath>:/sandbox/runner.mjs:ro',
  'node:lts-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53',
  'node', '--disallow-code-generation-from-strings', '/sandbox/runner.mjs'
]
```

### Residual Container Check (`docker ps -a`)
```
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```
*(Zero leftover or dangling containers remain after timeout or standard completion).*

---

## 6. Git Diff Statistics

```
 .github/workflows/ci.yml                           |  37 +-
 README.md                                          | 377 ++++++------
 benchmarks/run_benchmarks.js                       |  48 +-
 docs/MATHEMATICAL_FOUNDATIONS.md                   |  89 +--
 package.json                                       |   3 +-
 packages/cli/package.json                          |   2 +
 packages/cli/src/repl.ts                           |  37 +-
 packages/core/package.json                         |   5 +-
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
 packages/core/src/tools/Sandbox.ts                 | 635 ++++++++++++++++++---
 packages/core/src/types.ts                         |   2 +
 packages/web/server.js                             |  15 +-
 23 files changed, 1139 insertions(+), 583 deletions(-)
```

### Untracked Files Created for Checkpoint A-Fix / A2
- `EVAL_DESIGN.md` (Checkpoint A2 evaluation design specification)
- `REVIEW_A_3.md` (Full source of `sandbox-escape.test.ts` and `scripts/verify_mutations.js`)
- `REVIEW_A_4.md` (Full source of `Sandbox.ts` and `sandbox-runner.ts`)
- `REVIEW_A_FIX.md` (This document)
- `packages/core/src/tools/sandbox-runner.ts` (Unified shared runner)
- `packages/core/src/tests/sandbox-escape.test.ts` (Adversarial test suite)
- `scripts/verify_mutations.js` (Real mutation verification runner)

---

## 7. Still Unverified List

The following items are intentionally outside the frozen scope of Checkpoint A / A-fix / A2 and remain unverified until future checkpoints:
1. **Live Gemini API Evaluation Execution:** The 16 tasks defined in `EVAL_DESIGN.md` have not been executed against a live LLM model yet; implementation and benchmarking of the evaluation suite begins in Checkpoint B.
2. **Persistent Tool Synthesis Library Amortization (Condition D):** While `ToolRegistry` and `VectorMemory` have passing unit tests, end-to-end skill reuse across multiple consecutive tasks has not yet been benchmarked against a live LLM.
3. **Multi-Platform CI Verification on Linux:** All Docker and subprocess tests pass locally on Windows Docker Desktop 29.9.2 (WSL2 backend); the CI workflow updates will be verified on GitHub Actions (`ubuntu-latest`) upon git push.
